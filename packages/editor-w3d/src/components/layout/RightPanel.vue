<!--
 * @Date: 2025-11-07 13:42:04
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2026-01-14 23:50:55
 * @FilePath: \sdk\packages\editor\src\components\layout\RightPanel.vue
-->
<template>
    <div class="right-panel panel" :style="{ width: 'calc(var(--panel-width) + 60px)' }">
        <div class="panel-content right-panel__content">
            <div class="workspace-panel-header">
                <div class="workspace-panel-header__text">
                    <div class="workspace-panel-header__eyebrow">检查器</div>
                    <div class="workspace-panel-header__title">{{ activeTabMeta.label }}</div>
                </div>
            </div>

            <div class="workspace-panel-body">
                <!-- 属性编辑器 -->
                <div v-show="activeTab === 'properties'" class="h-full">
                    <PropertyEditor />
                </div>

                <!-- 事件管理 -->
                <div v-show="activeTab === 'events'" class="h-full">
                    <EventEditor />
                </div>

                <!-- 数据接入 -->
                <div v-show="activeTab === 'data'" class="h-full">
                    <DataBindingEditor />
                </div>

                <!-- 场景设置 -->
                <div v-show="activeTab === 'scene'" class="h-full">
                    <SceneSettings />
                </div>

            </div>
        </div>

        <Tabs v-model="activeTab" :tabs="tabs" orientation="vertical" class="right-panel__nav" />
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Tabs from '../ui/Tabs.vue';
import PropertyEditor from '../panels/PropertyEditor.vue';
import EventEditor from '../panels/EventEditor.vue';
import DataBindingEditor from '../panels/DataBindingEditor.vue';
import SceneSettings from '../panels/SceneSettings.vue';

const activeTab = ref('properties');

const tabs = [
    { key: 'properties', label: '属性', icon: 'icon-yuanshujubianji' },
    { key: 'events', label: '事件', icon: 'icon-guzhang1' },
    { key: 'data', label: '数据', icon: 'icon-wanggeshezhi' },
    { key: 'scene', label: '设置', icon: 'icon-gongzuotaimorentubiao' }
];

const activeTabMeta = computed(() => tabs.find((tab) => tab.key === activeTab.value) || tabs[0]);
</script>

<style scoped>
.right-panel {
    display: flex;
    flex-direction: row;
    height: 100%;
    min-width: 0;
    border-right: none;
    border-left: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.right-panel__nav {
    width: 60px;
    flex: 0 0 60px;
    border-left: 1px solid var(--color-border);
    background: #09111d;
}

.right-panel__content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    background: var(--color-bg-secondary);
    overflow: hidden;
}

.workspace-panel-header {
    flex: 0 0 auto;
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    background: rgba(13, 20, 32, 0.96);
}

.workspace-panel-header__text {
    min-width: 0;
}

.workspace-panel-header__eyebrow {
    color: var(--color-text-tertiary);
    font-size: 10px;
    line-height: 1;
    margin-bottom: var(--space-1);
}

.workspace-panel-header__title {
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.workspace-panel-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--space-3);
    overflow: hidden;
}
</style>

