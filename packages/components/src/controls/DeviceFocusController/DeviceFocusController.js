import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * Controls module component that focuses the camera and interaction state on selected devices or scene targets.
 */
export class DeviceFocusController extends Component {
    static defaultConfig = {
        animationDuration: 1500,
        cameraDistance: 5,
        highlightColor: 0xFF0000,
        colorTransitionDuration: 800,
        autoHideOtherFloors: true,
        floorMap: {},
        easing: TWEEN.Easing.Quadratic.Out
    };

    onMounted() {
        this.currentDevice = null;

        this.originalMaterials = new Map();

        this.initialCameraPosition = null;

        this.initialControlsTarget = null;

        this.floors = new Map();

        this.originalFloorVisibility = new Map();

        this.tweenGroup = new TWEEN.Group();

        this.isFocusing = false;

        this.saveInitialCameraState();

        this.initializeFloors();

        console.log('[DeviceFocusController] 组件初始化完成');
    }

    saveInitialCameraState() {
        if (!this.scene || !this.scene.camera.instance) {
            console.warn('[DeviceFocusController] 场景或相机未就绪');
            return;
        }

        this.initialCameraPosition = this.scene.camera.instance.clone();

        console.log(this.scene.controls );
        if (this.scene.controls && this.scene.controls.instance.target) {
            this.initialControlsTarget = this.scene.controls.instance.target.clone();
        }

        console.log('[DeviceFocusController] 初始相机状态已保存', {
            position: this.initialCameraPosition,
            target: this.initialControlsTarget
        });
    }

    initializeFloors() {
        const { floorMap } = this.config;

        if (!floorMap || Object.keys(floorMap).length === 0) {
            console.warn('[DeviceFocusController] floorMap 为空，跳过楼层初始化');
            return;
        }

        Object.entries(floorMap).forEach(([index, floorName]) => {
            const floorIndex = parseInt(index);

            const floorObject = this.scene.scene.getObjectByName(floorName);

            if (floorObject) {
                this.floors.set(floorIndex, floorObject);

                this.originalFloorVisibility.set(floorIndex, floorObject.visible);

                console.log(`[DeviceFocusController] 找到楼层 ${floorIndex}: ${floorName}`);
            } else {
                console.warn(`[DeviceFocusController] 未找到楼层对象: ${floorName}`);
            }
        });

        console.log(`[DeviceFocusController] 楼层初始化完成，共 ${this.floors.size} 层`);
    }

    async focusDevice(deviceObject, options = {}) {
        if (!deviceObject) {
            console.error('[DeviceFocusController] 设备对象不能为空');
            return;
        }

        if (this.isFocusing && this.currentDevice !== deviceObject) {
            await this.resetView();
        }

        this.currentDevice = deviceObject;
        this.isFocusing = true;

        const config = { ...this.config, ...options };

        const deviceFloor = this.getDeviceFloor(deviceObject);
        console.log('[DeviceFocusController] 设备所在楼层:', deviceFloor);

        if (config.autoHideOtherFloors && deviceFloor !== null) {
            this.hideOtherFloors(deviceFloor);
        }

        const deviceCenter = this.getDeviceCenter(deviceObject);
        console.log('[DeviceFocusController] 设备中心点:', deviceCenter);

        this.highlightDevice(deviceObject);

        await this.moveCameraToDevice(deviceCenter, config);

        this.emit('focusComplete', { device: deviceObject, center: deviceCenter });
    }

    getDeviceFloor(deviceObject) {
        if (deviceObject.userData && deviceObject.userData.floor !== undefined) {
            return deviceObject.userData.floor;
        }

        let parent = deviceObject.parent;
        while (parent) {
            if (parent.userData && parent.userData.floor !== undefined) {
                return parent.userData.floor;
            }

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

    getDeviceCenter(deviceObject) {
        const box = new THREE.Box3().setFromObject(deviceObject);
        const center = new THREE.Vector3();
        box.getCenter(center);
        return center;
    }

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

    highlightDevice(deviceObject) {
        const { highlightColor, colorTransitionDuration } = this.config;

        deviceObject.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!this.originalMaterials.has(child.uuid)) {
                    if (Array.isArray(child.material)) {
                        this.originalMaterials.set(child.uuid, child.material.map(mat => mat.clone()));
                    } else {
                        this.originalMaterials.set(child.uuid, child.material.clone());
                    }
                }

                this.applyHighlightColor(child, highlightColor, colorTransitionDuration);
            }
        });

        console.log('[DeviceFocusController] 设备高亮已应用');
    }

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

    moveCameraToDevice(targetPosition, config) {
        return new Promise((resolve) => {
            if (!this.scene || !this.scene.camera) {
                console.error('[DeviceFocusController] 场景或相机未就绪');
                resolve();
                return;
            }

            const camera = this.scene.camera.instance;
            const controls = this.scene.controls.instance;

            const cameraTargetPosition = new THREE.Vector3(
                targetPosition.x,
                targetPosition.y + config.cameraDistance * 0.5,
                targetPosition.z + config.cameraDistance
            );

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

    async resetView() {
        if (!this.isFocusing) {
            console.log('[DeviceFocusController] 当前未处于聚焦状态，无需重置');
            return;
        }

        console.log('[DeviceFocusController] 开始重置视图');

        this.restoreFloorVisibility();

        if (this.currentDevice) {
            this.removeHighlight(this.currentDevice);
        }

        await this.moveCameraToInitialPosition();

        this.currentDevice = null;
        this.isFocusing = false;

        this.emit('resetComplete');

        console.log('[DeviceFocusController] 视图重置完成');
    }

    restoreFloorVisibility() {
        this.floors.forEach((floorObject, floorIndex) => {
            const originalVisibility = this.originalFloorVisibility.get(floorIndex);
            if (originalVisibility !== undefined) {
                floorObject.visible = originalVisibility;
            }
        });

        console.log('[DeviceFocusController] 楼层可见性已恢复');
    }

    removeHighlight(deviceObject) {
        const { colorTransitionDuration } = this.config;

        deviceObject.traverse((child) => {
            if (child.isMesh && child.material) {
                const originalMaterial = this.originalMaterials.get(child.uuid);

                if (originalMaterial) {
                    this.restoreOriginalColor(child, originalMaterial, colorTransitionDuration);
                }
            }
        });

        console.log('[DeviceFocusController] 设备高亮已移除');
    }

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

    moveCameraToInitialPosition() {
        return new Promise((resolve) => {
            if (!this.scene || !this.scene.camera || !this.initialCameraPosition) {
                console.error('[DeviceFocusController] 场景、相机或初始位置未就绪');
                resolve();
                return;
            }

            const camera = this.scene.camera.instance;
            const controls = this.scene.controls.instance;

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

    onUpdate(delta) {
        this.tweenGroup.update();
    }

    onDispose() {
        this.tweenGroup.removeAll();

        this.originalMaterials.clear();

        this.floors.clear();
        this.originalFloorVisibility.clear();

        console.log('[DeviceFocusController] 组件已销毁');
    }
}
