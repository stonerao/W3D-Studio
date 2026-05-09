<template>
    <div class="roadside-device-manager space-y-3">
        <div class="manager-launch-meta">
            已配置设备：{{ devices.length }} 个（编辑在弹窗中管理）
        </div>
        <div class="flex gap-2">
            <Button variant="primary" size="sm" @click="openManager">管理设备</Button>
            <Button variant="outline" size="sm" @click="quickAdd">快速新增</Button>
        </div>

        <Modal
            v-model="showManager"
            title="路侧设备管理"
            width="900px"
            @close="handleClose"
        >
            <div class="roadside-device-manager__modal space-y-3">
                <TrafficCoordinateFittingEditor :component-id="componentId" />

                <div class="roadside-device-manager__layout flex gap-3">
                <!-- 左侧：列表/方块 -->
                <div class="roadside-device-manager__sidebar w-[320px] shrink-0">
                    <div class="roadside-device-manager__toolbar flex items-center justify-between mb-2">
                        <div class="flex gap-2">
                            <Button
                                size="sm"
                                :variant="viewMode === 'list' ? 'primary' : 'outline'"
                                @click="viewMode = 'list'"
                            >
                                列表
                            </Button>
                            <Button
                                size="sm"
                                :variant="viewMode === 'grid' ? 'primary' : 'outline'"
                                @click="viewMode = 'grid'"
                            >
                                方块
                            </Button>
                        </div>
                        <div class="flex gap-2">
                            <Button size="sm" @click="addDevice">新增</Button>
                            <Button size="sm" variant="danger" :disabled="!selectedDeviceId" @click="removeSelectedDevice">
                                删除
                            </Button>
                        </div>
                    </div>

                    <div v-if="devices.length === 0" class="roadside-device-manager__empty">
                        暂无设备，点击“新增”开始。
                    </div>

                    <!-- 列表视图 -->
                    <div v-else-if="viewMode === 'list'" class="roadside-device-manager__list space-y-1">
                        <button
                            v-for="d in devices"
                            :key="d.id"
                            class="roadside-device-manager__device roadside-device-manager__device--list w-full text-left px-2 py-2 rounded border"
                            :class="{ 'is-active': d.id === selectedDeviceId }"
                            @click="selectDevice(d.id)"
                        >
                            <div class="flex items-center justify-between">
                                <div class="roadside-device-manager__device-name text-sm font-medium truncate">
                                    {{ d.name }}
                                </div>
                                <div class="roadside-device-manager__device-type text-xs ml-2 shrink-0">{{ d.type }}</div>
                            </div>
                            <div class="roadside-device-manager__device-resource text-xs truncate">{{ d.resourceUrl || '未设置资源' }}</div>
                        </button>
                    </div>

                    <!-- 方块视图 -->
                    <div v-else class="roadside-device-manager__grid grid grid-cols-2 gap-2">
                        <button
                            v-for="d in devices"
                            :key="d.id"
                            class="roadside-device-manager__device roadside-device-manager__device--grid text-left p-2 rounded border"
                            :class="{ 'is-active': d.id === selectedDeviceId }"
                            @click="selectDevice(d.id)"
                        >
                            <div class="roadside-device-manager__device-name text-sm font-medium truncate">{{ d.name }}</div>
                            <div class="roadside-device-manager__device-type text-xs">{{ d.type }}</div>
                            <div class="roadside-device-manager__device-resource text-xs truncate mt-1">{{ d.resourceUrl || '未设置资源' }}</div>
                        </button>
                    </div>
                </div>

                <!-- 右侧：编辑 -->
                <div class="roadside-device-manager__editor flex-1 rounded p-3">
                    <div v-if="!currentDevice" class="roadside-device-manager__placeholder text-sm">
                        请选择左侧设备进行编辑。
                    </div>

                    <div v-else class="roadside-device-manager__form space-y-3">
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <div class="roadside-device-manager__current text-sm font-medium">
                                    当前：{{ currentDevice.name }}
                                    <span class="roadside-device-manager__current-meta text-xs ml-1">({{ currentDevice.type }})</span>
                                </div>
                                <div v-if="parentDisplay" class="roadside-device-manager__hint text-xs mt-0.5">挂载于：{{ parentDisplay }}</div>
                            </div>
                            <div class="roadside-device-manager__status text-xs text-right">
                                <div v-if="!hasResource" class="status-warn">未设置资源</div>
                                <div v-if="!hasMeaningfulXyz" class="status-warn">可能未设置坐标</div>
                            </div>
                        </div>

                        <div>
                            <label class="label">ID（只读）</label>
                            <Input :model-value="currentDevice.id" disabled />
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="label">名称</label>
                                <Input :model-value="currentDevice.name" @update:model-value="updateField('name', $event)" />
                            </div>
                            <div>
                                <label class="label">类型</label>
                                <Select
                                    :model-value="currentDevice.type"
                                    :options="typeOptions"
                                    @update:model-value="updateField('type', $event)"
                                />
                            </div>
                        </div>

                        <div>
                            <label class="label">parentId（可选）</label>
                            <Input
                                :model-value="currentDevice.parentId || ''"
                                placeholder="留空表示无挂载"
                                @update:model-value="updateField('parentId', $event || null)"
                            />
                            <div v-if="parentValidationMessage" class="roadside-device-manager__hint text-xs mt-1">
                                {{ parentValidationMessage }}
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="label">资源类型</label>
                                <Select
                                    :model-value="currentDevice.resourceType"
                                    :options="resourceTypeOptions"
                                    @update:model-value="updateField('resourceType', $event)"
                                />
                            </div>
                            <div>
                                <label class="label">资源 URL</label>
                                <div class="flex gap-2">
                                    <Input
                                        class="flex-1"
                                        :model-value="currentDevice.resourceUrl"
                                        placeholder="从资源库选择或手填"
                                        @update:model-value="updateField('resourceUrl', $event)"
                                    />
                                    <Button size="sm" @click="openPicker">选择</Button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="label">三维坐标 xyz（最终保存）</label>
                            <div class="grid grid-cols-3 gap-2">
                                <Input
                                    type="number"
                                    :model-value="xyzDraft[0]"
                                    placeholder="X"
                                    @update:model-value="(v) => (xyzDraft[0] = v)"
                                    @blur="() => commitXyz(0)"
                                    @keydown="(e) => onDraftKeydown(e, () => commitXyz(0))"
                                />
                                <Input
                                    type="number"
                                    :model-value="xyzDraft[1]"
                                    placeholder="Y"
                                    @update:model-value="(v) => (xyzDraft[1] = v)"
                                    @blur="() => commitXyz(1)"
                                    @keydown="(e) => onDraftKeydown(e, () => commitXyz(1))"
                                />
                                <Input
                                    type="number"
                                    :model-value="xyzDraft[2]"
                                    placeholder="Z"
                                    @update:model-value="(v) => (xyzDraft[2] = v)"
                                    @blur="() => commitXyz(2)"
                                    @keydown="(e) => onDraftKeydown(e, () => commitXyz(2))"
                                />
                            </div>
                            <div class="roadside-device-manager__hint text-xs mt-1">提示：输入完成后“失焦/回车”才会写入配置。</div>
                        </div>

                        <div>
                            <label class="label">经纬度备注（可选）</label>
                            <div class="grid grid-cols-3 gap-2">
                                <Input type="number" :model-value="currentDevice.lngLat?.[0] ?? ''" @update:model-value="updateLngLat(0, $event)" placeholder="lng" />
                                <Input type="number" :model-value="currentDevice.lngLat?.[1] ?? ''" @update:model-value="updateLngLat(1, $event)" placeholder="lat" />
                                <Input
                                    type="number"
                                    :model-value="altDraft"
                                    placeholder="alt"
                                    @update:model-value="(v) => (altDraft = v)"
                                    @blur="commitAlt"
                                    @keydown="(e) => onDraftKeydown(e, commitAlt)"
                                />
                            </div>
                            <div class="roadside-device-manager__hint text-xs mt-1">geo 模式下会依据当前原点/拟合参数自动同步 xyz；xyz 模式下 lng/lat 仅作附加记录。</div>
                        </div>

                        <div>
                            <label class="label">旋转 rotation（角度制 °）</label>
                            <div class="grid grid-cols-3 gap-2">
                                <Input
                                    type="number"
                                    :model-value="rotationDraft[0]"
                                    placeholder="X"
                                    @update:model-value="(v) => (rotationDraft[0] = v)"
                                    @blur="() => commitRotation(0)"
                                    @keydown="(e) => onDraftKeydown(e, () => commitRotation(0))"
                                />
                                <Input
                                    type="number"
                                    :model-value="rotationDraft[1]"
                                    placeholder="Y"
                                    @update:model-value="(v) => (rotationDraft[1] = v)"
                                    @blur="() => commitRotation(1)"
                                    @keydown="(e) => onDraftKeydown(e, () => commitRotation(1))"
                                />
                                <Input
                                    type="number"
                                    :model-value="rotationDraft[2]"
                                    placeholder="Z"
                                    @update:model-value="(v) => (rotationDraft[2] = v)"
                                    @blur="() => commitRotation(2)"
                                    @keydown="(e) => onDraftKeydown(e, () => commitRotation(2))"
                                />
                            </div>
                        </div>

                        <div>
                            <label class="label">缩放 scale</label>
                            <Input type="number" :model-value="currentDevice.scale ?? 1" @update:model-value="updateField('scale', toNumber($event, 1))" />
                        </div>

                        <div class="flex gap-2">
                            <Button size="sm" @click="startPick">开始拾取坐标</Button>
                            <Button size="sm" variant="outline" @click="stopPick">退出拾取</Button>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="handleClose">关闭</Button>
            </template>
        </Modal>

        <!-- 拾取坐标确认框：拾取到点后先确认，确认后才写回 xyz -->
        <Modal
            v-model="showPickConfirm"
            title="确认拾取坐标"
            width="420px"
            @close="handlePickConfirmClose"
        >
            <div class="roadside-device-manager__pick-confirm space-y-2">
                <div class="roadside-device-manager__pick-title text-sm">已拾取到坐标，确认写入目标设备？</div>
                <div class="roadside-device-manager__hint text-xs">
                    将写入到：
                    <span class="roadside-device-manager__pick-target">{{ pickConfirmTargetText }}</span>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <Input :model-value="format4(pickConfirmXyz[0])" disabled />
                    <Input :model-value="format4(pickConfirmXyz[1])" disabled />
                    <Input :model-value="format4(pickConfirmXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmPickConfirm">确认</Button>
            </template>
        </Modal>

        <!-- 资源选择器 -->
        <AssetPickerModal
            v-model="showAssetPicker"
            :category="pickerCategory"
            @select="handleAssetSelect"
        />
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import {
    createTrafficGeoCoordinateTransformer,
    normalizeTrafficCoordinateSystemConfig
} from '@w3d/components';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Button from '../ui/Button.vue';
import AssetPickerModal from './AssetPickerModal.vue';
import Modal from '../ui/Modal.vue';
import TrafficCoordinateFittingEditor from './TrafficCoordinateFittingEditor.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';

const props = defineProps({
    componentId: {
        type: String,
        required: true
    }
});

const componentStore = useComponentStore();
const { updateComponentConfig } = useComponent();
const toast = useToast();

const showAssetPicker = ref(false);
const pickerCategory = ref('model');
const showManager = ref(false);
const viewMode = ref('grid');
const minimizeAndRestoreAfterPick = ref(false);
const suppressRestoreOnce = ref(false);
const pendingAutoSelectDeviceId = ref('');

const component = computed(() => componentStore.components.find((c) => c.id === props.componentId) || null);
const config = computed(() => component.value?.config || {});
const coordinateSystem = computed(() => normalizeTrafficCoordinateSystemConfig(config.value.coordinateSystem || {}));
const geoTransformer = computed(() => createTrafficGeoCoordinateTransformer(coordinateSystem.value));

const devices = computed(() => (Array.isArray(config.value.devices) ? config.value.devices : []));

const selectedDeviceId = computed(() => {
    return componentStore.trafficSelectedDevice?.componentId === props.componentId
        ? componentStore.trafficSelectedDevice?.deviceId
        : null;
});

const selectedDeviceExists = computed(() => {
    if (!selectedDeviceId.value) return false;
    return devices.value.some((d) => d.id === selectedDeviceId.value);
});

const currentDevice = computed(() => {
    if (!selectedDeviceId.value) return null;
    return devices.value.find((d) => d.id === selectedDeviceId.value) || null;
});

const xyzDraft = ref(['0.0000', '0.0000', '0.0000']);
const rotationDraft = ref(['0', '0', '0']);
const altDraft = ref('0.0000');

const hasResource = computed(() => {
    const url = currentDevice.value?.resourceUrl;
    return typeof url === 'string' && url.trim().length > 0;
});

const hasMeaningfulXyz = computed(() => {
    const xyz = ensureVec3(currentDevice.value?.xyz, [0, 0, 0]);
    // 业务上 [0,0,0] 经常是“尚未设置”的默认值，这里只做提示，不阻断保存
    return !(xyz[0] === 0 && xyz[1] === 0 && xyz[2] === 0);
});

const parentDisplay = computed(() => {
    const pid = currentDevice.value?.parentId;
    if (!pid) return '';
    const parent = devices.value.find((d) => d?.id === pid);
    if (!parent) return pid;
    return `${parent.name || parent.id}`;
});

const parentValidationMessage = computed(() => {
    const dev = currentDevice.value;
    const pid = dev?.parentId;
    if (!dev || !pid) return '';

    const parent = devices.value.find((d) => d?.id === pid);
    if (!parent) return '警告：parentId 指向的设备不存在。';

    const visited = new Set([dev.id]);
    let cur = parent;
    while (cur?.parentId) {
        if (visited.has(cur.id)) return '警告：检测到 parentId 循环引用。';
        visited.add(cur.id);
        cur = devices.value.find((d) => d?.id === cur.parentId) || null;
        if (!cur) break;
    }

    return '';
});

const typeOptions = [
    { label: '杆件', value: 'pole' },
    { label: '铁塔', value: 'tower' },
    { label: '标志标牌', value: 'sign' },
    { label: '标线', value: 'marking' },
    { label: '高清摄像机', value: 'camera' },
    { label: '激光雷达', value: 'lidar' },
    { label: '毫米波雷达', value: 'mmwaveRadar' },
    { label: 'RSU', value: 'rsu' },
    { label: '边缘计算节点', value: 'edgeNode' },
    { label: '信号灯', value: 'trafficLight' }
];

const resourceTypeOptions = [
    { label: '模型', value: 'model' },
    { label: '图片', value: 'image' }
];

const toNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const round4 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return Math.round(n * 10000) / 10000;
};

const roundGeo = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return Math.round(n * 100000000) / 100000000;
};

const format4 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return round4(n).toFixed(4);
};

const getNextDefaultName = () => {
    let maxIndex = 0;
    for (const d of devices.value) {
        const name = typeof d?.name === 'string' ? d.name : '';
        const match = name.match(/^设备(\d+)$/);
        if (match) {
            const n = Number(match[1]);
            if (Number.isFinite(n)) {
                maxIndex = Math.max(maxIndex, n);
            }
        }
    }
    return `设备${maxIndex + 1}`;
};

const ensureVec3 = (value, fallback = [0, 0, 0]) => {
    if (!Array.isArray(value) || value.length < 3) return [...fallback];
    return [toNumber(value[0], fallback[0]), toNumber(value[1], fallback[1]), toNumber(value[2], fallback[2])];
};

const syncDraftFromDevice = (dev) => {
    const xyz = ensureVec3(dev?.xyz, [0, 0, 0]);
    xyzDraft.value = [format4(xyz[0]), format4(xyz[1]), format4(xyz[2])];

    const rot = ensureVec3(dev?.rotation, [0, 0, 0]);
    rotationDraft.value = [String(toNumber(rot[0], 0)), String(toNumber(rot[1], 0)), String(toNumber(rot[2], 0))];

    const alt = round4(toNumber(dev?.alt ?? 0, 0));
    altDraft.value = format4(alt);
};

const onDraftKeydown = (event, commitFn) => {
    if (event?.key === 'Enter') {
        try {
            event.preventDefault();
        } catch {}
        commitFn?.();
        // 让输入框失焦，避免连续触发
        try {
            event.target?.blur?.();
        } catch {}
    }
};

const ensureLngLat = (value) => {
    if (!Array.isArray(value) || value.length < 2) return [null, null];
    return [toNumber(value[0], null), toNumber(value[1], null)];
};

const buildPatchFromGeo = (lngLat, alt) => {
    const patch = {
        lngLat,
        alt
    };

    if (coordinateSystem.value.mode === 'geo' && Array.isArray(lngLat) && lngLat.length >= 2) {
        patch.xyz = geoTransformer.value.geoToModel([lngLat[0], lngLat[1], alt]).map((item) => round4(item));
    }

    return patch;
};

const buildPatchFromXyz = (xyz) => {
    const patch = { xyz };

    if (coordinateSystem.value.mode === 'geo') {
        const geo = geoTransformer.value.modelToGeo(xyz);
        patch.lngLat = [roundGeo(geo[0]), roundGeo(geo[1])];
        patch.alt = round4(geo[2]);
        altDraft.value = format4(patch.alt);
    }

    return patch;
};

const commitDevices = async (nextDevices) => {
    await updateComponentConfig(props.componentId, {
        devices: nextDevices
    });
};

const selectDevice = (deviceId) => {
    componentStore.setTrafficSelectedDevice(props.componentId, deviceId);
};

const addDevice = async () => {
    const id = `dev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newDevice = {
        id,
        name: getNextDefaultName(),
        type: 'pole',
        parentId: null,
        xyz: [0, 0, 0],
        lngLat: null,
        alt: 0,
        rotation: [0, 0, 0],
        scale: 1,
        resourceType: 'model',
        resourceUrl: ''
    };

    const next = [...devices.value, newDevice];
    pendingAutoSelectDeviceId.value = id;

    try {
        await commitDevices(next);
        await nextTick();

        // commitDevices 不再因运行时异常抛出，设备一定已写入 store
        const exists = devices.value.some((d) => d.id === id);
        if (exists) {
            selectDevice(id);
            const dev = devices.value.find((d) => d.id === id) || null;
            syncDraftFromDevice(dev);
            pendingAutoSelectDeviceId.value = '';
        } else {
            // 极端兜底：响应式传播延迟，留给 watcher 处理
            console.warn('[DeviceManager] 新设备写入 store 后未立即可见，等待 watcher 补偿', id);
        }
    } catch (error) {
        pendingAutoSelectDeviceId.value = '';
        console.error('Failed to add roadside device:', error);
        toast.error(`新增设备失败: ${error.message || error}`);
    }
};

const removeSelectedDevice = async () => {
    if (!selectedDeviceId.value) return;
    const next = devices.value.filter((d) => d.id !== selectedDeviceId.value);
    await commitDevices(next);
    componentStore.clearTrafficSelectedDevice(props.componentId);
    componentStore.stopTrafficPicking();
};

const updateDevice = async (patch) => {
    if (!currentDevice.value) return;

    const next = devices.value.map((d) => {
        if (d.id !== currentDevice.value.id) return d;
        return {
            ...d,
            ...patch
        };
    });

    await commitDevices(next);
};

const updateField = async (key, value) => {
    await updateDevice({ [key]: value });
};

const commitXyz = async (index) => {
    const xyz = ensureVec3(currentDevice.value?.xyz, [0, 0, 0]);
    xyz[index] = round4(toNumber(xyzDraft.value[index], xyz[index]));
    xyzDraft.value[index] = format4(xyz[index]);
    await updateDevice(buildPatchFromXyz(xyz));
};

const commitRotation = async (index) => {
    const rotation = ensureVec3(currentDevice.value?.rotation, [0, 0, 0]);
    rotation[index] = toNumber(rotationDraft.value[index], rotation[index]);
    rotationDraft.value[index] = String(rotation[index]);
    await updateDevice({ rotation });
};

const commitAlt = async () => {
    const alt = round4(toNumber(altDraft.value, toNumber(currentDevice.value?.alt ?? 0, 0)));
    altDraft.value = format4(alt);
    await updateDevice(buildPatchFromGeo(currentDevice.value?.lngLat || null, alt));
};

const updateLngLat = async (index, value) => {
    const [lng, lat] = ensureLngLat(currentDevice.value?.lngLat);
    const nextLng = index === 0 ? roundGeo(toNumber(value, null)) : lng;
    const nextLat = index === 1 ? roundGeo(toNumber(value, null)) : lat;

    const lngLat = (nextLng === null || nextLat === null) ? null : [nextLng, nextLat];
    await updateDevice(buildPatchFromGeo(lngLat, round4(toNumber(currentDevice.value?.alt ?? 0, 0))));
};

const openPicker = () => {
    const rt = currentDevice.value?.resourceType || 'model';
    pickerCategory.value = rt === 'image' ? 'image' : 'model';
    showAssetPicker.value = true;
};

const handleAssetSelect = async (asset) => {
    showAssetPicker.value = false;
    if (!asset?.url) return;
    await updateDevice({ resourceUrl: asset.url });
};

const openManager = () => {
    showManager.value = true;

    if (!selectedDeviceExists.value && devices.value.length > 0) {
        selectDevice(devices.value[0].id);
    }
};

const handleClose = () => {
    showManager.value = false;
    componentStore.stopTrafficPicking();
};

const quickAdd = async () => {
    await addDevice();
    showManager.value = true;
};

const startPick = () => {
    if (!selectedDeviceId.value) return;
    componentStore.startTrafficPicking(props.componentId, selectedDeviceId.value);

    // 最小化弹窗（这里用关闭弹窗模拟最小化），拾取完成后自动恢复
    minimizeAndRestoreAfterPick.value = true;
    showManager.value = false;
};

const stopPick = () => {
    componentStore.stopTrafficPicking();
};

const showPickConfirm = computed({
    get: () => {
        const pc = componentStore.trafficPickConfirm;
        return !!pc?.visible && pc?.componentId === props.componentId;
    },
    set: (v) => {
        if (!v) componentStore.clearTrafficPickConfirm();
    }
});

const pickConfirmXyz = computed(() => {
    const pc = componentStore.trafficPickConfirm;
    const xyz = pc?.componentId === props.componentId ? pc?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const pickConfirmTargetText = computed(() => {
    const pc = componentStore.trafficPickConfirm;
    if (!pc?.visible || pc?.componentId !== props.componentId) return '（未知）';

    const dev = devices.value.find((d) => d?.id === pc.deviceId);
    if (!dev) return `（设备不存在：${pc.deviceId}）`;

    const name = dev?.name || dev.id;
    const type = dev?.type ? ` / ${dev.type}` : '';
    return `${name}（ID: ${dev.id}${type}）`;
});

const confirmPickConfirm = async () => {
    const pc = componentStore.trafficPickConfirm;
    if (!pc?.visible) return;
    if (pc.componentId !== props.componentId) {
        componentStore.clearTrafficPickConfirm();
        return;
    }

    const nextXyz = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => round4(n));
    const prevDevices = devices.value;
    const nextDevices = prevDevices.map((d) => {
        if (d?.id !== pc.deviceId) return d;
        return {
            ...d,
            ...buildPatchFromXyz(nextXyz)
        };
    });

    await commitDevices(nextDevices);
    componentStore.setTrafficSelectedDevice(pc.componentId, pc.deviceId);
    componentStore.clearTrafficPickConfirm();
};

const cancelPickConfirm = () => {
    const pc = componentStore.trafficPickConfirm;
    if (!pc?.visible) {
        componentStore.clearTrafficPickConfirm();
        return;
    }

    // 取消：继续拾取，不自动恢复主弹窗
    suppressRestoreOnce.value = true;
    componentStore.clearTrafficPickConfirm();
    if (pc.componentId === props.componentId && pc.deviceId) {
        componentStore.startTrafficPicking(pc.componentId, pc.deviceId);
        minimizeAndRestoreAfterPick.value = true;
        showManager.value = false;
    }
};

const handlePickConfirmClose = () => {
    cancelPickConfirm();
};

watch(() => props.componentId, () => {
    componentStore.stopTrafficPicking();
});

watch(
    () => currentDevice.value?.id,
    () => {
        syncDraftFromDevice(currentDevice.value);
    },
    { immediate: true }
);

watch(
    () => devices.value.map((d) => d.id).join('|'),
    () => {
        const pendingId = pendingAutoSelectDeviceId.value;
        if (!pendingId) return;

        const found = devices.value.find((d) => d.id === pendingId);
        if (!found) return;

        selectDevice(pendingId);
        syncDraftFromDevice(found);
        pendingAutoSelectDeviceId.value = '';
    }
);

watch(
    () => [showManager.value, devices.value.map((d) => d.id).join('|'), selectedDeviceId.value],
    ([visible]) => {
        if (!visible) return;

        if (!devices.value.length) {
            if (selectedDeviceId.value) {
                componentStore.clearTrafficSelectedDevice(props.componentId);
            }
            return;
        }

        if (!selectedDeviceExists.value) {
            selectDevice(devices.value[0].id);
        }
    }
);

watch(
    () => componentStore.trafficPicking?.active,
    (active, prev) => {
        // 从“拾取中”变为“结束”，且是当前组件触发的拾取：恢复弹窗
        if (prev && !active && minimizeAndRestoreAfterPick.value && !componentStore.trafficPickConfirm?.visible) {
            const last = componentStore.trafficSelectedDevice;
            if (last?.componentId === props.componentId) {
                showManager.value = true;
            }
            minimizeAndRestoreAfterPick.value = false;
        }
    }
);

watch(
    () => componentStore.trafficPickConfirm?.visible,
    (visible, prev) => {
        // 确认框关闭后（且本轮拾取需要恢复）：恢复主弹窗
        if (prev && !visible && minimizeAndRestoreAfterPick.value) {
            if (suppressRestoreOnce.value) {
                suppressRestoreOnce.value = false;
                return;
            }

            const last = componentStore.trafficSelectedDevice;
            if (last?.componentId === props.componentId) {
                showManager.value = true;
            }
            minimizeAndRestoreAfterPick.value = false;
        }
    }
);
</script>

<style scoped>
.roadside-device-manager {
    --traffic-panel-bg: linear-gradient(180deg, rgba(34, 39, 68, 0.88), rgba(21, 25, 44, 0.96));
    --traffic-panel-bg-soft: rgba(18, 23, 42, 0.68);
    --traffic-panel-border: rgba(119, 139, 255, 0.18);
    --traffic-panel-border-strong: rgba(119, 139, 255, 0.34);
    --traffic-panel-shadow: 0 18px 40px rgba(6, 10, 24, 0.28);
    --traffic-text-main: rgba(240, 244, 255, 0.96);
    --traffic-text-secondary: rgba(189, 199, 235, 0.78);
    --traffic-text-muted: rgba(145, 156, 194, 0.68);
    --traffic-accent: #7c8cff;
    --traffic-accent-soft: rgba(124, 140, 255, 0.16);
    --traffic-danger: #ff8c8c;
}

.manager-launch-meta {
    color: var(--traffic-text-muted);
}

.roadside-device-manager__modal {
    color: var(--traffic-text-main);
}

.roadside-device-manager__layout {
    align-items: stretch;
}

.roadside-device-manager__sidebar,
.roadside-device-manager__editor {
    border: 1px solid var(--traffic-panel-border);
    background: var(--traffic-panel-bg);
    box-shadow: var(--traffic-panel-shadow);
}

.roadside-device-manager__sidebar {
    border-radius: 14px;
    padding: 14px;
}

.roadside-device-manager__toolbar {
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(124, 140, 255, 0.12);
}

.roadside-device-manager__empty,
.roadside-device-manager__placeholder {
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px dashed rgba(124, 140, 255, 0.22);
    background: rgba(17, 22, 39, 0.58);
    color: var(--traffic-text-muted);
}

.roadside-device-manager__device {
    border-color: rgba(124, 140, 255, 0.16);
    background: rgba(15, 19, 33, 0.62);
    transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.roadside-device-manager__device:hover {
    border-color: rgba(124, 140, 255, 0.28);
    background: rgba(24, 30, 52, 0.86);
    transform: translateY(-1px);
}

.roadside-device-manager__device.is-active {
    border-color: var(--traffic-panel-border-strong);
    background: linear-gradient(180deg, rgba(51, 60, 104, 0.88), rgba(27, 32, 58, 0.96));
    box-shadow: inset 0 0 0 1px rgba(124, 140, 255, 0.16), 0 10px 24px rgba(6, 10, 24, 0.28);
}

.roadside-device-manager__device-name,
.roadside-device-manager__current,
.roadside-device-manager__pick-target {
    color: var(--traffic-text-main);
}

.roadside-device-manager__device-type,
.roadside-device-manager__device-resource,
.roadside-device-manager__current-meta,
.roadside-device-manager__hint,
.roadside-device-manager__status,
.roadside-device-manager__pick-title {
    color: var(--traffic-text-secondary);
}

.roadside-device-manager__editor {
    border-radius: 16px;
    padding: 16px;
}

.roadside-device-manager__form {
    color: var(--traffic-text-main);
}

.roadside-device-manager__current {
    font-size: 14px;
    font-weight: 600;
}

.roadside-device-manager__status {
    min-width: 88px;
}

.roadside-device-manager__pick-confirm {
    padding: 2px 0 4px;
}

.label {
    display: block;
    font-size: 12px;
    color: var(--traffic-text-muted);
    margin-bottom: 4px;
    letter-spacing: 0.02em;
}

.status-warn {
    color: var(--traffic-danger);
}

@media (max-width: 960px) {
    .roadside-device-manager__layout {
        flex-direction: column;
    }

    .roadside-device-manager__sidebar {
        width: 100%;
    }
}
</style>
