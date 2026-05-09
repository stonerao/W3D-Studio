<template>
    <div class="tree-node group">
        <div
            class="tree-node-content"
            :class="{ selected: selected, 'has-children': hasChildren }"
            :style="{ paddingLeft: `${level * 16}px` }"
            @click="handleClick"
        >
            <!-- English comment. -->
            <span v-if="hasChildren" class="tree-node-icon" @click.stop="handleToggle">
                {{ expanded ? '▼' : '▶' }}
            </span>
            <span v-else class="tree-node-icon-placeholder"></span>

            <!-- English comment. -->
            <!-- <span class="tree-node-type-icon">{{ icon }}</span> -->

            <!-- English comment. -->
            <span class="tree-node-label">{{ label }}</span>

            <!-- English comment. -->
            <slot name="actions"></slot>
        </div>

        <!-- English comment. -->
        <div v-if="hasChildren && expanded" class="tree-node-children">
            <TreeNode
                v-for="child in children"
                :key="child.id"
                :node="child"
                :level="level + 1"
                :selected="selectedId === child.id"
                :expanded="expandedNodes.has(child.id)"
                @select="handleChildSelect"
                @toggle="handleChildToggle"
            >
                <template #actions>
                    <slot name="actions" :node="child"></slot>
                </template>
            </TreeNode>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    node: {
        type: Object,
        required: true
    },
    level: {
        type: Number,
        default: 0
    },
    selected: {
        type: Boolean,
        default: false
    },
    expanded: {
        type: Boolean,
        default: false
    },
    selectedId: {
        type: String,
        default: null
    },
    expandedNodes: {
        type: Set,
        default: () => new Set()
    }
});

const emit = defineEmits(['select', 'toggle']);

const hasChildren = computed(() => {
    return props.node.children && props.node.children.length > 0;
});

const label = computed(() => props.node.label || props.node.name || 'Unnamed');
const icon = computed(() => props.node.icon || '');
const children = computed(() => props.node.children || []);

const handleToggle = () => {
    emit('toggle', props.node.id);
};

const handleClick = () => {
    emit('select', props.node.id);
};

const handleChildSelect = (id) => {
    emit('select', id);
};

const handleChildToggle = (id) => {
    emit('toggle', id);
};
</script>

<style scoped>
.tree-node {
    user-select: none;
}

.tree-node-content {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding-top: 0;
    padding-right: 8px;
    padding-bottom: 0;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: background-color 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                color 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: var(--border-radius-sm, 4px);
    margin: 1px 0;
}

.tree-node-content:hover {
    background-color: var(--color-bg-hover);
}

.tree-node-content.selected {
    background-color: rgba(0, 212, 255, 0.15);
    color: var(--color-primary);
    box-shadow: inset 3px 0 0 var(--color-primary, #00d4ff);
}

.tree-node-icon {
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                color 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.tree-node-icon:hover {
    color: var(--color-primary, #00d4ff);
    transform: scale(1.2);
}

.tree-node-icon-placeholder {
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
}

.tree-node-type-icon {
    font-size: 1rem;
}

.tree-node-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
    transition: color 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.tree-node-content:hover .tree-node-label {
    color: var(--color-text-primary);
}

.tree-node-visibility {
    font-size: 0.875rem;
    opacity: 0.5;
    transition: opacity var(--transition-fast);
}

.tree-node-visibility:hover {
    opacity: 1;
}

.tree-node-children {
    margin-left: 0;
}
</style>

