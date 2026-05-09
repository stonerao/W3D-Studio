import { computed, ref } from 'vue';
import { chatWithAI } from '../api/aiGateway';
import { editorActions } from '../services/editorActions';
import { useComponentStore } from '../stores/useComponentStore';
import { useAISettingsStore } from '../stores/useAISettingsStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useSceneStore } from '../stores/useSceneStore';
import { currentLocale } from '../i18n';

const ACTION_NAME_MAP = Object.freeze({
    add_component: 'addComponent',
    update_component: 'updateComponentConfig',
    update_component_config: 'updateComponentConfig',
    call_component_method: 'callComponentMethod',
    invoke_component_method: 'callComponentMethod',
    remove_component: 'removeComponent',
    delete_component: 'removeComponent',
    select_component: 'selectComponent',
    deselect_component: 'deselectComponent',
    toggle_component_visibility: 'toggleComponentVisibility',
    update_camera_position: 'updateCameraPosition',
    update_background: 'updateBackground',
    toggle_grid: 'toggleGrid',
    update_renderer: 'updateRenderer',
    create_variable: 'createVariable',
    update_variable: 'updateVariable',
    save_project: 'saveProject',
    toggle_panel: 'togglePanel'
});

const normalizeAction = (item = {}) => {
    const rawName = item.action || item.type || item.name;
    const action = ACTION_NAME_MAP[rawName] || rawName;
    if (!action) return null;
    return {
        action,
        params: item.params || {}
    };
};

const clonePlain = (value, fallback = null) => {
    try {
        return JSON.parse(JSON.stringify(value ?? fallback));
    } catch {
        return fallback;
    }
};

const summarizeComponent = (component) => ({
    id: component.id,
    name: component.name,
    type: component.type,
    visible: component.visible !== false,
    locked: component.locked === true,
    config: clonePlain(component.config || {}, {})
});

export function useAIChat() {
    const componentStore = useComponentStore();
    const aiSettingsStore = useAISettingsStore();
    const projectStore = useProjectStore();
    const sceneStore = useSceneStore();

    const messages = ref([]);
    const isLoading = ref(false);
    const error = ref('');

    const latestAssistantMessage = computed(() => {
        return [...messages.value].reverse().find((item) => item.role === 'assistant') || null;
    });

    const buildContext = () => ({
        project: {
            name: projectStore.projectName,
            hasUnsavedChanges: projectStore.hasUnsavedChanges
        },
        locale: currentLocale.value,
        scene: {
            renderer: clonePlain(sceneStore.sceneConfig.renderer, {}),
            camera: clonePlain(sceneStore.sceneConfig.camera, {}),
            background: clonePlain(sceneStore.sceneConfig.background, {}),
            helpers: clonePlain(sceneStore.sceneConfig.helpers, {})
        },
        selectedComponent: componentStore.selectedComponent
            ? summarizeComponent(componentStore.selectedComponent)
            : null,
        components: componentStore.components.map(summarizeComponent)
    });

    const buildHistory = () => {
        return messages.value
            .filter((item) => item.role === 'user' || item.role === 'assistant')
            .slice(-8)
            .map((item) => ({
                role: item.role,
                content: item.content
            }));
    };

    const executeActions = async (actions, messageId = null) => {
        const normalizedActions = (actions || []).map(normalizeAction).filter(Boolean);
        if (normalizedActions.length === 0) return null;

        const result = await editorActions.executeMultiple(normalizedActions);
        if (messageId) {
            const target = messages.value.find((item) => item.id === messageId);
            if (target) {
                target.actionResults = result?.data || [];
                target.executed = result?.success === true;
            }
        }
        return result;
    };

    const sendMessage = async (content, { autoExecute = true } = {}) => {
        const text = String(content || '').trim();
        if (!text || isLoading.value) return null;

        error.value = '';
        const history = buildHistory();
        const userMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: text
        };
        messages.value.push(userMessage);
        isLoading.value = true;

        try {
            const response = await chatWithAI({
                message: text,
                history,
                context: buildContext(),
                provider: aiSettingsStore.toRequestPayload(),
                locale: currentLocale.value
            });

            const actions = Array.isArray(response.actions) ? response.actions : [];
            const assistantMessage = {
                id: `assistant_${Date.now()}`,
                role: 'assistant',
                content: response.message || '已返回操作建议',
                actions,
                requireConfirmation: response.requireConfirmation === true,
                actionSummary: response.actionSummary || '',
                actionResults: [],
                executed: false,
                model: response.model || ''
            };
            messages.value.push(assistantMessage);

            if (autoExecute && actions.length > 0 && !assistantMessage.requireConfirmation) {
                await executeActions(actions, assistantMessage.id);
            }

            return assistantMessage;
        } catch (err) {
            const message = err?.message || String(err);
            error.value = message;
            messages.value.push({
                id: `assistant_error_${Date.now()}`,
                role: 'assistant',
                content: `AI 请求失败：${message}`,
                isError: true
            });
            return null;
        } finally {
            isLoading.value = false;
        }
    };

    const clearMessages = () => {
        messages.value = [];
        error.value = '';
    };

    return {
        messages,
        isLoading,
        error,
        latestAssistantMessage,
        sendMessage,
        executeActions,
        clearMessages
    };
}
