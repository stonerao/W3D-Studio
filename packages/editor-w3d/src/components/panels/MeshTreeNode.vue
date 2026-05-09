<template>
    <div v-if="isVisible" class="mesh-tree-node">
        <div
            class="node-content"
            :class="{
                'has-texture': hasTexture,
                'is-mesh': node.isMesh,
                'is-active': activeNodeName === node.name
            }"
            :style="{ paddingLeft: level * 20 + 'px' }"
            @click="handleNodeClick"
        >
            <button
                v-if="node.children && node.children.length > 0"
                class="btn-expand"
                @click.stop="toggleExpand"
            >
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    :class="{ rotated: isExpanded }"
                >
                    <path
                        d="M4 2L8 6L4 10"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </button>
            <span v-else class="expand-placeholder"></span>

            <input
                v-if="!isBakeMode && (node.isMesh || node.type === 'Group') && !node.name.startsWith('Unnamed')"
                type="checkbox"
                class="mesh-checkbox"
                :checked="isSelected"
                @click.stop
                @change="handleToggle"
            />

            <span class="node-icon" :class="nodeIconClass">
                {{ nodeIcon }}
            </span>

            <span class="node-name" :class="{ 'is-mesh': node.isMesh, 'is-group': node.type === 'Group' }">
                {{ node.name }}
            </span>

            <span class="node-type">{{ node.type }}</span>

            <div v-if="isBakeMode && (node.isMesh || node.type === 'Group')" class="texture-config">
                <div v-if="hasTexture" class="texture-preview">
                    <img
                        :src="getTexturePreviewUrl(textureMapping[node.name])"
                        @error="handleImageError"
                        class="preview-img"
                        :title="textureMapping[node.name]"
                    />
                    <span class="texture-filename">
                        {{ getFileName(textureMapping[node.name]) }}
                    </span>
                </div>

                <div class="texture-actions">
                    <button
                        class="btn-select-texture"
                        @click.stop="handleSelectTexture"
                        :disabled="!enabled"
                    >
                        {{ hasTexture ? '更换' : '选择贴图' }}
                    </button>
                    <button
                        v-if="hasTexture"
                        class="btn-clear-texture"
                        @click.stop="handleClearTexture"
                        :disabled="!enabled"
                        title="移除贴图"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>

        <div v-if="isExpanded && node.children && node.children.length > 0" class="node-children">
            <MeshTreeNode
                v-for="child in node.children"
                :key="child.id"
                :node="child"
                :level="level + 1"
                :selected-meshes="selectedMeshes"
                :expanded="expandedNodes.has(child.id)"
                :texture-mapping="textureMapping"
                :enabled="enabled"
                :bake-mode="bakeMode"
                :search-query="searchQuery"
                :expanded-nodes="expandedNodes"
                :active-node-name="activeNodeName"
                @toggle="handleChildToggle"
                @click-node="handleChildNodeClick"
                @select-texture="$emit('select-texture', $event)"
                @clear-texture="$emit('clear-texture', $event)"
            />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
    node: {
        type: Object,
        required: true
    },
    level: {
        type: Number,
        default: 0
    },
    selectedMeshes: {
        type: Array,
        default: () => []
    },
    expanded: {
        type: Boolean,
        default: false
    },
    textureMapping: {
        type: Object,
        default: () => ({})
    },
    enabled: {
        type: Boolean,
        default: true
    },
    searchQuery: {
        type: String,
        default: ''
    },
    expandedNodes: {
        type: Set,
        default: () => new Set()
    },
    bakeMode: {
        type: Boolean,
        default: false
    },
    activeNodeName: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['toggle', 'click-node', 'select-texture', 'clear-texture']);

const isExpanded = ref(props.expanded);

watch(() => props.expanded, (newValue) => {
    isExpanded.value = newValue;
});

const isBakeMode = computed(() => props.bakeMode);

const isSelected = computed(() => {
    return props.selectedMeshes.includes(props.node.name);
});

const hasTexture = computed(() => {
    return !!props.textureMapping[props.node.name];
});

const matchesSearch = (node, query) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();

    if (node.name.toLowerCase().includes(lowerQuery)) {
        return true;
    }

    if (node.children && node.children.length > 0) {
        return node.children.some((child) => matchesSearch(child, lowerQuery));
    }

    return false;
};

const isVisible = computed(() => {
    return matchesSearch(props.node, props.searchQuery);
});

const nodeIcon = computed(() => {
    if (props.node.isMesh) return '🔷';
    if (props.node.type === 'Group') return '📂';
    if (props.node.type === 'Object3D') return '';
    if (props.node.type === 'Scene') return '🌍';
    return '🔹';
});

const nodeIconClass = computed(() => {
    if (props.node.isMesh) return 'icon-mesh';
    if (props.node.type === 'Group') return 'icon-group';
    return 'icon-object';
});

function toggleExpand() {
    isExpanded.value = !isExpanded.value;
    emit('toggle', props.node.id);
}

function handleToggle() {
    emit('toggle', props.node.name);
}

function handleNodeClick() {
    emit('click-node', props.node);
}

function handleChildToggle(nodeId) {
    emit('toggle', nodeId);
}

function handleChildNodeClick(node) {
    emit('click-node', node);
}

function handleSelectTexture() {
    emit('select-texture', props.node.name);
}

function handleClearTexture() {
    emit('clear-texture', props.node.name);
}

function getTexturePreviewUrl(path) {
    if (!path) return '';
    return path;
}

function getFileName(path) {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
}

function handleImageError(event) {
    event.target.style.display = 'none';
}
</script>

<style scoped>
.mesh-tree-node {
    user-select: none;
}

.node-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: var(--border-radius-sm);
    transition: background 0.2s, border-color 0.2s;
    border: 1px solid transparent;
    cursor: pointer;
}

.node-content:hover {
    background: var(--color-bg-hover);
}

.node-content.is-active {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-secondary));
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
}

.btn-expand {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    transition: transform 0.2s;
}

.btn-expand svg {
    transition: transform 0.2s;
}

.btn-expand svg.rotated {
    transform: rotate(90deg);
}

.btn-expand:hover {
    color: var(--color-text-primary);
}

.expand-placeholder {
    width: 16px;
    height: 16px;
}

.mesh-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
}

.node-icon {
    font-size: 1rem;
    line-height: 1;
}

.icon-mesh {
    opacity: 0.9;
}

.icon-group {
    opacity: 0.8;
}

.icon-object {
    opacity: 0.7;
}

.node-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.node-name.is-mesh {
    font-weight: 500;
}

.node-name.is-group {
    font-weight: 500;
    color: var(--color-primary);
}

.node-type {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    padding: 0.125rem 0.5rem;
    background: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
}

.node-children {
    margin-left: 0;
}

.node-content.has-texture {
    border-color: var(--color-primary);
    background-color: rgba(0, 212, 255, 0.05);
}

.node-content.is-mesh {
    background-color: var(--color-bg-secondary);
}

.texture-config {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
}

.texture-preview {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background-color: var(--color-bg-elevated);
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--color-border);
}

.preview-img {
    width: 1.5rem;
    height: 1.5rem;
    object-fit: cover;
    border-radius: var(--border-radius-sm);
}

.texture-filename {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.texture-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.btn-select-texture,
.btn-clear-texture {
    padding: 0.25rem 0.625rem;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.btn-select-texture:hover:not(:disabled) {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
}

.btn-clear-texture {
    padding: 0.25rem 0.5rem;
}

.btn-clear-texture:hover:not(:disabled) {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: white;
}

.btn-select-texture:disabled,
.btn-clear-texture:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
