import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * Effects module component that separates model parts into an exploded-view layout for inspection.
 */
export class ExplodedView extends Component {
    static defaultConfig = {
        floorMap: {},
        floorOrder: [],
        gap: 10,
        animate: true,
        time: 2,
        start: 1,
        offset: {
            x: 0,
            y: 1,
            z: 0
        },
        direction: 'up',
        delayStep: 100,
        customOffsets: {},
        highlightColor: 0x07A6FF,
        highlightIntensity: 1.5,
        //        | 'cubic-out' | 'cubic-inout' | 'elastic-out' | 'bounce-out' | 'back-out'
        easingPreset: 'quadratic-out'
    };

    onMounted() {
        console.log('[ExplodedView] 组件挂载，配置:', this.config);

        this.floors = new Map();

        this.originalPositions = new Map();

        this.originalMaterials = new Map();

        this.floorOrder = new Map();

        this.floorAnimateConfig = new Map();

        this.selectedFloorIndex = null;

        this.currentState = 'normal';

        this.tweenGroup = new TWEEN.Group();

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

    initializeFloors() {
        const { floorMap } = this.config;

        console.log('[ExplodedView] 开始初始化楼层');
        console.log('[ExplodedView] floorMap 配置:', JSON.stringify(floorMap, null, 2));

        if (!floorMap || Object.keys(floorMap).length === 0) {
            console.warn('[ExplodedView] floorMap 为空，无法初始化楼层');
            return;
        }

        this.floorOrder = this.createFloorOrder(Object.keys(floorMap));

        Object.entries(floorMap).forEach(([index, floorConfig]) => {
            const floorIndex = String(index);

            let modelNames = [];
            let shouldAnimate = true;

            if (Array.isArray(floorConfig)) {
                modelNames = floorConfig;
                console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用数组格式`);
            } else if (floorConfig && typeof floorConfig === 'object') {
                if (floorConfig.meshes && Array.isArray(floorConfig.meshes)) {
                    modelNames = floorConfig.meshes;
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 meshes 格式，共 ${modelNames.length} 个`);
                }
                else if (floorConfig.modelLoaders && Array.isArray(floorConfig.modelLoaders)) {
                    modelNames = floorConfig.modelLoaders.flatMap(loader => loader.meshes || []);
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 modelLoaders 格式`);
                }
                else if (floorConfig.models && Array.isArray(floorConfig.models)) {
                    modelNames = floorConfig.models;
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 models 格式`);
                }
                shouldAnimate = floorConfig.animate !== false;
            } else if (typeof floorConfig === 'string') {
                modelNames = [floorConfig];
                console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用字符串格式`);
            }

            console.log(`[ExplodedView] 楼层 ${floorIndex} 需要查找的模型:`, modelNames);

            this.floorAnimateConfig.set(floorIndex, shouldAnimate);
            const floorObjects = [];
            const positionsMap = new Map();
            const materialsMap = new Map();

            modelNames.forEach((modelName) => {
                let modelObject = null;

                modelObject = this.scene.scene.getObjectByName(modelName);

                if (!modelObject) {
                    this.scene.scene.traverse((child) => {
                        if (!modelObject && child.name === modelName) {
                            modelObject = child;
                        }
                    });
                }

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

                    positionsMap.set(modelName, modelObject.position.clone());

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

    createFloorOrder(floorIndices) {
        const orderMap = new Map();
        const configOrder = this.config.floorOrder;

        if (Array.isArray(configOrder) && configOrder.length > 0) {
            const orderedSet = configOrder.map(String);
            const remaining = floorIndices.filter(i => !orderedSet.includes(String(i)));
            const finalOrder = [...orderedSet.filter(i => floorIndices.map(String).includes(i)), ...remaining];
            finalOrder.forEach((index, order) => {
                orderMap.set(String(index), order);
            });
            return orderMap;
        }

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

    calculateFloorOffset(floorIndex) {
        const { gap, start, customOffsets } = this.config;

        if (customOffsets && customOffsets[floorIndex]) {
            return customOffsets[floorIndex];
        }

        const offset = this.resolveOffset();

        const currentOrder = this.floorOrder.get(String(floorIndex)) ?? 0;
        const startOrder = this.floorOrder.get(String(start)) ?? 0;
        const relativeIndex = currentOrder - startOrder;

        return {
            x: offset.x * relativeIndex * gap,
            y: offset.y * relativeIndex * gap,
            z: offset.z * relativeIndex * gap
        };
    }

    start() {
        if (this.currentState === 'exploded') {
            console.warn('[ExplodedView] 已处于爆炸状态');
            return;
        }

        console.log('[ExplodedView] ========== 开始爆炸效果 ==========');
        console.log('[ExplodedView] 已初始化的楼层数:', this.floors.size);
        console.log('[ExplodedView] 楼层列表:', Array.from(this.floors.keys()));
        console.log(this.config);

        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();

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

        const floorIndices = Array.from(this.floors.keys()).sort((a, b) => {
            const orderA = this.floorOrder.get(a) ?? 0;
            const orderB = this.floorOrder.get(b) ?? 0;
            return direction === 'down' ? orderB - orderA : orderA - orderB;
        });

        this.tweenGroup.removeAll();

        floorIndices.forEach((floorIndex, arrayIndex) => {
            const floorObjects = this.floors.get(floorIndex);
            if (!floorObjects || floorObjects.length === 0) return;
            console.log(floorObjects);
            const shouldAnimate = this.floorAnimateConfig.get(floorIndex);
            if (shouldAnimate === false) {
                console.log(`[ExplodedView] 楼层 ${floorIndex} 配置为不参与爆炸效果，跳过`);
                return;
            }

            const positionsMap = this.originalPositions.get(floorIndex);
            const targetOffset = this.calculateFloorOffset(floorIndex);
            console.log(`[ExplodedView] 楼层 ${floorIndex} 目标偏移:`, targetOffset);

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
                    const delay = arrayIndex * delayStep;
                    const duration = time * 1000;

                    new TWEEN.Tween(modelObject.position, this.tweenGroup)
                        .to(targetPosition, duration)
                        .delay(delay)
                        .easing(easing)
                        .start();
                } else {
                    modelObject.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
                }
            });
            this.syncBatchedModelLoaders();

            console.log(`[ExplodedView] 楼层 ${floorIndex} 开始爆炸动画，包含 ${floorObjects.length} 个模型`);
        });

        this.emit('exploded');
    }

    reset() {
        if (this.currentState === 'normal') {
            console.warn('[ExplodedView] 已处于正常状态');
            return;
        }

        console.log('[ExplodedView] 重置爆炸效果');

        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        this.currentState = 'normal';

        const { animate, time, direction, delayStep } = this.config;
        const easing = this.resolveEasing();

        const floorIndices = Array.from(this.floors.keys()).sort((a, b) => {
            const orderA = this.floorOrder.get(a) ?? 0;
            const orderB = this.floorOrder.get(b) ?? 0;
            return direction === 'down' ? orderA - orderB : orderB - orderA;
        });

        this.tweenGroup.removeAll();

        floorIndices.forEach((floorIndex, arrayIndex) => {
            const floorObjects = this.floors.get(floorIndex);
            if (!floorObjects || floorObjects.length === 0) return;

            const shouldAnimate = this.floorAnimateConfig.get(floorIndex);
            if (shouldAnimate === false) {
                console.log(`[ExplodedView] 楼层 ${floorIndex} 配置为不参与爆炸效果，跳过重置`);
                return;
            }

            const positionsMap = this.originalPositions.get(floorIndex);

            floorObjects.forEach((modelObject) => {
                const modelName = modelObject.name;
                const originalPos = positionsMap.get(modelName);
                if (!originalPos) return;

                if (animate) {
                    const delay = arrayIndex * delayStep;
                    const duration = time * 1000;

                    new TWEEN.Tween(modelObject.position, this.tweenGroup)
                        .to({ x: originalPos.x, y: originalPos.y, z: originalPos.z }, duration)
                        .delay(delay)
                        .easing(easing)
                        .start();
                } else {
                    modelObject.position.copy(originalPos);
                }
            });
            this.syncBatchedModelLoaders();

            console.log(`[ExplodedView] 楼层 ${floorIndex} 开始重置动画，包含 ${floorObjects.length} 个模型`);
        });

        if (this.selectedFloorIndex !== null) {
            this.deselectFloor();
        }

        this.emit('reset');
    }

    selectFloor(floorIndex) {
        const floorKey = String(floorIndex);

        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        if (!this.floors.has(floorKey)) {
            console.warn(`[ExplodedView] 楼层 ${floorIndex} 不存在`);
            return;
        }

        if (this.selectedFloorIndex !== null) {
            this.deselectFloor();
        }

        console.log(`[ExplodedView] 选中楼层 ${floorIndex}`);
        this.selectedFloorIndex = floorKey;

        const floorObjects = this.floors.get(floorKey);
        this.highlightFloor(floorObjects);

        this.emit('floorSelected', { floorIndex: floorKey });
    }

    deselectFloor() {
        if (this.selectedFloorIndex === null) return;

        console.log(`[ExplodedView] 取消选中楼层 ${this.selectedFloorIndex}`);

        const floorObjects = this.floors.get(this.selectedFloorIndex);
        this.unhighlightFloor(floorObjects, this.selectedFloorIndex);

        this.selectedFloorIndex = null;
        this.emit('floorDeselected');
    }

    highlightFloor(floorObjects) {
        const { highlightColor, highlightIntensity } = this.config;

        floorObjects.forEach((modelObject) => {
            modelObject.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material;
                        child.material = child.material.clone();
                    }

                    child.material.emissive = new THREE.Color(highlightColor);
                    child.material.emissiveIntensity = highlightIntensity;
                }
            });
        });
    }

    unhighlightFloor(floorObjects, _floorIndex) {
        if (!floorObjects) return;

        floorObjects.forEach((modelObject) => {
            modelObject.traverse((child) => {
                if (child.isMesh && child.userData.originalMaterial) {
                    child.material = child.userData.originalMaterial;
                    delete child.userData.originalMaterial;
                }
            });
        });
    }

    setFloorVisible(floorIndex, visible) {
        const floorKey = String(floorIndex);

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

    setFloorOffset(floorIndex, offset) {
        const floorKey = String(floorIndex);

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
                const duration = time * 1000;

                new TWEEN.Tween(modelObject.position, this.tweenGroup)
                    .to(targetPosition, duration)
                    .easing(easing)
                    .start();
            } else {
                modelObject.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
            }
        });
        this.syncBatchedModelLoaders();

        console.log(`[ExplodedView] 设置楼层 ${floorIndex} 偏移:`, offset);
        this.emit('floorOffsetChanged', { floorIndex: floorKey, offset });
    }

    getFloor(floorIndex) {
        return this.floors.get(String(floorIndex));
    }

    getFloorIndices() {
        return Array.from(this.floors.keys());
    }

    async updateConfig(newConfig) {
        console.log('[ExplodedView] 更新配置:', newConfig);

        this.config = {
            ...this.config,
            ...newConfig
        };

        if (newConfig.floorMap !== undefined) {
            console.log('[ExplodedView] floorMap 变化，重新初始化楼层');

            if (this.currentState === 'exploded') {
                this.reset();
            }

            this.floors.clear();
            this.originalPositions.clear();
            this.originalMaterials.clear();
            this.floorOrder.clear();
            this.floorAnimateConfig.clear();
            this.selectedFloorIndex = null;

            this.initializeFloors();

            console.log('[ExplodedView] 配置已更新，楼层已重新初始化，共 ' + this.floors.size + ' 个楼层');
        }
    }

    onUpdate(_delta) {
        const hasActiveTweens = (this.tweenGroup.getAll?.() || []).length > 0;
        if (!hasActiveTweens) return;

        this.tweenGroup.update();
        const stillActive = (this.tweenGroup.getAll?.() || []).length > 0;
        if (hasActiveTweens || stillActive) {
            this.syncBatchedModelLoaders();
        }
    }

    onDispose() {
        console.log('[ExplodedView] 销毁组件');

        this.tweenGroup.removeAll();

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

            this.unhighlightFloor(floorObjects, floorIndex);
        });

        this.floors.clear();
        this.originalPositions.clear();
        this.originalMaterials.clear();
    }
}
