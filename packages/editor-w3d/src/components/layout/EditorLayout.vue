<template>
    <div class="editor-layout flex flex-col w-full h-full">
        <!-- 顶部工具栏 -->
        <ErrorBoundary v-if="showToolbar">
            <TopToolbar
                :project-id="projectId"
                :persist-project="persistProject"
                :reload-project="reloadProject"
                @save="handleSave"
                @export="handleExport"
                @config-change="handleConfigChange"
                @request-reload="handleReload"
                @preview="handlePreview"
                @close="handleClose"
            />
        </ErrorBoundary>

        <!-- 主内容区域：左-中-右三栏布局 -->
        <div class="editor-main flex flex-1 overflow-hidden" :style="mainStyle">
            <!-- 左侧面板 -->
            <ErrorBoundary v-if="editorStore.showLeftPanel">
                <LeftPanel />
            </ErrorBoundary>

            <!-- 中间画布区域 -->
            <div class="editor-main__center">
                <ErrorBoundary>
                    <CenterCanvas class="editor-main__canvas" />
                </ErrorBoundary>
            </div>

            <!-- 右侧面板 -->
            <ErrorBoundary v-if="editorStore.showRightPanel">
                <RightPanel />
            </ErrorBoundary>
        </div>

        <!-- Toast 和 ConfirmDialog 组件（嵌入使用时需要） -->
        <Toast ref="toastRef" />
        <ConfirmDialog />
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, watch, ref, provide } from 'vue';
import { useEditorStore } from '../../stores/useEditorStore';
import { useKeyboard, SHORTCUTS } from '../../composables/useKeyboard';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useComponentStore } from '../../stores/useComponentStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { useVariableStore } from '../../stores/useVariableStore';
import { useDataSourceStore } from '../../stores/useDataSourceStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import { normalizeComponentMethodDefinitions } from '@w3d/components';
import { getComponentMethodDefinitions } from '../../utils/componentRegistry';
import ErrorBoundary from '../ui/ErrorBoundary.vue';
import TopToolbar from './TopToolbar.vue';
import LeftPanel from './LeftPanel.vue';
import CenterCanvas from './CenterCanvas.vue';
import RightPanel from './RightPanel.vue';
import Toast from '../ui/Toast.vue';
import ConfirmDialog from '../ui/ConfirmDialog.vue';

const props = defineProps({
    projectData: {
        type: Object,
        default: null
    },
    showToolbar: {
        type: Boolean,
        default: true
    },
    showLeftPanel: {
        type: Boolean,
        default: true
    },
    showRightPanel: {
        type: Boolean,
        default: true
    },
    readonly: {
        type: Boolean,
        default: false
    },
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

const emit = defineEmits(['save', 'export', 'dataUpdate', 'configChange', 'requestReload', 'preview', 'close']);

const editorStore = useEditorStore();
const keyboard = useKeyboard();
const historyStore = useHistoryStore();
const projectStore = useProjectStore();
const componentStore = useComponentStore();
const sceneStore = useSceneStore();
const variableStore = useVariableStore();
const dataSourceStore = useDataSourceStore();
const alarmStore = useAlarmStore();
const { removeComponent, executeDataBinding, applyAllComponentVariableBindings } = useComponent();
const toast = useToast();

// Toast 组件引用（用于嵌入使用时初始化）
const toastRef = ref(null);

let markDirtyTimer = null;
let emitDataTimer = null;
let panelResizeFrame = null;
let panelResizeFollowUpFrame = null;

const lastAppliedSignature = ref('');
const lastEmittedSignature = ref('');

// 标记是否正在应用外部数据，避免反序列化触发的 store 变化被误判为用户编辑
const isApplyingData = ref(false);

const showToolbar = computed(() => props.showToolbar);
const currentEditorProjectId = computed(() => String(props.projectId || '').trim());
const runtimeMode = computed(() => (props.readonly ? 'preview' : 'editor'));
const mainStyle = computed(() => ({
    height: showToolbar.value ? 'calc(100% - var(--toolbar-height))' : '100%'
}));

provide('editorProjectId', currentEditorProjectId);

const cancelPendingSceneResize = () => {
    if (panelResizeFrame) {
        cancelAnimationFrame(panelResizeFrame);
        panelResizeFrame = null;
    }
    if (panelResizeFollowUpFrame) {
        cancelAnimationFrame(panelResizeFollowUpFrame);
        panelResizeFollowUpFrame = null;
    }
};

const resizeSceneToContainer = async () => {
    cancelPendingSceneResize();

    await nextTick();

    panelResizeFrame = requestAnimationFrame(() => {
        panelResizeFollowUpFrame = requestAnimationFrame(() => {
            const renderer = sceneStore.sceneInstance?.renderer;
            if (renderer?.resize) {
                renderer.resize();
            } else {
                window.dispatchEvent(new Event('resize'));
            }
            panelResizeFrame = null;
            panelResizeFollowUpFrame = null;
        });
    });
};

/**
 * 构建数据签名（用于比较数据是否变化）
 * 只对编辑器关心的字段做签名，忽略外部系统附加的元字段（如 id/createdAt/updatedAt/savedAt 等）
 */
const normalizeProjectDataForSignature = (raw) => {
    const data = raw && typeof raw === 'object' ? raw : {};
    const scene = data.scene || data.sceneConfig || {};

    const normalizeArray = (arr, key = 'id') => {
        if (!Array.isArray(arr)) return [];
        // 仅用于签名比较：排序保证稳定性，避免因为顺序变化导致误判为变更
        const copy = [...arr];
        copy.sort((a, b) => {
            const av = a && typeof a === 'object' ? a[key] : a;
            const bv = b && typeof b === 'object' ? b[key] : b;
            const as = av == null ? '' : String(av);
            const bs = bv == null ? '' : String(bv);
            return as.localeCompare(bs);
        });
        return copy;
    };

    return {
        schemaVersion: Number.isFinite(Number(data.schemaVersion)) ? Number(data.schemaVersion) : 1,
        version: data.version || '1.0.0',
        name: data.name || '未命名项目',
        apiBaseUrl: data.apiBaseUrl || 'http://localhost:3000/',
        scene: {
            renderer: scene.renderer || {},
            camera: scene.camera || {},
            lighting: scene.lighting || {},
            background: scene.background || {},
            controls: scene.controls || {},
            helpers: scene.helpers || {}
        },
        components: normalizeArray(data.components, 'id'),
        variables: normalizeArray(data.variables, 'name'),
        dataSourceConfig: data.dataSourceConfig || null,
        alarmRules: data.alarmRules || null
    };
};

const buildSignature = (data) => {
    try {
        if (!data) return '';
        return JSON.stringify(normalizeProjectDataForSignature(data));
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

const applyProjectData = async (data, forceRestore = false) => {
    console.log('[EditorLayout] applyProjectData 被调用:', {
        hasData: !!data,
        componentsCount: data?.components?.length || 0,
        hasScene: !!data?.scene,
        forceRestore
    });

    const signature = buildSignature(data);
    if (signature && signature === lastAppliedSignature.value && !forceRestore) {
        console.log('[EditorLayout] 数据未变化，跳过反序列化');

        // 即使跳过反序列化，也要确保组件实例已恢复到场景中
        // 这是为了处理场景重新初始化但数据未变化的情况
        if (sceneStore.sceneInstance && componentStore.components.length > 0) {
            const hasInstancesInScene = componentStore.components.some(c => c.instance);
            if (!hasInstancesInScene) {
                console.log('[EditorLayout] 检测到场景已初始化但组件实例未恢复，强制恢复...');
                const result = await projectStore.restoreRuntimeIfPending(true, runtimeMode.value); // force = true
                console.log('[EditorLayout] 强制恢复结果:', result);
            }
        }
        return;
    }

    console.log('[EditorLayout] 开始反序列化数据...');

    // 标记正在应用外部数据，避免触发 dataUpdate
    isApplyingData.value = true;

    try {
        await projectStore.deserializeProject(data || {}, runtimeMode.value);
        lastAppliedSignature.value = signature;
        // 同步更新 lastEmittedSignature，避免反序列化后的数据再次触发更新
        lastEmittedSignature.value = buildSignature(projectStore.serializeProject());
        projectStore.hasUnsavedChanges = false;
        console.log('[EditorLayout] 反序列化完成');
    } finally {
        // 延迟重置标记，确保 watch 回调不会在反序列化后立即触发
        // 注意：此延迟必须大于 markDirty 中的延迟(200ms)，以避免竞态条件
        setTimeout(() => {
            isApplyingData.value = false;
        }, 500);
    }
};

const emitProjectData = (eventName) => {
    const data = projectStore.serializeProject();
    const signature = buildSignature(data);
    lastEmittedSignature.value = signature;
    emit(eventName, data);
};

const scheduleDataUpdate = () => {
    // 如果正在应用外部数据，不触发 dataUpdate
    if (isApplyingData.value) return;

    if (emitDataTimer) clearTimeout(emitDataTimer);
    emitDataTimer = setTimeout(() => {
        emitProjectData('dataUpdate');
    }, 300);
};

// 注册快捷键
onMounted(async () => {
    console.log('[EditorLayout] ========== EditorLayout 组件挂载 ==========');
    console.log('[EditorLayout] Props:', {
        hasProjectData: !!props.projectData,
        projectDataKeys: props.projectData ? Object.keys(props.projectData) : [],
        readonly: props.readonly,
        showToolbar: props.showToolbar,
        showLeftPanel: props.showLeftPanel,
        showRightPanel: props.showRightPanel
    });

    // 初始化 Toast 实例（嵌入使用时需要）
    if (toastRef.value) {
        toast.setToastInstance(toastRef.value);
    }

    // 重置签名状态，确保每次挂载时数据能正确加载
    lastAppliedSignature.value = '';
    lastEmittedSignature.value = '';

    // 重置 hasUnsavedChanges 状态，避免第二次打开时误触发确认对话框
    projectStore.hasUnsavedChanges = false;

    editorStore.setMode(props.readonly ? 'preview' : 'edit');
    alarmStore.setAutoEvaluationEnabled(props.readonly, { clearActiveAlarms: !props.readonly });
    editorStore.showLeftPanel = props.showLeftPanel;
    editorStore.showRightPanel = props.showRightPanel;

    console.log('[EditorLayout] 编辑器模式:', editorStore.mode);
    console.log('[EditorLayout] 面板显示:', {
        showLeftPanel: editorStore.showLeftPanel,
        showRightPanel: editorStore.showRightPanel
    });

    // 强制应用项目数据
    console.log('[EditorLayout] 开始加载项目数据...');
    await applyProjectData(props.projectData || {});
    console.log('[EditorLayout] 项目数据加载完成');
    triggerRunOnLoadDataSources();
    resizeSceneToContainer();

    // 撤回
    keyboard.register(SHORTCUTS.UNDO, async () => {
        if (historyStore.canUndo) {
            await historyStore.undo();
            toast.success('已撤回操作');
        }
    }, { description: '撤回上一步操作' });

    // 重做
    keyboard.register(SHORTCUTS.REDO, async () => {
        if (historyStore.canRedo) {
            await historyStore.redo();
            toast.success('已重做操作');
        }
    }, { description: '重做上一步操作' });

    // 保存
    keyboard.register(SHORTCUTS.SAVE, () => {
        handleSave();
    }, { description: '保存项目' });

    // 删除选中组件
    keyboard.register(SHORTCUTS.DELETE, () => {
        if (componentStore.selectedComponentId) {
            const component = componentStore.selectedComponent;
            try {
                removeComponent(componentStore.selectedComponentId);
                toast.success(`已删除组件: ${component?.name || '未命名'}`);
            } catch (error) {
                console.error('[EditorLayout] Delete shortcut failed:', error);
                toast.error(`删除组件失败: ${component?.name || '未命名'}`);
            }
        }
    }, { description: '删除选中组件', preventDefault: true });

    console.log('[EditorLayout] Keyboard shortcuts registered');

    // ===== 自动保存：监听场景/组件变化，节流后同步到页面状态 =====
    const markDirty = () => {
        // 如果正在应用外部数据，不触发 dirty 标记
        if (isApplyingData.value) return;

        if (markDirtyTimer) clearTimeout(markDirtyTimer);
        markDirtyTimer = setTimeout(() => {
            // 双重检查：延迟回调执行时再次检查 isApplyingData
            // 避免 deserializeProject 期间的 updateComponentInstance 触发循环
            if (isApplyingData.value) return;
            projectStore.markAsUnsaved();
            scheduleDataUpdate();
        }, 200);
    };

    watch(
        () => sceneStore.configVersion,
        () => markDirty()
    );

    watch(
        () => componentStore.serialVersion,
        () => markDirty()
    );

    watch(
        () => alarmStore.serialize(),
        () => markDirty(),
        { deep: true }
    );

   /*  watch(
        () => variableStore.variables,
        () => markDirty(),
        { deep: true }
    );

    watch(
        () => dataSourceStore.globalConfig,
        () => markDirty(),
        { deep: true }
    );

    watch(
        () => projectStore.projectName,
        () => markDirty()
    );

    watch(
        () => projectStore.apiBaseUrl,
        () => markDirty()
    ); */
});

watch(
    () => props.projectData,
    async (nextData) => {
        if (!nextData) return;
        const signature = buildSignature(nextData);
        if (signature && signature === lastEmittedSignature.value) return;
        await applyProjectData(nextData);
    },
    { deep: true }
);

watch(
    () => props.readonly,
    (readonly) => {
        editorStore.setMode(readonly ? 'preview' : 'edit');
        alarmStore.setAutoEvaluationEnabled(readonly, { clearActiveAlarms: !readonly });
    }
);

watch(
    () => (variableStore.variables || []).map((item) => ({
        name: item.name,
        value: item.value,
        updatedAt: item.updatedAt
    })),
    () => {
        applyAllComponentVariableBindings().catch((error) => {
            console.warn('[EditorLayout] failed to apply variable bindings:', error);
        });
    },
    { deep: true, immediate: true }
);

watch(
    () => componentStore.serialVersion,
    () => {
        applyAllComponentVariableBindings().catch((error) => {
            console.warn('[EditorLayout] failed to sync variable bindings after component change:', error);
        });
    },
    { immediate: true }
);

watch(
    () => props.showLeftPanel,
    (value) => {
        editorStore.showLeftPanel = value;
    }
);

watch(
    () => props.showRightPanel,
    (value) => {
        editorStore.showRightPanel = value;
    }
);

watch(
    () => [editorStore.showLeftPanel, editorStore.showRightPanel, showToolbar.value],
    () => {
        resizeSceneToContainer();
    }
);

const handleSave = () => {
    const data = projectStore.serializeProject();
    console.log('[EditorLayout] 保存触发，序列化数据:', {
        hasData: !!data,
        componentsCount: data?.components?.length || 0,
        hasScene: !!data?.scene
    });
    emitProjectData('save');
    projectStore.lastSavedAt = new Date().toISOString();
    projectStore.hasUnsavedChanges = false;
    toast.success('项目已保存');
};

const handleExport = () => {
    emitProjectData('export');
};

const handleConfigChange = (config) => {
    emit('configChange', config);
};

const handleReload = () => {
    if (!props.projectData) return;
    applyProjectData(props.projectData);
    emit('requestReload');
};

const handlePreview = () => {
    emit('preview');
};

const triggerRunOnLoadDataSources = () => {
    const allComponents = Array.isArray(componentStore.components) ? componentStore.components : [];
    allComponents.forEach((component) => {
        const sources = Array.isArray(component?.dataBinding?.sources) ? component.dataBinding.sources : [];
        const runOnLoadSources = sources.filter((source) => {
            const mode = String(source?.mode || '').toLowerCase();
            return source?.id && (source?.runOnLoad === true || mode === 'websocket' || mode === 'mqtt');
        });
        runOnLoadSources.forEach((source) => {
            const delayMs = Math.max(0, Number(source?.startupDelaySeconds || 0)) * 1000;
            window.setTimeout(() => {
                executeDataBinding(component.id, source.id, projectStore.apiBaseUrl).catch((error) => {
                    console.warn('[EditorLayout] runOnLoad data source execute failed:', {
                        componentId: component?.id,
                        sourceId: source?.id,
                        error
                    });
                });
            }, delayMs);
        });
    });
};

// 关闭编辑器
const handleClose = () => {
    emit('close');
};

const getSceneInstance = () => {
    return sceneStore.sceneInstance;
};

const getSerializedProjectData = () => {
    return projectStore.serializeProject();
};

const normalizeComponentCommand = (command) => {
    if (!command || typeof command !== 'object') return null;

    // 兼容旧结构：{ action: 'start'|'reset', componentId }
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

const getRuntimeComponentMethods = (component) => {
    if (!component) return [];
    const methods = [];
    let proto = Object.getPrototypeOf(component);
    const skipClasses = new Set(['Group', 'Object3D', 'EventDispatcher']);
    while (proto && !skipClasses.has(proto.constructor?.name)) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === 'constructor') continue;
            try {
                if (typeof proto[key] === 'function' && !key.startsWith('_')) methods.push(key);
            } catch {}
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
                        console.warn('[EditorLayout] executeDataBinding command failed:', error);
                    });
            });
        } else {
            executeDataBinding(targetComponent.id, null, apiBaseUrl)
                .catch((error) => {
                    console.warn('[EditorLayout] executeDataBinding command failed:', error);
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
        if (componentId) return component.id === componentId;
        return true;
    });

    if (target?.instance && invokeMethodWithFallback(target.instance, method, args || [])) {
        return { success: true, componentId: target.id, componentType: target.type, method };
    }

    const sceneInstance = sceneStore.sceneInstance;
    const componentsMap = sceneInstance?.componentManager?.components || sceneInstance?.components;
    if (!componentsMap) {
        return { success: false, reason: 'scene_not_initialized', method, componentId, componentType };
    }

    // 构建 [name, component] 列表以支持按 name 匹配
    const entries = [];
    componentsMap.forEach((component, name) => {
        entries.push([name, component]);
    });

    const matchByComponentId = ([name, component]) => {
        if (!component) return false;
        if (!canInvokeMethod(component, method)) return false;
        if (!componentId) return true;
        return name === componentId
            || component?.name === componentId
            || component?.config?.name === componentId
            || component?.config?.id === componentId
            || String(component?.id) === componentId;
    };

    const matchByComponentIdAndType = ([name, component]) => {
        if (!matchByComponentId([name, component])) return false;
        const runtimeType = component?.config?.type || component?.type || component?.constructor?.name || '';
        return !componentType || runtimeType === componentType;
    };

    const typedRuntimeEntry = componentId && componentType ? entries.find(matchByComponentIdAndType) : null;
    const idRuntimeEntry = componentId ? entries.find(matchByComponentId) : null;
    const runtimeEntry = typedRuntimeEntry || idRuntimeEntry || null;

    const runtimeTarget = runtimeEntry?.[1] || null;

    if (runtimeTarget && invokeMethodWithFallback(runtimeTarget, method, args || [])) {
        return {
            success: true,
            componentId: runtimeEntry?.[0] || runtimeTarget?.name || '',
            componentType: componentType || runtimeTarget?.config?.type || runtimeTarget?.type || runtimeTarget?.constructor?.name || '',
            method
        };
    }

    return { success: false, reason: 'component_or_method_not_found', method, componentId, componentType };
};

const executeExplodedViewAction = (action = 'start', componentId = '') => {
    return executeComponentCommand({
        componentType: 'ExplodedView',
        componentId,
        method: action === 'reset' ? 'reset' : 'start'
    });
};

const startExplodedView = (componentId = '') => {
    return executeExplodedViewAction('start', componentId);
};

const resetExplodedView = (componentId = '') => {
    return executeExplodedViewAction('reset', componentId);
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
                console.warn('[EditorLayout] 读取模型结构树失败:', error);
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

defineExpose({
    getSceneInstance,
    getSerializedProjectData,
    executeComponentCommand,
    executeVariableCommand,
    executeExplodedViewAction,
    startExplodedView,
    resetExplodedView,
    listSceneComponents
});

// 卸载时清理快捷键
onUnmounted(() => {
    keyboard.unregisterAll();
    if (markDirtyTimer) clearTimeout(markDirtyTimer);
    if (emitDataTimer) clearTimeout(emitDataTimer);
    cancelPendingSceneResize();
    console.log('[EditorLayout] Keyboard shortcuts unregistered');
});
</script>

<style scoped>
.editor-layout {
    background-color: var(--color-bg-secondary);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
}

.editor-main {
    min-width: 0;
    min-height: 0;
}

.editor-main__center {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    width: 0;
    overflow: hidden;
}

.editor-main__canvas {
    width: 100%;
    height: 100%;
}
</style>
