<template>
    <button
        class="btn"
        :class="[variantClass, sizeClass, { 'btn-block': block }]"
        :disabled="disabled"
        @click="handleClick"
    >
        <slot></slot>
    </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    variant: {
        type: String,
        default: 'default',
        validator: (value) => ['default', 'primary', 'danger', 'ghost', 'outline'].includes(value)
    },
    size: {
        type: String,
        default: 'md',
        validator: (value) => ['sm', 'md', 'lg'].includes(value)
    },
    block: {
        type: Boolean,
        default: false
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['click']);

const variantClass = computed(() => {
    const variants = {
        default: 'btn-default',
        primary: 'btn-primary',
        danger: 'btn-danger',
        ghost: 'btn-ghost',
        outline: 'btn-outline'
    };
    return variants[props.variant];
});

const sizeClass = computed(() => {
    const sizes = {
        sm: 'btn-sm',
        md: 'btn-md',
        lg: 'btn-lg'
    };
    return sizes[props.size];
});

const handleClick = (event) => {
    if (!props.disabled) {
        emit('click', event);
    }
};
</script>

<style scoped>
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-weight: var(--font-weight-medium);
    border-radius: var(--border-radius);
    transition: all var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
    cursor: pointer;
    outline: none;
    white-space: nowrap;
    user-select: none;
    position: relative;
    overflow: hidden;
    transform: translateZ(0);
}

/* 按钮涟漪效果 */
.btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    transition: transform 0.5s, opacity 0.3s;
    pointer-events: none;
}

.btn:active::before {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 1;
    transition: transform 0s, opacity 0s;
}

.btn:focus-visible {
    box-shadow: var(--focus-ring);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

/* 尺寸 */
.btn-sm {
    height: 28px;
    padding: 0 var(--space-3);
    font-size: var(--font-size-sm);
}

.btn-md {
    height: 34px;
    padding: 0 var(--space-4);
    font-size: var(--font-size-base);
}

.btn-lg {
    height: 40px;
    padding: 0 var(--space-5);
    font-size: var(--font-size-md);
}

/* 变体 - 商业级样式 */
.btn-default {
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
}

.btn-default:hover:not(:disabled) {
    background-color: var(--color-bg-elevated);
    border-color: var(--color-border-hover);
}

.btn-default:active:not(:disabled) {
    background-color: var(--color-bg-hover);
    transform: translateY(1px);
}

.btn-primary {
    background: var(--color-primary);
    border: 1px solid transparent;
    color: var(--color-text-inverse);
    font-weight: var(--font-weight-semibold);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
    box-shadow: 0 8px 18px rgba(47, 125, 244, 0.24),
                inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.btn-primary:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.btn-danger {
    background-color: var(--color-error);
    border: 1px solid transparent;
    color: white;
    font-weight: var(--font-weight-semibold);
}

.btn-danger:hover:not(:disabled) {
    background-color: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-danger:active:not(:disabled) {
    transform: translateY(0);
}

.btn-ghost {
    background-color: transparent;
    border: 1px solid transparent;
    color: var(--color-text-secondary);
}

.btn-ghost:hover:not(:disabled) {
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.btn-ghost:active:not(:disabled) {
    background-color: var(--color-bg-active);
}

.btn-outline {
    background-color: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
}

.btn-outline:hover:not(:disabled) {
    background-color: var(--color-primary-subtle);
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.btn-outline:active:not(:disabled) {
    background-color: var(--color-bg-active);
}

/* 块级按钮 */
.btn-block {
    width: 100%;
}
</style>

