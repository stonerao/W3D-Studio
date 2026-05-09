<template>
    <div class="slider-wrapper">
        <div class="slider-header">
            <label v-if="label" class="slider-label">
                {{ label }}
            </label>
            <span v-if="showValue" class="slider-value">
                {{ modelValue }}
            </span>
        </div>
        <div class="slider-container">
            <input
                type="range"
                :value="modelValue"
                :min="min"
                :max="max"
                :step="step"
                :disabled="disabled"
                class="slider"
                @input="handleInput"
                @change="handleChange"
            />
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    modelValue: {
        type: Number,
        default: 0
    },
    label: {
        type: String,
        default: ''
    },
    min: {
        type: Number,
        default: 0
    },
    max: {
        type: Number,
        default: 100
    },
    step: {
        type: Number,
        default: 1
    },
    showValue: {
        type: Boolean,
        default: true
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'change']);

const handleInput = (event) => {
    emit('update:modelValue', Number(event.target.value));
};

const handleChange = (event) => {
    emit('change', Number(event.target.value));
};
</script>

<style scoped>
.slider-wrapper {
    width: 100%;
}

.slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
}

.slider-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
}

.slider-value {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-family: var(--font-family-mono);
    font-feature-settings: "tnum" 1;
    min-width: 32px;
    text-align: right;
}

.slider-container {
    width: 100%;
    padding: var(--space-1) 0;
}

.slider {
    width: 100%;
    height: 4px;
    background-color: var(--color-bg-elevated);
    border-radius: var(--border-radius-full);
    appearance: none;
    cursor: pointer;
    outline: none;
    transition: background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.slider:hover {
    background-color: var(--color-bg-hover);
}

.slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.slider::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    background-color: var(--color-primary);
    border-radius: var(--border-radius-full);
    border: 2px solid var(--color-bg-primary);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: var(--shadow-sm);
    will-change: transform;
}

.slider::-webkit-slider-thumb:hover {
    background-color: var(--color-primary-hover);
    transform: scale(1.2);
    box-shadow: 0 0 0 4px var(--color-primary-subtle, rgba(37, 99, 235, 0.15)),
                0 2px 8px rgba(0, 0, 0, 0.2);
}

.slider:active::-webkit-slider-thumb {
    transform: scale(1.1);
}

.slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background-color: var(--color-primary);
    border-radius: var(--border-radius-full);
    border: 2px solid var(--color-bg-primary);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: var(--shadow-sm);
}

.slider::-moz-range-thumb:hover {
    background-color: var(--color-primary-hover);
    transform: scale(1.15);
}

.slider:focus-visible::-webkit-slider-thumb {
    box-shadow: var(--focus-ring);
}

.slider:focus-visible::-moz-range-thumb {
    box-shadow: var(--focus-ring);
}
</style>

