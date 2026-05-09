<template>
    <div class="scene-settings">
        <div class="settings-content">
            <Accordion :items="accordionItems" :default-open="['renderer', 'camera']">
                <template #renderer>
                    <div class="settings-group">
                        <div class="setting-item-inline">
                            <label>抗锯齿</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.renderer.antialias"
                                @change="updateRenderer('antialias', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>阴影</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.renderer.shadowEnabled"
                                @change="updateRenderer('shadowEnabled', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item">
                            <label>输出色彩空间</label>
                            <Select
                                :model-value="sceneConfig.renderer.outputColorSpace"
                                @update:model-value="updateRenderer('outputColorSpace', $event)"
                                :options="colorSpaceOptions"
                            />
                        </div>
                    </div>
                </template>

                <template #camera>
                    <div class="settings-group">
                        <div class="setting-item">
                            <label>投影类型</label>
                            <Select
                                :model-value="sceneConfig.camera.type"
                                @update:model-value="updateCamera('type', $event)"
                                :options="cameraTypeOptions"
                            />
                        </div>
                        <div v-if="sceneConfig.camera.type === 'perspective'" class="setting-item">
                            <label>视野角度 (FOV)</label>
                            <Slider
                                :model-value="sceneConfig.camera.fov"
                                @update:model-value="updateCamera('fov', $event)"
                                :min="10"
                                :max="120"
                                :step="1"
                            />
                        </div>
                        <div class="setting-item">
                            <label>近裁剪面 (near)</label>
                            <Input
                                type="number"
                                :model-value="sceneConfig.camera.near"
                                @update:model-value="updateCameraNear($event)"
                                placeholder="0.1"
                                :step="0.01"
                                :min="0.001"
                            />
                        </div>
                        <div class="setting-item">
                            <label>相机位置</label>
                            <div class="vector3-inputs">
                                <Input
                                    type="number"
                                    :model-value="sceneConfig.camera.position[0]"
                                    @update:model-value="updateCameraPosition(0, $event)"
                                    placeholder="X"
                                    :step="0.1"
                                />
                                <Input
                                    type="number"
                                    :model-value="sceneConfig.camera.position[1]"
                                    @update:model-value="updateCameraPosition(1, $event)"
                                    placeholder="Y"
                                    :step="0.1"
                                />
                                <Input
                                    type="number"
                                    :model-value="sceneConfig.camera.position[2]"
                                    @update:model-value="updateCameraPosition(2, $event)"
                                    placeholder="Z"
                                    :step="0.1"
                                />
                            </div>
                        </div>
                        <div class="setting-item">
                            <label>目标点</label>
                            <div class="vector3-inputs">
                                <Input
                                    type="number"
                                    :model-value="sceneConfig.camera.lookAt[0]"
                                    @update:model-value="updateCameraLookAt(0, $event)"
                                    placeholder="X"
                                    :step="0.1"
                                />
                                <Input
                                    type="number"
                                    :model-value="sceneConfig.camera.lookAt[1]"
                                    @update:model-value="updateCameraLookAt(1, $event)"
                                    placeholder="Y"
                                    :step="0.1"
                                />
                                <Input
                                    type="number"
                                    :model-value="sceneConfig.camera.lookAt[2]"
                                    @update:model-value="updateCameraLookAt(2, $event)"
                                    placeholder="Z"
                                    :step="0.1"
                                />
                            </div>
                        </div>
                    </div>
                </template>

                <template #background>
                    <div class="settings-group">
                        <div class="setting-item">
                            <label>背景类型</label>
                            <Select
                                :model-value="sceneConfig.background.type"
                                @update:model-value="updateBackground('type', $event)"
                                :options="backgroundTypeOptions"
                            />
                        </div>
                        <div v-if="sceneConfig.background.type === 'color'" class="setting-item">
                            <label>背景颜色</label>
                            <ColorPicker
                                :model-value="sceneConfig.background.color"
                                @update:model-value="updateBackground('color', $event)"
                            />
                        </div>
                        <div v-if="sceneConfig.background.type === 'gradient'" class="setting-item">
                            <label>顶部颜色</label>
                            <ColorPicker
                                :model-value="sceneConfig.background.gradientTop"
                                @update:model-value="updateBackground('gradientTop', $event)"
                            />
                        </div>
                        <div v-if="sceneConfig.background.type === 'gradient'" class="setting-item">
                            <label>底部颜色</label>
                            <ColorPicker
                                :model-value="sceneConfig.background.gradientBottom"
                                @update:model-value="updateBackground('gradientBottom', $event)"
                            />
                        </div>
                        <div v-if="sceneConfig.background.type === 'hdr'" class="setting-item">
                            <label>HDR URL</label>
                            <div class="row-gap">
                                <Input
                                    :model-value="sceneConfig.background.hdrUrl"
                                    @update:model-value="updateBackground('hdrUrl', $event)"
                                    placeholder="/hdr/environment.hdr"
                                />
                                <Button variant="outline" size="sm" @click="openAssetPicker('hdr')">
                                    选择
                                </Button>
                            </div>
                        </div>

                        <div v-if="sceneConfig.background.type === 'image'" class="setting-item">
                            <label>图片 URL</label>
                            <div class="row-gap">
                                <Input
                                    :model-value="sceneConfig.background.imageUrl"
                                    @update:model-value="updateBackground('imageUrl', $event)"
                                    placeholder="/images/background.png"
                                />
                                <Button variant="outline" size="sm" @click="openAssetPicker('image')">
                                    选择
                                </Button>
                            </div>
                        </div>
                    </div>
                </template>

                <template #controls>
                    <div class="settings-group">
                        <div class="setting-item-inline">
                            <label>阻尼</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.controls.enableDamping"
                                @change="updateControls('enableDamping', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item">
                            <label>阻尼系数</label>
                            <Slider
                                :model-value="sceneConfig.controls.dampingFactor"
                                @update:model-value="updateControls('dampingFactor', $event)"
                                :min="0"
                                :max="0.2"
                                :step="0.001"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>缩放</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.controls.enableZoom"
                                @change="updateControls('enableZoom', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>旋转</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.controls.enableRotate"
                                @change="updateControls('enableRotate', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>平移</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.controls.enablePan"
                                @change="updateControls('enablePan', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>自动旋转</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.controls.autoRotate"
                                @change="updateControls('autoRotate', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item">
                            <label>自动旋转速度</label>
                            <Slider
                                :model-value="sceneConfig.controls.autoRotateSpeed"
                                @update:model-value="updateControls('autoRotateSpeed', $event)"
                                :min="0"
                                :max="10"
                                :step="0.1"
                            />
                        </div>
                        <div class="setting-item">
                            <label>最小距离</label>
                            <Input
                                type="number"
                                :model-value="sceneConfig.controls.minDistance"
                                @update:model-value="updateControls('minDistance', Number($event))"
                                :step="0.1"
                            />
                        </div>
                        <div class="setting-item">
                            <label>最大距离</label>
                            <Input
                                type="number"
                                :model-value="sceneConfig.controls.maxDistance"
                                @update:model-value="updateControls('maxDistance', Number($event))"
                                :step="0.1"
                            />
                        </div>
                    </div>
                </template>

                <template #helpers>
                    <div class="settings-group">
                        <div class="helpers-toolbar">
                            <div class="helpers-summary">
                                <strong>辅助显示</strong>
                                <span>{{ previewHint }}</span>
                            </div>
                            <Button variant="outline" size="sm" @click="resetHelpers">
                                重置默认值
                            </Button>
                        </div>

                        <div class="setting-tip">
                            编辑器内默认显示网格辅助。预览模式是否显示由“预览时隐藏”控制。
                        </div>

                        <div class="setting-item-inline">
                            <label>编辑网格</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.helpers.grid.enabled"
                                @change="updateGridHelper('enabled', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>预览时隐藏</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.helpers.grid.hideInPreview !== false"
                                @change="updateGridHelper('hideInPreview', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item">
                            <label>网格大小</label>
                            <Slider
                                :model-value="sceneConfig.helpers.grid.size"
                                @update:model-value="updateGridHelper('size', Number($event) || 200)"
                                :min="50"
                                :max="500"
                                :step="1"
                            />
                        </div>
                        <div class="setting-item">
                            <label>分割数量</label>
                            <Slider
                                :model-value="sceneConfig.helpers.grid.divisions"
                                @update:model-value="updateGridHelper('divisions', Number($event) || 30)"
                                :min="1"
                                :max="200"
                                :step="1"
                            />
                        </div>
                        <div class="setting-item">
                            <label>网格颜色</label>
                            <ColorPicker
                                :model-value="sceneConfig.helpers.grid.color"
                                @update:model-value="updateGridHelper('color', $event)"
                            />
                        </div>
                        <div class="setting-item-inline">
                            <label>坐标轴</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.helpers.axes.enabled"
                                @change="updateAxesHelper('enabled', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item">
                            <label>坐标轴大小</label>
                            <Slider
                                :model-value="sceneConfig.helpers.axes.size"
                                @update:model-value="updateAxesHelper('size', Number($event) || 5)"
                                :min="1"
                                :max="50"
                                :step="1"
                            />
                        </div>
                    </div>
                </template>

                <template #loading>
                    <div class="settings-group">
                        <div class="setting-item-inline">
                            <label>Loading 开关</label>
                            <input
                                type="checkbox"
                                :checked="sceneConfig.loading?.enabled !== false"
                                @change="updateLoading('enabled', $event.target.checked)"
                                class="checkbox"
                            />
                        </div>
                        <div class="setting-item">
                            <label>Loading 效果</label>
                            <Select
                                :model-value="sceneConfig.loading?.effect || 'spinner'"
                                @update:model-value="updateLoading('effect', $event)"
                                :options="loadingEffectOptions"
                            />
                        </div>
                    </div>
                </template>

                <template #pointGeo>
                    <BuildingPointCoordinateSettings />
                </template>
            </Accordion>
        </div>

        <AssetPickerModal
            v-model="showAssetPicker"
            :category="assetPickerCategory"
            @select="handleAssetPicked"
        />
    </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useScene } from '../../composables/useScene';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Slider from '../ui/Slider.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import Accordion from '../ui/Accordion.vue';
import Button from '../ui/Button.vue';
import AssetPickerModal from './AssetPickerModal.vue';
import BuildingPointCoordinateSettings from './BuildingPointCoordinateSettings.vue';
import { cloneHelpersConfig, DEFAULT_HELPERS_CONFIG, syncSceneHelpers } from '../../utils/sceneHelpers';

const sceneStore = useSceneStore();
const historyStore = useHistoryStore();
const { updateBackground: applyBackground } = useScene();

const sceneConfig = computed(() => sceneStore.sceneConfig);
const previewHint = computed(() => {
    return sceneConfig.value.helpers.grid.hideInPreview !== false
        ? '当前预览模式会自动隐藏网格'
        : '当前预览模式会显示网格';
});

const accordionItems = [
    { key: 'renderer', label: '渲染器', icon: '' },
    { key: 'camera', label: '相机', icon: '' },
    { key: 'background', label: '背景', icon: '' },
    { key: 'controls', label: '控制器', icon: '' },
    { key: 'helpers', label: '辅助显示', icon: '' },
    { key: 'loading', label: 'Loading', icon: '' }
];

accordionItems.push({ key: 'pointGeo', label: '点位坐标转换', icon: '' });

const colorSpaceOptions = [
    { value: 'srgb', label: 'sRGB' },
    { value: 'linear', label: 'Linear' }
];

const cameraTypeOptions = [
    { value: 'perspective', label: '透视相机' },
    { value: 'orthographic', label: '正交相机' }
];

const backgroundTypeOptions = [
    { value: 'color', label: '纯色' },
    { value: 'gradient', label: '渐变' },
    { value: 'image', label: '图片' },
    { value: 'hdr', label: 'HDR' }
];

const loadingEffectOptions = [
    { value: 'spinner', label: '旋转圈' },
    { value: 'dots', label: '跳动点' },
    { value: 'pulse', label: '脉冲条' }
];

const updateRenderer = (key, value) => {
    sceneStore.updateRendererConfig({ [key]: value });
};

const updateCamera = (key, value) => {
    sceneStore.updateCameraConfig({ [key]: value });
};

const updateCameraNear = (value) => {
    const parsed = Number.parseFloat(value);
    sceneStore.updateCameraConfig({
        near: Number.isFinite(parsed) && parsed > 0 ? parsed : 0.1
    });
};

const updateCameraPosition = (index, value) => {
    const newPosition = [...sceneConfig.value.camera.position];
    newPosition[index] = parseFloat(value) || 0;
    sceneStore.updateCameraConfig({ position: newPosition });
};

const updateCameraLookAt = (index, value) => {
    const newLookAt = [...sceneConfig.value.camera.lookAt];
    newLookAt[index] = parseFloat(value) || 0;
    sceneStore.updateCameraConfig({ lookAt: newLookAt });
};

const updateBackground = (key, value) => {
    applyBackground({ [key]: value });
};

const updateControls = (key, value) => {
    sceneStore.updateControlsConfig({ [key]: value });
};

const updateLoading = (key, value) => {
    sceneStore.updateLoadingConfig({ [key]: value });
};

const applyHelpersConfig = async (helpers) => {
    const nextHelpers = cloneHelpersConfig(helpers);
    sceneStore.updateHelpersConfig(nextHelpers);

    if (sceneStore.sceneInstance) {
        await syncSceneHelpers(sceneStore.sceneInstance, nextHelpers, { isPreview: false });
    }
};

const commitHelpersChange = async (name, updater) => {
    const before = cloneHelpersConfig(sceneConfig.value.helpers);
    const after = updater(cloneHelpersConfig(before));

    await historyStore.executeCommand({
        name,
        execute: async () => {
            await applyHelpersConfig(after);
        },
        undo: async () => {
            await applyHelpersConfig(before);
        }
    });
};

const updateGridHelper = (key, value) => {
    void commitHelpersChange(`更新网格设置: ${key}`, (helpers) => {
        helpers.grid[key] = value;
        return helpers;
    });
};

const updateAxesHelper = (key, value) => {
    void commitHelpersChange(`更新坐标轴设置: ${key}`, (helpers) => {
        helpers.axes[key] = value;
        return helpers;
    });
};

const resetHelpers = () => {
    void commitHelpersChange('重置辅助显示', () => cloneHelpersConfig(DEFAULT_HELPERS_CONFIG));
};

const showAssetPicker = ref(false);
const assetPickerCategory = ref('hdr');

const openAssetPicker = (category) => {
    assetPickerCategory.value = category;
    showAssetPicker.value = true;
};

const handleAssetPicked = (asset) => {
    if (!asset?.url) return;

    if (assetPickerCategory.value === 'hdr') {
        updateBackground('type', 'hdr');
        updateBackground('hdrUrl', asset.url);
        return;
    }

    if (assetPickerCategory.value === 'image') {
        updateBackground('type', 'image');
        updateBackground('imageUrl', asset.url);
    }
};
</script>

<style scoped>
.scene-settings {
    height: 100%;
    overflow-y: auto;
}

.settings-content {
    padding: 1rem;
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.setting-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
}

.setting-item label {
    font-weight: 500;
    color: var(--color-text-primary);
}

.setting-item-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
}

.setting-item-inline label {
    font-weight: 500;
    color: var(--color-text-primary);
}

.helpers-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.helpers-summary {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
}

.helpers-summary strong {
    color: var(--color-text-primary);
    font-size: 0.875rem;
}

.setting-tip {
    padding: 0.625rem 0.75rem;
    border-radius: var(--border-radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface-secondary, rgba(255, 255, 255, 0.04));
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    line-height: 1.5;
}

.checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: var(--border-radius-sm);
    border: 1px solid var(--color-border);
}

.vector3-inputs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
}

.row-gap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
</style>
