<template>
    <div class="component-info">
        <div class="info-row">
            <span class="info-label">名称</span>
            <Input
                :model-value="selectedComponent.name"
                @update:model-value="emit('update-name', $event)"
                placeholder="组件名称"
            />
        </div>
        <div class="info-row">
            <span class="info-label">类型</span>
            <span class="info-value">{{ componentMetadata?.displayName || selectedComponent.type }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">ID</span>
            <span class="info-value text-xs">{{ selectedComponent.id }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">调用 ID</span>
            <span class="info-value text-xs">{{ callableComponentId }}</span>
            <button class="copy-id-btn" @click="emit('copy-callable-id')">复制</button>
        </div>
        <div v-if="isCameraJump" class="info-row">
            <span class="info-label">预览</span>
            <button class="copy-id-btn" @click="emit('preview-camera-jump')">立即跳转</button>
        </div>
    </div>
</template>

<script setup>
import Input from '../ui/Input.vue';

defineProps({
    selectedComponent: {
        type: Object,
        required: true
    },
    componentMetadata: {
        type: Object,
        default: null
    },
    callableComponentId: {
        type: String,
        default: ''
    },
    isCameraJump: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update-name', 'copy-callable-id', 'preview-camera-jump']);
</script>

<style scoped>
.component-info {
    background-color: rgba(15, 23, 42, 0.38);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border: 1px solid var(--color-border);
}

.info-row {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
}

.info-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-tertiary);
    white-space: nowrap;
}

.info-value {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.text-xs {
    font-size: var(--font-size-xs);
    opacity: 0.7;
}

.copy-id-btn {
    height: 20px;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-xs);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.copy-id-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}
</style>
