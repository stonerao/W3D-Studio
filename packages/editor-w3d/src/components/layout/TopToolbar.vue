<template>
    <div class="editor-topbar toolbar workbench-toolbar" :style="{ height: 'var(--toolbar-height)' }">
        <div class="toolbar-action-group" aria-label="历史操作">
            <button
                class="toolbar-btn toolbar-btn--icon"
                :disabled="!historyStore.canUndo"
                title="撤回 (Ctrl+Z)"
                @click="handleUndo"
            >
                <span class="toolbar-symbol">↶</span>
            </button>
            <button
                class="toolbar-btn toolbar-btn--icon"
                :disabled="!historyStore.canRedo"
                title="重做 (Ctrl+Y)"
                @click="handleRedo"
            >
                <span class="toolbar-symbol">↷</span>
            </button>
        </div>

        <div class="toolbar-divider"></div>

        <div class="toolbar-action-group">
            <button class="toolbar-btn toolbar-btn--primary" title="保存项目 (Ctrl+S)" @click="handleSave">
                <span>保存</span>
            </button>
            <button class="toolbar-btn" title="关闭编辑器" @click="handleClose">
                <span>关闭</span>
            </button>
        </div>

        <div class="toolbar-project-status">
            <span class="status-dot" :class="{ 'status-dot--dirty': projectStore.hasUnsavedChanges }"></span>
            <span class="project-name">{{ projectStore.projectName }}</span>
            <span class="project-save-meta">
                {{ projectStore.hasUnsavedChanges ? '有未保存更改' : projectStore.lastSavedAt ? `已保存 ${formatTime(projectStore.lastSavedAt)}` : '等待保存' }}
            </span>
        </div>

        <div class="toolbar-zone toolbar-zone--tools">
            <button
                class="toolbar-btn toolbar-btn--quiet"
                title="视角管理器"
                @click="openCameraManager"
            >
                <span>视角</span>
            </button>

            <button
                class="toolbar-btn toolbar-btn--quiet"
                title="点位管理器"
                @click="openBuildingManager"
            >
                <span>点位</span>
            </button>

            <div class="toolbar-action-group toolbar-action-group--segmented" aria-label="面板显示">
                <button
                    class="toolbar-btn toolbar-btn--segment"
                    :class="{ 'active': editorStore.showLeftPanel }"
                    title="切换左侧面板"
                    @click="editorStore.toggleLeftPanel"
                >
                    <span>左栏</span>
                </button>
                <button
                    class="toolbar-btn toolbar-btn--segment"
                    :class="{ 'active': editorStore.showRightPanel }"
                    title="切换右侧面板"
                    @click="editorStore.toggleRightPanel"
                >
                    <span>右栏</span>
                </button>
            </div>

            <button
                class="toolbar-btn"
                title="预览项目"
                @click="handlePreview"
            >
                <span>预览</span>
            </button>

            <button
                class="toolbar-btn toolbar-btn--icon"
                title="项目设置"
                @click="showSettingsModal = true"
            >
                <span class="toolbar-symbol">⚙</span>
            </button>
        </div>

        <!-- 隐藏的文件输入 -->
        <input
            ref="fileInputRef"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleFileSelect"
        />

        <!-- 设置模态框 -->
        <Modal
            v-model="showSettingsModal"
            title="项目设置"
            width="500px"
            @close="handleCancelSettings"
        >
            <div class="settings-form">
                <div class="settings-field">
                    <label class="settings-label">项目名称</label>
                    <Input
                        v-model="settingsForm.name"
                        placeholder="请输入项目名称"
                    />
                </div>

                <div class="settings-field">
                    <label class="settings-label">API 基础 URL 前缀</label>
                    <Input
                        v-model="settingsForm.apiBaseUrl"
                        placeholder="http://localhost:3000/"
                    />
                    <div class="settings-hint">
                        数据接入中使用相对路径时，会自动拼接此前缀
                    </div>
                </div>

                <div class="settings-field">
                    <label class="settings-label">场景交互事件</label>
                    <div class="setting-item-inline">
                        <input
                            type="checkbox"
                            :checked="interactiveEnabled"
                            @change="interactiveEnabled = $event.target.checked"
                            class="checkbox"
                        />
                        <span class="checkbox-label-text">启用三维场景内的点击、悬停等交互事件</span>
                    </div>
                    <div class="settings-hint">
                        禁用后，点击或悬停三维模型将不会触发任何交互效果
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="handleCancelSettings">
                    取消
                </Button>
                <Button variant="primary" @click="handleSaveSettings">
                    保存
                </Button>
            </template>
        </Modal>
        <Modal
            v-model="showBuildingManagerModal"
            title="点位管理器"
            :width="buildingManagerModalWidth"
            :position="buildingManagerMinimized ? 'top-right' : 'center'"
            :non-blocking="buildingManagerMinimized"
            :draggable="!buildingManagerMinimized"
            :close-on-click-outside="!buildingManagerMinimized"
        >
            <BuildingEditorManager
                :minimized="buildingManagerMinimized"
                @toggle-minimize="handleBuildingManagerMinimize"
            />

            <template #footer>
                <Button variant="outline" @click="showBuildingManagerModal = false">
                    关闭
                </Button>
            </template>
        </Modal>

        <Modal
            v-model="showCameraManagerModal"
            title="视角管理器"
            width="760px"
        >
            <div class="camera-manager">
                <div class="camera-manager__actions">
                    <Button variant="primary" @click="saveCurrentCameraView">
                        保存当前视角
                    </Button>
                </div>

                <div v-if="cameraViewsSorted.length === 0" class="settings-hint">
                    暂无视角，请先调整场景相机后点击“保存当前视角”。
                </div>

                <div v-else class="camera-view-list">
                    <div
                        v-for="view in cameraViewsSorted"
                        :key="view.id"
                        class="camera-view-row"
                        :class="{
                            active: selectedCameraViewId === view.id,
                            current: currentCameraViewId === view.id
                        }"
                        @click="applyCameraView(view)"
                    >
                        <div class="camera-view-row__info">
                            <div class="camera-view-row__name">{{ view.name }}</div>
                            <div class="camera-view-row__meta">
                                {{ view.cameraType === 'perspective' ? '透视' : '正交' }}
                                · {{ formatTime(view.timestamp) }}
                            </div>
                        </div>

                        <div class="camera-view-row__actions">
                            <Button variant="outline" size="sm" @click.stop="applyCameraView(view)">
                                应用
                            </Button>
                            <Button variant="outline" size="sm" @click.stop="renameCameraView(view)">
                                重命名
                            </Button>
                            <Button variant="danger" size="sm" @click.stop="removeCameraView(view)">
                                删除
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showCameraManagerModal = false">
                    关闭
                </Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useComponentStore } from '../../stores/useComponentStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import Modal from '../ui/Modal.vue';
import Input from '../ui/Input.vue';
import Button from '../ui/Button.vue';
import Select from '../ui/Select.vue';
import BuildingEditorManager from '../panels/BuildingEditorManager.vue';

const props = defineProps({
    projectId: {
        type: String,
        default: ''
    },
    persistProject: {
        type: Function,
        default: null
    },
    reloadProject: {
        type: Function,
        default: null
    }
});

const emit = defineEmits(['save', 'export', 'requestReload', 'preview', 'configChange', 'close']);

const editorStore = useEditorStore();
const historyStore = useHistoryStore();
const projectStore = useProjectStore();
const componentStore = useComponentStore();
const sceneStore = useSceneStore();
const toast = useToast();
const { confirm: showConfirm } = useConfirm();

const fileInputRef = ref(null);

// 事件系统开关状态（默认禁用，避免编辑时误触发三维交互）
const interactiveEnabled = ref(false);

const showCameraManagerModal = ref(false);
const cameraViews = ref([]);
const selectedCameraViewId = ref('');
const currentCameraViewId = ref(null);
const showBuildingManagerModal = ref(false);
const buildingManagerMinimized = ref(false);

const cameraViewsSorted = computed(() => {
    return [...cameraViews.value].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
});


const buildingManagerModalWidth = computed(() => {
    return buildingManagerMinimized.value ? '420px' : '980px';
});

// 设置模态框状态
const showSettingsModal = ref(false);
const settingsForm = reactive({
    name: '',
    apiBaseUrl: ''
});

// 监听设置模态框打开，初始化表单数据
watch(showSettingsModal, (visible) => {
    if (visible) {
        settingsForm.name = projectStore.projectName;
        settingsForm.apiBaseUrl = projectStore.apiBaseUrl;
    }
});

watch(showBuildingManagerModal, (visible) => {
    if (!visible) {
        buildingManagerMinimized.value = false;
    }
});

watch(showCameraManagerModal, (visible) => {
    if (!visible) return;
    const state = projectStore.getCameraViewsState();
    const loadedViews = Array.isArray(state.views) ? state.views : [];
    const normalizedViews = loadedViews.map((view, index) => normalizeCameraView(view, index));
    const migrated = JSON.stringify(loadedViews) !== JSON.stringify(normalizedViews);

    cameraViews.value = normalizedViews;
    currentCameraViewId.value = state.currentViewId || null;
    selectedCameraViewId.value = state.currentViewId || cameraViews.value[0]?.id || '';

    if (migrated) {
        persistCameraViews({ markUnsaved: false });
    }
});

const normalizeVector3 = (value, fallback = { x: 0, y: 0, z: 0 }) => {
    if (Array.isArray(value) && value.length >= 3) {
        return {
            x: Number(value[0]) || 0,
            y: Number(value[1]) || 0,
            z: Number(value[2]) || 0
        };
    }

    if (value && typeof value === 'object') {
        return {
            x: Number(value.x) || 0,
            y: Number(value.y) || 0,
            z: Number(value.z) || 0
        };
    }

    return {
        x: Number(fallback.x) || 0,
        y: Number(fallback.y) || 0,
        z: Number(fallback.z) || 0
    };
};

const normalizeCameraView = (view, index = 0) => {
    const rawView = view && typeof view === 'object' ? view : {};
    const hasPerspectiveParams = rawView.perspectiveParams && typeof rawView.perspectiveParams === 'object';
    const hasOrthographicParams = rawView.orthographicParams && typeof rawView.orthographicParams === 'object';

    let cameraType = rawView.cameraType;
    if (cameraType !== 'perspective' && cameraType !== 'orthographic') {
        cameraType = hasPerspectiveParams ? 'perspective' : 'orthographic';
    }

    const normalized = {
        id: String(rawView.id ?? `view-${Date.now()}-${index}`),
        name: String(rawView.name || `视角 ${index + 1}`),
        cameraType,
        position: normalizeVector3(rawView.position),
        target: normalizeVector3(rawView.target ?? rawView.lookAt),
        timestamp: Number(rawView.timestamp ?? rawView.createdAt ?? Date.now()) || Date.now()
    };

    if (cameraType === 'perspective') {
        normalized.fov = Number(rawView.fov ?? rawView.perspectiveParams?.fov ?? sceneStore.sceneConfig.camera.fov) || 45;
    } else {
        normalized.zoom = Number(rawView.zoom ?? rawView.orthographicParams?.zoom ?? 1) || 1;
    }

    return normalized;
};

const persistCameraViews = ({ markUnsaved = true } = {}) => {
    const normalizedViews = cameraViews.value.map((view, index) => normalizeCameraView(view, index));
    cameraViews.value = normalizedViews;
    projectStore.setCameraViewsState({
        views: normalizedViews,
        currentViewId: currentCameraViewId.value,
        markUnsaved
    });
};

const getRuntimeCameraSnapshot = () => {
    const scene = sceneStore.sceneInstance;
    const runtimeCamera = scene?.camera?.instance;
    const runtimeControls = scene?.controls?.instance;

    if (!runtimeCamera) return null;

    const runtimeType = runtimeCamera.isOrthographicCamera ? 'orthographic' : 'perspective';
    const configCamera = sceneStore.sceneConfig.camera;
    const target = runtimeControls?.target
        ? { x: runtimeControls.target.x, y: runtimeControls.target.y, z: runtimeControls.target.z }
        : normalizeVector3(configCamera.lookAt, { x: 0, y: 0, z: 0 });

    return {
        cameraType: runtimeType,
        position: {
            x: Number(runtimeCamera.position?.x) || 0,
            y: Number(runtimeCamera.position?.y) || 0,
            z: Number(runtimeCamera.position?.z) || 0
        },
        target,
        fov: runtimeType === 'perspective'
            ? (Number(runtimeCamera.fov) || Number(configCamera.fov) || 45)
            : undefined,
        zoom: runtimeType === 'orthographic'
            ? (Number(runtimeCamera.zoom) || 1)
            : undefined
    };
};

const openCameraManager = () => {
    showCameraManagerModal.value = true;
};

const saveCurrentCameraView = () => {
    const snapshot = getRuntimeCameraSnapshot();
    if (!snapshot) {
        toast.error('当前场景相机未就绪，无法保存视角');
        return;
    }

    const nextIndex = cameraViews.value.length + 1;
    const newView = normalizeCameraView({
        id: Date.now().toString(),
        name: `视角 ${nextIndex}`,
        cameraType: snapshot.cameraType,
        position: snapshot.position,
        target: snapshot.target,
        fov: snapshot.fov,
        zoom: snapshot.zoom,
        timestamp: Date.now()
    }, cameraViews.value.length);

    cameraViews.value.push(newView);
    selectedCameraViewId.value = newView.id;
    persistCameraViews();
    toast.success(`已保存 ${newView.name}`);
};

const applyCameraView = (view) => {
    if (!view) return;

    const normalized = normalizeCameraView(view, 0);
    const { cameraType, position, target } = normalized;

    sceneStore.updateCameraConfig({
        type: cameraType,
        position: [position.x, position.y, position.z],
        lookAt: [target.x, target.y, target.z],
        ...(cameraType === 'perspective' ? { fov: Number(normalized.fov) || sceneStore.sceneConfig.camera.fov } : {})
    });

    sceneStore.updateControlsConfig({ target });

    const runtimeCamera = sceneStore.sceneInstance?.camera?.instance;
    if (runtimeCamera?.isPerspectiveCamera && cameraType === 'perspective') {
        runtimeCamera.fov = Number(normalized.fov) || runtimeCamera.fov;
        runtimeCamera.updateProjectionMatrix?.();
    }
    if (runtimeCamera?.isOrthographicCamera && cameraType === 'orthographic') {
        runtimeCamera.zoom = Number(normalized.zoom) || runtimeCamera.zoom;
        runtimeCamera.updateProjectionMatrix?.();
    }

    selectedCameraViewId.value = normalized.id;
    currentCameraViewId.value = normalized.id;
    persistCameraViews();
    toast.success(`已应用 ${normalized.name}`);
};

const renameCameraView = (view) => {
    if (!view) return;
    const nextName = window.prompt('请输入新的视角名称', view.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
        toast.error('视角名称不能为空');
        return;
    }

    const target = cameraViews.value.find((item) => item.id === view.id);
    if (!target) return;
    target.name = trimmed;
    persistCameraViews();
    toast.success('视角名称已更新');
};

const removeCameraView = async (view) => {
    if (!view) return;
    const confirmed = await showConfirm(`确定删除视角“${view.name}”吗？`, { title: '删除视角' });
    if (!confirmed) return;

    const index = cameraViews.value.findIndex((item) => item.id === view.id);
    if (index < 0) return;

    cameraViews.value.splice(index, 1);
    if (selectedCameraViewId.value === view.id) {
        selectedCameraViewId.value = cameraViews.value[0]?.id || '';
    }
    if (currentCameraViewId.value === view.id) {
        currentCameraViewId.value = null;
    }

    persistCameraViews();
    toast.success('视角已删除');
};

const openBuildingManager = () => {
    showBuildingManagerModal.value = true;
};

const handleBuildingManagerMinimize = (value) => {
    buildingManagerMinimized.value = !!value;
};

const handleOpenCameraManagerEvent = () => {
    showCameraManagerModal.value = true;
};

onMounted(() => {
    window.addEventListener('editor:open-camera-manager', handleOpenCameraManagerEvent);

    // 场景初始化后应用默认的事件系统开关状态
    // 使用 nextTick 确保场景实例已创建
    const applyInitialEventState = () => {
        const scene = sceneStore.sceneInstance;
        if (scene?.eventSystem) {
            scene.eventSystem.enabled = interactiveEnabled.value;
            console.log('[TopToolbar] 已应用初始事件系统状态:', interactiveEnabled.value);
        } else {
            // 场景尚未初始化，延迟重试
            setTimeout(applyInitialEventState, 100);
        }
    };
    applyInitialEventState();
});

onUnmounted(() => {
    window.removeEventListener('editor:open-camera-manager', handleOpenCameraManagerEvent);
});

// 保存设置
const handleSaveSettings = () => {
    projectStore.updateSettings({
        name: settingsForm.name,
        apiBaseUrl: settingsForm.apiBaseUrl
    });

    // 应用事件系统开关
    const scene = sceneStore.sceneInstance;
    if (scene?.eventSystem) {
        scene.eventSystem.enabled = interactiveEnabled.value;
    }

    showSettingsModal.value = false;
    toast.success('项目设置已保存');
    emit('configChange', {
        name: projectStore.projectName,
        apiBaseUrl: projectStore.apiBaseUrl
    });
};

// 取消设置
const handleCancelSettings = () => {
    showSettingsModal.value = false;
};

// 撤回
const handleUndo = async () => {
    try {
        await historyStore.undo();
    } catch (error) {
        console.error('撤回失败:', error);
        toast.error('撤回失败，请查看控制台');
    }
};

// 重做
const handleRedo = async () => {
    try {
        await historyStore.redo();
    } catch (error) {
        console.error('重做失败:', error);
        toast.error('重做失败，请查看控制台');
    }
};

// 保存项目
const handleSave = async () => {
    emit('save');
    toast.success('项目已保存');
};

const handlePreview = () => {
    emit('preview');
};

// 关闭编辑器
const handleClose = async () => {
    if (projectStore.hasUnsavedChanges) {
        const confirmed = await showConfirm('当前有未保存的更改，确定要关闭吗？', { title: '关闭编辑器' });
        if (!confirmed) return;
    }
    emit('close');
};

// 重载项目（从外部数据源重新载入）
const handleReload = async () => {
    if (projectStore.hasUnsavedChanges) {
        const confirmed = await showConfirm('当前有未保存的更改，确定要重载项目吗？', { title: '重载项目' });
        if (!confirmed) return;
    }
    emit('requestReload');
    toast.success('项目已重载');
};

// 导入 JSON
const handleImport = async () => {
    if (projectStore.hasUnsavedChanges) {
        const confirmed = await showConfirm('当前有未保存的更改，确定要导入项目吗？', { title: '导入项目' });
        if (!confirmed) return;
    }

    fileInputRef.value?.click();
};

// 文件选择处理
const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        await projectStore.importFromJSON(file);
        toast.success('项目已导入');
    } catch (error) {
        console.error('导入失败:', error);
        toast.error('导入失败，请检查 JSON 文件格式');
    }

    // 清空文件输入
    event.target.value = '';
};

// 导出 JSON
const handleExport = () => {
    const success = projectStore.exportToJSON();
    if (success) {
        toast.success('项目已导出为 JSON 文件');
    } else {
        toast.error('导出失败，请查看控制台');
    }
    emit('export');
};

// 格式化时间
const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }
    // 小于1小时
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    }
    // 小于1天
    if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    }
    // 显示日期
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};
</script>

<style scoped>
.editor-topbar {
    box-shadow: none;
}

.workbench-toolbar {
    position: relative;
    z-index: 30;
    gap: var(--space-3);
    padding: 0 var(--space-3);
    background:
        linear-gradient(180deg, rgba(14, 19, 29, 0.98) 0%, rgba(10, 14, 22, 0.98) 100%);
    border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    color: var(--color-text-primary);
}

.toolbar-zone,
.toolbar-action-group {
    display: inline-flex;
    align-items: center;
    min-width: 0;
}

.toolbar-zone--tools {
    flex: 0 0 auto;
    gap: var(--space-2);
    justify-content: flex-end;
}

.toolbar-action-group {
    gap: var(--space-1);
}

.toolbar-action-group--segmented {
    gap: 0;
    padding: 2px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius);
    background: rgba(15, 23, 42, 0.56);
}

.toolbar-project-status {
    flex: 1 1 auto;
    min-width: 160px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    color: var(--color-text-secondary);
}

.status-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: var(--border-radius-full);
    background: var(--color-success);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
}

.status-dot--dirty {
    background: var(--color-warning);
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.14);
}

.project-name {
    max-width: 280px;
    overflow: hidden;
    color: #e5edf7;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.project-save-meta {
    color: rgba(203, 213, 225, 0.55);
    font-size: var(--font-size-xs);
    white-space: nowrap;
}

.toolbar-divider {
    height: 26px;
    margin: 0;
    background-color: rgba(148, 163, 184, 0.16);
}

.toolbar-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius);
    background-color: rgba(15, 23, 42, 0.4);
    color: rgba(226, 232, 240, 0.9);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    cursor: pointer;
    transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        color var(--transition-fast),
        transform var(--transition-fast);
    white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
    border-color: rgba(125, 183, 255, 0.5);
    background-color: rgba(30, 41, 59, 0.92);
    color: #ffffff;
}

.toolbar-btn:active:not(:disabled) {
    transform: translateY(1px);
}

.toolbar-btn:disabled {
    opacity: 0.38;
    cursor: not-allowed;
}

.toolbar-btn.active {
    border-color: rgba(96, 165, 250, 0.52);
    background-color: rgba(37, 99, 235, 0.18);
    color: #bfdbfe;
}

.toolbar-btn--icon {
    width: 34px;
    padding: 0;
}

.toolbar-btn--quiet {
    border-color: transparent;
    background-color: transparent;
    color: rgba(203, 213, 225, 0.72);
}

.toolbar-btn--quiet:hover:not(:disabled) {
    border-color: rgba(148, 163, 184, 0.18);
}

.toolbar-btn--segment {
    height: 28px;
    min-width: 38px;
    border: 0;
    border-radius: calc(var(--border-radius) - 2px);
    background: transparent;
    color: rgba(203, 213, 225, 0.64);
}

.toolbar-btn--segment:hover:not(:disabled) {
    border-color: transparent;
}

.toolbar-btn--primary {
    border-color: rgba(59, 130, 246, 0.92);
    background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
    color: #ffffff;
    font-weight: var(--font-weight-semibold);
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
}

.toolbar-btn--primary:hover:not(:disabled) {
    border-color: #60a5fa;
    background: linear-gradient(180deg, #4f94ff 0%, #2d6ff0 100%);
}

.toolbar-symbol {
    font-size: 16px;
    line-height: 1;
}

/* 设置表单样式 */
.settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.settings-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.settings-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.settings-hint {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    margin-top: 0.25rem;
}

.setting-item-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
}

.checkbox-label-text {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    user-select: none;
}

.camera-manager {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.camera-manager__actions {
    display: flex;
    justify-content: flex-start;
}

.camera-view-list {
    max-height: 420px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.camera-view-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-tertiary);
    transition: border-color 120ms ease;
    cursor: pointer;
}

.camera-view-row:hover {
    border-color: var(--color-border-hover);
}

.camera-view-row.active {
    border-color: var(--color-primary);
}

.camera-view-row.current {
    box-shadow: inset 0 0 0 1px var(--color-primary-subtle);
}

.camera-view-row__info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.camera-view-row__name {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.camera-view-row__meta {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
}

.camera-view-row__actions {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
}
</style>

