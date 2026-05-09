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
                <span class="accordion-title">{{ item.label }}</span>
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

const props = defineProps({
    items: {
        type: Array,
        required: true,
        // items: [{ key: 'transform', label: '变换', icon: '' }]
    },
    defaultOpen: {
        type: Array,
        default: () => []
        // defaultOpen: ['transform', 'properties']
    }
});

// 展开状态管理
const expandedKeys = ref(new Set(props.defaultOpen));

// 检查是否展开
const isExpanded = (key) => {
    return expandedKeys.value.has(key);
};

// 切换展开状态
const toggle = (key) => {
    if (expandedKeys.value.has(key)) {
        expandedKeys.value.delete(key);
    } else {
        expandedKeys.value.add(key);
    }
    // 触发响应式更新
    expandedKeys.value = new Set(expandedKeys.value);
};
</script>

<style scoped>
.accordion-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.accordion-item {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    overflow: hidden;
    background-color: rgba(15, 23, 42, 0.34);
    transition: border-color var(--duration-fast, 150ms) var(--ease-out),
                box-shadow var(--duration-fast, 150ms) var(--ease-out);
}

.accordion-item:hover {
    border-color: var(--color-border-hover);
}

.accordion-item--expanded {
    border-color: var(--color-border-hover);
    box-shadow: none;
}

.accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-3);
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
    background-color: rgba(18, 27, 42, 0.82);
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
    color: var(--color-primary);
}

.accordion-title {
    flex: 1;
    letter-spacing: 0;
}

.accordion-content-wrapper {
    overflow: hidden;
}

.accordion-content {
    padding: var(--space-3);
    border-top: 1px solid var(--color-border-light);
    background-color: rgba(13, 20, 32, 0.7);
}

/* 手风琴内容展开/收起动画 */
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

