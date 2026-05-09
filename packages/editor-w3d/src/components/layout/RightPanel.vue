<!--
 * @Date: 2025-11-07 13:42:04
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2026-01-14 23:50:55
 * @FilePath: \sdk\packages\editor\src\components\layout\RightPanel.vue
-->
<template>
    <div class="right-panel panel" :style="{ width: 'calc(var(--panel-width) + var(--side-rail-width))' }">
        <div class="panel-content right-panel__content">
            <div class="workspace-panel-header">
                    <div class="workspace-panel-header__text">
                    <div class="workspace-panel-header__eyebrow">{{ t('panels.inspector') }}</div>
                    <div class="workspace-panel-header__title">{{ activeTabMeta.label }}</div>
                </div>
            </div>

            <div class="workspace-panel-body">
                <!-- English comment. -->
                <div v-show="activeTab === 'properties'" class="h-full">
                    <PropertyEditor />
                </div>

                <!-- English comment. -->
                <div v-show="activeTab === 'events'" class="h-full">
                    <EventEditor />
                </div>

                <!-- English comment. -->
                <div v-show="activeTab === 'data'" class="h-full">
                    <DataBindingEditor />
                </div>

                <!-- English comment. -->
                <div v-show="activeTab === 'scene'" class="h-full">
                    <SceneSettings />
                </div>

                <div v-show="activeTab === 'ai'" class="h-full">
                    <AIChatPanel />
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
import AIChatPanel from '../panels/AIChatPanel.vue';
import { useEditorI18n } from '../../i18n';

const activeTab = ref('properties');
const { t } = useEditorI18n();

const tabs = computed(() => [
    { key: 'properties', label: t('panels.properties'), icon: 'icon-yuanshujubianji' },
    { key: 'events', label: t('panels.events'), icon: 'icon-guzhang1' },
    { key: 'data', label: t('panels.data'), icon: 'icon-wanggeshezhi' },
    { key: 'scene', label: t('panels.settings'), icon: 'icon-gongzuotaimorentubiao' },
    { key: 'ai', label: t('panels.ai'), icon: 'icon-gongzuotaimorentubiao' }
]);

const activeTabMeta = computed(() => tabs.value.find((tab) => tab.key === activeTab.value) || tabs.value[0]);
</script>

<style scoped>
.right-panel {
    display: flex;
    flex-direction: row;
    height: 100%;
    min-width: 0;
    border-right: none;
    border-left: 1px solid rgba(118, 144, 180, 0.17);
    background: var(--color-workbench-panel);
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.02);
}

.right-panel__nav {
    width: var(--side-rail-width);
    flex: 0 0 var(--side-rail-width);
    border-left: 1px solid rgba(118, 144, 180, 0.14);
    background:
        linear-gradient(180deg, rgba(7, 15, 27, 0.98) 0%, rgba(5, 11, 19, 0.98) 100%);
    --tabs-rail-item-width: 48px;
    --tabs-rail-item-height: 70px;
}

.right-panel__content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    background:
        linear-gradient(180deg, rgba(10, 18, 31, 0.98) 0%, rgba(7, 14, 24, 0.98) 100%);
    overflow: hidden;
}

.workspace-panel-header {
    flex: 0 0 auto;
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 16px 18px;
    border-bottom: 1px solid rgba(118, 144, 180, 0.15);
    background:
        linear-gradient(180deg, rgba(15, 28, 45, 0.98) 0%, rgba(10, 18, 31, 0.98) 100%);
}

.workspace-panel-header__text {
    min-width: 0;
}

.workspace-panel-header__eyebrow {
    color: #7db7ff;
    font-size: 10px;
    line-height: 1;
    margin-bottom: var(--space-1);
    font-weight: var(--font-weight-semibold);
}

.workspace-panel-header__title {
    color: var(--color-text-primary);
    font-size: 16px;
    font-weight: var(--font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.workspace-panel-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 14px;
    overflow: hidden;
}
</style>

