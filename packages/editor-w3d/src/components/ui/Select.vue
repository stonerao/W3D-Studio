<template>
    <div class="select-wrapper">
        <label v-if="label" class="select-label">
            {{ displayText(label) }}
        </label>
        <select
            :value="modelValue"
            :disabled="disabled"
            class="select"
            @change="handleChange"
        >
            <option v-if="placeholder" value="" disabled>
                {{ displayText(placeholder) }}
            </option>
            <option
                v-for="option in options"
                :key="option.value"
                :value="option.value"
            >
                {{ displayText(option.label) }}
            </option>
        </select>
    </div>
</template>

<script setup>
import { translateDisplayText } from '../../i18n';

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

const displayText = (value) => translateDisplayText(value);

const handleChange = (event) => {
    const rawValue = event.target.value;
    // English comment.
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
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
}

.select {
    width: 100%;
    height: 34px;
    padding: 0 var(--space-3);
    padding-right: var(--space-8);
    font-size: var(--font-size-sm);
    font-family: var(--font-sans);
    border: 1px solid rgba(118, 144, 180, 0.16);
    border-radius: 7px;
    background-color: var(--color-workbench-field);
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
    background-color: rgba(11, 22, 37, 0.9);
    transform: none;
}

.select:focus {
    outline: none;
    border-color: rgba(96, 165, 250, 0.74);
    box-shadow: 0 0 0 3px rgba(47, 125, 244, 0.16);
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

