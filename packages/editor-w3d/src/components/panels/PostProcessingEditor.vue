<template>
    <div class="post-processing-editor">
        <div class="action-buttons">
            <Button variant="outline" size="sm" @click="openPipelineModal">调整顺序</Button>
            <Button variant="outline" size="sm" @click="resetPipelineOrder">恢复默认</Button>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-title">整体开关</span>
                <label class="section-toggle">
                    <input
                        type="checkbox"
                        :checked="config.enabled !== false"
                        @change="updateRootEnabled($event.target.checked)"
                    >
                    <span>{{ config.enabled !== false ? '已启用' : '已停用' }}</span>
                </label>
            </div>
            <div class="pipeline-note">
                关闭后期处理后，将回退为普通渲染，但会保留每个效果的参数和启用状态。
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-title">后期列表</span>
                <span class="section-meta">{{ enabledCount }}/{{ orderedEffects.length }} 已启用</span>
            </div>

            <div class="effect-list">
                <div
                    v-for="(effect, index) in orderedEffects"
                    :key="effect.type"
                    class="effect-row"
                    :class="{ 'effect-row--disabled': !effect.enabled }"
                >
                    <div class="effect-row__order">{{ index + 1 }}</div>
                    <div class="effect-row__main">
                        <div class="effect-row__title">{{ effect.label }}</div>
                        <div class="effect-row__desc">{{ effect.description }}</div>
                    </div>
                    <label class="effect-row__toggle">
                        <input
                            type="checkbox"
                            :checked="effect.enabled"
                            @change="toggleEffectEnabled(effect.type, $event.target.checked)"
                        >
                        <span>{{ effect.enabled ? '启用' : '关闭' }}</span>
                    </label>
                    <div class="effect-row__actions">
                        <Button variant="outline" size="sm" @click="openEffectEditor(effect.type)">编辑</Button>
                    </div>
                </div>
            </div>

            <div class="pipeline-note">
                RenderPass 固定在最前，OutputPass 固定在最后。AO 类效果可以叠加，但更建议一次只启用一个。
            </div>
        </div>

        <Modal
            v-model="showPipelineModal"
            title="调整后期链路"
            width="820px"
        >
            <div class="pipeline-modal">
                <div class="pipeline-modal__anchors">
                    <div class="pipeline-anchor">
                        <span class="pipeline-anchor__title">1. RenderPass</span>
                        <span class="pipeline-anchor__desc">固定首位，负责场景基础渲染</span>
                    </div>
                    <div class="pipeline-anchor pipeline-anchor--last">
                        <span class="pipeline-anchor__title">末尾. OutputPass</span>
                        <span class="pipeline-anchor__desc">固定末位，负责最终输出</span>
                    </div>
                </div>

                <div class="pipeline-modal__list">
                    <div
                        v-for="(type, index) in draftPipeline"
                        :key="type"
                        class="pipeline-row"
                    >
                        <div class="pipeline-row__order">{{ index + 2 }}</div>
                        <div class="pipeline-row__main">
                            <div class="pipeline-row__title">{{ effectMeta[type].label }}</div>
                            <div class="pipeline-row__desc">{{ effectMeta[type].description }}</div>
                        </div>
                        <label class="pipeline-row__toggle">
                            <input
                                v-model="draftEnabled[type]"
                                type="checkbox"
                            >
                            <span>{{ draftEnabled[type] ? '启用' : '关闭' }}</span>
                        </label>
                        <div class="pipeline-row__actions">
                            <Button
                                variant="outline"
                                size="sm"
                                :disabled="index === 0"
                                @click="moveEffect(index, -1)"
                            >上移</Button>
                            <Button
                                variant="outline"
                                size="sm"
                                :disabled="index === draftPipeline.length - 1"
                                @click="moveEffect(index, 1)"
                            >下移</Button>
                            <Button
                                variant="outline"
                                size="sm"
                                @click="openEffectEditor(type)"
                            >编辑</Button>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showPipelineModal = false">取消</Button>
                <Button variant="primary" @click="savePipelineConfig">保存</Button>
            </template>
        </Modal>

        <Modal
            v-model="showEffectModal"
            :title="effectEditorTitle"
            width="640px"
        >
            <div v-if="editingEffectType" class="effect-editor-modal">
                <div class="effect-editor-modal__desc">
                    {{ effectMeta[editingEffectType].description }}
                </div>

                <div class="effect-editor-form">
                    <div
                        v-for="field in currentEffectFields"
                        :key="field.key"
                        class="field-group"
                    >
                        <label v-if="field.type !== 'boolean'">{{ field.label }}</label>

                        <template v-if="field.type === 'number'">
                            <Slider
                                :model-value="Number(getDraftFieldValue(field))"
                                :min="field.min"
                                :max="field.max"
                                :step="field.step"
                                @update:model-value="updateDraftField(field, $event)"
                            />
                        </template>

                        <template v-else-if="field.type === 'select'">
                            <Select
                                :model-value="getDraftFieldValue(field)"
                                :options="field.options || []"
                                @update:model-value="updateDraftField(field, $event)"
                            />
                        </template>

                        <template v-else-if="field.type === 'boolean'">
                            <label class="field-boolean">
                                <input
                                    type="checkbox"
                                    :checked="Boolean(getDraftFieldValue(field))"
                                    @change="updateDraftField(field, $event.target.checked)"
                                >
                                <span>{{ field.label }}</span>
                            </label>
                        </template>

                        <template v-else>
                            <Input
                                :model-value="getDraftFieldValue(field)"
                                @update:model-value="updateDraftField(field, $event)"
                            />
                        </template>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showEffectModal = false">取消</Button>
                <Button variant="primary" @click="saveEffectConfig">保存</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Button from '../ui/Button.vue';
import Modal from '../ui/Modal.vue';
import Select from '../ui/Select.vue';
import Slider from '../ui/Slider.vue';
import Input from '../ui/Input.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import { getComponent } from '../../utils/componentRegistry';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const DEFAULT_ORDER = ['gtao', 'ssao', 'sao', 'ssr', 'bloom', 'dof', 'sobel', 'pixel', 'fxaa'];

const effectMeta = {
    gtao: {
        label: 'GTAO',
        description: '高质量环境光遮蔽，层次感更强'
    },
    ssao: {
        label: 'SSAO',
        description: '轻量环境光遮蔽，成本低于 GTAO / SAO'
    },
    sao: {
        label: 'SAO',
        description: '屏幕空间环境光遮蔽，效果更厚重'
    },
    ssr: {
        label: 'SSR',
        description: '屏幕空间反射，适合地面和金属反射'
    },
    bloom: {
        label: 'Bloom',
        description: '泛光，高亮区域发光扩散'
    },
    dof: {
        label: 'DOF',
        description: '景深虚化，基于焦点距离控制清晰范围'
    },
    sobel: {
        label: 'Sobel',
        description: '边缘检测，适合轮廓强化'
    },
    pixel: {
        label: 'Pixel',
        description: '像素化，降低采样精度形成颗粒风格'
    },
    fxaa: {
        label: 'FXAA',
        description: '快速抗锯齿，适合作为尾部平滑'
    }
};

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

const showPipelineModal = ref(false);
const showEffectModal = ref(false);
const draftPipeline = ref([...DEFAULT_ORDER]);
const draftEnabled = ref({});
const editingEffectType = ref('');
const effectDraft = ref({});

const component = computed(() => {
    return componentStore.components.find((item) => item.id === props.componentId) || null;
});

const config = computed(() => component.value?.config || {});

const registryEntry = computed(() => getComponent('PostProcessing'));
const postProcessingSchema = computed(() => registryEntry.value?.metadata?.configSchema || []);

const normalizedPipeline = computed(() => {
    const middle = [];
    const source = Array.isArray(config.value.pipeline) ? config.value.pipeline : [];

    source.forEach((entry) => {
        const type = String(entry || '').trim();
        if (!DEFAULT_ORDER.includes(type) || middle.includes(type)) {
            return;
        }
        middle.push(type);
    });

    DEFAULT_ORDER.forEach((type) => {
        if (!middle.includes(type)) {
            middle.push(type);
        }
    });

    return middle;
});

const enabledMap = computed(() => ({
    gtao: config.value?.gtao?.enabled === true || config.value?.ao?.enabled === true,
    ssao: config.value?.ssao?.enabled === true,
    sao: config.value?.sao?.enabled === true,
    ssr: config.value?.ssr?.enabled === true,
    bloom: config.value?.bloom?.enabled === true,
    dof: config.value?.dof?.enabled === true,
    sobel: config.value?.sobel?.enabled === true,
    pixel: config.value?.pixel?.enabled === true,
    fxaa: config.value?.fxaa?.enabled === true
}));

const orderedEffects = computed(() => {
    return normalizedPipeline.value.map((type) => ({
        type,
        label: effectMeta[type].label,
        description: effectMeta[type].description,
        enabled: enabledMap.value[type] === true
    }));
});

const enabledCount = computed(() => orderedEffects.value.filter((item) => item.enabled).length);

const effectEditorTitle = computed(() => {
    if (!editingEffectType.value) {
        return '编辑效果';
    }
    return `编辑 ${effectMeta[editingEffectType.value]?.label || editingEffectType.value}`;
});

const currentEffectFields = computed(() => {
    const type = editingEffectType.value;
    if (!type) {
        return [];
    }

    return postProcessingSchema.value.filter((field) => {
        if (field.hidden) {
            return false;
        }
        return String(field.key || '').startsWith(`${type}.`);
    });
});

const cloneValue = (value) => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const setNestedValue = (target, path, value) => {
    const parts = String(path || '').split('.').filter(Boolean);
    if (parts.length === 0) {
        return;
    }

    let cursor = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
};

const getNestedValue = (target, path, fallback = undefined) => {
    const parts = String(path || '').split('.').filter(Boolean);
    let cursor = target;
    for (const key of parts) {
        if (cursor == null) {
            return fallback;
        }
        cursor = cursor[key];
    }
    return cursor === undefined ? fallback : cursor;
};

const getFieldLocalPath = (field) => {
    const type = editingEffectType.value;
    return String(field.key || '').replace(new RegExp(`^${type}\\.`), '');
};

const getDraftFieldValue = (field) => {
    const localPath = getFieldLocalPath(field);
    return getNestedValue(effectDraft.value, localPath, field.default);
};

const updateDraftField = (field, value) => {
    const localPath = getFieldLocalPath(field);
    const next = cloneValue(effectDraft.value || {});
    setNestedValue(next, localPath, value);
    effectDraft.value = next;
};

const openPipelineModal = () => {
    draftPipeline.value = [...normalizedPipeline.value];
    draftEnabled.value = {
        ...enabledMap.value
    };
    showPipelineModal.value = true;
};

const moveEffect = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= draftPipeline.value.length) {
        return;
    }

    const next = [...draftPipeline.value];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    draftPipeline.value = next;
};

const updateRootEnabled = async (enabled) => {
    await updateComponentConfig(props.componentId, {
        enabled: enabled !== false
    });
    toast.success(enabled ? '已启用后期处理' : '已停用后期处理');
};

const toggleEffectEnabled = async (type, enabled) => {
    const currentConfig = config.value?.[type] || {};
    await updateComponentConfig(props.componentId, {
        [type]: {
            ...cloneValue(currentConfig),
            enabled: enabled === true
        }
    });
};

const openEffectEditor = (type) => {
    editingEffectType.value = type;
    effectDraft.value = cloneValue(config.value?.[type] || {});
    if (effectDraft.value.enabled === undefined) {
        effectDraft.value.enabled = enabledMap.value[type] === true;
    }
    showEffectModal.value = true;
};

const saveEffectConfig = async () => {
    const type = editingEffectType.value;
    if (!type) {
        return;
    }

    await updateComponentConfig(props.componentId, {
        [type]: cloneValue(effectDraft.value)
    });

    showEffectModal.value = false;
    toast.success(`${effectMeta[type].label} 参数已更新`);
};

const resetPipelineOrder = async () => {
    await updateComponentConfig(props.componentId, {
        pipeline: ['render', ...DEFAULT_ORDER, 'output']
    });
    toast.success('已恢复默认后期顺序');
};

const savePipelineConfig = async () => {
    const currentConfig = config.value || {};

    await updateComponentConfig(props.componentId, {
        pipeline: ['render', ...draftPipeline.value, 'output'],
        gtao: {
            ...(cloneValue(currentConfig.gtao) || cloneValue(currentConfig.ao) || {}),
            enabled: draftEnabled.value.gtao === true
        },
        ssao: {
            ...(cloneValue(currentConfig.ssao) || {}),
            enabled: draftEnabled.value.ssao === true
        },
        sao: {
            ...(cloneValue(currentConfig.sao) || {}),
            enabled: draftEnabled.value.sao === true
        },
        ssr: {
            ...(cloneValue(currentConfig.ssr) || {}),
            enabled: draftEnabled.value.ssr === true
        },
        bloom: {
            ...(cloneValue(currentConfig.bloom) || {}),
            enabled: draftEnabled.value.bloom === true
        },
        dof: {
            ...(cloneValue(currentConfig.dof) || {}),
            enabled: draftEnabled.value.dof === true
        },
        sobel: {
            ...(cloneValue(currentConfig.sobel) || {}),
            enabled: draftEnabled.value.sobel === true
        },
        pixel: {
            ...(cloneValue(currentConfig.pixel) || {}),
            enabled: draftEnabled.value.pixel === true
        },
        fxaa: {
            ...(cloneValue(currentConfig.fxaa) || {}),
            enabled: draftEnabled.value.fxaa === true
        }
    });

    showPipelineModal.value = false;
    toast.success('后期链路已更新');
};
</script>

<style scoped>
.post-processing-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.action-buttons {
    display: flex;
    gap: 8px;
}

.section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-secondary);
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.section-meta {
    font-size: 12px;
    color: var(--color-text-secondary);
}

.section-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-primary);
}

.effect-list,
.pipeline-modal__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.effect-row,
.pipeline-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.effect-row--disabled {
    opacity: 0.72;
}

.effect-row__order,
.pipeline-row__order {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 600;
}

.effect-row__main,
.pipeline-row__main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.effect-row__title,
.pipeline-row__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.effect-row__desc,
.pipeline-row__desc,
.pipeline-anchor__desc,
.pipeline-note,
.effect-editor-modal__desc {
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
}

.effect-row__toggle,
.pipeline-row__toggle,
.field-boolean {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-primary);
    white-space: nowrap;
}

.effect-row__actions,
.pipeline-row__actions {
    display: inline-flex;
    gap: 8px;
}

.pipeline-modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.pipeline-modal__anchors {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.pipeline-anchor {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px dashed var(--color-border);
    background: var(--color-bg-secondary);
}

.pipeline-anchor__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.effect-editor-modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.effect-editor-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.field-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-primary);
}

@media (max-width: 768px) {
    .pipeline-modal__anchors {
        grid-template-columns: 1fr;
    }

    .effect-row,
    .pipeline-row {
        grid-template-columns: 32px minmax(0, 1fr);
    }

    .effect-row__toggle,
    .effect-row__actions,
    .pipeline-row__toggle,
    .pipeline-row__actions {
        grid-column: 2;
    }
}
</style>
