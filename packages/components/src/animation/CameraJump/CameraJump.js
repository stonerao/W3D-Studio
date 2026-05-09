import { Component, Tween } from '@w3d/core';
import * as THREE from 'three';

export class CameraJump extends Component {
    static defaultConfig = {
        targetType: 'mesh', // mesh | label | point
        distance: 8,
        direction: { x: 1, y: 0.35, z: 1 },
        duration: 1200,
        speed: 1,
        easing: 'easeInOutQuad',
        autoLookAt: true,
        autoStart: false,
        meshTarget: {
            componentId: '',
            meshName: '',
            nodePath: '',
            includeChildren: true
        },
        labelTarget: {
            componentId: '',
            labelId: ''
        },
        pointTarget: {
            source: 'manual', // manual | manager
            pointId: '',
            position: { x: 0, y: 0, z: 0 }
        }
    };

    onCreate() {
        this.activeTweens = [];
        this._tempVecA = new THREE.Vector3();
        this._tempVecB = new THREE.Vector3();
        this.lastJumpError = null;
    }

    onMounted() {
        if (this.config.autoStart) {
            this.jump();
        }
    }

    async updateConfig(newConfig = {}) {
        this.config = {
            ...this.config,
            ...newConfig,
            meshTarget: {
                ...(this.config.meshTarget || {}),
                ...(newConfig.meshTarget || {})
            },
            labelTarget: {
                ...(this.config.labelTarget || {}),
                ...(newConfig.labelTarget || {})
            },
            pointTarget: {
                ...(this.config.pointTarget || {}),
                ...(newConfig.pointTarget || {}),
                position: {
                    ...((this.config.pointTarget && this.config.pointTarget.position) || {}),
                    ...((newConfig.pointTarget && newConfig.pointTarget.position) || {})
                }
            },
            direction: {
                ...(this.config.direction || {}),
                ...(newConfig.direction || {})
            }
        };
    }

    stop() {
        this.activeTweens.forEach((tween) => tween?.stop?.());
        this.activeTweens = [];
    }

    getRuntimeHandles() {
        const camera = this.scene?.camera?.instance;
        const controls = this.scene?.controls?.instance;
        if (!camera || !controls?.target) return { camera: null, controls: null };
        return { camera, controls };
    }

    getSceneComponents() {
        const result = [];
        const mapA = this.scene?.componentManager?.components;
        const mapB = this.scene?.components;

        const collect = (source) => {
            if (!source) return;
            if (source instanceof Map) {
                source.forEach((value) => {
                    if (value) result.push(value);
                });
                return;
            }
            if (Array.isArray(source)) {
                source.forEach((value) => {
                    if (value) result.push(value);
                });
                return;
            }
            if (typeof source === 'object') {
                Object.values(source).forEach((value) => {
                    if (value) result.push(value);
                });
            }
        };

        collect(mapA);
        if (mapB !== mapA) {
            collect(mapB);
        }

        return result;
    }

    resolveComponentById(componentId, predicate = null) {
        const sceneComponents = this.getSceneComponents();
        if (!sceneComponents.length) return null;

        const targetId = String(componentId || '').trim();

        const byId = [];
        const fallback = [];

        for (const comp of sceneComponents) {
            const accepted = typeof predicate === 'function' ? predicate(comp) : true;
            if (!accepted) continue;

            if (!targetId) {
                fallback.push(comp);
                continue;
            }

            const candidateIds = [
                comp?.config?.id,
                comp?.id,
                comp?.config?.name,
                comp?.name
            ]
                .map((v) => String(v || '').trim())
                .filter(Boolean);

            if (candidateIds.includes(targetId)) {
                byId.push(comp);
            }
        }

        if (byId.length > 0) return byId[0];
        if (!targetId && fallback.length > 0) return fallback[0];
        return null;
    }

    normalizeActionPayload(payload = {}) {
        const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const nested = source.payload && typeof source.payload === 'object' && !Array.isArray(source.payload)
            ? source.payload
            : null;
        if (!nested) return source;
        const rest = { ...source };
        delete rest.payload;
        return {
            ...nested,
            ...rest
        };
    }

    resolveMeshTargetCenter(loaderComponentId, meshName, targetOptions = {}) {
        const sourceOptions = targetOptions && typeof targetOptions === 'object' ? targetOptions : {};
        const meshNames = [];
        const appendName = (value) => {
            const text = String(value || '').trim();
            if (text && !meshNames.includes(text)) meshNames.push(text);
        };

        appendName(meshName);
        appendName(sourceOptions.meshName);
        appendName(sourceOptions.name);
        const rawMeshNames = sourceOptions.meshNames || sourceOptions.names;
        (Array.isArray(rawMeshNames) ? rawMeshNames : [rawMeshNames]).forEach(appendName);

        const nodePaths = [];
        const appendPath = (value) => {
            const text = String(value || '').trim();
            if (text && !nodePaths.includes(text)) nodePaths.push(text);
        };
        appendPath(sourceOptions.nodePath || sourceOptions.objectPath);
        const rawNodePaths = sourceOptions.nodePaths || sourceOptions.objectPaths;
        (Array.isArray(rawNodePaths) ? rawNodePaths : [rawNodePaths]).forEach(appendPath);

        if (!meshNames.length && !nodePaths.length) {
            this.lastJumpError = {
                reason: 'mesh-name-empty',
                message: '未选择目标 Mesh 或模型节点'
            };
            return null;
        }

        const loader = this.resolveComponentById(
            loaderComponentId,
            (comp) => typeof comp?.getMeshByName === 'function'
        );
        if (!loader || typeof loader.getMeshByName !== 'function') {
            this.lastJumpError = {
                reason: 'mesh-loader-not-found',
                message: '未找到绑定的 ModelLoader 组件'
            };
            return null;
        }

        if (nodePaths.length > 0 && typeof loader.getMeshNamesForNodePaths === 'function') {
            loader.getMeshNamesForNodePaths(nodePaths, sourceOptions.includeChildren !== false).forEach(appendName);
        }

        const box = new THREE.Box3();
        let found = false;
        meshNames.forEach((name) => {
            const mesh = loader.getMeshByName(name);
            if (!mesh) return;

            mesh.updateWorldMatrix?.(true, true);
            const meshBox = new THREE.Box3().setFromObject(mesh);
            if (meshBox.isEmpty()) {
                box.expandByPoint(this._tempVecA.setFromMatrixPosition(mesh.matrixWorld));
            } else {
                box.union(meshBox);
            }
            found = true;
        });

        if (!found) {
            this.lastJumpError = {
                reason: 'mesh-not-found',
                message: `未找到 Mesh 或模型节点: ${meshNames[0] || nodePaths[0] || ''}`
            };
            return null;
        }

        if (box.isEmpty()) {
            return this._tempVecA.set(0, 0, 0).clone();
        }
        return box.getCenter(this._tempVecA).clone();
    }

    resolveLabelTargetPosition(labelComponentId, labelId) {
        const labelIdText = String(labelId || '').trim();
        if (!labelIdText) {
            this.lastJumpError = {
                reason: 'label-id-empty',
                message: '未选择目标标签'
            };
            return null;
        }

        const labelComp = this.resolveComponentById(
            labelComponentId,
            (comp) => typeof comp?.getLabel === 'function' || typeof comp?.getAllLabels === 'function'
        );
        if (!labelComp) {
            this.lastJumpError = {
                reason: 'label-component-not-found',
                message: '未找到绑定的 Label3D 组件'
            };
            return null;
        }

        const interactiveObjects = typeof labelComp.getInteractiveObjects === 'function'
            ? labelComp.getInteractiveObjects()
            : [];
        const labelObject = interactiveObjects.find((obj) => String(obj?.userData?.labelId || '') === labelIdText);
        if (labelObject) {
            labelObject.updateWorldMatrix?.(true, true);
            return labelObject.getWorldPosition(this._tempVecA).clone();
        }

        const data = typeof labelComp.getLabel === 'function' ? labelComp.getLabel(labelIdText) : null;
        if (!data?.position) {
            this.lastJumpError = {
                reason: 'label-not-found',
                message: `未找到标签: ${labelIdText}`
            };
            return null;
        }
        return new THREE.Vector3(
            Number(data.position.x) || 0,
            Number(data.position.y) || 0,
            Number(data.position.z) || 0
        );
    }

    resolvePointTargetPosition(pointTarget = {}) {
        if (pointTarget.source === 'manager') {
            const pointId = String(pointTarget.pointId || '');
            const points = this.scene?.scene?.userData?.w3dBuildingPoints;
            if (pointId && Array.isArray(points)) {
                const matched = points.find((item) => String(item?.id || '') === pointId);
                if (matched) {
                    const position = matched.position || {};
                    if (Array.isArray(position)) {
                        return new THREE.Vector3(
                            Number(position[0]) || 0,
                            Number(position[1]) || 0,
                            Number(position[2]) || 0
                        );
                    }
                    return new THREE.Vector3(
                        Number(position.x) || 0,
                        Number(position.y) || 0,
                        Number(position.z) || 0
                    );
                }
            }

            this.lastJumpError = {
                reason: 'point-not-found',
                message: pointId ? `未找到点位: ${pointId}` : '未选择点位'
            };
            return null;
        }

        const manual = pointTarget.position || {};
        return new THREE.Vector3(
            Number(manual.x) || 0,
            Number(manual.y) || 0,
            Number(manual.z) || 0
        );
    }

    resolveTargetPosition(config = this.config) {
        const targetType = config.targetType || 'mesh';
        if (targetType === 'mesh') {
            return this.resolveMeshTargetCenter(config.meshTarget?.componentId, config.meshTarget?.meshName, config.meshTarget || {});
        }
        if (targetType === 'label') {
            return this.resolveLabelTargetPosition(config.labelTarget?.componentId, config.labelTarget?.labelId);
        }
        return this.resolvePointTargetPosition(config.pointTarget || {});
    }

    normalizeDirectionVector(direction, fallback) {
        const raw = direction && typeof direction === 'object' ? direction : {};
        const x = Number(raw.x);
        const y = Number(raw.y);
        const z = Number(raw.z);
        this._tempVecB.set(
            Number.isFinite(x) ? x : fallback.x,
            Number.isFinite(y) ? y : fallback.y,
            Number.isFinite(z) ? z : fallback.z
        );

        if (this._tempVecB.lengthSq() <= 1e-9) {
            this._tempVecB.copy(fallback);
        }
        return this._tempVecB.normalize();
    }

    computeDuration(config, camera, nextCameraPosition) {
        const baseDuration = Number(config.duration);
        const duration = Number.isFinite(baseDuration) && baseDuration >= 0 ? baseDuration : 1200;

        const speed = Number(config.speed);
        if (!Number.isFinite(speed) || speed <= 0) {
            return duration;
        }

        const moveDistance = camera.position.distanceTo(nextCameraPosition);
        if (!Number.isFinite(moveDistance) || moveDistance <= 0) {
            return duration;
        }

        const ms = (moveDistance / speed) * 1000;
        if (!Number.isFinite(ms) || ms <= 0) return duration;
        return ms;
    }

    jump(customConfig = {}) {
        this.lastJumpError = null;

        const config = {
            ...this.config,
            ...customConfig,
            meshTarget: {
                ...(this.config.meshTarget || {}),
                ...(customConfig.meshTarget || {})
            },
            labelTarget: {
                ...(this.config.labelTarget || {}),
                ...(customConfig.labelTarget || {})
            },
            pointTarget: {
                ...(this.config.pointTarget || {}),
                ...(customConfig.pointTarget || {}),
                position: {
                    ...((this.config.pointTarget && this.config.pointTarget.position) || {}),
                    ...((customConfig.pointTarget && customConfig.pointTarget.position) || {})
                }
            },
            direction: {
                ...(this.config.direction || {}),
                ...(customConfig.direction || {})
            }
        };

        const { camera, controls } = this.getRuntimeHandles();
        if (!camera || !controls) {
            this.lastJumpError = {
                reason: 'camera-or-controls-not-ready',
                message: '相机或控制器未就绪'
            };
            this.emit('jump-error', this.lastJumpError);
            return false;
        }

        const targetPosition = this.resolveTargetPosition(config);
        if (!targetPosition) {
            if (!this.lastJumpError) {
                this.lastJumpError = {
                    reason: 'target-not-found',
                    message: '目标解析失败'
                };
            }
            this.emit('jump-error', {
                ...this.lastJumpError,
                targetType: config.targetType
            });
            return false;
        }

        const fallbackDir = this._tempVecA.copy(camera.position).sub(targetPosition);
        if (fallbackDir.lengthSq() <= 1e-9) fallbackDir.set(1, 0.35, 1);

        const direction = this.normalizeDirectionVector(config.direction, fallbackDir);
        const distance = Number(config.distance);
        const safeDistance = Number.isFinite(distance) && distance > 0 ? distance : 8;
        const cameraDestination = targetPosition.clone().add(direction.multiplyScalar(safeDistance));

        const duration = this.computeDuration(config, camera, cameraDestination);

        this.stop();
        this.emit('jump-start', {
            targetType: config.targetType,
            duration,
            targetPosition: { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z }
        });

        if (duration <= 0) {
            camera.position.copy(cameraDestination);
            if (config.autoLookAt !== false) {
                controls.target.copy(targetPosition);
            }
            controls.update?.();
            this.emit('jump-complete', {
                targetType: config.targetType,
                duration: 0
            });
            return true;
        }

        let done = 0;
        const onTweenDone = () => {
            done += 1;
            if (done >= this.activeTweens.length) {
                this.activeTweens = [];
                this.emit('jump-complete', {
                    targetType: config.targetType,
                    duration
                });
            }
        };

        const tweens = [];

        const positionTween = Tween.to(
            camera.position,
            {
                x: cameraDestination.x,
                y: cameraDestination.y,
                z: cameraDestination.z
            },
            duration,
            {
                easing: config.easing || 'easeInOutQuad',
                onUpdate: () => {
                    controls.update?.();
                },
                onComplete: onTweenDone
            }
        );
        tweens.push(positionTween);

        if (config.autoLookAt !== false) {
            const targetTween = Tween.to(
                controls.target,
                {
                    x: targetPosition.x,
                    y: targetPosition.y,
                    z: targetPosition.z
                },
                duration,
                {
                    easing: config.easing || 'easeInOutQuad',
                    onUpdate: () => {
                        controls.update?.();
                    },
                    onComplete: onTweenDone
                }
            );
            tweens.push(targetTween);
        }

        this.activeTweens = tweens;
        return true;
    }

    getLastJumpError() {
        return this.lastJumpError;
    }

    jumpToMesh(payload = {}) {
        const normalizedPayload = this.normalizeActionPayload(payload);
        const meshTargetPayload = normalizedPayload.meshTarget && typeof normalizedPayload.meshTarget === 'object'
            ? normalizedPayload.meshTarget
            : {};
        return this.jump({
            ...normalizedPayload,
            targetType: 'mesh',
            meshTarget: {
                ...(this.config.meshTarget || {}),
                ...meshTargetPayload,
                componentId: normalizedPayload.componentId || meshTargetPayload.componentId || this.config.meshTarget?.componentId || '',
                meshName: normalizedPayload.meshName || meshTargetPayload.meshName || this.config.meshTarget?.meshName || '',
                nodePath: normalizedPayload.nodePath || meshTargetPayload.nodePath || '',
                includeChildren: normalizedPayload.includeChildren ?? meshTargetPayload.includeChildren ?? this.config.meshTarget?.includeChildren ?? true
            }
        });
    }

    jumpToLabel(payload = {}) {
        const normalizedPayload = this.normalizeActionPayload(payload);
        return this.jump({
            ...normalizedPayload,
            targetType: 'label',
            labelTarget: {
                ...(this.config.labelTarget || {}),
                ...(normalizedPayload.labelTarget || {}),
                componentId: normalizedPayload.componentId || normalizedPayload.labelTarget?.componentId || this.config.labelTarget?.componentId || '',
                labelId: normalizedPayload.labelId || normalizedPayload.labelTarget?.labelId || this.config.labelTarget?.labelId || ''
            }
        });
    }

    jumpToPoint(payload = {}) {
        const normalizedPayload = this.normalizeActionPayload(payload);
        const position = normalizedPayload.position || normalizedPayload.pointTarget?.position;
        const pointTarget = {
            ...(this.config.pointTarget || {}),
            ...(normalizedPayload.pointTarget || {}),
            source: normalizedPayload.source || normalizedPayload.pointTarget?.source || this.config.pointTarget?.source || 'manual',
            pointId: normalizedPayload.pointId || normalizedPayload.pointTarget?.pointId || this.config.pointTarget?.pointId || '',
            position: {
                ...((this.config.pointTarget && this.config.pointTarget.position) || {}),
                ...(position || {})
            }
        };
        return this.jump({
            ...normalizedPayload,
            targetType: 'point',
            pointTarget
        });
    }

    onDispose() {
        this.stop();
        this._tempVecA = null;
        this._tempVecB = null;
    }
}

export default CameraJump;
