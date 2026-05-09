<template>
    <div class="exploded-view-editor">
        <!-- English comment. -->
        <div class="action-buttons">
            <Button
                :variant="isExploded ? 'default' : 'outline'"
                size="sm"
                :disabled="!hasFloors"
                @click="toggleExplode"
            >{{ isExploded ? '重置' : '爆炸' }}</Button>
            <Button
                variant="outline"
                size="sm"
                :disabled="!selectedFloorIndex"
                @click="deselectFloor"
            >取消选中</Button>
        </div>

        <!-- English comment. -->
        <div class="section">
            <div class="section-header">
                <span class="section-title">关联模型</span>
            </div>

            <div class="model-association">
                <div v-if="modelLoaderComponents.length === 0" class="empty-state small">
                    <div class="empty-text">场景中没有 ModelLoader 组件</div>
                    <div class="empty-hint">请先添加模型加载器组件</div>
                </div>

                <div v-else class="loader-select-wrap">
                    <div class="loader-selector-row">
                        <Select
                            v-model="selectedLoaderId"
                            :options="availableModelLoaderOptions"
                            placeholder="请选择 ModelLoader 组件"
                        />
                        <Button
                            v-if="selectedLoaderId"
                            variant="outline"
                            size="sm"
                            @click="selectedLoaderId = null"
                            title="取消绑定"
                        >取消</Button>
                    </div>
                    <div class="no-selection-hint">楼层与 Mesh 配置请在“楼层爆炸图设置”弹窗中完成</div>
                </div>
            </div>
        </div>

        <!-- English comment. -->
        <div class="section">
            <div class="section-header">
                <span class="section-title">楼层爆炸图设置</span>
                <div class="header-actions">
                    <span v-if="hasValidFloors" class="config-status">{{ validFloorCount }} 层</span>
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="!selectedLoaderId"
                        @click="openConfigModal"
                    >配置</Button>
                </div>
            </div>
            <div class="config-overview">
                <div v-if="!selectedLoaderId" class="empty-hint">请先在“关联模型”中选择 ModelLoader 后再配置楼层爆炸图</div>
                <div v-else-if="floors.length === 0" class="empty-hint">当前暂无楼层配置</div>
                <div v-else class="empty-hint">已配置 {{ floors.length }} 层，点击“配置”按钮编辑楼层与 Mesh</div>
            </div>
        </div>

        <!-- English comment. -->
        <div v-if="configModalVisible" class="config-modal-overlay">
            <div class="config-modal" @click.stop>
                <div class="modal-header">
                    <h3>楼层爆炸图设置</h3>
                    <div class="modal-header-actions">
                        <span v-if="floorConfigDirty" class="dirty-tag">未保存（{{ pendingChangeCount }}）</span>
                        <span v-else class="saved-tag">已保存</span>
                        <span class="save-time">{{ lastSavedTimeLabel }}</span>
                        <Button variant="primary" size="sm" :disabled="!floorConfigDirty" @click="saveFloorConfigFromModal">保存</Button>
                        <Button variant="outline" size="sm" @click="closeConfigModal">关闭</Button>
                    </div>
                </div>

                <div class="modal-toolbar">
                    <Button variant="outline" size="sm" @click="addFloor">添加楼层</Button>
                    <Button variant="outline" size="sm" @click="applyDefaultFloorsFromFirstLevel">默认楼层</Button>
                    <Button variant="outline" size="sm" :disabled="!hasFloors" @click="selectAllFloors">全选楼层</Button>
                    <Button variant="outline" size="sm" :disabled="!hasSelectedFloors" @click="clearFloorSelection">清空选择</Button>
                    <Button variant="outline" size="sm" :disabled="!hasSelectedFloors" @click="toggleAnimateForSelectedFloors">选中动画</Button>
                    <Button variant="danger" size="sm" :disabled="!hasSelectedFloors" @click="removeSelectedFloors">删除选中</Button>
                    <Button variant="outline" size="sm" :disabled="floors.length < 2" @click="reverseFloorOrder">反向顺序</Button>
                    <Button variant="outline" size="sm" :disabled="!hasFloors" @click="toggleExplode">{{ isExploded ? '重置' : '爆炸' }}</Button>
                </div>

                <div v-if="floors.length === 0" class="empty-state">
                    <div class="empty-text">暂无楼层配置</div>
                    <div class="empty-hint">点击上方“添加楼层”开始配置</div>
                </div>

                <div v-else class="floor-list">
                    <div
                        v-for="(floor, index) in floors"
                        :key="floor.index"
                        class="floor-item"
                        :class="{
                            selected: selectedFloorIndex === floor.index,
                            'no-animate': !floor.animate
                        }"
                    >
                        <div class="floor-header">
                            <div class="order-controls">
                                <input
                                    type="checkbox"
                                    class="floor-select-checkbox"
                                    :checked="isFloorMultiSelected(floor)"
                                    @click.stop
                                    @change="toggleFloorMultiSelect(floor)"
                                    title="多选楼层"
                                />
                            </div>
                            <div class="order-controls">

                                <button
                                    class="btn-order"
                                    :disabled="index === 0"
                                    @click="moveFloor(index, -1)"
                                    title="上移"
                                >
                                    <svg viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M8 4L4 8h8L8 4z" fill="currentColor" />
                                    </svg>
                                </button>
                                <button
                                    class="btn-order"
                                    :disabled="index === floors.length - 1"
                                    @click="moveFloor(index, 1)"
                                    title="下移"
                                >
                                    <svg viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M8 12l4-4H4l4 4z" fill="currentColor" />
                                    </svg>
                                </button>
                            </div>
                            <span
                                class="floor-index"
                                @click="selectFloor(floor.index)"
                            >
                                {{ floor.index }}层
                            </span>
                            <div class="floor-actions">
                                <button
                                    class="btn-floor-toggle"
                                    :class="{ muted: !floor.animate }"
                                    @click="toggleFloorAnimate(index)"
                                    :title="floor.animate ? '禁用动画' : '启用动画'"
                                >
                                    <svg v-if="floor.animate" viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                    <svg v-else viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                    </svg>
                                </button>
                                <button
                                    class="btn-floor-toggle"
                                    @click="toggleFloorExpand(index)"
                                    :title="expandedFloors.includes(index) ? '收起' : '展开'"
                                >
                                    <svg v-if="expandedFloors.includes(index)" viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                    <svg v-else viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <button
                                    class="btn-floor-delete"
                                    @click="removeFloor(index)"
                                    title="删除楼层"
                                >
                                    <svg viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M6 2h4l.5 1H13v1H3V3h2.5L6 2zm-1 3h6l-.5 8h-5L5 5z" fill="currentColor" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div v-if="expandedFloors.includes(index)" class="floor-details">
                            <div class="form-field">
                                <label>楼层索引</label>
                                <Input
                                    :model-value="floor.index"
                                    @update:model-value="updateFloorIndex(index, $event)"
                                    placeholder="如: 1, 2, RF"
                                />
                            </div>

                            <div class="form-field">
                                <label>Mesh / Group 选择</label>
                                <div v-if="selectedLoaderTreeRows.length === 0" class="no-loaders">当前 ModelLoader 中没有可选对象</div>
                                <div v-else class="mesh-tree-picker">
                                    <div class="mesh-tree-search">
                                        <Input
                                            :model-value="getMeshSearchKeyword(floor, index)"
                                            @update:model-value="setMeshSearchKeyword(floor, index, $event)"
                                            placeholder="搜索 Mesh / Group 名称"
                                        />
                                    </div>
                                    <label
                                        v-for="row in getDisplayTreeRows(floor, index)"
                                        :key="row.key"
                                        class="mesh-tree-item"
                                        :style="{ paddingLeft: (row.level * 1 + 0.5) + 'rem' }"
                                    >
                                        <button
                                            v-if="row.hasChildren"
                                            type="button"
                                            class="tree-expand-btn"
                                            @click.stop="toggleTreeNodeExpand(floor, index, row.nodeKey)"
                                            :title="row.expanded ? '收起子节点' : '展开子节点'"
                                        >
                                            {{ row.expanded ? '▾' : '▸' }}
                                        </button>
                                        <span v-else class="tree-expand-placeholder"></span>
                                        <input
                                            type="checkbox"
                                            class="checkbox"
                                            :checked="isNodeSelected(floor, row.name)"
                                            @change="toggleNodeInFloor(index, row.name)"
                                        />
                                        <span class="tree-marker">{{ row.hasChildren ? '◆' : '•' }}</span>
                                        <span class="tree-name">{{ row.name }}</span>
                                        <span v-if="row.level === 0" class="tree-top-tag">一级</span>
                                    </label>
                                    <div v-if="getDisplayTreeRows(floor, index).length === 0" class="mesh-tree-empty">
                                        没有匹配的 Mesh / Group
                                    </div>
                                </div>
                            </div>

                            <div v-if="!isFloorValid(floor)" class="validation-warning">
                                <span class="warning-text">该楼层配置不完整：请选择至少一个 Mesh 或 Group</span>
                            </div>

                            <div class="form-field-inline">
                                <label>参与爆炸动画</label>
                                <input
                                    type="checkbox"
                                    :checked="floor.animate"
                                    @change="updateFloorAnimate(index, $event.target.checked)"
                                    class="checkbox"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Button from '../ui/Button.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';

const getConfigModalStateCache = () => {
    const globalKey = '__w3dExplodedViewConfigModalState__';
    if (!globalThis[globalKey]) {
        globalThis[globalKey] = new Map();
    }
    return globalThis[globalKey];
};

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

// English comment.
const component = computed(() => {
    return componentStore.components.find((c) => c.id === props.componentId);
});

// English comment.
const config = computed(() => component.value?.config || {});

// English comment.
const isExploded = ref(false);

// English comment.
const selectedFloorIndex = ref(null);

// English comment.
const expandedFloors = ref([]);

// English comment.
const floors = ref([]);

// English comment.
const configModalVisible = ref(false);

// English comment.
const selectedFloorKeys = ref([]);

// English comment.
const floorConfigDirty = ref(false);

// English comment.
const pendingChangeCount = ref(0);

// English comment.
const lastSavedAt = ref(null);

// English comment.
const loaderTreeCache = new Map();

// English comment.
const meshSearchKeywordByFloor = ref({});

// English comment.
const collapsedNodeKeysByFloor = ref({});

// English comment.
const selectedLoaderId = ref(null);

// English comment.
const isLoadingFromConfig = ref(false);

// English comment.
const hasFloors = computed(() => floors.value.length > 0);

// English comment.
const validFloorCount = computed(() => {
    return floors.value.filter(floor =>
        floor.meshes && floor.meshes.length > 0
    ).length;
});

// English comment.
const hasValidFloors = computed(() => validFloorCount.value > 0);

// English comment.
const hasSelectedFloors = computed(() => selectedFloorKeys.value.length > 0);

const lastSavedTimeLabel = computed(() => {
    if (!lastSavedAt.value) return '未保存';
    return `最近保存 ${new Date(lastSavedAt.value).toLocaleTimeString('zh-CN', { hour12: false })}`;
});

// English comment.
const selectedLoaderTree = computed(() => {
    if (!selectedLoaderId.value) return [];
    return getLoaderTreeNodes(selectedLoaderId.value);
});

// English comment.
const selectedLoaderTreeRows = computed(() => {
    const rows = [];
    const walk = (nodes, level) => {
        nodes.forEach((node, nodeIndex) => {
            rows.push({
                key: `${level}-${nodeIndex}-${node.name}-${node.type}`,
                name: node.name,
                level,
                hasChildren: Array.isArray(node.children) && node.children.length > 0
            });
            if (node.children && node.children.length > 0) {
                walk(node.children, level + 1);
            }
        });
    };
    walk(selectedLoaderTree.value, 0);
    return rows;
});

const getFloorTreeKey = (floor, floorIndex) => {
    return String(floor?.index ?? floorIndex ?? '');
};

const getMeshSearchKeyword = (floor, floorIndex) => {
    const key = getFloorTreeKey(floor, floorIndex);
    return meshSearchKeywordByFloor.value[key] || '';
};

const setMeshSearchKeyword = (floor, floorIndex, keyword) => {
    const key = getFloorTreeKey(floor, floorIndex);
    meshSearchKeywordByFloor.value = {
        ...meshSearchKeywordByFloor.value,
        [key]: String(keyword || '')
    };
};

const normalizeKeyword = (value) => String(value || '').trim().toLowerCase();

const filterTreeByKeyword = (nodes, keyword) => {
    if (!keyword) return nodes;

    const walk = (nodeList) => {
        const result = [];
        nodeList.forEach((node) => {
            const children = Array.isArray(node.children) ? walk(node.children) : [];
            const matched = String(node.name || '').toLowerCase().includes(keyword);
            if (matched || children.length > 0) {
                result.push({
                    ...node,
                    children
                });
            }
        });
        return result;
    };

    return walk(nodes);
};

const isTreeNodeCollapsed = (floor, floorIndex, nodeKey) => {
    const key = getFloorTreeKey(floor, floorIndex);
    const collapsed = collapsedNodeKeysByFloor.value[key] || [];
    return collapsed.includes(nodeKey);
};

const toggleTreeNodeExpand = (floor, floorIndex, nodeKey) => {
    const key = getFloorTreeKey(floor, floorIndex);
    const collapsed = new Set(collapsedNodeKeysByFloor.value[key] || []);
    if (collapsed.has(nodeKey)) {
        collapsed.delete(nodeKey);
    } else {
        collapsed.add(nodeKey);
    }
    collapsedNodeKeysByFloor.value = {
        ...collapsedNodeKeysByFloor.value,
        [key]: Array.from(collapsed)
    };
};

const getDisplayTreeRows = (floor, floorIndex) => {
    const keyword = normalizeKeyword(getMeshSearchKeyword(floor, floorIndex));
    const sourceTree = filterTreeByKeyword(selectedLoaderTree.value, keyword);

    const rows = [];
    const walk = (nodes, level, parentPath) => {
        nodes.forEach((node, nodeIndex) => {
            const nodeKey = `${parentPath}/${nodeIndex}:${String(node.name || '')}`;
            const hasChildren = Array.isArray(node.children) && node.children.length > 0;
            const expanded = keyword
                ? true
                : !isTreeNodeCollapsed(floor, floorIndex, nodeKey);

            rows.push({
                key: `${level}-${nodeKey}`,
                nodeKey,
                name: node.name,
                level,
                hasChildren,
                expanded
            });

            if (hasChildren && expanded) {
                walk(node.children, level + 1, nodeKey);
            }
        });
    };

    walk(sourceTree, 0, 'root');
    return rows;
};

// English comment.
const modelLoaderComponents = computed(() => {
    return componentStore.components.filter((c) => c.type === 'ModelLoader');
});

// English comment.
const availableModelLoaderOptions = computed(() => {
    return modelLoaderComponents.value.map((loader) => ({
        label: loader.name || `ModelLoader (${loader.id.substring(0, 8)})`,
        value: loader.id
    }));
});

// English comment.
onMounted(() => {
    loadFloorsFromConfig();
    const modalStateCache = getConfigModalStateCache();
    configModalVisible.value = modalStateCache.get(props.componentId) === true;
});

// English comment.
watch(
    () => config.value.floorMap,
    () => {
        // English comment.
        if (!isLoadingFromConfig.value) {
            loadFloorsFromConfig();
        }
    },
    { deep: true }
);

// English comment.
watch(selectedLoaderId, async (newValue, oldValue) => {
    if (newValue !== oldValue && !isLoadingFromConfig.value) {
        try {
            await updateComponentConfig(props.componentId, {
                selectedLoaderId: newValue
            });
        } catch (error) {
            console.error('保存 selectedLoaderId 失败:', error);
        }
    }
});

watch(configModalVisible, (visible) => {
    const modalStateCache = getConfigModalStateCache();
    modalStateCache.set(props.componentId, visible);
});

/**
 * English comment.
 */
const loadFloorsFromConfig = () => {
    isLoadingFromConfig.value = true;

    const floorMap = config.value.floorMap || {};
    const savedFloorOrder = config.value.floorOrder || [];

    // English comment.
    if (config.value.selectedLoaderId) {
        selectedLoaderId.value = config.value.selectedLoaderId;
    }

    // English comment.
    const floorEntries = Object.entries(floorMap).map(([index, data]) => {
        // English comment.
        if (data && data.meshes && Array.isArray(data.meshes)) {
            return { index, meshes: data.meshes, animate: data.animate !== false };
        }
        // English comment.
        if (data && data.modelLoaders && Array.isArray(data.modelLoaders)) {
            const allMeshes = data.modelLoaders.flatMap(ml => ml.meshes || []);
            return { index, meshes: allMeshes, animate: data.animate !== false };
        }
        return { index, meshes: [], animate: data.animate !== false };
    });

    if (savedFloorOrder.length > 0) {
        // English comment.
        const entryMap = Object.fromEntries(floorEntries.map(f => [f.index, f]));
        const ordered = savedFloorOrder
            .map(idx => entryMap[String(idx)])
            .filter(Boolean);
        // English comment.
        const inOrder = new Set(savedFloorOrder.map(String));
        const extra = floorEntries.filter(f => !inOrder.has(String(f.index)));
        floors.value = [...ordered, ...extra];
    } else {
        // English comment.
        floors.value = floorEntries.sort((a, b) => {
            const numA = parseInt(a.index);
            const numB = parseInt(b.index);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.index).localeCompare(String(b.index));
        });
    }
};

/**
 * English comment.
 */
const saveFloorsToConfig = async () => {
    // English comment.
    isLoadingFromConfig.value = true;

    const floorMap = {};
    // English comment.
    const floorOrder = floors.value.map(f => f.index);

    floors.value.forEach((floor) => {
        floorMap[floor.index] = {
            meshes: floor.meshes || [],
            animate: floor.animate,
            loaderId: selectedLoaderId.value
        };
    });

    try {
        await updateComponentConfig(props.componentId, {
            floorMap,
            floorOrder,                                          // English comment.
            selectedLoaderId: selectedLoaderId.value,
            gap: config.value.gap ?? 5,
            animate: config.value.animate ?? true,
            time: config.value.time ?? 2,
            start: config.value.start ?? 1,
            offset: config.value.offset ?? { x: 0, y: 1, z: 0 },
            direction: config.value.direction ?? 'up',
            delayStep: config.value.delayStep ?? 100,
            highlightColor: config.value.highlightColor ?? 0x07a6ff,
            highlightIntensity: config.value.highlightIntensity ?? 1.5
        });
        return true;
    } catch (error) {
        console.error('保存楼层配置失败:', error);
        toast.error('保存配置失败: ' + error.message);
        return false;
    } finally {
        isLoadingFromConfig.value = false;
    }
};

/**
 * English comment.
 */
const addFloor = () => {
    // English comment.
    let newIndex = 1;
    const existingIndices = floors.value.map((f) => parseInt(f.index)).filter((n) => !isNaN(n));
    if (existingIndices.length > 0) {
        newIndex = Math.max(...existingIndices) + 1;
    }

    floors.value.push({
        index: String(newIndex),
        meshes: [],
        animate: true
    });

    // English comment.
    expandedFloors.value.push(floors.value.length - 1);

    queueOrSaveFloorConfig();

    toast.success(`已添加第 ${newIndex} 层`);
};

/**
 * English comment.
 */
const openConfigModal = () => {
    if (!selectedLoaderId.value) {
        toast.warning('请先选择 ModelLoader');
        return;
    }
    loaderTreeCache.delete(selectedLoaderId.value);
    configModalVisible.value = true;
};

/**
 * English comment.
 */
const closeConfigModal = () => {
    if (floorConfigDirty.value && !confirm('当前有未保存的楼层配置，确定关闭吗？')) {
        return;
    }
    configModalVisible.value = false;
};

/**
 * English comment.
 */
const markFloorConfigDirty = () => {
    floorConfigDirty.value = true;
    pendingChangeCount.value += 1;
};

/**
 * English comment.
 */
const queueOrSaveFloorConfig = () => {
    if (configModalVisible.value) {
        markFloorConfigDirty();
        return;
    }
    saveFloorsToConfig();
};

/**
 * English comment.
 */
const saveFloorConfigFromModal = async () => {
    const saved = await saveFloorsToConfig();
    if (saved) {
        floorConfigDirty.value = false;
        pendingChangeCount.value = 0;
        lastSavedAt.value = Date.now();
        toast.success('楼层配置已保存');
    }
};

/**
 * English comment.
 */
const isFloorMultiSelected = (floor) => {
    return selectedFloorKeys.value.includes(String(floor.index));
};

/**
 * English comment.
 */
const toggleFloorMultiSelect = (floor) => {
    const floorKey = String(floor.index);
    const selectedIndex = selectedFloorKeys.value.indexOf(floorKey);
    if (selectedIndex > -1) {
        selectedFloorKeys.value.splice(selectedIndex, 1);
    } else {
        selectedFloorKeys.value.push(floorKey);
    }
};

/**
 * English comment.
 */
const selectAllFloors = () => {
    selectedFloorKeys.value = floors.value.map(f => String(f.index));
};

/**
 * English comment.
 */
const clearFloorSelection = () => {
    selectedFloorKeys.value = [];
};

/**
 * English comment.
 */
const removeSelectedFloors = () => {
    if (!hasSelectedFloors.value) return;

    if (!confirm(`确定删除选中的 ${selectedFloorKeys.value.length} 个楼层吗？`)) {
        return;
    }

    const selectedSet = new Set(selectedFloorKeys.value.map(String));
    floors.value = floors.value.filter(floor => !selectedSet.has(String(floor.index)));
    selectedFloorKeys.value = [];
    expandedFloors.value = [];
    queueOrSaveFloorConfig();
    toast.success('已删除选中楼层');
};

/**
 * English comment.
 */
const toggleAnimateForSelectedFloors = () => {
    if (!hasSelectedFloors.value) return;

    const selectedSet = new Set(selectedFloorKeys.value.map(String));
    const selectedFloors = floors.value.filter(floor => selectedSet.has(String(floor.index)));
    if (selectedFloors.length === 0) return;

    const shouldEnable = selectedFloors.some(floor => floor.animate === false);
    floors.value.forEach((floor) => {
        if (selectedSet.has(String(floor.index))) {
            floor.animate = shouldEnable;
        }
    });

    queueOrSaveFloorConfig();
    toast.success(shouldEnable ? '已启用选中楼层动画' : '已禁用选中楼层动画');
};

/**
 * English comment.
 */
const applyDefaultFloorsFromFirstLevel = () => {
    if (!selectedLoaderId.value) {
        toast.warning('请先选择 ModelLoader');
        return;
    }

    const firstLevelNodes = selectedLoaderTree.value;
    if (firstLevelNodes.length === 0) {
        toast.warning('当前模型未找到可用的一级对象');
        return;
    }

    if (floors.value.length > 0 && !confirm('将按一级对象重建默认楼层，是否覆盖当前楼层配置？')) {
        return;
    }

    floors.value = firstLevelNodes.map((node, index) => ({
        index: String(index + 1),
        meshes: [node.name],
        animate: true
    }));

    expandedFloors.value = floors.value.map((_, index) => index);
    queueOrSaveFloorConfig();
    toast.success(`已按一级对象生成 ${floors.value.length} 层默认楼层`);
};

/**
 * English comment.
 */
const removeFloor = (index) => {
    const floor = floors.value[index];
    selectedFloorKeys.value = selectedFloorKeys.value.filter(key => key !== String(floor.index));
    floors.value.splice(index, 1);

    // English comment.
    expandedFloors.value = expandedFloors.value
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i);

    queueOrSaveFloorConfig();
    toast.success(`已删除第 ${floor.index} 层`);
};

/**
 * English comment.
 */
const updateFloorIndex = (index, newValue) => {
    const oldValue = String(floors.value[index].index);
    floors.value[index].index = newValue;
    const selectedIndex = selectedFloorKeys.value.indexOf(oldValue);
    if (selectedIndex > -1) {
        selectedFloorKeys.value.splice(selectedIndex, 1, String(newValue));
    }
    queueOrSaveFloorConfig();
};

/**
 * English comment.
 */
const updateFloorAnimate = (index, value) => {
    floors.value[index].animate = value;
    queueOrSaveFloorConfig();
};

/**
 * English comment.
 */
const toggleFloorAnimate = (index) => {
    floors.value[index].animate = !floors.value[index].animate;
    queueOrSaveFloorConfig();
};

/**
 * English comment.
 */
const toggleFloorExpand = (index) => {
    const expandIndex = expandedFloors.value.indexOf(index);
    if (expandIndex > -1) {
        expandedFloors.value.splice(expandIndex, 1);
    } else {
        expandedFloors.value.push(index);
    }
};

/**
 * English comment.
 */
const moveFloor = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= floors.value.length) return;

    // English comment.
    const temp = floors.value[index];
    floors.value[index] = floors.value[newIndex];
    floors.value[newIndex] = temp;

    // English comment.
    const wasExpanded = expandedFloors.value.includes(index);
    const targetWasExpanded = expandedFloors.value.includes(newIndex);

    if (wasExpanded || targetWasExpanded) {
        // English comment.
        const newExpandedFloors = expandedFloors.value.filter(i => i !== index && i !== newIndex);
        if (wasExpanded) newExpandedFloors.push(newIndex);
        if (targetWasExpanded) newExpandedFloors.push(index);
        expandedFloors.value = newExpandedFloors;
    }

    queueOrSaveFloorConfig();
    toast.success('楼层已' + (direction < 0 ? '上移' : '下移'));
};


/**
 * English comment.
 */
const isNodeSelected = (floor, nodeName) => {
    return Array.isArray(floor.meshes) && floor.meshes.includes(nodeName);
};

/**
 * English comment.
 */
const toggleNodeInFloor = (floorIndex, nodeName) => {
    const floor = floors.value[floorIndex];
    if (!Array.isArray(floor.meshes)) {
        floor.meshes = [];
    }

    const selectedIndex = floor.meshes.indexOf(nodeName);
    if (selectedIndex > -1) {
        floor.meshes.splice(selectedIndex, 1);
    } else {
        floor.meshes.push(nodeName);
    }
    queueOrSaveFloorConfig();
};


/**
 * English comment.
 */
const toggleExplode = () => {
    const instance = component.value?.instance;
    if (!instance) {
        toast.error('组件实例未就绪');
        return;
    }

    if (isExploded.value) {
        instance.reset();
        isExploded.value = false;
    } else {
        instance.start();
        isExploded.value = true;
    }
};

/**
 * English comment.
 */
const selectFloor = (floorIndex) => {
    const instance = component.value?.instance;
    if (!instance) return;

    if (selectedFloorIndex.value === floorIndex) {
        instance.deselectFloor();
        selectedFloorIndex.value = null;
    } else {
        instance.selectFloor(floorIndex);
        selectedFloorIndex.value = floorIndex;
    }
};

/**
 * English comment.
 */
const deselectFloor = () => {
    const instance = component.value?.instance;
    if (!instance) return;

    instance.deselectFloor();
    selectedFloorIndex.value = null;
};

/**
 * English comment.
 */
const getLoaderTreeNodes = (loaderId) => {
    if (loaderTreeCache.has(loaderId)) {
        return loaderTreeCache.get(loaderId);
    }

    const loader = componentStore.components.find((c) => c.id === loaderId);
    if (!loader || !loader.instance) {
        return [];
    }

    const instance = loader.instance;
    const isValidNodeName = (name) => {
        return !!name && !name.startsWith('__') && !name.startsWith('Unnamed');
    };

    const getRootObjects = () => {
        if (instance.model && Array.isArray(instance.model.children)) {
            return instance.model.children;
        }
        if (instance.componentScene && Array.isArray(instance.componentScene.children)) {
            return instance.componentScene.children;
        }
        return [];
    };

    const buildTree = (object) => {
        const children = Array.isArray(object.children)
            ? object.children
                .map(child => buildTree(child))
                .flat()
            : [];

        if (!isValidNodeName(object.name)) {
            return children;
        }

        return [{
            name: object.name,
            type: object.type,
            children
        }];
    };

    const roots = getRootObjects();
    const tree = roots.map(root => buildTree(root)).flat();

    if (tree.length > 0) {
        loaderTreeCache.set(loaderId, tree);
        return tree;
    }

    // English comment.
    if (typeof instance.getAllMeshes === 'function') {
        const meshRows = [];
        const allMeshes = instance.getAllMeshes();
        allMeshes.forEach(mesh => {
            if (isValidNodeName(mesh.name)) {
                meshRows.push({ name: mesh.name, type: 'Mesh', children: [] });
            }
        });
        loaderTreeCache.set(loaderId, meshRows);
        return meshRows;
    }
    return [];
};

/**
 * English comment.
 */
const reverseFloorOrder = () => {
    if (floors.value.length < 2) return;
    floors.value = [...floors.value].reverse();
    // English comment.
    const len = floors.value.length;
    expandedFloors.value = expandedFloors.value.map(i => len - 1 - i);
    queueOrSaveFloorConfig();
    toast.success('楼层顺序已反向');
};

/**
 * English comment.
 */
const isFloorValid = (floor) => {
    return floor.meshes && floor.meshes.length > 0;
};
</script>

<style scoped>
.exploded-view-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* English comment. */
.action-buttons {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
}

/* English comment. */
.section {
    border-top: 1px solid var(--color-border);
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
}

.section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

.config-overview {
    padding: 0.75rem;
}

.config-status {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    background: rgba(16, 185, 129, 0.12);
    border-radius: var(--border-radius-sm);
    color: #10b981;
}

/* English comment. */
.empty-state {
    padding: 1.25rem;
    text-align: center;
}

.empty-text {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.25rem;
}

.empty-hint {
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
}

/* English comment. */
.floor-list {
    max-height: 300px;
    overflow-y: auto;
}

.config-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.config-modal {
    width: min(860px, 92vw);
    max-height: 86vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-elevated, #1a2332);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.modal-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.dirty-tag {
    font-size: 0.6875rem;
    color: var(--color-warning, #f59e0b);
}

.saved-tag {
    font-size: 0.6875rem;
    color: var(--color-success, #10b981);
}

.save-time {
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
}

.modal-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--color-border);
}

.config-modal .floor-list {
    max-height: calc(86vh - 130px);
}

.floor-item {
    border-bottom: 1px solid var(--color-border);
    transition: all var(--transition-fast);
}

.floor-item:last-child {
    border-bottom: none;
}

.floor-item.selected {
    background: var(--color-primary-light, rgba(99,102,241,0.1));
}

.floor-item.no-animate {
    opacity: 0.7;
}

.floor-header {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
}

.order-controls {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.floor-select-checkbox {
    width: 0.875rem;
    height: 0.875rem;
    accent-color: var(--color-primary);
    cursor: pointer;
    margin-bottom: 0.125rem;
}

.btn-order {
    width: 1.25rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 2px;
    color: var(--color-text-tertiary);
    font-size: 0.5rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    padding: 0;
    line-height: 1;
}

.btn-order svg {
    width: 0.75rem;
    height: 0.75rem;
}

.btn-order:hover:not(:disabled) {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
}

.btn-order:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.floor-index {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm);
    transition: background-color var(--transition-fast);
}

.floor-index:hover {
    background: var(--color-bg-hover);
}

.floor-actions {
    display: flex;
    gap: 0.25rem;
}

/* English comment. */
.btn-floor-toggle {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.625rem;
    cursor: pointer;
    transition: background-color var(--transition-fast);
}

.btn-floor-toggle svg {
    width: 0.875rem;
    height: 0.875rem;
}

.btn-floor-toggle:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.btn-floor-toggle.muted {
    color: var(--color-text-tertiary);
}

.btn-floor-delete {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-tertiary);
    font-size: 0.625rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-floor-delete svg {
    width: 0.75rem;
    height: 0.75rem;
}

.btn-floor-delete:hover {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
}

/* English comment. */
.floor-details {
    padding: 0.75rem;
    background: var(--color-bg-tertiary);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.form-field label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.form-field-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.form-field-inline label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.checkbox {
    width: 1rem;
    height: 1rem;
    accent-color: var(--color-primary);
    cursor: pointer;
}

/* English comment. */
.validation-warning {
    padding: 0.5rem 0.75rem;
    background: rgba(245, 158, 11, 0.08);
    border-radius: var(--border-radius-sm);
    margin-top: 0.25rem;
}

.warning-text {
    font-size: 0.6875rem;
    color: var(--color-warning, #f59e0b);
}

.mesh-tree-picker {
    max-height: 220px;
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-secondary);
}

.mesh-tree-search {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.mesh-tree-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.75rem;
    color: var(--color-text-primary);
}

.mesh-tree-item:last-child {
    border-bottom: none;
}

.tree-marker {
    width: 0.75rem;
    color: var(--color-text-tertiary);
    text-align: center;
}

.tree-expand-btn {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 2px;
    background: var(--color-bg-elevated);
    color: var(--color-text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    line-height: 1;
    padding: 0;
}

.tree-expand-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.tree-expand-placeholder {
    width: 1rem;
    height: 1rem;
    display: inline-block;
}

.tree-name {
    flex: 1;
    min-width: 0;
    word-break: break-all;
}

.mesh-tree-empty {
    padding: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    text-align: center;
}

.tree-top-tag {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-elevated);
    color: var(--color-text-tertiary);
}

/* English comment. */
.model-selector {
    margin-bottom: 0.5rem;
}

.model-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    min-height: 1.5rem;
}

.model-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-primary);
    color: white;
    border-radius: var(--border-radius-sm);
    font-size: 0.6875rem;
    font-weight: 500;
}

.tag-remove {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1;
    padding: 0;
    margin-left: 0.125rem;
}

.tag-remove:hover {
    color: white;
}

.no-models {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    font-style: italic;
}

/* English comment. */
.model-list {
    max-height: 200px;
    overflow-y: auto;
}

.model-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.model-item:last-child {
    border-bottom: none;
}

.model-item:hover {
    background: var(--color-bg-hover);
}

.model-item.assigned {
    opacity: 0.6;
}

.model-name {
    font-size: 0.8125rem;
    color: var(--color-text-primary);
}

.assigned-badge {
    font-size: 0.6875rem;
    padding: 0.125rem 0.375rem;
    background: var(--color-primary);
    color: white;
    border-radius: var(--border-radius-sm);
}

.no-loaders {
    padding: 0.75rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

/* English comment. */
.selected-loader-info {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0;
    margin-bottom: 0.5rem;
}

.selected-loader-info .loader-name {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

/* English comment. */
.loaders-config {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.loader-config {
    padding: 0.75rem;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
}

.loader-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
}

.loader-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}





.mesh-tree {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
}

.mesh-tree .empty-hint {
    padding: 0.5rem;
    text-align: center;
    font-style: italic;
}

.mesh-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
}

.mesh-name {
    font-size: 0.8125rem;
    color: var(--color-text-primary);
}

.btn-remove-mesh {
    padding: 0.125rem 0.375rem;
    background: transparent;
    border: none;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    cursor: pointer;
    border-radius: var(--border-radius-sm);
    transition: all 0.2s;
}

.btn-remove-mesh:hover {
    background: rgba(255, 100, 100, 0.2);
    color: var(--color-error);
}

.no-meshes {
    padding: 0.5rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    font-style: italic;
}

/* English comment. */
.model-association {
    padding: 0.75rem;
}

.loader-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.loader-card {
    padding: 0.75rem;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.loader-card:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-primary);
}

.loader-card.selected {
    background: rgba(0, 212, 255, 0.1);
    border-color: var(--color-primary);
}

.loader-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.loader-icon {
    font-size: 1.5rem;
}

.loader-details {
    flex: 1;
}

.loader-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 0.25rem;
}

.loader-id {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    font-family: monospace;
}

.loader-meshes {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
}

.meshes-header {
    display: flex;
    align-items: center;
    margin-bottom: 0.375rem;
}

.meshes-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.meshes-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    max-height: 200px;
    overflow-y: auto;
}

.mesh-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.375rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    font-family: monospace;
}

/* English comment. */
.loader-select-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.loader-selector-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

.loader-selector-row > :first-child {
    flex: 1;
    min-width: 0;
}

.selected-loader-panel {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: 0.5rem 0.75rem;
}

.no-selection-hint {
    padding: 0.375rem 0;
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
    text-align: center;
}
</style>
