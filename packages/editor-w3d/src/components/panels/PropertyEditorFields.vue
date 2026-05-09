<template>
    <div class="properties-list" :class="{ 'properties-list--modules': useModuleGroups }">
        <section
            v-for="group in fieldGroups"
            :key="group.key"
            class="property-module"
            :class="{ 'property-module--flat': !group.grouped }"
        >
            <div v-if="group.grouped" class="property-module__header">
                <div>
                    <div class="property-module__title">{{ displayText(group.label) }}</div>
                    <div v-if="group.description" class="property-module__desc">{{ displayText(group.description) }}</div>
                </div>
            </div>

            <div class="property-module__fields">
                <div
                    v-for="field in group.fields"
                    :key="field.key"
                    class="property-field"
                >
                    <div v-if="field.type === 'text'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <Input
                            :model-value="getFieldValue(field.key)"
                            @update:model-value="emit('update-config', field.key, $event)"
                            :placeholder="displayText(field.placeholder)"
                        />
                    </div>

                    <div v-else-if="field.type === 'number'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <Slider
                            :model-value="getFieldValue(field.key) ?? field.default"
                            @update:model-value="emit('update-config', field.key, $event)"
                            :min="field.min"
                            :max="field.max"
                            :step="field.step"
                        />
                    </div>

                    <div v-else-if="field.type === 'color'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <ColorPicker
                            :model-value="getFieldValue(field.key) ?? field.default"
                            @update:model-value="emit('update-config', field.key, $event)"
                        />
                    </div>

                    <div v-else-if="field.type === 'boolean'" class="field-group-inline">
                        <label>{{ displayText(field.label) }}</label>
                        <input
                            type="checkbox"
                            :checked="getFieldValue(field.key) ?? field.default"
                            @change="emit('update-config', field.key, $event.target.checked)"
                            class="checkbox"
                        />
                    </div>

                    <div v-else-if="field.type === 'select'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <template v-if="isCameraJump && field.key === 'meshTarget.componentId'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="modelLoaderComponentOptions"
                            />
                        </template>
                        <template v-else-if="isCameraJump && field.key === 'meshTarget.meshName'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="cameraJumpMeshOptions"
                            />
                        </template>
                        <template v-else-if="isCameraJump && field.key === 'labelTarget.componentId'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="label3DComponentOptions"
                            />
                        </template>
                        <template v-else-if="isCameraJump && field.key === 'labelTarget.labelId'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="cameraJumpLabelOptions"
                            />
                        </template>
                        <template v-else-if="isCameraJump && field.key === 'pointTarget.pointId'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="buildingPointOptions"
                            />
                        </template>
                        <template v-else-if="isHeatmap && field.key === 'surfaceTarget.componentId'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-heatmap-surface-component', $event)"
                                :options="modelLoaderComponentOptions"
                            />
                        </template>
                        <template v-else-if="isHeatmap && field.key === 'surfaceTarget.meshName'">
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="heatmapSurfaceMeshOptions"
                            />
                        </template>
                        <template v-else>
                            <Select
                                :model-value="getFieldValue(field.key) ?? field.default"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :options="displayOptions(field.options)"
                            />
                        </template>
                    </div>

                    <div v-else-if="field.type === 'vector3'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <div class="vector3-inputs">
                            <Input
                                type="number"
                                :model-value="(getFieldValue(field.key) || field.default)[0]"
                                @update:model-value="emit('update-vector3', field.key, 0, $event)"
                                placeholder="X"
                                :step="0.1"
                            />
                            <Input
                                type="number"
                                :model-value="(getFieldValue(field.key) || field.default)[1]"
                                @update:model-value="emit('update-vector3', field.key, 1, $event)"
                                placeholder="Y"
                                :step="0.1"
                            />
                            <Input
                                type="number"
                                :model-value="(getFieldValue(field.key) || field.default)[2]"
                                @update:model-value="emit('update-vector3', field.key, 2, $event)"
                                placeholder="Z"
                                :step="0.1"
                            />
                        </div>
                    </div>

                    <div v-else-if="field.type === 'vector2'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <div class="vector2-inputs">
                            <Input
                                type="number"
                                :model-value="getArrayValue(field, 0)"
                                @update:model-value="emit('update-vector2', field.key, 0, $event)"
                                :placeholder="displayText(field.labels?.[0] || 'X')"
                                :step="field.step ?? 0.000001"
                            />
                            <Input
                                type="number"
                                :model-value="getArrayValue(field, 1)"
                                @update:model-value="emit('update-vector2', field.key, 1, $event)"
                                :placeholder="displayText(field.labels?.[1] || 'Y')"
                                :step="field.step ?? 0.000001"
                            />
                        </div>
                    </div>

                    <div v-else-if="field.type === 'colorRange'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <div class="range-inputs">
                            <div class="range-input">
                                <span>{{ displayText(field.labels?.[0] || '起始') }}</span>
                                <ColorPicker
                                    :model-value="getArrayValue(field, 0)"
                                    @update:model-value="emit('update-range', field.key, 0, $event)"
                                />
                            </div>
                            <div class="range-input">
                                <span>{{ displayText(field.labels?.[1] || '结束') }}</span>
                                <ColorPicker
                                    :model-value="getArrayValue(field, 1)"
                                    @update:model-value="emit('update-range', field.key, 1, $event)"
                                />
                            </div>
                        </div>
                    </div>

                    <div v-else-if="field.type === 'numberRange'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <div class="vector2-inputs">
                            <Input
                                type="number"
                                :model-value="getArrayValue(field, 0)"
                                @update:model-value="emit('update-range', field.key, 0, $event)"
                                :placeholder="displayText(field.labels?.[0] || '最小值')"
                                :step="field.step ?? 0.1"
                            />
                            <Input
                                type="number"
                                :model-value="getArrayValue(field, 1)"
                                @update:model-value="emit('update-range', field.key, 1, $event)"
                                :placeholder="displayText(field.labels?.[1] || '最大值')"
                                :step="field.step ?? 0.1"
                            />
                        </div>
                    </div>

                    <div v-else-if="field.type === 'asset'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <div class="input-with-button">
                            <Input
                                :model-value="getFieldValue(field.key) || ''"
                                @update:model-value="emit('update-config', field.key, $event)"
                                :placeholder="displayText(field.placeholder || '从资源库选择或手动输入')"
                            />
                            <button
                                class="btn-select-asset"
                                @click="emit('open-asset-picker', field)"
                                title="从资源库选择"
                            >
                                选
                            </button>
                        </div>
                    </div>

                    <div v-else-if="field.type === 'json'" class="field-group">
                        <label>{{ displayText(field.label) }}</label>
                        <template v-if="shouldUseLabel3DLabelsEditor(field)">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('labels') || []).length || 0 }} 条标签</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'label3d-labels')" title="编辑标签列表">编</button>
                            </div>
                        </template>
                        <template v-else-if="isMigrationLine && field.key === 'lines'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('lines') || []).length || 0 }} 条线</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'migration-lines')" title="编辑线条列表">编</button>
                            </div>
                        </template>
                        <template v-else-if="isMultiPathAnimation && field.key === 'paths'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('paths') || []).length || 0 }} 条路径</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'multi-paths')" title="编辑多轨迹数据与模型">编</button>
                            </div>
                        </template>
                        <template v-else-if="isAreaBlock && field.key === 'areas'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('areas') || []).length || 0 }} 个区域块</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'area-blocks')" title="编辑区域块列表">编</button>
                            </div>
                        </template>
                        <template v-else-if="isHeatmap && field.key === 'data'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('data') || []).length || 0 }} 个热力点</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'heatmap')" title="编辑热力图数据">编</button>
                            </div>
                        </template>
                        <template v-else-if="isHeatmap && field.key === 'colors'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('colors') || []).length || 0 }} 个颜色节点</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'heatmap')" title="编辑热力图颜色映射">编</button>
                            </div>
                        </template>
                        <template v-else-if="isHeatmap && field.key === 'thresholds'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('thresholds') || []).length || 0 }} 条阈值映射</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'heatmap')" title="编辑热力图阈值映射">编</button>
                            </div>
                        </template>
                        <template v-else-if="isCameraTour && field.key === 'views'">
                            <div class="camera-views-summary">
                                <span class="camera-views-summary__text">已配置 {{ (getFieldValue('views') || []).length || 0 }} 条视角</span>
                                <button class="btn-select-asset" @click="emit('open-editor', 'camera-views')" title="编辑视角列表">编</button>
                            </div>
                        </template>
                        <template v-else>
                            <div class="advanced-json-summary">
                                <div>
                                    <div class="advanced-json-summary__title">{{ getJsonSummary(field) }}</div>
                                    <div class="advanced-json-summary__desc">普通配置区不再直接编辑原始 JSON。</div>
                                </div>
                            </div>
                            <details class="advanced-json-panel">
                                <summary>高级配置：查看或粘贴原始 JSON</summary>
                                <textarea
                                    class="json-textarea"
                                    :value="formatJsonValue(getFieldValue(field.key))"
                                    @blur="emit('update-json-config', field.key, $event.target.value)"
                                    :placeholder="displayText(field.placeholder)"
                                    rows="5"
                                ></textarea>
                            </details>
                        </template>
                    </div>

                    <div v-if="field.description" class="field-description">{{ displayText(field.description) }}</div>
                </div>
            </div>
        </section>

        <div v-if="configSchema.length === 0" class="no-properties">
            该组件没有可配置的属性
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Slider from '../ui/Slider.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import { translateDisplayText } from '../../i18n';

const props = defineProps({
    selectedComponent: {
        type: Object,
        default: null
    },
    configSchema: {
        type: Array,
        default: () => []
    },
    getFieldValue: {
        type: Function,
        required: true
    },
    formatJsonValue: {
        type: Function,
        required: true
    },
    isCameraJump: {
        type: Boolean,
        default: false
    },
    isCameraTour: {
        type: Boolean,
        default: false
    },
    isLabel3D: {
        type: Boolean,
        default: false
    },
    isMigrationLine: {
        type: Boolean,
        default: false
    },
    isMultiPathAnimation: {
        type: Boolean,
        default: false
    },
    isAreaBlock: {
        type: Boolean,
        default: false
    },
    isHeatmap: {
        type: Boolean,
        default: false
    },
    isPostProcessing: {
        type: Boolean,
        default: false
    },
    modelLoaderComponentOptions: {
        type: Array,
        default: () => []
    },
    label3DComponentOptions: {
        type: Array,
        default: () => []
    },
    cameraJumpMeshOptions: {
        type: Array,
        default: () => []
    },
    cameraJumpLabelOptions: {
        type: Array,
        default: () => []
    },
    buildingPointOptions: {
        type: Array,
        default: () => []
    },
    heatmapSurfaceMeshOptions: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits([
    'update-config',
    'update-vector3',
    'update-vector2',
    'update-range',
    'update-json-config',
    'update-heatmap-surface-component',
    'open-asset-picker',
    'open-editor'
]);

const displayText = (value) => translateDisplayText(value);

const displayOptions = (options = []) => (
    (options || []).map((option) => ({
        ...option,
        label: displayText(option?.label)
    }))
);

const POST_PROCESSING_MODULES = [
    { key: 'root', label: '整体配置', description: '后期处理总开关。' },
    { key: 'gtao', label: 'GTAO', description: '高质量环境光遮蔽。' },
    { key: 'ssao', label: 'SSAO', description: '轻量屏幕空间环境光遮蔽。' },
    { key: 'sao', label: 'SAO', description: '屏幕空间环境光遮蔽。' },
    { key: 'ssr', label: 'SSR', description: '屏幕空间反射。' },
    { key: 'bloom', label: 'Bloom', description: '高亮泛光效果。' },
    { key: 'dof', label: 'DOF', description: '景深虚化效果。' },
    { key: 'sobel', label: 'Sobel', description: '边缘检测效果。' },
    { key: 'pixel', label: 'Pixel', description: '像素化效果。' },
    { key: 'fxaa', label: 'FXAA', description: '快速抗锯齿。' },
    { key: 'other', label: '其他', description: '其他后期处理参数。' }
];

const POST_PROCESSING_MODULE_MAP = POST_PROCESSING_MODULES.reduce((map, item) => {
    map[item.key] = item;
    return map;
}, {});

const getPostProcessingModule = (field) => {
    const key = String(field?.key || '');
    if (key === 'enabled' || key === 'pipeline') {
        return POST_PROCESSING_MODULE_MAP.root;
    }

    const effectKey = key.split('.')[0];
    return POST_PROCESSING_MODULE_MAP[effectKey] || POST_PROCESSING_MODULE_MAP.other;
};

const useModuleGroups = computed(() => props.isPostProcessing && props.configSchema.length > 0);

const fieldGroups = computed(() => {
    if (!useModuleGroups.value) {
        return [{
            key: 'default',
            grouped: false,
            fields: props.configSchema
        }];
    }

    const groups = [];
    const groupByKey = new Map();

    props.configSchema.forEach((field) => {
        const meta = getPostProcessingModule(field);
        if (!groupByKey.has(meta.key)) {
            const group = {
                ...meta,
                grouped: true,
                fields: []
            };
            groupByKey.set(meta.key, group);
            groups.push(group);
        }
        groupByKey.get(meta.key).fields.push(field);
    });

    return groups;
});

const shouldUseLabel3DLabelsEditor = (field) => {
    if (!field || field.key !== 'labels') {
        return false;
    }

    if (props.isLabel3D) {
        return true;
    }

    const selectedComponent = props.selectedComponent;
    if (!selectedComponent || typeof selectedComponent !== 'object') {
        return false;
    }

    if (selectedComponent.type === 'Label3D') {
        return true;
    }

    const config = selectedComponent.config && typeof selectedComponent.config === 'object'
        ? selectedComponent.config
        : {};

    return Array.isArray(config.labels)
        && config.globalConfig
        && typeof config.globalConfig === 'object';
};

const normalizeArrayValue = (value, field) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(field.default)) return field.default;
    return [];
};

const getArrayValue = (field, index) => {
    const values = normalizeArrayValue(props.getFieldValue(field.key), field);
    return values[index] ?? field.default?.[index] ?? '';
};

const getJsonSummary = (field) => {
    const value = props.getFieldValue(field.key);
    if (Array.isArray(value)) {
        return `已配置 ${value.length} 条数据`;
    }
    if (value && typeof value === 'object') {
        return `已配置 ${Object.keys(value).length} 个字段`;
    }
    if (value === undefined || value === null || value === '') {
        return '暂无配置';
    }
    return '已配置原始值';
};
</script>

<style scoped>
.properties-list {
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.properties-list--modules {
    gap: 10px;
}

.property-module {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 10px;
    border: 1px solid rgba(118, 144, 180, 0.16);
    border-radius: 8px;
    background: rgba(8, 15, 26, 0.36);
}

.property-module--flat {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
}

.property-module__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(118, 144, 180, 0.12);
}

.property-module__title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.property-module__desc {
    margin-top: 3px;
    font-size: var(--font-size-xs);
    line-height: 1.4;
    color: var(--color-text-tertiary);
}

.property-module__fields {
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.property-field {
    font-size: var(--font-size-xs);
}

.field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.field-group label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: #7a8da6;
}

.input-with-button {
    display: flex;
    gap: var(--space-1);
}

.input-with-button .input {
    flex: 1;
}

.btn-select-asset {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(8, 15, 26, 0.72);
    border-radius: 7px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    cursor: pointer;
    border: 1px solid rgba(118, 144, 180, 0.16);
    transition: all var(--transition-fast);
}

.btn-select-asset:hover {
    background-color: var(--color-primary-subtle);
    border-color: rgba(47, 125, 244, 0.5);
    color: #bfdbfe;
}

.camera-views-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    border: 1px solid rgba(118, 144, 180, 0.15);
    border-radius: 8px;
    padding: var(--space-2);
    background: rgba(8, 15, 26, 0.58);
}

.camera-views-summary__text {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.field-group-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 9px;
    border: 1px solid rgba(118, 144, 180, 0.13);
    border-radius: 7px;
    background: rgba(8, 15, 26, 0.5);
}

.field-group-inline label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
}

.checkbox {
    position: relative;
    width: 30px;
    height: 16px;
    border-radius: 999px;
    border: 1px solid rgba(118, 144, 180, 0.2);
    background-color: rgba(84, 100, 122, 0.32);
    cursor: pointer;
    appearance: none;
    transition: all var(--transition-fast);
}

.checkbox::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #cbd5e1;
    transition:
        transform var(--transition-fast),
        background-color var(--transition-fast);
}

.checkbox:checked::after {
    transform: translateX(14px);
    background: #ffffff;
}

.checkbox:checked {
    border-color: rgba(47, 125, 244, 0.86);
    background-color: #2f7df4;
}

.checkbox:hover:not(:checked) {
    border-color: var(--color-border-hover);
}

.checkbox:focus-visible {
    box-shadow: var(--focus-ring);
}

.vector3-inputs,
.vector2-inputs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-1);
}

.vector2-inputs {
    grid-template-columns: repeat(2, 1fr);
}

.range-inputs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
}

.range-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
}

.range-input span {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
}

.advanced-json-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    border: 1px solid rgba(118, 144, 180, 0.15);
    border-radius: 8px;
    padding: var(--space-2);
    background: rgba(8, 15, 26, 0.58);
}

.advanced-json-summary__title {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.advanced-json-summary__desc {
    margin-top: 2px;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
}

.advanced-json-panel {
    border: 1px solid rgba(118, 144, 180, 0.15);
    border-radius: 8px;
    padding: var(--space-2);
    background: rgba(8, 15, 26, 0.58);
}

.advanced-json-panel summary {
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.advanced-json-panel .json-textarea {
    margin-top: var(--space-2);
}

.json-textarea {
    width: 100%;
    min-height: 80px;
    padding: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    line-height: 1.4;
    border: 1px solid rgba(118, 144, 180, 0.15);
    border-radius: 8px;
    background-color: rgba(8, 15, 26, 0.68);
    color: var(--color-text-primary);
    resize: vertical;
    transition: border-color var(--transition-fast);
}

.json-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--focus-ring);
}

.json-textarea::placeholder {
    color: var(--color-text-tertiary);
}

.field-description {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: var(--space-1);
}

.no-properties {
    text-align: center;
    color: var(--color-text-tertiary);
    padding: var(--space-4) 0;
    font-size: var(--font-size-xs);
}
</style>
