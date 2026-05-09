<template>
    <Teleport to="body">
        <div class="toast-container">
            <TransitionGroup name="toast">
                <div
                    v-for="toast in toasts"
                    :key="toast.id"
                    class="toast-item"
                    :class="[`toast-${toast.type}`]"
                    @click="removeToast(toast.id)"
                >
                    <div class="toast-icon">{{ getIcon(toast.type) }}</div>
                    <div class="toast-content">
                        <div v-if="toast.title" class="toast-title">{{ toast.title }}</div>
                        <div class="toast-message">{{ toast.message }}</div>
                    </div>
                    <button class="toast-close" @click.stop="removeToast(toast.id)">×</button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>

<script setup>
import { ref } from 'vue';

const toasts = ref([]);
let nextId = 1;

const getIcon = (type) => {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
};

const addToast = (options) => {
    const toast = {
        id: nextId++,
        type: options.type || 'info',
        title: options.title || '',
        message: options.message || '',
        duration: options.duration || 3000
    };

    toasts.value.push(toast);

    if (toast.duration > 0) {
        setTimeout(() => {
            removeToast(toast.id);
        }, toast.duration);
    }

    return toast.id;
};

const removeToast = (id) => {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index > -1) {
        toasts.value.splice(index, 1);
    }
};

const clearAll = () => {
    toasts.value = [];
};

// 暴露方法供外部调用
defineExpose({
    addToast,
    removeToast,
    clearAll,
    success: (message, title) => addToast({ type: 'success', message, title }),
    error: (message, title) => addToast({ type: 'error', message, title }),
    warning: (message, title) => addToast({ type: 'warning', message, title }),
    info: (message, title) => addToast({ type: 'info', message, title })
});
</script>

<style scoped>
.toast-container {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    pointer-events: none;
}

.toast-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-width: 300px;
    max-width: 400px;
    padding: var(--space-4);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    cursor: pointer;
    background-color: var(--color-bg-elevated);
    border-left: 4px solid;
    transition: transform var(--duration-fast, 150ms) var(--ease-out),
                box-shadow var(--duration-fast, 150ms) var(--ease-out);
    /* 硬件加速 */
    will-change: transform, opacity;
    transform: translateZ(0);
    /* 毛玻璃效果 */
    backdrop-filter: blur(12px);
}

.toast-item:hover {
    transform: translateX(-4px);
    box-shadow: var(--shadow-xl);
}

.toast-success {
    border-left-color: var(--color-success);
}

.toast-error {
    border-left-color: var(--color-error);
}

.toast-warning {
    border-left-color: var(--color-warning);
}

.toast-info {
    border-left-color: var(--color-primary);
}

.toast-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-full);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    color: white;
}

.toast-success .toast-icon {
    background-color: var(--color-success);
}

.toast-error .toast-icon {
    background-color: var(--color-error);
}

.toast-warning .toast-icon {
    background-color: var(--color-warning);
}

.toast-info .toast-icon {
    background-color: var(--color-primary);
}

.toast-content {
    flex: 1;
    min-width: 0;
}

.toast-title {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    margin-bottom: var(--space-1);
    font-size: var(--font-size-sm);
}

.toast-message {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
}

.toast-close {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-tertiary);
    font-size: 18px;
    font-weight: var(--font-weight-bold);
    background: transparent;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.toast-close:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover);
}

/* 过渡动画 - 使用新动画系统 */
.toast-enter-active {
    animation: toast-slide-in var(--duration-slow, 300ms) var(--ease-out-back, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.toast-leave-active {
    animation: toast-slide-out var(--duration-fast, 150ms) var(--ease-in, cubic-bezier(0.4, 0, 1, 1));
}

.toast-move {
    transition: transform var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
}

@keyframes toast-slide-in {
    0% {
        opacity: 0;
        transform: translateX(100%) scale(0.9);
    }
    100% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

@keyframes toast-slide-out {
    0% {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
    100% {
        opacity: 0;
        transform: translateX(100%) scale(0.9);
    }
}
</style>

