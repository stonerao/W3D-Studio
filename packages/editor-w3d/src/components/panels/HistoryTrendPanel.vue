<template>
    <div class="trend-panel">
        <div class="trend-toolbar">
            <div class="action-grid">
                <Button size="sm" variant="outline" @click="handleTogglePause">
                    {{ trendStore.isPaused ? '恢复' : '暂停' }}
                </Button>
                <Button size="sm" variant="outline" @click="handleExportActiveRange">导出区间</Button>
                <Button size="sm" variant="outline" @click="handleExportHistory">导出历史</Button>
                <Button size="sm" variant="outline" @click="handleClearAll">清空</Button>
            </div>
        </div>

        <div class="settings-grid">
            <div class="form-group">
                <label>时间窗口</label>
                <Select v-model="windowValue" :options="windowOptions" @change="handleWindowChange" />
            </div>
            <div class="form-group">
                <label>对比模式</label>
                <Select v-model="comparisonModeValue" :options="comparisonModeOptions" @change="handleComparisonModeChange" />
            </div>
            <div class="form-group">
                <label>前台保留点数</label>
                <Input v-model="retainedPointsValue" type="number" placeholder="120" @blur="handleRetainedPointsChange" />
            </div>
            <div class="form-group">
                <label>历史归档点数</label>
                <Input v-model="archiveRetainedPointsValue" type="number" placeholder="5000" @blur="handleArchiveRetainedPointsChange" />
            </div>
        </div>

        <div class="query-panel">
            <div class="query-panel__header">
                <div class="section-meta">{{ activeRangeLabel }}</div>
                <div class="action-grid">
                    <Button size="sm" variant="ghost" @click="applyQuickRange('1h')">近 1 小时</Button>
                    <Button size="sm" variant="ghost" @click="applyQuickRange('24h')">近 24 小时</Button>
                    <Button size="sm" variant="ghost" @click="applyAllRange">全部</Button>
                </div>
            </div>

            <div class="query-grid">
                <div class="form-group">
                    <label>开始时间</label>
                    <input v-model="customStartValue" class="native-input" type="datetime-local" />
                </div>
                <div class="form-group">
                    <label>结束时间</label>
                    <input v-model="customEndValue" class="native-input" type="datetime-local" />
                </div>
                <div class="form-group query-grid__button">
                    <label>操作</label>
                    <Button variant="outline" @click="applyCustomRange">应用</Button>
                </div>
            </div>
        </div>

        <div class="playback-panel">
            <div class="playback-panel__header">
                <div class="section-meta">{{ trendStore.followLatest ? '实时跟随中' : playbackCurrentLabel }}</div>
                <div class="playback-panel__toggles">
                    <label class="checkbox-label checkbox-label--inline">
                        <input :checked="trendStore.followLatest" type="checkbox" @change="handleFollowLatestChange" />
                        <span>跟随最新</span>
                    </label>
                    <label class="checkbox-label checkbox-label--inline">
                        <input :checked="trendStore.analysisSettings.playbackProjectionEnabled" type="checkbox" @change="handlePlaybackProjectionChange" />
                        <span>投影到变量</span>
                    </label>
                </div>
                <div class="form-group">
                    <label>回放速度</label>
                    <Select v-model="playbackSpeedValue" :options="playbackSpeedOptions" @change="handlePlaybackSpeedChange" />
                </div>
                <div class="action-grid">
                    <Button size="sm" variant="ghost" @click="stepBackward">后退</Button>
                    <Button size="sm" variant="outline" @click="togglePlaybackAnimation">{{ trendStore.playbackState.isPlaying ? '暂停' : '开始' }}</Button>
                    <Button size="sm" variant="ghost" @click="stepForward">前进</Button>
                </div>
            </div>

            <input
                class="playback-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                :value="String(playbackProgressValue)"
                :disabled="trendStore.followLatest"
                @input="handlePlaybackInput"
            />
            <div class="playback-meta">
                <span>{{ playbackStartLabel }}</span>
                <span>{{ playbackCurrentLabel }}</span>
                <span>{{ playbackEndLabel }}</span>
            </div>
        </div>

        <div v-if="numericVariables.length === 0" class="empty-state">
            <div class="empty-text">暂无可绘制趋势的数值变量</div>
            <div class="empty-hint">仅支持数值型变量</div>
        </div>

        <template v-else>
            <div class="selector-list">
                <button
                    v-for="item in numericVariables"
                    :key="item.name"
                    class="selector-chip"
                    :class="{ 'selector-chip--active': selectedVariables.includes(item.name) }"
                    @click="toggleVariable(item.name)"
                >
                    <span>{{ item.name }}</span>
                    <span class="selector-chip__meta">{{ item.historyPointCount }}</span>
                </button>
            </div>

            <div v-if="selectedSummaries.length === 0" class="empty-state empty-state--compact">
                <div class="empty-text">请选择至少一个变量</div>
            </div>

            <template v-else>
                <div class="analysis-config">
                    <div class="analysis-config__header">
                        <div class="analysis-config__toggles">
                            <label class="checkbox-label checkbox-label--inline">
                                <input :checked="trendStore.analysisSettings.showAverageLine" type="checkbox" @change="toggleAnalysisFlag('showAverageLine', $event.target.checked)" />
                                <span>均线</span>
                            </label>
                            <label class="checkbox-label checkbox-label--inline">
                                <input :checked="trendStore.analysisSettings.showMinMaxMarkers" type="checkbox" @change="toggleAnalysisFlag('showMinMaxMarkers', $event.target.checked)" />
                                <span>极值</span>
                            </label>
                            <label class="checkbox-label checkbox-label--inline">
                                <input :checked="trendStore.analysisSettings.showThresholdLines" type="checkbox" @change="toggleAnalysisFlag('showThresholdLines', $event.target.checked)" />
                                <span>阈值</span>
                            </label>
                        </div>
                    </div>

                    <div class="analysis-list">
                        <div v-for="summary in selectedSummaries" :key="`${summary.name}-config`" class="analysis-item">
                            <div class="analysis-item__title">{{ summary.name }}</div>
                            <div class="form-group">
                                <label>单位</label>
                                <input :value="summary.display.unit" class="native-input native-input--sm" type="text" placeholder="如 ℃" @change="updateDisplaySetting(summary.name, 'unit', $event.target.value)" />
                            </div>
                            <div class="form-group">
                                <label>坐标轴</label>
                                <select :value="summary.display.axis" class="native-input native-input--sm" @change="updateDisplaySetting(summary.name, 'axis', $event.target.value)">
                                    <option value="left">左轴</option>
                                    <option value="right">右轴</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>精度</label>
                                <input :value="String(summary.display.precision ?? 2)" class="native-input native-input--sm" type="number" min="0" max="6" @change="updateDisplaySetting(summary.name, 'precision', Number($event.target.value || 2))" />
                            </div>
                            <div class="form-group">
                                <label>下阈值</label>
                                <input :value="summary.display.minThreshold ?? ''" class="native-input native-input--sm" type="number" placeholder="空" @change="updateDisplaySetting(summary.name, 'minThreshold', $event.target.value)" />
                            </div>
                            <div class="form-group">
                                <label>上阈值</label>
                                <input :value="summary.display.maxThreshold ?? ''" class="native-input native-input--sm" type="number" placeholder="空" @change="updateDisplaySetting(summary.name, 'maxThreshold', $event.target.value)" />
                            </div>
                        </div>
                    </div>
                </div>

                <div class="trend-card trend-card--overview">
                    <div class="trend-card__header">
                        <div class="trend-card__title">总览</div>
                        <div class="trend-card__meta">{{ overviewMetaText }}</div>
                        <div class="axis-badges">
                            <span v-if="overviewAxisMeta.leftLabel" class="axis-badge">左轴 {{ overviewAxisMeta.leftLabel }}</span>
                            <span v-if="overviewAxisMeta.rightLabel" class="axis-badge">右轴 {{ overviewAxisMeta.rightLabel }}</span>
                        </div>
                    </div>

                    <div class="trend-chart trend-chart--overview">
                        <svg v-if="overviewChart.lines.length > 0" viewBox="0 0 320 180" preserveAspectRatio="none" class="trend-chart__svg">
                            <g v-for="interval in overviewChart.alarmIntervals" :key="interval.key">
                                <rect
                                    class="trend-chart__alarm-band"
                                    :class="`trend-chart__alarm-band--${interval.variant}`"
                                    :x="interval.x"
                                    :y="0"
                                    :width="interval.width"
                                    :height="180"
                                >
                                    <title>{{ interval.title }}</title>
                                </rect>
                            </g>
                            <g v-for="line in overviewChart.referenceLines" :key="line.key">
                                <line class="trend-chart__reference" :x1="0" :x2="320" :y1="line.y" :y2="line.y"></line>
                            </g>
                            <g v-for="line in overviewChart.lines" :key="line.name">
                                <polyline class="trend-chart__line" :style="{ stroke: line.color }" :points="line.points" />
                                <polyline v-if="line.averagePoints" class="trend-chart__line trend-chart__line--average" :style="{ stroke: line.color }" :points="line.averagePoints" />
                            </g>
                        </svg>
                        <div v-else class="trend-chart__empty">样本不足，等待更多数据</div>
                    </div>

                    <div class="legend-list">
                        <div v-for="line in overviewChart.lines" :key="`${line.name}-legend`" class="legend-item">
                            <span class="legend-item__swatch" :style="{ background: line.color }"></span>
                            <span>{{ line.name }}</span>
                            <span class="legend-item__meta">{{ line.axis === 'right' ? '右轴' : '左轴' }} {{ line.unit || '' }}</span>
                        </div>
                    </div>
                </div>

                <div class="snapshot-panel">
                    <div class="snapshot-list">
                        <div v-for="item in playbackSnapshot" :key="`${item.name}-snapshot`" class="snapshot-item">
                            <span>{{ item.name }}</span>
                            <strong>{{ item.value }}</strong>
                            <span>{{ item.unit }}</span>
                        </div>
                    </div>
                </div>

                <div class="trend-list">
                    <div v-for="summary in selectedSummaries" :key="summary.name" class="trend-card">
                        <div class="trend-card__header">
                            <div>
                                <div class="trend-card__title">{{ summary.name }}</div>
                                <div class="trend-card__meta">{{ formatPointMeta(summary) }}</div>
                            </div>
                            <div class="trend-card__actions">
                                <span class="axis-badge">{{ summary.display.axis === 'right' ? '右轴' : '左轴' }} {{ summary.display.unit || '' }}</span>
                                <Button size="sm" variant="ghost" @click="handleClearSeries(summary.name)">清空</Button>
                            </div>
                        </div>

                        <div class="trend-stats trend-stats--five">
                            <div class="trend-stat">
                                <span class="trend-stat__label">当前值</span>
                                <span class="trend-stat__value">{{ formatNumber(summary.currentValue, summary.display.precision) }}</span>
                            </div>
                            <div class="trend-stat">
                                <span class="trend-stat__label">最小值</span>
                                <span class="trend-stat__value">{{ formatNumber(summary.stats.min, summary.display.precision) }}</span>
                            </div>
                            <div class="trend-stat">
                                <span class="trend-stat__label">最大值</span>
                                <span class="trend-stat__value">{{ formatNumber(summary.stats.max, summary.display.precision) }}</span>
                            </div>
                            <div class="trend-stat">
                                <span class="trend-stat__label">平均值</span>
                                <span class="trend-stat__value">{{ formatNumber(summary.stats.average, summary.display.precision) }}</span>
                            </div>
                            <div class="trend-stat">
                                <span class="trend-stat__label">区间变化</span>
                                <span class="trend-stat__value">{{ formatNumber(summary.stats.delta, summary.display.precision) }}</span>
                            </div>
                        </div>

                        <div class="trend-chart">
                            <svg v-if="summary.series.length > 1" viewBox="0 0 320 140" preserveAspectRatio="none" class="trend-chart__svg">
                                <g v-for="interval in buildAlarmIntervals(summary, 320, 140)" :key="interval.key">
                                    <rect
                                        class="trend-chart__alarm-band"
                                        :class="`trend-chart__alarm-band--${interval.variant}`"
                                        :x="interval.x"
                                        :y="0"
                                        :width="interval.width"
                                        :height="140"
                                    >
                                        <title>{{ interval.title }}</title>
                                    </rect>
                                </g>
                                <g v-for="line in buildReferenceLines(summary, 320, 140)" :key="line.key">
                                    <line class="trend-chart__reference" :x1="0" :x2="320" :y1="line.y" :y2="line.y"></line>
                                </g>
                                <polyline class="trend-chart__line" :style="{ stroke: getSeriesColor(summary.name) }" :points="buildPoints(summary.series, 320, 140, summary.scale.min, summary.scale.max)" />
                                <polyline v-if="summary.averagePoints" class="trend-chart__line trend-chart__line--average" :style="{ stroke: getSeriesColor(summary.name) }" :points="summary.averagePoints" />
                                <g v-for="marker in buildExtremaMarkers(summary, 320, 140)" :key="marker.key">
                                    <circle class="trend-chart__extrema-dot" :cx="marker.x" :cy="marker.y" r="4"></circle>
                                    <title>{{ marker.title }}</title>
                                </g>
                                <g v-for="marker in buildAlarmMarkers(summary, 320, 140)" :key="marker.key">
                                    <line class="trend-chart__marker-line" :x1="marker.x" :x2="marker.x" y1="0" y2="140"></line>
                                    <circle class="trend-chart__marker-dot" :class="`trend-chart__marker-dot--${marker.variant}`" :cx="marker.x" :cy="marker.y" r="4">
                                        <title>{{ marker.title }}</title>
                                    </circle>
                                </g>
                            </svg>
                            <div v-else class="trend-chart__empty">样本不足，等待更多数据</div>
                        </div>

                        <div class="trend-meta-row">
                            <span>样本 {{ summary.stats.pointCount }}</span>
                            <span>查询范围 {{ formatDateTime(activeRange.start) }} - {{ formatDateTime(activeRange.end) }}</span>
                        </div>

                        <div v-if="buildAlarmMarkers(summary, 320, 140).length > 0" class="trend-marker-list">
                            <div v-for="marker in buildAlarmMarkers(summary, 320, 140)" :key="`${marker.key}-text`" class="trend-marker-item">
                                <span :class="['trend-marker-item__dot', `trend-marker-item__dot--${marker.variant}`]"></span>
                                <span>{{ marker.text }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useTrendStore } from '../../stores/useTrendStore';
import { useAlarmStore } from '../../stores/useAlarmStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useToast } from '../../composables/useToast';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';

const trendStore = useTrendStore();
const alarmStore = useAlarmStore();
const projectStore = useProjectStore();
const toast = useToast();

const selectedVariables = ref(Array.isArray(trendStore.selectedVariables) ? [...trendStore.selectedVariables] : []);
const windowValue = ref(trendStore.selectedWindow || '15m');
const comparisonModeValue = ref(trendStore.comparisonMode || 'overlay');
const retainedPointsValue = ref(String(trendStore.retainedPoints || 120));
const archiveRetainedPointsValue = ref(String(trendStore.archiveRetainedPoints || 5000));
const customStartValue = ref(toDateTimeLocal(trendStore.customRangeStart));
const customEndValue = ref(toDateTimeLocal(trendStore.customRangeEnd));
const playbackSpeedValue = ref(String(trendStore.playbackState.speed || 1));

const colorPalette = ['#60a5fa', '#34d399', '#f59e0b', '#f97316', '#a78bfa', '#f472b6', '#22d3ee', '#fb7185'];
const playbackSpeedOptions = [
    { label: '0.5x', value: '0.5' },
    { label: '1x', value: '1' },
    { label: '2x', value: '2' },
    { label: '4x', value: '4' }
];
const windowOptions = [
    { label: '5 分钟', value: '5m' },
    { label: '15 分钟', value: '15m' },
    { label: '1 小时', value: '1h' },
    { label: '6 小时', value: '6h' },
    { label: '24 小时', value: '24h' },
    { label: '全部', value: 'all' },
    { label: '自定义', value: 'custom' }
];
const comparisonModeOptions = [
    { label: '叠加对比', value: 'overlay' },
    { label: '分层对比', value: 'stacked' }
];

let playbackTimer = null;

const numericVariables = computed(() => {
    return trendStore.variableSummaries.filter((item) => item.historyPointCount > 0 || typeof item.currentValue === 'number' || !Number.isNaN(Number(item.currentValue)));
});

watch(
    numericVariables,
    (variables) => {
        const availableNames = new Set(variables.map((item) => item.name));
        const nextSelected = selectedVariables.value.filter((name) => availableNames.has(name));
        if (nextSelected.length === 0 && variables.length > 0) {
            selectedVariables.value = [variables[0].name];
        } else {
            selectedVariables.value = nextSelected;
        }
    },
    { immediate: true }
);

watch(
    selectedVariables,
    (value) => {
        trendStore.setSelectedVariables(value);
        projectStore.markAsUnsaved();
    },
    { deep: true }
);

watch(
    () => [trendStore.playbackTimestamp, trendStore.followLatest, trendStore.analysisSettings.playbackProjectionEnabled, selectedVariables.value.join('|')],
    () => {
        if (selectedVariables.value.length === 0) {
            return;
        }
        trendStore.syncPlaybackProjection(selectedVariables.value);
    }
);

watch(
    () => trendStore.playbackState.isPlaying,
    (isPlaying) => {
        if (isPlaying) {
            startPlaybackTimer();
            return;
        }
        stopPlaybackTimer();
    }
);

const playbackProgressValue = computed(() => Math.round(Number(trendStore.playbackProgress || 100)));
const activeRange = computed(() => trendStore.activeQueryRange);
const activeRangeLabel = computed(() => `${formatDateTime(activeRange.value.start)} - ${formatDateTime(activeRange.value.end)}`);
const playbackStartLabel = computed(() => formatDateTime(trendStore.timelineExtent.min));
const playbackCurrentLabel = computed(() => formatDateTime(trendStore.playbackTimestamp));
const playbackEndLabel = computed(() => formatDateTime(trendStore.timelineExtent.max));

const selectedSummaries = computed(() => {
    return numericVariables.value
        .filter((item) => selectedVariables.value.includes(item.name))
        .map((item) => {
            const series = trendStore.getSeriesForActiveRange(item.name);
            const scale = buildScale(series, item.display);
            const stats = trendStore.buildSeriesStats(series, item.name);
            return {
                ...item,
                series,
                stats,
                scale,
                averagePoints: trendStore.analysisSettings.showAverageLine
                    ? buildMovingAveragePoints(series, 320, 140, scale.min, scale.max, trendStore.analysisSettings.movingAverageWindow)
                    : ''
            };
        });
});

const playbackSnapshot = computed(() => {
    return selectedSummaries.value.map((summary) => {
        const point = trendStore.getValueAtTimestamp(summary.name, trendStore.playbackTimestamp);
        return {
            name: summary.name,
            unit: summary.display.unit || '',
            value: point ? formatNumber(point.value, summary.display.precision) : '--'
        };
    });
});

const overviewAxisMeta = computed(() => {
    const leftUnits = new Set();
    const rightUnits = new Set();
    selectedSummaries.value.forEach((item) => {
        if (item.display.axis === 'right') {
            rightUnits.add(item.display.unit || '无单位');
            return;
        }
        leftUnits.add(item.display.unit || '无单位');
    });

    return {
        leftLabel: leftUnits.size > 0 ? Array.from(leftUnits).join(' / ') : '',
        rightLabel: rightUnits.size > 0 ? Array.from(rightUnits).join(' / ') : ''
    };
});

const overviewMetaText = computed(() => {
    return `${selectedSummaries.value.length} 条曲线 · 历史归档 ${trendStore.archiveRetainedPoints} 点 · ${trendStore.followLatest ? '实时模式' : '回放模式'}`;
});

const overviewChart = computed(() => {
    const width = 320;
    const height = 180;
    const seriesList = selectedSummaries.value.filter((item) => item.series.length > 1);
    if (seriesList.length === 0) {
        return { lines: [], alarmIntervals: [], referenceLines: [] };
    }

    const leftSeries = seriesList.filter((item) => item.display.axis !== 'right');
    const rightSeries = seriesList.filter((item) => item.display.axis === 'right');
    const leftScale = buildCombinedScale(leftSeries);
    const rightScale = buildCombinedScale(rightSeries);

    const lines = seriesList.map((item, index) => {
        const scale = item.display.axis === 'right' ? rightScale : leftScale;
        let points = buildPoints(item.series, width, height, scale.min, scale.max);
        let averagePoints = trendStore.analysisSettings.showAverageLine
            ? buildMovingAveragePoints(item.series, width, height, scale.min, scale.max, trendStore.analysisSettings.movingAverageWindow)
            : '';

        if (trendStore.comparisonMode === 'stacked') {
            const offset = index * 16;
            points = offsetPoints(points, offset);
            averagePoints = offsetPoints(averagePoints, offset);
        }

        return {
            name: item.name,
            axis: item.display.axis,
            unit: item.display.unit,
            color: getSeriesColor(item.name),
            points,
            averagePoints
        };
    });

    const referenceLines = [];
    if (trendStore.analysisSettings.showThresholdLines) {
        seriesList.forEach((item) => {
            buildReferenceLines(item, width, height).forEach((line) => referenceLines.push(line));
        });
    }

    return {
        lines,
        alarmIntervals: seriesList.flatMap((item) => buildAlarmIntervals(item, width, height)),
        referenceLines
    };
});

const formatPointMeta = (summary) => {
    if (!summary.stats.latestPoint) {
        return '暂无趋势样本';
    }

    return `最近更新 ${formatTime(summary.stats.latestPoint.timestamp)} · ${summary.stats.pointCount} 点`;
};

const toggleVariable = (name) => {
    if (selectedVariables.value.includes(name)) {
        selectedVariables.value = selectedVariables.value.filter((item) => item !== name);
        return;
    }
    selectedVariables.value = [...selectedVariables.value, name];
};

const handleTogglePause = () => {
    const nextPaused = trendStore.setPaused(!trendStore.isPaused);
    projectStore.markAsUnsaved();
    toast.success(nextPaused ? '趋势采样已暂停' : '趋势采样已恢复');
};

const handleExportActiveRange = () => {
    exportCsv(activeRange.value.start, activeRange.value.end, 'trend-range');
};

const handleExportHistory = () => {
    exportCsv(null, null, 'trend-history');
};

const handleClearSeries = (name) => {
    trendStore.clearSeries(name);
    projectStore.markAsUnsaved();
};

const handleClearAll = () => {
    trendStore.clearAllSeries();
    projectStore.markAsUnsaved();
};

const handleWindowChange = (value) => {
    trendStore.setSelectedWindow(value);
    if (value !== 'custom') {
        customStartValue.value = '';
        customEndValue.value = '';
    }
    projectStore.markAsUnsaved();
};

const handleComparisonModeChange = (value) => {
    trendStore.setComparisonMode(value);
    projectStore.markAsUnsaved();
};

const handleRetainedPointsChange = () => {
    const nextValue = trendStore.setRetainedPoints(retainedPointsValue.value);
    retainedPointsValue.value = String(nextValue);
    projectStore.markAsUnsaved();
};

const handleArchiveRetainedPointsChange = () => {
    const nextValue = trendStore.setArchiveRetainedPoints(archiveRetainedPointsValue.value);
    archiveRetainedPointsValue.value = String(nextValue);
    projectStore.markAsUnsaved();
};

const handleFollowLatestChange = (event) => {
    trendStore.setFollowLatest(event.target.checked);
    if (event.target.checked) {
        trendStore.setPlaybackPlaying(false);
    }
    projectStore.markAsUnsaved();
};

const handlePlaybackProjectionChange = (event) => {
    trendStore.setAnalysisSettings({ playbackProjectionEnabled: event.target.checked });
    trendStore.syncPlaybackProjection(selectedVariables.value);
    projectStore.markAsUnsaved();
};

const handlePlaybackInput = (event) => {
    trendStore.setPlaybackProgress(event.target.value);
    projectStore.markAsUnsaved();
};

const handlePlaybackSpeedChange = (value) => {
    playbackSpeedValue.value = value;
    trendStore.setPlaybackSpeed(value);
    projectStore.markAsUnsaved();
};

const togglePlaybackAnimation = () => {
    if (trendStore.followLatest) {
        trendStore.setFollowLatest(false);
    }
    trendStore.setPlaybackPlaying(!trendStore.playbackState.isPlaying);
};

const stepBackward = () => {
    trendStore.setPlaybackPlaying(false);
    trendStore.stepPlayback(-trendStore.analysisSettings.playbackStepPercent);
    projectStore.markAsUnsaved();
};

const stepForward = () => {
    trendStore.setPlaybackPlaying(false);
    trendStore.stepPlayback(trendStore.analysisSettings.playbackStepPercent);
    projectStore.markAsUnsaved();
};

const toggleAnalysisFlag = (key, value) => {
    trendStore.setAnalysisSettings({ [key]: value });
    projectStore.markAsUnsaved();
};

const updateDisplaySetting = (variableName, key, value) => {
    trendStore.setVariableDisplaySetting(variableName, { [key]: value });
    projectStore.markAsUnsaved();
};

const applyCustomRange = () => {
    if (!customStartValue.value || !customEndValue.value) {
        toast.warning('请填写完整的开始和结束时间');
        return;
    }

    trendStore.setCustomRange({
        start: new Date(customStartValue.value).getTime(),
        end: new Date(customEndValue.value).getTime()
    });
    windowValue.value = 'custom';
    projectStore.markAsUnsaved();
};

const applyQuickRange = (preset) => {
    const end = trendStore.timelineExtent.max;
    const duration = preset === '24h' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const start = end - duration;
    customStartValue.value = toDateTimeLocal(start);
    customEndValue.value = toDateTimeLocal(end);
    trendStore.setCustomRange({ start, end });
    windowValue.value = 'custom';
    projectStore.markAsUnsaved();
};

const applyAllRange = () => {
    trendStore.setSelectedWindow('all');
    windowValue.value = 'all';
    projectStore.markAsUnsaved();
};

const exportCsv = (start, end, prefix) => {
    if (selectedVariables.value.length === 0) {
        toast.warning('请先选择要导出的变量');
        return;
    }

    const csv = trendStore.exportSeriesToCSV(selectedVariables.value, start, end);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('趋势数据已导出');
};

const getSeriesColor = (name) => {
    const index = selectedVariables.value.indexOf(name);
    return colorPalette[index >= 0 ? index % colorPalette.length : 0];
};

const buildScale = (series, display) => {
    const values = Array.isArray(series) ? series.map((item) => Number(item.value)).filter((item) => Number.isFinite(item)) : [];
    const thresholdValues = [display.minThreshold, display.maxThreshold].filter((item) => Number.isFinite(item));
    const allValues = [...values, ...thresholdValues];
    if (allValues.length === 0) {
        return { min: 0, max: 1 };
    }
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    return { min, max: max === min ? min + 1 : max };
};

const buildCombinedScale = (summaries) => {
    const values = summaries.flatMap((item) => {
        return item.series.map((point) => point.value).concat(
            Number.isFinite(item.display.minThreshold) ? [item.display.minThreshold] : [],
            Number.isFinite(item.display.maxThreshold) ? [item.display.maxThreshold] : []
        );
    }).filter((item) => Number.isFinite(Number(item)));

    if (values.length === 0) {
        return { min: 0, max: 1 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max: max === min ? min + 1 : max };
};

const buildPoints = (series, width = 320, height = 140, minOverride = null, maxOverride = null) => {
    if (!Array.isArray(series) || series.length < 2) {
        return '';
    }

    const values = series.map((item) => item.value);
    const min = minOverride ?? Math.min(...values);
    const max = maxOverride ?? Math.max(...values);
    const range = max - min || 1;

    return series.map((item, index) => {
        const x = (index / Math.max(1, series.length - 1)) * width;
        const y = height - ((item.value - min) / range) * (height - 12) - 6;
        return `${x},${y}`;
    }).join(' ');
};

const offsetPoints = (points, offset) => {
    if (!points) {
        return '';
    }

    return points
        .split(' ')
        .filter(Boolean)
        .map((point) => {
            const [x, y] = point.split(',').map(Number);
            return `${x},${Math.max(6, y - offset)}`;
        })
        .join(' ');
};

const buildMovingAveragePoints = (series, width, height, min, max, windowSize) => {
    if (!Array.isArray(series) || series.length < 2) {
        return '';
    }

    const window = Math.max(2, Number(windowSize) || 5);
    const averaged = series.map((item, index) => {
        const start = Math.max(0, index - window + 1);
        const bucket = series.slice(start, index + 1);
        const average = bucket.reduce((total, point) => total + Number(point.value), 0) / bucket.length;
        return {
            ...item,
            value: average
        };
    });

    return buildPoints(averaged, width, height, min, max);
};

const buildReferenceLines = (summary, width = 320, height = 140) => {
    const lines = [];
    const range = summary.scale.max - summary.scale.min || 1;

    if (trendStore.analysisSettings.showAverageLine && Number.isFinite(summary.stats.average)) {
        const y = height - ((summary.stats.average - summary.scale.min) / range) * (height - 12) - 6;
        lines.push({ key: `${summary.name}-avg`, y, label: 'avg' });
    }

    if (trendStore.analysisSettings.showThresholdLines && Number.isFinite(summary.display.minThreshold)) {
        const y = height - ((summary.display.minThreshold - summary.scale.min) / range) * (height - 12) - 6;
        lines.push({ key: `${summary.name}-min-threshold`, y, label: 'min' });
    }

    if (trendStore.analysisSettings.showThresholdLines && Number.isFinite(summary.display.maxThreshold)) {
        const y = height - ((summary.display.maxThreshold - summary.scale.min) / range) * (height - 12) - 6;
        lines.push({ key: `${summary.name}-max-threshold`, y, label: 'max' });
    }

    return lines;
};

const buildExtremaMarkers = (summary, width = 320, height = 140) => {
    if (!trendStore.analysisSettings.showMinMaxMarkers || summary.series.length < 2) {
        return [];
    }

    const range = summary.scale.max - summary.scale.min || 1;
    const minValue = summary.stats.min;
    const maxValue = summary.stats.max;
    const markers = [];
    const minIndex = summary.series.findIndex((item) => item.value === minValue);
    const maxIndex = summary.series.findIndex((item) => item.value === maxValue);

    [
        { key: 'min', index: minIndex, value: minValue },
        { key: 'max', index: maxIndex, value: maxValue }
    ].forEach((item) => {
        if (item.index < 0) {
            return;
        }

        const x = (item.index / Math.max(1, summary.series.length - 1)) * width;
        const y = height - ((item.value - summary.scale.min) / range) * (height - 12) - 6;
        markers.push({
            key: `${summary.name}-${item.key}`,
            x,
            y,
            title: `${summary.name} ${item.key === 'min' ? '最小' : '最大'}值 ${formatNumber(item.value, summary.display.precision)}`
        });
    });

    return markers;
};

const getAlarmEventsForSummary = (summary) => {
    if (!summary.series.length) return [];

    const startTime = summary.series[0]?.timestamp || 0;
    const endTime = summary.series[summary.series.length - 1]?.timestamp || 0;

    return alarmStore.alarmHistory
        .filter((item) => item.variableName === summary.name)
        .filter((item) => ['triggered', 'cleared', 'recovered', 'cleared-manual'].includes(item.status))
        .filter((item) => {
            const timestamp = item.resolvedAt || item.lastTriggeredAt || item.triggeredAt;
            return timestamp >= startTime && timestamp <= endTime;
        })
        .slice(0, 20);
};

const buildAlarmMarkers = (summary, width = 320, height = 140) => {
    if (!summary.series.length) return [];

    const range = summary.scale.max - summary.scale.min || 1;
    const startTime = summary.series[0]?.timestamp || 0;
    const endTime = summary.series[summary.series.length - 1]?.timestamp || 0;
    const duration = Math.max(1, endTime - startTime);

    return getAlarmEventsForSummary(summary).map((event, index) => {
        const timestamp = event.resolvedAt || event.lastTriggeredAt || event.triggeredAt;
        const nearestPoint = summary.series.reduce((closest, current) => {
            if (!closest) return current;
            return Math.abs(current.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp) ? current : closest;
        }, null);
        const x = ((timestamp - startTime) / duration) * width;
        const yValue = nearestPoint?.value ?? summary.stats.max ?? 0;
        const y = height - ((yValue - summary.scale.min) / range) * (height - 12) - 6;
        const variant = event.status === 'triggered' ? event.severity : 'resolved';
        const timeLabel = formatTime(timestamp);

        return {
            key: `${event.id}-${index}`,
            x,
            y,
            variant,
            title: `${event.ruleName} ${event.status} ${timeLabel}`,
            text: `${timeLabel} ${event.ruleName} ${event.status === 'triggered' ? '触发' : '恢复'}`
        };
    });
};

const buildAlarmIntervals = (summary, width = 320, height = 140) => {
    void height;
    if (!summary.series.length) return [];

    const startTime = summary.series[0]?.timestamp || 0;
    const endTime = summary.series[summary.series.length - 1]?.timestamp || 0;
    const duration = Math.max(1, endTime - startTime);
    const history = alarmStore.alarmHistory.filter((item) => item.variableName === summary.name);
    const resolvedStatuses = new Set(['cleared', 'recovered', 'cleared-manual']);

    const intervals = history
        .filter((item) => resolvedStatuses.has(item.status))
        .map((item, index) => {
            const start = item.triggeredAt || item.lastTriggeredAt || item.resolvedAt;
            const end = item.resolvedAt || item.lastTriggeredAt || start;
            return {
                key: `${item.id}-${index}`,
                variant: item.severity || 'warning',
                title: `${item.ruleName} ${formatTime(start)} - ${formatTime(end)}`,
                start,
                end
            };
        });

    alarmStore.activeAlarms
        .filter((item) => item.variableName === summary.name)
        .forEach((item, index) => {
            intervals.push({
                key: `${item.id}-active-${index}`,
                variant: item.severity || 'warning',
                title: `${item.ruleName} ${formatTime(item.triggeredAt)} - 进行中`,
                start: item.triggeredAt || item.lastTriggeredAt,
                end: endTime
            });
        });

    return intervals
        .filter((item) => item.end >= startTime && item.start <= endTime)
        .map((item) => {
            const clampedStart = Math.max(startTime, item.start);
            const clampedEnd = Math.min(endTime, item.end);
            return {
                ...item,
                x: ((clampedStart - startTime) / duration) * width,
                width: Math.max(2, ((clampedEnd - clampedStart) / duration) * width)
            };
        });
};

const formatNumber = (value, precision = 2) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '-';
    }

    return numeric.toFixed(Math.max(0, Math.min(6, Number(precision) || 2)));
};

const formatTime = (value) => {
    if (!value) return '--:--:--';
    return new Date(value).toLocaleTimeString('zh-CN', { hour12: false });
};

const formatDateTime = (value) => {
    if (!value) return '--';
    return new Date(value).toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

function toDateTimeLocal(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    const pad = (item) => String(item).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const startPlaybackTimer = () => {
    stopPlaybackTimer();
    playbackTimer = window.setInterval(() => {
        const delta = trendStore.analysisSettings.playbackStepPercent * (trendStore.playbackState.speed || 1);
        const next = trendStore.stepPlayback(delta);
        if (next >= 100) {
            trendStore.setPlaybackPlaying(false);
            trendStore.setFollowLatest(true);
        }
    }, 600);
};

const stopPlaybackTimer = () => {
    if (playbackTimer) {
        window.clearInterval(playbackTimer);
        playbackTimer = null;
    }
};

onUnmounted(() => {
    stopPlaybackTimer();
});
</script>

<style scoped>
.trend-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    padding: 12px;
    overflow-y: auto;
}

.trend-toolbar,
.trend-card__header,
.playback-meta,
.trend-meta-row,
.snapshot-item,
.trend-card__actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
}

.playback-panel__header,
.query-panel__header,
.analysis-config__header,
.legend-list,
.selector-list,
.trend-marker-list,
.analysis-config__toggles {
    display: flex;
    gap: 8px;
    flex-direction: column;
}

.action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
}

.section-meta,
.trend-card__meta,
.empty-hint,
.playback-meta,
.legend-item,
.trend-marker-item,
.axis-badge,
.legend-item__meta,
.trend-meta-row {
    font-size: 12px;
    color: var(--color-text-secondary);
}

.settings-grid,
.query-grid,
.trend-stats {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
}

.trend-stats--five {
    grid-template-columns: 1fr;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.query-grid__button {
    justify-content: stretch;
}

.query-panel,
.playback-panel,
.trend-card,
.empty-state,
.analysis-config,
.snapshot-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-secondary);
}

.section-title,
.trend-card__title,
.analysis-item__title,
.empty-text {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary);
}

.selector-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
}

.selector-chip--active {
    border-color: rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.12);
    color: var(--color-text-primary);
}

.selector-chip__meta {
    font-size: 11px;
    color: var(--color-text-muted);
}

.checkbox-label--inline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
}

.playback-slider {
    width: 100%;
}

.native-input {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}

.native-input--sm {
    height: 28px;
}

.analysis-table {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
}

.analysis-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.analysis-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-tertiary);
}

.analysis-table__header,
.analysis-table__row {
    display: grid;
    grid-template-columns: 1.3fr 1fr 0.8fr 0.8fr 0.9fr 0.9fr;
    gap: 8px;
    padding: 10px 12px;
    align-items: center;
}

.analysis-table__header {
    background: var(--color-bg-tertiary);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.analysis-table__row + .analysis-table__row {
    border-top: 1px solid var(--color-border);
}

.analysis-table__name,
.snapshot-item strong,
.trend-stat__value {
    color: var(--color-text-primary);
    font-weight: 700;
}

.axis-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.1);
}

.trend-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.trend-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border-radius: 10px;
    background: var(--color-bg-tertiary);
}

.trend-stat__label {
    font-size: 11px;
    color: var(--color-text-secondary);
}

.trend-stat__value {
    font-size: 16px;
}

.trend-chart {
    height: 140px;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(59, 130, 246, 0.10), rgba(59, 130, 246, 0.02)), var(--color-bg-tertiary);
    overflow: hidden;
}

.trend-chart--overview {
    height: 180px;
}

.trend-chart__svg {
    width: 100%;
    height: 100%;
}

.trend-chart__line {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.trend-chart__line--average {
    stroke-dasharray: 6 4;
    opacity: 0.75;
}

.trend-chart__reference {
    stroke: rgba(148, 163, 184, 0.35);
    stroke-width: 1;
    stroke-dasharray: 4 4;
}

.trend-chart__marker-line {
    stroke: rgba(148, 163, 184, 0.35);
    stroke-width: 1;
    stroke-dasharray: 4 4;
}

.trend-chart__extrema-dot {
    fill: #ffffff;
    stroke: #0f172a;
    stroke-width: 1.5;
}

.trend-chart__alarm-band {
    opacity: 0.12;
}

.trend-chart__alarm-band--critical {
    fill: #ef4444;
}

.trend-chart__alarm-band--major {
    fill: #f97316;
}

.trend-chart__alarm-band--warning {
    fill: #f59e0b;
}

.trend-chart__alarm-band--info {
    fill: #3b82f6;
}

.trend-chart__marker-dot--critical,
.trend-marker-item__dot--critical {
    fill: #ef4444;
    background: #ef4444;
}

.trend-chart__marker-dot--major,
.trend-marker-item__dot--major {
    fill: #f97316;
    background: #f97316;
}

.trend-chart__marker-dot--warning,
.trend-marker-item__dot--warning {
    fill: #f59e0b;
    background: #f59e0b;
}

.trend-chart__marker-dot--info,
.trend-marker-item__dot--info {
    fill: #3b82f6;
    background: #3b82f6;
}

.trend-chart__marker-dot--resolved,
.trend-marker-item__dot--resolved {
    fill: #94a3b8;
    background: #94a3b8;
}

.legend-item,
.trend-marker-item,
.snapshot-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.legend-item__swatch,
.trend-marker-item__dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    flex: 0 0 auto;
}

.snapshot-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.snapshot-item {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--color-bg-tertiary);
}

.trend-chart__empty,
.empty-state {
    align-items: center;
    justify-content: center;
    min-height: 120px;
    text-align: center;
}

.empty-state--compact {
    min-height: auto;
}

@media (max-width: 920px) {
    .trend-toolbar,
    .trend-card__header,
    .playback-meta,
    .playback-panel__header,
    .query-panel__header,
    .analysis-config__header,
    .trend-meta-row,
    .trend-card__actions {
        flex-direction: column;
        align-items: stretch;
    }

    .action-grid {
        grid-template-columns: 1fr;
    }
}
</style>
