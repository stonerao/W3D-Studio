<template>
    <div class="variable-value-editor">
        <!-- Number -->
        <template v-if="type === 'number'">
            <Input
                type="number"
                :model-value="modelValue"
                @update:model-value="updateValue(parseFloat($event) || 0)"
                step="any"
            />
        </template>

        <!-- Boolean -->
        <template v-else-if="type === 'boolean'">
            <div class="boolean-toggle">
                <button
                    class="toggle-btn"
                    :class="{ active: modelValue === true }"
                    @click="updateValue(true)"
                >
                    true
                </button>
                <button
                    class="toggle-btn"
                    :class="{ active: modelValue === false }"
                    @click="updateValue(false)"
                >
                    false
                </button>
            </div>
        </template>

        <!-- String -->
        <template v-else-if="type === 'string'">
            <textarea
                :value="modelValue"
                @input="updateValue($event.target.value)"
                class="string-input"
                rows="2"
                placeholder="输入文本..."
            ></textarea>
        </template>

        <!-- Array -->
        <template v-else-if="type === 'array'">
            <div class="structured-editor">
                <div v-for="(item, index) in safeArray(modelValue)" :key="`arr-${index}`" class="structured-row">
                    <Input
                        :model-value="formatScalar(item)"
                        placeholder="值"
                        @update:model-value="updateArrayItem(index, $event)"
                    />
                    <button class="structured-btn" type="button" @click="removeArrayItem(index)">删除</button>
                </div>
                <button class="structured-add" type="button" @click="addArrayItem">新增项</button>
                <details class="advanced-json">
                    <summary>高级配置：批量编辑 JSON 数组</summary>
                    <textarea
                        :value="formatJson(modelValue)"
                        @blur="parseJsonValue($event.target.value)"
                        class="json-input"
                        rows="3"
                        placeholder="[1, 2, 3]"
                    ></textarea>
                </details>
            </div>
        </template>

        <!-- Object -->
        <template v-else-if="type === 'object'">
            <div class="structured-editor">
                <div v-for="entry in objectEntries" :key="entry.key" class="structured-row structured-row--object">
                    <Input
                        :model-value="entry.key"
                        placeholder="字段名"
                        @update:model-value="updateObjectKey(entry.key, $event)"
                    />
                    <Input
                        :model-value="formatScalar(entry.value)"
                        placeholder="字段值"
                        @update:model-value="updateObjectValue(entry.key, $event)"
                    />
                    <button class="structured-btn" type="button" @click="removeObjectKey(entry.key)">删除</button>
                </div>
                <button class="structured-add" type="button" @click="addObjectEntry">新增字段</button>
                <details class="advanced-json">
                    <summary>高级配置：批量编辑 JSON 对象</summary>
                    <textarea
                        :value="formatJson(modelValue)"
                        @blur="parseJsonValue($event.target.value)"
                        class="json-input"
                        rows="4"
                        placeholder='{"key": "value"}'
                    ></textarea>
                </details>
            </div>
        </template>

        <!-- Vector2 -->
        <template v-else-if="type === 'vector2'">
            <div class="vector-inputs">
                <div class="vector-input">
                    <label>X</label>
                    <Input
                        type="number"
                        :model-value="safeArray(modelValue)[0]"
                        @update:model-value="updateVectorComponent(0, $event)"
                        step="any"
                    />
                </div>
                <div class="vector-input">
                    <label>Y</label>
                    <Input
                        type="number"
                        :model-value="safeArray(modelValue)[1]"
                        @update:model-value="updateVectorComponent(1, $event)"
                        step="any"
                    />
                </div>
            </div>
        </template>

        <!-- Vector3 -->
        <template v-else-if="type === 'vector3'">
            <div class="vector-inputs">
                <div class="vector-input">
                    <label>X</label>
                    <Input
                        type="number"
                        :model-value="safeArray(modelValue)[0]"
                        @update:model-value="updateVectorComponent(0, $event)"
                        step="any"
                    />
                </div>
                <div class="vector-input">
                    <label>Y</label>
                    <Input
                        type="number"
                        :model-value="safeArray(modelValue)[1]"
                        @update:model-value="updateVectorComponent(1, $event)"
                        step="any"
                    />
                </div>
                <div class="vector-input">
                    <label>Z</label>
                    <Input
                        type="number"
                        :model-value="safeArray(modelValue)[2]"
                        @update:model-value="updateVectorComponent(2, $event)"
                        step="any"
                    />
                </div>
            </div>
        </template>

        <!-- Fallback -->
        <template v-else>
            <Input
                :model-value="String(modelValue)"
                @update:model-value="updateValue($event)"
            />
        </template>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Input from '../ui/Input.vue';

const props = defineProps({
    modelValue: {
        type: [Number, Boolean, String, Array, Object],
        default: null
    },
    type: {
        type: String,
        default: 'string'
    }
});

const emit = defineEmits(['update:modelValue']);

const updateValue = (value) => {
    emit('update:modelValue', value);
};

const objectValue = computed(() => {
    return props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue)
        ? props.modelValue
        : {};
});

const objectEntries = computed(() => {
    return Object.entries(objectValue.value).map(([key, value]) => ({ key, value }));
});

const formatJson = (value) => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '';
    }
};

const parseJsonValue = (text) => {
    try {
        const parsed = JSON.parse(text);
        emit('update:modelValue', parsed);
    } catch {
        // 保持原值
    }
};

const safeArray = (value) => {
    if (Array.isArray(value)) return value;
    if (props.type === 'vector2') return [0, 0];
    if (props.type === 'vector3') return [0, 0, 0];
    return [];
};

const formatScalar = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const parseLooseValue = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    const numeric = Number(text);
    if (text !== '' && Number.isFinite(numeric) && String(numeric) === text) return numeric;
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
            return JSON.parse(text);
        } catch {
            return value;
        }
    }
    return value;
};

const updateArrayItem = (index, value) => {
    const next = [...safeArray(props.modelValue)];
    next[index] = parseLooseValue(value);
    emit('update:modelValue', next);
};

const addArrayItem = () => {
    emit('update:modelValue', [...safeArray(props.modelValue), '']);
};

const removeArrayItem = (index) => {
    const next = safeArray(props.modelValue).filter((_, itemIndex) => itemIndex !== index);
    emit('update:modelValue', next);
};

const updateObjectKey = (oldKey, newKey) => {
    const key = String(newKey || '').trim();
    if (!key || key === oldKey) return;
    const next = { ...objectValue.value };
    next[key] = next[oldKey];
    delete next[oldKey];
    emit('update:modelValue', next);
};

const updateObjectValue = (key, value) => {
    emit('update:modelValue', {
        ...objectValue.value,
        [key]: parseLooseValue(value)
    });
};

const addObjectEntry = () => {
    const next = { ...objectValue.value };
    let index = Object.keys(next).length + 1;
    let key = `field${index}`;
    while (Object.prototype.hasOwnProperty.call(next, key)) {
        index += 1;
        key = `field${index}`;
    }
    next[key] = '';
    emit('update:modelValue', next);
};

const removeObjectKey = (key) => {
    const next = { ...objectValue.value };
    delete next[key];
    emit('update:modelValue', next);
};

const updateVectorComponent = (index, value) => {
    const arr = safeArray(props.modelValue);
    const newArr = [...arr];
    newArr[index] = parseFloat(value) || 0;
    emit('update:modelValue', newArr);
};
</script>

<style scoped>
.variable-value-editor {
    width: 100%;
}

.boolean-toggle {
    display: flex;
    gap: 4px;
}

.toggle-btn {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
}

.toggle-btn:hover {
    border-color: var(--color-primary);
}

.toggle-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.string-input,
.json-input {
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    resize: vertical;
}

.json-input {
    font-family: monospace;
    font-size: 12px;
}

.string-input:focus,
.json-input:focus {
    outline: none;
    border-color: var(--color-primary);
}

.vector-inputs {
    display: flex;
    gap: 8px;
}

.vector-input {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.vector-input label {
    font-size: 11px;
    color: var(--color-text-secondary);
    text-align: center;
}

.structured-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.structured-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
}

.structured-row--object {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr) auto;
}

.structured-btn,
.structured-add {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 12px;
}

.structured-btn {
    padding: 7px 10px;
}

.structured-add {
    padding: 8px 10px;
}

.structured-btn:hover,
.structured-add:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.advanced-json {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 8px;
    background: var(--color-bg-secondary);
}

.advanced-json summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.advanced-json .json-input {
    margin-top: 8px;
}
</style>
