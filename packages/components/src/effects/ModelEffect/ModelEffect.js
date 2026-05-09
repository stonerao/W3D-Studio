import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * English comment.
 */
export class ModelEffect extends Component {
    /**
     * English comment.
     */
    static defaultConfig = {
        target: null,                           // English comment.
        effect: 'color',                        // English comment.
        duration: 1000,                         // English comment.
        easing: TWEEN.Easing.Quadratic.Out,    // English comment.
        // English comment.
        targetColor: 0xFF0000,                  // English comment.
        // English comment.
        targetPosition: null,                   // English comment.
        targetRotation: null,                   // English comment.
        targetScale: null,                      // English comment.
        // English comment.
        targetOpacity: 1.0,                     // English comment.
        // English comment.
        targetEmissive: null,                   // English comment.
        emissiveIntensity: 1.0,                 // English comment.
        // English comment.
        autoReverse: false,                     // English comment.
        loop: false,                            // English comment.
        onComplete: null                        // English comment.
    };

    /**
     * English comment.
     */
    onMounted() {
        // English comment.
        this.targets = [];

        // English comment.
        this.originalStates = new Map();

        // English comment.
        this.activeTweens = [];

        // English comment.
        this.tweenGroup = new TWEEN.Group();

        // English comment.
        this.effectState = {
            isPlaying: false,
            currentEffect: null
        };

        // English comment.
        this.initializeTargets();

        // English comment.
        if (this.config.target && this.config.effect) {
            this.applyEffect(this.config);
        }

        // English comment.
        if (this.scene?.eventSystem) {
            this.scene.eventSystem.on('bakedLightingConfigUpdated', this.handleBakedLightingUpdate.bind(this));
        }
    }

    /**
     * English comment.
     */
    handleBakedLightingUpdate(data) {
        const config = data?.config || data;

        // eslint-disable-next-line no-console
        console.log('[ModelEffect] 接收到烘焙光照配置更新:', config);

        // English comment.
        if (this.targets.length > 0) {
            // English comment.
            // eslint-disable-next-line no-undef
            setTimeout(() => {
                // English comment.
                this.originalStates.clear();

                // English comment.
                this.targets.forEach((obj) => {
                    this.saveOriginalState(obj);
                });

                // eslint-disable-next-line no-console
                console.log('[ModelEffect] 已更新材质状态以反映烘焙光照变化');

                // English comment.
                this.emit('materialStateUpdated', { bakedLightingConfig: config });
            }, 100); // English comment.
        }
    }

    /**
     * English comment.
     */
    initializeTargets() {
        const { target } = this.config;

        if (!target) {
            console.warn('[ModelEffect] 未指定目标对象');
            return;
        }

        // English comment.
        this.targets = Array.isArray(target) ? target : [target];

        // English comment.
        this.targets.forEach((obj) => {
            this.saveOriginalState(obj);
        });

        console.log('[ModelEffect] 目标对象初始化完成，数量:', this.targets.length);
    }

    /**
     * English comment.
     */
    saveOriginalState(obj) {
        if (!obj) return;

        const state = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
            materials: []
        };

        // English comment.
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
     * English comment.
     */
    applyEffect(options = {}) {
        // English comment.
        this.stopEffect();

        // English comment.
        const effectConfig = {
            ...this.config,
            ...options
        };

        const { effect } = effectConfig;
        this.effectState.currentEffect = effect;
        this.effectState.isPlaying = true;

        // English comment.
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
     * English comment.
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

                            // English comment.
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
     * English comment.
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

                // English comment.
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
     * English comment.
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

                            // English comment.
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

                            // English comment.
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
     * English comment.
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

                            // English comment.
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
     * English comment.
     */
    stopEffect() {
        // English comment.
        this.activeTweens.forEach((tween) => {
            tween.stop();
        });
        this.activeTweens = [];

        this.effectState.isPlaying = false;
        this.emit('effectStopped');

        console.log('[ModelEffect] 效果已停止');
    }

    /**
     * English comment.
     */
    resetEffect() {
        // English comment.
        this.stopEffect();

        // English comment.
        this.targets.forEach((obj) => {
            const state = this.originalStates.get(obj);
            if (!state) return;

            // English comment.
            obj.position.copy(state.position);
            obj.rotation.copy(state.rotation);
            obj.scale.copy(state.scale);

            // English comment.
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
     * English comment.
     */
    setTarget(newTarget) {
        // English comment.
        this.stopEffect();

        // English comment.
        this.originalStates.clear();

        // English comment.
        this.config.target = newTarget;
        this.targets = Array.isArray(newTarget) ? newTarget : [newTarget];

        // English comment.
        this.targets.forEach((obj) => {
            this.saveOriginalState(obj);
        });

        console.log('[ModelEffect] 目标对象已更新，数量:', this.targets.length);
    }

    /**
     * English comment.
     */
    onUpdate(delta) {
        // English comment.
        this.tweenGroup.update();
    }

    /**
     * English comment.
     */
    onUnmounted() {
        // English comment.
        if (this.scene?.eventSystem) {
            this.scene.eventSystem.off('bakedLightingConfigUpdated', this.handleBakedLightingUpdate.bind(this));
        }

        // English comment.
        this.stopEffect();

        // English comment.
        this.targets = [];
        this.originalStates.clear();
        this.activeTweens = [];

        // eslint-disable-next-line no-console
        console.log('[ModelEffect] 组件已卸载');
    }

    /**
     * English comment.
     */
    dispose() {
        this.stopEffect();
        this.targets = [];
        this.originalStates.clear();
        this.activeTweens = [];
        super.dispose?.();
    }
}
