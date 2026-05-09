import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class PathTracer extends Component {
    /**
     * English comment.
     */
    static defaultConfig = {
        // English comment.
        enable: true, // English comment.
        pause: false, // English comment.
        samples: 100, // English comment.
        minSamples: 3, // English comment.
        tiles: 3, // English comment.
        resolutionScale: 1.0, // English comment.

        // English comment.
        model: null, // English comment.
        environment: null, // English comment.
        background: null, // English comment.

        // English comment.
        envMapIntensity: 1.0, // English comment.
        envMapBlur: 0.0, // English comment.

        // English comment.
        adjustMaterials: true, // English comment.
        materialConfig: {
            roughnessScale: 0.25, // English comment.
            enableTransmission: true, // English comment.
            transmissionIOR: 1.4 // English comment.
        },

        // English comment.
        floor: {
            enabled: false, // English comment.
            size: 2500, // English comment.
            roughness: 0.15, // English comment.
            metalness: 0.9, // English comment.
            color: '#ffffff', // English comment.
            generateTexture: true // English comment.
        },

        // English comment.
        filterGlossyFactor: 1, // English comment.

        // English comment.
        toneMapping: true, // English comment.
        toneMappingType: 'ACESFilmic', // English comment.

        // English comment.
        transparentBackground: false,

        // English comment.
        autoStart: true,

        // English comment.
        onProgress: null, // (progress) => {}
        onComplete: null // () => {}
    };

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        if (!this.config.model) {
            console.warn('PathTracer: No model provided');
            return;
        }

        // English comment.
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

        // English comment.
        this.initializePathTracer();

        // English comment.
        this.setupEnvironment();

        // English comment.
        if (this.config.adjustMaterials && this.config.model) {
            this.adjustModelMaterials(this.config.model);
        }

        // English comment.
        if (this.config.floor.enabled) {
            this.createFloor();
        }

        // English comment.
        // English comment.
        if (this.config.model) {
            this.scene.scene.add(this.config.model);
            this.addedModel = this.config.model; // English comment.
        }

        // English comment.
        await this.updateScene();

        // English comment.
        this.setupCameraControls();

        // English comment.
        if (this.config.autoStart) {
            this.start();
        }

        this.emit('mounted');
    }

    /**
     * English comment.
     */
    initializePathTracer() {
        const renderer = this.scene.renderer.instance;

        // English comment.
        this.pathTracer = new this.WebGLPathTracer(renderer);
        this.pathTracer.filterGlossyFactor = this.config.filterGlossyFactor;
        this.pathTracer.minSamples = this.config.minSamples;
        this.pathTracer.renderScale = this.config.resolutionScale;
        this.pathTracer.tiles.set(this.config.tiles, this.config.tiles);

        // English comment.
        this.originalToneMapping = renderer.toneMapping;

        // English comment.
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

        // English comment.
        // English comment.
        this.originalSceneRender = this.scene.renderer.render.bind(this.scene.renderer);

        // English comment.
        this.scene.renderer.render = () => {
            // English comment.
            // English comment.
        };

        this.isInitialized = true;
        this.currentSamples = 0;
    }

    /**
     * English comment.
     */
    setupEnvironment() {
        // English comment.
        if (this.config.transparentBackground) {
            this.scene.scene.background = null;
        } else if (this.config.background) {
            if (this.config.background instanceof THREE.Color) {
                this.scene.scene.background = this.config.background;
            } else {
                this.scene.scene.background = this.config.background;
            }
        } else {
            // English comment.
            const gradientMap = new this.GradientEquirectTexture();
            gradientMap.topColor.set(0xeeeeee);
            gradientMap.bottomColor.set(0xeaeaea);
            gradientMap.update();
            this.scene.scene.background = gradientMap;
            this.gradientMap = gradientMap;
        }
    }

    /**
     * English comment.
     */
    adjustModelMaterials(model) {
        const { roughnessScale, enableTransmission, transmissionIOR } = this.config.materialConfig;

        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const material = child.material;

                // English comment.
                if (material.roughness !== undefined) {
                    material.roughness *= roughnessScale;
                }

                // English comment.
                if (enableTransmission && material.opacity < 1.0) {
                    const oldMaterial = material;
                    const newMaterial = new THREE.MeshPhysicalMaterial();

                    newMaterial.opacity = 1.0;
                    newMaterial.transmission = 1.0;
                    newMaterial.thickness = 1.0;
                    newMaterial.ior = transmissionIOR;
                    newMaterial.roughness = oldMaterial.roughness || 0.1;
                    newMaterial.metalness = 0.0;

                    // English comment.
                    const hsl = {};
                    oldMaterial.color.getHSL(hsl);
                    hsl.l = Math.max(hsl.l, 0.35);
                    newMaterial.color.setHSL(hsl.h, hsl.s, hsl.l);

                    child.material = newMaterial;

                    // English comment.
                    if (oldMaterial.dispose) {
                        oldMaterial.dispose();
                    }
                }
            }

            // English comment.
            if (child.isLineSegments) {
                child.visible = false;
            }
        });
    }

    /**
     * English comment.
     */
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

        // English comment.
        if (floorConfig.generateTexture) {
            material.map = this.generateRadialFloorTexture(1024);
        }

        this.floor = new THREE.Mesh(geometry, material);
        this.floor.scale.setScalar(floorConfig.size);
        this.floor.rotation.x = -Math.PI / 2;

        // English comment.
        if (this.config.model) {
            const bbox = new THREE.Box3().setFromObject(this.config.model);
            this.floor.position.y = bbox.min.y;
        }

        // English comment.
        this.scene.scene.add(this.floor);
    }

    /**
     * English comment.
     */
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

    /**
     * English comment.
     */
    async updateScene() {
        if (!this.pathTracer) return;

        // English comment.
        await this.pathTracer.setScene(this.scene.scene, this.scene.camera.instance);

        this.emit('sceneUpdated');
    }

    /**
     * English comment.
     */
    setupCameraControls() {
        // English comment.
        const controls = this.scene.controls?.instance;

        if (!controls) {
            return;
        }

        // English comment.
        this.cameraChangeHandler = () => {
            if (this.pathTracer && this.isInitialized) {
                // English comment.
                this.pathTracer.updateCamera();

                // English comment.
                this.pathTracer.reset();

                // English comment.
                this.emit('cameraChanged');
            }
        };

        // English comment.
        controls.addEventListener('change', this.cameraChangeHandler);
    }

    /**
     * English comment.
     */
    start() {
        this.config.enable = true;
        this.config.pause = false;
        this.isRendering = true;
        this.emit('start');
    }

    /**
     * English comment.
     */
    pause() {
        this.config.pause = true;
        this.emit('pause');
    }

    /**
     * English comment.
     */
    resume() {
        this.config.pause = false;
        this.emit('resume');
    }

    /**
     * English comment.
     */
    stop() {
        this.config.enable = false;
        this.isRendering = false;
        this.emit('stop');
    }

    /**
     * English comment.
     */
    reset() {
        if (this.pathTracer) {
            this.pathTracer.reset();
            this.currentSamples = 0;
            this.emit('reset');
        }
    }

    /**
     * English comment.
     */
    updateCamera() {
        if (this.pathTracer) {
            this.pathTracer.updateCamera();
            this.emit('cameraUpdated');
        }
    }

    /**
     * English comment.
     */
    updateMaterials() {
        if (this.pathTracer) {
            this.pathTracer.updateMaterials();
            this.emit('materialsUpdated');
        }
    }

    /**
     * English comment.
     */
    updateEnvironment() {
        if (this.pathTracer) {
            this.pathTracer.updateEnvironment();
            this.emit('environmentUpdated');
        }
    }

    /**
     * English comment.
     */
    setResolutionScale(scale) {
        this.config.resolutionScale = Math.max(0.1, Math.min(1.0, scale));
        if (this.pathTracer) {
            this.pathTracer.renderScale = this.config.resolutionScale;
            this.pathTracer.reset();
        }
    }

    /**
     * English comment.
     */
    setTiles(tiles) {
        this.config.tiles = Math.max(1, Math.min(6, tiles));
        if (this.pathTracer) {
            this.pathTracer.tiles.set(this.config.tiles, this.config.tiles);
        }
    }

    /**
     * English comment.
     */
    getSamples() {
        return this.pathTracer ? Math.floor(this.pathTracer.samples) : 0;
    }

    /**
     * English comment.
     */
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

    /**
     * English comment.
     */
    download(filename = 'pathtraced-render.png') {
        const renderer = this.scene.renderer.instance;
        const link = document.createElement('a');
        link.download = filename;
        link.href = renderer.domElement.toDataURL().replace('image/png', 'image/octet-stream');
        link.click();
        this.emit('download', { filename });
    }

    /**
     * English comment.
     */
    onUpdate(_deltaTime) {
        if (!this.pathTracer || !this.isInitialized) return;

        // English comment.
        this.pathTracer.enablePathTracing = this.config.enable;
        this.pathTracer.pausePathTracing = this.config.pause;

        // English comment.
        if (this.config.enable && !this.config.pause) {
            this.pathTracer.renderSample();

            const samples = this.getSamples();

            // English comment.
            if (this.config.onProgress) {
                this.config.onProgress(samples / this.config.samples);
            }

            // English comment.
            this.emit('progress', {
                samples,
                targetSamples: this.config.samples,
                progress: samples / this.config.samples
            });

            // English comment.
            if (samples >= this.config.samples && this.currentSamples < this.config.samples) {
                this.currentSamples = samples;

                if (this.config.onComplete) {
                    this.config.onComplete();
                }

                this.emit('complete', { samples });
            }
        }
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.stop();

        // English comment.
        if (this.scene.controls?.instance && this.cameraChangeHandler) {
            this.scene.controls.instance.removeEventListener('change', this.cameraChangeHandler);
            this.cameraChangeHandler = null;
        }

        // English comment.
        if (this.originalSceneRender) {
            this.scene.renderer.render = this.originalSceneRender;
        }

        // English comment.
        if (this.originalToneMapping !== undefined) {
            this.scene.renderer.instance.toneMapping = this.originalToneMapping;
        }

        // English comment.
        if (this.addedModel) {
            this.scene.scene.remove(this.addedModel);
        }

        // English comment.
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

        // English comment.
        if (this.pathTracer) {
            this.pathTracer.reset();
            this.pathTracer = null;
        }

        this.emit('disposed');
    }
}

export default PathTracer;
