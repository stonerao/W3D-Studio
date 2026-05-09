<template>
    <div class="input-wrapper">
        <label v-if="label" class="input-label">
            {{ label }}
        </label>
        <input
            :type="type"
            :value="modelValue"
            :placeholder="placeholder"
            :disabled="disabled"
            class="input"
            :class="{ 'input-error': error }"
            @input="handleInput"
            @blur="handleBlur"
            @focus="handleFocus"
            @keydown="handleKeydown"
        />
        <div v-if="error" class="input-error-message">
            {{ error }}
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    modelValue: {
        type: [String, Number],
        default: ''
    },
    type: {
        type: String,
        default: 'text'
    },
    label: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    },
    error: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:modelValue', 'blur', 'focus', 'keydown']);

const handleInput = (event) => {
    emit('update:modelValue', event.target.value);
};

const handleBlur = (event) => {
    emit('blur', event);
};

const handleFocus = (event) => {
    emit('focus', event);
};

const handleKeydown = (event) => {
    emit('keydown', event);
};
</script>

<style scoped>
.input-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.input-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
}

.input {
    width: 100%;
    height: 32px;
    padding: 0 var(--space-3);
    font-family: var(--font-sans);
    font-size: var(--font-size-base);
    font-feature-settings: 'tnum' on, 'lnum' on;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    background-color: rgba(8, 13, 21, 0.66);
    color: var(--color-text-primary);
    transition: border-color var(--duration-fast, 150ms) var(--ease-out),
                background-color var(--duration-fast, 150ms) var(--ease-out),
                box-shadow var(--duration-fast, 150ms) var(--ease-out);
}

.input::placeholder {
    color: var(--color-text-muted);
}

.input:hover:not(:disabled):not(:focus) {
    border-color: var(--color-border-hover);
    background-color: rgba(18, 27, 42, 0.9);
}

.input:focus {
    outline: none;
    border-color: var(--color-primary);
    background-color: rgba(8, 13, 21, 0.9);
    box-shadow: 0 0 0 3px var(--color-primary-subtle);
}

.input:disabled {
    background-color: var(--color-bg-secondary);
    cursor: not-allowed;
    opacity: 0.5;
}

/* English comment. */
.input[type="number"] {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
}

.input[type="number"]::-webkit-inner-spin-button,
.input[type="number"]::-webkit-outer-spin-button {
    opacity: 0;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    width: 20px;
}

.input[type="number"]:hover::-webkit-inner-spin-button,
.input[type="number"]:hover::-webkit-outer-spin-button {
    opacity: 1;
}

/* English comment. */
.input-error {
    border-color: var(--color-error);
    background-color: var(--color-error-bg);
}

.input-error:focus {
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.input-error-message {
    font-size: var(--font-size-xs);
    color: var(--color-error);
}
</style>

