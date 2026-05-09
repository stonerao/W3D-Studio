import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useEditorStore = defineStore('editor', () => {
    const mode = ref('edit');
    const showLeftPanel = ref(true);
    const showRightPanel = ref(true);
    const activeLeftPanelTab = ref('components');

    const setMode = (newMode) => {
        mode.value = newMode;
    };

    const toggleLeftPanel = () => {
        showLeftPanel.value = !showLeftPanel.value;
    };

    const toggleRightPanel = () => {
        showRightPanel.value = !showRightPanel.value;
    };

    const setActiveLeftPanelTab = (tabKey) => {
        activeLeftPanelTab.value = String(tabKey || 'components');
    };

    return {
        mode,
        showLeftPanel,
        showRightPanel,
        activeLeftPanelTab,
        setMode,
        toggleLeftPanel,
        toggleRightPanel,
        setActiveLeftPanelTab
    };
});
