<template>
    <div id="editor-app" class="w-full h-full">
        <router-view />
        <Toast ref="toastRef" />
        <ConfirmDialog />
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Toast from './components/ui/Toast.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
import { useToast } from './composables/useToast';

const toast = useToast();

// English comment.
const toastRef = ref(null);

// English comment.
onMounted(() => {
    if (toastRef.value) {
        toast.setToastInstance(toastRef.value);
    }

});

</script>

<style scoped>
#editor-app {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}
</style>

