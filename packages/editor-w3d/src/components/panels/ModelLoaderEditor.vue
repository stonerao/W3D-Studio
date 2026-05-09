<template>
    <div class="modelloader-editor">
        <div class="local-model-panel">
            <div class="local-model-panel__main">
                <div>
                    <div class="local-model-panel__title">本地模型文件</div>
                    <div class="local-model-panel__meta">{{ localModelSummary }}</div>
                </div>
                <Button variant="outline" size="sm" @click="chooseLocalModelFile">
                    选择文件
                </Button>
            </div>
            <input
                ref="localModelInputRef"
                class="local-model-input"
                type="file"
                :accept="localModelAccept"
                multiple
                @change="handleLocalModelFileChange"
            />
            <div class="local-model-panel__hint">
                支持 GLB / GLTF / FBX；文件只在浏览器本地读取，不上传服务器。GLTF 如有外部 .bin 或贴图，请一并选择。
            </div>
        </div>

        <!-- English comment. -->
        <div v-if="isLoading" class="loading-state">
            <div class="loading-text">加载模型中... {{ loadProgress > 0 ? Math.round(loadProgress * 100) + '%' : '' }}</div>
            <div v-if="loadProgress > 0" class="progress-bar">
                <div class="progress-fill" :style="{ width: loadProgress * 100 + '%' }"></div>
            </div>
        </div>

        <!-- English comment. -->
        <div v-else-if="modelInstance" class="settings-content">
            <div class="section-label">尺寸适配</div>
            <div class="settings-group">
                <div class="setting-item">
                    <label>缩放模式</label>
                    <Select
                        :model-value="sizeMode"
                        @update:model-value="updateSizeMode"
                        :options="sizeModeOptions"
                    />
                </div>
                <div class="setting-item" v-if="sizeMode === 'fit'">
                    <label>目标最长边</label>
                    <Input
                        type="number"
                        :model-value="targetSize"
                        @update:model-value="updateTargetSize"
                        :step="0.1"
                        :min="0.01"
                        placeholder="请输入目标尺寸"
                    />
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">当前尺寸</span>
                    <span class="info-value">{{ modelSizeSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">当前最长边</span>
                    <span class="info-value">{{ modelMaxDimSummary }}</span>
                </div>
                <div class="empty-hint">
                    适配模式会按模型包围盒最长边自动缩放，最终缩放 = 自动适配结果 × 通用 Transform 中的 scale。
                </div>
            </div>

            <div class="section-label">
                性能优化模式
                <span class="status-tag" :class="performanceModeEnabled ? 'enabled' : 'disabled'">
                    {{ performanceModeEnabled ? '已启用' : '未启用' }}
                </span>
            </div>
            <div class="settings-group">
                <div class="setting-item-inline">
                    <label>启用优化</label>
                    <input
                        type="checkbox"
                        :checked="performanceModeEnabled"
                        @change="togglePerformanceMode($event.target.checked)"
                        class="checkbox"
                    />
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">网格统计</span>
                    <span class="info-value">{{ performanceMeshSummary }}</span>
                </div>
                <div class="setting-item-inline">
                    <span class="info-label">批处理结果</span>
                    <span class="info-value">{{ performanceInstancingSummary }}</span>
                </div>
                <div v-if="performanceModeEnabled" class="empty-hint">
                    静态网格会合并为单 Mesh + 原材质贴图；事件和烘焙通过源 Mesh 代理映射到合并结果。
                </div>
                <div v-if="performanceModeEnabled && performanceBlockerHint" class="empty-hint">
                    {{ performanceBlockerHint }}
                </div>
            </div>

            <!-- English comment. -->
            <div class="setting-item">
                <label>Mesh（共 {{ meshList.length }} 个）</label>
                <div class="mesh-selector-row">
                    <Select
                        class="mesh-selector-row__select"
                        :model-value="selectedMeshName"
                        @update:model-value="selectedMeshName = $event"
                        :options="[{ value: '', label: '-- 请选择 --' }, ...meshList.map(m => ({ value: m.name, label: m.name || '未命名' }))]"
                        placeholder="-- 请选择 --"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="!modelInstance"
                        @click="toggleMeshEyedropper"
                    >
                        {{ isMeshPickingActive ? '取消吸管' : '吸管拾取' }}
                    </Button>
                </div>
            </div>

            <!-- English comment. -->
            <template v-if="selectedMeshName && selectedMeshProps">
                <!-- English comment. -->
                <div class="setting-item-inline">
                    <label>可见</label>
                    <input
                        type="checkbox"
                        :checked="selectedMeshProps.visible"
                        @change="updateMeshVisibility($event.target.checked)"
                        class="checkbox"
                    />
                </div>
                <div class="mesh-toolbar">
                    <Button variant="outline" size="sm" @click="highlightSelectedMesh">高亮</Button>
                    <Button variant="outline" size="sm" @click="unhighlightSelectedMesh">取消高亮</Button>
                    <Button variant="outline" size="sm" @click="isolateSelectedMesh">隔离</Button>
                    <Button variant="outline" size="sm" @click="showAllMeshes">显示全部</Button>
                </div>

                <!-- English comment. -->
                <div class="section-label">材质</div>
                <div class="settings-group">
                    <div class="setting-item">
                        <label>颜色</label>
                        <ColorPicker
                            :model-value="selectedMaterialProps.color || '#ffffff'"
                            @update:model-value="updateMaterialProperty('color', $event)"
                        />
                    </div>
                    <div class="setting-item-inline">
                        <label>启用透明</label>
                        <input
                            type="checkbox"
                            :checked="selectedMaterialProps.transparent"
                            @change="updateMaterialProperty('transparent', $event.target.checked)"
                            class="checkbox"
                        />
                    </div>
                    <div class="setting-item">
                        <label>不透明度</label>
                        <Slider
                            :model-value="selectedMaterialProps.opacity ?? 1"
                            @update:model-value="updateMaterialProperty('opacity', $event)"
                            :min="0" :max="1" :step="0.01"
                        />
                    </div>
                    <div v-if="selectedMaterialProps.metalness !== undefined" class="setting-item">
                        <label>金属度</label>
                        <Slider
                            :model-value="selectedMaterialProps.metalness"
                            @update:model-value="updateMaterialProperty('metalness', $event)"
                            :min="0" :max="1" :step="0.01"
                        />
                    </div>
                    <div v-if="selectedMaterialProps.roughness !== undefined" class="setting-item">
                        <label>粗糙度</label>
                        <Slider
                            :model-value="selectedMaterialProps.roughness"
                            @update:model-value="updateMaterialProperty('roughness', $event)"
                            :min="0" :max="1" :step="0.01"
                        />
                    </div>
                    <div v-if="selectedMaterialProps.emissive !== undefined" class="setting-item">
                        <label>发光色</label>
                        <ColorPicker
                            :model-value="selectedMaterialProps.emissive || '#000000'"
                            @update:model-value="updateMaterialProperty('emissive', $event)"
                        />
                    </div>
                    <div v-if="selectedMaterialProps.emissiveIntensity !== undefined" class="setting-item">
                        <label>发光强度</label>
                        <Slider
                            :model-value="selectedMaterialProps.emissiveIntensity"
                            @update:model-value="updateMaterialProperty('emissiveIntensity', $event)"
                            :min="0" :max="2" :step="0.01"
                        />
                    </div>
                    <div class="setting-item-inline">
                        <label>线框模式</label>
                        <input
                            type="checkbox"
                            :checked="selectedMaterialProps.wireframe"
                            @change="updateMaterialProperty('wireframe', $event.target.checked)"
                            class="checkbox"
                        />
                    </div>
                </div>

                <!-- English comment. -->
                <div class="section-label">变换</div>
                <div class="settings-group">
                    <div class="setting-item">
                        <label>位置</label>
                        <div class="vector3-inputs">
                            <Input type="number" :model-value="selectedMeshProps.position?.x?.toFixed(3)" @update:model-value="updateMeshTransform('position', 'x', parseFloat($event))" placeholder="X" :step="0.1" />
                            <Input type="number" :model-value="selectedMeshProps.position?.y?.toFixed(3)" @update:model-value="updateMeshTransform('position', 'y', parseFloat($event))" placeholder="Y" :step="0.1" />
                            <Input type="number" :model-value="selectedMeshProps.position?.z?.toFixed(3)" @update:model-value="updateMeshTransform('position', 'z', parseFloat($event))" placeholder="Z" :step="0.1" />
                        </div>
                    </div>
                    <div class="setting-item">
                        <label>旋转（°）</label>
                        <div class="vector3-inputs">
                            <Input type="number" :model-value="radToDeg(selectedMeshProps.rotation?.x)?.toFixed(1)" @update:model-value="updateMeshTransform('rotation', 'x', degToRad(parseFloat($event)))" placeholder="X" :step="1" />
                            <Input type="number" :model-value="radToDeg(selectedMeshProps.rotation?.y)?.toFixed(1)" @update:model-value="updateMeshTransform('rotation', 'y', degToRad(parseFloat($event)))" placeholder="Y" :step="1" />
                            <Input type="number" :model-value="radToDeg(selectedMeshProps.rotation?.z)?.toFixed(1)" @update:model-value="updateMeshTransform('rotation', 'z', degToRad(parseFloat($event)))" placeholder="Z" :step="1" />
                        </div>
                    </div>
                    <div class="setting-item">
                        <label>缩放</label>
                        <div class="vector3-inputs">
                            <Input type="number" :model-value="selectedMeshProps.scale?.x?.toFixed(3)" @update:model-value="updateMeshTransform('scale', 'x', parseFloat($event))" placeholder="X" :step="0.1" />
                            <Input type="number" :model-value="selectedMeshProps.scale?.y?.toFixed(3)" @update:model-value="updateMeshTransform('scale', 'y', parseFloat($event))" placeholder="Y" :step="0.1" />
                            <Input type="number" :model-value="selectedMeshProps.scale?.z?.toFixed(3)" @update:model-value="updateMeshTransform('scale', 'z', parseFloat($event))" placeholder="Z" :step="0.1" />
                        </div>
                    </div>
                </div>
            </template>

            <div v-else-if="!selectedMeshName" class="empty-hint">
                选择一个 Mesh 开始编辑
            </div>

            <!-- English comment. -->
            <template v-if="animationList.length > 0">
                <div class="section-label">动画（{{ animationList.length }}）</div>
                <div class="settings-group">
                    <div
                        v-for="(animation, index) in animationList"
                        :key="index"
                        class="animation-item"
                        :class="{ active: currentAnimation === animation }"
                        @click="playAnimation(index)"
                    >
                        <span>{{ animation }}</span>
                        <span v-if="currentAnimation === animation" class="playing-badge">播放中</span>
                    </div>
                    <div v-if="currentAnimation" class="setting-item">
                        <label>播放速度</label>
                        <Slider :model-value="animationSpeed" @update:model-value="setAnimationSpeed" :min="0.1" :max="3" :step="0.1" />
                    </div>
                    <div v-if="currentAnimation" class="mesh-toolbar">
                        <Button variant="outline" size="sm" @click="pauseAnimation">暂停</Button>
                        <Button variant="outline" size="sm" @click="resumeAnimation">继续</Button>
                        <Button variant="outline" size="sm" @click="stopAnimation">停止</Button>
                    </div>
                </div>
            </template>

            <!-- English comment. -->
            <div class="section-label">
                烘焙光照
                <span class="status-tag" :class="bakedLightingEnabled ? 'enabled' : 'disabled'">
                    {{ bakedLightingEnabled ? '已启用' : '已禁用' }}
                </span>
            </div>
            <div class="settings-group">
                <div class="setting-item-inline">
                    <span class="info-label">已配置贴图</span>
                    <span class="info-value">{{ bakedTextureMappingCount }} 个</span>
                </div>
                <div v-if="bakedLightingEnabled" class="setting-item-inline">
                    <span class="info-label">强度</span>
                    <span class="info-value">{{ bakedLightingIntensity }}</span>
                </div>
                <Button variant="outline" size="sm" block @click="openBakedLightingModal">管理烘焙贴图</Button>
            </div>
        </div>

        <!-- English comment. -->
        <div v-else class="empty-state">
            <div class="empty-text">请选择本地模型文件或设置模型 URL</div>
        </div>

        <!-- English comment. -->
        <BakedLightingModal
            v-model="showBakedLightingModal"
            :model-loader-id="componentId"
            @save="handleBakedLightingSave"
            @baked-lighting-updated="handleBakedLightingUpdated"
        />

    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import Slider from '../ui/Slider.vue';
import Select from '../ui/Select.vue';
import Input from '../ui/Input.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import Button from '../ui/Button.vue';
import BakedLightingModal from './BakedLightingModal.vue';
import { createLocalModelAsset, localModelAccept } from '../../utils/localModelFiles';

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

// Props
const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

// English comment.
const isLoading = ref(false);
const loadProgress = ref(0);
const meshList = ref([]);
const animationList = ref([]);
const currentAnimation = ref(null);
const animationSpeed = ref(1.0);
const interactiveMeshNames = ref([]);
const geometryStats = ref(null);
const modelBounds = ref(null);
const localModelInputRef = ref(null);

// English comment.
const selectedMeshName = ref('');
const selectedMeshProps = ref(null);
const selectedMaterialProps = ref({});
const meshListCollapsed = ref(true);
const animationListCollapsed = ref(true);

const MESH_CONFIG_DEBOUNCE_MS = 160;
let meshConfigPersistTimer = null;
const pendingMeshConfigMap = new Map();

// English comment.
const bakedLightingCollapsed = ref(false);
const showBakedLightingModal = ref(false);

// English comment.
const component = computed(() => {
    return componentStore.components.find((c) => c.id === props.componentId);
});

const modelInstance = computed(() => {
    return component.value?.instance;
});

const formatFileSize = (bytes) => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '';
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const localModelSummary = computed(() => {
    const config = component.value?.config || {};
    if (config.sourceType === 'local-file' || config.localFileName) {
        const sizeText = formatFileSize(config.localFileSize);
        const count = Number(config.localFileCount || 0);
        return [
            config.localFileName || '本地模型',
            sizeText,
            count > 1 ? `共 ${count} 个文件` : ''
        ].filter(Boolean).join('，');
    }
    return config.url ? '当前使用 URL / 资源库模型' : '未选择模型文件';
});

const interactiveMeshes = computed(() => {
    return component.value?.config?.interactiveMeshes || false;
});

// English comment.
const bakedLightingConfig = computed(() => {
    return component.value?.config?.bakedLighting || {};
});

const bakedLightingEnabled = computed(() => {
    return bakedLightingConfig.value?.enabled || false;
});

const performanceModeEnabled = computed(() => {
    return component.value?.config?.performanceMode === true;
});

const performanceOptimizationSummary = computed(() => {
    return modelInstance.value?.getPerformanceOptimizationSummary?.() || {
        enabled: performanceModeEnabled.value,
        meshCountBefore: meshList.value.length,
        meshCountAfter: meshList.value.length,
        optimizedMeshCount: 0,
        instancedGroupCount: 0,
        skippedReason: ''
    };
});

const isMeshPickingActive = computed(() => {
    return !!componentStore.meshPicking?.active
        && componentStore.meshPicking?.componentId === props.componentId
        && componentStore.meshPicking?.source === 'model-loader-editor';
});

const performanceMeshSummary = computed(() => {
    const summary = performanceOptimizationSummary.value;
    if (!summary.enabled) {
        return `${meshList.value.length} 个 Mesh`;
    }
    return `${summary.meshCountBefore || 0} -> ${summary.meshCountAfter || 0}`;
});

const performanceInstancingSummary = computed(() => {
    const summary = performanceOptimizationSummary.value;
    if (!summary.enabled) {
        return '未启用';
    }
    if (summary.skippedReason === 'animations') {
        return '模型含动画，跳过批处理';
    }
    if (summary.strategy === 'merged-textured-materials') {
        return `1 Mesh / ${summary.drawCallEstimate || 0} 材质 draw calls / 贴图保留 / ${summary.batchedInstanceCount || 0} 源 Mesh`;
    }
    if (summary.strategy === 'merged-single-material') {
        return `1 Mesh / 1 draw call / ${summary.sourceMaterialCount || 0} 源材质 / ${summary.batchedInstanceCount || 0} 源 Mesh`;
    }
    if (summary.strategy === 'merged-multi-material') {
        return `1 Mesh / ${summary.drawCallEstimate || 0} 材质 draw calls / ${summary.batchedInstanceCount || 0} 源 Mesh`;
    }
    if (summary.strategy === 'batched') {
        return `${summary.batchedMeshCount || 0} 批 / ${summary.batchedInstanceCount || 0} 实例 / 估算 ${summary.drawCallEstimate || 0} draw calls`;
    }
    if (summary.skippedReason === 'no-batchable-mesh') {
        return '未发现可批处理 Mesh';
    }
    if (!summary.instancedGroupCount) {
        return '未发现可优化组';
    }
    return `${summary.instancedGroupCount} 组 / ${summary.optimizedMeshCount} 个源 Mesh`;
});

const performanceBlockerHint = computed(() => {
    const reason = performanceOptimizationSummary.value?.skippedReason || '';
    if (reason === 'animations') {
        return '模型包含动画，已跳过批处理折叠，仅保留安全的轻量材质优化。';
    }
    if (reason === 'mesh-config') {
        return '检测到逐 Mesh 配置，仍保留原 Mesh 代理用于单 Mesh 编辑能力。';
    }
    if (reason === 'no-batchable-mesh') {
        return '当前模型没有满足静态、单材质、几何属性兼容条件的 Mesh。';
    }
    return '';
});

const bakedLightingIntensity = computed(() => {
    return bakedLightingConfig.value?.intensity ?? 3.5;
});

const bakedTextureMappingCount = computed(() => {
    const mapping = bakedLightingConfig.value?.textureMapping || {};
    return Object.keys(mapping).length;
});

const sizeMode = computed(() => {
    return component.value?.config?.sizeMode === 'fit' ? 'fit' : 'scale';
});

const targetSize = computed(() => {
    const value = Number(component.value?.config?.targetSize);
    return Number.isFinite(value) && value > 0 ? value : 1;
});

const sizeModeOptions = [
    { value: 'scale', label: '普通缩放' },
    { value: 'fit', label: '按最长边适配' }
];

const formatDimension = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '--';
    return Math.round(numeric * 1000) / 1000;
};

const modelSizeSummary = computed(() => {
    const size = modelBounds.value?.size;
    if (!Array.isArray(size) || size.length < 3) {
        return '--';
    }
    return `${formatDimension(size[0])} × ${formatDimension(size[1])} × ${formatDimension(size[2])}`;
});

const modelMaxDimSummary = computed(() => {
    const maxDim = modelBounds.value?.maxDim;
    return formatDimension(maxDim);
});

// English comment.
const radToDeg = (rad) => {
    if (rad === undefined || rad === null) return 0;
    return rad * (180 / Math.PI);
};

// English comment.
const degToRad = (deg) => {
    if (deg === undefined || deg === null) return 0;
    return deg * (Math.PI / 180);
};

const updateSizeMode = async (value) => {
    const nextMode = value === 'fit' ? 'fit' : 'scale';
    await updateComponentConfig(props.componentId, {
        sizeMode: nextMode
    });
};

const updateTargetSize = async (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        toast.warning('目标最长边必须大于 0');
        return;
    }

    await updateComponentConfig(props.componentId, {
        targetSize: numeric
    });
};

const chooseLocalModelFile = () => {
    if (localModelInputRef.value) {
        localModelInputRef.value.value = '';
    }
    localModelInputRef.value?.click();
};

const handleLocalModelFileChange = async (event) => {
    const asset = createLocalModelAsset(event?.target?.files || []);
    if (event?.target) {
        event.target.value = '';
    }
    if (!asset) {
        toast.warning('请选择 .glb、.gltf 或 .fbx 模型文件');
        return;
    }

    const isFirstModel = !component.value?.config?.url;
    try {
        await updateComponentConfig(props.componentId, {
            url: asset.url,
            format: asset.format,
            sourceType: asset.sourceType,
            localFileName: asset.fileName,
            localFileSize: asset.fileSize,
            localFileCount: asset.fileCount,
            localFileLastModified: asset.lastModified,
            ...(isFirstModel ? { sizeMode: 'fit', targetSize: 10 } : {})
        });
        toast.success(`已加载本地模型：${asset.fileName}`);
    } catch (error) {
        console.error('[ModelLoaderEditor] Load local model failed:', error);
        toast.error(`加载本地模型失败: ${error?.message || String(error)}`);
    }
};

const cloneValue = (value) => {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // fallback below
        }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const flushPendingMeshConfig = () => {
    if (!component.value || pendingMeshConfigMap.size === 0) return;

    const currentConfig = component.value.config || {};
    const nextMeshConfig = { ...(currentConfig.mesh || {}) };
    const nextMaterialConfig = { ...(currentConfig.material || {}) };

    pendingMeshConfigMap.forEach((payload, meshName) => {
        if (!meshName) return;
        const materialName = `mat_${meshName}`;

        const meshProps = payload?.meshProps || {};
        const materialProps = payload?.materialProps || {};

        nextMaterialConfig[materialName] = {
            ...(nextMaterialConfig[materialName] || {}),
            ...materialProps
        };

        nextMeshConfig[meshName] = {
            ...(nextMeshConfig[meshName] || {}),
            name: meshName,
            material: materialName,
            position: meshProps.position || { x: 0, y: 0, z: 0 },
            rotation: meshProps.rotation || { x: 0, y: 0, z: 0 },
            scale: meshProps.scale || { x: 1, y: 1, z: 1 },
            visible: meshProps.visible !== false
        };
    });

    pendingMeshConfigMap.clear();

    updateComponentConfig(props.componentId, {
        material: nextMaterialConfig,
        mesh: nextMeshConfig
    });
};

const queueMeshConfigPersist = () => {
    if (!selectedMeshName.value) return;

    pendingMeshConfigMap.set(selectedMeshName.value, {
        meshProps: cloneValue(selectedMeshProps.value),
        materialProps: cloneValue(selectedMaterialProps.value)
    });

    if (meshConfigPersistTimer) {
        clearTimeout(meshConfigPersistTimer);
    }

    meshConfigPersistTimer = setTimeout(() => {
        meshConfigPersistTimer = null;
        flushPendingMeshConfig();
    }, MESH_CONFIG_DEBOUNCE_MS);
};

const normalizeLoadProgress = (value) => {
    const progress = Number(value);
    if (!Number.isFinite(progress)) return 0;
    return Math.min(1, Math.max(0, progress));
};

const syncLoadStateFromInstance = () => {
    const instance = modelInstance.value;
    isLoading.value = Boolean(instance?.isLoading);
    loadProgress.value = normalizeLoadProgress(instance?.loadProgress);
};

// English comment.
const loadModelInfo = () => {
    if (!modelInstance.value) return;

    try {
        // English comment.
        const meshes = modelInstance.value.getAllMeshes?.() || [];
        meshList.value = meshes.map((mesh) => ({
            name: mesh.name || '未命名',
            uuid: mesh.uuid
        }));

        // English comment.
        const animations = modelInstance.value.getAnimationNames?.() || [];
        animationList.value = animations;

        // English comment.
        currentAnimation.value = modelInstance.value.getCurrentAnimationName?.() || null;

        // English comment.
        if (Array.isArray(interactiveMeshes.value)) {
            interactiveMeshNames.value = [...interactiveMeshes.value];
        } else {
            interactiveMeshNames.value = [];
        }

        geometryStats.value = modelInstance.value.getGeometryStats?.() || null;
        modelBounds.value = modelInstance.value.getBounds?.() || null;

        console.log('[ModelLoaderEditor] Model info loaded:', {
            meshes: meshList.value.length,
            animations: animationList.value.length
        });
    } catch (error) {
        console.error('[ModelLoaderEditor] Failed to load model info:', error);
    }
};

// English comment.
const onMeshSelect = () => {
    if (!selectedMeshName.value || !modelInstance.value) {
        selectedMeshProps.value = null;
        selectedMaterialProps.value = {};
        return;
    }

    // English comment.
    selectedMeshProps.value = modelInstance.value.getMeshTransform?.(selectedMeshName.value);

    // English comment.
    selectedMaterialProps.value = modelInstance.value.getMeshMaterialProps?.(selectedMeshName.value) || {};
};

// English comment.
const updateMaterialProperty = (prop, value) => {
    if (!selectedMeshName.value || !modelInstance.value) return;

    // English comment.
    modelInstance.value.updateMeshMaterial?.(selectedMeshName.value, { [prop]: value });

    // English comment.
    selectedMaterialProps.value = {
        ...selectedMaterialProps.value,
        [prop]: value
    };

    // English comment.
    queueMeshConfigPersist();
};

// English comment.
const updateMeshTransform = (type, axis, value) => {
    if (!selectedMeshName.value || !modelInstance.value) return;
    if (isNaN(value)) return;

    const transform = {
        [type]: {
            [axis]: value
        }
    };

    // English comment.
    modelInstance.value.updateMeshTransform?.(selectedMeshName.value, transform);

    // English comment.
    if (selectedMeshProps.value && selectedMeshProps.value[type]) {
        selectedMeshProps.value[type][axis] = value;
    }

    // English comment.
    queueMeshConfigPersist();
};

// English comment.
const updateMeshVisibility = (visible) => {
    if (!selectedMeshName.value || !modelInstance.value) return;

    modelInstance.value.setMeshVisibility?.(selectedMeshName.value, visible);

    if (selectedMeshProps.value) {
        selectedMeshProps.value.visible = visible;
    }

    // English comment.
    queueMeshConfigPersist();
};

// English comment.
const highlightSelectedMesh = () => {
    if (!selectedMeshName.value || !modelInstance.value) return;
    modelInstance.value.highlightMesh?.(selectedMeshName.value);
};

// English comment.
const unhighlightSelectedMesh = () => {
    if (!selectedMeshName.value || !modelInstance.value) return;
    modelInstance.value.unhighlightMesh?.(selectedMeshName.value);
};

// English comment.
const isolateSelectedMesh = () => {
    if (!selectedMeshName.value || !modelInstance.value) return;
    modelInstance.value.isolateMesh?.(selectedMeshName.value);
};

// English comment.
const showAllMeshes = () => {
    if (!modelInstance.value) return;
    modelInstance.value.showAllMeshes?.();
};

const isInteractiveMesh = (meshName) => {
    if (interactiveMeshes.value === '*') return true;
    if (Array.isArray(interactiveMeshes.value)) {
        return interactiveMeshes.value.includes(meshName);
    }
    return false;
};

const toggleMeshInteractive = (meshName) => {
    const newList = [...interactiveMeshNames.value];
    const index = newList.indexOf(meshName);

    if (index > -1) {
        newList.splice(index, 1);
    } else {
        newList.push(meshName);
    }

    interactiveMeshNames.value = newList;

    // English comment.
    componentStore.updateComponent(props.componentId, {
        config: {
            ...component.value.config,
            interactiveMeshes: newList
        }
    });

    // English comment.
    if (modelInstance.value?.setInteractiveMeshes) {
        modelInstance.value.setInteractiveMeshes(newList);
    }
};

const enableAllMeshes = () => {
    const allMeshNames = meshList.value.map((m) => m.name).filter((n) => n);
    interactiveMeshNames.value = allMeshNames;

    componentStore.updateComponent(props.componentId, {
        config: {
            ...component.value.config,
            interactiveMeshes: allMeshNames
        }
    });

    if (modelInstance.value?.setInteractiveMeshes) {
        modelInstance.value.setInteractiveMeshes(allMeshNames);
    }
};

const disableAllMeshes = () => {
    interactiveMeshNames.value = [];

    componentStore.updateComponent(props.componentId, {
        config: {
            ...component.value.config,
            interactiveMeshes: []
        }
    });

    if (modelInstance.value?.setInteractiveMeshes) {
        modelInstance.value.setInteractiveMeshes([]);
    }
};

const playAnimation = (index) => {
    if (!modelInstance.value?.playAnimation) return;

    try {
        modelInstance.value.playAnimation(index);
        currentAnimation.value = animationList.value[index];
    } catch (error) {
        console.error('[ModelLoaderEditor] Failed to play animation:', error);
    }
};

const pauseAnimation = () => {
    if (modelInstance.value?.pauseAnimation) {
        modelInstance.value.pauseAnimation();
    }
};

const resumeAnimation = () => {
    if (modelInstance.value?.resumeAnimation) {
        modelInstance.value.resumeAnimation();
    }
};

const stopAnimation = () => {
    if (modelInstance.value?.stopAnimation) {
        modelInstance.value.stopAnimation();
        currentAnimation.value = null;
    }
};

const setAnimationSpeed = (speed) => {
    animationSpeed.value = speed;
    if (modelInstance.value?.setAnimationSpeed) {
        modelInstance.value.setAnimationSpeed(speed);
    }
};

// English comment.
const openBakedLightingModal = () => {
    showBakedLightingModal.value = true;
};

const toggleMeshEyedropper = () => {
    if (!modelInstance.value) return;
    if (isMeshPickingActive.value) {
        componentStore.stopMeshPicking();
        return;
    }
    componentStore.startMeshPicking(props.componentId, 'model-loader-editor');
    toast.info('请点击场景中的模型 Mesh 进行选择');
};

const togglePerformanceMode = async (enabled) => {
    const nextPatch = enabled
        ? {
            performanceMode: true
        }
        : {
            performanceMode: false
        };

    await updateComponentConfig(props.componentId, nextPatch);

    toast.info(enabled
        ? '已启用性能优化模式，模型将重新加载并保留烘焙/事件配置'
        : '已关闭性能优化模式，模型将恢复普通加载模式');
};

const handleBakedLightingSave = (config) => {
    console.log('[ModelLoaderEditor] 烘焙配置已保存:', config);
};

const handleBakedLightingUpdated = (config) => {
    console.log('[ModelLoaderEditor] 烘焙配置已更新，通知ModelEffect:', config);

    // English comment.
    if (modelInstance.value?.scene?.eventSystem) {
        modelInstance.value.scene.eventSystem.emit('bakedLightingConfigUpdated', {
            config,
            modelLoaderId: props.componentId
        });
    } else if (modelInstance.value) {
        // English comment.
        modelInstance.value.emit('bakedLightingConfigUpdated', config);
    }
};

// English comment.
watch(modelInstance, (newInstance) => {
    syncLoadStateFromInstance();
    if (newInstance) {
        if (!isLoading.value) {
            loadModelInfo();
        }
    }
}, { immediate: true });

// English comment.
watch(selectedMeshName, onMeshSelect);

watch(
    () => componentStore.meshPickResult?.token,
    () => {
        const result = componentStore.meshPickResult;
        if (!result?.token) return;
        if (result.componentId !== props.componentId) return;
        if (result.source !== 'model-loader-editor') return;

        selectedMeshName.value = result.meshName || '';
        componentStore.clearMeshPickResult();
    }
);

/* English comment. */

// English comment.
let loadStartHandler = null;
let loadProgressHandler = null;
let loadCompleteHandler = null;
let loadErrorHandler = null;

const bindModelLoadEvents = (instance) => {
    if (!instance) return;

    if (!loadStartHandler) {
        loadStartHandler = (data = {}) => {
            isLoading.value = true;
            loadProgress.value = normalizeLoadProgress(data.progress);
        };
    }
    if (!loadProgressHandler) {
        loadProgressHandler = (data) => {
            loadProgress.value = normalizeLoadProgress(data?.progress);
        };
    }
    if (!loadCompleteHandler) {
        loadCompleteHandler = () => {
            isLoading.value = false;
            loadProgress.value = 1;
            loadModelInfo();
        };
    }
    if (!loadErrorHandler) {
        loadErrorHandler = () => {
            isLoading.value = false;
            loadProgress.value = 0;
        };
    }

    instance.on?.('loadStart', loadStartHandler);
    instance.on?.('loadProgress', loadProgressHandler);
    instance.on?.('loadComplete', loadCompleteHandler);
    instance.on?.('loadError', loadErrorHandler);
    syncLoadStateFromInstance();
};

const unbindModelLoadEvents = (instance) => {
    if (!instance) return;
    instance.off?.('loadStart', loadStartHandler);
    instance.off?.('loadProgress', loadProgressHandler);
    instance.off?.('loadComplete', loadCompleteHandler);
    instance.off?.('loadError', loadErrorHandler);
};

onMounted(() => {
    if (modelInstance.value) {
        bindModelLoadEvents(modelInstance.value);
        if (!isLoading.value) {
            loadModelInfo();
        }
    }
});

watch(modelInstance, (next, prev) => {
    if (prev && prev !== next) {
        unbindModelLoadEvents(prev);
    }
    if (next) {
        bindModelLoadEvents(next);
    }
});

onUnmounted(() => {
    if (meshConfigPersistTimer) {
        clearTimeout(meshConfigPersistTimer);
        meshConfigPersistTimer = null;
    }
    flushPendingMeshConfig();

    unbindModelLoadEvents(modelInstance.value);
});
</script>

<style scoped>
.modelloader-editor {
    display: flex;
    flex-direction: column;
}

.local-model-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.local-model-panel__main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.local-model-panel__title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.local-model-panel__meta {
    margin-top: 0.125rem;
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
    word-break: break-all;
}

.local-model-panel__hint {
    font-size: 0.6875rem;
    line-height: 1.5;
    color: var(--color-text-tertiary);
}

.local-model-input {
    display: none;
}

/* English comment. */
.settings-content {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0.5rem 0;
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
}

.setting-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
}

.setting-item label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
}

.mesh-selector-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.mesh-selector-row__select {
    flex: 1;
}

.setting-item-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
}

.setting-item-inline label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
}

.checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--color-border);
    cursor: pointer;
}

.vector3-inputs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.375rem;
}

/* English comment. */
.loading-state,
.empty-state {
    padding: 1.5rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

.progress-bar {
    width: 100%;
    height: 3px;
    background-color: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.5rem;
}

.progress-fill {
    height: 100%;
    background-color: var(--color-primary);
    transition: width 0.3s;
}

/* English comment. */
.section-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-border);
    margin-top: 0.25rem;
}

/* English comment. */
.mesh-toolbar {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
    padding: 0.5rem 0.75rem;
}

/* English comment. */
.empty-hint {
    padding: 1.5rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

/* English comment. */
.animation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    font-size: 0.6875rem;
    background-color: var(--color-bg-elevated);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: background-color var(--transition-fast);
}

.animation-item:hover {
    background-color: var(--color-bg-hover);
}

.animation-item.active {
    background-color: var(--color-primary-light, rgba(99,102,241,0.15));
    color: var(--color-primary);
}

.playing-badge {
    font-size: 0.625rem;
    color: var(--color-primary);
}

.governance-risk-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem 0.5rem;
}

.risk-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 1.5rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.14);
    color: #d97706;
    font-size: 0.6875rem;
}

/* English comment. */
.status-tag {
    font-size: 0.625rem;
    padding: 0.1rem 0.375rem;
    border-radius: var(--border-radius-sm);
    font-weight: normal;
    text-transform: none;
    letter-spacing: 0;
}

.status-tag.enabled {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
}

.status-tag.disabled {
    background: rgba(107, 114, 128, 0.12);
    color: var(--color-text-tertiary);
}

/* English comment. */
.info-label {
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
}

.info-value {
    font-size: 0.6875rem;
    color: var(--color-text-primary);
}
</style>

