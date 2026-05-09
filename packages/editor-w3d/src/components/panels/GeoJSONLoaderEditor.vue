<template>
    <div class="geojson-loader-editor">
        <div class="section-label">数据城市加载器</div>

        <div class="settings-group">
            <div class="setting-item">
                <label>数据源类型</label>
                <Select
                    :model-value="sourceType"
                    :options="sourceTypeOptions"
                    @update:model-value="updateConfig('sourceType', $event)"
                />
            </div>

            <div v-if="sourceType === 'url'" class="setting-item">
                <label>GeoJSON URL</label>
                <Input
                    :model-value="componentConfig.url || ''"
                    placeholder="/mock/geojson-city-demo.json"
                    @update:model-value="updateConfig('url', $event)"
                />
            </div>

            <div v-if="sourceType === 'inline'" class="setting-item">
                <label>内联数据</label>
                <div class="advanced-json-box">
                    <div class="advanced-json-box__hint">默认建议使用 URL、模拟数据或导入数据；手写 GeoJSON 放入高级配置。</div>
                    <details>
                        <summary>高级配置：内联 GeoJSON</summary>
                        <textarea
                            class="json-textarea"
                            :value="inlineJson"
                            rows="12"
                            placeholder="请输入 GeoJSON FeatureCollection"
                            @blur="saveInlineJson($event.target.value)"
                        ></textarea>
                    </details>
                </div>
            </div>

            <div class="toolbar-row">
                <Button size="sm" @click="useMockData">使用模拟数据</Button>
                <Button size="sm" variant="outline" @click="reloadData">重新加载</Button>
                <Button size="sm" variant="outline" @click="applyMockMetrics">生成模拟指标</Button>
                <Button size="sm" variant="outline" @click="focusFirstRegion">聚焦首个区域</Button>
                <Button size="sm" variant="outline" @click="clearSelection">清空选中</Button>
            </div>
        </div>

        <div class="section-label">运行状态</div>
        <div class="settings-group">
            <div class="setting-item-inline">
                <span class="info-label">区域数量</span>
                <span class="info-value">{{ regionCount }}</span>
            </div>
            <div class="setting-item-inline">
                <span class="info-label">选中数量</span>
                <span class="info-value">{{ selectedCount }}</span>
            </div>
            <div class="setting-item-inline">
                <span class="info-label">数据源</span>
                <span class="info-value">{{ sourceType }}</span>
            </div>
        </div>

        <div class="section-label">区域预览</div>
        <div class="settings-group">
            <div v-if="regionOptions.length === 0" class="empty-hint">
                当前尚未解析出区域。请检查 GeoJSON 数据格式或切换到模拟数据。
            </div>

            <template v-else>
                <div class="setting-item">
                    <label>区域</label>
                    <Select
                        :model-value="activeRegionId"
                        :options="regionOptions"
                        @update:model-value="activeRegionId = $event"
                    />
                </div>

                <div class="setting-item-inline">
                    <span class="info-label">名称</span>
                    <span class="info-value">{{ activeRegionMeta?.name || '-' }}</span>
                </div>

                <div class="setting-item-inline">
                    <span class="info-label">当前值</span>
                    <span class="info-value">{{ activeRegionMeta?.value ?? '-' }}</span>
                </div>

                <div class="toolbar-row">
                    <Button size="sm" variant="outline" :disabled="!activeRegionId" @click="focusActiveRegion">
                        聚焦当前区域
                    </Button>
                    <Button size="sm" variant="outline" :disabled="!activeRegionId" @click="selectActiveRegion">
                        选中当前区域
                    </Button>
                </div>

                <pre class="meta-preview">{{ activeRegionMetaText }}</pre>
            </template>
        </div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useToast } from '../../composables/useToast';
import { useComponent } from '../../composables/useComponent';
import { cloneGeojsonCityDemo } from '../../mocks/geojsonCityDemo';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Button from '../ui/Button.vue';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const toast = useToast();
const { updateComponentConfig } = useComponent();

const sourceTypeOptions = [
    { label: '内联 JSON', value: 'inline' },
    { label: 'URL', value: 'url' }
];

const selectedComponent = computed(() => componentStore.getComponentById(props.componentId));
const componentConfig = computed(() => selectedComponent.value?.config || {});
const componentInstance = computed(() => selectedComponent.value?.instance || null);
const sourceType = computed(() => String(componentConfig.value?.sourceType || 'inline'));

const getStats = () => componentInstance.value?.getRegionStats?.() || {
    regionCount: 0,
    selectedCount: 0,
    sourceType: sourceType.value
};

const stats = ref(getStats());
const activeRegionId = ref('');

const inlineJson = computed(() => {
    const data = componentConfig.value?.data;
    if (!data) return '';
    try {
        return JSON.stringify(data, null, 2);
    } catch {
        return '';
    }
});

const regionCount = computed(() => stats.value?.regionCount || 0);
const selectedCount = computed(() => stats.value?.selectedCount || 0);

const regionOptions = computed(() => {
    const instance = componentInstance.value;
    if (!instance?.regionMap) return [];
    return Array.from(instance.regionMap.values()).map((runtime) => ({
        label: `${runtime.name} (${runtime.id})`,
        value: runtime.id
    }));
});

const activeRegionMeta = computed(() => {
    if (!activeRegionId.value) return null;
    return componentInstance.value?.getRegionMeta?.(activeRegionId.value) || null;
});

const activeRegionMetaText = computed(() => {
    if (!activeRegionMeta.value) return '暂无区域信息';
    return JSON.stringify(activeRegionMeta.value, null, 2);
});

let boundInstance = null;
let onLoaded = null;
let onSelectionChange = null;

const refreshStats = () => {
    stats.value = getStats();
    if (!activeRegionId.value && regionOptions.value.length > 0) {
        activeRegionId.value = regionOptions.value[0].value;
    }
};

const unbindInstanceEvents = () => {
    if (!boundInstance) return;
    if (onLoaded) boundInstance.off?.('loaded', onLoaded);
    if (onSelectionChange) boundInstance.off?.('selectionChange', onSelectionChange);
    boundInstance = null;
    onLoaded = null;
    onSelectionChange = null;
};

const bindInstanceEvents = (instance) => {
    unbindInstanceEvents();
    if (!instance?.on) return;
    onLoaded = () => refreshStats();
    onSelectionChange = () => refreshStats();
    instance.on('loaded', onLoaded);
    instance.on('selectionChange', onSelectionChange);
    boundInstance = instance;
};

watch(
    () => componentInstance.value,
    (instance) => {
        bindInstanceEvents(instance);
        refreshStats();
    },
    { immediate: true }
);

watch(
    () => [componentConfig.value?.url, componentConfig.value?.data, componentConfig.value?.sourceType],
    () => refreshStats(),
    { immediate: true, deep: true }
);

watch(regionOptions, (options) => {
    if (!options.length) {
        activeRegionId.value = '';
        return;
    }
    if (!options.some((item) => item.value === activeRegionId.value)) {
        activeRegionId.value = options[0].value;
    }
});

onBeforeUnmount(() => {
    unbindInstanceEvents();
});

const buildNestedPatch = (dotPath, value) => {
    const parts = String(dotPath || '').split('.');
    if (parts.length === 1) return { [dotPath]: value };
    const result = {};
    let cursor = result;
    for (let i = 0; i < parts.length - 1; i += 1) {
        cursor[parts[i]] = {};
        cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
    return result;
};

const updateConfig = async (key, value) => {
    try {
        await updateComponentConfig(props.componentId, buildNestedPatch(key, value));
        refreshStats();
    } catch (error) {
        toast.error(`更新配置失败: ${error.message}`);
    }
};

const useMockData = async () => {
    await updateComponentConfig(props.componentId, {
        sourceType: 'inline',
        url: '',
        data: cloneGeojsonCityDemo()
    });
    toast.success('已切换到内联模拟 GeoJSON 数据');
    refreshStats();
};

const reloadData = async () => {
    try {
        await componentInstance.value?.reload?.();
        refreshStats();
        toast.success('GeoJSON 数据已重新加载');
    } catch (error) {
        toast.error(`重新加载失败: ${error.message}`);
    }
};

const buildMockMetrics = () => {
    return regionOptions.value.map((item, index) => ({
        id: item.value,
        value: 45 + ((index * 17) % 55),
        height: 5 + (index % 4) * 3
    }));
};

const applyMockMetrics = async () => {
    try {
        await componentInstance.value?.updateData?.(buildMockMetrics());
        refreshStats();
        toast.success('已生成并应用模拟指标数据');
    } catch (error) {
        toast.error(`应用模拟指标失败: ${error.message}`);
    }
};

const focusFirstRegion = () => {
    const first = regionOptions.value[0]?.value;
    if (!first) return;
    activeRegionId.value = first;
    componentInstance.value?.focusRegion?.(first);
};

const focusActiveRegion = () => {
    if (!activeRegionId.value) return;
    componentInstance.value?.focusRegion?.(activeRegionId.value);
};

const selectActiveRegion = () => {
    if (!activeRegionId.value) return;
    componentInstance.value?.setSelectedRegions?.([activeRegionId.value]);
    refreshStats();
};

const clearSelection = () => {
    componentInstance.value?.clearSelection?.();
    refreshStats();
};

const saveInlineJson = async (value) => {
    try {
        const parsed = JSON.parse(value);
        await updateComponentConfig(props.componentId, {
            sourceType: 'inline',
            data: parsed
        });
        toast.success('内联 GeoJSON 已更新');
        refreshStats();
    } catch (error) {
        toast.error(`GeoJSON JSON 解析失败: ${error.message}`);
    }
};
</script>

<style scoped>
.geojson-loader-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.section-label {
    font-size: 12px;
    font-weight: 600;
    color: #d8e6ff;
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(120, 160, 255, 0.18);
    border-radius: 10px;
    background: rgba(11, 18, 34, 0.66);
}

.setting-item,
.setting-item-inline {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.setting-item-inline {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
}

.setting-item label,
.info-label {
    font-size: 12px;
    color: rgba(216, 230, 255, 0.72);
}

.info-value {
    font-size: 12px;
    color: #f3f7ff;
}

.toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.json-textarea,
.meta-preview {
    width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(120, 160, 255, 0.18);
    background: rgba(3, 8, 20, 0.9);
    color: #dce9ff;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
    box-sizing: border-box;
}

.advanced-json-box {
    border: 1px solid rgba(120, 160, 255, 0.18);
    border-radius: 10px;
    padding: 10px;
    background: rgba(3, 8, 20, 0.45);
}

.advanced-json-box__hint {
    margin-bottom: 8px;
    font-size: 12px;
    color: rgba(216, 230, 255, 0.72);
    line-height: 1.5;
}

.advanced-json-box summary {
    cursor: pointer;
    font-size: 12px;
    color: #dce9ff;
}

.advanced-json-box .json-textarea {
    margin-top: 8px;
}

.meta-preview {
    margin: 0;
    max-height: 220px;
    overflow: auto;
}

.empty-hint {
    font-size: 12px;
    line-height: 1.6;
    color: rgba(216, 230, 255, 0.72);
}
</style>
