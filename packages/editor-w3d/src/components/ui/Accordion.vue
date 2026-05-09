<template>
    <div class="accordion-container">
        <div
            v-for="item in items"
            :key="item.key"
            class="accordion-item"
            :class="{ 'accordion-item--expanded': isExpanded(item.key) }"
            :data-accordion-key="item.key"
            :data-expanded="isExpanded(item.key) ? 'true' : 'false'"
        >
            <button
                class="accordion-header"
                :class="{ expanded: isExpanded(item.key) }"
                @click="toggle(item.key)"
            >
                <span class="accordion-arrow">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M3 2L7 5L3 8V2Z" />
                    </svg>
                </span>
                <span class="accordion-title">{{ displayText(item.label) }}</span>
            </button>
            <Transition name="accordion-content">
                <div v-show="isExpanded(item.key)" class="accordion-content-wrapper">
                    <div class="accordion-content">
                        <slot :name="item.key"></slot>
                    </div>
                </div>
            </Transition>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { translateDisplayText } from '../../i18n';

const props = defineProps({
    items: {
        type: Array,
        required: true,
        // English comment.
    },
    defaultOpen: {
        type: Array,
        default: () => []
        // defaultOpen: ['transform', 'properties']
    }
});

// English comment.
const expandedKeys = ref(new Set(props.defaultOpen));

const displayText = (value) => translateDisplayText(value);

// English comment.
const isExpanded = (key) => {
    return expandedKeys.value.has(key);
};

// English comment.
const toggle = (key) => {
    if (expandedKeys.value.has(key)) {
        expandedKeys.value.delete(key);
    } else {
        expandedKeys.value.add(key);
    }
    // English comment.
    expandedKeys.value = new Set(expandedKeys.value);
};
</script>

<style scoped>
.accordion-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.accordion-item {
    border: 1px solid rgba(118, 144, 180, 0.15);
    border-radius: 8px;
    overflow: hidden;
    background:
        linear-gradient(180deg, rgba(16, 28, 45, 0.74) 0%, rgba(9, 17, 29, 0.74) 100%);
    transition: border-color var(--duration-fast, 150ms) var(--ease-out),
                box-shadow var(--duration-fast, 150ms) var(--ease-out);
}

.accordion-item:hover {
    border-color: var(--color-border-hover);
}

.accordion-item--expanded {
    border-color: rgba(125, 183, 255, 0.24);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 48px;
    padding: 0 14px;
    background-color: transparent;
    text-align: left;
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
    border: none;
    cursor: pointer;
    transition: background-color var(--duration-fast, 150ms) var(--ease-out);
}

.accordion-header:hover {
    background-color: var(--color-bg-hover);
}

.accordion-header.expanded {
    background:
        linear-gradient(180deg, rgba(18, 32, 52, 0.92) 0%, rgba(12, 22, 37, 0.92) 100%);
}

.accordion-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: var(--color-text-tertiary);
    transition: transform var(--duration-normal, 200ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)),
                color var(--duration-fast, 150ms) var(--ease-out);
}

.accordion-header.expanded .accordion-arrow {
    transform: rotate(90deg);
    color: #7db7ff;
}

.accordion-title {
    flex: 1;
    letter-spacing: 0;
}

.accordion-content-wrapper {
    overflow: hidden;
}

.accordion-content {
    padding: 14px;
    border-top: 1px solid rgba(118, 144, 180, 0.1);
    background-color: rgba(7, 14, 24, 0.58);
}

/* English comment. */
.accordion-content-enter-active {
    animation: accordion-expand var(--duration-slow, 300ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}

.accordion-content-leave-active {
    animation: accordion-collapse var(--duration-fast, 150ms) var(--ease-in, cubic-bezier(0.4, 0, 1, 1));
}

@keyframes accordion-expand {
    from {
        opacity: 0;
        max-height: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        max-height: 1000px;
        transform: translateY(0);
    }
}

@keyframes accordion-collapse {
    from {
        opacity: 1;
        max-height: 1000px;
    }
    to {
        opacity: 0;
        max-height: 0;
    }
}
</style>

