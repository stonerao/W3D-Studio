<template>
    <Teleport to="body">
        <Transition name="context-menu">
            <div
                v-if="visible"
                ref="menuRef"
                class="context-menu"
                :style="menuStyle"
                @click.stop
            >
                <div
                    v-for="(item, index) in items"
                    :key="index"
                    class="context-menu-item"
                    :class="{
                        'disabled': item.disabled,
                        'divider': item.divider
                    }"
                    @click="handleItemClick(item)"
                >
                    <template v-if="!item.divider">
                        <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
                        <span class="item-label">{{ item.label }}</span>
                        <span v-if="item.shortcut" class="item-shortcut">{{ item.shortcut }}</span>
                    </template>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    x: {
        type: Number,
        default: 0
    },
    y: {
        type: Number,
        default: 0
    },
    items: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:visible', 'select']);

const menuRef = ref(null);

// English comment.
const menuStyle = computed(() => {
    return {
        left: `${props.x}px`,
        top: `${props.y}px`
    };
});

// English comment.
const handleItemClick = (item) => {
    if (item.disabled || item.divider) return;

    emit('select', item);
    emit('update:visible', false);

    // English comment.
    if (item.action && typeof item.action === 'function') {
        item.action();
    }
};

// English comment.
const handleClickOutside = (event) => {
    if (menuRef.value && !menuRef.value.contains(event.target)) {
        emit('update:visible', false);
    }
};

// English comment.
const handleEscape = (event) => {
    if (event.key === 'Escape') {
        emit('update:visible', false);
    }
};

// English comment.
watch(() => props.visible, (newValue) => {
    if (newValue) {
        // English comment.
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);
    } else {
        // English comment.
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
    }
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.context-menu {
    position: fixed;
    z-index: 50;
    min-width: 180px;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.4),
                0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid var(--color-border);
    padding: 0.25rem 0;
    backdrop-filter: blur(12px);
    transform-origin: top left;
}

.context-menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background-color 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                color 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                padding-left 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.context-menu-item:hover {
    background-color: var(--color-primary, #2563eb);
    color: white;
    padding-left: 1rem;
}

.context-menu-item.disabled {
    color: var(--color-text-tertiary);
    cursor: not-allowed;
}

.context-menu-item.disabled:hover {
    background-color: transparent;
}

.context-menu-item.divider {
    height: 1px;
    background-color: var(--color-border);
    margin: 0.25rem 0;
    padding: 0;
    cursor: default;
}

.context-menu-item.divider:hover {
    background-color: var(--color-border);
}

.item-icon {
    flex-shrink: 0;
    width: 1rem;
    text-align: center;
}

.item-label {
    flex: 1;
}

.item-shortcut {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
}

/* English comment. */
.context-menu-enter-active {
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.context-menu-leave-active {
    transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.context-menu-enter-from {
    opacity: 0;
    transform: scale(0.9) translateY(-4px);
}

.context-menu-leave-to {
    opacity: 0;
    transform: scale(0.95);
}
</style>

