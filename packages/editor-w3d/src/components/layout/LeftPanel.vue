<template>
    <div class="left-panel panel" :style="{ width: 'calc(var(--panel-width) + var(--left-module-rail-width))' }">
        <Tabs v-model="activeTab" :tabs="tabs" orientation="vertical" class="left-panel__nav" />

        <div class="panel-content left-panel__content">
            <div class="workspace-panel-body">
                <div v-show="activeTab === 'components'" class="h-full">
                    <ComponentLibrary @component-added="handleComponentAdded" />
                </div>

                <div v-show="activeTab === 'tree'" class="h-full">
                    <SceneTree
                        @component-selected="handleComponentSelected"
                        @component-deleted="handleComponentDeleted"
                    />
                </div>

                <div v-show="activeTab === 'variables'" class="h-full">
                    <VariablesEditor />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Tabs from '../ui/Tabs.vue';
import ComponentLibrary from '../panels/ComponentLibrary.vue';
import SceneTree from '../panels/SceneTree.vue';
import VariablesEditor from '../panels/VariablesEditor.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useEditorI18n } from '../../i18n';

const AVAILABLE_LEFT_PANEL_TABS = new Set(['components', 'tree', 'variables']);
const normalizeLeftPanelTab = (tab) => AVAILABLE_LEFT_PANEL_TABS.has(tab) ? tab : 'tree';

const editorStore = useEditorStore();
const activeTab = ref(normalizeLeftPanelTab(editorStore.activeLeftPanelTab));
const componentStore = useComponentStore();
const { t } = useEditorI18n();

const tabs = computed(() => [
    { key: 'tree', label: t('panels.sceneTree'), icon: 'icon-wenjianjia' },
    { key: 'components', label: t('panels.components'), icon: 'icon-gongzuotaimorentubiao' },
    { key: 'variables', label: t('panels.variables'), icon: 'icon-yuanshujubianji' }
]);

const handleComponentAdded = () => {
    activeTab.value = 'tree';
};

const handleComponentSelected = (componentId) => {
    console.log('Component selected:', componentId);
};

const handleComponentDeleted = (componentId) => {
    console.log('Component deleted:', componentId);
};

watch(
    () => componentStore.components.length,
    (nextLength, previousLength) => {
        if (nextLength > previousLength) {
            activeTab.value = 'tree';
        }
    }
);

watch(activeTab, (tab) => {
    const normalized = normalizeLeftPanelTab(tab);
    if (normalized !== tab) {
        activeTab.value = normalized;
        return;
    }
    editorStore.setActiveLeftPanelTab(normalized);
});

watch(
    () => editorStore.activeLeftPanelTab,
    (tab) => {
        const normalized = normalizeLeftPanelTab(tab);
        if (normalized === activeTab.value) return;
        activeTab.value = normalized;
    }
);
</script>

<style scoped>
.left-panel {
    display: flex;
    flex-direction: row;
    height: 100%;
    min-width: 0;
    background: var(--color-workbench-panel);
    border-right: 1px solid rgba(118, 144, 180, 0.17);
    box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.02);
}

.left-panel__nav {
    width: var(--left-module-rail-width);
    flex: 0 0 var(--left-module-rail-width);
    border-right: 1px solid rgba(118, 144, 180, 0.14);
    background:
        linear-gradient(180deg, rgba(7, 15, 27, 0.98) 0%, rgba(5, 11, 19, 0.98) 100%);
    --tabs-rail-item-width: 58px;
    --tabs-rail-item-height: 68px;
    --tabs-rail-padding-x: 6px;
    --tabs-rail-gap: 8px;
    --tabs-hover-bg: transparent;
    --tabs-hover-color: #d8eaff;
    --tabs-active-bg: transparent;
    --tabs-active-shadow: none;
    --tabs-active-color: #58a2ff;
    --tabs-active-icon-color: #58a2ff;
}

.left-panel__content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    background:
        linear-gradient(180deg, rgba(10, 18, 31, 0.98) 0%, rgba(7, 14, 24, 0.98) 100%);
    overflow: hidden;
}

.workspace-panel-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 0;
    overflow: hidden;
}
</style>
