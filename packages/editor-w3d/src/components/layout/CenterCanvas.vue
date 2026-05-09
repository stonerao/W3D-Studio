<template>
    <div
        class="center-canvas canvas-container"
        :class="{ 'is-drag-over': dragOverlayVisible }"
        @dragenter="handleDragEnter"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
    >
        <!-- English comment. -->
        <div ref="canvasRef" class="w-full h-full"></div>

        <!-- English comment. -->
        <div v-if="dragOverlayVisible" class="drag-overlay">
            <div class="drag-overlay__title">{{ t('canvas.releaseToAdd') }}</div>
            <div class="drag-overlay__sub">{{ dragOverlayText }}</div>
        </div>

        <!-- English comment. -->
        <div v-if="trafficPickBarVisible" class="traffic-pick-bar">
            <div class="traffic-pick-bar__text">
                <div class="traffic-pick-bar__title">{{ trafficPickBarTitle }}</div>
                <div class="traffic-pick-bar__sub">{{ trafficPickBarSub }}</div>
            </div>
            <div class="traffic-pick-bar__actions">
                <Button size="sm" variant="outline" @click="handleTrafficPickCancel">
                    {{ t('canvas.cancel') }}
                </Button>
                <Button
                    v-if="trafficPickBarCanRepick"
                    size="sm"
                    variant="primary"
                    @click="handleTrafficRepick"
                >
                    {{ t('canvas.repick') }}
                </Button>
            </div>
        </div>

        <!-- English comment. -->
        <div v-if="trajectoryPickBarVisible" class="traffic-pick-bar">
            <div class="traffic-pick-bar__text">
                <div class="traffic-pick-bar__title">
                    {{ t('canvas.trajectoryPickingTitle', { name: trajectoryPickComponentName }) }}
                </div>
                <div class="traffic-pick-bar__sub">
                    {{ t('canvas.trajectoryPickingSub', { count: trajectoryPickPointCount }) }}
                </div>
            </div>
            <div class="traffic-pick-bar__actions">
                <Button size="sm" variant="outline" @click="handleTrajectoryPickStop">
                    {{ t('canvas.finish') }}
                </Button>
            </div>
        </div>

        <div v-if="meshPickBarVisible" class="traffic-pick-bar">
            <div class="traffic-pick-bar__text">
                <div class="traffic-pick-bar__title">{{ meshPickBarTitle }}</div>
                <div class="traffic-pick-bar__sub">{{ meshPickBarSub }}</div>
            </div>
            <div class="traffic-pick-bar__actions">
                <Button size="sm" variant="outline" @click="handleMeshPickCancel">
                    {{ t('canvas.cancel') }}
                </Button>
            </div>
        </div>

        <div
            v-if="screenFlashState.visible"
            class="alarm-screen-flash"
            :style="{
                '--alarm-flash-color': screenFlashState.color,
                '--alarm-flash-opacity': String(screenFlashState.opacity ?? 0.2),
                '--alarm-flash-duration': `${screenFlashState.durationMs || 1200}ms`
            }"
        ></div>

        <div v-if="alarmModalState.visible" class="alarm-runtime-modal">
            <div class="alarm-runtime-modal__backdrop" @click="closeAlarmModal"></div>
            <div class="alarm-runtime-modal__panel">
                <div class="alarm-runtime-modal__header">
                    <div>
                        <div class="alarm-runtime-modal__eyebrow">{{ t('canvas.alarmPrompt') }}</div>
                        <div class="alarm-runtime-modal__title">{{ alarmModalState.title }}</div>
                    </div>
                    <button class="alarm-runtime-modal__close" type="button" @click="closeAlarmModal">×</button>
                </div>
                <div class="alarm-runtime-modal__body">
                    <div class="alarm-runtime-modal__message">{{ alarmModalState.message }}</div>
                    <div v-if="alarmModalState.severity" class="alarm-runtime-modal__severity">
                        {{ t('canvas.severity', { severity: alarmModalState.severity }) }}
                    </div>
                </div>
                <div class="alarm-runtime-modal__footer">
                    <Button size="sm" variant="outline" @click="closeAlarmModal">
                        {{ t('canvas.close') }}
                    </Button>
                </div>
            </div>
        </div>

        <!-- English comment. -->
        <div
            v-if="canvasLoadingVisible"
            class="canvas-loading-overlay"
        >
            <div class="canvas-loading-content">
                <div class="canvas-loading-title">{{ canvasLoadingTitle }}</div>
                <div
                    v-if="loadingEffect === 'spinner'"
                    class="loading-spinner"
                    aria-label="loading-spinner"
                ></div>
                <div v-else-if="loadingEffect === 'dots'" class="loading-dots" aria-label="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div v-else class="loading-pulse" aria-label="loading-pulse">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>

        <!-- English comment. -->
        <div
            v-if="sceneError"
            class="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-90 z-10"
        >
            <div class="text-center">
                <div class="text-6xl mb-4"></div>
                <div class="text-lg font-medium text-red-700 mb-2">{{ t('canvas.sceneInitFailed') }}</div>
                <div class="text-sm text-red-600">{{ sceneError }}</div>
                <button
                    class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    @click="retryInit"
                >
                    {{ t('canvas.retry') }}
                </button>
            </div>
        </div>

        <!-- English comment. -->
        <div
            v-if="sceneInitialized && !canvasLoadingVisible && isTransformable"
            class="transform-toolbar"
        >
            <button
                type="button"
                class="transform-btn"
                :class="{ active: transformMode === 'translate' }"
                :disabled="isSelectedLocked"
                @click="setTransformMode('translate')"
                :title="t('canvas.moveTitle')"
                :aria-label="t('canvas.moveTitle')"
            >
                <i class="sico icon-move transform-btn__icon" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="transform-btn"
                :class="{ active: transformMode === 'rotate' }"
                :disabled="isSelectedLocked"
                @click="setTransformMode('rotate')"
                :title="t('canvas.rotateTitle')"
                :aria-label="t('canvas.rotateTitle')"
            >
                <i class="sico icon-yulanxuanzhuan transform-btn__icon" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="transform-btn"
                :class="{ active: transformMode === 'scale' }"
                :disabled="isSelectedLocked"
                @click="setTransformMode('scale')"
                :title="t('canvas.scaleTitle')"
                :aria-label="t('canvas.scaleTitle')"
            >
                <i class="sico icon-iconset0442 transform-btn__icon" aria-hidden="true"></i>
            </button>
        </div>

        <!-- English comment. -->
        <div
            v-if="sceneInitialized && !canvasLoadingVisible"
            class="canvas-status-chip"
        >
            <span>FPS {{ fps }}</span>
            <span>{{ t('canvas.componentsCount', { count: components.length }) }}</span>
        </div>

        <ContextMenu
            v-model:visible="canvasContextMenu.visible"
            :x="canvasContextMenu.x"
            :y="canvasContextMenu.y"
            :items="canvasContextMenuItems"
            @select="handleCanvasContextAction"
        />
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import '../../styles/icon/iconfont.css';
import { useScene } from '../../composables/useScene';
import { useAlarmRuntime } from '../../composables/useAlarmRuntime';
import { useLargeSceneRuntime } from '../../composables/useLargeSceneRuntime';
import { useSceneStore } from '../../stores/useSceneStore';
import { useComponent } from '../../composables/useComponent';
import { useComponentStore } from '../../stores/useComponentStore';
import { findComponentIdFromObject, getPickingMetadataFromObject, tagInstanceForPicking } from '../../utils/picking';
import { getModelHitIdentity } from '../../utils/modelElementIdentity';
import {
    createLocalModelAssetFromDataTransfer,
    isPotentialFileDrag,
    hasSupportedModelFiles
} from '../../utils/localModelFiles';
import { useLargeSceneStore } from '../../stores/useLargeSceneStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { useDiagnosticsStore } from '../../stores/useDiagnosticsStore';
import Button from '../ui/Button.vue';
import ContextMenu from '../ui/ContextMenu.vue';
import { useToast } from '../../composables/useToast';
import { useEditorI18n } from '../../i18n';

const canvasRef = ref(null);
const fps = ref(60);
const { t } = useEditorI18n();
const DEFAULT_SCENE_STATE = Object.freeze({
    initialized: false,
    loading: false,
    error: null
});

// English comment.
const sceneStore = useSceneStore();
const sceneApi = useScene();
const sceneState = computed(() => sceneApi?.sceneState || sceneStore.sceneState || DEFAULT_SCENE_STATE);
const sceneLoading = computed(() => Boolean(sceneState.value?.loading));
const loadingConfig = computed(() => sceneStore.sceneConfig?.loading || { enabled: true, effect: 'spinner' });
const sceneLoadingVisible = computed(() => sceneLoading.value && loadingConfig.value?.enabled !== false);
const loadingEffect = computed(() => {
    const effect = String(loadingConfig.value?.effect || 'spinner');
    return ['spinner', 'dots', 'pulse'].includes(effect) ? effect : 'spinner';
});
const sceneInitialized = computed(() => Boolean(sceneState.value?.initialized));
const sceneError = computed(() => sceneState.value?.error || '');
const initScene = sceneApi?.initScene || (async () => {
    throw new Error('Scene API unavailable');
});
const disposeScene = sceneApi?.disposeScene || (() => {});
const alarmRuntime = useAlarmRuntime();
const screenFlashState = alarmRuntime.screenFlashState;
const alarmModalState = alarmRuntime.alarmModalState;
const closeAlarmModal = alarmRuntime.closeAlarmModal;
const largeSceneRuntime = useLargeSceneRuntime();

// English comment.
const {
    components,
    addComponent,
    selectComponent,
    deselectComponent,
    updateComponentConfig,
    refreshSelectionHighlight
} = useComponent();
const componentStore = useComponentStore();
const editorStore = useEditorStore();
const largeSceneStore = useLargeSceneStore();
const alarmStore = useAlarmStore();
const diagnosticsStore = useDiagnosticsStore();
const toast = useToast();

const MARKER_CONTEXT_TYPES = new Set(['CameraPointManager', 'PointTypeMarkerManager']);
const MODEL_CONTEXT_TYPES = new Set(['ModelLoader']);

const modelLoadingState = ref({
    active: false,
    progress: 0,
    count: 0,
    name: ''
});
const modelLoadStates = new Map();
const modelLoadBindings = new Map();

const normalizeLoadProgress = (value) => {
    const progress = Number(value);
    if (!Number.isFinite(progress)) return 0;
    return Math.min(1, Math.max(0, progress));
};

const updateModelLoadingSummary = () => {
    const activeStates = Array.from(modelLoadStates.values()).filter((state) => state.loading);

    if (!activeStates.length) {
        modelLoadingState.value = {
            active: false,
            progress: 0,
            count: 0,
            name: ''
        };
        return;
    }

    const primaryState = activeStates[0];
    modelLoadingState.value = {
        active: true,
        progress: normalizeLoadProgress(primaryState.progress),
        count: activeStates.length,
        name: primaryState.name || ''
    };
};

const setModelLoadState = (componentId, patch = {}) => {
    const component = componentStore.getComponentById(componentId);
    if (!component) {
        modelLoadStates.delete(componentId);
        updateModelLoadingSummary();
        return;
    }

    const current = modelLoadStates.get(componentId) || {};
    modelLoadStates.set(componentId, {
        componentId,
        name: component.name || component.config?.name || t('canvas.modelFallbackName'),
        loading: false,
        progress: 0,
        ...current,
        ...patch
    });
    updateModelLoadingSummary();
};

const clearModelLoadState = (componentId) => {
    modelLoadStates.delete(componentId);
    updateModelLoadingSummary();
};

const syncModelLoadStateFromInstance = (component) => {
    const instance = component?.instance;
    if (!component?.id || component?.type !== 'ModelLoader' || !instance?.isLoading) {
        if (component?.id) {
            clearModelLoadState(component.id);
        }
        return;
    }

    setModelLoadState(component.id, {
        loading: true,
        progress: normalizeLoadProgress(instance.loadProgress),
        name: component.name || component.config?.name || t('canvas.modelFallbackName')
    });
};

const unbindModelLoadEvents = (componentId) => {
    const binding = modelLoadBindings.get(componentId);
    if (!binding) return;

    const { instance, handlers } = binding;
    instance?.off?.('loadStart', handlers.handleLoadStart);
    instance?.off?.('loadProgress', handlers.handleLoadProgress);
    instance?.off?.('loadComplete', handlers.handleLoadFinish);
    instance?.off?.('loadError', handlers.handleLoadFinish);

    modelLoadBindings.delete(componentId);
    clearModelLoadState(componentId);
};

const bindModelLoadEvents = (component) => {
    const instance = component?.instance;
    if (!component?.id || component.type !== 'ModelLoader' || !instance) return;

    const existing = modelLoadBindings.get(component.id);
    if (existing?.instance === instance) {
        syncModelLoadStateFromInstance(component);
        return;
    }

    unbindModelLoadEvents(component.id);

    const handlers = {
        handleLoadStart: (payload = {}) => {
            setModelLoadState(component.id, {
                loading: true,
                progress: normalizeLoadProgress(payload.progress),
                name: component.name || component.config?.name || t('canvas.modelFallbackName')
            });
        },
        handleLoadProgress: (payload = {}) => {
            setModelLoadState(component.id, {
                loading: true,
                progress: normalizeLoadProgress(payload.progress)
            });
        },
        handleLoadFinish: () => {
            clearModelLoadState(component.id);
        }
    };

    instance.on?.('loadStart', handlers.handleLoadStart);
    instance.on?.('loadProgress', handlers.handleLoadProgress);
    instance.on?.('loadComplete', handlers.handleLoadFinish);
    instance.on?.('loadError', handlers.handleLoadFinish);

    modelLoadBindings.set(component.id, { instance, handlers });
    syncModelLoadStateFromInstance(component);
};

const refreshModelLoadEventBindings = () => {
    const activeIds = new Set();

    (componentStore.components || []).forEach((component) => {
        if (component?.type !== 'ModelLoader' || !component.instance) return;
        activeIds.add(component.id);
        bindModelLoadEvents(component);
    });

    Array.from(modelLoadBindings.keys()).forEach((componentId) => {
        if (!activeIds.has(componentId)) {
            unbindModelLoadEvents(componentId);
        }
    });

    updateModelLoadingSummary();
};

const clearModelLoadEventBindings = () => {
    Array.from(modelLoadBindings.keys()).forEach((componentId) => {
        unbindModelLoadEvents(componentId);
    });
    modelLoadStates.clear();
    updateModelLoadingSummary();
};

const modelLoadingVisible = computed(() => modelLoadingState.value.active);
const canvasLoadingVisible = computed(() => sceneLoadingVisible.value || modelLoadingVisible.value);
const canvasLoadingTitle = computed(() => {
    if (sceneLoadingVisible.value) return t('canvas.sceneLoading');

    const state = modelLoadingState.value;
    const progress = normalizeLoadProgress(state.progress);
    const progressText = progress > 0 && progress < 1 ? ` ${Math.round(progress * 100)}%` : '';

    if (state.count > 1) {
        return t('canvas.modelLoadingCount', { count: state.count, progress: progressText });
    }

    return t('canvas.modelLoadingNamed', {
        name: state.name || t('canvas.modelFallbackName'),
        progress: progressText
    });
});

const canvasContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    context: null
});

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toVec3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [
            toFiniteNumber(value[0], fallback[0]),
            toFiniteNumber(value[1], fallback[1]),
            toFiniteNumber(value[2], fallback[2])
        ];
    }
    if (value && typeof value === 'object') {
        return [
            toFiniteNumber(value.x, fallback[0]),
            toFiniteNumber(value.y, fallback[1]),
            toFiniteNumber(value.z, fallback[2])
        ];
    }
    return [...fallback];
};

const getComponentPoints = (component) => (
    Array.isArray(component?.config?.points) ? component.config.points : []
);

const buildUniqueName = (baseName, names) => {
    const usedNames = new Set((names || []).map((name) => String(name || '').toLowerCase()));
    if (!usedNames.has(String(baseName).toLowerCase())) return baseName;

    let index = 1;
    let nextName = `${baseName}${index}`;
    while (usedNames.has(nextName.toLowerCase())) {
        index += 1;
        nextName = `${baseName}${index}`;
    }
    return nextName;
};

const buildUniqueId = (prefix, ids) => {
    const usedIds = new Set((ids || []).map((id) => String(id || '')));
    let nextId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    while (usedIds.has(nextId)) {
        nextId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return nextId;
};

const getCameraPointDefaultType = (component) => {
    const config = component?.config || {};
    if (config.typeStyles && typeof config.typeStyles === 'object' && !Array.isArray(config.typeStyles)) {
        const firstKey = Object.keys(config.typeStyles)[0];
        if (firstKey) return firstKey;
    }
    if (Array.isArray(config.types) && config.types[0]?.id) {
        return String(config.types[0].id);
    }
    return 'default';
};

const getPointTypeMarkerDefaultType = (component) => {
    const config = component?.config || {};
    if (Array.isArray(config.types) && config.types[0]?.id) {
        return String(config.types[0].id);
    }
    return 'default';
};

const createMarkerPointForComponent = (component, position) => {
    const points = getComponentPoints(component);
    const ids = points.map((point) => point?.id);
    const names = points.map((point) => point?.name);
    const xyz = toVec3(position).map(round4);

    if (component?.type === 'CameraPointManager') {
        return {
            id: buildUniqueId('camera_point', ids),
            name: buildUniqueName(`摄像头点位${points.length + 1}`, names),
            position: xyz,
            type: getCameraPointDefaultType(component),
            vendor: 'generic',
            videoUrl: '',
            videoFormat: 'hls',
            videoInfo: []
        };
    }

    return {
        id: buildUniqueId('point', ids),
        name: buildUniqueName(`点位 ${points.length + 1}`, names),
        typeId: getPointTypeMarkerDefaultType(component),
        position: xyz,
        scale: null,
        offset: null,
        color: null,
        visible: true
    };
};

// English comment.
const dragOverlayVisible = ref(false);
const dragOverlayText = ref('');

const isSupportedDrag = (event) => {
    const types = event?.dataTransfer?.types;
    if (!types) return false;
    return (
        Array.from(types).includes('component-type') ||
        Array.from(types).includes('asset-url') ||
        isPotentialFileDrag(event)
    );
};

const updateDragOverlay = (event) => {
    const dt = event?.dataTransfer;
    if (!dt) return;

    const compName = dt.getData('component-name');
    const compType = dt.getData('component-type');
    const assetUrl = dt.getData('asset-url');
    const assetType = dt.getData('asset-type');
    const assetFormat = dt.getData('asset-format');

    if (isPotentialFileDrag(event)) {
        if (hasSupportedModelFiles(dt.files)) {
            const count = dt.files?.length || 0;
            dragOverlayText.value = count > 1
                ? t('canvas.localModelFilesCount', { count })
                : t('canvas.localModelFiles');
        } else {
            dragOverlayText.value = t('canvas.localModelDropHint');
        }
        return;
    }

    if (compType) {
        dragOverlayText.value = compName ? `${compName}（${compType}）` : compType;
        return;
    }
    if (assetUrl) {
        dragOverlayText.value = assetType === 'model'
            ? t('canvas.modelAsset', { url: assetUrl })
            : assetType === 'splat'
                ? t('canvas.splatAsset', { url: assetUrl })
                : assetType === 'geojson'
                    ? `GeoJSON：${assetUrl}`
                : t('canvas.resourceAsset', { url: assetUrl });
    }
};

watch(fps, (value) => {
    largeSceneStore.setCurrentFps(value);
}, { immediate: true });

const isObjectVisible = (obj) => {
    let cur = obj;
    while (cur) {
        if (cur.visible === false) return false;
        if (cur.userData && cur.userData.__editorIgnoreRaycast) return false;
        cur = cur.parent;
    }
    return true;
};

const getDropWorldPoint = (event) => {
    const scene = sceneStore.sceneInstance;
    const raycaster = scene?.eventSystem?.raycaster;
    if (!scene || !raycaster) return null;

    // English comment.
    const intersects = getScenePickHits(event);
    if (intersects.length > 0 && intersects[0]?.point) {
        return intersects[0].point;
    }

    // English comment.
    return raycaster.intersectGround?.(event) || null;
};

const round4 = (n) => Math.round(n * 10000) / 10000;

const isModelLoaderPickTarget = (componentId, pickMeta = null) => {
    if (pickMeta?.pickable === false) {
        return false;
    }
    const component = componentStore.getComponentById(componentId);
    if (component?.type === 'ModelLoader') {
        return true;
    }
    return pickMeta?.componentType === 'ModelLoader';
};

const isSurfacePickTarget = (componentId, pickMeta = null) => {
    if (pickMeta?.pickable === false) {
        return false;
    }

    const component = componentStore.getComponentById(componentId);
    const componentType = component?.type || pickMeta?.componentType;
    return componentType === 'ModelLoader' || componentType === 'GaussianSplatLoader';
};

const componentHasCanvasContextActions = (component) => {
    if (!component) return false;
    return MODEL_CONTEXT_TYPES.has(component.type) || MARKER_CONTEXT_TYPES.has(component.type);
};

const findUserDataValue = (object, resolvers) => {
    let cursor = object;
    while (cursor) {
        const userData = cursor.userData || {};
        for (const resolver of resolvers) {
            const value = typeof resolver === 'function' ? resolver(userData, cursor) : userData[resolver];
            if (value !== undefined && value !== null && String(value) !== '') {
                return value;
            }
        }
        cursor = cursor.parent;
    }
    return '';
};

const resolveMarkerPointIdFromHit = (hit, component) => {
    if (!hit || !component) return '';

    if (component.type === 'PointTypeMarkerManager') {
        return String(
            hit.pointId ||
            findUserDataValue(hit.object, ['__w3dPointTypeMarkerPointId', 'pointId'])
        );
    }

    if (component.type === 'CameraPointManager') {
        return String(
            hit.pointId ||
            findUserDataValue(hit.object, [
                '__w3dCameraPointId',
                (userData) => userData.cameraPoint?.id,
                (userData) => userData.point?.id
            ])
        );
    }

    return '';
};

const resolveMeshNameFromHit = (hit) => {
    const batchMeta = hit?.object?.userData?.__w3dBatchedInstanceMeta;
    if (batchMeta && hit?.batchId !== undefined) {
        const meta = batchMeta.get?.(hit.batchId);
        if (meta?.meshName) {
            return meta.meshName;
        }
    }

    const mergedFaceRanges = hit?.object?.userData?.__w3dMergedFaceRanges;
    if (Array.isArray(mergedFaceRanges) && hit?.faceIndex !== undefined) {
        const faceIndex = Number(hit.faceIndex);
        const meta = mergedFaceRanges.find((item) => faceIndex >= item.faceStart && faceIndex <= item.faceEnd);
        if (meta?.meshName) {
            return meta.meshName;
        }
    }

    let cursor = hit?.object || null;
    while (cursor) {
        const name = String(cursor.name || '');
        if (cursor.isMesh && name && !name.startsWith('Unnamed') && !name.startsWith('__w3d_')) {
            return cursor.name;
        }
        cursor = cursor.parent;
    }
    return '';
};

const resolveMeshIdentityFromHit = (hit) => {
    const batchMeta = hit?.object?.userData?.__w3dBatchedInstanceMeta;
    if (batchMeta && hit?.batchId !== undefined) {
        const meta = batchMeta.get?.(hit.batchId);
        if (meta) {
            return {
                meshName: String(meta.meshName || '').trim(),
                nodePath: String(meta.nodePath || '').trim(),
                rawName: String(meta.rawName || '').trim()
            };
        }
    }

    const mergedFaceRanges = hit?.object?.userData?.__w3dMergedFaceRanges;
    if (Array.isArray(mergedFaceRanges) && hit?.faceIndex !== undefined) {
        const faceIndex = Number(hit.faceIndex);
        const meta = mergedFaceRanges.find((item) => faceIndex >= item.faceStart && faceIndex <= item.faceEnd);
        if (meta) {
            return {
                meshName: String(meta.meshName || '').trim(),
                nodePath: String(meta.nodePath || '').trim(),
                rawName: String(meta.rawName || '').trim()
            };
        }
    }

    const meshName = resolveMeshNameFromHit(hit);
    if (!meshName) return null;

    let cursor = hit?.object || null;
    while (cursor) {
        if (cursor.isMesh && cursor.name === meshName) {
            return getModelHitIdentity(cursor);
        }
        cursor = cursor.parent;
    }
    return null;
};

const getCanvasContextWorldPoint = (event, hit) => {
    if (hit?.point) {
        return [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];
    }
    const scene = sceneStore.sceneInstance;
    const raycaster = scene?.eventSystem?.raycaster;
    const groundPoint = raycaster?.intersectGround?.(event);
    if (!groundPoint) return null;
    return [round4(groundPoint.x), round4(groundPoint.y), round4(groundPoint.z)];
};

const getScenePickHits = (event) => {
    const scene = sceneStore.sceneInstance;
    const raycaster = scene?.eventSystem?.raycaster;
    if (!scene || !raycaster) return [];

    const regularHits = (raycaster.raycast?.(event) || []).filter((hit) => hit?.object && isObjectVisible(hit.object));
    const runtimeHits = [];
    const runtimeHitComponentIds = new Set();

    // English comment.
    const capableIds = componentStore.raycastCapableIds;
    for (const component of componentStore.components || []) {
        if (!capableIds.has(component.id)) continue;
        if (!component?.instance || component.visible === false) {
            continue;
        }

        try {
            const hits = component.instance.raycast(event) || [];
            if (!Array.isArray(hits) || hits.length === 0) continue;

            runtimeHits.push(...hits.filter((hit) => hit?.object && hit?.point));
            runtimeHitComponentIds.add(component.id);
        } catch (error) {
            console.warn('Component raycast failed:', component?.id, error);
        }
    }

    const filteredRegularHits = runtimeHitComponentIds.size > 0
        ? regularHits.filter((hit) => !runtimeHitComponentIds.has(findComponentIdFromObject(hit.object)))
        : regularHits;

    return [...filteredRegularHits, ...runtimeHits]
        .filter((hit) => hit?.object)
        .sort((a, b) => (Number(a?.distance) || Infinity) - (Number(b?.distance) || Infinity));
};

const getStoredMarkerPointId = (componentId) => {
    const selection = componentStore.canvasSubSelection;
    if (selection?.componentId !== componentId || selection?.targetType !== 'marker-point') return '';
    return String(selection.targetId || '');
};

const resolveCanvasContextComponent = (hitComponent, hitMeta = null) => {
    const selected = selectedComponent.value;
    if (
        selected &&
        MARKER_CONTEXT_TYPES.has(selected.type) &&
        (!hitComponent || hitComponent.id === selected.id || isSurfacePickTarget(hitComponent.id, hitMeta))
    ) {
        return selected;
    }

    if (componentHasCanvasContextActions(hitComponent)) return hitComponent;
    if (componentHasCanvasContextActions(selected)) return selected;
    return null;
};

const buildCanvasContext = (event) => {
    const hits = getScenePickHits(event);
    const primaryHit = hits[0] || null;
    const hitComponentId = primaryHit?.object ? findComponentIdFromObject(primaryHit.object) : '';
    const hitMeta = primaryHit?.object ? getPickingMetadataFromObject(primaryHit.object) : null;
    const hitComponent = hitComponentId ? componentStore.getComponentById(hitComponentId) : null;
    const component = resolveCanvasContextComponent(hitComponent, hitMeta);

    if (!component) return null;

    const isHitOnContextComponent = hitComponentId === component.id;
    const pointId = isHitOnContextComponent
        ? resolveMarkerPointIdFromHit(primaryHit, component)
        : getStoredMarkerPointId(component.id);
    const meshName = component.type === 'ModelLoader' && isHitOnContextComponent
        ? resolveMeshNameFromHit(primaryHit)
        : '';

    return {
        componentId: component.id,
        componentType: component.type,
        hitComponentId,
        pointId,
        meshName,
        meshMeta: meshName ? resolveMeshIdentityFromHit(primaryHit) : null,
        worldPoint: getCanvasContextWorldPoint(event, primaryHit),
        clientX: event.clientX,
        clientY: event.clientY
    };
};

const canvasContextComponent = computed(() => {
    const componentId = canvasContextMenu.value.context?.componentId;
    return componentId ? componentStore.getComponentById(componentId) : null;
});

const isCanvasContextComponentLocked = computed(() => (
    isEditMode.value && canvasContextComponent.value?.locked === true
));

const canvasContextTargetPointId = computed(() => {
    const context = canvasContextMenu.value.context;
    if (!context?.componentId) return '';
    return String(context.pointId || getStoredMarkerPointId(context.componentId) || '');
});

const canvasContextMenuItems = computed(() => {
    const context = canvasContextMenu.value.context;
    const component = canvasContextComponent.value;
    if (!context || !component) return [];

    if (component.type === 'ModelLoader') {
        return [
            {
                label: context.meshName
                    ? t('canvas.selectMeshNamed', { name: context.meshName })
                    : t('canvas.selectMesh'),
                action: 'selectMesh',
                disabled: component.visible === false
            }
        ];
    }

    if (MARKER_CONTEXT_TYPES.has(component.type)) {
        return [
            {
                label: t('canvas.quickAddPoint'),
                action: 'quickAddMarkerPoint',
                disabled: isCanvasContextComponentLocked.value || !context.worldPoint
            },
            {
                label: t('canvas.deletePoint'),
                action: 'deleteMarkerPoint',
                disabled: isCanvasContextComponentLocked.value || !canvasContextTargetPointId.value
            }
        ];
    }

    return [];
});

const hideCanvasContextMenu = () => {
    canvasContextMenu.value.visible = false;
};

const handleCanvasContextMenu = (event) => {
    event.preventDefault();
    if (!sceneInitialized.value || sceneLoadingVisible.value) return;
    if (transformControls && isTransformDragging) return;

    const context = buildCanvasContext(event);
    if (!context) {
        hideCanvasContextMenu();
        return;
    }

    const component = componentStore.getComponentById(context.componentId);
    if (!component) {
        hideCanvasContextMenu();
        return;
    }

    canvasContextMenu.value = {
        visible: false,
        x: context.clientX,
        y: context.clientY,
        context
    };
    if (canvasContextMenuItems.value.length === 0) {
        hideCanvasContextMenu();
        return;
    }

    selectComponent(context.componentId);
    if (context.pointId) {
        componentStore.setCanvasSubSelection(context.componentId, 'marker-point', context.pointId, {
            componentType: context.componentType
        });
    } else if (context.meshName) {
        componentStore.setCanvasSubSelection(context.componentId, 'mesh', context.meshName, {
            componentType: context.componentType,
            ...(context.meshMeta || {})
        });
    }

    canvasContextMenu.value = {
        visible: true,
        x: context.clientX,
        y: context.clientY,
        context
    };
};

const selectModelMeshFromContext = (context) => {
    const component = componentStore.getComponentById(context.componentId);
    if (!component || component.type !== 'ModelLoader') return;

    selectComponent(component.id);

    if (context.meshName) {
        componentStore.setCanvasSubSelection(component.id, 'mesh', context.meshName, {
            componentType: component.type,
            ...(context.meshMeta || {})
        });
        componentStore.completeMeshPicking(component.id, context.meshName, 'model-loader-editor', context.meshMeta || {});
        toast.success(t('canvas.meshSelected', { name: context.meshName }));
        return;
    }

    componentStore.startMeshPicking(component.id, 'model-loader-editor');
    toast.info(t('canvas.pickMeshHint'));
};

const quickAddMarkerPointFromContext = async (context) => {
    const component = componentStore.getComponentById(context.componentId);
    if (!component || !MARKER_CONTEXT_TYPES.has(component.type)) return;
    if (isEditMode.value && component.locked) {
        toast.warning(t('canvas.lockedCannotAddPoint'));
        return;
    }
    if (!context.worldPoint) {
        toast.warning(t('canvas.invalidPoint'));
        return;
    }

    const nextPoint = createMarkerPointForComponent(component, context.worldPoint);
    const nextPoints = [...getComponentPoints(component), nextPoint];
    await updateComponentConfig(component.id, { points: nextPoints });
    componentStore.setCanvasSubSelection(component.id, 'marker-point', nextPoint.id, {
        componentType: component.type
    });
    selectComponent(component.id);
    toast.success(t('canvas.pointAdded'));
};

const deleteMarkerPointFromContext = async (context) => {
    const component = componentStore.getComponentById(context.componentId);
    if (!component || !MARKER_CONTEXT_TYPES.has(component.type)) return;
    if (isEditMode.value && component.locked) {
        toast.warning(t('canvas.lockedCannotDeletePoint'));
        return;
    }

    const pointId = canvasContextTargetPointId.value;
    if (!pointId) {
        toast.warning(t('canvas.selectPointFirst'));
        return;
    }

    const points = getComponentPoints(component);
    const nextPoints = points.filter((point) => String(point?.id || '') !== pointId);
    if (nextPoints.length === points.length) {
        toast.warning(t('canvas.pointNotFound'));
        componentStore.clearCanvasSubSelection(component.id);
        return;
    }

    await updateComponentConfig(component.id, { points: nextPoints });
    componentStore.clearCanvasSubSelection(component.id);
    selectComponent(component.id);
    toast.success(t('canvas.pointDeleted'));
};

const handleCanvasContextAction = async (item) => {
    const context = canvasContextMenu.value.context;
    if (!context || !item?.action) return;

    try {
        if (item.action === 'selectMesh') {
            selectModelMeshFromContext(context);
            return;
        }
        if (item.action === 'quickAddMarkerPoint') {
            await quickAddMarkerPointFromContext(context);
            return;
        }
        if (item.action === 'deleteMarkerPoint') {
            await deleteMarkerPointFromContext(context);
        }
    } catch (error) {
        console.error('[CenterCanvas] canvas context action failed:', error);
        toast.error(error?.message || t('canvas.quickActionFailed'));
    }
};

const handleDragEnter = (event) => {
    if (!isSupportedDrag(event)) return;
    event.preventDefault();
    dragOverlayVisible.value = true;
    updateDragOverlay(event);
};

const handleDragOver = (event) => {
    if (!isSupportedDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    // English comment.
};

const handleDragLeave = (event) => {
    // English comment.
    if (!event.currentTarget?.contains(event.relatedTarget)) {
        dragOverlayVisible.value = false;
        dragOverlayText.value = '';
    }
};

const handleDrop = async (event) => {
    if (!isSupportedDrag(event)) return;
    event.preventDefault();

    dragOverlayVisible.value = false;
    const dt = event.dataTransfer;

    const compType = dt.getData('component-type');
    const assetUrl = dt.getData('asset-url');
    const assetType = dt.getData('asset-type');
    const assetFormat = dt.getData('asset-format');
    const shouldUseOriginPosition = isPotentialFileDrag(event) || assetType === 'model';

    let position = [0, 0, 0];
    if (!shouldUseOriginPosition) {
        const point = getDropWorldPoint(event);
        if (!point) {
            toast.warning(t('canvas.sceneNotReadyDrop'));
            return;
        }
        position = [round4(point.x), round4(point.y), round4(point.z)];
    }

    try {
        if (isPotentialFileDrag(event)) {
            const localAsset = await createLocalModelAssetFromDataTransfer(dt);
            if (!localAsset) {
                toast.warning(t('canvas.unsupportedLocalModelFile'));
                return;
            }

            const created = await addComponent('ModelLoader', {
                name: localAsset.name || t('canvas.localModelName'),
                url: localAsset.url,
                format: localAsset.format,
                sourceType: localAsset.sourceType,
                localAssetId: localAsset.assetId,
                localFileName: localAsset.fileName,
                localFileSize: localAsset.fileSize,
                localFileCount: localAsset.fileCount,
                localFileLastModified: localAsset.lastModified,
                sizeMode: 'fit',
                targetSize: 10,
                position
            });

            toast.success(t('canvas.localModelLoaded', {
                name: localAsset.fileName || created?.name || 'ModelLoader'
            }));
            if (!localAsset.persisted) {
                toast.warning('本地模型缓存失败，刷新后可能需要重新选择文件');
            }
            return;
        }

        if (compType) {
            const created = await addComponent(compType, { position });
            toast.success(t('canvas.componentAdded', { name: created?.name || compType }));
            return;
        }

        if (assetUrl) {
            if (assetType === 'model') {
                const created = await addComponent('ModelLoader', {
                    url: assetUrl,
                    ...(assetFormat ? { format: assetFormat } : {}),
                    position
                });
                toast.success(t('canvas.modelAdded', { name: created?.name || 'ModelLoader' }));
                return;
            }

            if (assetType === 'splat') {
                const created = await addComponent('GaussianSplatLoader', {
                    url: assetUrl,
                    ...(assetFormat ? { format: assetFormat } : {}),
                    position,
                    gpuAcceleratedSort: false,
                    sharedMemoryForWorkers: false
                });
                toast.success(t('canvas.splatAdded', { name: created?.name || 'GaussianSplatLoader' }));
                return;
            }

            if (assetType === 'geojson') {
                const created = await addComponent('GeoJSONLoader', {
                    url: assetUrl,
                    sourceType: 'url',
                    data: null,
                    position
                });
                toast.success(t('canvas.dataCityAdded', { name: created?.name || 'GeoJSONLoader' }));
                return;
            }

            if (assetType) {
                toast.warning(t('canvas.unsupportedDropAsset'));
                return;
            }
        }
    } catch (error) {
        console.error('Drop create component failed:', error);
        toast.error(t('canvas.dropCreateFailed', { message: error.message }));
    }
};

const trafficPickBarVisible = computed(() => {
    return !!componentStore.trafficPicking?.active || !!componentStore.trafficPickConfirm?.visible;
});

const trafficPickContext = computed(() => {
    const picking = componentStore.trafficPicking;
    const confirm = componentStore.trafficPickConfirm;

    if (picking?.active) {
        return {
            state: 'picking',
            componentId: picking.componentId,
            deviceId: picking.deviceId
        };
    }

    if (confirm?.visible) {
        return {
            state: 'confirm',
            componentId: confirm.componentId,
            deviceId: confirm.deviceId
        };
    }

    return { state: 'idle', componentId: null, deviceId: null };
});

const trafficPickDeviceName = computed(() => {
    const { componentId, deviceId } = trafficPickContext.value;
    if (!componentId || !deviceId) return '';
    const comp = componentStore.getComponentById(componentId);
    const devices = Array.isArray(comp?.config?.devices) ? comp.config.devices : [];
    const dev = devices.find((d) => d?.id === deviceId);
    return dev?.name || deviceId;
});

const trafficPickBarTitle = computed(() => {
    if (trafficPickContext.value.state === 'picking') {
        return t('canvas.trafficPickingTitle', { name: trafficPickDeviceName.value });
    }
    if (trafficPickContext.value.state === 'confirm') {
        return t('canvas.trafficPickedTitle', { name: trafficPickDeviceName.value });
    }
    return '';
});

const trafficPickBarSub = computed(() => {
    if (trafficPickContext.value.state === 'picking') {
        return t('canvas.trafficPickSurfaceHint');
    }
    if (trafficPickContext.value.state === 'confirm') {
        return t('canvas.trafficPickConfirmHint');
    }
    return '';
});

const trafficPickBarCanRepick = computed(() => {
    return trafficPickContext.value.state === 'confirm';
});

const handleTrafficPickCancel = () => {
    componentStore.stopTrafficPicking();
    componentStore.clearTrafficPickConfirm();
};

const handleTrafficRepick = () => {
    const { componentId, deviceId } = trafficPickContext.value;
    if (!componentId || !deviceId) return;
    componentStore.clearTrafficPickConfirm();
    componentStore.startTrafficPicking(componentId, deviceId);
};

// English comment.
const trajectoryPickBarVisible = computed(() => {
    return !!componentStore.trajectoryPicking?.active;
});

const trajectoryPickComponent = computed(() => {
    const compId = componentStore.trajectoryPicking?.componentId;
    if (!compId) return null;
    return componentStore.getComponentById(compId) || null;
});

const trajectoryPickComponentName = computed(() => {
    return trajectoryPickComponent.value?.name || trajectoryPickComponent.value?.id || '';
});

const trajectoryPickPointCount = computed(() => {
    const points = trajectoryPickComponent.value?.config?.points;
    return Array.isArray(points) ? points.length : 0;
});

const handleTrajectoryPickStop = () => {
    componentStore.stopTrajectoryPicking();
};

const meshPickContext = computed(() => componentStore.meshPicking || { active: false, componentId: null, source: null });

const meshPickBarVisible = computed(() => !!meshPickContext.value?.active);

const meshPickBarTitle = computed(() => {
    const componentId = meshPickContext.value?.componentId;
    const component = componentId ? componentStore.getComponentById(componentId) : null;
    const name = component?.name || componentId || '';
    const prefix = meshPickContext.value?.source === 'event-target'
        ? t('canvas.meshPickEventTarget')
        : t('canvas.meshPickEyedropper');
    return name ? `${prefix}：${name}` : prefix;
});

const meshPickBarSub = computed(() => t('canvas.meshPickSub'));

const handleMeshPickCancel = () => {
    componentStore.stopMeshPicking();
};

// English comment.
const TRANSFORMABLE_TYPES = [
    'ModelLoader',
    'GaussianSplatLoader',
    'Light',
    'Camera',
    'GridHelper',
    'ParticleSystem',
    'FireEffect',
    'AreaBlock',
    'PathAnimation',
    'MultiPathAnimation',
    'TrajectoryMove',
    'MigrationLine',
    'Label3D',
    'MarkArea',
    'MarkLine',
    'MarkPoint',
    'TrafficRoadsideDeviceManager'
];

// English comment.
let transformControls = null;
let isTransformDragging = false;
const TRANSFORM_CONTROLS_NAME = '__editor_transform_controls__';
let canvasEl = null;
let handleCanvasClick = null;
let handleCanvasContextMenuBound = null;

// English comment.
const transformMode = ref('translate');

// English comment.
let lastTime = performance.now();
let frames = 0;

// English comment.
const selectedComponent = computed(() => componentStore.selectedComponent);
const diagnosticsComponents = computed(() => Array.isArray(componentStore.components) ? componentStore.components : []);
const isEditMode = computed(() => editorStore.mode === 'edit');
const isSelectedLocked = computed(() => isEditMode.value && selectedComponent.value?.locked === true);

const collectSceneObjectStats = () => {
    const scene = sceneStore.sceneInstance?.scene;
    if (!scene?.traverse) {
        return {
            objectCount: 0,
            meshCount: 0,
            lightCount: 0
        };
    }

    let objectCount = 0;
    let meshCount = 0;
    let lightCount = 0;

    scene.traverse((object) => {
        objectCount += 1;
        if (object?.isMesh) meshCount += 1;
        if (object?.isLight) lightCount += 1;
    });

    return {
        objectCount,
        meshCount,
        lightCount
    };
};

const updateDiagnosticsSnapshot = () => {
    const rendererInstance = sceneStore.sceneInstance?.renderer?.instance || null;
    const rendererInfo = rendererInstance?.info || null;
    const render = rendererInfo?.render || {};
    const memory = rendererInfo?.memory || {};
    const sceneObjectStats = collectSceneObjectStats();

    diagnosticsStore.updateRenderStats({
        fps: Number(fps.value) || 0,
        drawCalls: Number(render.calls) || 0,
        triangles: Number(render.triangles) || 0,
        points: Number(render.points) || 0,
        lines: Number(render.lines) || 0,
        geometries: Number(memory.geometries) || 0,
        textures: Number(memory.textures) || 0,
        programs: Array.isArray(rendererInfo?.programs) ? rendererInfo.programs.length : 0,
        ...sceneObjectStats
    });

    diagnosticsStore.updateSceneStatus({
        initialized: sceneInitialized.value,
        loading: sceneLoading.value,
        error: sceneError.value,
        componentCount: diagnosticsComponents.value.length,
        selectedComponentId: selectedComponent.value?.id || '',
        selectedComponentName: selectedComponent.value?.name || '',
        activeAlarmCount: alarmStore.activeCount
    });
};

watch(
    () => [
        sceneInitialized.value,
        sceneLoading.value,
        sceneError.value,
        diagnosticsComponents.value.length,
        selectedComponent.value?.id || '',
        selectedComponent.value?.name || '',
        alarmStore.activeCount
    ],
    () => {
        updateDiagnosticsSnapshot();
    },
    { immediate: true }
);

watch(fps, () => {
    updateDiagnosticsSnapshot();
}, { immediate: true });

// English comment.
const isTransformable = computed(() => {
    if (!selectedComponent.value) return false;
    if (selectedComponent.value.type === 'TrafficRoadsideDeviceManager') {
        return componentStore.trafficSelectedDevice?.componentId === selectedComponent.value.id
            && !!componentStore.trafficSelectedDevice?.deviceId;
    }
    return TRANSFORMABLE_TYPES.includes(selectedComponent.value.type);
});

// English comment.
watch(selectedComponent, (newComp, oldComp) => {
    if (!transformControls) return;

    if (newComp && isTransformable.value && !isSelectedLocked.value) {
        attachTransformControls(newComp);
    } else {
        detachTransformControls();
    }
}, { immediate: false });

watch(
    () => [selectedComponent.value?.id, selectedComponent.value?.locked, isTransformable.value, editorStore.mode],
    () => {
        if (!transformControls) return;
        if (selectedComponent.value && isTransformable.value && !isSelectedLocked.value) {
            attachTransformControls(selectedComponent.value);
        } else {
            detachTransformControls();
        }
    }
);

watch(
    () => componentStore.serialVersion,
    () => {
        refreshModelLoadEventBindings();
    },
    { immediate: true }
);

onMounted(async () => {
    await initializeScene();
    refreshModelLoadEventBindings();
});

onUnmounted(() => {
    disposeEditorRuntimes();
    cleanup();
});

/**
 * English comment.
 */
const initializeScene = async () => {
    console.log('[CenterCanvas] ========== 开始初始化场景 ==========');
    console.log('[CenterCanvas] canvasRef.value:', canvasRef.value);

    if (!canvasRef.value) {
        console.error('[CenterCanvas] ❌ Canvas container not found!');
        return;
    }

    // English comment.
    const rect = canvasRef.value.getBoundingClientRect();
    console.log('[CenterCanvas] 容器尺寸:', {
        width: rect.width,
        height: rect.height,
        clientWidth: canvasRef.value.clientWidth,
        clientHeight: canvasRef.value.clientHeight
    });

    if (rect.width === 0 || rect.height === 0) {
        console.error('[CenterCanvas] ❌ 容器尺寸为 0！width:', rect.width, 'height:', rect.height);
    }

    try {
        console.log('[CenterCanvas] 调用 initScene...');
        const scene = await initScene(canvasRef.value);
        console.log('[CenterCanvas] ✅ initScene 完成，scene:', scene);

        // English comment.
        console.log('[CenterCanvas] 场景关键对象检查:', {
            hasScene: !!scene,
            hasRenderer: !!scene?.renderer,
            hasCamera: !!scene?.camera,
            hasControls: !!scene?.controls,
            rendererDomElement: !!scene?.renderer?.getDomElement?.()
        });

        // English comment.
        console.log('[CenterCanvas] 恢复相机视角...');
        restoreCameraView(scene);
        updateDiagnosticsSnapshot();

        // English comment.
        const componentsWithInstance = (componentStore.components || []).filter(c => c?.id && c?.instance);
        console.log('[CenterCanvas] 补充拾取标记，已有实例的组件数:', componentsWithInstance.length);
        componentsWithInstance.forEach((c) => {
            tagInstanceForPicking(c.id, c.instance);
        });

        // English comment.
        canvasEl = scene?.renderer?.getDomElement?.() || null;
        if (canvasEl) {
            handleCanvasClick = async (event) => {
                // English comment.
                if (transformControls && isTransformDragging) return;

                const intersects = getScenePickHits(event);

                // English comment.
                if (componentStore.trajectoryPicking?.active) {
                    const pickCompId = componentStore.trajectoryPicking.componentId;
                    const pickComp = componentStore.getComponentById(pickCompId);

                    if (pickComp && pickComp.type === 'TrajectoryMove') {
                        for (const hit of intersects) {
                            const hitCompId = findComponentIdFromObject(hit.object);

                            // English comment.
                            if (!isSurfacePickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;
                            if (!hit?.point) continue;

                            const nextXyz = [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];

                            // English comment.
                            componentStore.stopTrajectoryPicking();
                            componentStore.requestTrajectoryPickConfirm(pickCompId, nextXyz);
                            selectComponent(pickCompId);
                            return;
                        }
                    }

                    // English comment.
                }

                // English comment.
                if (componentStore.trafficPicking?.active) {
                    const pickCompId = componentStore.trafficPicking.componentId;
                    const pickDeviceId = componentStore.trafficPicking.deviceId;
                    const pickComp = componentStore.getComponentById(pickCompId);

                    if (pickComp && pickComp.type === 'TrafficRoadsideDeviceManager' && pickDeviceId) {
                        for (const hit of intersects) {
                            const hitCompId = findComponentIdFromObject(hit.object);

                            // English comment.
                            if (!isSurfacePickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;
                            if (!hit?.point) continue;

                            const round4 = (n) => Math.round(n * 10000) / 10000;
                            const nextXyz = [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];

                            // English comment.
                            componentStore.stopTrafficPicking();
                            componentStore.requestTrafficPickConfirm(pickCompId, pickDeviceId, nextXyz);
                            componentStore.setTrafficSelectedDevice(pickCompId, pickDeviceId);
                            selectComponent(pickCompId);
                            return;
                        }
                    }

                    // English comment.
                }

                // English comment.
                if (componentStore.buildingPicking?.active) {
                    const pickCompId = componentStore.buildingPicking.componentId;
                    const pickPointId = componentStore.buildingPicking.pointId || null;

                    // English comment.
                    // English comment.
                    const pickComp = componentStore.getComponentById(pickCompId);
                    const isReusablePickType = pickComp && ['BuildingEditor', 'Label3D', 'MigrationLine', 'AreaBlock', 'MultiPathAnimation', 'PointTypeMarkerManager', 'CameraPointManager'].includes(pickComp.type);
                    const isValidPicking = pickCompId === '__building_manager__' || isReusablePickType;

                    if (isValidPicking) {
                        for (const hit of intersects) {
                            const hitCompId = findComponentIdFromObject(hit.object);

                            // English comment.
                            if (!isSurfacePickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;
                            if (!hit?.point) continue;

                            const nextXyz = [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];

                            // English comment.
                            componentStore.stopBuildingPicking();
                            componentStore.requestBuildingPickConfirm(pickCompId, nextXyz, pickPointId);

                            // English comment.
                            if (pickComp) {
                                selectComponent(pickCompId);
                            }
                            return;
                        }
                    }

                    // English comment.
                }

                if (componentStore.meshPicking?.active) {
                    const pickCompId = componentStore.meshPicking.componentId;
                    const pickSource = componentStore.meshPicking.source || 'generic';

                    for (const hit of intersects) {
                        const hitCompId = findComponentIdFromObject(hit.object);
                        if (hitCompId !== pickCompId) continue;
                        if (!isModelLoaderPickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;

                        const meshName = resolveMeshNameFromHit(hit);
                        if (meshName) {
                            const identity = resolveMeshIdentityFromHit(hit);
                            componentStore.completeMeshPicking(pickCompId, meshName, pickSource, identity || {});
                            componentStore.setCanvasSubSelection(pickCompId, 'mesh', meshName, {
                                componentType: 'ModelLoader',
                                ...(identity || {})
                            });
                            selectComponent(pickCompId);
                            return;
                        }
                    }
                }

                for (const hit of intersects) {
                    const componentId = findComponentIdFromObject(hit.object);
                    if (componentId) {
                        const hitComponent = componentStore.getComponentById(componentId);
                        selectComponent(componentId);
                        if (hitComponent && MARKER_CONTEXT_TYPES.has(hitComponent.type)) {
                            const pointId = resolveMarkerPointIdFromHit(hit, hitComponent);
                            if (pointId) {
                                componentStore.setCanvasSubSelection(componentId, 'marker-point', pointId, {
                                    componentType: hitComponent.type
                                });
                            } else {
                                componentStore.clearCanvasSubSelection(componentId);
                            }
                        } else if (hitComponent?.type === 'ModelLoader') {
                            const meshName = resolveMeshNameFromHit(hit);
                            if (meshName) {
                                componentStore.setCanvasSubSelection(componentId, 'mesh', meshName, {
                                    componentType: hitComponent.type,
                                    ...(resolveMeshIdentityFromHit(hit) || {})
                                });
                            } else {
                                componentStore.clearCanvasSubSelection(componentId);
                            }
                        } else {
                            componentStore.clearCanvasSubSelection(componentId);
                        }
                        return;
                    }
                }
                deselectComponent();
            };
            canvasEl.addEventListener('click', handleCanvasClick);
            handleCanvasContextMenuBound = handleCanvasContextMenu;
            canvasEl.addEventListener('contextmenu', handleCanvasContextMenuBound);
        }

        // English comment.
        await initTransformControls(scene);

        // English comment.
        console.log('[CenterCanvas] 设置动画循环...');
        setupAnimationLoop(scene);

        // English comment.
        console.log('[CenterCanvas] 设置相机保存监听...');
        setupCameraSaveListener(scene);

        console.log('[CenterCanvas] ========== ✅ 场景初始化完成 ==========');

        // English comment.
        setTimeout(() => {
            console.log('[CenterCanvas] 延迟检查 - 渲染器状态:', {
                sceneStarted: scene?.isRunning,
                rendererInfo: scene?.renderer?.instance?.info,
                canvasInDOM: document.contains(scene?.renderer?.getDomElement?.())
            });
        }, 1000);
    } catch (error) {
        console.error('[CenterCanvas] ❌ 场景初始化失败:', error);
        console.error('[CenterCanvas] 错误堆栈:', error.stack);
    }
};

/**
 * English comment.
 */
const initTransformControls = async (scene) => {
    if (!scene || !canvasEl) {
        console.warn('Cannot initialize TransformControls: scene or canvas not available');
        return;
    }

    try {
        transformControls = await scene.add('TransformControls', {
            name: TRANSFORM_CONTROLS_NAME,
            mode: transformMode.value,
            size: 1,
            space: 'world',
            disableOrbitOnDrag: true
        });
    } catch (error) {
        console.warn('Failed to create TransformControls component:', error);
        transformControls = null;
        return;
    }

    // English comment.
    try {
        const control = transformControls?.getControl?.();
        const helper = control?.getHelper?.();
        if (helper) {
            if (!helper.userData) helper.userData = {};
            helper.userData.__editorIgnoreRaycast = true;
            helper.traverse?.((o) => {
                if (!o.userData) o.userData = {};
                o.userData.__editorIgnoreRaycast = true;
            });
        }
    } catch {}

    // English comment.
    transformControls.on?.('dragging-changed', ({ dragging }) => {
        isTransformDragging = !!dragging;
    });

    // English comment.
    transformControls.on?.('object-change', () => {
        syncTransformToConfig();
        refreshSelectionHighlight(selectedComponent.value?.id);
    });

    // English comment.
    window.addEventListener('keydown', handleKeyDown);

    console.log(' TransformControls initialized (SDK)');
};

/**
 * English comment.
 */
const attachTransformControls = (component) => {
    if (!transformControls || !component) return;
    if (isEditMode.value && component.locked) {
        detachTransformControls();
        return;
    }

    const instance = component.instance;
    // English comment.
    let root = null;

    if (component.type === 'TrafficRoadsideDeviceManager') {
        const selected = componentStore.trafficSelectedDevice;
        const deviceId = selected?.componentId === component.id ? selected.deviceId : null;
        if (deviceId && typeof instance?.getDeviceObject === 'function') {
            root = instance.getDeviceObject(deviceId);
        }
    }

    if (!root) {
        root = instance?.componentScene || instance?.group || instance?.object3d || instance?.mesh;
    }
    console.log(instance, root);
    if (!root) {
        console.warn('Cannot attach TransformControls: component has no 3D object');
        detachTransformControls();
        return;
    }

    transformControls.attach(root);
    console.log(` TransformControls attached to: ${component.name}`);
};

/**
 * English comment.
 */
const detachTransformControls = () => {
    if (!transformControls) return;
    transformControls.detach();
};

/**
 * English comment.
 */
const syncTransformToConfig = () => {
    const obj = transformControls?.getAttachedObject?.();
    if (!transformControls || !obj) return;

    const comp = selectedComponent.value;
    if (!comp) return;
    if (isEditMode.value && comp.locked) {
        detachTransformControls();
        return;
    }

    // English comment.
    const position = [obj.position.x, obj.position.y, obj.position.z];
    const rotation = comp.type === 'GaussianSplatLoader'
        ? [obj.rotation.x, obj.rotation.y, obj.rotation.z]
        : [
            obj.rotation.x * (180 / Math.PI),
            obj.rotation.y * (180 / Math.PI),
            obj.rotation.z * (180 / Math.PI)
        ];
    const scale = obj.scale.x; // English comment.

    // English comment.
    if (comp.type === 'TrafficRoadsideDeviceManager') {
        const selected = componentStore.trafficSelectedDevice;
        const deviceId = selected?.componentId === comp.id ? selected.deviceId : null;
        const prevDevices = Array.isArray(comp.config?.devices) ? comp.config.devices : [];

        if (deviceId) {
            const round4 = (n) => Math.round(n * 10000) / 10000;
            const roundedPosition = [round4(position[0]), round4(position[1]), round4(position[2])];
            const nextDevices = prevDevices.map((d) => {
                if (d?.id !== deviceId) return d;
                return {
                    ...d,
                    xyz: roundedPosition,
                    rotation,
                    scale
                };
            });

            componentStore.updateComponent(comp.id, {
                config: {
                    ...comp.config,
                    devices: nextDevices
                }
            });
            return;
        }
    }

    // English comment.
    componentStore.updateComponent(comp.id, {
        config: {
            ...comp.config,
            position,
            rotation,
            scale
        }
    });
};

/**
 * English comment.
 */
const handleKeyDown = (event) => {
    if (!transformControls) return;
    if (isSelectedLocked.value && ['w', 'e', 'r'].includes(String(event.key || '').toLowerCase())) return;

    switch (event.key.toLowerCase()) {
        case 'w':
            transformMode.value = 'translate';
            transformControls.setMode('translate');
            break;
        case 'e':
            transformMode.value = 'rotate';
            transformControls.setMode('rotate');
            break;
        case 'r':
            transformMode.value = 'scale';
            transformControls.setMode('scale');
            break;
        case 'escape':
            // English comment.
            if (componentStore.trafficPicking?.active || componentStore.trafficPickConfirm?.visible) {
                handleTrafficPickCancel();
                return;
            }
            if (componentStore.trajectoryPicking?.active) {
                handleTrajectoryPickStop();
                return;
            }
            if (componentStore.meshPicking?.active) {
                handleMeshPickCancel();
                return;
            }
            if (componentStore.buildingPicking?.active || componentStore.buildingPickConfirm?.visible) {
                componentStore.stopBuildingPicking();
                componentStore.clearBuildingPickConfirm();
                return;
            }
            deselectComponent();
            break;
    }
};

/**
 * English comment.
 */
const setupAnimationLoop = (scene) => {
    const originalAnimate = scene.animate.bind(scene);

    scene.animate = function () {
        originalAnimate();

        // English comment.
        frames++;
        const currentTime = performance.now();
        if (currentTime >= lastTime + 1000) {
            fps.value = Math.round((frames * 1000) / (currentTime - lastTime));
            frames = 0;
            lastTime = currentTime;
        }
    };
};

/**
 * English comment.
 */
const retryInit = async () => {
    cleanup();
    await initializeScene();
    refreshModelLoadEventBindings();
};

const disposeEditorRuntimes = () => {
    largeSceneRuntime.disposeLargeSceneRuntime?.();
    alarmRuntime.disposeAlarmRuntime?.();
};

/**
 * English comment.
 */
const cleanup = () => {
    console.log('Cleaning up scene...');

    // English comment.
    window.removeEventListener('keydown', handleKeyDown);

    // English comment.
    isTransformDragging = false;
    if (transformControls) {
        try {
            transformControls.detach?.();
        } catch {}
        try {
            sceneStore.sceneInstance?.remove?.(TRANSFORM_CONTROLS_NAME);
        } catch {}
        transformControls = null;
    }

    if (canvasEl && handleCanvasClick) {
        try {
            canvasEl.removeEventListener('click', handleCanvasClick);
        } catch {}
    }
    if (canvasEl && handleCanvasContextMenuBound) {
        try {
            canvasEl.removeEventListener('contextmenu', handleCanvasContextMenuBound);
        } catch {}
    }
    canvasEl = null;
    handleCanvasClick = null;
    handleCanvasContextMenuBound = null;
    hideCanvasContextMenu();
    clearModelLoadEventBindings();

    disposeScene();
    diagnosticsStore.resetSceneDiagnostics();
};

/**
 * English comment.
 */
const setTransformMode = (mode) => {
    if (!transformControls) return;
    if (isSelectedLocked.value) return;
    transformMode.value = mode;
    transformControls.setMode(mode);
};

/**
 * English comment.
 */
const saveCameraView = (scene) => {
    const cameraConfig = scene?.camera?.getConfig?.();
    const controlsConfig = scene?.controls?.getConfig?.();
    if (!cameraConfig || !controlsConfig) return;

    const cameraView = {
        position: {
            x: cameraConfig.position?.[0] ?? 0,
            y: cameraConfig.position?.[1] ?? 0,
            z: cameraConfig.position?.[2] ?? 0
        },
        target: {
            x: controlsConfig.target?.x ?? 0,
            y: controlsConfig.target?.y ?? 0,
            z: controlsConfig.target?.z ?? 0
        }
    };

    try {
        localStorage.setItem('editor_camera_view', JSON.stringify(cameraView));
    } catch (error) {
        console.warn('[CenterCanvas] 保存相机视角失败:', error);
    }
};

const isFiniteVec3 = (value) => {
    return Array.isArray(value)
        && value.length >= 3
        && value.slice(0, 3).every((n) => Number.isFinite(Number(n)));
};

const getCameraViewFromSettings = () => {
    const camera = sceneStore.sceneConfig?.camera || {};
    const position = camera.position;
    const lookAt = camera.lookAt;

    if (!isFiniteVec3(position) || !isFiniteVec3(lookAt)) {
        return null;
    }

    return {
        position: {
            x: Number(position[0]),
            y: Number(position[1]),
            z: Number(position[2])
        },
        target: {
            x: Number(lookAt[0]),
            y: Number(lookAt[1]),
            z: Number(lookAt[2])
        }
    };
};

/**
 * English comment.
 */
const restoreCameraView = (scene) => {
    if (!scene?.camera?.updateConfig || !scene?.controls?.updateConfig) {
        console.warn('[CenterCanvas] 无法恢复相机视角：相机或控制器未初始化');
        return;
    }

    try {
        const settingsView = getCameraViewFromSettings();
        let cameraView = settingsView;

        // English comment.
        if (!cameraView) {
            const savedView = localStorage.getItem('editor_camera_view');
            if (!savedView) {
                console.log('[CenterCanvas] 未找到可用相机视角，使用默认视角');
                return;
            }
            cameraView = JSON.parse(savedView);
        }

        // English comment.
        if (cameraView.position) {
            scene.camera.updateConfig({
                position: [cameraView.position.x, cameraView.position.y, cameraView.position.z]
            });
        }

        // English comment.
        if (cameraView.target) {
            const target = {
                x: cameraView.target.x,
                y: cameraView.target.y,
                z: cameraView.target.z
            };
            scene.controls.updateConfig({ target });
            scene.camera.updateConfig({
                lookAt: [target.x, target.y, target.z]
            });
        }

        console.log('[CenterCanvas] 相机视角已恢复（优先设置面板）:', cameraView);
    } catch (error) {
        console.warn('[CenterCanvas] 恢复相机视角失败:', error);
    }
};

/**
 * English comment.
 */
let cameraSaveTimeout = null;
const setupCameraSaveListener = (scene) => {
    if (!scene?.controls?.addEventListener) return;

    // English comment.
    const handleControlsChange = () => {
        // English comment.
        if (cameraSaveTimeout) {
            clearTimeout(cameraSaveTimeout);
        }

        cameraSaveTimeout = setTimeout(() => {
            saveCameraView(scene);
        }, 500); // English comment.
    };

    scene.controls.addEventListener('change', handleControlsChange);

    console.log('[CenterCanvas]  相机视角自动保存已启用');
};

// English comment.
defineExpose({
    transformMode,
    setTransformMode
});
</script>

<style scoped>
.traffic-pick-bar {
    position: absolute;
    left: 50%;
    top: 16px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border-radius: 8px;
    background: rgba(8, 15, 26, 0.82);
    border: 1px solid rgba(118, 144, 180, 0.18);
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(14px);
    z-index: 20;
    max-width: 70%;
}

.traffic-pick-bar__text {
    min-width: 0;
}

.traffic-pick-bar__title {
    font-size: 12px;
    color: var(--color-text-primary);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.traffic-pick-bar__sub {
    font-size: 11px;
    color: var(--color-text-tertiary);
    line-height: 1.2;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.traffic-pick-bar__actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
</style>

<style scoped>
.center-canvas {
    position: relative;
    background:
        linear-gradient(180deg, rgba(17, 30, 54, 0.96) 0%, rgba(7, 13, 23, 0.98) 100%);
}

.center-canvas::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(circle at 50% 35%, rgba(57, 105, 185, 0.18), transparent 34%),
        linear-gradient(180deg, rgba(6, 11, 18, 0) 0%, rgba(6, 11, 18, 0.28) 100%);
    z-index: 1;
}

.center-canvas > :not(.drag-overlay):not(.traffic-pick-bar):not(.alarm-screen-flash):not(.alarm-runtime-modal):not(.canvas-loading-overlay):not(.transform-toolbar):not(.canvas-status-chip):not(.absolute) {
    position: relative;
    z-index: 0;
}

.center-canvas.is-drag-over {
    outline: 1px dashed var(--color-border-hover);
    outline-offset: -2px;
}

.drag-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(8, 15, 26, 0.72);
    backdrop-filter: blur(4px);
    z-index: 20;
    pointer-events: none;
}

.drag-overlay__title {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.drag-overlay__sub {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    max-width: 80%;
    word-break: break-all;
    text-align: center;
}

.canvas-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 15, 26, 0.72);
    backdrop-filter: blur(4px);
}

.canvas-loading-content {
    min-width: 180px;
    padding: 16px 18px;
    border-radius: 8px;
    border: 1px solid rgba(118, 144, 180, 0.18);
    background:
        linear-gradient(180deg, rgba(18, 30, 48, 0.94) 0%, rgba(8, 15, 26, 0.94) 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.canvas-loading-title {
    color: #eef3f8;
    font-size: 13px;
    line-height: 1;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top: 4px solid #4ea1ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.loading-dots {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 20px;
}

.loading-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6bb3ff;
    animation: dots-bounce 1s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
    animation-delay: 0.15s;
}

.loading-dots span:nth-child(3) {
    animation-delay: 0.3s;
}

.loading-pulse {
    display: inline-flex;
    align-items: flex-end;
    gap: 4px;
    height: 24px;
}

.loading-pulse span {
    width: 5px;
    border-radius: 999px;
    background: #7ab9ff;
    animation: pulse-bar 0.9s ease-in-out infinite;
}

.loading-pulse span:nth-child(1) { animation-delay: 0s; }
.loading-pulse span:nth-child(2) { animation-delay: 0.1s; }
.loading-pulse span:nth-child(3) { animation-delay: 0.2s; }
.loading-pulse span:nth-child(4) { animation-delay: 0.3s; }

.alarm-screen-flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 18;
    background: var(--alarm-flash-color, rgba(239, 68, 68, 0.25));
    opacity: var(--alarm-flash-opacity, 0.2);
    animation: alarm-screen-flash-pulse var(--alarm-flash-duration, 1200ms) ease-in-out infinite;
}

.alarm-runtime-modal {
    position: absolute;
    inset: 0;
    z-index: 24;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

.alarm-runtime-modal__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(7, 10, 16, 0.56);
    backdrop-filter: blur(4px);
}

.alarm-runtime-modal__panel {
    position: relative;
    width: min(520px, 100%);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(180deg, rgba(32, 38, 52, 0.96) 0%, rgba(20, 24, 34, 0.98) 100%);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    overflow: hidden;
}

.alarm-runtime-modal__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.alarm-runtime-modal__eyebrow {
    font-size: 11px;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.52);
    margin-bottom: 8px;
}

.alarm-runtime-modal__title {
    color: #f5f7fb;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
}

.alarm-runtime-modal__close {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.72);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
}

.alarm-runtime-modal__close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.alarm-runtime-modal__body {
    padding: 18px 20px 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.alarm-runtime-modal__message {
    color: rgba(255, 255, 255, 0.92);
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
}

.alarm-runtime-modal__severity {
    display: inline-flex;
    align-self: flex-start;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 208, 117, 0.12);
    color: #ffd075;
    font-size: 12px;
    line-height: 1;
}

.alarm-runtime-modal__footer {
    display: flex;
    justify-content: flex-end;
    padding: 16px 20px 20px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

@keyframes dots-bounce {
    0%, 80%, 100% {
        transform: translateY(0);
        opacity: 0.45;
    }
    40% {
        transform: translateY(-4px);
        opacity: 1;
    }
}

@keyframes pulse-bar {
    0%, 100% {
        height: 8px;
        opacity: 0.45;
    }
    50% {
        height: 22px;
        opacity: 1;
    }
}

@keyframes alarm-screen-flash-pulse {
    0%, 100% {
        opacity: 0;
    }
    30% {
        opacity: var(--alarm-flash-opacity, 0.2);
    }
    60% {
        opacity: calc(var(--alarm-flash-opacity, 0.2) * 0.45);
    }
}

/* English comment. */
.transform-toolbar {
    position: absolute;
    top: 132px;
    right: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(8, 15, 26, 0.72);
    padding: 7px;
    border: 1px solid rgba(118, 144, 180, 0.17);
    border-radius: 8px;
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26);
    backdrop-filter: blur(14px);
    z-index: 10;
}

.transform-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
    color: rgba(226, 232, 240, 0.82);
    font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.transform-btn__icon {
    font-size: 1.125rem;
    line-height: 1;
}

.transform-btn:hover {
    background: rgba(125, 183, 255, 0.1);
    border-color: rgba(125, 183, 255, 0.22);
    color: #ffffff;
}

.transform-btn.active {
    background: rgba(47, 125, 244, 0.22);
    border-color: rgba(47, 125, 244, 0.5);
    color: #9ec7ff;
    box-shadow: inset 0 0 0 1px rgba(47, 125, 244, 0.18);
}

.transform-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.transform-btn:disabled:hover {
    background: transparent;
}

.canvas-status-chip {
    position: absolute;
    top: 18px;
    left: 18px;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 8px 10px;
    border: 1px solid rgba(118, 144, 180, 0.16);
    border-radius: 8px;
    background: rgba(8, 15, 26, 0.64);
    color: rgba(226, 232, 240, 0.82);
    font-size: var(--font-size-xs);
    line-height: 1;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(12px);
}

.canvas-status-chip span + span {
    padding-left: var(--space-2);
    border-left: 1px solid rgba(148, 163, 184, 0.16);
}
</style>

