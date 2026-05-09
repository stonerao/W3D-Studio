<template>
    <Modal
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        :title="isEditing ? '编辑数据源' : '添加数据源'"
        width="600px"
        @close="handleClose"
    >
        <div class="data-source-form">
            <!-- 数据源名称 -->
            <div class="form-field">
                <label class="form-label required">数据源名称</label>
                <Input
                    v-model="formData.name"
                    placeholder="例如: 获取区域数据"
                />
            </div>

            <!-- 请求地址 -->
            <div class="form-field">
                <label class="form-label required">请求地址</label>
                <Input
                    v-model="formData.url"
                    placeholder="输入完整 URL 或相对路径"
                />
                <div class="form-hint">
                    相对路径会自动拼接 API 基础前缀: {{ projectStore.apiBaseUrl }}
                </div>
            </div>

            <!-- 请求方法 -->
            <div class="form-field">
                <label class="form-label">请求方法</label>
                <Select
                    v-model="formData.method"
                    :options="methodOptions"
                />
            </div>

            <!-- 属性绑定 -->
            <div class="form-field">
                <label class="form-label required">绑定属性</label>
                <Select
                    v-model="formData.targetProperty"
                    :options="bindableProperties"
                    placeholder="选择要绑定的组件属性"
                />
                <div class="form-hint">
                    选择数据请求成功后要更新的组件属性
                </div>
            </div>

            <!-- 折叠面板 -->
            <Accordion :items="accordionItems" :default-open="[]">
                <!-- URL 参数 -->
                <template #params>
                    <KeyValueEditor
                        v-model="formData.params"
                        key-placeholder="参数名"
                        value-placeholder="参数值"
                        add-button-text="添加 URL 参数"
                        empty-text="暂无 URL 参数"
                    />
                </template>

                <!-- 请求头 -->
                <template #headers>
                    <KeyValueEditor
                        v-model="formData.headers"
                        key-placeholder="Header 名称"
                        value-placeholder="Header 值"
                        add-button-text="添加 Header"
                        empty-text="暂无自定义 Header"
                    />
                </template>

                <!-- 请求体 -->
                <template #body>
                    <div v-if="formData.method === 'POST'" class="body-editor">
                        <details class="lowcode-advanced-box">
                            <summary>高级配置：原始请求体</summary>
                            <textarea
                                v-model="formData.body"
                                class="code-textarea"
                                placeholder='{"key": "value"}'
                                spellcheck="false"
                            />
                        </details>
                    </div>
                    <div v-else class="body-disabled">
                        请求体仅在 POST 方法时可用
                    </div>
                </template>

                <!-- 数据映射 -->
                <template #mapping>
                    <div class="mapping-editor">
                        <div class="mapping-hint">
                            指定从响应数据中提取的字段路径，例如: data.areas 或 result.list
                        </div>
                        <Input
                            v-model="formData.dataPath"
                            placeholder="data"
                        />
                    </div>
                </template>

                <!-- 数据处理回调 -->
                <template #callback>
                    <div class="callback-editor">
                        <div class="callback-hint">
                            默认通过字段路径提取数据；复杂逻辑可在高级配置中编写回调函数。
                        </div>
                        <details class="lowcode-advanced-box">
                            <summary>高级配置：数据处理回调</summary>
                            <textarea
                                v-model="formData.callback"
                                class="code-textarea callback-textarea"
                                spellcheck="false"
                            />
                        </details>
                    </div>
                </template>
            </Accordion>
        </div>

        <template #footer>
            <Button variant="outline" @click="handleClose">
                取消
            </Button>
            <Button variant="primary" @click="handleSave" :disabled="!isFormValid">
                {{ isEditing ? '保存' : '添加' }}
            </Button>
        </template>
    </Modal>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useProjectStore } from '../../stores/useProjectStore';
import { getBindablePropertyOptionsByType } from '../../utils/bindableProperties';
import Modal from '../ui/Modal.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Button from '../ui/Button.vue';
import Accordion from '../ui/Accordion.vue';
import KeyValueEditor from '../ui/KeyValueEditor.vue';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    dataSource: {
        type: Object,
        default: null
    },
    componentType: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:modelValue', 'save']);
const projectStore = useProjectStore();

// 是否编辑模式
const isEditing = computed(() => !!props.dataSource?.id);

// 表单数据
const formData = reactive({
    id: '',
    name: '',
    url: '',
    method: 'GET',
    targetProperty: '',
    params: [],
    headers: [],
    body: '',
    dataPath: 'data',
    callback: ''
});

// 请求方法选项
const methodOptions = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' }
];

// 折叠面板配置
const accordionItems = [
    { key: 'params', title: 'URL 参数' },
    { key: 'headers', title: '请求头 (Headers)' },
    { key: 'body', title: '请求体 (Body)' },
    { key: 'mapping', title: '数据映射' },
    { key: 'callback', title: '数据处理回调' }
];

// 可绑定属性列表（根据组件类型动态生成）
const bindableProperties = computed(() => {
    const options = getBindablePropertyOptionsByType(props.componentType);
    return options.map((item) => ({
        label: `${item.label} (${item.value})`,
        value: item.value
    }));
});

// 表单验证
const isFormValid = computed(() => {
    return formData.name && formData.url && formData.targetProperty;
});

// 生成唯一 ID
const generateId = () => {
    return `ds_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// 监听弹窗打开，初始化表单
watch(() => props.modelValue, (visible) => {
    if (visible) {
        if (props.dataSource) {
            // 编辑模式，加载现有数据
            Object.assign(formData, {
                id: props.dataSource.id || generateId(),
                name: props.dataSource.name || '',
                url: props.dataSource.url || '',
                method: props.dataSource.method || 'GET',
                targetProperty: props.dataSource.targetProperty || '',
                params: props.dataSource.params || [],
                headers: props.dataSource.headers || [],
                body: props.dataSource.body || '',
                dataPath: props.dataSource.dataPath || 'data',
                callback: props.dataSource.callback || ''
            });
        } else {
            // 新增模式，重置表单
            Object.assign(formData, {
                id: generateId(),
                name: '',
                url: '',
                method: 'GET',
                targetProperty: '',
                params: [],
                headers: [],
                body: '',
                dataPath: 'data',
                callback: ''
            });
        }
    }
});

// 保存
const handleSave = () => {
    if (!isFormValid.value) return;

    const dataSource = {
        id: formData.id,
        name: formData.name,
        url: formData.url,
        method: formData.method,
        targetProperty: formData.targetProperty,
        params: [...formData.params],
        headers: [...formData.headers],
        body: formData.body,
        dataPath: formData.dataPath,
        callback: formData.callback
    };

    emit('save', dataSource);
    emit('update:modelValue', false);
};

// 关闭
const handleClose = () => {
    emit('update:modelValue', false);
};
</script>

<style scoped>
.data-source-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
}

.form-label.required::after {
    content: ' *';
    color: #ef4444;
}

.form-hint {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
}

.code-textarea {
    width: 100%;
    min-height: 100px;
    padding: 0.75rem;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-primary);
    resize: vertical;
}

.code-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.callback-textarea {
    min-height: 150px;
}

.lowcode-advanced-box {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: var(--color-bg-tertiary);
}

.lowcode-advanced-box summary {
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.lowcode-advanced-box .code-textarea {
    margin-top: var(--space-2);
}

.body-disabled {
    padding: 1rem;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
}

.mapping-editor,
.callback-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.mapping-hint,
.callback-hint {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    line-height: 1.5;
}
</style>
