<template>
    <div class="scene-tree">
        <!-- English comment. -->
        <div class="toolbar">
            <div class="toolbar-label">场景结构</div>
            <div class="toolbar-actions">
                <button class="tool-btn" @click="expandAll" title="展开全部">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                </button>
                <button class="tool-btn" @click="collapseAll" title="折叠全部">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        <path d="M9 13h6" />
                    </svg>
                </button>
                <button class="tool-btn tool-btn--danger" @click="clearAll" title="清空场景">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- English comment. -->
        <div class="tree-container">
            <div v-if="components.length === 0" class="empty-state">
                <div class="empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                </div>
                <div class="empty-title">暂无组件</div>
                <div class="empty-hint">从左侧组件库添加组件</div>
            </div>

            <div v-else class="tree-list" ref="scrollContainerRef" @scroll="onVirtualScroll">
                <!-- English comment. -->
                <div :style="{ height: totalHeight + 'px', position: 'relative' }">
                    <div :style="{ transform: `translateY(${offsetY}px)` }">
                        <TreeNode
                            v-for="entry in visibleNodes"
                            :key="entry.component.id"
                            :node="entry.node"
                            :selected="entry.component.id === selectedComponentId"
                            :expanded="expandedNodes.has(entry.component.id)"
                            @toggle="handleToggle(entry.component.id)"
                            @select="handleSelect(entry.component.id)"
                        >
                            <template #actions>
                        <div class="node-actions">
                            <!-- English comment. -->
                            <button
                                class="action-btn"
                                :class="{ active: entry.component.visible }"
                                @click.stop="handleToggleVisibility(entry.component.id)"
                                :title="entry.component.visible ? '编辑隐藏' : '编辑显示'"
                            >
                                <svg v-if="entry.component.visible" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            </button>

                            <!-- English comment. -->
                            <button
                                class="action-btn"
                                :class="{ active: entry.component.locked }"
                                @click.stop="handleToggleLock(entry.component.id)"
                                :title="entry.component.locked ? '解锁' : '锁定'"
                            >
                                <svg v-if="entry.component.locked" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                </svg>
                            </button>

                            <!-- English comment. -->
                            <button
                                class="action-btn"
                                @click.stop="handleShowMenu(entry.component.id, $event)"
                                title="更多操作"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="5" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="12" cy="19" r="2" />
                                </svg>
                            </button>
                        </div>
                            </template>
                        </TreeNode>
                    </div>
                </div>
            </div>
        </div>

        <!-- English comment. -->
        <ContextMenu
            v-model:visible="contextMenu.visible"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :items="contextMenuItems"
            @select="handleContextMenuSelect"
        />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import TreeNode from '../ui/TreeNode.vue';
import ContextMenu from '../ui/ContextMenu.vue';
import { useComponent } from '../../composables/useComponent';
import { useComponentStore } from '../../stores/useComponentStore';
import { getComponent } from '../../utils/componentRegistry';

const emit = defineEmits(['component-selected', 'component-deleted']);

// English comment.
const componentStore = useComponentStore();
const { selectComponent, removeComponent, toggleComponentVisibility, renameComponent, duplicateComponent, clearAllComponents } = useComponent();

// English comment.
const components = computed(() => componentStore.components || []);
const selectedComponent = computed(() => componentStore.selectedComponent);
const selectedComponentId = computed(() => selectedComponent.value?.id || null);

// English comment.
const ITEM_HEIGHT = 32; // English comment.
const OVERSCAN = 5;     // English comment.
const scrollContainerRef = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(300);

const totalHeight = computed(() => treeNodes.value.length * ITEM_HEIGHT);
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - OVERSCAN));
const endIndex = computed(() => Math.min(
    treeNodes.value.length,
    Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT) + OVERSCAN
));
const offsetY = computed(() => startIndex.value * ITEM_HEIGHT);
const visibleNodes = computed(() => treeNodes.value.slice(startIndex.value, endIndex.value));

const onVirtualScroll = (e) => {
    scrollTop.value = e.target.scrollTop;
};

let resizeObserver = null;
onMounted(() => {
    if (scrollContainerRef.value) {
        containerHeight.value = scrollContainerRef.value.clientHeight || 300;
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                containerHeight.value = entry.contentRect.height || 300;
            }
        });
        resizeObserver.observe(scrollContainerRef.value);
    }
});
onUnmounted(() => {
    resizeObserver?.disconnect();
});

// English comment.
watch(selectedComponentId, (id) => {
    if (!id || !scrollContainerRef.value) return;
    const idx = treeNodes.value.findIndex((n) => n.component.id === id);
    if (idx < 0) return;
    const itemTop = idx * ITEM_HEIGHT;
    const itemBottom = itemTop + ITEM_HEIGHT;
    const el = scrollContainerRef.value;
    if (itemTop < el.scrollTop) {
        el.scrollTop = itemTop;
    } else if (itemBottom > el.scrollTop + el.clientHeight) {
        el.scrollTop = itemBottom - el.clientHeight;
    }
});

// English comment.
const expandedNodes = ref(new Set());

// English comment.
const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    componentId: null
});

// English comment.
const contextMenuItems = computed(() => {
    const componentList = components.value || [];
    const component = componentList.find((c) => c.id === contextMenu.value.componentId);
    if (!component) return [];

    return [
        {
            // icon: 'edit',
            label: '重命名',
            action: 'rename'
        },
        {
            // icon: component.visible ? 'eye' : 'eye-off',
            label: component.visible ? '编辑隐藏' : '编辑显示',
            action: 'toggleVisibility'
        },
        {
            // icon: component.locked ? 'lock' : 'unlock',
            label: component.locked ? '解锁' : '锁定',
            action: 'toggleLock'
        },
        {
            divider: true
        },
        {
            // icon: 'copy',
            label: '复制',
            action: 'duplicate',
            disabled: false
        },
        {
            divider: true
        },
        {
            // icon: 'trash',
            label: '删除',
            action: 'delete',
            shortcut: 'Del',
            disabled: component.locked === true
        }
    ];
});

/**
 * English comment.
 */
const formatNodeData = (comp) => {
    const metadata = getComponent(comp.type)?.metadata;
    return {
        id: comp.id,
        label: comp.name || metadata?.displayName || comp.type,
        icon: getComponentIcon(comp.type),
        children: [] // English comment.
    };
};

const treeNodes = computed(() => components.value.map((component) => ({
    component,
    node: formatNodeData(component)
})));

/**
 * English comment.
 */
const getComponentIcon = (type) => {
    const iconMap = {
        ModelLoader: 'cube',
        GridHelper: 'grid',
        HDRLoader: 'image',
        Light: 'sun',
        Camera: 'camera',
        Heatmap: 'flame',
        ParticleSystem: 'sparkles',
        AreaBlock: 'square',
        Label3D: 'tag',
        MarkPoint: 'map-pin',
        MarkLine: 'git-commit-vertical',
        MarkArea: 'pentagon',
        PathAnimation: 'route',
        MultiPathAnimation: 'workflow',
        TrajectoryMove: 'move-right',
        FlyControls: 'navigation',
        FirstPersonControls: 'person-standing',
        CameraTour: 'waypoints',
        MigrationLine: 'send',
        WeatherClouds: 'cloud',
        WeatherLighting: 'cloud-lightning',
        BuildingEditor: 'map'
    };
    return iconMap[type] || 'box';
};

/**
 * English comment.
 */
const handleToggle = (nodeId) => {
    if (expandedNodes.value.has(nodeId)) {
        expandedNodes.value.delete(nodeId);
    } else {
        expandedNodes.value.add(nodeId);
    }
};

/**
 * English comment.
 */
const handleSelect = (componentId) => {
    selectComponent(componentId);
    emit('component-selected', componentId);
};

/**
 * English comment.
 */
const handleToggleVisibility = (componentId) => {
    toggleComponentVisibility(componentId);
};

/**
 * English comment.
 */
const handleToggleLock = (componentId) => {
    const componentList = components.value || [];
    const component = componentList.find((c) => c.id === componentId);
    if (component) {
        componentStore.updateComponent(componentId, {
            locked: !component.locked
        });
    }
};

/**
 * English comment.
 */
const handleShowMenu = (componentId, event) => {
    contextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        componentId
    };

    // English comment.
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
};

/**
 * English comment.
 */
const hideContextMenu = () => {
    contextMenu.value.visible = false;
};

/**
 * English comment.
 */
const handleContextMenuSelect = (item) => {
    const componentId = contextMenu.value.componentId;

    switch (item.action) {
        case 'rename':
            handleRename();
            break;
        case 'toggleVisibility':
            handleToggleVisibility(componentId);
            break;
        case 'toggleLock':
            handleToggleLock(componentId);
            break;
        case 'duplicate':
            handleDuplicate();
            break;
        case 'delete':
            handleDelete();
            break;
    }
};

/**
 * English comment.
 */
const handleRename = async () => {
    const componentId = contextMenu.value.componentId;
    const componentList = components.value || [];
    const component = componentList.find((c) => c.id === componentId);
    if (component) {
        const newName = prompt('请输入新名称:', component.name);
        if (newName && newName.trim()) {
            await renameComponent(componentId, newName.trim());
        }
    }
};

/**
 * English comment.
 */
const handleDuplicate = async () => {
    const componentId = contextMenu.value.componentId;
    const componentList = components.value || [];
    const component = componentList.find((c) => c.id === componentId);
    if (component) {
        await duplicateComponent(componentId);
    }
};

/**
 * English comment.
 */
const handleDelete = () => {
    const componentId = contextMenu.value.componentId;
    const componentList = components.value || [];
    const component = componentList.find((c) => c.id === componentId);
    if (component?.locked) {
        alert('组件已锁定，无法删除');
        return;
    }
    if (confirm('确定要删除这个组件吗？')) {
        try {
            removeComponent(componentId);
            emit('component-deleted', componentId);
        } catch (error) {
            alert(error?.message || '删除失败');
        }
    }
};

/**
 * English comment.
 */
const expandAll = () => {
    const componentList = components.value || [];
    componentList.forEach((comp) => {
        expandedNodes.value.add(comp.id);
    });
};

/**
 * English comment.
 */
const collapseAll = () => {
    expandedNodes.value.clear();
};

/**
 * English comment.
 */
const clearAll = () => {
    if (confirm('确定要清空场景中的所有未锁定组件吗？')) {
        clearAllComponents();
    }
};
</script>

<style scoped>
.scene-tree {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: var(--left-panel-content-gap);
    padding: var(--left-panel-content-padding) var(--left-panel-content-padding) 0;
}

.toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 0 0 auto;
    min-height: var(--left-panel-control-height);
    margin-bottom: 0;
    padding: 0;
    border-bottom: 0;
    background: transparent;
}

.toolbar-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-primary);
    letter-spacing: 0;
}

.toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.tool-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    background-color: transparent;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.tool-btn:hover {
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.tool-btn--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
}

.tree-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    overflow-x: hidden;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 180px;
    text-align: center;
    color: var(--color-text-tertiary);
    padding: 0 var(--space-3) var(--left-panel-content-padding);
}

.empty-icon {
    margin-bottom: var(--space-3);
    opacity: 0.4;
}

.empty-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
}

.empty-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
}

.tree-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    height: 100%;
    overflow-y: auto;
    padding: 0 0 var(--left-panel-content-padding);
    scrollbar-gutter: stable;
}

.node-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    opacity: 0;
    transition: opacity var(--transition-fast);
}

.tree-node:hover .node-actions {
    opacity: 1;
}

.action-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    background-color: transparent;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.action-btn:hover {
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.action-btn.active {
    color: var(--color-primary);
}
</style>

