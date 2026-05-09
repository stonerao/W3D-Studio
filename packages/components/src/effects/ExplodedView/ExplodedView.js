import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * ExplodedView 爆炸图组件
 *
 * @class ExplodedView
 * @extends Component
 * @description 用于实现建筑楼层的爆炸视图效果，支持楼层选中、高亮、独立控制等功能
 *              每个楼层可以包含多个模型，所有模型会一起移动和高亮
 *
 * @example
 * const explodedView = await scene.add('ExplodedView', {
 *     name: 'building-exploded',
 *     floorMap: {
 *         '1': ['1F_QiangTi', '1F_BoLi', '1F_CK'],
 *         '2': ['2F_QiangTi', '2F_BoLi', '2F_CK']
 *     },
 *     gap: 10,
 *     animate: true,
 *     time: 2,
 *     direction: 'up'
 * });
 *
 * // 开始爆炸效果
 * explodedView.start();
 *
 * // 选中并高亮第3层（所有模型都会高亮）
 * explodedView.selectFloor('3');
 *
 * // 重置
 * explodedView.reset();
 */
export class ExplodedView extends Component {
    /**
     * 默认配置
     */
    static defaultConfig = {
        floorMap: {},              // 楼层对照表，格式：{ '1': { meshes: ['...'], animate: true }, ... }
        floorOrder: [],            // 楼层爆炸顺序数组（空时回退到数字排序）格式：['1', '3', '2']
        gap: 10,                   // 楼层间隔距离（默认值）
        animate: true,             // 是否开启动画
        time: 2,                   // 动画时长（秒）
        start: 1,                  // 以第几层楼为起始（不偏移的基准层）
        offset: {                  // 自定义爆炸方向向量（direction='custom' 时生效）
            x: 0,
            y: 1,
            z: 0
        },
        // 爆炸方向预设：'up'|'down'|'left'|'right'|'forward'|'back'|'custom'
        // 'custom' 时使用 offset 向量；其余预设自动映射到对应的单位向量
        direction: 'up',
        delayStep: 100,            // 每层动画延迟步长（毫秒），设为 0 时所有层同时爆炸
        customOffsets: {},         // 自定义某些楼层的偏移量，格式：{ floorIndex: { x, y, z } }
        highlightColor: 0x07A6FF,  // 高亮颜色
        highlightIntensity: 1.5,   // 高亮强度
        // 缓动预设（可序列化字符串，运行时由 resolveEasing() 映射为 TWEEN 函数）
        // 可选值：'linear' | 'quadratic-in' | 'quadratic-out' | 'quadratic-inout'
        //        | 'cubic-out' | 'cubic-inout' | 'elastic-out' | 'bounce-out' | 'back-out'
        easingPreset: 'quadratic-out'
    };

    /**
     * 组件挂载完成
     */
    onMounted() {
        console.log('[ExplodedView] 组件挂载，配置:', this.config);

        // 楼层对象映射表：Map<楼层索引, Object3D数组>
        this.floors = new Map();

        // 楼层原始位置映射表：Map<楼层索引, Map<模型名, Vector3>>
        this.originalPositions = new Map();

        // 楼层原始材质映射表
        this.originalMaterials = new Map();

        // 楼层顺序映射（用于排序和偏移计算）
        this.floorOrder = new Map();

        // 楼层动画配置映射（标记哪些楼层不参与爆炸）
        this.floorAnimateConfig = new Map();

        // 当前选中的楼层索引
        this.selectedFloorIndex = null;

        // 当前状态：'normal' | 'exploded'
        this.currentState = 'normal';

        // 动画组
        this.tweenGroup = new TWEEN.Group();

        // 初始化楼层对象
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
     * 初始化楼层对象
     * 根据 floorMap 查找场景中的楼层模型（支持每层多个模型）
     */
    initializeFloors() {
        const { floorMap } = this.config;

        console.log('[ExplodedView] 开始初始化楼层');
        console.log('[ExplodedView] floorMap 配置:', JSON.stringify(floorMap, null, 2));

        if (!floorMap || Object.keys(floorMap).length === 0) {
            console.warn('[ExplodedView] floorMap 为空，无法初始化楼层');
            return;
        }

        // 创建楼层索引到数字顺序的映射（用于计算偏移）
        this.floorOrder = this.createFloorOrder(Object.keys(floorMap));

        // 遍历 floorMap，查找对应的楼层对象
        Object.entries(floorMap).forEach(([index, floorConfig]) => {
            const floorIndex = String(index);

            // 兼容多种格式
            let modelNames = [];
            let shouldAnimate = true;

            if (Array.isArray(floorConfig)) {
                // 旧格式：直接是模型名数组
                modelNames = floorConfig;
                console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用数组格式`);
            } else if (floorConfig && typeof floorConfig === 'object') {
                // 新格式对象
                // 优先级 1: meshes（编辑器新格式）
                if (floorConfig.meshes && Array.isArray(floorConfig.meshes)) {
                    modelNames = floorConfig.meshes;
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 meshes 格式，共 ${modelNames.length} 个`);
                }
                // 优先级 2: modelLoaders
                else if (floorConfig.modelLoaders && Array.isArray(floorConfig.modelLoaders)) {
                    modelNames = floorConfig.modelLoaders.flatMap(loader => loader.meshes || []);
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 modelLoaders 格式`);
                }
                // 优先级 3: models（Building 项目格式）
                else if (floorConfig.models && Array.isArray(floorConfig.models)) {
                    modelNames = floorConfig.models;
                    console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用 models 格式`);
                }
                shouldAnimate = floorConfig.animate !== false;
            } else if (typeof floorConfig === 'string') {
                // 单个模型名
                modelNames = [floorConfig];
                console.log(`[ExplodedView] 楼层 ${floorIndex}: 使用字符串格式`);
            }

            console.log(`[ExplodedView] 楼层 ${floorIndex} 需要查找的模型:`, modelNames);

            // 保存动画配置
            this.floorAnimateConfig.set(floorIndex, shouldAnimate);            // 存储该楼层的所有模型对象
            const floorObjects = [];
            // 存储该楼层所有模型的原始位置
            const positionsMap = new Map();
            // 存储该楼层所有模型的原始材质
            const materialsMap = new Map();

            modelNames.forEach((modelName) => {
                // 在场景中查找模型对象（多种方式）
                let modelObject = null;

                // 方式 1: 直接通过名称查找
                modelObject = this.scene.scene.getObjectByName(modelName);

                // 方式 2: 如果没找到，尝试遍历场景查找（支持部分匹配）
                if (!modelObject) {
                    this.scene.scene.traverse((child) => {
                        if (!modelObject && child.name === modelName) {
                            modelObject = child;
                        }
                    });
                }

                // 方式 3: 如果还没找到，尝试从注册的组件中查找
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

                    // 保存原始位置
                    positionsMap.set(modelName, modelObject.position.clone());

                    // 保存原始材质
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
                    // 列出场景中所有可用的对象名称，帮助调试
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
     * 将爆炸方向预设或自定义 offset 解析为实际的方向向量
     *
     * 当 direction 为预设关键字（'up'/'down'/'left'/'right'/'forward'/'back'）时返回对应单位向量；
     * 当 direction 为 'custom' 时返回 config.offset；
     * 向后兼容：旧值 'up'/'down' 仍正常工作。
     *
     * @returns {{ x: number, y: number, z: number }}
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
     * 将 easingPreset 字符串解析为 TWEEN 缓动函数
     * 当配置中没有 easingPreset 或值无效时，回退到 Quadratic.Out
     *
     * @returns {Function} TWEEN 缓动函数
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
     * 创建楼层顺序映射
     * 将楼层索引映射到顺序数字
     *
     * 优先使用 config.floorOrder 显式顺序（编辑器保存的自定义顺序），
     * 回退到数字排序以兼容旧数据。
     *
     * @param {string[]} floorIndices - 楼层索引数组（floorMap 的键）
     * @returns {Map<string, number>}
     */
    createFloorOrder(floorIndices) {
        const orderMap = new Map();
        const configOrder = this.config.floorOrder;

        // 如果配置中有显式顺序数组，优先使用
        if (Array.isArray(configOrder) && configOrder.length > 0) {
            // 先按 configOrder 排列，configOrder 中没有的索引追加在末尾
            const orderedSet = configOrder.map(String);
            const remaining = floorIndices.filter(i => !orderedSet.includes(String(i)));
            const finalOrder = [...orderedSet.filter(i => floorIndices.map(String).includes(i)), ...remaining];
            finalOrder.forEach((index, order) => {
                orderMap.set(String(index), order);
            });
            return orderMap;
        }

        // 回退：分离数字楼层和特殊楼层，数字楼层按数值排序
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
     * 计算楼层的目标偏移量
     * 使用 resolveOffset() 统一解析方向向量，支持6轴预设与自定义向量
     */
    calculateFloorOffset(floorIndex) {
        const { gap, start, customOffsets } = this.config;

        // 如果有自定义偏移量，使用自定义值
        if (customOffsets && customOffsets[floorIndex]) {
            return customOffsets[floorIndex];
        }

        // 解析实际方向向量
        const offset = this.resolveOffset();

        // 使用楼层顺序映射计算相对偏移
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
     * 开始爆炸图效果
     * 将楼层按配置偏移到爆炸状态（每层所有模型一起移动）
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

        // 如果楼层数据为空，尝试重新初始化（处理异步加载场景的情况）
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();

            // 如果重新初始化后仍为空，报错返回
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

        // 获取所有楼层索引并按 floorOrder 顺序排列
        // direction='down' 时反向播放（高层先动）；其余方向保持正向顺序
        const floorIndices = Array.from(this.floors.keys()).sort((a, b) => {
            const orderA = this.floorOrder.get(a) ?? 0;
            const orderB = this.floorOrder.get(b) ?? 0;
            return direction === 'down' ? orderB - orderA : orderA - orderB;
        });

        // 停止所有正在进行的动画
        this.tweenGroup.removeAll();

        floorIndices.forEach((floorIndex, arrayIndex) => {
            const floorObjects = this.floors.get(floorIndex);
            if (!floorObjects || floorObjects.length === 0) return;
            console.log(floorObjects);
            // 检查该楼层是否参与爆炸动画
            const shouldAnimate = this.floorAnimateConfig.get(floorIndex);
            if (shouldAnimate === false) {
                console.log(`[ExplodedView] 楼层 ${floorIndex} 配置为不参与爆炸效果，跳过`);
                return;
            }

            const positionsMap = this.originalPositions.get(floorIndex);
            const targetOffset = this.calculateFloorOffset(floorIndex);
            console.log(`[ExplodedView] 楼层 ${floorIndex} 目标偏移:`, targetOffset);

            // 为该楼层的每个模型创建动画
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
                    // 使用动画
                    const delay = arrayIndex * delayStep;
                    const duration = time * 1000; // 转换为毫秒

                    new TWEEN.Tween(modelObject.position, this.tweenGroup)
                        .to(targetPosition, duration)
                        .delay(delay)
                        .easing(easing)
                        .start();
                } else {
                    // 直接设置位置
                    modelObject.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
                }
            });
            this.syncBatchedModelLoaders();

            console.log(`[ExplodedView] 楼层 ${floorIndex} 开始爆炸动画，包含 ${floorObjects.length} 个模型`);
        });

        this.emit('exploded');
    }

    /**
     * 重置为初始状态
     * 将所有楼层恢复到原始位置（每层所有模型一起恢复）
     */
    reset() {
        if (this.currentState === 'normal') {
            console.warn('[ExplodedView] 已处于正常状态');
            return;
        }

        console.log('[ExplodedView] 重置爆炸效果');

        // 如果楼层数据为空，尝试重新初始化
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        this.currentState = 'normal';

        const { animate, time, direction, delayStep } = this.config;
        const easing = this.resolveEasing();

        // 重置时采用反向顺序（与爆炸方向相反），让视觉上回缩更自然
        // direction='down' 时爆炸是反向的，重置就用正向；其余情况用反向
        const floorIndices = Array.from(this.floors.keys()).sort((a, b) => {
            const orderA = this.floorOrder.get(a) ?? 0;
            const orderB = this.floorOrder.get(b) ?? 0;
            return direction === 'down' ? orderA - orderB : orderB - orderA;
        });

        // 停止所有正在进行的动画
        this.tweenGroup.removeAll();

        floorIndices.forEach((floorIndex, arrayIndex) => {
            const floorObjects = this.floors.get(floorIndex);
            if (!floorObjects || floorObjects.length === 0) return;

            // 检查该楼层是否参与爆炸动画
            const shouldAnimate = this.floorAnimateConfig.get(floorIndex);
            if (shouldAnimate === false) {
                console.log(`[ExplodedView] 楼层 ${floorIndex} 配置为不参与爆炸效果，跳过重置`);
                return;
            }

            const positionsMap = this.originalPositions.get(floorIndex);

            // 为该楼层的每个模型创建动画
            floorObjects.forEach((modelObject) => {
                const modelName = modelObject.name;
                const originalPos = positionsMap.get(modelName);
                if (!originalPos) return;

                if (animate) {
                    // 使用动画
                    const delay = arrayIndex * delayStep;
                    const duration = time * 1000; // 转换为毫秒

                    new TWEEN.Tween(modelObject.position, this.tweenGroup)
                        .to({ x: originalPos.x, y: originalPos.y, z: originalPos.z }, duration)
                        .delay(delay)
                        .easing(easing)
                        .start();
                } else {
                    // 直接设置位置
                    modelObject.position.copy(originalPos);
                }
            });
            this.syncBatchedModelLoaders();

            console.log(`[ExplodedView] 楼层 ${floorIndex} 开始重置动画，包含 ${floorObjects.length} 个模型`);
        });

        // 清除选中状态
        if (this.selectedFloorIndex !== null) {
            this.deselectFloor();
        }

        this.emit('reset');
    }

    /**
     * 选中并高亮某一层楼（高亮该楼层的所有模型）
     */
    selectFloor(floorIndex) {
        const floorKey = String(floorIndex);

        // 如果楼层数据为空，尝试重新初始化
        if (this.floors.size === 0) {
            console.warn('[ExplodedView] 楼层数据为空，尝试重新初始化...');
            this.initializeFloors();
        }

        if (!this.floors.has(floorKey)) {
            console.warn(`[ExplodedView] 楼层 ${floorIndex} 不存在`);
            return;
        }

        // 如果已有选中的楼层，先取消高亮
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
     * 取消选中楼层
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
     * 高亮楼层（高亮该楼层的所有模型）
     * @param {THREE.Object3D[]} floorObjects - 楼层模型数组
     */
    highlightFloor(floorObjects) {
        const { highlightColor, highlightIntensity } = this.config;

        floorObjects.forEach((modelObject) => {
            modelObject.traverse((child) => {
                if (child.isMesh && child.material) {
                    // 克隆材质以避免影响其他对象
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material;
                        child.material = child.material.clone();
                    }

                    // 设置发光效果
                    child.material.emissive = new THREE.Color(highlightColor);
                    child.material.emissiveIntensity = highlightIntensity;
                }
            });
        });
    }

    /**
     * 取消高亮楼层（取消该楼层所有模型的高亮）
     * @param {THREE.Object3D[]} floorObjects - 楼层模型数组
     * @param {string} _floorIndex - 楼层索引（保留参数以保持 API 一致性）
     */
    unhighlightFloor(floorObjects, _floorIndex) {
        if (!floorObjects) return;

        floorObjects.forEach((modelObject) => {
            modelObject.traverse((child) => {
                if (child.isMesh && child.userData.originalMaterial) {
                    // 恢复原始材质
                    child.material = child.userData.originalMaterial;
                    delete child.userData.originalMaterial;
                }
            });
        });
    }

    /**
     * 设置某一层的显示/隐藏（设置该楼层所有模型的显示/隐藏）
     */
    setFloorVisible(floorIndex, visible) {
        const floorKey = String(floorIndex);

        // 如果楼层数据为空，尝试重新初始化
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
     * 设置某一层的位移幅度（设置该楼层所有模型的位移）
     */
    setFloorOffset(floorIndex, offset) {
        const floorKey = String(floorIndex);

        // 如果楼层数据为空，尝试重新初始化
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
                // 使用动画
                const duration = time * 1000;

                new TWEEN.Tween(modelObject.position, this.tweenGroup)
                    .to(targetPosition, duration)
                    .easing(easing)
                    .start();
            } else {
                // 直接设置位置
                modelObject.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
            }
        });
        this.syncBatchedModelLoaders();

        console.log(`[ExplodedView] 设置楼层 ${floorIndex} 偏移:`, offset);
        this.emit('floorOffsetChanged', { floorIndex: floorKey, offset });
    }

    /**
     * 获取楼层对象数组
     * @param {string|number} floorIndex - 楼层索引
     * @returns {THREE.Object3D[]} 楼层模型数组
     */
    getFloor(floorIndex) {
        return this.floors.get(String(floorIndex));
    }

    /**
     * 获取所有楼层索引
     */
    getFloorIndices() {
        return Array.from(this.floors.keys());
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    async updateConfig(newConfig) {
        console.log('[ExplodedView] 更新配置:', newConfig);

        // 合并配置
        this.config = {
            ...this.config,
            ...newConfig
        };

        // 如果 floorMap 发生变化，需要重新初始化
        if (newConfig.floorMap !== undefined) {
            console.log('[ExplodedView] floorMap 变化，重新初始化楼层');

            // 先重置到正常状态
            if (this.currentState === 'exploded') {
                this.reset();
            }

            // 清空现有数据
            this.floors.clear();
            this.originalPositions.clear();
            this.originalMaterials.clear();
            this.floorOrder.clear();
            this.floorAnimateConfig.clear();
            this.selectedFloorIndex = null;

            // 重新初始化楼层
            this.initializeFloors();

            console.log('[ExplodedView] 配置已更新，楼层已重新初始化，共 ' + this.floors.size + ' 个楼层');
        }
    }

    /**
     * 每帧更新
     */
    onUpdate(_delta) {
        const hasActiveTweens = (this.tweenGroup.getAll?.() || []).length > 0;
        if (!hasActiveTweens) return;

        // 更新 Tween 动画
        this.tweenGroup.update();
        const stillActive = (this.tweenGroup.getAll?.() || []).length > 0;
        if (hasActiveTweens || stillActive) {
            this.syncBatchedModelLoaders();
        }
    }

    /**
     * 组件销毁
     */
    onDispose() {
        console.log('[ExplodedView] 销毁组件');

        // 停止所有动画
        this.tweenGroup.removeAll();

        // 恢复所有楼层到原始状态
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

            // 恢复原始材质
            this.unhighlightFloor(floorObjects, floorIndex);
        });

        // 清空映射表
        this.floors.clear();
        this.originalPositions.clear();
        this.originalMaterials.clear();
    }
}
