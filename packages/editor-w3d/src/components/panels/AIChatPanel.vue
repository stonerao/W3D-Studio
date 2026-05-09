<template>
    <div class="ai-chat-panel">
        <div class="ai-chat-panel__toolbar">
            <div>
                <div class="ai-chat-panel__title">三维 AI</div>
                <div class="ai-chat-panel__meta">
                    {{ aiSettings.isConfigured ? `${providerLabel} · ${aiSettings.model}` : '未配置 API Key' }}
                </div>
            </div>
            <Button variant="outline" size="sm" :disabled="isLoading || messages.length === 0" @click="clearMessages">
                清空
            </Button>
        </div>

        <div class="ai-settings">
            <div class="setting-row">
                <label>供应商</label>
                <select v-model="aiSettings.provider" class="setting-control" @change="handleProviderChange">
                    <option
                        v-for="option in aiSettings.providerOptions"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </option>
                </select>
            </div>
            <div class="setting-row">
                <label>API Base URL</label>
                <input
                    :key="`${aiSettings.provider}-base-url`"
                    v-model.trim="aiSettings.baseUrl"
                    class="setting-control"
                    type="text"
                    :placeholder="baseUrlPlaceholder"
                />
            </div>
            <div class="setting-row">
                <label>Model</label>
                <input
                    :key="`${aiSettings.provider}-model`"
                    v-model.trim="aiSettings.model"
                    class="setting-control"
                    type="text"
                    :placeholder="modelPlaceholder"
                />
            </div>
            <div class="setting-row">
                <label>API Key</label>
                <div class="api-key-row">
                    <input
                        v-model.trim="aiSettings.apiKey"
                        class="setting-control"
                        :type="showApiKey ? 'text' : 'password'"
                        placeholder="sk-..."
                        autocomplete="off"
                    />
                    <button type="button" class="mini-button" @click="showApiKey = !showApiKey">
                        {{ showApiKey ? '隐藏' : '显示' }}
                    </button>
                    <button type="button" class="mini-button" :disabled="!aiSettings.apiKey" @click="aiSettings.clearApiKey">
                        清除
                    </button>
                </div>
            </div>
        </div>

        <div class="ai-chat-panel__quick">
            <button
                v-for="item in quickPrompts"
                :key="item"
                type="button"
                class="quick-prompt"
                :disabled="isLoading || !aiSettings.isConfigured"
                @click="submitQuickPrompt(item)"
            >
                {{ item }}
            </button>
        </div>

        <div ref="messageListRef" class="ai-chat-panel__messages">
            <div v-if="messages.length === 0" class="empty-state">
                输入需求后，AI 会结合当前场景组件给出回复；低风险操作会自动执行，需要确认的操作会停留等待。
            </div>

            <div
                v-for="message in messages"
                :key="message.id"
                class="chat-message"
                :class="[
                    `chat-message--${message.role}`,
                    { 'chat-message--error': message.isError }
                ]"
            >
                <div class="chat-message__role">{{ message.role === 'user' ? '你' : 'AI' }}</div>
                <div class="chat-message__content">{{ message.content }}</div>

                <div v-if="message.actionSummary" class="chat-message__summary">
                    {{ message.actionSummary }}
                </div>

                <div v-if="message.actions?.length" class="action-block">
                    <div class="action-block__header">
                        <span>操作 {{ message.actions.length }} 项</span>
                        <span v-if="message.executed" class="action-status action-status--done">已执行</span>
                        <span v-else-if="message.requireConfirmation" class="action-status action-status--pending">待确认</span>
                    </div>
                    <div class="action-list">
                        <div v-for="(action, index) in message.actions" :key="index" class="action-row">
                            <span class="action-row__name">{{ action.action || action.type || action.name }}</span>
                            <code class="action-row__params">{{ formatActionParams(action.params) }}</code>
                        </div>
                    </div>
                    <Button
                        v-if="message.requireConfirmation && !message.executed"
                        variant="primary"
                        size="sm"
                        :disabled="isLoading"
                        @click="executeMessageActions(message)"
                    >
                        执行动作
                    </Button>
                </div>

                <div v-if="message.actionResults?.length" class="result-list">
                    <div
                        v-for="(result, index) in message.actionResults"
                        :key="index"
                        class="result-row"
                        :class="{ 'result-row--failed': !result.success }"
                    >
                        {{ result.action }}：{{ result.message }}
                    </div>
                </div>
            </div>
        </div>

        <form class="ai-chat-panel__input" @submit.prevent="submit">
            <textarea
                v-model="draft"
                class="ai-input"
                rows="3"
                placeholder="例如：添加一个模型加载器并放到原点"
                :disabled="isLoading || !aiSettings.isConfigured"
                @keydown.enter.exact.prevent="submit"
            ></textarea>
            <div class="ai-chat-panel__input-actions">
                <div class="ai-chat-panel__error">{{ error || configHint }}</div>
                <Button
                    variant="primary"
                    size="sm"
                    :disabled="isLoading || !draft.trim() || !aiSettings.isConfigured"
                    @click.prevent="submit"
                >
                    {{ isLoading ? '请求中' : '发送' }}
                </Button>
            </div>
        </form>
    </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import Button from '../ui/Button.vue';
import { useAIChat } from '../../composables/useAIChat';
import { useToast } from '../../composables/useToast';
import { AI_PROVIDER_PRESETS, useAISettingsStore } from '../../stores/useAISettingsStore';

const {
    messages,
    isLoading,
    error,
    sendMessage,
    executeActions,
    clearMessages
} = useAIChat();

const aiSettings = useAISettingsStore();
const toast = useToast();
const draft = ref('');
const messageListRef = ref(null);
const showApiKey = ref(false);

const quickPrompts = [
    '概括当前场景',
    '添加模型加载器',
    '把选中组件移动到原点'
];

const activeProviderPreset = computed(() => (
    AI_PROVIDER_PRESETS[aiSettings.provider] || AI_PROVIDER_PRESETS.deepseek
));

const providerLabel = computed(() => (
    activeProviderPreset.value.label || aiSettings.provider
));

const baseUrlPlaceholder = computed(() => (
    activeProviderPreset.value.baseUrl || 'https://api.example.com/v1'
));

const modelPlaceholder = computed(() => (
    activeProviderPreset.value.model || 'model-id'
));

const configHint = computed(() => {
    if (aiSettings.isConfigured) return '';
    return '请先配置供应商、Model 和 API Key';
});

const scrollToBottom = async () => {
    await nextTick();
    const el = messageListRef.value;
    if (el) {
        el.scrollTop = el.scrollHeight;
    }
};

const submit = async () => {
    const text = draft.value.trim();
    if (!text || isLoading.value || !aiSettings.isConfigured) return;
    draft.value = '';
    await sendMessage(text, { autoExecute: true });
    await scrollToBottom();
};

const submitQuickPrompt = async (text) => {
    if (isLoading.value || !aiSettings.isConfigured) return;
    await sendMessage(text, { autoExecute: true });
    await scrollToBottom();
};

const handleProviderChange = () => {
    aiSettings.applyProviderPreset(aiSettings.provider);
};

const executeMessageActions = async (message) => {
    try {
        const result = await executeActions(message.actions || [], message.id);
        if (result?.success) {
            toast.success('AI 动作已执行');
        } else {
            toast.warning(result?.message || '部分 AI 动作执行失败');
        }
    } catch (err) {
        toast.error(err?.message || String(err));
    }
};

const formatActionParams = (params = {}) => {
    const text = JSON.stringify(params || {});
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

watch(() => messages.value.length, scrollToBottom);
</script>

<style scoped>
.ai-chat-panel {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    color: var(--color-text-primary);
}

.ai-chat-panel__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
}

.ai-chat-panel__title {
    font-size: 0.875rem;
    font-weight: 600;
}

.ai-chat-panel__meta {
    margin-top: 0.125rem;
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
}

.ai-settings {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    background: rgba(15, 23, 42, 0.3);
}

.setting-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.setting-row label {
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
}

.setting-control {
    width: 100%;
    min-width: 0;
    height: 2rem;
    padding: 0 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: rgba(2, 6, 23, 0.42);
    color: var(--color-text-primary);
    font-size: 0.75rem;
    outline: none;
}

.setting-control:focus {
    border-color: rgba(96, 165, 250, 0.65);
}

.api-key-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.375rem;
}

.mini-button {
    min-width: 2.75rem;
    height: 2rem;
    padding: 0 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--border-radius-sm);
    background: rgba(15, 23, 42, 0.52);
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
    cursor: pointer;
}

.mini-button:hover:not(:disabled) {
    color: var(--color-text-primary);
    border-color: rgba(96, 165, 250, 0.5);
}

.mini-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.ai-chat-panel__quick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
}

.quick-prompt {
    min-height: 1.75rem;
    padding: 0 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--border-radius-sm);
    background: rgba(15, 23, 42, 0.52);
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
    cursor: pointer;
}

.quick-prompt:hover:not(:disabled) {
    color: var(--color-text-primary);
    border-color: rgba(96, 165, 250, 0.5);
}

.quick-prompt:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.ai-chat-panel__messages {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0.75rem;
}

.empty-state {
    padding: 1rem 0.25rem;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    line-height: 1.6;
}

.chat-message {
    margin-bottom: 0.75rem;
    padding: 0.625rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius);
    background: rgba(15, 23, 42, 0.42);
}

.chat-message--user {
    background: rgba(37, 99, 235, 0.14);
    border-color: rgba(96, 165, 250, 0.24);
}

.chat-message--error {
    border-color: rgba(239, 68, 68, 0.45);
}

.chat-message__role {
    margin-bottom: 0.375rem;
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
}

.chat-message__content {
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.8125rem;
    line-height: 1.55;
}

.chat-message__summary {
    margin-top: 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
}

.action-block {
    margin-top: 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.action-block__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
}

.action-status {
    padding: 0.125rem 0.375rem;
    border-radius: var(--border-radius-sm);
}

.action-status--done {
    color: #10b981;
    background: rgba(16, 185, 129, 0.12);
}

.action-status--pending {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.12);
}

.action-list,
.result-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.action-row,
.result-row {
    padding: 0.375rem;
    border-radius: var(--border-radius-sm);
    background: rgba(2, 6, 23, 0.32);
    font-size: 0.6875rem;
}

.action-row__name {
    display: block;
    color: #93c5fd;
    margin-bottom: 0.25rem;
}

.action-row__params {
    display: block;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.result-row {
    color: #10b981;
}

.result-row--failed {
    color: #f87171;
}

.ai-chat-panel__input {
    flex: 0 0 auto;
    padding: 0.75rem;
    border-top: 1px solid var(--color-border);
}

.ai-input {
    width: 100%;
    resize: vertical;
    min-height: 4.75rem;
    max-height: 10rem;
    padding: 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    background: rgba(2, 6, 23, 0.42);
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    line-height: 1.5;
    outline: none;
}

.ai-input:focus {
    border-color: rgba(96, 165, 250, 0.65);
}

.ai-input:disabled {
    opacity: 0.58;
    cursor: not-allowed;
}

.ai-chat-panel__input-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.5rem;
}

.ai-chat-panel__error {
    min-width: 0;
    color: #f87171;
    font-size: 0.6875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
