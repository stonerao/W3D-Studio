<template>
    <div class="hdr-preview-canvas" :style="{ width: width + 'px', height: height + 'px' }">
        <canvas ref="canvasRef" class="preview-canvas"></canvas>
        <div v-if="loading" class="preview-overlay">
            <div class="loading-spinner"></div>
            <span class="overlay-text">解析 HDR 中...</span>
        </div>
        <div v-else-if="errorMsg" class="preview-overlay preview-overlay--error">
            <span class="overlay-text">{{ errorMsg }}</span>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const props = defineProps({
    file: { type: File, default: null },
    width: { type: Number, default: 350 },
    height: { type: Number, default: 200 },
});

const emit = defineEmits(['thumbnail-generated', 'error']);

const canvasRef = ref(null);
const loading = ref(false);
const errorMsg = ref(null);

let renderer = null;

// English comment.
const readFileAsArrayBuffer = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
    });

const destroyRenderer = () => {
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
};

const renderHdr = async (file) => {
    if (!file) return;

    // English comment.
    await nextTick();
    if (!canvasRef.value) return;

    destroyRenderer();
    loading.value = true;
    errorMsg.value = null;

    try {
        // English comment.
        const buffer = await readFileAsArrayBuffer(file);

        // English comment.
        renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.value,
            antialias: false,
            preserveDrawingBuffer: true,
            alpha: false,
        });
        renderer.setSize(props.width, props.height, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // English comment.
        const ext = file.name.split('.').pop().toLowerCase();
        let texData;

        if (ext === 'exr') {
            const loader = new EXRLoader();
            loader.setDataType(THREE.HalfFloatType);
            texData = loader.parse(buffer);
        } else {
            // RGBE / HDR
            const loader = new HDRLoader();
            loader.setDataType(THREE.HalfFloatType);
            texData = loader.parse(buffer);
        }

        const texture = new THREE.DataTexture(texData.data, texData.width, texData.height);
        texture.type = texData.type ?? THREE.HalfFloatType;
        texture.format = texData.format ?? THREE.RGBAFormat;
        texture.colorSpace = texData.colorSpace ?? THREE.LinearSRGBColorSpace;
        // English comment.
        texture.flipY = true;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.needsUpdate = true;

        // English comment.
        const scene = new THREE.Scene();
        scene.background = texture;

        const camera = new THREE.PerspectiveCamera(
            75, props.width / props.height, 0.1, 100
        );
        camera.position.set(0, 0, 0);

        // English comment.
        renderer.render(scene, camera);

        // English comment.
        await new Promise((r) => setTimeout(r, 32));

        // English comment.
        if (!canvasRef.value) return;

        await new Promise((resolve) => {
            canvasRef.value.toBlob(
                (blob) => {
                    if (blob) emit('thumbnail-generated', blob);
                    resolve();
                },
                'image/jpeg',
                0.88
            );
        });

        texture.dispose();
    } catch (e) {
        console.error('[HdrPreviewCanvas] 预览失败:', e);
        errorMsg.value = e?.message || '预览失败';
        emit('error', e instanceof Error ? e : new Error(String(e)));
    } finally {
        loading.value = false;
    }
};

watch(
    () => props.file,
    (file) => {
        if (file) {
            renderHdr(file);
        } else {
            destroyRenderer();
            errorMsg.value = null;
            // English comment.
            // English comment.
            if (canvasRef.value) {
                canvasRef.value.width = canvasRef.value.width;
            }
        }
    }
);

onMounted(() => {
    if (props.file) renderHdr(props.file);
});

onUnmounted(destroyRenderer);
</script>

<style scoped>
.hdr-preview-canvas {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-bg-tertiary, #1e293b);
}

.preview-canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.preview-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.55);
}

.preview-overlay--error {
    background: rgba(30, 10, 10, 0.7);
}

.overlay-text {
    font-size: 12px;
    color: var(--color-text-secondary, #94a3b8);
}

.preview-overlay--error .overlay-text {
    color: var(--color-error, #f87171);
}

.loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-top-color: var(--color-primary, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
