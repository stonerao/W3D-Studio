import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * ModelEffect 模型效果组件
 *
 * @class ModelEffect
 * @extends Component
 * @description 用于封装常见的模型视觉效果，包括材质变色、矩阵动画、透明度渐变、发光效果等
 *
 * @example
 * const modelEffect = await scene.add('ModelEffect', {
 *     name: 'model-effect',
 *     target: mesh,
 *     effect: 'color',
 *     targetColor: 0xFF0000,
 *     duration: 1000,
 *     autoReverse: false,
 *     loop: false
 * });
 *
 * // 应用颜色效果
 * modelEffect.applyEffect({
 *     effect: 'color',
 *     targetColor: 0xFF0000,
 *     duration: 1000
 * });
 *
 * // 应用变换效果
 * modelEffect.applyEffect({
 *     effect: 'transform',
 *     targetPosition: { x: 0, y: 10, z: 0 },
 *     duration: 2000
 * });
 *
 * // 停止当前效果
 * modelEffect.stopEffect();
 *
 * // 重置到初始状态
 * modelEffect.resetEffect();
 */
export class ModelEffect extends Component {
    /**
     * 默认配置
     */
    static defaultConfig = {
        target: null,                           // 目标 Mesh 或 Mesh 数组
        effect: 'color',                        // 效果类型：'color' | 'transform' | 'opacity' | 'emissive'
        duration: 1000,                         // 动画时长（毫秒）
        easing: TWEEN.Easing.Quadratic.Out,    // 缓动函数
        // 颜色效果参数
        targetColor: 0xFF0000,                  // 目标颜色
        // 变换效果参数
        targetPosition: null,                   // 目标位置 { x, y, z }
        targetRotation: null,                   // 目标旋转 { x, y, z }
        targetScale: null,                      // 目标缩放 { x, y, z }
        // 透明度效果参数
        targetOpacity: 1.0,                     // 目标透明度 (0-1)
        // 发光效果参数
        targetEmissive: null,                   // 目标发光颜色
        emissiveIntensity: 1.0,                 // 发光强度
        // 通用参数
        autoReverse: false,                     // 是否自动反向播放
        loop: false,                            // 是否循环
        onComplete: null                        // 完成回调
    };

    /**
     * 组件挂载完成
     */
    onMounted() {
        // 目标对象数组
        this.targets = [];

        // 原始状态存储
        this.originalStates = new Map();

        // 当前活动的动画
        this.activeTweens = [];

        // Tween 动画组
        this.tweenGroup = new TWEEN.Group();

        // 效果状态
        this.effectState = {
            isPlaying: false,
            currentEffect: null
        };

        // 初始化目标对象
        this.initializeTargets();

        // 如果配置了自动应用效果
        if (this.config.target && this.config.effect) {
            this.applyEffect(this.config);
        }

        // 监听烘焙光照配置更新事件（通过场景事件系统）
        if (this.scene?.eventSystem) {
            this.scene.eventSystem.on('bakedLightingConfigUpdated', this.handleBakedLightingUpdate.bind(this));
        }
    }

    /**
     * 处理烘焙光照更新
     * @param {Object} data - 事件数据，包含 config 和 modelLoaderId
     */
    handleBakedLightingUpdate(data) {
        const config = data?.config || data;

        // eslint-disable-next-line no-console
        console.log('[ModelEffect] 接收到烘焙光照配置更新:', config);

        // 如果当前有目标对象，重新保存其状态
        if (this.targets.length > 0) {
            // 延迟执行，确保烘焙光照已应用到材质
            // eslint-disable-next-line no-undef
            setTimeout(() => {
                // 清空旧状态
                this.originalStates.clear();

                // 重新保存状态（包含更新后的烘焙光照材质）
                this.targets.forEach((obj) => {
                    this.saveOriginalState(obj);
                });

                // eslint-disable-next-line no-console
                console.log('[ModelEffect] 已更新材质状态以反映烘焙光照变化');

                // 触发自定义事件
                this.emit('materialStateUpdated', { bakedLightingConfig: config });
            }, 100); // 延迟100ms确保材质已更新
        }
    }

    /**
     * 初始化目标对象
     */
    initializeTargets() {
        const { target } = this.config;

        if (!target) {
            console.warn('[ModelEffect] 未指定目标对象');
            return;
        }

        // 将目标转换为数组
        this.targets = Array.isArray(target) ? target : [target];

        // 保存每个目标的原始状态
        this.targets.forEach((obj) => {
            this.saveOriginalState(obj);
        });

        console.log('[ModelEffect] 目标对象初始化完成，数量:', this.targets.length);
    }

    /**
     * 保存对象的原始状态
     * @param {THREE.Object3D} obj - 目标对象
     */
    saveOriginalState(obj) {
        if (!obj) return;

        const state = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
            materials: []
        };

        // 遍历保存所有 Mesh 的材质状态
        obj.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat) => {
                    state.materials.push({
                        mesh: child,
                        material: mat,
                        color: mat.color ? mat.color.clone() : null,
                        emissive: mat.emissive ? mat.emissive.clone() : null,
                        opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
                        transparent: mat.transparent || false
                    });
                });
            }
        });

        this.originalStates.set(obj, state);
    }

    /**
     * 应用效果
     * @param {Object} options - 效果选项
     * @returns {Promise<void>}
     */
    applyEffect(options = {}) {
        // 停止当前正在进行的效果
        this.stopEffect();

        // 合并配置
        const effectConfig = {
            ...this.config,
            ...options
        };

        const { effect } = effectConfig;
        this.effectState.currentEffect = effect;
        this.effectState.isPlaying = true;

        // 根据效果类型调用相应方法
        switch (effect) {
        case 'color':
            return this.applyColorEffect(effectConfig);
        case 'transform':
            return this.applyTransformEffect(effectConfig);
        case 'opacity':
            return this.applyOpacityEffect(effectConfig);
        case 'emissive':
            return this.applyEmissiveEffect(effectConfig);
        default:
            console.warn(`[ModelEffect] 未知的效果类型: ${effect}`);
            return Promise.resolve();
        }
    }

    /**
     * 应用颜色效果
     * @param {Object} config - 配置参数
     * @returns {Promise<void>}
     */
    applyColorEffect(config) {
        const { targetColor, duration, easing, autoReverse, loop, onComplete } = config;

        return new Promise((resolve) => {
            this.targets.forEach((obj) => {
                obj.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];

                        materials.forEach((mat) => {
                            if (!mat.color) return;

                            const startColor = {
                                r: mat.color.r,
                                g: mat.color.g,
                                b: mat.color.b
                            };

                            const endColor = new THREE.Color(targetColor);
                            const targetColorObj = {
                                r: endColor.r,
                                g: endColor.g,
                                b: endColor.b
                            };

                            const tween = new TWEEN.Tween(startColor, this.tweenGroup)
                                .to(targetColorObj, duration)
                                .easing(easing)
                                .onUpdate(() => {
                                    mat.color.setRGB(startColor.r, startColor.g, startColor.b);
                                })
                                .onComplete(() => {
                                    if (onComplete) onComplete();
                                    this.emit('effectComplete', { effect: 'color' });
                                    resolve();
                                });

                            // 如果启用自动反向
                            if (autoReverse) {
                                tween.yoyo(true).repeat(loop ? Infinity : 1);
                            } else if (loop) {
                                tween.repeat(Infinity);
                            }

                            tween.start();
                            this.activeTweens.push(tween);
                        });
                    }
                });
            });
        });
    }

    /**
     * 应用变换效果
     * @param {Object} config - 配置参数
     * @returns {Promise<void>}
     */
    applyTransformEffect(config) {
        const {
            targetPosition,
            targetRotation,
            targetScale,
            duration,
            easing,
            autoReverse,
            loop,
            onComplete
        } = config;

        return new Promise((resolve) => {
            let completedCount = 0;
            const totalCount = this.targets.length;

            this.targets.forEach((obj) => {
                const start = {
                    px: obj.position.x,
                    py: obj.position.y,
                    pz: obj.position.z,
                    rx: obj.rotation.x,
                    ry: obj.rotation.y,
                    rz: obj.rotation.z,
                    sx: obj.scale.x,
                    sy: obj.scale.y,
                    sz: obj.scale.z
                };

                const end = {
                    px: targetPosition ? targetPosition.x : start.px,
                    py: targetPosition ? targetPosition.y : start.py,
                    pz: targetPosition ? targetPosition.z : start.pz,
                    rx: targetRotation ? targetRotation.x : start.rx,
                    ry: targetRotation ? targetRotation.y : start.ry,
                    rz: targetRotation ? targetRotation.z : start.rz,
                    sx: targetScale ? targetScale.x : start.sx,
                    sy: targetScale ? targetScale.y : start.sy,
                    sz: targetScale ? targetScale.z : start.sz
                };

                const tween = new TWEEN.Tween(start, this.tweenGroup)
                    .to(end, duration)
                    .easing(easing)
                    .onUpdate(() => {
                        obj.position.set(start.px, start.py, start.pz);
                        obj.rotation.set(start.rx, start.ry, start.rz);
                        obj.scale.set(start.sx, start.sy, start.sz);
                    })
                    .onComplete(() => {
                        completedCount++;
                        if (completedCount === totalCount) {
                            if (onComplete) onComplete();
                            this.emit('effectComplete', { effect: 'transform' });
                            resolve();
                        }
                    });

                // 如果启用自动反向
                if (autoReverse) {
                    tween.yoyo(true).repeat(loop ? Infinity : 1);
                } else if (loop) {
                    tween.repeat(Infinity);
                }

                tween.start();
                this.activeTweens.push(tween);
            });
        });
    }

    /**
     * 应用透明度效果
     * @param {Object} config - 配置参数
     * @returns {Promise<void>}
     */
    applyOpacityEffect(config) {
        const { targetOpacity, duration, easing, autoReverse, loop, onComplete } = config;

        return new Promise((resolve) => {
            this.targets.forEach((obj) => {
                obj.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];

                        materials.forEach((mat) => {
                            const startOpacity = { value: mat.opacity !== undefined ? mat.opacity : 1.0 };
                            const endOpacity = { value: targetOpacity };

                            // 如果目标透明度小于1，需要启用透明
                            if (targetOpacity < 1.0) {
                                mat.transparent = true;
                            }

                            const tween = new TWEEN.Tween(startOpacity, this.tweenGroup)
                                .to(endOpacity, duration)
                                .easing(easing)
                                .onUpdate(() => {
                                    mat.opacity = startOpacity.value;
                                })
                                .onComplete(() => {
                                    if (onComplete) onComplete();
                                    this.emit('effectComplete', { effect: 'opacity' });
                                    resolve();
                                });

                            // 如果启用自动反向
                            if (autoReverse) {
                                tween.yoyo(true).repeat(loop ? Infinity : 1);
                            } else if (loop) {
                                tween.repeat(Infinity);
                            }

                            tween.start();
                            this.activeTweens.push(tween);
                        });
                    }
                });
            });
        });
    }

    /**
     * 应用发光效果
     * @param {Object} config - 配置参数
     * @returns {Promise<void>}
     */
    applyEmissiveEffect(config) {
        const {
            targetEmissive,
            emissiveIntensity,
            duration,
            easing,
            autoReverse,
            loop,
            onComplete
        } = config;

        if (!targetEmissive) {
            console.warn('[ModelEffect] 未指定目标发光颜色');
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.targets.forEach((obj) => {
                obj.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];

                        materials.forEach((mat) => {
                            if (!mat.emissive) return;

                            const startEmissive = {
                                r: mat.emissive.r,
                                g: mat.emissive.g,
                                b: mat.emissive.b,
                                intensity: mat.emissiveIntensity || 1.0
                            };

                            const endColor = new THREE.Color(targetEmissive);
                            const endEmissive = {
                                r: endColor.r * emissiveIntensity,
                                g: endColor.g * emissiveIntensity,
                                b: endColor.b * emissiveIntensity,
                                intensity: emissiveIntensity
                            };

                            const tween = new TWEEN.Tween(startEmissive, this.tweenGroup)
                                .to(endEmissive, duration)
                                .easing(easing)
                                .onUpdate(() => {
                                    mat.emissive.setRGB(startEmissive.r, startEmissive.g, startEmissive.b);
                                    if (mat.emissiveIntensity !== undefined) {
                                        mat.emissiveIntensity = startEmissive.intensity;
                                    }
                                })
                                .onComplete(() => {
                                    if (onComplete) onComplete();
                                    this.emit('effectComplete', { effect: 'emissive' });
                                    resolve();
                                });

                            // 如果启用自动反向
                            if (autoReverse) {
                                tween.yoyo(true).repeat(loop ? Infinity : 1);
                            } else if (loop) {
                                tween.repeat(Infinity);
                            }

                            tween.start();
                            this.activeTweens.push(tween);
                        });
                    }
                });
            });
        });
    }

    /**
     * 停止当前效果
     */
    stopEffect() {
        // 停止所有活动的 Tween
        this.activeTweens.forEach((tween) => {
            tween.stop();
        });
        this.activeTweens = [];

        this.effectState.isPlaying = false;
        this.emit('effectStopped');

        console.log('[ModelEffect] 效果已停止');
    }

    /**
     * 重置到初始状态
     */
    resetEffect() {
        // 停止当前效果
        this.stopEffect();

        // 恢复每个目标的原始状态
        this.targets.forEach((obj) => {
            const state = this.originalStates.get(obj);
            if (!state) return;

            // 恢复变换
            obj.position.copy(state.position);
            obj.rotation.copy(state.rotation);
            obj.scale.copy(state.scale);

            // 恢复材质
            state.materials.forEach((matState) => {
                const { mesh, material, color, emissive, opacity, transparent } = matState;

                if (color && material.color) {
                    material.color.copy(color);
                }

                if (emissive && material.emissive) {
                    material.emissive.copy(emissive);
                }

                if (material.opacity !== undefined) {
                    material.opacity = opacity;
                    material.transparent = transparent;
                }

                material.needsUpdate = true;
            });
        });

        this.effectState.currentEffect = null;
        this.emit('effectReset');

        console.log('[ModelEffect] 已重置到初始状态');
    }

    /**
     * 更新目标对象
     * @param {THREE.Object3D|THREE.Object3D[]} newTarget - 新的目标对象
     */
    setTarget(newTarget) {
        // 停止当前效果
        this.stopEffect();

        // 清空原有状态
        this.originalStates.clear();

        // 更新目标
        this.config.target = newTarget;
        this.targets = Array.isArray(newTarget) ? newTarget : [newTarget];

        // 保存新目标的原始状态
        this.targets.forEach((obj) => {
            this.saveOriginalState(obj);
        });

        console.log('[ModelEffect] 目标对象已更新，数量:', this.targets.length);
    }

    /**
     * 每帧更新
     * @param {number} delta - 时间差（秒）
     */
    onUpdate(delta) {
        // 更新 Tween 动画组
        this.tweenGroup.update();
    }

    /**
     * 组件卸载
     */
    onUnmounted() {
        // 移除场景事件监听
        if (this.scene?.eventSystem) {
            this.scene.eventSystem.off('bakedLightingConfigUpdated', this.handleBakedLightingUpdate.bind(this));
        }

        // 停止所有效果
        this.stopEffect();

        // 清空状态
        this.targets = [];
        this.originalStates.clear();
        this.activeTweens = [];

        // eslint-disable-next-line no-console
        console.log('[ModelEffect] 组件已卸载');
    }

    /**
     * 清理资源
     */
    dispose() {
        this.stopEffect();
        this.targets = [];
        this.originalStates.clear();
        this.activeTweens = [];
        super.dispose?.();
    }
}
