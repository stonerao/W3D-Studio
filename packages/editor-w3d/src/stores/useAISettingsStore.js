import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'w3d_editor_ai_settings';

export const AI_PROVIDER_PRESETS = Object.freeze({
    deepseek: Object.freeze({
        provider: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash'
    }),
    openai: Object.freeze({
        provider: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5-mini'
    }),
    minimax: Object.freeze({
        provider: 'minimax',
        label: 'MiniMax',
        baseUrl: 'https://api.minimax.io/v1',
        model: 'MiniMax-M2.7'
    }),
    openaiCompatible: Object.freeze({
        provider: 'openaiCompatible',
        label: 'OpenAI 兼容',
        baseUrl: '',
        model: ''
    }),
    custom: Object.freeze({
        provider: 'custom',
        label: '自定义',
        baseUrl: '',
        model: ''
    })
});

const getProviderPreset = (provider) => {
    return AI_PROVIDER_PRESETS[provider] || AI_PROVIDER_PRESETS.deepseek;
};

const loadSavedSettings = () => {
    if (typeof localStorage === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
        return {};
    }
};

export const useAISettingsStore = defineStore('aiSettings', () => {
    const saved = loadSavedSettings();
    const initialPreset = getProviderPreset(saved.provider);
    const provider = ref(initialPreset.provider);
    const apiKey = ref(saved.apiKey || '');
    const baseUrl = ref(saved.baseUrl || initialPreset.baseUrl);
    const model = ref(saved.model || initialPreset.model);

    const providerOptions = computed(() => Object.values(AI_PROVIDER_PRESETS).map((item) => ({
        value: item.provider,
        label: item.label
    })));

    const isConfigured = computed(() => {
        return Boolean(apiKey.value.trim() && baseUrl.value.trim() && model.value.trim());
    });

    const applyProviderPreset = (nextProvider) => {
        const preset = getProviderPreset(nextProvider);
        provider.value = preset.provider;
        baseUrl.value = preset.baseUrl;
        model.value = preset.model;
    };

    const clearApiKey = () => {
        apiKey.value = '';
    };

    const toRequestPayload = () => ({
        provider: provider.value,
        apiKey: apiKey.value.trim(),
        baseUrl: baseUrl.value.trim(),
        model: model.value.trim()
    });

    watch(
        () => ({
            provider: provider.value,
            apiKey: apiKey.value,
            baseUrl: baseUrl.value,
            model: model.value
        }),
        (value) => {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        },
        { deep: true }
    );

    return {
        provider,
        apiKey,
        baseUrl,
        model,
        providerOptions,
        isConfigured,
        applyProviderPreset,
        clearApiKey,
        toRequestPayload
    };
});
