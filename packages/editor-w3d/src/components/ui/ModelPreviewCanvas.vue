<template>
    <div class="model-preview-canvas">
        <div
            ref="canvasContainer"
            class="canvas-container"
            :style="{ width: width + 'px', height: height + 'px' }"
        ></div>
        <div v-if="loading" class="loading-overlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">{{ loadingText }}</div>
        </div>
        <div v-if="error" class="error-overlay">
            <div class="error-text">{{ error }}</div>
        </div>
        <div v-if="modelInfo" class="model-info">
            <div class="info-item">
                <span class="label">文件名:</span>
                <span class="value">{{ modelInfo.fileName }}</span>
            </div>
            <div class="info-item">
                <span class="label">文件大小:</span>
                <span class="value">{{ formatFileSize(modelInfo.fileSize) }}</span>
            </div>
            <div class="info-item">
                <span class="label">文件类型:</span>
                <span class="value">{{ modelInfo.fileType }}</span>
            </div>
            <div v-if="modelInfo.vertices" class="info-item">
                <span class="label">顶点数:</span>
                <span class="value">{{ modelInfo.vertices.toLocaleString() }}</span>
            </div>
            <div v-if="modelInfo.triangles" class="info-item">
                <span class="label">三角面数:</span>
                <span class="value">{{ modelInfo.triangles.toLocaleString() }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { Scene } from '@w3d/core';
import { registerAllComponents, applyBackground } from '../../composables/useSceneCommon';

const props = defineProps({
    file: {
        type: File,
        default: null
    },
    width: {
        type: Number,
        default: 500
    },
    height: {
        type: Number,
        default: 400
    }
});

const emit = defineEmits(['loaded', 'error', 'thumbnail-generated']);

const canvasContainer = ref(null);
const loading = ref(false);
const loadingText = ref('加载中...');
const error = ref(null);
const modelInfo = ref(null);

let scene = null;
let modelLoader = null;
let currentObjectUrl = null;
let resizeObserver = null;
let initPromise = null;

const GRID_NAME = '__model_preview_grid__';
const MODEL_NAME = '__model_preview_model__';
const previewMaterialCache = new WeakMap();

/**
 * English comment.
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
};

const createPreviewBasicMaterial = (sourceMaterial) => {
    if (!sourceMaterial) {
        return new THREE.MeshBasicMaterial({ color: '#bfc7d5' });
    }

    const cached = previewMaterialCache.get(sourceMaterial);
    if (cached) {
        return cached;
    }

    const basicMaterial = new THREE.MeshBasicMaterial({
        color: sourceMaterial.color?.clone?.() || new THREE.Color('#bfc7d5'),
        map: sourceMaterial.map || null,
        transparent: sourceMaterial.transparent === true,
        opacity: Number.isFinite(sourceMaterial.opacity) ? sourceMaterial.opacity : 1,
        alphaTest: Number.isFinite(sourceMaterial.alphaTest) ? sourceMaterial.alphaTest : 0,
        side: sourceMaterial.side ?? THREE.FrontSide,
        wireframe: sourceMaterial.wireframe === true,
        fog: false
    });

    basicMaterial.name = sourceMaterial.name
        ? `${sourceMaterial.name}_preview_basic`
        : 'preview_basic_material';

    previewMaterialCache.set(sourceMaterial, basicMaterial);
    return basicMaterial;
};

const replacePreviewMaterials = (root) => {
    if (!root?.traverse) return;

    root.traverse((child) => {
        if (!child?.isMesh || !child.material) return;

        child.material = Array.isArray(child.material)
            ? child.material.map((material) => createPreviewBasicMaterial(material))
            : createPreviewBasicMaterial(child.material);
    });
};

/**
 * English comment.
 */
const initScene = async () => {
    if (!canvasContainer.value) return;

    // English comment.
    cleanup();

    scene = new Scene(canvasContainer.value, {
        isRendering: true,
        isResize: false,
        dracoDecoderPath: '/draco/',
        renderer: {
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true
        },
        camera: {
            fov: 45,
            near: 0.1,
            far: 1000000,
            position: [5, 5, 5],
            lookAt: [0, 0, 0]
        },
        controls: {
            enableDamping: true,
            dampingFactor: 0.05,
            enableZoom: true,
            enableRotate: true,
            enablePan: true,
            minDistance: 0.1,
            maxDistance: 1000,
            target: { x: 0, y: 0, z: 0 }
        }
    });

    // English comment.
    registerAllComponents(scene);

    await scene.init();

    // English comment.
    scene.renderer?.enableShadow?.(true);
    scene.light?.updateConfig?.({
        ambient: { color: '#ffffff', intensity: 0.6 },
        directional: {
            color: '#ffffff',
            intensity: 0.8,
            position: [5, 10, 7.5],
            castShadow: true
        }
    });

    await applyBackground(scene, { type: 'color', color: '#1a1a1a' }, '__preview_hdr__');

    // English comment.
    try {
        await scene.add('GridHelper', {
            name: GRID_NAME,
            size: 10,
            divisions: 10,
            colorCenterLine: '#444444',
            colorGrid: '#222222'
        });
    } catch {}

    // English comment.
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
            try {
                scene?.renderer?.resize?.();
            } catch {}
        });
        resizeObserver.observe(canvasContainer.value);
    }
};

const ensureScene = async () => {
    if (scene) return scene;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        await initScene();
        return scene;
    })();

    try {
        return await initPromise;
    } finally {
        initPromise = null;
    }
};

/**
 * English comment.
 */
const loadModel = async (file) => {
    if (!file) return;

    loading.value = true;
    loadingText.value = '正在加载模型...';
    error.value = null;

    try {
        await ensureScene();
        if (!scene) throw new Error('Preview scene not initialized');

        // English comment.
        if (currentObjectUrl) {
            try {
                URL.revokeObjectURL(currentObjectUrl);
            } catch {}
        }
        currentObjectUrl = URL.createObjectURL(file);

        // English comment.
        if (!modelLoader) {
            modelLoader = await scene.add('ModelLoader', {
                name: MODEL_NAME,
                url: '',
                scale: 1,
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                dracoDecoderPath: '/draco/',
                castShadow: true,
                receiveShadow: true,
                animations: true,
                autoPlayAnimation: false
            });

            modelLoader.on('loadProgress', ({ progress }) => {
                if (typeof progress === 'number') {
                    loadingText.value = `加载中... ${progress.toFixed(0)}%`;
                }
            });

            modelLoader.on('loadComplete', () => {
                // English comment.
            });

            modelLoader.on('loadError', ({ error: loadError }) => {
                const msg = loadError?.message || String(loadError || '未知错误');
                error.value = '模型加载失败: ' + msg;
                loading.value = false;
                emit('error', loadError);
            });
        }

        // English comment.
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();

        // English comment.
        await modelLoader.updateConfig({
            url: currentObjectUrl,
            format: fileExt,
            castShadow: true,
            receiveShadow: true
        });

        replacePreviewMaterials(
            modelLoader?.componentScene || modelLoader?.model || modelLoader?.group || modelLoader?.object3d
        );

        // English comment.
        if (error.value) {
            return;
        }

        const stats = modelLoader.getGeometryStats?.() || null;
        const bounds = modelLoader.getBounds?.() || null;

        // English comment.
        if (bounds) {
            const [cx, cy, cz] = bounds.center;
            const maxDim = bounds.maxDim || 1;
            const fov = (scene.camera?.getConfig?.().fov ?? 45) * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 2.5;
            if (!Number.isFinite(cameraZ) || cameraZ <= 0) cameraZ = 5;

            scene.camera?.updateConfig?.({
                position: [cx + cameraZ, cy + cameraZ, cz + cameraZ],
                lookAt: [cx, cy, cz]
            });
            scene.controls?.updateConfig?.({ target: { x: cx, y: cy, z: cz } });
        }

        modelInfo.value = {
            fileName: file.name,
            fileSize: file.size,
            fileType: (file.name.split('.').pop() || '').toUpperCase(),
            vertices: stats?.vertices,
            triangles: stats?.triangles
        };

        loading.value = false;
        emit('loaded', modelInfo.value);

        // English comment.
        setTimeout(() => {
            generateThumbnail();
        }, 100);
    } catch (err) {
        console.error('Failed to load model:', err);
        error.value = '模型加载失败: ' + (err?.message || String(err));
        loading.value = false;
        emit('error', err);
    }
};

/**
 * English comment.
 */
const generateThumbnail = () => {
    if (!scene?.renderer) return;

    try {
        // English comment.
        scene.renderOnce?.();

        // English comment.
        const canvas = scene.renderer.getDomElement?.();
        if (!canvas) return;

        // English comment.
        const thumbnailSize = 512;
        const thumbnailCanvas = document.createElement('canvas');
        thumbnailCanvas.width = thumbnailSize;
        thumbnailCanvas.height = thumbnailSize;
        const ctx = thumbnailCanvas.getContext('2d');

        // English comment.
        const aspectRatio = canvas.width / canvas.height;
        let drawWidth = thumbnailSize;
        let drawHeight = thumbnailSize;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
            drawHeight = thumbnailSize / aspectRatio;
            offsetY = (thumbnailSize - drawHeight) / 2;
        } else {
            drawWidth = thumbnailSize * aspectRatio;
            offsetX = (thumbnailSize - drawWidth) / 2;
        }

        // English comment.
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, thumbnailSize, thumbnailSize);

        // English comment.
        ctx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);

        // English comment.
        thumbnailCanvas.toBlob((blob) => {
            if (blob) {
                emit('thumbnail-generated', blob);
            }
        }, 'image/jpeg', 0.9);

    } catch (err) {
        console.error('Failed to generate thumbnail:', err);
    }
};

/**
 * English comment.
 */
const cleanup = () => {
    initPromise = null;
    if (resizeObserver) {
        try {
            resizeObserver.disconnect();
        } catch {}
        resizeObserver = null;
    }

    if (scene) {
        try {
            scene.dispose();
        } catch {}
        scene = null;
    }

    modelLoader = null;

    if (currentObjectUrl) {
        try {
            URL.revokeObjectURL(currentObjectUrl);
        } catch {}
        currentObjectUrl = null;
    }
};

// English comment.
watch(() => props.file, (newFile) => {
    if (newFile) {
        loadModel(newFile);
    }
});

onMounted(async () => {
    // English comment.
    await nextTick();
    // English comment.
    await ensureScene();
    // English comment.
    if (props.file) {
        loadModel(props.file);
    }
});

onUnmounted(() => {
    cleanup();
});
</script>

<style scoped>
.model-preview-canvas {
    position: relative;
    width: 100%;
    height: 100%;
}

.canvas-container {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    overflow: hidden;
}

.loading-overlay,
.error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #4a9eff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-text {
    margin-top: 12px;
    color: #fff;
    font-size: 14px;
}

.error-text {
    color: #ff4d4f;
    font-size: 14px;
    padding: 0 20px;
    text-align: center;
}

.model-info {
    position: absolute;
    top: 12px;
    left: 12px;
    background: rgba(0, 0, 0, 0.7);
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    color: #fff;
    backdrop-filter: blur(4px);
}

.info-item {
    display: flex;
    margin-bottom: 6px;
}

.info-item:last-child {
    margin-bottom: 0;
}

.info-item .label {
    color: #999;
    margin-right: 8px;
    min-width: 70px;
}

.info-item .value {
    color: #fff;
    font-weight: 500;
}
</style>
