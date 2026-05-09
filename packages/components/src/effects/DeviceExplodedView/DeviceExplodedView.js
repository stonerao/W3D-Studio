import { Component } from '@w3d/core';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

const TEMP_BOX = new THREE.Box3();
const TEMP_CENTER = new THREE.Vector3();
const TEMP_PARENT_INV = new THREE.Matrix4();
const TEMP_TARGET_WORLD_MATRIX = new THREE.Matrix4();
const TEMP_ORIGIN = new THREE.Vector3();
const FALLBACK_DIRECTION = new THREE.Vector3(0, 1, 0);

const normalizeArrayVec3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [
            Number.isFinite(Number(value[0])) ? Number(value[0]) : fallback[0],
            Number.isFinite(Number(value[1])) ? Number(value[1]) : fallback[1],
            Number.isFinite(Number(value[2])) ? Number(value[2]) : fallback[2]
        ];
    }
    if (value && typeof value === 'object') {
        return [
            Number.isFinite(Number(value.x)) ? Number(value.x) : fallback[0],
            Number.isFinite(Number(value.y)) ? Number(value.y) : fallback[1],
            Number.isFinite(Number(value.z)) ? Number(value.z) : fallback[2]
        ];
    }
    return [...fallback];
};

const getNodeLabel = (object, index) => {
    const name = String(object?.name || '').trim();
    if (name) return name;
    return `${object?.type || 'Node'}_${index}`;
};

const isPerformanceBatchMesh = (object) => {
    return object?.userData?.__w3dPerformanceBatchMesh === true
        || String(object?.name || '').startsWith('__w3d_batched_');
};

const buildNodeTree = (roots = []) => {
    const walk = (object, pathParts = [], depth = 1) => {
        if (!object || isPerformanceBatchMesh(object)) return null;

        const children = Array.isArray(object?.children)
            ? object.children.filter((child) => !isPerformanceBatchMesh(child))
            : [];
        return {
            key: pathParts.join('/'),
            label: getNodeLabel(object, pathParts[pathParts.length - 1] ?? 0),
            depth,
            object,
            children: children
                .map((child, index) => walk(child, [...pathParts, index], depth + 1))
                .filter(Boolean)
        };
    };

    return roots
        .map((root, index) => walk(root, [index], 1))
        .filter(Boolean);
};

const flattenTree = (nodes = [], target = []) => {
    nodes.forEach((node) => {
        target.push(node);
        flattenTree(node.children, target);
    });
    return target;
};

const getDedupedCustomKeys = (keys = []) => {
    const sorted = [...new Set(keys.map((item) => String(item || '').trim()).filter(Boolean))]
        .sort((a, b) => a.length - b.length);

    return sorted.filter((key, index) => {
        return !sorted.slice(0, index).some((ancestor) => key.startsWith(`${ancestor}/`));
    });
};

/**
 * Effects module component that creates device-focused exploded views for equipment inspection workflows.
 */
export class DeviceExplodedView extends Component {
    static defaultConfig = {
        selectedLoaderId: '',
        selectionMode: 'level',
        explodeLevel: 1,
        selectedNodeKeys: [],
        originMode: 'sceneOrigin',
        origin: [0, 0, 0],
        baseOffset: 0,
        distanceFactor: 0.18,
        distanceExponent: 1,
        maxOffset: 30,
        axisMask: { x: true, y: true, z: true },
        animate: true,
        time: 1.2,
        delayStep: 0,
        delayMode: 'byDistance',
        easingPreset: 'quadratic-out'
    };

    static methodDefinitions = [
        { name: 'start', title: '开始爆炸', description: '执行设备爆炸动画' },
        { name: 'reset', title: '恢复原位', description: '恢复设备节点到初始位置' },
        { name: 'getNodeSummary', title: '获取节点摘要', description: '获取当前节点数量及状态信息' }
    ];

    onMounted() {
        this.currentState = 'normal';
        this.activeAnimation = null;
        this.deviceNodes = [];
        this.nodeTree = [];
        this.nodeMap = new Map();
        this.initializeNodes();
    }

    getTargetLoader() {
        const targetId = String(this.config.selectedLoaderId || '').trim();
        if (!targetId || !this.scene?.componentManager) return null;

        const allComponents = this.scene.componentManager.getAll?.() || [];
        return allComponents.find((component) => {
            if (!component) return false;
            const candidates = [
                component.config?.id,
                component.config?.name,
                component.name
            ].map((value) => String(value || '').trim()).filter(Boolean);
            return candidates.includes(targetId) && (component.model || component.componentScene);
        }) || null;
    }

    syncTargetLoaderBatch() {
        const loader = this.getTargetLoader();
        loader?.syncPerformanceBatchMatrices?.();
    }

    getLoaderRoots(loader) {
        if (!loader) return [];
        if (loader.model && Array.isArray(loader.model.children)) {
            return loader.model.children;
        }
        if (loader.componentScene && Array.isArray(loader.componentScene.children)) {
            return loader.componentScene.children;
        }
        return [];
    }

    initializeNodes() {
        this.deviceNodes = [];
        this.nodeTree = [];
        this.nodeMap.clear();

        const loader = this.getTargetLoader();
        if (!loader) {
            return;
        }

        const roots = this.getLoaderRoots(loader);
        this.nodeTree = buildNodeTree(roots);
        const flatNodes = flattenTree(this.nodeTree);

        flatNodes.forEach((node) => {
            this.nodeMap.set(node.key, node);
        });

        this.rebuildSelectedNodes();
    }

    rebuildSelectedNodes() {
        const loader = this.getTargetLoader();
        if (!loader) {
            this.deviceNodes = [];
            return;
        }

        loader.model?.updateWorldMatrix?.(true, true);
        loader.componentScene?.updateWorldMatrix?.(true, true);

        const originWorld = this.resolveOriginWorld().clone();
        const selectedNodes = this.resolveExplosionTreeNodes(this.resolveSelectedTreeNodes());
        this.deviceNodes = selectedNodes.map((node, index) => {
            const object = node.object;
            const center = TEMP_BOX.setFromObject(object).getCenter(new THREE.Vector3());
            const worldPosition = object.getWorldPosition(new THREE.Vector3());
            return {
                key: node.key,
                label: node.label,
                depth: node.depth,
                index,
                object,
                parent: object.parent || null,
                parentKey: this.getParentKey(node.key),
                center,
                distance: center.distanceTo(originWorld),
                originalLocalPosition: object.position.clone(),
                originalWorldPosition: worldPosition.clone(),
                originalWorldMatrix: object.matrixWorld.clone()
            };
        });
    }

    resolveSelectedTreeNodes() {
        const mode = String(this.config.selectionMode || 'level');
        const nodes = Array.from(this.nodeMap.values());

        if (mode === 'leaf') {
            return nodes.filter((node) => node.children.length === 0);
        }

        if (mode === 'custom') {
            const dedupedKeys = getDedupedCustomKeys(this.config.selectedNodeKeys || []);
            return dedupedKeys
                .map((key) => this.nodeMap.get(key))
                .filter(Boolean);
        }

        const targetDepth = Math.max(1, Number(this.config.explodeLevel) || 1);
        return nodes.filter((node) => node.depth === targetDepth);
    }

    getParentKey(key = '') {
        const index = String(key).lastIndexOf('/');
        return index > -1 ? key.slice(0, index) : '';
    }

    resolveExplosionTreeNodes(selectedNodes = []) {
        const visited = new Set();
        const result = [];

        const walk = (node) => {
            if (!node || visited.has(node.key)) return;
            visited.add(node.key);
            result.push(node);
            node.children.forEach((child) => walk(child));
        };

        selectedNodes.forEach((node) => walk(node));
        return result.sort((a, b) => a.depth - b.depth);
    }

    resolveOriginWorld() {
        const loader = this.getTargetLoader();
        const mode = String(this.config.originMode || 'sceneOrigin');

        if (mode === 'modelCenter' && loader?.model) {
            return TEMP_BOX.setFromObject(loader.model).getCenter(TEMP_ORIGIN);
        }

        if (mode === 'custom' && loader?.model) {
            const [x, y, z] = normalizeArrayVec3(this.config.origin, [0, 0, 0]);
            return loader.model.localToWorld(TEMP_ORIGIN.set(x, y, z));
        }

        return TEMP_ORIGIN.set(0, 0, 0);
    }

    resolveEasing() {
        const preset = this.config.easingPreset || 'quadratic-out';
        const easingMap = {
            linear: TWEEN.Easing.Linear.None,
            'quadratic-in': TWEEN.Easing.Quadratic.In,
            'quadratic-out': TWEEN.Easing.Quadratic.Out,
            'quadratic-inout': TWEEN.Easing.Quadratic.InOut,
            'cubic-out': TWEEN.Easing.Cubic.Out,
            'cubic-inout': TWEEN.Easing.Cubic.InOut,
            'elastic-out': TWEEN.Easing.Elastic.Out,
            'bounce-out': TWEEN.Easing.Bounce.Out,
            'back-out': TWEEN.Easing.Back.Out
        };
        return easingMap[preset] || TWEEN.Easing.Quadratic.Out;
    }

    resolveWorldOffset(node, originWorld = null) {
        const axisMask = this.config.axisMask || {};
        const origin = originWorld ? originWorld.clone() : this.resolveOriginWorld().clone();
        const direction = node.center.clone().sub(origin);

        if (axisMask.x === false) direction.x = 0;
        if (axisMask.y === false) direction.y = 0;
        if (axisMask.z === false) direction.z = 0;

        if (direction.lengthSq() <= 1e-8) {
            direction.copy(FALLBACK_DIRECTION);
        } else {
            direction.normalize();
        }

        const baseOffset = Number(this.config.baseOffset) || 0;
        const distanceFactor = Number(this.config.distanceFactor) || 0;
        const distanceExponent = Number(this.config.distanceExponent) || 1;
        const maxOffset = Math.max(0, Number(this.config.maxOffset) || 0);
        const distance = Math.max(0, Number(node.distance) || 0);
        const computedDistance = baseOffset + distanceFactor * Math.pow(distance, distanceExponent);
        const offsetDistance = maxOffset > 0 ? Math.min(computedDistance, maxOffset) : computedDistance;

        return direction.multiplyScalar(offsetDistance);
    }

    resolveDelay(node, orderIndex) {
        const delayStep = Math.max(0, Number(this.config.delayStep) || 0);
        if (delayStep === 0) return 0;
    }

    buildDelayMap() {
        const delayStep = Math.max(0, Number(this.config.delayStep) || 0);
        if (delayStep === 0) {
            return new Map(this.deviceNodes.map((node) => [node.key, 0]));
        }

        const delayMode = String(this.config.delayMode || 'none');
        const orderedNodes = [...this.deviceNodes];

        if (delayMode === 'byDistance') {
            orderedNodes.sort((a, b) => a.distance - b.distance);
        } else if (delayMode === 'byDepth') {
            orderedNodes.sort((a, b) => a.depth - b.depth || a.index - b.index);
        }

        return new Map(orderedNodes.map((node, index) => [node.key, index * delayStep]));
    }

    buildExplodeTargetMap() {
        const originWorld = this.resolveOriginWorld().clone();
        const targetStateMap = new Map();
        const targetLocalMap = new Map();

        this.deviceNodes.forEach((node) => {
            const worldOffset = this.resolveWorldOffset(node, originWorld);
            const targetWorldPosition = node.originalWorldPosition.clone().add(worldOffset);

            let parentWorldMatrix = null;
            if (node.parentKey && targetStateMap.has(node.parentKey)) {
                parentWorldMatrix = targetStateMap.get(node.parentKey);
            } else if (node.parent?.matrixWorld) {
                parentWorldMatrix = node.parent.matrixWorld;
            }

            let targetLocalPosition = targetWorldPosition.clone();
            if (parentWorldMatrix) {
                TEMP_PARENT_INV.copy(parentWorldMatrix).invert();
                targetLocalPosition = targetWorldPosition.clone().applyMatrix4(TEMP_PARENT_INV);
            }

            const targetWorldMatrix = TEMP_TARGET_WORLD_MATRIX.copy(node.originalWorldMatrix);
            targetWorldMatrix.setPosition(targetWorldPosition);
            targetStateMap.set(node.key, targetWorldMatrix.clone());
            targetLocalMap.set(node.key, targetLocalPosition);
        });

        return targetLocalMap;
    }

    buildAnimationPlan(type = 'explode') {
        if (this.deviceNodes.length === 0) return null;

        const delayMap = this.buildDelayMap();
        const explodeTargetMap = type === 'explode' ? this.buildExplodeTargetMap() : null;
        const durationMs = Math.max(0, Number(this.config.time) || 0) * 1000;
        const easing = this.resolveEasing();

        const nodes = this.deviceNodes.map((node) => {
            const from = node.object.position.clone();
            const to = type === 'explode'
                ? (explodeTargetMap.get(node.key)?.clone() || node.originalLocalPosition.clone())
                : node.originalLocalPosition.clone();
            const delayMs = delayMap.get(node.key) || 0;
            return {
                key: node.key,
                object: node.object,
                from,
                to,
                delayMs
            };
        });

        const totalDurationMs = nodes.reduce((max, node) => {
            return Math.max(max, node.delayMs + durationMs);
        }, durationMs);

        return {
            type,
            durationMs,
            totalDurationMs,
            elapsedMs: 0,
            easing,
            nodes
        };
    }

    applyAnimationFrame(plan) {
        const durationMs = Math.max(0, plan.durationMs);

        plan.nodes.forEach((node) => {
            if (durationMs === 0) {
                node.object.position.copy(node.to);
                return;
            }

            const localElapsed = (plan.elapsedMs - node.delayMs) / durationMs;
            const t = Math.min(1, Math.max(0, localElapsed));
            const eased = plan.easing(t);
            node.object.position.copy(node.from).lerp(node.to, eased);
        });
        this.syncTargetLoaderBatch();
    }

    finalizeAnimation(plan) {
        plan.nodes.forEach((node) => {
            node.object.position.copy(node.to);
        });
        this.syncTargetLoaderBatch();
        this.activeAnimation = null;
    }

    playAnimation(type = 'explode') {
        const plan = this.buildAnimationPlan(type);
        if (!plan) {
            return false;
        }

        if (this.config.animate === false || plan.durationMs === 0) {
            this.finalizeAnimation(plan);
            return true;
        }

        this.activeAnimation = plan;
        this.applyAnimationFrame(plan);
        return true;
    }

    restoreOriginalPositions() {
        this.deviceNodes.forEach((node) => {
            node.object.position.copy(node.originalLocalPosition);
        });
        this.syncTargetLoaderBatch();
    }

    start() {
        if (this.currentState === 'exploded' && !this.activeAnimation) return;

        this.initializeNodes();
        if (this.deviceNodes.length === 0) {
            console.warn('[DeviceExplodedView] No nodes resolved for explosion');
            return;
        }

        this.currentState = 'exploded';
        this.playAnimation('explode');

        this.emit('exploded', {
            count: this.deviceNodes.length
        });
    }

    reset() {
        if (this.currentState === 'normal' && !this.activeAnimation) return;

        this.currentState = 'normal';
        this.playAnimation('reset');

        this.emit('reset');
    }

    getNodeSummary() {
        return this.deviceNodes.map((node) => ({
            key: node.key,
            label: node.label,
            depth: node.depth,
            distance: Number(node.distance.toFixed(4))
        }));
    }

    async updateConfig(newConfig) {
        this.activeAnimation = null;
        if (this.currentState === 'exploded') {
            this.restoreOriginalPositions();
            this.currentState = 'normal';
        }

        this.config = {
            ...this.config,
            ...newConfig
        };

        this.initializeNodes();
    }

    onUpdate(delta) {
        if (!this.activeAnimation) return;

        this.activeAnimation.elapsedMs += Math.max(0, Number(delta) || 0) * 1000;
        this.applyAnimationFrame(this.activeAnimation);

        if (this.activeAnimation.elapsedMs >= this.activeAnimation.totalDurationMs) {
            this.finalizeAnimation(this.activeAnimation);
        }
    }

    onDispose() {
        this.activeAnimation = null;
        this.restoreOriginalPositions();
        this.deviceNodes = [];
        this.nodeTree = [];
        this.nodeMap.clear();
    }
}
