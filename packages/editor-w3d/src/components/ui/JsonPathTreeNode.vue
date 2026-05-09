<template>
    <div class="json-path-node">
        <div class="json-path-node__row" :style="{ paddingLeft: `${level * 16}px` }">
            <button
                v-if="hasChildren"
                type="button"
                class="json-path-node__toggle"
                @click="emit('toggle', node.key)"
            >
                {{ expanded ? '▼' : '▶' }}
            </button>
            <span v-else class="json-path-node__toggle json-path-node__toggle--placeholder"></span>

            <button type="button" class="json-path-node__select" @click="emit('pick', node.path)">
                <span class="json-path-node__label">{{ node.label }}</span>
                <span class="json-path-node__meta">{{ node.pathLabel }}</span>
                <span class="json-path-node__type">{{ node.type }}</span>
                <span v-if="node.sample" class="json-path-node__sample">{{ node.sample }}</span>
            </button>

            <Button size="sm" variant="ghost" class="json-path-node__action" @click="emit('pick', node.path)">选择</Button>
        </div>

        <div v-if="hasChildren && expanded" class="json-path-node__children">
            <JsonPathTreeNode
                v-for="child in node.children"
                :key="child.key"
                :node="child"
                :level="level + 1"
                :expanded-keys="expandedKeys"
                @toggle="emit('toggle', $event)"
                @pick="emit('pick', $event)"
            />
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Button from './Button.vue';

defineOptions({
    name: 'JsonPathTreeNode'
});

const props = defineProps({
    node: {
        type: Object,
        required: true
    },
    level: {
        type: Number,
        default: 0
    },
    expandedKeys: {
        type: Object,
        default: () => new Set()
    }
});

const emit = defineEmits(['toggle', 'pick']);

const hasChildren = computed(() => Array.isArray(props.node?.children) && props.node.children.length > 0);
const expanded = computed(() => props.expandedKeys instanceof Set && props.expandedKeys.has(props.node.key));
</script>

<style scoped>
.json-path-node {
    display: flex;
    flex-direction: column;
}

.json-path-node__row {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.json-path-node__toggle {
    width: 16px;
    height: 28px;
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
    cursor: pointer;
}

.json-path-node__toggle--placeholder {
    cursor: default;
}

.json-path-node__select {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 4px 6px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
}

.json-path-node__select:hover {
    background: rgba(96, 165, 250, 0.08);
}

.json-path-node__label {
    color: #f4f7fb;
    font-size: 13px;
    font-weight: 600;
}

.json-path-node__meta,
.json-path-node__type,
.json-path-node__sample {
    min-width: 0;
    font-size: 12px;
    line-height: 1.5;
}

.json-path-node__meta {
    color: #93c5fd;
    font-family: var(--font-mono, monospace);
    word-break: break-all;
}

.json-path-node__type {
    color: rgba(255, 255, 255, 0.56);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.json-path-node__sample {
    color: rgba(255, 255, 255, 0.74);
    word-break: break-all;
}

.json-path-node__action {
    align-self: center;
}

.json-path-node__children {
    display: flex;
    flex-direction: column;
}

@media (max-width: 960px) {
    .json-path-node__row {
        grid-template-columns: 16px minmax(0, 1fr);
    }

    .json-path-node__action {
        grid-column: 2;
        justify-self: start;
    }
}
</style>
