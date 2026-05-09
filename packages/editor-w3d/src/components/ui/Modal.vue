<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="modelValue" class="modal-overlay" :class="overlayClass" @click="handleOverlayClick">
                <div
                    class="modal-container"
                    :class="containerClass"
                    :style="modalStyle"
                    @click.stop
                >
                    <!-- English comment. -->
                    <div
                        class="modal-header"
                        @mousedown="startDrag"
                        :style="{ cursor: isDraggable ? 'move' : 'default' }"
                    >
                        <h3 class="modal-title">{{ title }}</h3>
                        <button
                            v-if="showClose"
                            class="modal-close"
                            @click="handleClose"
                        >
                            ✕
                        </button>
                    </div>

                    <!-- English comment. -->
                    <div class="modal-body">
                        <slot></slot>
                    </div>

                    <!-- English comment. -->
                    <div v-if="$slots.footer" class="modal-footer">
                        <slot name="footer"></slot>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: ''
    },
    width: {
        type: String,
        default: '500px'
    },
    showClose: {
        type: Boolean,
        default: true
    },
    closeOnClickOutside: {
        type: Boolean,
        default: true
    },
    draggable: {
        type: Boolean,
        default: true
    },
    position: {
        type: String,
        default: 'center'
    },
    nonBlocking: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'close']);

// English comment.
const isDragging = ref(false);
const isDraggable = computed(() => props.draggable);
const dragStartX = ref(0);
const dragStartY = ref(0);
const modalX = ref(0);
const modalY = ref(0);
const initialX = ref(0);
const initialY = ref(0);

const overlayClass = computed(() => {
    return {
        'modal-overlay--top-right': props.position === 'top-right',
        'modal-overlay--non-blocking': props.nonBlocking
    };
});

const containerClass = computed(() => {
    return {
        'modal-container--non-blocking': props.nonBlocking
    };
});

// English comment.
const modalStyle = computed(() => {
    const style = {
        width: props.width
    };

    if (isDraggable.value && (modalX.value !== 0 || modalY.value !== 0)) {
        style.transform = `translate(${modalX.value}px, ${modalY.value}px)`;
    }

    return style;
});

// English comment.
const startDrag = (event) => {
    if (!isDraggable.value) return;

    isDragging.value = true;
    dragStartX.value = event.clientX;
    dragStartY.value = event.clientY;
    initialX.value = modalX.value;
    initialY.value = modalY.value;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);

    // English comment.
    event.preventDefault();
};

// English comment.
const onDrag = (event) => {
    if (!isDragging.value) return;

    const deltaX = event.clientX - dragStartX.value;
    const deltaY = event.clientY - dragStartY.value;

    modalX.value = initialX.value + deltaX;
    modalY.value = initialY.value + deltaY;
};

// English comment.
const stopDrag = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

// English comment.
const resetPosition = () => {
    modalX.value = 0;
    modalY.value = 0;
};

// English comment.
watch(() => props.modelValue, (newValue) => {
    if (newValue) {
        resetPosition();
    }
});

const handleClose = () => {
    emit('update:modelValue', false);
    emit('close');
};

const handleOverlayClick = () => {
    if (props.closeOnClickOutside) {
        handleClose();
    }
};

// English comment.
onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
});
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.7);
}

.modal-overlay--top-right {
    align-items: flex-start;
    justify-content: flex-end;
    padding: 12px;
}

.modal-overlay--non-blocking {
    background-color: transparent;
    pointer-events: none;
}

.modal-container {
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-lg, 12px);
    box-shadow: var(--shadow-xl),
                0 0 0 1px rgba(255, 255, 255, 0.05);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    /* English comment. */
    backdrop-filter: blur(20px);
    /* English comment. */
    will-change: transform, opacity;
    transform: translateZ(0);
}

.modal-container--non-blocking {
    pointer-events: auto;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    user-select: none;
}

.modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.modal-close {
    color: var(--color-text-secondary);
    font-size: 1.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    background-color: transparent;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.modal-close:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover);
}

.modal-body {
    padding: 1rem 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
}

/* English comment. */
.modal-enter-active,
.modal-leave-active {
    transition: opacity var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0, 0, 0.2, 1));
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-active .modal-container {
    transition: all var(--duration-slow, 300ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}

.modal-leave-active .modal-container {
    transition: all var(--duration-fast, 150ms) var(--ease-in, cubic-bezier(0.4, 0, 1, 1));
}

.modal-enter-from .modal-container {
    opacity: 0;
    transform: scale(0.92) translateY(-16px);
}

.modal-leave-to .modal-container {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
}
</style>

