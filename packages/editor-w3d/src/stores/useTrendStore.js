import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useVariableStore } from './useVariableStore';

const DEFAULT_WINDOW = '15m';
const DEFAULT_RETAINED_POINTS = 120;
const DEFAULT_ARCHIVE_POINTS = 5000;
const DEFAULT_CUSTOM_RANGE_MS = 60 * 60 * 1000;

const WINDOW_PRESET_MS = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    all: 0,
    custom: 0
};

const DEFAULT_ANALYSIS_SETTINGS = {
    showAverageLine: true,
    showMinMaxMarkers: true,
    showThresholdLines: true,
    movingAverageWindow: 5,
    playbackProjectionEnabled: true,
    playbackStepPercent: 5
};

const toNumericValue = (value) => {
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

const normalizeTimestamp = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

const normalizeRetainedPoints = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_RETAINED_POINTS;
    }

    return Math.max(20, Math.min(1000, Math.round(numeric)));
};

const normalizeArchivePoints = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return DEFAULT_ARCHIVE_POINTS;
    }

    return Math.max(200, Math.min(50000, Math.round(numeric)));
};

const normalizeOptionalNumber = (value) => {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const normalizeAnalysisSettings = (value = {}) => ({
    ...DEFAULT_ANALYSIS_SETTINGS,
    ...(value && typeof value === 'object' ? value : {}),
    movingAverageWindow: Math.max(2, Math.min(60, Math.round(Number(value?.movingAverageWindow) || DEFAULT_ANALYSIS_SETTINGS.movingAverageWindow))),
    playbackStepPercent: Math.max(1, Math.min(25, Math.round(Number(value?.playbackStepPercent) || DEFAULT_ANALYSIS_SETTINGS.playbackStepPercent))),
    playbackProjectionEnabled: value?.playbackProjectionEnabled !== false
});

const normalizeVariableDisplaySetting = (value = {}) => ({
    unit: typeof value.unit === 'string' ? value.unit : '',
    axis: value.axis === 'right' ? 'right' : 'left',
    group: typeof value.group === 'string' ? value.group : '',
    color: typeof value.color === 'string' ? value.color : '',
    precision: Math.max(0, Math.min(6, Math.round(Number(value.precision) || 2))),
    minThreshold: normalizeOptionalNumber(value.minThreshold),
    maxThreshold: normalizeOptionalNumber(value.maxThreshold)
});

const cloneSeries = (series = []) => {
    return Array.isArray(series) ? series.map((item) => ({ ...item })) : [];
};

const normalizeSeriesMap = (seriesMap = {}, retained = DEFAULT_ARCHIVE_POINTS) => {
    return Object.fromEntries(
        Object.entries(seriesMap).map(([key, value]) => [
            key,
            cloneSeries(value)
                .filter((item) => Number.isFinite(Number(item?.timestamp)) && Number.isFinite(Number(item?.value)))
                .slice(-retained)
        ])
    );
};

const sliceSeriesByRange = (series, start, end) => {
    if (!Array.isArray(series) || series.length === 0) {
        return [];
    }

    return series.filter((item) => {
        const timestamp = Number(item.timestamp);
        if (!Number.isFinite(timestamp)) {
            return false;
        }

        if (Number.isFinite(start) && timestamp < start) {
            return false;
        }

        if (Number.isFinite(end) && timestamp > end) {
            return false;
        }

        return true;
    });
};

const findPointAtTimestamp = (series, timestamp) => {
    if (!Array.isArray(series) || series.length === 0 || !Number.isFinite(Number(timestamp))) {
        return null;
    }

    let candidate = null;
    for (const point of series) {
        if (Number(point.timestamp) <= timestamp) {
            candidate = point;
            continue;
        }

        if (!candidate) {
            return point;
        }

        return Math.abs(Number(point.timestamp) - timestamp) < Math.abs(Number(candidate.timestamp) - timestamp)
            ? point
            : candidate;
    }

    return candidate || series[series.length - 1] || null;
};

export const useTrendStore = defineStore('trend', () => {
    const variableStore = useVariableStore();

    const seriesMap = ref({});
    const historySeriesMap = ref({});
    const isPaused = ref(false);
    const retainedPoints = ref(DEFAULT_RETAINED_POINTS);
    const archiveRetainedPoints = ref(DEFAULT_ARCHIVE_POINTS);
    const selectedWindow = ref(DEFAULT_WINDOW);
    const selectedVariables = ref([]);
    const comparisonMode = ref('overlay');
    const followLatest = ref(true);
    const playbackProgress = ref(100);
    const customRangeStart = ref(null);
    const customRangeEnd = ref(null);
    const variableDisplaySettings = ref({});
    const analysisSettings = ref({ ...DEFAULT_ANALYSIS_SETTINGS });
    const playbackState = ref({
        isPlaying: false,
        speed: 1,
        lastAppliedAt: null
    });
    const liveValueSnapshot = ref({});
    const isApplyingPlayback = ref(false);

    const selectedWindowMs = computed(() => WINDOW_PRESET_MS[selectedWindow.value] ?? WINDOW_PRESET_MS[DEFAULT_WINDOW]);

    const timelineExtent = computed(() => {
        const allPoints = Object.values(historySeriesMap.value).flat();
        if (allPoints.length === 0) {
            const now = Date.now();
            return { min: now, max: now };
        }

        const timestamps = allPoints
            .map((item) => Number(item.timestamp))
            .filter((item) => Number.isFinite(item));

        if (timestamps.length === 0) {
            const now = Date.now();
            return { min: now, max: now };
        }

        return {
            min: Math.min(...timestamps),
            max: Math.max(...timestamps)
        };
    });

    const playbackTimestamp = computed(() => {
        const { min, max } = timelineExtent.value;
        if (followLatest.value || max <= min) {
            return max;
        }

        return min + ((max - min) * playbackProgress.value) / 100;
    });

    const activeQueryRange = computed(() => {
        const { min, max } = timelineExtent.value;
        if (selectedWindow.value === 'custom') {
            const start = normalizeTimestamp(customRangeStart.value) ?? Math.max(min, max - DEFAULT_CUSTOM_RANGE_MS);
            const end = normalizeTimestamp(customRangeEnd.value) ?? max;
            return {
                start: Math.min(start, end),
                end: Math.max(start, end)
            };
        }

        const windowMs = selectedWindowMs.value;
        if (!windowMs || windowMs <= 0) {
            return { start: min, end: max };
        }

        const end = playbackTimestamp.value;
        return {
            start: end - windowMs,
            end
        };
    });

    const appendPoint = (variableName, value, timestamp = Date.now()) => {
        const numericValue = toNumericValue(value);
        if (numericValue === null) {
            return null;
        }

        const point = {
            timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now(),
            value: numericValue
        };

        const recentSeries = Array.isArray(seriesMap.value[variableName]) ? seriesMap.value[variableName] : [];
        const historySeries = Array.isArray(historySeriesMap.value[variableName]) ? historySeriesMap.value[variableName] : [];

        seriesMap.value = {
            ...seriesMap.value,
            [variableName]: [...recentSeries, point].slice(-normalizeRetainedPoints(retainedPoints.value))
        };

        historySeriesMap.value = {
            ...historySeriesMap.value,
            [variableName]: [...historySeries, point].slice(-normalizeArchivePoints(archiveRetainedPoints.value))
        };

        return point;
    };

    const getSeries = (variableName) => {
        return Array.isArray(seriesMap.value[variableName]) ? seriesMap.value[variableName] : [];
    };

    const getHistorySeries = (variableName) => {
        return Array.isArray(historySeriesMap.value[variableName]) ? historySeriesMap.value[variableName] : [];
    };

    const getSeriesInWindow = (variableName, windowMs = 0, now = Date.now()) => {
        const series = getHistorySeries(variableName);
        if (!windowMs || windowMs <= 0) {
            return series;
        }

        const threshold = now - windowMs;
        return series.filter((item) => Number(item.timestamp) >= threshold && Number(item.timestamp) <= now);
    };

    const getSeriesInRange = (variableName, start = null, end = null) => {
        return sliceSeriesByRange(getHistorySeries(variableName), start, end);
    };

    const getSeriesForActiveRange = (variableName) => {
        const { start, end } = activeQueryRange.value;
        return getSeriesInRange(variableName, start, end);
    };

    const getValueAtTimestamp = (variableName, timestamp = playbackTimestamp.value) => {
        return findPointAtTimestamp(getHistorySeries(variableName), timestamp);
    };

    const setPaused = (value) => {
        isPaused.value = value === true;
        return isPaused.value;
    };

    const setRetainedPoints = (value) => {
        retainedPoints.value = normalizeRetainedPoints(value);
        seriesMap.value = Object.fromEntries(
            Object.entries(seriesMap.value).map(([key, series]) => [key, cloneSeries(series).slice(-retainedPoints.value)])
        );
        return retainedPoints.value;
    };

    const setArchiveRetainedPoints = (value) => {
        archiveRetainedPoints.value = normalizeArchivePoints(value);
        historySeriesMap.value = Object.fromEntries(
            Object.entries(historySeriesMap.value).map(([key, series]) => [key, cloneSeries(series).slice(-archiveRetainedPoints.value)])
        );
        return archiveRetainedPoints.value;
    };

    const setSelectedWindow = (value) => {
        selectedWindow.value = Object.hasOwn(WINDOW_PRESET_MS, value) ? value : DEFAULT_WINDOW;
        return selectedWindow.value;
    };

    const setSelectedVariables = (value = []) => {
        selectedVariables.value = Array.isArray(value) ? [...new Set(value)] : [];
        return selectedVariables.value;
    };

    const setComparisonMode = (value) => {
        comparisonMode.value = value === 'stacked' ? 'stacked' : 'overlay';
        return comparisonMode.value;
    };

    const setCustomRange = ({ start = null, end = null } = {}) => {
        customRangeStart.value = normalizeTimestamp(start);
        customRangeEnd.value = normalizeTimestamp(end);
        selectedWindow.value = 'custom';
        return {
            start: customRangeStart.value,
            end: customRangeEnd.value
        };
    };

    const setFollowLatest = (value) => {
        followLatest.value = value !== false;
        if (followLatest.value) {
            playbackProgress.value = 100;
            playbackState.value.isPlaying = false;
        } else if (!Object.keys(liveValueSnapshot.value).length) {
            liveValueSnapshot.value = Object.fromEntries(
                variableStore.variables.map((item) => [item.name, item.value])
            );
        }
        return followLatest.value;
    };

    const setPlaybackProgress = (value) => {
        const numeric = Number(value);
        playbackProgress.value = Number.isFinite(numeric)
            ? Math.max(0, Math.min(100, numeric))
            : 100;

        if (playbackProgress.value < 100) {
            followLatest.value = false;
            if (!Object.keys(liveValueSnapshot.value).length) {
                liveValueSnapshot.value = Object.fromEntries(
                    variableStore.variables.map((item) => [item.name, item.value])
                );
            }
        }

        return playbackProgress.value;
    };

    const stepPlayback = (deltaPercent = analysisSettings.value.playbackStepPercent) => {
        setFollowLatest(false);
        return setPlaybackProgress(playbackProgress.value + Number(deltaPercent || 0));
    };

    const setPlaybackPlaying = (value) => {
        playbackState.value = {
            ...playbackState.value,
            isPlaying: value === true
        };
        return playbackState.value.isPlaying;
    };

    const setPlaybackSpeed = (value) => {
        const numeric = Number(value);
        playbackState.value = {
            ...playbackState.value,
            speed: Number.isFinite(numeric) ? Math.max(0.25, Math.min(8, numeric)) : 1
        };
        return playbackState.value.speed;
    };

    const setAnalysisSettings = (updates = {}) => {
        analysisSettings.value = normalizeAnalysisSettings({
            ...analysisSettings.value,
            ...updates
        });
        return analysisSettings.value;
    };

    const getVariableDisplaySetting = (variableName) => {
        return normalizeVariableDisplaySetting(variableDisplaySettings.value[variableName]);
    };

    const setVariableDisplaySetting = (variableName, updates = {}) => {
        variableDisplaySettings.value = {
            ...variableDisplaySettings.value,
            [variableName]: normalizeVariableDisplaySetting({
                ...getVariableDisplaySetting(variableName),
                ...updates
            })
        };
        return variableDisplaySettings.value[variableName];
    };

    const applyPlaybackFrame = (variableNames = []) => {
        if (analysisSettings.value.playbackProjectionEnabled === false) {
            return { appliedCount: 0, skipped: true };
        }

        const names = Array.isArray(variableNames) && variableNames.length > 0
            ? variableNames
            : (selectedVariables.value.length > 0
                ? selectedVariables.value
                : variableStore.variables.map((item) => item.name));

        isApplyingPlayback.value = true;
        let appliedCount = 0;

        try {
            names.forEach((name) => {
                const point = getValueAtTimestamp(name, playbackTimestamp.value);
                if (!point || !variableStore.getVariableByName(name)) {
                    return;
                }

                variableStore.setVariableValueByName(name, point.value);
                appliedCount += 1;
            });
        } finally {
            isApplyingPlayback.value = false;
        }

        playbackState.value = {
            ...playbackState.value,
            lastAppliedAt: Date.now()
        };

        return { appliedCount, skipped: false };
    };

    const restoreLiveSnapshot = () => {
        const names = Object.keys(liveValueSnapshot.value);
        if (names.length === 0) {
            return 0;
        }

        isApplyingPlayback.value = true;
        let restoredCount = 0;

        try {
            names.forEach((name) => {
                if (!variableStore.getVariableByName(name)) {
                    return;
                }

                variableStore.setVariableValueByName(name, liveValueSnapshot.value[name]);
                restoredCount += 1;
            });
        } finally {
            isApplyingPlayback.value = false;
        }

        liveValueSnapshot.value = {};
        return restoredCount;
    };

    const syncPlaybackProjection = (variableNames = []) => {
        if (followLatest.value) {
            return { restoredCount: restoreLiveSnapshot() };
        }

        return applyPlaybackFrame(variableNames);
    };

    const clearSeries = (variableName) => {
        const nextRecentMap = { ...seriesMap.value };
        const nextHistoryMap = { ...historySeriesMap.value };
        delete nextRecentMap[variableName];
        delete nextHistoryMap[variableName];
        seriesMap.value = nextRecentMap;
        historySeriesMap.value = nextHistoryMap;
    };

    const clearAllSeries = () => {
        seriesMap.value = {};
        historySeriesMap.value = {};
        liveValueSnapshot.value = {};
    };

    const buildSeriesStats = (series = [], variableName = '') => {
        const values = series.map((item) => Number(item.value)).filter((item) => Number.isFinite(item));
        const setting = getVariableDisplaySetting(variableName);
        const latest = series[series.length - 1] || null;
        const first = series[0] || null;
        const average = values.length
            ? values.reduce((total, item) => total + item, 0) / values.length
            : null;

        return {
            min: values.length ? Math.min(...values) : null,
            max: values.length ? Math.max(...values) : null,
            average,
            delta: latest && first ? latest.value - first.value : null,
            latestPoint: latest,
            firstPoint: first,
            pointCount: values.length,
            thresholds: {
                min: setting.minThreshold,
                max: setting.maxThreshold
            }
        };
    };

    const exportSeriesToCSV = (variableNames = [], start = null, end = null) => {
        const names = Array.isArray(variableNames) ? variableNames : [];
        const rows = ['variableName,timestamp,localTime,value'];

        names.forEach((name) => {
            getSeriesInRange(name, start, end).forEach((point) => {
                const isoTime = new Date(point.timestamp).toISOString();
                const localTime = new Date(point.timestamp).toLocaleString('zh-CN', { hour12: false });
                rows.push([name, isoTime, localTime, point.value].map((item) => `"${String(item).replaceAll('"', '""')}"`).join(','));
            });
        });

        return rows.join('\n');
    };

    const variableSummaries = computed(() => {
        return variableStore.variables.map((variable) => {
            const recentSeries = getSeries(variable.name);
            const historySeries = getHistorySeries(variable.name);
            const stats = buildSeriesStats(historySeries, variable.name);

            return {
                name: variable.name,
                type: variable.type,
                currentValue: variable.value,
                pointCount: recentSeries.length,
                historyPointCount: historySeries.length,
                latestPoint: stats.latestPoint,
                min: stats.min,
                max: stats.max,
                average: stats.average,
                delta: stats.delta,
                series: recentSeries,
                historySeries,
                display: getVariableDisplaySetting(variable.name)
            };
        });
    });

    const serialize = () => ({
        seriesMap: { ...seriesMap.value },
        historySeriesMap: { ...historySeriesMap.value },
        settings: {
            isPaused: isPaused.value,
            retainedPoints: retainedPoints.value,
            archiveRetainedPoints: archiveRetainedPoints.value,
            selectedWindow: selectedWindow.value,
            selectedVariables: [...selectedVariables.value],
            comparisonMode: comparisonMode.value,
            followLatest: followLatest.value,
            playbackProgress: playbackProgress.value,
            customRangeStart: customRangeStart.value,
            customRangeEnd: customRangeEnd.value,
            playbackState: { ...playbackState.value }
        },
        variableDisplaySettings: { ...variableDisplaySettings.value },
        analysisSettings: { ...analysisSettings.value }
    });

    const deserialize = (payload) => {
        if (!payload || typeof payload !== 'object') {
            seriesMap.value = {};
            historySeriesMap.value = {};
            isPaused.value = false;
            retainedPoints.value = DEFAULT_RETAINED_POINTS;
            archiveRetainedPoints.value = DEFAULT_ARCHIVE_POINTS;
            selectedWindow.value = DEFAULT_WINDOW;
            selectedVariables.value = [];
            comparisonMode.value = 'overlay';
            followLatest.value = true;
            playbackProgress.value = 100;
            customRangeStart.value = null;
            customRangeEnd.value = null;
            variableDisplaySettings.value = {};
            analysisSettings.value = { ...DEFAULT_ANALYSIS_SETTINGS };
            playbackState.value = { isPlaying: false, speed: 1, lastAppliedAt: null };
            liveValueSnapshot.value = {};
            isApplyingPlayback.value = false;
            return;
        }

        retainedPoints.value = normalizeRetainedPoints(payload.settings?.retainedPoints);
        archiveRetainedPoints.value = normalizeArchivePoints(payload.settings?.archiveRetainedPoints);
        seriesMap.value = normalizeSeriesMap(payload.seriesMap, retainedPoints.value);
        historySeriesMap.value = normalizeSeriesMap(payload.historySeriesMap || payload.seriesMap, archiveRetainedPoints.value);
        isPaused.value = payload.settings?.isPaused === true;
        selectedWindow.value = Object.hasOwn(WINDOW_PRESET_MS, payload.settings?.selectedWindow)
            ? payload.settings.selectedWindow
            : DEFAULT_WINDOW;
        selectedVariables.value = Array.isArray(payload.settings?.selectedVariables)
            ? [...new Set(payload.settings.selectedVariables)]
            : [];
        comparisonMode.value = payload.settings?.comparisonMode === 'stacked' ? 'stacked' : 'overlay';
        followLatest.value = payload.settings?.followLatest !== false;
        playbackProgress.value = Number.isFinite(Number(payload.settings?.playbackProgress))
            ? Math.max(0, Math.min(100, Number(payload.settings.playbackProgress)))
            : 100;
        customRangeStart.value = normalizeTimestamp(payload.settings?.customRangeStart);
        customRangeEnd.value = normalizeTimestamp(payload.settings?.customRangeEnd);
        variableDisplaySettings.value = Object.fromEntries(
            Object.entries(payload.variableDisplaySettings || {}).map(([key, value]) => [key, normalizeVariableDisplaySetting(value)])
        );
        analysisSettings.value = normalizeAnalysisSettings(payload.analysisSettings);
        playbackState.value = {
            isPlaying: false,
            speed: Number.isFinite(Number(payload.settings?.playbackState?.speed))
                ? Math.max(0.25, Math.min(8, Number(payload.settings.playbackState.speed)))
                : 1,
            lastAppliedAt: Number.isFinite(Number(payload.settings?.playbackState?.lastAppliedAt))
                ? Number(payload.settings.playbackState.lastAppliedAt)
                : null
        };
        liveValueSnapshot.value = {};
        isApplyingPlayback.value = false;
    };

    watch(
        () => variableStore.variables.map((item) => ({
            name: item.name,
            value: item.value,
            updatedAt: item.updatedAt
        })),
        (variables) => {
            if (isPaused.value || isApplyingPlayback.value) {
                return;
            }

            variables.forEach((item) => {
                appendPoint(item.name, item.value, item.updatedAt || Date.now());
            });
        },
        { deep: true, immediate: true }
    );

    return {
        seriesMap,
        historySeriesMap,
        isPaused,
        retainedPoints,
        archiveRetainedPoints,
        selectedWindow,
        selectedVariables,
        comparisonMode,
        followLatest,
        playbackProgress,
        customRangeStart,
        customRangeEnd,
        variableDisplaySettings,
        analysisSettings,
        playbackState,
        isApplyingPlayback,
        variableSummaries,
        selectedWindowMs,
        timelineExtent,
        playbackTimestamp,
        activeQueryRange,
        appendPoint,
        getSeries,
        getHistorySeries,
        getSeriesInWindow,
        getSeriesInRange,
        getSeriesForActiveRange,
        getValueAtTimestamp,
        buildSeriesStats,
        exportSeriesToCSV,
        setPaused,
        setRetainedPoints,
        setArchiveRetainedPoints,
        setSelectedWindow,
        setSelectedVariables,
        setComparisonMode,
        setCustomRange,
        setFollowLatest,
        setPlaybackProgress,
        stepPlayback,
        setPlaybackPlaying,
        setPlaybackSpeed,
        setAnalysisSettings,
        getVariableDisplaySetting,
        setVariableDisplaySetting,
        applyPlaybackFrame,
        restoreLiveSnapshot,
        syncPlaybackProjection,
        serialize,
        deserialize,
        clearSeries,
        clearAllSeries
    };
});
