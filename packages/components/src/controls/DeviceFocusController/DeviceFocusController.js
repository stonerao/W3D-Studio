import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * DeviceFocusController 设备聚焦控制器组件
 *
 * @class DeviceFocusController
 * @extends Component
 * @description 用于实现设备视角跳转和高亮功能，支持相机动画、楼层控制、材质高亮等
 *
 * @example
 * const deviceFocusController = await scene.add('DeviceFocusController', {
 *     animationDuration: 1500,
 *     highlightColor: 0xFF0000,
 *     cameraDistance: 5
 * });
 *
 * // 聚焦设备
 * const deviceObject = scene.scene.getObjectByName("设备2");
 * await deviceFocusController.focusDevice(deviceObject);
 *
 * // 恢复视角
 * await deviceFocusController.resetView();
 */
export class DeviceFocusController extends Component {
    /**
     * 默认配置
     */
    static defaultConfig = {
        animationDuration: 1500,        // 相机移动动画时长（毫秒）
        cameraDistance: 5,               // 相机距离设备的距离
        highlightColor: 0xFF0000,        // 高亮颜色（默认红色）
        colorTransitionDuration: 800,    // 颜色过渡时长（毫秒）
        autoHideOtherFloors: true,       // 是否自动隐藏其他楼层
        floorMap: {},                    // 楼层对照表，格式：{ 1: '1F', 2: '2F', ... }
        easing: TWEEN.Easing.Quadratic.Out  // 缓动函数
    };

    /**
     * 组件挂载完成
     */
    onMounted() {
        // 当前聚焦的设备对象
        this.currentDevice = null;

        // 设备原始材质
        this.originalMaterials = new Map();

        // 初始相机位置
        this.initialCameraPosition = null;

        // 初始 OrbitControls target
        this.initialControlsTarget = null;

        // 楼层对象映射表
        this.floors = new Map();

        // 楼层原始可见性状态
        this.originalFloorVisibility = new Map();

        // 动画组
        this.tweenGroup = new TWEEN.Group();

        // 是否处于聚焦状态
        this.isFocusing = false;

        // 保存初始相机状态
        this.saveInitialCameraState();

        // 初始化楼层对象
        this.initializeFloors();

        console.log('[DeviceFocusController] 组件初始化完成');
    }

    /**
     * 保存初始相机状态
     */
    saveInitialCameraState() {
        if (!this.scene || !this.scene.camera.instance) {
            console.warn('[DeviceFocusController] 场景或相机未就绪');
            return;
        }

        // 保存初始相机位置
        this.initialCameraPosition = this.scene.camera.instance.clone();

        // 保存初始 OrbitControls target
        console.log(this.scene.controls );
        if (this.scene.controls && this.scene.controls.instance.target) {
            this.initialControlsTarget = this.scene.controls.instance.target.clone();
        }

        console.log('[DeviceFocusController] 初始相机状态已保存', {
            position: this.initialCameraPosition,
            target: this.initialControlsTarget
        });
    }

    /**
     * 初始化楼层对象
     * 根据 floorMap 查找场景中的楼层模型
     */
    initializeFloors() {
        const { floorMap } = this.config;

        if (!floorMap || Object.keys(floorMap).length === 0) {
            console.warn('[DeviceFocusController] floorMap 为空，跳过楼层初始化');
            return;
        }

        // 遍历 floorMap，查找对应的楼层对象
        Object.entries(floorMap).forEach(([index, floorName]) => {
            const floorIndex = parseInt(index);

            // 在场景中查找楼层对象
            const floorObject = this.scene.scene.getObjectByName(floorName);

            if (floorObject) {
                this.floors.set(floorIndex, floorObject);

                // 保存楼层原始可见性状态
                this.originalFloorVisibility.set(floorIndex, floorObject.visible);

                console.log(`[DeviceFocusController] 找到楼层 ${floorIndex}: ${floorName}`);
            } else {
                console.warn(`[DeviceFocusController] 未找到楼层对象: ${floorName}`);
            }
        });

        console.log(`[DeviceFocusController] 楼层初始化完成，共 ${this.floors.size} 层`);
    }

    /**
     * 聚焦设备
     * @param {THREE.Object3D} deviceObject - 要聚焦的设备 3D 对象
     * @param {Object} options - 可选配置
     * @returns {Promise<void>}
     */
    async focusDevice(deviceObject, options = {}) {
        if (!deviceObject) {
            console.error('[DeviceFocusController] 设备对象不能为空');
            return;
        }

        // 如果已经在聚焦其他设备，先重置
        if (this.isFocusing && this.currentDevice !== deviceObject) {
            await this.resetView();
        }

        this.currentDevice = deviceObject;
        this.isFocusing = true;

        // 合并配置
        const config = { ...this.config, ...options };

        // 1. 读取设备所在楼层信息
        const deviceFloor = this.getDeviceFloor(deviceObject);
        console.log('[DeviceFocusController] 设备所在楼层:', deviceFloor);

        // 2. 隐藏其他楼层（如果启用）
        if (config.autoHideOtherFloors && deviceFloor !== null) {
            this.hideOtherFloors(deviceFloor);
        }

        // 3. 计算设备包围盒中心点
        const deviceCenter = this.getDeviceCenter(deviceObject);
        console.log('[DeviceFocusController] 设备中心点:', deviceCenter);

        // 4. 高亮设备
        this.highlightDevice(deviceObject);

        // 5. 相机移动到设备位置
        await this.moveCameraToDevice(deviceCenter, config);

        // 触发聚焦完成事件
        this.emit('focusComplete', { device: deviceObject, center: deviceCenter });
    }

    /**
     * 获取设备所在楼层
     * @param {THREE.Object3D} deviceObject - 设备对象
     * @returns {number|null} 楼层索引
     */
    getDeviceFloor(deviceObject) {
        // 1. 从设备对象的 userData.floor 读取
        if (deviceObject.userData && deviceObject.userData.floor !== undefined) {
            return deviceObject.userData.floor;
        }

        // 2. 从父级对象查找
        let parent = deviceObject.parent;
        while (parent) {
            if (parent.userData && parent.userData.floor !== undefined) {
                return parent.userData.floor;
            }

            // 检查父级对象名称是否在 floorMap 中
            for (const [floorIndex, floorName] of Object.entries(this.config.floorMap)) {
                if (parent.name === floorName) {
                    return parseInt(floorIndex);
                }
            }

            parent = parent.parent;
        }

        console.warn('[DeviceFocusController] 无法确定设备所在楼层');
        return null;
    }

    /**
     * 计算设备包围盒中心点
     * @param {THREE.Object3D} deviceObject - 设备对象
     * @returns {THREE.Vector3} 中心点
     */
    getDeviceCenter(deviceObject) {
        const box = new THREE.Box3().setFromObject(deviceObject);
        const center = new THREE.Vector3();
        box.getCenter(center);
        return center;
    }

    /**
     * 隐藏其他楼层
     * @param {number} targetFloor - 目标楼层索引
     */
    hideOtherFloors(targetFloor) {
        this.floors.forEach((floorObject, floorIndex) => {
            if (floorIndex !== targetFloor) {
                floorObject.visible = false;
            } else {
                floorObject.visible = true;
            }
        });

        console.log(`[DeviceFocusController] 已隐藏其他楼层，仅显示第 ${targetFloor} 层`);
    }

    /**
     * 高亮设备
     * @param {THREE.Object3D} deviceObject - 设备对象
     */
    highlightDevice(deviceObject) {
        const { highlightColor, colorTransitionDuration } = this.config;

        // 遍历设备对象及其子对象，保存原始材质并应用高亮
        deviceObject.traverse((child) => {
            if (child.isMesh && child.material) {
                // 保存原始材质
                if (!this.originalMaterials.has(child.uuid)) {
                    if (Array.isArray(child.material)) {
                        this.originalMaterials.set(child.uuid, child.material.map(mat => mat.clone()));
                    } else {
                        this.originalMaterials.set(child.uuid, child.material.clone());
                    }
                }

                // 应用高亮颜色（使用 Tween 实现颜色渐变）
                this.applyHighlightColor(child, highlightColor, colorTransitionDuration);
            }
        });

        console.log('[DeviceFocusController] 设备高亮已应用');
    }

    /**
     * 应用高亮颜色（带渐变动画）
     * @param {THREE.Mesh} mesh - 网格对象
     * @param {number} targetColor - 目标颜色
     * @param {number} duration - 动画时长
     */
    applyHighlightColor(mesh, targetColor, duration) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((material) => {
            if (!material.color) return;

            const startColor = material.color.clone();
            const endColor = new THREE.Color(targetColor);

            const colorTween = new TWEEN.Tween({ r: startColor.r, g: startColor.g, b: startColor.b }, this.tweenGroup)
                .to({ r: endColor.r, g: endColor.g, b: endColor.b }, duration)
                .easing(this.config.easing)
                .onUpdate((obj) => {
                    material.color.setRGB(obj.r, obj.g, obj.b);
                })
                .start();
        });
    }

    /**
     * 相机移动到设备位置
     * @param {THREE.Vector3} targetPosition - 目标位置
     * @param {Object} config - 配置
     * @returns {Promise<void>}
     */
    moveCameraToDevice(targetPosition, config) {
        return new Promise((resolve) => {
            if (!this.scene || !this.scene.camera) {
                console.error('[DeviceFocusController] 场景或相机未就绪');
                resolve();
                return;
            }

            const camera = this.scene.camera.instance;
            const controls = this.scene.controls.instance;

            // 计算相机目标位置（在设备前方一定距离）
            const cameraTargetPosition = new THREE.Vector3(
                targetPosition.x,
                targetPosition.y + config.cameraDistance * 0.5,
                targetPosition.z + config.cameraDistance
            );

            // 相机位置动画
            const cameraTween = new TWEEN.Tween(
                { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                this.tweenGroup
            )
                .to(
                    { x: cameraTargetPosition.x, y: cameraTargetPosition.y, z: cameraTargetPosition.z },
                    config.animationDuration
                )
                .easing(config.easing)
                .onUpdate((obj) => {
                    camera.position.set(obj.x, obj.y, obj.z);
                })
                .onComplete(() => {
                    console.log('[DeviceFocusController] 相机移动完成');
                    resolve();
                })
                .start();

            // OrbitControls target 动画
            if (controls && controls.target) {
                const controlsTween = new TWEEN.Tween(
                    { x: controls.target.x, y: controls.target.y, z: controls.target.z },
                    this.tweenGroup
                )
                    .to(
                        { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z },
                        config.animationDuration
                    )
                    .easing(config.easing)
                    .onUpdate((obj) => {
                        controls.target.set(obj.x, obj.y, obj.z);
                        controls.update();
                    })
                    .start();
            }
        });
    }

    /**
     * 重置视图
     * @returns {Promise<void>}
     */
    async resetView() {
        if (!this.isFocusing) {
            console.log('[DeviceFocusController] 当前未处于聚焦状态，无需重置');
            return;
        }

        console.log('[DeviceFocusController] 开始重置视图');

        // 1. 恢复楼层可见性
        this.restoreFloorVisibility();

        // 2. 取消设备高亮
        if (this.currentDevice) {
            this.removeHighlight(this.currentDevice);
        }

        // 3. 相机移动回初始位置
        await this.moveCameraToInitialPosition();

        // 4. 清空当前设备
        this.currentDevice = null;
        this.isFocusing = false;

        // 触发重置完成事件
        this.emit('resetComplete');

        console.log('[DeviceFocusController] 视图重置完成');
    }

    /**
     * 恢复楼层可见性
     */
    restoreFloorVisibility() {
        this.floors.forEach((floorObject, floorIndex) => {
            const originalVisibility = this.originalFloorVisibility.get(floorIndex);
            if (originalVisibility !== undefined) {
                floorObject.visible = originalVisibility;
            }
        });

        console.log('[DeviceFocusController] 楼层可见性已恢复');
    }

    /**
     * 移除设备高亮
     * @param {THREE.Object3D} deviceObject - 设备对象
     */
    removeHighlight(deviceObject) {
        const { colorTransitionDuration } = this.config;

        deviceObject.traverse((child) => {
            if (child.isMesh && child.material) {
                const originalMaterial = this.originalMaterials.get(child.uuid);

                if (originalMaterial) {
                    // 使用 Tween 实现颜色渐变恢复
                    this.restoreOriginalColor(child, originalMaterial, colorTransitionDuration);
                }
            }
        });

        console.log('[DeviceFocusController] 设备高亮已移除');
    }

    /**
     * 恢复原始颜色（带渐变动画）
     * @param {THREE.Mesh} mesh - 网格对象
     * @param {THREE.Material|THREE.Material[]} originalMaterial - 原始材质
     * @param {number} duration - 动画时长
     */
    restoreOriginalColor(mesh, originalMaterial, duration) {
        const currentMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const originalMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];

        currentMaterials.forEach((material, index) => {
            if (!material.color) return;

            const originalMat = originalMaterials[index];
            if (!originalMat || !originalMat.color) return;

            const startColor = material.color.clone();
            const endColor = originalMat.color.clone();

            const colorTween = new TWEEN.Tween({ r: startColor.r, g: startColor.g, b: startColor.b }, this.tweenGroup)
                .to({ r: endColor.r, g: endColor.g, b: endColor.b }, duration)
                .easing(this.config.easing)
                .onUpdate((obj) => {
                    material.color.setRGB(obj.r, obj.g, obj.b);
                })
                .start();
        });
    }

    /**
     * 相机移动回初始位置
     * @returns {Promise<void>}
     */
    moveCameraToInitialPosition() {
        return new Promise((resolve) => {
            if (!this.scene || !this.scene.camera || !this.initialCameraPosition) {
                console.error('[DeviceFocusController] 场景、相机或初始位置未就绪');
                resolve();
                return;
            }

            const camera = this.scene.camera.instance;
            const controls = this.scene.controls.instance;

            // 相机位置动画
            const cameraTween = new TWEEN.Tween(
                { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                this.tweenGroup
            )
                .to(
                    { x: this.initialCameraPosition.x, y: this.initialCameraPosition.y, z: this.initialCameraPosition.z },
                    this.config.animationDuration
                )
                .easing(this.config.easing)
                .onUpdate((obj) => {
                    camera.position.set(obj.x, obj.y, obj.z);
                })
                .onComplete(() => {
                    console.log('[DeviceFocusController] 相机已恢复到初始位置');
                    resolve();
                })
                .start();

            // OrbitControls target 动画
            if (controls && controls.target && this.initialControlsTarget) {
                const controlsTween = new TWEEN.Tween(
                    { x: controls.target.x, y: controls.target.y, z: controls.target.z },
                    this.tweenGroup
                )
                    .to(
                        { x: this.initialControlsTarget.x, y: this.initialControlsTarget.y, z: this.initialControlsTarget.z },
                        this.config.animationDuration
                    )
                    .easing(this.config.easing)
                    .onUpdate((obj) => {
                        controls.target.set(obj.x, obj.y, obj.z);
                        controls.update();
                    })
                    .start();
            }
        });
    }

    /**
     * 更新方法（每帧调用）
     * @param {number} delta - 时间增量
     */
    onUpdate(delta) {
        // 更新 Tween 动画
        this.tweenGroup.update();
    }

    /**
     * 销毁组件
     */
    onDispose() {
        // 停止所有动画
        this.tweenGroup.removeAll();

        // 清空材质缓存
        this.originalMaterials.clear();

        // 清空楼层映射
        this.floors.clear();
        this.originalFloorVisibility.clear();

        console.log('[DeviceFocusController] 组件已销毁');
    }
}
