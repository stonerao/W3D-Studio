import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useVariableStore } from './useVariableStore';
import { useComponentStore } from './useComponentStore';
import { useDataSourceStore } from './useDataSourceStore';
import { useDiagnosticsStore } from './useDiagnosticsStore';
import { executeDataAccess } from '../api/dataAccess';
import { executeRuntimeDataSource, getDataSourceRuntimeState } from '../services/dataSourceRuntime';

export const ALARM_SEVERITIES = {
    CRITICAL: 'critical',
    MAJOR: 'major',
    WARNING: 'warning',
    INFO: 'info'
};

export const ALARM_OPERATORS = {
    GT: '>',
    GTE: '>=',
    LT: '<',
    LTE: '<=',
    EQ: '==',
    NEQ: '!=',
    CONTAINS: 'contains',
    CHANGED: 'changed'
};

export const ALARM_ACTION_TYPES = {
    HIGHLIGHT_MODEL: 'highlight-model',
    HIGHLIGHT_LABEL3D: 'highlight-label3d',
    TOAST: 'toast',
    MODAL: 'modal',
    SCREEN_FLASH: 'screen-flash'
};

export const ALARM_SEVERITY_CONFIG = {
    [ALARM_SEVERITIES.CRITICAL]: { label: '严重' },
    [ALARM_SEVERITIES.MAJOR]: { label: '重要' },
    [ALARM_SEVERITIES.WARNING]: { label: '告警' },
    [ALARM_SEVERITIES.INFO]: { label: '提示' }
};

const DEFAULT_NOTIFICATION_SETTINGS = {
    browserEnabled: false,
    soundEnabled: false,
    soundFrequency: 880,
    soundDurationMs: 180
};

const DEFAULT_TITLE_TEMPLATE = '{ruleName}';
const DEFAULT_MESSAGE_TEMPLATE = '{ruleName} 触发，变量 {variableName} 当前值为 {value}';
const DEFAULT_SCREEN_FLASH_COLOR = 'rgba(239, 68, 68, 0.2)';
const DEFAULT_SOURCE_MODE = 'data-source';
const DEFAULT_DATA_ACCESS_POLLING_MS = 30000;
const MIN_REMOTE_POLLING_MS = 1000;
const DEFAULT_RULE_FILTER = {
    enabled: false,
    path: '',
    operator: ALARM_OPERATORS.EQ,
    threshold: ''
};
const ALARM_PUBLIC_RUNTIME_COMPONENT_ID = '__alarm_public__';
const isRuntimeSourceMode = (sourceMode = '') => {
    const normalized = String(sourceMode || '').trim();
    return normalized === 'websocket';
};
const isDataAccessSourceMode = (sourceMode = '') => String(sourceMode || '').trim() === DEFAULT_SOURCE_MODE;
const isPublicSourceMode = (sourceMode = '') => String(sourceMode || '').trim() === 'public-source';
const normalizePollingInterval = (value, fallback = 0) => {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    if (parsed === 0) return 0;
    return Math.max(MIN_REMOTE_POLLING_MS, Math.round(parsed));
};

const normalizeActionString = (value = '') => String(value || '').trim();

const normalizeActionColor = (value, fallback) => {
    const text = normalizeActionString(value);
    return text || fallback;
};

const normalizeActionNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAlarmAction = (action = {}, legacyRule = null) => {
    const type = normalizeActionString(action.type);

    if (type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL) {
        return {
            type,
            componentId: normalizeActionString(action.componentId || legacyRule?.targetComponentId),
            meshName: normalizeActionString(action.meshName),
            color: normalizeActionColor(action.color, '#ef4444'),
            intensity: Math.max(0, normalizeActionNumber(action.intensity, 0.45)),
            blink: Boolean(action.blink)
        };
    }

    if (type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D) {
        return {
            type,
            componentId: normalizeActionString(action.componentId || legacyRule?.targetComponentId),
            labelId: normalizeActionString(action.labelId),
            color: normalizeActionColor(action.color, '#ffffff'),
            backgroundColor: normalizeActionColor(action.backgroundColor, 'rgba(239, 68, 68, 0.82)'),
            borderColor: normalizeActionColor(action.borderColor, '#fecaca'),
            blink: Boolean(action.blink)
        };
    }

    if (type === ALARM_ACTION_TYPES.TOAST) {
        return {
            type,
            durationMs: Math.max(1200, normalizeActionNumber(action.durationMs, 3000))
        };
    }

    if (type === ALARM_ACTION_TYPES.MODAL) {
        return { type };
    }

    if (type === ALARM_ACTION_TYPES.SCREEN_FLASH) {
        return {
            type,
            color: normalizeActionColor(action.color, DEFAULT_SCREEN_FLASH_COLOR),
            opacity: Math.min(1, Math.max(0.02, normalizeActionNumber(action.opacity, 0.22))),
            durationMs: Math.max(300, normalizeActionNumber(action.durationMs, 1600)),
            blinkCount: Math.max(1, Math.round(normalizeActionNumber(action.blinkCount, 2)))
        };
    }

    return null;
};

const normalizeAlarmActions = (actions, legacyRule = null) => {
    if (Array.isArray(actions) && actions.length > 0) {
        return actions.map((item) => normalizeAlarmAction(item, legacyRule)).filter(Boolean);
    }

    return [];
};

const getPrimaryTargetComponentIdFromActions = (actions = []) => {
    const highlightAction = actions.find((item) =>
        item?.type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL || item?.type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D
    );
    return normalizeActionString(highlightAction?.componentId);
};

const cloneValue = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => cloneValue(item));
    }

    if (value && typeof value === 'object') {
        return { ...value };
    }

    return value;
};

const toComparableNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
};

const stringifyValue = (value) => {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const stringifyForDebug = (value) => {
    try {
        return JSON.stringify(value);
    } catch {
        return stringifyValue(value);
    }
};

const isSameValue = (left, right) => stringifyValue(left) === stringifyValue(right);

const normalizeDelay = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }

    return parsed;
};

const normalizeAlarmFilter = (filter = {}) => {
    const operator = Object.values(ALARM_OPERATORS).includes(filter?.operator)
        ? filter.operator
        : DEFAULT_RULE_FILTER.operator;

    return {
        enabled: filter?.enabled === true,
        path: String(filter?.path || '').trim(),
        operator,
        threshold: filter?.threshold ?? ''
    };
};

const operatorRequiresThreshold = (operator) => operator !== ALARM_OPERATORS.CHANGED;

const hasMeaningfulThreshold = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
};

const getNestedValue = (obj, path) => {
    if (!path) return obj;
    const normalizedPath = String(path || '')
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .map((item) => String(item || '').trim())
        .filter(Boolean);

    let value = obj;
    for (const key of normalizedPath) {
        if (value === null || value === undefined) return undefined;
        value = value[key];
    }
    return value;
};

const getRuleValueStorageKey = (rule) => String(rule?.id || '');

const appendAlarmLogSafe = (entry = {}) => {
    try {
        useDiagnosticsStore().appendAlarmLog(entry);
    } catch (error) {
        console.warn('[Diagnostics] append alarm log failed:', error);
    }
};

export const useAlarmStore = defineStore('alarm', () => {
    const variableStore = useVariableStore();
    const componentStore = useComponentStore();
    const dataSourceStore = useDataSourceStore();

    const rules = ref([]);
    const activeAlarms = ref([]);
    const alarmHistory = ref([]);
    const lastEvaluationAt = ref(null);
    const notificationSettings = ref({ ...DEFAULT_NOTIFICATION_SETTINGS });
    const runtimeStateVersion = ref(0);
    const autoEvaluationEnabled = ref(true);

    let ruleCounter = 0;
    let alarmCounter = 0;
    const previousValueMap = new Map();
    const ruleTimingStateMap = new Map();
    let pendingEvaluationTimer = null;
    const dataAccessSnapshotMap = new Map();
    let remoteSourcePollingTimer = null;
    let dataAccessRefreshPromise = null;
    const remoteSourceFetchStateMap = new Map();

    const touchRuntimeState = () => {
        runtimeStateVersion.value += 1;
    };

    const isAutoEvaluationEnabled = () => autoEvaluationEnabled.value !== false;

    const activeAlarmMap = computed(() => {
        const map = {};
        for (const alarm of activeAlarms.value) {
            map[alarm.ruleId] = alarm;
        }
        return map;
    });

    const enabledRules = computed(() => rules.value.filter((rule) => rule.enabled !== false));
    const activeCount = computed(() => activeAlarms.value.length);
    const acknowledgedCount = computed(() => activeAlarms.value.filter((alarm) => Boolean(alarm.acknowledgedAt)).length);
    const severityStats = computed(() => ({
        critical: activeAlarms.value.filter((alarm) => alarm.severity === ALARM_SEVERITIES.CRITICAL).length,
        major: activeAlarms.value.filter((alarm) => alarm.severity === ALARM_SEVERITIES.MAJOR).length,
        warning: activeAlarms.value.filter((alarm) => alarm.severity === ALARM_SEVERITIES.WARNING).length,
        info: activeAlarms.value.filter((alarm) => alarm.severity === ALARM_SEVERITIES.INFO).length
    }));

    const generateRuleId = () => `alarm_rule_${++ruleCounter}_${Date.now()}`;
    const generateAlarmId = () => `alarm_record_${++alarmCounter}_${Date.now()}`;

    const getDataSourceDefinition = (componentId, sourceId) => {
        const component = componentStore.getComponentById(componentId);
        const sources = Array.isArray(component?.dataBinding?.sources) ? component.dataBinding.sources : [];
        return sources.find((item) => String(item?.id || '') === String(sourceId || '')) || null;
    };

    const getPublicDataSourceDefinition = (sourceId) => {
        return dataSourceStore.getPublicDataSourceById(String(sourceId || '').trim());
    };

    const getDataAccessSnapshot = (accessCode) => dataAccessSnapshotMap.get(String(accessCode || '').trim()) || null;

    const setDataAccessSnapshot = (accessCode, payload) => {
        const normalizedCode = String(accessCode || '').trim();
        if (!normalizedCode) return;
        dataAccessSnapshotMap.set(normalizedCode, {
            accessCode: normalizedCode,
            payload,
            updatedAt: Date.now()
        });
        touchRuntimeState();
    };

    const clearRemoteSourcePollingTimer = () => {
        if (remoteSourcePollingTimer) {
            clearTimeout(remoteSourcePollingTimer);
            remoteSourcePollingTimer = null;
        }
    };

    const getRemoteSourceFetchState = (key) => {
        if (!remoteSourceFetchStateMap.has(key)) {
            remoteSourceFetchStateMap.set(key, {
                lastFetchedAt: 0
            });
        }
        return remoteSourceFetchStateMap.get(key);
    };

    const debugAlarmRemote = (label, payload) => {
        console.log(`[Alarm][Debug] ${label}`, payload);
    };

    const validateRule = (ruleData, excludeId = null) => {
        const sourceMode = String(ruleData.sourceMode || '').trim() || (ruleData.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
        const hasVariable = Boolean(ruleData.variableName);
        const hasSource = Boolean(ruleData.sourceId);

        if (!hasVariable && !hasSource) {
            throw new Error('?????????');
        }

        if (sourceMode === 'variable' && hasVariable && !variableStore.getVariableByName(ruleData.variableName)) {
            throw new Error(`?????: ${ruleData.variableName}`);
        }

        if (isDataAccessSourceMode(sourceMode)) {
            if (!ruleData.sourceId) {
                throw new Error('??????');
            }
        }

        if (isPublicSourceMode(sourceMode)) {
            if (!ruleData.sourceId) {
                throw new Error('??????');
            }
            if (!getPublicDataSourceDefinition(ruleData.sourceId)) {
                throw new Error(`?????????: ${ruleData.sourceId}`);
            }
        }

        if (isRuntimeSourceMode(sourceMode)) {
            if (!ruleData.sourceComponentId) {
                throw new Error('??????????');
            }
            if (!componentStore.getComponentById(ruleData.sourceComponentId)) {
                throw new Error(`??????????: ${ruleData.sourceComponentId}`);
            }
            if (!ruleData.sourceId) {
                throw new Error('??????');
            }
        }

        if (!ruleData.name || !String(ruleData.name).trim()) {
            throw new Error('告警规则名称不能为空');
        }

        if (ruleData.targetComponentId && !componentStore.getComponentById(ruleData.targetComponentId)) {
            throw new Error(`绑定组件不存在: ${ruleData.targetComponentId}`);
        }

        const duplicated = rules.value.some(
            (item) => item.name === ruleData.name && item.id !== excludeId
        );
        if (duplicated) {
            throw new Error(`告警规则名称已存在: ${ruleData.name}`);
        }

        if (!Object.values(ALARM_OPERATORS).includes(ruleData.operator)) {
            throw new Error(`不支持的告警运算符: ${ruleData.operator}`);
        }

        if (!Object.values(ALARM_SEVERITIES).includes(ruleData.severity)) {
            throw new Error(`不支持的告警等级: ${ruleData.severity}`);
        }

        if (!Array.isArray(ruleData.actions)) {
            throw new Error('告警动作格式无效');
        }

        if (ruleData.filter?.enabled === true) {
            if (!Object.values(ALARM_OPERATORS).includes(ruleData.filter.operator)) {
                throw new Error(`Unsupported alarm filter operator: ${ruleData.filter.operator}`);
            }

            if (ruleData.filter.operator === ALARM_OPERATORS.CHANGED) {
                throw new Error('Alarm filter does not support the changed operator');
            }
        }

        for (const action of ruleData.actions) {
            if (!action?.type || !Object.values(ALARM_ACTION_TYPES).includes(action.type)) {
                throw new Error(`不支持的告警动作: ${action?.type || 'unknown'}`);
            }

            if (
                (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL || action.type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D)
                && !componentStore.getComponentById(action.componentId)
            ) {
                throw new Error(`告警动作绑定组件不存在: ${action.componentId}`);
            }

            if (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL && !normalizeActionString(action.meshName)) {
                throw new Error('模型高亮动作缺少 Mesh 名称');
            }

            if (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D && !normalizeActionString(action.labelId)) {
                throw new Error('标签高亮动作缺少标签 ID');
            }
        }

        if (normalizeDelay(ruleData.triggerDelayMs) !== Number(ruleData.triggerDelayMs || 0)) {
            throw new Error('触发延时必须是大于等于 0 的数字');
        }

        if (normalizeDelay(ruleData.recoverDelayMs) !== Number(ruleData.recoverDelayMs || 0)) {
            throw new Error('恢复延时必须是大于等于 0 的数字');
        }

        if ((isDataAccessSourceMode(sourceMode) || isPublicSourceMode(sourceMode)) && normalizePollingInterval(ruleData.pollingIntervalMs) !== Number(ruleData.pollingIntervalMs || 0)) {
            throw new Error('??????????? 0 ??????');
        }
    };


    const createRulePayload = (ruleData = {}) => {
        const now = Date.now();
        const sourceMode = String(ruleData.sourceMode || '').trim() || (ruleData.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
        const variableName = ruleData.variableName || variableStore.variables[0]?.name || '';
        const sourceComponentId = String(ruleData.sourceComponentId || '').trim();
        const sourceId = String(ruleData.sourceId || '').trim();
        const sourcePath = String(ruleData.sourcePath || '').trim();
        const operator = ruleData.operator || ALARM_OPERATORS.GT;
        const baseName = ruleData.name || `${variableName || sourceId || '??'}??`;

        return {
            id: ruleData.id || generateRuleId(),
            name: baseName,
            sourceMode,
            variableName,
            sourceComponentId,
            sourceId,
            sourcePath,
            operator,
            threshold: ruleData.threshold ?? '',
            severity: ruleData.severity || ALARM_SEVERITIES.WARNING,
            targetComponentId: ruleData.targetComponentId || '',
            titleTemplate: ruleData.titleTemplate || DEFAULT_TITLE_TEMPLATE,
            enabled: ruleData.enabled !== false,
            muted: ruleData.muted === true,
            pollingIntervalMs: normalizePollingInterval(ruleData.pollingIntervalMs, isDataAccessSourceMode(sourceMode) || isPublicSourceMode(sourceMode) ? DEFAULT_DATA_ACCESS_POLLING_MS : 0),
            triggerDelayMs: normalizeDelay(ruleData.triggerDelayMs),
            recoverDelayMs: normalizeDelay(ruleData.recoverDelayMs),
            autoClear: ruleData.autoClear !== false,
            messageTemplate: ruleData.messageTemplate || DEFAULT_MESSAGE_TEMPLATE,
            filter: normalizeAlarmFilter(ruleData.filter),
            actions: normalizeAlarmActions(ruleData.actions, ruleData),
            description: ruleData.description || '',
            createdAt: ruleData.createdAt || now,
            updatedAt: now
        };
    };

    const getRuleSourcePayload = (rule) => {
        const sourceMode = String(rule?.sourceMode || '').trim() || (rule?.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
        if (isDataAccessSourceMode(sourceMode)) {
            if (!rule?.sourceId) return undefined;
            const snapshot = getDataAccessSnapshot(rule.sourceId);
            return snapshot?.payload;
        }
        if (isPublicSourceMode(sourceMode)) {
            if (!rule?.sourceId) return undefined;
            const runtimeState = getDataSourceRuntimeState(ALARM_PUBLIC_RUNTIME_COMPONENT_ID, rule.sourceId);
            return runtimeState?.lastPayload;
        }
        if (isRuntimeSourceMode(sourceMode)) {
            if (!rule?.sourceComponentId || !rule?.sourceId) return undefined;
            const runtimeState = getDataSourceRuntimeState(rule.sourceComponentId, rule.sourceId);
            return runtimeState?.lastPayload;
        }
        if (!rule?.variableName) return undefined;
        return variableStore.getVariableByName(rule.variableName)?.value;
    };

    const getRuleCurrentValue = (rule, sourcePayload = getRuleSourcePayload(rule)) => {
        return getNestedValue(sourcePayload, rule?.sourcePath || '');
    };

    const getRuleFilterValue = (rule, sourcePayload = getRuleSourcePayload(rule)) => {
        if (rule?.filter?.enabled !== true) {
            return sourcePayload;
        }

        return getNestedValue(sourcePayload, rule?.filter?.path || '');
    };

    const refreshRuleSourcePayload = async (rule) => {
        const sourceMode = String(rule?.sourceMode || '').trim() || (rule?.sourceId ? DEFAULT_SOURCE_MODE : 'variable');

        if (isDataAccessSourceMode(sourceMode)) {
            const accessCode = String(rule?.sourceId || '').trim();
            if (!accessCode) return getRuleSourcePayload(rule);
            const result = await executeDataAccess(accessCode, {});
            setDataAccessSnapshot(accessCode, result?.data);
            return result?.data;
        }

        if (isPublicSourceMode(sourceMode)) {
            const source = getPublicDataSourceDefinition(rule?.sourceId);
            if (!source?.id) return getRuleSourcePayload(rule);
            if (source.mode === 'websocket') {
                const runtimeState = getDataSourceRuntimeState(ALARM_PUBLIC_RUNTIME_COMPONENT_ID, source.id);
                return runtimeState?.lastPayload;
            }

            const result = await executeRuntimeDataSource({
                source: {
                    ...source,
                    id: source.id,
                    mode: source.mode,
                    accessCode: source.accessCode,
                    url: source.mode === 'websocket' ? source.websocketUrl : source.url
                },
                apiBaseUrl: dataSourceStore.globalConfig?.baseUrl || '',
                globalConfig: {
                    ...dataSourceStore.globalConfig,
                    headersObject: dataSourceStore.headersObject
                },
                componentId: ALARM_PUBLIC_RUNTIME_COMPONENT_ID
            });
            return result?.data;
        }

        return getRuleSourcePayload(rule);
    };

    const clearPendingEvaluationTimer = () => {
        if (pendingEvaluationTimer) {
            clearTimeout(pendingEvaluationTimer);
            pendingEvaluationTimer = null;
        }
    };

    const getRuleTimingState = (ruleId) => {
        if (!ruleTimingStateMap.has(ruleId)) {
            ruleTimingStateMap.set(ruleId, {
                triggerStartedAt: null,
                recoverStartedAt: null
            });
        }

        return ruleTimingStateMap.get(ruleId);
    };

    const cleanupRuleTimingState = (ruleId) => {
        const state = ruleTimingStateMap.get(ruleId);
        if (!state) return;

        if (!state.triggerStartedAt && !state.recoverStartedAt) {
            ruleTimingStateMap.delete(ruleId);
            touchRuntimeState();
        }
    };

    const setRuleTimingValue = (ruleId, key, value) => {
        const state = getRuleTimingState(ruleId);
        if (state[key] === value) {
            return state;
        }

        state[key] = value;
        touchRuntimeState();
        return state;
    };

    const playNotificationSound = () => {
        if (typeof window === 'undefined') return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        try {
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            const durationSeconds = Math.max(0.05, Number(notificationSettings.value.soundDurationMs || 180) / 1000);

            oscillator.type = 'sine';
            oscillator.frequency.value = Number(notificationSettings.value.soundFrequency || 880);
            gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + durationSeconds);

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + durationSeconds);
            oscillator.onended = () => {
                audioContext.close().catch(() => {});
            };
        } catch (error) {
            console.warn('[Alarm] Failed to play notification sound', error);
        }
    };

    const notifyAlarmTriggered = (alarm) => {
        if (notificationSettings.value.browserEnabled && typeof window !== 'undefined' && 'Notification' in window) {
            if (window.Notification.permission === 'granted') {
                try {
                    new window.Notification(alarm.ruleName, {
                        body: alarm.message,
                        tag: alarm.ruleId,
                        renotify: true
                    });
                } catch (error) {
                    console.warn('[Alarm] Failed to send browser notification', error);
                }
            }
        }

        if (notificationSettings.value.soundEnabled) {
            playNotificationSound();
        }
    };

    const collectDataAccessCodes = () => {
        const set = new Set();
        rules.value.forEach((rule) => {
            const sourceMode = String(rule?.sourceMode || '').trim() || (rule?.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
            if (!isDataAccessSourceMode(sourceMode)) return;
            const accessCode = String(rule?.sourceId || '').trim();
            if (accessCode) {
                set.add(accessCode);
            }
        });
        return Array.from(set);
    };

    const shouldPollRuleRemoteSource = (rule) => {
        const sourceMode = String(rule?.sourceMode || '').trim() || (rule?.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
        if (rule?.enabled === false) return false;

        if (isDataAccessSourceMode(sourceMode)) {
            return Boolean(rule?.sourceId) && normalizePollingInterval(rule?.pollingIntervalMs) > 0;
        }

        if (isPublicSourceMode(sourceMode)) {
            const source = getPublicDataSourceDefinition(rule?.sourceId);
            if (!source || source.mode === 'websocket') return false;
            return normalizePollingInterval(rule?.pollingIntervalMs) > 0;
        }

        return false;
    };

    const isRefreshableRemoteRule = (rule) => {
        const sourceMode = String(rule?.sourceMode || '').trim() || (rule?.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
        if (rule?.enabled === false) return false;
        if (isDataAccessSourceMode(sourceMode)) {
            return Boolean(String(rule?.sourceId || '').trim());
        }
        if (isPublicSourceMode(sourceMode)) {
            const source = getPublicDataSourceDefinition(rule?.sourceId);
            return Boolean(source?.id) && source.mode !== 'websocket';
        }
        return false;
    };

    const collectRemotePollingTargets = (includeManualOnly = false) => {
        const targets = new Map();

        rules.value.forEach((rule) => {
            if (includeManualOnly ? !isRefreshableRemoteRule(rule) : !shouldPollRuleRemoteSource(rule)) return;

            const sourceMode = String(rule?.sourceMode || '').trim() || (rule?.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
            const pollingIntervalMs = normalizePollingInterval(rule?.pollingIntervalMs);

            if (isDataAccessSourceMode(sourceMode)) {
                const accessCode = String(rule?.sourceId || '').trim();
                if (!accessCode) return;
                const key = `data-access:${accessCode}`;
                const current = targets.get(key);
                if (!current || pollingIntervalMs < current.pollingIntervalMs) {
                    targets.set(key, { key, kind: 'data-access', accessCode, pollingIntervalMs });
                }
                return;
            }

            const source = getPublicDataSourceDefinition(rule?.sourceId);
            if (!source?.id || source.mode === 'websocket') return;
            const key = `public:${source.id}`;
            const current = targets.get(key);
            if (!current || pollingIntervalMs < current.pollingIntervalMs) {
                targets.set(key, { key, kind: 'public', source, pollingIntervalMs });
            }
        });

        const list = Array.from(targets.values());
        debugAlarmRemote(includeManualOnly ? 'collectRemoteTargets(force)' : 'collectRemoteTargets(schedule)', {
            rules: rules.value.map((rule) => ({
                id: rule.id,
                name: rule.name,
                enabled: rule.enabled !== false,
                sourceMode: rule.sourceMode,
                sourceId: rule.sourceId,
                pollingIntervalMs: rule.pollingIntervalMs
            })),
            targets: list.map((target) => ({
                key: target.key,
                kind: target.kind,
                pollingIntervalMs: target.pollingIntervalMs,
                accessCode: target.accessCode,
                sourceId: target.source?.id,
                sourceMode: target.source?.mode
            }))
        });
        return list;
    };

    const shouldRefreshRemoteTarget = (target, forceRefresh = false) => {
        if (forceRefresh) return true;
        if (!target) return false;
        const state = getRemoteSourceFetchState(target.key);
        if (!state.lastFetchedAt) return true;
        return Date.now() - state.lastFetchedAt >= target.pollingIntervalMs;
    };

    const markRemoteTargetFetched = (target) => {
        if (!target?.key) return;
        getRemoteSourceFetchState(target.key).lastFetchedAt = Date.now();
    };

    const refreshDataAccessSnapshots = async ({ forceRefresh = false } = {}) => {
        if (dataAccessRefreshPromise) {
            return dataAccessRefreshPromise;
        }

        const targets = collectRemotePollingTargets(forceRefresh).filter((target) => target.kind === 'data-access' && shouldRefreshRemoteTarget(target, forceRefresh));
        debugAlarmRemote('refreshDataAccessSnapshots', {
            forceRefresh,
            targets: targets.map((target) => ({
                key: target.key,
                accessCode: target.accessCode,
                pollingIntervalMs: target.pollingIntervalMs
            }))
        });
        if (!targets.length) {
            return [];
        }

        dataAccessRefreshPromise = Promise.allSettled(targets.map(async (target) => {
            debugAlarmRemote('requestDataAccess:start', {
                key: target.key,
                accessCode: target.accessCode
            });
            const result = await executeDataAccess(target.accessCode, {});
            setDataAccessSnapshot(target.accessCode, result?.data);
            markRemoteTargetFetched(target);
            debugAlarmRemote('requestDataAccess:done', {
                key: target.key,
                accessCode: target.accessCode,
                hasData: result?.data !== undefined
            });
            return target.accessCode;
        })).finally(() => {
            dataAccessRefreshPromise = null;
        });

        return dataAccessRefreshPromise;
    };

    const refreshPublicSourceSnapshots = async ({ forceRefresh = false } = {}) => {
        const targets = collectRemotePollingTargets(forceRefresh).filter((target) => target.kind === 'public' && shouldRefreshRemoteTarget(target, forceRefresh));
        debugAlarmRemote('refreshPublicSourceSnapshots', {
            forceRefresh,
            targets: targets.map((target) => ({
                key: target.key,
                sourceId: target.source?.id,
                mode: target.source?.mode,
                url: target.source?.url || target.source?.websocketUrl || ''
            }))
        });
        if (!targets.length) return [];

        return Promise.allSettled(targets.map(async (target) => {
            const source = target.source;
            const sourceConfig = {
                ...source,
                id: source.id,
                mode: source.mode,
                accessCode: source.accessCode,
                url: source.mode === 'websocket' ? source.websocketUrl : source.url
            };
            debugAlarmRemote('requestPublicSource:start', {
                key: target.key,
                sourceId: source.id,
                mode: source.mode,
                url: sourceConfig.url
            });
            const result = await executeRuntimeDataSource({
                source: sourceConfig,
                apiBaseUrl: dataSourceStore.globalConfig?.baseUrl || '',
                globalConfig: {
                    ...dataSourceStore.globalConfig,
                    headersObject: dataSourceStore.headersObject
                },
                componentId: ALARM_PUBLIC_RUNTIME_COMPONENT_ID
            });
            markRemoteTargetFetched(target);
            debugAlarmRemote('requestPublicSource:done', {
                key: target.key,
                sourceId: source.id,
                mode: source.mode,
                hasData: result?.data !== undefined
            });
            return result;
        }));
    };

    const scheduleRemoteSourcePolling = () => {
        clearRemoteSourcePollingTimer();
        if (!isAutoEvaluationEnabled()) return;
        const targets = collectRemotePollingTargets();
        if (!targets.length) return;

        const now = Date.now();
        let nextDelay = null;
        targets.forEach((target) => {
            const state = getRemoteSourceFetchState(target.key);
            const dueAt = state.lastFetchedAt ? state.lastFetchedAt + target.pollingIntervalMs : now;
            const delay = Math.max(0, dueAt - now);
            nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay);
        });

        remoteSourcePollingTimer = setTimeout(async () => {
            remoteSourcePollingTimer = null;
            try {
                await evaluateAllRules();
            } catch (error) {
                console.warn('[Alarm] Failed to refresh remote alarm sources', error);
            }
        }, nextDelay === null ? DEFAULT_DATA_ACCESS_POLLING_MS : nextDelay);
    };

    const schedulePendingEvaluation = () => {
        clearPendingEvaluationTimer();
        if (!isAutoEvaluationEnabled()) return;

        let nextEvaluationAt = null;

        for (const rule of rules.value) {
            const state = ruleTimingStateMap.get(rule.id);
            if (!state) continue;

            if (state.triggerStartedAt && rule.triggerDelayMs > 0) {
                const candidate = state.triggerStartedAt + rule.triggerDelayMs;
                nextEvaluationAt = nextEvaluationAt === null ? candidate : Math.min(nextEvaluationAt, candidate);
            }

            if (state.recoverStartedAt && rule.recoverDelayMs > 0) {
                const candidate = state.recoverStartedAt + rule.recoverDelayMs;
                nextEvaluationAt = nextEvaluationAt === null ? candidate : Math.min(nextEvaluationAt, candidate);
            }
        }

        if (nextEvaluationAt === null) {
            return;
        }

        const timeout = Math.max(0, nextEvaluationAt - Date.now());
        pendingEvaluationTimer = setTimeout(() => {
            pendingEvaluationTimer = null;
            evaluateAllRules();
        }, timeout);
    };

    const compareValues = (currentValue, operator, threshold, previousValue) => {
        if (operator === ALARM_OPERATORS.CHANGED) {
            return previousValue !== undefined && !isSameValue(currentValue, previousValue);
        }

        if (operator === ALARM_OPERATORS.CONTAINS) {
            if (Array.isArray(currentValue)) {
                return currentValue.some((item) => isSameValue(item, threshold));
            }
            return stringifyValue(currentValue).includes(String(threshold ?? ''));
        }

        const numericCurrent = toComparableNumber(currentValue);
        const numericThreshold = toComparableNumber(threshold);

        if (numericCurrent !== null && numericThreshold !== null) {
            switch (operator) {
                case ALARM_OPERATORS.GT:
                    return numericCurrent > numericThreshold;
                case ALARM_OPERATORS.GTE:
                    return numericCurrent >= numericThreshold;
                case ALARM_OPERATORS.LT:
                    return numericCurrent < numericThreshold;
                case ALARM_OPERATORS.LTE:
                    return numericCurrent <= numericThreshold;
                case ALARM_OPERATORS.EQ:
                    return numericCurrent === numericThreshold;
                case ALARM_OPERATORS.NEQ:
                    return numericCurrent !== numericThreshold;
                default:
                    return false;
            }
        }

        const stringCurrent = stringifyValue(currentValue);
        const stringThreshold = stringifyValue(threshold);

        switch (operator) {
            case ALARM_OPERATORS.EQ:
                return stringCurrent === stringThreshold;
            case ALARM_OPERATORS.NEQ:
                return stringCurrent !== stringThreshold;
            default:
                return false;
        }
    };

    const buildAlarmMessage = (rule, currentValue) => {
        const template = rule.messageTemplate || DEFAULT_MESSAGE_TEMPLATE;
        const replacers = {
            ruleName: rule.name,
            variableName: rule.variableName,
            value: stringifyValue(currentValue),
            threshold: stringifyValue(rule.threshold),
            severity: ALARM_SEVERITY_CONFIG[rule.severity]?.label || rule.severity,
            operator: rule.operator,
            sourceId: rule.sourceId || '',
            sourcePath: rule.sourcePath || ''
        };

        return template.replace(/\{(ruleName|variableName|value|threshold|severity|operator|sourceId|sourcePath)\}/g, (match, key) => {
            return replacers[key] ?? match;
        });
    };

    const buildAlarmTitle = (rule, currentValue) => {
        const template = rule.titleTemplate || DEFAULT_TITLE_TEMPLATE;
        const replacers = {
            ruleName: rule.name,
            variableName: rule.variableName,
            value: stringifyValue(currentValue),
            threshold: stringifyValue(rule.threshold),
            severity: ALARM_SEVERITY_CONFIG[rule.severity]?.label || rule.severity,
            operator: rule.operator,
            sourceId: rule.sourceId || '',
            sourcePath: rule.sourcePath || ''
        };

        return template.replace(/\{(ruleName|variableName|value|threshold|severity|operator|sourceId|sourcePath)\}/g, (match, key) => {
            return replacers[key] ?? match;
        });
    };

    const pushHistory = (record) => {
        alarmHistory.value.unshift(record);
        if (alarmHistory.value.length > 100) {
            alarmHistory.value = alarmHistory.value.slice(0, 100);
        }
    };

    const triggerAlarm = (rule, currentValue, filterValue) => {
        const existing = activeAlarmMap.value[rule.id];
        const now = Date.now();
        const title = buildAlarmTitle(rule, currentValue);
        const message = buildAlarmMessage(rule, currentValue);
        const actionsSnapshot = (rule.actions || []).map((item) => ({ ...item }));
        const primaryTargetComponentId = getPrimaryTargetComponentIdFromActions(actionsSnapshot) || rule.targetComponentId || '';
        const actionTypes = actionsSnapshot.map((action) => action?.type).filter(Boolean);

        console.log('[Alarm] triggerAlarm', {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            currentValue: cloneValue(currentValue),
            filterValue: cloneValue(filterValue),
            actionCount: actionsSnapshot.length,
            actionTypes
        });

        if (existing) {
            existing.title = title;
            existing.currentValue = cloneValue(currentValue);
            existing.lastValue = cloneValue(currentValue);
            existing.filter = rule.filter ? { ...rule.filter } : normalizeAlarmFilter();
            existing.message = message;
            existing.triggerCount += 1;
            existing.lastTriggeredAt = now;
            existing.actionsSnapshot = actionsSnapshot;
            existing.targetComponentId = primaryTargetComponentId;
            existing.filterValue = cloneValue(filterValue);
            appendAlarmLogSafe({
                type: 'updated',
                level: 'info',
                ruleId: rule.id,
                ruleName: rule.name,
                message: `告警重复触发，当前值 ${stringifyValue(currentValue)}`,
                details: {
                    severity: rule.severity,
                    currentValue: cloneValue(currentValue),
                    filterValue: cloneValue(filterValue),
                    actionTypes
                }
            });
            return existing;
        }

        const record = {
            id: generateAlarmId(),
            ruleId: rule.id,
            ruleName: rule.name,
            variableName: rule.variableName,
            sourceMode: rule.sourceMode,
            sourceComponentId: rule.sourceComponentId,
            sourceId: rule.sourceId,
            sourcePath: rule.sourcePath,
            severity: rule.severity,
            targetComponentId: primaryTargetComponentId,
            title,
            message,
            currentValue: cloneValue(currentValue),
            lastValue: cloneValue(currentValue),
            filterValue: cloneValue(filterValue),
            threshold: rule.threshold,
            operator: rule.operator,
            filter: rule.filter ? { ...rule.filter } : normalizeAlarmFilter(),
            actionsSnapshot,
            triggerCount: 1,
            acknowledgedAt: null,
            triggeredAt: now,
            lastTriggeredAt: now
        };

        activeAlarms.value.unshift(record);
        pushHistory({
            ...record,
            status: 'triggered'
        });
        appendAlarmLogSafe({
            type: 'triggered',
            level: 'info',
            ruleId: rule.id,
            ruleName: rule.name,
            message: `触发告警，动作 ${actionTypes.join(', ') || '无'}`,
            details: {
                severity: rule.severity,
                currentValue: cloneValue(currentValue),
                filterValue: cloneValue(filterValue),
                actionTypes
            }
        });
        notifyAlarmTriggered(record);
        return record;
    };

    const getRuleRuntimeState = (ruleId) => {
        runtimeStateVersion.value;

        const rule = rules.value.find((item) => item.id === ruleId);
        if (!rule) {
            return { status: 'missing', remainingMs: 0 };
        }

        const state = ruleTimingStateMap.get(ruleId);
        if (!state) {
            return { status: 'idle', remainingMs: 0 };
        }

        if (state.triggerStartedAt && rule.triggerDelayMs > 0) {
            return {
                status: 'pending-trigger',
                remainingMs: Math.max(0, state.triggerStartedAt + rule.triggerDelayMs - Date.now())
            };
        }

        if (state.recoverStartedAt && rule.recoverDelayMs > 0) {
            return {
                status: 'pending-recover',
                remainingMs: Math.max(0, state.recoverStartedAt + rule.recoverDelayMs - Date.now())
            };
        }

        return { status: 'idle', remainingMs: 0 };
    };

    const resolveAlarm = (ruleId, status = 'cleared') => {
        const index = activeAlarms.value.findIndex((alarm) => alarm.ruleId === ruleId);
        if (index === -1) return null;

        const [alarm] = activeAlarms.value.splice(index, 1);
        pushHistory({
            ...alarm,
            status,
            resolvedAt: Date.now()
        });
        appendAlarmLogSafe({
            type: status,
            level: status.includes('deleted') ? 'warning' : 'info',
            ruleId: alarm.ruleId,
            ruleName: alarm.ruleName,
            message: `告警已${status}`,
            details: {
                currentValue: cloneValue(alarm.currentValue),
                triggerCount: alarm.triggerCount
            }
        });
        return alarm;
    };

    const evaluateRule = (rule) => {
        const timingState = rule?.id ? getRuleTimingState(rule.id) : null;

        if (!rule || rule.enabled === false) {
            if (timingState) {
                setRuleTimingValue(rule.id, 'triggerStartedAt', null);
                setRuleTimingValue(rule.id, 'recoverStartedAt', null);
                cleanupRuleTimingState(rule.id);
                schedulePendingEvaluation();
            }
            resolveAlarm(rule?.id, 'disabled');
            return false;
        }

        if (rule.muted === true) {
            setRuleTimingValue(rule.id, 'triggerStartedAt', null);
            setRuleTimingValue(rule.id, 'recoverStartedAt', null);
            cleanupRuleTimingState(rule.id);
            schedulePendingEvaluation();
            resolveAlarm(rule.id, 'suppressed');
            return false;
        }

        const sourceMode = String(rule.sourceMode || '').trim() || (rule.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
        if (sourceMode === 'variable' && rule.variableName && !variableStore.getVariableByName(rule.variableName)) {
            setRuleTimingValue(rule.id, 'triggerStartedAt', null);
            setRuleTimingValue(rule.id, 'recoverStartedAt', null);
            cleanupRuleTimingState(rule.id);
            schedulePendingEvaluation();
            resolveAlarm(rule.id, 'missing-variable');
            return false;
        }

        const now = Date.now();
        const sourcePayload = getRuleSourcePayload(rule);
        const currentValue = getRuleCurrentValue(rule, sourcePayload);
        const filterValue = getRuleFilterValue(rule, sourcePayload);
        const previousSnapshot = previousValueMap.get(getRuleValueStorageKey(rule)) || {};
        const missingThreshold = operatorRequiresThreshold(rule.operator) && !hasMeaningfulThreshold(rule.threshold);
        const missingFilterThreshold = rule.filter?.enabled === true
            && operatorRequiresThreshold(rule.filter.operator)
            && !hasMeaningfulThreshold(rule.filter.threshold);
        const filterMatched = rule.filter?.enabled === true
            ? (missingFilterThreshold ? false : compareValues(filterValue, rule.filter.operator, rule.filter.threshold, previousSnapshot.filterValue))
            : true;
        const matched = !missingThreshold && filterMatched
            ? compareValues(currentValue, rule.operator, rule.threshold, previousSnapshot.value)
            : false;
        const activeAlarm = activeAlarmMap.value[rule.id];

        if (missingThreshold) {
            console.warn('[Alarm] evaluateRule skipped: missing threshold', {
                ruleId: rule.id,
                ruleName: rule.name,
                operator: rule.operator,
                threshold: rule.threshold
            });
        }

        if (missingFilterThreshold) {
            console.warn('[Alarm] evaluateRule skipped: missing filter threshold', {
                ruleId: rule.id,
                ruleName: rule.name,
                filterOperator: rule.filter?.operator,
                filterThreshold: rule.filter?.threshold
            });
        }

        console.log('[Alarm] evaluateRule result', {
            ruleId: rule.id,
            ruleName: rule.name,
            sourceMode,
            sourceId: rule.sourceId,
            sourcePath: rule.sourcePath,
            operator: rule.operator,
            threshold: cloneValue(rule.threshold),
            currentValue: cloneValue(currentValue),
            previousValue: cloneValue(previousSnapshot.value),
            filterEnabled: rule.filter?.enabled === true,
            filterPath: rule.filter?.path || '',
            filterOperator: rule.filter?.operator || '',
            filterThreshold: cloneValue(rule.filter?.threshold),
            filterValue: cloneValue(filterValue),
            previousFilterValue: cloneValue(previousSnapshot.filterValue),
            filterMatched,
            matched,
            activeAlarmId: activeAlarm?.id || '',
            actionCount: Array.isArray(rule.actions) ? rule.actions.length : 0,
            actionTypes: Array.isArray(rule.actions) ? rule.actions.map((action) => action?.type) : []
        });
        console.log(
            `[Alarm] evaluateRule summary rule=${rule.name} source=${sourceMode}:${rule.sourceId || ''} path=${rule.sourcePath || '(root)'} `
            + `operator=${rule.operator} threshold=${stringifyForDebug(rule.threshold)} `
            + `current=${stringifyForDebug(currentValue)} previous=${stringifyForDebug(previousSnapshot.value)} `
            + `filterEnabled=${rule.filter?.enabled === true} filterPath=${rule.filter?.path || '(root)'} `
            + `filterOperator=${rule.filter?.operator || ''} filterThreshold=${stringifyForDebug(rule.filter?.threshold)} `
            + `filterValue=${stringifyForDebug(filterValue)} previousFilter=${stringifyForDebug(previousSnapshot.filterValue)} `
            + `filterMatched=${String(filterMatched)} matched=${String(matched)} `
            + `actions=${(Array.isArray(rule.actions) ? rule.actions.map((action) => action?.type) : []).join(',')}`
        );

        if (matched) {
            console.log('[Alarm] evaluateRule matched', {
                ruleId: rule.id,
                ruleName: rule.name,
                sourceMode,
                sourceId: rule.sourceId,
                sourcePath: rule.sourcePath,
                currentValue: cloneValue(currentValue),
                filterMatched,
                filterValue: cloneValue(filterValue),
                actionCount: Array.isArray(rule.actions) ? rule.actions.length : 0,
                actionTypes: Array.isArray(rule.actions) ? rule.actions.map((action) => action?.type) : []
            });
        }

        if (matched) {
            setRuleTimingValue(rule.id, 'recoverStartedAt', null);

            if (activeAlarm) {
                setRuleTimingValue(rule.id, 'triggerStartedAt', null);
                cleanupRuleTimingState(rule.id);
                schedulePendingEvaluation();
                triggerAlarm(rule, currentValue, filterValue);
                return true;
            }

            if (rule.triggerDelayMs > 0) {
                if (!timingState.triggerStartedAt) {
                    setRuleTimingValue(rule.id, 'triggerStartedAt', now);
                    schedulePendingEvaluation();
                    return true;
                }

                if (now - timingState.triggerStartedAt < rule.triggerDelayMs) {
                    schedulePendingEvaluation();
                    return true;
                }
            }

            setRuleTimingValue(rule.id, 'triggerStartedAt', null);
            cleanupRuleTimingState(rule.id);
            schedulePendingEvaluation();
            triggerAlarm(rule, currentValue, filterValue);
        } else {
            setRuleTimingValue(rule.id, 'triggerStartedAt', null);

            if (!activeAlarm) {
                setRuleTimingValue(rule.id, 'recoverStartedAt', null);
                cleanupRuleTimingState(rule.id);
                schedulePendingEvaluation();
                return false;
            }

            if (rule.autoClear === false) {
                setRuleTimingValue(rule.id, 'recoverStartedAt', null);
                cleanupRuleTimingState(rule.id);
                schedulePendingEvaluation();
                return false;
            }

            if (rule.recoverDelayMs > 0) {
                if (!timingState.recoverStartedAt) {
                    setRuleTimingValue(rule.id, 'recoverStartedAt', now);
                    schedulePendingEvaluation();
                    return false;
                }

                if (now - timingState.recoverStartedAt < rule.recoverDelayMs) {
                    schedulePendingEvaluation();
                    return false;
                }
            }

            setRuleTimingValue(rule.id, 'recoverStartedAt', null);
            cleanupRuleTimingState(rule.id);
            schedulePendingEvaluation();
            resolveAlarm(rule.id, 'cleared');
        }

        return matched;
    };

    const snapshotVariableValues = () => {
        previousValueMap.clear();
        for (const rule of rules.value) {
            const sourcePayload = getRuleSourcePayload(rule);
            previousValueMap.set(getRuleValueStorageKey(rule), {
                payload: cloneValue(sourcePayload),
                value: cloneValue(getRuleCurrentValue(rule, sourcePayload)),
                filterValue: cloneValue(getRuleFilterValue(rule, sourcePayload))
            });
        }
    };

    const evaluateAllRules = async (options = {}) => {
        const { forceRefreshRemote = false, ignoreAutoEvaluation = false } = options;
        if (!ignoreAutoEvaluation && !isAutoEvaluationEnabled()) {
            debugAlarmRemote('evaluateAllRules:skipped', {
                forceRefreshRemote,
                ruleCount: rules.value.length
            });
            return [];
        }
        debugAlarmRemote('evaluateAllRules:start', {
            forceRefreshRemote,
            ruleCount: rules.value.length,
            enabledRuleCount: enabledRules.value.length
        });
        await refreshDataAccessSnapshots({ forceRefresh: forceRefreshRemote });
        await refreshPublicSourceSnapshots({ forceRefresh: forceRefreshRemote });
        enabledRules.value.forEach((rule) => evaluateRule(rule));
        lastEvaluationAt.value = Date.now();
        snapshotVariableValues();
        scheduleRemoteSourcePolling();
        debugAlarmRemote('evaluateAllRules:done', {
            forceRefreshRemote,
            activeAlarmCount: activeAlarms.value.length,
            lastEvaluationAt: lastEvaluationAt.value
        });
    };

    const testRule = async (ruleId) => {
        const rule = rules.value.find((item) => item.id === ruleId);
        if (!rule) {
            throw new Error(`告警规则不存在: ${ruleId}`);
        }

        const sourcePayload = await refreshRuleSourcePayload(rule);
        const currentValue = getRuleCurrentValue(rule, sourcePayload);
        const filterValue = getRuleFilterValue(rule, sourcePayload);

        setRuleTimingValue(rule.id, 'triggerStartedAt', null);
        setRuleTimingValue(rule.id, 'recoverStartedAt', null);
        cleanupRuleTimingState(rule.id);

        const record = triggerAlarm(rule, currentValue, filterValue);
        lastEvaluationAt.value = Date.now();
        snapshotVariableValues();
        schedulePendingEvaluation();
        scheduleRemoteSourcePolling();
        return record;
    };

    const addRule = (ruleData) => {
        const payload = createRulePayload(ruleData);
        validateRule(payload);
        rules.value.push(payload);
        evaluateAllRules({ forceRefreshRemote: true });
        scheduleRemoteSourcePolling();
        return payload;
    };

    const updateRule = (id, updates) => {
        const index = rules.value.findIndex((rule) => rule.id === id);
        if (index === -1) {
            throw new Error(`告警规则不存在: ${id}`);
        }

        const merged = {
            ...rules.value[index],
            ...updates,
            filter: normalizeAlarmFilter(updates.filter ?? rules.value[index].filter),
            actions: normalizeAlarmActions(updates.actions ?? rules.value[index].actions, {
                ...rules.value[index],
                ...updates
            }),
            updatedAt: Date.now()
        };
        validateRule(merged, id);
        rules.value[index] = merged;
        evaluateAllRules({ forceRefreshRemote: true });
        schedulePendingEvaluation();
        scheduleRemoteSourcePolling();
        return merged;
    };

    const removeRule = (id) => {
        const index = rules.value.findIndex((rule) => rule.id === id);
        if (index === -1) {
            return null;
        }
        ruleTimingStateMap.delete(id);
        schedulePendingEvaluation();
        scheduleRemoteSourcePolling();
        resolveAlarm(id, 'deleted');
        return rules.value.splice(index, 1)[0];
    };

    const acknowledgeAlarm = (alarmId) => {
        const alarm = activeAlarms.value.find((item) => item.id === alarmId);
        if (!alarm) return null;
        alarm.acknowledgedAt = Date.now();
        pushHistory({
            ...alarm,
            status: 'acknowledged'
        });
        appendAlarmLogSafe({
            type: 'acknowledged',
            level: 'info',
            ruleId: alarm.ruleId,
            ruleName: alarm.ruleName,
            message: '告警已确认',
            details: {
                currentValue: cloneValue(alarm.currentValue)
            }
        });
        return alarm;
    };

    const clearAlarm = (alarmId) => {
        const alarm = activeAlarms.value.find((item) => item.id === alarmId);
        if (!alarm) return null;
        return resolveAlarm(alarm.ruleId, 'cleared-manual');
    };

    const toggleRuleEnabled = (id) => {
        const rule = rules.value.find((item) => item.id === id);
        if (!rule) return null;
        rule.enabled = !rule.enabled;
        rule.updatedAt = Date.now();
        if (rule.enabled) {
            evaluateAllRules({ forceRefreshRemote: true });
        } else {
            evaluateRule(rule);
            snapshotVariableValues();
            schedulePendingEvaluation();
            scheduleRemoteSourcePolling();
        }
        return rule;
    };

    const toggleRuleMuted = (id) => {
        const rule = rules.value.find((item) => item.id === id);
        if (!rule) return null;
        rule.muted = rule.muted !== true;
        rule.updatedAt = Date.now();
        evaluateRule(rule);
        snapshotVariableValues();
        schedulePendingEvaluation();
        scheduleRemoteSourcePolling();
        return rule;
    };

    const clearHistory = () => {
        alarmHistory.value = [];
    };

    const updateNotificationSettings = (updates = {}) => {
        notificationSettings.value = {
            ...notificationSettings.value,
            ...updates,
            soundFrequency: Math.max(220, Number(updates.soundFrequency ?? notificationSettings.value.soundFrequency ?? 880)),
            soundDurationMs: Math.max(60, Number(updates.soundDurationMs ?? notificationSettings.value.soundDurationMs ?? 180))
        };

        return notificationSettings.value;
    };

    const clearAllActive = () => {
        const ids = activeAlarms.value.map((alarm) => alarm.id);
        ids.forEach((alarmId) => clearAlarm(alarmId));
    };

    const setAutoEvaluationEnabled = (enabled, options = {}) => {
        const nextEnabled = enabled !== false;
        const { clearActiveAlarms = !nextEnabled } = options;
        autoEvaluationEnabled.value = nextEnabled;

        if (!nextEnabled) {
            clearPendingEvaluationTimer();
            clearRemoteSourcePollingTimer();
            if (clearActiveAlarms) {
                activeAlarms.value = [];
            }
        } else {
            schedulePendingEvaluation();
            scheduleRemoteSourcePolling();
        }

        return autoEvaluationEnabled.value;
    };

    const serialize = () => {
        return {
            rules: rules.value.map((rule) => ({
                id: rule.id,
                name: rule.name,
                sourceMode: rule.sourceMode,
                variableName: rule.variableName,
                sourceComponentId: rule.sourceComponentId,
                sourceId: rule.sourceId,
                sourcePath: rule.sourcePath,
                operator: rule.operator,
                threshold: rule.threshold,
                severity: rule.severity,
                targetComponentId: rule.targetComponentId,
                titleTemplate: rule.titleTemplate,
                enabled: rule.enabled,
                muted: rule.muted === true,
                pollingIntervalMs: rule.pollingIntervalMs,
                triggerDelayMs: rule.triggerDelayMs,
                recoverDelayMs: rule.recoverDelayMs,
                autoClear: rule.autoClear,
                messageTemplate: rule.messageTemplate,
                filter: rule.filter ? { ...rule.filter } : normalizeAlarmFilter(),
                actions: (rule.actions || []).map((action) => ({ ...action })),
                description: rule.description,
                createdAt: rule.createdAt,
                updatedAt: rule.updatedAt
            })),
            notificationSettings: { ...notificationSettings.value }
        };
    };

    const deserialize = (data) => {
        activeAlarms.value = [];
        alarmHistory.value = [];
        ruleTimingStateMap.clear();
        dataAccessSnapshotMap.clear();
        clearPendingEvaluationTimer();
        clearRemoteSourcePollingTimer();
        remoteSourceFetchStateMap.clear();

        const normalizedData = Array.isArray(data)
            ? { rules: data, notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS } }
            : (data && typeof data === 'object'
                ? {
                    rules: Array.isArray(data.rules) ? data.rules : [],
                    notificationSettings: {
                        ...DEFAULT_NOTIFICATION_SETTINGS,
                        ...(data.notificationSettings || {})
                    }
                }
                : { rules: [], notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS } });

        notificationSettings.value = {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...normalizedData.notificationSettings
        };

        if (!Array.isArray(normalizedData.rules)) {
            rules.value = [];
            ruleCounter = 0;
            snapshotVariableValues();
            return;
        }

        let maxRuleCounter = 0;
        for (const item of normalizedData.rules) {
            const match = typeof item?.id === 'string' ? item.id.match(/^alarm_rule_(\d+)_/) : null;
            if (match) {
                maxRuleCounter = Math.max(maxRuleCounter, Number(match[1]));
            }
        }
        ruleCounter = maxRuleCounter;
        rules.value = normalizedData.rules.map((item) => ({
            id: item.id || generateRuleId(),
            sourceMode: item.sourceMode || (item.sourceId ? DEFAULT_SOURCE_MODE : 'variable'),
            name: item.name || `${item.variableName || '变量'}告警`,
            variableName: item.variableName || '',
            sourceComponentId: item.sourceComponentId || '',
            sourceId: item.sourceId || '',
            sourcePath: item.sourcePath || '',
            operator: item.operator || ALARM_OPERATORS.GT,
            threshold: item.threshold ?? '',
            severity: item.severity || ALARM_SEVERITIES.WARNING,
            targetComponentId: item.targetComponentId || '',
            titleTemplate: item.titleTemplate || DEFAULT_TITLE_TEMPLATE,
            enabled: item.enabled !== false,
            muted: item.muted === true,
            pollingIntervalMs: normalizePollingInterval(item.pollingIntervalMs, isDataAccessSourceMode(item.sourceMode || (item.sourceId ? DEFAULT_SOURCE_MODE : 'variable')) || isPublicSourceMode(item.sourceMode) ? DEFAULT_DATA_ACCESS_POLLING_MS : 0),
            triggerDelayMs: normalizeDelay(item.triggerDelayMs),
            recoverDelayMs: normalizeDelay(item.recoverDelayMs),
            autoClear: item.autoClear !== false,
            messageTemplate: item.messageTemplate || DEFAULT_MESSAGE_TEMPLATE,
            filter: normalizeAlarmFilter(item.filter),
            actions: normalizeAlarmActions(item.actions, item),
            description: item.description || '',
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now()
        }));
        console.log('[Alarm] deserialize complete', {
            ruleCount: rules.value.length,
            rules: rules.value.map((rule) => ({
                id: rule.id,
                name: rule.name,
                sourceMode: rule.sourceMode,
                sourceId: rule.sourceId,
                enabled: rule.enabled !== false,
                actionCount: Array.isArray(rule.actions) ? rule.actions.length : 0,
                actionTypes: Array.isArray(rule.actions) ? rule.actions.map((action) => action?.type) : []
            }))
        });
        snapshotVariableValues();
        evaluateAllRules({ forceRefreshRemote: true }).catch((error) => {
            console.warn('[Alarm] Failed to evaluate rules after deserialize', error);
        });
        schedulePendingEvaluation();
        scheduleRemoteSourcePolling();
    };

    watch(
        () => ({
            variables: variableStore.variables.map((item) => ({
                name: item.name,
                value: item.value,
                updatedAt: item.updatedAt
            })),
            sources: rules.value.map((rule) => {
                const sourceMode = String(rule.sourceMode || '').trim() || (rule.sourceId ? DEFAULT_SOURCE_MODE : 'variable');
                if (isPublicSourceMode(sourceMode) && rule.sourceId) {
                    const publicSource = getPublicDataSourceDefinition(rule.sourceId);
                    if (publicSource?.mode !== 'websocket') {
                        return `${rule.id}:public:polled`;
                    }
                    const runtimeState = getDataSourceRuntimeState(ALARM_PUBLIC_RUNTIME_COMPONENT_ID, rule.sourceId);
                    return `${rule.id}:public:${runtimeState?.lastUpdatedAt || ''}`;
                }
                if (!isRuntimeSourceMode(sourceMode) || !rule.sourceComponentId || !rule.sourceId) {
                    return `${rule.id}:variable`;
                }
                const runtimeState = getDataSourceRuntimeState(rule.sourceComponentId, rule.sourceId);
                return `${rule.id}:${runtimeState?.lastUpdatedAt || ''}`;
            })
        }),
        () => {
            evaluateAllRules().catch((error) => {
                console.warn('[Alarm] Failed to evaluate alarm rules', error);
            });
            schedulePendingEvaluation();
            scheduleRemoteSourcePolling();
        },
        { deep: true }
    );

    return {
        rules,
        activeAlarms,
        alarmHistory,
        lastEvaluationAt,
        activeCount,
        acknowledgedCount,
        enabledRules,
        severityStats,
        addRule,
        updateRule,
        removeRule,
        acknowledgeAlarm,
        clearAlarm,
        clearAllActive,
        clearHistory,
        notificationSettings,
        updateNotificationSettings,
        autoEvaluationEnabled,
        setAutoEvaluationEnabled,
        getRuleRuntimeState,
        toggleRuleEnabled,
        toggleRuleMuted,
        evaluateRule,
        evaluateAllRules,
        testRule,
        serialize,
        deserialize
    };
});
