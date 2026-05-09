<template>
    <div
        class="event-editor"
        @mousedown.stop
        @click.stop
        @dblclick.stop
    >
        <div v-if="!selectedComponent" class="empty-state empty-state--panel">
            <div class="empty-state__mark">EVT</div>
            <div class="empty-state__title">未选择组件</div>
            <div class="empty-state__desc">选择画布中的组件后，可以在这里配置交互事件。</div>
        </div>

        <div v-else class="event-content">
            <section class="component-summary" aria-label="当前组件">
                <div class="component-summary__main">
                    <div class="component-summary__eyebrow">当前组件</div>
                    <div class="component-summary__name" :title="selectedComponent.name">
                        {{ selectedComponent.name }}
                    </div>
                    <div class="component-summary__meta">
                        <span>{{ selectedComponent.type || '-' }}</span>
                        <span>{{ eventSummaryText }}</span>
                    </div>
                </div>
                <span :class="['event-status', eventStatusClass]">{{ eventStatusLabel }}</span>
            </section>

            <div class="blueprint-entry">
                <div class="blueprint-entry-main">
                    <div class="blueprint-entry-kicker">事件编排</div>
                    <div class="blueprint-entry-title">蓝图事件流</div>
                    <div class="blueprint-entry-desc">
                        统一配置入口、判断条件和执行动作。
                    </div>
                </div>
                <Button
                    class="blueprint-entry-action"
                    variant="primary"
                    size="sm"
                    :disabled="isEventConfigBlocked"
                    @click="handleOpenBlueprintEditor"
                >
                    配置蓝图
                </Button>
            </div>

            <div class="blueprint-summary">
                <div class="summary-header">
                    <div>
                        <div class="summary-title">事件入口</div>
                        <div class="summary-desc">{{ eventSummaryText }}</div>
                    </div>
                    <span class="summary-count">{{ componentEvents.length }}</span>
                </div>

                <div v-if="componentEvents.length === 0" class="blueprint-empty">
                    <div class="blueprint-empty__icon">+</div>
                    <div class="blueprint-empty__title">暂无事件入口</div>
                    <div class="blueprint-empty__desc">进入蓝图后添加点击、悬停、数据更新等触发入口。</div>
                    <Button
                        variant="outline"
                        size="sm"
                        block
                        :disabled="isEventConfigBlocked"
                        @click="handleOpenBlueprintEditor"
                    >
                        打开蓝图
                    </Button>
                </div>

                <div v-else class="event-chips">
                    <button
                        v-for="event in componentEvents"
                        :key="event.id"
                        type="button"
                        class="event-chip"
                        @click="handleOpenBlueprintEditor"
                    >
                        <span class="event-chip-main">
                            <span class="event-chip-name">{{ getEventDisplayName(event.type) }}</span>
                            <span class="event-chip-type">{{ event.type || '-' }}</span>
                        </span>
                        <span class="event-chip-state" :class="{ disabled: event.enabled === false }">
                            {{ event.enabled === false ? '停用' : '启用' }}
                        </span>
                    </button>
                </div>
            </div>
        </div>

        <EventBlueprintEditor
            v-model="blueprintEditorVisible"
            :component="selectedComponent"
            :disabled="isEventConfigBlocked"
            @save="handleSaveBlueprintEvents"
        />
    </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useEventSystem } from '../../composables/useEventSystem';
import { getEventMetadata } from '../../config/eventTypes';
import { useToast } from '../../composables/useToast';
import Button from '../ui/Button.vue';
import EventBlueprintEditor from './EventBlueprintEditor.vue';

const componentStore = useComponentStore();
const { replaceComponentEvents } = useEventSystem();
const toast = useToast();

const selectedComponent = computed(() => componentStore.selectedComponent);
const componentEvents = computed(() => selectedComponent.value?.events || []);
const enabledEventCount = computed(() => componentEvents.value.filter((event) => event?.enabled !== false).length);

const eventSummaryText = computed(() => {
    if (componentEvents.value.length === 0) return '0 个事件入口';
    if (enabledEventCount.value === componentEvents.value.length) {
        return `${componentEvents.value.length} 个事件入口`;
    }
    return `${enabledEventCount.value}/${componentEvents.value.length} 个已启用`;
});

const eventStatusLabel = computed(() => {
    if (isEventConfigBlocked.value) return '已禁用';
    if (componentEvents.value.length === 0) return '未配置';
    return `${componentEvents.value.length} 个入口`;
});

const eventStatusClass = computed(() => {
    if (isEventConfigBlocked.value) return 'event-status--blocked';
    if (componentEvents.value.length === 0) return 'event-status--empty';
    return 'event-status--active';
});

const isEventConfigBlocked = computed(() => {
    return false;
});

const blueprintEditorVisible = ref(false);
const reselectionTimers = new Set();

const clearReselectionTimers = () => {
    reselectionTimers.forEach((timer) => clearTimeout(timer));
    reselectionTimers.clear();
};

const keepSelectedComponent = (componentId) => {
    if (!componentId) return;

    let attempts = 0;
    const maxAttempts = 8;
    const retryDelayMs = 100;

    const tryReselect = () => {
        attempts += 1;

        if (componentStore.selectedComponentId === componentId) {
            return;
        }

        const exists = componentStore.components.some((component) => component.id === componentId);
        if (exists) {
            componentStore.selectComponent(componentId);
        }

        if (componentStore.selectedComponentId === componentId || attempts >= maxAttempts) {
            return;
        }

        const timer = setTimeout(() => {
            reselectionTimers.delete(timer);
            tryReselect();
        }, retryDelayMs);
        reselectionTimers.add(timer);
    };

    tryReselect();
};

const getEventDisplayName = (type) => {
    const meta = getEventMetadata(type);
    return meta?.displayName || type || '未知事件';
};

const handleOpenBlueprintEditor = () => {
    if (isEventConfigBlocked.value) {
        toast.warning('当前组件不可配置事件');
        return;
    }
    if (!selectedComponent.value) return;
    blueprintEditorVisible.value = true;
};

const handleSaveBlueprintEvents = (events) => {
    if (isEventConfigBlocked.value) {
        toast.warning('当前组件不可配置事件');
        return;
    }
    if (!selectedComponent.value) return;

    const componentId = selectedComponent.value.id;
    replaceComponentEvents(componentId, Array.isArray(events) ? events : []);
    keepSelectedComponent(componentId);
    toast.success('蓝图事件已保存');
};

onUnmounted(() => {
    clearReselectionTimers();
});
</script>

<style scoped>
.event-editor {
    padding: 0.625rem 0.75rem 0.75rem;
    height: 100%;
    overflow-y: auto;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 180px;
    padding: 1.5rem 0.75rem;
    text-align: center;
    border: 1px dashed rgba(148, 163, 184, 0.18);
    border-radius: var(--border-radius-md);
    background: rgba(15, 23, 42, 0.32);
}

.empty-state--panel {
    min-height: 240px;
}

.empty-state__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--border-radius-md);
    color: var(--color-primary);
    background-color: rgba(47, 125, 244, 0.12);
    border: 1px solid rgba(47, 125, 244, 0.24);
    font-size: 0.625rem;
    font-weight: 800;
    letter-spacing: 0;
}

.empty-state__title {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 700;
}

.empty-state__desc {
    max-width: 190px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
}

.event-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.component-summary {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    background: linear-gradient(180deg, rgba(18, 27, 42, 0.88), rgba(13, 20, 32, 0.72));
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: var(--border-radius-md);
}

.component-summary__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.component-summary__eyebrow {
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
    font-weight: 600;
}

.component-summary__name {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.component-summary__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
}

.component-summary__meta span + span::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 3px;
    margin: 0 0.5rem 0.125rem 0;
    border-radius: 50%;
    background-color: var(--color-text-muted);
}

.event-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    height: 1.375rem;
    padding: 0 0.5rem;
    border-radius: var(--border-radius-full);
    font-size: 0.6875rem;
    font-weight: 700;
    border: 1px solid transparent;
}

.event-status--empty {
    color: #fde68a;
    background-color: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
}

.event-status--active {
    color: #bfdbfe;
    background-color: rgba(47, 125, 244, 0.14);
    border-color: rgba(47, 125, 244, 0.32);
}

.event-status--blocked {
    color: #fca5a5;
    background-color: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.28);
}

.event-warning {
    padding: 0.625rem 0.75rem;
    color: #fca5a5;
    font-size: 0.75rem;
    line-height: 1.5;
    background-color: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: var(--border-radius-md);
}

.blueprint-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 0.625rem;
    padding: 0.75rem;
    border: 1px solid rgba(47, 125, 244, 0.24);
    border-radius: var(--border-radius-md);
    background: linear-gradient(180deg, rgba(47, 125, 244, 0.12), rgba(15, 23, 42, 0.34));
}

.blueprint-entry-main {
    min-width: 0;
}

.blueprint-entry-kicker {
    margin-bottom: 0.25rem;
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
    font-weight: 600;
}

.blueprint-entry-title {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 700;
}

.blueprint-entry-desc {
    margin-top: 0.375rem;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    line-height: 1.45;
}

.blueprint-entry-action {
    flex-shrink: 0;
    padding-inline: 0.625rem;
}

.blueprint-summary {
    padding: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: var(--border-radius-md);
    background-color: rgba(18, 27, 42, 0.58);
}

.summary-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.summary-title {
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 700;
}

.summary-desc {
    margin-top: 0.125rem;
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
    line-height: 1.35;
}

.summary-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.375rem;
    height: 1.375rem;
    padding: 0 0.375rem;
    border-radius: var(--border-radius-full);
    color: var(--color-text-secondary);
    background-color: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.16);
    font-size: 0.6875rem;
    font-weight: 700;
}

.blueprint-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 1.125rem 0.75rem;
    text-align: center;
    border: 1px dashed rgba(148, 163, 184, 0.2);
    border-radius: var(--border-radius-md);
    background: rgba(15, 23, 42, 0.3);
}

.blueprint-empty__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--border-radius-md);
    color: var(--color-primary);
    background-color: rgba(47, 125, 244, 0.12);
    border: 1px solid rgba(47, 125, 244, 0.28);
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1;
}

.blueprint-empty__title {
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 700;
}

.blueprint-empty__desc {
    max-width: 210px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
}

.event-chips {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-top: 0.75rem;
}

.event-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-width: 0;
    gap: 0.75rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius-sm);
    background: rgba(15, 23, 42, 0.34);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.event-chip:hover {
    border-color: rgba(47, 125, 244, 0.42);
    background-color: rgba(24, 35, 56, 0.72);
}

.event-chip-main {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
}

.event-chip-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    font-weight: 700;
}

.event-chip-type {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
}

.event-chip-state {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.25rem;
    padding: 0 0.45rem;
    border-radius: var(--border-radius-full);
    color: #86efac;
    background-color: rgba(34, 197, 94, 0.14);
    border: 1px solid rgba(34, 197, 94, 0.34);
    font-size: 0.6875rem;
    font-weight: 700;
}

.event-chip-state.disabled {
    color: var(--color-text-tertiary);
    background-color: rgba(148, 163, 184, 0.1);
    border-color: rgba(148, 163, 184, 0.18);
}
</style>
