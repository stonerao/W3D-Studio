import { useDiagnosticsStore } from '../stores/useDiagnosticsStore';

const buildSummary = (payload) => {
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
        console.warn('[Diagnostics] append data-access request log failed:', error);
    }
};

export async function fetchDataAccessList() {
    return [];
}

export async function executeDataAccess(accessCode, params = {}) {
    const startedAt = Date.now();
    const result = {
        success: false,
        disabled: true,
        data: null,
        message: '后端数据接入已移除'
    };

    appendRequestLogSafe({
        channel: 'runtime',
        mode: 'data-access',
        method: 'LOCAL',
        target: accessCode,
        status: 'disabled',
        durationMs: Date.now() - startedAt,
        summary: buildSummary(result),
        details: {
            params
        }
    });

    return result;
}
