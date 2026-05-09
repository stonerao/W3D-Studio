import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * English comment.
 */
export class ExplodedView extends Component {
    /**
     * English comment.
     */
    static defaultConfig = {
        floorMap: {},              // English comment.
        floorOrder: [],            // English comment.
        gap: 10,                   // English comment.
        animate: true,             // English comment.
        time: 2,                   // English comment.
        start: 1,                  // English comment.
        offset: {                  // English comment.
            x: 0,
            y: 1,
            z: 0
        },
        // English comment.
        // English comment.
        direction: 'up',
        delayStep: 100,            // English comment.
        customOffsets: {},         // English comment.
        highlightColor: 0x07A6FF,  // English comment.
        highlightIntensity: 1.5,   // English comment.
        // English comment.
        // English comment.
        //        | 'cubic-out' | 'cubic-inout' | 'elastic-out' | 'bounce-out' | 'back-out'
        easingPreset: 'quadratic-out'
    };

    /**
     * English comment.
     */
    onMounted() {
        console.log('[ExplodedView] 组件挂载，配置:', this.config);

        // English comment.
        this.floors = new Map();

        // English comment.
        this.originalPositions = new Map();

        // English comment.
        this.originalMaterials = new Map();

        // English comment.
        this.floorOrder = new Map();

        // English comment.
        this.floorAnimateConfig = new Map();

        // English comment.
        this.selectedFloorIndex = null;

        // English comment.
        this.currentState = 'normal';

        // English comment.
        this.tweenGroup = new TWEEN.Group();

        // English comment.
        this.initializeFloors();

        console.log('[ExplodedView] 组件挂载完成，已初始化 ' + this.floors.size + ' 个楼层');
    }

    syncBatchedModelLoaders() {
        const componentMaps = [
            this.scene?.components,
            this.scene?.componentManager?.components
        ].filter(Boolean);
        const visited = new Set();

        componentMaps.forEach((componentMap) => {
            const values = typeof componentMap.values === 'function'
                ? componentMap.values()
                : Object.values(componentMap);
            for (const component of values) {
                if (!component || visited.has(component)) continue;
                visited.add(component);
                if (component.performanceBatchState) {
                    component.syncPerformanceBatchMatrices?.();
                }
            }
        });

        const allComponents = this.scene?.componentManager?.getAll?.() || [];
        allComponents.forEach((component) => {
            if (!component || visited.has(component)) return;
            visited.add(component);
            if (component.performanceBatchState) {
                component.syncPerformanceBatchMatrices?.();
            }
        });
    }

    setObjectVisibleWithBatchProxy(object, visible) {
        if (!object) return;

        let hasBatchProxy = false;
        const applyProxyVisibility = (child) => {
            const record = child?.userData?.__w3dPerformanceBatchProxy;
            if (!record) return;

            hasBatchProxy = true;
            record.proxyVisible = visible !== false;
            child.visible = false;
            record.batchedMesh?.setVisibleAt?.(record.instanceId, record.proxyVisible);
        };

        if (typeof object.traverse === 'function') {
            object.traverse(applyProxyVisibility);
        } else {
            applyProxyVisibility(object);
        }

        if (!object.userData?.__w3dPerformanceBatchProxy) {
            object.visible = visible;
        } else {
            object.visible = false;
        }

        if (hasBatchProxy) {
            this.syncBatchedModelLoaders();
        }
    }

    /**
     * English comment.
     */
    initializeFloors() {
        const { floorMap } = this.config;

        console.log('[ExplodedView] 开始初始化楼层');
        console.log('[ExplodedView] floorMap 配置:', JSON.stringify(floorMap, null, 2));

        if (!floorMap || Object.keys(floorMap).length === 0) {
            console.warn('[ExplodedView] floorMap 为空，无法初始化楼层');
            return;
        }

        // English comment.
        this.floorOrder = this.createFloorOrder(Object.keys(floorMap));

        // English comment.
        Object.entries(floorMap).forEach(([index, floorConfig]) => {
            const floorIndex = String(index);

            // English comment.
            let modelNames = [];
            let shouldAnimate = true;

            if (Array.isArray(floorConfig)) {
                // English comment.
                modelNames = floorConfig;
                console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用数组格式`);
            } else if (floorConfig && typeof floorConfig === 'object') {
                // English comment.
                // English comment.
                if (floorConfig.meshes && Array.isArray(floorConfig.meshes)) {
                    modelNames = floorConfig.meshes;
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 meshes 格式，共 ${modelNames.length} 个`);
                }
                // English comment.
                else if (floorConfig.modelLoaders && Array.isArray(floorConfig.modelLoaders)) {
                    modelNames = floorConfig.modelLoaders.flatMap(loader => loader.meshes || []);
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 modelLoaders 格式`);
                }
                // English comment.
                else if (floorConfig.models && Array.isArray(floorConfig.models)) {
                    modelNames = floorConfig.models;
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 models 格式`);
                }
                shouldAnimate = floorConfig.animate !== false;
            } else if (typeof floorConfig === 'string') {
                // English comment.
                modelNames = [floorConfig];
                console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用字符串格式`);
            }

            console.log(`[ExplodedView] 楼层 ${floorIndex} 需要查找的模型:`, modelNames);

            // English comment.
            this.floorAnimateConfig.set(floorIndex, shouldAnimate);            // English comment.
            const floorObjects = [];
            // English comment.
            const positionsMap = new Map();
            // English comment.
            const materialsMap = new Map();

            modelNames.forEach((modelName) => {
                // English comment.
                let modelObject = null;

                // English comment.
                modelObject = this.scene.scene.getObjectByName(modelName);

                // English comment.
                if (!modelObject) {
                    this.scene.scene.traverse((child) => {
                        if (!modelObject && child.name === modelName) {
                            modelObject = child;
                        }
                    });
                }

                // English comment.
                if (!modelObject && this.scene.components) {
                    for (const [, comp] of this.scene.components) {
                        if (comp.componentScene) {
                            const found = comp.componentScene.getObjectByName(modelName);
                            if (found) {
                                modelObject = found;
                                break;
                            }
                        }
                        if (comp.model) {
                            const found = comp.model.getObjectByName ? comp.model.getObjectByName(modelName) : null;
                            if (found) {
                                modelObject = found;
                                break;
                            }
                        }
                    }
                }

                if (modelObject) {
                    floorObjects.push(modelObject);

                    // English comment.
                    positionsMap.set(modelName, modelObject.position.clone());

                    // English comment.
                    const materials = [];
                    modelObject.traverse((child) => {
                        if (child.isMesh && child.material) {
                            materials.push({
                                mesh: child,
                                material: child.material.clone()
                            });
                        }
                    });
                    materialsMap.set(modelName, materials);

                    console.log(`[ExplodedView] ✓ 找到楼层 ${floorIndex} 模型: ${modelName}`, {
                        type: modelObject.type,
                        position: modelObject.position.toArray()
                    });
                } else {
                    console.warn(`[ExplodedView] ✗ 未找到楼层 ${floorIndex} 的模型: ${modelName}`);
                    // English comment.
                    const availableNames = [];
                    this.scene.scene.traverse((child) => {
                        if (child.name && !child.name.startsWith('__')) {
                            availableNames.push(child.name);
                        }
                    });
                    console.log('[ExplodedView] 场景中可用的对象名称 (前20个):', availableNames.slice(0, 20));
                }
            });

            if (floorObjects.length > 0) {
                this.floors.set(floorIndex, floorObjects);
                this.originalPositions.set(floorIndex, positionsMap);
                this.originalMaterials.set(floorIndex, materialsMap);
                console.log(`[ExplodedView] 楼层 ${floorIndex} 初始化完成，共 ${floorObjects.length} 个模型`);
            }
        });

        console.log(`[ExplodedView] 初始化完成，共找到 ${this.floors.size} 个楼层`);
    }

    /**
     * English comment.
     */
    resolveOffset() {
        const { direction, offset } = this.config;
        const presets = {
            up:      { x: 0,  y: 1,  z: 0  },
            down:    { x: 0,  y: -1, z: 0  },
            left:    { x: -1, y: 0,  z: 0  },
            right:   { x: 1,  y: 0,  z: 0  },
            forward: { x: 0,  y: 0,  z: 1  },
            back:    { x: 0,  y: 0,  z: -1 }
        };
        return presets[direction] || offset || { x: 0, y: 1, z: 0 };
    }

    /**
     * English comment.
     */
    resolveEasing() {
        const preset = this.config.easingPreset || 'quadratic-out';
        const easingMap = {
            'linear':           TWEEN.Easing.Linear.None,
            'quadratic-in':     TWEEN.Easing.Quadratic.In,
            'quadratic-out':    TWEEN.Easing.Quadratic.Out,
            'quadratic-inout':  TWEEN.Easing.Quadratic.InOut,
            'cubic-out':        TWEEN.Easing.Cubic.Out,
            'cubic-inout':      TWEEN.Easing.Cubic.InOut,
            'elastic-out':      TWEEN.Easing.Elastic.Out,
            'bounce-out':       TWEEN.Easing.Bounce.Out,
            'back-out':         TWEEN.Easing.Back.Out
        };
        return easingMap[preset] || TWEEN.Easing.Quadratic.Out;
    }

    /**
     * English comment.
     */
    createFloorOrder(floorIndices) {
        const orderMap = new Map();
        const configOrder = this.config.floorOrder;

        // English comment.
        if (Array.isArray(configOrder) && configOrder.length > 0) {
            // English comment.
            const orderedSet = configOrder.map(String);
            const remaining = floorIndices.filter(i => !orderedSet.includes(String(i)));
            const finalOrder = [...orderedSet.filter(i => floorIndices.map(String).includes(i)), ...remaining];
            finalOrder.forEach((index, order) => {
                orderMap.set(String(index), order);
            });
            return orderMap;
        }

        // English comment.
        const numericFloors = [];
        const specialFloors = [];

        floorIndices.forEach((index) => {
            const num = parseInt(index);
            if (!isNaN(num)) {
                numericFloors.push({ index, num });
            } else {
                specialFloors.push(index);
            }
        });

        numericFloors.sort((a, b) => a.num - b.num);

        let order = 0;
        numericFloors.forEach(({ index }) => {
            orderMap.set(index, order++);
        });
        specialFloors.forEach((index) => {
            orderMap.set(index, order++);
        });

        return orderMap;
    }

    /**
     * English comment.
     */
    calculateFloorOffset(floorIndex) {
        const { gap, start, customOffsets } = this.config;

        // English comment.
        if (customOffsets && customOffsets[floorIndex]) {
            return customOffsets[floorIndex];
        }

        // English comment.
        const offset = this.resolveOffset();

        // English comment.
        const currentOrder = this.floorOrder.get(String(floorIndex)) ?? 0;
        const startOrder = this.floorOrder.get(String(start)) ?? 0;
        const relativeIndex = currentOrder - startOrder;

        return {
            x: offset.x * relativeIndex * gap,
            y: offset.y * relativeIndex * gap,
            z: offset.z * relativeIndex * gap
        };
    }

    /**
     * English comment.
     */
    start() {
        if (this.currentState === 'exploded') {
            console.warn('[ExplodedView] 已处于爆炸状态');
            return;
        }

        console.log('[ExplodedView] ========== 开始爆炸效果 ==========');
        console.log('[ExplodedView] 已初始化的楼层数:', this.floors.size);
        console.log('[ExplodedView] 楼层列表:', Array.from(this.floors.keys()));
        console.log(this.config);

        // English comment.
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();

            // English comment.
            if (this.floors.size === 0) {
                console.error('[ExplodedView] 没有可爆炸的楼层！请检查 floorMap 配置和模型名称是否匹配');
                return;
            }
            console.log('[ExplodedView] 重新初始化成功，共找到 ' + this.floors.size + ' 个楼层');
        }

        this.currentState = 'exploded';

        const { animate, time, direction, delayStep } = this.config;
        const easing = this.resolveEasing();
        const resolvedOffset = this.resolveOffset();
        console.log('[ExplodedView] 动画配置:', { animate, time, direction, delayStep, resolvedOffset });

        // English comment.
        // English comment.
        const floorIndices = Array.from(this.floors.keys()).sort((a, b) => {
            const orderA = this.floorOrder.get(a) ?? 0;
            const orderB = this.floorOrder.get(b) ?? 0;
            return direction === 'down' ? orderB - orderA : orderA - orderB;
        });

        // English comment.
        this.tweenGroup.removeAll();

        floorIndices.forEach((floorIndex, arrayIndex) => {
            const floorObjects = this.floors.get(floorIndex);
            if (!floorObjects || floorObjects.length === 0) return;
            console.log(floorObjects);
            // English comment.
            const shouldAnimate = this.floorAnimateConfig.get(floorIndex);
            if (shouldAnimate === false) {
                console.log(`[ExplodedView] 楼层 ${floorIndex} 配置为不参与爆炸效果，跳过`);
                return;
            }

            const positionsMap = this.originalPositions.get(floorIndex);
            const targetOffset = this.calculateFloorOffset(floorIndex);
            console.log(`[ExplodedView] 楼层 ${floorIndex} 目标偏移:`, targetOffset);

            // English comment.
            floorObjects.forEach((modelObject) => {
                const modelName = modelObject.name;
                const originalPos = positionsMap.get(modelName);
                if (!originalPos) return;

                const targetPosition = {
                    x: originalPos.x + targetOffset.x,
                    y: originalPos.y + targetOffset.y,
                    z: originalPos.z + targetOffset.z
                };

                if (animate) {
                    // English comment.
                    const delay = arrayIndex * delayStep;
                    const duration = time * 1000; // English comment.

                    new TWEEN.Tween(modelObject.position, this.tweenGroup)
                        .to(targetPosition, duration)
                        .delay(delay)
                        .easing(easing)
                        .start();
                } else {
                    // English comment.
                    modelObject.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
                }
            });
            this.syncBatchedModelLoaders();

            console.log(`[ExplodedView] 楼层 ${floorIndex} 开始爆炸动画，包含 ${floorObjects.length} 个模型`);
        });

        this.emit('exploded');
    }

    /**
     * English comment.
     */
    reset() {
        if (this.currentState === 'normal') {
            console.warn('[ExplodedView] 已处于正常状态');
            return;
        }

        console.log('[ExplodedView] 重置爆炸效果');

        // English comment.
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        this.currentState = 'normal';

        const { animate, time, direction, delayStep } = this.config;
        const easing = this.resolveEasing();

        // English comment.
        // English comment.
        const floorIndices = Array.from(this.floors.keys()).sort((a, b) => {
            const orderA = this.floorOrder.get(a) ?? 0;
            const orderB = this.floorOrder.get(b) ?? 0;
            return direction === 'down' ? orderA - orderB : orderB - orderA;
        });

        // English comment.
        this.tweenGroup.removeAll();

        floorIndices.forEach((floorIndex, arrayIndex) => {
            const floorObjects = this.floors.get(floorIndex);
            if (!floorObjects || floorObjects.length === 0) return;

            // English comment.
            const shouldAnimate = this.floorAnimateConfig.get(floorIndex);
            if (shouldAnimate === false) {
                console.log(`[ExplodedView] 楼层 ${floorIndex} 配置为不参与爆炸效果，跳过重置`);
                return;
            }

            const positionsMap = this.originalPositions.get(floorIndex);

            // English comment.
            floorObjects.forEach((modelObject) => {
                const modelName = modelObject.name;
                const originalPos = positionsMap.get(modelName);
                if (!originalPos) return;

                if (animate) {
                    // English comment.
                    const delay = arrayIndex * delayStep;
                    const duration = time * 1000; // English comment.

                    new TWEEN.Tween(modelObject.position, this.tweenGroup)
                        .to({ x: originalPos.x, y: originalPos.y, z: originalPos.z }, duration)
                        .delay(delay)
                        .easing(easing)
                        .start();
                } else {
                    // English comment.
                    modelObject.position.copy(originalPos);
                }
            });
            this.syncBatchedModelLoaders();

            console.log(`[ExplodedView] 楼层 ${floorIndex} 开始重置动画，包含 ${floorObjects.length} 个模型`);
        });

        // English comment.
        if (this.selectedFloorIndex !== null) {
            this.deselectFloor();
        }

        this.emit('reset');
    }

    /**
     * English comment.
     */
    selectFloor(floorIndex) {
        const floorKey = String(floorIndex);

        // English comment.
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        if (!this.floors.has(floorKey)) {
            console.warn(`[ExplodedView] 楼层 ${floorIndex} 不存在`);
            return;
        }

        // English comment.
        if (this.selectedFloorIndex !== null) {
            this.deselectFloor();
        }

        console.log(`[ExplodedView] 选中楼层 ${floorIndex}`);
        this.selectedFloorIndex = floorKey;

        const floorObjects = this.floors.get(floorKey);
        this.highlightFloor(floorObjects);

        this.emit('floorSelected', { floorIndex: floorKey });
    }

    /**
     * English comment.
     */
    deselectFloor() {
        if (this.selectedFloorIndex === null) return;

        console.log(`[ExplodedView] 取消选中楼层 ${this.selectedFloorIndex}`);

        const floorObjects = this.floors.get(this.selectedFloorIndex);
        this.unhighlightFloor(floorObjects, this.selectedFloorIndex);

        this.selectedFloorIndex = null;
        this.emit('floorDeselected');
    }

    /**
     * English comment.
     */
    highlightFloor(floorObjects) {
        const { highlightColor, highlightIntensity } = this.config;

        floorObjects.forEach((modelObject) => {
            modelObject.traverse((child) => {
                if (child.isMesh && child.material) {
                    // English comment.
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material;
                        child.material = child.material.clone();
                    }

                    // English comment.
                    child.material.emissive = new THREE.Color(highlightColor);
                    child.material.emissiveIntensity = highlightIntensity;
                }
            });
        });
    }

    /**
     * English comment.
     */
    unhighlightFloor(floorObjects, _floorIndex) {
        if (!floorObjects) return;

        floorObjects.forEach((modelObject) => {
            modelObject.traverse((child) => {
                if (child.isMesh && child.userData.originalMaterial) {
                    // English comment.
                    child.material = child.userData.originalMaterial;
                    delete child.userData.originalMaterial;
                }
            });
        });
    }

    /**
     * English comment.
     */
    setFloorVisible(floorIndex, visible) {
        const floorKey = String(floorIndex);

        // English comment.
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        if (!this.floors.has(floorKey)) {
            console.warn(`[ExplodedView] 楼层 ${floorIndex} 不存在`);
            return;
        }

        const floorObjects = this.floors.get(floorKey);
        floorObjects.forEach((modelObject) => {
            this.setObjectVisibleWithBatchProxy(modelObject, visible);
        });

        console.log(`[ExplodedView] 设置楼层 ${floorIndex} 可见性: ${visible}`);
        this.emit('floorVisibilityChanged', { floorIndex: floorKey, visible });
    }

    /**
     * English comment.
     */
    setFloorOffset(floorIndex, offset) {
        const floorKey = String(floorIndex);

        // English comment.
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        if (!this.floors.has(floorKey)) {
            console.warn(`[ExplodedView] 楼层 ${floorIndex} 不存在`);
            return;
        }

        const { animate, time, easing } = this.config;
        const floorObjects = this.floors.get(floorKey);
        const positionsMap = this.originalPositions.get(floorKey);

        floorObjects.forEach((modelObject) => {
            const modelName = modelObject.name;
            const originalPos = positionsMap.get(modelName);
            if (!originalPos) return;

            const targetPosition = {
                x: originalPos.x + offset.x,
                y: originalPos.y + offset.y,
                z: originalPos.z + offset.z
            };

            if (animate) {
                // English comment.
                const duration = time * 1000;

                new TWEEN.Tween(modelObject.position, this.tweenGroup)
                    .to(targetPosition, duration)
                    .easing(easing)
                    .start();
            } else {
                // English comment.
                modelObject.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
            }
        });
        this.syncBatchedModelLoaders();

        console.log(`[ExplodedView] 设置楼层 ${floorIndex} 偏移:`, offset);
        this.emit('floorOffsetChanged', { floorIndex: floorKey, offset });
    }

    /**
     * English comment.
     */
    getFloor(floorIndex) {
        return this.floors.get(String(floorIndex));
    }

    /**
     * English comment.
     */
    getFloorIndices() {
        return Array.from(this.floors.keys());
    }

    /**
     * English comment.
     */
    async updateConfig(newConfig) {
        console.log('[ExplodedView] 更新配置:', newConfig);

        // English comment.
        this.config = {
            ...this.config,
            ...newConfig
        };

        // English comment.
        if (newConfig.floorMap !== undefined) {
            console.log('[ExplodedView] floorMap 变化，重新初始化楼层');

            // English comment.
            if (this.currentState === 'exploded') {
                this.reset();
            }

            // English comment.
            this.floors.clear();
            this.originalPositions.clear();
            this.originalMaterials.clear();
            this.floorOrder.clear();
            this.floorAnimateConfig.clear();
            this.selectedFloorIndex = null;

            // English comment.
            this.initializeFloors();

            console.log('[ExplodedView] 配置已更新，楼层已重新初始化，共 ' + this.floors.size + ' 个楼层');
        }
    }

    /**
     * English comment.
     */
    onUpdate(_delta) {
        const hasActiveTweens = (this.tweenGroup.getAll?.() || []).length > 0;
        if (!hasActiveTweens) return;

        // English comment.
        this.tweenGroup.update();
        const stillActive = (this.tweenGroup.getAll?.() || []).length > 0;
        if (hasActiveTweens || stillActive) {
            this.syncBatchedModelLoaders();
        }
    }

    /**
     * English comment.
     */
    onDispose() {
        console.log('[ExplodedView] 销毁组件');

        // English comment.
        this.tweenGroup.removeAll();

        // English comment.
        this.floors.forEach((floorObjects, floorIndex) => {
            const positionsMap = this.originalPositions.get(floorIndex);

            if (floorObjects && positionsMap) {
                floorObjects.forEach((modelObject) => {
                    const originalPos = positionsMap.get(modelObject.name);
                    if (originalPos) {
                        modelObject.position.copy(originalPos);
                    }
                });
            }
            this.syncBatchedModelLoaders();

            // English comment.
            this.unhighlightFloor(floorObjects, floorIndex);
        });

        // English comment.
        this.floors.clear();
        this.originalPositions.clear();
        this.originalMaterials.clear();
    }
}
