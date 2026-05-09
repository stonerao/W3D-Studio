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
 * HDRLoader HDR 环境贴图加载器组件
 *
 * @class HDRLoader
 * @extends Component
 * @description 加载 HDR 环境贴图，支持强度控制和独立的环境/背景配置
 */
export class HDRLoaderCom extends Component {
    static defaultConfig = {
        url: '',
        mapping: THREE.EquirectangularReflectionMapping,
        asEnvironment: true,      // 是否作为环境贴图
        asBackground: false,      // 是否作为背景贴图
        intensity: 1.0,           // 环境贴图强度（默认 1.0）
        backgroundIntensity: 1.0  // 背景贴图强度（默认 1.0）
    };

    async onMounted() {
        this.loader = new HDRLoader();

        // 保存当前强度值
        this.currentIntensity = this.config.intensity;
        this.currentBackgroundIntensity = this.config.backgroundIntensity;

        await this.loadHDR();
    }

    async loadHDR() {
        if (!this.config.url) {
            console.warn('HDRLoader: url is required');
            return;
        }

        // 验证文件扩展名
        const url = this.config.url.toLowerCase();
        if (!url.endsWith('.hdr') && !url.endsWith('.exr')) {
            const error = new Error(`不支持的文件格式。请使用 .hdr 或 .exr 文件。当前文件: ${this.config.url}`);
            console.error('HDRLoader:', error.message);
            this.emit('loadError', { error });
            // 清理场景中的环境贴图
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
                        // 验证纹理是否加载成功
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
                        // 提供更友好的错误消息
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

            // 验证纹理对象
            if (!this.texture || !this.texture.image) {
                throw new Error('加载的 HDR 纹理无效');
            }

            // 设置映射方式
            this.texture.mapping = this.config.mapping;

            // 应用到场景
            if (this.config.asEnvironment) {
                this.scene.scene.environment = this.texture;
                // 设置环境贴图强度
                this.applyEnvironmentIntensity(this.currentIntensity);
            }

            if (this.config.asBackground) {
                this.scene.scene.background = this.texture;
                // 设置背景贴图强度
                this.applyBackgroundIntensity(this.currentBackgroundIntensity);
            }

            this.emit('loadComplete', { texture: this.texture });
            console.log('HDRLoader: Successfully loaded HDR', this.config.url);
        } catch (error) {
            console.error('HDRLoader: Failed to load HDR', error);
            this.emit('loadError', { error });
            
            // 加载失败时清理纹理和场景引用
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

    /**
     * 应用环境贴图强度
     * @param {number} value - 强度值
     * @private
     */
    applyEnvironmentIntensity(value) {
        if (!this.scene || !this.scene.scene) return;

        // Three.js r155+ 支持 scene.environmentIntensity
        if ('environmentIntensity' in this.scene.scene) {
            this.scene.scene.environmentIntensity = value;
        } else {
            // 降级方案：调整场景中所有材质的 envMapIntensity
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

    /**
     * 应用背景贴图强度
     * @param {number} value - 强度值
     * @private
     */
    applyBackgroundIntensity(value) {
        if (!this.scene || !this.scene.scene) return;

        // Three.js r163+ 支持 scene.backgroundIntensity
        if ('backgroundIntensity' in this.scene.scene) {
            this.scene.scene.backgroundIntensity = value;
        } else {
            // 降级方案：通过调整纹理的色彩空间或使用后处理
            // 注意：这是一个简化的实现，实际效果可能有限
            console.warn('HDRLoader: backgroundIntensity 不被当前 Three.js 版本支持');
        }
    }

    /**
     * 设置环境贴图强度
     * @param {number} value - 强度值（0.0 - 5.0）
     */
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

    /**
     * 设置背景贴图强度
     * @param {number} value - 强度值（0.0 - 5.0）
     */
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

    /**
     * 切换是否作为环境贴图
     * @param {boolean} enabled - 是否启用
     */
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

    /**
     * 切换是否作为背景贴图
     * @param {boolean} enabled - 是否启用
     */
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

    /**
     * 获取当前环境贴图强度
     * @returns {number} 当前强度值
     */
    getIntensity() {
        return this.currentIntensity;
    }

    /**
     * 获取当前背景贴图强度
     * @returns {number} 当前强度值
     */
    getBackgroundIntensity() {
        return this.currentBackgroundIntensity;
    }

    /**
     * 获取纹理对象
     * @returns {THREE.Texture} HDR 纹理
     */
    getTexture() {
        return this.texture;
    }

    /**
     * 更新配置（支持动态更新）
     * @param {Object} newConfig - 新配置
     */
    async updateConfig(newConfig) {
        console.log(newConfig)
        const oldUrl = this.config.url;
        const oldAsEnvironment = this.config.asEnvironment;
        const oldAsBackground = this.config.asBackground;

        // 合并新配置
        Object.assign(this.config, newConfig);

        const newUrl = this.config.url;

        // URL 变化时重新加载 HDR
        if (newUrl && newUrl !== oldUrl) {
            // 清理旧纹理
            if (this.texture) {
                this.texture.dispose();
                this.texture = null;
            }

            // 重新加载
            await this.loadHDR();
        } else {
            // URL 未变化，只更新其他配置
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
        // 清理场景中的引用
        if (this.scene && this.scene.scene) {
            if (this.config.asEnvironment && this.scene.scene.environment === this.texture) {
                this.scene.scene.environment = null;
            }
            if (this.config.asBackground && this.scene.scene.background === this.texture) {
                this.scene.scene.background = null;
            }
        }

        // 释放纹理资源
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }

        // 清理加载器
        this.loader = null;
    }
}
// 兼容性导出：提供命名导出 `HDRLoader` 以匹配上层重导出
export { HDRLoaderCom as HDRLoader };

export default HDRLoaderCom;
