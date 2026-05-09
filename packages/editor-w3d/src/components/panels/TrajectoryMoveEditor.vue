<template>
    <div class="trajectory-editor">
        <div class="editor-summary">
            <div class="summary-item">
                <span class="summary-label">轨迹点数:</span>
                <span class="summary-value">{{ points.length }} 个</span>
            </div>
            <div v-if="points.length >= 2" class="summary-item">
                <span class="summary-label">起点:</span>
                <span class="summary-value">{{ formatPoint(points[0]) }}</span>
            </div>
            <div v-if="points.length >= 2" class="summary-item">
                <span class="summary-label">终点:</span>
                <span class="summary-value">{{ formatPoint(points[points.length - 1]) }}</span>
            </div>
        </div>

        <div class="editor-actions">
            <Button variant="primary" size="sm" @click="openEditor">编辑轨迹</Button>
            <Button variant="outline" size="sm" @click="clearPoints">清空</Button>
        </div>

        <!-- 拾取和更新按钮 -->
        <div class="editor-actions">
            <Button size="sm" @click="startPick">拾取点位</Button>
            <Button size="sm" variant="outline" @click="stopPick">退出拾取</Button>
            <Button size="sm" variant="outline" @click="updateAnimation">更新动画</Button>
        </div>

        <!-- 拾取坐标确认框 -->
        <Modal
            v-model="showPickConfirm"
            title="确认拾取点位"
            width="420px"
            @close="handlePickConfirmClose"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">已拾取到坐标，确认添加到轨迹点位？</div>
                <div class="text-xs text-gray-500 mt-2">
                    将追加到：
                    <span class="text-gray-700">{{ component?.name || '未知组件' }}</span>
                    （当前 {{ points.length }} 个点）
                </div>
                <div class="pick-xyz-display">
                    <div class="coord-display">
                        <span class="coord-label">X</span>
                        <span class="coord-value">{{ format4(pickConfirmXyz[0]) }}</span>
                    </div>
                    <div class="coord-display">
                        <span class="coord-label">Y</span>
                        <span class="coord-value">{{ format4(pickConfirmXyz[1]) }}</span>
                    </div>
                    <div class="coord-display">
                        <span class="coord-label">Z</span>
                        <span class="coord-value">{{ format4(pickConfirmXyz[2]) }}</span>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmPickConfirm">确认添加</Button>
            </template>
        </Modal>

        <!-- 轨迹编辑弹窗 -->
        <Modal
            v-model="showEditor"
            title="轨迹点位编辑"
            width="700px"
            @close="handleClose"
        >
            <div class="trajectory-modal-content">
                <!-- 工具栏 -->
                <div class="toolbar">
                    <Button size="sm" @click="addPoint">添加点位</Button>
                    <Button size="sm" variant="outline" @click="reversePoints">反转顺序</Button>
                    <Button size="sm" variant="outline" @click="resetToDefault">重置默认</Button>
                </div>

                <!-- 点位列表 -->
                <div class="points-list">
                    <div v-if="editPoints.length === 0" class="empty-hint">
                        暂无轨迹点位，点击"添加点位"开始
                    </div>
                    <div
                        v-for="(point, index) in editPoints"
                        :key="index"
                        class="point-item"
                        :class="{ 'point-start': index === 0, 'point-end': index === editPoints.length - 1 }"
                    >
                        <div class="point-header">
                            <span class="point-index">
                                <template v-if="index === 0">🚀 起点</template>
                                <template v-else-if="index === editPoints.length - 1">🏁 终点</template>
                                <template v-else>#{{ index + 1 }}</template>
                            </span>
                            <div class="point-actions">
                                <button
                                    v-if="index > 0"
                                    class="btn-icon"
                                    title="上移"
                                    @click="movePoint(index, -1)"
                                >↑</button>
                                <button
                                    v-if="index < editPoints.length - 1"
                                    class="btn-icon"
                                    title="下移"
                                    @click="movePoint(index, 1)"
                                >↓</button>
                                <button
                                    class="btn-icon btn-delete"
                                    title="删除"
                                    @click="removePoint(index)"
                                >×</button>
                            </div>
                        </div>
                        <div class="point-coords">
                            <div class="coord-input">
                                <label>X</label>
                                <input
                                    type="number"
                                    :value="point.x"
                                    @input="updatePointCoord(index, 'x', $event.target.value)"
                                    step="1"
                                />
                            </div>
                            <div class="coord-input">
                                <label>Y</label>
                                <input
                                    type="number"
                                    :value="point.y"
                                    @input="updatePointCoord(index, 'y', $event.target.value)"
                                    step="1"
                                />
                            </div>
                            <div class="coord-input">
                                <label>Z</label>
                                <input
                                    type="number"
                                    :value="point.z"
                                    @input="updatePointCoord(index, 'z', $event.target.value)"
                                    step="1"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 快速添加 -->
                <div class="quick-add">
                    <div class="quick-add-title">快速添加点位</div>
                    <div class="quick-add-inputs">
                        <input v-model.number="quickX" type="number" placeholder="X" step="1" />
                        <input v-model.number="quickY" type="number" placeholder="Y" step="1" />
                        <input v-model.number="quickZ" type="number" placeholder="Z" step="1" />
                        <Button size="sm" @click="quickAddPoint">添加</Button>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="handleClose">取消</Button>
                <Button variant="primary" @click="savePoints">保存</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Button from '../ui/Button.vue';
import Modal from '../ui/Modal.vue';
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

const showEditor = ref(false);
const editPoints = ref([]);
const quickX = ref(0);
const quickY = ref(0);
const quickZ = ref(0);

// 获取组件配置
const component = computed(() => {
    return componentStore.components.find((c) => c.id === props.componentId);
});

const config = computed(() => component.value?.config || {});

const points = computed(() => {
    const pts = config.value.points;
    if (!Array.isArray(pts)) return [];
    return pts.map(normalizePoint);
});

// 默认轨迹数据
const defaultPoints = [
    { x: 0, y: 0, z: 0 },
    { x: -50, y: 50, z: 100 }
];

// 规范化点位格式
function normalizePoint(point) {
    if (Array.isArray(point)) {
        return { x: point[0] || 0, y: point[1] || 0, z: point[2] || 0 };
    }
    return {
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
        z: Number(point.z) || 0
    };
}

// 格式化点位显示
function formatPoint(point) {
    if (!point) return '(0, 0, 0)';
    const p = normalizePoint(point);
    return `(${p.x}, ${p.y}, ${p.z})`;
}

// 打开编辑器
function openEditor() {
    editPoints.value = points.value.length > 0
        ? points.value.map(p => ({ ...p }))
        : defaultPoints.map(p => ({ ...p }));
    showEditor.value = true;
}

// 关闭编辑器
function handleClose() {
    showEditor.value = false;
}

// 添加点位
function addPoint() {
    const lastPoint = editPoints.value[editPoints.value.length - 1];
    editPoints.value.push({
        x: lastPoint ? lastPoint.x + 10 : 0,
        y: lastPoint ? lastPoint.y : 0,
        z: lastPoint ? lastPoint.z + 10 : 0
    });
}

// 快速添加点位
function quickAddPoint() {
    editPoints.value.push({
        x: quickX.value,
        y: quickY.value,
        z: quickZ.value
    });
    // 重置快速添加输入
    quickX.value = 0;
    quickY.value = 0;
    quickZ.value = 0;
}

// 删除点位
function removePoint(index) {
    editPoints.value.splice(index, 1);
}

// 移动点位顺序
function movePoint(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editPoints.value.length) return;
    const temp = editPoints.value[index];
    editPoints.value[index] = editPoints.value[newIndex];
    editPoints.value[newIndex] = temp;
}

// 更新点位坐标
function updatePointCoord(index, axis, value) {
    editPoints.value[index][axis] = Number(value) || 0;
}

// 反转点位顺序
function reversePoints() {
    editPoints.value.reverse();
}

// 重置为默认
function resetToDefault() {
    editPoints.value = defaultPoints.map(p => ({ ...p }));
}

// 清空点位
async function clearPoints() {
    await updateComponentConfig(props.componentId, { points: [] });
    toast.success('轨迹已清空');
}

// 保存点位
async function savePoints() {
    if (editPoints.value.length < 2) {
        toast.error('至少需要 2 个点位才能形成轨迹');
        return;
    }
    await updateComponentConfig(props.componentId, { points: editPoints.value });
    toast.success('轨迹已保存');
    showEditor.value = false;
}

// ========== 拾取点位相关 ==========

const round4 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return Math.round(n * 10000) / 10000;
};

const format4 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return round4(n).toFixed(4);
};

const ensureVec3 = (value, fallback = [0, 0, 0]) => {
    if (!Array.isArray(value) || value.length < 3) return [...fallback];
    return [Number(value[0]) || fallback[0], Number(value[1]) || fallback[1], Number(value[2]) || fallback[2]];
};

// 拾取确认框显示状态
const showPickConfirm = computed({
    get: () => {
        const pc = componentStore.trajectoryPickConfirm;
        return !!pc?.visible && pc?.componentId === props.componentId;
    },
    set: (v) => {
        if (!v) componentStore.clearTrajectoryPickConfirm();
    }
});

// 拾取确认框中的坐标
const pickConfirmXyz = computed(() => {
    const pc = componentStore.trajectoryPickConfirm;
    const xyz = pc?.componentId === props.componentId ? pc?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

// 开始拾取
function startPick() {
    componentStore.startTrajectoryPicking(props.componentId);
    toast.info('请点击场景中的模型表面拾取点位');
}

// 停止拾取
function stopPick() {
    componentStore.stopTrajectoryPicking();
}

// 确认拾取
async function confirmPickConfirm() {
    const pc = componentStore.trajectoryPickConfirm;
    if (!pc?.visible) return;
    if (pc.componentId !== props.componentId) {
        componentStore.clearTrajectoryPickConfirm();
        return;
    }

    const nextXyz = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => round4(n));
    const newPoint = { x: nextXyz[0], y: nextXyz[1], z: nextXyz[2] };
    const prevPoints = Array.isArray(config.value.points) ? config.value.points.map(normalizePoint) : [];
    const nextPoints = [...prevPoints, newPoint];

    await updateComponentConfig(props.componentId, { points: nextPoints });
    toast.success(`已添加点位 #${nextPoints.length}`);
    componentStore.clearTrajectoryPickConfirm();
}

// 取消拾取
function cancelPickConfirm() {
    componentStore.clearTrajectoryPickConfirm();
    // 继续拾取模式
    componentStore.startTrajectoryPicking(props.componentId);
}

// 关闭拾取确认框
function handlePickConfirmClose() {
    cancelPickConfirm();
}

// 更新动画（重新初始化组件实例）
async function updateAnimation() {
    const comp = component.value;
    if (!comp?.instance) {
        toast.warning('组件实例不存在');
        return;
    }

    if (typeof comp.instance.updateConfig === 'function') {
        comp.instance.updateConfig(comp.config);
        toast.success('动画已更新');
    } else {
        toast.warning('该组件不支持动态更新');
    }
}
</script>

<style scoped>
.trajectory-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.editor-summary {
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.summary-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-xs);
}

.summary-label {
    color: var(--color-text-tertiary);
}

.summary-value {
    color: var(--color-text-primary);
    font-family: var(--font-mono);
}

.editor-actions {
    display: flex;
    gap: var(--space-2);
}

.trajectory-modal-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.toolbar {
    display: flex;
    gap: var(--space-2);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border);
}

.points-list {
    max-height: 350px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.empty-hint {
    text-align: center;
    color: var(--color-text-tertiary);
    padding: var(--space-6) 0;
    font-size: var(--font-size-sm);
}

.point-item {
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3);
}

.point-item.point-start {
    border-left: 3px solid #22c55e;
}

.point-item.point-end {
    border-left: 3px solid #ef4444;
}

.point-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
}

.point-index {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
}

.point-actions {
    display: flex;
    gap: var(--space-1);
}

.btn-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-xs);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-icon:hover {
    background-color: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
}

.btn-delete:hover {
    background-color: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
}

.point-coords {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
}

.coord-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.coord-input label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-weight-medium);
}

.coord-input input {
    width: 100%;
    padding: var(--space-2);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.coord-input input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--focus-ring);
}

.quick-add {
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3);
}

.quick-add-title {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-2);
}

.quick-add-inputs {
    display: flex;
    gap: var(--space-2);
    align-items: center;
}

.quick-add-inputs input {
    flex: 1;
    padding: var(--space-2);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.quick-add-inputs input:focus {
    outline: none;
    border-color: var(--color-primary);
}

/* 拾取确认框样式 */
.pick-confirm-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.pick-xyz-display {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
    margin-top: var(--space-2);
}

.coord-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2);
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
}

.coord-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    font-weight: var(--font-weight-medium);
}

.coord-value {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--color-text-primary);
}
</style>
