<template>
    <div class="preview-page">
        <!-- 顶部工具栏 -->
        <!-- <div v-if="showToolbar" class="preview-toolbar">
            <div class="toolbar-left">
                <span class="project-name">{{ projectName }}</span>
            </div>
            <div class="toolbar-right">
                <span class="preview-badge">{{ headerTitle }}</span>
            </div>
        </div> -->

        <!-- 3D 画布区域 -->
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

            <!-- 加载状态 -->
            <div v-if="isLoading" class="loading-overlay">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p class="loading-text">加载中...</p>
                </div>
            </div>

            <!-- 错误状态 -->
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
     * 是否启用三维场景内的交互事件（点击、悬停等）。
     * 设为 false 时，EventSystem 将静默忽略所有交互事件。
     * 用于编辑模式下禁止三维对象的事件触发。
     */
    interactiveEnabled: {
        type: Boolean,
        default: true
    }
});

// 画布容器
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

// 场景管理
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

// 用于防止重复加载的签名
const lastLoadedSignature = ref('');
// 标记是否正在加载，避免重入
const isLoadingProject = ref(false);
let pendingProjectReload = false;
let currentLoadToken = 0;
const runOnLoadTimerIds = new Set();

// 状态
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

// 监听 interactiveEnabled 变化，同步到核心 EventSystem
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
 * 构建数据签名，用于判断数据是否真正变化
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
 * 加载工程数据
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

        // 清理旧场景，避免重复初始化
        disposePreviewScene();

        await projectStore.deserializeProject(props.projectData || {}, 'preview');
        if (!isCurrentLoad(token)) return;

        // 记录已加载的数据签名
        lastLoadedSignature.value = signature;

        // 获取项目名称
        projectName.value = projectStore.projectName || '未命名项目';

        console.log('[Preview] 项目数据已加载:', {
            name: projectStore.projectName,
            components: componentStore.components.length,
            sceneConfig: sceneStore.sceneConfig
        });

        // 初始化场景（initScene 内部会在 Scene 就绪后自动执行“待处理的运行时恢复”）
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
 * 初始化场景
 */
const initializeScene = async () => {
    if (!canvasContainer.value) {
        throw new Error('画布容器未找到');
    }

    try {
        // 使用 usePreviewScene 初始化场景
        const scene = await initPreviewScene(canvasContainer.value, { isControls: isControls.value });

        // 初始化后立即同步 interactiveEnabled 到 EventSystem
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
 * 清理场景
 */
const cleanup = () => {
    console.log('[Preview] 清理场景资源');
    currentLoadToken += 1;
    clearRunOnLoadTimers();
    alarmRuntime.disposeAlarmRuntime();
    disposePreviewScene();
};

// 组件挂载时加载工程
onMounted(() => {
    alarmStore.setAutoEvaluationEnabled(true, { clearActiveAlarms: false });
    if (toastRef.value) {
        toast.setToastInstance(toastRef.value);
        console.log('[Preview] toast instance ready');
    }
    void loadProject();
});

// 注意：移除了 deep watch，避免编辑状态下频繁触发更新
// 父组件需要在适当时机（如点击"编辑三维"、"保存"）调用 refresh() 方法手动触发更新
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

// 组件卸载时清理场景
onUnmounted(() => {
    alarmStore.setAutoEvaluationEnabled(false);
    cleanup();
});

/**
 * 强制刷新预览
 * 供父组件在需要时调用（如保存、编辑三维按钮点击时）
 */
const refresh = () => {
    // 重置签名以强制重新加载
    lastLoadedSignature.value = '';
    void loadProject();
};

/**
 * 增量更新场景配置
 * 不重新初始化场景，只更新变化的配置项
 * @param {Object} projectData - 项目数据
 * @param {boolean} forceUpdate - 是否强制更新所有配置
 * @returns {Promise<Object>} 更新结果
 */
const updateScene = async (projectData, forceUpdate = false) => {
    if (!sceneStore.sceneInstance) {
        console.warn('[Preview] 场景未初始化，无法增量更新');
        return { success: false, reason: 'scene_not_initialized' };
    }

    console.log('[Preview] 执行增量更新', { forceUpdate });

    // 调用 usePreviewScene 的 update 方法进行增量更新
    const result = await updatePreviewScene(projectData, forceUpdate);

    // 更新已加载的数据签名
    if (result.success && result.updatedItems?.length > 0) {
        lastLoadedSignature.value = buildSignature(projectData);
    }

    return result;
};

/**
 * 暂停预览场景
 * 当切换到编辑模式时调用，停止渲染循环但保留场景状态
 * @returns {boolean} 是否成功暂停
 */
const pause = () => {
    console.log('[Preview] 暂停场景渲染');
    return pausePreviewScene();
};

/**
 * 恢复预览场景
 * 当从编辑模式切换回预览模式时调用
 * @returns {boolean} 是否成功恢复
 */
const resume = () => {
    console.log('[Preview] 恢复场景渲染');
    return resumePreviewScene();
};

/**
 * 检查场景是否正在运行
 * @returns {boolean} 是否正在运行
 */
const isRunning = () => {
    return isSceneRunning();
};

/**
 * 获取场景实例
 * @returns {Scene|null} 场景实例
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
 * 列出场景中所有组件的详细信息（调试用）
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

// 暴露方法供父组件调用
defineExpose({
    // 加载和刷新
    refresh,
    loadProject,
    updateScene,
    getSceneInstance,
    executeComponentCommand,
    executeVariableCommand,
    listSceneComponents,
    // 暂停/恢复控制
    pause,
    resume,
    isRunning,
    // 直接暴露场景实例（兼容旧的调用方式）
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
