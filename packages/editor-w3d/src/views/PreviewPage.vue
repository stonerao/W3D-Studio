<template>
    <div class="preview-page-wrapper">
        <Preview
            :project-data="projectData"
            :show-toolbar="true"
            header-title="预览模式"
        />
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import Preview from './Preview.vue';
import { createDefaultProjectData } from '../utils/defaultProjectData';

const LOCAL_PROJECT_KEY = 'w3d_editor_project';

const projectData = ref(createDefaultProjectData('未命名项目'));

const loadProjectData = () => {
    try {
        const raw = localStorage.getItem(LOCAL_PROJECT_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
            projectData.value = data;
        }
    } catch (error) {
        console.warn('[PreviewPage] load local project failed:', error);
    }
};

onMounted(() => {
    loadProjectData();
});
</script>

<style scoped>
.preview-page-wrapper {
    width: 100%;
    height: 100%;
}
</style>
