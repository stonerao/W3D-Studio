<template>
    <div class="building-point-settings">
        <div class="summary-card" :class="{ valid: canReprojectSavedPoints }">
            <div class="summary-card__content">
                <div class="summary-card__title">点位坐标转换</div>
                <div class="summary-card__meta">
                    <span>拟合方式：{{ savedMethodLabel }}</span>
                    <span>有效参考点：{{ savedValidControlPointCount }}</span>
                </div>
                <div class="summary-card__status">{{ savedStatusText }}</div>
                <div v-if="savedTransformer.fitResult.valid" class="summary-card__metrics">
                    RMS {{ formatMetric(savedTransformer.fitResult.rms) }} m，最大残差 {{ formatMetric(savedTransformer.fitResult.maxResidual) }} m
                </div>
            </div>

            <div class="summary-card__actions">
                <Button size="sm" variant="outline" @click="openEditModal">编辑参数</Button>
                <Button size="sm" variant="outline" :disabled="!canReprojectSavedPoints" @click="reprojectAllPoints">
                    重算已有点位
                </Button>
            </div>
        </div>

        <Modal
            v-model="showEditModal"
            title="点位坐标转换"
            width="1120px"
            @close="handleEditClose"
        >
            <div class="editor-modal">
                <div class="editor-sidebar">
                    <div class="modal-intro">
                        参考点至少需要 4 个，且必须同时填写 `lng / lat / x / y / z` 才会参与拟合。
                    </div>

                    <div class="settings-block">
                        <label class="label">拟合方式</label>
                        <Select
                            :model-value="fitMethodDraft"
                            :options="fitMethodOptions"
                            @update:model-value="(value) => (fitMethodDraft = value)"
                        />
                    </div>

                    <div class="settings-block origin-block">
                        <label class="label">ENU 原点 (lng / lat / alt)</label>
                        <div class="origin-grid">
                            <Input
                                type="number"
                                :model-value="originDraft[0]"
                                placeholder="lng"
                                @update:model-value="(value) => (originDraft[0] = value)"
                            />
                            <Input
                                type="number"
                                :model-value="originDraft[1]"
                                placeholder="lat"
                                @update:model-value="(value) => (originDraft[1] = value)"
                            />
                            <Input
                                type="number"
                                :model-value="originDraft[2]"
                                placeholder="alt"
                                @update:model-value="(value) => (originDraft[2] = value)"
                            />
                        </div>
                    </div>

                    <div class="status-panel" :class="{ valid: canConvertWithDraft }">
                        <div>有效参考点：{{ validControlPointCount }} / {{ controlPointRows.length }}</div>
                        <div>{{ draftStatusText }}</div>
                        <div v-if="draftTransformer.fitResult.valid">
                            RMS {{ formatMetric(draftTransformer.fitResult.rms) }} m，最大残差 {{ formatMetric(draftTransformer.fitResult.maxResidual) }} m
                        </div>
                    </div>

                    <Button size="sm" variant="outline" @click="addControlPoint">添加参考点</Button>
                </div>

                <div class="editor-main">
                    <div class="table-wrap">
                        <table class="control-table">
                            <colgroup>
                                <col class="col-name" />
                                <col class="col-geo" />
                                <col class="col-geo" />
                                <col class="col-alt" />
                                <col class="col-xyz" />
                                <col class="col-xyz" />
                                <col class="col-xyz" />
                                <col class="col-source" />
                                <col class="col-actions" />
                            </colgroup>
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>经度</th>
                                <th>纬度</th>
                                <th>高程</th>
                                <th>X</th>
                                <th>Y</th>
                                <th>Z</th>
                                <th>点位管理器坐标</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, index) in controlPointRows" :key="row.id">
                                <td>
                                    <Input
                                        :model-value="row.name"
                                        :placeholder="`参考点${index + 1}`"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'name', value)"
                                    />
                                </td>
                                <td>
                                    <Input
                                        type="number"
                                        :model-value="row.lng"
                                        placeholder="lng"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'lng', value)"
                                    />
                                </td>
                                <td>
                                    <Input
                                        type="number"
                                        :model-value="row.lat"
                                        placeholder="lat"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'lat', value)"
                                    />
                                </td>
                                <td>
                                    <Input
                                        type="number"
                                        :model-value="row.alt"
                                        placeholder="alt"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'alt', value)"
                                    />
                                </td>
                                <td>
                                    <Input
                                        type="number"
                                        :model-value="row.x"
                                        placeholder="x"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'x', value)"
                                    />
                                </td>
                                <td>
                                    <Input
                                        type="number"
                                        :model-value="row.y"
                                        placeholder="y"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'y', value)"
                                    />
                                </td>
                                <td>
                                    <Input
                                        type="number"
                                        :model-value="row.z"
                                        placeholder="z"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'z', value)"
                                    />
                                </td>
                                <td class="point-source-cell">
                                    <Select
                                        :model-value="row.sourcePointId"
                                        :options="buildingPointOptions"
                                        placeholder="选择点位"
                                        @update:model-value="(value) => updateControlPointField(row.id, 'sourcePointId', value)"
                                    />
                                    <Button size="sm" variant="outline" @click="applyBuildingPointToControlPoint(row.id)">
                                        使用点位
                                    </Button>
                                </td>
                                <td class="row-actions">
                                    <Button size="sm" variant="outline" @click="startControlPointPicking(row.id)">拾取XYZ</Button>
                                    <Button size="sm" variant="outline" @click="cloneControlPoint(row.id)">复制</Button>
                                    <Button size="sm" variant="danger" @click="removeControlPoint(row.id)">删除</Button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="handleEditClose">取消</Button>
                <Button variant="primary" @click="applySettings">应用参数</Button>
            </template>
        </Modal>

        <Modal
            v-model="showPickConfirm"
            title="确认参考点坐标"
            width="420px"
            @close="handlePickConfirmClose"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">{{ pickConfirmDescription }}</div>
                <div class="pick-xyz-display">
                    <Input :model-value="formatMetric(pickConfirmXyz[0])" disabled />
                    <Input :model-value="formatMetric(pickConfirmXyz[1])" disabled />
                    <Input :model-value="formatMetric(pickConfirmXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelControlPointPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmControlPointPickConfirm">确认</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
    GEO_FIT_METHODS,
    createTrafficGeoCoordinateTransformer,
    normalizeTrafficCoordinateSystemConfig
} from '@w3d/components';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Modal from '../ui/Modal.vue';
import Select from '../ui/Select.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useToast } from '../../composables/useToast';

const REQUIRED_CONTROL_POINT_COUNT = 4;
const BUILDING_POINT_SETTINGS_PICKER_ID = '__building_point_coordinate_settings__';
const FIT_METHOD_LABELS = {
    [GEO_FIT_METHODS.SIMILARITY_2D]: '2D 四参数拟合',
    [GEO_FIT_METHODS.SIMILARITY_3D]: '3D 七参数拟合',
    [GEO_FIT_METHODS.AFFINE]: '仿射拟合'
};

const componentStore = useComponentStore();
const projectStore = useProjectStore();
const toast = useToast();

const showEditModal = ref(false);
const editModalMinimizedByPicking = ref(false);
const suppressEditModalCloseCleanup = ref(false);
const originDraft = ref(['0', '0', '0']);
const fitMethodDraft = ref(GEO_FIT_METHODS.AFFINE);
const controlPointRows = ref([]);
let controlPointSeed = 0;

const savedCoordinateSystem = computed(() => normalizeTrafficCoordinateSystemConfig(projectStore.buildingPointCoordinateSystem || {}));
const savedTransformer = computed(() => createTrafficGeoCoordinateTransformer(savedCoordinateSystem.value));
const savedValidControlPointCount = computed(() => savedCoordinateSystem.value.fitting.controlPoints.filter((item) => item.valid).length);
const canReprojectSavedPoints = computed(() => {
    return savedCoordinateSystem.value.mode === 'geo'
        && savedValidControlPointCount.value >= REQUIRED_CONTROL_POINT_COUNT
        && savedTransformer.value.fitResult.valid;
});
const savedMethodLabel = computed(() => {
    return FIT_METHOD_LABELS[savedCoordinateSystem.value.fitting.method] || '未配置';
});
const savedStatusText = computed(() => {
    if (savedCoordinateSystem.value.mode !== 'geo') {
        return '当前还未应用点位坐标转换参数。';
    }
    if (savedValidControlPointCount.value < REQUIRED_CONTROL_POINT_COUNT) {
        return `当前配置中的有效参考点不足 ${REQUIRED_CONTROL_POINT_COUNT} 个。`;
    }
    if (!savedTransformer.value.fitResult.valid) {
        return savedTransformer.value.fitResult.message || '当前参考点无法解算转换参数。';
    }
    return `${savedTransformer.value.fitResult.label} 已可用于点位坐标转换。`;
});

const fitMethodOptions = [
    { label: '2D 四参数拟合', value: GEO_FIT_METHODS.SIMILARITY_2D },
    { label: '3D 七参数拟合', value: GEO_FIT_METHODS.SIMILARITY_3D },
    { label: '仿射拟合', value: GEO_FIT_METHODS.AFFINE }
];
const buildingPointOptions = computed(() => {
    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    const options = points.map((point, index) => ({
        label: String(point?.name || '').trim() || `点位${index + 1}`,
        value: String(point?.id || '')
    })).filter((item) => item.value);

    return options;
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

const formatGeo = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? String(roundGeo(n)) : '';
};

const format4 = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? String(round4(n)) : '';
};

const formatMetric = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? round4(n).toFixed(4) : '--';
};

const ensureVec3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [toNumber(value[0], fallback[0]), toNumber(value[1], fallback[1]), toNumber(value[2], fallback[2])];
    }

    if (value && typeof value === 'object') {
        return [toNumber(value.x, fallback[0]), toNumber(value.y, fallback[1]), toNumber(value.z, fallback[2])];
    }

    return [...fallback];
};

const createControlPointRow = (index, source = {}) => ({
    id: String(source.id || `control_point_draft_${Date.now()}_${controlPointSeed++}`),
    name: String(source.name || `参考点${index + 1}`),
    lng: formatGeo(source.geo?.[0] ?? source.lng),
    lat: formatGeo(source.geo?.[1] ?? source.lat),
    alt: format4(source.geo?.[2] ?? source.alt ?? 0),
    x: format4(source.model?.[0] ?? source.x),
    y: format4(source.model?.[1] ?? source.y),
    z: format4(source.model?.[2] ?? source.z),
    sourcePointId: String(source.sourcePointId || '')
});

const ensureMinimumRows = (rows) => {
    const nextRows = Array.isArray(rows) ? [...rows] : [];
    while (nextRows.length < REQUIRED_CONTROL_POINT_COUNT) {
        nextRows.push(createControlPointRow(nextRows.length));
    }
    return nextRows;
};

const buildDraftControlPoints = () => (
    controlPointRows.value.flatMap((row, index) => {
        const lng = toNullableNumber(row.lng);
        const lat = toNullableNumber(row.lat);
        const x = toNullableNumber(row.x);
        const y = toNullableNumber(row.y);
        const z = toNullableNumber(row.z);
        const alt = toNumber(row.alt, 0);

        if (lng === null || lat === null || x === null || y === null || z === null) {
            return [];
        }

        return [{
            id: row.id,
            name: String(row.name || '').trim() || `参考点${index + 1}`,
            model: [x, y, z],
            geo: [lng, lat, alt]
        }];
    })
);

const draftCoordinateSystem = computed(() => normalizeTrafficCoordinateSystemConfig({
    mode: 'geo',
    axis: 'xEast_yUp_zNorth',
    originLngLatAlt: [
        roundGeo(toNumber(originDraft.value[0], 0)),
        roundGeo(toNumber(originDraft.value[1], 0)),
        round4(toNumber(originDraft.value[2], 0))
    ],
    fitting: {
        method: fitMethodDraft.value,
        controlPoints: buildDraftControlPoints()
    }
}));

const draftTransformer = computed(() => createTrafficGeoCoordinateTransformer(draftCoordinateSystem.value));
const validControlPointCount = computed(() => draftCoordinateSystem.value.fitting.controlPoints.filter((item) => item.valid).length);
const canConvertWithDraft = computed(() => {
    return validControlPointCount.value >= REQUIRED_CONTROL_POINT_COUNT && draftTransformer.value.fitResult.valid;
});

const draftStatusText = computed(() => {
    if (validControlPointCount.value < REQUIRED_CONTROL_POINT_COUNT) {
        return `参考对照表至少需要 ${REQUIRED_CONTROL_POINT_COUNT} 个有效点。`;
    }
    if (!draftTransformer.value.fitResult.valid) {
        return draftTransformer.value.fitResult.message || '当前参考点无法解算转换参数。';
    }
    return `${draftTransformer.value.fitResult.label} 已可用于点位坐标转换。`;
});

const syncDrafts = (coordinateSystem) => {
    originDraft.value = [
        formatGeo(coordinateSystem.originLngLatAlt[0]),
        formatGeo(coordinateSystem.originLngLatAlt[1]),
        format4(coordinateSystem.originLngLatAlt[2])
    ];
    fitMethodDraft.value = coordinateSystem.fitting.method === GEO_FIT_METHODS.NONE
        ? GEO_FIT_METHODS.AFFINE
        : coordinateSystem.fitting.method;
    controlPointRows.value = ensureMinimumRows(
        (coordinateSystem.fitting.controlPoints || []).map((item, index) => createControlPointRow(index, item))
    );
};

const openEditModal = () => {
    syncDrafts(savedCoordinateSystem.value);
    showEditModal.value = true;
};

const handleEditClose = () => {
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    syncDrafts(savedCoordinateSystem.value);
    showEditModal.value = false;
    editModalMinimizedByPicking.value = false;
    suppressEditModalCloseCleanup.value = false;
};

const updateControlPointField = (rowId, field, value) => {
    controlPointRows.value = controlPointRows.value.map((row) => {
        if (row.id !== rowId) return row;
        return {
            ...row,
            [field]: value
        };
    });
};

const addControlPoint = () => {
    controlPointRows.value = [
        ...controlPointRows.value,
        createControlPointRow(controlPointRows.value.length)
    ];
};

const applyBuildingPointToControlPoint = (rowId) => {
    const row = controlPointRows.value.find((item) => item.id === rowId);
    if (!row) return;

    const selectedPointId = String(row.sourcePointId || '').trim();
    if (!selectedPointId) {
        toast.warning('请先选择点位');
        return;
    }

    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    const point = points.find((item) => String(item?.id || '') === selectedPointId);
    if (!point) {
        toast.error('未找到对应点位数据');
        return;
    }

    const [x, y, z] = ensureVec3(point.position, [0, 0, 0]).map((item) => round4(item));
    controlPointRows.value = controlPointRows.value.map((item) => {
        if (item.id !== rowId) return item;
        return {
            ...item,
            x: format4(x),
            y: format4(y),
            z: format4(z)
        };
    });
    toast.success('已带入点位管理器坐标');
};

const startControlPointPicking = (rowId) => {
    const row = controlPointRows.value.find((item) => item.id === rowId);
    if (!row?.id) return;

    suppressEditModalCloseCleanup.value = true;
    editModalMinimizedByPicking.value = true;
    showEditModal.value = false;

    componentStore.startBuildingPicking(BUILDING_POINT_SETTINGS_PICKER_ID, row.id);
    toast.info('请点击场景中的模型表面拾取 XYZ 坐标');
};

const cloneControlPoint = (rowId) => {
    const targetRow = controlPointRows.value.find((row) => row.id === rowId);
    if (!targetRow) return;
    controlPointRows.value = [
        ...controlPointRows.value,
        createControlPointRow(controlPointRows.value.length, {
            ...targetRow,
            name: `${targetRow.name || '参考点'} 副本`,
            lng: targetRow.lng,
            lat: targetRow.lat,
            alt: targetRow.alt,
            x: targetRow.x,
            y: targetRow.y,
            z: targetRow.z
        })
    ];
};

const removeControlPoint = (rowId) => {
    controlPointRows.value = ensureMinimumRows(controlPointRows.value.filter((row) => row.id !== rowId));
};

const applySettings = () => {
    projectStore.setBuildingPointCoordinateState({
        coordinateSystem: {
            mode: 'geo',
            axis: 'xEast_yUp_zNorth',
            originLngLatAlt: [...draftCoordinateSystem.value.originLngLatAlt],
            fitting: {
                method: draftCoordinateSystem.value.fitting.method,
                controlPoints: buildDraftControlPoints()
            }
        },
        markUnsaved: true
    });

    showEditModal.value = false;

    if (canConvertWithDraft.value) {
        toast.success('点位坐标转换参数已更新');
        return;
    }

    toast.warning(draftStatusText.value);
};

const reprojectAllPoints = () => {
    if (!canReprojectSavedPoints.value) {
        toast.warning('请先应用有效的转换参数，再重算已有点位');
        return;
    }

    const nextPoints = (Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : []).map((point) => {
        const lngLat = Array.isArray(point?.lngLat) && point.lngLat.length >= 2
            ? [Number(point.lngLat[0]), Number(point.lngLat[1])]
            : null;

        if (!lngLat || !Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) {
            return point;
        }

        const alt = toNumber(point?.alt, 0);
        return {
            ...point,
            position: savedTransformer.value.geoToModel([lngLat[0], lngLat[1], alt]).map((item) => round4(item))
        };
    });

    projectStore.setBuildingPointsState({
        points: nextPoints,
        markUnsaved: true
    });
    toast.success('已有点位已按当前转换参数重算');
};

const showPickConfirm = computed({
    get: () => {
        const pending = componentStore.buildingPickConfirm;
        return !!pending?.visible && pending?.componentId === BUILDING_POINT_SETTINGS_PICKER_ID;
    },
    set: (visible) => {
        if (!visible) {
            componentStore.clearBuildingPickConfirm();
        }
    }
});

const pickConfirmXyz = computed(() => {
    const pending = componentStore.buildingPickConfirm;
    const xyz = pending?.componentId === BUILDING_POINT_SETTINGS_PICKER_ID ? pending?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const pickConfirmDescription = computed(() => {
    const pending = componentStore.buildingPickConfirm;
    if (!pending?.visible || pending?.componentId !== BUILDING_POINT_SETTINGS_PICKER_ID) {
        return '已拾取到参考点坐标。';
    }

    const target = controlPointRows.value.find((row) => row.id === pending.pointId);
    return `已拾取到坐标，确认写入参考点“${target?.name || pending.pointId}”的 XYZ？`;
});

const confirmControlPointPickConfirm = () => {
    const pending = componentStore.buildingPickConfirm;
    if (!pending?.visible || pending?.componentId !== BUILDING_POINT_SETTINGS_PICKER_ID) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const targetId = String(pending.pointId || '');
    if (!targetId) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const [x, y, z] = ensureVec3(pending.xyz, [0, 0, 0]).map((item) => round4(item));
    controlPointRows.value = controlPointRows.value.map((row) => {
        if (row.id !== targetId) return row;
        return {
            ...row,
            x: format4(x),
            y: format4(y),
            z: format4(z)
        };
    });

    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();
    if (editModalMinimizedByPicking.value) {
        showEditModal.value = true;
        editModalMinimizedByPicking.value = false;
    }
    toast.success('参考点 XYZ 已更新');
};

const cancelControlPointPickConfirm = () => {
    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();
    if (editModalMinimizedByPicking.value) {
        showEditModal.value = true;
        editModalMinimizedByPicking.value = false;
    }
};

const handlePickConfirmClose = () => {
    cancelControlPointPickConfirm();
};

watch(
    () => savedCoordinateSystem.value,
    (value) => {
        if (!showEditModal.value) {
            syncDrafts(value);
        }
    },
    { immediate: true, deep: true }
);

watch(showEditModal, (visible) => {
    if (visible) {
        suppressEditModalCloseCleanup.value = false;
        return;
    }

    if (suppressEditModalCloseCleanup.value) {
        suppressEditModalCloseCleanup.value = false;
        return;
    }

    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    editModalMinimizedByPicking.value = false;
});

watch(
    () => [componentStore.buildingPicking?.active, showPickConfirm.value],
    ([active, confirming]) => {
        if (!editModalMinimizedByPicking.value) return;
        if (active || confirming) return;
        showEditModal.value = true;
        editModalMinimizedByPicking.value = false;
    }
);
</script>

<style scoped>
.building-point-settings {
    display: flex;
    flex-direction: column;
}

.summary-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 5px 5px;
    color: #92400e;
}

.summary-card.valid {
    border-color: rgba(16, 185, 129, 0.28);
    /* background: rgba(236, 253, 245, 0.88); */
    color: #065f46;
}

.summary-card__content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
}

.summary-card__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.summary-card__meta,
.summary-card__metrics {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.summary-card__status {
    font-size: 12px;
    line-height: 1.6;
    word-break: break-word;
}

.summary-card__actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
}

.summary-card__actions :deep(.btn) {
    width: 100%;
}

.editor-modal {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
}

.modal-intro {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.6;
}

.editor-sidebar {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.editor-main {
    min-width: 0;
}

.settings-block,
.origin-block,
.origin-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.origin-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary);
}

.status-panel {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.5;
}

.status-panel.valid {
    border-color: rgba(92, 124, 250, 0.28);
    background: linear-gradient(180deg, rgba(92, 124, 250, 0.08), rgba(92, 124, 250, 0.03));
    color: var(--color-text-primary);
}

.table-wrap {
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    max-height: 62vh;
    background: var(--color-bg-tertiary);
}

.control-table {
    width: 100%;
    min-width: 1100px;
    border-collapse: collapse;
    table-layout: fixed;
}

.control-table th,
.control-table td {
    padding: 6px;
    border-bottom: 1px solid var(--color-border);
    text-align: left;
    vertical-align: middle;
}

.control-table th {
    font-size: 11px;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.03);
    position: sticky;
    top: 0;
    z-index: 1;
}

.control-table .col-name {
    width: 130px;
}

.control-table .col-geo {
    width: 120px;
}

.control-table .col-alt {
    width: 86px;
}

.control-table .col-xyz {
    width: 76px;
}

.control-table .col-source {
    width: 180px;
}

.control-table .col-actions {
    width: 170px;
}

.row-actions,
.point-source-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.point-source-cell :deep(.select-wrapper) {
    flex: 1;
    min-width: 120px;
}

.control-table :deep(.input-wrapper),
.control-table :deep(.select-wrapper) {
    gap: 0;
}

.control-table :deep(.input),
.control-table :deep(.select) {
    height: 28px;
}

.pick-confirm-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pick-xyz-display {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

@media (max-width: 1100px) {
    .editor-modal {
        grid-template-columns: 1fr;
    }
}
</style>
