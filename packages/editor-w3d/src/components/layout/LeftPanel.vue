<template>
    <div class="left-panel panel" :style="{ width: 'calc(var(--panel-width) + 60px)' }">
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
const normalizeLeftPanelTab = (tab) => AVAILABLE_LEFT_PANEL_TABS.has(tab) ? tab : 'components';

const editorStore = useEditorStore();
const activeTab = ref(normalizeLeftPanelTab(editorStore.activeLeftPanelTab));
const componentStore = useComponentStore();
const { t } = useEditorI18n();

const tabs = computed(() => [
    { key: 'components', label: t('panels.components'), icon: 'icon-gongzuotaimorentubiao' },
    { key: 'tree', label: t('panels.sceneTree'), icon: 'icon-wenjianjia' },
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
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-border);
}

.left-panel__nav {
    width: 60px;
    flex: 0 0 60px;
    border-right: 1px solid var(--color-border);
    background: #09111d;
}

.left-panel__content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
    background: var(--color-bg-secondary);
    overflow: hidden;
}

.workspace-panel-body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 0;
    overflow: hidden;
}
</style>
