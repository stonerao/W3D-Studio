<template>
    <div class="property-binding-selector">
        <label class="selector-label">绑定属性</label>
        <Select
            :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)"
            :options="propertyOptions"
            placeholder="选择要绑定的属性"
        />
        <div v-if="selectedPropertyReference" class="property-info">
            <div class="info-line info-title">接入参考：{{ selectedPropertyReference.label }}</div>
            <div class="info-line">
                <span class="info-key">默认格式</span>
                <span class="info-text">{{ selectedPropertyReference.formatHint }}</span>
            </div>
            <div class="info-line">
                <span class="info-key">默认值</span>
                <span class="info-text info-value">{{ selectedPropertyReference.defaultValueText }}</span>
            </div>
            <div class="info-line">
                <span class="info-key">接入示例</span>
                <span class="info-text">{{ selectedPropertyReference.accessHint }}</span>
            </div>
            <div class="info-actions">
                <button
                    class="btn-apply-example"
                    type="button"
                    @click="applyTransformExample"
                >
                    应用示例到 transform
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Select from './Select.vue';
import { getBindablePropertyOptionsByType, getPropertyBindingReference } from '../../utils/bindableProperties';

const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    },
    componentType: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:modelValue', 'apply-transform-example']);

const propertyOptions = computed(() => {
    return getBindablePropertyOptionsByType(props.componentType);
});

const selectedPropertyReference = computed(() => {
    if (!props.modelValue) return '';
    return getPropertyBindingReference(props.componentType, props.modelValue);
});

const applyTransformExample = () => {
    if (!selectedPropertyReference.value) return;
    emit('apply-transform-example', selectedPropertyReference.value);
};
</script>

<style scoped>
.property-binding-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.selector-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.property-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background-color: rgba(59, 130, 246, 0.1);
    border-left: 2px solid var(--color-primary);
    border-radius: var(--border-radius-sm);
}

.info-line {
    display: flex;
    gap: 0.375rem;
    align-items: flex-start;
}

.info-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.info-key {
    min-width: 52px;
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    flex-shrink: 0;
}

.info-text {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
}

.info-value {
    color: var(--color-text-primary);
    word-break: break-all;
}

.info-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.25rem;
}

.btn-apply-example {
    height: 1.5rem;
    padding: 0 0.5rem;
    font-size: 0.625rem;
    color: var(--color-text-primary);
    background-color: rgba(var(--color-primary-rgb), 0.12);
    border: 1px solid var(--color-primary);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-apply-example:hover {
    background-color: rgba(var(--color-primary-rgb), 0.2);
}
</style>

