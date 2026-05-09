<template>
    <div class="key-value-editor">
        <div v-if="items.length === 0" class="empty-state">
            <span class="empty-text">{{ emptyText }}</span>
        </div>

        <div
            v-for="(item, index) in items"
            :key="index"
            class="key-value-row"
        >
            <Input
                :model-value="item.key"
                @update:model-value="updateKey(index, $event)"
                :placeholder="keyPlaceholder"
                size="sm"
                class="key-input"
            />
            <Input
                :model-value="item.value"
                @update:model-value="updateValue(index, $event)"
                :placeholder="valuePlaceholder"
                size="sm"
                class="value-input"
            />
            <button
                class="btn-remove"
                @click="removeItem(index)"
                title="删除"
            >
                ✕
            </button>
        </div>

        <button class="btn-add" @click="addItem">
            <span class="btn-add-icon">+</span>
            <span>{{ addButtonText }}</span>
        </button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Input from './Input.vue';

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    keyPlaceholder: {
        type: String,
        default: '键'
    },
    valuePlaceholder: {
        type: String,
        default: '值'
    },
    addButtonText: {
        type: String,
        default: '添加项'
    },
    emptyText: {
        type: String,
        default: '暂无数据'
    }
});

const emit = defineEmits(['update:modelValue']);

const items = computed(() => props.modelValue || []);

const updateKey = (index, newKey) => {
    const newItems = [...items.value];
    newItems[index] = { ...newItems[index], key: newKey };
    emit('update:modelValue', newItems);
};

const updateValue = (index, newValue) => {
    const newItems = [...items.value];
    newItems[index] = { ...newItems[index], value: newValue };
    emit('update:modelValue', newItems);
};

const addItem = () => {
    const newItems = [...items.value, { key: '', value: '' }];
    emit('update:modelValue', newItems);
};

const removeItem = (index) => {
    const newItems = items.value.filter((_, i) => i !== index);
    emit('update:modelValue', newItems);
};
</script>

<style scoped>
.key-value-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.empty-state {
    padding: 0.75rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
}

.key-value-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.key-input {
    flex: 1;
}

.value-input {
    flex: 2;
}

.btn-remove {
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
}

.btn-remove:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
}

.btn-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem;
    background-color: var(--color-bg-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-add:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.btn-add-icon {
    font-size: 0.875rem;
    font-weight: 600;
}
</style>

