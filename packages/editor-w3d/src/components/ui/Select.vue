<template>
    <div class="select-wrapper">
        <label v-if="label" class="select-label">
            {{ label }}
        </label>
        <select
            :value="modelValue"
            :disabled="disabled"
            class="select"
            @change="handleChange"
        >
            <option v-if="placeholder" value="" disabled>
                {{ placeholder }}
            </option>
            <option
                v-for="option in options"
                :key="option.value"
                :value="option.value"
            >
                {{ option.label }}
            </option>
        </select>
    </div>
</template>

<script setup>
const props = defineProps({
    modelValue: {
        type: [String, Number, Boolean],
        default: ''
    },
    label: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: ''
    },
    options: {
        type: Array,
        required: true,
        default: () => []
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'change']);

const handleChange = (event) => {
    const rawValue = event.target.value;
    // 从 options 中找到匹配项以还原原始类型（避免 DOM 将数字/布尔值转为字符串）
    const matched = props.options.find((o) => String(o.value) === rawValue);
    const value = matched ? matched.value : rawValue;
    emit('update:modelValue', value);
    emit('change', value);
};
</script>

<style scoped>
.select-wrapper {
    width: 100%;
}

.select-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
}

.select {
    width: 100%;
    height: 32px;
    padding: 0 var(--space-3);
    padding-right: var(--space-8);
    font-size: var(--font-size-sm);
    font-family: var(--font-family-base);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-bg-tertiary);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%238b8fa3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    color: var(--color-text-primary);
    transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
    appearance: none;
    will-change: border-color, box-shadow;
}

.select:hover:not(:disabled) {
    border-color: var(--color-border-hover);
    background-color: var(--color-bg-hover);
    transform: translateY(-1px);
}

.select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-subtle, rgba(37, 99, 235, 0.1)),
                0 0 20px -5px var(--color-primary, #2563eb);
    transform: translateY(0);
}

.select:disabled {
    background-color: var(--color-bg-secondary);
    cursor: not-allowed;
    opacity: 0.6;
}

.select option {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    padding: var(--space-2);
}
</style>

