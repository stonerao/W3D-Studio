<template>
    <Modal
        :model-value="modelValue"
        title="数据整理配置"
        width="min(1120px, calc(100vw - 40px))"
        @update:model-value="emit('update:modelValue', $event)"
        @close="close"
    >
        <div class="data-transform-config">
            <div class="transform-tabs">
                <button
                    type="button"
                    :class="['transform-tab', { active: activeTab === 'visual' }]"
                    @click="activeTab = 'visual'"
                >
                    可视化配置
                </button>
                <button
                    type="button"
                    :class="['transform-tab', { active: activeTab === 'script' }]"
                    @click="activeTab = 'script'"
                >
                    高级脚本
                </button>
            </div>

            <div v-if="activeTab === 'visual'" class="visual-layout">
                <div class="config-pane">
                    <section class="config-section">
                        <div class="section-header">
                            <div>
                                <div class="section-title">1. 选择数据范围</div>
                                <div class="section-desc">先从预览返回中选择列表或对象所在位置</div>
                            </div>
                            <label class="switch-label">
                                <input
                                    type="checkbox"
                                    :checked="draftConfig.enabled"
                                    @change="setEnabled($event.target.checked)"
                                />
                                启用
                            </label>
                        </div>
                        <Select
                            :model-value="selectedRangePath"
                            :options="dataPathSelectOptions"
                            @update:model-value="setDataRange"
                        />
                        <div class="section-hint">
                            当前选中 {{ sourceRowsInfo.rowCount }} 条，应用规则后 {{ transformedRowsInfo.rowCount }} 条。
                        </div>
                    </section>

                    <section v-if="isRealtimeMode" class="config-section config-section--sample">
                        <div class="section-header">
                            <div>
                                <div class="section-title">实时消息样例</div>
                                <div class="section-desc">WebSocket / MQTT 没有最近消息时，可粘贴一条消息用于配置</div>
                            </div>
                            <Button
                                v-if="runtimePayload !== null && runtimePayload !== undefined"
                                variant="outline"
                                size="sm"
                                @click="useRuntimePayloadAsSample"
                            >
                                使用最近消息
                            </Button>
                        </div>
                        <textarea
                            v-model="sampleText"
                            class="sample-textarea"
                            spellcheck="false"
                            placeholder='例如：{"data":[{"name":"设备A","x":1,"y":2,"z":3}]}'
                        />
                        <div v-if="sampleParseError" class="section-error">{{ sampleParseError }}</div>
                    </section>

                    <section v-if="templateOptions.length" class="config-section">
                        <div class="section-header">
                            <div>
                                <div class="section-title">组件推荐模板</div>
                                <div class="section-desc">按三维组件期望结构快速生成字段匹配</div>
                            </div>
                        </div>
                        <div class="template-list">
                            <button
                                v-for="template in templateOptions"
                                :key="template.id"
                                type="button"
                                :class="['template-card', { active: draftConfig.templateId === template.id }]"
                                @click="applyTemplate(template)"
                            >
                                <span>{{ template.label }}</span>
                                <small>{{ template.outputHint }}</small>
                            </button>
                        </div>
                    </section>

                    <section class="config-section">
                        <div class="section-header">
                            <div>
                                <div class="section-title">2. 添加过滤条件</div>
                                <div class="section-desc">字段和值都来自右侧预览数据</div>
                            </div>
                            <Button variant="outline" size="sm" @click="addFilter">新增条件</Button>
                        </div>
                        <div v-if="draftConfig.filters.length === 0" class="empty-row">不过滤数据</div>
                        <div
                            v-for="(filter, index) in draftConfig.filters"
                            :key="`filter-${index}`"
                            class="filter-row"
                        >
                            <Select
                                :model-value="filter.field"
                                :options="fieldSelectOptions"
                                placeholder="字段"
                                @update:model-value="updateFilter(index, 'field', $event)"
                            />
                            <Select
                                :model-value="filter.operator"
                                :options="filterOperatorOptions"
                                @update:model-value="updateFilter(index, 'operator', $event)"
                            />
                            <Select
                                v-if="getFilterValueOptions(filter.field, filter.value).length"
                                :model-value="filter.value"
                                :options="getFilterValueOptions(filter.field, filter.value)"
                                placeholder="选择值"
                                @update:model-value="updateFilter(index, 'value', $event)"
                            />
                            <Input
                                v-else-if="operatorNeedsValue(filter.operator)"
                                :model-value="filter.value"
                                placeholder="输入值"
                                @update:model-value="updateFilter(index, 'value', $event)"
                            />
                            <span v-else class="value-placeholder">无需填写</span>
                            <button type="button" class="icon-remove" @click="removeFilter(index)">×</button>
                        </div>
                    </section>

                    <section class="config-section">
                        <div class="section-title">3. 排序与数量</div>
                        <div class="sort-row">
                            <Select
                                :model-value="draftConfig.sort.field"
                                :options="fieldSelectOptions"
                                placeholder="排序字段"
                                @update:model-value="updateSort('field', $event)"
                            />
                            <Select
                                :model-value="draftConfig.sort.direction"
                                :options="sortDirectionOptions"
                                @update:model-value="updateSort('direction', $event)"
                            />
                            <label class="switch-label switch-label--inline">
                                <input
                                    type="checkbox"
                                    :checked="draftConfig.limit.enabled"
                                    @change="updateLimit('enabled', $event.target.checked)"
                                />
                                限制
                            </label>
                            <Input
                                :model-value="draftConfig.limit.count"
                                type="number"
                                min="0"
                                placeholder="条数"
                                @update:model-value="updateLimit('count', $event)"
                            />
                        </div>
                    </section>

                    <section class="config-section">
                        <div class="section-header">
                            <div>
                                <div class="section-title">4. 字段匹配</div>
                                <div class="section-desc">目标字段是三维组件需要的结构，来源字段从预览数据选择</div>
                            </div>
                            <div class="section-actions">
                                <Button variant="outline" size="sm" @click="autoMatchFields">自动匹配</Button>
                                <Button variant="outline" size="sm" @click="addMapping">新增字段</Button>
                            </div>
                        </div>
                        <div v-if="draftConfig.mappings.length === 0" class="empty-row">暂无字段匹配，整理后会直接使用选中的原始数据。</div>
                        <div
                            v-for="(mapping, index) in draftConfig.mappings"
                            :key="`mapping-${index}`"
                            class="mapping-row"
                        >
                            <Select
                                :model-value="mapping.target"
                                :options="getTargetOptions(mapping.target)"
                                placeholder="目标字段"
                                @update:model-value="updateMapping(index, 'target', $event)"
                            />
                            <Select
                                :model-value="mapping.source"
                                :options="getSourceOptions(mapping.source)"
                                placeholder="来源字段"
                                @update:model-value="updateMapping(index, 'source', $event)"
                            />
                            <Select
                                :model-value="mapping.type"
                                :options="valueTypeOptions"
                                @update:model-value="updateMapping(index, 'type', $event)"
                            />
                            <Input
                                :model-value="mapping.fallback"
                                placeholder="默认值"
                                @update:model-value="updateMapping(index, 'fallback', $event)"
                            />
                            <button type="button" class="icon-remove" @click="removeMapping(index)">×</button>
                        </div>
                    </section>
                </div>

                <div class="preview-pane">
                    <section class="preview-card preview-card--toolbar">
                        <div>
                            <div class="preview-title">数据预览</div>
                            <div class="preview-subtitle">{{ previewStatusText }}</div>
                        </div>
                        <Button variant="outline" size="sm" :disabled="previewLoading" @click="reloadPreview">
                            {{ previewLoading ? '加载中...' : '刷新预览' }}
                        </Button>
                    </section>

                    <section v-if="previewError" class="preview-card preview-card--error">
                        {{ previewError }}
                    </section>

                    <section class="preview-card">
                        <div class="preview-card-header">
                            <span>可用字段</span>
                            <small>点击字段可快速填入下一个映射</small>
                        </div>
                        <div v-if="fieldOptions.length" class="field-chip-list">
                            <button
                                v-for="field in fieldOptions"
                                :key="field.value"
                                type="button"
                                class="field-chip"
                                @click="assignFieldToNextMapping(field.value)"
                            >
                                <span>{{ field.value }}</span>
                                <small>{{ field.valueType }}</small>
                            </button>
                        </div>
                        <div v-else class="empty-row">暂无可识别字段，请先选择数据范围或刷新预览。</div>
                    </section>

                    <section class="preview-card">
                        <div class="preview-card-header">
                            <span>整理后表格</span>
                            <small>最多显示 20 行、8 列</small>
                        </div>
                        <div v-if="transformedTableRows.length && transformedTableColumns.length" class="preview-table-wrap">
                            <table class="preview-table">
                                <thead>
                                    <tr>
                                        <th v-for="column in transformedTableColumns" :key="column.value">{{ column.label }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, rowIndex) in transformedTableRows" :key="`transformed-row-${rowIndex}`">
                                        <td v-for="column in transformedTableColumns" :key="column.value">
                                            {{ formatCell(getValueByPath(row, column.value)) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <pre v-else class="json-preview">{{ stringifyPreview(transformedPreviewData) || '暂无' }}</pre>
                    </section>

                    <section class="preview-card">
                        <div class="preview-card-header">
                            <span>原始返回</span>
                            <small>{{ rawPreviewRows.length }} 行样例</small>
                        </div>
                        <div v-if="rawPreviewRows.length && rawTableColumns.length" class="preview-table-wrap">
                            <table class="preview-table">
                                <thead>
                                    <tr>
                                        <th v-for="column in rawTableColumns" :key="column.value">{{ column.label }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, rowIndex) in rawPreviewRows" :key="`raw-row-${rowIndex}`">
                                        <td v-for="column in rawTableColumns" :key="column.value">
                                            {{ formatCell(getValueByPath(row, column.value)) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <pre v-else class="json-preview">{{ stringifyPreview(effectiveRawData) || '暂无' }}</pre>
                    </section>
                </div>
            </div>

            <div v-else class="script-layout">
                <div class="script-editor">
                    <div class="section-title">高级脚本</div>
                    <div class="section-desc">仅在未启用“可视化配置”时按兼容逻辑执行。</div>
                    <textarea
                        v-model="draftTransformFn"
                        class="script-textarea"
                        spellcheck="false"
                    />
                </div>
                <div class="script-preview">
                    <section class="preview-card">
                        <div class="preview-card-header">
                            <span>脚本输入</span>
                        </div>
                        <pre class="json-preview">{{ stringifyPreview(scriptInputData) || '暂无' }}</pre>
                    </section>
                    <section class="preview-card">
                        <div class="preview-card-header">
                            <span>脚本结果</span>
                        </div>
                        <pre class="json-preview">{{ stringifyPreview(scriptResult) || '暂无' }}</pre>
                    </section>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="modal-footer-content">
                <div class="footer-info">
                    <span class="footer-tag">{{ draftConfig.enabled ? '可视化整理' : '兼容模式' }}</span>
                    <span class="footer-text">{{ footerSummary }}</span>
                </div>
                <div class="footer-actions">
                    <Button variant="outline" @click="close">取消</Button>
                    <Button variant="primary" @click="save">保存</Button>
                </div>
            </div>
        </template>
    </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import Modal from '../ui/Modal.vue';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import {
    applyLegacyDataTransform,
    buildDataPathOptions,
    collectFieldOptions,
    createVisualTransformPreview,
    getRowsInfo,
    getValueByPath,
    normalizeVisualTransformConfig
} from '../../services/visualDataTransform';
import {
    buildVisualTransformConfigFromTemplate,
    getVisualDataTemplateMapping,
    getVisualDataTemplateTargetOptions,
    getVisualDataTemplates
} from '../../services/visualDataTemplates';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    source: {
        type: Object,
        default: () => ({})
    },
    config: {
        type: Object,
        default: () => ({})
    },
    transformFn: {
        type: String,
        default: ''
    },
    componentType: {
        type: String,
        default: ''
    },
    runtimePayload: {
        type: [Object, Array, String, Number, Boolean],
        default: null
    },
    previewSampleData: {
        type: String,
        default: ''
    },
    previewLoader: {
        type: Function,
        default: null
    }
});

const emit = defineEmits(['update:modelValue', 'save']);

const VISUAL_TARGET_OPTIONS_BY_COMPONENT = Object.freeze({
    Heatmap: ['x', 'y', 'z', 'value', 'radius', 'weight', 'name'],
    Label3D: ['id', 'label', 'text', 'name', 'position.x', 'position.y', 'position.z', 'color', 'scale', 'visible'],
    PointTypeMarkerManager: ['id', 'name', 'typeId', 'position.x', 'position.y', 'position.z', 'status', 'visible'],
    TrafficRoadsideDeviceManager: ['id', 'name', 'x', 'y', 'z', 'position.x', 'position.y', 'position.z', 'status', 'type'],
    MigrationLine: ['id', 'name', 'points.0.x', 'points.0.y', 'points.0.z', 'points.1.x', 'points.1.y', 'points.1.z', 'color', 'height'],
    AreaBlock: ['id', 'name', 'points.0.x', 'points.0.y', 'points.0.z', 'points.1.x', 'points.1.y', 'points.1.z', 'points.2.x', 'points.2.y', 'points.2.z', 'color', 'height']
});

const GENERIC_VISUAL_TARGETS = ['id', 'name', 'label', 'value', 'type', 'status', 'x', 'y', 'z', 'position.x', 'position.y', 'position.z'];

const SOURCE_ALIASES_BY_TARGET = Object.freeze({
    id: ['id', 'ID', '_id', 'code', 'deviceId'],
    name: ['name', 'title', 'label', 'text', 'deviceName'],
    label: ['label', 'name', 'title', 'text'],
    text: ['text', 'label', 'name', 'title'],
    value: ['value', 'count', 'num', 'total', 'score'],
    type: ['type', 'category', 'kind'],
    typeId: ['typeId', 'type_id', 'type', 'category'],
    status: ['status', 'state', 'online', 'enabled'],
    x: ['x', 'lng', 'lon', 'longitude'],
    y: ['y', 'lat', 'latitude'],
    z: ['z', 'alt', 'height', 'elevation'],
    'position.x': ['x', 'lng', 'lon', 'longitude', 'position.x'],
    'position.y': ['y', 'lat', 'latitude', 'position.y'],
    'position.z': ['z', 'alt', 'height', 'elevation', 'position.z'],
    'points.0.x': ['startX', 'fromX', 'sourceX', 'x1', 'lng1', 'startLng'],
    'points.0.y': ['startY', 'fromY', 'sourceY', 'y1', 'lat1', 'startLat'],
    'points.0.z': ['startZ', 'fromZ', 'sourceZ', 'z1', 'height1', 'startHeight'],
    'points.1.x': ['endX', 'toX', 'targetX', 'x2', 'lng2', 'endLng'],
    'points.1.y': ['endY', 'toY', 'targetY', 'y2', 'lat2', 'endLat'],
    'points.1.z': ['endZ', 'toZ', 'targetZ', 'z2', 'height2', 'endHeight'],
    color: ['color', 'fill', 'stroke'],
    height: ['height', 'z', 'alt']
});

const filterOperatorOptions = [
    { label: '等于', value: 'equals' },
    { label: '不等于', value: 'notEquals' },
    { label: '包含', value: 'contains' },
    { label: '不包含', value: 'notContains' },
    { label: '大于', value: 'greaterThan' },
    { label: '大于等于', value: 'greaterOrEqual' },
    { label: '小于', value: 'lessThan' },
    { label: '小于等于', value: 'lessOrEqual' },
    { label: '为空', value: 'empty' },
    { label: '不为空', value: 'notEmpty' }
];

const sortDirectionOptions = [
    { label: '不排序', value: 'none' },
    { label: '升序', value: 'asc' },
    { label: '降序', value: 'desc' }
];

const valueTypeOptions = [
    { label: '自动', value: 'auto' },
    { label: '文本', value: 'string' },
    { label: '数字', value: 'number' },
    { label: '开关', value: 'boolean' },
    { label: 'JSON', value: 'json' },
    { label: '三维坐标', value: 'vector3' }
];

const activeTab = ref('visual');
const previewLoading = ref(false);
const previewError = ref('');
const rawData = ref(null);
const sampleText = ref('');
const draftTransformFn = ref('');
const draftConfig = reactive(normalizeVisualTransformConfig({}));

const close = () => {
    emit('update:modelValue', false);
};

const replaceDraftConfig = (config) => {
    const normalized = normalizeVisualTransformConfig(config);
    Object.assign(draftConfig, normalized);
};

const normalizeFieldName = (value = '') => {
    return String(value || '').toLowerCase().replace(/[\s_\-:：]/g, '');
};

const stringifyPreview = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const parseSampleText = () => {
    const text = String(sampleText.value || '').trim();
    if (!text) return { value: undefined, error: '' };
    try {
        return { value: JSON.parse(text), error: '' };
    } catch (error) {
        return { value: undefined, error: `样例 JSON 格式错误：${error.message}` };
    }
};

const isRealtimeMode = computed(() => ['websocket', 'mqtt'].includes(props.source?.mode));
const sampleParse = computed(() => parseSampleText());
const sampleParseError = computed(() => sampleParse.value.error);
const effectiveRawData = computed(() => {
    if (isRealtimeMode.value && sampleText.value.trim() && !sampleParse.value.error) {
        return sampleParse.value.value;
    }
    return rawData.value;
});

const transformPreview = computed(() => createVisualTransformPreview(effectiveRawData.value, draftConfig));
const fieldOptions = computed(() => transformPreview.value.fieldOptions || []);
const sourceRowsInfo = computed(() => transformPreview.value.rowsInfo || getRowsInfo(null));
const transformedRowsInfo = computed(() => transformPreview.value.transformedRowsInfo || getRowsInfo(null));
const transformedPreviewData = computed(() => transformPreview.value.transformedData);
const transformedFieldOptions = computed(() => collectFieldOptions(transformedRowsInfo.value.rows));
const rawFieldOptions = computed(() => collectFieldOptions(sourceRowsInfo.value.rows));

const dataPathSelectOptions = computed(() => {
    const options = buildDataPathOptions(effectiveRawData.value).map((item) => ({
        label: item.label,
        value: item.value
    }));
    const current = selectedRangePath.value;
    if (current && !options.some((item) => item.value === current)) {
        options.unshift({ label: `${current}（当前）`, value: current });
    }
    return options.length ? options : [{ label: '完整返回', value: '' }];
});

const fieldSelectOptions = computed(() => {
    const options = fieldOptions.value.map((item) => ({
        label: `${item.value} · ${item.valueType || item.type}`,
        value: item.value
    }));
    return options.length ? options : [{ label: '暂无字段', value: '' }];
});

const selectedRangePath = computed(() => {
    if (draftConfig.inputPath && draftConfig.arrayPath) return `${draftConfig.inputPath}.${draftConfig.arrayPath}`;
    return draftConfig.inputPath || '';
});

const templateOptions = computed(() => getVisualDataTemplates(props.componentType || ''));
const activeTemplate = computed(() => templateOptions.value.find((item) => item.id === draftConfig.templateId) || null);

const targetFieldOptions = computed(() => {
    if (activeTemplate.value) return getVisualDataTemplateTargetOptions(activeTemplate.value);
    const targets = VISUAL_TARGET_OPTIONS_BY_COMPONENT[props.componentType] || GENERIC_VISUAL_TARGETS;
    return targets.map((target) => ({ label: target, value: target }));
});

const rawPreviewRows = computed(() => sourceRowsInfo.value.rows.slice(0, 20));
const transformedTableRows = computed(() => transformedRowsInfo.value.rows.slice(0, 20));
const rawTableColumns = computed(() => rawFieldOptions.value.slice(0, 8).map((field) => ({ label: field.value, value: field.value })));
const transformedTableColumns = computed(() => transformedFieldOptions.value.slice(0, 8).map((field) => ({ label: field.value, value: field.value })));

const previewStatusText = computed(() => {
    if (previewLoading.value) return '正在获取预览数据';
    if (previewError.value) return '预览失败，请检查请求或使用样例数据';
    if (isRealtimeMode.value && !effectiveRawData.value) return '等待最近消息，或粘贴样例消息';
    return `原始 ${sourceRowsInfo.value.rowCount} 条，整理后 ${transformedRowsInfo.value.rowCount} 条`;
});

const footerSummary = computed(() => {
    const parts = [];
    parts.push(`范围：${selectedRangePath.value || '完整返回'}`);
    if (draftConfig.filters.length) parts.push(`过滤 ${draftConfig.filters.length} 条`);
    if (draftConfig.mappings.length) parts.push(`匹配 ${draftConfig.mappings.length} 项`);
    return parts.join(' / ');
});

const scriptInputData = computed(() => {
    return draftConfig.enabled ? transformedPreviewData.value : effectiveRawData.value;
});

const scriptResult = computed(() => {
    if (!draftTransformFn.value?.trim()) return scriptInputData.value;
    try {
        return applyLegacyDataTransform({
            dataPath: '',
            transformFn: draftTransformFn.value
        }, scriptInputData.value, { returnErrorObject: true });
    } catch (error) {
        return { __transformError: error.message || String(error) };
    }
});

const setEnabled = (enabled) => {
    draftConfig.enabled = enabled === true;
};

const setDataRange = (path) => {
    draftConfig.enabled = true;
    draftConfig.inputPath = String(path || '');
    draftConfig.arrayPath = '';
};

const updateSort = (field, value) => {
    draftConfig.enabled = true;
    draftConfig.sort[field] = field === 'direction' ? String(value || 'none') : String(value || '');
};

const updateLimit = (field, value) => {
    draftConfig.enabled = true;
    draftConfig.limit[field] = field === 'enabled' ? value === true : Math.max(0, Number(value || 0));
};

const operatorNeedsValue = (operator) => !['empty', 'notEmpty'].includes(operator);

const addFilter = () => {
    draftConfig.enabled = true;
    draftConfig.filters.push({
        enabled: true,
        field: fieldOptions.value[0]?.value || '',
        operator: 'equals',
        value: ''
    });
};

const updateFilter = (index, field, value) => {
    const filter = draftConfig.filters[index];
    if (!filter) return;
    draftConfig.enabled = true;
    filter[field] = field === 'enabled' ? value === true : value;
    if (field === 'operator' && !operatorNeedsValue(value)) {
        filter.value = '';
    }
};

const removeFilter = (index) => {
    draftConfig.filters.splice(index, 1);
};

const getFilterValueOptions = (field, currentValue) => {
    if (!field) return [];
    const sourceField = fieldOptions.value.find((item) => item.value === field);
    const options = (sourceField?.sampleValues || []).map((item) => ({
        label: item.label,
        value: item.value
    }));
    if (options.length < 2) return [];
    if (currentValue !== '' && currentValue !== undefined && !options.some((item) => item.value === currentValue)) {
        options.unshift({ label: String(currentValue), value: currentValue });
    }
    return options;
};

const getTargetOptions = (currentValue = '') => {
    const options = [...targetFieldOptions.value];
    if (currentValue && !options.some((item) => item.value === currentValue)) {
        options.unshift({ label: `${currentValue}（当前）`, value: currentValue });
    }
    return options;
};

const getSourceOptions = (currentValue = '') => {
    const options = fieldOptions.value.map((item) => ({
        label: `${item.value} · ${item.valueType || item.type}`,
        value: item.value
    }));
    if (currentValue && !options.some((item) => item.value === currentValue)) {
        options.unshift({ label: `${currentValue}（当前）`, value: currentValue });
    }
    return options;
};

const inferTargetType = (target = '') => {
    const normalized = String(target || '');
    if (/(^|\.)(x|y|z)$/.test(normalized) || ['value', 'height', 'radius', 'weight', 'scale'].includes(normalized)) return 'number';
    if (['visible', 'enabled'].includes(normalized)) return 'boolean';
    if (normalized === 'position') return 'vector3';
    return 'auto';
};

const getFieldValueType = (source = '') => {
    const field = fieldOptions.value.find((item) => item.value === source);
    return field?.valueType || 'auto';
};

const inferMappingType = (target = '', source = '') => {
    const sourceType = getFieldValueType(source);
    if (sourceType && sourceType !== 'auto') return sourceType;
    return inferTargetType(target);
};

const pickSourceFieldForTarget = (target = '') => {
    const templateMapping = activeTemplate.value
        ? getVisualDataTemplateMapping(activeTemplate.value, target)
        : null;
    const aliases = templateMapping?.sourceAliases || SOURCE_ALIASES_BY_TARGET[target] || SOURCE_ALIASES_BY_TARGET[target.split('.').pop()] || [target];
    const normalizedAliases = aliases.map((item) => normalizeFieldName(item));
    const exact = fieldOptions.value.find((item) => normalizedAliases.includes(normalizeFieldName(item.value)));
    if (exact) return exact.value;
    const fuzzy = fieldOptions.value.find((item) => {
        const fieldKey = normalizeFieldName(item.value);
        return normalizedAliases.some((alias) => fieldKey.includes(alias) || alias.includes(fieldKey));
    });
    return fuzzy?.value || '';
};

const addMapping = () => {
    draftConfig.enabled = true;
    const usedTargets = new Set(draftConfig.mappings.map((item) => item.target).filter(Boolean));
    const target = targetFieldOptions.value.find((item) => !usedTargets.has(item.value))?.value || '';
    const source = target ? pickSourceFieldForTarget(target) : '';
    draftConfig.mappings.push({
        target,
        source,
        fallback: '',
        type: inferMappingType(target, source)
    });
};

const updateMapping = (index, field, value) => {
    const mapping = draftConfig.mappings[index];
    if (!mapping) return;
    draftConfig.enabled = true;
    mapping[field] = field === 'type' ? String(value || 'auto') : String(value ?? '');
    if (field === 'target' && !mapping.source) {
        mapping.source = pickSourceFieldForTarget(mapping.target);
    }
    if (field === 'target' || field === 'source') {
        mapping.type = inferMappingType(mapping.target, mapping.source);
    }
};

const removeMapping = (index) => {
    draftConfig.mappings.splice(index, 1);
};

const ensureMappingRows = () => {
    if (draftConfig.mappings.length) return;
    targetFieldOptions.value.slice(0, 12).forEach((targetOption) => {
        const source = pickSourceFieldForTarget(targetOption.value);
        draftConfig.mappings.push({
            target: targetOption.value,
            source,
            fallback: '',
            type: inferMappingType(targetOption.value, source)
        });
    });
};

const autoMatchFields = () => {
    draftConfig.enabled = true;
    ensureMappingRows();
    draftConfig.mappings.forEach((mapping) => {
        if (!mapping.source) {
            mapping.source = pickSourceFieldForTarget(mapping.target);
        }
        mapping.type = inferMappingType(mapping.target, mapping.source);
    });
};

const assignFieldToNextMapping = (field) => {
    draftConfig.enabled = true;
    if (!draftConfig.mappings.length) addMapping();
    const target = draftConfig.mappings.find((item) => !item.source) || draftConfig.mappings[0];
    if (!target) return;
    target.source = field;
    target.type = inferMappingType(target.target, field);
};

const applyTemplate = (template) => {
    if (!template) return;
    const nextConfig = buildVisualTransformConfigFromTemplate(template, {
        currentConfig: draftConfig,
        sourceFields: fieldOptions.value
    });
    replaceDraftConfig(nextConfig);
};

const formatCell = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
        const text = stringifyPreview(value).replace(/\s+/g, ' ');
        return text.length > 80 ? `${text.slice(0, 77)}...` : text;
    }
    return String(value);
};

const useRuntimePayloadAsSample = () => {
    sampleText.value = stringifyPreview(props.runtimePayload);
};

const reloadPreview = async () => {
    previewError.value = '';
    if (!props.previewLoader) return;
    if (isRealtimeMode.value && sampleText.value.trim() && !sampleParse.value.error) {
        rawData.value = sampleParse.value.value;
        return;
    }
    try {
        previewLoading.value = true;
        const result = await props.previewLoader({
            ...props.source,
            previewSampleData: sampleText.value
        });
        if (result?.success) {
            rawData.value = result.data;
            return;
        }
        previewError.value = result?.error || '未获取到预览数据';
    } catch (error) {
        previewError.value = error.message || String(error);
    } finally {
        previewLoading.value = false;
    }
};

const save = () => {
    emit('save', {
        config: normalizeVisualTransformConfig(draftConfig),
        transformFn: draftTransformFn.value,
        previewSampleData: sampleText.value,
        binding: activeTemplate.value?.binding || null
    });
    close();
};

watch(
    () => props.modelValue,
    async (visible) => {
        if (!visible) return;
        activeTab.value = 'visual';
        replaceDraftConfig(props.config);
        draftTransformFn.value = props.transformFn || '';
        sampleText.value = props.previewSampleData || '';
        rawData.value = props.runtimePayload ?? null;
        await reloadPreview();
    }
);
</script>

<style scoped>
.data-transform-config {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.transform-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    padding: 0.25rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    gap: 0.375rem;
}

.transform-tab {
    height: 2rem;
    padding: 0 0.75rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.transform-tab:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
    background: var(--color-bg-hover);
}

.transform-tab.active {
    color: #99f6e4;
    background: rgba(20, 184, 166, 0.1);
    border-color: rgba(45, 212, 191, 0.34);
    font-weight: 700;
}

.visual-layout,
.script-layout {
    display: grid;
    grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
    gap: 0.875rem;
    min-height: 560px;
}

.config-pane,
.preview-pane,
.script-preview {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 62vh;
    overflow: auto;
}

.config-section,
.preview-card,
.script-editor {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.875rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
}

.config-section--sample {
    background: linear-gradient(180deg, rgba(20, 184, 166, 0.08), var(--color-bg-tertiary));
    border-color: rgba(45, 212, 191, 0.22);
}

.section-header,
.preview-card--toolbar,
.preview-card-header,
.modal-footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.section-title,
.preview-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text-primary);
}

.section-desc,
.section-hint,
.preview-subtitle,
.preview-card-header small,
.footer-text {
    font-size: 0.6875rem;
    line-height: 1.45;
    color: var(--color-text-secondary);
}

.section-error,
.preview-card--error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.24);
}

.switch-label {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
}

.switch-label--inline {
    justify-content: center;
    min-height: 32px;
}

.sample-textarea,
.script-textarea,
.json-preview {
    width: 100%;
    min-height: 110px;
    padding: 0.625rem;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    resize: vertical;
    white-space: pre-wrap;
}

.script-textarea {
    min-height: 420px;
}

.template-list,
.field-chip-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
}

.template-card,
.field-chip {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.625rem;
    text-align: left;
    color: var(--color-text-secondary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.template-card.active,
.template-card:hover,
.field-chip:hover {
    color: var(--color-text-primary);
    border-color: rgba(45, 212, 191, 0.5);
    background: rgba(20, 184, 166, 0.12);
}

.template-card span,
.field-chip span {
    overflow: hidden;
    font-size: 0.75rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.template-card small,
.field-chip small {
    color: var(--color-text-tertiary);
    font-size: 0.625rem;
}

.template-card.active small,
.template-card:hover small,
.field-chip:hover small {
    color: #99f6e4;
}

.filter-row,
.mapping-row,
.sort-row {
    display: grid;
    gap: 0.5rem;
    align-items: center;
}

.filter-row {
    grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr) 28px;
}

.mapping-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 110px minmax(0, 0.8fr) 28px;
}

.sort-row {
    grid-template-columns: minmax(0, 1fr) 100px 72px 100px;
}

.section-actions,
.footer-actions,
.footer-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.icon-remove {
    width: 28px;
    height: 28px;
    color: var(--color-text-secondary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.icon-remove:hover {
    color: white;
    background: rgba(239, 68, 68, 0.75);
    border-color: rgba(239, 68, 68, 0.9);
}

.empty-row,
.value-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0.5rem;
    color: var(--color-text-tertiary);
    background: var(--color-bg-primary);
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
}

.preview-table-wrap {
    max-height: 260px;
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-primary);
}

.preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.6875rem;
}

.preview-table th,
.preview-table td {
    max-width: 160px;
    padding: 0.45rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.preview-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
}

.footer-tag {
    padding: 0.1875rem 0.625rem;
    color: #99f6e4;
    background: rgba(20, 184, 166, 0.12);
    border: 1px solid rgba(45, 212, 191, 0.28);
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 700;
    white-space: nowrap;
}

@media (max-width: 900px) {
    .visual-layout,
    .script-layout {
        grid-template-columns: 1fr;
    }

    .filter-row,
    .mapping-row,
    .sort-row,
    .template-list,
    .field-chip-list {
        grid-template-columns: 1fr;
    }

    .section-header,
    .preview-card--toolbar,
    .modal-footer-content {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
