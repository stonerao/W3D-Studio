<template>
    <div class="variables-editor">
        <!-- 工具栏 -->
        <div class="toolbar">
            <div class="toolbar-row">
                <div class="toolbar-primary">
                    <Button size="sm" @click="handleAddVariable">
                        <span class="toolbar-btn-content">
                            <i class="sico icon-xinjian toolbar-btn-icon" aria-hidden="true"></i>
                            <span>添加</span>
                        </span>
                    </Button>
                </div>
                <div class="toolbar-actions">
                    <Button size="sm" variant="outline" @click="handleImport" title="导入变量">
                        <span class="toolbar-btn-content">
                            <i class="sico icon-daoru_o toolbar-btn-icon" aria-hidden="true"></i>
                            <span>导入</span>
                        </span>
                    </Button>
                    <Button size="sm" variant="outline" @click="handleExport" title="导出变量">
                        <span class="toolbar-btn-content">
                            <i class="sico icon-daochu_o toolbar-btn-icon" aria-hidden="true"></i>
                            <span>导出</span>
                        </span>
                    </Button>
                </div>
            </div>
            <div class="toolbar-summary">
                <span>变量 {{ variableStore.variables.length }}</span>
                <span v-if="hasActiveFilters">当前 {{ filteredVariables.length }}</span>
            </div>
        </div>

        <!-- 搜索与过滤 -->
        <div class="filter-box">
            <Input
                v-model="searchKeyword"
                placeholder="搜索名称、分组或描述"
                size="sm"
            />
            <div class="filter-row">
                <Select v-model="typeFilter" :options="typeFilterOptions" />
                <Select v-model="groupFilter" :options="groupFilterOptions" />
                <Button
                    v-if="hasActiveFilters"
                    size="sm"
                    variant="ghost"
                    class="filter-clear"
                    @click="clearFilters"
                >
                    清除
                </Button>
            </div>
        </div>

        <!-- 变量列表 -->
        <div class="variable-list">
            <div v-if="filteredVariables.length === 0" class="empty-state">
                <div class="empty-icon">
                    <i class="sico icon-gongzuotaimorentubiao" aria-hidden="true"></i>
                </div>
                <div class="empty-text">暂无变量</div>
                <div class="empty-hint">点击"添加变量"创建第一个变量</div>
            </div>

            <div
                v-for="variable in filteredVariables"
                :key="variable.id"
                class="variable-item"
                :class="{ selected: selectedVariableId === variable.id }"
                @click="selectVariable(variable.id)"
                @dblclick.stop="openEditModal(variable)"
            >
                <div class="variable-header">
                    <span :class="['variable-icon', getTypeIconClass(variable.type)]">{{ getTypeIcon(variable.type) }}</span>
                    <div class="variable-meta">
                        <span class="variable-name">{{ variable.name }}</span>
                        <span class="variable-type">{{ getTypeLabel(variable.type) }}</span>
                    </div>
                    <div class="variable-actions">
                        <button type="button" class="variable-action" title="编辑变量" @click.stop="openEditModal(variable)">
                            编辑
                        </button>
                        <button type="button" class="variable-action" title="重置为默认值" @click.stop="handleReset(variable)">
                            重置
                        </button>
                    </div>
                </div>
                <div class="variable-value">
                    {{ formatValue(variable.value, variable.type) }}
                </div>
                <div class="variable-footer">
                    <span>{{ variable.group || '默认' }}</span>
                    <span v-if="variable.updatedAt">更新 {{ formatTime(variable.updatedAt) }}</span>
                </div>
                <div v-if="variable.description" class="variable-desc">
                    {{ variable.description }}
                </div>
            </div>
        </div>

        <!-- 变量编辑弹窗 -->
        <Modal v-model="showEditModal" :title="isEditing ? '编辑变量' : '添加变量'" width="480px">
            <div class="edit-form">
                <!-- 变量名 -->
                <div class="form-group">
                    <label>变量名 <span class="required">*</span></label>
                    <Input
                        v-model="editForm.name"
                        placeholder="如: myVariable"
                        :class="{ 'input-error': nameError }"
                    />
                    <div v-if="nameError" class="error-text">{{ nameError }}</div>
                </div>

                <!-- 类型 -->
                <div class="form-group">
                    <label>类型 <span class="required">*</span></label>
                    <Select
                        v-model="editForm.type"
                        :options="typeOptions"
                        @update:model-value="handleTypeChange"
                    />
                </div>

                <!-- 值编辑器 -->
                <div class="form-group">
                    <label>值</label>
                    <VariableValueEditor
                        v-model="editForm.value"
                        :type="editForm.type"
                    />
                </div>

                <!-- 默认值 -->
                <div class="form-group">
                    <label>默认值</label>
                    <VariableValueEditor
                        v-model="editForm.defaultValue"
                        :type="editForm.type"
                    />
                </div>

                <!-- 描述 -->
                <div class="form-group">
                    <label>描述</label>
                    <Input
                        v-model="editForm.description"
                        placeholder="变量用途说明"
                    />
                </div>

                <!-- 分组 -->
                <div class="form-group">
                    <label>分组</label>
                    <Input
                        v-model="editForm.group"
                        placeholder="默认"
                        list="group-list"
                    />
                    <datalist id="group-list">
                        <option v-for="group in groupNames" :key="group" :value="group" />
                    </datalist>
                </div>
            </div>

            <template #footer>
                <div class="modal-actions">
                    <Button v-if="isEditing" variant="danger" @click="handleDelete">
                        删除
                    </Button>
                    <div class="spacer"></div>
                    <Button variant="outline" @click="showEditModal = false">
                        取消
                    </Button>
                    <Button @click="handleSave">
                        {{ isEditing ? '保存' : '添加' }}
                    </Button>
                </div>
            </template>
        </Modal>

        <!-- 导入弹窗 -->
        <Modal v-model="showImportModal" title="导入变量" width="500px">
            <div class="import-form">
                <div class="form-group">
                    <label>JSON 数据</label>
                    <textarea
                        v-model="importJson"
                        class="json-textarea"
                        rows="10"
                        placeholder='[{"name": "var1", "type": "number", "value": 0}]'
                    ></textarea>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="importMerge" />
                        合并模式（保留现有变量，跳过重名）
                    </label>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showImportModal = false">取消</Button>
                <Button @click="confirmImport">导入</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import '../../styles/icon/iconfont.css';
import { useVariableStore, VARIABLE_TYPES, VARIABLE_TYPE_CONFIG } from '../../stores/useVariableStore';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Modal from '../ui/Modal.vue';
import VariableValueEditor from './VariableValueEditor.vue';

const variableStore = useVariableStore();
const toast = useToast();
const { confirm: showConfirm } = useConfirm();

// 搜索
const searchKeyword = ref('');
const typeFilter = ref('all');
const groupFilter = ref('all');

// 选中的变量
const selectedVariableId = ref(null);

// 编辑弹窗
const showEditModal = ref(false);
const isEditing = ref(false);
const editingId = ref(null);

// 编辑表单
const editForm = ref({
    name: '',
    type: VARIABLE_TYPES.NUMBER,
    value: 0,
    defaultValue: 0,
    description: '',
    group: '默认'
});

// 名称错误
const nameError = ref('');

// 导入弹窗
const showImportModal = ref(false);
const importJson = ref('');
const importMerge = ref(false);

// 类型选项
const typeOptions = computed(() => {
    return Object.entries(VARIABLE_TYPE_CONFIG).map(([key, config]) => ({
        label: `${config.icon} ${config.label}`,
        value: key
    }));
});

const typeFilterOptions = computed(() => [
    { label: '全部类型', value: 'all' },
    ...typeOptions.value
]);

// 分组名称列表
const groupNames = computed(() => variableStore.groupNames);

const groupFilterOptions = computed(() => [
    { label: '全部分组', value: 'all' },
    ...groupNames.value.map((group) => ({
        label: group,
        value: group
    }))
]);

const hasActiveFilters = computed(() => (
    Boolean(searchKeyword.value.trim()) ||
    typeFilter.value !== 'all' ||
    groupFilter.value !== 'all'
));

// 过滤后的变量列表
const filteredVariables = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase();
    return [...variableStore.variables]
        .filter((variable) => typeFilter.value === 'all' || variable.type === typeFilter.value)
        .filter((variable) => groupFilter.value === 'all' || (variable.group || '默认') === groupFilter.value)
        .filter((variable) => {
            if (!keyword) return true;
            return (
                variable.name.toLowerCase().includes(keyword) ||
                getTypeLabel(variable.type).toLowerCase().includes(keyword) ||
                String(variable.description || '').toLowerCase().includes(keyword) ||
                String(variable.group || '').toLowerCase().includes(keyword)
            );
        })
        .sort((a, b) => {
            const groupCompare = String(a.group || '默认').localeCompare(String(b.group || '默认'), 'zh-Hans-CN');
            if (groupCompare !== 0) return groupCompare;
            return a.name.localeCompare(b.name, 'zh-Hans-CN');
        });
});

const clearFilters = () => {
    searchKeyword.value = '';
    typeFilter.value = 'all';
    groupFilter.value = 'all';
};

// 获取类型图标
const getTypeIcon = (type) => {
    return VARIABLE_TYPE_CONFIG[type]?.icon || '';
};

const getTypeIconClass = (type) => {
    return `variable-icon--${type || 'default'}`;
};

// 获取类型标签
const getTypeLabel = (type) => {
    return VARIABLE_TYPE_CONFIG[type]?.label || type;
};

// 格式化显示值
const formatValue = (value, type) => {
    if (value === null || value === undefined) return '(空)';
    const trimLongText = (text) => text.length > 160 ? `${text.slice(0, 157)}...` : text;

    switch (type) {
        case VARIABLE_TYPES.BOOLEAN:
            return value ? 'true' : 'false';
        case VARIABLE_TYPES.ARRAY:
        case VARIABLE_TYPES.OBJECT:
            return trimLongText(JSON.stringify(value));
        case VARIABLE_TYPES.VECTOR2: {
            const vector = Array.isArray(value) ? value : [0, 0];
            return `[${vector[0] ?? 0}, ${vector[1] ?? 0}]`;
        }
        case VARIABLE_TYPES.VECTOR3: {
            const vector = Array.isArray(value) ? value : [0, 0, 0];
            return `[${vector[0] ?? 0}, ${vector[1] ?? 0}, ${vector[2] ?? 0}]`;
        }
        default:
            return trimLongText(String(value));
    }
};

const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 选中变量
const selectVariable = (id) => {
    selectedVariableId.value = id;
};

// 打开添加弹窗
const handleAddVariable = () => {
    isEditing.value = false;
    editingId.value = null;
    editForm.value = {
        name: '',
        type: VARIABLE_TYPES.NUMBER,
        value: 0,
        defaultValue: 0,
        description: '',
        group: '默认'
    };
    nameError.value = '';
    showEditModal.value = true;
};

// 打开编辑弹窗
const openEditModal = (variable) => {
    isEditing.value = true;
    editingId.value = variable.id;
    editForm.value = {
        name: variable.name,
        type: variable.type,
        value: variable.value,
        defaultValue: variable.defaultValue,
        description: variable.description || '',
        group: variable.group || '默认'
    };
    nameError.value = '';
    showEditModal.value = true;
};

// 类型改变时重置值
const handleTypeChange = (newType) => {
    const defaultVal = variableStore.getDefaultValue(newType);
    editForm.value.value = defaultVal;
    editForm.value.defaultValue = defaultVal;
};

const handleReset = (variable) => {
    try {
        variableStore.resetToDefault(variable.id);
        toast.success('变量已重置');
    } catch (error) {
        toast.error(error.message);
    }
};

// 验证名称
const validateName = () => {
    const validation = variableStore.validateName(editForm.value.name);
    if (!validation.valid) {
        nameError.value = validation.message;
        return false;
    }

    if (variableStore.isNameExists(editForm.value.name, editingId.value)) {
        nameError.value = `变量名 "${editForm.value.name}" 已存在`;
        return false;
    }

    nameError.value = '';
    return true;
};

// 保存变量
const handleSave = () => {
    if (!validateName()) return;

    try {
        if (isEditing.value) {
            variableStore.updateVariable(editingId.value, editForm.value);
            toast.success('变量已更新');
        } else {
            variableStore.addVariable(editForm.value);
            toast.success('变量已添加');
        }
        showEditModal.value = false;
    } catch (error) {
        toast.error(error.message);
    }
};

// 删除变量
const handleDelete = async () => {
    if (!editingId.value) return;

    const confirmed = await showConfirm('确定要删除这个变量吗？', {
        title: '删除变量',
        variant: 'danger',
        confirmText: '删除'
    });
    if (confirmed) {
        variableStore.removeVariable(editingId.value);
        toast.success('变量已删除');
        showEditModal.value = false;
        selectedVariableId.value = null;
    }
};

// 导出
const handleExport = () => {
    const json = variableStore.exportToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'variables.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('变量已导出');
};

// 打开导入弹窗
const handleImport = () => {
    importJson.value = '';
    importMerge.value = false;
    showImportModal.value = true;
};

// 确认导入
const confirmImport = () => {
    const result = variableStore.importFromJson(importJson.value, importMerge.value);
    if (result.success) {
        toast.success(`成功导入 ${result.count} 个变量`);
        showImportModal.value = false;
    } else {
        toast.error(`导入失败: ${result.error}`);
    }
};

// 监听名称输入，实时验证
watch(() => editForm.value.name, () => {
    if (editForm.value.name) {
        validateName();
    } else {
        nameError.value = '';
    }
});
</script>

<style scoped>
.variables-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    min-height: 0;
    gap: var(--left-panel-content-gap);
    padding: var(--left-panel-content-padding) var(--left-panel-content-padding) 0;
}

.toolbar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex: 0 0 auto;
    gap: 0;
    height: auto;
    margin-bottom: 0;
    background-color: transparent;
    border-bottom: 0;
    padding: 0;
}

.toolbar-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--left-panel-list-gap);
    min-height: var(--left-panel-control-height);
    min-width: 0;
}

.toolbar-primary {
    flex: 0 0 auto;
    min-width: 0;
}

.toolbar-primary :deep(.btn) {
    height: var(--left-panel-control-height);
    min-width: 70px;
}

.toolbar-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}

.toolbar-actions :deep(.btn) {
    height: var(--left-panel-control-height);
    min-width: 70px;
}

.toolbar-btn-content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.toolbar-btn-icon {
    font-size: 14px;
    line-height: 1;
}

.toolbar-summary {
    font-size: 12px;
    color: var(--color-text-secondary);
    padding: 0 2px;
    line-height: 1.4;
    word-break: break-all;
}

.filter-box {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 0;
    min-width: 0;
}

.filter-box :deep(.input),
.filter-box :deep(.select) {
    height: var(--left-panel-control-height);
    border-radius: var(--left-panel-control-radius);
    font-size: var(--font-size-sm);
}

.filter-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-width: 0;
}

.filter-clear {
    min-width: 48px;
}

.variable-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--left-panel-list-gap);
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 2px;
    padding-bottom: var(--left-panel-content-padding);
    min-width: 0;
    scrollbar-gutter: stable;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 180px;
    padding: 0 var(--space-3) var(--left-panel-content-padding);
    text-align: center;
    color: var(--color-text-secondary);
}

.empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-bottom: 10px;
    border: 1px solid rgba(47, 125, 244, 0.46);
    border-radius: var(--left-panel-control-radius);
    background: rgba(47, 125, 244, 0.12);
    color: var(--color-primary);
    font-size: 16px;
    line-height: 1;
}

.empty-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
}

.empty-hint {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
}

.variable-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: var(--left-panel-card-min-height);
    padding: var(--left-panel-card-padding);
    background: var(--left-panel-card-bg);
    border: 1px solid var(--left-panel-card-border);
    border-radius: var(--left-panel-card-radius);
    cursor: pointer;
    transition: all 0.2s;
    min-width: 0;
}

.variable-item:hover {
    border-color: var(--left-panel-card-border-hover);
    background: var(--left-panel-card-bg-hover);
}

.variable-item.selected {
    border-color: var(--color-primary);
    background: var(--color-bg-tertiary);
    box-shadow: 0 0 0 1px rgba(47, 125, 244, 0.18);
}

.variable-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: 0;
    min-width: 0;
}

.variable-icon {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    border-radius: 999px;
    background: var(--color-bg-tertiary);
    flex-shrink: 0;
}

.variable-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    flex: 1;
}

.variable-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.variable-action {
    height: 22px;
    padding: 0 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-tertiary);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
}

.variable-action:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(47, 125, 244, 0.1);
}

.variable-icon--number {
    background: rgba(6, 182, 212, 0.12);
}

.variable-icon--boolean {
    background: rgba(34, 197, 94, 0.12);
}

.variable-icon--string {
    background: rgba(249, 115, 22, 0.12);
}

.variable-icon--array {
    background: rgba(168, 85, 247, 0.12);
}

.variable-icon--object {
    background: rgba(59, 130, 246, 0.12);
}

.variable-icon--vector2,
.variable-icon--vector3 {
    background: rgba(236, 72, 153, 0.12);
}

.variable-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    line-height: 1.35;
    color: var(--color-text-primary);
    min-width: 0;
    flex: 1;
    word-break: break-all;
}

.variable-type {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--color-bg-tertiary);
    border-radius: 4px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
    line-height: 1.3;
}

.variable-value {
    font-family: monospace;
    font-size: 12px;
    color: var(--color-primary);
    margin-top: 6px;
    margin-bottom: 0;
    line-height: 1.45;
    word-break: break-all;
    white-space: pre-wrap;
}

.variable-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-text-tertiary);
    line-height: 1.35;
}

.variable-desc {
    font-size: 11px;
    margin-top: 4px;
    color: var(--color-text-tertiary);
    line-height: 1.45;
}

/* 编辑表单 */
.edit-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
}

.required {
    color: #ef4444;
}

.input-error {
    border-color: #ef4444 !important;
}

.error-text {
    font-size: 12px;
    color: #ef4444;
}

.modal-actions {
    display: flex;
    gap: 8px;
    width: 100%;
}

.modal-actions .spacer {
    flex: 1;
}

/* 导入表单 */
.import-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.json-textarea {
    width: 100%;
    padding: 12px;
    font-family: monospace;
    font-size: 12px;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    resize: vertical;
}

.json-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.checkbox-label input {
    width: 16px;
    height: 16px;
}

@media (max-width: 360px) {
    .toolbar-row {
        flex-direction: column;
        align-items: stretch;
    }

    .toolbar-actions {
        width: 100%;
    }

    .toolbar-actions :deep(.btn) {
        flex: 1;
        min-width: 0;
    }

    .toolbar-btn-content {
        width: 100%;
        justify-content: center;
    }

    .variable-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }

    .variable-type {
        align-self: flex-start;
    }

    .filter-row {
        grid-template-columns: 1fr;
    }

    .variable-actions {
        width: 100%;
    }

    .variable-action {
        flex: 1;
    }
}
</style>
