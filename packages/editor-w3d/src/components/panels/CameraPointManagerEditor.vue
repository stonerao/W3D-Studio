<template>
    <div class="cpm">
        <div class="cpm-meta">已配置点位：{{ points.length }} 个</div>
        <div class="cpm-actions">
            <Button size="sm" @click="openManager">管理点位</Button>
            <Button size="sm" variant="outline" @click="quickAddPoint">快速新增</Button>
            <Button size="sm" variant="outline" @click="openStyleManager">摄像头样式编辑</Button>
            <Button size="sm" variant="outline" @click="openEventManager">事件与弹窗配置</Button>
        </div>
        <div class="cpm-meta">样式类型：{{ styleEntries.length }} 个</div>

        <Modal v-model="showManager" title="摄像头点位管理" width="1080px" @close="stopPick">
            <div class="cpm-layout">
                <div class="cpm-side">
                    <Input
                        :model-value="keyword"
                        label="筛选"
                        placeholder="名称 / 类型 / 厂商"
                        @update:model-value="keyword = $event"
                    />
                    <div class="cpm-actions">
                        <Button size="sm" @click="addPoint">新增</Button>
                        <Button size="sm" variant="outline" @click="startPickNew">拾取新增</Button>
                    </div>
                    <div class="cpm-actions">
                        <Button size="sm" variant="outline" @click="triggerImport">导入 JSON</Button>
                        <Button size="sm" variant="outline" @click="exportPoints">导出 JSON</Button>
                    </div>
                    <input
                        ref="fileInputRef"
                        type="file"
                        accept=".json,application/json"
                        class="cpm-hidden"
                        @change="handleImportFile"
                    >

                    <div v-if="filteredPoints.length === 0" class="cpm-empty">暂无点位</div>
                    <button
                        v-for="point in filteredPoints"
                        :key="point.id"
                        type="button"
                        class="cpm-item"
                        :class="{ active: selectedPointId === point.id }"
                        @click="selectPoint(point.id)"
                    >
                        <div class="cpm-item__name">{{ point.name }}</div>
                        <div class="cpm-item__sub">{{ point.type }} / {{ getVendorLabel(point.vendor) }}</div>
                        <div class="cpm-item__sub">{{ point.videoFormat }} · {{ point.videoUrl || '未配置视频' }}</div>
                    </button>
                </div>

                <div class="cpm-main">
                    <div v-if="!draft" class="cpm-empty">请选择左侧点位，或新增一个摄像头点位。</div>
                    <div v-else class="cpm-form">
                        <div class="cpm-summary">
                            <div>ID：{{ draft.id }}</div>
                            <div>坐标：{{ formatPosition(draft.position) }}</div>
                            <div>视频：{{ draft.videoUrl || '未配置' }}</div>
                        </div>

                        <div class="cpm-grid cpm-grid--2">
                            <Input
                                :model-value="draft.name"
                                label="点位名称"
                                placeholder="同一组件内唯一"
                                :error="nameError"
                                @update:model-value="updateDraftField('name', $event)"
                            />
                            <Select
                                :model-value="draft.type"
                                label="摄像头样式"
                                :options="styleOptions"
                                @update:model-value="updateDraftField('type', $event)"
                            />
                        </div>

                        <div class="cpm-grid cpm-grid--2">
                            <Select
                                :model-value="draft.vendor"
                                label="监控厂商"
                                :options="vendorOptions"
                                @update:model-value="updateDraftField('vendor', $event)"
                            />
                            <Select
                                :model-value="draft.videoFormat"
                                label="视频流格式"
                                :options="videoFormatOptions"
                                @update:model-value="updateDraftField('videoFormat', $event)"
                            />
                        </div>

                        <div class="cpm-vec3">
                            <Input
                                type="number"
                                :model-value="draft.position[0]"
                                label="X"
                                @update:model-value="updateDraftPosition(0, $event)"
                            />
                            <Input
                                type="number"
                                :model-value="draft.position[1]"
                                label="Y"
                                @update:model-value="updateDraftPosition(1, $event)"
                            />
                            <Input
                                type="number"
                                :model-value="draft.position[2]"
                                label="Z"
                                @update:model-value="updateDraftPosition(2, $event)"
                            />
                        </div>

                        <div class="cpm-actions">
                            <Button size="sm" variant="outline" @click="startPickCurrent">拾取坐标</Button>
                            <Button size="sm" variant="outline" @click="stopPick">退出拾取</Button>
                        </div>

                        <Input
                            :model-value="draft.videoUrl"
                            label="视频 URL"
                            placeholder="输入视频流地址"
                            @update:model-value="updateDraftField('videoUrl', $event)"
                        />

                        <div class="cpm-section">
                            <div class="cpm-section__header">
                                <div class="cpm-section__title">视频信息</div>
                                <Button size="sm" variant="outline" @click="addVideoInfo">新增信息</Button>
                            </div>
                            <div v-if="draft.videoInfo.length === 0" class="cpm-empty cpm-empty--compact">暂无视频信息</div>
                            <div
                                v-for="(item, index) in draft.videoInfo"
                                :key="index"
                                class="cpm-info-row"
                            >
                                <Input
                                    :model-value="item.label"
                                    placeholder="字段名"
                                    @update:model-value="updateVideoInfo(index, 'label', $event)"
                                />
                                <Input
                                    :model-value="item.value"
                                    placeholder="字段值"
                                    @update:model-value="updateVideoInfo(index, 'value', $event)"
                                />
                                <Button size="sm" variant="danger" @click="removeVideoInfo(index)">删除</Button>
                            </div>
                        </div>

                        <div class="cpm-actions cpm-actions--footer">
                            <Button variant="primary" @click="saveDraft">保存点位</Button>
                            <Button variant="outline" @click="resetDraft">重置</Button>
                            <Button variant="danger" @click="removePoint(draft.id)">删除</Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>

        <Modal v-model="showStyleManager" title="摄像头样式编辑" width="1080px">
            <div class="cpm-layout">
                <div class="cpm-side">
                    <div class="cpm-actions">
                        <Button size="sm" @click="addStyle">新增样式</Button>
                    </div>
                    <div v-if="styleEntries.length === 0" class="cpm-empty">暂无样式，点击新增样式。</div>
                    <button
                        v-for="style in styleEntries"
                        :key="style.id"
                        type="button"
                        class="cpm-item"
                        :class="{ active: selectedStyleId === style.id }"
                        @click="selectStyle(style.id)"
                    >
                        <div class="cpm-item__name">{{ style.name || style.id }}</div>
                        <div class="cpm-item__sub">type：{{ style.id }}</div>
                        <div class="cpm-item__sub">
                            图片 {{ style.image.enabled ? '开' : '关' }} /
                            模型 {{ style.model.enabled ? '开' : '关' }} /
                            名称 {{ style.label.enabled ? '显示' : '隐藏' }}
                        </div>
                    </button>
                </div>

                <div class="cpm-main">
                    <div v-if="!styleDraft" class="cpm-empty">请选择或新增一个摄像头样式。</div>
                    <div v-else class="cpm-form">
                        <div class="cpm-grid cpm-grid--2">
                            <Input
                                :model-value="styleDraft.id"
                                label="样式 type"
                                placeholder="与点位 type 对应"
                                @update:model-value="updateStyleField('id', $event)"
                            />
                            <Input
                                :model-value="styleDraft.name"
                                label="样式名称"
                                @update:model-value="updateStyleField('name', $event)"
                            />
                        </div>

                        <label class="cpm-check">
                            <input
                                type="checkbox"
                                :checked="styleDraft.label.enabled"
                                @change="updateStyleLabelEnabled($event.target.checked)"
                            >
                            <span>显示点位名称</span>
                        </label>

                        <div class="cpm-section">
                            <div class="cpm-section__header">
                                <div class="cpm-section__title">图片样式</div>
                                <label class="cpm-check">
                                    <input
                                        type="checkbox"
                                        :checked="styleDraft.image.enabled"
                                        @change="updateStyleNested('image', 'enabled', $event.target.checked)"
                                    >
                                    <span>启用图片</span>
                                </label>
                            </div>
                            <div class="cpm-grid cpm-grid--2">
                                <div class="cpm-url">
                                    <Input
                                        :model-value="styleDraft.image.url"
                                        label="图片 URL"
                                        @update:model-value="updateStyleNested('image', 'url', $event)"
                                    />
                                    <Button size="sm" variant="outline" @click="openStyleAssetPicker('image')">选择</Button>
                                </div>
                                <Select
                                    :model-value="styleDraft.image.renderMode"
                                    label="图片类型"
                                    :options="imageRenderModeOptions"
                                    @update:model-value="updateStyleNested('image', 'renderMode', $event)"
                                />
                            </div>
                            <div class="cpm-vec3">
                                <Input
                                    type="number"
                                    :model-value="styleDraft.image.size"
                                    label="图片大小"
                                    @update:model-value="updateStyleNested('image', 'size', toNumber($event, 1))"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.image.offset[0]"
                                    label="偏移 X"
                                    @update:model-value="updateStyleVec3('image', 'offset', 0, $event)"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.image.offset[1]"
                                    label="偏移 Y"
                                    @update:model-value="updateStyleVec3('image', 'offset', 1, $event)"
                                />
                            </div>
                            <div class="cpm-vec3">
                                <Input
                                    type="number"
                                    :model-value="styleDraft.image.offset[2]"
                                    label="偏移 Z"
                                    @update:model-value="updateStyleVec3('image', 'offset', 2, $event)"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.image.center[0]"
                                    label="Sprite Center X"
                                    :disabled="styleDraft.image.renderMode !== 'sprite'"
                                    @update:model-value="updateStyleVec2('image', 'center', 0, $event)"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.image.center[1]"
                                    label="Sprite Center Y"
                                    :disabled="styleDraft.image.renderMode !== 'sprite'"
                                    @update:model-value="updateStyleVec2('image', 'center', 1, $event)"
                                />
                            </div>
                        </div>

                        <div class="cpm-section">
                            <div class="cpm-section__header">
                                <div class="cpm-section__title">模型样式</div>
                                <label class="cpm-check">
                                    <input
                                        type="checkbox"
                                        :checked="styleDraft.model.enabled"
                                        @change="updateStyleNested('model', 'enabled', $event.target.checked)"
                                    >
                                    <span>启用模型</span>
                                </label>
                            </div>
                            <div class="cpm-grid cpm-grid--2">
                                <div class="cpm-url">
                                    <Input
                                        :model-value="styleDraft.model.url"
                                        label="模型 URL"
                                        @update:model-value="updateStyleNested('model', 'url', $event)"
                                    />
                                    <Button size="sm" variant="outline" @click="openStyleAssetPicker('model')">选择</Button>
                                </div>
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.fitSize"
                                    label="拟合尺寸"
                                    @update:model-value="updateStyleNested('model', 'fitSize', toNumber($event, 1))"
                                />
                            </div>
                            <div class="cpm-vec3">
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.scale"
                                    label="模型缩放"
                                    @update:model-value="updateStyleNested('model', 'scale', toNumber($event, 1))"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.offset[0]"
                                    label="偏移 X"
                                    @update:model-value="updateStyleVec3('model', 'offset', 0, $event)"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.offset[1]"
                                    label="偏移 Y"
                                    @update:model-value="updateStyleVec3('model', 'offset', 1, $event)"
                                />
                            </div>
                            <div class="cpm-vec3">
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.offset[2]"
                                    label="偏移 Z"
                                    @update:model-value="updateStyleVec3('model', 'offset', 2, $event)"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.rotation[0]"
                                    label="旋转 X"
                                    @update:model-value="updateStyleVec3('model', 'rotation', 0, $event)"
                                />
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.rotation[1]"
                                    label="旋转 Y"
                                    @update:model-value="updateStyleVec3('model', 'rotation', 1, $event)"
                                />
                            </div>
                            <div class="cpm-grid cpm-grid--2">
                                <Input
                                    type="number"
                                    :model-value="styleDraft.model.rotation[2]"
                                    label="旋转 Z"
                                    @update:model-value="updateStyleVec3('model', 'rotation', 2, $event)"
                                />
                            </div>
                        </div>

                        <div class="cpm-actions cpm-actions--footer">
                            <Button variant="primary" @click="saveStyleDraft">保存样式</Button>
                            <Button variant="outline" @click="resetStyleDraft">重置</Button>
                            <Button variant="danger" @click="removeStyle(styleDraft.id)">删除</Button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>

        <Modal v-model="showEventManager" title="事件与弹窗配置" width="720px">
            <div v-if="eventDraft" class="cpm-form">
                <div class="cpm-section">
                    <div class="cpm-section__title">触发事件</div>
                    <label class="cpm-check">
                        <input
                            type="checkbox"
                            :checked="eventDraft.eventConfig.click.enabled"
                            @change="updateEventEnabled('click', $event.target.checked)"
                        >
                        <span>单击点位后弹窗展示视频流</span>
                    </label>
                    <label class="cpm-check">
                        <input
                            type="checkbox"
                            :checked="eventDraft.eventConfig.dblclick.enabled"
                            @change="updateEventEnabled('dblclick', $event.target.checked)"
                        >
                        <span>双击点位后弹窗展示视频流</span>
                    </label>
                    <div class="cpm-meta">如果同时启用单击和双击，单击会短暂等待以避免双击时重复弹窗。</div>
                </div>

                <div class="cpm-section">
                    <div class="cpm-section__title">弹窗样式与位置</div>
                    <div class="cpm-grid cpm-grid--2">
                        <Select
                            :model-value="eventDraft.videoModalStyle.preset"
                            label="视频弹窗样式"
                            :options="modalPresetOptions"
                            @update:model-value="updateModalPreset"
                        />
                        <Select
                            :model-value="eventDraft.videoModalStyle.placement"
                            label="弹窗显示位置"
                            :options="modalPlacementOptions"
                            @update:model-value="updateModalStyleField('placement', $event)"
                        />
                    </div>
                    <div class="cpm-grid cpm-grid--2">
                        <Input
                            type="number"
                            :model-value="eventDraft.videoModalStyle.width"
                            label="视频宽度(px)"
                            @update:model-value="updateModalStyleField('width', $event)"
                        />
                        <Input
                            type="number"
                            :model-value="eventDraft.videoModalStyle.height"
                            label="视频高度(px，0自动)"
                            @update:model-value="updateModalStyleField('height', $event)"
                        />
                    </div>
                    <div class="cpm-grid cpm-grid--2">
                        <Input
                            type="number"
                            :model-value="eventDraft.videoModalStyle.left"
                            label="固定 Left(px)"
                            :disabled="eventDraft.videoModalStyle.placement !== 'fixed'"
                            @update:model-value="updateModalStyleField('left', $event)"
                        />
                        <Input
                            type="number"
                            :model-value="eventDraft.videoModalStyle.top"
                            label="固定 Top(px)"
                            :disabled="eventDraft.videoModalStyle.placement !== 'fixed'"
                            @update:model-value="updateModalStyleField('top', $event)"
                        />
                    </div>
                    <div class="cpm-meta">“鼠标当前位置”按触发点击时的屏幕坐标定位；“固定位置”使用 left/top。</div>
                </div>

                <div class="cpm-actions cpm-actions--footer">
                    <Button variant="primary" @click="saveEventDraft">保存配置</Button>
                    <Button variant="outline" @click="resetEventDraft">重置</Button>
                </div>
            </div>
        </Modal>

        <Modal v-model="showPickConfirm" title="确认拾取坐标" width="420px" @close="cancelPickConfirm">
            <div class="cpm-form">
                <div class="cpm-empty">
                    {{ pickConfirmPointId ? '已拾取到坐标，确认写入当前点位？' : '已拾取到坐标，确认新增摄像头点位？' }}
                </div>
                <div class="cpm-vec3">
                    <Input :model-value="String(pickConfirmXyz[0])" label="X" disabled />
                    <Input :model-value="String(pickConfirmXyz[1])" label="Y" disabled />
                    <Input :model-value="String(pickConfirmXyz[2])" label="Z" disabled />
                </div>
            </div>
            <template #footer>
                <div class="cpm-actions">
                    <Button variant="outline" @click="cancelPickConfirm">取消</Button>
                    <Button @click="confirmPickConfirm">确认</Button>
                </div>
            </template>
        </Modal>

        <AssetPickerModal
            v-model="showAssetPicker"
            :category="assetPickerCategory"
            @select="handleAssetSelect"
        />
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Modal from '../ui/Modal.vue';
import AssetPickerModal from './AssetPickerModal.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';

const props = defineProps({ componentId: { type: String, required: true } });

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

const showManager = ref(false);
const showStyleManager = ref(false);
const showEventManager = ref(false);
const showPickConfirm = ref(false);
const showAssetPicker = ref(false);
const assetPickerCategory = ref('image');
const assetPickerTarget = ref('');
const selectedPointId = ref('');
const selectedStyleId = ref('');
const keyword = ref('');
const draft = ref(null);
const styleDraft = ref(null);
const eventDraft = ref(null);
const draftDirty = ref(false);
const styleDraftDirty = ref(false);
const nameError = ref('');
const fileInputRef = ref(null);

const videoFormatOptions = [
    { label: 'MP4', value: 'mp4' },
    { label: 'FLV', value: 'flv' },
    { label: 'WS-FLV', value: 'ws-flv' },
    { label: 'HLS / M3U8', value: 'hls' },
    { label: 'RTSP', value: 'rtsp' },
    { label: 'RTMP', value: 'rtmp' },
    { label: 'WebRTC', value: 'webrtc' }
];

const vendorOptions = [
    { label: '通用', value: 'generic' },
    { label: '海康威视', value: 'hikvision' },
    { label: '大华', value: 'dahua' },
    { label: '宇视', value: 'uniview' },
    { label: '华为', value: 'huawei' },
    { label: '天地伟业', value: 'tiandy' },
    { label: '自定义', value: 'custom' }
];

const imageRenderModeOptions = [
    { label: 'Sprite', value: 'sprite' },
    { label: 'Plane', value: 'plane' }
];

const modalPresetOptions = [
    { label: '深色监控', value: 'dark' },
    { label: '浅色面板', value: 'light' },
    { label: '玻璃拟态', value: 'glass' },
    { label: '安防绿', value: 'security' }
];

const modalPlacementOptions = [
    { label: '屏幕中间', value: 'center' },
    { label: '鼠标当前位置', value: 'cursor' },
    { label: '固定位置', value: 'fixed' }
];

const videoFormatValues = new Set(videoFormatOptions.map((item) => item.value));
const vendorValues = new Set(vendorOptions.map((item) => item.value));

const normalizeText = (value, fallback = '') => {
    const text = value === null || value === undefined ? '' : String(value).trim();
    return text || fallback;
};

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const round4 = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
};

const vec3 = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [round4(toNumber(value[0], fallback[0])), round4(toNumber(value[1], fallback[1])), round4(toNumber(value[2], fallback[2]))];
    }
    if (value && typeof value === 'object') {
        return [round4(toNumber(value.x, fallback[0])), round4(toNumber(value.y, fallback[1])), round4(toNumber(value.z, fallback[2]))];
    }
    return [...fallback];
};

const vec2 = (value, fallback = [0, 0]) => {
    if (Array.isArray(value)) {
        return [round4(toNumber(value[0], fallback[0])), round4(toNumber(value[1], fallback[1]))];
    }
    if (value && typeof value === 'object') {
        return [round4(toNumber(value.x, fallback[0])), round4(toNumber(value.y, fallback[1]))];
    }
    return [...fallback];
};

const normalizeVideoFormat = (value, fallback = 'hls') => {
    const raw = normalizeText(value, fallback).toLowerCase();
    const format = raw === 'm3u8' ? 'hls' : raw;
    return videoFormatValues.has(format) ? format : fallback;
};

const inferVideoFormatFromUrl = (value) => {
    const url = normalizeText(value).toLowerCase();
    if (!url) return '';
    if (url.startsWith('rtsp://')) return 'rtsp';
    if (url.startsWith('rtmp://')) return 'rtmp';
    if (url.startsWith('webrtc://')) return 'webrtc';

    try {
        const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
        const pathname = new URL(url, base).pathname.toLowerCase();
        if (pathname.endsWith('.m3u8')) return 'hls';
        if (pathname.endsWith('.mp4')) return 'mp4';
        if (pathname.endsWith('.flv')) return 'flv';
    } catch {
        const path = url.split(/[?#]/)[0] || '';
        if (path.endsWith('.m3u8')) return 'hls';
        if (path.endsWith('.mp4')) return 'mp4';
        if (path.endsWith('.flv')) return 'flv';
    }

    return '';
};

const resolveVideoFormat = (format, url, fallback = 'hls') => {
    const configured = normalizeVideoFormat(format, '');
    const inferred = inferVideoFormatFromUrl(url);
    if (inferred && (!configured || configured === 'hls')) return inferred;
    return configured || inferred || fallback;
};

const normalizeVendor = (value) => {
    const vendor = normalizeText(value, 'generic');
    return vendorValues.has(vendor) ? vendor : 'custom';
};

const normalizeEventConfig = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
        click: {
            enabled: source.click?.enabled !== false,
            action: 'openVideo'
        },
        dblclick: {
            enabled: source.dblclick?.enabled === true,
            action: 'openVideo'
        }
    };
};

const normalizeVideoModalStyle = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    const preset = normalizeText(source.preset, 'dark');
    const placement = normalizeText(source.placement, 'center');
    return {
        preset: modalPresetOptions.some((item) => item.value === preset) ? preset : 'dark',
        placement: modalPlacementOptions.some((item) => item.value === placement) ? placement : 'center',
        left: Math.max(0, Math.round(toNumber(source.left, 120))),
        top: Math.max(0, Math.round(toNumber(source.top, 120))),
        width: Math.max(320, Math.round(toNumber(source.width, 920))),
        height: Math.max(0, Math.round(toNumber(source.height, 0)))
    };
};

const normalizeVideoInfo = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => {
            if (item && typeof item === 'object') {
                const label = normalizeText(item.label ?? item.name ?? item.key);
                const itemValue = normalizeText(item.value ?? item.text ?? item.content);
                if (!label && !itemValue) return null;
                return {
                    label: label || `信息${index + 1}`,
                    value: itemValue
                };
            }
            const itemValue = normalizeText(item);
            if (!itemValue) return null;
            return {
                label: `信息${index + 1}`,
                value: itemValue
            };
        })
        .filter(Boolean)
        .filter((item) => item.label || item.value);
};

const normalizePoint = (point, index = 0) => {
    const source = point && typeof point === 'object' ? point : {};
    const legacyVideo = source.video && typeof source.video === 'object' ? source.video : {};
    const legacyInfo = source.data && typeof source.data === 'object' ? source.data.videoInfo : null;
    const videoUrl = normalizeText(source.videoUrl ?? legacyVideo.url);
    return {
        id: normalizeText(source.id, `camera_point_${Date.now()}_${index}`),
        name: normalizeText(source.name, `摄像头点位${index + 1}`),
        position: vec3(source.position, [0, 0, 0]),
        type: normalizeText(source.type ?? source.typeId, 'default'),
        vendor: normalizeVendor(source.vendor),
        videoUrl,
        videoFormat: resolveVideoFormat(source.videoFormat ?? legacyVideo.format, videoUrl),
        videoInfo: normalizeVideoInfo(source.videoInfo ?? legacyInfo)
    };
};

const toPersistedPoint = (point, index = 0) => {
    const normalized = normalizePoint(point, index);
    return {
        id: normalized.id,
        name: normalized.name,
        position: [...normalized.position],
        type: normalized.type,
        vendor: normalized.vendor,
        videoUrl: normalized.videoUrl,
        videoFormat: normalized.videoFormat,
        videoInfo: normalized.videoInfo.map((item) => ({ ...item }))
    };
};

const normalizeImageStyle = (image = {}) => {
    const source = image && typeof image === 'object' ? image : {};
    const rawRenderMode = normalizeText(source.renderMode ?? source.mode, 'sprite').toLowerCase();
    return {
        enabled: source.enabled === true,
        url: normalizeText(source.url),
        renderMode: rawRenderMode === 'plane' || rawRenderMode === 'plan' ? 'plane' : 'sprite',
        size: toNumber(source.size, 1),
        center: vec2(source.center, [0.5, 0]),
        offset: vec3(source.offset, [0, 0, 0])
    };
};

const normalizeModelStyle = (model = {}) => {
    const source = model && typeof model === 'object' ? model : {};
    return {
        enabled: source.enabled === true,
        url: normalizeText(source.url),
        fitSize: toNumber(source.fitSize, 1),
        scale: toNumber(source.scale, 1),
        rotation: vec3(source.rotation, [0, 0, 0]),
        offset: vec3(source.offset, [0, 0, 0])
    };
};

const normalizeLabelStyle = (label = {}) => {
    const source = label && typeof label === 'object' ? label : {};
    return {
        enabled: source.enabled === true,
        usePointName: source.usePointName !== false,
        text: normalizeText(source.text),
        offset: vec3(source.offset, [0, 1.2, 0]),
        style: source.style && typeof source.style === 'object'
            ? JSON.parse(JSON.stringify(source.style))
            : {
                fontSize: 28,
                paddingX: 18,
                paddingY: 10,
                color: '#ffffff',
                backgroundColor: 'rgba(15, 23, 42, 0.78)',
                borderColor: 'rgba(148, 163, 184, 0.28)',
                borderWidth: 2
            }
    };
};

const normalizeStyle = (style = {}, index = 0) => {
    const source = style && typeof style === 'object' ? style : {};
    const id = normalizeText(source.id ?? source.type ?? source.typeId, index === 0 ? 'default' : `camera_style_${index + 1}`);
    return {
        id,
        name: normalizeText(source.name, id === 'default' ? '默认样式' : id),
        image: normalizeImageStyle(source.image),
        model: normalizeModelStyle(source.model),
        label: normalizeLabelStyle(source.label || (source.showName !== undefined ? {
            enabled: source.showName === true,
            usePointName: true
        } : {}))
    };
};

const toPersistedStyle = (style, index = 0) => {
    const normalized = normalizeStyle(style, index);
    return {
        id: normalized.id,
        name: normalized.name,
        image: {
            enabled: normalized.image.enabled,
            url: normalized.image.url,
            renderMode: normalized.image.renderMode,
            size: normalized.image.size,
            center: [...normalized.image.center],
            offset: [...normalized.image.offset]
        },
        model: {
            enabled: normalized.model.enabled,
            url: normalized.model.url,
            fitSize: normalized.model.fitSize,
            scale: normalized.model.scale,
            rotation: [...normalized.model.rotation],
            offset: [...normalized.model.offset]
        },
        label: {
            enabled: normalized.label.enabled,
            usePointName: true,
            text: '',
            offset: [...normalized.label.offset],
            style: { ...normalized.label.style }
        }
    };
};

const component = computed(() => {
    return (componentStore.components || []).find((item) => item.id === props.componentId) || null;
});

const points = computed(() => {
    return (Array.isArray(component.value?.config?.points) ? component.value.config.points : []).map((item, index) => normalizePoint(item, index));
});

const filteredPoints = computed(() => {
    const text = normalizeText(keyword.value).toLowerCase();
    if (!text) return points.value;
    return points.value.filter((item) => [
        item.name,
        item.id,
        item.type,
        item.vendor,
        item.videoFormat,
        item.videoUrl
    ].some((value) => String(value || '').toLowerCase().includes(text)));
});

const styleEntries = computed(() => {
    const config = component.value?.config || {};
    const entries = [];
    const seen = new Set();

    if (config.typeStyles && typeof config.typeStyles === 'object' && !Array.isArray(config.typeStyles)) {
        Object.entries(config.typeStyles).forEach(([id, style], index) => {
            const next = normalizeStyle({ id, ...(style && typeof style === 'object' ? style : {}) }, index);
            entries.push(next);
            seen.add(next.id);
        });
    }

    if (Array.isArray(config.types)) {
        config.types.forEach((style, index) => {
            const next = normalizeStyle(style, index);
            if (seen.has(next.id)) return;
            entries.push(next);
            seen.add(next.id);
        });
    }

    return entries;
});

const styleOptions = computed(() => {
    if (styleEntries.value.length === 0) {
        return [{ label: '默认样式 (default)', value: 'default' }];
    }
    return styleEntries.value.map((style) => ({
        label: `${style.name || style.id} (${style.id})`,
        value: style.id
    }));
});

const currentPoint = computed(() => points.value.find((item) => item.id === selectedPointId.value) || null);

const pickConfirm = computed(() => componentStore.buildingPickConfirm || {});
const pickConfirmPointId = computed(() => {
    return pickConfirm.value?.componentId === props.componentId ? String(pickConfirm.value?.pointId || '') : '';
});
const pickConfirmXyz = computed(() => {
    const confirm = pickConfirm.value;
    return confirm?.componentId === props.componentId && Array.isArray(confirm?.xyz) ? vec3(confirm.xyz, [0, 0, 0]) : [0, 0, 0];
});

const getVendorLabel = (vendor) => {
    return vendorOptions.find((item) => item.value === vendor)?.label || vendor || '通用';
};

const formatPosition = (position) => vec3(position, [0, 0, 0]).map((item) => item.toFixed(4)).join(', ');

const ensureSelected = () => {
    if (points.value.length === 0) {
        selectedPointId.value = '';
        draft.value = null;
        draftDirty.value = false;
        return;
    }
    if (!points.value.some((item) => item.id === selectedPointId.value)) {
        selectedPointId.value = points.value[0].id;
    }
};

const loadDraft = () => {
    draft.value = currentPoint.value ? toPersistedPoint(currentPoint.value) : null;
    draftDirty.value = false;
    nameError.value = '';
};

const selectPoint = (pointId) => {
    selectedPointId.value = pointId;
    loadDraft();
};

const validatePoints = (nextPoints) => {
    const seen = new Map();
    for (const rawPoint of nextPoints) {
        const rawName = normalizeText(rawPoint?.name);
        const point = normalizePoint(rawPoint);
        if (!rawName) return '点位名称不能为空';
        if (!point.type) return `点位“${point.name}”的 type 不能为空`;
        const key = point.name.toLowerCase();
        if (seen.has(key)) return `点位名称“${point.name}”重复`;
        seen.set(key, point.id);
    }
    return '';
};

const commitPoints = async (nextPoints, successText = '') => {
    const persisted = nextPoints.map((item, index) => toPersistedPoint(item, index));
    const error = validatePoints(persisted);
    if (error) {
        toast.error(error);
        return false;
    }
    await updateComponentConfig(props.componentId, { points: persisted });
    if (successText) toast.success(successText);
    return true;
};

const getNextPointName = () => {
    let index = points.value.length + 1;
    const names = new Set(points.value.map((point) => point.name.toLowerCase()));
    while (names.has(`摄像头点位${index}`.toLowerCase())) index += 1;
    return `摄像头点位${index}`;
};

const createPoint = (position = [0, 0, 0]) => toPersistedPoint({
    id: `camera_point_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: getNextPointName(),
    position,
    type: styleOptions.value[0]?.value || 'default',
    vendor: 'generic',
    videoUrl: '',
    videoFormat: 'hls',
    videoInfo: []
});

const getNextStyleId = () => {
    let index = styleEntries.value.length + 1;
    const ids = new Set(styleEntries.value.map((style) => style.id));
    while (ids.has(`camera_style_${index}`)) index += 1;
    return `camera_style_${index}`;
};

const createStyle = (style = {}) => toPersistedStyle({
    id: style.id || 'default',
    name: style.name || (style.id === 'default' ? '默认样式' : style.id || '默认样式'),
    image: {
        enabled: false,
        url: '',
        renderMode: 'sprite',
        size: 1,
        center: [0.5, 0],
        offset: [0, 0, 0]
    },
    model: {
        enabled: false,
        url: '',
        fitSize: 1,
        scale: 1,
        rotation: [0, 0, 0],
        offset: [0, 0, 0]
    },
    label: {
        enabled: false,
        usePointName: true,
        text: '',
        offset: [0, 1.2, 0]
    },
    ...style
});

const buildTypeStylesPayload = (nextEntries) => {
    return nextEntries.reduce((result, style, index) => {
        const persisted = toPersistedStyle(style, index);
        result[persisted.id] = persisted;
        return result;
    }, {});
};

const commitStyles = async (nextEntries, successText = '') => {
    const seen = new Set();
    const persisted = [];
    for (const rawStyle of nextEntries) {
        const style = toPersistedStyle(rawStyle, persisted.length);
        if (!style.id) {
            toast.error('样式 type 不能为空');
            return false;
        }
        if (seen.has(style.id)) {
            toast.error(`样式 type“${style.id}”重复`);
            return false;
        }
        seen.add(style.id);
        persisted.push(style);
    }
    await updateComponentConfig(props.componentId, { typeStyles: buildTypeStylesPayload(persisted) });
    if (successText) toast.success(successText);
    return true;
};

const loadStyleDraft = () => {
    const current = styleEntries.value.find((item) => item.id === selectedStyleId.value) || null;
    styleDraft.value = current ? toPersistedStyle(current) : null;
    styleDraftDirty.value = false;
};

const selectStyle = (styleId) => {
    selectedStyleId.value = styleId;
    loadStyleDraft();
};

const openStyleManager = () => {
    showStyleManager.value = true;
    if (styleEntries.value.length === 0) {
        const initial = createStyle({ id: 'default', name: '默认样式' });
        selectedStyleId.value = initial.id;
        styleDraft.value = initial;
        styleDraftDirty.value = false;
        return;
    }
    if (!styleEntries.value.some((style) => style.id === selectedStyleId.value)) {
        selectedStyleId.value = styleEntries.value[0].id;
    }
    loadStyleDraft();
};

const addStyle = () => {
    const nextId = styleEntries.value.length === 0 ? 'default' : getNextStyleId();
    const nextStyle = createStyle({ id: nextId, name: nextId === 'default' ? '默认样式' : nextId });
    selectedStyleId.value = nextStyle.id;
    styleDraft.value = nextStyle;
    styleDraftDirty.value = true;
};

const updateStyleField = (key, value) => {
    if (!styleDraft.value) return;
    styleDraft.value = { ...styleDraft.value, [key]: value };
    styleDraftDirty.value = true;
};

const updateStyleNested = (section, key, value) => {
    if (!styleDraft.value) return;
    styleDraft.value = {
        ...styleDraft.value,
        [section]: {
            ...(styleDraft.value[section] || {}),
            [key]: value
        }
    };
    styleDraftDirty.value = true;
};

const updateStyleVec3 = (section, key, index, value) => {
    if (!styleDraft.value) return;
    const current = vec3(styleDraft.value?.[section]?.[key], [0, 0, 0]);
    current[index] = round4(toNumber(value, current[index]));
    updateStyleNested(section, key, current);
};

const updateStyleVec2 = (section, key, index, value) => {
    if (!styleDraft.value) return;
    const current = vec2(styleDraft.value?.[section]?.[key], [0.5, 0]);
    current[index] = round4(toNumber(value, current[index]));
    updateStyleNested(section, key, current);
};

const updateStyleLabelEnabled = (enabled) => {
    updateStyleNested('label', 'enabled', enabled);
    updateStyleNested('label', 'usePointName', true);
};

const saveStyleDraft = async () => {
    if (!styleDraft.value) return;
    const nextStyle = toPersistedStyle(styleDraft.value);
    if (!normalizeText(nextStyle.id)) {
        toast.error('样式 type 不能为空');
        return;
    }

    const nextEntries = styleEntries.value
        .filter((style) => style.id !== selectedStyleId.value && style.id !== nextStyle.id)
        .map((style) => toPersistedStyle(style));
    nextEntries.push(nextStyle);

    const saved = await commitStyles(nextEntries, '已保存摄像头样式');
    if (!saved) return;
    selectedStyleId.value = nextStyle.id;
    styleDraft.value = toPersistedStyle(nextStyle);
    styleDraftDirty.value = false;
};

const resetStyleDraft = () => {
    loadStyleDraft();
    if (!styleDraft.value) {
        styleDraft.value = createStyle({ id: 'default', name: '默认样式' });
    }
};

const removeStyle = async (styleId) => {
    const nextEntries = styleEntries.value.filter((style) => style.id !== styleId);
    const saved = await commitStyles(nextEntries, '已删除摄像头样式');
    if (!saved) return;
    selectedStyleId.value = nextEntries[0]?.id || '';
    styleDraft.value = nextEntries[0] ? toPersistedStyle(nextEntries[0]) : null;
    styleDraftDirty.value = false;
};

const openStyleAssetPicker = (category) => {
    assetPickerCategory.value = category === 'model' ? 'model' : 'image';
    assetPickerTarget.value = category === 'model' ? 'styleModel' : 'styleImage';
    showAssetPicker.value = true;
};

const handleAssetSelect = (asset) => {
    if (!asset?.url || !styleDraft.value) return;
    if (assetPickerTarget.value === 'styleModel') {
        updateStyleNested('model', 'url', asset.url);
    } else if (assetPickerTarget.value === 'styleImage') {
        updateStyleNested('image', 'url', asset.url);
    }
    showAssetPicker.value = false;
    assetPickerTarget.value = '';
};

const loadEventDraft = () => {
    eventDraft.value = {
        eventConfig: normalizeEventConfig(component.value?.config?.eventConfig),
        videoModalStyle: normalizeVideoModalStyle(component.value?.config?.videoModalStyle)
    };
};

const openEventManager = () => {
    showEventManager.value = true;
    loadEventDraft();
};

const updateEventEnabled = (trigger, enabled) => {
    if (!eventDraft.value) return;
    eventDraft.value = {
        ...eventDraft.value,
        eventConfig: {
            ...eventDraft.value.eventConfig,
            [trigger]: {
                ...(eventDraft.value.eventConfig?.[trigger] || {}),
                enabled,
                action: 'openVideo'
            }
        }
    };
};

const updateModalPreset = (preset) => {
    updateModalStyleField('preset', preset);
};

const updateModalStyleField = (key, value) => {
    if (!eventDraft.value) return;
    eventDraft.value = {
        ...eventDraft.value,
        videoModalStyle: normalizeVideoModalStyle({
            ...(eventDraft.value.videoModalStyle || {}),
            [key]: value
        })
    };
};

const saveEventDraft = async () => {
    if (!eventDraft.value) return;
    await updateComponentConfig(props.componentId, {
        eventConfig: normalizeEventConfig(eventDraft.value.eventConfig),
        videoModalStyle: normalizeVideoModalStyle(eventDraft.value.videoModalStyle)
    });
    toast.success('已保存事件与弹窗配置');
};

const resetEventDraft = () => {
    loadEventDraft();
};

const openManager = () => {
    showManager.value = true;
    ensureSelected();
    loadDraft();
};

const quickAddPoint = async () => {
    await addPoint();
    showManager.value = true;
};

const addPoint = async () => {
    const nextPoint = createPoint();
    const saved = await commitPoints([...points.value, nextPoint], '已新增点位');
    if (!saved) return;
    selectedPointId.value = nextPoint.id;
    draft.value = toPersistedPoint(nextPoint);
    draftDirty.value = false;
};

const removePoint = async (pointId) => {
    const saved = await commitPoints(points.value.filter((item) => item.id !== pointId), '已删除点位');
    if (!saved) return;
    ensureSelected();
    loadDraft();
};

const updateDraftField = (key, value) => {
    if (!draft.value) return;
    const nextDraft = { ...draft.value, [key]: value };
    if (key === 'videoUrl') {
        const inferred = inferVideoFormatFromUrl(value);
        if (inferred && (!nextDraft.videoFormat || nextDraft.videoFormat === 'hls')) {
            nextDraft.videoFormat = inferred;
        }
    }
    draft.value = nextDraft;
    draftDirty.value = true;
    if (key === 'name') nameError.value = '';
};

const updateDraftPosition = (index, value) => {
    if (!draft.value) return;
    const position = [...draft.value.position];
    position[index] = round4(toNumber(value, position[index]));
    draft.value = { ...draft.value, position };
    draftDirty.value = true;
};

const addVideoInfo = () => {
    if (!draft.value) return;
    draft.value = {
        ...draft.value,
        videoInfo: [...draft.value.videoInfo, { label: '', value: '' }]
    };
    draftDirty.value = true;
};

const updateVideoInfo = (index, key, value) => {
    if (!draft.value) return;
    const videoInfo = draft.value.videoInfo.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
    ));
    draft.value = { ...draft.value, videoInfo };
    draftDirty.value = true;
};

const removeVideoInfo = (index) => {
    if (!draft.value) return;
    draft.value = {
        ...draft.value,
        videoInfo: draft.value.videoInfo.filter((_, itemIndex) => itemIndex !== index)
    };
    draftDirty.value = true;
};

const saveDraft = async () => {
    if (!draft.value) return;
    const rawName = normalizeText(draft.value.name);
    const rawType = normalizeText(draft.value.type);
    if (!rawName) {
        nameError.value = '点位名称不能为空';
        toast.error(nameError.value);
        return;
    }
    if (!rawType) {
        toast.error('点位 type 不能为空');
        return;
    }

    const nextPoint = toPersistedPoint(draft.value);

    const next = points.value.map((item) => (item.id === selectedPointId.value ? nextPoint : item));
    const error = validatePoints(next);
    if (error) {
        nameError.value = error.includes('重复') || error.includes('不能为空') ? error : '';
        toast.error(error);
        return;
    }

    const saved = await commitPoints(next, '已保存点位');
    if (!saved) return;
    selectedPointId.value = nextPoint.id;
    draft.value = toPersistedPoint(nextPoint);
    draftDirty.value = false;
    nameError.value = '';
};

const resetDraft = () => {
    loadDraft();
};

const startPickCurrent = () => {
    if (!draft.value) return toast.warning('请先选择一个点位');
    componentStore.startBuildingPicking(props.componentId, draft.value.id);
    showManager.value = false;
    toast.info('请点击场景中的模型表面拾取点位');
};

const startPickNew = () => {
    componentStore.startBuildingPicking(props.componentId, null);
    showManager.value = false;
    toast.info('请点击场景中的模型表面新增点位');
};

const stopPick = () => {
    if (componentStore.buildingPicking?.componentId === props.componentId) {
        componentStore.stopBuildingPicking();
    }
};

const cancelPickConfirm = () => {
    componentStore.clearBuildingPickConfirm();
    showPickConfirm.value = false;
    showManager.value = true;
};

const confirmPickConfirm = async () => {
    const confirm = componentStore.buildingPickConfirm;
    const xyz = Array.isArray(confirm?.xyz) ? vec3(confirm.xyz, [0, 0, 0]) : null;
    if (confirm?.componentId !== props.componentId || !xyz) return cancelPickConfirm();

    const targetId = String(confirm?.pointId || '');
    if (targetId) {
        if (draft.value?.id === targetId) {
            draft.value = { ...draft.value, position: xyz };
            draftDirty.value = true;
            toast.success('已回填拾取坐标，请保存点位');
        } else {
            await commitPoints(points.value.map((item) => (
                item.id === targetId ? toPersistedPoint({ ...item, position: xyz }) : item
            )), '已更新点位坐标');
        }
    } else {
        const nextPoint = createPoint(xyz);
        const saved = await commitPoints([...points.value, nextPoint], '已通过拾取新增点位');
        if (saved) {
            selectedPointId.value = nextPoint.id;
            draft.value = toPersistedPoint(nextPoint);
            draftDirty.value = false;
        }
    }

    componentStore.clearBuildingPickConfirm();
    showPickConfirm.value = false;
    showManager.value = true;
};

const triggerImport = () => fileInputRef.value?.click?.();

const handleImportFile = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        const nextPoints = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.points) ? parsed.points : []);
        const persisted = nextPoints.map((item, index) => toPersistedPoint(item, index));
        const saved = await commitPoints(persisted, '已导入点位数据');
        if (saved) {
            selectedPointId.value = persisted[0]?.id || '';
            loadDraft();
        }
    } catch (error) {
        toast.error(`导入失败: ${error.message || error}`);
    } finally {
        event.target.value = '';
    }
};

const exportPoints = () => {
    const blob = new Blob([JSON.stringify(points.value.map((item, index) => toPersistedPoint(item, index)), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${component.value?.name || 'camera-points'}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

watch(points, () => {
    ensureSelected();
    if (!draftDirty.value) loadDraft();
}, { deep: true, immediate: true });

watch(() => selectedPointId.value, () => {
    loadDraft();
});

watch(() => componentStore.buildingPickConfirm, (confirm) => {
    showPickConfirm.value = !!confirm?.visible && confirm?.componentId === props.componentId;
}, { deep: true, immediate: true });

onBeforeUnmount(() => {
    stopPick();
});
</script>

<style scoped>
.cpm,
.cpm-form,
.cpm-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cpm-meta {
    font-size: 12px;
    color: var(--color-text-secondary);
}

.cpm-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.cpm-actions--footer {
    justify-content: flex-end;
}

.cpm-layout {
    display: grid;
    grid-template-columns: 330px minmax(0, 1fr);
    gap: 16px;
    min-height: 560px;
}

.cpm-side,
.cpm-main {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 12px;
    background: var(--color-bg-secondary);
}

.cpm-side {
    overflow: hidden;
}

.cpm-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    margin-top: 8px;
}

.cpm-item.active {
    border-color: var(--color-primary, #3b82f6);
    background: rgba(59, 130, 246, .08);
}

.cpm-item__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.cpm-item__sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.cpm-summary {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-radius: 8px;
    background: var(--color-bg-tertiary);
    font-size: 12px;
    color: var(--color-text-secondary);
}

.cpm-grid {
    display: grid;
    gap: 12px;
}

.cpm-grid--2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.cpm-vec3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.cpm-section {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
}

.cpm-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.cpm-section__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.cpm-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.cpm-url {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
}

.cpm-info-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto;
    gap: 8px;
    align-items: end;
}

.cpm-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

.cpm-empty--compact {
    min-height: 40px;
    justify-content: flex-start;
}

.cpm-hidden {
    display: none;
}

@media (max-width: 960px) {
    .cpm-layout,
    .cpm-grid--2,
    .cpm-vec3,
    .cpm-info-row {
        grid-template-columns: 1fr;
    }
}
</style>
