<template>
    <div class="diagnostics-panel">
        <div class="diagnostics-panel__toolbar">
            <div>
                <div class="diagnostics-panel__title">运行诊断</div>
                <div class="diagnostics-panel__subtitle">查看渲染指标、场景状态、最近数据请求与告警事件</div>
            </div>
            <div class="diagnostics-panel__toolbar-actions">
                <Button variant="ghost" size="sm" @click="diagnosticsStore.clearRequestLogs">清空请求</Button>
                <Button variant="ghost" size="sm" @click="diagnosticsStore.clearAlarmLogs">清空告警</Button>
            </div>
        </div>

        <div class="diagnostics-grid">
            <section class="diagnostics-card">
                <div class="diagnostics-card__title">渲染指标</div>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <span>FPS</span>
                        <strong>{{ formatNumber(renderStats.fps) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Draw Calls</span>
                        <strong>{{ formatNumber(renderStats.drawCalls) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Triangles</span>
                        <strong>{{ formatNumber(renderStats.triangles) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Geometries</span>
                        <strong>{{ formatNumber(renderStats.geometries) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Textures</span>
                        <strong>{{ formatNumber(renderStats.textures) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Programs</span>
                        <strong>{{ formatNumber(renderStats.programs) }}</strong>
                    </div>
                </div>
            </section>

            <section class="diagnostics-card">
                <div class="diagnostics-card__title">场景状态</div>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <span>已初始化</span>
                        <strong>{{ sceneStatus.initialized ? '是' : '否' }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>加载中</span>
                        <strong>{{ sceneStatus.loading ? '是' : '否' }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>组件数</span>
                        <strong>{{ formatNumber(sceneStatus.componentCount) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>场景对象</span>
                        <strong>{{ formatNumber(renderStats.objectCount) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Mesh 数</span>
                        <strong>{{ formatNumber(renderStats.meshCount) }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>活跃告警</span>
                        <strong>{{ formatNumber(sceneStatus.activeAlarmCount) }}</strong>
                    </div>
                </div>
                <div class="diagnostics-detail">
                    <div>当前选中：{{ sceneStatus.selectedComponentName || sceneStatus.selectedComponentId || '无' }}</div>
                    <div>最后更新：{{ formatDateTime(renderStats.updatedAt || sceneStatus.updatedAt) }}</div>
                    <div v-if="sceneStatus.error" class="diagnostics-detail__error">场景错误：{{ sceneStatus.error }}</div>
                </div>
            </section>
        </div>

        <section class="diagnostics-card">
            <div class="diagnostics-card__header">
                <div class="diagnostics-card__title">最近数据请求</div>
                <span class="diagnostics-card__badge" :class="{ danger: requestErrorCount > 0 }">
                    {{ requestLogs.length }} 条
                </span>
            </div>
            <div v-if="requestLogs.length === 0" class="diagnostics-empty">暂无数据请求记录</div>
            <div v-else class="diagnostics-log-list">
                <div v-for="item in requestLogs" :key="item.id" class="diagnostics-log-item">
                    <div class="diagnostics-log-item__head">
                        <span class="log-badge" :class="item.status">{{ item.status }}</span>
                        <span class="log-target">{{ item.mode || item.channel }} · {{ item.target || '-' }}</span>
                        <span class="log-time">{{ formatDateTime(item.timestamp) }}</span>
                    </div>
                    <div class="diagnostics-log-item__body">
                        <div>{{ item.method || 'request' }} · {{ item.durationMs }}ms</div>
                        <div class="diagnostics-log-item__summary">{{ item.summary || '-' }}</div>
                    </div>
                </div>
            </div>
        </section>

        <section class="diagnostics-card">
            <div class="diagnostics-card__header">
                <div class="diagnostics-card__title">最近告警事件</div>
                <span class="diagnostics-card__badge" :class="{ danger: alarmErrorCount > 0 }">
                    {{ alarmLogs.length }} 条
                </span>
            </div>
            <div v-if="alarmLogs.length === 0" class="diagnostics-empty">暂无告警事件记录</div>
            <div v-else class="diagnostics-log-list">
                <div v-for="item in alarmLogs" :key="item.id" class="diagnostics-log-item">
                    <div class="diagnostics-log-item__head">
                        <span class="log-badge" :class="item.level">{{ item.type }}</span>
                        <span class="log-target">{{ item.ruleName || item.ruleId || '未命名规则' }}</span>
                        <span class="log-time">{{ formatDateTime(item.timestamp) }}</span>
                    </div>
                    <div class="diagnostics-log-item__body">
                        <div class="diagnostics-log-item__summary">{{ item.message || '-' }}</div>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from '../ui/Button.vue';
import { useDiagnosticsStore } from '../../stores/useDiagnosticsStore';

const diagnosticsStore = useDiagnosticsStore();

const renderStats = computed(() => diagnosticsStore.renderStats);
const sceneStatus = computed(() => diagnosticsStore.sceneStatus);
const requestLogs = computed(() => diagnosticsStore.requestLogs);
const alarmLogs = computed(() => diagnosticsStore.alarmLogs);

const requestErrorCount = computed(() => requestLogs.value.filter((item) => item.status === 'error').length);
const alarmErrorCount = computed(() => alarmLogs.value.filter((item) => item.level === 'error').length);

const formatNumber = (value) => {
    const number = Number(value) || 0;
    return number.toLocaleString('zh-CN');
};

const formatDateTime = (value) => {
    if (!value) return '未更新';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '未更新';
    return date.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
</script>

<style scoped>
.diagnostics-panel {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 0.25rem;
}

.diagnostics-panel__toolbar {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
}

.diagnostics-panel__title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary);
}

.diagnostics-panel__subtitle {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
}

.diagnostics-panel__toolbar-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.diagnostics-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.875rem;
}

.diagnostics-card {
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-secondary);
    padding: 0.875rem;
}

.diagnostics-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.diagnostics-card__title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.diagnostics-card__badge {
    min-width: 42px;
    height: 24px;
    padding: 0 0.625rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
}

.diagnostics-card__badge.danger {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.28);
    background: rgba(248, 113, 113, 0.1);
}

.metrics-grid {
    margin-top: 0.75rem;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.625rem;
}

.metric-item {
    padding: 0.625rem 0.75rem;
    border-radius: 10px;
    background: var(--color-bg-tertiary);
    border: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.metric-item span {
    font-size: 0.72rem;
    color: var(--color-text-tertiary);
}

.metric-item strong {
    font-size: 0.92rem;
    color: var(--color-text-primary);
}

.diagnostics-detail {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.76rem;
    color: var(--color-text-tertiary);
}

.diagnostics-detail__error {
    color: #f87171;
}

.diagnostics-empty {
    padding: 1rem 0;
    font-size: 0.82rem;
    color: var(--color-text-tertiary);
}

.diagnostics-log-list {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    max-height: 260px;
    overflow: auto;
}

.diagnostics-log-item {
    padding: 0.75rem;
    border-radius: 10px;
    background: var(--color-bg-tertiary);
    border: 1px solid rgba(255, 255, 255, 0.04);
}

.diagnostics-log-item__head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.diagnostics-log-item__body {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.76rem;
    color: var(--color-text-secondary);
}

.diagnostics-log-item__summary {
    color: var(--color-text-tertiary);
    word-break: break-word;
}

.log-badge {
    min-width: 56px;
    height: 22px;
    padding: 0 0.5rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    text-transform: lowercase;
    background: rgba(148, 163, 184, 0.16);
    color: var(--color-text-secondary);
}

.log-badge.success,
.log-badge.info {
    background: rgba(34, 197, 94, 0.12);
    color: #4ade80;
}

.log-badge.error {
    background: rgba(248, 113, 113, 0.12);
    color: #f87171;
}

.log-badge.warning {
    background: rgba(250, 204, 21, 0.14);
    color: #facc15;
}

.log-target {
    flex: 1;
    min-width: 0;
    color: var(--color-text-primary);
    font-size: 0.78rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.log-time {
    flex: 0 0 auto;
    color: var(--color-text-tertiary);
    font-size: 0.72rem;
}

@media (max-width: 1100px) {
    .diagnostics-grid {
        grid-template-columns: 1fr;
    }

    .metrics-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
