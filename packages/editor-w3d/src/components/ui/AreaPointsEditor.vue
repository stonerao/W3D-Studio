<template>
    <div class="area-points-editor">
        <div v-if="points.length === 0" class="empty-state">
            <span class="empty-text">暂无点坐标</span>
        </div>

        <div
            v-for="(point, index) in points"
            :key="index"
            class="point-row"
        >
            <span class="point-label">点 {{ index + 1 }}</span>
            <div class="point-inputs">
                <Input
                    :model-value="getPointValue(point, 'x')"
                    @update:model-value="updatePoint(index, 'x', $event)"
                    placeholder="X"
                    size="sm"
                    type="number"
                    class="coord-input"
                />
                <Input
                    :model-value="getPointValue(point, 'y')"
                    @update:model-value="updatePoint(index, 'y', $event)"
                    placeholder="Y"
                    size="sm"
                    type="number"
                    class="coord-input"
                />
                <Input
                    :model-value="getPointValue(point, 'z')"
                    @update:model-value="updatePoint(index, 'z', $event)"
                    placeholder="Z"
                    size="sm"
                    type="number"
                    class="coord-input"
                />
            </div>
            <button
                class="btn-remove"
                @click="removePoint(index)"
                title="删除点"
            >
                ✕
            </button>
        </div>

        <button class="btn-add" @click="addPoint">
            <span class="btn-add-icon">+</span>
            <span>添加点</span>
        </button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Input from './Input.vue';

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:modelValue']);

const points = computed(() => props.modelValue || []);

// English comment.
const getPointValue = (point, axis) => {
    if (Array.isArray(point)) {
        const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        return point[index] ?? 0;
    }
    return point[axis] ?? 0;
};

// English comment.
const updatePoint = (index, axis, value) => {
    const newPoints = [...points.value];
    const numValue = parseFloat(value) || 0;

    if (Array.isArray(newPoints[index])) {
        // English comment.
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        newPoints[index] = [...newPoints[index]];
        newPoints[index][axisIndex] = numValue;
    } else {
        // English comment.
        newPoints[index] = { ...newPoints[index], [axis]: numValue };
    }

    emit('update:modelValue', newPoints);
};

// English comment.
const addPoint = () => {
    const newPoints = [...points.value];
    // English comment.
    if (newPoints.length > 0) {
        if (Array.isArray(newPoints[0])) {
            newPoints.push([0, 0, 0]);
        } else {
            newPoints.push({ x: 0, y: 0, z: 0 });
        }
    } else {
        // English comment.
        newPoints.push({ x: 0, y: 0, z: 0 });
    }
    emit('update:modelValue', newPoints);
};

// English comment.
const removePoint = (index) => {
    const newPoints = points.value.filter((_, i) => i !== index);
    emit('update:modelValue', newPoints);
};
</script>

<style scoped>
.area-points-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.empty-state {
    padding: 0.75rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
}

.point-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.point-label {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    min-width: 2.5rem;
}

.point-inputs {
    display: flex;
    gap: 0.375rem;
    flex: 1;
}

.coord-input {
    flex: 1;
}

.btn-remove {
    width: 1.75rem;
    height: 1.75rem;
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
}

.btn-remove:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
}

.btn-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem;
    background-color: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-add:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.btn-add-icon {
    font-size: 0.875rem;
    font-weight: 600;
}
</style>
