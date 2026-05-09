<template>
    <div class="device-exploded-view-editor">
        <div class="action-buttons">
            <Button variant="outline" size="sm" :disabled="selectedNodeCount === 0" @click="startExplosion">爆炸</Button>
            <Button variant="outline" size="sm" @click="resetExplosion">重置</Button>
            <Button variant="outline" size="sm" :disabled="!selectedLoaderId" @click="refreshTree">刷新结构</Button>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-title">关联模型</span>
            </div>
            <div v-if="modelLoaderOptions.length === 0" class="empty-state small">
                <div class="empty-text">场景中没有 ModelLoader 组件</div>
                <div class="empty-hint">请先添加模型加载器组件</div>
            </div>
            <div v-else class="loader-selector-row">
                <Select
                    :model-value="selectedLoaderId"
                    :options="modelLoaderOptions"
                    placeholder="请选择 ModelLoader 组件"
                    @update:model-value="handleLoaderChange"
                />
                <Button v-if="selectedLoaderId" variant="outline" size="sm" @click="handleLoaderChange('')">取消</Button>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-title">节点选择</span>
                <span class="section-meta">{{ selectionSummary }}</span>
            </div>

            <div v-if="!selectedLoaderId" class="empty-hint">请先绑定模型，再选择参与爆炸的节点。</div>
            <div v-else-if="selectionMode !== 'custom'" class="empty-hint">
                <span v-if="selectionMode === 'level'">当前按“爆炸层级”自动选择节点。</span>
                <span v-else>当前按叶子节点自动选择，无需手动勾选。</span>
            </div>
            <template v-else>
                <div class="tree-toolbar">
                    <Button variant="outline" size="sm" @click="expandAll">展开全部</Button>
                    <Button variant="outline" size="sm" @click="collapseAll">折叠全部</Button>
                    <Button variant="outline" size="sm" :disabled="selectedNodeKeys.length === 0" @click="clearNodeSelection">清空选择</Button>
                </div>

                <div v-if="treeRows.length === 0" class="empty-hint">当前模型没有可选树节点。</div>
                <div v-else class="tree-list">
                    <label
                        v-for="row in treeRows"
                        :key="row.key"
                        class="tree-item"
                        :style="{ paddingLeft: `${row.depth * 14}px` }"
                    >
                        <button
                            v-if="row.hasChildren"
                            type="button"
                            class="tree-expand-btn"
                            @click.stop="toggleExpand(row.key)"
                        >
                            {{ row.expanded ? '▾' : '▸' }}
                        </button>
                        <span v-else class="tree-expand-placeholder"></span>
                        <input
                            type="checkbox"
                            :checked="selectedKeySet.has(row.key)"
                            @change="toggleNodeSelection(row.key)"
                        >
                        <span class="tree-label">{{ row.label }}</span>
                        <span class="tree-type">{{ row.objectType }}</span>
                    </label>
                </div>
            </template>
        </div>

        <div v-if="summaryRows.length > 0" class="section">
            <div class="section-header">
                <span class="section-title">预估节点</span>
                <span class="section-meta">{{ summaryRows.length }} 个</span>
            </div>
            <div class="summary-list">
                <div v-for="item in summaryRows" :key="item.key" class="summary-item">
                    <span class="summary-label">{{ item.label }}</span>
                    <span class="summary-meta">深度 {{ item.depth }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import Button from '../ui/Button.vue';
import Select from '../ui/Select.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

const component = computed(() => componentStore.components.find((item) => item.id === props.componentId) || null);
const config = computed(() => component.value?.config || {});
const selectionMode = computed(() => String(config.value.selectionMode || 'level'));
const selectedLoaderId = computed(() => String(config.value.selectedLoaderId || '').trim());
const selectedNodeKeys = computed(() => Array.isArray(config.value.selectedNodeKeys) ? config.value.selectedNodeKeys : []);
const selectedKeySet = computed(() => new Set(selectedNodeKeys.value.map((item) => String(item || '').trim()).filter(Boolean)));

const treeRoots = ref([]);
const expandedKeys = ref(new Set());

const getComponentCallableId = (target) => {
    return String(target?.config?.id || target?.instance?.config?.id || target?.id || '').trim();
};

const modelLoaderComponents = computed(() => {
    return componentStore.components.filter((item) => item?.type === 'ModelLoader');
});

const modelLoaderOptions = computed(() => {
    return modelLoaderComponents.value.map((loader) => ({
        value: getComponentCallableId(loader),
        label: `${loader.name || 'ModelLoader'} (${loader.id})`
    }));
});

const getNodeLabel = (object, index) => {
    const name = String(object?.name || '').trim();
    if (name) return name;
    return `${object?.type || 'Node'}_${index}`;
};

const buildTree = (roots = []) => {
    const walk = (object, pathParts = [], depth = 1) => ({
        key: pathParts.join('/'),
        label: getNodeLabel(object, pathParts[pathParts.length - 1] ?? 0),
        depth,
        objectType: object?.type || 'Object3D',
        object,
        children: (Array.isArray(object?.children) ? object.children : []).map((child, index) => walk(child, [...pathParts, index], depth + 1))
    });

    return roots.map((root, index) => walk(root, [index], 1));
};

const collectAllKeys = (nodes = [], target = []) => {
    nodes.forEach((node) => {
        target.push(node.key);
        collectAllKeys(node.children, target);
    });
    return target;
};

const flattenNodes = (nodes = [], target = []) => {
    nodes.forEach((node) => {
        target.push(node);
        flattenNodes(node.children, target);
    });
    return target;
};

const getLoaderInstance = () => {
    if (!selectedLoaderId.value) return null;
    return modelLoaderComponents.value.find((loader) => {
        return getComponentCallableId(loader) === selectedLoaderId.value;
    })?.instance || null;
};

const refreshTree = () => {
    const instance = getLoaderInstance();
    if (!instance) {
        treeRoots.value = [];
        expandedKeys.value = new Set();
        return;
    }

    const roots = Array.isArray(instance.model?.children)
        ? instance.model.children
        : (Array.isArray(instance.componentScene?.children) ? instance.componentScene.children : []);

    treeRoots.value = buildTree(roots);
    expandedKeys.value = new Set(collectAllKeys(treeRoots.value));
};

const treeRows = computed(() => {
    const rows = [];
    const walk = (nodes) => {
        nodes.forEach((node) => {
            const expanded = expandedKeys.value.has(node.key);
            rows.push({
                key: node.key,
                label: node.label,
                depth: node.depth,
                objectType: node.objectType,
                hasChildren: node.children.length > 0,
                expanded
            });
            if (node.children.length > 0 && expanded) {
                walk(node.children);
            }
        });
    };
    walk(treeRoots.value);
    return rows;
});

const toggleExpand = (key) => {
    const next = new Set(expandedKeys.value);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }
    expandedKeys.value = next;
};

const dedupeCustomKeys = (keys = []) => {
    const sorted = [...new Set(keys.map((item) => String(item || '').trim()).filter(Boolean))].sort((a, b) => a.length - b.length);
    return sorted.filter((key, index) => {
        return !sorted.slice(0, index).some((ancestor) => key.startsWith(`${ancestor}/`));
    });
};

const toggleNodeSelection = async (key) => {
    const next = new Set(selectedKeySet.value);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }

    await updateComponentConfig(props.componentId, {
        selectedNodeKeys: dedupeCustomKeys(Array.from(next))
    });
};

const clearNodeSelection = async () => {
    await updateComponentConfig(props.componentId, {
        selectedNodeKeys: []
    });
};

const expandAll = () => {
    expandedKeys.value = new Set(collectAllKeys(treeRoots.value));
};

const collapseAll = () => {
    expandedKeys.value = new Set(treeRoots.value.map((node) => node.key));
};

const handleLoaderChange = async (value) => {
    await updateComponentConfig(props.componentId, {
        selectedLoaderId: String(value || '').trim(),
        selectedNodeKeys: []
    });
};

const resolvedNodes = computed(() => {
    const flat = flattenNodes(treeRoots.value);
    if (selectionMode.value === 'leaf') {
        return flat.filter((node) => node.children.length === 0);
    }
    if (selectionMode.value === 'custom') {
        const selected = dedupeCustomKeys(selectedNodeKeys.value);
        const map = new Map(flat.map((node) => [node.key, node]));
        return selected.map((key) => map.get(key)).filter(Boolean);
    }
    const targetDepth = Math.max(1, Number(config.value.explodeLevel) || 1);
    return flat.filter((node) => node.depth === targetDepth);
});

const selectedNodeCount = computed(() => resolvedNodes.value.length);
const selectionSummary = computed(() => {
    if (!selectedLoaderId.value) return '未绑定模型';
    if (selectionMode.value === 'custom') return `已选 ${selectedNodeCount.value} 个节点`;
    if (selectionMode.value === 'leaf') return `叶子节点 ${selectedNodeCount.value} 个`;
    return `层级 ${config.value.explodeLevel || 1}，共 ${selectedNodeCount.value} 个`;
});

const summaryRows = computed(() => {
    return resolvedNodes.value.slice(0, 12).map((node) => ({
        key: node.key,
        label: node.label,
        depth: node.depth
    }));
});

const startExplosion = () => {
    const instance = component.value?.instance;
    if (!instance?.start) {
        toast.error('设备爆炸图实例未就绪');
        return;
    }
    instance.start();
};

const resetExplosion = () => {
    const instance = component.value?.instance;
    if (!instance?.reset) {
        toast.error('设备爆炸图实例未就绪');
        return;
    }
    instance.reset();
};

watch(
    () => [selectedLoaderId.value, modelLoaderComponents.value.length],
    () => {
        refreshTree();
    },
    { immediate: true }
);
</script>

<style scoped>
.device-exploded-view-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
}

.section {
    border-top: 1px solid var(--color-border);
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
}

.section-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.section-meta {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.loader-selector-row,
.tree-toolbar {
    display: flex;
    gap: 0.5rem;
    padding: 0 0.75rem 0.75rem;
    flex-wrap: wrap;
}

.empty-state,
.empty-hint {
    padding: 0 0.75rem 0.75rem;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
}

.tree-list {
    max-height: 320px;
    overflow: auto;
    padding: 0 0.75rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.tree-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 30px;
    font-size: 0.75rem;
    color: var(--color-text-primary);
}

.tree-expand-btn,
.tree-expand-placeholder {
    width: 18px;
    flex: 0 0 18px;
    text-align: center;
}

.tree-expand-btn {
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
}

.tree-label {
    flex: 1;
    min-width: 0;
    word-break: break-all;
}

.tree-type {
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
}

.summary-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0 0.75rem 0.75rem;
}

.summary-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.75rem;
}

.summary-label {
    color: var(--color-text-primary);
}

.summary-meta {
    color: var(--color-text-secondary);
}
</style>
