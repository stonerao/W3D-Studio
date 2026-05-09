/*
 * @Date: 2025-10-09 16:07:16
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2025-12-30 00:17:03
 * @FilePath: \packages\components\src\loaders\HDRLoader\HDRLoader.js
 */
import { Component } from '@w3d/core';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import * as THREE from 'three';

/**
 * Loader module component that applies HDR textures as scene environment lighting and optional background imagery.
 */
export class HDRLoaderCom extends Component {
    static defaultConfig = {
        url: '',
        mapping: THREE.EquirectangularReflectionMapping,
        asEnvironment: true,
        asBackground: false,
        intensity: 1.0,
        backgroundIntensity: 1.0
    };

    async onMounted() {
        this.loader = new HDRLoader();

        this.currentIntensity = this.config.intensity;
        this.currentBackgroundIntensity = this.config.backgroundIntensity;

        await this.loadHDR();
    }

    async loadHDR() {
        if (!this.config.url) {
            console.warn('HDRLoader: url is required');
            return;
        }

        const url = this.config.url.toLowerCase();
        if (!url.endsWith('.hdr') && !url.endsWith('.exr')) {
            const error = new Error(`不支持的文件格式。请使用 .hdr 或 .exr 文件。当前文件: ${this.config.url}`);
            console.error('HDRLoader:', error.message);
            this.emit('loadError', { error });
            if (this.scene && this.scene.scene) {
                if (this.config.asEnvironment) {
                    this.scene.scene.environment = null;
                }
                if (this.config.asBackground) {
                    this.scene.scene.background = null;
                }
            }
            return;
        }

        try {
            this.emit('loadStart', { url: this.config.url });

            this.texture = await new Promise((resolve, reject) => {
                this.loader.load(
                    this.config.url,
                    (texture) => {
                        if (!texture || !texture.image) {
                            reject(new Error('加载的纹理无效'));
                            return;
                        }
                        resolve(texture);
                    },
                    (progress) => {
                        if (progress.total > 0) {
                            const percent = progress.loaded / progress.total;
                            this.emit('loadProgress', { progress: percent });
                        }
                    },
                    (error) => {
                        const errorMsg = error?.message || String(error);
                        if (errorMsg.includes('Bad File Format') || errorMsg.includes('bad initial token')) {
                            reject(new Error(`HDR 文件格式错误。请确保文件是有效的 .hdr 或 .exr 格式。URL: ${this.config.url}`));
                        } else if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
                            reject(new Error(`HDR 文件未找到: ${this.config.url}`));
                        } else {
                            reject(error);
                        }
                    }
                );
            });

            if (!this.texture || !this.texture.image) {
                throw new Error('加载的 HDR 纹理无效');
            }

            this.texture.mapping = this.config.mapping;

            if (this.config.asEnvironment) {
                this.scene.scene.environment = this.texture;
                this.applyEnvironmentIntensity(this.currentIntensity);
            }

            if (this.config.asBackground) {
                this.scene.scene.background = this.texture;
                this.applyBackgroundIntensity(this.currentBackgroundIntensity);
            }

            this.emit('loadComplete', { texture: this.texture });
            console.log('HDRLoader: Successfully loaded HDR', this.config.url);
        } catch (error) {
            console.error('HDRLoader: Failed to load HDR', error);
            this.emit('loadError', { error });
            
            if (this.texture) {
                this.texture.dispose();
                this.texture = null;
            }
            
            if (this.scene && this.scene.scene) {
                if (this.config.asEnvironment) {
                    this.scene.scene.environment = null;
                }
                if (this.config.asBackground) {
                    this.scene.scene.background = null;
                }
            }
        }
    }

    applyEnvironmentIntensity(value) {
        if (!this.scene || !this.scene.scene) return;

        if ('environmentIntensity' in this.scene.scene) {
            this.scene.scene.environmentIntensity = value;
        } else {
            this.scene.scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                    materials.forEach((material) => {
                        if ('envMapIntensity' in material) {
                            material.envMapIntensity = value;
                            material.needsUpdate = true;
                        }
                    });
                }
            });
        }
    }

    applyBackgroundIntensity(value) {
        if (!this.scene || !this.scene.scene) return;

        if ('backgroundIntensity' in this.scene.scene) {
            this.scene.scene.backgroundIntensity = value;
        } else {
            console.warn('HDRLoader: backgroundIntensity 不被当前 Three.js 版本支持');
        }
    }

    setIntensity(value) {
        if (typeof value !== 'number' || value < 0) {
            console.warn('HDRLoader: intensity 必须是非负数');
            return;
        }

        this.currentIntensity = value;

        if (this.config.asEnvironment && this.texture) {
            this.applyEnvironmentIntensity(value);
            this.emit('intensityChanged', { intensity: value });
        }
    }

    setBackgroundIntensity(value) {
        if (typeof value !== 'number' || value < 0) {
            console.warn('HDRLoader: backgroundIntensity 必须是非负数');
            return;
        }

        this.currentBackgroundIntensity = value;

        if (this.config.asBackground && this.texture) {
            this.applyBackgroundIntensity(value);
            this.emit('backgroundIntensityChanged', { intensity: value });
        }
    }

    setAsEnvironment(enabled) {
        if (!this.scene || !this.scene.scene) {
            console.warn('HDRLoader: 场景未初始化');
            return;
        }

        if (enabled && !this.texture) {
            console.warn('HDRLoader: 纹理未加载，无法设置为环境贴图');
            return;
        }

        this.config.asEnvironment = enabled;

        if (enabled) {
            this.scene.scene.environment = this.texture;
            this.applyEnvironmentIntensity(this.currentIntensity);
            this.emit('environmentEnabled', { enabled: true });
        } else {
            this.scene.scene.environment = null;
            this.emit('environmentEnabled', { enabled: false });
        }
    }

    setAsBackground(enabled) {
        if (!this.scene || !this.scene.scene) {
            console.warn('HDRLoader: 场景未初始化');
            return;
        }

        if (enabled && !this.texture) {
            console.warn('HDRLoader: 纹理未加载，无法设置为背景');
            return;
        }

        this.config.asBackground = enabled;

        if (enabled) {
            this.scene.scene.background = this.texture;
            this.applyBackgroundIntensity(this.currentBackgroundIntensity);
            this.emit('backgroundEnabled', { enabled: true });
        } else {
            this.scene.scene.background = null;
            this.emit('backgroundEnabled', { enabled: false });
        }
    }

    getIntensity() {
        return this.currentIntensity;
    }

    getBackgroundIntensity() {
        return this.currentBackgroundIntensity;
    }

    getTexture() {
        return this.texture;
    }

    async updateConfig(newConfig) {
        console.log(newConfig)
        const oldUrl = this.config.url;
        const oldAsEnvironment = this.config.asEnvironment;
        const oldAsBackground = this.config.asBackground;

        Object.assign(this.config, newConfig);

        const newUrl = this.config.url;

        if (newUrl && newUrl !== oldUrl) {
            if (this.texture) {
                this.texture.dispose();
                this.texture = null;
            }

            await this.loadHDR();
        } else {
            if ('intensity' in newConfig && newConfig.intensity !== this.currentIntensity) {
                this.setIntensity(newConfig.intensity);
            }

            if ('backgroundIntensity' in newConfig && newConfig.backgroundIntensity !== this.currentBackgroundIntensity) {
                this.setBackgroundIntensity(newConfig.backgroundIntensity);
            }

            if ('asEnvironment' in newConfig && newConfig.asEnvironment !== oldAsEnvironment) {
                this.setAsEnvironment(newConfig.asEnvironment);
            }

            if ('asBackground' in newConfig && newConfig.asBackground !== oldAsBackground) {
                this.setAsBackground(newConfig.asBackground);
            }
        }
    }

    onDispose() {
        if (this.scene && this.scene.scene) {
            if (this.config.asEnvironment && this.scene.scene.environment === this.texture) {
                this.scene.scene.environment = null;
            }
            if (this.config.asBackground && this.scene.scene.background === this.texture) {
                this.scene.scene.background = null;
            }
        }

        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }

        this.loader = null;
    }
}
export { HDRLoaderCom as HDRLoader };

export default HDRLoaderCom;
