import { config } from './config.js';

const PROVIDER_DEFAULTS = Object.freeze({
    deepseek: Object.freeze({
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        supportsJsonMode: true
    }),
    openai: Object.freeze({
        id: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5-mini',
        supportsJsonMode: true
    }),
    minimax: Object.freeze({
        id: 'minimax',
        label: 'MiniMax',
        baseUrl: 'https://api.minimax.io/v1',
        model: 'MiniMax-M2.7',
        supportsJsonMode: false
    }),
    openaiCompatible: Object.freeze({
        id: 'openaiCompatible',
        label: 'OpenAI Compatible',
        baseUrl: '',
        model: '',
        supportsJsonMode: true
    }),
    custom: Object.freeze({
        id: 'custom',
        label: 'Custom',
        baseUrl: '',
        model: '',
        supportsJsonMode: true
    })
});

const trimTrailingSlash = (value = '') => String(value || '').trim().replace(/\/$/, '');

const assertHttpUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const getProviderDefaults = (provider) => {
    return PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;
};

export const normalizeProviderConfig = (input = {}) => {
    const defaults = getProviderDefaults(input.provider);
    const apiKey = String(input.apiKey || '').trim() || config.apiKey;
    const baseUrl = trimTrailingSlash(input.baseUrl || defaults.baseUrl || config.baseUrl);
    const model = String(input.model || defaults.model || config.model).trim();
    const supportsJsonMode = input.supportsJsonMode !== false && defaults.supportsJsonMode !== false;

    if (!apiKey) {
        const error = new Error('AI API Key is not configured');
        error.statusCode = 400;
        throw error;
    }

    if (!baseUrl || !assertHttpUrl(baseUrl)) {
        const error = new Error('AI Base URL is invalid');
        error.statusCode = 400;
        throw error;
    }

    if (!model) {
        const error = new Error('AI model is not configured');
        error.statusCode = 400;
        throw error;
    }

    return {
        provider: defaults.id,
        apiKey,
        baseUrl,
        model,
        supportsJsonMode
    };
};

export const getPublicDefaultProviderConfig = () => ({
    provider: 'deepseek',
    baseUrl: config.baseUrl || PROVIDER_DEFAULTS.deepseek.baseUrl,
    model: config.model || PROVIDER_DEFAULTS.deepseek.model,
    configured: Boolean(config.apiKey)
});
