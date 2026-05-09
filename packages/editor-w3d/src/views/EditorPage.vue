<template>
    <div class="editor-page">
        <EditorLayout
            :project-data="projectData"
            project-id=""
            :persist-project="persistProjectData"
            :reload-project="handleReload"
            :show-toolbar="true"
            :show-left-panel="true"
            :show-right-panel="true"
            :readonly="false"
            @data-update="handleDataUpdate"
            @save="handleSave"
            @request-reload="handleReload"
            @preview="handlePreview"
            @close="handleClose"
        />
        <div v-if="isSaving" class="editor-page__saving">保存中...</div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import EditorLayout from '../components/layout/EditorLayout.vue';
import { useToast } from '../composables/useToast';
import { createDefaultProjectData } from '../utils/defaultProjectData';

const LOCAL_PROJECT_KEY = 'w3d_editor_project';
const LOCAL_PROJECT_NAME_KEY = 'w3d_editor_project_name';

const router = useRouter();
const toast = useToast();

const projectData = ref(createDefaultProjectData('未命名项目'));
const isSaving = ref(false);

const readLocalProjectData = () => {
    try {
        const raw = localStorage.getItem(LOCAL_PROJECT_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : null;
    } catch (error) {
        console.warn('[EditorPage] load local project failed:', error);
        return null;
    }
};

const writeLocalProjectData = (data) => {
    const nextData = {
        ...data,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_PROJECT_KEY, JSON.stringify(nextData, null, 2));
    localStorage.setItem(LOCAL_PROJECT_NAME_KEY, nextData.name || '未命名项目');
    return nextData;
};

const loadProjectData = () => {
    projectData.value = readLocalProjectData() || createDefaultProjectData('未命名项目');
    return projectData.value;
};

const handleDataUpdate = (data) => {
    projectData.value = data;
};

const persistProjectData = async (data, options = {}) => {
    projectData.value = data;

    try {
        isSaving.value = true;
        const savedData = writeLocalProjectData(data);
        projectData.value = savedData;
        if (!options.silent) {
            toast.success('项目已保存到本地');
        }
        return savedData;
    } catch (error) {
        console.error('[EditorPage] save local project failed:', error);
        if (!options.silent) {
            toast.error(error?.message || '保存项目失败');
        }
        throw error;
    } finally {
        isSaving.value = false;
    }
};

const handleSave = async (data) => {
    await persistProjectData(data);
};

const handleReload = async () => {
    loadProjectData();
};

const getPreviewUrl = () => {
    const route = router.resolve({ name: 'Preview' });
    return new URL(route.href, window.location.origin).toString();
};

const handlePreview = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
        toast.warning('浏览器阻止了预览窗口，请允许弹窗后重试');
        return;
    }
    previewWindow.opener = null;

    try {
        if (projectData.value) {
            await persistProjectData(projectData.value, { silent: true });
        }
        previewWindow.location.href = getPreviewUrl();
    } catch (error) {
        previewWindow.close();
        toast.error(error?.message || '打开预览失败');
    }
};

const handleClose = async () => {
    if (projectData.value) {
        await persistProjectData(projectData.value, { silent: true });
    }
};

onMounted(() => {
    loadProjectData();
});
</script>

<style scoped>
.editor-page {
    position: relative;
    width: 100%;
    height: 100%;
}

.editor-page__saving {
    position: absolute;
    right: 16px;
    bottom: 16px;
    padding: 7px 11px;
    border: 1px solid rgba(118, 144, 180, 0.16);
    border-radius: 8px;
    background: rgba(8, 15, 26, 0.86);
    color: #e2e8f0;
    font-size: 12px;
    pointer-events: none;
    backdrop-filter: blur(12px);
}
</style>
