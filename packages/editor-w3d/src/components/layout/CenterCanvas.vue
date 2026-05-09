<template>
    <div
        class="center-canvas canvas-container"
        :class="{ 'is-drag-over': dragOverlayVisible }"
        @dragenter="handleDragEnter"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
    >
        <!-- 3D 场景容器 -->
        <div ref="canvasRef" class="w-full h-full"></div>

        <!-- 拖拽覆盖层（最小视觉反馈） -->
        <div v-if="dragOverlayVisible" class="drag-overlay">
            <div class="drag-overlay__title">释放以添加</div>
            <div class="drag-overlay__sub">{{ dragOverlayText }}</div>
        </div>

        <!-- 路侧设备：拾取状态浮条（拾取中/等待确认） -->
        <div v-if="trafficPickBarVisible" class="traffic-pick-bar">
            <div class="traffic-pick-bar__text">
                <div class="traffic-pick-bar__title">{{ trafficPickBarTitle }}</div>
                <div class="traffic-pick-bar__sub">{{ trafficPickBarSub }}</div>
            </div>
            <div class="traffic-pick-bar__actions">
                <Button size="sm" variant="outline" @click="handleTrafficPickCancel">取消</Button>
                <Button
                    v-if="trafficPickBarCanRepick"
                    size="sm"
                    variant="primary"
                    @click="handleTrafficRepick"
                >
                    重新拾取
                </Button>
            </div>
        </div>

        <!-- 轨迹移动：拾取路线点位浮条 -->
        <div v-if="trajectoryPickBarVisible" class="traffic-pick-bar">
            <div class="traffic-pick-bar__text">
                <div class="traffic-pick-bar__title">轨迹拾取中：{{ trajectoryPickComponentName }}</div>
                <div class="traffic-pick-bar__sub">点击场景取点（Esc 可取消），已添加 {{ trajectoryPickPointCount }} 个点</div>
            </div>
            <div class="traffic-pick-bar__actions">
                <Button size="sm" variant="outline" @click="handleTrajectoryPickStop">结束</Button>
            </div>
        </div>

        <div v-if="meshPickBarVisible" class="traffic-pick-bar">
            <div class="traffic-pick-bar__text">
                <div class="traffic-pick-bar__title">{{ meshPickBarTitle }}</div>
                <div class="traffic-pick-bar__sub">{{ meshPickBarSub }}</div>
            </div>
            <div class="traffic-pick-bar__actions">
                <Button size="sm" variant="outline" @click="handleMeshPickCancel">取消</Button>
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
                        <div class="alarm-runtime-modal__eyebrow">告警提示</div>
                        <div class="alarm-runtime-modal__title">{{ alarmModalState.title }}</div>
                    </div>
                    <button class="alarm-runtime-modal__close" type="button" @click="closeAlarmModal">×</button>
                </div>
                <div class="alarm-runtime-modal__body">
                    <div class="alarm-runtime-modal__message">{{ alarmModalState.message }}</div>
                    <div v-if="alarmModalState.severity" class="alarm-runtime-modal__severity">
                        等级：{{ alarmModalState.severity }}
                    </div>
                </div>
                <div class="alarm-runtime-modal__footer">
                    <Button size="sm" variant="outline" @click="closeAlarmModal">关闭</Button>
                </div>
            </div>
        </div>

        <!-- 加载提示 -->
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

        <!-- 错误提示 -->
        <div
            v-if="sceneError"
            class="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-90 z-10"
        >
            <div class="text-center">
                <div class="text-6xl mb-4"></div>
                <div class="text-lg font-medium text-red-700 mb-2">场景初始化失败</div>
                <div class="text-sm text-red-600">{{ sceneError }}</div>
                <button
                    class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    @click="retryInit"
                >
                    重试
                </button>
            </div>
        </div>

        <!-- 变换工具栏 -->
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
                title="移动 (W)"
                aria-label="移动 (W)"
            >
                <i class="sico icon-move transform-btn__icon" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="transform-btn"
                :class="{ active: transformMode === 'rotate' }"
                :disabled="isSelectedLocked"
                @click="setTransformMode('rotate')"
                title="旋转 (E)"
                aria-label="旋转 (E)"
            >
                <i class="sico icon-yulanxuanzhuan transform-btn__icon" aria-hidden="true"></i>
            </button>
            <button
                type="button"
                class="transform-btn"
                :class="{ active: transformMode === 'scale' }"
                :disabled="isSelectedLocked"
                @click="setTransformMode('scale')"
                title="缩放 (R)"
                aria-label="缩放 (R)"
            >
                <i class="sico icon-iconset0442 transform-btn__icon" aria-hidden="true"></i>
            </button>
        </div>

        <!-- 场景信息显示 -->
        <div
            v-if="sceneInitialized && !canvasLoadingVisible"
            class="canvas-status-chip"
        >
            <span>FPS {{ fps }}</span>
            <span>组件 {{ components.length }}</span>
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

const canvasRef = ref(null);
const fps = ref(60);
const DEFAULT_SCENE_STATE = Object.freeze({
    initialized: false,
    loading: false,
    error: null
});

// 使用场景管理
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

// 使用组件管理
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
        name: component.name || component.config?.name || '模型',
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
        name: component.name || component.config?.name || '模型'
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
                name: component.name || component.config?.name || '模型'
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
    if (sceneLoadingVisible.value) return '场景加载中...';

    const state = modelLoadingState.value;
    const progress = normalizeLoadProgress(state.progress);
    const progressText = progress > 0 && progress < 1 ? ` ${Math.round(progress * 100)}%` : '';

    if (state.count > 1) {
        return `模型加载中（${state.count} 个）...${progressText}`;
    }

    return `${state.name || '模型'} 加载中...${progressText}`;
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

// ===== 拖拽创建组件（组件库/资源库 -> 画布） =====
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
                ? `本地模型文件（${count} 个文件）`
                : '本地模型文件';
        } else {
            dragOverlayText.value = '释放后检测模型文件（GLB / GLTF / FBX）';
        }
        return;
    }

    if (compType) {
        dragOverlayText.value = compName ? `${compName}（${compType}）` : compType;
        return;
    }
    if (assetUrl) {
        dragOverlayText.value = assetType === 'model'
            ? `模型：${assetUrl}`
            : assetType === 'splat'
                ? `泼溅：${assetUrl}`
                : assetType === 'geojson'
                    ? `GeoJSON：${assetUrl}`
                : `资源：${assetUrl}`;
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

    // 先尝试命中场景物体表面
    const intersects = getScenePickHits(event);
    if (intersects.length > 0 && intersects[0]?.point) {
        return intersects[0].point;
    }

    // 空白区域：回落到 y=0 平面（SDK Raycaster 内部实现）
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

    // 仅遍历已标记具有自定义 raycast 能力的组件（由 store 维护缓存）
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
                label: context.meshName ? `选择 Mesh：${context.meshName}` : '选择 Mesh',
                action: 'selectMesh',
                disabled: component.visible === false
            }
        ];
    }

    if (MARKER_CONTEXT_TYPES.has(component.type)) {
        return [
            {
                label: '快速添加点位',
                action: 'quickAddMarkerPoint',
                disabled: isCanvasContextComponentLocked.value || !context.worldPoint
            },
            {
                label: '删除点位',
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
        toast.success(`已选择 Mesh：${context.meshName}`);
        return;
    }

    componentStore.startMeshPicking(component.id, 'model-loader-editor');
    toast.info('请点击场景中的模型 Mesh 进行选择');
};

const quickAddMarkerPointFromContext = async (context) => {
    const component = componentStore.getComponentById(context.componentId);
    if (!component || !MARKER_CONTEXT_TYPES.has(component.type)) return;
    if (isEditMode.value && component.locked) {
        toast.warning('组件已锁定，无法新增点位');
        return;
    }
    if (!context.worldPoint) {
        toast.warning('未获取到有效坐标，无法新增点位');
        return;
    }

    const nextPoint = createMarkerPointForComponent(component, context.worldPoint);
    const nextPoints = [...getComponentPoints(component), nextPoint];
    await updateComponentConfig(component.id, { points: nextPoints });
    componentStore.setCanvasSubSelection(component.id, 'marker-point', nextPoint.id, {
        componentType: component.type
    });
    selectComponent(component.id);
    toast.success('已新增点位');
};

const deleteMarkerPointFromContext = async (context) => {
    const component = componentStore.getComponentById(context.componentId);
    if (!component || !MARKER_CONTEXT_TYPES.has(component.type)) return;
    if (isEditMode.value && component.locked) {
        toast.warning('组件已锁定，无法删除点位');
        return;
    }

    const pointId = canvasContextTargetPointId.value;
    if (!pointId) {
        toast.warning('请先右键命中或选中一个点位');
        return;
    }

    const points = getComponentPoints(component);
    const nextPoints = points.filter((point) => String(point?.id || '') !== pointId);
    if (nextPoints.length === points.length) {
        toast.warning('点位不存在或已被删除');
        componentStore.clearCanvasSubSelection(component.id);
        return;
    }

    await updateComponentConfig(component.id, { points: nextPoints });
    componentStore.clearCanvasSubSelection(component.id);
    selectComponent(component.id);
    toast.success('已删除点位');
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
        toast.error(error?.message || '快捷操作失败');
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
    // dragenter 已设置 overlay，这里只需 preventDefault 即可
};

const handleDragLeave = (event) => {
    // 仅当真正离开画布容器时关闭（避免子元素触发抖动）
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
            toast.warning('场景未初始化，无法在画布中放置组件');
            return;
        }
        position = [round4(point.x), round4(point.y), round4(point.z)];
    }

    try {
        if (isPotentialFileDrag(event)) {
            const localAsset = createLocalModelAssetFromDataTransfer(dt);
            if (!localAsset) {
                toast.warning('请拖入 .glb、.gltf 或 .fbx 模型文件');
                return;
            }

            const created = await addComponent('ModelLoader', {
                name: localAsset.name || '本地模型',
                url: localAsset.url,
                format: localAsset.format,
                sourceType: localAsset.sourceType,
                localFileName: localAsset.fileName,
                localFileSize: localAsset.fileSize,
                localFileCount: localAsset.fileCount,
                localFileLastModified: localAsset.lastModified,
                sizeMode: 'fit',
                targetSize: 10,
                position
            });

            toast.success(`已加载本地模型：${localAsset.fileName || created?.name || 'ModelLoader'}`);
            return;
        }

        if (compType) {
            const created = await addComponent(compType, { position });
            toast.success(`已添加组件：${created?.name || compType}`);
            return;
        }

        if (assetUrl) {
            if (assetType === 'model') {
                const created = await addComponent('ModelLoader', {
                    url: assetUrl,
                    ...(assetFormat ? { format: assetFormat } : {}),
                    position
                });
                toast.success(`已添加模型：${created?.name || 'ModelLoader'}`);
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
                toast.success(`已添加高斯泼溅：${created?.name || 'GaussianSplatLoader'}`);
                return;
            }

            if (assetType === 'geojson') {
                const created = await addComponent('GeoJSONLoader', {
                    url: assetUrl,
                    sourceType: 'url',
                    data: null,
                    position
                });
                toast.success(`已添加数据城市：${created?.name || 'GeoJSONLoader'}`);
                return;
            }

            if (assetType) {
                toast.warning('仅支持拖拽“模型”“泼溅”或“GeoJSON”资源到画布');
                return;
            }
        }
    } catch (error) {
        console.error('Drop create component failed:', error);
        toast.error(`拖拽创建失败: ${error.message}`);
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
        return `拾取中：${trafficPickDeviceName.value}`;
    }
    if (trafficPickContext.value.state === 'confirm') {
        return `已拾取：${trafficPickDeviceName.value}`;
    }
    return '';
});

const trafficPickBarSub = computed(() => {
    if (trafficPickContext.value.state === 'picking') {
        return '点击模型或高斯泼溅表面取点（Esc 可取消）';
    }
    if (trafficPickContext.value.state === 'confirm') {
        return '等待确认写入坐标（可重新拾取）';
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

// ===== 轨迹移动：拾取路线点位（编辑器态） =====
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
    const prefix = meshPickContext.value?.source === 'event-target' ? '事件目标拾取中' : '吸管拾取中';
    return name ? `${prefix}：${name}` : prefix;
});

const meshPickBarSub = computed(() => '点击场景中的模型 Mesh 进行选择（Esc 可取消）');

const handleMeshPickCancel = () => {
    componentStore.stopMeshPicking();
};

// 支持变换操作的组件类型
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

// TransformControls 实例
let transformControls = null;
let isTransformDragging = false;
const TRANSFORM_CONTROLS_NAME = '__editor_transform_controls__';
let canvasEl = null;
let handleCanvasClick = null;
let handleCanvasContextMenuBound = null;

// 当前变换模式: 'translate' | 'rotate' | 'scale'
const transformMode = ref('translate');

// FPS 计算
let lastTime = performance.now();
let frames = 0;

// 计算当前选中的组件
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

// 判断当前选中组件是否支持变换
const isTransformable = computed(() => {
    if (!selectedComponent.value) return false;
    if (selectedComponent.value.type === 'TrafficRoadsideDeviceManager') {
        return componentStore.trafficSelectedDevice?.componentId === selectedComponent.value.id
            && !!componentStore.trafficSelectedDevice?.deviceId;
    }
    return TRANSFORMABLE_TYPES.includes(selectedComponent.value.type);
});

// 监听选中组件变化，更新 TransformControls
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
 * 初始化场景
 */
const initializeScene = async () => {
    console.log('[CenterCanvas] ========== 开始初始化场景 ==========');
    console.log('[CenterCanvas] canvasRef.value:', canvasRef.value);

    if (!canvasRef.value) {
        console.error('[CenterCanvas] ❌ Canvas container not found!');
        return;
    }

    // 检查容器尺寸
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

        // 检查场景关键对象
        console.log('[CenterCanvas] 场景关键对象检查:', {
            hasScene: !!scene,
            hasRenderer: !!scene?.renderer,
            hasCamera: !!scene?.camera,
            hasControls: !!scene?.controls,
            rendererDomElement: !!scene?.renderer?.getDomElement?.()
        });

        // 恢复上次保存的相机视角
        console.log('[CenterCanvas] 恢复相机视角...');
        restoreCameraView(scene);
        updateDiagnosticsSnapshot();

        // 兼容：对已存在的实例补打拾取标记（避免热更新/旧项目加载后无法拾取）
        const componentsWithInstance = (componentStore.components || []).filter(c => c?.id && c?.instance);
        console.log('[CenterCanvas] 补充拾取标记，已有实例的组件数:', componentsWithInstance.length);
        componentsWithInstance.forEach((c) => {
            tagInstanceForPicking(c.id, c.instance);
        });

        // 点击画布拾取选中
        canvasEl = scene?.renderer?.getDomElement?.() || null;
        if (canvasEl) {
            handleCanvasClick = async (event) => {
                // 如果正在拖拽 TransformControls，不触发选择
                if (transformControls && isTransformDragging) return;

                const intersects = getScenePickHits(event);

                // 轨迹移动：拾取路线点位（优先处理，从 ModelLoader 模型表面取点）
                if (componentStore.trajectoryPicking?.active) {
                    const pickCompId = componentStore.trajectoryPicking.componentId;
                    const pickComp = componentStore.getComponentById(pickCompId);

                    if (pickComp && pickComp.type === 'TrajectoryMove') {
                        for (const hit of intersects) {
                            const hitCompId = findComponentIdFromObject(hit.object);

                            // 允许从模型或高斯泼溅表面近似取点
                            if (!isSurfacePickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;
                            if (!hit?.point) continue;

                            const nextXyz = [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];

                            // 拾取结束后弹出确认框
                            componentStore.stopTrajectoryPicking();
                            componentStore.requestTrajectoryPickConfirm(pickCompId, nextXyz);
                            selectComponent(pickCompId);
                            return;
                        }
                    }

                    // 没拾取到有效点则继续走普通选择逻辑
                }

                // 路侧设备：拾取坐标模式（优先处理，不改变组件选中逻辑）
                if (componentStore.trafficPicking?.active) {
                    const pickCompId = componentStore.trafficPicking.componentId;
                    const pickDeviceId = componentStore.trafficPicking.deviceId;
                    const pickComp = componentStore.getComponentById(pickCompId);

                    if (pickComp && pickComp.type === 'TrafficRoadsideDeviceManager' && pickDeviceId) {
                        for (const hit of intersects) {
                            const hitCompId = findComponentIdFromObject(hit.object);

                            // 允许从模型或高斯泼溅表面近似取点
                            if (!isSurfacePickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;
                            if (!hit?.point) continue;

                            const round4 = (n) => Math.round(n * 10000) / 10000;
                            const nextXyz = [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];

                            // 拾取结束先弹确认框，确认后再写回 xyz
                            componentStore.stopTrafficPicking();
                            componentStore.requestTrafficPickConfirm(pickCompId, pickDeviceId, nextXyz);
                            componentStore.setTrafficSelectedDevice(pickCompId, pickDeviceId);
                            selectComponent(pickCompId);
                            return;
                        }
                    }

                    // 没拾取到有效点则继续走普通选择逻辑
                }

                // 点位管理器：拾取点位（优先处理，从 ModelLoader 模型表面取点）
                if (componentStore.buildingPicking?.active) {
                    const pickCompId = componentStore.buildingPicking.componentId;
                    const pickPointId = componentStore.buildingPicking.pointId || null;

                    // 支持固定标识符 '__building_manager__'（新的纯数据管理模式）
                    // 以及可复用该链路的组件（如 BuildingEditor / Label3D / MigrationLine / AreaBlock）
                    const pickComp = componentStore.getComponentById(pickCompId);
                    const isReusablePickType = pickComp && ['BuildingEditor', 'Label3D', 'MigrationLine', 'AreaBlock', 'MultiPathAnimation', 'PointTypeMarkerManager', 'CameraPointManager'].includes(pickComp.type);
                    const isValidPicking = pickCompId === '__building_manager__' || isReusablePickType;

                    if (isValidPicking) {
                        for (const hit of intersects) {
                            const hitCompId = findComponentIdFromObject(hit.object);

                            // 允许从模型或高斯泼溅表面近似取点
                            if (!isSurfacePickTarget(hitCompId, getPickingMetadataFromObject(hit.object))) continue;
                            if (!hit?.point) continue;

                            const nextXyz = [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)];

                            // 拾取结束后弹出确认框
                            componentStore.stopBuildingPicking();
                            componentStore.requestBuildingPickConfirm(pickCompId, nextXyz, pickPointId);

                            // 只有在是真实组件时才选中
                            if (pickComp) {
                                selectComponent(pickCompId);
                            }
                            return;
                        }
                    }

                    // 没拾取到有效点则继续走普通选择逻辑
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

        // 初始化 TransformControls
        await initTransformControls(scene);

        // 设置动画循环
        console.log('[CenterCanvas] 设置动画循环...');
        setupAnimationLoop(scene);

        // 监听相机变化，自动保存视角
        console.log('[CenterCanvas] 设置相机保存监听...');
        setupCameraSaveListener(scene);

        console.log('[CenterCanvas] ========== ✅ 场景初始化完成 ==========');

        // 最终检查：确认渲染器已启动
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
 * 初始化 TransformControls
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

    // 避免 gizmo 参与拾取
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

    // 监听拖拽状态
    transformControls.on?.('dragging-changed', ({ dragging }) => {
        isTransformDragging = !!dragging;
    });

    // 监听变换改变事件，更新组件配置
    transformControls.on?.('object-change', () => {
        syncTransformToConfig();
        refreshSelectionHighlight(selectedComponent.value?.id);
    });

    // 监听键盘事件切换模式
    window.addEventListener('keydown', handleKeyDown);

    console.log(' TransformControls initialized (SDK)');
};

/**
 * 将 TransformControls 附加到组件
 */
const attachTransformControls = (component) => {
    if (!transformControls || !component) return;
    if (isEditMode.value && component.locked) {
        detachTransformControls();
        return;
    }

    const instance = component.instance;
    // 获取组件的 3D 对象根节点
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
 * 从组件分离 TransformControls
 */
const detachTransformControls = () => {
    if (!transformControls) return;
    transformControls.detach();
};

/**
 * 同步变换到组件配置
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

    // 获取位置、旋转、缩放
    const position = [obj.position.x, obj.position.y, obj.position.z];
    const rotation = comp.type === 'GaussianSplatLoader'
        ? [obj.rotation.x, obj.rotation.y, obj.rotation.z]
        : [
            obj.rotation.x * (180 / Math.PI),
            obj.rotation.y * (180 / Math.PI),
            obj.rotation.z * (180 / Math.PI)
        ];
    const scale = obj.scale.x; // 假设统一缩放

    // 路侧设备：写回到选中 device
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

    // 默认：更新组件自身 position/rotation/scale（只更新 store，不重建实例）
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
 * 处理键盘事件
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
            // 优先取消路侧设备拾取/确认
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
 * 设置动画循环
 */
const setupAnimationLoop = (scene) => {
    const originalAnimate = scene.animate.bind(scene);

    scene.animate = function () {
        originalAnimate();

        // 计算 FPS
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
 * 重试初始化
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
 * 清理资源
 */
const cleanup = () => {
    console.log('Cleaning up scene...');

    // 清理键盘事件监听
    window.removeEventListener('keydown', handleKeyDown);

    // 清理 TransformControls
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
 * 设置变换模式
 */
const setTransformMode = (mode) => {
    if (!transformControls) return;
    if (isSelectedLocked.value) return;
    transformMode.value = mode;
    transformControls.setMode(mode);
};

/**
 * 保存相机视角到 localStorage
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
 * 从 localStorage 恢复相机视角
 */
const restoreCameraView = (scene) => {
    if (!scene?.camera?.updateConfig || !scene?.controls?.updateConfig) {
        console.warn('[CenterCanvas] 无法恢复相机视角：相机或控制器未初始化');
        return;
    }

    try {
        const settingsView = getCameraViewFromSettings();
        let cameraView = settingsView;

        // 兜底：若设置中没有有效相机参数，再尝试历史 localStorage
        if (!cameraView) {
            const savedView = localStorage.getItem('editor_camera_view');
            if (!savedView) {
                console.log('[CenterCanvas] 未找到可用相机视角，使用默认视角');
                return;
            }
            cameraView = JSON.parse(savedView);
        }

        // 恢复相机位置
        if (cameraView.position) {
            scene.camera.updateConfig({
                position: [cameraView.position.x, cameraView.position.y, cameraView.position.z]
            });
        }

        // 恢复控制器目标点（同时同步到 camera.lookAt）
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
 * 监听相机变化并自动保存
 */
let cameraSaveTimeout = null;
const setupCameraSaveListener = (scene) => {
    if (!scene?.controls?.addEventListener) return;

    // 监听控制器变化事件（OrbitControls 的 'change' 事件）
    const handleControlsChange = () => {
        // 使用防抖，避免频繁保存
        if (cameraSaveTimeout) {
            clearTimeout(cameraSaveTimeout);
        }

        cameraSaveTimeout = setTimeout(() => {
            saveCameraView(scene);
        }, 500); // 500ms 防抖
    };

    scene.controls.addEventListener('change', handleControlsChange);

    console.log('[CenterCanvas]  相机视角自动保存已启用');
};

// 暴露方法给父组件使用
defineExpose({
    transformMode,
    setTransformMode
});
</script>

<style scoped>
.traffic-pick-bar {
    position: absolute;
    left: 50%;
    top: 12px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
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
    background: #080d15;
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
    background: rgba(8, 13, 21, 0.72);
    backdrop-filter: blur(2px);
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
    background: rgba(16, 20, 26, 0.72);
    backdrop-filter: blur(2px);
}

.canvas-loading-content {
    min-width: 180px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(20, 26, 34, 0.92);
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

/* 变换工具栏样式 */
.transform-toolbar {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: row;
    gap: var(--space-1);
    background: rgba(8, 13, 21, 0.78);
    padding: 5px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: var(--border-radius);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(10px);
    z-index: 10;
}

.transform-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: calc(var(--border-radius) - 1px);
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
    background: rgba(148, 163, 184, 0.1);
    border-color: rgba(148, 163, 184, 0.18);
    color: #ffffff;
}

.transform-btn.active {
    background: rgba(47, 125, 244, 0.2);
    border-color: rgba(47, 125, 244, 0.5);
    color: #9ec7ff;
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
    top: 14px;
    left: 14px;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 7px 9px;
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--border-radius);
    background: rgba(8, 13, 21, 0.62);
    color: rgba(226, 232, 240, 0.82);
    font-size: var(--font-size-xs);
    line-height: 1;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(8px);
}

.canvas-status-chip span + span {
    padding-left: var(--space-2);
    border-left: 1px solid rgba(148, 163, 184, 0.16);
}
</style>

