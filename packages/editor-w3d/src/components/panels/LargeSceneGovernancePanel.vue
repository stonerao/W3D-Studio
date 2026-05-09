<template>
    <div class="large-scene-panel">
        <div class="panel-toolbar">
            <div class="action-grid">
                <Button variant="outline" size="sm" @click="refreshNow">刷新</Button>
                <Button variant="outline" size="sm" @click="applyRiskRecommendations" :disabled="!riskyModels.length">治理风险</Button>
                <Button variant="ghost" size="sm" @click="resetThresholds">重置</Button>
            </div>
        </div>

        <div class="settings-card">
            <div class="setting-item-inline">
                <span class="setting-label">启用诊断</span>
                <input
                    type="checkbox"
                    class="checkbox"
                    :checked="settings.diagnosticsEnabled"
                    @change="updateBooleanSetting('diagnosticsEnabled', $event.target.checked)"
                />
            </div>
            <div class="setting-item">
                <label>刷新间隔（ms）</label>
                <Input
                    type="number"
                    :model-value="String(settings.autoRefreshMs)"
                    @update:model-value="updateNumberSetting('autoRefreshMs', $event)"
                    placeholder="1200"
                />
            </div>
            <div class="setting-item-inline">
                <span class="setting-label">启用分块流式</span>
                <input
                    type="checkbox"
                    class="checkbox"
                    :checked="settings.chunkStreaming.enabled"
                    @change="updateChunkStreamingBoolean('enabled', $event.target.checked)"
                />
            </div>
            <div class="threshold-grid">
                <div class="setting-item">
                    <label>分块预加载距离（m）</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.preloadDistance)" @update:model-value="updateChunkStreamingNumber('preloadDistance', $event)" />
                </div>
                <div class="setting-item">
                    <label>分块预取距离（m）</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.prefetchDistance)" @update:model-value="updateChunkStreamingNumber('prefetchDistance', $event)" />
                </div>
                <div class="setting-item">
                    <label>分块释放距离（m）</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.releaseDistance)" @update:model-value="updateChunkStreamingNumber('releaseDistance', $event)" />
                </div>
                <div class="setting-item">
                    <label>并发加载块数</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.maxConcurrentLoads)" @update:model-value="updateChunkStreamingNumber('maxConcurrentLoads', $event)" />
                </div>
            </div>
            <div class="threshold-grid">
                <label class="setting-item-inline manifest-checkbox">
                    <span class="setting-label">启用预取预算</span>
                    <input type="checkbox" class="checkbox" :checked="settings.chunkStreaming.prefetchBudgetEnabled" @change="updateChunkStreamingBoolean('prefetchBudgetEnabled', $event.target.checked)" />
                </label>
                <div class="setting-item">
                    <label>驻留三角面预算</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.maxResidentTriangles)" @update:model-value="updateChunkStreamingNumber('maxResidentTriangles', $event)" />
                </div>
                <div class="setting-item">
                    <label>驻留资源数量预算</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.maxResidentResources)" @update:model-value="updateChunkStreamingNumber('maxResidentResources', $event)" />
                </div>
                <div class="setting-item">
                    <label>驻留几何体预算</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.maxResidentGeometries)" @update:model-value="updateChunkStreamingNumber('maxResidentGeometries', $event)" />
                </div>
                <div class="setting-item">
                    <label>驻留贴图预算</label>
                    <Input type="number" :model-value="String(settings.chunkStreaming.maxResidentTextures)" @update:model-value="updateChunkStreamingNumber('maxResidentTextures', $event)" />
                </div>
            </div>
            <div class="threshold-grid">
                <div class="setting-item">
                    <label>FPS 预警</label>
                    <Input type="number" :model-value="String(settings.thresholds.fpsWarning)" @update:model-value="updateThreshold('fpsWarning', $event)" />
                </div>
                <div class="setting-item">
                    <label>Draw Calls 预警</label>
                    <Input type="number" :model-value="String(settings.thresholds.drawCallsWarning)" @update:model-value="updateThreshold('drawCallsWarning', $event)" />
                </div>
                <div class="setting-item">
                    <label>帧三角面预警</label>
                    <Input type="number" :model-value="String(settings.thresholds.frameTrianglesWarning)" @update:model-value="updateThreshold('frameTrianglesWarning', $event)" />
                </div>
                <div class="setting-item">
                    <label>单模型三角面预警</label>
                    <Input type="number" :model-value="String(settings.thresholds.modelTrianglesWarning)" @update:model-value="updateThreshold('modelTrianglesWarning', $event)" />
                </div>
            </div>
            <div class="manifest-section">
                <div class="manifest-section__header">
                    <div class="action-grid">
                        <Button variant="ghost" size="sm" @click="fillManifestFromStore">回填当前清单</Button>
                        <Button variant="ghost" size="sm" @click="fillManifestExample">示例</Button>
                        <Button variant="outline" size="sm" @click="importManifestJson">导入清单</Button>
                        <Button variant="ghost" size="sm" @click="clearManifest">清空</Button>
                    </div>
                </div>
                <div class="threshold-grid manifest-source-grid">
                    <div class="setting-item">
                        <label>清单来源</label>
                        <select class="manifest-select" :value="manifestSource.mode" @change="updateManifestSource('mode', $event.target.value)">
                            <option value="inline">内嵌 JSON</option>
                            <option value="url">远端 URL</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label>清单 URL</label>
                        <Input :model-value="manifestSource.url || ''" @update:model-value="updateManifestSource('url', $event)" placeholder="/api/large-scene/manifest.json" />
                    </div>
                    <label class="setting-item-inline manifest-checkbox">
                        <span class="setting-label">启用本地缓存</span>
                        <input type="checkbox" class="checkbox" :checked="manifestSource.cacheEnabled !== false" @change="updateManifestSource('cacheEnabled', $event.target.checked)" />
                    </label>
                    <label class="setting-item-inline manifest-checkbox">
                        <span class="setting-label">失败时回退缓存</span>
                        <input type="checkbox" class="checkbox" :checked="manifestSource.preferCacheOnError !== false" @change="updateManifestSource('preferCacheOnError', $event.target.checked)" />
                    </label>
                    <label class="setting-item-inline manifest-checkbox">
                        <span class="setting-label">相对地址走项目 API Base</span>
                        <input type="checkbox" class="checkbox" :checked="manifestSource.useProjectApiBase" @change="updateManifestSource('useProjectApiBase', $event.target.checked)" />
                    </label>
                    <div class="setting-item manifest-source-actions">
                        <label>远端清单</label>
                        <div class="action-grid">
                            <Button variant="outline" size="sm" @click="loadManifestFromSource" :disabled="manifestFetchState.loading || manifestSource.mode !== 'url'">
                                {{ manifestFetchState.loading ? '拉取中...' : '拉取' }}
                            </Button>
                            <Button variant="ghost" size="sm" @click="forceRefreshManifest" :disabled="manifestFetchState.loading || manifestSource.mode !== 'url'">
                                强制刷新
                            </Button>
                        </div>
                    </div>
                </div>
                <div class="model-tags">
                    <span class="tag">chunk {{ manifestSummary.chunkCount }}</span>
                    <span class="tag">资源 {{ manifestSummary.resourceCount }}</span>
                    <span class="tag">已加载 {{ summary.loadedManifestResourceCount }}/{{ summary.manifestResourceCount }}</span>
                    <span class="tag">来源 {{ manifestSummary.sourceMode === 'url' ? '远端' : '内嵌' }}</span>
                    <span v-if="manifestFetchState.versionTag" class="tag">版本 {{ manifestFetchState.versionTag }}</span>
                    <span v-if="manifestFetchState.cacheStatus" class="tag">缓存 {{ manifestFetchState.cacheStatus }}</span>
                    <span v-if="manifestFetchState.resolvedUrl" class="tag">地址 {{ manifestFetchState.resolvedUrl }}</span>
                    <span v-if="manifestFetchState.loadedAt" class="tag">最近拉取 {{ fetchUpdatedText }}</span>
                    <span v-if="manifestFetchState.fromCache" class="tag">来源缓存</span>
                    <span v-if="manifestFetchState.etag" class="tag">ETag {{ manifestFetchState.etag }}</span>
                    <span v-if="manifestFetchState.fallbackReason" class="tag tag--danger">回退原因 {{ manifestFetchState.fallbackReason }}</span>
                    <span v-if="manifestFetchState.error" class="tag tag--danger">{{ manifestFetchState.error }}</span>
                </div>
                <details class="manifest-advanced">
                    <summary>高级配置：内嵌 Manifest JSON</summary>
                    <textarea
                        v-model="manifestJson"
                        class="manifest-textarea"
                        rows="10"
                        placeholder="粘贴大场景 manifest JSON"
                    ></textarea>
                </details>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <span class="summary-label">FPS</span>
                <strong class="summary-value">{{ summary.fps || '-' }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">Draw Calls</span>
                <strong class="summary-value">{{ formatNumber(summary.drawCalls) }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">帧三角面</span>
                <strong class="summary-value">{{ formatNumber(summary.frameTriangles) }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">模型总三角面</span>
                <strong class="summary-value">{{ formatNumber(summary.totalTriangles) }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">治理中模型</span>
                <strong class="summary-value">{{ summary.activeGovernanceCount }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">已裁剪模型</span>
                <strong class="summary-value">{{ summary.culledModelCount }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">已加载模型</span>
                <strong class="summary-value">{{ summary.loadedModelCount }}</strong>
            </div>
            <div class="summary-card">
                <span class="summary-label">活跃分块</span>
                <strong class="summary-value">{{ summary.activeChunkCount }}/{{ summary.chunkCount }}</strong>
            </div>
        </div>

        <div v-if="sceneWarnings.length" class="warning-list">
            <div v-for="warning in sceneWarnings" :key="warning" class="warning-chip">{{ warning }}</div>
        </div>

        <div v-if="hasOrganizationGroups" class="organization-section">
            <div class="organization-grid">
                <div v-for="section in organizationSections" :key="section.dimension" class="organization-card">
                    <div class="organization-card__header">
                        <div>
                            <div class="organization-title">{{ section.label }}</div>
                            <div class="organization-meta">{{ section.groups.length }} 组</div>
                        </div>
                        <div class="organization-actions">
                            <Button variant="ghost" size="sm" @click="setAllGroups(section.dimension, true)">全开</Button>
                            <Button variant="ghost" size="sm" @click="setAllGroups(section.dimension, false)">全关</Button>
                        </div>
                    </div>
                    <div class="organization-list">
                        <label v-for="group in section.groups" :key="group.key" class="organization-row">
                            <div>
                                <div class="organization-key">{{ group.key }}</div>
                                <div class="organization-meta">{{ group.count }} 模型 · {{ group.riskyCount }} 风险</div>
                            </div>
                            <input
                                type="checkbox"
                                class="checkbox"
                                :checked="group.active"
                                @change="setGroupActive(section.dimension, group.key, $event.target.checked)"
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="chunkDiagnostics.length" class="organization-section">
            <div class="organization-grid">
                <div v-for="chunk in chunkDiagnostics" :key="chunk.key" class="organization-card">
                    <div class="organization-card__header">
                        <div>
                            <div class="organization-title">{{ chunk.key }}</div>
                            <div class="organization-meta">{{ chunk.distanceText }} · {{ chunk.loadedCount }}/{{ chunk.totalCount }} 已加载</div>
                        </div>
                        <span class="status-pill" :class="chunk.currentActive ? 'status-pill--active' : 'status-pill--normal'">
                            {{ chunk.currentActive ? '活跃' : '待释放' }}
                        </span>
                    </div>
                    <div class="model-tags">
                        <span class="tag">目标 {{ chunk.targetActive ? '加载' : '释放' }}</span>
                        <span class="tag">驻留 {{ chunk.targetResident ? '保留' : '释放' }}</span>
                        <span class="tag">加载中 {{ chunk.loadingCount }}</span>
                        <span class="tag">风险 {{ chunk.riskyCount }}</span>
                        <span v-if="chunk.componentCount" class="tag">组件 {{ chunk.componentCount }}</span>
                        <span v-if="chunk.manifestCount" class="tag">分片 {{ chunk.manifestCount }}</span>
                        <span v-if="chunk.prefetched" class="tag">预取驻留</span>
                        <span v-if="chunk.budgetBlocked" class="tag tag--danger">预算阻塞</span>
                        <span class="tag">队列 {{ chunk.queueState }}</span>
                        <span v-if="chunk.pinned" class="tag tag--accent">常驻</span>
                        <span v-else-if="chunk.manuallyActivated" class="tag tag--accent">手动加载</span>
                    </div>
                    <div class="suggestion-row">
                        <Button
                            variant="ghost"
                            size="sm"
                            @click="toggleChunkPinned(chunk.key, !chunk.pinned)"
                        >
                            {{ chunk.pinned ? '取消常驻' : '设为常驻' }}
                        </Button>
                        <Button
                            v-if="!chunk.manuallyActivated"
                            variant="ghost"
                            size="sm"
                            @click="setChunkManualActive(chunk.key, true)"
                        >
                            立即加载
                        </Button>
                        <Button
                            v-else
                            variant="ghost"
                            size="sm"
                            @click="setChunkManualActive(chunk.key, false)"
                        >
                            恢复自动
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <div class="model-section-header">
            <label class="risk-toggle">
                <input type="checkbox" class="checkbox" v-model="showOnlyRisk" />
                <span>仅看风险项</span>
            </label>
        </div>

        <div v-if="filteredModels.length" class="model-list">
            <div v-for="item in filteredModels" :key="item.componentId" class="model-card">
                <div class="model-card__header">
                    <div>
                        <div class="model-name">{{ item.componentName }}</div>
                        <div class="model-meta">{{ item.meshCount }} Mesh · {{ formatNumber(item.triangles) }} Tri · {{ item.distanceText }}</div>
                    </div>
                    <div class="model-card__actions">
                        <span class="status-pill" :class="statusClass(item)">{{ statusText(item) }}</span>
                        <Button v-if="item.focusable" variant="outline" size="sm" @click="focusComponent(item.componentId)">选中</Button>
                    </div>
                </div>
                <div class="model-tags">
                    <span v-if="item.runtimeOnly" class="tag">清单分片</span>
                    <span v-if="item.prefetched" class="tag">已预取</span>
                    <span v-if="item.sourceChunk" class="tag">来源 {{ item.sourceChunk }}</span>
                    <span class="tag">顶点 {{ formatNumber(item.vertices) }}</span>
                    <span class="tag">边界 {{ item.boundsMaxDim ? `${item.boundsMaxDim.toFixed(1)}m` : '-' }}</span>
                    <span v-if="item.distanceCullingEnabled" class="tag">裁剪阈值 {{ item.maxVisibleDistance }}m</span>
                    <span v-if="item.lodEnabled" class="tag">LOD {{ item.lodLevelText }}</span>
                    <span v-if="item.meshCount" class="tag">显示 {{ item.activeMeshCount }}/{{ item.meshCount }}</span>
                    <span v-if="item.organization.zone" class="tag">区域 {{ item.organization.zone }}</span>
                    <span v-if="item.organization.floor" class="tag">楼层 {{ item.organization.floor }}</span>
                    <span v-if="item.organization.chunk" class="tag">分块 {{ item.organization.chunk }}</span>
                    <span v-if="item.governanceEnabled" class="tag tag--accent">治理已启用</span>
                </div>
                <div v-if="item.hiddenByOrganization.length" class="model-risks">
                    <span v-for="dimension in item.hiddenByOrganization" :key="dimension" class="risk-chip">{{ formatDimension(dimension) }} 已停用</span>
                </div>
                <div v-if="item.riskFlags.length" class="model-risks">
                    <span v-for="flag in item.riskFlags" :key="flag" class="risk-chip">{{ flag }}</span>
                </div>
                <div v-if="item.suggestions.length" class="suggestion-row">
                    <Button
                        v-for="suggestion in item.suggestions"
                        :key="`${item.componentId}-${suggestion.id}`"
                        variant="ghost"
                        size="sm"
                        @click="applySuggestion(item, suggestion)"
                    >
                        {{ suggestion.label }}
                    </Button>
                </div>
            </div>
        </div>
        <div v-else class="empty-state">当前没有可展示的模型诊断数据。</div>

        <div class="footer-text">最近刷新：{{ lastUpdatedText }}</div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useLargeSceneStore } from '../../stores/useLargeSceneStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import { LARGE_SCENE_MANIFEST_EXAMPLE, stringifyLargeSceneManifest } from '../../utils/largeSceneManifest';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';

const largeSceneStore = useLargeSceneStore();
const { selectComponent, updateComponentConfig } = useComponent();
const toast = useToast();

const showOnlyRisk = ref(false);
const manifestJson = ref('');

largeSceneStore.rehydrateSettingsFromProject();
manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});

const settings = computed(() => largeSceneStore.settings);
const summary = computed(() => largeSceneStore.sceneSummary);
const sceneWarnings = computed(() => largeSceneStore.sceneWarnings);
const riskyModels = computed(() => largeSceneStore.riskyModels || []);
const chunkDiagnostics = computed(() => largeSceneStore.chunkDiagnostics || []);
const manifestSummary = computed(() => largeSceneStore.manifestSummary || { chunkCount: 0, resourceCount: 0 });
const manifestSource = computed(() => largeSceneStore.manifest?.source || { mode: 'inline', url: '', useProjectApiBase: true });
const manifestFetchState = computed(() => largeSceneStore.manifestFetchState || { loading: false, loadedAt: '', error: '', resolvedUrl: '' });
const organizationSections = computed(() => ([
    {
        dimension: 'zone',
        label: '区域',
        groups: largeSceneStore.organizationGroups?.zone || []
    },
    {
        dimension: 'floor',
        label: '楼层',
        groups: largeSceneStore.organizationGroups?.floor || []
    },
    {
        dimension: 'chunk',
        label: '分块',
        groups: largeSceneStore.organizationGroups?.chunk || []
    }
]));
const hasOrganizationGroups = computed(() => organizationSections.value.some((item) => item.groups.length > 0));
const filteredModels = computed(() => {
    const source = largeSceneStore.modelDiagnostics || [];
    return showOnlyRisk.value
        ? source.filter((item) => item.riskFlags.length > 0 || item.hiddenByOrganization.length > 0)
        : source;
});

const lastUpdatedText = computed(() => {
    if (!largeSceneStore.lastUpdatedAt) {
        return '尚未刷新';
    }
    return new Date(largeSceneStore.lastUpdatedAt).toLocaleTimeString('zh-CN', {
        hour12: false
    });
});

const fetchUpdatedText = computed(() => {
    if (!manifestFetchState.value.loadedAt) {
        return '';
    }
    return new Date(manifestFetchState.value.loadedAt).toLocaleTimeString('zh-CN', {
        hour12: false
    });
});

const updateBooleanSetting = (key, value) => {
    largeSceneStore.updateSettings({ [key]: value });
    largeSceneStore.requestRefresh();
};

const updateNumberSetting = (key, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return;
    }
    largeSceneStore.updateSettings({ [key]: Math.round(numeric) });
};

const updateChunkStreamingBoolean = (key, value) => {
    largeSceneStore.updateSettings({
        chunkStreaming: {
            [key]: value
        }
    });
    largeSceneStore.requestRefresh();
};

const updateChunkStreamingNumber = (key, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return;
    }
    largeSceneStore.updateSettings({
        chunkStreaming: {
            [key]: Math.round(numeric)
        }
    });
    largeSceneStore.requestRefresh();
};

const updateThreshold = (key, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return;
    }
    largeSceneStore.updateSettings({
        thresholds: {
            [key]: Math.round(numeric)
        }
    });
    largeSceneStore.requestRefresh();
};

const resetThresholds = () => {
    largeSceneStore.resetSettings();
    largeSceneStore.requestRefresh();
};

const refreshNow = () => {
    largeSceneStore.requestRefresh();
};

const fillManifestFromStore = () => {
    manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});
};

const fillManifestExample = () => {
    manifestJson.value = LARGE_SCENE_MANIFEST_EXAMPLE;
};

const updateManifestSource = (key, value) => {
    largeSceneStore.updateManifestSource({ [key]: value });
    manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});
};

const importManifestJson = () => {
    try {
        const parsed = JSON.parse(manifestJson.value || '{}');
        largeSceneStore.setManifest(parsed);
        manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});
        largeSceneStore.requestRefresh();
        toast.success(`已导入 ${largeSceneStore.manifestSummary.resourceCount} 个资源分片`);
    } catch (error) {
        toast.error(`清单导入失败：${error.message || 'JSON 解析错误'}`);
    }
};

const clearManifest = () => {
    largeSceneStore.clearManifest();
    manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});
    largeSceneStore.requestRefresh();
    toast.success('已清空资源分片清单');
};

const loadManifestFromSource = async () => {
    try {
        await largeSceneStore.loadManifestFromSource();
        manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});
        largeSceneStore.requestRefresh();
        toast.success(`已拉取 ${largeSceneStore.manifestSummary.resourceCount} 个资源分片`);
    } catch (error) {
        toast.error(`远端清单拉取失败：${error.message || '请求异常'}`);
    }
};

const forceRefreshManifest = async () => {
    try {
        await largeSceneStore.loadManifestFromSource({ forceRefresh: true });
        manifestJson.value = stringifyLargeSceneManifest(largeSceneStore.manifest || {});
        largeSceneStore.requestRefresh();
        const suffix = largeSceneStore.manifestFetchState.fromCache ? '，网络失败后已回退缓存' : '，已忽略本地缓存条件';
        toast.success(`已强制刷新 ${largeSceneStore.manifestSummary.resourceCount} 个资源分片${suffix}`);
    } catch (error) {
        toast.error(`强制刷新失败：${error.message || '请求异常'}`);
    }
};

const focusComponent = (componentId) => {
    selectComponent(componentId);
};

const setGroupActive = (dimension, key, active) => {
    largeSceneStore.setGroupActive(dimension, key, active);
    largeSceneStore.requestRefresh();
};

const setAllGroups = (dimension, active) => {
    largeSceneStore.setAllGroupsActive(dimension, active);
    largeSceneStore.requestRefresh();
};

const toggleChunkPinned = (chunkKey, pinned) => {
    largeSceneStore.setChunkPinned(chunkKey, pinned);
    largeSceneStore.requestRefresh();
    toast.success(pinned ? `已将 ${chunkKey} 设为常驻` : `已取消 ${chunkKey} 常驻`);
};

const setChunkManualActive = (chunkKey, active) => {
    largeSceneStore.setChunkManualActive(chunkKey, active);
    toast.success(active ? `已请求立即加载 ${chunkKey}` : `已恢复 ${chunkKey} 自动流式`);
};

const applySuggestion = async (item, suggestion) => {
    await updateComponentConfig(item.componentId, {
        largeScene: suggestion.patch
    });
    largeSceneStore.requestRefresh();
    toast.success(`已对 ${item.componentName} 应用建议：${suggestion.label}`);
};

const applyRiskRecommendations = async () => {
    const targets = riskyModels.value.filter((item) => item.suggestions.length > 0);
    if (!targets.length) {
        toast.warning('当前没有可应用的治理建议');
        return;
    }

    let appliedCount = 0;
    for (const item of targets) {
        for (const suggestion of item.suggestions) {
            await updateComponentConfig(item.componentId, {
                largeScene: suggestion.patch
            });
            appliedCount += 1;
        }
    }

    largeSceneStore.requestRefresh();
    toast.success(`已应用 ${appliedCount} 条治理建议`);
};

const formatNumber = (value) => {
    const numeric = Number(value) || 0;
    return numeric.toLocaleString('zh-CN');
};

const formatDimension = (dimension) => {
    if (dimension === 'zone') return '区域';
    if (dimension === 'floor') return '楼层';
    if (dimension === 'chunk') return '分块';
    return dimension;
};

const statusText = (item) => {
    if (item.loadState === 'unloading') return '释放中';
    if (item.loadState === 'loading') return '加载中';
    if (item.loadState === 'unloaded') return '已释放';
    if (item.hiddenByOrganization.length > 0) return '分组停用';
    if (item.culled) return '已裁剪';
    if (item.riskFlags.length > 0) return '关注';
    if (item.governanceEnabled) return '治理中';
    return '正常';
};

const statusClass = (item) => {
    if (item.hiddenByOrganization.length > 0) return 'status-pill--warning';
    if (item.culled) return 'status-pill--culled';
    if (item.riskFlags.length > 0) return 'status-pill--warning';
    if (item.governanceEnabled) return 'status-pill--active';
    return 'status-pill--normal';
};
</script>

<style scoped>
.large-scene-panel {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    height: 100%;
    padding: 0.875rem;
    overflow: auto;
}

.action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    width: 100%;
}

.panel-toolbar,
.model-section-header,
.model-card__header,
.setting-item-inline,
.risk-toggle,
.toolbar-actions,
.model-card__actions,
.organization-card__header,
.organization-actions,
.organization-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.panel-title,
.panel-title-sm,
.model-name,
.organization-title,
.organization-key {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.panel-subtitle,
.model-meta,
.footer-text,
.setting-label,
.organization-meta {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.settings-card,
.summary-card,
.model-card,
.organization-card {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background: var(--color-bg-secondary);
}

.settings-card,
.model-card,
.organization-card {
    padding: 0.75rem;
}

.setting-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.manifest-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
}

.manifest-section__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.manifest-textarea {
    width: 100%;
    min-height: 10rem;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.75rem;
    line-height: 1.5;
    resize: vertical;
}

.manifest-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.manifest-advanced {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: var(--color-bg-tertiary);
}

.manifest-advanced summary {
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.manifest-advanced .manifest-textarea {
    margin-top: var(--space-2);
}

.manifest-select {
    min-height: 2rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
}

.manifest-checkbox {
    padding: 1.35rem 0 0;
}

.manifest-source-actions {
    justify-content: flex-end;
}

.setting-item label {
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
}

.threshold-grid,
.summary-grid,
.model-tags,
.warning-list,
.model-risks,
.organization-grid {
    display: grid;
    gap: 0.5rem;
}

.organization-list,
.model-list,
.suggestion-row {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.threshold-grid {
    margin-top: 0.75rem;
    grid-template-columns: 1fr;
}

.summary-grid,
.organization-grid {
    grid-template-columns: 1fr;
}

.summary-card {
    padding: 0.75rem;
}

.summary-label {
    display: block;
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
}

.summary-value {
    display: block;
    margin-top: 0.25rem;
    font-size: 1rem;
    color: var(--color-text-primary);
}

.warning-list,
.model-tags,
.model-risks {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.organization-row {
    padding: 0.5rem 0.625rem;
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
}

.organization-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.warning-chip,
.tag,
.risk-chip,
.status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 1.75rem;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    font-size: 0.6875rem;
    line-height: 1.2;
}

.warning-chip,
.risk-chip,
.status-pill--warning {
    background: rgba(245, 158, 11, 0.14);
    color: #d97706;
}

.tag {
    justify-content: flex-start;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
}

.tag--accent,
.status-pill--active {
    background: rgba(59, 130, 246, 0.14);
    color: #2563eb;
}

.tag--danger {
    background: rgba(239, 68, 68, 0.14);
    color: #dc2626;
}

.status-pill--culled {
    background: rgba(239, 68, 68, 0.14);
    color: #dc2626;
}

.status-pill--normal {
    background: rgba(16, 185, 129, 0.14);
    color: #059669;
}

.checkbox {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
}

.empty-state {
    padding: 1rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-md);
}

@media (max-width: 720px) {
    .action-grid,
    .threshold-grid,
    .summary-grid,
    .organization-grid {
        grid-template-columns: 1fr;
    }

    .manifest-section__header {
        flex-direction: column;
    }
}
</style>
