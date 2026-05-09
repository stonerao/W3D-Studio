<template>
    <div class="editor-topbar toolbar workbench-toolbar" :style="{ height: 'var(--toolbar-height)' }">
        <div class="toolbar-action-group" :aria-label="t('toolbar.historyActions')">
            <button
                class="toolbar-btn toolbar-btn--icon"
                :disabled="!historyStore.canUndo"
                :title="t('toolbar.undoTitle')"
                @click="handleUndo"
            >
                <span class="toolbar-symbol">↶</span>
            </button>
            <button
                class="toolbar-btn toolbar-btn--icon"
                :disabled="!historyStore.canRedo"
                :title="t('toolbar.redoTitle')"
                @click="handleRedo"
            >
                <span class="toolbar-symbol">↷</span>
            </button>
        </div>

        <div class="toolbar-divider"></div>

        <div class="toolbar-action-group">
            <button
                class="toolbar-btn toolbar-btn--icon toolbar-btn--play"
                :title="t('toolbar.previewProject')"
                @click="handlePreview"
            >
                <span class="toolbar-symbol">▶</span>
            </button>
            <button class="toolbar-btn toolbar-btn--primary" :title="t('toolbar.saveProjectTitle')" @click="handleSave">
                <i class="sico icon-baocun toolbar-icon" aria-hidden="true"></i>
                <span>{{ t('common.save') }}</span>
            </button>
            <button class="toolbar-btn" :title="t('toolbar.closeEditorTitle')" @click="handleClose">
                <span>{{ t('common.close') }}</span>
            </button>
        </div>

        <div class="toolbar-spacer"></div>

        <div class="toolbar-zone toolbar-zone--tools">
            <div
                class="toolbar-save-status"
                :title="projectSaveMeta"
                :aria-label="projectSaveMeta"
            >
                <span class="status-dot" :class="{ 'status-dot--dirty': projectStore.hasUnsavedChanges }"></span>
            </div>

            <div class="toolbar-language">
                <select
                    id="w3d-locale-select"
                    class="toolbar-language__select"
                    :value="locale"
                    :title="t('common.language')"
                    @change="handleLocaleChange"
                >
                    <option
                        v-for="option in languageOptions"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </option>
                </select>
            </div>

            <button
                class="toolbar-btn toolbar-btn--quiet"
                :title="t('toolbar.cameraManager')"
                @click="openCameraManager"
            >
                <i class="sico icon-qianshitu toolbar-icon" aria-hidden="true"></i>
                <span class="toolbar-compact-label">{{ t('toolbar.camera') }}</span>
            </button>

            <button
                class="toolbar-btn toolbar-btn--quiet"
                :title="t('toolbar.buildingManager')"
                @click="openBuildingManager"
            >
                <i class="sico icon-shiqudian toolbar-icon" aria-hidden="true"></i>
                <span class="toolbar-compact-label">{{ t('toolbar.points') }}</span>
            </button>

            <div class="toolbar-action-group toolbar-action-group--segmented" :aria-label="t('toolbar.panelDisplay')">
                <button
                    class="toolbar-btn toolbar-btn--segment"
                    :class="{ 'active': editorStore.showLeftPanel }"
                    :title="t('toolbar.toggleLeftPanel')"
                    @click="editorStore.toggleLeftPanel"
                >
                    <span>{{ t('toolbar.leftPanel') }}</span>
                </button>
                <button
                    class="toolbar-btn toolbar-btn--segment"
                    :class="{ 'active': editorStore.showRightPanel }"
                    :title="t('toolbar.toggleRightPanel')"
                    @click="editorStore.toggleRightPanel"
                >
                    <span>{{ t('toolbar.rightPanel') }}</span>
                </button>
            </div>

            <button
                class="toolbar-btn toolbar-btn--icon"
                :title="t('toolbar.projectSettings')"
                @click="showSettingsModal = true"
            >
                <i class="sico icon-shezhi toolbar-icon" aria-hidden="true"></i>
            </button>
        </div>

        <!-- English comment. -->
        <input
            ref="fileInputRef"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleFileSelect"
        />

        <!-- English comment. -->
        <Modal
            v-model="showSettingsModal"
            :title="t('toolbar.projectSettings')"
            width="500px"
            @close="handleCancelSettings"
        >
            <div class="settings-form">
                <div class="settings-field">
                    <label class="settings-label">{{ t('toolbar.projectName') }}</label>
                    <Input
                        v-model="settingsForm.name"
                        :placeholder="t('toolbar.projectNamePlaceholder')"
                    />
                </div>

                <div class="settings-field">
                    <label class="settings-label">{{ t('toolbar.apiBaseUrl') }}</label>
                    <Input
                        v-model="settingsForm.apiBaseUrl"
                        placeholder="http://localhost:3000/"
                    />
                    <div class="settings-hint">
                        {{ t('toolbar.apiBaseUrlHint') }}
                    </div>
                </div>

                <div class="settings-field">
                    <label class="settings-label">{{ t('toolbar.sceneInteractionEvents') }}</label>
                    <div class="setting-item-inline">
                        <input
                            type="checkbox"
                            :checked="interactiveEnabled"
                            @change="interactiveEnabled = $event.target.checked"
                            class="checkbox"
                        />
                        <span class="checkbox-label-text">{{ t('toolbar.enableSceneInteractions') }}</span>
                    </div>
                    <div class="settings-hint">
                        {{ t('toolbar.sceneInteractionHint') }}
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="handleCancelSettings">
                    {{ t('common.cancel') }}
                </Button>
                <Button variant="primary" @click="handleSaveSettings">
                    {{ t('common.save') }}
                </Button>
            </template>
        </Modal>
        <Modal
            v-model="showBuildingManagerModal"
            :title="t('toolbar.buildingManager')"
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
                    {{ t('common.close') }}
                </Button>
            </template>
        </Modal>

        <Modal
            v-model="showCameraManagerModal"
            :title="t('toolbar.cameraManager')"
            width="760px"
        >
            <div class="camera-manager">
                <div class="camera-manager__actions">
                    <Button variant="primary" @click="saveCurrentCameraView">
                        {{ t('toolbar.saveCurrentView') }}
                    </Button>
                </div>

                <div v-if="cameraViewsSorted.length === 0" class="settings-hint">
                    {{ t('toolbar.noCameraViews') }}
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
                                {{ view.cameraType === 'perspective' ? t('common.perspective') : t('common.orthographic') }}
                                · {{ formatTime(view.timestamp) }}
                            </div>
                        </div>

                        <div class="camera-view-row__actions">
                            <Button variant="outline" size="sm" @click.stop="applyCameraView(view)">
                                {{ t('common.apply') }}
                            </Button>
                            <Button variant="outline" size="sm" @click.stop="renameCameraView(view)">
                                {{ t('common.rename') }}
                            </Button>
                            <Button variant="danger" size="sm" @click.stop="removeCameraView(view)">
                                {{ t('common.delete') }}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showCameraManagerModal = false">
                    {{ t('common.close') }}
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
import { useEditorI18n } from '../../i18n';
import '../../styles/icon/iconfont.css';
import Modal from '../ui/Modal.vue';
import Input from '../ui/Input.vue';
import Button from '../ui/Button.vue';
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
const { locale, setLocale, t, formatDateTime } = useEditorI18n();

const fileInputRef = ref(null);
const localSavedAt = ref(null);

// English comment.
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

const languageOptions = computed(() => [
    { value: 'en', label: t('common.english') },
    { value: 'zh', label: t('common.chinese') }
]);

const projectSaveMeta = computed(() => {
    if (projectStore.hasUnsavedChanges) return t('toolbar.unsavedChanges');
    const savedAt = localSavedAt.value || projectStore.lastSavedAt;
    if (savedAt) {
        return t('toolbar.savedAt', { time: formatTime(savedAt) });
    }
    return t('toolbar.waitingSave');
});

const handleLocaleChange = (event) => {
    setLocale(event.target.value);
};


const buildingManagerModalWidth = computed(() => {
    return buildingManagerMinimized.value ? '420px' : '980px';
});

// English comment.
const showSettingsModal = ref(false);
const settingsForm = reactive({
    name: '',
    apiBaseUrl: ''
});

// English comment.
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

watch(
    () => projectStore.hasUnsavedChanges,
    (hasUnsavedChanges) => {
        if (hasUnsavedChanges) {
            localSavedAt.value = null;
        }
    }
);

watch(
    () => projectStore.lastSavedAt,
    (savedAt) => {
        if (savedAt) {
            localSavedAt.value = savedAt;
        }
    }
);

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
        name: String(rawView.name || t('toolbar.viewName', { index: index + 1 })),
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
        toast.error(t('toolbar.cameraNotReady'));
        return;
    }

    const nextIndex = cameraViews.value.length + 1;
    const newView = normalizeCameraView({
        id: Date.now().toString(),
        name: t('toolbar.viewName', { index: nextIndex }),
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
    toast.success(t('toolbar.viewSaved', { name: newView.name }));
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
    toast.success(t('toolbar.viewApplied', { name: normalized.name }));
};

const renameCameraView = (view) => {
    if (!view) return;
    const nextName = window.prompt(t('toolbar.renameViewPrompt'), view.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
        toast.error(t('toolbar.emptyViewName'));
        return;
    }

    const target = cameraViews.value.find((item) => item.id === view.id);
    if (!target) return;
    target.name = trimmed;
    persistCameraViews();
    toast.success(t('toolbar.viewNameUpdated'));
};

const removeCameraView = async (view) => {
    if (!view) return;
    const confirmed = await showConfirm(t('toolbar.deleteViewMessage', { name: view.name }), {
        title: t('toolbar.deleteViewTitle')
    });
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
    toast.success(t('toolbar.viewDeleted'));
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

    // English comment.
    // English comment.
    const applyInitialEventState = () => {
        const scene = sceneStore.sceneInstance;
        if (scene?.eventSystem) {
            scene.eventSystem.enabled = interactiveEnabled.value;
            console.log('[TopToolbar] 已应用初始事件系统状态:', interactiveEnabled.value);
        } else {
            // English comment.
            setTimeout(applyInitialEventState, 100);
        }
    };
    applyInitialEventState();
});

onUnmounted(() => {
    window.removeEventListener('editor:open-camera-manager', handleOpenCameraManagerEvent);
});

// English comment.
const handleSaveSettings = () => {
    projectStore.updateSettings({
        name: settingsForm.name,
        apiBaseUrl: settingsForm.apiBaseUrl
    });

    // English comment.
    const scene = sceneStore.sceneInstance;
    if (scene?.eventSystem) {
        scene.eventSystem.enabled = interactiveEnabled.value;
    }

    showSettingsModal.value = false;
    toast.success(t('toolbar.settingsSaved'));
    emit('configChange', {
        name: projectStore.projectName,
        apiBaseUrl: projectStore.apiBaseUrl
    });
};

// English comment.
const handleCancelSettings = () => {
    showSettingsModal.value = false;
};

// English comment.
const handleUndo = async () => {
    try {
        await historyStore.undo();
    } catch (error) {
        console.error('撤回失败:', error);
        toast.error(t('toolbar.undoFailed'));
    }
};

// English comment.
const handleRedo = async () => {
    try {
        await historyStore.redo();
    } catch (error) {
        console.error('重做失败:', error);
        toast.error(t('toolbar.redoFailed'));
    }
};

// English comment.
const handleSave = () => {
    localSavedAt.value = new Date().toISOString();
    emit('save');
};

const handlePreview = () => {
    emit('preview');
};

// English comment.
const handleClose = async () => {
    if (projectStore.hasUnsavedChanges) {
        const confirmed = await showConfirm(t('toolbar.closeUnsavedMessage'), {
            title: t('toolbar.closeUnsavedTitle')
        });
        if (!confirmed) return;
    }
    emit('close');
};

// English comment.
const handleReload = async () => {
    if (projectStore.hasUnsavedChanges) {
        const confirmed = await showConfirm(t('toolbar.reloadUnsavedMessage'), {
            title: t('toolbar.reloadUnsavedTitle')
        });
        if (!confirmed) return;
    }
    emit('requestReload');
    toast.success(t('toolbar.projectReloaded'));
};

// English comment.
const handleImport = async () => {
    if (projectStore.hasUnsavedChanges) {
        const confirmed = await showConfirm(t('toolbar.importUnsavedMessage'), {
            title: t('toolbar.importUnsavedTitle')
        });
        if (!confirmed) return;
    }

    fileInputRef.value?.click();
};

// English comment.
const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        await projectStore.importFromJSON(file);
        toast.success(t('toolbar.projectImported'));
    } catch (error) {
        console.error('导入失败:', error);
        toast.error(t('toolbar.importFailed'));
    }

    // English comment.
    event.target.value = '';
};

// English comment.
const handleExport = () => {
    const success = projectStore.exportToJSON();
    if (success) {
        toast.success(t('toolbar.exportSuccess'));
    } else {
        toast.error(t('toolbar.exportFailed'));
    }
    emit('export');
};

// English comment.
const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    // English comment.
    if (diff < 60000) {
        return t('toolbar.justNow');
    }
    // English comment.
    if (diff < 3600000) {
        return t('toolbar.minutesAgo', { count: Math.floor(diff / 60000) });
    }
    // English comment.
    if (diff < 86400000) {
        return t('toolbar.hoursAgo', { count: Math.floor(diff / 3600000) });
    }
    // English comment.
    return formatDateTime(date, {
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
    gap: 10px;
    padding: 0 14px;
    background:
        linear-gradient(180deg, rgba(8, 15, 26, 0.99) 0%, rgba(4, 10, 18, 0.99) 100%);
    border-bottom: 1px solid rgba(118, 144, 180, 0.16);
    color: var(--color-text-primary);
    box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.02), 0 12px 28px rgba(0, 0, 0, 0.18);
}

.toolbar-zone,
.toolbar-action-group {
    display: inline-flex;
    align-items: center;
    min-width: 0;
}

.toolbar-zone--tools {
    flex: 0 0 auto;
    gap: 8px;
    justify-content: flex-end;
}

.toolbar-action-group {
    gap: 8px;
}

.toolbar-action-group--segmented {
    gap: 0;
    padding: 2px;
    border: 1px solid rgba(118, 144, 180, 0.14);
    border-radius: 8px;
    background: rgba(8, 15, 26, 0.62);
}

.toolbar-spacer {
    flex: 1 1 auto;
    min-width: 160px;
}

.toolbar-save-status {
    flex: 0 0 auto;
    width: 28px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.status-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: var(--border-radius-full);
    background: var(--color-success);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12), 0 0 14px rgba(16, 185, 129, 0.45);
}

.status-dot--dirty {
    background: var(--color-warning);
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.14);
}

.toolbar-divider {
    width: 1px;
    height: 28px;
    margin: 0;
    background-color: rgba(118, 144, 180, 0.16);
}

.toolbar-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    height: 36px;
    padding: 0 14px;
    border: 1px solid rgba(118, 144, 180, 0.16);
    border-radius: 7px;
    background:
        linear-gradient(180deg, rgba(18, 30, 48, 0.72) 0%, rgba(10, 18, 31, 0.72) 100%);
    color: rgba(226, 232, 240, 0.9);
    font-size: 13px;
    font-weight: var(--font-weight-semibold);
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
    border-color: rgba(125, 183, 255, 0.48);
    background:
        linear-gradient(180deg, rgba(25, 40, 62, 0.96) 0%, rgba(14, 25, 42, 0.96) 100%);
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
    background-color: rgba(47, 125, 244, 0.18);
    color: #bfdbfe;
}

.toolbar-btn--icon {
    width: 38px;
    padding: 0;
}

.toolbar-btn--play {
    border-color: rgba(125, 183, 255, 0.2);
    background: rgba(14, 24, 40, 0.86);
}

.toolbar-btn--quiet {
    border-color: rgba(118, 144, 180, 0.12);
    background-color: rgba(8, 15, 26, 0.34);
    color: rgba(203, 213, 225, 0.72);
}

.toolbar-btn--quiet:hover:not(:disabled) {
    border-color: rgba(148, 163, 184, 0.18);
}

.toolbar-btn--segment {
    height: 30px;
    min-width: 42px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: rgba(203, 213, 225, 0.64);
}

.toolbar-btn--segment:hover:not(:disabled) {
    border-color: transparent;
}

.toolbar-btn--segment.active {
    background: transparent;
    box-shadow: none;
    color: #58a2ff;
}

.toolbar-btn--primary {
    border-color: rgba(59, 130, 246, 0.92);
    background: var(--gradient-primary);
    color: #ffffff;
    font-weight: var(--font-weight-semibold);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.toolbar-btn--primary:hover:not(:disabled) {
    border-color: #60a5fa;
    background: linear-gradient(180deg, #4f94ff 0%, #2d6ff0 100%);
}

.toolbar-symbol {
    font-size: 16px;
    line-height: 1;
}

.toolbar-icon {
    font-size: 15px;
    line-height: 1;
}

.toolbar-compact-label {
    white-space: nowrap;
}

.toolbar-language {
    display: inline-flex;
    align-items: center;
    min-width: 0;
}

.toolbar-language__label {
    color: rgba(203, 213, 225, 0.72);
    font-size: var(--font-size-xs);
    white-space: nowrap;
}

.toolbar-language__select {
    height: 34px;
    max-width: 96px;
    padding: 0 26px 0 10px;
    border: 1px solid rgba(118, 144, 180, 0.16);
    border-radius: 7px;
    background: rgba(8, 15, 26, 0.72);
    color: rgba(226, 232, 240, 0.9);
    font-size: 12px;
    outline: none;
}

.toolbar-language__select:focus {
    border-color: rgba(96, 165, 250, 0.66);
}

/* English comment. */
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

