<template>
    <section class="fit-card">
        <div class="fit-card__header">
            <div>
                <div class="fit-card__title">经纬度与三维坐标拟合</div>
                <div class="fit-card__desc">
                    使用多控制点最小二乘拟合，将模型坐标与真实经纬度坐标关联。`geo` 模式下设备会自动在 `lng/lat/alt` 与 `xyz` 之间双向换算。
                </div>
            </div>
            <div class="fit-card__actions">
                <Button size="sm" variant="outline" @click="formatControlPointsJson">格式化</Button>
                <Button size="sm" variant="outline" :disabled="!validControlPointCount" @click="useFirstControlPointAsOrigin">
                    首点设原点
                </Button>
                <Button size="sm" @click="applyControlPointsJson">应用控制点</Button>
            </div>
        </div>

        <div class="fit-card__grid">
            <div>
                <label class="label">坐标模式</label>
                <Select
                    :model-value="coordinateSystem.mode"
                    :options="coordinateModeOptions"
                    @update:model-value="updateCoordinateMode"
                />
            </div>
            <div>
                <label class="label">拟合方式</label>
                <Select
                    :model-value="coordinateSystem.fitting.method"
                    :options="fitMethodOptions"
                    @update:model-value="updateFitMethod"
                />
            </div>
            <div>
                <label class="label">状态</label>
                <div class="fit-status" :class="{ 'is-valid': fitResult.valid }">
                    {{ fitStatusText }}
                </div>
            </div>
        </div>

        <div>
            <label class="label">ENU 原点 (lng / lat / alt)</label>
            <div class="grid grid-cols-3 gap-2">
                <Input
                    type="number"
                    :model-value="originDraft[0]"
                    placeholder="lng"
                    @update:model-value="(v) => (originDraft[0] = v)"
                    @blur="() => commitOrigin(0)"
                    @keydown="(e) => onDraftKeydown(e, () => commitOrigin(0))"
                />
                <Input
                    type="number"
                    :model-value="originDraft[1]"
                    placeholder="lat"
                    @update:model-value="(v) => (originDraft[1] = v)"
                    @blur="() => commitOrigin(1)"
                    @keydown="(e) => onDraftKeydown(e, () => commitOrigin(1))"
                />
                <Input
                    type="number"
                    :model-value="originDraft[2]"
                    placeholder="alt"
                    @update:model-value="(v) => (originDraft[2] = v)"
                    @blur="() => commitOrigin(2)"
                    @keydown="(e) => onDraftKeydown(e, () => commitOrigin(2))"
                />
            </div>
        </div>

        <div>
            <div class="control-point-header">
                <label class="label">控制点</label>
                <Button size="sm" variant="outline" @click="addControlPoint">新增控制点</Button>
            </div>
            <div class="control-point-table">
                <div class="control-point-row control-point-row--head">
                    <span>名称</span>
                    <span>模型 X/Y/Z</span>
                    <span>经度/纬度/高度</span>
                    <span>操作</span>
                </div>
                <div v-for="(point, index) in controlPoints" :key="point.id || index" class="control-point-row">
                    <Input
                        :model-value="point.name || `CP${index + 1}`"
                        @blur="updateControlPointField(index, 'name', $event.target.value)"
                    />
                    <div class="fit-inline-grid">
                        <Input v-for="axis in 3" :key="`model-${index}-${axis}`" type="number" :model-value="point.model?.[axis - 1] ?? 0" @blur="updateControlPointArray(index, 'model', axis - 1, $event.target.value)" />
                    </div>
                    <div class="fit-inline-grid">
                        <Input v-for="axis in 3" :key="`geo-${index}-${axis}`" type="number" :model-value="point.geo?.[axis - 1] ?? 0" @blur="updateControlPointArray(index, 'geo', axis - 1, $event.target.value)" />
                    </div>
                    <Button size="sm" variant="ghost" @click="removeControlPoint(index)">删除</Button>
                </div>
                <div v-if="controlPoints.length === 0" class="fit-help">暂无控制点，请新增控制点或使用高级 JSON 批量导入。</div>
            </div>
            <details class="fit-advanced">
                <summary>高级配置：控制点 JSON</summary>
                <textarea
                    v-model="controlPointsJsonDraft"
                    class="fit-textarea"
                    placeholder='[
  { "name": "CP1", "model": [0, 0, 0], "geo": [121.4737, 31.2304, 8.2] },
  { "name": "CP2", "model": [128.4, 0, 52.8], "geo": [121.4741, 31.2308, 8.4] }
]'
                    @keydown="onControlPointsJsonKeydown"
                />
                <div class="action-row">
                    <Button size="sm" variant="outline" @click="formatControlPointsJson">格式化</Button>
                    <Button size="sm" @click="applyControlPointsJson">应用 JSON</Button>
                </div>
            </details>
            <div class="fit-help">
                支持 `model: [x,y,z]` 与 `geo: [lng,lat,alt]`。2D 四参数至少 2 点，3D 七参数至少 3 点，仿射至少 4 点。
            </div>
            <div v-if="controlPointsJsonError" class="fit-error">
                {{ controlPointsJsonError }}
            </div>
        </div>

        <div class="fit-metrics" :class="{ 'is-valid': fitResult.valid }">
            <div>{{ fitMetricsText }}</div>
            <div>
                有效控制点 {{ validControlPointCount }} 个
                <span v-if="fitResult.valid">，RMS {{ formatMetric(fitResult.rms) }} m，最大残差 {{ formatMetric(fitResult.maxResidual) }} m</span>
            </div>
        </div>
    </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
    GEO_FIT_METHODS,
    createTrafficGeoCoordinateTransformer,
    getGeoFitMethodLabel,
    normalizeTrafficCoordinateSystemConfig
} from '@w3d/components';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Button from '../ui/Button.vue';
import { useComponent } from '../../composables/useComponent';
import { useComponentStore } from '../../stores/useComponentStore';
import { useToast } from '../../composables/useToast';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

const originDraft = ref(['0', '0', '0']);
const controlPointsJsonDraft = ref('[]');
const controlPointsJsonError = ref('');

const component = computed(() => componentStore.components.find((item) => item.id === props.componentId) || null);
const coordinateSystem = computed(() => normalizeTrafficCoordinateSystemConfig(component.value?.config?.coordinateSystem || {}));
const controlPoints = computed(() => coordinateSystem.value.fitting.controlPoints || []);
const fitResult = computed(() => createTrafficGeoCoordinateTransformer(coordinateSystem.value).fitResult);
const validControlPointCount = computed(() => coordinateSystem.value.fitting.controlPoints.filter((item) => item.valid).length);
const fitStatusText = computed(() => fitResult.value.valid ? `${getGeoFitMethodLabel(fitResult.value.method)} 已生效` : (fitResult.value.message || '未启用拟合'));
const fitMetricsText = computed(() => fitResult.value.valid ? `${getGeoFitMethodLabel(fitResult.value.method)} 已完成` : (fitResult.value.message || '当前按 ENU 原点近似换算'));

const coordinateModeOptions = [
    { label: '三维坐标 (XYZ)', value: 'xyz' },
    { label: '经纬度 (Geo)', value: 'geo' }
];

const fitMethodOptions = [
    { label: '不拟合，仅 ENU 原点', value: GEO_FIT_METHODS.NONE },
    { label: '2D 四参数', value: GEO_FIT_METHODS.SIMILARITY_2D },
    { label: '3D 七参数', value: GEO_FIT_METHODS.SIMILARITY_3D },
    { label: '仿射', value: GEO_FIT_METHODS.AFFINE }
];

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const roundTo = (value, digits = 4) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
};

const round4 = (value) => roundTo(value, 4);
const roundGeo = (value) => roundTo(value, 8);

const formatGeo = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return String(roundGeo(n));
};

const format4 = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return round4(n).toFixed(4);
};

const formatMetric = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return round4(n).toFixed(4);
};

const deepMerge = (target, source) => {
    const base = target && typeof target === 'object' ? target : {};
    const patch = source && typeof source === 'object' ? source : {};
    const result = { ...base };
    Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = deepMerge(base[key] || {}, value);
        } else {
            result[key] = value;
        }
    });
    return result;
};

const serializeControlPoints = (items) => JSON.stringify(
    (Array.isArray(items) ? items : []).map((item) => ({
        id: item.id,
        name: item.name,
        model: item.model,
        geo: item.geo
    })),
    null,
    2
);

const syncDrafts = (nextCoordinateSystem) => {
    originDraft.value = [
        formatGeo(nextCoordinateSystem.originLngLatAlt[0]),
        formatGeo(nextCoordinateSystem.originLngLatAlt[1]),
        format4(nextCoordinateSystem.originLngLatAlt[2])
    ];
    controlPointsJsonDraft.value = serializeControlPoints(nextCoordinateSystem.fitting.controlPoints || []);
    controlPointsJsonError.value = '';
};

const commitCoordinateSystem = async (patch) => {
    const next = deepMerge(coordinateSystem.value, patch || {});
    await updateComponentConfig(props.componentId, {
        coordinateSystem: next
    });
};

const onDraftKeydown = (event, commitFn) => {
    if (event?.key !== 'Enter') return;
    event.preventDefault();
    commitFn?.();
    event.target?.blur?.();
};

const onControlPointsJsonKeydown = (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
    event.preventDefault();
    applyControlPointsJson();
};

const updateCoordinateMode = async (mode) => {
    await commitCoordinateSystem({ mode });
};

const updateFitMethod = async (method) => {
    await commitCoordinateSystem({
        fitting: {
            ...coordinateSystem.value.fitting,
            method
        }
    });
};

const commitOrigin = async (index) => {
    const origin = [...coordinateSystem.value.originLngLatAlt];
    origin[index] = index < 2
        ? roundGeo(toNumber(originDraft.value[index], origin[index]))
        : round4(toNumber(originDraft.value[index], origin[index]));
    await commitCoordinateSystem({ originLngLatAlt: origin });
};

const parseControlPointsJson = () => {
    const rawText = String(controlPointsJsonDraft.value || '').trim();
    if (!rawText) return [];
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.controlPoints)) {
        return parsed.controlPoints;
    }
    throw new Error('控制点 JSON 必须是数组，或包含 controlPoints 数组字段');
};

const applyControlPointsJson = async () => {
    try {
        const controlPoints = parseControlPointsJson();
        controlPointsJsonError.value = '';
        await commitCoordinateSystem({
            fitting: {
                ...coordinateSystem.value.fitting,
                controlPoints
            }
        });
        toast.success('控制点已更新');
    } catch (error) {
        controlPointsJsonError.value = error.message || String(error);
    }
};

const formatControlPointsJson = () => {
    try {
        controlPointsJsonDraft.value = serializeControlPoints(parseControlPointsJson());
        controlPointsJsonError.value = '';
    } catch (error) {
        controlPointsJsonError.value = error.message || String(error);
    }
};

const useFirstControlPointAsOrigin = async () => {
    const first = coordinateSystem.value.fitting.controlPoints.find((item) => item.valid);
    if (!first?.geo) return;
    await commitCoordinateSystem({ originLngLatAlt: first.geo });
    toast.success('已使用首个控制点作为原点');
};

const normalizeControlPoint = (point = {}, index = 0) => ({
    id: point.id || `cp_${Date.now()}_${index}`,
    name: point.name || `CP${index + 1}`,
    model: Array.isArray(point.model) ? point.model.map((item) => toNumber(item, 0)) : [0, 0, 0],
    geo: Array.isArray(point.geo) ? point.geo.map((item) => toNumber(item, 0)) : [0, 0, 0]
});

const commitControlPoints = async (items) => {
    await commitCoordinateSystem({
        fitting: {
            ...coordinateSystem.value.fitting,
            controlPoints: items.map((item, index) => normalizeControlPoint(item, index))
        }
    });
};

const addControlPoint = async () => {
    await commitControlPoints([
        ...controlPoints.value,
        normalizeControlPoint({}, controlPoints.value.length)
    ]);
};

const removeControlPoint = async (index) => {
    await commitControlPoints(controlPoints.value.filter((_, itemIndex) => itemIndex !== index));
};

const updateControlPointField = async (index, key, value) => {
    const next = controlPoints.value.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item);
    await commitControlPoints(next);
};

const updateControlPointArray = async (index, key, axis, value) => {
    const next = controlPoints.value.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const current = Array.isArray(item[key]) ? [...item[key]] : [0, 0, 0];
        current[axis] = key === 'geo' && axis < 2 ? roundGeo(toNumber(value, current[axis])) : round4(toNumber(value, current[axis]));
        return { ...item, [key]: current };
    });
    await commitControlPoints(next);
};

watch(
    () => coordinateSystem.value,
    (value) => {
        syncDrafts(value);
    },
    { immediate: true, deep: true }
);
</script>

<style scoped>
.label {
    display: block;
    font-size: 12px;
    color: rgba(145, 156, 194, 0.72);
    margin-bottom: 4px;
}

.fit-card {
    border: 1px solid rgba(119, 139, 255, 0.18);
    border-radius: 14px;
    padding: 16px;
    background: linear-gradient(180deg, rgba(34, 39, 68, 0.88), rgba(21, 25, 44, 0.96));
    box-shadow: 0 18px 40px rgba(6, 10, 24, 0.24);
}

.fit-card__header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.fit-card__title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(240, 244, 255, 0.96);
}

.fit-card__desc,
.fit-help,
.fit-error {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(189, 199, 235, 0.76);
    line-height: 1.6;
}

.fit-card__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: flex-start;
}

.fit-card__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
}

.fit-status,
.fit-metrics {
    min-height: 38px;
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.6;
    border: 1px solid rgba(119, 139, 255, 0.18);
    background: rgba(15, 19, 33, 0.58);
    color: rgba(189, 199, 235, 0.82);
}

.fit-status.is-valid,
.fit-metrics.is-valid {
    border-color: rgba(94, 234, 212, 0.22);
    background: linear-gradient(180deg, rgba(10, 56, 62, 0.82), rgba(10, 38, 46, 0.9));
    color: rgba(187, 247, 236, 0.96);
}

.fit-textarea {
    width: 100%;
    min-height: 180px;
    border-radius: 10px;
    border: 1px solid rgba(119, 139, 255, 0.18);
    padding: 10px 12px;
    resize: vertical;
    outline: none;
    font-size: 12px;
    line-height: 1.7;
    font-family: Consolas, 'Courier New', monospace;
    color: rgba(240, 244, 255, 0.96);
    background: rgba(12, 16, 28, 0.8);
}

.fit-textarea:focus {
    border-color: rgba(124, 140, 255, 0.42);
    box-shadow: 0 0 0 3px rgba(124, 140, 255, 0.12);
}

.control-point-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
}

.control-point-table {
    display: grid;
    gap: 6px;
}

.control-point-row {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr) minmax(0, 1.4fr) auto;
    gap: 6px;
    align-items: center;
}

.control-point-row--head {
    font-size: 12px;
    color: rgba(189, 199, 235, 0.76);
}

.fit-inline-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
}

.fit-advanced {
    margin-top: 10px;
    border: 1px solid rgba(119, 139, 255, 0.18);
    border-radius: 10px;
    padding: 10px;
    background: rgba(12, 16, 28, 0.5);
}

.fit-advanced summary {
    cursor: pointer;
    font-size: 12px;
    color: rgba(240, 244, 255, 0.9);
}

.fit-advanced .fit-textarea {
    margin-top: 8px;
}

.action-row {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
}

@media (max-width: 960px) {
    .fit-card__header {
        flex-direction: column;
    }

    .fit-card__grid,
    .control-point-row {
        grid-template-columns: 1fr;
    }
}
</style>
