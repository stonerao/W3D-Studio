<!--
 * @Date: 2025-11-07 13:42:04
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2026-01-20 02:46:55
 * @FilePath: \sdk\packages\editor\src\components\ui\Tabs.vue
-->
<template>
    <div class="tabs-container" :class="`tabs-container--${orientation}`">
        <div
            class="tabs-scroll-shell"
            :class="[
                `tabs-scroll-shell--${orientation}`,
                {
                    'tabs-scroll-shell--left-fade': showStartFade,
                    'tabs-scroll-shell--right-fade': showEndFade
                }
            ]"
        >
            <button
                v-if="showScrollControls"
                type="button"
                class="tabs-scroll-btn tabs-scroll-btn--start"
                :disabled="!canScrollPrev"
                :aria-label="t('tabs.scrollPrev')"
                @click="scrollTabs('prev')"
            >
                ‹
            </button>
            <div
                ref="tabsHeaderRef"
                class="tabs-header"
                :class="`tabs-header--${orientation}`"
                @scroll="updateScrollState"
            >
                <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    class="tab-item"
                    :class="[{ active: modelValue === tab.key }, `tab-item--${orientation}`]"
                    :title="tab.label"
                    @click="handleTabClick(tab.key)"
                >
                    <span v-if="tab.icon" class="tab-item__icon-wrap" aria-hidden="true">
                        <i class="sico tab-item__icon" :class="tab.icon"></i>
                    </span>
                    <span class="tab-item__label">{{ tab.label }}</span>
                    <span v-if="tab.badge" class="tab-item__badge">{{ tab.badge }}</span>
                </button>
            </div>
            <button
                v-if="showScrollControls"
                type="button"
                class="tabs-scroll-btn tabs-scroll-btn--end"
                :disabled="!canScrollNext"
                :aria-label="t('tabs.scrollNext')"
                @click="scrollTabs('next')"
            >
                ›
            </button>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import '../../styles/icon/iconfont.css';
import { useEditorI18n } from '../../i18n';

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    tabs: {
        type: Array,
        required: true
    },
    orientation: {
        type: String,
        default: 'horizontal'
    }
});

const emit = defineEmits(['update:modelValue']);
const { t } = useEditorI18n();
const tabsHeaderRef = ref(null);
const canScrollPrev = ref(false);
const canScrollNext = ref(false);
let resizeObserver = null;

const handleTabClick = (key) => {
    emit('update:modelValue', key);
};

const showScrollControls = computed(() => props.orientation === 'horizontal');
const showStartFade = computed(() => showScrollControls.value && canScrollPrev.value);
const showEndFade = computed(() => showScrollControls.value && canScrollNext.value);

const updateScrollState = () => {
    const el = tabsHeaderRef.value;
    if (!el || props.orientation !== 'horizontal') {
        canScrollPrev.value = false;
        canScrollNext.value = false;
        return;
    }

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    canScrollPrev.value = el.scrollLeft > 4;
    canScrollNext.value = el.scrollLeft < maxScrollLeft - 4;
};

const scrollTabs = (direction) => {
    const el = tabsHeaderRef.value;
    if (!el) return;

    const delta = Math.max(120, Math.round(el.clientWidth * 0.55));
    el.scrollBy({
        left: direction === 'next' ? delta : -delta,
        behavior: 'smooth'
    });
};

const syncScrollStateSoon = async () => {
    await nextTick();
    updateScrollState();
};

onMounted(() => {
    syncScrollStateSoon();

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            updateScrollState();
        });

        if (tabsHeaderRef.value) {
            resizeObserver.observe(tabsHeaderRef.value);
        }
    }

    window.addEventListener('resize', updateScrollState);
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect?.();
    window.removeEventListener('resize', updateScrollState);
});

watch(() => props.tabs, syncScrollStateSoon, { deep: true });
watch(() => props.modelValue, syncScrollStateSoon);
watch(() => props.orientation, syncScrollStateSoon);
</script>

<style scoped>
.tabs-container {
    background-color: transparent;
}

.tabs-scroll-shell {
    position: relative;
}

.tabs-container--vertical {
    height: 100%;
}

.tabs-scroll-shell--horizontal {
    display: flex;
    align-items: stretch;
}

.tabs-scroll-shell--vertical {
    height: 100%;
}

.tabs-header {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
}

.tabs-scroll-shell--left-fade::before,
.tabs-scroll-shell--right-fade::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 1px;
    width: 24px;
    pointer-events: none;
    z-index: 1;
}

.tabs-scroll-shell--left-fade::before {
    left: 0;
    background: linear-gradient(90deg, var(--color-bg-secondary) 20%, rgba(37, 37, 55, 0));
}

.tabs-scroll-shell--right-fade::after {
    right: 0;
    background: linear-gradient(270deg, var(--color-bg-secondary) 20%, rgba(37, 37, 55, 0));
}

.tabs-header--vertical {
    flex-direction: column;
    height: 100%;
    border-right: none;
    border-bottom: none;
    overflow: visible;
    align-items: center;
    padding: var(--tabs-rail-padding-y, 18px) var(--tabs-rail-padding-x, 8px);
    gap: var(--tabs-rail-gap, 10px);
}

.tab-item {
    position: relative;
    z-index: 0;
    isolation: isolate;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0.75rem 1rem;
    font-size: 0.775rem;
    font-weight: 500;
    color: rgba(169, 183, 201, 0.78);
    background-color: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition:
        color var(--transition-fast),
        background-color var(--transition-fast),
        border-color var(--transition-fast);
}

.tabs-header::-webkit-scrollbar {
    display: none;
}

.tabs-scroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(116, 127, 255, 0.22);
    border-radius: 999px;
    background: rgba(49, 53, 84, 0.92);
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity var(--duration-fast, 150ms) var(--ease-out),
                color var(--duration-fast, 150ms) var(--ease-out),
                border-color var(--duration-fast, 150ms) var(--ease-out);
}

.tabs-scroll-btn:hover:not(:disabled) {
    color: var(--color-text-primary);
    border-color: rgba(116, 127, 255, 0.48);
}

.tabs-scroll-btn:disabled {
    opacity: 0;
    pointer-events: none;
}

.tabs-scroll-btn--start {
    left: 4px;
}

.tabs-scroll-btn--end {
    right: 4px;
}

.tab-item--vertical {
    flex-direction: column;
    justify-content: center;
    width: var(--tabs-rail-item-width, 74px);
    min-height: var(--tabs-rail-item-height, 72px);
    padding: var(--tabs-rail-item-padding, 10px 6px);
    border-bottom: none;
    border-left: 0;
    border-radius: 8px;
    gap: 8px;
}

.tab-item__icon-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    transition:
        background-color var(--transition-fast),
        box-shadow var(--transition-fast),
        color var(--transition-fast);
}

.tab-item__icon {
    font-size: 19px;
}

.tab-item__label {
    line-height: 1;
    white-space: nowrap;
}

.tab-item--vertical .tab-item__label {
    max-width: 64px;
    overflow: hidden;
    font-size: 12px;
    font-weight: var(--font-weight-semibold);
    text-overflow: ellipsis;
}

.tab-item__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
    font-size: 0.675rem;
    font-weight: 700;
    line-height: 1;
}

.tab-item--vertical .tab-item__badge {
    position: absolute;
    top: 10px;
    right: 10px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 0.625rem;
}

/* English comment. */
.tab-item::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--color-primary);
    transition: all var(--duration-normal, 200ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
    transform: translateX(-50%);
}

.tab-item--vertical::after {
    display: none;
}

.tab-item:hover {
    color: var(--tabs-hover-color, var(--color-text-primary));
    background-color: var(--tabs-hover-bg, rgba(125, 183, 255, 0.06));
}

.tab-item:hover .tab-item__icon-wrap {
    background: transparent;
}

.tab-item:hover::after {
    width: 30%;
    background: rgba(148, 163, 184, 0.45);
}

.tab-item.active {
    color: var(--tabs-active-color, #58a2ff);
    border-bottom-color: transparent;
    background: var(--tabs-active-bg, linear-gradient(180deg, rgba(22, 70, 142, 0.62) 0%, rgba(11, 47, 103, 0.62) 100%));
    box-shadow: var(--tabs-active-shadow, inset 0 0 0 1px rgba(74, 144, 255, 0.16), 0 12px 28px rgba(28, 100, 242, 0.16));
}

.tab-item.active .tab-item__icon-wrap {
    background: transparent;
    color: var(--tabs-active-icon-color, #58a2ff);
    box-shadow: none;
}

.tab-item--vertical.active {
    border-left-color: transparent;
}

.tab-item.active .tab-item__badge {
    background: rgba(59, 130, 246, 0.18);
    color: #93c5fd;
}

.tab-item.active::after {
    width: 100%;
    background: var(--color-primary);
}

.tab-item--vertical.active::after {
    display: none;
}
</style>

