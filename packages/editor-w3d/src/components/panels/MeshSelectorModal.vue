<template>
    <div v-if="modelValue" class="mesh-selector-modal-overlay" @click="handleOverlayClick">
        <div class="mesh-selector-modal" @click.stop>
            <!-- 标题栏 -->
            <div class="modal-header">
                <h3>选择 Mesh / Group</h3>
                <button class="btn-close" @click="close">
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M12 4L4 12M4 4L12 12"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>

            <!-- 搜索栏 -->
            <div class="modal-toolbar">
                <input
                    v-model="searchQuery"
                    type="text"
                    class="search-input"
                    placeholder="搜索 Mesh 或 Group..."
                />
                <button class="btn-select-all" @click="selectAll">全选</button>
                <button class="btn-deselect-all" @click="deselectAll">清空</button>
            </div>

            <!-- Mesh 树 -->
            <div class="modal-content">
                <div v-if="loading" class="loading">加载中...</div>
                <div v-else-if="meshTree.length === 0" class="empty">未找到任何 Mesh</div>
                <div v-else class="mesh-tree">
                    <MeshTreeNode
                        v-for="node in filteredTree"
                        :key="node.id"
                        :node="node"
                        :selected-meshes="localSelectedMeshes"
                        @toggle="toggleMesh"
                    />
                </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="modal-footer">
                <span class="selected-count">已选: {{ localSelectedMeshes.length }}</span>
                <div class="footer-buttons">
                    <button class="btn-cancel" @click="close">取消</button>
                    <button class="btn-confirm" @click="confirm">确定</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import MeshTreeNode from './MeshTreeNode.vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    modelLoaderId: {
        type: String,
        default: ''
    },
    selectedMeshes: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:modelValue', 'select']);

const componentStore = useComponentStore();
const loading = ref(false);
const meshTree = ref([]);
const searchQuery = ref('');
const localSelectedMeshes = ref([]);

// 过滤后的树
const filteredTree = computed(() => {
    if (!searchQuery.value) return meshTree.value;

    const query = searchQuery.value.toLowerCase();
    return filterTree(meshTree.value, query);
});

/**
 * 递归过滤树
 */
function filterTree(nodes, query) {
    return nodes
        .map((node) => {
            const matchesName = node.name.toLowerCase().includes(query);
            const filteredChildren = node.children ? filterTree(node.children, query) : [];

            if (matchesName || filteredChildren.length > 0) {
                return {
                    ...node,
                    children: filteredChildren
                };
            }
            return null;
        })
        .filter((node) => node !== null);
}

/**
 * 构建 Mesh 树
 */
function buildMeshTree() {
    loading.value = true;
    meshTree.value = [];

    if (!props.modelLoaderId) {
        console.warn('[MeshSelectorModal] 未指定 ModelLoader ID');
        loading.value = false;
        return;
    }

    try {
        const componentData = componentStore.components.find((c) => c.id === props.modelLoaderId);
        if (!componentData || !componentData.instance) {
            console.error('[MeshSelectorModal] ModelLoader 组件实例未找到:', props.modelLoaderId);
            loading.value = false;
            return;
        }

        const instance = componentData.instance;
        console.log('[MeshSelectorModal] ModelLoader 实例:', instance);

        let rootObjects = [];

        // 尝试多种方式获取根对象
        // 方式 1: 从 model 属性
        if (instance.model) {
            console.log('[MeshSelectorModal] 从 model 属性获取对象');
            rootObjects = [instance.model];
        }
        // 方式 2: 从 componentScene
        else if (instance.componentScene?.children && instance.componentScene.children.length > 0) {
            console.log('[MeshSelectorModal] 从 componentScene 获取对象');
            rootObjects = instance.componentScene.children;
        }
        // 方式 3: 从 getAllMeshes
        else if (typeof instance.getAllMeshes === 'function') {
            console.log('[MeshSelectorModal] 从 getAllMeshes 方法获取对象');
            const allMeshes = instance.getAllMeshes();
            // 将 mesh 对象包装成树节点
            meshTree.value = allMeshes.map((mesh, index) => ({
                id: `mesh-${index}`,
                name: mesh.name || 'Unnamed',
                type: 'Mesh',
                isMesh: true,
                children: []
            }));
            loading.value = false;
            console.log('[MeshSelectorModal] 构建完成，总节点数:', meshTree.value.length);
            return;
        }

        if (rootObjects.length === 0) {
            console.warn('[MeshSelectorModal] 未找到可用的对象');
            loading.value = false;
            return;
        }

        let idCounter = 0;
        const buildNode = (object) => {
            const node = {
                id: `mesh-${idCounter++}`,
                name: object.name || `Unnamed-${object.type}`,
                type: object.type,
                isMesh: object.isMesh || false,
                children: []
            };

            // 递归处理子对象
            if (object.children && object.children.length > 0) {
                object.children.forEach((child) => {
                    // 过滤掉内部辅助对象
                    if (
                        child
                    ) {
                        node.children.push(buildNode(child));
                    }
                });
            }

            return node;
        };

        rootObjects.forEach((obj) => {
            if (
                obj
            ) {
                meshTree.value.push(buildNode(obj));
            }
        });

        console.log('[MeshSelectorModal] rootObjects', rootObjects);
        console.log('[MeshSelectorModal] 构建完成，总节点数:', meshTree.value.length);
    } catch (error) {
        console.error('[MeshSelectorModal] 构建 Mesh 树失败:', error);
    } finally {
        loading.value = false;
    }
}

/**
 * 切换 Mesh 选择
 */
function toggleMesh(meshName) {
    const index = localSelectedMeshes.value.indexOf(meshName);
    if (index > -1) {
        localSelectedMeshes.value.splice(index, 1);
    } else {
        localSelectedMeshes.value.push(meshName);
    }
}

/**
 * 全选
 */
function selectAll() {
    const allMeshNames = [];
    const collectMeshes = (nodes) => {
        nodes.forEach((node) => {
            // 收集 Mesh 和 Group 节点
            if ((node.isMesh || node.type === 'Group') && node.name && !node.name.startsWith('Unnamed')) {
                allMeshNames.push(node.name);
            }
            if (node.children && node.children.length > 0) {
                collectMeshes(node.children);
            }
        });
    };
    console.log('[MeshSelectorModal] 全选，包含 Mesh 和 Group 节点');
    collectMeshes(filteredTree.value);
    localSelectedMeshes.value = [...new Set(allMeshNames)];
}

/**
 * 清空
 */
function deselectAll() {
    localSelectedMeshes.value = [];
}

/**
 * 确认选择
 */
function confirm() {
    emit('select', [...localSelectedMeshes.value]);
    emit('update:modelValue', false);
}

/**
 * 关闭模态框
 */
function close() {
    emit('update:modelValue', false);
}

/**
 * 点击遮罩层关闭
 */
function handleOverlayClick() {
    close();
}

// 监听打开状态,重新构建树
watch(
    () => props.modelValue,
    (newVal) => {
        if (newVal) {
            localSelectedMeshes.value = [...props.selectedMeshes];
            buildMeshTree();
        } else {
            searchQuery.value = '';
        }
    }
);
</script>

<style scoped>
.mesh-selector-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.mesh-selector-modal {
    background: rgba(2, 23, 38, 0.911);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.btn-close {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: var(--border-radius-sm);
    transition: all 0.2s;
}

.btn-close:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.modal-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border);
}

.search-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
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

.btn-select-all,
.btn-deselect-all {
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-select-all:hover,
.btn-deselect-all:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    border-color: var(--color-primary);
}

.modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
}

.loading,
.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

.mesh-tree {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-border);
}

.selected-count {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

.footer-buttons {
    display: flex;
    gap: 0.5rem;
}

.btn-cancel,
.btn-confirm {

    background: #17253c;
    padding: 0.5rem 1.5rem;
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

.btn-confirm {
    color: white;
    border-color: var(--color-primary);
}

.btn-confirm:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
}
</style>
