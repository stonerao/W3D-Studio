import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * Effects module component that applies visual emphasis and material effects to target models.
 */
export class ModelEffect extends Component {
    static defaultConfig = {
        target: null,
        effect: 'color',
        duration: 1000,
        easing: TWEEN.Easing.Quadratic.Out,
        targetColor: 0xFF0000,
        targetPosition: null,
        targetRotation: null,
        targetScale: null,
        targetOpacity: 1.0,
        targetEmissive: null,
        emissiveIntensity: 1.0,
        autoReverse: false,
        loop: false,
        onComplete: null
    };

    onMounted() {
        this.targets = [];

        this.originalStates = new Map();

        this.activeTweens = [];

        this.tweenGroup = new TWEEN.Group();

        this.effectState = {
            isPlaying: false,
            currentEffect: null
        };

        this.initializeTargets();

        if (this.config.target && this.config.effect) {
            this.applyEffect(this.config);
        }

        if (this.scene?.eventSystem) {
            this.scene.eventSystem.on('bakedLightingConfigUpdated', this.handleBakedLightingUpdate.bind(this));
        }
    }

    handleBakedLightingUpdate(data) {
        const config = data?.config || data;

        // eslint-disable-next-line no-console
        console.log('[ModelEffect] 接收到烘焙光照配置更新:', config);

        if (this.targets.length > 0) {
            // eslint-disable-next-line no-undef
            setTimeout(() => {
                this.originalStates.clear();

                this.targets.forEach((obj) => {
                    this.saveOriginalState(obj);
                });

                // eslint-disable-next-line no-console
                console.log('[ModelEffect] 已更新材质状态以反映烘焙光照变化');

                this.emit('materialStateUpdated', { bakedLightingConfig: config });
            }, 100);
        }
    }

    initializeTargets() {
        const { target } = this.config;

        if (!target) {
            console.warn('[ModelEffect] 未指定目标对象');
            return;
        }

        this.targets = Array.isArray(target) ? target : [target];

        this.targets.forEach((obj) => {
            this.saveOriginalState(obj);
        });

        console.log('[ModelEffect] 目标对象初始化完成，数量:', this.targets.length);
    }

    saveOriginalState(obj) {
        if (!obj) return;

        const state = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
            materials: []
        };

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

    applyEffect(options = {}) {
        this.stopEffect();

        const effectConfig = {
            ...this.config,
            ...options
        };

        const { effect } = effectConfig;
        this.effectState.currentEffect = effect;
        this.effectState.isPlaying = true;

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

    stopEffect() {
        this.activeTweens.forEach((tween) => {
            tween.stop();
        });
        this.activeTweens = [];

        this.effectState.isPlaying = false;
        this.emit('effectStopped');

        console.log('[ModelEffect] 效果已停止');
    }

    resetEffect() {
        this.stopEffect();

        this.targets.forEach((obj) => {
            const state = this.originalStates.get(obj);
            if (!state) return;

            obj.position.copy(state.position);
            obj.rotation.copy(state.rotation);
            obj.scale.copy(state.scale);

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

    setTarget(newTarget) {
        this.stopEffect();

        this.originalStates.clear();

        this.config.target = newTarget;
        this.targets = Array.isArray(newTarget) ? newTarget : [newTarget];

        this.targets.forEach((obj) => {
            this.saveOriginalState(obj);
        });

        console.log('[ModelEffect] 目标对象已更新，数量:', this.targets.length);
    }

    onUpdate(delta) {
        this.tweenGroup.update();
    }

    onUnmounted() {
        if (this.scene?.eventSystem) {
            this.scene.eventSystem.off('bakedLightingConfigUpdated', this.handleBakedLightingUpdate.bind(this));
        }

        this.stopEffect();

        this.targets = [];
        this.originalStates.clear();
        this.activeTweens = [];

        // eslint-disable-next-line no-console
        console.log('[ModelEffect] 组件已卸载');
    }

    dispose() {
        this.stopEffect();
        this.targets = [];
        this.originalStates.clear();
        this.activeTweens = [];
        super.dispose?.();
    }
}
