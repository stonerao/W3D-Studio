<template>
    <div class="ptm-editor">
        <div class="ptm-summary">
            <span>类型数：{{ types.length }}</span>
            <span>点位数：{{ points.length }}</span>
            <span>上限：{{ maxPoints }}</span>
        </div>

        <div class="ptm-actions">
            <Button size="sm" @click="showUnifiedEditorModal = true">统一弹窗编辑属性</Button>
            <Button size="sm" variant="outline" @click="showAdvanced = !showAdvanced">
                {{ showAdvanced ? '隐藏高级设置' : '显示高级设置' }}
            </Button>
        </div>

        <Modal v-model="showUnifiedEditorModal" title="多类型点位管理属性" width="1120px">
            <div class="ptm-unified-content">
        <div v-if="showAdvanced" class="ptm-section">
            <div class="ptm-section__title">数据映射模板</div>
            <div class="ptm-actions">
                <Select class="ptm-action-select" :model-value="mappingTemplate" :options="mappingTemplateOptions" @update:model-value="mappingTemplate = $event" />
                <Button size="sm" @click="applyMappingTemplate">应用模板</Button>
                <Button size="sm" variant="outline" @click="enableMapping">启用映射</Button>
                <Button size="sm" variant="outline" @click="ensureSnapshotBinding">初始化快照绑定</Button>
                <Button size="sm" variant="outline" @click="triggerSnapshotImport">导入快照 JSON</Button>
                <Button size="sm" variant="outline" @click="exportSnapshot">导出快照 JSON</Button>
                <Button size="sm" variant="outline" @click="reapplySnapshotMapping">重新执行映射</Button>
            </div>
            <div class="ptm-grid ptm-grid--3">
                <Input :model-value="mappingPaths.types" label="类型数组路径" @update:model-value="updateMappingPath('types', $event)" />
                <Input :model-value="mappingPaths.points" label="点位数组路径" @update:model-value="updateMappingPath('points', $event)" />
                <Input :model-value="mappingPaths.list" label="列表路径" @update:model-value="updateMappingPath('list', $event)" />
            </div>
        </div>

        <div class="ptm-section">
            <div class="ptm-section__title">状态样式（按类型）</div>
            <div class="ptm-actions">
                <Select class="ptm-type-select" :model-value="selectedTypeId" :options="typeOptions" @update:model-value="selectedTypeId = $event" />
                <Button size="sm" variant="outline" :disabled="!currentType" @click="resetCurrentTypeStateStyles">重置当前类型状态样式</Button>
            </div>
            <div v-if="!currentType" class="ptm-empty">请先选择一个类型后再设置状态样式</div>
            <div v-else class="ptm-grid ptm-grid--4">
                <div v-for="state in stateKeys" :key="`${currentType.id}_${state}`" class="ptm-card">
                    <div class="ptm-card__title">{{ getStateLabel(state) }}</div>
                    <ColorPicker :model-value="currentTypeStateStyles[state].color || '#07a6ff'" label="颜色" @update:model-value="updateStateStyle(state, 'color', $event)" />
                    <Input type="number" :model-value="currentTypeStateStyles[state].scaleMultiplier" label="缩放倍率" @update:model-value="updateStateStyle(state, 'scaleMultiplier', toNumber($event, 1))" />
                    <Input type="number" :model-value="currentTypeStateStyles[state].opacity" label="透明度" @update:model-value="updateStateStyle(state, 'opacity', toNumber($event, 1))" />
                    <div class="ptm-vec3">
                        <Input type="number" :model-value="currentTypeStateStyles[state].offset[0]" label="偏移 X" @update:model-value="updateStateOffset(state, 0, $event)" />
                        <Input type="number" :model-value="currentTypeStateStyles[state].offset[1]" label="偏移 Y" @update:model-value="updateStateOffset(state, 1, $event)" />
                        <Input type="number" :model-value="currentTypeStateStyles[state].offset[2]" label="偏移 Z" @update:model-value="updateStateOffset(state, 2, $event)" />
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showAdvanced" class="ptm-section">
            <div class="ptm-section__title">批量编辑点位（按类型）</div>
            <div class="ptm-grid ptm-grid--4 ptm-batch-grid">
                <Select :model-value="batchTypeId" label="目标类型" :options="batchTypeOptions" @update:model-value="batchTypeId = $event" />
                <Input :model-value="batchScaleValue" label="缩放覆盖值（空=不改）" placeholder="例如 1.2" @update:model-value="batchScaleValue = $event" />
                <Input :model-value="batchColorValue" label="颜色覆盖值（空=不改）" placeholder="#07a6ff" @update:model-value="batchColorValue = $event" />
                <div class="ptm-batch-count">命中点位：{{ batchTargetCount }}</div>
            </div>
            <div class="ptm-vec3 ptm-batch-offset">
                <Input type="number" :model-value="batchOffset[0]" label="批量偏移 X" @update:model-value="updateBatchOffset(0, $event)" />
                <Input type="number" :model-value="batchOffset[1]" label="批量偏移 Y" @update:model-value="updateBatchOffset(1, $event)" />
                <Input type="number" :model-value="batchOffset[2]" label="批量偏移 Z" @update:model-value="updateBatchOffset(2, $event)" />
            </div>
            <label class="ptm-checkbox">
                <input type="checkbox" :checked="batchEnableOffset" @change="batchEnableOffset = $event.target.checked">
                <span>应用偏移覆盖</span>
            </label>
            <div class="ptm-actions">
                <Button size="sm" @click="applyBatchStyleOverrides">应用批量覆盖</Button>
                <Button size="sm" variant="outline" @click="clearBatchScaleOverride">清空缩放覆盖</Button>
                <Button size="sm" variant="outline" @click="clearBatchColorOverride">清空颜色覆盖</Button>
                <Button size="sm" variant="outline" @click="clearBatchOffsetOverride">清空偏移覆盖</Button>
            </div>
        </div>

        <div class="ptm-section">
            <div class="ptm-actions">
                <Button size="sm" @click="addType">新增类型</Button>
                <Button size="sm" @click="addPoint">新增点位</Button>
                <Button size="sm" variant="outline" @click="triggerImport">导入点位 JSON</Button>
                <Button size="sm" variant="outline" @click="exportPoints">导出点位 JSON</Button>
            </div>
            <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden-input" @change="handleImportFile">
            <input ref="snapshotFileInputRef" type="file" accept=".json,application/json" class="hidden-input" @change="handleSnapshotImportFile">
        </div>

        <div class="ptm-grid ptm-grid--2">
            <div class="ptm-card">
                <div class="ptm-card__title">类型列表</div>
                <div v-if="types.length === 0" class="ptm-empty">暂无类型</div>
                <button v-for="type in types" :key="type.id" class="ptm-item-btn" :class="{ active: selectedTypeId === type.id }" @click="selectedTypeId = type.id">
                    <span class="ptm-item-name">{{ type.name }}</span>
                    <span class="ptm-item-sub">{{ type.resourceType }}</span>
                </button>
            </div>

            <div class="ptm-card">
                <div class="ptm-card__title">类型编辑</div>
                <div v-if="!currentType" class="ptm-empty">请选择一个类型</div>
                <div v-else class="ptm-form">
                    <div class="ptm-type-brief">
                        <div>ID：{{ currentType.id }}</div>
                        <div>名称：{{ currentType.name }}</div>
                        <div>资源类型：{{ currentType.resourceType }}</div>
                        <div class="ptm-ellipsis">资源地址：{{ currentType.resourceUrl || '未绑定' }}</div>
                        <div>尺寸/缩放：{{ currentType.size }} / {{ currentType.scale }}</div>
                    </div>
                    <div class="ptm-actions">
                        <Button size="sm" @click="openTypeEditModal('basic')">编辑基础信息</Button>
                        <Button size="sm" variant="outline" @click="openTypeEditModal('resource')">绑定资源</Button>
                        <Button size="sm" variant="outline" @click="openTypeEditModal('style')">编辑样式参数</Button>
                    </div>
                    <Button size="sm" variant="danger" @click="removeType(currentType.id)">删除类型</Button>
                </div>
            </div>
        </div>

        <div class="ptm-grid ptm-grid--2">
            <div class="ptm-card ptm-point-manager-card">
                <div class="ptm-card__title">点位列表</div>
                <div class="ptm-point-tools">
                    <Input :model-value="pointKeyword" label="筛选关键字" placeholder="名称 / ID / 类型" @update:model-value="updatePointKeyword" />
                    <div class="ptm-point-tools-row">
                        <Select :model-value="pointSortMode" label="排序" :options="pointSortModeOptions" @update:model-value="updatePointSortMode" />
                        <Select :model-value="pointPageSize" label="每页条数" :options="pointPageSizeOptions" @update:model-value="updatePointPageSize" />
                        <div class="ptm-page-info">第 {{ pointPage }} / {{ pointTotalPages }} 页</div>
                    </div>
                    <div class="ptm-actions">
                        <Button size="sm" variant="outline" @click="prevPointPage">上一页</Button>
                        <Button size="sm" variant="outline" @click="nextPointPage">下一页</Button>
                        <Button size="sm" variant="outline" @click="locateCurrentPointPage">定位当前点位</Button>
                        <Button size="sm" variant="outline" @click="toggleCurrentPageAllChecked(true)">本页全选</Button>
                        <Button size="sm" variant="outline" @click="toggleCurrentPageAllChecked(false)">取消本页</Button>
                        <Button size="sm" variant="outline" @click="clearCheckedPoints">清空勾选</Button>
                        <Button size="sm" variant="outline" @click="setCheckedPointsVisible(true)">勾选设为可见</Button>
                        <Button size="sm" variant="outline" @click="setCheckedPointsVisible(false)">勾选设为隐藏</Button>
                        <Button size="sm" variant="danger" @click="removeCheckedPoints">删除勾选</Button>
                    </div>
                    <div v-if="showAdvanced" class="ptm-actions">
                        <Button size="sm" variant="outline" @click="undoLastOperation">撤销上一步</Button>
                        <Button size="sm" variant="outline" @click="redoLastOperation">重做上一步</Button>
                        <Button size="sm" variant="outline" @click="clearOperationLogs">清空日志</Button>
                        <Button size="sm" variant="outline" @click="clearHistoryStacks">清空历史</Button>
                    </div>
                    <div class="ptm-point-tools-row">
                        <Input type="number" :model-value="checkedMoveOffset[0]" label="移动 X" @update:model-value="updateCheckedMoveOffset(0, $event)" />
                        <Input type="number" :model-value="checkedMoveOffset[1]" label="移动 Y" @update:model-value="updateCheckedMoveOffset(1, $event)" />
                        <Input type="number" :model-value="checkedMoveOffset[2]" label="移动 Z" @update:model-value="updateCheckedMoveOffset(2, $event)" />
                    </div>
                    <div class="ptm-actions">
                        <Button size="sm" variant="outline" @click="moveCheckedPoints">勾选批量移动</Button>
                        <Select class="ptm-type-select" :model-value="checkedTargetTypeId" :options="checkedTypeOptions" @update:model-value="checkedTargetTypeId = $event" />
                        <Button size="sm" variant="outline" @click="changeCheckedPointsType">勾选改类型</Button>
                    </div>
                    <div class="ptm-point-summary">筛选结果 {{ filteredPoints.length }} 条，当前页 {{ pagedPoints.length }} 条，已勾选 {{ checkedPointCount }} 条</div>
                    <div v-if="showAdvanced" class="ptm-log-list">
                        <div class="ptm-log-title">最近操作</div>
                        <div v-if="operationLogList.length === 0" class="ptm-empty">暂无日志</div>
                        <button
                            v-for="log in operationLogList"
                            :key="log.id"
                            type="button"
                            class="ptm-log-item"
                            @click="focusLogEntry(log)"
                        >
                            <span class="ptm-log-time">{{ log.time }}</span>
                            <span class="ptm-log-text">{{ log.text }}</span>
                        </button>
                    </div>
                </div>
                <div v-if="points.length === 0" class="ptm-empty">暂无点位</div>
                <button v-for="point in pagedPoints" :key="point.id" class="ptm-item-btn" :class="{ active: selectedPointId === point.id }" @click="selectedPointId = point.id">
                    <input
                        class="ptm-item-check"
                        type="checkbox"
                        :checked="isPointChecked(point.id)"
                        @click.stop
                        @change="togglePointChecked(point.id, $event.target.checked)"
                    >
                    <span class="ptm-item-name">{{ point.name }}</span>
                    <span class="ptm-item-sub">{{ point.typeId }}</span>
                </button>
                <div class="ptm-point-edit-inline">
                <div class="ptm-card__title">点位编辑</div>
                <div v-if="!currentPoint" class="ptm-empty">请选择一个点位</div>
                <div v-else class="ptm-form">
                    <div class="ptm-point-brief">
                        <div>ID：{{ currentPoint.id }}</div>
                        <div>名称：{{ currentPoint.name }}</div>
                        <div>类型：{{ currentPoint.typeId }}</div>
                        <div>坐标：{{ currentPoint.position?.[0] ?? 0 }}, {{ currentPoint.position?.[1] ?? 0 }}, {{ currentPoint.position?.[2] ?? 0 }}</div>
                    </div>
                    <div class="ptm-vec3">
                        <Input type="number" :model-value="currentPoint.position?.[0] ?? 0" label="坐标 X" @update:model-value="updatePointPosition(0, $event)" />
                        <Input type="number" :model-value="currentPoint.position?.[1] ?? 0" label="坐标 Y" @update:model-value="updatePointPosition(1, $event)" />
                        <Input type="number" :model-value="currentPoint.position?.[2] ?? 0" label="坐标 Z" @update:model-value="updatePointPosition(2, $event)" />
                    </div>
                    <div class="ptm-actions">
                        <Button size="sm" variant="outline" @click="startPointPick">开始拾取坐标</Button>
                        <Button size="sm" variant="outline" @click="stopPointPick">退出拾取</Button>
                    </div>
                    <Button size="sm" @click="openPointEditModal">弹窗编辑点位</Button>
                    <div class="ptm-actions">
                        <Button size="sm" variant="outline" @click="previewState('hover', true)">悬停开</Button>
                        <Button size="sm" variant="outline" @click="previewState('hover', false)">悬停关</Button>
                        <Button size="sm" variant="outline" @click="previewState('click', true)">点击开</Button>
                        <Button size="sm" variant="outline" @click="previewState('click', false)">点击关</Button>
                        <Button size="sm" variant="outline" @click="previewHighlight(true)">高亮开</Button>
                        <Button size="sm" variant="outline" @click="previewHighlight(false)">高亮关</Button>
                        <Button size="sm" variant="outline" @click="clearAllStates">清空状态</Button>
                    </div>
                    <Button size="sm" variant="danger" @click="removePoint(currentPoint.id)">删除点位</Button>
                </div>
                </div>
            </div>
        </div>
            </div>
            <template #footer>
                <div class="ptm-actions">
                    <Button variant="outline" @click="showUnifiedEditorModal = false">关闭</Button>
                </div>
            </template>
        </Modal>

        <Modal v-model="showPointEditModal" title="编辑点位" width="760px">
            <div v-if="pointEditDraft" class="ptm-modal-form">
                <div class="ptm-grid ptm-grid--2">
                    <Input :model-value="pointEditDraft.id" label="点位 ID" @update:model-value="updatePointDraftField('id', $event)" />
                    <Input :model-value="pointEditDraft.name" label="名称" @update:model-value="updatePointDraftField('name', $event)" />
                </div>
                <Select :model-value="pointEditDraft.typeId" label="所属类型" :options="typeOptions" @update:model-value="updatePointDraftField('typeId', $event)" />
                <div class="ptm-vec3">
                    <Input type="number" :model-value="pointEditDraft.position?.[0] ?? 0" label="坐标 X" @update:model-value="updatePointDraftPosition(0, $event)" />
                    <Input type="number" :model-value="pointEditDraft.position?.[1] ?? 0" label="坐标 Y" @update:model-value="updatePointDraftPosition(1, $event)" />
                    <Input type="number" :model-value="pointEditDraft.position?.[2] ?? 0" label="坐标 Z" @update:model-value="updatePointDraftPosition(2, $event)" />
                </div>
                <div class="ptm-grid ptm-grid--2">
                    <Input type="number" :model-value="pointEditDraft.scale" label="缩放覆盖（空=不覆盖）" @update:model-value="updatePointDraftField('scale', $event)" />
                    <ColorPicker :model-value="pointEditDraft.color || '#07a6ff'" label="颜色覆盖（空=不覆盖）" @update:model-value="updatePointDraftField('color', $event)" />
                </div>
                <label class="ptm-checkbox">
                    <input type="checkbox" :checked="pointEditDraft.visible !== false" @change="updatePointDraftField('visible', $event.target.checked)">
                    <span>可见</span>
                </label>
            </div>
            <template #footer>
                <div class="ptm-actions">
                    <Button variant="outline" @click="showPointEditModal = false">取消</Button>
                    <Button @click="savePointEditModal">保存</Button>
                </div>
            </template>
        </Modal>
        <Modal
            v-model="showPointPickConfirm"
            title="确认拾取坐标"
            width="420px"
            @close="handlePointPickConfirmClose"
        >
            <div class="ptm-modal-form">
                <div class="ptm-empty">已拾取到坐标，确认写入当前点位？</div>
                <div class="ptm-grid ptm-grid--3">
                    <Input :model-value="String(pointPickConfirmXyz[0])" label="X" disabled />
                    <Input :model-value="String(pointPickConfirmXyz[1])" label="Y" disabled />
                    <Input :model-value="String(pointPickConfirmXyz[2])" label="Z" disabled />
                </div>
            </div>
            <template #footer>
                <div class="ptm-actions">
                    <Button variant="outline" @click="cancelPointPickConfirm">继续拾取</Button>
                    <Button @click="confirmPointPickConfirm">确认写入</Button>
                </div>
            </template>
        </Modal>
        <Modal v-model="showTypeEditModal" :title="typeEditModalTitle" width="760px">
            <div v-if="typeEditDraft" class="ptm-modal-form">
                <div v-if="typeEditMode === 'basic'" class="ptm-modal-form">
                    <Input :model-value="typeEditDraft.id" label="类型 ID" @update:model-value="updateTypeDraftField('id', $event)" />
                    <Input :model-value="typeEditDraft.name" label="名称" @update:model-value="updateTypeDraftField('name', $event)" />
                    <label class="ptm-checkbox">
                        <input type="checkbox" :checked="typeEditDraft.visible !== false" @change="updateTypeDraftField('visible', $event.target.checked)">
                        <span>可见</span>
                    </label>
                </div>
                <div v-else-if="typeEditMode === 'resource'" class="ptm-modal-form">
                    <Select :model-value="typeEditDraft.resourceType" label="资源类型" :options="resourceTypeOptions" @update:model-value="updateTypeDraftField('resourceType', $event)" />
                    <div class="ptm-actions">
                        <Input class="ptm-resource-input" :model-value="typeEditDraft.resourceUrl" label="资源地址 URL" @update:model-value="updateTypeDraftField('resourceUrl', $event)" />
                        <Button size="sm" variant="outline" @click="openTypeAssetPicker">从资源库选择</Button>
                    </div>
                </div>
                <div v-else class="ptm-modal-form">
                    <ColorPicker :model-value="typeEditDraft.color" label="颜色" @update:model-value="updateTypeDraftField('color', $event)" />
                    <div class="ptm-grid ptm-grid--2">
                        <Input type="number" :model-value="typeEditDraft.size" label="基础尺寸" @update:model-value="updateTypeDraftField('size', toNumber($event, 1))" />
                        <Input type="number" :model-value="typeEditDraft.scale" label="基础缩放" @update:model-value="updateTypeDraftField('scale', toNumber($event, 1))" />
                    </div>
                    <div class="ptm-vec3">
                        <Input type="number" :model-value="typeEditDraft.offset?.[0] ?? 0" label="偏移 X" @update:model-value="updateTypeDraftOffset(0, $event)" />
                        <Input type="number" :model-value="typeEditDraft.offset?.[1] ?? 0" label="偏移 Y" @update:model-value="updateTypeDraftOffset(1, $event)" />
                        <Input type="number" :model-value="typeEditDraft.offset?.[2] ?? 0" label="偏移 Z" @update:model-value="updateTypeDraftOffset(2, $event)" />
                    </div>
                </div>
            </div>
            <template #footer>
                <div class="ptm-actions">
                    <Button variant="outline" @click="showTypeEditModal = false">取消</Button>
                    <Button @click="saveTypeEditModal">保存</Button>
                </div>
            </template>
        </Modal>
        <AssetPickerModal
            v-model="showAssetPicker"
            :category="assetPickerCategory"
            @select="handleTypeAssetSelect"
        />
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import Modal from '../ui/Modal.vue';
import AssetPickerModal from './AssetPickerModal.vue';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const DEFAULT_STATE_STYLES = {
    normal: { color: null, scaleMultiplier: 1, opacity: 1, offset: [0, 0, 0] },
    hover: { color: '#1d4ed8', scaleMultiplier: 1.1, opacity: 1, offset: [0, 0, 0] },
    click: { color: '#ef4444', scaleMultiplier: 1.2, opacity: 1, offset: [0, 0, 0] },
    highlight: { color: '#facc15', scaleMultiplier: 1.25, opacity: 1, offset: [0, 0, 0] }
};

const DEFAULT_MAPPING = {
    enabled: false,
    template: 'separate',
    paths: { types: 'types', points: 'points', list: 'list', groupedPoints: 'points' },
    typeFields: { id: 'id', name: 'name', resourceType: 'resourceType', resourceUrl: 'resourceUrl', color: 'color', size: 'size', scale: 'scale', offset: 'offset', visible: 'visible' },
    pointFields: { id: 'id', name: 'name', typeId: 'typeId', position: 'position', x: 'x', y: 'y', z: 'z', scale: 'scale', offset: 'offset', color: 'color', visible: 'visible', data: 'data' }
};

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

const fileInputRef = ref(null);
const snapshotFileInputRef = ref(null);
const selectedTypeId = ref('');
const selectedPointId = ref('');
const mappingTemplate = ref('separate');
const batchTypeId = ref('all');
const batchScaleValue = ref('');
const batchColorValue = ref('');
const batchOffset = ref([0, 0, 0]);
const batchEnableOffset = ref(false);
const pointKeyword = ref('');
const pointPage = ref(1);
const pointPageSize = ref(100);
const pointSortMode = ref('name_asc');
const checkedPointIds = ref([]);
const checkedMoveOffset = ref([0, 0, 0]);
const checkedTargetTypeId = ref('');
const undoStack = ref([]);
const redoStack = ref([]);
const operationLogList = ref([]);
const showUnifiedEditorModal = ref(false);
const showAdvanced = ref(false);
const showPointEditModal = ref(false);
const pointEditDraft = ref(null);
const showTypeEditModal = ref(false);
const typeEditMode = ref('basic');
const typeEditDraft = ref(null);
const showAssetPicker = ref(false);
const assetPickerCategory = ref('image');
const stateKeys = ['normal', 'hover', 'click', 'highlight'];
const MAX_OPERATION_LOGS = 20;
const MAX_UNDO_STEPS = 20;

const mappingTemplateOptions = [
    { label: '分离模板（types + points）', value: 'separate' },
    { label: '列表模板（仅 points）', value: 'list' },
    { label: '分组模板（type 下带 points）', value: 'grouped' }
];
const resourceTypeOptions = [{ label: '静态图', value: 'image' }, { label: '模型', value: 'model' }];
const pointPageSizeOptions = [{ label: '50', value: 50 }, { label: '100', value: 100 }, { label: '200', value: 200 }];
const pointSortModeOptions = [
    { label: '名称升序', value: 'name_asc' },
    { label: '名称降序', value: 'name_desc' },
    { label: 'ID 升序', value: 'id_asc' },
    { label: 'ID 降序', value: 'id_desc' }
];
const checkedTypeOptions = computed(() => ([
    { label: '请选择目标类型', value: '' },
    ...typeOptions.value
]));

const component = computed(() => componentStore.components.find((item) => item.id === props.componentId) || null);
const config = computed(() => component.value?.config || {});
const maxPoints = computed(() => Number(config.value.maxPoints || 1000));
const mappingConfig = computed(() => mergeDeep(DEFAULT_MAPPING, config.value.dataMapping || {}));
const mappingPaths = computed(() => mappingConfig.value.paths || DEFAULT_MAPPING.paths);
const mappingTypeFields = computed(() => mappingConfig.value.typeFields || DEFAULT_MAPPING.typeFields);
const mappingPointFields = computed(() => mappingConfig.value.pointFields || DEFAULT_MAPPING.pointFields);
const stateStyles = computed(() => {
    const merged = mergeDeep(DEFAULT_STATE_STYLES, config.value.stateStyles || {});
    return { normal: normalizeStateStyle(merged.normal), hover: normalizeStateStyle(merged.hover), click: normalizeStateStyle(merged.click), highlight: normalizeStateStyle(merged.highlight) };
});
const typeStateStylesMap = computed(() => {
    const source = config.value.typeStateStyles && typeof config.value.typeStateStyles === 'object'
        ? config.value.typeStateStyles
        : {};
    const result = {};
    Object.keys(source).forEach((typeId) => {
        const merged = mergeDeep(DEFAULT_STATE_STYLES, source[typeId] || {});
        result[typeId] = {
            normal: normalizeStateStyle(merged.normal),
            hover: normalizeStateStyle(merged.hover),
            click: normalizeStateStyle(merged.click),
            highlight: normalizeStateStyle(merged.highlight)
        };
    });
    return result;
});
const types = computed(() => (Array.isArray(config.value.types) ? config.value.types : []).map((item, index) => normalizeType(item, index)));
const points = computed(() => {
    const list = Array.isArray(config.value.points) ? config.value.points : [];
    return list.map((item, index) => normalizePoint(item, index, types.value[0]?.id || 'default'));
});
const typeOptions = computed(() => types.value.map((item) => ({ label: item.name, value: item.id })));
const batchTypeOptions = computed(() => ([{ label: '全部类型', value: 'all' }, ...typeOptions.value]));
const currentType = computed(() => types.value.find((item) => item.id === selectedTypeId.value) || null);
const typeEditModalTitle = computed(() => ({
    basic: '编辑类型基础信息',
    resource: '绑定类型资源',
    style: '编辑类型样式参数'
}[typeEditMode.value] || '编辑类型'));
const currentTypeStateStyles = computed(() => {
    if (!currentType.value) return stateStyles.value;
    return typeStateStylesMap.value[currentType.value.id] || stateStyles.value;
});
const currentPoint = computed(() => points.value.find((item) => item.id === selectedPointId.value) || null);
const showPointPickConfirm = computed({
    get: () => {
        const pc = componentStore.buildingPickConfirm;
        return !!pc?.visible && pc?.componentId === props.componentId;
    },
    set: (value) => {
        if (!value) componentStore.clearBuildingPickConfirm();
    }
});
const pointPickConfirmXyz = computed(() => {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== props.componentId) return [0, 0, 0];
    return ensureVec3(pc.xyz, [0, 0, 0]);
});
const batchTargetCount = computed(() => getBatchTargetPoints().length);
const filteredPoints = computed(() => {
    const keyword = String(pointKeyword.value || '').trim().toLowerCase();
    if (!keyword) return points.value;
    return points.value.filter((item) => String(item.id || '').toLowerCase().includes(keyword) || String(item.name || '').toLowerCase().includes(keyword) || String(item.typeId || '').toLowerCase().includes(keyword));
});
const sortedPoints = computed(() => {
    const list = [...filteredPoints.value];
    const mode = pointSortMode.value;
    list.sort((a, b) => {
        const nameA = String(a.name || '');
        const nameB = String(b.name || '');
        const idA = String(a.id || '');
        const idB = String(b.id || '');
        if (mode === 'name_desc') return nameB.localeCompare(nameA, 'zh-CN');
        if (mode === 'id_asc') return idA.localeCompare(idB, 'zh-CN');
        if (mode === 'id_desc') return idB.localeCompare(idA, 'zh-CN');
        return nameA.localeCompare(nameB, 'zh-CN');
    });
    return list;
});
const pointTotalPages = computed(() => Math.max(1, Math.ceil(filteredPoints.value.length / Math.max(1, Number(pointPageSize.value || 100)))));
const pagedPoints = computed(() => {
    const size = Math.max(1, Number(pointPageSize.value || 100));
    const page = Math.min(Math.max(1, Number(pointPage.value || 1)), pointTotalPages.value);
    return sortedPoints.value.slice((page - 1) * size, page * size);
});
const checkedPointCount = computed(() => checkedPointIds.value.length);

watch(() => mappingConfig.value.template, (template) => { mappingTemplate.value = template || 'separate'; }, { immediate: true });
watch(() => types.value.map((item) => item.id).join('|'), () => {
    if (!types.value.length) selectedTypeId.value = '';
    else if (!types.value.some((item) => item.id === selectedTypeId.value)) selectedTypeId.value = types.value[0].id;
}, { immediate: true });
watch(() => points.value.map((item) => item.id).join('|'), () => {
    if (!points.value.length) selectedPointId.value = '';
    else if (!points.value.some((item) => item.id === selectedPointId.value)) selectedPointId.value = points.value[0].id;
}, { immediate: true });
watch([() => filteredPoints.value.length, () => pointPageSize.value], () => {
    if (pointPage.value > pointTotalPages.value) pointPage.value = pointTotalPages.value;
    if (pointPage.value < 1) pointPage.value = 1;
}, { immediate: true });
watch(() => points.value.map((item) => item.id).join('|'), () => {
    const idSet = new Set(points.value.map((item) => item.id));
    checkedPointIds.value = checkedPointIds.value.filter((id) => idSet.has(id));
}, { immediate: true });
function toNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function ensureVec3(value, fallback = [0, 0, 0]) {
    if (Array.isArray(value)) return [toNumber(value[0], fallback[0]), toNumber(value[1], fallback[1]), toNumber(value[2], fallback[2])];
    if (value && typeof value === 'object') return [toNumber(value.x, fallback[0]), toNumber(value.y, fallback[1]), toNumber(value.z, fallback[2])];
    return [...fallback];
}
function mergeDeep(target, source) {
    const base = target && typeof target === 'object' ? target : {};
    const patch = source && typeof source === 'object' ? source : {};
    const result = { ...base };
    Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) result[key] = mergeDeep(base[key] || {}, value);
        else result[key] = value;
    });
    return result;
}
function normalizeStateStyle(style = {}) { return { color: style.color ?? null, scaleMultiplier: toNumber(style.scaleMultiplier, 1), opacity: toNumber(style.opacity, 1), offset: ensureVec3(style.offset, [0, 0, 0]) }; }
function normalizeType(raw = {}, index = 0) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return { id: String(source.id || `type_${index + 1}`), name: String(source.name || `类型 ${index + 1}`), resourceType: source.resourceType === 'model' ? 'model' : 'image', resourceUrl: String(source.resourceUrl || ''), color: String(source.color || '#07a6ff'), size: toNumber(source.size, 2), scale: toNumber(source.scale, 1), offset: ensureVec3(source.offset, [0, 0, 0]), visible: source.visible !== false };
}
function normalizePoint(raw = {}, index = 0, fallbackTypeId = 'default') {
    const source = raw && typeof raw === 'object' ? raw : {};
    const hasScale = source.scale !== null && source.scale !== undefined && String(source.scale).trim() !== '';
    return { ...source, id: String(source.id || `point_${index + 1}`), name: String(source.name || `点位 ${index + 1}`), typeId: String(source.typeId || fallbackTypeId), position: ensureVec3(source.position, [0, 0, 0]), scale: hasScale ? toNumber(source.scale, 1) : null, offset: source.offset === null || source.offset === undefined ? null : ensureVec3(source.offset, [0, 0, 0]), color: source.color ? String(source.color) : null, visible: source.visible !== false };
}
function getStateLabel(state) { return ({ normal: '默认态', hover: '悬停态', click: '点击态', highlight: '高亮态' }[state] || state); }
function isSupportedMarkerImageUrl(url) {
    const text = String(url || '').trim().toLowerCase();
    if (!text) return false;
    const pure = text.split('?')[0].split('#')[0];
    const ext = pure.includes('.') ? pure.slice(pure.lastIndexOf('.') + 1) : '';
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext);
}
function generateUniquePointId(prefix = 'point') {
    const idSet = new Set(points.value.map((item) => String(item.id || '')));
    let seed = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    while (idSet.has(seed)) {
        seed = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return seed;
}
async function commitPatch(patch) { await updateComponentConfig(props.componentId, patch); }
async function commitMapping(nextMapping) { await commitPatch({ dataMapping: nextMapping }); }

async function applyMappingTemplate() {
    const next = mergeDeep(mappingConfig.value, { template: mappingTemplate.value });
    if (mappingTemplate.value === 'separate') {
        next.paths.types = 'types';
        next.paths.points = 'points';
    } else if (mappingTemplate.value === 'list') {
        next.paths.list = 'list';
    } else if (mappingTemplate.value === 'grouped') {
        next.paths.types = 'types';
        next.paths.groupedPoints = 'points';
    }
    await commitMapping(next);
    toast.success(`映射模板已应用：${mappingTemplate.value}`);
}

async function enableMapping() {
    const next = mergeDeep(mappingConfig.value, { enabled: true, template: mappingTemplate.value });
    await commitMapping(next);
    toast.success('数据映射已启用');
}

async function updateMappingPath(key, value) {
    const next = mergeDeep(mappingConfig.value, { paths: { [key]: String(value || '') } });
    await commitMapping(next);
}

function createBindingSource() {
    return {
        id: `source_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: '点位快照数据源',
        mode: 'local',
        bindProperty: 'dataSnapshot',
        localDataFormat: 'json',
        localFileName: '',
        localDataContent: '{\n  "types": [],\n  "points": []\n}',
        dataPath: '',
        transformFn: `function transform(data) {\n  return data;\n}`
    };
}

function ensureSnapshotBinding() {
    const comp = component.value;
    if (!comp) return;
    const currentBinding = comp.dataBinding && typeof comp.dataBinding === 'object' ? comp.dataBinding : { enabled: true, sources: [] };
    const sources = Array.isArray(currentBinding.sources) ? [...currentBinding.sources] : [];
    if (!sources.find((item) => item?.bindProperty === 'dataSnapshot')) {
        sources.push(createBindingSource());
    }
    componentStore.updateDataBinding(comp.id, { ...currentBinding, enabled: true, sources });
    toast.success('已初始化快照绑定（bindProperty: dataSnapshot）');
}

async function updateStateStyle(state, key, value) {
    const typeId = currentType.value?.id;
    if (!typeId) return;
    const nextTypeStyles = mergeDeep(currentTypeStateStyles.value, { [state]: { [key]: value } });
    const nextMap = {
        ...(config.value.typeStateStyles && typeof config.value.typeStateStyles === 'object' ? config.value.typeStateStyles : {}),
        [typeId]: nextTypeStyles
    };
    await commitPatch({ typeStateStyles: nextMap });
}

async function updateStateOffset(state, axis, value) {
    const offset = ensureVec3(currentTypeStateStyles.value[state]?.offset, [0, 0, 0]);
    offset[axis] = toNumber(value, offset[axis]);
    await updateStateStyle(state, 'offset', offset);
}

async function resetCurrentTypeStateStyles() {
    const typeId = currentType.value?.id;
    if (!typeId) return;
    const currentMap = config.value.typeStateStyles && typeof config.value.typeStateStyles === 'object'
        ? { ...config.value.typeStateStyles }
        : {};
    delete currentMap[typeId];
    await commitPatch({ typeStateStyles: currentMap });
    toast.success(`已重置类型 ${typeId} 的状态样式`);
}

async function addType() {
    const id = `type_${Date.now()}`;
    const next = [...types.value, normalizeType({ id, name: `类型 ${types.value.length + 1}` }, types.value.length)];
    await commitPatch({ types: next });
    selectedTypeId.value = id;
}

async function removeType(typeId) {
    const nextTypes = types.value.filter((item) => item.id !== typeId);
    const fallbackTypeId = nextTypes[0]?.id || 'default';
    const nextPoints = points.value.map((item) => (item.typeId === typeId ? { ...item, typeId: fallbackTypeId } : item));
    await commitPatch({ types: nextTypes, points: nextPoints });
}

async function updateTypeField(key, value) {
    if (!currentType.value) return;
    const oldId = currentType.value.id;
    const newId = key === 'id' ? (String(value || '').trim() || oldId) : oldId;
    const nextTypes = types.value.map((item) => (item.id === oldId ? { ...item, [key]: value } : item));
    const patch = { types: nextTypes };
    if (key === 'id' && oldId !== newId) {
        const currentMap = config.value.typeStateStyles && typeof config.value.typeStateStyles === 'object'
            ? { ...config.value.typeStateStyles }
            : {};
        if (Object.prototype.hasOwnProperty.call(currentMap, oldId)) {
            currentMap[newId] = currentMap[oldId];
            delete currentMap[oldId];
            patch.typeStateStyles = currentMap;
        }
    }
    await commitPatch(patch);
    if (key === 'id' && oldId !== newId) {
        const nextPoints = points.value.map((item) => (item.typeId === oldId ? { ...item, typeId: newId } : item));
        await commitPatch({ points: nextPoints });
        selectedTypeId.value = newId;
    }
}

function openTypeEditModal(mode = 'basic') {
    if (!currentType.value) return;
    typeEditMode.value = mode;
    typeEditDraft.value = {
        ...currentType.value,
        offset: ensureVec3(currentType.value.offset, [0, 0, 0])
    };
    showTypeEditModal.value = true;
}

function updateTypeDraftField(key, value) {
    if (!typeEditDraft.value) return;
    typeEditDraft.value = {
        ...typeEditDraft.value,
        [key]: value
    };
}

function updateTypeDraftOffset(axis, value) {
    if (!typeEditDraft.value) return;
    const offset = ensureVec3(typeEditDraft.value.offset, [0, 0, 0]);
    offset[axis] = toNumber(value, offset[axis]);
    updateTypeDraftField('offset', offset);
}

async function saveTypeEditModal() {
    if (!typeEditDraft.value || !currentType.value) return;
    const oldId = currentType.value.id;
    const newId = String(typeEditDraft.value.id || '').trim() || oldId;
    const normalized = {
        ...currentType.value,
        ...typeEditDraft.value,
        id: newId,
        name: String(typeEditDraft.value.name || currentType.value.name || oldId),
        resourceType: typeEditDraft.value.resourceType === 'model' ? 'model' : 'image',
        resourceUrl: String(typeEditDraft.value.resourceUrl || '').trim(),
        color: String(typeEditDraft.value.color || '#07a6ff'),
        size: toNumber(typeEditDraft.value.size, 1),
        scale: toNumber(typeEditDraft.value.scale, 1),
        offset: ensureVec3(typeEditDraft.value.offset, [0, 0, 0]),
        visible: typeEditDraft.value.visible !== false
    };
    const nextTypes = types.value.map((item) => (item.id === oldId ? normalized : item));
    const patch = { types: nextTypes };
    if (oldId !== newId) {
        const currentMap = config.value.typeStateStyles && typeof config.value.typeStateStyles === 'object'
            ? { ...config.value.typeStateStyles }
            : {};
        if (Object.prototype.hasOwnProperty.call(currentMap, oldId)) {
            currentMap[newId] = currentMap[oldId];
            delete currentMap[oldId];
            patch.typeStateStyles = currentMap;
        }
    }
    await commitPatch(patch);
    if (oldId !== newId) {
        const nextPoints = points.value.map((item) => (item.typeId === oldId ? { ...item, typeId: newId } : item));
        await commitPatch({ points: nextPoints });
        selectedTypeId.value = newId;
    }
    showTypeEditModal.value = false;
    toast.success('类型配置已保存');
}

function openTypeAssetPicker() {
    const resourceType = typeEditDraft.value?.resourceType || currentType.value?.resourceType;
    if (!resourceType) return;
    assetPickerCategory.value = resourceType === 'model' ? 'model' : 'image';
    showAssetPicker.value = true;
}

async function handleTypeAssetSelect(asset) {
    showAssetPicker.value = false;
    if (!asset?.url) return;
    const resourceType = typeEditDraft.value?.resourceType || currentType.value?.resourceType;
    if (resourceType !== 'model' && !isSupportedMarkerImageUrl(asset.url)) {
        toast.warning('当前点位静态图仅支持常见图片格式（jpg/png/webp/gif/bmp/svg）');
        return;
    }
    if (showTypeEditModal.value && typeEditDraft.value) {
        updateTypeDraftField('resourceUrl', asset.url);
        toast.success('资源已填入弹窗，点击保存后生效');
        return;
    }
    await updateTypeField('resourceUrl', asset.url);
    toast.success('资源已绑定到当前类型');
}

async function updateTypeOffset(axis, value) {
    if (!currentType.value) return;
    const offset = ensureVec3(currentType.value.offset, [0, 0, 0]);
    offset[axis] = toNumber(value, offset[axis]);
    await updateTypeField('offset', offset);
}

async function addPoint() {
    if (points.value.length >= maxPoints.value) {
        toast.warning(`点位数量已达上限：${maxPoints.value}`);
        return;
    }
    const id = generateUniquePointId('point');
    const next = [...points.value, normalizePoint({ id, name: `点位 ${points.value.length + 1}`, typeId: selectedTypeId.value || types.value[0]?.id || 'default', position: [0, 0, 0] }, points.value.length, selectedTypeId.value || types.value[0]?.id || 'default')];
    await commitPatch({ points: next });
    selectedPointId.value = id;
    locateCurrentPointPage();
}

async function removePoint(pointId) {
    await commitPatch({ points: points.value.filter((item) => item.id !== pointId) });
}

async function updatePointField(key, value) {
    if (!currentPoint.value) return;
    const oldId = currentPoint.value.id;
    const newId = key === 'id' ? (String(value || '').trim() || oldId) : oldId;
    const next = points.value.map((item) => (item.id === oldId ? { ...item, [key]: value } : item));
    await commitPatch({ points: next });
    if (key === 'id') {
        selectedPointId.value = newId;
        locateCurrentPointPage();
    }
}

async function updatePointPosition(axis, value) {
    if (!currentPoint.value) return;
    const position = ensureVec3(currentPoint.value.position, [0, 0, 0]);
    position[axis] = toNumber(value, position[axis]);
    await updatePointField('position', position);
}

async function startPointPick() {
    if (!currentPoint.value) {
        toast.warning('请先选择一个点位');
        return;
    }
    showPointEditModal.value = false;
    showTypeEditModal.value = false;
    if (showUnifiedEditorModal.value) {
        showUnifiedEditorModal.value = false;
        await nextTick();
    }
    componentStore.startBuildingPicking(props.componentId, currentPoint.value.id);
    toast.info('已进入坐标拾取，请在画布点击模型表面');
}

function stopPointPick() {
    if (componentStore.buildingPicking?.componentId === props.componentId) {
        componentStore.stopBuildingPicking();
    }
}

async function confirmPointPickConfirm() {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== props.componentId) return;
    const targetPointId = String(pc.pointId || selectedPointId.value || '');
    const xyz = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => Math.round(n * 10000) / 10000);
    if (!targetPointId) {
        componentStore.clearBuildingPickConfirm();
        toast.warning('未找到目标点位');
        return;
    }
    const exists = points.value.some((item) => String(item.id || '') === targetPointId);
    if (!exists) {
        componentStore.clearBuildingPickConfirm();
        toast.warning(`点位不存在：${targetPointId}`);
        return;
    }
    const next = points.value.map((item) => (
        String(item.id || '') === targetPointId ? { ...item, position: xyz } : item
    ));
    await commitPatch({ points: next });
    selectedPointId.value = targetPointId;
    componentStore.clearBuildingPickConfirm();
    toast.success('拾取坐标已写入当前点位');
}

function cancelPointPickConfirm() {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== props.componentId) return;
    const pointId = String(pc.pointId || selectedPointId.value || '');
    componentStore.clearBuildingPickConfirm();
    componentStore.startBuildingPicking(props.componentId, pointId || null);
}

function handlePointPickConfirmClose() {
    componentStore.clearBuildingPickConfirm();
}

async function updatePointScale(value) {
    const text = String(value ?? '').trim();
    await updatePointField('scale', text ? toNumber(text, 1) : null);
}

async function updatePointColor(value) {
    const text = String(value || '').trim();
    await updatePointField('color', text || null);
}
function openPointEditModal() {
    if (!currentPoint.value) return;
    pointEditDraft.value = {
        ...currentPoint.value,
        id: String(currentPoint.value.id || ''),
        name: String(currentPoint.value.name || ''),
        typeId: String(currentPoint.value.typeId || ''),
        position: ensureVec3(currentPoint.value.position, [0, 0, 0]),
        scale: currentPoint.value.scale === null || currentPoint.value.scale === undefined ? '' : String(currentPoint.value.scale),
        color: currentPoint.value.color ? String(currentPoint.value.color) : '',
        visible: currentPoint.value.visible !== false
    };
    showPointEditModal.value = true;
}
function updatePointDraftField(key, value) {
    if (!pointEditDraft.value) return;
    pointEditDraft.value = {
        ...pointEditDraft.value,
        [key]: value
    };
}
function updatePointDraftPosition(axis, value) {
    if (!pointEditDraft.value) return;
    const nextPos = ensureVec3(pointEditDraft.value.position, [0, 0, 0]);
    nextPos[axis] = toNumber(value, nextPos[axis]);
    pointEditDraft.value = {
        ...pointEditDraft.value,
        position: nextPos
    };
}
async function savePointEditModal() {
    if (!currentPoint.value || !pointEditDraft.value) return;
    const oldId = String(currentPoint.value.id || '');
    const nextId = String(pointEditDraft.value.id || '').trim() || oldId;
    const nextName = String(pointEditDraft.value.name || '').trim() || currentPoint.value.name;
    const nextTypeId = String(pointEditDraft.value.typeId || '').trim() || currentPoint.value.typeId;
    const idTaken = points.value.some((item) => String(item.id || '') === nextId && String(item.id || '') !== oldId);
    if (idTaken) {
        toast.warning(`点位 ID 已存在：${nextId}`);
        return;
    }
    const typeExists = types.value.some((item) => String(item.id || '') === nextTypeId);
    if (!typeExists) {
        toast.warning(`点位类型不存在：${nextTypeId}`);
        return;
    }
    const nextColorText = String(pointEditDraft.value.color || '').trim();
    const nextScaleText = String(pointEditDraft.value.scale ?? '').trim();
    const patch = {
        ...currentPoint.value,
        id: nextId,
        name: nextName,
        typeId: nextTypeId,
        position: ensureVec3(pointEditDraft.value.position, [0, 0, 0]),
        scale: nextScaleText ? toNumber(nextScaleText, 1) : null,
        color: nextColorText || null,
        visible: pointEditDraft.value.visible !== false
    };
    const nextPoints = points.value.map((item) => (item.id === oldId ? patch : item));
    await commitPatch({ points: nextPoints });
    selectedPointId.value = nextId;
    locateCurrentPointPage();
    showPointEditModal.value = false;
    toast.success('点位已保存');
}

function getBatchTargetPoints() {
    return batchTypeId.value === 'all' ? points.value : points.value.filter((item) => item.typeId === batchTypeId.value);
}

function updateBatchOffset(axis, value) {
    const next = [...batchOffset.value];
    next[axis] = toNumber(value, next[axis] ?? 0);
    batchOffset.value = next;
}

async function applyBatchStyleOverrides() {
    const targets = getBatchTargetPoints();
    if (!targets.length) {
        toast.warning('当前筛选没有可编辑的点位');
        return;
    }
    const scaleText = String(batchScaleValue.value ?? '').trim();
    const colorText = String(batchColorValue.value ?? '').trim();
    const shouldSetScale = scaleText.length > 0;
    const shouldSetColor = colorText.length > 0;
    const shouldSetOffset = batchEnableOffset.value;
    const ids = { size: targets.length };
    const dx = toNumber(batchOffset.value?.[0], 0);
    const dy = toNumber(batchOffset.value?.[1], 0);
    const dz = toNumber(batchOffset.value?.[2], 0);
    if (!shouldSetScale && !shouldSetColor && !shouldSetOffset) {
        toast.warning('没有可应用的批量配置');
        return;
    }
    const idSet = new Set(targets.map((item) => item.id));
    startOperationRecord(`批量移动 ${ids.size} 个点位（${dx}, ${dy}, ${dz}）`);
    attachLastLogPointIds(targets.map((item) => item.id));
    const next = points.value.map((item) => {
        if (!idSet.has(item.id)) return item;
        const updated = { ...item };
        if (shouldSetScale) updated.scale = toNumber(scaleText, item.scale ?? 1);
        if (shouldSetColor) updated.color = colorText;
        if (shouldSetOffset) updated.offset = ensureVec3(batchOffset.value, [0, 0, 0]);
        return updated;
    });
    await commitPatch({ points: next });
    toast.success(`已批量更新 ${targets.length} 个点位`);
}

async function clearBatchScaleOverride() {
    const targets = getBatchTargetPoints();
    const idSet = new Set(targets.map((item) => item.id));
    startOperationRecord(`批量清空缩放覆盖 ${targets.length} 个点位`);
    attachLastLogPointIds(targets.map((item) => item.id));
    await commitPatch({ points: points.value.map((item) => (idSet.has(item.id) ? { ...item, scale: null } : item)) });
    toast.success(`已清空 ${targets.length} 个点位的缩放覆盖`);
}

async function clearBatchColorOverride() {
    const targets = getBatchTargetPoints();
    const idSet = new Set(targets.map((item) => item.id));
    startOperationRecord(`批量清空颜色覆盖 ${targets.length} 个点位`);
    attachLastLogPointIds(targets.map((item) => item.id));
    await commitPatch({ points: points.value.map((item) => (idSet.has(item.id) ? { ...item, color: null } : item)) });
    toast.success(`已清空 ${targets.length} 个点位的颜色覆盖`);
}

async function clearBatchOffsetOverride() {
    const targets = getBatchTargetPoints();
    const idSet = new Set(targets.map((item) => item.id));
    startOperationRecord(`批量清空偏移覆盖 ${targets.length} 个点位`);
    attachLastLogPointIds(targets.map((item) => item.id));
    await commitPatch({ points: points.value.map((item) => (idSet.has(item.id) ? { ...item, offset: null } : item)) });
    toast.success(`已清空 ${targets.length} 个点位的偏移覆盖`);
}

function previewHighlight(enabled) {
    const instance = component.value?.instance;
    const pointId = currentPoint.value?.id;
    if (instance && pointId && typeof instance.setPointState === 'function') {
        instance.setPointState(pointId, 'highlight', !!enabled);
    }
}

function previewState(state, enabled) {
    const instance = component.value?.instance;
    const pointId = currentPoint.value?.id;
    if (instance && pointId && typeof instance.setPointState === 'function') {
        instance.setPointState(pointId, state, !!enabled);
    }
}

function clearAllStates() {
    const instance = component.value?.instance;
    if (instance && typeof instance.clearAllStates === 'function') {
        instance.clearAllStates();
    }
}

function updatePointKeyword(value) { pointKeyword.value = String(value || ''); pointPage.value = 1; }
function updatePointPageSize(value) { pointPageSize.value = Math.max(1, Number(value || 100)); pointPage.value = 1; }
function updatePointSortMode(value) { pointSortMode.value = String(value || 'name_asc'); pointPage.value = 1; }
function prevPointPage() { pointPage.value = Math.max(1, pointPage.value - 1); }
function nextPointPage() { pointPage.value = Math.min(pointTotalPages.value, pointPage.value + 1); }
function locateCurrentPointPage() {
    const index = sortedPoints.value.findIndex((item) => item.id === selectedPointId.value);
    if (index < 0) return;
    pointPage.value = Math.floor(index / Math.max(1, Number(pointPageSize.value || 100))) + 1;
}
function isPointChecked(pointId) {
    return checkedPointIds.value.includes(pointId);
}
function togglePointChecked(pointId, checked) {
    const id = String(pointId || '');
    if (!id) return;
    if (checked) {
        if (!checkedPointIds.value.includes(id)) {
            checkedPointIds.value = [...checkedPointIds.value, id];
        }
        return;
    }
    checkedPointIds.value = checkedPointIds.value.filter((item) => item !== id);
}
function toggleCurrentPageAllChecked(checked) {
    const pageIds = pagedPoints.value.map((item) => item.id);
    if (checked) {
        const merged = new Set([...checkedPointIds.value, ...pageIds]);
        checkedPointIds.value = Array.from(merged);
        return;
    }
    const pageSet = new Set(pageIds);
    checkedPointIds.value = checkedPointIds.value.filter((id) => !pageSet.has(id));
}
function clearCheckedPoints() {
    checkedPointIds.value = [];
}
function clonePointsSnapshot() {
    return points.value.map((item) => ({
        ...item,
        position: ensureVec3(item.position, [0, 0, 0]),
        offset: item.offset === null || item.offset === undefined ? null : ensureVec3(item.offset, [0, 0, 0])
    }));
}
function formatNowTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}
function addOperationLog(text, pointIds = []) {
    const next = [
        {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            time: formatNowTime(),
            text: String(text || ''),
            pointIds: Array.isArray(pointIds) ? pointIds.map((id) => String(id || '')).filter(Boolean) : []
        },
        ...operationLogList.value
    ].slice(0, MAX_OPERATION_LOGS);
    operationLogList.value = next;
}
function attachLastLogPointIds(pointIds = []) {
    if (!operationLogList.value.length) return;
    const ids = Array.isArray(pointIds) ? pointIds.map((id) => String(id || '')).filter(Boolean) : [];
    operationLogList.value = operationLogList.value.map((item, index) => (
        index === 0 ? { ...item, pointIds: ids } : item
    ));
}
function startOperationRecord(label, pointIds = []) {
    undoStack.value = [clonePointsSnapshot(), ...undoStack.value].slice(0, MAX_UNDO_STEPS);
    redoStack.value = [];
    if (label) addOperationLog(label, pointIds);
}
function clearOperationLogs() {
    operationLogList.value = [];
}
async function undoLastOperation() {
    if (!undoStack.value.length) {
        toast.warning('暂无可撤销操作');
        return;
    }
    const current = clonePointsSnapshot();
    const [previous, ...rest] = undoStack.value;
    undoStack.value = rest;
    redoStack.value = [current, ...redoStack.value].slice(0, MAX_UNDO_STEPS);
    await commitPatch({ points: previous });
    addOperationLog('撤销上一步操作');
    toast.success('已撤销上一步');
}
async function redoLastOperation() {
    if (!redoStack.value.length) {
        toast.warning('暂无可重做操作');
        return;
    }
    const current = clonePointsSnapshot();
    const [next, ...rest] = redoStack.value;
    redoStack.value = rest;
    undoStack.value = [current, ...undoStack.value].slice(0, MAX_UNDO_STEPS);
    await commitPatch({ points: next });
    addOperationLog('重做上一步操作');
    toast.success('已重做上一步');
}
function clearHistoryStacks() {
    undoStack.value = [];
    redoStack.value = [];
    addOperationLog('已清空撤销/重做栈');
}
function focusLogEntry(log) {
    const pointIds = Array.isArray(log?.pointIds) ? log.pointIds : [];
    if (!pointIds.length) return;
    const firstId = String(pointIds[0] || '');
    if (!firstId) return;
    selectedPointId.value = firstId;
    locateCurrentPointPage();
}
function isEditableElement(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}
function handleGlobalKeydown(event) {
    if (!event) return;
    const ctrlOrMeta = event.ctrlKey || event.metaKey;
    if (!ctrlOrMeta || event.altKey) return;
    if (isEditableElement(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoLastOperation();
        return;
    }
    if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoLastOperation();
    }
}
onMounted(() => {
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', handleGlobalKeydown);
    }
});
onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleGlobalKeydown);
    }
    if (componentStore.buildingPicking?.componentId === props.componentId) {
        componentStore.stopBuildingPicking();
    }
    if (componentStore.buildingPickConfirm?.componentId === props.componentId) {
        componentStore.clearBuildingPickConfirm();
    }
});
function updateCheckedMoveOffset(axis, value) {
    const next = [...checkedMoveOffset.value];
    next[axis] = toNumber(value, next[axis] ?? 0);
    checkedMoveOffset.value = next;
}
function confirmCheckedAction(message) {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
    return window.confirm(message);
}
async function moveCheckedPoints() {
    const ids = new Set(checkedPointIds.value);
    if (!ids.size) {
        toast.warning('请先勾选点位');
        return;
    }
    const dx = toNumber(checkedMoveOffset.value[0], 0);
    const dy = toNumber(checkedMoveOffset.value[1], 0);
    const dz = toNumber(checkedMoveOffset.value[2], 0);
    if (dx === 0 && dy === 0 && dz === 0) {
        toast.warning('移动偏移不能全为 0');
        return;
    }
    if (!confirmCheckedAction(`确认移动已勾选的 ${ids.size} 个点位吗？`)) {
        return;
    }
    const next = points.value.map((item) => {
        if (!ids.has(item.id)) return item;
        const position = ensureVec3(item.position, [0, 0, 0]);
        return { ...item, position: [position[0] + dx, position[1] + dy, position[2] + dz] };
    });
    await commitPatch({ points: next });
    toast.success(`已移动 ${ids.size} 个点位`);
}
async function changeCheckedPointsType() {
    const ids = new Set(checkedPointIds.value);
    if (!ids.size) {
        toast.warning('请先勾选点位');
        return;
    }
    const targetTypeId = String(checkedTargetTypeId.value || '').trim();
    if (!targetTypeId) {
        toast.warning('请选择目标类型');
        return;
    }
    if (!types.value.some((item) => item.id === targetTypeId)) {
        toast.warning('目标类型不存在');
        return;
    }
    if (!confirmCheckedAction(`确认将已勾选的 ${ids.size} 个点位改为类型 ${targetTypeId} 吗？`)) {
        return;
    }
    startOperationRecord(`批量改类型 ${ids.size} 个点位 -> ${targetTypeId}`);
    const next = points.value.map((item) => (ids.has(item.id) ? { ...item, typeId: targetTypeId } : item));
    await commitPatch({ points: next });
    toast.success(`已更新 ${ids.size} 个点位类型`);
}
async function removeCheckedPoints() {
    const ids = new Set(checkedPointIds.value);
    if (!ids.size) {
        toast.warning('请先勾选点位');
        return;
    }
    if (!confirmCheckedAction(`确认删除已勾选的 ${ids.size} 个点位吗？`)) {
        return;
    }
    startOperationRecord(`批量删除 ${ids.size} 个点位`);
    const next = points.value.filter((item) => !ids.has(item.id));
    await commitPatch({ points: next });
    if (selectedPointId.value && ids.has(selectedPointId.value)) {
        selectedPointId.value = '';
    }
    checkedPointIds.value = [];
    toast.success(`已删除 ${ids.size} 个点位`);
}
async function setCheckedPointsVisible(visible) {
    const ids = new Set(checkedPointIds.value);
    if (!ids.size) {
        toast.warning('请先勾选点位');
        return;
    }
    startOperationRecord(`批量设为${visible ? '可见' : '隐藏'} ${ids.size} 个点位`);
    const next = points.value.map((item) => (ids.has(item.id) ? { ...item, visible } : item));
    await commitPatch({ points: next });
    toast.success(`已将 ${ids.size} 个点位设为${visible ? '可见' : '隐藏'}`);
}

function triggerImport() { fileInputRef.value?.click(); }
function triggerSnapshotImport() { snapshotFileInputRef.value?.click(); }

async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed)) throw new Error('JSON 必须是数组');
        const fallbackTypeId = selectedTypeId.value || types.value[0]?.id || 'default';
        await commitPatch({ points: parsed.map((item, index) => normalizePoint(item, index, fallbackTypeId)) });
        toast.success('导入点位成功');
    } catch (error) {
        toast.error(`导入失败：${error.message}`);
    } finally {
        event.target.value = '';
    }
}

function exportPoints() {
    const blob = new Blob([JSON.stringify(points.value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `点位数据-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function handleSnapshotImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        await commitPatch({ dataSnapshot: JSON.parse(await file.text()) });
        toast.success('快照 JSON 导入成功');
    } catch (error) {
        toast.error(`快照导入失败：${error.message}`);
    } finally {
        event.target.value = '';
    }
}

function exportSnapshot() {
    const blob = new Blob([JSON.stringify(config.value.dataSnapshot ?? {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `点位快照-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function reapplySnapshotMapping() {
    const snapshot = config.value.dataSnapshot;
    if (snapshot === null || snapshot === undefined) {
        toast.warning('暂无快照数据');
        return;
    }
    let next = snapshot;
    try { next = JSON.parse(JSON.stringify(snapshot)); } catch {}
    await commitPatch({ dataSnapshot: next });
    toast.success('已重新执行快照映射');
}
</script>

<style scoped>
.ptm-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ptm-section {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background: var(--color-bg-secondary);
    padding: 10px;
}

.ptm-section__title {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
}

.ptm-summary {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--color-text-tertiary);
}

.ptm-unified-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 72vh;
    overflow: auto;
    padding-right: 4px;
}

.ptm-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
}

.ptm-action-select {
    min-width: 220px;
}

.ptm-resource-input {
    flex: 1 1 auto;
    min-width: 260px;
}

.hidden-input {
    display: none;
}

.ptm-grid {
    display: grid;
    gap: 12px;
}

.ptm-grid--2 {
    grid-template-columns: 1fr 1fr;
}

.ptm-grid--3 {
    grid-template-columns: repeat(3, 1fr);
    margin-top: 8px;
}

.ptm-grid--4 {
    grid-template-columns: repeat(4, 1fr);
}

.ptm-card {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    padding: 10px;
    background: var(--color-bg-secondary);
    max-height: 520px;
    overflow: auto;
}

.ptm-point-manager-card {
    grid-column: 1 / -1;
}

.ptm-point-edit-inline {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--color-border);
}

.ptm-card__title {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
}

.ptm-empty {
    font-size: 12px;
    color: var(--color-text-tertiary);
}

.ptm-item-btn {
    width: 100%;
    text-align: left;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    margin-bottom: 6px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    cursor: pointer;
}

.ptm-item-btn.active {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
}

.ptm-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ptm-item-sub {
    font-size: 12px;
    color: var(--color-text-tertiary);
}

.ptm-item-check {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin-top: 2px;
}

.ptm-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ptm-vec3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
}

.ptm-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.ptm-batch-grid {
    align-items: end;
}

.ptm-batch-offset {
    margin-top: 8px;
}

.ptm-batch-count {
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 12px;
    display: flex;
    align-items: center;
    padding: 0 10px;
}

.ptm-point-tools {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
}

.ptm-point-tools-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    align-items: end;
}

.ptm-page-info {
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 12px;
    display: flex;
    align-items: center;
    padding: 0 10px;
}

.ptm-point-summary {
    font-size: 12px;
    color: var(--color-text-tertiary);
}

.ptm-type-select {
    min-width: 180px;
}

.ptm-point-brief {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
    padding: 8px;
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
}

.ptm-type-brief {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
    padding: 8px;
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
}

.ptm-ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.ptm-modal-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.ptm-log-list {
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-tertiary);
    padding: 8px;
    max-height: 140px;
    overflow: auto;
}

.ptm-log-title {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
}

.ptm-log-item {
    display: flex;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-bottom: 4px;
    width: 100%;
    border: none;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
}

.ptm-log-time {
    flex: 0 0 auto;
    font-family: var(--font-mono);
}

.ptm-log-text {
    flex: 1 1 auto;
    min-width: 0;
}
</style>
