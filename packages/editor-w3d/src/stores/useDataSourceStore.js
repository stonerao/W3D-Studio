import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const PUBLIC_SOURCE_MODES = ['data-access', 'websocket', 'http'];

const createPublicDataSource = (mode = 'data-access') => ({
    id: `public_source_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    mode: PUBLIC_SOURCE_MODES.includes(mode) ? mode : 'data-access',
    enabled: true,
    description: '',
    accessCode: '',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    bodyType: 'none',
    bodyParams: [],
    body: '',
    timeout: 30,
    websocketUrl: '',
    socketProtocol: '',
    socketMessage: '',
    socketWaitForMessage: false,
    autoReconnect: true,
    reconnectPeriod: 3000,
    heartbeatEnabled: false,
    heartbeatInterval: 30000,
    heartbeatMessage: '',
    runOnLoad: true
});

const normalizePublicDataSource = (source = {}, index = 0) => {
    const base = createPublicDataSource(source.mode);
    const mode = PUBLIC_SOURCE_MODES.includes(source.mode) ? source.mode : base.mode;
    return {
        ...base,
        ...source,
        id: source.id || `public_source_${Date.now()}_${index}`,
        mode,
        name: String(source.name || '').trim(),
        enabled: source.enabled !== false,
        description: String(source.description || ''),
        accessCode: String(source.accessCode || '').trim(),
        method: String(source.method || 'GET').toUpperCase(),
        url: String(source.url || '').trim(),
        bodyType: ['none', 'form-data', 'x-www-form-urlencoded', 'json', 'xml'].includes(source.bodyType)
            ? source.bodyType
            : base.bodyType,
        body: typeof source.body === 'string' ? source.body : '',
        timeout: Number.isFinite(Number(source.timeout)) ? Math.max(1, Number(source.timeout)) : base.timeout,
        websocketUrl: String(source.websocketUrl || '').trim(),
        socketProtocol: String(source.socketProtocol || '').trim(),
        socketMessage: String(source.socketMessage || ''),
        socketWaitForMessage: source.socketWaitForMessage === true,
        autoReconnect: source.autoReconnect !== false,
        reconnectPeriod: Number.isFinite(Number(source.reconnectPeriod)) ? Math.max(1000, Number(source.reconnectPeriod)) : base.reconnectPeriod,
        heartbeatEnabled: source.heartbeatEnabled === true,
        heartbeatInterval: Number.isFinite(Number(source.heartbeatInterval)) ? Math.max(1000, Number(source.heartbeatInterval)) : base.heartbeatInterval,
        heartbeatMessage: String(source.heartbeatMessage || ''),
        runOnLoad: source.runOnLoad !== false,
        params: Array.isArray(source.params) ? source.params.map((item) => ({
            key: String(item?.key || '').trim(),
            value: item?.value ?? '',
            valueSource: item?.valueSource || 'input',
            variableName: String(item?.variableName || '').trim()
        })) : [],
        bodyParams: Array.isArray(source.bodyParams) ? source.bodyParams.map((item) => ({
            key: String(item?.key || '').trim(),
            value: item?.value ?? '',
            valueSource: item?.valueSource || 'input',
            variableName: String(item?.variableName || '').trim()
        })) : [],
        headers: Array.isArray(source.headers) ? source.headers.map((item) => ({
            key: String(item?.key || '').trim(),
            value: String(item?.value || '')
        })) : []
    };
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

/**
 * 全局数据源配置 Store
 * 管理全局公共配置（前置URL、超时时间、公共Headers等）
 */
export const useDataSourceStore = defineStore('dataSource', () => {
    const createDefaultGlobalConfig = () => ({
        // HTTP 服务前置 URL
        baseUrl: 'http://localhost:3000/',
        // WebSocket 服务地址
        websocketUrl: 'ws://localhost:3000/',
        // MQTT Broker 地址（浏览器端通常使用 ws/wss）
        mqttUrl: 'ws://localhost:8083/mqtt',
        // 超时时间（秒）
        timeout: 30,
        // 公共请求头
        headers: []
    });

    const getServiceUrlByMode = (mode = 'http') => {
        if (mode === 'websocket') return globalConfig.value.websocketUrl || '';
        if (mode === 'mqtt') return globalConfig.value.mqttUrl || '';
        return globalConfig.value.baseUrl || '';
    };

    const setServiceUrlByMode = (mode = 'http', url = '') => {
        if (mode === 'websocket') {
            globalConfig.value.websocketUrl = url;
            return;
        }

        if (mode === 'mqtt') {
            globalConfig.value.mqttUrl = url;
            return;
        }

        globalConfig.value.baseUrl = url;
    };

    // ==================== 状态 ====================

    /**
     * 全局公共配置
     */
    const globalConfig = ref(createDefaultGlobalConfig());
    const publicDataSources = ref([]);

    // ==================== 计算属性 ====================

    /**
     * 格式化的超时时间（毫秒）
     */
    const timeoutMs = computed(() => globalConfig.value.timeout * 1000);

    /**
     * 公共请求头对象
     */
    const headersObject = computed(() => {
        const obj = {};
        for (const h of globalConfig.value.headers) {
            if (h.key) {
                obj[h.key] = h.value;
            }
        }
        return obj;
    });

    const publicDataSourceOptions = computed(() => {
        return publicDataSources.value.map((item) => ({
            label: item.name ? `[${item.mode}] ${item.name}` : `[${item.mode}] ${item.id}`,
            value: item.id
        }));
    });

    // ==================== 方法 ====================

    /**
     * 更新全局配置
     * @param {Object} updates - 更新内容
     */
    const updateGlobalConfig = (updates) => {
        globalConfig.value = {
            ...globalConfig.value,
            ...updates
        };
    };

    /**
     * 更新前置 URL
     * @param {string} url - 新的前置 URL
     */
    const setBaseUrl = (url) => {
        globalConfig.value.baseUrl = url;
    };

    /**
     * 更新超时时间
     * @param {number} seconds - 超时时间（秒）
     */
    const setTimeout = (seconds) => {
        globalConfig.value.timeout = seconds;
    };

    /**
     * 更新公共请求头
     * @param {Array} headers - 请求头数组 [{key, value}]
     */
    const setHeaders = (headers) => {
        globalConfig.value.headers = headers;
    };

    /**
     * 添加公共请求头
     * @param {string} key - Header 名称
     * @param {string} value - Header 值
     */
    const addHeader = (key, value) => {
        globalConfig.value.headers.push({ key, value });
    };

    /**
     * 移除公共请求头
     * @param {number} index - 索引
     */
    const removeHeader = (index) => {
        globalConfig.value.headers.splice(index, 1);
    };

    /**
     * 构建完整 URL
     * @param {string} path - 请求路径
     * @param {boolean} useGlobal - 是否使用全局配置
     * @returns {string} 完整 URL
     */
    const buildFullUrl = (path, useGlobal = true, mode = 'http') => {
        if (!path) return '';

        // 已经是完整 URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        // 使用全局前置 URL
        const serviceUrl = getServiceUrlByMode(mode);
        if (useGlobal && serviceUrl) {
            const base = serviceUrl.replace(/\/+$/, '');
            const cleanPath = path.replace(/^\/+/, '');
            return `${base}/${cleanPath}`;
        }

        return path;
    };

    const getPublicDataSourceById = (id) => {
        return publicDataSources.value.find((item) => item.id === id) || null;
    };

    const addPublicDataSource = (sourceData = {}) => {
        const nextSource = normalizePublicDataSource(sourceData, publicDataSources.value.length);
        if (!nextSource.name) {
            nextSource.name = `公共接口 ${publicDataSources.value.length + 1}`;
        }
        publicDataSources.value = [...publicDataSources.value, nextSource];
        return nextSource;
    };

    const updatePublicDataSource = (id, updates = {}) => {
        const index = publicDataSources.value.findIndex((item) => item.id === id);
        if (index === -1) {
            throw new Error(`公共接口不存在: ${id}`);
        }

        const nextSource = normalizePublicDataSource({
            ...publicDataSources.value[index],
            ...updates,
            id
        }, index);

        publicDataSources.value = publicDataSources.value.map((item, itemIndex) => {
            return itemIndex === index ? nextSource : item;
        });

        return nextSource;
    };

    const removePublicDataSource = (id) => {
        const target = getPublicDataSourceById(id);
        publicDataSources.value = publicDataSources.value.filter((item) => item.id !== id);
        return target;
    };

    /**
     * 序列化（用于保存）
     */
    const serialize = () => {
        return {
            baseUrl: globalConfig.value.baseUrl,
            websocketUrl: globalConfig.value.websocketUrl,
            mqttUrl: globalConfig.value.mqttUrl,
            timeout: globalConfig.value.timeout,
            headers: globalConfig.value.headers.map(h => ({ ...h })),
            publicDataSources: deepClone(publicDataSources.value)
        };
    };

    /**
     * 反序列化（用于加载）
     * @param {Object} data - 配置数据
     */
    const deserialize = (data) => {
        if (!data || typeof data !== 'object') {
            globalConfig.value = createDefaultGlobalConfig();
            return;
        }

        globalConfig.value = {
            ...createDefaultGlobalConfig(),
            baseUrl: data.baseUrl || 'http://localhost:3000/',
            websocketUrl: data.websocketUrl || 'ws://localhost:3000/',
            mqttUrl: data.mqttUrl || 'ws://localhost:8083/mqtt',
            timeout: typeof data.timeout === 'number' ? data.timeout : 30,
            headers: Array.isArray(data.headers) ? data.headers.map(h => ({ ...h })) : []
        };

        publicDataSources.value = Array.isArray(data.publicDataSources)
            ? data.publicDataSources.map((item, index) => normalizePublicDataSource(item, index))
            : [];
    };

    /**
     * 重置为默认值
     */
    const reset = () => {
        globalConfig.value = createDefaultGlobalConfig();
        publicDataSources.value = [];
    };

    return {
        // 状态
        globalConfig,
        publicDataSources,

        // 计算属性
        timeoutMs,
        headersObject,
        publicDataSourceOptions,

        // 方法
        updateGlobalConfig,
        setBaseUrl,
        setTimeout,
        setHeaders,
        addHeader,
        removeHeader,
        getServiceUrlByMode,
        setServiceUrlByMode,
        buildFullUrl,
        getPublicDataSourceById,
        addPublicDataSource,
        updatePublicDataSource,
        removePublicDataSource,
        serialize,
        deserialize,
        reset
    };
});
