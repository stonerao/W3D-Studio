import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const MAX_REQUEST_LOGS = 60;
const MAX_ALARM_LOGS = 80;

const createRenderStats = () => ({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
    objectCount: 0,
    meshCount: 0,
    lightCount: 0,
    updatedAt: ''
});

const createSceneStatus = () => ({
    initialized: false,
    loading: false,
    error: '',
    componentCount: 0,
    selectedComponentId: '',
    selectedComponentName: '',
    activeAlarmCount: 0,
    updatedAt: ''
});

const toPreviewText = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const clampLogList = (list, maxSize) => list.slice(0, maxSize);

export const useDiagnosticsStore = defineStore('diagnostics', () => {
    const renderStats = ref(createRenderStats());
    const sceneStatus = ref(createSceneStatus());
    const requestLogs = ref([]);
    const alarmLogs = ref([]);

    const issueCount = computed(() => {
        const requestIssues = requestLogs.value.filter((item) => item.status === 'error').length;
        const alarmIssues = alarmLogs.value.filter((item) => item.level === 'error').length;
        return requestIssues + alarmIssues + (sceneStatus.value.error ? 1 : 0);
    });

    const updateRenderStats = (patch = {}) => {
        renderStats.value = {
            ...renderStats.value,
            ...patch,
            updatedAt: new Date().toISOString()
        };
    };

    const updateSceneStatus = (patch = {}) => {
        sceneStatus.value = {
            ...sceneStatus.value,
            ...patch,
            updatedAt: new Date().toISOString()
        };
    };

    const appendRequestLog = (entry = {}) => {
        requestLogs.value = clampLogList([
            {
                id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                channel: entry.channel || 'runtime',
                mode: entry.mode || '',
                target: entry.target || '',
                method: entry.method || '',
                status: entry.status || 'success',
                durationMs: Number(entry.durationMs) || 0,
                summary: toPreviewText(entry.summary || ''),
                details: entry.details ?? null,
                timestamp: entry.timestamp || new Date().toISOString()
            },
            ...requestLogs.value
        ], MAX_REQUEST_LOGS);
    };

    const appendAlarmLog = (entry = {}) => {
        alarmLogs.value = clampLogList([
            {
                id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                type: entry.type || 'info',
                level: entry.level || 'info',
                ruleId: entry.ruleId || '',
                ruleName: entry.ruleName || '',
                message: entry.message || '',
                details: entry.details ?? null,
                timestamp: entry.timestamp || new Date().toISOString()
            },
            ...alarmLogs.value
        ], MAX_ALARM_LOGS);
    };

    const clearRequestLogs = () => {
        requestLogs.value = [];
    };

    const clearAlarmLogs = () => {
        alarmLogs.value = [];
    };

    const resetSceneDiagnostics = () => {
        renderStats.value = createRenderStats();
        sceneStatus.value = createSceneStatus();
    };

    return {
        renderStats,
        sceneStatus,
        requestLogs,
        alarmLogs,
        issueCount,
        updateRenderStats,
        updateSceneStatus,
        appendRequestLog,
        appendAlarmLog,
        clearRequestLogs,
        clearAlarmLogs,
        resetSceneDiagnostics
    };
});
