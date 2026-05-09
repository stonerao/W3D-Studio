import { reactive } from 'vue';
import mqtt from 'mqtt';
import { executeDataAccess } from '../api/dataAccess';
import { useDiagnosticsStore } from '../stores/useDiagnosticsStore';

const runtimeConnections = new Map();
const runtimeStates = reactive({});

const buildRequestSummary = (payload) => {
    if (payload === null || payload === undefined) return '';
    if (typeof payload === 'string') return payload;
    try {
        const text = JSON.stringify(payload);
        return text.length > 200 ? `${text.slice(0, 197)}...` : text;
    } catch {
        return String(payload);
    }
};

const appendRequestLogSafe = (entry = {}) => {
    try {
        useDiagnosticsStore().appendRequestLog(entry);
    } catch (error) {
        console.warn('[Diagnostics] append runtime request log failed:', error);
    }
};

const formatPreviewMessage = (payload) => {
    if (payload === null || payload === undefined) return '';

    const text = typeof payload === 'string'
        ? payload
        : (() => {
            try {
                return JSON.stringify(payload);
            } catch {
                return String(payload);
            }
        })();

    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
};

const ensureRuntimeState = (componentId, sourceId) => {
    const key = getRuntimeKey(componentId, sourceId);
    if (!runtimeStates[key]) {
        runtimeStates[key] = {
            status: 'idle',
            lastMessage: '',
            lastPayload: null,
            lastUpdatedAt: '',
            error: '',
            reconnectCount: 0,
            mode: ''
        };
    }
    return runtimeStates[key];
};

const updateRuntimeState = (componentId, sourceId, patch = {}) => {
    Object.assign(ensureRuntimeState(componentId, sourceId), patch);
};

const markRuntimeMessage = (componentId, sourceId, payload, extra = {}) => {
    updateRuntimeState(componentId, sourceId, {
        status: 'connected',
        lastMessage: formatPreviewMessage(payload),
        lastPayload: payload,
        lastUpdatedAt: new Date().toISOString(),
        error: '',
        ...extra
    });
};

const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(value) || /^wss?:\/\//i.test(value);

const normalizePairs = (pairs = []) => {
    if (!Array.isArray(pairs)) return [];
    return pairs.filter((item) => item?.key);
};

const normalizePairValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const resolveTemplateValue = (input = '', variableValues = {}) => {
    const text = String(input || '');
    if (!text.includes('{{')) return text;
    return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, variableName) => {
        return normalizePairValue(variableValues?.[variableName]);
    });
};

const getLocalStorageRuntimeValue = (storageKey = '') => {
    const key = String(storageKey || '').trim();
    if (!key || typeof window === 'undefined' || !window.localStorage) return '';
    try {
        return window.localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
};

const getCookieRuntimeValue = (cookieName = '') => {
    const key = String(cookieName || '').trim();
    if (!key || typeof document === 'undefined') return '';
    const entries = String(document.cookie || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean);
    const matched = entries.find((item) => item.startsWith(`${key}=`));
    if (!matched) return '';
    return decodeURIComponent(matched.slice(key.length + 1));
};

const resolvePairValue = (item = {}, variableValues = {}) => {
    const valueSource = item?.valueSource || 'input';
    if (valueSource === 'local') {
        return normalizePairValue(variableValues?.[String(item?.variableName || '').trim()]);
    }
    if (valueSource === 'localStorage') {
        return normalizePairValue(getLocalStorageRuntimeValue(item?.variableName));
    }
    if (valueSource === 'cookie') {
        return normalizePairValue(getCookieRuntimeValue(item?.variableName));
    }
    return resolveTemplateValue(item?.value ?? '', variableValues);
};

const buildSearchParams = (pairs = [], variableValues = {}) => {
    const searchParams = new URLSearchParams();
    normalizePairs(pairs).forEach((item) => {
        searchParams.append(item.key, resolvePairValue(item, variableValues));
    });
    return searchParams.toString();
};

const buildRequestBody = (source, headers, variableValues = {}) => {
    const bodyType = String(source?.bodyType || 'none').trim() || 'none';
    if (bodyType === 'none') {
        return null;
    }

    if (bodyType === 'form-data') {
        const formData = new FormData();
        normalizePairs(source?.bodyParams).forEach((item) => {
            formData.append(item.key, resolvePairValue(item, variableValues));
        });
        return formData;
    }

    if (bodyType === 'x-www-form-urlencoded') {
        const searchParams = new URLSearchParams();
        normalizePairs(source?.bodyParams).forEach((item) => {
            searchParams.append(item.key, resolvePairValue(item, variableValues));
        });
        if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        }
        return searchParams.toString();
    }

    const resolvedBody = resolveTemplateValue(source?.body || '', variableValues);
    if (!resolvedBody) {
        return null;
    }

    if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = bodyType === 'xml'
            ? 'application/xml;charset=UTF-8'
            : 'application/json;charset=UTF-8';
    }
    return resolvedBody;
};

const buildSourceUrl = (source, apiBaseUrl = '', globalConfig = {}) => {
    const mode = source?.mode || 'http';
    const rawUrl = String(source?.url || '').trim();
    const globalHttpUrl = String(globalConfig?.baseUrl || '').trim();
    const globalWebSocketUrl = String(globalConfig?.websocketUrl || '').trim();
    const globalMqttUrl = String(globalConfig?.mqttUrl || '').trim();

    if (!rawUrl) {
        if (source?.useGlobalUrl === false) return '';
        if (mode === 'websocket') return globalWebSocketUrl;
        if (mode === 'mqtt') return globalMqttUrl;
        return globalHttpUrl || String(apiBaseUrl || '').trim();
    }

    if (isAbsoluteUrl(rawUrl)) {
        return rawUrl;
    }

    if (source?.useGlobalUrl === false) {
        if ((mode === 'websocket' || mode === 'mqtt') && !String(apiBaseUrl || '').trim()) {
            return rawUrl;
        }

        const base = String(apiBaseUrl || '').replace(/\/+$/, '');
        const cleanPath = rawUrl.replace(/^\/+/, '');
        return base ? `${base}/${cleanPath}` : rawUrl;
    }

    const serviceUrl = mode === 'websocket'
        ? globalWebSocketUrl
        : mode === 'mqtt'
            ? globalMqttUrl
            : (globalHttpUrl || String(apiBaseUrl || '').trim());

    if (!serviceUrl) return rawUrl;

    const base = serviceUrl.replace(/\/+$/, '');
    const cleanPath = rawUrl.replace(/^\/+/, '');
    return `${base}/${cleanPath}`;
};

const parseMaybeJson = (value) => {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (!trimmed) return value;

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }

    return value;
};

const parseCsvRow = (line, delimiter) => {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const nextChar = line[index + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    cells.push(current.trim());
    return cells;
};

const detectCsvDelimiter = (headerLine = '') => {
    const delimiters = [',', ';', '\t'];
    const candidates = delimiters.map((delimiter) => ({
        delimiter,
        count: headerLine.split(delimiter).length
    }));
    candidates.sort((left, right) => right.count - left.count);
    return candidates[0]?.count > 1 ? candidates[0].delimiter : ',';
};

const parseCsvContent = (content = '') => {
    const normalized = String(content || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const lines = normalized.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return [];

    const delimiter = detectCsvDelimiter(lines[0]);
    const headers = parseCsvRow(lines[0], delimiter).map((header, index) => header || `column_${index + 1}`);

    return lines.slice(1).map((line) => {
        const values = parseCsvRow(line, delimiter);
        return headers.reduce((row, header, index) => {
            row[header] = values[index] ?? '';
            return row;
        }, {});
    });
};

const getTimeoutMs = (source, globalConfig = {}) => {
    const timeoutSeconds = Number(source?.timeout ?? globalConfig?.timeout ?? 30);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
        return 30000;
    }
    return timeoutSeconds * 1000;
};

const getRuntimeKey = (componentId, sourceId) => `${componentId || 'component'}::${sourceId || 'source'}`;

const disconnectRuntimeConnection = (componentId, sourceId) => {
    const key = getRuntimeKey(componentId, sourceId);
    const runtime = runtimeConnections.get(key);
    if (!runtime) return;

    try {
        runtime.manualClose = true;
        runtime.clearReconnectTimer?.();
        runtime.disconnect?.();
    } catch (error) {
        console.warn('[DataSourceRuntime] disconnect failed:', error);
    }

    updateRuntimeState(componentId, sourceId, {
        status: 'disconnected',
        error: '',
        mode: runtime.type || ''
    });
    runtimeConnections.delete(key);
};

const createRealtimeHandlers = ({ key, onData, resolve, reject, timeoutMs, cleanupOnClose = true }) => {
    let settled = false;
    let timer = null;

    const settleSuccess = (payload, meta = {}) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({ success: true, data: payload, ...meta });
    };

    const settleError = (error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        runtimeConnections.delete(key);
        reject(error instanceof Error ? error : new Error(String(error || '连接失败')));
    };

    const handleIncomingData = async (payload, meta = {}) => {
        try {
            await onData?.(payload, meta);
            if (!settled) {
                settleSuccess(payload, { connected: true, live: true, ...meta });
            }
        } catch (error) {
            console.error('[DataSourceRuntime] onData failed:', error);
        }
    };

    timer = setTimeout(() => {
        settleError(new Error('连接超时'));
    }, timeoutMs);

    return {
        settleSuccess,
        settleError,
        handleIncomingData,
        isSettled: () => settled,
        onClose: () => {
            if (cleanupOnClose) {
                runtimeConnections.delete(key);
            }
        }
    };
};

const executeHttpSource = async ({ source, apiBaseUrl, globalConfig }) => {
    const startedAt = Date.now();
    const variableValues = globalConfig?.variableValues || {};
    const fullUrlBase = buildSourceUrl(source, apiBaseUrl, globalConfig);
    let fullUrl = fullUrlBase;
    const query = (() => {
        const searchParams = new URLSearchParams();
        normalizePairs(source?.params).forEach((item) => {
            searchParams.append(item.key, resolvePairValue(item, variableValues));
        });
        return searchParams.toString();
    })();
    if (query) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + query;
    }

    const headers = { ...(globalConfig?.headersObject || {}) };
    normalizePairs(source?.headers).forEach((item) => {
        headers[item.key] = resolvePairValue(item, variableValues);
    });

    const requestOptions = {
        method: source?.method || 'GET',
        headers
    };

    if (requestOptions.method === 'POST') {
        const requestBody = buildRequestBody(source, headers, variableValues);
        if (requestBody !== null) {
            requestOptions.body = requestBody;
        }
    }

    try {
        const response = await fetch(fullUrl, requestOptions);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        const data = contentType.includes('application/json') ? await response.json() : await response.text();
        appendRequestLogSafe({
            channel: 'runtime',
            mode: 'http',
            method: requestOptions.method || 'GET',
            target: fullUrl,
            status: 'success',
            durationMs: Date.now() - startedAt,
            summary: buildRequestSummary(data)
        });
        return { success: true, data, mode: 'http' };
    } catch (error) {
        appendRequestLogSafe({
            channel: 'runtime',
            mode: 'http',
            method: requestOptions.method || 'GET',
            target: fullUrl,
            status: 'error',
            durationMs: Date.now() - startedAt,
            summary: error?.message || 'HTTP 请求失败'
        });
        throw error;
    }
};

const executeDataAccessSource = async ({ source, globalConfig }) => {
    const variableValues = globalConfig?.variableValues || {};
    const accessCode = String(source?.accessCode || '').trim();
    if (!accessCode) {
        throw new Error('数据接入编码不能为空');
    }

    const params = {};
    normalizePairs(source?.params).forEach((item) => {
        params[item.key] = resolvePairValue(item, variableValues);
    });

    const result = await executeDataAccess(accessCode, params);
    return {
        success: true,
        data: result?.data,
        rawData: result?.rawData,
        total: result?.total,
        mode: 'data-access'
    };
};

const executeLocalSource = async ({ source }) => {
    const rawContent = String(source?.localDataContent || '').trim();
    if (!rawContent) {
        throw new Error('本地数据为空，请先选择文件或输入数据内容');
    }

    const format = source?.localDataFormat || 'json';
    if (format === 'text') {
        return { success: true, data: rawContent, mode: 'local' };
    }

    if (format === 'csv') {
        return { success: true, data: parseCsvContent(rawContent), mode: 'local' };
    }

    try {
        return { success: true, data: JSON.parse(rawContent), mode: 'local' };
    } catch (error) {
        throw new Error(`本地数据解析失败: ${error.message}`);
    }
};

const executeWebSocketSource = ({ source, apiBaseUrl, globalConfig, componentId, onData }) => {
    const urlBase = buildSourceUrl(source, apiBaseUrl, globalConfig);
    if (!urlBase) {
        return Promise.reject(new Error('WebSocket 地址不能为空'));
    }

    const query = buildSearchParams(source?.params, globalConfig?.variableValues || {});
    const url = query ? `${urlBase}${urlBase.includes('?') ? '&' : '?'}${query}` : urlBase;
    const key = getRuntimeKey(componentId, source?.id);
    disconnectRuntimeConnection(componentId, source?.id);

    return new Promise((resolve, reject) => {
        const timeoutMs = getTimeoutMs(source, globalConfig);
        const handlers = createRealtimeHandlers({ key, onData, resolve, reject, timeoutMs });
        const autoReconnect = source?.autoReconnect !== false;
        const reconnectPeriod = Math.max(1000, Number(source?.reconnectPeriod || 3000));
        const heartbeatEnabled = source?.heartbeatEnabled === true;
        const heartbeatInterval = Math.max(1000, Number(source?.heartbeatInterval || 30000));
        const heartbeatMessage = typeof source?.heartbeatMessage === 'string' ? source.heartbeatMessage : '';
        const runtimeEntry = {
            type: 'websocket',
            manualClose: false,
            reconnectTimer: null,
            heartbeatTimer: null,
            socket: null,
            clearReconnectTimer() {
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            },
            clearHeartbeatTimer() {
                if (this.heartbeatTimer) {
                    clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = null;
                }
            },
            startHeartbeat() {
                this.clearHeartbeatTimer();
                if (!heartbeatEnabled || !heartbeatMessage) return;
                this.heartbeatTimer = setInterval(() => {
                    const socket = runtimeEntry.socket;
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(heartbeatMessage);
                    }
                }, heartbeatInterval);
            },
            disconnect: () => {
                runtimeEntry.manualClose = true;
                runtimeEntry.clearReconnectTimer();
                runtimeEntry.clearHeartbeatTimer();
                const socket = runtimeEntry.socket;
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close(1000, 'manual disconnect');
                }
            }
        };

        const scheduleReconnect = () => {
            if (!autoReconnect || runtimeEntry.manualClose) return;
            runtimeEntry.clearReconnectTimer();
            updateRuntimeState(componentId, source?.id, {
                status: 'reconnecting',
                error: '',
                reconnectCount: ensureRuntimeState(componentId, source?.id).reconnectCount + 1,
                mode: 'websocket'
            });
            runtimeEntry.reconnectTimer = setTimeout(() => {
                connectSocket();
            }, reconnectPeriod);
        };

        const connectSocket = () => {
            updateRuntimeState(componentId, source?.id, {
                status: 'connecting',
                error: '',
                mode: 'websocket'
            });

            const protocols = source?.socketProtocol ? [source.socketProtocol] : undefined;
            const socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
            runtimeEntry.socket = socket;
            runtimeConnections.set(key, runtimeEntry);

            socket.onopen = async () => {
                updateRuntimeState(componentId, source?.id, {
                    status: 'connected',
                    error: '',
                    mode: 'websocket'
                });

                if (source?.socketMessage) {
                    socket.send(source.socketMessage);
                }

                 runtimeEntry.startHeartbeat();

                if (!source?.socketWaitForMessage) {
                    handlers.settleSuccess(null, { connected: true, live: true, mode: 'websocket' });
                }
            };

            socket.onmessage = async (event) => {
                const payload = parseMaybeJson(event.data);
                markRuntimeMessage(componentId, source?.id, payload, { mode: 'websocket' });
                await handlers.handleIncomingData(payload, { mode: 'websocket' });
            };

            socket.onerror = () => {
                updateRuntimeState(componentId, source?.id, {
                    status: 'error',
                    error: 'WebSocket 连接失败',
                    mode: 'websocket'
                });
            };

            socket.onclose = () => {
                runtimeEntry.clearHeartbeatTimer();
                if (runtimeEntry.manualClose) {
                    updateRuntimeState(componentId, source?.id, {
                        status: 'disconnected',
                        error: '',
                        mode: 'websocket'
                    });
                    handlers.onClose();
                    return;
                }

                if (!handlers.isSettled() && !autoReconnect) {
                    updateRuntimeState(componentId, source?.id, {
                        status: 'error',
                        error: 'WebSocket 已关闭',
                        mode: 'websocket'
                    });
                    handlers.settleError(new Error('WebSocket 已关闭'));
                    return;
                }

                scheduleReconnect();
            };
        };

        connectSocket();
    });
};

const executeMqttSource = ({ source, apiBaseUrl, globalConfig, componentId, onData }) => {
    const brokerUrl = buildSourceUrl(source, apiBaseUrl, globalConfig);
    if (!brokerUrl) {
        return Promise.reject(new Error('MQTT Broker 地址不能为空'));
    }

    if (!source?.mqttTopic) {
        return Promise.reject(new Error('MQTT Topic 不能为空'));
    }

    const key = getRuntimeKey(componentId, source?.id);
    disconnectRuntimeConnection(componentId, source?.id);

    return new Promise((resolve, reject) => {
        const timeoutMs = getTimeoutMs(source, globalConfig);
        const handlers = createRealtimeHandlers({ key, onData, resolve, reject, timeoutMs, cleanupOnClose: false });
        const autoReconnect = source?.autoReconnect !== false;
        const client = mqtt.connect(brokerUrl, {
            clientId: source?.mqttClientId || `w3d_${Math.random().toString(16).slice(2, 10)}`,
            username: source?.mqttUsername || undefined,
            password: source?.mqttPassword || undefined,
            connectTimeout: timeoutMs,
            clean: source?.mqttClean !== false,
            reconnectPeriod: autoReconnect ? Math.max(1000, Number(source?.reconnectPeriod || 3000)) : 0
        });

        runtimeConnections.set(key, {
            type: 'mqtt',
            manualClose: false,
            disconnect: () => {
                updateRuntimeState(componentId, source?.id, {
                    status: 'disconnected',
                    error: '',
                    mode: 'mqtt'
                });
                client.end(true);
            }
        });

        updateRuntimeState(componentId, source?.id, {
            status: 'connecting',
            error: '',
            mode: 'mqtt'
        });

        client.on('connect', () => {
            updateRuntimeState(componentId, source?.id, {
                status: 'connected',
                error: '',
                mode: 'mqtt'
            });

            client.subscribe(source.mqttTopic, { qos: Number(source?.mqttQos || 0) }, (error) => {
                if (error) {
                    updateRuntimeState(componentId, source?.id, {
                        status: 'error',
                        error: error.message || 'MQTT 订阅失败',
                        mode: 'mqtt'
                    });
                    handlers.settleError(error);
                    return;
                }

                if (!source?.mqttWaitForMessage) {
                    handlers.settleSuccess(null, { connected: true, live: true, mode: 'mqtt' });
                }
            });
        });

        client.on('message', async (_topic, payload) => {
            const text = payload?.toString?.() ?? '';
            const parsedPayload = parseMaybeJson(text);
            markRuntimeMessage(componentId, source?.id, parsedPayload, { mode: 'mqtt' });
            await handlers.handleIncomingData(parsedPayload, { mode: 'mqtt' });
        });

        client.on('error', (error) => {
            updateRuntimeState(componentId, source?.id, {
                status: 'error',
                error: error.message || 'MQTT 连接失败',
                mode: 'mqtt'
            });
            if (!handlers.isSettled()) {
                handlers.settleError(error);
            }
        });

        client.on('reconnect', () => {
            updateRuntimeState(componentId, source?.id, {
                status: 'reconnecting',
                error: '',
                reconnectCount: ensureRuntimeState(componentId, source?.id).reconnectCount + 1,
                mode: 'mqtt'
            });
        });

        client.on('offline', () => {
            updateRuntimeState(componentId, source?.id, {
                status: autoReconnect ? 'reconnecting' : 'disconnected',
                error: '',
                mode: 'mqtt'
            });
        });

        client.on('close', () => {
            if (!autoReconnect) {
                updateRuntimeState(componentId, source?.id, {
                    status: 'disconnected',
                    error: '',
                    mode: 'mqtt'
                });
            }
            handlers.onClose();
        });
    });
};

export const executeRuntimeDataSource = async ({ source, apiBaseUrl = '', globalConfig = {}, componentId = '', onData }) => {
    const mode = source?.mode || 'http';

    if (mode === 'http' || mode === 'data-access') {
        updateRuntimeState(componentId, source?.id, {
            status: 'idle',
            error: '',
            mode
        });
    }

    if (mode === 'data-access') {
        const result = await executeDataAccessSource({ source, globalConfig });
        markRuntimeMessage(componentId, source?.id, result?.data, { mode });
        return result;
    }

    if (mode === 'websocket') {
        return executeWebSocketSource({ source, apiBaseUrl, globalConfig, componentId, onData });
    }

    if (mode === 'mqtt') {
        return executeMqttSource({ source, apiBaseUrl, globalConfig, componentId, onData });
    }

    if (mode === 'local') {
        const result = await executeLocalSource({ source });
        markRuntimeMessage(componentId, source?.id, result?.data, { mode });
        return result;
    }

    const result = await executeHttpSource({ source, apiBaseUrl, globalConfig });
    markRuntimeMessage(componentId, source?.id, result?.data, { mode });
    return result;
};

export const disconnectDataSourceRuntime = (componentId, sourceId) => {
    disconnectRuntimeConnection(componentId, sourceId);
};

export const getDataSourceDisplayAddress = (source, apiBaseUrl = '', globalConfig = {}) => {
    const mode = source?.mode || 'http';

    if (mode === 'local') {
        return source?.localFileName || '本地数据';
    }

    if (mode === 'data-access') {
        return source?.accessName || source?.accessCode || '数据接入';
    }

    return buildSourceUrl(source, apiBaseUrl, globalConfig);
};

export const getDataSourceRuntimeState = (componentId, sourceId) => {
    return ensureRuntimeState(componentId, sourceId);
};
