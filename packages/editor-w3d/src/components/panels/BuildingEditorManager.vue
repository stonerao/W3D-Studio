<template>
    <div class="building-editor-manager">
        <div class="summary-row">
            <span class="text-sm">点位总数：{{ localPoints.length }}</span>
            <span class="text-xs text-gray-500">已选择：{{ selectedCount }}</span>
        </div>

        <div class="actions-row">
            <Button size="sm" @click="addPoint">添加点位</Button>
            <Button size="sm" variant="outline" @click="startPickAdd">拾取添加</Button>
            <Button size="sm" variant="outline" @click="stopPick">退出拾取</Button>
            <Button size="sm" variant="danger" :disabled="selectedCount === 0" @click="removeSelectedPoints">批量删除</Button>
            <Button v-if="minimized" size="sm" variant="outline" @click="restoreModal">恢复面板</Button>
        </div>

        <div v-if="minimized" class="minimized-hint">
            已最小化，正在拾取模式中。请点击场景模型表面完成拾取。
        </div>

        <div v-else-if="localPoints.length === 0" class="empty-hint">
            暂无点位，点击“添加点位”或“拾取添加”开始。
        </div>

        <div v-else class="points-list">
            <div v-for="(point, index) in localPoints" :key="point.id" class="point-row">
                <label class="select-checkbox" :title="point.id">
                    <input
                        type="checkbox"
                        :checked="selectedPointIds.includes(point.id)"
                        @change="togglePointSelection(point.id, $event.target.checked)"
                    />
                    <span>{{ index + 1 }}</span>
                </label>

                <Input
                    class="name-input"
                    :model-value="point.name"
                    placeholder="点位名称"
                    @update:model-value="updatePointName(point.id, $event)"
                />

                <Input
                    class="coord-input"
                    type="number"
                    :model-value="point.position[0]"
                    @update:model-value="updatePointCoord(point.id, 0, $event)"
                />

                <Input
                    class="coord-input"
                    type="number"
                    :model-value="point.position[1]"
                    @update:model-value="updatePointCoord(point.id, 1, $event)"
                />

                <Input
                    class="coord-input"
                    type="number"
                    :model-value="point.position[2]"
                    @update:model-value="updatePointCoord(point.id, 2, $event)"
                />

                <Button size="sm" variant="outline" @click="startRepick(point.id)">重拾取</Button>
                <Button size="sm" variant="outline" @click="openGeoConvert(point.id)">坐标转换</Button>
                <Button size="sm" variant="danger" @click="removePoint(point.id)">删除</Button>
            </div>
        </div>

        <Modal
            v-model="showConvertModal"
            title="坐标转换"
            width="520px"
            @close="handleConvertClose"
        >
            <div class="convert-modal">
                <div class="text-sm text-gray-600">
                    目标点位：{{ convertTargetName }}
                </div>

                <div class="convert-grid">
                    <div>
                        <label class="field-label">经度 lng</label>
                        <Input
                            type="number"
                            :model-value="convertLngDraft"
                            @update:model-value="(value) => (convertLngDraft = value)"
                        />
                    </div>
                    <div>
                        <label class="field-label">纬度 lat</label>
                        <Input
                            type="number"
                            :model-value="convertLatDraft"
                            @update:model-value="(value) => (convertLatDraft = value)"
                        />
                    </div>
                    <div>
                        <label class="field-label">高程 alt</label>
                        <Input
                            type="number"
                            :model-value="convertAltDraft"
                            @update:model-value="(value) => (convertAltDraft = value)"
                        />
                    </div>
                </div>

                <div class="convert-status" :class="{ warn: !canConvertGeo }">
                    {{ convertStatusText }}
                </div>

                <div class="convert-grid">
                    <div>
                        <label class="field-label">场景 X</label>
                        <Input :model-value="previewPosition[0]" disabled />
                    </div>
                    <div>
                        <label class="field-label">场景 Y</label>
                        <Input :model-value="previewPosition[1]" disabled />
                    </div>
                    <div>
                        <label class="field-label">场景 Z</label>
                        <Input :model-value="previewPosition[2]" disabled />
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="handleConvertClose">取消</Button>
                <Button variant="primary" :disabled="!canConvertGeo" @click="confirmGeoConvert">应用</Button>
            </template>
        </Modal>

        <Modal
            v-model="showPickConfirm"
            title="确认拾取点位"
            width="420px"
            @close="handlePickConfirmClose"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">{{ pickConfirmDescription }}</div>
                <div class="pick-xyz-display">
                    <Input :model-value="format4(pickConfirmXyz[0])" disabled />
                    <Input :model-value="format4(pickConfirmXyz[1])" disabled />
                    <Input :model-value="format4(pickConfirmXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmPickConfirm">确认</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
    createTrafficGeoCoordinateTransformer,
    normalizeTrafficCoordinateSystemConfig
} from '@w3d/components';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Modal from '../ui/Modal.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useToast } from '../../composables/useToast';

defineProps({
    minimized: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['toggle-minimize']);

const BUILDING_MANAGER_ID = '__building_manager__';
const REQUIRED_CONTROL_POINT_COUNT = 4;

const componentStore = useComponentStore();
const projectStore = useProjectStore();
const toast = useToast();

const selectedPointIds = ref([]);
const localPoints = ref([]);
let commitTimer = null;

const showConvertModal = ref(false);
const convertPointId = ref('');
const convertLngDraft = ref('');
const convertLatDraft = ref('');
const convertAltDraft = ref('0');

const coordinateSystem = computed(() => normalizeTrafficCoordinateSystemConfig(projectStore.buildingPointCoordinateSystem || {}));
const geoTransformer = computed(() => createTrafficGeoCoordinateTransformer(coordinateSystem.value));

const points = computed(() => {
    const raw = projectStore.buildingPoints || [];
    return Array.isArray(raw) ? raw.map((point, index) => normalizePoint(point, index)) : [];
});

const selectedCount = computed(() => selectedPointIds.value.length);
const convertTargetPoint = computed(() => localPoints.value.find((point) => point.id === convertPointId.value) || null);
const convertTargetName = computed(() => convertTargetPoint.value?.name || '未选择点位');
const validControlPointCount = computed(() => coordinateSystem.value.fitting.controlPoints.filter((item) => item.valid).length);
const hasValidTransform = computed(() => {
    return coordinateSystem.value.mode === 'geo'
        && validControlPointCount.value >= REQUIRED_CONTROL_POINT_COUNT
        && geoTransformer.value.fitResult.valid;
});

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toNullableNumber = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
};

const roundTo = (value, digits = 4) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
};

const round4 = (value) => roundTo(value, 4);
const roundGeo = (value) => roundTo(value, 8);

const format4 = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? round4(n).toFixed(4) : value;
};

const ensureVec3 = (position, fallback = [0, 0, 0]) => {
    if (Array.isArray(position)) {
        return [toNumber(position[0], fallback[0]), toNumber(position[1], fallback[1]), toNumber(position[2], fallback[2])];
    }

    if (position && typeof position === 'object') {
        return [toNumber(position.x, fallback[0]), toNumber(position.y, fallback[1]), toNumber(position.z, fallback[2])];
    }

    return [...fallback];
};

const normalizePoint = (point, index) => {
    const position = ensureVec3(point?.position, [0, 0, 0]);
    const id = point?.id || `point_${Date.now()}_${index}`;
    return {
        id,
        name: String(point?.name || '').trim() || `点位${index + 1}`,
        position,
        lngLat: Array.isArray(point?.lngLat) && point.lngLat.length >= 2
            ? [toNumber(point.lngLat[0], 0), toNumber(point.lngLat[1], 0)]
            : null,
        alt: round4(toNumber(point?.alt, 0))
    };
};

const scheduleCommit = () => {
    clearTimeout(commitTimer);
    commitTimer = setTimeout(async () => {
        commitTimer = null;
        await commitPoints(localPoints.value);
    }, 300);
};

const commitPoints = async (nextPoints) => {
    const normalized = nextPoints.map((point, index) => {
        const next = normalizePoint(point, index);
        return {
            id: next.id,
            name: next.name,
            position: [...next.position],
            lngLat: next.lngLat ? [roundGeo(next.lngLat[0]), roundGeo(next.lngLat[1])] : null,
            alt: round4(next.alt)
        };
    });

    projectStore.setBuildingPointsState({
        points: normalized,
        markUnsaved: true
    });
};

const getNextPointName = () => {
    let maxIndex = 0;
    localPoints.value.forEach((point) => {
        const match = String(point?.name || '').match(/^点位(\d+)$/);
        if (!match) return;
        const n = Number(match[1]);
        if (Number.isFinite(n)) {
            maxIndex = Math.max(maxIndex, n);
        }
    });
    return `点位${maxIndex + 1}`;
};

const createPointId = () => `point_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const addPoint = async () => {
    clearTimeout(commitTimer);
    commitTimer = null;
    localPoints.value = [
        ...localPoints.value,
        normalizePoint({ id: createPointId(), name: getNextPointName(), position: [0, 0, 0], lngLat: null, alt: 0 }, localPoints.value.length)
    ];
    await commitPoints(localPoints.value);
    toast.success('已添加点位');
};

const updatePointName = (pointId, name) => {
    localPoints.value = localPoints.value.map((point) => {
        if (point.id !== pointId) return point;
        return { ...point, name: String(name || '').trim() || point.name };
    });
    scheduleCommit();
};

const updatePointCoord = (pointId, axisIndex, value) => {
    localPoints.value = localPoints.value.map((point) => {
        if (point.id !== pointId) return point;
        const position = [...point.position];
        position[axisIndex] = round4(toNumber(value, position[axisIndex]));
        return { ...point, position };
    });
    scheduleCommit();
};

const removePoint = async (pointId) => {
    clearTimeout(commitTimer);
    commitTimer = null;
    localPoints.value = localPoints.value.filter((point) => point.id !== pointId);
    selectedPointIds.value = selectedPointIds.value.filter((id) => id !== pointId);
    await commitPoints(localPoints.value);
    toast.success('已删除点位');
};

const togglePointSelection = (pointId, checked) => {
    if (checked) {
        if (!selectedPointIds.value.includes(pointId)) {
            selectedPointIds.value = [...selectedPointIds.value, pointId];
        }
        return;
    }
    selectedPointIds.value = selectedPointIds.value.filter((id) => id !== pointId);
};

const removeSelectedPoints = async () => {
    if (selectedPointIds.value.length === 0) return;
    clearTimeout(commitTimer);
    commitTimer = null;
    const selectedSet = new Set(selectedPointIds.value);
    localPoints.value = localPoints.value.filter((point) => !selectedSet.has(point.id));
    const removedCount = selectedPointIds.value.length;
    selectedPointIds.value = [];
    await commitPoints(localPoints.value);
    toast.success(`已删除 ${removedCount} 个点位`);
};

const restoreModal = () => {
    emit('toggle-minimize', false);
};

const startPickAdd = () => {
    componentStore.startBuildingPicking(BUILDING_MANAGER_ID, null);
    emit('toggle-minimize', true);
    toast.info('请点击场景中的模型表面拾取点位');
};

const startRepick = (pointId) => {
    if (!pointId) return;
    componentStore.startBuildingPicking(BUILDING_MANAGER_ID, pointId);
    emit('toggle-minimize', true);
    toast.info('请点击场景中的模型表面，更新该点位坐标');
};

const stopPick = () => {
    componentStore.stopBuildingPicking();
    emit('toggle-minimize', false);
};

const openGeoConvert = (pointId) => {
    const point = localPoints.value.find((item) => item.id === pointId);
    if (!point) return;
    convertPointId.value = pointId;
    convertLngDraft.value = point.lngLat?.[0] ?? '';
    convertLatDraft.value = point.lngLat?.[1] ?? '';
    convertAltDraft.value = String(point.alt ?? 0);
    showConvertModal.value = true;
};

const handleConvertClose = () => {
    showConvertModal.value = false;
    convertPointId.value = '';
};

const convertLng = computed(() => toNullableNumber(convertLngDraft.value));
const convertLat = computed(() => toNullableNumber(convertLatDraft.value));
const convertAlt = computed(() => round4(toNumber(convertAltDraft.value, 0)));
const canConvertGeo = computed(() => {
    return hasValidTransform.value
        && convertLng.value !== null
        && convertLat.value !== null;
});

const previewPosition = computed(() => {
    if (!canConvertGeo.value) return ['--', '--', '--'];
    const position = geoTransformer.value.geoToModel([convertLng.value, convertLat.value, convertAlt.value]);
    return position.map((item) => format4(item));
});

const convertStatusText = computed(() => {
    if (coordinateSystem.value.mode !== 'geo') {
        return '请先到右侧“设置 -> 点位坐标转换”中应用转换参数。';
    }
    if (validControlPointCount.value < REQUIRED_CONTROL_POINT_COUNT) {
        return `参考对照表至少需要 ${REQUIRED_CONTROL_POINT_COUNT} 个有效点。`;
    }
    if (!geoTransformer.value.fitResult.valid) {
        return geoTransformer.value.fitResult.message || '当前参考点无法解算转换参数。';
    }
    if (!canConvertGeo.value) {
        return '请输入完整的经纬度。';
    }
    return `${geoTransformer.value.fitResult.label} 已生效，当前结果为实时预览。`;
});

const confirmGeoConvert = async () => {
    if (!canConvertGeo.value || !convertPointId.value) return;
    const position = geoTransformer.value.geoToModel([convertLng.value, convertLat.value, convertAlt.value]).map((item) => round4(item));
    localPoints.value = localPoints.value.map((point) => {
        if (point.id !== convertPointId.value) return point;
        return {
            ...point,
            position,
            lngLat: [roundGeo(convertLng.value), roundGeo(convertLat.value)],
            alt: convertAlt.value
        };
    });
    await commitPoints(localPoints.value);
    showConvertModal.value = false;
    toast.success('坐标转换已应用到点位');
};

const showPickConfirm = computed({
    get: () => {
        const pending = componentStore.buildingPickConfirm;
        return !!pending?.visible && pending?.componentId === BUILDING_MANAGER_ID;
    },
    set: (visible) => {
        if (!visible) componentStore.clearBuildingPickConfirm();
    }
});

const pickConfirmXyz = computed(() => {
    const pending = componentStore.buildingPickConfirm;
    const xyz = pending?.componentId === BUILDING_MANAGER_ID ? pending?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const pickConfirmDescription = computed(() => {
    const pending = componentStore.buildingPickConfirm;
    if (!pending?.visible || pending?.componentId !== BUILDING_MANAGER_ID) {
        return '已拾取到坐标。';
    }
    if (pending.pointId) {
        const target = localPoints.value.find((point) => point.id === pending.pointId);
        return `已拾取到坐标，确认更新点位“${target?.name || pending.pointId}”？`;
    }
    return '已拾取到坐标，确认添加到点位列表？';
});

const confirmPickConfirm = async () => {
    const pending = componentStore.buildingPickConfirm;
    if (!pending?.visible) return;
    if (pending.componentId !== BUILDING_MANAGER_ID) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    clearTimeout(commitTimer);
    commitTimer = null;

    const nextPosition = ensureVec3(pending.xyz, [0, 0, 0]).map((item) => round4(item));
    if (pending.pointId) {
        localPoints.value = localPoints.value.map((point) => (
            point.id === pending.pointId
                ? { ...point, position: nextPosition }
                : point
        ));
        toast.success('点位坐标已更新');
    } else {
        localPoints.value = [
            ...localPoints.value,
            normalizePoint({ id: createPointId(), name: getNextPointName(), position: nextPosition }, localPoints.value.length)
        ];
        toast.success('拾取点位已添加');
    }

    await commitPoints(localPoints.value);
    componentStore.clearBuildingPickConfirm();
    emit('toggle-minimize', false);
};

const cancelPickConfirm = () => {
    const pending = componentStore.buildingPickConfirm;
    if (!pending?.visible) {
        componentStore.clearBuildingPickConfirm();
        return;
    }
    componentStore.clearBuildingPickConfirm();
    componentStore.startBuildingPicking(BUILDING_MANAGER_ID, pending.pointId || null);
    emit('toggle-minimize', true);
};

const handlePickConfirmClose = () => {
    cancelPickConfirm();
};

watch(
    () => points.value,
    (value) => {
        if (commitTimer !== null) return;
        localPoints.value = value.map((point, index) => normalizePoint(point, index));
    },
    { immediate: true, deep: true }
);

watch(showPickConfirm, (visible) => {
    if (visible) {
        emit('toggle-minimize', false);
    }
});

watch(
    () => componentStore.buildingPicking?.active,
    (active, previous) => {
        if (previous && !active && !showPickConfirm.value) {
            emit('toggle-minimize', false);
        }
    }
);

watch(
    () => localPoints.value.length,
    () => {
        const validIds = new Set(localPoints.value.map((point) => point.id));
        selectedPointIds.value = selectedPointIds.value.filter((id) => validIds.has(id));
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    clearTimeout(commitTimer);
    commitTimer = null;
});
</script>

<style scoped>
.building-editor-manager {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.minimized-hint {
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 12px;
}

.empty-hint {
    padding: 12px;
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-tertiary);
    font-size: 12px;
}

.points-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 460px;
    overflow-y: auto;
}

.point-row {
    display: grid;
    grid-template-columns: 72px minmax(140px, 1.6fr) repeat(3, minmax(90px, 1fr)) auto auto auto;
    gap: 8px;
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: 8px;
    background-color: var(--color-bg-tertiary);
}

.select-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.convert-modal,
.pick-confirm-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.convert-grid,
.pick-xyz-display {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

.field-label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary);
}

.convert-status {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.22);
    background: rgba(236, 253, 245, 0.75);
    color: #065f46;
    font-size: 12px;
    line-height: 1.6;
}

.convert-status.warn {
    border-color: rgba(245, 158, 11, 0.28);
    background: rgba(255, 251, 235, 0.85);
    color: #92400e;
}

@media (max-width: 1300px) {
    .point-row {
        grid-template-columns: 72px minmax(140px, 1.2fr) repeat(3, minmax(80px, 1fr));
    }
}
</style>
