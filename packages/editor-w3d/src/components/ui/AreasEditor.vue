<template>
    <div class="areas-editor">
        <div v-if="areas.length === 0" class="empty-state">
            <div class="empty-icon"></div>
            <div class="empty-text">暂无区域块</div>
        </div>

        <Accordion
            v-else
            :items="accordionItems"
            :default-open="areas.length === 1 ? [areas[0].id] : []"
        >
            <template v-for="area in areas" :key="area.id" #[area.id]>
                <div class="area-content">
                    <!-- 区域 ID -->
                    <div class="form-field">
                        <label class="form-label">区域 ID</label>
                        <Input
                            :model-value="area.id"
                            @update:model-value="updateAreaId(area.id, $event)"
                            placeholder="area_1"
                            size="sm"
                        />
                    </div>

                    <!-- 点坐标编辑器 -->
                    <div class="form-field">
                        <label class="form-label">点坐标</label>
                        <AreaPointsEditor
                            :model-value="area.points"
                            @update:model-value="updateAreaPoints(area.id, $event)"
                        />
                    </div>

                    <!-- 区域样式配置（可选） -->
                    <div v-if="showStyleConfig" class="style-config">
                        <div class="style-config-title">区域样式（留空继承全局配置）</div>

                        <div class="style-grid">
                            <div class="form-field">
                                <label class="form-label">颜色</label>
                                <div class="color-input-wrapper">
                                    <input
                                        type="color"
                                        :value="area.color || '#00ff00'"
                                        @input="updateAreaStyle(area.id, 'color', $event.target.value)"
                                        class="color-picker"
                                    />
                                    <Input
                                        :model-value="area.color || ''"
                                        @update:model-value="updateAreaStyle(area.id, 'color', $event)"
                                        placeholder="继承全局"
                                        size="sm"
                                        class="color-text-input"
                                    />
                                    <button
                                        v-if="area.color"
                                        class="btn-clear"
                                        @click="updateAreaStyle(area.id, 'color', '')"
                                        title="清除（使用全局配置）"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div class="form-field">
                                <label class="form-label">墙壁高度</label>
                                <div class="number-input-wrapper">
                                    <Input
                                        :model-value="area.wallHeight ?? ''"
                                        @update:model-value="updateAreaStyle(area.id, 'wallHeight', $event)"
                                        placeholder="继承全局"
                                        size="sm"
                                        type="number"
                                    />
                                    <button
                                        v-if="area.wallHeight !== undefined"
                                        class="btn-clear"
                                        @click="updateAreaStyle(area.id, 'wallHeight', '')"
                                        title="清除（使用全局配置）"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div class="form-field">
                                <label class="form-label">墙壁透明度</label>
                                <div class="number-input-wrapper">
                                    <Input
                                        :model-value="area.wallOpacity ?? ''"
                                        @update:model-value="updateAreaStyle(area.id, 'wallOpacity', $event)"
                                        placeholder="继承全局"
                                        size="sm"
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                    />
                                    <button
                                        v-if="area.wallOpacity !== undefined"
                                        class="btn-clear"
                                        @click="updateAreaStyle(area.id, 'wallOpacity', '')"
                                        title="清除（使用全局配置）"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div class="form-field">
                                <label class="form-label">底部透明度</label>
                                <div class="number-input-wrapper">
                                    <Input
                                        :model-value="area.bottomOpacity ?? ''"
                                        @update:model-value="updateAreaStyle(area.id, 'bottomOpacity', $event)"
                                        placeholder="继承全局"
                                        size="sm"
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                    />
                                    <button
                                        v-if="area.bottomOpacity !== undefined"
                                        class="btn-clear"
                                        @click="updateAreaStyle(area.id, 'bottomOpacity', '')"
                                        title="清除（使用全局配置）"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="style-toggles">
                            <label class="toggle-item">
                                <input
                                    type="checkbox"
                                    :checked="area.showWall !== false"
                                    :indeterminate="area.showWall === undefined"
                                    @change="updateAreaStyle(area.id, 'showWall', $event.target.checked)"
                                />
                                <span>显示墙壁</span>
                            </label>
                            <label class="toggle-item">
                                <input
                                    type="checkbox"
                                    :checked="area.showBottom !== false"
                                    :indeterminate="area.showBottom === undefined"
                                    @change="updateAreaStyle(area.id, 'showBottom', $event.target.checked)"
                                />
                                <span>显示底部</span>
                            </label>
                            <label class="toggle-item">
                                <input
                                    type="checkbox"
                                    :checked="area.showBorder !== false"
                                    :indeterminate="area.showBorder === undefined"
                                    @change="updateAreaStyle(area.id, 'showBorder', $event.target.checked)"
                                />
                                <span>显示边框</span>
                            </label>
                        </div>
                    </div>

                    <!-- 删除按钮 -->
                    <div class="area-actions">
                        <Button
                            variant="danger"
                            size="sm"
                            @click="removeArea(area.id)"
                        >
                            删除区域
                        </Button>
                    </div>
                </div>
            </template>
        </Accordion>

        <!-- 添加区域按钮 -->
        <button class="btn-add-area" @click="addArea">
            <span class="btn-add-icon">+</span>
            <span>添加区域块</span>
        </button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useToast } from '../../composables/useToast';
import Input from './Input.vue';
import Button from './Button.vue';
import Accordion from './Accordion.vue';
import AreaPointsEditor from './AreaPointsEditor.vue';

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    showStyleConfig: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(['update:modelValue']);

const toast = useToast();

const areas = computed(() => props.modelValue || []);

// 折叠面板配置
const accordionItems = computed(() => {
    return areas.value.map(area => ({
        key: area.id,
        title: `区域: ${area.id} (${area.points?.length || 0} 个点)`
    }));
});

// 生成唯一 ID
const generateAreaId = () => {
    const existingIds = areas.value.map(a => a.id);
    let counter = 1;
    let newId = `area_${counter}`;
    while (existingIds.includes(newId)) {
        counter++;
        newId = `area_${counter}`;
    }
    return newId;
};

// 添加区域
const addArea = () => {
    const newAreas = [...areas.value];
    newAreas.push({
        id: generateAreaId(),
        points: [
            { x: -5, y: 0, z: -5 },
            { x: 5, y: 0, z: -5 },
            { x: 5, y: 0, z: 5 },
            { x: -5, y: 0, z: 5 }
        ]
    });
    emit('update:modelValue', newAreas);
};

// 删除区域
const removeArea = (areaId) => {
    const newAreas = areas.value.filter(a => a.id !== areaId);
    emit('update:modelValue', newAreas);
};

// 更新区域 ID
const updateAreaId = (oldId, newId) => {
    if (!newId || newId === oldId) return;

    // 检查 ID 是否已存在
    if (areas.value.some(a => a.id === newId && a.id !== oldId)) {
        toast.warning('该 ID 已存在，请使用其他 ID');
        return;
    }

    const newAreas = areas.value.map(a => {
        if (a.id === oldId) {
            return { ...a, id: newId };
        }
        return a;
    });
    emit('update:modelValue', newAreas);
};

// 更新区域点坐标
const updateAreaPoints = (areaId, newPoints) => {
    const newAreas = areas.value.map(a => {
        if (a.id === areaId) {
            return { ...a, points: newPoints };
        }
        return a;
    });
    emit('update:modelValue', newAreas);
};

// 更新区域样式
const updateAreaStyle = (areaId, styleKey, value) => {
    const newAreas = areas.value.map(a => {
        if (a.id === areaId) {
            const updatedArea = { ...a };
            if (value === '' || value === null || value === undefined) {
                // 删除该样式属性，使用全局配置
                delete updatedArea[styleKey];
            } else {
                // 设置样式属性
                const numValue = styleKey === 'color' ? value : parseFloat(value);
                updatedArea[styleKey] = numValue;
            }
            return updatedArea;
        }
        return a;
    });
    emit('update:modelValue', newAreas);
};
</script>

<style scoped>
.areas-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
}

.empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.empty-text {
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
}

.area-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem 0;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.style-config {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
    margin-top: 0.25rem;
    border: 1px solid var(--color-border);
}

.style-config-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
}

.style-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
}

.color-input-wrapper {
    display: flex;
    gap: 0.375rem;
    align-items: center;
}

.color-picker {
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
}

.color-picker::-webkit-color-swatch-wrapper {
    padding: 2px;
}

.color-picker::-webkit-color-swatch {
    border-radius: 2px;
    border: none;
}

.color-text-input {
    flex: 1;
}

.number-input-wrapper {
    display: flex;
    gap: 0.375rem;
    align-items: center;
}

.number-input-wrapper :deep(.input) {
    flex: 1;
}

.btn-clear {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
    font-size: 0.625rem;
}

.btn-clear:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
}

.style-toggles {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
}

.toggle-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    cursor: pointer;
}

.toggle-item input[type="checkbox"] {
    width: 0.875rem;
    height: 0.875rem;
    accent-color: var(--color-primary);
}

.area-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border);
}

.btn-add-area {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-add-area:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.btn-add-icon {
    font-size: 1rem;
    font-weight: 600;
}
</style>
