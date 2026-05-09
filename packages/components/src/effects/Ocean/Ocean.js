import { Component } from '@w3d/core';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Effects module component that renders large animated ocean surfaces for outdoor scenes.
 */
export class Ocean extends Component {
    static defaultConfig = {
        position: [0, 0, 0],
        rotation: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],

        geometryType: 'plane', // 'plane' | 'model'
        geometryWidth: 10000,
        geometryHeight: 10000,
        modelPath: null,
        geometryName: null,

        textureWidth: 512,
        textureHeight: 512,
        waterNormalsUrl: '/textures/waternormals.jpg',
        waterColor: '#001e0f',
        sunColor: '#ffffff',
        sunDirection: [0, 1, 0],
        distortionScale: 3.7,
        size: 1.0,
        alpha: 1.0,
        time: 0,
        waterSpeed: 1.0
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.water = null;

        this.geometry = null;

        this.waterNormals = null;

        this.isLoaded = false;
    }

    async onMounted() {
        try {
            await this.loadWaterNormals();

            await this.createGeometry();

            this.createWater();

            this.applyTransform();

            this.isLoaded = true;

            this.emit('loaded', {
                water: this.water,
                geometry: this.geometry
            });
        } catch (error) {
            console.error('[Ocean] 初始化失败:', error);
            this.emit('error', { error });
        }
    }

    async loadWaterNormals() {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                this.config.waterNormalsUrl,
                (texture) => {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    this.waterNormals = texture;
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.warn('[Ocean] 法线贴图加载失败，使用默认配置:', error);
                    resolve(null);
                }
            );
        });
    }

    async createGeometry() {
        const { geometryType, geometryWidth, geometryHeight, modelPath, geometryName } =
            this.config;

        if (geometryType === 'model' && modelPath) {
            await this.loadGeometryFromModel(modelPath, geometryName);
        } else {
            this.geometry = new THREE.PlaneGeometry(geometryWidth, geometryHeight);
        }
    }

    async loadGeometryFromModel(modelPath, geometryName = null) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                modelPath,
                (gltf) => {
                    let targetMesh = null;

                    if (geometryName) {
                        gltf.scene.traverse((child) => {
                            if (child.isMesh && child.name === geometryName) {
                                targetMesh = child;
                            }
                        });
                    }

                    if (!targetMesh) {
                        gltf.scene.traverse((child) => {
                            if (child.isMesh && !targetMesh) {
                                targetMesh = child;
                            }
                        });
                    }

                    if (targetMesh) {
                        this.geometry = targetMesh.geometry.clone();

                        if (this.config.position[0] === 0 && this.config.position[1] === 0 && this.config.position[2] === 0) {
                            this.config.position = [
                                targetMesh.position.x,
                                targetMesh.position.y,
                                targetMesh.position.z
                            ];
                        }

                        if (this.config.rotation[0] === -Math.PI / 2 && this.config.rotation[1] === 0 && this.config.rotation[2] === 0) {
                            this.config.rotation = [
                                targetMesh.rotation.x,
                                targetMesh.rotation.y,
                                targetMesh.rotation.z
                            ];
                        }

                        if (this.config.scale[0] === 1 && this.config.scale[1] === 1 && this.config.scale[2] === 1) {
                            this.config.scale = [
                                targetMesh.scale.x,
                                targetMesh.scale.y,
                                targetMesh.scale.z
                            ];
                        }

                        this.emit('geometryLoaded', {
                            geometry: this.geometry,
                            mesh: targetMesh
                        });

                        resolve(this.geometry);
                    } else {
                        reject(new Error('模型中未找到有效的几何体'));
                    }
                },
                undefined,
                (error) => {
                    console.error('[Ocean] 模型加载失败:', error);
                    reject(error);
                }
            );
        });
    }

    createWater() {
        if (!this.geometry) {
            console.error('[Ocean] 几何体未创建');
            return;
        }

        const waterConfig = {
            textureWidth: this.config.textureWidth,
            textureHeight: this.config.textureHeight,
            waterColor: new THREE.Color(this.config.waterColor),
            sunColor: new THREE.Color(this.config.sunColor),
            sunDirection: new THREE.Vector3(...this.config.sunDirection),
            distortionScale: this.config.distortionScale,
            alpha: this.config.alpha,
            time: this.config.time,
            fog: this.scene.scene.fog !== undefined
        };

        if (this.waterNormals) {
            waterConfig.waterNormals = this.waterNormals;
        }

        this.water = new Water(this.geometry, waterConfig);

        this.componentScene.add(this.water);

        this.emit('waterCreated', { water: this.water });
    }

    applyTransform() {
        if (!this.water) return;

        const { position, rotation, scale } = this.config;

        this.water.position.set(position[0], position[1], position[2]);
        this.water.rotation.set(rotation[0], rotation[1], rotation[2]);
        this.water.scale.set(scale[0], scale[1], scale[2]);
    }

    updatePosition(x, y, z) {
        this.config.position = [x, y, z];
        if (this.water) {
            this.water.position.set(x, y, z);
        }
        this.emit('positionUpdated', { position: [x, y, z] });
    }

    setPosition(position) {
        const { x = 0, y = 0, z = 0 } = position;
        this.updatePosition(x, y, z);
    }

    updateRotation(x, y, z) {
        this.config.rotation = [x, y, z];
        if (this.water) {
            this.water.rotation.set(x, y, z);
        }
        this.emit('rotationUpdated', { rotation: [x, y, z] });
    }

    setRotation(rotation) {
        const { x = 0, y = 0, z = 0 } = rotation;
        this.updateRotation(x, y, z);
    }

    updateScale(x, y, z) {
        this.config.scale = [x, y, z];
        if (this.water) {
            this.water.scale.set(x, y, z);
        }
        this.emit('scaleUpdated', { scale: [x, y, z] });
    }

    setScale(scale) {
        const { x = 1, y = 1, z = 1 } = scale;
        this.updateScale(x, y, z);
    }

    updateWaterParams(params) {
        if (!this.water || !this.water.material) {
            console.warn('[Ocean] Water 未初始化');
            return;
        }

        const uniforms = this.water.material.uniforms;

        if (params.waterColor !== undefined) {
            this.config.waterColor = params.waterColor;
            uniforms.waterColor.value = new THREE.Color(params.waterColor);
        }

        if (params.sunColor !== undefined) {
            this.config.sunColor = params.sunColor;
            uniforms.sunColor.value = new THREE.Color(params.sunColor);
        }

        if (params.distortionScale !== undefined) {
            this.config.distortionScale = params.distortionScale;
            uniforms.distortionScale.value = params.distortionScale;
        }

        if (params.size !== undefined) {
            this.config.size = params.size;
            uniforms.size.value = params.size;
        }

        if (params.alpha !== undefined) {
            this.config.alpha = params.alpha;
            uniforms.alpha.value = params.alpha;
        }

        if (params.waterSpeed !== undefined) {
            this.config.waterSpeed = params.waterSpeed;
        }

        this.emit('waterParamsUpdated', { params });
    }

    updateSunDirection(x, y, z) {
        this.config.sunDirection = [x, y, z];
        if (this.water && this.water.material) {
            this.water.material.uniforms.sunDirection.value.set(x, y, z).normalize();
        }
        this.emit('sunDirectionUpdated', { sunDirection: [x, y, z] });
    }

    updateConfig(newConfig) {
        super.updateConfig(newConfig);

        if (newConfig.position) {
            this.updatePosition(...newConfig.position);
        }
        if (newConfig.rotation) {
            this.updateRotation(...newConfig.rotation);
        }
        if (newConfig.scale) {
            this.updateScale(...newConfig.scale);
        }

        const waterParams = {};
        if (newConfig.waterColor) waterParams.waterColor = newConfig.waterColor;
        if (newConfig.sunColor) waterParams.sunColor = newConfig.sunColor;
        if (newConfig.distortionScale !== undefined)
            waterParams.distortionScale = newConfig.distortionScale;
        if (newConfig.size !== undefined) waterParams.size = newConfig.size;
        if (newConfig.alpha !== undefined) waterParams.alpha = newConfig.alpha;
        if (newConfig.waterSpeed !== undefined) waterParams.waterSpeed = newConfig.waterSpeed;

        if (Object.keys(waterParams).length > 0) {
            this.updateWaterParams(waterParams);
        }

        if (newConfig.sunDirection) {
            this.updateSunDirection(...newConfig.sunDirection);
        }
    }

    onUpdate(delta) {
        if (!this.water || !this.water.material) return;

        this.water.material.uniforms.time.value += delta * this.config.waterSpeed;
    }

    getWater() {
        return this.water;
    }

    getGeometry() {
        return this.geometry;
    }

    onDispose() {
        if (this.water) {
            if (this.water.geometry) {
                this.water.geometry.dispose();
            }
            if (this.water.material) {
                this.water.material.dispose();
            }
            this.componentScene.remove(this.water);
            this.water = null;
        }

        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        if (this.waterNormals) {
            this.waterNormals.dispose();
            this.waterNormals = null;
        }
    }
}

export default Ocean;

