<template>
    <div class="transform-editor">
        <!-- 位置 -->
        <div class="transform-group">
            <div class="group-header">
                <div class="group-label">位置</div>
                <button
                    type="button"
                    class="binding-icon-btn"
                    :class="{ active: isBindingActive('position') }"
                    title="绑定位置变量"
                    @click="openVariableBinding('position')"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
                        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2" />
                    </svg>
                </button>
            </div>
            <div class="vector3-inputs">
                <div class="input-group">
                    <label>X</label>
                    <Input
                        type="number"
                        :model-value="position[0]"
                        :disabled="disabled"
                        @update:model-value="updatePosition(0, $event)"
                        :step="0.1"
                    />
                </div>
                <div class="input-group">
                    <label>Y</label>
                    <Input
                        type="number"
                        :model-value="position[1]"
                        :disabled="disabled"
                        @update:model-value="updatePosition(1, $event)"
                        :step="0.1"
                    />
                </div>
                <div class="input-group">
                    <label>Z</label>
                    <Input
                        type="number"
                        :model-value="position[2]"
                        :disabled="disabled"
                        @update:model-value="updatePosition(2, $event)"
                        :step="0.1"
                    />
                </div>
            </div>
        </div>

        <!-- 旋转 -->
        <div class="transform-group">
            <div class="group-header">
                <div class="group-label">旋转</div>
                <button
                    type="button"
                    class="binding-icon-btn"
                    :class="{ active: isBindingActive('rotation') }"
                    title="绑定旋转变量"
                    @click="openVariableBinding('rotation')"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
                        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2" />
                    </svg>
                </button>
            </div>
            <div class="vector3-inputs">
                <div class="input-group">
                    <label>X</label>
                    <Input
                        type="number"
                        :model-value="rotationDegrees[0]"
                        :disabled="disabled"
                        @update:model-value="updateRotation(0, $event)"
                        :step="1"
                    />
                </div>
                <div class="input-group">
                    <label>Y</label>
                    <Input
                        type="number"
                        :model-value="rotationDegrees[1]"
                        :disabled="disabled"
                        @update:model-value="updateRotation(1, $event)"
                        :step="1"
                    />
                </div>
                <div class="input-group">
                    <label>Z</label>
                    <Input
                        type="number"
                        :model-value="rotationDegrees[2]"
                        :disabled="disabled"
                        @update:model-value="updateRotation(2, $event)"
                        :step="1"
                    />
                </div>
            </div>
        </div>

        <!-- 缩放 -->
        <div class="transform-group">
            <div class="group-header">
                <div class="group-label">缩放</div>
                <button
                    type="button"
                    class="binding-icon-btn"
                    :class="{ active: isBindingActive('scale') }"
                    title="绑定缩放变量"
                    @click="openVariableBinding('scale')"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
                        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2" />
                    </svg>
                </button>
            </div>
            <div class="scale-inputs">
                <div class="input-group flex-1">
                    <label>统一缩放</label>
                    <Input
                        type="number"
                        :model-value="uniformScale"
                        :disabled="disabled"
                        @update:model-value="updateUniformScale"
                        :step="0.1"
                        :min="0.01"
                    />
                </div>
                <button
                    class="lock-btn"
                    :class="{ active: lockScale }"
                    :disabled="disabled"
                    @click="lockScale = !lockScale"
                    title="锁定比例"
                >
                    {{ lockScale ? '锁' : '轴' }}
                </button>
            </div>
            <div v-if="!lockScale" class="vector3-inputs mt-2">
                <div class="input-group">
                    <label>X</label>
                    <Input
                        type="number"
                        :model-value="scale[0]"
                        :disabled="disabled"
                        @update:model-value="updateScale(0, $event)"
                        :step="0.1"
                        :min="0.01"
                    />
                </div>
                <div class="input-group">
                    <label>Y</label>
                    <Input
                        type="number"
                        :model-value="scale[1]"
                        :disabled="disabled"
                        @update:model-value="updateScale(1, $event)"
                        :step="0.1"
                        :min="0.01"
                    />
                </div>
                <div class="input-group">
                    <label>Z</label>
                    <Input
                        type="number"
                        :model-value="scale[2]"
                        :disabled="disabled"
                        @update:model-value="updateScale(2, $event)"
                        :step="0.1"
                        :min="0.01"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Input from '../ui/Input.vue';

const props = defineProps({
    position: {
        type: Array,
        default: () => [0, 0, 0]
    },
    rotation: {
        type: Array,
        default: () => [0, 0, 0]
    },
    scale: {
        type: [Number, Array],
        default: 1
    },
    disabled: {
        type: Boolean,
        default: false
    },
    variableBindings: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(['update:position', 'update:rotation', 'update:scale', 'open-variable-binding']);

const lockScale = ref(true);

const normalizeVector3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [0, 1, 2].map((index) => {
            const numeric = Number(value[index]);
            return Number.isFinite(numeric) ? numeric : fallback[index];
        });
    }

    if (value && typeof value === 'object') {
        return ['x', 'y', 'z'].map((key, index) => {
            const numeric = Number(value[key]);
            return Number.isFinite(numeric) ? numeric : fallback[index];
        });
    }

    return [...fallback];
};

const normalizedPosition = computed(() => normalizeVector3(props.position, [0, 0, 0]));
const normalizedRotation = computed(() => normalizeVector3(props.rotation, [0, 0, 0]));
const normalizedScale = computed(() => {
    if (typeof props.scale === 'number') {
        const numeric = Number(props.scale);
        const safeValue = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
        return [safeValue, safeValue, safeValue];
    }

    return normalizeVector3(props.scale, [1, 1, 1]).map((item) => (item > 0 ? item : 1));
});

// 将旋转从弧度转换为角度
const rotationDegrees = computed(() => {
    return normalizedRotation.value.map((rad) => Math.round((rad * 180) / Math.PI));
});

// 统一缩放值
const uniformScale = computed(() => {
    return normalizedScale.value[0];
});

const isBindingActive = (propertyKey) => {
    return !!String(props.variableBindings?.[propertyKey] || '').trim();
};

const openVariableBinding = (propertyKey) => {
    emit('open-variable-binding', propertyKey);
};

// 更新位置
const updatePosition = (index, value) => {
    const newPosition = [...normalizedPosition.value];
    newPosition[index] = parseFloat(value) || 0;
    emit('update:position', newPosition);
};

// 更新旋转（输入为角度，转换为弧度）
const updateRotation = (index, value) => {
    const newRotation = [...normalizedRotation.value];
    newRotation[index] = ((parseFloat(value) || 0) * Math.PI) / 180;
    emit('update:rotation', newRotation);
};

// 更新统一缩放
const updateUniformScale = (value) => {
    const scaleValue = parseFloat(value) || 0.01;
    if (lockScale.value) {
        emit('update:scale', scaleValue);
    } else {
        emit('update:scale', [scaleValue, scaleValue, scaleValue]);
    }
};

// 更新单个轴的缩放
const updateScale = (index, value) => {
    const scaleValue = parseFloat(value) || 0.01;
    const newScale = [...normalizedScale.value];
    newScale[index] = scaleValue;
    emit('update:scale', newScale);
};

// 监听锁定状态变化
watch(lockScale, (locked) => {
    if (locked) {
        // 锁定时，使用当前的统一缩放值
        emit('update:scale', uniformScale.value);
    } else {
        // 解锁时，转换为数组形式
        const currentScale = uniformScale.value;
        emit('update:scale', [currentScale, currentScale, currentScale]);
    }
});

watch(
    normalizedScale,
    (value) => {
        const [x, y, z] = value;
        lockScale.value = Math.abs(x - y) < 0.0001 && Math.abs(y - z) < 0.0001;
    },
    { immediate: true }
);
</script>

<style scoped>
.transform-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.transform-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
    gap: var(--space-2);
}

.group-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
}

.binding-icon-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm);
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        color var(--transition-fast);
}

.binding-icon-btn svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.binding-icon-btn:hover {
    border-color: rgba(47, 125, 244, 0.4);
    background: rgba(47, 125, 244, 0.12);
    color: var(--color-primary);
}

.binding-icon-btn.active {
    border-color: rgba(47, 125, 244, 0.55);
    background: rgba(47, 125, 244, 0.18);
    color: #9ec7ff;
}

.vector3-inputs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
}

.scale-inputs {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--color-text-primary);
}

.input-group label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
}

.lock-btn {
    width: 34px;
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.lock-btn:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-primary);
    color: var(--color-text-primary);
}

.lock-btn.active {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.45);
    color: var(--color-primary);
}

.lock-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@media (max-width: 720px) {
    .vector3-inputs {
        grid-template-columns: 1fr;
    }

    .scale-inputs {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>

