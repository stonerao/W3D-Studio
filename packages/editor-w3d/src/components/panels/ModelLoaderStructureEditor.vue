<template>
    <div class="model-loader-structure-editor">
        <div v-if="!modelInstance" class="empty-state">模型未加载，无法展示结构树。</div>
        <div v-else class="panel-content">
            <div class="section-label section-label--with-action">
                <span>模型结构</span>
                <Button variant="outline" size="sm" @click="showStructureModal = true">弹窗展示</Button>
            </div>

            <div class="toolbar-stack">
                <div class="toolbar-row toolbar-row--single">
                    <Input
                        :model-value="searchQuery"
                        placeholder="搜索 Mesh / Group"
                        @update:model-value="searchQuery = String($event || '')"
                    />
                </div>
                <div class="toolbar-row toolbar-row--double">
                    <Button variant="outline" size="sm" @click="expandAllNodes">全部展开</Button>
                    <Button variant="outline" size="sm" @click="collapseAllNodes">全部收起</Button>
                </div>
                <div class="toolbar-row toolbar-row--double">
                    <Button variant="outline" size="sm" @click="setAllMeshVisibility(true)">全部显示</Button>
                    <Button variant="outline" size="sm" @click="setAllMeshVisibility(false)">全部隐藏</Button>
                </div>
            </div>

            <div class="summary-row">
                <span>{{ meshInfoList.length }} 个 Mesh</span>
                <span>当前显示 {{ visibleMeshNames.length }} 个</span>
            </div>

            <div class="selection-row">
                <span class="selection-row__label">当前选中</span>
                <span class="selection-row__value">{{ activeNodeLabel }}</span>
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="!canIsolateSelected"
                    @click="hideOtherMeshes"
                >
                    隐藏其他物体
                </Button>
            </div>

            <div v-if="structureTree.length === 0" class="empty-hint">当前模型没有可展示的节点。</div>
            <div v-else class="tree-panel">
                <MeshTreeNode
                    v-for="node in structureTree"
                    :key="node.id"
                    :node="node"
                    :level="0"
                    :selected-meshes="selectionKeys"
                    :expanded="expandedNodes.has(node.id)"
                    :expanded-nodes="expandedNodes"
                    :search-query="searchQuery"
                    :active-node-name="activeNodeName"
                    @toggle="handleTreeToggle"
                    @click-node="handleNodeClick"
                />
            </div>
        </div>

        <Modal
            v-model="showStructureModal"
            title="模型结构展示控制"
            width="650px"
        >
            <div class="structure-modal-content">
                <div class="toolbar-stack structure-modal-toolbar">
                    <div class="toolbar-row toolbar-row--single">
                        <Input
                            :model-value="searchQuery"
                            placeholder="搜索 Mesh / Group"
                            @update:model-value="searchQuery = String($event || '')"
                        />
                    </div>
                    <div class="toolbar-row toolbar-row--double">
                        <Button variant="outline" size="sm" @click="expandAllNodes">全部展开</Button>
                        <Button variant="outline" size="sm" @click="collapseAllNodes">全部收起</Button>
                    </div>
                    <div class="toolbar-row toolbar-row--double">
                        <Button variant="outline" size="sm" @click="setAllMeshVisibility(true)">全部显示</Button>
                        <Button variant="outline" size="sm" @click="setAllMeshVisibility(false)">全部隐藏</Button>
                    </div>
                </div>

                <div class="summary-row structure-modal-summary">
                    <span>{{ meshInfoList.length }} 个 Mesh</span>
                    <span>当前显示 {{ visibleMeshNames.length }} 个</span>
                </div>

                <div class="selection-row structure-modal-selection">
                    <span class="selection-row__label">当前选中</span>
                    <span class="selection-row__value">{{ activeNodeLabel }}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="!canIsolateSelected"
                        @click="hideOtherMeshes"
                    >
                        隐藏其他物体
                    </Button>
                </div>

                <div v-if="structureTree.length === 0" class="empty-hint">当前模型没有可展示的节点。</div>
                <div v-else class="tree-panel tree-panel--modal">
                    <MeshTreeNode
                        v-for="node in structureTree"
                        :key="`modal-${node.id}`"
                        :node="node"
                        :level="0"
                        :selected-meshes="selectionKeys"
                        :expanded="expandedNodes.has(node.id)"
                        :expanded-nodes="expandedNodes"
                        :search-query="searchQuery"
                        :active-node-name="activeNodeName"
                        @toggle="handleTreeToggle"
                        @click-node="handleNodeClick"
                    />
                </div>
            </div>
        </Modal>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Input from '../ui/Input.vue';
import Button from '../ui/Button.vue';
import Modal from '../ui/Modal.vue';
import MeshTreeNode from './MeshTreeNode.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();

const searchQuery = ref('');
const expandedNodes = ref(new Set());
const activeNodeName = ref('');
const meshInfoList = ref([]);
const showStructureModal = ref(false);

const component = computed(() => componentStore.components.find((item) => item.id === props.componentId) || null);
const modelInstance = computed(() => component.value?.instance || null);

const refreshMeshInfo = () => {
    meshInfoList.value = modelInstance.value?.getMeshesInfo?.() || [];
};

const visibleMeshSet = computed(() => new Set(
    meshInfoList.value
        .filter((item) => item?.name && item.visible !== false)
        .map((item) => item.name)
));

const visibleMeshNames = computed(() => [...visibleMeshSet.value]);

const isValidNodeName = (name = '') => {
    const text = String(name || '').trim();
    return !!text && !text.startsWith('__') && !text.startsWith('Unnamed');
};

const buildNodeTree = (object, path = 'root') => {
    const children = Array.isArray(object?.children)
        ? object.children.flatMap((child, index) => buildNodeTree(child, `${path}/${child.name || child.uuid || index}`))
        : [];

    const isMesh = object?.isMesh === true;
    const meshNames = isMesh && isValidNodeName(object?.name)
        ? [object.name]
        : children.flatMap((child) => child.meshNames || []);

    if (!isMesh && !isValidNodeName(object?.name)) {
        return children;
    }

    return [{
        id: `node:${path}`,
        name: object?.name || object?.uuid || 'Unnamed',
        type: object?.type || 'Object3D',
        isMesh,
        children,
        meshNames: [...new Set(meshNames)]
    }];
};

const structureTree = computed(() => {
    const model = modelInstance.value?.getModel?.() || modelInstance.value?.model || null;
    const roots = Array.isArray(model?.children) ? model.children : [];
    const tree = roots.flatMap((child, index) => buildNodeTree(child, `${child.name || child.uuid || index}`));

    if (tree.length > 0) {
        return tree;
    }

    return meshInfoList.value
        .filter((item) => isValidNodeName(item?.name))
        .map((item, index) => ({
            id: `node:fallback/${item.name}/${index}`,
            name: item.name,
            type: 'Mesh',
            isMesh: true,
            children: [],
            meshNames: [item.name]
        }));
});

const collectAllNodeIds = (nodes = []) => {
    const ids = [];
    nodes.forEach((node) => {
        ids.push(node.id);
        if (Array.isArray(node.children) && node.children.length > 0) {
            ids.push(...collectAllNodeIds(node.children));
        }
    });
    return ids;
};

const collectSelectionKeys = (nodes = [], visibleNames = new Set()) => {
    const keys = [];

    nodes.forEach((node) => {
        const childKeys = collectSelectionKeys(node.children || [], visibleNames);
        const meshNames = Array.isArray(node.meshNames) ? node.meshNames : [];
        const allVisible = meshNames.length > 0 && meshNames.every((name) => visibleNames.has(name));

        if (allVisible) {
            keys.push(node.name);
        }

        keys.push(...childKeys);
    });

    return keys;
};

const selectionKeys = computed(() => collectSelectionKeys(structureTree.value, visibleMeshSet.value));

const findNodeByName = (nodes, name) => {
    for (const node of nodes) {
        if (node.name === name) {
            return node;
        }
        if (node.children?.length) {
            const match = findNodeByName(node.children, name);
            if (match) return match;
        }
    }
    return null;
};

const activeNode = computed(() => {
    if (!activeNodeName.value) return null;
    return findNodeByName(structureTree.value, activeNodeName.value);
});

const activeNodeLabel = computed(() => activeNode.value?.name || '未选中');
const canIsolateSelected = computed(() => {
    return Array.isArray(activeNode.value?.meshNames) && activeNode.value.meshNames.length > 0;
});

const expandAllNodes = () => {
    expandedNodes.value = new Set(collectAllNodeIds(structureTree.value));
};

const collapseAllNodes = () => {
    expandedNodes.value = new Set();
};

const persistMeshVisibility = async (meshNames, visible) => {
    if (!Array.isArray(meshNames) || meshNames.length === 0) return;

    const nextMeshConfig = {};
    meshNames.forEach((meshName) => {
        if (!meshName) return;
        modelInstance.value?.setMeshVisibility?.(meshName, visible);
        nextMeshConfig[meshName] = {
            ...(component.value?.config?.mesh?.[meshName] || {}),
            name: meshName,
            visible
        };
    });

    await updateComponentConfig(props.componentId, {
        mesh: nextMeshConfig
    });

    refreshMeshInfo();
};

const setAllMeshVisibility = async (visible) => {
    const meshNames = meshInfoList.value.map((item) => item.name).filter(Boolean);
    await persistMeshVisibility(meshNames, visible);
};

const hideOtherMeshes = async () => {
    const keepVisible = new Set(activeNode.value?.meshNames || []);
    if (keepVisible.size === 0) return;

    const allMeshNames = meshInfoList.value.map((item) => item.name).filter(Boolean);
    const nextMeshConfig = {};

    allMeshNames.forEach((meshName) => {
        const visible = keepVisible.has(meshName);
        if (visible) {
            modelInstance.value?.setMeshVisibility?.(meshName, true);
        } else {
            modelInstance.value?.setMeshVisibility?.(meshName, false);
        }
        nextMeshConfig[meshName] = {
            ...(component.value?.config?.mesh?.[meshName] || {}),
            name: meshName,
            visible
        };
    });

    if (keepVisible.size === 1) {
        modelInstance.value?.isolateMesh?.([...keepVisible][0]);
    } else {
        modelInstance.value?.showAllMeshes?.();
        allMeshNames.forEach((meshName) => {
            modelInstance.value?.setMeshVisibility?.(meshName, keepVisible.has(meshName));
        });
    }

    await updateComponentConfig(props.componentId, {
        mesh: nextMeshConfig
    });

    refreshMeshInfo();
};

const handleTreeToggle = async (token) => {
    const nodeId = String(token || '');
    if (nodeId.startsWith('node:')) {
        const next = new Set(expandedNodes.value);
        if (next.has(nodeId)) {
            next.delete(nodeId);
        } else {
            next.add(nodeId);
        }
        expandedNodes.value = next;
        return;
    }

    const targetNode = findNodeByName(structureTree.value, nodeId);
    if (!targetNode) return;

    const meshNames = Array.isArray(targetNode.meshNames) ? targetNode.meshNames.filter(Boolean) : [];
    if (meshNames.length === 0) return;

    const shouldShow = !meshNames.every((name) => visibleMeshSet.value.has(name));
    await persistMeshVisibility(meshNames, shouldShow);
};

const handleNodeClick = (node) => {
    activeNodeName.value = String(node?.name || '');
};

watch(modelInstance, () => {
    refreshMeshInfo();
}, { immediate: true });

watch(() => component.value?.config?.mesh, () => {
    refreshMeshInfo();
}, { deep: true });

watch(structureTree, (value) => {
    expandedNodes.value = new Set(collectAllNodeIds(value));
    if (activeNodeName.value && !findNodeByName(value, activeNodeName.value)) {
        activeNodeName.value = '';
    }
}, { immediate: true });
</script>

<style scoped>
.model-loader-structure-editor {
    display: flex;
    flex-direction: column;
}

.panel-content {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
}

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
}

.section-label--with-action {
    justify-content: space-between;
}

.toolbar-stack {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.75rem;
}

.toolbar-row {
    display: grid;
    gap: 0.375rem;
}

.toolbar-row--single {
    grid-template-columns: minmax(0, 1fr);
}

.toolbar-row--double {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.summary-row,
.selection-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.75rem 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.summary-row {
    justify-content: space-between;
}

.selection-row {
    flex-wrap: wrap;
}

.selection-row__label {
    color: var(--color-text-tertiary);
}

.selection-row__value {
    flex: 1;
    min-width: 0;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tree-panel {
    margin: 0 0.75rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    background: var(--color-bg-tertiary);
    max-height: 26rem;
    overflow: auto;
}

.structure-modal-content {
    height: 800px;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.structure-modal-toolbar {
    padding: 0 0 0.75rem;
}

.structure-modal-summary,
.structure-modal-selection {
    padding-left: 0;
    padding-right: 0;
}

.tree-panel--modal {
    margin: 0;
    max-height: none;
    flex: 1;
    min-height: 0;
}

.empty-state,
.empty-hint {
    padding: 1rem 0.75rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
}

@media (max-width: 960px) {
    .toolbar-row--double {
        grid-template-columns: 1fr;
    }

    .summary-row {
        flex-direction: column;
        align-items: flex-start;
    }

    .selection-row__value {
        flex-basis: 100%;
        white-space: normal;
    }
}
</style>
