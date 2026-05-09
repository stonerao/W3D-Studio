<template>
    <div class="model-loader-governance-editor">
        <div v-if="!component" class="empty-state">未找到当前模型组件。</div>
        <div v-else class="panel-content">
            <div class="section-label">
                大场景治理
                <span class="status-tag" :class="largeSceneConfig.enabled ? 'enabled' : 'disabled'">
                    {{ largeSceneConfig.enabled ? '已启用' : '未启用' }}
                </span>
            </div>
            <div class="settings-group">
                <div class="setting-item-inline">
                    <span class="info-label">模型规模</span>
                    <span class="info-value">{{ geometryStatsSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">边界尺寸</span>
                    <span class="info-value">{{ boundsSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">当前距离</span>
                    <span class="info-value">{{ runtimeDistanceSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">运行状态</span>
                    <span class="info-value">{{ runtimeGovernanceSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">LOD 级别</span>
                    <span class="info-value">{{ runtimeLodSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">加载状态</span>
                    <span class="info-value">{{ runtimeLoadSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <label>启用治理</label>
                    <input
                        type="checkbox"
                        :checked="largeSceneConfig.enabled"
                        @change="updateLargeSceneConfig({ enabled: $event.target.checked })"
                        class="checkbox"
                    />
                </div>
                <div class="setting-item-inline">
                    <label>距离裁剪</label>
                    <input
                        type="checkbox"
                        :checked="largeSceneConfig.distanceCulling.enabled"
                        @change="updateLargeSceneConfig({ distanceCulling: { enabled: $event.target.checked } })"
                        class="checkbox"
                    />
                </div>
                <div class="setting-item">
                    <label>区域标签</label>
                    <Input
                        :model-value="largeSceneConfig.organization.zone"
                        @update:model-value="updateLargeSceneConfig({ organization: { zone: String($event || '').trim() } })"
                        placeholder="如：A区"
                    />
                </div>
                <div class="setting-item">
                    <label>楼层标签</label>
                    <Input
                        :model-value="largeSceneConfig.organization.floor"
                        @update:model-value="updateLargeSceneConfig({ organization: { floor: String($event || '').trim() } })"
                        placeholder="如：F3"
                    />
                </div>
                <div class="setting-item">
                    <label>分块标签</label>
                    <Input
                        :model-value="largeSceneConfig.organization.chunk"
                        @update:model-value="updateLargeSceneConfig({ organization: { chunk: String($event || '').trim() } })"
                        placeholder="如：chunk-01"
                    />
                </div>
                <div class="setting-item">
                    <label>最大可见距离（m）</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.distanceCulling.maxVisibleDistance || '')"
                        @update:model-value="updateLargeSceneNumber('distanceCulling.maxVisibleDistance', $event)"
                        placeholder="800"
                    />
                </div>
                <div class="setting-item-inline">
                    <label>启用 LOD</label>
                    <input
                        type="checkbox"
                        :checked="largeSceneConfig.lod.enabled"
                        @change="updateLargeSceneConfig({ lod: { enabled: $event.target.checked } })"
                        class="checkbox"
                    />
                </div>
                <div class="setting-item-inline">
                    <label>保留交互 Mesh</label>
                    <input
                        type="checkbox"
                        :checked="largeSceneConfig.lod.preserveInteractiveMeshes"
                        @change="updateLargeSceneConfig({ lod: { preserveInteractiveMeshes: $event.target.checked } })"
                        class="checkbox"
                    />
                </div>
                <div class="setting-item-inline">
                    <label>参与分块流式</label>
                    <input
                        type="checkbox"
                        :checked="largeSceneConfig.streaming.enabled"
                        @change="updateLargeSceneConfig({ streaming: { enabled: $event.target.checked } })"
                        class="checkbox"
                    />
                </div>
                <div class="setting-item">
                    <label>LOD 中距离（m）</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.lod.midDistance || '')"
                        @update:model-value="updateLargeSceneNumber('lod.midDistance', $event)"
                        placeholder="280"
                    />
                </div>
                <div class="setting-item">
                    <label>LOD 远距离（m）</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.lod.farDistance || '')"
                        @update:model-value="updateLargeSceneNumber('lod.farDistance', $event)"
                        placeholder="560"
                    />
                </div>
                <div class="setting-item">
                    <label>中距离隐藏比例</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.lod.mediumMeshRatio || '')"
                        @update:model-value="updateLargeSceneNumber('lod.mediumMeshRatio', $event)"
                        placeholder="0.015"
                    />
                </div>
                <div class="setting-item">
                    <label>远距离隐藏比例</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.lod.lowMeshRatio || '')"
                        @update:model-value="updateLargeSceneNumber('lod.lowMeshRatio', $event)"
                        placeholder="0.04"
                    />
                </div>
                <div class="setting-item">
                    <label>单模型三角面预警</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.thresholds.trianglesWarning || '')"
                        @update:model-value="updateLargeSceneNumber('thresholds.trianglesWarning', $event)"
                        placeholder="250000"
                    />
                </div>
                <div class="setting-item">
                    <label>单模型 Mesh 预警</label>
                    <Input
                        type="number"
                        :model-value="String(largeSceneConfig.thresholds.meshesWarning || '')"
                        @update:model-value="updateLargeSceneNumber('thresholds.meshesWarning', $event)"
                        placeholder="300"
                    />
                </div>
                <div v-if="runtimeRiskFlags.length" class="governance-risk-list">
                    <span v-for="flag in runtimeRiskFlags" :key="flag" class="risk-chip">{{ flag }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Input from '../ui/Input.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useLargeSceneStore } from '../../stores/useLargeSceneStore';
import { useComponent } from '../../composables/useComponent';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const largeSceneStore = useLargeSceneStore();
const { updateComponentConfig } = useComponent();

const component = computed(() => componentStore.components.find((item) => item.id === props.componentId) || null);
const modelInstance = computed(() => component.value?.instance || null);
const geometryStats = computed(() => modelInstance.value?.getGeometryStats?.() || null);
const modelBounds = computed(() => modelInstance.value?.getBounds?.() || null);
const runtimeDiagnostic = computed(() => {
    return (largeSceneStore.modelDiagnostics || []).find((item) => item.componentId === props.componentId) || null;
});

const largeSceneConfig = computed(() => {
    const config = component.value?.config?.largeScene || {};
    return {
        enabled: Boolean(config.enabled),
        organization: {
            zone: String(config.organization?.zone || ''),
            floor: String(config.organization?.floor || ''),
            chunk: String(config.organization?.chunk || '')
        },
        distanceCulling: {
            enabled: Boolean(config.distanceCulling?.enabled),
            maxVisibleDistance: Number(config.distanceCulling?.maxVisibleDistance) || 800
        },
        lod: {
            enabled: Boolean(config.lod?.enabled),
            midDistance: Number(config.lod?.midDistance) || 280,
            farDistance: Number(config.lod?.farDistance) || 560,
            mediumMeshRatio: Number(config.lod?.mediumMeshRatio) || 0.015,
            lowMeshRatio: Number(config.lod?.lowMeshRatio) || 0.04,
            preserveInteractiveMeshes: config.lod?.preserveInteractiveMeshes !== false
        },
        streaming: {
            enabled: Boolean(config.streaming?.enabled)
        },
        thresholds: {
            trianglesWarning: Number(config.thresholds?.trianglesWarning) || 250000,
            meshesWarning: Number(config.thresholds?.meshesWarning) || 300
        }
    };
});

const geometryStatsSummary = computed(() => {
    if (!geometryStats.value) return '未获取';
    return `${(geometryStats.value.vertices || 0).toLocaleString('zh-CN')} Vert · ${(geometryStats.value.triangles || 0).toLocaleString('zh-CN')} Tri`;
});

const boundsSummary = computed(() => {
    const maxDim = Number(modelBounds.value?.maxDim) || 0;
    return maxDim ? `${maxDim.toFixed(1)} m` : '未获取';
});

const runtimeDistanceSummary = computed(() => runtimeDiagnostic.value?.distanceText || '-');
const runtimeLodSummary = computed(() => {
    if (!runtimeDiagnostic.value?.lodEnabled) return '未启用';
    return runtimeDiagnostic.value?.lodLevelText || '高精度';
});
const runtimeLoadSummary = computed(() => runtimeDiagnostic.value?.loadStateText || '已加载');
const runtimeGovernanceSummary = computed(() => {
    if (!runtimeDiagnostic.value) return '未诊断';
    if (runtimeDiagnostic.value.hiddenByOrganization?.length) return '已按分组停用';
    if (runtimeDiagnostic.value.culled) return '已按距离隐藏';
    if (runtimeDiagnostic.value.riskFlags?.length) return '存在风险项';
    if (runtimeDiagnostic.value.governanceEnabled) return '治理运行中';
    return '正常';
});
const runtimeRiskFlags = computed(() => runtimeDiagnostic.value?.riskFlags || []);

const updateLargeSceneConfig = (patch) => {
    updateComponentConfig(props.componentId, {
        largeScene: patch
    });
    largeSceneStore.requestRefresh();
};

const updateLargeSceneNumber = (path, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    if (path === 'distanceCulling.maxVisibleDistance') {
        updateLargeSceneConfig({ distanceCulling: { maxVisibleDistance: Math.round(numeric) } });
        return;
    }
    if (path === 'thresholds.trianglesWarning') {
        updateLargeSceneConfig({ thresholds: { trianglesWarning: Math.round(numeric) } });
        return;
    }
    if (path === 'thresholds.meshesWarning') {
        updateLargeSceneConfig({ thresholds: { meshesWarning: Math.round(numeric) } });
        return;
    }
    if (path === 'lod.midDistance') {
        updateLargeSceneConfig({ lod: { midDistance: Math.round(numeric) } });
        return;
    }
    if (path === 'lod.farDistance') {
        updateLargeSceneConfig({ lod: { farDistance: Math.round(numeric) } });
        return;
    }
    if (path === 'lod.mediumMeshRatio') {
        updateLargeSceneConfig({ lod: { mediumMeshRatio: Number(numeric.toFixed(3)) } });
        return;
    }
    if (path === 'lod.lowMeshRatio') {
        updateLargeSceneConfig({ lod: { lowMeshRatio: Number(numeric.toFixed(3)) } });
    }
};
</script>

<style scoped>
.model-loader-governance-editor {
    display: flex;
    flex-direction: column;
}

.panel-content {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
}

.section-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-border);
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
}

.setting-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.setting-item label,
.info-label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
}

.setting-item-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.875rem;
}

.info-value {
    font-size: 0.6875rem;
    color: var(--color-text-primary);
}

.checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--color-border);
    cursor: pointer;
}

.governance-risk-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.25rem 0 0.5rem;
}

.risk-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 1.5rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.14);
    color: #d97706;
    font-size: 0.6875rem;
}

.status-tag {
    font-size: 0.625rem;
    padding: 0.1rem 0.375rem;
    border-radius: var(--border-radius-sm);
    font-weight: normal;
    text-transform: none;
    letter-spacing: 0;
}

.status-tag.enabled {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
}

.status-tag.disabled {
    background: rgba(107, 114, 128, 0.12);
    color: var(--color-text-tertiary);
}

.empty-state {
    padding: 1rem 0.75rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}
</style>
