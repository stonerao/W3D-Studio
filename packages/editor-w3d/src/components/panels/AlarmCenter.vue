<template>
    <div class="alarm-center">
        <div class="toolbar">
            <Button size="sm" @click="handleAddRule">新增</Button>
            <Button size="sm" variant="outline" @click="handleEvaluateNow">立即评估</Button>
            <Button size="sm" variant="outline" @click="handleClearHistory">清空历史</Button>
        </div>

        <div class="summary-grid">
            <div class="summary-card"><span>活跃告警</span><strong>{{ alarmStore.activeCount }}</strong></div>
            <div class="summary-card"><span>已确认</span><strong>{{ alarmStore.acknowledgedCount }}</strong></div>
            <div class="summary-card"><span>规则数</span><strong>{{ alarmStore.rules.length }}</strong></div>
            <div class="summary-card"><span>待触发 / 恢复</span><strong>{{ pendingRuleCount }}</strong></div>
        </div>

        <div class="panel-section">
            <div class="section-title">通知设置</div>
            <div class="form-grid notification-grid">
                <label class="checkbox-line"><input v-model="notificationForm.browserEnabled" type="checkbox" @change="handleNotificationSettingsChange" /><span>浏览器通知</span></label>
                <label class="checkbox-line"><input v-model="notificationForm.soundEnabled" type="checkbox" @change="handleNotificationSettingsChange" /><span>提示音</span></label>
                <Input v-model="notificationForm.soundFrequency" type="number" placeholder="声音频率 Hz" @blur="handleNotificationSettingsChange" />
                <Input v-model="notificationForm.soundDurationMs" type="number" placeholder="持续时长 ms" @blur="handleNotificationSettingsChange" />
            </div>
            <div class="row-end"><Button size="sm" variant="outline" @click="handleRequestNotificationPermission">授权通知</Button></div>
            <div class="muted">通知权限：{{ notificationPermissionLabel }}</div>
        </div>

        <div class="panel-section">
            <div class="section-title">筛选器</div>
            <div class="form-grid">
                <Input v-model="filterForm.keyword" placeholder="关键字" />
                <Select v-model="filterForm.severity" :options="severityFilterOptions" />
                <Select v-model="filterForm.state" :options="stateFilterOptions" />
            </div>
        </div>

        <div class="panel-section">
            <div class="section-header">
                <div class="section-title">活跃告警</div>
                <Button size="sm" variant="ghost" :disabled="alarmStore.activeAlarms.length === 0" @click="handleClearAllActive">清空活跃</Button>
            </div>
            <div v-if="filteredActiveAlarms.length === 0" class="empty-text">当前没有活跃告警</div>
            <div v-else class="list">
                <div v-for="alarm in filteredActiveAlarms" :key="alarm.id" class="card">
                    <div class="card-header">
                        <div class="title-line"><span :class="['severity-badge', `severity-badge--${alarm.severity}`]">{{ getSeverityLabel(alarm.severity) }}</span><strong>{{ alarm.title || alarm.ruleName }}</strong></div>
                        <span class="muted">{{ formatTime(alarm.lastTriggeredAt) }}</span>
                    </div>
                    <div class="message">{{ alarm.message }}</div>
                    <div v-if="alarm.sourceMode && alarm.sourceMode !== 'variable'" class="muted"><span :class="['rule-status', 'source-mode-badge', getSourceModeBadgeClass(alarm.sourceMode)]">{{ getSourceModeBadgeLabel(alarm.sourceMode) }}</span></div>
                    <div v-if="getRuleFilterSummary(alarm)" class="muted">过滤：{{ getRuleFilterSummary(alarm) }}</div>
                    <div class="muted">{{ getAlarmConditionSummary(alarm) }} / 值：{{ formatInlineValue(alarm.lastValue) }}</div>
                    <div class="actions">
                        <Button size="sm" variant="outline" :disabled="Boolean(alarm.acknowledgedAt)" @click="handleAcknowledge(alarm.id)">{{ alarm.acknowledgedAt ? '已确认' : '确认' }}</Button>
                        <Button v-if="alarm.targetComponentId" size="sm" variant="ghost" @click="locateComponent(alarm.targetComponentId)">定位</Button>
                        <Button size="sm" variant="ghost" @click="handleClearAlarm(alarm.id)">清除</Button>
                    </div>
                </div>
            </div>
        </div>

        <div class="panel-section">
            <div class="section-title">告警规则</div>
            <div v-if="filteredRules.length === 0" class="empty-text">暂无规则</div>
            <div v-else class="list">
                <div v-for="rule in filteredRules" :key="rule.id" :class="['card', { 'card--saved': recentlySavedRuleId === rule.id }]">
                    <div class="card-header">
                        <div class="title-line">
                            <strong>{{ rule.name }}</strong>
                            <span :class="['rule-status', rule.enabled ? 'enabled' : 'disabled']">{{ rule.enabled ? '启用' : '停用' }}</span>
                            <span v-if="rule.muted" class="rule-status muted-status">静默</span>
                            <span v-if="getRuntimeBadge(rule).label" class="rule-status pending-status">{{ getRuntimeBadge(rule).label }}</span>
                        </div>
                        <span :class="['severity-badge', `severity-badge--${rule.severity}`]">{{ getSeverityLabel(rule.severity) }}</span>
                    </div>
                    <div class="message">{{ getRuleConditionSummary(rule) }}</div>
                    <div v-if="rule.sourceMode && rule.sourceMode !== 'variable'" class="muted"><span :class="['rule-status', 'source-mode-badge', getSourceModeBadgeClass(rule.sourceMode)]">{{ getSourceModeBadgeLabel(rule.sourceMode) }}</span></div>
                    <div v-if="getRuleFilterSummary(rule)" class="muted">过滤：{{ getRuleFilterSummary(rule) }}</div>
                    <div v-if="getRuleActionSummary(rule)" class="muted">动作：{{ getRuleActionSummary(rule) }}</div>
                    <div v-if="rule.description" class="muted">{{ rule.description }}</div>
                    <div class="actions">
                        <Button size="sm" variant="outline" @click="handleEditRule(rule)">编辑</Button>
                        <Button size="sm" variant="outline" @click="handleTestRule(rule.id)">测试</Button>
                        <Button v-if="getPrimaryRuleComponentId(rule)" size="sm" variant="ghost" @click="locateComponent(getPrimaryRuleComponentId(rule))">定位</Button>
                        <Button size="sm" variant="ghost" @click="toggleRuleMuted(rule.id)">{{ rule.muted ? '解除静默' : '静默' }}</Button>
                        <Button size="sm" variant="ghost" @click="toggleRule(rule.id)">{{ rule.enabled ? '停用' : '启用' }}</Button>
                        <Button size="sm" variant="ghost" @click="handleDeleteRule(rule.id)">删除</Button>
                    </div>
                </div>
            </div>
        </div>

        <div class="panel-section">
            <div class="section-title">最近历史</div>
            <div v-if="filteredHistory.length === 0" class="empty-text">暂无历史记录</div>
            <div v-else class="list">
                <div v-for="record in filteredHistory" :key="`${record.id}-${record.status}-${record.resolvedAt || record.lastTriggeredAt}`" class="card">
                    <div class="card-header">
                        <div class="title-line"><span :class="['severity-badge', `severity-badge--${record.severity}`]">{{ getSeverityLabel(record.severity) }}</span><strong>{{ record.ruleName }}</strong></div>
                        <span class="muted">{{ getHistoryStatusLabel(record.status) }}</span>
                    </div>
                    <div class="message">{{ record.message }}</div>
                    <div class="muted">{{ formatTime(record.resolvedAt || record.lastTriggeredAt || record.triggeredAt) }}</div>
                </div>
            </div>
        </div>

        <Modal v-model="showEditModal" :title="isEditing ? '编辑告警规则' : '新增告警规则'" width="760px">
            <div class="edit-form">
                <div class="form-grid">
                    <div class="form-group"><label>规则名称</label><Input v-model="editForm.name" placeholder="例如：高温告警" /></div>
                    <div class="form-group"><label>数据模式</label><Select v-model="editForm.sourceMode" :options="sourceModeOptions" /></div>
                </div>
                <div v-if="editForm.sourceMode === 'public-source'" class="form-grid">
                    <div class="form-group"><label>公共接口</label><Select v-model="editForm.sourceId" :options="publicSourceOptions" /></div>
                    <div class="form-group"><label>接口说明</label><Input :model-value="currentPublicSourceDescription" readonly /></div>
                </div>
                <div v-else-if="editForm.sourceMode === 'data-source'" class="form-grid">
                    <div class="form-group"><label>数据接入</label><Select v-model="editForm.sourceId" :options="currentModeSourceOptions" /></div>
                    <div class="form-group"><label>来源说明</label><Input :model-value="dataAccessLoading ? '加载数据接入中...' : '使用 /view/data-access 中配置的数据接入'" readonly /></div>
                </div>
                <div v-else-if="editForm.sourceMode === 'websocket'" class="form-grid">
                    <div class="form-group"><label>当前组件</label><Input :model-value="currentAlarmSourceComponentLabel" placeholder="请先在场景中选中一个组件" readonly /></div>
                    <div class="form-group"><label>WebSocket</label><Select v-model="editForm.sourceId" :options="currentModeSourceOptions" /></div>
                </div>
                <div v-if="editForm.sourceMode === 'data-source' || editForm.sourceMode === 'websocket' || editForm.sourceMode === 'public-source'" class="form-group">
                    <div class="path-input-row">
                        <div class="path-input-row__main">
                            <label>取值路径</label>
                            <Input v-model="editForm.sourcePath" placeholder="例如：data.status 或 items[0].value" />
                        </div>
                        <Button size="sm" variant="outline" class="path-input-row__action" @click="openPathPicker('source')" :disabled="pathPickerLoading">{{ pathPickerLoading ? '加载中...' : '预览数据' }}</Button>
                    </div>
                    <div class="muted">点击“预览数据”后，可从当前数据接入返回结果或 JSON 数据结构中选择键值并自动回填。</div>
                </div>
                <div v-if="editForm.sourceMode === 'data-source' || editForm.sourceMode === 'public-source'" class="form-group">
                    <label>轮询时间 (ms)</label>
                    <Input v-model="editForm.pollingIntervalMs" type="number" placeholder="例如：30000" />
                    <div class="muted">初始化会先请求一次数据，之后按这里的间隔持续轮询。填 0 表示不自动轮询，仅在手动评估或规则保存后拉取一次。</div>
                </div>
                <div v-else class="form-grid">
                    <div class="form-group"><label>变量</label><Select v-model="editForm.variableName" :options="variableOptions" /></div>
                </div>
                <div class="form-group">
                    <div class="section-header">
                        <label>数据过滤</label>
                        <label class="checkbox-line"><input v-model="editForm.filter.enabled" type="checkbox" /><span>启用预过滤</span></label>
                    </div>
                    <div class="muted">每次消息回调先执行过滤，命中过滤后再判断告警条件，条件成立才触发动作。</div>
                    <div v-if="editForm.filter.enabled" class="form-grid compact">
                        <div class="form-group">
                            <div class="path-input-row">
                                <div class="path-input-row__main">
                                    <label>过滤路径</label>
                                    <Input v-model="editForm.filter.path" placeholder="例如：data.deviceType" />
                                </div>
                                <Button size="sm" variant="outline" class="path-input-row__action" @click="openPathPicker('filter')" :disabled="pathPickerLoading">{{ pathPickerLoading ? '加载中...' : '预览数据' }}</Button>
                            </div>
                        </div>
                        <div class="form-group"><label>过滤运算符</label><Select v-model="editForm.filter.operator" :options="filterOperatorOptions" /></div>
                        <div class="form-group"><label>过滤阈值</label><Input v-model="editForm.filter.threshold" placeholder="例如：alarm" /></div>
                    </div>
                </div>
                <div class="form-grid">
                    <div class="form-group"><label>等级</label><Select v-model="editForm.severity" :options="severityOptions" /></div>
                    <div class="form-group"><label>联动组件（旧规则兼容）</label><Select v-model="editForm.targetComponentId" :options="componentOptions" /></div>
                </div>
                <div class="form-grid compact">
                    <div class="form-group"><label>运算符</label><Select v-model="editForm.operator" :options="operatorOptions" /></div>
                    <div class="form-group"><label>阈值</label><Input v-model="editForm.threshold" placeholder="例如：80" /></div>
                    <div class="form-group"><label>触发延时 (ms)</label><Input v-model="editForm.triggerDelayMs" type="number" placeholder="0" /></div>
                    <div class="form-group"><label>恢复延时 (ms)</label><Input v-model="editForm.recoverDelayMs" type="number" placeholder="0" /></div>
                </div>
                <div class="form-group"><label>标题模板</label><Input v-model="editForm.titleTemplate" placeholder="{ruleName}" /></div>
                <div class="form-group"><label>消息模板</label><textarea v-model="editForm.messageTemplate" class="textarea" rows="3" placeholder="支持 {ruleName} {value} {threshold} {severity} {sourceId} {sourcePath}"></textarea></div>
                <div class="form-group">
                    <div class="section-header">
                        <label>动作配置</label>
                        <div class="toolbar compact-toolbar">
                            <Button size="sm" variant="outline" @click="addAction(ALARM_ACTION_TYPES.HIGHLIGHT_MODEL)">模型高亮</Button>
                            <Button size="sm" variant="outline" @click="addAction(ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D)">标签高亮</Button>
                            <Button size="sm" variant="outline" @click="addAction(ALARM_ACTION_TYPES.TOAST)">消息</Button>
                            <Button size="sm" variant="outline" @click="addAction(ALARM_ACTION_TYPES.MODAL)">弹窗</Button>
                            <Button size="sm" variant="outline" @click="addAction(ALARM_ACTION_TYPES.SCREEN_FLASH)">闪烁</Button>
                        </div>
                    </div>
                    <div v-if="editForm.actions.length === 0" class="empty-text">未配置动作时，仅保留旧规则组件定位能力。</div>
                    <div v-else class="list">
                        <div v-for="(action, index) in editForm.actions" :key="`${action.type}-${index}`" class="card">
                            <div class="card-header"><strong>动作 {{ index + 1 }}</strong><Button size="sm" variant="ghost" @click="removeAction(index)">删除</Button></div>
                            <div class="form-group"><label>动作类型</label><Select :model-value="action.type" :options="actionTypeOptions" @update:model-value="handleActionTypeChange(index, $event)" /></div>
                            <template v-if="action.type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL">
                                <div class="form-grid">
                                    <div class="form-group"><label>模型组件</label><Select v-model="action.componentId" :options="modelComponentOptions" /></div>
                                    <div class="form-group"><label>Mesh</label><Select v-model="action.meshName" :options="getMeshOptionsForComponent(action.componentId)" /></div>
                                    <div class="form-group"><label>颜色</label><Input v-model="action.color" placeholder="#ff4d4f" /></div>
                                    <div class="form-group"><label>强度</label><Input v-model="action.intensity" type="number" placeholder="0.6" /></div>
                                </div>
                                <label class="checkbox-line"><input v-model="action.blink" type="checkbox" /><span>闪烁高亮</span></label>
                            </template>
                            <template v-else-if="action.type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D">
                                <div class="form-grid">
                                    <div class="form-group"><label>标签组件</label><Select v-model="action.componentId" :options="label3DComponentOptions" /></div>
                                    <div class="form-group"><label>标签</label><Select v-model="action.labelId" :options="getLabelOptionsForComponent(action.componentId)" /></div>
                                    <div class="form-group"><label>文字颜色</label><Input v-model="action.color" placeholder="#ff4d4f" /></div>
                                    <div class="form-group"><label>背景颜色</label><Input v-model="action.backgroundColor" placeholder="rgba(255,77,79,0.18)" /></div>
                                </div>
                                <label class="checkbox-line"><input v-model="action.blink" type="checkbox" /><span>闪烁高亮</span></label>
                            </template>
                            <div v-else-if="action.type === ALARM_ACTION_TYPES.TOAST" class="form-group"><label>消息时长 (ms)</label><Input v-model="action.durationMs" type="number" placeholder="3000" /></div>
                            <div v-else-if="action.type === ALARM_ACTION_TYPES.SCREEN_FLASH" class="form-grid">
                                <div class="form-group"><label>闪烁颜色</label><Input v-model="action.color" placeholder="rgba(239, 68, 68, 0.2)" /></div>
                                <div class="form-group"><label>透明度</label><Input v-model="action.opacity" type="number" placeholder="0.2" /></div>
                                <div class="form-group"><label>持续时长 (ms)</label><Input v-model="action.durationMs" type="number" placeholder="1200" /></div>
                                <div class="form-group"><label>闪烁次数</label><Input v-model="action.blinkCount" type="number" placeholder="2" /></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-group"><label>说明</label><textarea v-model="editForm.description" class="textarea" rows="2" placeholder="填写规则用途"></textarea></div>
                <div class="form-grid compact">
                    <label class="checkbox-line"><input v-model="editForm.enabled" type="checkbox" /><span>创建后立即启用</span></label>
                    <label class="checkbox-line"><input v-model="editForm.muted" type="checkbox" /><span>创建时即静默</span></label>
                    <label class="checkbox-line"><input v-model="editForm.autoClear" type="checkbox" /><span>恢复后自动清除</span></label>
                </div>
                <div v-if="formError" class="error-text">{{ formError }}</div>
            </div>
            <template #footer><div class="row-end"><Button v-if="isEditing && editingRuleId" variant="outline" @click="handleTestRule(editingRuleId)">测试当前规则</Button><Button variant="outline" @click="showEditModal = false">取消</Button><Button @click="handleSaveRule">{{ isEditing ? '保存' : '创建' }}</Button></div></template>
        </Modal>

        <Modal v-model="showPathPickerModal" :title="pathPickerTitle" width="860px">
            <div class="path-picker">
                <div class="path-picker__toolbar">
                    <div class="muted">{{ pathPickerHint }}</div>
                    <Button size="sm" variant="outline" @click="refreshPathPickerData" :disabled="pathPickerLoading">{{ pathPickerLoading ? '刷新中...' : '刷新数据' }}</Button>
                </div>
                <div v-if="pathPickerError" class="error-text">{{ pathPickerError }}</div>
                <div v-else-if="pathPickerTree.length === 0" class="empty-text">当前没有可预览的数据，请先让数据源返回一条消息。</div>
                <div v-else class="path-picker__tree">
                    <JsonPathTreeNode
                        v-for="node in pathPickerTree"
                        :key="node.key"
                        :node="node"
                        :expanded-keys="pathPickerExpandedKeys"
                        @toggle="togglePathPickerNode"
                        @pick="applyPickedPath"
                    />
                </div>
                <div class="section-title path-picker__subtitle">当前预览数据</div>
                <textarea class="textarea path-picker__json" :value="pathPickerPreviewText" readonly />
            </div>
            <template #footer><div class="row-end"><Button variant="outline" @click="showPathPickerModal = false">关闭</Button></div></template>
        </Modal>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useAlarmStore, ALARM_OPERATORS, ALARM_SEVERITIES, ALARM_SEVERITY_CONFIG, ALARM_ACTION_TYPES } from '../../stores/useAlarmStore';
import { useVariableStore } from '../../stores/useVariableStore';
import { useComponentStore } from '../../stores/useComponentStore';
import { useDataSourceStore } from '../../stores/useDataSourceStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import { useComponent } from '../../composables/useComponent';
import { fetchDataAccessList, executeDataAccess } from '../../api/dataAccess';
import { executeRuntimeDataSource, getDataSourceRuntimeState } from '../../services/dataSourceRuntime';
import Button from '../ui/Button.vue';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Modal from '../ui/Modal.vue';
import JsonPathTreeNode from '../ui/JsonPathTreeNode.vue';

const alarmStore = useAlarmStore();
const variableStore = useVariableStore();
const componentStore = useComponentStore();
const dataSourceStore = useDataSourceStore();
const projectStore = useProjectStore();
const toast = useToast();
const { confirm: showConfirm } = useConfirm();
const { selectComponent } = useComponent();

const showEditModal = ref(false);
const isEditing = ref(false);
const editingRuleId = ref(null);
const formError = ref('');
const dataAccessOptions = ref([]);
const dataAccessLoading = ref(false);
const notificationForm = ref({ browserEnabled: alarmStore.notificationSettings.browserEnabled, soundEnabled: alarmStore.notificationSettings.soundEnabled, soundFrequency: alarmStore.notificationSettings.soundFrequency, soundDurationMs: alarmStore.notificationSettings.soundDurationMs });
const filterForm = ref({ keyword: '', severity: '', state: '' });
const sourceModeOptions = [
    { label: '公共接口', value: 'public-source' },
    { label: '数据接入（兼容）', value: 'data-source' },
    { label: '当前组件 WebSocket', value: 'websocket' },
    { label: '变量模式（兼容）', value: 'variable' }
];
const severityOptions = Object.entries(ALARM_SEVERITY_CONFIG).map(([value, config]) => ({ label: config.label, value }));
const severityFilterOptions = [{ label: '全部等级', value: '' }, ...severityOptions];
const stateFilterOptions = [{ label: '全部状态', value: '' }, { label: '活跃中', value: 'active' }, { label: '待触发', value: 'pending-trigger' }, { label: '待恢复', value: 'pending-recover' }, { label: '已静默', value: 'muted' }, { label: '已停用', value: 'disabled' }, { label: '已启用', value: 'enabled' }];
const operatorOptions = [{ label: '大于', value: ALARM_OPERATORS.GT }, { label: '大于等于', value: ALARM_OPERATORS.GTE }, { label: '小于', value: ALARM_OPERATORS.LT }, { label: '小于等于', value: ALARM_OPERATORS.LTE }, { label: '等于', value: ALARM_OPERATORS.EQ }, { label: '不等于', value: ALARM_OPERATORS.NEQ }, { label: '包含', value: ALARM_OPERATORS.CONTAINS }, { label: '值变化', value: ALARM_OPERATORS.CHANGED }];
const filterOperatorOptions = operatorOptions.filter((item) => item.value !== ALARM_OPERATORS.CHANGED);
const actionTypeOptions = [{ label: '模型高亮', value: ALARM_ACTION_TYPES.HIGHLIGHT_MODEL }, { label: '3D 标签高亮', value: ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D }, { label: '消息提示', value: ALARM_ACTION_TYPES.TOAST }, { label: '模态弹窗', value: ALARM_ACTION_TYPES.MODAL }, { label: '整屏闪烁', value: ALARM_ACTION_TYPES.SCREEN_FLASH }];
const variableOptions = computed(() => variableStore.variables.map((item) => ({ label: `${item.name} (${item.type})`, value: item.name })));
const componentOptions = computed(() => [{ label: '不绑定组件', value: '' }, ...componentStore.components.map((item) => ({ label: `${item.name} (${item.type})`, value: item.id }))]);
const modelComponentOptions = computed(() => componentStore.components.filter((item) => item.type === 'ModelLoader').map((item) => ({ label: `${item.name} (${item.type})`, value: item.id })));
const label3DComponentOptions = computed(() => componentStore.components.filter((item) => item.type === 'Label3D').map((item) => ({ label: `${item.name} (${item.type})`, value: item.id })));
const createDefaultAction = (type = ALARM_ACTION_TYPES.TOAST) => { if (type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL) return { type, componentId: modelComponentOptions.value[0]?.value || '', meshName: '', color: '#ff4d4f', intensity: 0.6, blink: true }; if (type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D) return { type, componentId: label3DComponentOptions.value[0]?.value || '', labelId: '', color: '#ff4d4f', backgroundColor: 'rgba(255,77,79,0.18)', blink: true }; if (type === ALARM_ACTION_TYPES.SCREEN_FLASH) return { type, color: 'rgba(239, 68, 68, 0.2)', opacity: 0.2, durationMs: 1200, blinkCount: 2 }; if (type === ALARM_ACTION_TYPES.MODAL) return { type }; return { type: ALARM_ACTION_TYPES.TOAST, durationMs: 3000 }; };
const createDefaultFilter = () => ({ enabled: false, path: '', operator: ALARM_OPERATORS.EQ, threshold: '' });
const createDefaultForm = () => ({ name: '', sourceMode: 'public-source', variableName: variableStore.variables[0]?.name || '', sourceComponentId: '', sourceId: '', sourcePath: '', targetComponentId: '', operator: ALARM_OPERATORS.GT, threshold: '', severity: ALARM_SEVERITIES.WARNING, enabled: true, muted: false, pollingIntervalMs: 30000, triggerDelayMs: 0, recoverDelayMs: 0, autoClear: true, titleTemplate: '{ruleName}', messageTemplate: '{ruleName} 触发，当前值为 {value}', description: '', filter: createDefaultFilter(), actions: [] });
const operatorRequiresThreshold = (operator) => operator !== ALARM_OPERATORS.CHANGED;
const hasMeaningfulThreshold = (value) => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
const editForm = ref(createDefaultForm());
const ALARM_PUBLIC_RUNTIME_COMPONENT_ID = '__alarm_public__';
const showPathPickerModal = ref(false);
const pathPickerLoading = ref(false);
const pathPickerError = ref('');
const pathPickerTree = ref([]);
const pathPickerExpandedKeys = ref(new Set());
const pathPickerPreviewText = ref('');
const pathPickerTarget = ref('source');
const recentlySavedRuleId = ref('');
const recentHistory = computed(() => alarmStore.alarmHistory.slice(0, 8));
const pendingRuleCount = computed(() => alarmStore.rules.filter((rule) => ['pending-trigger', 'pending-recover'].includes(alarmStore.getRuleRuntimeState(rule.id).status)).length);
const notificationPermissionLabel = computed(() => typeof window === 'undefined' || !('Notification' in window) ? '当前环境不支持' : (window.Notification.permission === 'granted' ? '已授权' : (window.Notification.permission === 'denied' ? '已拒绝' : '未授权')));
const normalizedKeyword = computed(() => filterForm.value.keyword.trim().toLowerCase());
const matchesKeyword = (value) => !normalizedKeyword.value || String(value || '').toLowerCase().includes(normalizedKeyword.value);
const matchesSeverity = (severity) => !filterForm.value.severity || filterForm.value.severity === severity;
const matchesRuleState = (rule) => { const state = filterForm.value.state; if (!state) return true; const runtimeState = alarmStore.getRuleRuntimeState(rule.id); const isActive = alarmStore.activeAlarms.some((item) => item.ruleId === rule.id); if (state === 'active') return isActive; if (state === 'pending-trigger' || state === 'pending-recover') return runtimeState.status === state; if (state === 'muted') return rule.muted === true; if (state === 'disabled') return rule.enabled === false; if (state === 'enabled') return rule.enabled !== false; return true; };
const cloneActions = (actions = []) => Array.isArray(actions) ? actions.map((item) => ({ ...item })) : [];
const getComponentName = (componentId) => componentId ? (componentStore.getComponentById(componentId)?.name || componentId) : '';
const getSourceModeBadgeLabel = (mode = 'data-source') => {
    if (mode === 'public-source') return '公共';
    if (mode === 'websocket') return '实时';
    if (mode === 'mqtt') return '订阅';
    if (mode === 'data-source') return '蓝图';
    if (mode === 'local') return '离线';
    return '请求';
};
const getSourceModeBadgeClass = (mode = 'data-source') => `source-mode-badge--${mode || 'data-source'}`;
const loadDataAccessCatalog = async () => {
    if (dataAccessLoading.value) return;
    dataAccessLoading.value = true;
    try {
        const result = await fetchDataAccessList();
        const list = Array.isArray(result) ? result : [];
        dataAccessOptions.value = list.map((item) => ({
            label: item?.accessName ? `[蓝图] ${item.accessName} (${item.accessCode})` : `[蓝图] ${item?.accessCode || ''}`,
            value: String(item?.accessCode || '').trim()
        })).filter((item) => item.value);
    } catch (error) {
        console.error('[AlarmCenter] load data access failed:', error);
        toast.error(`加载数据接入失败: ${error.message}`);
    } finally {
        dataAccessLoading.value = false;
    }
};

const getDataSourceOptionsForComponent = (componentId, mode = 'data-source') => {
    const sources = componentStore.getComponentById(componentId)?.dataBinding?.sources || [];
    return sources
        .filter((item) => {
            const sourceMode = String(item?.mode || 'http');
            if (mode === 'websocket') return sourceMode === 'websocket';
            return sourceMode !== 'websocket' && sourceMode !== 'mqtt';
        })
        .map((item) => {
            const sourceMode = String(item?.mode || 'http');
            const modeText = getSourceModeBadgeLabel(sourceMode === 'data-access' ? 'data-source' : sourceMode);
            return { label: item?.name ? `[${modeText}] ${item.name} (${item.id})` : `[${modeText}] ${item.id}`, value: item.id };
        });
};
const currentAlarmSourceComponentId = computed(() => componentStore.selectedComponentId || editForm.value.sourceComponentId || '');
const currentAlarmSourceComponentLabel = computed(() => currentAlarmSourceComponentId.value ? getComponentName(currentAlarmSourceComponentId.value) : '');
const publicSourceOptions = computed(() => dataSourceStore.publicDataSourceOptions);
const currentPublicSource = computed(() => dataSourceStore.getPublicDataSourceById(editForm.value.sourceId));
const currentPublicSourceDescription = computed(() => {
    const item = currentPublicSource.value;
    if (!item) return '请选择项目级公共接口';
    if (item.mode === 'data-access') return `数据接入 / ${item.accessCode || '-'}`;
    if (item.mode === 'websocket') return `WebSocket / ${item.websocketUrl || item.url || '-'}`;
    return `HTTP ${item.method || 'GET'} / ${item.url || '-'}`;
});
const currentModeSourceOptions = computed(() => {
    if (editForm.value.sourceMode === 'data-source') {
        return dataAccessOptions.value;
    }
    return getDataSourceOptionsForComponent(currentAlarmSourceComponentId.value, editForm.value.sourceMode);
});
const getDataSourceLabel = (componentId, sourceId) => {
    if (!componentId) {
        return dataAccessOptions.value.find((item) => item.value === String(sourceId || '').trim())?.label || sourceId || '';
    }
    const sources = componentStore.getComponentById(componentId)?.dataBinding?.sources || [];
    const matched = sources.find((item) => String(item?.id || '') === String(sourceId || ''));
    return matched?.name || sourceId || '';
};
const pathPickerTitle = computed(() => pathPickerTarget.value === 'filter' ? '预览数据并选择过滤路径' : '预览数据并选择取值路径');
const pathPickerHint = computed(() => pathPickerTarget.value === 'filter' ? '预览当前消息数据，从结构中选择一个键值路径回填到过滤路径。' : '预览当前数据接入返回结果或 JSON 数据结构，从中选择一个键值路径回填到取值路径。');
const getOperatorLabel = (operator) => operatorOptions.find((item) => item.value === operator)?.label || operator || '';
const getRuleConditionSummary = (rule) => {
    if ((rule.sourceMode || '') === 'public-source' && rule.sourceId) {
        const sourceLabel = dataSourceStore.getPublicDataSourceById(rule.sourceId)?.name || rule.sourceId;
        const pathLabel = rule.sourcePath ? `.${rule.sourcePath}` : '';
        return `${sourceLabel}${pathLabel} ${rule.operator} ${rule.threshold || '-'}`;
    }
    if ((rule.sourceMode || 'data-source') === 'data-source' && rule.sourceId) {
        const sourceLabel = getDataSourceLabel('', rule.sourceId);
        const pathLabel = rule.sourcePath ? `.${rule.sourcePath}` : '';
        return `${sourceLabel}${pathLabel} ${rule.operator} ${rule.threshold || '-'}`;
    }
    if ((rule.sourceMode || 'data-source') === 'websocket' && rule.sourceComponentId && rule.sourceId) {
        const sourceLabel = getDataSourceLabel(rule.sourceComponentId, rule.sourceId);
        const pathLabel = rule.sourcePath ? `.${rule.sourcePath}` : '';
        return `${getComponentName(rule.sourceComponentId)} / ${sourceLabel}${pathLabel} ${rule.operator} ${rule.threshold || '-'}`;
    }
    return `${rule.variableName} ${rule.operator} ${rule.threshold || '-'}`;
};
const getRuleFilterSummary = (rule) => {
    if (rule?.filter?.enabled !== true) return '';
    const pathLabel = rule.filter.path ? rule.filter.path : '(当前消息)';
    return `${pathLabel} ${getOperatorLabel(rule.filter.operator)} ${formatInlineValue(rule.filter.threshold)}`;
};
const getAlarmConditionSummary = (alarm) => {
    if ((alarm.sourceMode || '') === 'public-source' && alarm.sourceId) {
        const sourceLabel = dataSourceStore.getPublicDataSourceById(alarm.sourceId)?.name || alarm.sourceId;
        const pathLabel = alarm.sourcePath ? `.${alarm.sourcePath}` : '';
        return `${sourceLabel}${pathLabel} ${alarm.operator} ${alarm.threshold || '-'}`;
    }
    if ((alarm.sourceMode || 'data-source') === 'data-source' && alarm.sourceId) {
        const sourceLabel = getDataSourceLabel('', alarm.sourceId);
        const pathLabel = alarm.sourcePath ? `.${alarm.sourcePath}` : '';
        return `${sourceLabel}${pathLabel} ${alarm.operator} ${alarm.threshold || '-'}`;
    }
    if ((alarm.sourceMode || 'data-source') === 'websocket' && alarm.sourceComponentId && alarm.sourceId) {
        const sourceLabel = getDataSourceLabel(alarm.sourceComponentId, alarm.sourceId);
        const pathLabel = alarm.sourcePath ? `.${alarm.sourcePath}` : '';
        return `${getComponentName(alarm.sourceComponentId)} / ${sourceLabel}${pathLabel} ${alarm.operator} ${alarm.threshold || '-'}`;
    }
    return `${alarm.variableName} ${alarm.operator} ${alarm.threshold || '-'}`;
};
const getPrimaryRuleComponentId = (rule) => (Array.isArray(rule.actions) ? rule.actions.find((item) => item?.componentId)?.componentId : '') || rule.targetComponentId || '';
const getRuleActionSummary = (rule) => { const actions = Array.isArray(rule.actions) ? rule.actions : []; if (!actions.length) return rule.targetComponentId ? `组件高亮：${getComponentName(rule.targetComponentId)}` : ''; return actions.map((action) => { if (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL) return `模型高亮：${getComponentName(action.componentId)} / ${action.meshName || '-'}`; if (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D) return `标签高亮：${getComponentName(action.componentId)} / ${action.labelId || '-'}`; if (action.type === ALARM_ACTION_TYPES.TOAST) return '消息提示'; if (action.type === ALARM_ACTION_TYPES.MODAL) return '模态弹窗'; if (action.type === ALARM_ACTION_TYPES.SCREEN_FLASH) return '整屏闪烁'; return action.type; }).join(' / '); };
const formatRemainingMs = (value) => Number(value || 0) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}s` : `${Math.max(0, Math.round(Number(value || 0)))}ms`;
const getRuntimeBadge = (rule) => { const state = alarmStore.getRuleRuntimeState(rule.id); if (state.status === 'pending-trigger') return { label: `待触发 ${formatRemainingMs(state.remainingMs)}` }; if (state.status === 'pending-recover') return { label: `待恢复 ${formatRemainingMs(state.remainingMs)}` }; return { label: '' }; };
const formatTime = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '未执行';
const formatInlineValue = (value) => value === null || value === undefined ? '-' : (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value));
const stringifyPreview = (value) => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value ?? '');
    }
};
const getValueType = (value) => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
};
const formatPathSegment = (segment) => {
    if (typeof segment === 'number') return `[${segment}]`;
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(segment)) ? String(segment) : `["${String(segment).replace(/"/g, '\\"')}"]`;
};
const joinPathSegments = (segments = []) => segments.reduce((path, segment, index) => {
    const formatted = formatPathSegment(segment);
    if (typeof segment === 'number') {
        return `${path}${formatted}`;
    }
    if (index === 0) {
        return formatted;
    }
    return formatted.startsWith('[') ? `${path}${formatted}` : `${path}.${formatted}`;
}, '');
const buildPathPickerTree = (value, segments = [], label = '(当前消息)') => {
    const path = joinPathSegments(segments);
    const node = {
        key: path || '__root__',
        label,
        path,
        pathLabel: path || '(当前消息)',
        type: getValueType(value),
        sample: formatInlineValue(value),
        children: []
    };

    if (Array.isArray(value)) {
        node.children = value.slice(0, 20).map((item, index) => buildPathPickerTree(item, [...segments, index], `[${index}]`));
        return node;
    }

    if (value && typeof value === 'object') {
        node.children = Object.entries(value).slice(0, 50).map(([key, item]) => buildPathPickerTree(item, [...segments, key], key));
    }

    return node;
};
const collectExpandablePathPickerKeys = (node, expandedKeys = new Set()) => {
    if (!node || !Array.isArray(node.children) || node.children.length === 0) return expandedKeys;
    expandedKeys.add(node.key);
    node.children.forEach((child) => collectExpandablePathPickerKeys(child, expandedKeys));
    return expandedKeys;
};
const getCurrentComponentSourceDefinition = () => {
    const componentId = currentAlarmSourceComponentId.value;
    const sourceId = String(editForm.value.sourceId || '').trim();
    if (!componentId || !sourceId) return null;
    const sources = componentStore.getComponentById(componentId)?.dataBinding?.sources || [];
    return sources.find((item) => String(item?.id || '') === sourceId) || null;
};
const resolvePathPickerPayload = async () => {
    const sourceMode = String(editForm.value.sourceMode || '').trim();

    if (sourceMode === 'data-source') {
        const accessCode = String(editForm.value.sourceId || '').trim();
        if (!accessCode) throw new Error('请先选择数据接入');
        const result = await executeDataAccess(accessCode, {});
        return result?.data;
    }

    if (sourceMode === 'public-source') {
        const source = dataSourceStore.getPublicDataSourceById(editForm.value.sourceId);
        if (!source) throw new Error('未找到公共接口配置');
        if (source.mode === 'websocket') {
            const runtimeState = getDataSourceRuntimeState(ALARM_PUBLIC_RUNTIME_COMPONENT_ID, source.id);
            if (runtimeState?.lastPayload === null || runtimeState?.lastPayload === undefined) {
                throw new Error('当前公共 WebSocket 还没有收到消息');
            }
            return runtimeState.lastPayload;
        }
        const result = await executeRuntimeDataSource({
            source: {
                ...source,
                id: source.id,
                mode: source.mode,
                accessCode: source.accessCode,
                url: source.mode === 'websocket' ? (source.websocketUrl || source.url) : source.url
            },
            apiBaseUrl: dataSourceStore.globalConfig?.baseUrl || '',
            globalConfig: {
                ...dataSourceStore.globalConfig,
                headersObject: dataSourceStore.headersObject
            },
            componentId: ALARM_PUBLIC_RUNTIME_COMPONENT_ID
        });
        return result?.data;
    }

    if (sourceMode === 'websocket') {
        const source = getCurrentComponentSourceDefinition();
        if (!source) throw new Error('请先选择 WebSocket 数据源');
        const runtimeState = getDataSourceRuntimeState(currentAlarmSourceComponentId.value, source.id);
        if (runtimeState?.lastPayload === null || runtimeState?.lastPayload === undefined) {
            throw new Error('当前 WebSocket 还没有收到消息');
        }
        return runtimeState.lastPayload;
    }

    throw new Error('当前数据模式不支持路径预览');
};
const refreshPathPickerData = async () => {
    try {
        pathPickerLoading.value = true;
        pathPickerError.value = '';
        const payload = await resolvePathPickerPayload();
        const tree = buildPathPickerTree(payload);
        pathPickerTree.value = tree ? [tree] : [];
        pathPickerExpandedKeys.value = tree ? collectExpandablePathPickerKeys(tree, new Set()) : new Set();
        pathPickerPreviewText.value = stringifyPreview(payload);
    } catch (error) {
        pathPickerTree.value = [];
        pathPickerExpandedKeys.value = new Set();
        pathPickerPreviewText.value = '';
        pathPickerError.value = error.message || String(error);
    } finally {
        pathPickerLoading.value = false;
    }
};
const togglePathPickerNode = (key) => {
    const nextKeys = new Set(pathPickerExpandedKeys.value);
    if (nextKeys.has(key)) {
        nextKeys.delete(key);
    } else {
        nextKeys.add(key);
    }
    pathPickerExpandedKeys.value = nextKeys;
};
const openPathPicker = async (target = 'source') => {
    pathPickerTarget.value = target;
    showPathPickerModal.value = true;
    await refreshPathPickerData();
};
const applyPickedPath = (path) => {
    if (pathPickerTarget.value === 'filter') {
        editForm.value.filter.path = path;
    } else {
        editForm.value.sourcePath = path;
    }
    showPathPickerModal.value = false;
};
const getSeverityLabel = (severity) => ALARM_SEVERITY_CONFIG[severity]?.label || severity;
const getHistoryStatusLabel = (status) => ({ triggered: '触发', acknowledged: '确认', cleared: '恢复', recovered: '恢复', 'cleared-manual': '手动清除', deleted: '规则删除', disabled: '规则停用', suppressed: '规则静默', 'missing-variable': '变量缺失' }[status] || status);
const filteredActiveAlarms = computed(() => alarmStore.activeAlarms.filter((alarm) => matchesSeverity(alarm.severity) && [alarm.ruleName, alarm.variableName, alarm.sourceId, alarm.sourcePath, alarm.message, alarm.title].some(matchesKeyword)));
const filteredRules = computed(() => alarmStore.rules.filter((rule) => matchesSeverity(rule.severity) && matchesRuleState(rule) && [rule.name, rule.variableName, rule.sourceId, rule.sourcePath, rule.description, getRuleActionSummary(rule)].some(matchesKeyword)));
const filteredHistory = computed(() => recentHistory.value.filter((record) => matchesSeverity(record.severity) && [record.ruleName, record.variableName, record.sourceId, record.sourcePath, record.message, getHistoryStatusLabel(record.status)].some(matchesKeyword)));
const isRuleVisibleUnderCurrentFilters = (rule) => matchesSeverity(rule?.severity) && matchesRuleState(rule) && [rule?.name, rule?.variableName, rule?.sourceId, rule?.sourcePath, rule?.description, getRuleActionSummary(rule)].some(matchesKeyword);
const getMeshOptionsForComponent = (componentId) => { const list = componentStore.getComponentById(componentId)?.instance?.getMeshListSnapshot?.() || []; const used = new Set(); return list.map((item) => item?.name).filter((name) => name && !used.has(name) && used.add(name)).map((name) => ({ label: name, value: name })); };
const getLabelOptionsForComponent = (componentId) => (componentStore.getComponentById(componentId)?.instance?.getAllLabels?.() || []).map((item) => ({ label: item?.label ? `${item.label} (${item.id})` : item.id, value: item.id }));
const addAction = (type = ALARM_ACTION_TYPES.TOAST) => editForm.value.actions.push(createDefaultAction(type));
const removeAction = (index) => editForm.value.actions.splice(index, 1);
const handleActionTypeChange = (index, nextType) => editForm.value.actions.splice(index, 1, createDefaultAction(nextType));
const markProjectDirty = () => projectStore.markAsUnsaved();
const locateComponent = (componentId) => { if (!componentId) return; if (!componentStore.getComponentById(componentId)) return toast.warning('绑定组件已不存在'); selectComponent(componentId); toast.success(`已定位到组件：${getComponentName(componentId)}`); };
const handleAddRule = async () => { isEditing.value = false; editingRuleId.value = null; editForm.value = createDefaultForm(); formError.value = ''; await loadDataAccessCatalog(); showEditModal.value = true; };
const handleEditRule = async (rule) => { isEditing.value = true; editingRuleId.value = rule.id; editForm.value = { name: rule.name, sourceMode: rule.sourceMode || (rule.sourceId ? 'data-source' : 'variable'), variableName: rule.variableName, sourceComponentId: rule.sourceComponentId || componentStore.selectedComponentId || '', sourceId: rule.sourceId || '', sourcePath: rule.sourcePath || '', targetComponentId: rule.targetComponentId || '', operator: rule.operator, threshold: rule.threshold, severity: rule.severity, enabled: rule.enabled, muted: rule.muted === true, pollingIntervalMs: rule.pollingIntervalMs ?? 30000, triggerDelayMs: rule.triggerDelayMs || 0, recoverDelayMs: rule.recoverDelayMs || 0, autoClear: rule.autoClear, titleTemplate: rule.titleTemplate || '{ruleName}', messageTemplate: rule.messageTemplate, description: rule.description || '', filter: { ...createDefaultFilter(), ...(rule.filter || {}) }, actions: cloneActions(rule.actions) }; formError.value = ''; await loadDataAccessCatalog(); showEditModal.value = true; };
const handleSaveRule = async () => {
    formError.value = '';
    try {
        const payload = { ...editForm.value };
        if (operatorRequiresThreshold(payload.operator) && !hasMeaningfulThreshold(payload.threshold)) {
            throw new Error('当前告警条件缺少阈值，请填写比较值');
        }
        if (payload.filter?.enabled === true && operatorRequiresThreshold(payload.filter.operator) && !hasMeaningfulThreshold(payload.filter.threshold)) {
            throw new Error('当前过滤条件缺少阈值，请填写过滤比较值');
        }
        if (payload.sourceMode === 'public-source' || payload.sourceMode === 'data-source') {
            payload.sourceComponentId = '';
        } else if (payload.sourceMode === 'websocket') {
            payload.sourceComponentId = componentStore.selectedComponentId || payload.sourceComponentId || '';
        }

        const savedRule = isEditing.value && editingRuleId.value
            ? alarmStore.updateRule(editingRuleId.value, payload)
            : alarmStore.addRule(payload);

        if (!isRuleVisibleUnderCurrentFilters(savedRule)) {
            filterForm.value = { keyword: '', severity: '', state: '' };
        }

        recentlySavedRuleId.value = savedRule.id;
        await nextTick();
        markProjectDirty();
        showEditModal.value = false;
        toast.success(isEditing.value ? '告警规则已更新' : '告警规则已创建');
        window.setTimeout(() => {
            if (recentlySavedRuleId.value === savedRule.id) {
                recentlySavedRuleId.value = '';
            }
        }, 2400);
    } catch (error) {
        formError.value = error.message;
    }
};
const handleEvaluateNow = () => {
    if (alarmStore.autoEvaluationEnabled === false) {
        toast.warning('编辑态不自动执行告警，请使用“测试”按钮');
        return;
    }
    alarmStore.evaluateAllRules({ forceRefreshRemote: true });
    toast.success('告警规则已重新评估');
};
const handleTestRule = async (ruleId) => {
    try {
        const record = await alarmStore.testRule(ruleId);
        toast.success(`已触发测试告警：${record?.ruleName || '当前规则'}`);
    } catch (error) {
        console.error('[AlarmCenter] test rule failed:', {
            ruleId,
            error
        });
        toast.error(error.message || '测试告警失败');
    }
};
const handleNotificationSettingsChange = () => { alarmStore.updateNotificationSettings({ browserEnabled: notificationForm.value.browserEnabled, soundEnabled: notificationForm.value.soundEnabled, soundFrequency: notificationForm.value.soundFrequency, soundDurationMs: notificationForm.value.soundDurationMs }); markProjectDirty(); };
const handleRequestNotificationPermission = async () => { if (typeof window === 'undefined' || !('Notification' in window)) return toast.warning('当前浏览器不支持通知能力'); const permission = await window.Notification.requestPermission(); toast[permission === 'granted' ? 'success' : 'warning'](permission === 'granted' ? '通知权限已授权' : '通知权限未授权'); };
const handleAcknowledge = (alarmId) => { alarmStore.acknowledgeAlarm(alarmId); toast.success('告警已确认'); };
const handleClearAlarm = (alarmId) => { alarmStore.clearAlarm(alarmId); toast.success('告警已清除'); };
const handleClearAllActive = async () => { if (!await showConfirm('确定要清空当前所有活跃告警吗？', { title: '清空活跃告警', confirmText: '清空', cancelText: '取消', variant: 'warning' })) return; alarmStore.clearAllActive(); toast.success('活跃告警已清空'); };
const handleClearHistory = async () => { if (!await showConfirm('确定要清空告警历史吗？此操作不可恢复。', { title: '清空告警历史', confirmText: '清空', cancelText: '取消', variant: 'warning' })) return; alarmStore.clearHistory(); toast.success('告警历史已清空'); };
const handleDeleteRule = async (ruleId) => { if (!await showConfirm('确定要删除这条告警规则吗？', { title: '删除告警规则', confirmText: '删除', cancelText: '取消', variant: 'warning' })) return; alarmStore.removeRule(ruleId); markProjectDirty(); toast.success('告警规则已删除'); };
const toggleRule = (ruleId) => { const rule = alarmStore.toggleRuleEnabled(ruleId); if (!rule) return; markProjectDirty(); toast.success(rule.enabled ? '告警规则已启用' : '告警规则已停用'); };
const toggleRuleMuted = (ruleId) => { const rule = alarmStore.toggleRuleMuted(ruleId); if (!rule) return; markProjectDirty(); toast.success(rule.muted ? '告警规则已静默' : '告警规则已取消静默'); };

watch(() => editForm.value.sourceMode, (mode) => {
    if (mode === 'public-source') {
        if (!Number(editForm.value.pollingIntervalMs)) {
            editForm.value.pollingIntervalMs = 30000;
        }
        const sourceOptions = publicSourceOptions.value;
        if (!sourceOptions.some((item) => item.value === editForm.value.sourceId)) {
            editForm.value.sourceId = sourceOptions[0]?.value || '';
        }
        editForm.value.sourceComponentId = '';
        return;
    }
    if (mode !== 'data-source' && mode !== 'websocket') return;
    if (mode === 'data-source') {
        if (!Number(editForm.value.pollingIntervalMs)) {
            editForm.value.pollingIntervalMs = 30000;
        }
        loadDataAccessCatalog();
        editForm.value.sourceComponentId = '';
    } else {
        editForm.value.pollingIntervalMs = 0;
        editForm.value.sourceComponentId = componentStore.selectedComponentId || editForm.value.sourceComponentId || '';
    }
    const sourceOptions = mode === 'data-source' ? dataAccessOptions.value : getDataSourceOptionsForComponent(editForm.value.sourceComponentId, mode);
    if (!sourceOptions.some((item) => item.value === editForm.value.sourceId)) {
        editForm.value.sourceId = sourceOptions[0]?.value || '';
    }
});

watch(() => componentStore.selectedComponentId, (componentId) => {
    if (editForm.value.sourceMode !== 'websocket') return;
    editForm.value.sourceComponentId = componentId || '';
    const sourceOptions = getDataSourceOptionsForComponent(componentId, editForm.value.sourceMode);
    if (!sourceOptions.some((item) => item.value === editForm.value.sourceId)) {
        editForm.value.sourceId = sourceOptions[0]?.value || '';
    }
});

onMounted(() => {
    loadDataAccessCatalog();
});
</script>

<style scoped>
.alarm-center { display:flex; flex-direction:column; gap:12px; height:100%; padding:12px; overflow-y:auto; }
.toolbar,.actions,.title-line,.row-end,.section-header { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.alarm-center > .toolbar { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
.row-end { justify-content:flex-end; }
.summary-grid,.form-grid { display:grid; gap:10px; grid-template-columns:repeat(2,minmax(0,1fr)); }
.form-grid.compact { grid-template-columns:repeat(4,minmax(0,1fr)); }
.panel-section .form-grid { grid-template-columns:1fr; }
.panel-section .notification-grid { grid-template-columns:repeat(2,minmax(0,1fr)); align-items:end; }
.summary-card,.panel-section,.card { background:rgba(18,23,33,.92); border:1px solid rgba(255,255,255,.08); border-radius:12px; }
.card--saved { border-color:rgba(96,165,250,.9); box-shadow:0 0 0 1px rgba(96,165,250,.45), 0 0 22px rgba(37,99,235,.16); }
.summary-card { padding:12px; display:flex; flex-direction:column; gap:6px; color:rgba(255,255,255,.7); }
.summary-card strong { color:#f4f7fb; font-size:22px; }
.panel-section,.card { padding:12px; }
.section-title { color:#f4f7fb; font-size:14px; font-weight:700; margin-bottom:10px; }
.form-group { display:flex; flex-direction:column; gap:6px; }
.toolbar > *,.actions > * { min-width:0; }
.form-group label,.muted,.empty-text { color:rgba(255,255,255,.62); font-size:12px; line-height:1.6; }
.textarea { width:100%; min-height:72px; resize:vertical; padding:10px 12px; border-radius:10px; background:rgba(10,14,22,.84); border:1px solid rgba(255,255,255,.1); color:#eef3f8; }
.list { display:flex; flex-direction:column; gap:10px; }
.card-header { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; margin-bottom:8px; }
.message { color:rgba(255,255,255,.88); font-size:13px; line-height:1.7; margin-bottom:8px; }
.severity-badge,.rule-status { display:inline-flex; align-items:center; justify-content:center; min-height:24px; padding:0 10px; border-radius:999px; font-size:12px; }
.severity-badge--critical { background:rgba(239,68,68,.16); color:#ff8e8e; }
.severity-badge--major { background:rgba(249,115,22,.16); color:#ffb07b; }
.severity-badge--warning { background:rgba(245,158,11,.16); color:#ffd38a; }
.severity-badge--info { background:rgba(59,130,246,.16); color:#98c1ff; }
.rule-status { background:rgba(255,255,255,.08); color:rgba(255,255,255,.78); }
.enabled { color:#86efac; background:rgba(34,197,94,.16); }
.disabled { color:#fca5a5; background:rgba(239,68,68,.16); }
.muted-status { color:#c4b5fd; background:rgba(139,92,246,.16); }
.pending-status { color:#ffd38a; background:rgba(245,158,11,.16); }
.source-mode-badge { margin-right:6px; }
.source-mode-badge--data-source { color:#93c5fd; background:rgba(59,130,246,.16); }
.source-mode-badge--public-source { color:#67e8f9; background:rgba(6,182,212,.16); }
.source-mode-badge--websocket { color:#86efac; background:rgba(34,197,94,.16); }
.source-mode-badge--mqtt { color:#f9a8d4; background:rgba(236,72,153,.16); }
.source-mode-badge--local { color:#c4b5fd; background:rgba(139,92,246,.16); }
.checkbox-line { display:inline-flex; align-items:center; gap:8px; min-width:0; color:rgba(255,255,255,.82); font-size:12px; }
.compact-toolbar { gap:6px; }
.edit-form { display:flex; flex-direction:column; gap:14px; }
.edit-form .form-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
.edit-form .form-grid.compact { grid-template-columns:repeat(3,minmax(0,1fr)); }
.path-input-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:end; }
.path-input-row__main { display:flex; flex-direction:column; gap:6px; min-width:0; }
.path-input-row__action { align-self:end; }
.path-picker { display:flex; flex-direction:column; gap:12px; }
.path-picker__toolbar { display:flex; justify-content:space-between; gap:8px; align-items:center; }
.path-picker__tree { max-height:360px; overflow:auto; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:rgba(10,14,22,.56); }
.path-picker__subtitle { margin-bottom:0; }
.path-picker__json { min-height:220px; font-family:var(--font-mono, monospace); font-size:12px; }
.error-text { color:#fca5a5; font-size:12px; }
@media (max-width:960px) {
    .alarm-center > .toolbar,
    .summary-grid,
    .panel-section .notification-grid,
    .edit-form .form-grid,
    .edit-form .form-grid.compact {
        grid-template-columns:1fr;
    }
    .path-input-row { grid-template-columns:1fr; }
    .path-input-row__action { width:100%; }
    .path-picker__toolbar { flex-direction:column; align-items:flex-start; }
}
</style>
