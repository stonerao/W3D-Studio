<template>
    <div class="preview-page">
        <!-- English comment. -->
        <!-- <div v-if="showToolbar" class="preview-toolbar">
            <div class="toolbar-left">
                <span class="project-name">{{ projectName }}</span>
            </div>
            <div class="toolbar-right">
                <span class="preview-badge">{{ headerTitle }}</span>
            </div>
        </div> -->

        <!-- English comment. -->
        <div class="preview-canvas">
            <div ref="canvasContainer" class="canvas-container"></div>

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

            <CameraVideoModal :state="cameraVideoModalState" @close="closeCameraVideoModal" />

            <!-- English comment. -->
            <div v-if="isLoading" class="loading-overlay">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p class="loading-text">加载中...</p>
                </div>
            </div>

            <!-- English comment. -->
            <div v-if="errorMessage" class="error-overlay">
                <div class="error-content">
                    <div class="text-4xl mb-4"></div>
                    <h3 class="text-xl font-medium text-gray-700 mb-2">加载失败</h3>
                    <p class="text-sm text-gray-500 mb-4">{{ errorMessage }}</p>
                    <Button variant="primary" @click="loadProject">重新加载</Button>
                </div>
            </div>
        </div>
        <Toast ref="toastRef" />
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import Button from '../components/ui/Button.vue';
import Toast from '../components/ui/Toast.vue';
import { usePreviewScene } from '../composables/usePreviewScene';
import { useAlarmRuntime } from '../composables/useAlarmRuntime';
import { useCameraPointRuntime } from '../composables/useCameraPointRuntime';
import { useToast } from '../composables/useToast';
import { useComponent } from '../composables/useComponent';
import { useProjectStore } from '../stores/useProjectStore';
import { useSceneStore } from '../stores/useSceneStore';
import { useComponentStore } from '../stores/useComponentStore';
import { useAlarmStore } from '../stores/useAlarmStore';
import { useVariableStore } from '../stores/useVariableStore';
import { normalizeComponentMethodDefinitions } from '@w3d/components';
import { getComponentMethodDefinitions } from '../utils/componentRegistry';
import CameraVideoModal from '../components/ui/CameraVideoModal.vue';

const props = defineProps({
    projectData: {
        type: Object,
        default: null
    },
    showToolbar: {
        type: Boolean,
        default: true
    },
    headerTitle: {
        type: String,
        default: '预览模式'
    },
    isControls: {
        type: Boolean,
        default: true
    },
    /**
     * English comment.
     */
    interactiveEnabled: {
        type: Boolean,
        default: true
    }
});

// English comment.
const canvasContainer = ref(null);

// Store
const projectStore = useProjectStore();
const sceneStore = useSceneStore();
const componentStore = useComponentStore();
const alarmStore = useAlarmStore();
const variableStore = useVariableStore();
const toast = useToast();
const { executeDataBinding, applyAllComponentVariableBindings } = useComponent();
const toastRef = ref(null);

// English comment.
const {
    initPreviewScene,
    disposePreviewScene,
    pausePreviewScene,
    resumePreviewScene,
    isSceneRunning,
    updatePreviewScene
} = usePreviewScene();
const alarmRuntime = useAlarmRuntime();
const cameraPointRuntime = useCameraPointRuntime();

// English comment.
const lastLoadedSignature = ref('');
// English comment.
const isLoadingProject = ref(false);
let pendingProjectReload = false;
let currentLoadToken = 0;
const runOnLoadTimerIds = new Set();

// English comment.
const projectName = ref('');
const isLoading = ref(true);
const errorMessage = ref('');
const showToolbar = computed(() => props.showToolbar);
const headerTitle = computed(() => props.headerTitle);
const isControls = computed(() => props.isControls);
const screenFlashState = alarmRuntime.screenFlashState;
const alarmModalState = alarmRuntime.alarmModalState;
const closeAlarmModal = alarmRuntime.closeAlarmModal;
const cameraVideoModalState = cameraPointRuntime.modalState;
const closeCameraVideoModal = cameraPointRuntime.closeModal;

const isCurrentLoad = (token) => token === currentLoadToken;

const clearRunOnLoadTimers = () => {
    runOnLoadTimerIds.forEach((timerId) => {
        window.clearTimeout(timerId);
    });
    runOnLoadTimerIds.clear();
};

const waitForPreviewSceneReady = async () => {
    await nextTick();
    await new Promise((resolve) => {
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
            resolve();
            return;
        }
        window.requestAnimationFrame(() => resolve());
    });
};

const triggerAlarmRequestsAfterSceneReady = async (token = currentLoadToken) => {
    await waitForPreviewSceneReady();
    if (!isCurrentLoad(token)) return;
    await alarmStore.evaluateAllRules({ forceRefreshRemote: true });
    if (!isCurrentLoad(token)) return;
    await nextTick();
    if (!isCurrentLoad(token)) return;
    alarmRuntime.syncAlarmRuntimeEffects();
    console.log('[Preview] triggerAlarmRequestsAfterSceneReady', {
        activeAlarms: alarmStore.activeAlarms.map((alarm) => ({
            id: alarm.id,
            ruleId: alarm.ruleId,
            title: alarm.title,
            message: alarm.message,
            actions: alarm.actionsSnapshot
        })),
        modalVisible: alarmModalState.value.visible,
        screenFlashVisible: screenFlashState.value.visible
    });
};

// English comment.
watch(
    () => props.interactiveEnabled,
    (enabled) => {
        const scene = sceneStore.sceneInstance;
        if (scene?.eventSystem) {
            scene.eventSystem.enabled = enabled;
            console.log('[Preview] EventSystem.enabled =', enabled);
        }
    },
    { immediate: false }
);

watch(
    () => (variableStore.variables || []).map((item) => ({
        name: item.name,
        value: item.value,
        updatedAt: item.updatedAt
    })),
    () => {
        applyAllComponentVariableBindings().catch((error) => {
            console.warn('[Preview] failed to apply variable bindings:', error);
        });
    },
    { deep: true, immediate: true }
);

watch(
    () => componentStore.serialVersion,
    () => {
        applyAllComponentVariableBindings().catch((error) => {
            console.warn('[Preview] failed to sync variable bindings after component change:', error);
        });
    },
    { immediate: true }
);

/**
 * English comment.
 */
const buildSignature = (data) => {
    try {
        return JSON.stringify(data || {});
    } catch {
        return '';
    }
};

const normalizeVariableCommandValue = (variable, value) => {
    const type = String(variable?.type || '').trim();
    if (type === 'boolean') {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['false', '0', 'off', 'no', 'hidden', 'hide', ''].includes(normalized)) return false;
            if (['true', '1', 'on', 'yes', 'visible', 'show'].includes(normalized)) return true;
        }
        return Boolean(value);
    }
    if (type === 'number') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return value;
};

const executeVariableCommand = (command = {}) => {
    const name = String(command?.name || '').trim();
    const operation = String(command?.operation || 'value').trim() || 'value';
    if (!name) {
        return { success: false, reason: 'invalid_variable_name', requestId: command?.requestId || '' };
    }

    const variable = variableStore.getVariableByName(name);
    if (!variable) {
        return { success: false, reason: 'variable_not_found', name, requestId: command?.requestId || '' };
    }

    try {
        const nextValue = operation === 'toggle' && String(variable?.type || '').trim() === 'boolean'
            ? !Boolean(variable.value)
            : normalizeVariableCommandValue(variable, command?.value);
        variableStore.setVariableValueByName(name, nextValue);
        return {
            success: true,
            name,
            value: nextValue,
            operation,
            requestId: command?.requestId || ''
        };
    } catch (error) {
        return {
            success: false,
            reason: 'variable_update_failed',
            name,
            message: error?.message || String(error),
            requestId: command?.requestId || ''
        };
    }
};

/**
 * English comment.
 */
const loadProject = async () => {
    if (isLoadingProject.value) {
        pendingProjectReload = true;
        return;
    }

    const token = currentLoadToken + 1;
    currentLoadToken = token;
    pendingProjectReload = false;
    const signature = buildSignature(props.projectData);
    console.log('开始重绘场景', props.projectData);

    try {
        isLoadingProject.value = true;
        isLoading.value = true;
        errorMessage.value = '';
        clearRunOnLoadTimers();

        // English comment.
        disposePreviewScene();

        await projectStore.deserializeProject(props.projectData || {}, 'preview');
        if (!isCurrentLoad(token)) return;

        // English comment.
        lastLoadedSignature.value = signature;

        // English comment.
        projectName.value = projectStore.projectName || '未命名项目';

        console.log('[Preview] 项目数据已加载:', {
            name: projectStore.projectName,
            components: componentStore.components.length,
            sceneConfig: sceneStore.sceneConfig
        });

        // English comment.
        const scene = await initializeScene();
        if (!isCurrentLoad(token)) {
            if (sceneStore.sceneInstance === scene) {
                disposePreviewScene();
            } else {
                scene?.dispose?.();
            }
            return;
        }

        triggerRunOnLoadDataSources(token);
        triggerAlarmRequestsAfterSceneReady(token).catch((error) => {
            console.warn('[Preview] alarm evaluate failed:', error);
        });

        isLoading.value = false;
    } catch (error) {
        if (!isCurrentLoad(token)) return;
        console.error('[Preview] 加载项目失败:', error);
        errorMessage.value = error.message || '加载项目失败';
        isLoading.value = false;
    } finally {
        isLoadingProject.value = false;
        if (isCurrentLoad(token) && pendingProjectReload) {
            pendingProjectReload = false;
            void loadProject();
        }
    }
};

const triggerRunOnLoadDataSources = (token = currentLoadToken) => {
    const allComponents = Array.isArray(componentStore.components) ? componentStore.components : [];
    allComponents.forEach((component) => {
        const sources = Array.isArray(component?.dataBinding?.sources) ? component.dataBinding.sources : [];
        const runOnLoadSources = sources.filter((source) => {
            const mode = String(source?.mode || '').toLowerCase();
            return source?.id && (source?.runOnLoad === true || mode === 'websocket' || mode === 'mqtt');
        });
        runOnLoadSources.forEach((source) => {
            const delayMs = Math.max(0, Number(source?.startupDelaySeconds || 0)) * 1000;
            const timerId = window.setTimeout(() => {
                runOnLoadTimerIds.delete(timerId);
                if (!isCurrentLoad(token)) return;
                executeDataBinding(component.id, source.id, projectStore.apiBaseUrl).catch((error) => {
                    console.warn('[Preview] runOnLoad data source execute failed:', {
                        componentId: component?.id,
                        sourceId: source?.id,
                        error
                    });
                });
            }, delayMs);
            runOnLoadTimerIds.add(timerId);
        });
    });
};

/**
 * English comment.
 */
const initializeScene = async () => {
    if (!canvasContainer.value) {
        throw new Error('画布容器未找到');
    }

    try {
        // English comment.
        const scene = await initPreviewScene(canvasContainer.value, { isControls: isControls.value });

        // English comment.
        if (scene?.eventSystem) {
            scene.eventSystem.enabled = props.interactiveEnabled;
        }

        console.log('[Preview] 场景初始化成功');

        return scene;
    } catch (error) {
        console.error('[Preview] 场景初始化失败:', error);
        throw error;
    }
};


/**
 * English comment.
 */
const cleanup = () => {
    console.log('[Preview] 清理场景资源');
    currentLoadToken += 1;
    clearRunOnLoadTimers();
    alarmRuntime.disposeAlarmRuntime();
    disposePreviewScene();
};

// English comment.
onMounted(() => {
    alarmStore.setAutoEvaluationEnabled(true, { clearActiveAlarms: false });
    if (toastRef.value) {
        toast.setToastInstance(toastRef.value);
        console.log('[Preview] toast instance ready');
    }
    void loadProject();
});

// English comment.
// English comment.
watch(
    () => props.projectData,
    (nextValue, previousValue) => {
        if (nextValue === previousValue) return;
        if (!nextValue) return;
        refresh();
    }
);

watch(
    () => alarmStore.activeAlarms.map((alarm) => ({
        id: alarm.id,
        ruleId: alarm.ruleId,
        title: alarm.title,
        message: alarm.message,
        actions: Array.isArray(alarm.actionsSnapshot) ? alarm.actionsSnapshot.map((action) => action?.type) : []
    })),
    (value) => {
        console.log('[Preview] activeAlarms changed', value);
    },
    { deep: true }
);

watch(
    () => ({
        modalVisible: alarmModalState.value.visible,
        modalTitle: alarmModalState.value.title,
        flashVisible: screenFlashState.value.visible,
        flashKey: screenFlashState.value.key
    }),
    (value) => {
        console.log('[Preview] alarm runtime state changed', value);
    },
    { deep: true }
);

// English comment.
onUnmounted(() => {
    alarmStore.setAutoEvaluationEnabled(false);
    cleanup();
});

/**
 * English comment.
 */
const refresh = () => {
    // English comment.
    lastLoadedSignature.value = '';
    void loadProject();
};

/**
 * English comment.
 */
const updateScene = async (projectData, forceUpdate = false) => {
    if (!sceneStore.sceneInstance) {
        console.warn('[Preview] 场景未初始化，无法增量更新');
        return { success: false, reason: 'scene_not_initialized' };
    }

    console.log('[Preview] 执行增量更新', { forceUpdate });

    // English comment.
    const result = await updatePreviewScene(projectData, forceUpdate);

    // English comment.
    if (result.success && result.updatedItems?.length > 0) {
        lastLoadedSignature.value = buildSignature(projectData);
    }

    return result;
};

/**
 * English comment.
 */
const pause = () => {
    console.log('[Preview] 暂停场景渲染');
    return pausePreviewScene();
};

/**
 * English comment.
 */
const resume = () => {
    console.log('[Preview] 恢复场景渲染');
    return resumePreviewScene();
};

/**
 * English comment.
 */
const isRunning = () => {
    return isSceneRunning();
};

/**
 * English comment.
 */
const getSceneInstance = () => {
    return sceneStore.sceneInstance;
};

const getRuntimeComponentMethods = (component) => {
    if (!component) return [];
    const methods = [];
    let proto = Object.getPrototypeOf(component);
    const skipClasses = new Set(['Group', 'Object3D', 'EventDispatcher']);
    while (proto && !skipClasses.has(proto.constructor?.name)) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === 'constructor') continue;
            try { if (typeof proto[key] === 'function' && !key.startsWith('_')) methods.push(key); } catch {}
        }
        proto = Object.getPrototypeOf(proto);
    }
    return [...new Set(methods)];
};

const resolveCallableMethods = (componentType, component) => {
    const configuredMethods = getComponentMethodDefinitions(componentType);
    if (configuredMethods.length) return configuredMethods;
    return normalizeComponentMethodDefinitions(getRuntimeComponentMethods(component));
};

const normalizeComponentCommand = (command) => {
    if (!command || typeof command !== 'object') return null;

    if (typeof command.action === 'string' && !command.method) {
        return {
            method: command.action === 'reset' ? 'reset' : 'start',
            componentId: typeof command.componentId === 'string' ? command.componentId : '',
            componentType: 'ExplodedView',
            args: Array.isArray(command.args) ? command.args : []
        };
    }

    const method = typeof command.method === 'string' ? command.method.trim() : '';
    if (!method) return null;

    return {
        method,
        componentId: typeof command.componentId === 'string' ? command.componentId : '',
        componentType: typeof command.componentType === 'string' ? command.componentType : '',
        args: Array.isArray(command.args) ? command.args : []
    };
};

const invokeMethodWithFallback = (target, method, args = []) => {
    if (!target || !method) return false;

    if (typeof target[method] === 'function') {
        target[method](...args);
        return true;
    }

    if (method === 'setVisible') {
        const nextVisible = args[0] !== false;
        if (typeof target.setVisible === 'function') {
            target.setVisible(nextVisible, ...args.slice(1));
            return true;
        }
        if (nextVisible) {
            if (typeof target.show === 'function') {
                target.show();
                return true;
            }
        } else if (typeof target.hide === 'function') {
            target.hide();
            return true;
        }
        if ('visible' in target) {
            target.visible = nextVisible;
            return true;
        }
    }

    if (method === 'toggle') {
        if (typeof target.toggle === 'function') {
            target.toggle(...args);
            return true;
        }
        if (typeof target.show === 'function' && typeof target.hide === 'function') {
            if (target.visible === false) {
                target.show();
            } else {
                target.hide();
            }
            return true;
        }
    }

    return false;
};

const canInvokeMethod = (target, method) => {
    if (!target || !method) return false;
    if (typeof target[method] === 'function') return true;
    if (method === 'setVisible') {
        return typeof target.setVisible === 'function'
            || typeof target.show === 'function'
            || typeof target.hide === 'function'
            || 'visible' in target;
    }
    if (method === 'toggle') {
        return typeof target.toggle === 'function' || (typeof target.show === 'function' && typeof target.hide === 'function');
    }
    return false;
};

const executeComponentCommand = (rawCommand = {}) => {
    const command = normalizeComponentCommand(rawCommand);
    if (!command) {
        return { success: false, reason: 'invalid_command' };
    }

    const { method, componentId, componentType, args } = command;

    if (method === 'requestData' || method === 'executeDataBinding') {
        const targetComponent = (componentStore.components || []).find((component) => {
            if (!component) return false;
            if (componentType && component.type !== componentType) return false;
            if (componentId) {
                return component.id === componentId
                    || component.name === componentId
                    || component?.config?.name === componentId
                    || component?.config?.id === componentId;
            }
            return true;
        });

        if (!targetComponent) {
            return { success: false, reason: 'component_not_found', method, componentId, componentType };
        }

        const firstArg = Array.isArray(args) ? args[0] : null;
        const sourceIdInput = Array.isArray(firstArg)
            ? firstArg
            : (typeof firstArg === 'string'
                ? firstArg
                : (firstArg && typeof firstArg === 'object' ? firstArg.sourceId : null));
        const sourceIds = Array.isArray(sourceIdInput)
            ? sourceIdInput.map((item) => String(item || '').trim()).filter(Boolean)
            : (typeof sourceIdInput === 'string' && String(sourceIdInput || '').trim()
                ? [String(sourceIdInput || '').trim()]
                : []);
        const apiBaseUrl = (firstArg && typeof firstArg === 'object' && typeof firstArg.apiBaseUrl === 'string')
            ? firstArg.apiBaseUrl
            : projectStore.apiBaseUrl;

        if (sourceIds.length > 0) {
            sourceIds.forEach((sourceId) => {
                executeDataBinding(targetComponent.id, sourceId, apiBaseUrl)
                    .catch((error) => {
                        console.warn('[Preview] executeDataBinding command failed:', error);
                    });
            });
        } else {
            executeDataBinding(targetComponent.id, null, apiBaseUrl)
                .catch((error) => {
                    console.warn('[Preview] executeDataBinding command failed:', error);
                });
        }

        return {
            success: true,
            pending: true,
            componentId: targetComponent.id,
            componentType: targetComponent.type,
            method,
            sourceIds
        };
    }

    const target = (componentStore.components || []).find((component) => {
        if (!component?.instance || !canInvokeMethod(component.instance, method)) return false;
        if (componentType && component.type !== componentType) return false;
        if (componentId) {
            return component.id === componentId
                || component.name === componentId
                || component?.config?.name === componentId
                || component?.config?.id === componentId;
        }
        return true;
    });

    if (target?.instance && invokeMethodWithFallback(target.instance, method, args || [])) {
        return { success: true, componentId: target.id, componentType: target.type, method };
    }

    return { success: false, reason: 'component_or_method_not_found', method, componentId, componentType };
};

/**
 * English comment.
 */
const listSceneComponents = () => {
    const sceneInstance = sceneStore.sceneInstance;
    const componentsMap = sceneInstance?.componentManager?.components || sceneInstance?.components;
    if (!componentsMap) {
        return { success: false, reason: 'scene_not_initialized', components: [] };
    }
    const result = [];
    const editorComponentMap = new Map((componentStore.components || []).map((item) => {
        const keys = [
            item?.id,
            item?.name,
            item?.config?.id,
            item?.config?.name
        ].filter(Boolean).map((key) => String(key));
        return [keys, item];
    }).flatMap(([keys, item]) => keys.map((key) => [key, item])));
    componentsMap.forEach((component, name) => {
        const componentType = component?.config?.type || component?.type || component?.constructor?.name || '';
        const methodDefinitions = resolveCallableMethods(componentType, component);
        const matchedEditorComponent = editorComponentMap.get(String(component?.id || ''))
            || editorComponentMap.get(String(component?.config?.id || ''))
            || editorComponentMap.get(String(component?.name || ''))
            || editorComponentMap.get(String(name || ''));
        const dataSources = Array.isArray(matchedEditorComponent?.dataBinding?.sources)
            ? matchedEditorComponent.dataBinding.sources.map((source) => ({
                id: String(source?.id || ''),
                name: String(source?.name || source?.id || ''),
                mode: String(source?.mode || 'http'),
                runOnLoad: source?.runOnLoad === true,
                startupDelaySeconds: Math.max(0, Number(source?.startupDelaySeconds || 0))
        })).filter((source) => !!source.id)
            : [];
        const isModelLoader = componentType === 'ModelLoader';
        let modelStructureTree = [];
        let meshCount = 0;
        if (isModelLoader) {
            try {
                const tree = typeof component?.getModelStructureTree === 'function'
                    ? component.getModelStructureTree()
                    : [];
                modelStructureTree = Array.isArray(tree) ? tree : [];
            } catch (error) {
                console.warn('[Preview] 读取模型结构树失败:', error);
            }
            try {
                if (typeof component?.getMeshCount === 'function') {
                    meshCount = Number(component.getMeshCount()) || 0;
                } else if (typeof component?.getAllMeshes === 'function') {
                    const meshes = component.getAllMeshes();
                    meshCount = Array.isArray(meshes) ? meshes.length : 0;
                }
            } catch {
                meshCount = 0;
            }
        }
        result.push({
            name,
            id: component?.id,
            type: componentType,
            className: component?.constructor?.name || '',
            methods: methodDefinitions.map((item) => item.name),
            methodDefinitions,
            dataSources,
            modelStructureTree,
            meshCount,
            isMounted: !!component?.isMounted
        });
    });
    return { success: true, components: result };
};

// English comment.
defineExpose({
    // English comment.
    refresh,
    loadProject,
    updateScene,
    getSceneInstance,
    executeComponentCommand,
    executeVariableCommand,
    listSceneComponents,
    // English comment.
    pause,
    resume,
    isRunning,
    // English comment.
    get sceneInstance() {
        return sceneStore.sceneInstance;
    }
});
</script>

<style scoped>
.preview-page {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-base);
}

.preview-toolbar {
    background-color: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: var(--shadow-md);
}

.toolbar-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.project-name {
    color: var(--color-text-primary);
    font-weight: 500;
}

.preview-badge {
    /* padding: 0.25rem 0.75rem; */
    background-color: var(--color-bg-base);
    color: var(--color-text-inverse);
    font-size: 0.75rem;
    border-radius: 9999px;
}

.preview-canvas {
    flex: 1;
    position: relative;
}

.alarm-screen-flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 18;
    background: var(--alarm-flash-color, rgba(239, 68, 68, 0.2));
    opacity: var(--alarm-flash-opacity, 0.2);
    animation: preview-alarm-flash var(--alarm-flash-duration, 1200ms) ease-in-out 2;
}

.alarm-runtime-modal {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
}

.alarm-runtime-modal__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(6, 10, 18, 0.54);
    backdrop-filter: blur(8px);
}

.alarm-runtime-modal__panel {
    position: relative;
    width: min(520px, calc(100% - 32px));
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(16, 22, 34, 0.96);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
    overflow: hidden;
}

.alarm-runtime-modal__header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    padding: 18px 20px 12px;
}

.alarm-runtime-modal__eyebrow {
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(148, 163, 184, 0.9);
    margin-bottom: 6px;
}

.alarm-runtime-modal__title {
    font-size: 18px;
    line-height: 1.4;
    font-weight: 600;
    color: #f8fafc;
}

.alarm-runtime-modal__close {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: #e2e8f0;
    font-size: 18px;
    cursor: pointer;
}

.alarm-runtime-modal__close:hover {
    background: rgba(255, 255, 255, 0.12);
}

.alarm-runtime-modal__body {
    padding: 0 20px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.alarm-runtime-modal__message {
    color: rgba(226, 232, 240, 0.92);
    line-height: 1.7;
    font-size: 14px;
    white-space: pre-wrap;
}

.alarm-runtime-modal__severity {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 12px;
    color: #fecaca;
    background: rgba(239, 68, 68, 0.12);
}

.alarm-runtime-modal__footer {
    display: flex;
    justify-content: flex-end;
    padding: 0 20px 20px;
}

.canvas-container {
    width: 100%;
    height: 100%;
}

.loading-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(10, 10, 10, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
}

.loading-spinner {
    text-align: center;
}

.spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid var(--color-primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.loading-text {
    color: var(--color-text-primary);
    font-size: 0.875rem;
}

.error-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(10, 10, 10, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
}

.error-content {
    text-align: center;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius);
    padding: 2rem;
    max-width: 28rem;
}

@keyframes preview-alarm-flash {
    0%,
    100% {
        opacity: 0;
    }
    25%,
    75% {
        opacity: var(--alarm-flash-opacity, 0.2);
    }
}
</style>
