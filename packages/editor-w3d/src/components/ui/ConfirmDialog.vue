<template>
    <Teleport to="body">
        <Transition name="confirm-dialog">
            <div v-if="visible" class="confirm-overlay" @click="handleOverlayClick">
                <div class="confirm-dialog" :class="[`confirm-dialog--${dialogState.variant}`]" @click.stop>
                    <!-- English comment. -->
                    <div class="confirm-icon" :class="[`confirm-icon--${dialogState.variant}`]">
                        <span v-if="dialogState.variant === 'danger'">⚠</span>
                        <span v-else-if="dialogState.variant === 'warning'">⚡</span>
                        <span v-else>❓</span>
                    </div>

                    <!-- English comment. -->
                    <h3 class="confirm-title">{{ dialogState.title }}</h3>

                    <!-- English comment. -->
                    <p class="confirm-message">{{ dialogState.message }}</p>

                    <!-- English comment. -->
                    <div class="confirm-actions">
                        <button
                            v-if="dialogState.type === 'confirm'"
                            class="confirm-btn confirm-btn--cancel"
                            @click="handleCancel"
                        >
                            {{ dialogState.cancelText }}
                        </button>
                        <button
                            class="confirm-btn"
                            :class="[`confirm-btn--${dialogState.variant}`]"
                            @click="handleConfirm"
                        >
                            {{ dialogState.confirmText }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { useConfirm } from '../../composables/useConfirm';

const { visible, dialogState, handleConfirm, handleCancel } = useConfirm();

// English comment.
const handleOverlayClick = () => {
    if (dialogState.type === 'confirm') {
        handleCancel();
    }
};
</script>

<style scoped>
.confirm-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 10000;
}

.confirm-dialog {
    background-color: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #363648);
    border-radius: var(--border-radius-lg, 12px);
    padding: 1.5rem;
    min-width: 320px;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.5),
                0 0 1px rgba(255, 255, 255, 0.1);
}

.confirm-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background-color: var(--color-bg-tertiary, #262636);
}

.confirm-icon--default {
    color: var(--color-primary, #2563eb);
    background-color: var(--color-primary-subtle, rgba(37, 99, 235, 0.15));
}

.confirm-icon--danger {
    color: var(--color-error, #ef4444);
    background-color: var(--color-error-bg, rgba(239, 68, 68, 0.15));
}

.confirm-icon--warning {
    color: var(--color-warning, #f59e0b);
    background-color: var(--color-warning-bg, rgba(245, 158, 11, 0.15));
}

.confirm-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary, #fff);
    margin: 0 0 0.5rem;
}

.confirm-message {
    font-size: 0.875rem;
    color: var(--color-text-secondary, #a0a0b0);
    margin: 0 0 1.5rem;
    line-height: 1.5;
    white-space: pre-wrap;
}

.confirm-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
}

.confirm-btn {
    flex: 1;
    padding: 0.625rem 1.25rem;
    border-radius: var(--border-radius, 8px);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    border: none;
    outline: none;
}

.confirm-btn--cancel {
    background-color: var(--color-bg-tertiary, #262636);
    color: var(--color-text-secondary, #a0a0b0);
    border: 1px solid var(--color-border, #363648);
}

.confirm-btn--cancel:hover {
    background-color: var(--color-bg-hover, #2a2a3a);
    color: var(--color-text-primary, #fff);
    border-color: var(--color-border-hover, #4a4a5a);
}

.confirm-btn--default {
    background-color: var(--color-primary, #2563eb);
    color: white;
}

.confirm-btn--default:hover {
    background-color: var(--color-primary-hover, #1d4ed8);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.confirm-btn--danger {
    background-color: var(--color-error, #ef4444);
    color: white;
}

.confirm-btn--danger:hover {
    background-color: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.confirm-btn--warning {
    background-color: var(--color-warning, #f59e0b);
    color: white;
}

.confirm-btn--warning:hover {
    background-color: #d97706;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

/* English comment. */
.confirm-dialog-enter-active {
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.confirm-dialog-enter-active .confirm-dialog {
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.confirm-dialog-leave-active {
    transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.confirm-dialog-leave-active .confirm-dialog {
    transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.confirm-dialog-enter-from {
    opacity: 0;
}

.confirm-dialog-enter-from .confirm-dialog {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
}

.confirm-dialog-leave-to {
    opacity: 0;
}

.confirm-dialog-leave-to .confirm-dialog {
    opacity: 0;
    transform: scale(0.95);
}
</style>
