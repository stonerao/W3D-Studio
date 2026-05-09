<template>
    <Modal
        v-model="isOpen"
        title="烘焙光照配置"
        width="800px"
        @close="close"
    >
        <div v-if="isPerformanceModeEnabled" class="runtime-hint">
            性能优化模式已启用，烘焙贴图会通过源 Mesh 代理同步到合并 Mesh。
        </div>

                <!-- English comment. -->
                <div class="config-section">
                <div class="section-header">
                    <span class="section-title">全局参数</span>
                    <label class="toggle-switch">
                        <input type="checkbox" v-model="localConfig.enabled" />
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">{{ localConfig.enabled ? '已启用' : '已禁用' }}</span>
                    </label>
                </div>

                <div class="config-grid" :class="{ disabled: !localConfig.enabled }">
                    <div class="config-item">
                        <label>模式 (mode)</label>
                        <select v-model="localConfig.mode" :disabled="!localConfig.enabled">
                            <option value="bake">bake</option>
                            <option value="lightMap">lightMap</option>
                        </select>
                    </div>
                    <div class="config-item">
                        <label>强度 (intensity)</label>
                        <input
                            type="number"
                            v-model.number="localConfig.intensity"
                            step="0.1"
                            min="0"
                            max="10"
                            :disabled="!localConfig.enabled"
                        />
                    </div>
                    <div class="config-item">
                        <label>UV 通道 (channel)</label>
                        <select v-model.number="localConfig.channel" :disabled="!localConfig.enabled">
                            <option :value="0">0</option>
                            <option :value="1">1</option>
                            <option :value="2">2</option>
                        </select>
                    </div>
                    <div class="config-item checkbox-item">
                        <label>
                            <input type="checkbox" v-model="localConfig.flipY" :disabled="!localConfig.enabled" />
                            翻转 Y 轴 (flipY)
                        </label>
                    </div>
                    <div class="config-item checkbox-item">
                        <label>
                            <input type="checkbox" v-model="localConfig.IndependentMaterial" :disabled="!localConfig.enabled" />
                            独立材质 (IndependentMaterial)
                        </label>
                    </div>
                    <div class="config-item checkbox-item">
                        <label>
                            <input type="checkbox" v-model="localConfig.disableInEditor" :disabled="!localConfig.enabled" />
                            编辑态不加载烘焙贴图
                        </label>
                    </div>
                    <div class="config-item">
                        <label>分批应用数量 (applyChunkSize)</label>
                        <input
                            type="number"
                            v-model.number="localConfig.applyChunkSize"
                            min="8"
                            max="200"
                            step="4"
                            :disabled="!localConfig.enabled"
                        />
                    </div>
                </div>
                <div v-if="showEditorSkipHint" class="runtime-hint">
                    当前为编辑态，已按设置跳过烘焙贴图加载；切换到预览态后会正常加载。
                </div>
                <div v-if="showLargeSceneHint" class="runtime-hint runtime-hint--warn">
                    当前模型 Mesh 数量较大，建议优先关闭“独立材质”，并将“分批应用数量”控制在 {{ recommendedChunkSize }} 左右。
                </div>
                </div>

                <div class="mode-switch">
                    <button
                        class="mode-switch__btn"
                        :class="{ active: editMode === 'manual' }"
                        type="button"
                        @click="editMode = 'manual'"
                    >
                        手动配置
                    </button>
                    <button
                        class="mode-switch__btn"
                        :class="{ active: editMode === 'batch' }"
                        type="button"
                        @click="editMode = 'batch'"
                    >
                        批量匹配
                    </button>
                </div>

                <div v-if="editMode === 'batch'" class="batch-panel">
                    <div class="batch-toolbar">
                        <button
                            class="btn-apply"
                            type="button"
                            :disabled="!localConfig.enabled"
                            @click="openBatchAssetPicker"
                        >
                            选择多张纹理
                        </button>
                        <button
                            class="btn-cancel"
                            type="button"
                            :disabled="!batchAssets.length"
                            @click="clearBatchAssets"
                        >
                            清空已选
                        </button>
                        <button
                            class="btn-apply"
                            type="button"
                            :disabled="!localConfig.enabled || !batchAssets.length"
                            @click="generateBatchPreview"
                        >
                            预览匹配
                        </button>
                        <button
                            class="btn-confirm"
                            type="button"
                            :disabled="!batchApplicableCount"
                            @click="applyBatchPreview"
                        >
                            批量应用
                        </button>
                    </div>

                    <div class="batch-grid">
                        <div class="config-item">
                            <label>去后缀（逗号分隔）</label>
                            <input v-model="batchSuffixInput" type="text" placeholder="VRayCompleteMap,_bake,_LM,_lightmap" />
                            <div class="batch-presets-group">
                                <button
                                    class="batch-presets-group__btn"
                                    type="button"
                                    @click="applyBatchSuffixPresetGroup('vray')"
                                >
                                    常用 V-Ray 后缀
                                </button>
                                <button
                                    class="batch-presets-group__btn"
                                    type="button"
                                    @click="applyBatchSuffixPresetGroup('common')"
                                >
                                    常用烘焙后缀
                                </button>
                            </div>
                            <div class="batch-presets">
                                <button
                                    v-for="suffix in batchSuffixPresets"
                                    :key="suffix"
                                    class="batch-presets__btn"
                                    type="button"
                                    @click="appendBatchSuffixPreset(suffix)"
                                >
                                    + {{ suffix }}
                                </button>
                            </div>
                        </div>
                        <div class="config-item">
                            <label>去前缀（逗号分隔）</label>
                            <input v-model="batchPrefixInput" type="text" placeholder="T_,LM_" />
                        </div>
                        <div class="config-item">
                            <label>匹配模式</label>
                            <select v-model="batchMatchMode">
                                <option value="exact">精确匹配</option>
                                <option value="case-insensitive">忽略大小写</option>
                                <option value="normalized">归一化匹配</option>
                            </select>
                        </div>
                    </div>

                    <div class="config-item">
                        <label>替换规则（每行一条，格式：from => to）</label>
                        <textarea
                            v-model="batchReplaceRulesInput"
                            class="batch-rules-textarea"
                            placeholder="LOD0 =>&#10;_001 =>&#10;Facade => facade"
                        />
                    </div>

                    <div class="batch-rule-hint">
                        文件名会先去扩展名，再按“去前缀 / 去后缀 / 替换规则”依次转换。
                        例如 `attached_总配VRayCompleteMap.png`，在“去后缀”里填 `VRayCompleteMap`，最终会匹配为 `attached_总配`。
                    </div>

                    <div v-if="batchAssets.length" class="batch-selected">
                        已选纹理 {{ batchAssets.length }} 张：
                        <span class="batch-selected__names">{{ batchAssetNamesText }}</span>
                    </div>

                    <div class="batch-summary" v-if="batchPreviewRows.length">
                        <span>可应用 {{ batchApplicableCount }}</span>
                        <span>未匹配 {{ batchUnmatchedCount }}</span>
                        <span>冲突 {{ batchConflictCount }}</span>
                        <span>将覆盖 {{ batchOverwriteCount }}</span>
                    </div>
                    <div class="batch-impact" v-if="batchPreviewRows.length">
                        <span>预计影响 Mesh {{ batchImpactedMeshCount }}</span>
                        <span>预计材质实例 {{ batchEstimatedMaterialCount }}</span>
                        <span>{{ localConfig.IndependentMaterial ? '当前为独立材质模式' : '当前为复用材质模式' }}</span>
                    </div>

                    <div v-if="batchPreviewRows.length" class="batch-filters">
                        <button
                            v-for="filter in batchResultFilterOptions"
                            :key="filter.value"
                            class="batch-filters__btn"
                            :class="{ active: batchResultFilter === filter.value }"
                            type="button"
                            @click="batchResultFilter = filter.value"
                        >
                            {{ filter.label }}
                        </button>
                    </div>

                    <div v-if="batchPreviewRows.length" class="batch-preview-table">
                        <div class="batch-preview-table__head">
                            <span>贴图</span>
                            <span>转换后名称</span>
                            <span>匹配对象</span>
                            <span>状态</span>
                        </div>
                        <div
                            v-for="row in filteredBatchPreviewRows"
                            :key="`${row.assetUrl}-${row.transformedName}`"
                            class="batch-preview-table__row"
                        >
                            <span :title="row.assetName">{{ row.assetName }}</span>
                            <span :title="row.transformedName">{{ row.transformedName || '--' }}</span>
                            <span :title="row.matchedTargetName || row.matchedTargetNames?.join(', ') || '--'">
                                {{ row.matchedTargetLabel || row.matchedTargetNames?.join(', ') || '--' }}
                            </span>
                            <span class="batch-status" :class="`is-${row.status}`">{{ batchStatusLabelMap[row.status] }}</span>
                        </div>
                    </div>
                </div>

                <!-- English comment. -->
                <template v-if="editMode === 'manual'">
                <div class="modal-toolbar">
                <div class="search-input-wrapper">
                    <input
                        v-model="searchQuery"
                        type="text"
                        class="search-input"
                        placeholder="搜索 Mesh..."
                        :disabled="!localConfig.enabled"
                    />
                    <button
                        v-if="searchQuery"
                        class="btn-clear-search"
                        type="button"
                        title="清空搜索"
                        :disabled="!localConfig.enabled"
                        @click="searchQuery = ''"
                    >
                        ×
                    </button>
                </div>
                <button
                    class="btn-pick-mesh"
                    :class="{ active: isMeshPickingActive }"
                    type="button"
                    :disabled="!localConfig.enabled"
                    @click="toggleMeshEyedropper"
                >
                    {{ isMeshPickingActive ? '取消吸管' : '吸管选物' }}
                </button>
                <button
                    class="btn-clear-all"
                    @click="clearAllTextures"
                    :disabled="!localConfig.enabled || Object.keys(localConfig.textureMapping).length === 0"
                >
                    清空贴图
                </button>
                </div>
                </template>

                <!-- English comment. -->
                <template v-if="editMode === 'manual'">
                <div class="modal-content">
                <div v-if="loading" class="loading">加载中...</div>
                <div v-else-if="meshTreeNodes.length === 0" class="empty">
                    {{ searchQuery ? '未找到匹配的 Mesh' : '未找到任何 Mesh' }}
                </div>
                <div v-else class="mesh-tree-container" :class="{ disabled: !localConfig.enabled }">
                    <MeshTreeNode
                        v-for="node in meshTreeNodes"
                        :key="node.id"
                        :node="node"
                        :level="0"
                        :expanded="expandedNodes.has(node.id)"
                        :texture-mapping="localConfig.textureMapping"
                        :bake-mode="true"
                        :enabled="localConfig.enabled"
                        :search-query="searchQuery"
                        :expanded-nodes="expandedNodes"
                        :active-node-name="activeNodeName"
                        @toggle="handleToggleNode"
                        @click-node="handleNodeClick"
                        @select-texture="openAssetPicker"
                        @clear-texture="clearTexture"
                    />
                </div>
                </div>
                </template>

        <!-- English comment. -->
        <template #footer>
            <div class="baked-footer-wrapper">
                <div class="footer-info">
                    <span class="config-count">
                        已配置: {{ Object.keys(localConfig.textureMapping).length }} / {{ totalMeshCount }}
                    </span>
                </div>
                <div class="footer-buttons">
                    <button class="btn-cancel" @click="close">取消</button>
                            <button class="btn-apply" @click="applyConfig" :disabled="!localConfig.enabled">
                        应用
                    </button>
                    <button class="btn-confirm" @click="confirm">保存</button>
                </div>
            </div>
        </template>
    </Modal>

    <!-- English comment. -->
    <AssetPickerModal
        v-model="showAssetPicker"
        category="texture"
        :initial-keyword="assetPickerSearchKeyword"
        :multiple="assetPickerMultiple"
        @select="handleAssetSelect"
    />
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import Modal from '../ui/Modal.vue';
import AssetPickerModal from './AssetPickerModal.vue';
import MeshTreeNode from './MeshTreeNode.vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    modelLoaderId: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:modelValue', 'save', 'baked-lighting-updated']);

const componentStore = useComponentStore();
const editorStore = useEditorStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

// English comment.
const isOpen = ref(props.modelValue);
const loading = ref(false);
const meshTreeNodes = ref([]);
const totalMeshCount = ref(0);
const expandedNodes = ref(new Set());
const searchQuery = ref('');
const showAssetPicker = ref(false);
const currentEditingMesh = ref(null);
const assetPickerSearchKeyword = ref('');
const assetPickerMultiple = ref(false);
const activeNodeName = ref('');
const editMode = ref('manual');
const batchAssets = ref([]);
const batchSuffixInput = ref('_bake,_LM,_lightmap');
const batchPrefixInput = ref('');
const batchMatchMode = ref('exact');
const batchReplaceRulesInput = ref('');
const batchPreviewRows = ref([]);
const batchResultFilter = ref('all');
const batchSuffixPresets = ['VRayCompleteMap', '_bake', '_LM', '_lightmap', '_LightMap', '_lighting'];
const batchSuffixPresetGroups = {
    vray: ['VRayCompleteMap'],
    common: ['_bake', '_LM', '_lightmap', '_LightMap', '_lighting']
};

const batchStatusLabelMap = {
    matched: '匹配成功',
    overwrite: '将覆盖',
    unmatched: '未匹配',
    conflict: '冲突'
};
const batchResultFilterOptions = [
    { label: '全部', value: 'all' },
    { label: '可应用', value: 'applicable' },
    { label: '未匹配', value: 'unmatched' },
    { label: '冲突', value: 'conflict' },
    { label: '将覆盖', value: 'overwrite' }
];

// English comment.
const defaultConfig = {
    enabled: true,
    textureMapping: {},
    mode: 'bake',
    intensity: 3.5,
    autoApply: true,
    disableInEditor: false,
    channel: 1,
    flipY: false,
    IndependentMaterial: true,
    applyChunkSize: 48
};

// English comment.
const localConfig = ref({ ...defaultConfig });

const isPerformanceModeEnabled = computed(() => {
    const componentData = componentStore.components.find(c => c.id === props.modelLoaderId);
    return componentData?.config?.performanceMode === true;
});

const showEditorSkipHint = computed(() => {
    return editorStore.mode === 'edit' && localConfig.value?.disableInEditor === true;
});
const showLargeSceneHint = computed(() => totalMeshCount.value >= 300);
const recommendedChunkSize = computed(() => {
    if (totalMeshCount.value >= 1500) return 24;
    if (totalMeshCount.value >= 800) return 32;
    if (totalMeshCount.value >= 300) return 40;
    return 48;
});

const batchAssetNamesText = computed(() => batchAssets.value.map((item) => item?.name).filter(Boolean).join('、'));
const batchApplicableCount = computed(() => batchPreviewRows.value.filter((item) => item.status === 'matched' || item.status === 'overwrite').length);
const batchUnmatchedCount = computed(() => batchPreviewRows.value.filter((item) => item.status === 'unmatched').length);
const batchConflictCount = computed(() => batchPreviewRows.value.filter((item) => item.status === 'conflict').length);
const batchOverwriteCount = computed(() => batchPreviewRows.value.filter((item) => item.status === 'overwrite').length);
const batchImpactedMeshCount = computed(() => {
    return batchPreviewRows.value.reduce((count, item) => {
        if (item.status !== 'matched' && item.status !== 'overwrite') return count;
        return count + (item.applyTargetNames?.length || 0);
    }, 0);
});
const batchEstimatedMaterialCount = computed(() => {
    if (!localConfig.value.IndependentMaterial) {
        return batchApplicableCount.value;
    }
    return batchImpactedMeshCount.value;
});
const isMeshPickingActive = computed(() => {
    const context = componentStore.meshPicking;
    return context?.active && context.componentId === props.modelLoaderId && context.source === 'baked-lighting';
});
const filteredBatchPreviewRows = computed(() => {
    if (batchResultFilter.value === 'all') return batchPreviewRows.value;
    if (batchResultFilter.value === 'applicable') {
        return batchPreviewRows.value.filter((item) => item.status === 'matched' || item.status === 'overwrite');
    }
    return batchPreviewRows.value.filter((item) => item.status === batchResultFilter.value);
});

/**
 * English comment.
 */
function getModelLoaderInstance() {
    if (!props.modelLoaderId) return null;
    const componentData = componentStore.components.find(c => c.id === props.modelLoaderId);
    return componentData?.instance || null;
}

/**
 * English comment.
 */
function loadExistingConfig() {
    const componentData = componentStore.components.find(c => c.id === props.modelLoaderId);
    if (componentData?.config?.bakedLighting) {
        const existing = componentData.config.bakedLighting;
        localConfig.value = {
            enabled: existing.enabled ?? defaultConfig.enabled,
            textureMapping: { ...(existing.textureMapping || {}) },
            mode: existing.mode ?? defaultConfig.mode,
            intensity: existing.intensity ?? defaultConfig.intensity,
            autoApply: existing.autoApply ?? defaultConfig.autoApply,
            disableInEditor: existing.disableInEditor ?? defaultConfig.disableInEditor,
            channel: existing.channel ?? defaultConfig.channel,
            flipY: existing.flipY ?? defaultConfig.flipY,
            IndependentMaterial: existing.IndependentMaterial ?? defaultConfig.IndependentMaterial,
            applyChunkSize: existing.applyChunkSize ?? defaultConfig.applyChunkSize
        };
    } else {
        localConfig.value = { ...defaultConfig, textureMapping: {} };
    }
}

/**
 * English comment.
 */
function buildMeshTree() {
    loading.value = true;
    meshTreeNodes.value = [];
    totalMeshCount.value = 0;

    if (!props.modelLoaderId) {
        console.warn('[BakedLightingModal] 未指定 ModelLoader ID');
        loading.value = false;
        return;
    }

    try {
        const instance = getModelLoaderInstance();
        if (!instance) {
            console.error('[BakedLightingModal] ModelLoader 组件实例未找到');
            loading.value = false;
            return;
        }

        const structureTree = instance.getModelStructureTree?.();
        if (Array.isArray(structureTree) && structureTree.length > 0) {
            meshTreeNodes.value = structureTree;
            const countMeshNodes = (nodes = []) => nodes.reduce((count, node) => {
                return count + (node?.isMesh ? 1 : 0) + countMeshNodes(node?.children || []);
            }, 0);
            totalMeshCount.value = countMeshNodes(structureTree);
            console.log('[BakedLightingModal] 使用 ModelLoader 结构树，Mesh 数量:', totalMeshCount.value);
            return;
        }

        let rootObjects = [];

        // English comment.
        if (instance.model) {
            rootObjects = [instance.model];
        } else if (instance.componentScene?.children?.length > 0) {
            rootObjects = instance.componentScene.children;
        }

        if (rootObjects.length === 0) {
            console.warn('[BakedLightingModal] 未找到可用的对象');
            loading.value = false;
            return;
        }

        // English comment.
        let meshCount = 0;
        const buildTreeNode = (object, parentPath = '') => {
            if (object?.userData?.__w3dPerformanceBatchMesh === true) {
                return null;
            }
            if (!object.name || object.name.startsWith('Unnamed')) {
                return null;
            }

            const nodePath = parentPath ? `${parentPath}/${object.name}` : object.name;
            const isPerformanceProxy = object?.userData?.__w3dPerformanceBatchProxy !== undefined;
            const isMesh = object.isMesh || isPerformanceProxy;
            const node = {
                id: nodePath,
                name: object.name,
                type: object.type,
                isMesh,
                children: []
            };

            // English comment.
            if (isMesh) {
                meshCount++;
            }

            // English comment.
            if (object.children && object.children.length > 0) {
                object.children.forEach(child => {
                    const childNode = buildTreeNode(child, nodePath);
                    if (childNode) {
                        node.children.push(childNode);
                    }
                });
            }

            return node;
        };

        rootObjects.forEach(obj => {
            const node = buildTreeNode(obj);
            if (node) {
                meshTreeNodes.value.push(node);
            }
        });

        totalMeshCount.value = meshCount;
        console.log('[BakedLightingModal] 构建树形结构完成，Mesh 数量:', meshCount);
    } catch (error) {
        console.error('[BakedLightingModal] 构建树形结构失败:', error);
    } finally {
        loading.value = false;
    }
}

/**
 * English comment.
 */
function handleToggleNode(nodeId) {
    if (expandedNodes.value.has(nodeId)) {
        expandedNodes.value.delete(nodeId);
    } else {
        expandedNodes.value.add(nodeId);
    }
}

/**
 * English comment.
 */
function openAssetPicker(meshName) {
    console.log('[BakedLightingModal] 打开资源选择器 for mesh:', meshName);
    currentEditingMesh.value = meshName;
    assetPickerMultiple.value = false;
    assetPickerSearchKeyword.value = String(meshName || '').trim();
    showAssetPicker.value = true;
    console.log('[BakedLightingModal] showAssetPicker:', showAssetPicker.value);
}

function openBatchAssetPicker() {
    currentEditingMesh.value = null;
    assetPickerMultiple.value = true;
    assetPickerSearchKeyword.value = '';
    showAssetPicker.value = true;
}

/**
 * English comment.
 */
function handleAssetSelect(asset) {
    console.log('[BakedLightingModal] 资源已选择:', asset);
    if (assetPickerMultiple.value) {
        batchAssets.value = Array.isArray(asset) ? asset : [];
        batchPreviewRows.value = [];
        batchResultFilter.value = 'all';
        showAssetPicker.value = false;
        assetPickerMultiple.value = false;
        assetPickerSearchKeyword.value = '';
        toast.success(`已选择 ${batchAssets.value.length} 张纹理`);
        return;
    }

    if (currentEditingMesh.value && asset?.url) {
        localConfig.value.textureMapping[currentEditingMesh.value] = asset.url;
        console.log('[BakedLightingModal] 已更新 textureMapping:', localConfig.value.textureMapping);
    }
    showAssetPicker.value = false;
    currentEditingMesh.value = null;
    assetPickerSearchKeyword.value = '';
}

function clearBatchAssets() {
    batchAssets.value = [];
    batchPreviewRows.value = [];
    batchResultFilter.value = 'all';
}

function parseRuleList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function appendBatchSuffixPreset(suffix) {
    const current = parseRuleList(batchSuffixInput.value);
    if (!current.includes(suffix)) {
        batchSuffixInput.value = [...current, suffix].join(',');
    }
}

function applyBatchSuffixPresetGroup(groupKey) {
    const group = batchSuffixPresetGroups[groupKey] || [];
    const current = parseRuleList(batchSuffixInput.value);
    const merged = [...current];
    group.forEach((suffix) => {
        if (!merged.includes(suffix)) {
            merged.push(suffix);
        }
    });
    batchSuffixInput.value = merged.join(',');
}

function parseReplaceRules(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split('=>');
            if (parts.length < 2) return null;
            const from = parts[0].trim();
            const to = parts.slice(1).join('=>').trim();
            if (!from) return null;
            return { from, to };
        })
        .filter(Boolean);
}

function stripFileExtension(name) {
    return String(name || '').replace(/\.[^.]+$/, '');
}

function normalizeMatchName(name) {
    return String(name || '').toLowerCase().replace(/[\s_-]+/g, '');
}

function transformAssetName(assetName) {
    let result = stripFileExtension(assetName);
    const prefixes = parseRuleList(batchPrefixInput.value);
    const suffixes = parseRuleList(batchSuffixInput.value);
    const replaceRules = parseReplaceRules(batchReplaceRulesInput.value);

    prefixes.forEach((prefix) => {
        const lowerResult = result.toLowerCase();
        const lowerPrefix = String(prefix).toLowerCase();
        if (lowerPrefix && lowerResult.startsWith(lowerPrefix)) {
            result = result.slice(prefix.length);
        }
    });

    suffixes.forEach((suffix) => {
        const lowerResult = result.toLowerCase();
        const lowerSuffix = String(suffix).toLowerCase();
        if (lowerSuffix && lowerResult.endsWith(lowerSuffix)) {
            result = result.slice(0, result.length - suffix.length);
        }
    });

    replaceRules.forEach((rule) => {
        result = result.split(rule.from).join(rule.to);
    });

    return result.trim();
}

function collectDescendantMeshNames(node, result = []) {
    (node?.children || []).forEach((child) => {
        if (child?.isMesh && child?.name) {
            result.push(child.name);
        }
        if (child?.children?.length) {
            collectDescendantMeshNames(child, result);
        }
    });
    return result;
}

function collectMatchTargets(nodes, result = []) {
    (nodes || []).forEach((node) => {
        const isMatchableGroup = node?.type === 'Group' && node?.name;
        if (node?.name && node?.isMesh) {
            result.push({
                name: node.name,
                type: 'mesh',
                applyTargetNames: [node.name]
            });
        } else if (isMatchableGroup) {
            const descendantMeshNames = collectDescendantMeshNames(node, []);
            if (descendantMeshNames.length) {
                result.push({
                    name: node.name,
                    type: 'group',
                    applyTargetNames: descendantMeshNames
                });
            }
        }
        if (node?.children?.length) {
            collectMatchTargets(node.children, result);
        }
    });
    return result;
}

function isTargetNameMatched(candidate, transformedName) {
    if (batchMatchMode.value === 'exact') {
        return candidate === transformedName;
    }
    if (batchMatchMode.value === 'case-insensitive') {
        return String(candidate).toLowerCase() === transformedName.toLowerCase();
    }
    return normalizeMatchName(candidate) === normalizeMatchName(transformedName);
}

function findMatchedTargets(transformedName, targets) {
    if (!transformedName) return [];

    const meshMatches = targets.filter((item) => item.type === 'mesh' && isTargetNameMatched(item.name, transformedName));
    const groupMatches = targets.filter((item) => item.type === 'group' && isTargetNameMatched(item.name, transformedName));

    if (meshMatches.length === 1 && groupMatches.length === 0) return meshMatches;
    if (meshMatches.length === 0 && groupMatches.length === 1) return groupMatches;
    if (meshMatches.length > 0 && groupMatches.length === 0) return meshMatches;
    if (meshMatches.length === 0 && groupMatches.length > 0) return groupMatches;

    return [...meshMatches, ...groupMatches];
}

function formatMatchedTargetLabel(target) {
    if (!target?.name) return '--';
    if (target.type === 'group') {
        return `[Group→${target.applyTargetNames?.length || 0} Mesh] ${target.name}`;
    }
    return `[Mesh] ${target.name}`;
}

function getMatchedTargetStatus(matchedTargets) {
    if (matchedTargets.length === 1) {
        const applyTargetNames = matchedTargets[0].applyTargetNames || [];
        const hasExisting = applyTargetNames.some((name) => localConfig.value.textureMapping[name]);
        return hasExisting ? 'overwrite' : 'matched';
    }
    if (matchedTargets.length > 1) {
        return 'conflict';
    }
    return 'unmatched';
}

function generateBatchPreview() {
    const matchTargets = collectMatchTargets(meshTreeNodes.value, []);
    batchResultFilter.value = 'all';
    batchPreviewRows.value = batchAssets.value.map((asset) => {
        const assetName = asset?.fileName || asset?.name || asset?.url || '';
        const transformedName = transformAssetName(assetName);
        const matchedTargets = findMatchedTargets(transformedName, matchTargets);
        return {
            assetName,
            assetUrl: asset?.url || '',
            transformedName,
            matchedTargetName: matchedTargets.length === 1 ? matchedTargets[0].name : null,
            matchedTargetType: matchedTargets.length === 1 ? matchedTargets[0].type : '',
            applyTargetNames: matchedTargets.length === 1 ? (matchedTargets[0].applyTargetNames || []) : [],
            matchedTargetLabel: matchedTargets.length === 1 ? formatMatchedTargetLabel(matchedTargets[0]) : '',
            matchedTargetNames: matchedTargets.length > 1 ? matchedTargets.map((item) => formatMatchedTargetLabel(item)) : [],
            status: getMatchedTargetStatus(matchedTargets)
        };
    });
}

function applyBatchPreview() {
    const nextMapping = { ...(localConfig.value.textureMapping || {}) };
    let appliedCount = 0;
    let groupCount = 0;
    batchPreviewRows.value.forEach((row) => {
        if ((row.status === 'matched' || row.status === 'overwrite') && row.applyTargetNames?.length && row.assetUrl) {
            row.applyTargetNames.forEach((name) => {
                nextMapping[name] = row.assetUrl;
                appliedCount++;
            });
            if (row.matchedTargetType === 'group') {
                groupCount++;
            }
        }
    });
    localConfig.value.textureMapping = nextMapping;
    toast.success(`已批量写入 ${appliedCount} 个 Mesh 的烘焙贴图${groupCount ? `，其中由 Group 展开 ${groupCount} 项` : ''}`);
    editMode.value = 'manual';
}

function handleNodeClick(node) {
    if (!node?.name) return;
    activeNodeName.value = node.name;
}

function toggleMeshEyedropper() {
    if (!props.modelLoaderId) return;
    if (isMeshPickingActive.value) {
        componentStore.stopMeshPicking();
        toast.info('已取消 Mesh 吸管拾取');
        return;
    }
    componentStore.startMeshPicking(props.modelLoaderId, 'baked-lighting');
    toast.info('请在场景中点击一个物体，自动定位到对应 Mesh');
}

/**
 * English comment.
 */
function clearTexture(meshName) {
    delete localConfig.value.textureMapping[meshName];
}

/**
 * English comment.
 */
function clearAllTextures() {
    localConfig.value.textureMapping = {};
}

/**
 * English comment.
 */
function getFileName(path) {
    if (!path) return '';
    return path.split('/').pop();
}

/**
 * English comment.
 */
function getTexturePreviewUrl(path) {
    if (!path) return '';
    // English comment.
    if (path.startsWith('/')) {
        return path;
    }
    return path;
}

/**
 * English comment.
 */
function handleImageError(event) {
    event.target.style.display = 'none';
}

/**
 * English comment.
 */
async function applyConfig() {
    if (!props.modelLoaderId) {
        toast.error('未找到 ModelLoader 组件');
        return;
    }

    try {
        const bakedLightingConfig = {
            enabled: localConfig.value.enabled,
            textureMapping: { ...localConfig.value.textureMapping },
            mode: localConfig.value.mode,
            intensity: localConfig.value.intensity,
            autoApply: localConfig.value.autoApply,
            disableInEditor: localConfig.value.disableInEditor,
            channel: localConfig.value.channel,
            flipY: localConfig.value.flipY,
            IndependentMaterial: localConfig.value.IndependentMaterial,
            applyChunkSize: Math.max(8, Number(localConfig.value.applyChunkSize) || defaultConfig.applyChunkSize)
        };

        await updateComponentConfig(props.modelLoaderId, {
            bakedLighting: bakedLightingConfig
        });

        toast.success('烘焙配置已应用');
    } catch (error) {
        console.error('[BakedLightingModal] 应用配置失败:', error);
        toast.error('应用配置失败: ' + error.message);
    }
}

/**
 * English comment.
 */
async function confirm() {
    await applyConfig();
    const savedConfig = { ...localConfig.value };
    emit('save', savedConfig);
    emit('baked-lighting-updated', savedConfig);
    close();
}

/**
 * English comment.
 */
function close() {
    if (isMeshPickingActive.value) {
        componentStore.stopMeshPicking();
    }
    isOpen.value = false;
}

// English comment.
watch(() => props.modelValue, (newValue) => {
    isOpen.value = newValue;
    if (newValue) {
        loadExistingConfig();
        buildMeshTree();
        editMode.value = 'manual';
        batchPreviewRows.value = [];
        batchResultFilter.value = 'all';
        activeNodeName.value = '';
        // English comment.
        expandedNodes.value = new Set(meshTreeNodes.value.map(node => node.id));
        if (totalMeshCount.value >= 300 && localConfig.value.IndependentMaterial) {
            toast.info('当前模型 Mesh 数量较多，若应用烘焙后卡顿，建议关闭“独立材质”并适当降低分批应用数量。');
        }
    } else {
        searchQuery.value = '';
        activeNodeName.value = '';
        expandedNodes.value.clear();
    }
});

// English comment.
watch(isOpen, (newValue) => {
    emit('update:modelValue', newValue);
});

watch(() => componentStore.meshPickResult?.token, (token) => {
    if (!token) return;
    const result = componentStore.meshPickResult;
    if (!result) return;
    if (result.componentId !== props.modelLoaderId || result.source !== 'baked-lighting') return;
    if (result.meshName) {
        editMode.value = 'manual';
        activeNodeName.value = result.meshName;
        searchQuery.value = result.meshName;
        toast.success(`已拾取 Mesh: ${result.meshName}`);
    }
    componentStore.clearMeshPickResult();
});
</script>

<style scoped>
/* English comment. */
.baked-footer-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.footer-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.config-count {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

.footer-buttons {
    display: flex;
    gap: 0.5rem;
}

/* English comment. */
.config-section {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border);
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
}

.section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

/* English comment. */
.toggle-switch {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.toggle-switch input {
    display: none;
}

.toggle-slider {
    position: relative;
    width: 40px;
    height: 20px;
    background: var(--color-bg-secondary);
    border-radius: 10px;
    transition: all 0.2s;
}

.toggle-slider::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--color-text-secondary);
    border-radius: 50%;
    transition: all 0.2s;
}

.toggle-switch input:checked + .toggle-slider {
    background: var(--color-primary);
}

.toggle-switch input:checked + .toggle-slider::after {
    left: 22px;
    background: white;
}

.toggle-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

/* English comment. */
.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
}

.config-grid.disabled {
    opacity: 0.5;
    pointer-events: none;
}

.runtime-hint {
    margin-top: 0.625rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.4;
}

.runtime-hint--warn {
    border-color: color-mix(in srgb, var(--color-primary) 38%, var(--color-border));
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.mode-switch {
    display: inline-flex;
    gap: 0.375rem;
    margin: 0.25rem 0 0.75rem;
    padding: 0.25rem;
    border-radius: 999px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
}

.mode-switch__btn {
    min-width: 90px;
    height: 30px;
    padding: 0 0.875rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.18s ease;
}

.mode-switch__btn.active {
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-bg-elevated));
    color: var(--color-text-primary);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent);
}

.batch-panel {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 0.875rem 0 0.5rem;
}

.batch-toolbar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.batch-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
}

.batch-selected,
.batch-summary,
.batch-impact {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
}

.batch-impact {
    margin-top: -0.25rem;
    border-style: dashed;
}

.batch-filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.batch-filters__btn {
    height: 28px;
    padding: 0 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.18s ease;
}

.batch-filters__btn.active {
    border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
    background: color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-elevated));
    color: var(--color-text-primary);
}

.batch-selected__names {
    color: var(--color-text-primary);
}

.batch-rule-hint {
    margin-top: -0.125rem;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.6;
}

.batch-presets {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
}

.batch-presets-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
}

.batch-presets-group__btn {
    height: 26px;
    padding: 0 0.625rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-secondary));
    color: var(--color-text-primary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.18s ease;
}

.batch-presets-group__btn:hover {
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-bg-elevated));
    border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.batch-presets__btn {
    height: 24px;
    padding: 0 0.5rem;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
    cursor: pointer;
    transition: all 0.18s ease;
}

.batch-presets__btn:hover {
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-elevated));
}

.batch-rules-textarea {
    width: 100%;
    min-height: 88px;
    padding: 0.625rem 0.75rem;
    resize: vertical;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    line-height: 1.6;
    font-family: var(--font-mono, Consolas, monospace);
}

.batch-rules-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.batch-preview-table {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    overflow: hidden;
}

.batch-preview-table__head,
.batch-preview-table__row {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr 110px;
    gap: 0.75rem;
    align-items: center;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
}

.batch-preview-table__head {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-weight: 600;
}

.batch-preview-table__row {
    border-top: 1px solid var(--color-border);
    color: var(--color-text-primary);
}

.batch-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
}

.batch-status.is-matched {
    background: color-mix(in srgb, var(--color-success) 18%, transparent);
    color: var(--color-success);
}

.batch-status.is-overwrite {
    background: color-mix(in srgb, var(--color-warning) 18%, transparent);
    color: var(--color-warning);
}

.batch-status.is-unmatched {
    background: color-mix(in srgb, var(--color-error) 14%, transparent);
    color: var(--color-error);
}

.batch-status.is-conflict {
    background: color-mix(in srgb, var(--color-primary) 18%, transparent);
    color: var(--color-primary);
}

.config-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.config-item label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.config-item select,
.config-item input[type="number"] {
    padding: 0.375rem 0.5rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-primary);
    font-size: 0.875rem;
}

.config-item select:focus,
.config-item input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.checkbox-item label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
}

/* English comment. */
.modal-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border);
}

.search-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
}

.search-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    padding-right: 1.875rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    color: var(--color-text-primary);
    font-size: 0.875rem;
}

.search-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.search-input:disabled {
    opacity: 0.5;
}

.btn-clear-search {
    position: absolute;
    right: 0.375rem;
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    line-height: 1;
}

.btn-clear-search:hover:not(:disabled) {
    color: var(--color-text-primary);
    background: var(--color-bg-hover);
}

.btn-clear-all {
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-clear-all:hover:not(:disabled) {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: white;
}

.btn-clear-all:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-pick-mesh {
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.btn-pick-mesh:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-text-primary);
}

.btn-pick-mesh.active {
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-bg-elevated));
    border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
    color: var(--color-text-primary);
}

.btn-pick-mesh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* English comment. */
.modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 0;
    min-height: 200px;
    max-height: 400px;
}

.loading,
.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 150px;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

/* English comment. */
.mesh-tree-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.mesh-tree-container.disabled {
    opacity: 0.5;
    pointer-events: none;
}

/* English comment. */
.btn-cancel,
.btn-apply,
.btn-confirm {
    padding: 0.5rem 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-cancel {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
}

.btn-cancel:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.btn-apply {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    border-color: var(--color-primary);
}

.btn-apply:hover:not(:disabled) {
    background: var(--color-primary);
    color: white;
}

.btn-apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-confirm {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.btn-confirm:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
}

@media (max-width: 900px) {
    .batch-grid,
    .batch-preview-table__head,
    .batch-preview-table__row {
        grid-template-columns: 1fr;
    }
}
</style>
