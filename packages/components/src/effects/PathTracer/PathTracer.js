import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Effects module component that enables path-traced rendering for higher quality lighting and material previews.
 */
export class PathTracer extends Component {
    static defaultConfig = {
        enable: true,
        pause: false,
        samples: 100,
        minSamples: 3,
        tiles: 3,
        resolutionScale: 1.0,

        model: null,
        environment: null,
        background: null,

        envMapIntensity: 1.0,
        envMapBlur: 0.0,

        adjustMaterials: true,
        materialConfig: {
            roughnessScale: 0.25,
            enableTransmission: true,
            transmissionIOR: 1.4
        },

        floor: {
            enabled: false,
            size: 2500,
            roughness: 0.15,
            metalness: 0.9,
            color: '#ffffff',
            generateTexture: true
        },

        filterGlossyFactor: 1,

        toneMapping: true,
        toneMappingType: 'ACESFilmic',

        transparentBackground: false,

        autoStart: true,

        onProgress: null, // (progress) => {}
        onComplete: null // () => {}
    };

    async onMounted() {
        if (!this.config.model) {
            console.warn('PathTracer: No model provided');
            return;
        }

        try {
            const module = await import('three-gpu-pathtracer');
            this.WebGLPathTracer = module.WebGLPathTracer;
            this.BlurredEnvMapGenerator = module.BlurredEnvMapGenerator;
            this.GradientEquirectTexture = module.GradientEquirectTexture;
        } catch (error) {
            console.error('PathTracer: Failed to load three-gpu-pathtracer library', error);
            console.warn('Please install: npm install three-gpu-pathtracer');
            return;
        }

        this.initializePathTracer();

        this.setupEnvironment();

        if (this.config.adjustMaterials && this.config.model) {
            this.adjustModelMaterials(this.config.model);
        }

        if (this.config.floor.enabled) {
            this.createFloor();
        }

        if (this.config.model) {
            this.scene.scene.add(this.config.model);
            this.addedModel = this.config.model;
        }

        await this.updateScene();

        this.setupCameraControls();

        if (this.config.autoStart) {
            this.start();
        }

        this.emit('mounted');
    }

    initializePathTracer() {
        const renderer = this.scene.renderer.instance;

        this.pathTracer = new this.WebGLPathTracer(renderer);
        this.pathTracer.filterGlossyFactor = this.config.filterGlossyFactor;
        this.pathTracer.minSamples = this.config.minSamples;
        this.pathTracer.renderScale = this.config.resolutionScale;
        this.pathTracer.tiles.set(this.config.tiles, this.config.tiles);

        this.originalToneMapping = renderer.toneMapping;

        if (this.config.toneMapping) {
            const toneMappingTypes = {
                Linear: THREE.LinearToneMapping,
                Reinhard: THREE.ReinhardToneMapping,
                Cineon: THREE.CineonToneMapping,
                ACESFilmic: THREE.ACESFilmicToneMapping,
                Custom: THREE.CustomToneMapping
            };
            renderer.toneMapping =
                toneMappingTypes[this.config.toneMappingType] || THREE.ACESFilmicToneMapping;
        }

        this.originalSceneRender = this.scene.renderer.render.bind(this.scene.renderer);

        this.scene.renderer.render = () => {
        };

        this.isInitialized = true;
        this.currentSamples = 0;
    }

    setupEnvironment() {
        if (this.config.transparentBackground) {
            this.scene.scene.background = null;
        } else if (this.config.background) {
            if (this.config.background instanceof THREE.Color) {
                this.scene.scene.background = this.config.background;
            } else {
                this.scene.scene.background = this.config.background;
            }
        } else {
            const gradientMap = new this.GradientEquirectTexture();
            gradientMap.topColor.set(0xeeeeee);
            gradientMap.bottomColor.set(0xeaeaea);
            gradientMap.update();
            this.scene.scene.background = gradientMap;
            this.gradientMap = gradientMap;
        }
    }

    adjustModelMaterials(model) {
        const { roughnessScale, enableTransmission, transmissionIOR } = this.config.materialConfig;

        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const material = child.material;

                if (material.roughness !== undefined) {
                    material.roughness *= roughnessScale;
                }

                if (enableTransmission && material.opacity < 1.0) {
                    const oldMaterial = material;
                    const newMaterial = new THREE.MeshPhysicalMaterial();

                    newMaterial.opacity = 1.0;
                    newMaterial.transmission = 1.0;
                    newMaterial.thickness = 1.0;
                    newMaterial.ior = transmissionIOR;
                    newMaterial.roughness = oldMaterial.roughness || 0.1;
                    newMaterial.metalness = 0.0;

                    const hsl = {};
                    oldMaterial.color.getHSL(hsl);
                    hsl.l = Math.max(hsl.l, 0.35);
                    newMaterial.color.setHSL(hsl.h, hsl.s, hsl.l);

                    child.material = newMaterial;

                    if (oldMaterial.dispose) {
                        oldMaterial.dispose();
                    }
                }
            }

            if (child.isLineSegments) {
                child.visible = false;
            }
        });
    }

    createFloor() {
        const floorConfig = this.config.floor;

        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            roughness: floorConfig.roughness,
            metalness: floorConfig.metalness,
            color: floorConfig.color,
            transparent: true
        });

        if (floorConfig.generateTexture) {
            material.map = this.generateRadialFloorTexture(1024);
        }

        this.floor = new THREE.Mesh(geometry, material);
        this.floor.scale.setScalar(floorConfig.size);
        this.floor.rotation.x = -Math.PI / 2;

        if (this.config.model) {
            const bbox = new THREE.Box3().setFromObject(this.config.model);
            this.floor.position.y = bbox.min.y;
        }

        this.scene.scene.add(this.floor);
    }

    generateRadialFloorTexture(dim) {
        const data = new Uint8Array(dim * dim * 4);

        for (let x = 0; x < dim; x++) {
            for (let y = 0; y < dim; y++) {
                const xNorm = x / (dim - 1);
                const yNorm = y / (dim - 1);

                const xCent = 2.0 * (xNorm - 0.5);
                const yCent = 2.0 * (yNorm - 0.5);
                let a = Math.max(Math.min(1.0 - Math.sqrt(xCent ** 2 + yCent ** 2), 1.0), 0.0);
                a = a ** 1.5;
                a = a * 1.5;
                a = Math.min(a, 1.0);

                const i = y * dim + x;
                data[i * 4 + 0] = 255;
                data[i * 4 + 1] = 255;
                data[i * 4 + 2] = 255;
                data[i * 4 + 3] = a * 255;
            }
        }

        const tex = new THREE.DataTexture(data, dim, dim);
        tex.format = THREE.RGBAFormat;
        tex.type = THREE.UnsignedByteType;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        return tex;
    }

    async updateScene() {
        if (!this.pathTracer) return;

        await this.pathTracer.setScene(this.scene.scene, this.scene.camera.instance);

        this.emit('sceneUpdated');
    }

    setupCameraControls() {
        const controls = this.scene.controls?.instance;

        if (!controls) {
            return;
        }

        this.cameraChangeHandler = () => {
            if (this.pathTracer && this.isInitialized) {
                this.pathTracer.updateCamera();

                this.pathTracer.reset();

                this.emit('cameraChanged');
            }
        };

        controls.addEventListener('change', this.cameraChangeHandler);
    }

    start() {
        this.config.enable = true;
        this.config.pause = false;
        this.isRendering = true;
        this.emit('start');
    }

    pause() {
        this.config.pause = true;
        this.emit('pause');
    }

    resume() {
        this.config.pause = false;
        this.emit('resume');
    }

    stop() {
        this.config.enable = false;
        this.isRendering = false;
        this.emit('stop');
    }

    reset() {
        if (this.pathTracer) {
            this.pathTracer.reset();
            this.currentSamples = 0;
            this.emit('reset');
        }
    }

    updateCamera() {
        if (this.pathTracer) {
            this.pathTracer.updateCamera();
            this.emit('cameraUpdated');
        }
    }

    updateMaterials() {
        if (this.pathTracer) {
            this.pathTracer.updateMaterials();
            this.emit('materialsUpdated');
        }
    }

    updateEnvironment() {
        if (this.pathTracer) {
            this.pathTracer.updateEnvironment();
            this.emit('environmentUpdated');
        }
    }

    setResolutionScale(scale) {
        this.config.resolutionScale = Math.max(0.1, Math.min(1.0, scale));
        if (this.pathTracer) {
            this.pathTracer.renderScale = this.config.resolutionScale;
            this.pathTracer.reset();
        }
    }

    setTiles(tiles) {
        this.config.tiles = Math.max(1, Math.min(6, tiles));
        if (this.pathTracer) {
            this.pathTracer.tiles.set(this.config.tiles, this.config.tiles);
        }
    }

    getSamples() {
        return this.pathTracer ? Math.floor(this.pathTracer.samples) : 0;
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isRendering: this.isRendering,
            isPaused: this.config.pause,
            samples: this.getSamples(),
            targetSamples: this.config.samples,
            progress: this.getSamples() / this.config.samples
        };
    }

    download(filename = 'pathtraced-render.png') {
        const renderer = this.scene.renderer.instance;
        const link = document.createElement('a');
        link.download = filename;
        link.href = renderer.domElement.toDataURL().replace('image/png', 'image/octet-stream');
        link.click();
        this.emit('download', { filename });
    }

    onUpdate(_deltaTime) {
        if (!this.pathTracer || !this.isInitialized) return;

        this.pathTracer.enablePathTracing = this.config.enable;
        this.pathTracer.pausePathTracing = this.config.pause;

        if (this.config.enable && !this.config.pause) {
            this.pathTracer.renderSample();

            const samples = this.getSamples();

            if (this.config.onProgress) {
                this.config.onProgress(samples / this.config.samples);
            }

            this.emit('progress', {
                samples,
                targetSamples: this.config.samples,
                progress: samples / this.config.samples
            });

            if (samples >= this.config.samples && this.currentSamples < this.config.samples) {
                this.currentSamples = samples;

                if (this.config.onComplete) {
                    this.config.onComplete();
                }

                this.emit('complete', { samples });
            }
        }
    }

    onDispose() {
        this.stop();

        if (this.scene.controls?.instance && this.cameraChangeHandler) {
            this.scene.controls.instance.removeEventListener('change', this.cameraChangeHandler);
            this.cameraChangeHandler = null;
        }

        if (this.originalSceneRender) {
            this.scene.renderer.render = this.originalSceneRender;
        }

        if (this.originalToneMapping !== undefined) {
            this.scene.renderer.instance.toneMapping = this.originalToneMapping;
        }

        if (this.addedModel) {
            this.scene.scene.remove(this.addedModel);
        }

        if (this.floor) {
            this.scene.scene.remove(this.floor);
            this.floor.geometry.dispose();
            this.floor.material.dispose();
            if (this.floor.material.map) {
                this.floor.material.map.dispose();
            }
        }

        if (this.gradientMap) {
            this.gradientMap.dispose();
        }

        if (this.pathTracer) {
            this.pathTracer.reset();
            this.pathTracer = null;
        }

        this.emit('disposed');
    }
}

export default PathTracer;
