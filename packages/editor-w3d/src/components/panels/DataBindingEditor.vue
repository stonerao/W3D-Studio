<template>
    <div class="data-binding-editor">
        <!-- English comment. -->
        <div v-if="!selectedComponent" class="empty-state empty-state--panel">
            <div class="empty-state__mark">DATA</div>
            <div class="empty-state__title">未选择组件</div>
            <div class="empty-state__desc">选择画布中的组件后，可以在这里配置数据接入。</div>
        </div>

        <!-- English comment. -->
        <div v-else class="binding-content">
            <!-- English comment. -->
            <section class="component-summary" aria-label="当前组件">
                <div class="component-summary__main">
                    <div class="component-summary__eyebrow">当前组件</div>
                    <div class="component-summary__name" :title="selectedComponent?.name || '-'">
                        {{ selectedComponent?.name || '-' }}
                    </div>
                    <div class="component-summary__meta">
                        <span>{{ selectedComponent?.type || '-' }}</span>
                        <span>{{ dataSources.length }} 个数据源</span>
                    </div>
                </div>
                <span :class="['binding-status', bindingStatusClass]">{{ bindingStatusLabel }}</span>
            </section>

            <!-- English comment. -->
            <section class="data-access-panel">
                <label class="switch-row">
                    <input
                        type="checkbox"
                        v-model="bindingEnabled"
                        class="switch-input"
                    />
                    <span class="switch-track" aria-hidden="true">
                        <span class="switch-thumb"></span>
                    </span>
                    <span class="switch-copy">
                        <span class="switch-title">数据接入</span>
                        <span class="switch-desc">
                            {{ bindingEnabled ? '组件会接收外部数据更新' : '开启后可绑定接口或实时消息' }}
                        </span>
                    </span>
                </label>
                <Button class="structure-button" variant="outline" size="sm" @click="showDataStructureModal = true">
                    查看结构
                </Button>
            </section>

            <!-- English comment. -->
            <div v-if="bindingEnabled" class="data-sources-section">
                <div v-if="dataSources.length > 0" class="section-header">
                    <div class="section-heading">
                        <div class="section-title">数据源</div>
                        <div class="section-subtitle">{{ dataSourceSectionSubtitle }}</div>
                    </div>
                    <div class="section-actions">
                        <Button
                            variant="outline"
                            size="sm"
                            @click="executeAllDataSources"
                            :disabled="isExecuting"
                        >
                            {{ isExecuting ? '执行中...' : '执行全部' }}
                        </Button>
                        <Button variant="primary" size="sm" @click="openAddDataSourceModal">
                            添加数据源
                        </Button>
                    </div>
                </div>

                <div v-if="dataSources.length === 0" class="empty-sources">
                    <div class="empty-sources__icon">+</div>
                    <div class="empty-sources__title">还没有数据源</div>
                    <div class="empty-sources__desc">添加 HTTP、公共接口或实时消息源，并绑定到当前组件。</div>
                    <Button variant="primary" size="sm" block @click="openAddDataSourceModal">
                        添加数据源
                    </Button>
                </div>

                <div v-else class="sources-list">
                    <div
                        v-for="source in dataSources"
                        :key="source.id"
                        class="source-item"
                    >
                        <div class="source-header">
                            <div class="source-main">
                                <div class="source-title-line">
                                    <span class="source-name">{{ source.name || '未命名数据源' }}</span>
                                    <span :class="['source-mode-badge', getSourceModeBadgeClass(source.mode)]">{{ getSourceModeLabel(source.mode) }}</span>
                                </div>
                                <span class="source-property">绑定：{{ getSourceBindPropertyLabel(source) }}</span>
                            </div>
                        </div>
                        <div class="source-details">
                            <div class="source-detail-line">
                                <span class="detail-item detail-item--address">{{ getSourceSummary(source) }}</span>
                                <span
                                    v-if="source.mode === 'websocket' || source.mode === 'mqtt'"
                                    :class="['runtime-badge', getRuntimeStatusClass(getSourceRuntime(source).status)]"
                                >
                                    {{ getRuntimeStatusLabel(getSourceRuntime(source).status) }}
                                </span>
                            </div>
                            <div
                                v-if="(source.mode === 'websocket' || source.mode === 'mqtt') && getSourceRuntime(source).lastUpdatedAt"
                                class="source-detail-line source-detail-line--meta"
                            >
                                <span class="detail-item">最近更新：{{ formatRuntimeUpdatedAt(getSourceRuntime(source).lastUpdatedAt) }}</span>
                                <span class="detail-item">重连次数：{{ getSourceRuntime(source).reconnectCount || 0 }}</span>
                            </div>
                            <div
                                v-if="(source.mode === 'websocket' || source.mode === 'mqtt') && getSourceRuntime(source).lastMessage"
                                class="source-preview"
                            >
                                {{ getSourceRuntime(source).lastMessage }}
                            </div>
                            <div
                                v-if="(source.mode === 'websocket' || source.mode === 'mqtt') && getSourceRuntime(source).error"
                                class="source-error"
                            >
                                {{ getSourceRuntime(source).error }}
                            </div>
                            <div
                                v-if="source.visualTransformConfig?.enabled"
                                class="source-detail-line source-detail-line--meta"
                            >
                                <span class="visual-transform-badge">无代码整理</span>
                                <span class="detail-item">字段映射 {{ source.visualTransformConfig?.mappings?.length || 0 }} 项</span>
                            </div>
                        </div>
                        <div class="source-actions">
                            <button
                                :class="['btn-icon', 'btn-icon--execute', getActionButtonClass(source.mode, 'execute')]"
                                @click="executeSingleDataSource(source)"
                                :title="getExecuteActionTitle(source.mode)"
                            >
                                {{ getExecuteActionLabel(source.mode) }}
                            </button>
                            <button
                                v-if="source.mode === 'websocket' || source.mode === 'mqtt'"
                                :class="['btn-icon', getActionButtonClass(source.mode, 'disconnect')]"
                                @click="disconnectDataSourceConnection(source)"
                                :title="getDisconnectActionTitle(source.mode)"
                            >
                                {{ getDisconnectActionLabel(source.mode) }}
                            </button>
                            <button
                                :class="['btn-icon', getActionButtonClass(source.mode, 'edit')]"
                                @click="editDataSource(source)"
                                :title="getEditActionTitle(source.mode)"
                            >
                                {{ getEditActionLabel(source.mode) }}
                            </button>
                            <button
                                :class="['btn-icon', getActionButtonClass(source.mode, 'test')]"
                                @click="testDataSource(source)"
                                :title="getTestActionTitle(source.mode)"
                            >
                                {{ getTestActionLabel(source.mode) }}
                            </button>
                            <button
                                class="btn-icon btn-danger"
                                @click="removeDataSourceConfirm(source.id)"
                                title="删除"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>

            </div>
            <div v-else class="data-access-disabled">
                <div class="data-access-disabled__title">数据接入未启用</div>
                <div class="data-access-disabled__desc">开启后可以为当前组件添加接口、公共数据源或实时连接。</div>
            </div>
        </div>

        <!-- English comment. -->
        <Modal
            v-model="showDataSourceModal"
            title=""
            width="min(920px, calc(100vw - 48px))"
            @close="closeDataSourceModal"
        >
            <div class="data-source-config">
                <div v-if="isSelectingSourceType" class="source-type-selector">
                    <button
                        v-for="option in modeOptions"
                        :key="option.value"
                        type="button"
                        class="type-card"
                        @click="selectDataSourceMode(option.value)"
                    >
                        <div class="type-card__header">
                            <div class="type-card__title-wrap">
                                <span class="type-card__title">{{ option.label }}</span>
                                <span class="type-card__badge">{{ getModeBadge(option.value) }}</span>
                            </div>
                            <span class="type-card__action">编辑</span>
                        </div>
                        <div class="type-card__desc">{{ getModeDescription(option.value) }}</div>
                        <div class="type-card__tags">
                            <span
                                v-for="tag in getModeFeatureTags(option.value)"
                                :key="`${option.value}-${tag}`"
                                class="type-card__tag"
                            >
                                {{ tag }}
                            </span>
                        </div>
                        <div class="type-card__meta">{{ getModeTransformHint(option.value) }}</div>
                    </button>
                </div>

                <template v-else>
                <div class="data-flow-guide">
                    <span>1 选择来源</span>
                    <span>2 绑定目标</span>
                    <span>3 整理数据</span>
                    <span>4 预览保存</span>
                </div>

                <!-- English comment. -->
                <div v-if="!isDataAccessMode && !isPublicSourceMode" class="global-config-section">
                    <div
                        class="global-config-header"
                        @click="showGlobalConfig = !showGlobalConfig"
                    >
                        <div class="global-config-meta">
                            <span class="global-config-summary">{{ getGlobalServiceLabel(dataSourceForm.mode) }}</span>
                        </div>
                        <span class="global-config-toggle">{{ showGlobalConfig ? '▲' : '▼' }}</span>
                    </div>

                    <div v-show="showGlobalConfig" class="global-config-content">
                        <div class="config-row">
                            <div class="config-field flex-1">
                                <label class="config-label">服务</label>
                                <Input
                                    :model-value="getGlobalServiceUrl(dataSourceForm.mode)"
                                    @update:model-value="handleGlobalServiceUrlChange"
                                    :disabled="isDataAccessMode"
                                    placeholder="http://localhost:3000/"
                                />
                                <div class="config-hint">{{ getGlobalServiceLabel(dataSourceForm.mode) }}</div>
                            </div>
                            <div v-if="!isWebSocketMode" class="config-field timeout-field">
                                <label class="config-label">&nbsp;</label>
                                <div class="timeout-input">
                                    <Input
                                        v-model.number="dataSourceStore.globalConfig.timeout"
                                        type="number"
                                        min="0"
                                        style="width: 80px;"
                                    />
                                    <Select
                                        v-model="timeoutUnit"
                                        :options="timeoutUnitOptions"
                                        style="width: 60px;"
                                    />
                                </div>
                                <div class="config-hint">连接超时，单位为秒</div>
                            </div>
                            <div class="config-field">
                                <label class="config-label">&nbsp;</label>
                                <Button variant="outline" size="sm" @click="showGlobalConfigModal = true">
                                    编辑
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div class="divider-arrow" @click="showGlobalConfig = !showGlobalConfig">
                        <span>{{ showGlobalConfig ? '▲' : '▼' }}</span>
                    </div>
                </div>

                <!-- English comment. -->
                <div class="form-field">
                    <label class="form-label">数据源名称</label>
                    <Input
                        v-model="dataSourceForm.name"
                        placeholder="例如：获取区域数据"
                    />
                </div>

                <div v-if="!isDataAccessMode" class="form-field">
                    <div class="mode-summary-card">
                        <div>
                            <div class="mode-summary-card__desc">{{ getModeDescription(dataSourceForm.mode) }}</div>
                        </div>
                    </div>
                </div>

                <div class="form-field">
                    <div class="form-label-row">
                        <label class="form-label">绑定目标</label>
                        <Button variant="outline" size="sm" @click="addBindingRow">新增</Button>
                    </div>
                    <div
                        v-for="(binding, index) in dataSourceForm.bindings"
                        :key="`binding-${index}`"
                        class="binding-row binding-row--unified"
                    >
                        <Select
                            :model-value="binding.type"
                            @update:model-value="updateBindingType(index, $event)"
                            :options="bindingTypeOptions"
                            class="binding-type-select"
                        />
                        <Select
                            :model-value="binding.value"
                            @update:model-value="updateBindingValue(index, $event)"
                            :options="getAvailableBindingOptions(index)"
                            :placeholder="binding.type === 'property' ? '选择属性' : '选择方法'"
                            class="binding-value-select"
                        />
                        <button
                            type="button"
                            class="btn-inline-remove"
                            :disabled="dataSourceForm.bindings.length <= 1"
                            @click="removeBindingRow(index)"
                        >
                            ×
                        </button>
                    </div>
                    <div class="form-hint">属性：数据赋值给组件属性 | 方法：数据作为参数调用组件方法</div>
                </div>

                <div v-if="!isDataAccessMode && !isPublicSourceMode && !isWebSocketMode && !visualTransformEnabled" class="form-field">
                    <label class="form-label">数据路径</label>
                    <Input
                        v-model="dataSourceForm.dataPath"
                        placeholder="如 data.list，留空表示使用完整数据"
                    />
                </div>

                <!-- English comment. -->
                <div class="address-section">
                    <div v-if="isHttpMode" class="address-row">
                        <div class="address-field method-field">
                            <label class="config-label">请求方式</label>
                            <Select
                                v-model="dataSourceForm.method"
                                :options="requestMethodOptions"
                            />
                        </div>
                        <div class="address-field url-field">
                            <label class="config-label">HTTP 地址</label>
                            <div class="url-input-wrapper">
                                <span class="url-prefix">{{ dataSourceForm.useGlobalUrl ? getGlobalServiceUrl('http') : '' }}</span>
                                <Input
                                    v-model="dataSourceForm.url"
                                    :placeholder="dataSourceForm.useGlobalUrl ? '请输入接口路径或补充路径' : '请输入完整 HTTP URL'"
                                    class="url-input"
                                />
                            </div>
                            <div class="config-hint">适合一次性请求或轮询接口</div>
                        </div>
                        <div class="address-field timeout-field">
                            <label class="config-label">地址来源</label>
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="dataSourceForm.useGlobalUrl" />
                                使用全局 HTTP 服务
                            </label>
                            <div class="config-hint">全局地址可在上方统一维护</div>
                        </div>
                    </div>

                    <div v-else-if="isPublicSourceMode" class="mode-grid">
                        <div class="form-field form-field--full">
                            <label class="form-label">公共接口</label>
                            <Select
                                v-model="dataSourceForm.publicSourceId"
                                :options="publicSourceOptions"
                                placeholder="选择一个公共接口"
                            />
                            <div class="form-hint">复用项目级公共接口定义，组件仅配置绑定属性、数据路径和转换逻辑</div>
                            <div v-if="selectedPublicSource" class="form-hint form-hint--compact">
                                当前接口：{{ selectedPublicSource.name || selectedPublicSource.id }} · {{ getSourceModeLabel(selectedPublicSource.mode) }}
                            </div>
                            <div v-if="selectedPublicSource?.description" class="form-hint form-hint--compact">
                                {{ selectedPublicSource.description }}
                            </div>
                        </div>
                        <div v-if="!visualTransformEnabled" class="form-field">
                            <label class="form-label">数据路径</label>
                            <Input
                                v-model="dataSourceForm.dataPath"
                                placeholder="如 data.list，留空表示使用完整数据"
                            />
                            <div class="form-hint">公共接口返回后，再从结果中提取当前组件需要的数据路径</div>
                        </div>
                    </div>

                    <div v-else-if="isDataAccessMode" class="mode-grid">
                        <div class="form-field form-field--full">
                            <div class="form-label-row">
                                <label class="form-label">数据接入</label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    @click="syncDataAccessSelection(dataSourceForm.accessCode, { forceParams: true })"
                                >
                                    同步参数模板
                                </Button>
                            </div>
                            <Select
                                :model-value="dataSourceForm.accessCode"
                                :options="dataAccessOptions"
                                :placeholder="dataAccessLoading ? '加载中...' : '选择一个数据接入'"
                                @update:model-value="syncDataAccessSelection($event)"
                            />
                            <div class="form-hint">复用数据接入蓝图的执行结果，不再单独配置 URL / Header / Body</div>
                            <div v-if="currentComponentDataAccessGuide" class="form-hint form-hint--compact">
                                当前组件推荐绑定到 {{ currentComponentDataAccessGuide.propertyLabel }}，
                                期望结构：{{ currentComponentDataAccessGuide.formatHint }}
                            </div>
                            <div v-if="recommendedDataAccessNames.length" class="form-hint form-hint--compact">
                                推荐接入：{{ recommendedDataAccessNames.join('，') }}
                            </div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">间隔时间</label>
                            <div class="timeout-input">
                                <Input
                                    v-model.number="dataSourceForm.timeout"
                                    type="number"
                                    min="0"
                                    style="width: 100px;"
                                />
                                <span class="timeout-unit">秒</span>
                            </div>
                            <div class="form-hint">0 表示仅首次执行，非 0 表示按固定间隔刷新</div>
                        </div>
                    </div>

                    <div v-else-if="isWebSocketMode" class="mode-grid mode-grid--two">
                        <div class="form-field form-field--full">
                            <div class="form-label-row">
                                <label class="form-label">WebSocket 地址</label>
                                <Button variant="outline" size="sm" @click="applyLocationSimulatorTestData">
                                    添加测试数据
                                </Button>
                            </div>
                            <div class="url-input-wrapper">
                                <span class="url-prefix">{{ dataSourceForm.useGlobalUrl ? getGlobalServiceUrl('websocket') : '' }}</span>
                                <Input
                                    v-model="dataSourceForm.url"
                                    :placeholder="dataSourceForm.useGlobalUrl ? '请输入路径或补充路径' : '请输入完整 ws/wss 地址'"
                                />
                            </div>
                            <div class="form-hint">连接建立后会持续监听服务端推送</div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">地址来源</label>
                            <label class="checkbox-label checkbox-label--block">
                                <input type="checkbox" v-model="dataSourceForm.useGlobalUrl" />
                                使用全局 WebSocket 服务
                            </label>
                            <div class="form-hint">适合将统一网关地址抽到全局配置</div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">连接后发送</label>
                            <Input
                                v-model="dataSourceForm.socketMessage"
                                placeholder="可选，建立连接后立即发送的内容"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">自动重连</label>
                            <label class="checkbox-label checkbox-label--block">
                                <input type="checkbox" v-model="dataSourceForm.autoReconnect" />
                                连接关闭后自动重连
                            </label>
                            <div class="form-hint">默认 3 秒后重连，数据提取请在转换函数中处理</div>
                        </div>
                    </div>

                    <div v-else-if="isMqttMode" class="mode-grid">
                        <div class="form-field">
                            <label class="form-label">MQTT Broker 地址</label>
                            <div class="url-input-wrapper">
                                <span class="url-prefix">{{ dataSourceForm.useGlobalUrl ? getGlobalServiceUrl('mqtt') : '' }}</span>
                                <Input
                                    v-model="dataSourceForm.url"
                                    :placeholder="dataSourceForm.useGlobalUrl ? '请输入路径或补充路径' : '请输入完整 broker 地址（通常为 ws/wss）'"
                                />
                            </div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">Topic</label>
                            <Input
                                v-model="dataSourceForm.mqttTopic"
                                placeholder="例如 factory/device/status"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">QoS</label>
                            <Select
                                v-model="dataSourceForm.mqttQos"
                                :options="mqttQosOptions"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">Client ID</label>
                            <Input
                                v-model="dataSourceForm.mqttClientId"
                                placeholder="可选，留空自动生成"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">用户名</label>
                            <Input
                                v-model="dataSourceForm.mqttUsername"
                                placeholder="可选"
                            />
                        </div>
                        <div class="form-field">
                            <label class="form-label">密码</label>
                            <Input
                                v-model="dataSourceForm.mqttPassword"
                                type="password"
                                placeholder="可选"
                            />
                        </div>
                        <div class="form-field form-field--full">
                            <label class="form-label">地址来源</label>
                            <label class="checkbox-label checkbox-label--block">
                                <input type="checkbox" v-model="dataSourceForm.useGlobalUrl" />
                                使用全局 MQTT Broker 地址
                            </label>
                            <div class="form-hint">浏览器端 MQTT 一般通过 ws/wss 接入 Broker</div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">自动重连</label>
                            <label class="checkbox-label checkbox-label--block">
                                <input type="checkbox" v-model="dataSourceForm.autoReconnect" />
                                Broker 断开后自动重连
                            </label>
                        </div>
                        <div class="form-field">
                            <label class="form-label">重连间隔</label>
                            <Input
                                v-model.number="dataSourceForm.reconnectPeriod"
                                type="number"
                                min="1000"
                                placeholder="毫秒，默认 3000"
                            />
                        </div>
                    </div>

                    <div v-else class="mode-grid">
                        <div class="form-field">
                            <label class="form-label">本地数据格式</label>
                            <Select
                                v-model="dataSourceForm.localDataFormat"
                                :options="localFormatOptions"
                            />
                        </div>
                        <div class="form-field form-field--full">
                            <label class="form-label">选择本地文件</label>
                            <input
                                type="file"
                                class="native-file-input"
                                accept=".json,.txt,.csv,.js,.ts"
                                @change="handleLocalFileChange"
                            />
                            <div class="form-hint">当前文件：{{ dataSourceForm.localFileName || '未选择文件' }}</div>
                        </div>
                        <div class="form-field form-field--full">
                            <label class="form-label">本地数据内容</label>
                            <textarea
                                v-model="dataSourceForm.localDataContent"
                                class="code-textarea"
                                :placeholder="dataSourceForm.localDataFormat === 'json' ? '{ value: 1 }' : '请输入文本内容'"
                                spellcheck="false"
                                rows="8"
                            />
                        </div>
                    </div>

                    <div v-if="dataSourceForm.mode !== 'local' && !isDataAccessMode && !isPublicSourceMode" class="timeout-row">
                        <div class="config-field">
                            <label class="config-label">超时时间</label>
                            <div class="timeout-input">
                                <Input
                                    v-model.number="dataSourceForm.timeout"
                                    type="number"
                                    min="0"
                                    style="width: 80px;"
                                />
                                <span class="timeout-unit">秒</span>
                            </div>
                        </div>
                    </div>

                    <div class="form-field form-field--full">
                        <label class="form-label">加载策略</label>
                        <label class="checkbox-label checkbox-label--block">
                            <input
                                type="checkbox"
                                v-model="dataSourceForm.runOnLoad"
                                :disabled="isWebSocketMode || isMqttMode"
                            />
                            预览加载后自动请求
                        </label>
                        <div class="startup-delay-row">
                            <label class="config-label">加载后多少秒启动</label>
                            <div class="timeout-input">
                                <Input
                                    v-model.number="dataSourceForm.startupDelaySeconds"
                                    type="number"
                                    min="0"
                                    step="1"
                                    style="width: 100px;"
                                />
                                <span class="timeout-unit">秒</span>
                            </div>
                        </div>
                        <div class="form-hint">
                            {{ (isWebSocketMode || isMqttMode) ? '实时数据源在预览加载后会自动建立连接' : '默认 0 秒，所有请求方式统一生效' }}
                        </div>
                    </div>
                </div>

                <!-- English comment. -->
                <div v-if="isHttpMode || isDataAccessMode" class="params-section">
                    <div v-if="isHttpMode" class="params-tabs">
                        <button
                            v-for="tab in paramsTabs"
                            :key="tab.key"
                            :class="['params-tab', { active: activeParamsTab === tab.key }]"
                            @click="activeParamsTab = tab.key"
                        >
                            {{ tab.label }}
                        </button>
                    </div>

                    <div class="params-content">
                        <div v-if="isDataAccessMode" class="params-table-wrapper">
                            <div class="form-hint form-hint--compact">
                                {{ selectedDataAccess?.inputParams?.length
                                    ? '参数已按所选数据接入自动带出，可继续调整默认值或补充变量绑定'
                                    : '当前数据接入未声明参数，可按需补充执行参数' }}
                            </div>
                            <div v-if="!hasLocalVariables" class="form-hint form-hint--compact">
                                当前项目还没有本地变量。选择“本地变量”时可先手动输入变量名，或先到变量面板创建变量。
                                <button type="button" class="link-button" @click="openVariablesPanel">前往变量面板</button>
                            </div>
                            <div v-if="!hasLocalStorageOptions" class="form-hint form-hint--compact">
                                当前 localStorage 没有可选项。
                            </div>
                            <div v-if="!hasCookieOptions" class="form-hint form-hint--compact">
                                当前 Cookie 没有可选项。
                            </div>
                            <div v-if="!hasLocalStorageOptions" class="form-hint form-hint--compact">
                                当前 localStorage 没有可选项。
                            </div>
                            <div v-if="!hasCookieOptions" class="form-hint form-hint--compact">
                                当前 Cookie 没有可选项。
                            </div>
                            <table class="params-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;"></th>
                                        <th>Key</th>
                                        <th>Value</th>
                                        <th style="width: 80px;">操作</th>
                                        <th style="width: 80px;">结果</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(param, index) in dataSourceForm.params" :key="index">
                                        <td class="row-number">{{ index + 1 }}</td>
                                        <td>
                                            <Input v-model="param.key" placeholder="请输入" size="sm" />
                                        </td>
                                        <td>
                                            <div class="param-value-cell">
                                                <Select
                                                    :model-value="param.valueSource || 'input'"
                                                    :options="paramValueSourceOptions"
                                                    @update:model-value="updateParamValueSource(index, $event)"
                                                    style="width: 90px;"
                                                />
                                                <Input
                                                    v-if="(param.valueSource || 'input') === 'input'"
                                                    v-model="param.value"
                                                    placeholder="请输入"
                                                    size="sm"
                                                />
                                                <template v-else-if="(param.valueSource || 'input') === 'local'">
                                                    <Select
                                                        v-if="hasLocalVariables"
                                                        :model-value="param.variableName || ''"
                                                        :options="getLocalVariableOptions(param.variableName)"
                                                        placeholder="选择本地变量"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                    <Input
                                                        v-else
                                                        :model-value="param.variableName || ''"
                                                        placeholder="当前无变量，请输入变量名"
                                                        size="sm"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                </template>
                                                <template v-else-if="(param.valueSource || 'input') === 'localStorage'">
                                                    <Select
                                                        v-if="hasLocalStorageOptions"
                                                        :model-value="param.variableName || ''"
                                                        :options="getLocalStorageOptions(param.variableName)"
                                                        placeholder="选择 localStorage Key"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                    <Input
                                                        v-else
                                                        :model-value="param.variableName || ''"
                                                        placeholder="当前没有 localStorage Key"
                                                        size="sm"
                                                        disabled
                                                    />
                                                </template>
                                                <template v-else>
                                                    <Select
                                                        v-if="hasCookieOptions"
                                                        :model-value="param.variableName || ''"
                                                        :options="getCookieOptions(param.variableName)"
                                                        placeholder="选择 Cookie 名称"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                    <Input
                                                        v-else
                                                        :model-value="param.variableName || ''"
                                                        placeholder="当前没有 Cookie"
                                                        size="sm"
                                                        disabled
                                                    />
                                                </template>
                                            </div>
                                        </td>
                                        <td class="actions-cell">
                                            <button class="btn-table-action" @click="addParam(index)">+</button>
                                            <button class="btn-table-action btn-remove" @click="removeParam(index)">-</button>
                                        </td>
                                        <td class="result-cell">
                                            <span :class="['result-badge', getParamValidation(param)]">
                                                {{ getParamValidationText(param) }}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr v-if="dataSourceForm.params.length === 0">
                                        <td class="row-number">1</td>
                                        <td><Input placeholder="请输入" size="sm" @focus="ensureParamRow" /></td>
                                        <td><Input placeholder="请输入" size="sm" @focus="ensureParamRow" /></td>
                                        <td class="actions-cell">
                                            <button class="btn-table-action" @click="addParam(-1)">+</button>
                                            <button class="btn-table-action btn-remove" disabled>-</button>
                                        </td>
                                        <td class="result-cell"><span class="result-badge empty">-</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <template v-else>
                        <!-- English comment. -->
                        <div v-show="activeParamsTab === 'params'" class="params-table-wrapper">
                            <div v-if="!hasLocalVariables" class="form-hint form-hint--compact">
                                当前项目还没有本地变量。选择“本地变量”时可先手动输入变量名，或先到变量面板创建变量。
                                <button type="button" class="link-button" @click="openVariablesPanel">前往变量面板</button>
                            </div>
                            <table class="params-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;"></th>
                                        <th>Key</th>
                                        <th>Value</th>
                                        <th style="width: 80px;">操作</th>
                                        <th style="width: 80px;">结果</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(param, index) in dataSourceForm.params" :key="index">
                                        <td class="row-number">{{ index + 1 }}</td>
                                        <td>
                                            <Input
                                                v-model="param.key"
                                                placeholder="请输入"
                                                size="sm"
                                            />
                                        </td>
                                        <td>
                                            <div class="param-value-cell">
                                                <Select
                                                    :model-value="param.valueSource || 'input'"
                                                    :options="paramValueSourceOptions"
                                                    @update:model-value="updateParamValueSource(index, $event)"
                                                    style="width: 90px;"
                                                />
                                                <Input
                                                    v-if="(param.valueSource || 'input') === 'input'"
                                                    v-model="param.value"
                                                    placeholder="请输入"
                                                    size="sm"
                                                />
                                                <template v-else-if="(param.valueSource || 'input') === 'local'">
                                                    <Select
                                                        v-if="hasLocalVariables"
                                                        :model-value="param.variableName || ''"
                                                        :options="getLocalVariableOptions(param.variableName)"
                                                        placeholder="选择本地变量"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                    <Input
                                                        v-else
                                                        :model-value="param.variableName || ''"
                                                        placeholder="当前无变量，请输入变量名"
                                                        size="sm"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                </template>
                                                <template v-else-if="(param.valueSource || 'input') === 'localStorage'">
                                                    <Select
                                                        v-if="hasLocalStorageOptions"
                                                        :model-value="param.variableName || ''"
                                                        :options="getLocalStorageOptions(param.variableName)"
                                                        placeholder="选择 localStorage Key"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                    <Input
                                                        v-else
                                                        :model-value="param.variableName || ''"
                                                        placeholder="当前没有 localStorage Key"
                                                        size="sm"
                                                        disabled
                                                    />
                                                </template>
                                                <template v-else>
                                                    <Select
                                                        v-if="hasCookieOptions"
                                                        :model-value="param.variableName || ''"
                                                        :options="getCookieOptions(param.variableName)"
                                                        placeholder="选择 Cookie 名称"
                                                        @update:model-value="updateParamVariableName(index, $event)"
                                                    />
                                                    <Input
                                                        v-else
                                                        :model-value="param.variableName || ''"
                                                        placeholder="当前没有 Cookie"
                                                        size="sm"
                                                        disabled
                                                    />
                                                </template>
                                            </div>
                                        </td>
                                        <td class="actions-cell">
                                            <button class="btn-table-action" @click="addParam(index)">+</button>
                                            <button class="btn-table-action btn-remove" @click="removeParam(index)">-</button>
                                        </td>
                                        <td class="result-cell">
                                            <span :class="['result-badge', getParamValidation(param)]">
                                                {{ getParamValidationText(param) }}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr v-if="dataSourceForm.params.length === 0">
                                        <td class="row-number">1</td>
                                        <td>
                                            <Input placeholder="请输入" size="sm" @focus="ensureParamRow" />
                                        </td>
                                        <td>
                                            <Input placeholder="请输入" size="sm" @focus="ensureParamRow" />
                                        </td>
                                        <td class="actions-cell">
                                            <button class="btn-table-action" @click="addParam(-1)">+</button>
                                            <button class="btn-table-action btn-remove" disabled>-</button>
                                        </td>
                                        <td class="result-cell">
                                            <span class="result-badge empty">-</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- English comment. -->
                        <div v-show="activeParamsTab === 'body'" class="body-section">
                            <div class="body-editor">
                                <div class="body-type-group">
                                    <label v-for="option in requestBodyTypeOptions" :key="option.value" class="body-type-option">
                                        <input v-model="dataSourceForm.bodyType" type="radio" name="request-body-type" :value="option.value" />
                                        <span>{{ option.label }}</span>
                                    </label>
                                </div>
                                <template v-if="dataSourceForm.method === 'POST'">
                                    <template v-if="dataSourceForm.bodyType === 'json' || dataSourceForm.bodyType === 'xml'">
                                        <div class="lowcode-advanced-box">
                                            <div class="lowcode-advanced-box__hint">
                                                默认建议使用参数表或变量模板构建请求体；原始 {{ dataSourceForm.bodyType.toUpperCase() }} 仅作为高级配置。
                                            </div>
                                            <details>
                                                <summary>高级配置：原始 {{ dataSourceForm.bodyType.toUpperCase() }} 请求体</summary>
                                                <textarea
                                                    v-model="dataSourceForm.body"
                                                    class="code-textarea"
                                                    :placeholder="dataSourceForm.bodyType === 'xml' ? '<root></root>' : '请输入 JSON 请求体'"
                                                    spellcheck="false"
                                                    rows="6"
                                                />
                                            </details>
                                        </div>
                                    </template>
                                    <template v-else-if="dataSourceForm.bodyType === 'form-data' || dataSourceForm.bodyType === 'x-www-form-urlencoded'">
                                        <div class="params-table-wrapper">
                                            <table class="params-table">
                                                <thead>
                                                    <tr>
                                                        <th style="width: 40px;"></th>
                                                        <th>Key</th>
                                                        <th>Value</th>
                                                        <th style="width: 80px;">操作</th>
                                                        <th style="width: 80px;">结果</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="(param, index) in dataSourceForm.bodyParams" :key="`body-param-${index}`">
                                                        <td class="row-number">{{ index + 1 }}</td>
                                                        <td>
                                                            <Input v-model="param.key" placeholder="请输入" size="sm" />
                                                        </td>
                                                        <td>
                                                            <div class="param-input-group">
                                                                <Select
                                                                    :model-value="param.valueSource || 'input'"
                                                                    :options="paramValueSourceOptions"
                                                                    class="param-source-select"
                                                                    @update:model-value="updateBodyParamValueSource(index, $event)"
                                                                />
                                                                <template v-if="(param.valueSource || 'input') === 'local'">
                                                                    <Select
                                                                        :model-value="param.variableName || ''"
                                                                        :options="variableNameOptions"
                                                                        placeholder="选择变量"
                                                                        class="param-value-input"
                                                                        @update:model-value="updateBodyParamVariableName(index, $event)"
                                                                    />
                                                                </template>
                                                                <template v-else-if="(param.valueSource || 'input') === 'localStorage'">
                                                                    <Input
                                                                        :model-value="param.variableName || ''"
                                                                        placeholder="localStorage Key"
                                                                        size="sm"
                                                                        class="param-value-input"
                                                                        @update:model-value="updateBodyParamVariableName(index, $event)"
                                                                    />
                                                                </template>
                                                                <template v-else-if="(param.valueSource || 'input') === 'cookie'">
                                                                    <Input
                                                                        :model-value="param.variableName || ''"
                                                                        placeholder="Cookie 名称"
                                                                        size="sm"
                                                                        class="param-value-input"
                                                                        @update:model-value="updateBodyParamVariableName(index, $event)"
                                                                    />
                                                                </template>
                                                                <template v-else>
                                                                    <Input
                                                                        v-model="param.value"
                                                                        placeholder="请输入"
                                                                        size="sm"
                                                                        class="param-value-input"
                                                                    />
                                                                </template>
                                                            </div>
                                                        </td>
                                                        <td class="actions-cell">
                                                            <button class="btn-table-action" @click="addBodyParam(index)">+</button>
                                                            <button class="btn-table-action btn-remove" @click="removeBodyParam(index)">-</button>
                                                        </td>
                                                        <td class="result-cell">
                                                            <span :class="['result-badge', getParamValidation(dataSourceForm.bodyParams[index]) === 'valid' ? 'success' : getParamValidation(dataSourceForm.bodyParams[index]) === 'incomplete' ? 'warning' : 'empty']">
                                                                {{ getParamValidationText(dataSourceForm.bodyParams[index]) }}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    <tr v-if="dataSourceForm.bodyParams.length === 0">
                                                        <td class="row-number">1</td>
                                                        <td><Input placeholder="请输入" size="sm" @focus="ensureBodyParamRow" /></td>
                                                        <td><Input placeholder="请输入" size="sm" @focus="ensureBodyParamRow" /></td>
                                                        <td class="actions-cell">
                                                            <button class="btn-table-action" @click="addBodyParam(-1)">+</button>
                                                            <button class="btn-table-action btn-remove" disabled>-</button>
                                                        </td>
                                                        <td class="result-cell">
                                                            <span class="result-badge empty">-</span>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </template>
                                    <div v-else class="body-disabled">当前请求体类型不发送 Body</div>
                                </template>
                                <div v-else class="body-disabled">
                                    当前已显示请求体类型，切换为 POST 后可编辑请求体内容
                                </div>
                                <div class="form-hint">支持变量模板：<code v-pre>{{变量名}}</code>，发送时会替换为变量当前值</div>
                            </div>
                        </div>

                        <!-- English comment. -->
                        <div v-show="activeParamsTab === 'header'" class="params-table-wrapper">
                            <table class="params-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;"></th>
                                        <th>Key</th>
                                        <th>Value</th>
                                        <th style="width: 80px;">操作</th>
                                        <th style="width: 80px;">结果</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(header, index) in dataSourceForm.headers" :key="index">
                                        <td class="row-number">{{ index + 1 }}</td>
                                        <td>
                                            <Input
                                                v-model="header.key"
                                                placeholder="请输入"
                                                size="sm"
                                            />
                                        </td>
                                        <td>
                                            <Input
                                                v-model="header.value"
                                                placeholder="请输入"
                                                size="sm"
                                            />
                                        </td>
                                        <td class="actions-cell">
                                            <button class="btn-table-action" @click="addHeader(index)">+</button>
                                            <button class="btn-table-action btn-remove" @click="removeHeader(index)">-</button>
                                        </td>
                                        <td class="result-cell">
                                            <span :class="['result-badge', getParamValidation(header)]">
                                                {{ getParamValidationText(header) }}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr v-if="dataSourceForm.headers.length === 0">
                                        <td class="row-number">1</td>
                                        <td>
                                            <Input placeholder="请输入" size="sm" @focus="ensureHeaderRow" />
                                        </td>
                                        <td>
                                            <Input placeholder="请输入" size="sm" @focus="ensureHeaderRow" />
                                        </td>
                                        <td class="actions-cell">
                                            <button class="btn-table-action" @click="addHeader(-1)">+</button>
                                            <button class="btn-table-action btn-remove" disabled>-</button>
                                        </td>
                                        <td class="result-cell">
                                            <span class="result-badge empty">-</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        </template>
                    </div>
                </div>

                <!-- English comment. -->
                <section class="data-flow-section data-flow-section--transform">
                    <div class="data-flow-section__header">
                        <div class="data-flow-section__title-wrap">
                            <span class="data-flow-section__step">03</span>
                            <div>
                                <div class="data-flow-section__title">整理返回数据</div>
                                <div class="data-flow-section__desc">把接口、文件或消息返回值转换成组件可识别的数据结构</div>
                            </div>
                        </div>
                        <span class="data-flow-section__badge">
                            {{ visualTransformEnabled ? '无代码模式' : '兼容模式' }}
                        </span>
                    </div>
                    <div class="transform-summary-panel">
                        <div class="transform-summary-main">
                            <div class="transform-summary-title">{{ transformSummaryTitle }}</div>
                            <div class="transform-summary-desc">{{ transformSummaryText }}</div>
                            <div class="transform-summary-tags">
                                <span>{{ transformRangeLabel }}</span>
                                <span>字段匹配 {{ visualTransformConfig.mappings.length }} 项</span>
                                <span>过滤 {{ visualTransformConfig.filters.length }} 条</span>
                            </div>
                        </div>
                        <div class="transform-summary-actions">
                            <Button variant="outline" @click="openDataTransformModal">
                                配置数据整理
                            </Button>
                            <Button
                                v-if="canPreviewCurrentDataSource"
                                variant="outline"
                                :disabled="resultPreviewLoading"
                                @click="previewCurrentDataSource"
                            >
                                {{ resultPreviewLoading ? '预览中...' : '执行预览' }}
                            </Button>
                        </div>
                    </div>
                </section>
                </template>
            </div>

            <!-- English comment. -->
            <template #footer>
                <div v-if="isSelectingSourceType" class="modal-footer-content modal-footer-content--selector">
                    <div class="footer-actions">
                        <Button variant="outline" @click="openRequestPreview">
                            请求预览
                        </Button>
                        <Button variant="outline" @click="closeDataSourceModal">
                            取消
                        </Button>
                    </div>
                </div>
                <div v-else class="modal-footer-content">
                    <div class="footer-info">
                        <span class="footer-tag">{{ getSourceModeLabel(dataSourceForm.mode) }}</span>
                        <span class="footer-tag footer-tag--muted">{{ visualTransformEnabled ? '无代码整理' : '兼容转换' }}</span>
                    </div>
                    <div class="footer-actions">
                        <Button v-if="canPreviewCurrentDataSource" variant="outline" @click="previewCurrentDataSource" :disabled="resultPreviewLoading">
                            {{ resultPreviewLoading ? '预览中...' : '执行预览' }}
                        </Button>
                        <Button variant="outline" @click="closeDataSourceModal">
                            取消
                        </Button>
                        <Button variant="primary" @click="saveDataSource">
                            保存
                        </Button>
                    </div>
                </div>
            </template>
        </Modal>

        <DataTransformConfigModal
            v-model="showDataTransformModal"
            :source="dataTransformModalSource"
            :config="dataSourceForm.visualTransformConfig"
            :transform-fn="dataSourceForm.transformFn"
            :component-type="selectedComponent?.type || ''"
            :runtime-payload="currentRuntimePayload"
            :preview-sample-data="dataSourceForm.previewSampleData"
            :preview-loader="loadDataTransformPreview"
            @save="handleDataTransformSave"
        />

        <!-- English comment. -->
        <Modal
            v-model="showGlobalConfigModal"
            title=""
            width="500px"
        >
            <div class="global-config-form">
                <div class="form-field">
                    <label class="form-label">HTTP 服务地址</label>
                    <Input
                        v-model="dataSourceStore.globalConfig.baseUrl"
                        placeholder="http://localhost:3000/"
                    />
                </div>
                <div class="form-field">
                    <label class="form-label">WebSocket 服务地址</label>
                    <Input
                        v-model="dataSourceStore.globalConfig.websocketUrl"
                        placeholder="ws://localhost:3000/"
                    />
                </div>
                <div class="form-field">
                    <label class="form-label">MQTT Broker 地址</label>
                    <Input
                        v-model="dataSourceStore.globalConfig.mqttUrl"
                        placeholder="ws://localhost:8083/mqtt"
                    />
                </div>
                <div class="form-field">
                    <label class="form-label">默认超时时间（秒）</label>
                    <Input
                        v-model.number="dataSourceStore.globalConfig.timeout"
                        type="number"
                        min="0"
                    />
                </div>
                <div class="form-field">
                    <label class="form-label">公共请求头</label>
                    <KeyValueEditor
                        v-model="dataSourceStore.globalConfig.headers"
                        key-placeholder="Header 名称"
                        value-placeholder="Header 值"
                        add-button-text="添加 Header"
                        empty-text="暂无公共 Header"
                    />
                </div>
            </div>
            <template #footer>
                <Button variant="outline" @click="showGlobalConfigModal = false">关闭</Button>
            </template>
        </Modal>

        <Modal
            v-model="showDataStructureModal"
            title="当前组件数据结构"
            width="760px"
        >
            <div class="data-structure-modal">
                <div class="data-structure-header">
                    <div>组件：{{ selectedComponent?.name || '-' }}</div>
                    <div>类型：{{ selectedComponent?.type || '-' }}</div>
                    <div v-if="shouldShowMockListStructure">
                        列表数据：{{ currentComponentListDataSourceLabel }}
                        <button type="button" class="link-button" @click="refreshCurrentListDataPreview" :disabled="listDataPreviewLoading">
                            {{ listDataPreviewLoading ? '刷新中...' : '刷新' }}
                        </button>
                    </div>
                </div>
                <div v-if="currentComponentStructureRows.length" class="data-structure-table">
                    <table class="params-table">
                        <thead>
                            <tr>
                                <th>字段</th>
                                <th>类型</th>
                                <th>格式示例</th>
                                <th>说明</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in currentComponentStructureRows" :key="item.key">
                                <td>{{ item.key }}</td>
                                <td>{{ item.type }}</td>
                                <td>{{ item.formatHint }}</td>
                                <td>{{ item.description || '-' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="structure-json-label">方法对应数据结构（{{ methodStructureScopeText }}）：</div>
                <div v-if="currentComponentMethodRowsForDisplay.length" class="data-structure-table">
                    <table class="params-table">
                        <thead>
                            <tr>
                                <th>方法</th>
                                <th>标题</th>
                                <th>参数定义</th>
                                <th>说明</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in currentComponentMethodRowsForDisplay" :key="item.name">
                                <td>{{ item.name }}</td>
                                <td>{{ item.title }}</td>
                                <td>{{ item.paramsText }}</td>
                                <td>{{ item.description || '-' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-hint">说明：数据接入触发方法时，会将“最终值”作为方法第一个参数传入。</div>
                <div class="structure-json-label">方法数据样例(JSON)：</div>
                <textarea class="code-textarea structure-json" :value="currentComponentMethodJson" readonly />
                <template v-if="shouldShowMockListStructure">
                    <div class="structure-json-label">列表数据：{{ currentComponentMockListLabel }}</div>
                    <textarea class="code-textarea structure-json" :value="currentComponentMockListJson" readonly />
                </template>
                <div class="structure-json-label">推荐数据结构(JSON)：</div>
                <textarea class="code-textarea structure-json" :value="currentComponentStructureJson" readonly />
            </div>
            <template #footer>
                <Button variant="outline" @click="showDataStructureModal = false">关闭</Button>
            </template>
        </Modal>

        <Modal
            v-model="showRequestPreviewModal"
            title="请求预览"
            width="760px"
        >
            <div class="request-preview">
                <div class="request-preview-row">
                    <span class="request-preview-key">模式</span>
                    <span class="request-preview-value">{{ requestPreview.mode }}</span>
                </div>
                <div class="request-preview-row">
                    <div class="request-preview-key-row">
                        <span class="request-preview-key">URL</span>
                        <Button variant="outline" size="sm" @click="copyPreviewField('url')">复制</Button>
                    </div>
                    <span class="request-preview-value request-preview-value--block">{{ requestPreview.url || '-' }}</span>
                </div>
                <div class="request-preview-row">
                    <div class="request-preview-key-row">
                        <span class="request-preview-key">Params</span>
                        <Button variant="outline" size="sm" @click="copyPreviewField('params')">复制</Button>
                    </div>
                    <textarea class="code-textarea request-preview-json" :value="requestPreview.paramsText" readonly />
                </div>
                <div class="request-preview-row">
                    <div class="request-preview-key-row">
                        <span class="request-preview-key">Headers</span>
                        <Button variant="outline" size="sm" @click="copyPreviewField('headers')">复制</Button>
                    </div>
                    <textarea class="code-textarea request-preview-json" :value="requestPreview.headersText" readonly />
                </div>
                <div class="request-preview-row">
                    <div class="request-preview-key-row">
                        <span class="request-preview-key">Body</span>
                        <Button variant="outline" size="sm" @click="copyPreviewField('body')">复制</Button>
                    </div>
                    <textarea class="code-textarea request-preview-json" :value="requestPreview.bodyText" readonly />
                </div>
            </div>
            <template #footer>
                <Button variant="outline" @click="copyPreviewField('all')">复制全部</Button>
                <Button variant="outline" @click="showRequestPreviewModal = false">关闭</Button>
            </template>
        </Modal>

        <Modal
            v-model="showResultPreviewModal"
            title="结果预览"
            width="860px"
        >
            <div class="request-preview">
                <div class="request-preview-row">
                    <span class="request-preview-key">模式</span>
                    <span class="request-preview-value">{{ resultPreview.mode }}</span>
                </div>
                <div class="request-preview-row">
                    <span class="request-preview-key">数据源</span>
                    <span class="request-preview-value">{{ resultPreview.sourceName }}</span>
                </div>
                <div class="request-preview-row">
                    <div class="request-preview-key-row">
                        <span class="request-preview-key">原始结果</span>
                    </div>
                    <textarea class="code-textarea request-preview-json request-preview-json--lg" :value="resultPreview.rawText" readonly />
                </div>
                <div class="request-preview-row">
                    <div class="request-preview-key-row">
                        <span class="request-preview-key">转换结果</span>
                    </div>
                    <textarea class="code-textarea request-preview-json request-preview-json--lg" :value="resultPreview.finalText" readonly />
                </div>
            </div>
            <template #footer>
                <Button variant="outline" @click="showResultPreviewModal = false">关闭</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useDataSourceStore } from '../../stores/useDataSourceStore';
import { useVariableStore } from '../../stores/useVariableStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Button from '../ui/Button.vue';
import Modal from '../ui/Modal.vue';
import KeyValueEditor from '../ui/KeyValueEditor.vue';
import DataTransformConfigModal from './DataTransformConfigModal.vue';
import { getBindablePropertyOptionsByType, getPropertyBindingReference } from '../../utils/bindableProperties';
import { getComponentMethodDefinitions } from '../../utils/componentRegistry';
import { disconnectDataSourceRuntime, getDataSourceDisplayAddress, getDataSourceRuntimeState } from '../../services/dataSourceRuntime';
import {
    DEFAULT_VISUAL_TRANSFORM_CONFIG,
    applyDataSourceTransform,
    inferFieldOptions,
    normalizeVisualTransformConfig
} from '../../services/visualDataTransform';
import {
    buildVisualTransformConfigFromTemplate,
    getVisualDataTemplateMapping,
    getVisualDataTemplateTargetOptions,
    getVisualDataTemplates
} from '../../services/visualDataTemplates';
import { fetchDataAccessList } from '../../api/dataAccess';

const componentStore = useComponentStore();
const projectStore = useProjectStore();
const dataSourceStore = useDataSourceStore();
const variableStore = useVariableStore();
const editorStore = useEditorStore();
const { executeDataBinding, fetchDataSource } = useComponent();
const toast = useToast();
const { confirm: showConfirm } = useConfirm();

// English comment.
const isExecuting = ref(false);

const selectedComponent = computed(() => componentStore.selectedComponent);

// English comment.
const bindingEnabled = ref(false);

// English comment.
const showGlobalConfig = ref(true);
const showGlobalConfigModal = ref(false);
const showDataStructureModal = ref(false);
const showRequestPreviewModal = ref(false);
const showResultPreviewModal = ref(false);
const showDataTransformModal = ref(false);
const listDataPreviewLoading = ref(false);
const listDataPreviewMode = ref('mock');
const listDataPreviewJson = ref('');
const dataAccessLoading = ref(false);
const dataAccessCatalog = ref([]);
const resultPreviewLoading = ref(false);
const resultPreview = ref({
    mode: '',
    sourceName: '',
    rawText: '',
    finalText: ''
});
const requestPreview = ref({
    mode: '',
    url: '',
    paramsText: '',
    headersText: '',
    bodyText: ''
});

// English comment.
const timeoutUnit = ref('秒');
const timeoutUnitOptions = [
    { label: '秒', value: '秒' },
    { label: '分', value: '分' }
];

const paramValueSourceOptions = [
    { label: '输入', value: 'input' },
    { label: '本地变量', value: 'local' },
    { label: 'localStorage', value: 'localStorage' },
    { label: 'Cookie', value: 'cookie' }
];

// English comment.
const activeParamsTab = ref('params');
const paramsTabs = [
    { key: 'params', label: 'Params' },
    { key: 'body', label: 'Body' },
    { key: 'header', label: 'Header' }
];

// English comment.
const bindingTypeOptions = [
    { label: '属性', value: 'property' },
    { label: '方法', value: 'method' }
];

const visualValueTypeOptions = [
    { label: '自动', value: 'auto' },
    { label: '文本', value: 'string' },
    { label: '数字', value: 'number' },
    { label: '开关', value: 'boolean' },
    { label: 'JSON', value: 'json' },
    { label: '三维坐标', value: 'vector3' }
];

const visualSortDirectionOptions = [
    { label: '不排序', value: 'none' },
    { label: '升序', value: 'asc' },
    { label: '降序', value: 'desc' }
];

const visualFilterOperatorOptions = [
    { label: '等于', value: 'equals' },
    { label: '不等于', value: 'notEquals' },
    { label: '包含', value: 'contains' },
    { label: '不包含', value: 'notContains' },
    { label: '大于', value: 'greaterThan' },
    { label: '大于等于', value: 'greaterOrEqual' },
    { label: '小于', value: 'lessThan' },
    { label: '小于等于', value: 'lessOrEqual' },
    { label: '为空', value: 'empty' },
    { label: '不为空', value: 'notEmpty' }
];

// English comment.
const modeOptions = [
    { label: 'HTTP 接口', value: 'http' },
    { label: '公共接口', value: 'public-source' },
    { label: '数据接入', value: 'data-access' },
    { label: 'WebSocket', value: 'websocket' },
    { label: 'MQTT', value: 'mqtt' },
    { label: '读取本地数据', value: 'local' }
];

const requestMethodOptions = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' }
];

const requestBodyTypeOptions = [
    { label: 'none', value: 'none' },
    { label: 'form-data', value: 'form-data' },
    { label: 'x-www-form-urlencoded', value: 'x-www-form-urlencoded' },
    { label: 'json', value: 'json' },
    { label: 'xml', value: 'xml' }
];

const mqttQosOptions = [
    { label: 'QoS 0', value: '0' },
    { label: 'QoS 1', value: '1' },
    { label: 'QoS 2', value: '2' }
];

const localFormatOptions = [
    { label: 'JSON', value: 'json' },
    { label: 'CSV', value: 'csv' },
    { label: '文本', value: 'text' }
];

// English comment.

// English comment.
const dataSources = computed(() => {
    const binding = selectedComponent.value?.dataBinding;
    return binding?.sources || [];
});

const bindingStatusLabel = computed(() => {
    if (!bindingEnabled.value) return '未启用';
    if (dataSources.value.length === 0) return '待添加';
    return `${dataSources.value.length} 个数据源`;
});

const bindingStatusClass = computed(() => {
    if (!bindingEnabled.value) return 'binding-status--off';
    if (dataSources.value.length === 0) return 'binding-status--empty';
    return 'binding-status--active';
});

const dataSourceSectionSubtitle = computed(() => {
    const count = dataSources.value.length;
    if (count === 0) return '暂无绑定项';
    return `${count} 个绑定项会按配置更新当前组件`;
});

const isHttpMode = computed(() => dataSourceForm.mode === 'http');
const isPublicSourceMode = computed(() => dataSourceForm.mode === 'public-source');
const isDataAccessMode = computed(() => dataSourceForm.mode === 'data-access');
const isWebSocketMode = computed(() => dataSourceForm.mode === 'websocket');
const isMqttMode = computed(() => dataSourceForm.mode === 'mqtt');
const canPreviewCurrentDataSource = computed(() => !isWebSocketMode.value && !isMqttMode.value);
const isSelectingSourceType = ref(false);
const COMPONENT_DATA_ACCESS_GUIDES = Object.freeze({
    MigrationLine: {
        property: 'lines',
        propertyLabel: '线条列表',
        formatHint: '数组，每项包含 points:[{ x, y, z }]，至少两个点',
        keywords: ['line', 'lines', 'point', 'points', 'start', 'end', 'from', 'to', 'source', 'target']
    },
    AreaBlock: {
        property: 'areas',
        propertyLabel: '区域块列表',
        formatHint: '数组，每项包含 points:[{ x, y, z }]，至少三个点',
        keywords: ['area', 'areas', 'polygon', 'path', 'vertex', 'vertices', 'point', 'points']
    },
    Label3D: {
        property: 'labels',
        propertyLabel: '标签列表',
        formatHint: '数组，每项包含 label 和 position:{ x, y, z }',
        keywords: ['label', 'labels', 'text', 'name', 'position', 'point', 'x', 'y', 'z']
    },
    PointTypeMarkerManager: {
        property: 'points',
        propertyLabel: '点位数据',
        formatHint: '数组，每项包含 id/typeId/position:{ x, y, z }',
        keywords: ['point', 'points', 'position', 'type', 'typeid', 'x', 'y', 'z']
    },
    TrafficRoadsideDeviceManager: {
        method: 'updateData',
        methodLabel: '更新设备位置',
        formatHint: '数组，每项包含 id 或 name，以及 x/y/z 坐标',
        keywords: ['device', 'devices', 'roadside', 'position', 'x', 'y', 'z', 'name', 'id']
    }
});

const getCurrentComponentDataAccessGuide = (bindProperty = '') => {
    const componentType = selectedComponent.value?.type || '';
    const guide = COMPONENT_DATA_ACCESS_GUIDES[componentType] || null;
    if (!guide) return null;
    if (bindProperty && guide.property && bindProperty !== guide.property) return null;
    if (bindProperty && !guide.property) return null;
    return guide;
};

const collectDataAccessFieldKeys = (access) => {
    const keys = new Set();
    const appendKey = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized) keys.add(normalized);
    };

    (access?.outputFields || []).forEach((field) => {
        appendKey(field?.name);
        appendKey(field?.alias);
    });

    const sourceFields = access?.blueprintData?.outputStructure?.sourceFields;
    if (Array.isArray(sourceFields)) {
        sourceFields.forEach((field) => {
            appendKey(field?.sourceKey);
            appendKey(field?.resultKey);
        });
    }

    appendKey(access?.tableName);
    appendKey(access?.accessCode);
    appendKey(access?.accessName);
    return [...keys];
};

const getDataAccessCompatibilityInfo = (access, bindProperty = '') => {
    const guide = getCurrentComponentDataAccessGuide(bindProperty);
    if (!guide) {
        return { score: 0, recommended: false, matchedKeywords: [] };
    }

    const fieldKeys = collectDataAccessFieldKeys(access);
    const matchedKeywords = guide.keywords.filter((keyword) => {
        return fieldKeys.some((fieldKey) => fieldKey.includes(keyword));
    });

    let score = 0;
    if (String(access?.resultType || '').toLowerCase() === 'list') {
        score += 2;
    }
    if (matchedKeywords.length > 0) {
        score += Math.min(4, matchedKeywords.length);
    }
    if (String(access?.status ?? 1) === '1' || Number(access?.status ?? 1) === 1) {
        score += 1;
    }

    return {
        score,
        recommended: score >= 4,
        matchedKeywords
    };
};

const currentComponentDataAccessGuide = computed(() => {
    return getCurrentComponentDataAccessGuide(dataSourceForm.bindProperty);
});
const selectedDataAccess = computed(() => {
    const accessCode = String(dataSourceForm.accessCode || '').trim();
    if (!accessCode) return null;
    return dataAccessCatalog.value.find((item) => String(item?.accessCode || '').trim() === accessCode) || null;
});
const dataAccessOptions = computed(() => {
    return dataAccessCatalog.value
        .map((item) => {
            const compatibility = getDataAccessCompatibilityInfo(item, dataSourceForm.bindProperty);
            const prefix = compatibility.recommended ? '推荐' : compatibility.score > 0 ? '可用' : '';
            return {
                label: `${prefix ? `${prefix} · ` : ''}${item.accessName || item.accessCode} (${item.accessCode})`,
                value: item.accessCode,
                score: compatibility.score
            };
        })
        .sort((left, right) => right.score - left.score || String(left.label).localeCompare(String(right.label), 'zh-Hans-CN'))
        .map(({ label, value }) => ({ label, value }));
});
const publicSourceOptions = computed(() => dataSourceStore.publicDataSourceOptions);
const selectedPublicSource = computed(() => {
    const sourceId = String(dataSourceForm.publicSourceId || '').trim();
    if (!sourceId) return null;
    return dataSourceStore.getPublicDataSourceById(sourceId) || null;
});
const recommendedDataAccessNames = computed(() => {
    return dataAccessCatalog.value
        .map((item) => ({
            name: item.accessName || item.accessCode,
            info: getDataAccessCompatibilityInfo(item, dataSourceForm.bindProperty)
        }))
        .filter((item) => item.info.recommended)
        .slice(0, 3)
        .map((item) => item.name);
});

const currentTransformPresets = computed(() => createTransformPresets(dataSourceForm.mode, dataSourceForm.bindProperty));

const cloneVisualArray = (value) => Array.isArray(value)
    ? value.map((item) => ({ ...(item || {}) }))
    : [];

const createVisualTransformConfig = (overrides = {}) => ({
    version: DEFAULT_VISUAL_TRANSFORM_CONFIG.version,
    enabled: overrides.enabled === true,
    templateId: String(overrides.templateId || ''),
    templateName: String(overrides.templateName || ''),
    componentType: String(overrides.componentType || ''),
    inputPath: String(overrides.inputPath || ''),
    arrayPath: String(overrides.arrayPath || ''),
    filters: cloneVisualArray(overrides.filters),
    sort: {
        field: String(overrides.sort?.field || ''),
        direction: overrides.sort?.direction || 'none'
    },
    limit: {
        enabled: overrides.limit?.enabled === true,
        count: Number(overrides.limit?.count || 0)
    },
    mappings: cloneVisualArray(overrides.mappings)
});

const ensureVisualTransformConfig = () => {
    if (!dataSourceForm.visualTransformConfig || typeof dataSourceForm.visualTransformConfig !== 'object') {
        dataSourceForm.visualTransformConfig = createVisualTransformConfig({
            inputPath: dataSourceForm.dataPath || ''
        });
    }
    if (!Array.isArray(dataSourceForm.visualTransformConfig.mappings)) {
        dataSourceForm.visualTransformConfig.mappings = [];
    }
    if (!Array.isArray(dataSourceForm.visualTransformConfig.filters)) {
        dataSourceForm.visualTransformConfig.filters = [];
    }
    if (!dataSourceForm.visualTransformConfig.sort || typeof dataSourceForm.visualTransformConfig.sort !== 'object') {
        dataSourceForm.visualTransformConfig.sort = { field: '', direction: 'none' };
    }
    if (!dataSourceForm.visualTransformConfig.limit || typeof dataSourceForm.visualTransformConfig.limit !== 'object') {
        dataSourceForm.visualTransformConfig.limit = { enabled: false, count: 0 };
    }
    return dataSourceForm.visualTransformConfig;
};

const visualTransformEnabled = computed(() => dataSourceForm.visualTransformConfig?.enabled === true);
const visualTransformConfig = computed(() => dataSourceForm.visualTransformConfig || createVisualTransformConfig());

const setVisualTransformEnabled = (enabled) => {
    const config = ensureVisualTransformConfig();
    config.enabled = enabled === true;
    if (config.enabled && !config.inputPath && dataSourceForm.dataPath) {
        config.inputPath = dataSourceForm.dataPath;
    }
};

const updateVisualTransformField = (field, value) => {
    const config = ensureVisualTransformConfig();
    config[field] = String(value || '');
};

const updateVisualSortField = (field, value) => {
    const config = ensureVisualTransformConfig();
    config.sort[field] = field === 'direction' ? String(value || 'none') : String(value || '');
};

const updateVisualLimitField = (field, value) => {
    const config = ensureVisualTransformConfig();
    config.limit[field] = field === 'enabled' ? value === true : Math.max(0, Number(value || 0));
};

const VISUAL_TARGET_OPTIONS_BY_COMPONENT = Object.freeze({
    Heatmap: ['x', 'y', 'z', 'value', 'radius', 'weight', 'name'],
    Label3D: ['id', 'label', 'text', 'name', 'position.x', 'position.y', 'position.z', 'color', 'scale', 'visible'],
    PointTypeMarkerManager: ['id', 'name', 'typeId', 'position.x', 'position.y', 'position.z', 'status', 'visible'],
    TrafficRoadsideDeviceManager: ['id', 'name', 'x', 'y', 'z', 'position.x', 'position.y', 'position.z', 'status', 'type'],
    MigrationLine: ['id', 'name', 'points.0.x', 'points.0.y', 'points.0.z', 'points.1.x', 'points.1.y', 'points.1.z', 'color', 'height'],
    AreaBlock: ['id', 'name', 'points.0.x', 'points.0.y', 'points.0.z', 'points.1.x', 'points.1.y', 'points.1.z', 'points.2.x', 'points.2.y', 'points.2.z', 'color', 'height']
});

const GENERIC_VISUAL_TARGETS = ['id', 'name', 'label', 'value', 'type', 'status', 'x', 'y', 'z', 'position.x', 'position.y', 'position.z'];

const normalizeOptionKey = (value = '') => String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const currentVisualDataTemplates = computed(() => getVisualDataTemplates(selectedComponent.value?.type || ''));
const activeVisualTemplateId = computed(() => dataSourceForm.visualTransformConfig?.templateId || '');
const activeVisualTemplate = computed(() => {
    const templateId = activeVisualTemplateId.value;
    if (!templateId) return null;
    return currentVisualDataTemplates.value.find((item) => item.id === templateId) || null;
});

const getCurrentVisualTemplateLabel = () => {
    if (activeVisualTemplate.value) return `当前：${activeVisualTemplate.value.label}`;
    return '选择后自动生成目标结构';
};

const toVisualOptions = (fields = []) => {
    const map = new Map();
    fields.forEach((field) => {
        const value = String((field?.value ?? field) || '').trim();
        if (!value || map.has(value)) return;
        map.set(value, {
            label: String(field?.label || value),
            value
        });
    });
    return [...map.values()];
};

const visualTargetFieldOptions = computed(() => {
    if (activeVisualTemplate.value) {
        return getVisualDataTemplateTargetOptions(activeVisualTemplate.value);
    }
    const componentType = selectedComponent.value?.type || '';
    const targets = VISUAL_TARGET_OPTIONS_BY_COMPONENT[componentType] || GENERIC_VISUAL_TARGETS;
    const propertyBindings = dataSourceForm.bindings.filter((item) => item.type === 'property' && item.value);
    const hasMethodBinding = dataSourceForm.bindings.some((item) => item.type === 'method' && item.value);
    const bindingTargets = propertyBindings.flatMap((item) => {
        const reference = getPropertyBindingReference(selectedComponent.value?.type || '', item.value);
        if (reference?.type === 'vector3') return ['x', 'y', 'z'];
        if (reference?.isCollection || reference?.type === 'json') return targets;
        return [];
    });
    if (!hasMethodBinding && propertyBindings.length === 1 && bindingTargets.length === 0) {
        return [];
    }
    return toVisualOptions([...targets, ...bindingTargets]);
});

const getVisualTargetOptions = (currentValue = '') => {
    const options = [...visualTargetFieldOptions.value];
    const normalizedCurrentValue = String(currentValue || '').trim();
    if (!normalizedCurrentValue || options.some((item) => item.value === normalizedCurrentValue)) {
        return options;
    }
    return [{ label: `${normalizedCurrentValue}（当前）`, value: normalizedCurrentValue }, ...options];
};

const parseCsvHeaderFields = (content = '') => {
    const firstLine = String(content || '').replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim());
    if (!firstLine) return [];
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
    return firstLine.split(delimiter)
        .map((item) => item.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
        .map((item) => ({ label: item, value: item }));
};

const selectedDataAccessFieldOptions = computed(() => {
    const access = selectedDataAccess.value;
    if (!access) return [];
    const fields = [];
    (access.outputFields || []).forEach((field) => {
        fields.push(field?.name, field?.alias, field?.sourceKey, field?.resultKey);
    });
    const sourceFields = access?.blueprintData?.outputStructure?.sourceFields;
    if (Array.isArray(sourceFields)) {
        sourceFields.forEach((field) => {
            fields.push(field?.sourceKey, field?.resultKey, field?.name, field?.alias);
        });
    }
    return toVisualOptions(fields);
});

const localDataFieldOptions = computed(() => {
    if (dataSourceForm.mode !== 'local') return [];
    if (dataSourceForm.localDataFormat === 'csv') {
        return parseCsvHeaderFields(dataSourceForm.localDataContent);
    }
    if (dataSourceForm.localDataFormat !== 'json') return [];
    try {
        return inferFieldOptions(JSON.parse(dataSourceForm.localDataContent || 'null')).map((item) => ({
            label: item.label,
            value: item.value
        }));
    } catch {
        return [];
    }
});

const visualSourceFieldOptions = computed(() => {
    if (dataSourceForm.mode === 'data-access') return selectedDataAccessFieldOptions.value;
    if (dataSourceForm.mode === 'local') return localDataFieldOptions.value;
    return [];
});

const visualSourceFieldHints = computed(() => visualSourceFieldOptions.value.slice(0, 12).map((item) => item.label || item.value));

const SOURCE_ALIASES_BY_TARGET = Object.freeze({
    id: ['id', 'ID', '_id', 'code', 'deviceId'],
    name: ['name', 'title', 'label', 'text', 'deviceName'],
    label: ['label', 'name', 'title', 'text'],
    text: ['text', 'label', 'name', 'title'],
    value: ['value', 'count', 'num', 'total', 'score'],
    type: ['type', 'category', 'kind'],
    typeId: ['typeId', 'type_id', 'type', 'category'],
    status: ['status', 'state', 'online', 'enabled'],
    x: ['x', 'lng', 'lon', 'longitude'],
    y: ['y', 'lat', 'latitude'],
    z: ['z', 'alt', 'height', 'elevation'],
    'position.x': ['x', 'lng', 'lon', 'longitude', 'position.x'],
    'position.y': ['y', 'lat', 'latitude', 'position.y'],
    'position.z': ['z', 'alt', 'height', 'elevation', 'position.z'],
    'points.0.x': ['startX', 'fromX', 'sourceX', 'x1', 'lng1', 'startLng'],
    'points.0.y': ['startY', 'fromY', 'sourceY', 'y1', 'lat1', 'startLat'],
    'points.0.z': ['startZ', 'fromZ', 'sourceZ', 'z1', 'height1', 'startHeight'],
    'points.1.x': ['endX', 'toX', 'targetX', 'x2', 'lng2', 'endLng'],
    'points.1.y': ['endY', 'toY', 'targetY', 'y2', 'lat2', 'endLat'],
    'points.1.z': ['endZ', 'toZ', 'targetZ', 'z2', 'height2', 'endHeight'],
    color: ['color', 'fill', 'stroke'],
    height: ['height', 'z', 'alt']
});

const getVisualTargetType = (target = '') => {
    const normalized = String(target || '');
    if (/(^|\.)(x|y|z)$/.test(normalized) || ['value', 'height', 'radius', 'weight', 'scale'].includes(normalized)) {
        return 'number';
    }
    if (['visible', 'enabled'].includes(normalized)) return 'boolean';
    if (normalized === 'position') return 'vector3';
    return 'auto';
};

const getVisualSourcePlaceholder = (target = '') => {
    const templateMapping = activeVisualTemplate.value
        ? getVisualDataTemplateMapping(activeVisualTemplate.value, target)
        : null;
    const aliases = templateMapping?.sourceAliases || SOURCE_ALIASES_BY_TARGET[target] || SOURCE_ALIASES_BY_TARGET[target.split('.').pop()] || [target || '来源字段'];
    return `如 ${aliases.slice(0, 3).join(' / ')}`;
};

const pickSourceFieldForTarget = (target = '') => {
    const templateMapping = activeVisualTemplate.value
        ? getVisualDataTemplateMapping(activeVisualTemplate.value, target)
        : null;
    const aliases = templateMapping?.sourceAliases || SOURCE_ALIASES_BY_TARGET[target] || SOURCE_ALIASES_BY_TARGET[target.split('.').pop()] || [target];
    const sourceOptions = visualSourceFieldOptions.value;
    const normalizedAliases = aliases.map((item) => normalizeOptionKey(item));
    const exact = sourceOptions.find((item) => normalizedAliases.includes(normalizeOptionKey(item.value)));
    if (exact) return exact.value;
    const fuzzy = sourceOptions.find((item) => {
        const fieldKey = normalizeOptionKey(item.value);
        return normalizedAliases.some((alias) => fieldKey.includes(alias) || alias.includes(fieldKey));
    });
    if (fuzzy) return fuzzy.value;
    return aliases[0] || target;
};

const getRecommendedVisualTargets = () => {
    if (activeVisualTemplate.value) {
        return activeVisualTemplate.value.mappings.map((item) => item.target);
    }
    const componentType = selectedComponent.value?.type || '';
    const targets = VISUAL_TARGET_OPTIONS_BY_COMPONENT[componentType] || GENERIC_VISUAL_TARGETS;
    const selectedProperty = dataSourceForm.bindProperty || dataSourceForm.bindings.find((item) => item.type === 'property' && item.value)?.value || '';
    const reference = selectedProperty ? getPropertyBindingReference(componentType, selectedProperty) : null;
    if (reference?.type === 'vector3') {
        return ['x', 'y', 'z'];
    }
    if (selectedProperty && reference && !reference.isCollection && reference.type !== 'json') {
        return [];
    }
    return targets.slice(0, componentType === 'AreaBlock' ? 12 : 10);
};

const applyRecommendedVisualMapping = () => {
    if (activeVisualTemplate.value) {
        applyVisualDataTemplate(activeVisualTemplate.value);
        return;
    }
    if (currentVisualDataTemplates.value.length) {
        applyVisualDataTemplate(currentVisualDataTemplates.value[0]);
        return;
    }
    const config = ensureVisualTransformConfig();
    config.enabled = true;
    const targets = getRecommendedVisualTargets();
    if (targets.length === 0) {
        config.mappings = [];
        toast.info('当前绑定是单值属性，请在“返回数据路径”填写字段路径即可，不需要字段映射');
        return;
    }
    config.mappings = targets.map((target) => ({
        target,
        source: pickSourceFieldForTarget(target),
        fallback: '',
        type: getVisualTargetType(target)
    }));
    toast.success('已生成推荐字段映射，可按实际接口字段继续调整');
};

const applyVisualDataTemplate = (template) => {
    if (!template) return;
    if (template.binding?.type && template.binding?.value) {
        dataSourceForm.bindings = [{
            type: template.binding.type,
            value: template.binding.value
        }];
        syncPrimaryBindProperty();
    }
    dataSourceForm.visualTransformConfig = buildVisualTransformConfigFromTemplate(template, {
        currentConfig: ensureVisualTransformConfig(),
        sourceFields: visualSourceFieldOptions.value
    });
    toast.success(`已应用组件模板：${template.label}`);
};

const addVisualMapping = () => {
    const config = ensureVisualTransformConfig();
    if (visualTargetFieldOptions.value.length === 0) {
        toast.info('当前绑定是单值属性，请使用“返回数据路径”直接提取字段值');
        return;
    }
    const usedTargets = new Set(config.mappings.map((item) => item.target).filter(Boolean));
    const nextTarget = visualTargetFieldOptions.value.find((item) => !usedTargets.has(item.value))?.value || '';
    config.mappings.push({
        target: nextTarget,
        source: nextTarget ? pickSourceFieldForTarget(nextTarget) : '',
        fallback: '',
        type: getVisualTargetType(nextTarget)
    });
};

const updateVisualMapping = (index, field, value) => {
    const config = ensureVisualTransformConfig();
    const mapping = config.mappings[index];
    if (!mapping) return;
    mapping[field] = field === 'type' ? String(value || 'auto') : String(value ?? '');
    if (field === 'target' && !mapping.source) {
        mapping.source = pickSourceFieldForTarget(mapping.target);
        mapping.type = getVisualTargetType(mapping.target);
    }
};

const removeVisualMapping = (index) => {
    const config = ensureVisualTransformConfig();
    config.mappings.splice(index, 1);
};

const addVisualFilter = () => {
    const config = ensureVisualTransformConfig();
    config.filters.push({
        enabled: true,
        field: '',
        operator: 'equals',
        value: ''
    });
};

const updateVisualFilter = (index, field, value) => {
    const config = ensureVisualTransformConfig();
    const filter = config.filters[index];
    if (!filter) return;
    filter[field] = field === 'enabled' ? value === true : String(value ?? '');
};

const removeVisualFilter = (index) => {
    const config = ensureVisualTransformConfig();
    config.filters.splice(index, 1);
};

const createDataAccessParamRows = (access) => {
    if (!access || !Array.isArray(access.inputParams)) return [];
    return access.inputParams.map((param) => ({
        key: String(param?.name || '').trim(),
        value: param?.defaultValue ?? '',
        valueSource: 'input',
        variableName: ''
    }));
};

const ensureDataAccessCatalog = async () => {
    if (dataAccessLoading.value) return;
    if (dataAccessCatalog.value.length > 0) return;

    dataAccessLoading.value = true;
    try {
        const result = await fetchDataAccessList();
        dataAccessCatalog.value = Array.isArray(result) ? result : [];
    } catch (error) {
        console.error('[DataBindingEditor] load data access failed:', error);
        toast.error(`加载数据接入失败: ${error.message}`);
    } finally {
        dataAccessLoading.value = false;
    }
};

const syncDataAccessSelection = (accessCode, { initializeParams = true, forceParams = false } = {}) => {
    const access = dataAccessCatalog.value.find((item) => String(item?.accessCode || '').trim() === String(accessCode || '').trim()) || null;
    dataSourceForm.accessCode = access?.accessCode || '';
    dataSourceForm.accessName = access?.accessName || '';

    if (!initializeParams || !access) return;

    const nextParams = createDataAccessParamRows(access);
    const hasMeaningfulParams = (dataSourceForm.params || []).some((item) => String(item?.key || '').trim() || String(item?.value || '').trim() || String(item?.variableName || '').trim());
    if (forceParams || !hasMeaningfulParams) {
        dataSourceForm.params = nextParams;
    }
};

const normalizeStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || '').trim())
        .filter((item, index, arr) => !!item && arr.indexOf(item) === index);
};

const getBindProperties = (source = {}) => {
    const list = normalizeStringArray(source.bindProperties);
    if (list.length) return list;
    const legacy = String(source.bindProperty || '').trim();
    return legacy ? [legacy] : [];
};

const getMethodBindings = (source = {}) => {
    if (Array.isArray(source.methodBindings) && source.methodBindings.length) {
        return source.methodBindings
            .map((item) => ({
                enabled: item?.enabled !== false,
                methodName: String(item?.methodName || '').trim(),
                passMode: item?.passMode || 'finalValue'
            }))
            .filter((item) => !!item.methodName);
    }
    const legacyName = String(source?.methodBinding?.methodName || '').trim();
    if (source?.methodBinding?.enabled && legacyName) {
        return [{
            enabled: true,
            methodName: legacyName,
            passMode: source?.methodBinding?.passMode || 'finalValue'
        }];
    }
    return [];
};

const getSourceBindPropertyLabel = (source = {}) => {
    const props = getBindProperties(source).map((item) => getPropertyLabel(item));
    const methods = getMethodBindings(source).map((item) => item.methodName);
    const all = [...props, ...methods];
    if (!all.length) return '未绑定';
    return all.join('，');
};

const bindableProperties = computed(() => {
    return getBindablePropertyOptionsByType(selectedComponent.value?.type || '');
});

const localVariableOptions = computed(() => {
    return (variableStore.variables || []).map((item) => ({
        label: `${item.name}`,
        value: item.name
    }));
});

const hasLocalVariables = computed(() => localVariableOptions.value.length > 0);

const getLocalVariableOptions = (currentName = '') => {
    const normalizedCurrentName = String(currentName || '').trim();
    const options = [...localVariableOptions.value];
    if (!normalizedCurrentName) return options;
    if (options.some((item) => item.value === normalizedCurrentName)) {
        return options;
    }
    return [
        { label: `${normalizedCurrentName} (当前值)`, value: normalizedCurrentName },
        ...options
    ];
};

const buildCurrentValueOption = (currentName = '', labelSuffix = '当前值') => {
    const normalizedCurrentName = String(currentName || '').trim();
    if (!normalizedCurrentName) return [];
    return [{ label: `${normalizedCurrentName} (${labelSuffix})`, value: normalizedCurrentName }];
};

const localStorageOptions = computed(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
        return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
            .filter(Boolean)
            .map((key) => ({
                label: String(key),
                value: String(key)
            }));
    } catch {
        return [];
    }
});

const cookieOptions = computed(() => {
    if (typeof document === 'undefined') return [];
    return String(document.cookie || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.split('=')[0]?.trim())
        .filter(Boolean)
        .map((name) => ({
            label: String(name),
            value: String(name)
        }));
});

const hasLocalStorageOptions = computed(() => localStorageOptions.value.length > 0);
const hasCookieOptions = computed(() => cookieOptions.value.length > 0);

const getLocalStorageOptions = (currentName = '') => {
    const normalizedCurrentName = String(currentName || '').trim();
    const options = [...localStorageOptions.value];
    if (!normalizedCurrentName) return options;
    if (options.some((item) => item.value === normalizedCurrentName)) {
        return options;
    }
    return [
        ...buildCurrentValueOption(normalizedCurrentName),
        ...options
    ];
};

const getCookieOptions = (currentName = '') => {
    const normalizedCurrentName = String(currentName || '').trim();
    const options = [...cookieOptions.value];
    if (!normalizedCurrentName) return options;
    if (options.some((item) => item.value === normalizedCurrentName)) {
        return options;
    }
    return [
        ...buildCurrentValueOption(normalizedCurrentName),
        ...options
    ];
};

const openVariablesPanel = () => {
    editorStore.showLeftPanel = true;
    editorStore.setActiveLeftPanelTab('variables');
};

const getCurrentListPreviewSource = () => {
    const component = selectedComponent.value;
    const targetProperty = currentComponentListDataSample.value?.property;
    const sources = component?.dataBinding?.sources || [];
    if (!targetProperty) return null;

    return sources.find((source) => {
        const bindProperties = getBindProperties(source);
        return bindProperties.includes(targetProperty);
    }) || null;
};

const extractListDataForPreview = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (!value || typeof value !== 'object') {
        return [];
    }

    const directList = value?.source ?? value?.list ?? value?.rows ?? value?.data ?? null;
    if (Array.isArray(directList)) {
        return directList;
    }

    if (currentComponentListDataSample.value?.property && Array.isArray(value[currentComponentListDataSample.value.property])) {
        return value[currentComponentListDataSample.value.property];
    }

    return [];
};

const refreshCurrentListDataPreview = async () => {
    const source = getCurrentListPreviewSource();
    if (!source || !selectedComponent.value?.id) {
        listDataPreviewMode.value = 'mock';
        listDataPreviewJson.value = '';
        return;
    }

    try {
        listDataPreviewLoading.value = true;
        const result = await fetchDataSource(source, projectStore.apiBaseUrl, selectedComponent.value.id, null);
        if (!result?.success) {
            listDataPreviewMode.value = 'mock';
            listDataPreviewJson.value = '';
            return;
        }

        const finalData = runTransformPreview(source, result.data);
        const listData = extractListDataForPreview(finalData);
        if (Array.isArray(listData) && listData.length > 0) {
            listDataPreviewMode.value = 'real';
            listDataPreviewJson.value = JSON.stringify(listData.slice(0, 20), null, 2);
            return;
        }

        listDataPreviewMode.value = 'mock';
        listDataPreviewJson.value = '';
    } catch (error) {
        console.warn('[DataBindingEditor] refresh list preview failed:', error);
        listDataPreviewMode.value = 'mock';
        listDataPreviewJson.value = '';
    } finally {
        listDataPreviewLoading.value = false;
    }
};

const currentComponentStructureRows = computed(() => {
    const componentType = selectedComponent.value?.type || '';
    if (!componentType) return [];
    return bindableProperties.value.map((item) => {
        const reference = getPropertyBindingReference(componentType, item.value);
        return {
            key: item.value,
            type: reference?.type || 'unknown',
            formatHint: reference?.formatHint || '-',
            description: reference?.description || ''
        };
    });
});

const getParamTypeExample = (param = {}) => {
    const type = String(param?.type || '').toLowerCase();
    const name = String(param?.name || 'value');
    if (type === 'number') return 0;
    if (type === 'boolean') return false;
    if (type === 'array') return [];
    if (type === 'object') return { [name]: null };
    if (type === 'vector3') return { x: 0, y: 0, z: 0 };
    return '';
};

const currentComponentMethodRows = computed(() => {
    const componentType = selectedComponent.value?.type || '';
    const methods = getComponentMethodDefinitions(componentType) || [];
    return methods.map((item) => {
        const params = Array.isArray(item?.params) ? item.params : [];
        const paramsText = params.length
            ? params.map((param) => `${param?.name || 'arg'}:${param?.type || 'string'}${param?.required ? '(必填)' : ''}`).join(', ')
            : '无';
        return {
            name: item?.name || '',
            title: item?.title || item?.name || '',
            description: item?.description || '',
            paramsText,
            params
        };
    }).filter((item) => !!item.name);
});

const boundMethodNameSet = computed(() => {
    const names = new Set();

    dataSources.value.forEach((source) => {
        getMethodBindings(source).forEach((binding) => {
            const methodName = String(binding?.methodName || '').trim();
            if (methodName) names.add(methodName);
        });
    });

    (dataSourceForm.bindings || []).forEach((binding) => {
        if (binding?.type !== 'method') return;
        const methodName = String(binding?.value || '').trim();
        if (methodName) names.add(methodName);
    });

    return names;
});

const currentComponentMethodRowsForDisplay = computed(() => {
    const allRows = currentComponentMethodRows.value;
    const boundSet = boundMethodNameSet.value;
    if (!boundSet.size) return allRows;
    const filtered = allRows.filter((item) => boundSet.has(item.name));
    return filtered.length ? filtered : allRows;
});

const methodStructureScopeText = computed(() => {
    return boundMethodNameSet.value.size > 0 ? '当前已绑定方法' : '组件全部方法';
});

const currentComponentMethodJson = computed(() => {
    const sample = {};
    currentComponentMethodRowsForDisplay.value.forEach((method) => {
        if (!method.params?.length) {
            sample[method.name] = null;
            return;
        }
        if (method.params.length === 1) {
            sample[method.name] = getParamTypeExample(method.params[0]);
            return;
        }
        const multiArgs = {};
        method.params.forEach((param) => {
            multiArgs[param?.name || 'arg'] = getParamTypeExample(param);
        });
        sample[method.name] = multiArgs;
    });
    return JSON.stringify(sample, null, 2);
});

const COMPONENT_LIST_DATA_SAMPLES = Object.freeze({
    Heatmap: {
        property: 'data',
        label: '热力点位列表',
        data: [
            { id: 'heat_001', name: '东门', x: -6, y: 0, z: -3, value: 10, size: 1.2 },
            { id: 'heat_002', name: '主广场', x: -2, y: 0, z: 1, value: 35, size: 1.8 },
            { id: 'heat_003', name: '停车区', x: 4, y: 0, z: 3, value: 80, size: 3.2 }
        ]
    },
    AreaBlock: {
        property: 'areas',
        label: '区域块列表',
        data: [
            {
                id: 'area_001',
                name: '能源分区',
                category: 'energy',
                points: [
                    { x: -12, y: 0, z: -8 },
                    { x: -2, y: 0, z: -8 },
                    { x: -1, y: 0, z: 3 },
                    { x: -13, y: 0, z: 2 }
                ]
            },
            {
                id: 'area_002',
                name: '交通分区',
                category: 'traffic',
                points: [
                    { x: 4, y: 0, z: -6 },
                    { x: 12, y: 0, z: -4 },
                    { x: 10, y: 0, z: 6 },
                    { x: 3, y: 0, z: 4 }
                ]
            }
        ]
    },
    MultiPathAnimation: {
        property: 'paths',
        label: '路径列表',
        data: [
            {
                id: 'path_001',
                name: '巡检路线 A',
                speed: 5,
                data: [
                    { x: -10, y: 0, z: -5 },
                    { x: -2, y: 0, z: 0 },
                    { x: 8, y: 0, z: 4 }
                ]
            },
            {
                id: 'path_002',
                name: '巡检路线 B',
                speed: 6.5,
                data: [
                    { x: -8, y: 0, z: 8 },
                    { x: 0, y: 0, z: 6 },
                    { x: 10, y: 0, z: 9 }
                ]
            }
        ]
    },
    Label3D: {
        property: 'labels',
        label: '标签列表',
        data: [
            {
                id: 'label_001',
                label: '1号楼',
                type: 'building',
                position: { x: -6, y: 4, z: 3 },
                config: { renderMode: 'sprite', size: 1.2, textColor: '#ffffff' }
            },
            {
                id: 'label_002',
                label: '监控点',
                type: 'camera',
                position: { x: 8, y: 3, z: -2 },
                config: { renderMode: 'plane', size: 1, textColor: '#22d3ee' }
            }
        ]
    },
    PointTypeMarkerManager: {
        property: 'points',
        label: '点位列表',
        data: [
            {
                id: 'point_001',
                name: '配电柜 A',
                typeId: 'power',
                position: { x: -4, y: 0, z: 6 },
                scale: 1,
                visible: true,
                data: { status: 'online', level: 'warning' }
            },
            {
                id: 'point_002',
                name: '摄像头 B',
                typeId: 'camera',
                position: { x: 6, y: 0, z: -3 },
                scale: 1.1,
                visible: true,
                data: { status: 'online', level: 'normal' }
            }
        ]
    },
    TrafficRoadsideDeviceManager: {
        method: 'updateData',
        label: '路侧设备位置更新',
        data: [
            {
                id: 'device_001',
                name: '信号灯 A',
                x: -12,
                y: 0,
                z: 4
            },
            {
                id: 'device_002',
                name: '相机 B',
                x: 14,
                y: 0,
                z: -6
            }
        ]
    },
    MigrationLine: {
        property: 'lines',
        label: '迁移线列表',
        data: [
            {
                lineId: 'line_001',
                name: '迁移线 001',
                category: 'logistics',
                color: '#22c55e',
                speed: 1.15,
                points: [
                    { x: 18, y: 0, z: 0 },
                    { x: 23.4, y: 7, z: 6.8 },
                    { x: 24.25, y: 0, z: 14 }
                ]
            },
            {
                lineId: 'line_002',
                name: '迁移线 002',
                category: 'energy',
                color: '#3b82f6',
                speed: 1.5,
                points: [
                    { x: 17.12, y: 0, z: 5.56 },
                    { x: 19.8, y: 8, z: 13.4 },
                    { x: 18.74, y: 0, z: 20.81 }
                ]
            },
            {
                lineId: 'line_003',
                name: '迁移线 003',
                category: 'traffic',
                color: '#f97316',
                speed: 1.85,
                points: [
                    { x: 14.56, y: 0, z: 10.58 },
                    { x: 14.2, y: 6, z: 18.4 },
                    { x: 11.39, y: 0, z: 25.58 }
                ]
            }
        ]
    }
});

const currentComponentListDataSample = computed(() => {
    const componentType = selectedComponent.value?.type || '';
    return COMPONENT_LIST_DATA_SAMPLES[componentType] || null;
});

const shouldShowMockListStructure = computed(() => Boolean(currentComponentListDataSample.value));

const currentComponentMockListLabel = computed(() => {
    return currentComponentListDataSample.value?.label || '列表数据';
});

const currentComponentMockListJson = computed(() => {
    if (listDataPreviewMode.value === 'real' && listDataPreviewJson.value) {
        return listDataPreviewJson.value;
    }
    return JSON.stringify(currentComponentListDataSample.value?.data || [], null, 2);
});

const currentComponentListDataSourceLabel = computed(() => {
    return listDataPreviewMode.value === 'real' ? '真实结果' : '模拟结果';
});

const currentComponentStructureJson = computed(() => {
    const componentType = selectedComponent.value?.type || '';
    if (componentType === 'Heatmap') {
        return JSON.stringify({
            data: [
                { x: -6, y: 0, z: -3, value: 10, size: 1.2 },
                { x: -2, y: 0, z: 1, value: 35, size: 1.8 },
                { x: 1, y: 0, z: -2, value: 55, size: 2.4 },
                { x: 4, y: 0, z: 3, value: 80, size: 3.2 }
            ],
            colors: ['#102a6b', '#00b8ff', '#29f0b4', '#ffe066', '#ff8c42', '#ff3b30'],
            thresholds: [
                { value: 20, color: '#00b8ff' },
                { value: 50, color: '#29f0b4' },
                { value: 80, color: '#ff8c42' }
            ]
        }, null, 2);
    }

    const sample = {};
    bindableProperties.value.forEach((item) => {
        const reference = getPropertyBindingReference(componentType, item.value);
        sample[item.value] = reference?.defaultValue !== undefined
            ? reference.defaultValue
            : (reference?.formatHint || null);
    });
    return JSON.stringify(sample, null, 2);
});

const methodBindingOptions = computed(() => {
    const componentType = selectedComponent.value?.type || '';
    const methodDefinitions = getComponentMethodDefinitions(componentType) || [];
    const reservedMethodNames = new Set(['requestdata', 'executedatabinding']);

    return methodDefinitions
        .filter((item) => !reservedMethodNames.has(String(item?.name || '').toLowerCase()))
        .map((item) => ({
            label: `${item?.title || item?.name || ''} (${item?.name || ''})`,
            value: item?.name || ''
        }))
        .filter((item) => item.value);
});

const applySinglePropertyBinding = (property, sourceId) => {
    if (!selectedComponent.value) return;

    dataSources.value.forEach((source) => {
        if ((getBindProperties(source)[0] || '') === property && source.id !== sourceId) {
            componentStore.updateDataSource(selectedComponent.value.id, source.id, { bindProperty: '', bindProperties: [] });
        }
    });

    if (!sourceId) return;

    const targetSource = dataSources.value.find((source) => source.id === sourceId);
    if (!targetSource) return;

    if ((getBindProperties(targetSource)[0] || '') && (getBindProperties(targetSource)[0] || '') !== property) {
        componentStore.updateDataSource(selectedComponent.value.id, sourceId, { bindProperty: property, bindProperties: property ? [property] : [] });
        return;
    }

    componentStore.updateDataSource(selectedComponent.value.id, sourceId, { bindProperty: property, bindProperties: property ? [property] : [] });
};

const applyTransformExampleToForm = (reference) => {
    if (!reference) return;

    const expression = reference.transformExpression || 'data?.result ?? data';
    const modeLabel = getSourceModeLabel(dataSourceForm.mode);
    dataSourceForm.transformFn = `// ${modeLabel} 完成回调数据转换\n// data: ${modeLabel} 返回的原始数据\n// 返回值: 转换后的数据，将赋值给绑定的属性 ${reference.key || ''}\nfunction transform(data) {\n    return ${expression};\n}`;
    toast.success('已应用接入示例到 transform');
};

const createMigrationLineTransformFn = (modeLabel = '数据接入') => {
    return `// ${modeLabel} 完成回调数据转换
// English comment.
// English comment.
function transform(data) {
    const list = Array.isArray(data)
        ? data
        : data?.lines ?? data?.list ?? data?.rows ?? data?.source ?? [];

    if (!Array.isArray(list)) {
        return [];
    }

    const isReady = list.every((item) =>
        item &&
        Array.isArray(item.points) &&
        item.points.length >= 2 &&
        item.points.every((point) =>
            point &&
            Number.isFinite(Number(point.x)) &&
            Number.isFinite(Number(point.y)) &&
            Number.isFinite(Number(point.z))
        )
    );

    if (isReady) {
        return list;
    }

    const normalizePoint = (point = {}) => ({
        x: Number(point.x ?? point.lng ?? point.lon ?? point.longitude ?? 0),
        y: Number(point.y ?? point.alt ?? point.height ?? point.elevation ?? 0),
        z: Number(point.z ?? point.lat ?? point.latitude ?? 0)
    });

    const buildPoints = (item) => {
        if (Array.isArray(item?.points)) {
            return item.points.map(normalizePoint);
        }

        const start = item?.start ?? item?.from ?? item?.source ?? item?.origin;
        const end = item?.end ?? item?.to ?? item?.target ?? item?.destination;
        return [start, end].filter(Boolean).map(normalizePoint);
    };

    return list
        .map((item, index) => ({
            id: item?.id ?? item?.lineId ?? \`line_\${index + 1}\`,
            name: item?.name ?? item?.label ?? \`line_\${index + 1}\`,
            points: buildPoints(item)
        }))
        .filter((item) => Array.isArray(item.points) && item.points.length >= 2);
}`;
};

const createAreaBlockTransformFn = (modeLabel = '数据接入') => {
    return `// ${modeLabel} 完成回调数据转换
// English comment.
// English comment.
function transform(data) {
    const list = Array.isArray(data)
        ? data
        : data?.areas ?? data?.list ?? data?.rows ?? data?.source ?? [];

    if (!Array.isArray(list)) {
        return [];
    }

    const normalizePoint = (point = {}) => {
        if (Array.isArray(point)) {
            return {
                x: Number(point[0] ?? 0),
                y: Number(point[1] ?? 0),
                z: Number(point[2] ?? 0)
            };
        }

        return {
            x: Number(point.x ?? point.lng ?? point.lon ?? point.longitude ?? 0),
            y: Number(point.y ?? point.alt ?? point.height ?? point.elevation ?? 0),
            z: Number(point.z ?? point.lat ?? point.latitude ?? 0)
        };
    };

    const buildPoints = (item) => {
        const points = Array.isArray(item?.points)
            ? item.points
            : Array.isArray(item?.polygon)
                ? item.polygon
                : Array.isArray(item?.path)
                    ? item.path
                    : Array.isArray(item?.vertices)
                        ? item.vertices
                        : [];

        return points.map(normalizePoint);
    };

    return list
        .map((item, index) => ({
            id: item?.id ?? item?.areaId ?? \`area_\${index + 1}\`,
            name: item?.name ?? item?.label ?? \`area_\${index + 1}\`,
            points: buildPoints(item)
        }))
        .filter((item) => Array.isArray(item.points) && item.points.length >= 3);
}`;
};

const createLabel3DTransformFn = (modeLabel = '数据接入') => {
    return `// ${modeLabel} 完成回调数据转换
// English comment.
// English comment.
function transform(data) {
    const list = Array.isArray(data)
        ? data
        : data?.labels ?? data?.list ?? data?.rows ?? data?.source ?? [];

    if (!Array.isArray(list)) {
        return [];
    }

    const normalizePosition = (value = {}) => {
        if (Array.isArray(value)) {
            return {
                x: Number(value[0] ?? 0),
                y: Number(value[1] ?? 0),
                z: Number(value[2] ?? 0)
            };
        }

        return {
            x: Number(value.x ?? value.lng ?? value.lon ?? value.longitude ?? 0),
            y: Number(value.y ?? value.alt ?? value.height ?? value.elevation ?? 0),
            z: Number(value.z ?? value.lat ?? value.latitude ?? 0)
        };
    };

    return list.map((item, index) => ({
        id: item?.id ?? item?.labelId ?? \`label_\${index + 1}\`,
        label: String(item?.label ?? item?.text ?? item?.name ?? \`标签 \${index + 1}\`),
        position: normalizePosition(item?.position ?? item?.point ?? item),
        config: {
            renderMode: item?.config?.renderMode === 'plane' ? 'plane' : 'sprite',
            autoSize: item?.config?.autoSize !== false,
            size: Number(item?.config?.size ?? item?.size ?? 1) || 1,
            width: Number(item?.config?.width ?? item?.width ?? 2) || 2,
            height: Number(item?.config?.height ?? item?.height ?? 1) || 1,
            textColor: String(item?.config?.textColor ?? item?.textColor ?? '#ffffff'),
            backgroundColor: String(item?.config?.backgroundColor ?? item?.backgroundColor ?? 'rgba(0, 0, 0, 0.7)'),
            center: {
                x: Number(item?.config?.center?.x ?? 0.5),
                y: Number(item?.config?.center?.y ?? 0)
            }
        }
    }));
}`;
};

const createPointTypeMarkerTransformFn = (modeLabel = '数据接入') => {
    return `// ${modeLabel} 完成回调数据转换
// English comment.
// English comment.
function transform(data) {
    const list = Array.isArray(data)
        ? data
        : data?.points ?? data?.list ?? data?.rows ?? data?.source ?? [];

    if (!Array.isArray(list)) {
        return [];
    }

    const normalizePosition = (value = {}) => {
        if (Array.isArray(value)) {
            return {
                x: Number(value[0] ?? 0),
                y: Number(value[1] ?? 0),
                z: Number(value[2] ?? 0)
            };
        }

        return {
            x: Number(value.x ?? value.lng ?? value.lon ?? value.longitude ?? 0),
            y: Number(value.y ?? value.alt ?? value.height ?? value.elevation ?? 0),
            z: Number(value.z ?? value.lat ?? value.latitude ?? 0)
        };
    };

    return list.map((item, index) => ({
        id: item?.id ?? item?.pointId ?? \`point_\${index + 1}\`,
        name: item?.name ?? item?.label ?? \`点位 \${index + 1}\`,
        typeId: item?.typeId ?? item?.type ?? 'default',
        position: normalizePosition(item?.position ?? item?.point ?? item),
        scale: Number(item?.scale ?? 1) || 1,
        visible: item?.visible !== false,
        data: item?.data ?? item
    }));
}`;
};

const createRoadsideDevicePositionTransformFn = (modeLabel = '数据接入') => {
    return `// ${modeLabel} 完成回调数据转换
// English comment.
// English comment.
// English comment.
function transform(data) {
    const list = Array.isArray(data)
        ? data
        : data?.devices ?? data?.list ?? data?.rows ?? data?.source ?? data?.payload ?? [];

    if (!Array.isArray(list)) {
        return [];
    }

    return list
        .map((item) => ({
            id: item?.id ?? item?.deviceId ?? '',
            name: item?.name ?? item?.deviceName ?? '',
            x: Number(item?.x),
            y: Number(item?.y),
            z: Number(item?.z)
        }))
        .filter((item) =>
            (item.id || item.name) &&
            Number.isFinite(item.x) &&
            Number.isFinite(item.y) &&
            Number.isFinite(item.z)
        );
}`;
};

const createStructuredDataAccessTransformFn = (bindProperty = '', modeLabel = '数据接入') => {
    const componentType = selectedComponent.value?.type || '';
    if (componentType === 'MigrationLine' && bindProperty === 'lines') {
        return createMigrationLineTransformFn(modeLabel);
    }
    if (componentType === 'AreaBlock' && bindProperty === 'areas') {
        return createAreaBlockTransformFn(modeLabel);
    }
    if (componentType === 'Label3D' && bindProperty === 'labels') {
        return createLabel3DTransformFn(modeLabel);
    }
    if (componentType === 'PointTypeMarkerManager' && bindProperty === 'points') {
        return createPointTypeMarkerTransformFn(modeLabel);
    }
    if (componentType === 'TrafficRoadsideDeviceManager' && !bindProperty) {
        return createRoadsideDevicePositionTransformFn(modeLabel);
    }
    return '';
};

const createDefaultTransformFn = (mode = 'http', bindProperty = '') => {
    const propertyLabel = bindProperty || '目标属性';
    const modeLabel = getSourceModeLabel(mode);
    if (selectedComponent.value?.type === 'TrafficRoadsideDeviceManager' && !bindProperty) {
        return createRoadsideDevicePositionTransformFn(modeLabel);
    }
    const structuredTransform = mode === 'data-access'
        ? createStructuredDataAccessTransformFn(bindProperty, modeLabel)
        : '';
    if (structuredTransform) {
        return structuredTransform;
    }
    const sourceLineMap = {
        http: '// 适用场景: 接口请求完成后，将响应结果映射为组件可消费的数据',
        'public-source': '// 适用场景: 复用项目级公共接口结果，将统一输出转换为组件可消费的数据',
        'data-access': '// 适用场景: 复用数据接入蓝图结果，将统一输出转换为组件可消费的数据',
        websocket: '// 适用场景: 收到服务端推送消息后，抽取消息体中的关键字段',
        mqtt: '// 适用场景: 收到 Topic 消息后，将设备上报内容归一化为组件属性结构',
        local: '// 适用场景: 读取本地文件或粘贴数据后，转换为组件最终绑定值'
    };
    const exampleLineMap = {
        http: '    return data?.result ?? data?.data ?? data;',
        'public-source': '    return data?.payload ?? data?.data ?? data?.result ?? data;',
        'data-access': '    return data?.source ?? data?.list ?? data?.rows ?? data;',
        websocket: '    return data?.payload ?? data?.data ?? data;',
        mqtt: '    return data?.payload ?? data?.message ?? data;',
        local: '    return Array.isArray(data) ? data : data?.list ?? data;'
    };

    return `// ${modeLabel} 完成回调数据转换\n// data: ${modeLabel} 返回的原始数据\n// 返回值: 转换后的数据，将赋值给绑定属性 ${propertyLabel}\n${sourceLineMap[mode] || sourceLineMap.http}\nfunction transform(data) {\n${exampleLineMap[mode] || exampleLineMap.http}\n}`;
};

const createTransformPresets = (mode = 'http', bindProperty = '') => {
    const propertyLabel = bindProperty || '目标属性';

    const presetsByMode = {
        http: [
            {
                key: 'http-raw',
                label: '原样返回',
                code: `// HTTP 完成回调数据转换\n// 返回接口原始数据到绑定属性 ${propertyLabel}\nfunction transform(data) {\n    return data;\n}`
            },
            {
                key: 'http-result',
                label: '提取 result/data',
                code: `// HTTP 完成回调数据转换\n// 优先提取常见业务字段 result 或 data\nfunction transform(data) {\n    return data?.result ?? data?.data ?? data;\n}`
            },
            {
                key: 'http-table',
                label: '表格列表',
                code: `// HTTP 完成回调数据转换\n// 适合表格、列表组件，将数组统一映射为 items\nfunction transform(data) {\n    const list = data?.list ?? data?.rows ?? data?.data ?? [];\n    return Array.isArray(list) ? list : [];\n}`
            }
        ],
        'public-source': [
            {
                key: 'public-source-raw',
                label: '原样返回',
                code: `// 公共接口完成回调数据转换\n// 返回公共接口原始结果到绑定属性 ${propertyLabel}\nfunction transform(data) {\n    return data;\n}`
            },
            {
                key: 'public-source-data',
                label: '提取 payload/data',
                code: `// 公共接口完成回调数据转换\n// 适合 HTTP / WebSocket 统一结果，优先提取 payload / data / result\nfunction transform(data) {\n    return data?.payload ?? data?.data ?? data?.result ?? data;\n}`
            },
            {
                key: 'public-source-list',
                label: '提取列表',
                code: `// 公共接口完成回调数据转换\n// 适合列表结构，优先提取 list / rows / source\nfunction transform(data) {\n    const list = data?.list ?? data?.rows ?? data?.source ?? data?.data ?? data;\n    return Array.isArray(list) ? list : [];\n}`
            }
        ],
        'data-access': [
            {
                key: 'data-access-raw',
                label: '原样返回',
                code: `// 数据接入完成回调数据转换\n// 返回蓝图执行后的原始结果到绑定属性 ${propertyLabel}\nfunction transform(data) {\n    return data;\n}`
            },
            {
                key: 'data-access-source',
                label: '提取 source/list',
                code: `// 数据接入完成回调数据转换\n// 适合列表类组件，优先提取 source / list / rows\nfunction transform(data) {\n    const list = data?.source ?? data?.list ?? data?.rows ?? data;\n    return Array.isArray(list) ? list : [];\n}`
            },
            {
                key: 'data-access-migration-line',
                label: '迁移线 lines',
                code: createMigrationLineTransformFn('数据接入')
            },
            {
                key: 'data-access-area-block',
                label: '区域块 areas',
                code: createAreaBlockTransformFn('数据接入')
            },
            {
                key: 'data-access-label3d',
                label: '3D 标签 labels',
                code: createLabel3DTransformFn('数据接入')
            },
            {
                key: 'data-access-point-markers',
                label: '点位 points',
                code: createPointTypeMarkerTransformFn('数据接入')
            }
        ],
        websocket: [
            {
                key: 'ws-payload',
                label: '提取 payload',
                code: `// WebSocket 完成回调数据转换\n// 适合服务端推送标准消息体 { type, payload }\nfunction transform(data) {\n    return data?.payload ?? data?.data ?? data;\n}`
            },
            {
                key: 'ws-status',
                label: '状态归一化',
                code: `// WebSocket 完成回调数据转换\n// 适合状态灯、设备状态卡片等场景\nfunction transform(data) {\n    return {\n        status: data?.status ?? data?.payload?.status ?? 'unknown',\n        value: data?.value ?? data?.payload?.value ?? null,\n        updatedAt: Date.now()\n    };\n}`
            },
            {
                key: 'ws-array',
                label: '推送列表',
                code: `// WebSocket 完成回调数据转换\n// 适合实时列表推送，保证返回数组\nfunction transform(data) {\n    const list = data?.payload?.list ?? data?.list ?? data;\n    return Array.isArray(list) ? list : [];\n}`
            }
        ],
        mqtt: [
            {
                key: 'mqtt-payload',
                label: '提取消息体',
                code: `// MQTT 完成回调数据转换\n// 适合 payload/message 结构的 Topic 消息\nfunction transform(data) {\n    return data?.payload ?? data?.message ?? data;\n}`
            },
            {
                key: 'mqtt-device',
                label: '设备指标',
                code: `// MQTT 完成回调数据转换\n// 适合设备上报温度、压力、电量等指标\nfunction transform(data) {\n    const payload = data?.payload ?? data;\n    return {\n        deviceId: payload?.deviceId ?? payload?.id ?? '',\n        metrics: payload?.metrics ?? payload?.data ?? payload,\n        updatedAt: payload?.timestamp ?? Date.now()\n    };\n}`
            },
            {
                key: 'mqtt-status',
                label: '布尔状态',
                code: `// MQTT 完成回调数据转换\n// 适合开关量、在线离线等布尔型状态\nfunction transform(data) {\n    const payload = data?.payload ?? data;\n    return Boolean(payload?.online ?? payload?.enabled ?? payload?.value);\n}`
            }
        ],
        local: [
            {
                key: 'local-raw',
                label: '原样返回',
                code: `// 本地数据完成回调转换\n// 直接返回导入或粘贴的原始数据\nfunction transform(data) {\n    return data;\n}`
            },
            {
                key: 'local-list',
                label: '提取 list',
                code: `// 本地数据完成回调转换\n// 适合 JSON 文件中包含 list 字段的结构\nfunction transform(data) {\n    return Array.isArray(data) ? data : data?.list ?? [];\n}`
            },
            {
                key: 'local-option',
                label: '选项映射',
                code: `// 本地数据完成回调转换\n// 适合下拉框、图例等需要 label/value 的组件\nfunction transform(data) {\n    const list = Array.isArray(data) ? data : data?.list ?? [];\n    return list.map((item) => ({\n        label: item?.label ?? item?.name ?? String(item?.value ?? item?.id ?? ''),\n        value: item?.value ?? item?.id ?? item\n    }));\n}`
            }
        ]
    };

    const presets = presetsByMode[mode] || presetsByMode.http;
    if (selectedComponent.value?.type !== 'TrafficRoadsideDeviceManager') {
        return presets;
    }

    return [
        {
            key: `${mode}-roadside-device-position`,
            label: '路侧设备位置',
            code: createRoadsideDevicePositionTransformFn(getSourceModeLabel(mode))
        },
        ...presets
    ];
};

const getModeTransformHint = (mode = 'http') => {
    if (mode === 'public-source') return '编写公共接口结果完成回调，将统一接口输出转换为组件属性需要的结构';
    if (mode === 'data-access') return '编写数据接入结果完成回调，将蓝图返回数据转换为三维组件可消费的结构';
    if (mode === 'websocket') return '编写 WebSocket 消息完成回调，将推送数据转换为组件属性需要的结构';
    if (mode === 'mqtt') return '编写 MQTT 消息完成回调，将订阅到的 Topic 数据转换为组件属性值';
    if (mode === 'local') return '编写本地数据完成回调，将导入内容转换为组件属性可直接使用的格式';
    return '编写 HTTP 请求完成回调，将接口返回结果转换为组件属性所需的数据格式';
};

const getModeBadge = (mode = 'http') => {
    if (mode === 'public-source') return '公共';
    if (mode === 'data-access') return '蓝图';
    if (mode === 'websocket') return '实时';
    if (mode === 'mqtt') return '订阅';
    if (mode === 'local') return '离线';
    return '请求';
};

const getModeFeatureTags = (mode = 'http') => {
    if (mode === 'public-source') return ['项目级', '统一复用', '配置收敛'];
    if (mode === 'data-access') return ['统一执行', '参数校验', '结构复用'];
    if (mode === 'websocket') return ['长连接', '消息推送', '自动重连'];
    if (mode === 'mqtt') return ['Topic 订阅', '设备接入', 'Broker'];
    if (mode === 'local') return ['本地文件', 'CSV/JSON', '离线调试'];
    return ['接口请求', '参数配置', '即时测试'];
};

const getSourceModeBadgeClass = (mode = 'http') => `source-mode-badge--${mode || 'http'}`;

const getExecuteActionLabel = (mode = 'http') => {
    if (mode === 'public-source') return '执行';
    if (mode === 'data-access') return '执行';
    if (mode === 'websocket') return '连接';
    if (mode === 'mqtt') return '订阅';
    if (mode === 'local') return '载入';
    return '请求';
};

const getExecuteActionTitle = (mode = 'http') => {
    if (mode === 'public-source') return '执行公共接口并更新组件';
    if (mode === 'data-access') return '执行数据接入并更新组件';
    if (mode === 'websocket') return '建立 WebSocket 连接并更新组件';
    if (mode === 'mqtt') return '连接 Broker 并订阅 Topic';
    if (mode === 'local') return '解析本地数据并更新组件';
    return '执行 HTTP 请求并更新组件';
};

const getDisconnectActionLabel = (mode = 'websocket') => {
    if (mode === 'mqtt') return '退订';
    return '断连';
};

const getDisconnectActionTitle = (mode = 'websocket') => {
    if (mode === 'mqtt') return '断开 MQTT 连接并停止订阅';
    return '断开 WebSocket 实时连接';
};

const getEditActionLabel = (mode = 'http') => {
    if (mode === 'public-source') return '引用';
    if (mode === 'data-access') return '配置';
    if (mode === 'local') return '内容';
    if (mode === 'websocket' || mode === 'mqtt') return '配置';
    return '编辑';
};

const getEditActionTitle = (mode = 'http') => {
    if (mode === 'public-source') return '编辑公共接口引用和绑定配置';
    if (mode === 'data-access') return '编辑数据接入绑定配置';
    if (mode === 'local') return '编辑本地数据内容和转换规则';
    if (mode === 'websocket') return '编辑 WebSocket 连接配置';
    if (mode === 'mqtt') return '编辑 MQTT 订阅配置';
    return '编辑 HTTP 数据源';
};

const getTestActionLabel = (mode = 'http') => {
    if (mode === 'public-source') return '测试';
    if (mode === 'data-access') return '校验';
    if (mode === 'local') return '预览';
    if (mode === 'websocket' || mode === 'mqtt') return '联调';
    return '测试';
};

const getTestActionTitle = (mode = 'http') => {
    if (mode === 'public-source') return '测试公共接口执行结果';
    if (mode === 'data-access') return '测试数据接入执行结果';
    if (mode === 'local') return '预览本地数据解析结果';
    if (mode === 'websocket') return '测试 WebSocket 连接并等待消息';
    if (mode === 'mqtt') return '测试 MQTT 连接并等待消息';
    return '测试 HTTP 数据源并查看响应';
};

const getActionButtonClass = (mode = 'http', action = 'edit') => {
    return `btn-icon--${action}-${mode || 'http'}`;
};

// English comment.
const showDataSourceModal = ref(false);
const editingSourceId = ref(null);

// English comment.
const dataSourceForm = reactive({
    name: '',
    mode: 'http',
    bindProperty: '',
    bindProperties: [''],
    publicSourceId: '',
    accessCode: '',
    accessName: '',
    url: '',
    method: 'GET',
    params: [],
    headers: [],
    bodyType: 'none',
    bodyParams: [],
    body: '',
    useGlobalUrl: true,
    timeout: 30,
    dataPath: '',
    socketProtocol: '',
    socketMessage: '',
    autoReconnect: true,
    reconnectPeriod: 3000,
    mqttTopic: '',
    mqttQos: '0',
    mqttClientId: '',
    mqttUsername: '',
    mqttPassword: '',
    localDataFormat: 'json',
    localFileName: '',
    localDataContent: '',
    transformFn: createDefaultTransformFn('http'),
    visualTransformConfig: null,
    previewSampleData: '',
    runOnLoad: false,
    startupDelaySeconds: 0,
    bindings: [{ type: 'property', value: '' }]
});

const LOCATION_SIMULATOR_TEST_WS_URL = 'ws://localhost:3000/api/ws/location-simulator?sessionId=loc_abc';
const LOCATION_SIMULATOR_START_MESSAGE = JSON.stringify({ type: 'start' });

const createLocationSimulatorTransformFn = () => `// 定位模拟 WebSocket 数据转换
// English comment.
// English comment.
function transform(data) {
    return Array.isArray(data) ? data : [];
}`;

const syncPrimaryBindProperty = () => {
    const properties = dataSourceForm.bindings
        .filter((b) => b.type === 'property' && b.value)
        .map((b) => b.value);
    dataSourceForm.bindProperty = properties[0] || '';
};

const ensurePreferredDataAccessBinding = () => {
    const guide = getCurrentComponentDataAccessGuide();
    if (!guide?.property && !guide?.method) return;

    const filledBindings = dataSourceForm.bindings.filter((item) => item.value);
    if (filledBindings.length > 0) {
        return;
    }

    dataSourceForm.bindings = guide.method
        ? [{ type: 'method', value: guide.method }]
        : [{ type: 'property', value: guide.property }];
    syncPrimaryBindProperty();
};

const ensureTrafficRoadsidePositionBinding = () => {
    if (selectedComponent.value?.type !== 'TrafficRoadsideDeviceManager') return;
    const hasFilledBinding = dataSourceForm.bindings.some((item) => item.value);
    if (hasFilledBinding) return;
    dataSourceForm.bindings = [{ type: 'method', value: 'updateData' }];
    syncPrimaryBindProperty();
};

const addBindingRow = () => {
    dataSourceForm.bindings.push({ type: 'property', value: '' });
};

const updateBindingType = (index, type) => {
    dataSourceForm.bindings[index].type = type;
    dataSourceForm.bindings[index].value = '';
};

const updateBindingValue = (index, value) => {
    dataSourceForm.bindings[index].value = String(value || '').trim();
    syncPrimaryBindProperty();
};

const removeBindingRow = (index) => {
    if (dataSourceForm.bindings.length <= 1) return;
    dataSourceForm.bindings.splice(index, 1);
    syncPrimaryBindProperty();
};

const getAvailableBindingOptions = (index) => {
    const currentBinding = dataSourceForm.bindings[index];
    const selectedValues = new Set(
        dataSourceForm.bindings
            .filter((b, i) => i !== index && b.type === currentBinding.type && b.value)
            .map((b) => b.value)
    );
    const sourceOptions = currentBinding.type === 'property'
        ? bindableProperties.value
        : methodBindingOptions.value;
    return sourceOptions.filter((opt) => !selectedValues.has(opt.value));
};

// English comment.
const openAddDataSourceModal = () => {
    editingSourceId.value = null;
    resetDataSourceForm();
    isSelectingSourceType.value = true;
    showDataSourceModal.value = true;
};

const selectDataSourceMode = (mode) => {
    dataSourceForm.mode = mode;
    if (mode === 'public-source' && !dataSourceForm.publicSourceId) {
        dataSourceForm.publicSourceId = dataSourceStore.publicDataSourceOptions[0]?.value || '';
    }
    if (mode === 'websocket') {
        dataSourceForm.dataPath = '';
        dataSourceForm.timeout = 30;
        dataSourceForm.socketProtocol = '';
        dataSourceForm.reconnectPeriod = 3000;
        dataSourceForm.runOnLoad = true;
    }
    if (mode === 'mqtt') {
        dataSourceForm.runOnLoad = true;
    }
    if (mode === 'data-access') {
        ensureDataAccessCatalog();
        ensurePreferredDataAccessBinding();
    }
    if (mode === 'websocket' || mode === 'mqtt' || mode === 'http' || mode === 'public-source' || mode === 'local') {
        ensureTrafficRoadsidePositionBinding();
    }
    syncPrimaryBindProperty();
    dataSourceForm.transformFn = createDefaultTransformFn(mode, dataSourceForm.bindProperty);
    isSelectingSourceType.value = false;
};

const applyLocationSimulatorTestData = () => {
    dataSourceForm.name = dataSourceForm.name || '定位模拟测试数据';
    dataSourceForm.useGlobalUrl = false;
    dataSourceForm.url = LOCATION_SIMULATOR_TEST_WS_URL;
    dataSourceForm.socketMessage = LOCATION_SIMULATOR_START_MESSAGE;
    dataSourceForm.autoReconnect = true;
    dataSourceForm.dataPath = '';
    dataSourceForm.socketProtocol = '';
    dataSourceForm.timeout = 30;
    dataSourceForm.reconnectPeriod = 3000;
    dataSourceForm.runOnLoad = true;
    ensureTrafficRoadsidePositionBinding();
    dataSourceForm.transformFn = createLocationSimulatorTransformFn();
    toast.success('已填入定位模拟 WebSocket 测试数据');
};

// English comment.
const editDataSource = (source) => {
    editingSourceId.value = source.id;
    isSelectingSourceType.value = false;
    dataSourceForm.name = source.name || '';
    dataSourceForm.mode = source.mode || 'http';
    dataSourceForm.bindProperty = source.bindProperty || '';
    const propBindings = getBindProperties(source).map((v) => ({ type: 'property', value: v }));
    const methodBindings = getMethodBindings(source).map((m) => ({ type: 'method', value: m.methodName }));
    dataSourceForm.bindings = [...propBindings, ...methodBindings];
    if (!dataSourceForm.bindings.length) {
        dataSourceForm.bindings = [{ type: 'property', value: '' }];
    }
    dataSourceForm.publicSourceId = source.publicSourceId || '';
    dataSourceForm.accessCode = source.accessCode || '';
    dataSourceForm.accessName = source.accessName || '';
    dataSourceForm.url = source.url || '';
    dataSourceForm.method = source.method || 'GET';
    dataSourceForm.params = source.params ? source.params.map((item) => normalizeParamRow(item)) : [];
    dataSourceForm.headers = source.headers ? [...source.headers] : [];
    dataSourceForm.bodyType = source.bodyType || 'none';
    dataSourceForm.bodyParams = source.bodyParams ? source.bodyParams.map((item) => normalizeParamRow(item)) : [];
    dataSourceForm.body = source.body || '';
    dataSourceForm.useGlobalUrl = source.useGlobalUrl !== false;
    dataSourceForm.timeout = source.timeout || 30;
    dataSourceForm.dataPath = source.dataPath || '';
    dataSourceForm.socketProtocol = source.socketProtocol || '';
    dataSourceForm.socketMessage = source.socketMessage || '';
    dataSourceForm.autoReconnect = source.autoReconnect !== false;
    dataSourceForm.reconnectPeriod = Number(source.reconnectPeriod || 3000);
    dataSourceForm.mqttTopic = source.mqttTopic || '';
    dataSourceForm.mqttQos = String(source.mqttQos ?? '0');
    dataSourceForm.mqttClientId = source.mqttClientId || '';
    dataSourceForm.mqttUsername = source.mqttUsername || '';
    dataSourceForm.mqttPassword = source.mqttPassword || '';
    dataSourceForm.localDataFormat = source.localDataFormat || 'json';
    dataSourceForm.localFileName = source.localFileName || '';
    dataSourceForm.localDataContent = source.localDataContent || '';
    dataSourceForm.transformFn = source.transformFn || createDefaultTransformFn(source.mode || 'http', source.bindProperty || '');
    dataSourceForm.visualTransformConfig = source.visualTransformConfig && typeof source.visualTransformConfig === 'object'
        ? normalizeVisualTransformConfig(source.visualTransformConfig)
        : null;
    dataSourceForm.previewSampleData = source.previewSampleData || '';
    dataSourceForm.runOnLoad = source.runOnLoad === true || source.mode === 'websocket' || source.mode === 'mqtt';
    dataSourceForm.startupDelaySeconds = Math.max(0, Number(source.startupDelaySeconds || 0));
    if (dataSourceForm.mode === 'data-access') {
        ensureDataAccessCatalog().then(() => {
            syncDataAccessSelection(dataSourceForm.accessCode, { initializeParams: false });
        });
    }
    syncPrimaryBindProperty();
    activeParamsTab.value = 'params';
    showDataSourceModal.value = true;
};

// English comment.
const closeDataSourceModal = () => {
    showDataSourceModal.value = false;
    editingSourceId.value = null;
    isSelectingSourceType.value = false;
    resetDataSourceForm();
};

// English comment.
const resetDataSourceForm = () => {
    dataSourceForm.name = '';
    dataSourceForm.mode = 'http';
    dataSourceForm.bindProperty = '';
    dataSourceForm.bindings = [{ type: 'property', value: '' }];
    dataSourceForm.publicSourceId = '';
    dataSourceForm.accessCode = '';
    dataSourceForm.accessName = '';
    dataSourceForm.url = '';
    dataSourceForm.method = 'GET';
    dataSourceForm.params = [];
    dataSourceForm.headers = [];
    dataSourceForm.bodyType = 'none';
    dataSourceForm.bodyParams = [];
    dataSourceForm.body = '';
    dataSourceForm.useGlobalUrl = true;
    dataSourceForm.timeout = 30;
    dataSourceForm.dataPath = '';
    dataSourceForm.socketProtocol = '';
    dataSourceForm.socketMessage = '';
    dataSourceForm.autoReconnect = true;
    dataSourceForm.reconnectPeriod = 3000;
    dataSourceForm.mqttTopic = '';
    dataSourceForm.mqttQos = '0';
    dataSourceForm.mqttClientId = '';
    dataSourceForm.mqttUsername = '';
    dataSourceForm.mqttPassword = '';
    dataSourceForm.localDataFormat = 'json';
    dataSourceForm.localFileName = '';
    dataSourceForm.localDataContent = '';
    dataSourceForm.transformFn = createDefaultTransformFn('http');
    dataSourceForm.visualTransformConfig = null;
    dataSourceForm.previewSampleData = '';
    dataSourceForm.runOnLoad = false;
    dataSourceForm.startupDelaySeconds = 0;
    dataSourceForm.bindings = [{ type: 'property', value: '' }];
    activeParamsTab.value = 'params';
};

const resetTransformTemplate = () => {
    syncPrimaryBindProperty();
    dataSourceForm.transformFn = createDefaultTransformFn(dataSourceForm.mode, dataSourceForm.bindProperty);
    toast.success('已重置为当前类型的回调模板');
};

const applyTransformPreset = (preset) => {
    if (!preset?.code) return;
    dataSourceForm.transformFn = preset.code;
    toast.success(`已应用模板: ${preset.label}`);
};

const getGlobalServiceUrl = (mode = 'http') => {
    if (mode === 'data-access') return '';
    return dataSourceStore.getServiceUrlByMode(mode);
};

const handleGlobalServiceUrlChange = (value) => {
    if (dataSourceForm.mode === 'data-access') {
        return;
    }
    dataSourceStore.setServiceUrlByMode(dataSourceForm.mode, value);
};

const getGlobalServiceLabel = (mode = 'http') => {
    if (mode === 'data-access') return '数据接入执行地址';
    if (mode === 'websocket') return 'WebSocket 全局服务地址';
    if (mode === 'mqtt') return 'MQTT 全局 Broker 地址';
    return 'HTTP 全局前置 URL';
};

const getModeDescription = (mode = 'http') => {
    if (mode === 'public-source') return '复用项目级公共接口定义，将统一连接配置绑定到当前组件';
    if (mode === 'data-access') return '复用数据接入蓝图，按 accessCode 执行并将结果绑定到三维组件';
    if (mode === 'websocket') return '持续监听服务端推送数据，适合实时状态同步';
    if (mode === 'mqtt') return '订阅 MQTT Topic，适合工业设备和消息总线场景';
    if (mode === 'local') return '导入本地文件或直接粘贴本地数据内容';
    return '通过 HTTP 接口主动获取数据';
};

function getSourceModeLabel(mode = 'http') {
    return modeOptions.find((item) => item.value === (mode || 'http'))?.label || 'HTTP 接口';
}

const getSourceSummary = (source) => {
    const mode = source?.mode || 'http';
    if (mode === 'public-source') {
        const publicSource = dataSourceStore.getPublicDataSourceById(source?.publicSourceId || '');
        if (!publicSource) {
            return '未选择公共接口';
        }
        if (publicSource.mode === 'data-access') {
            return `${publicSource?.accessCode || '-'} · ${publicSource?.name || '公共接口'}`;
        }
        if (publicSource.mode === 'websocket') {
            return publicSource.websocketUrl || publicSource.url || publicSource.name || '-';
        }
        return publicSource.url || publicSource.name || '-';
    }
    if (mode === 'data-access') {
        return `${source?.accessCode || '-'} · ${source?.accessName || '未选择数据接入'}`;
    }
    if (mode === 'mqtt') {
        return `${getDataSourceDisplayAddress(source, projectStore.apiBaseUrl, dataSourceStore.globalConfig)} · topic: ${source.mqttTopic || '-'}`;
    }

    return getDataSourceDisplayAddress(source, projectStore.apiBaseUrl, dataSourceStore.globalConfig) || source?.url || '-';
};

const getSourceRuntime = (source) => {
    return getDataSourceRuntimeState(selectedComponent.value?.id || '', source?.id || '');
};

const getRuntimeStatusLabel = (status = 'idle') => {
    const labelMap = {
        idle: '未连接',
        connecting: '连接中',
        connected: '已连接',
        reconnecting: '重连中',
        disconnected: '已断开',
        error: '异常'
    };
    return labelMap[status] || '未知';
};

const getRuntimeStatusClass = (status = 'idle') => {
    return `runtime-badge--${status}`;
};

const formatRuntimeUpdatedAt = (value) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('zh-CN', { hour12: false });
};

const disconnectDataSourceConnection = (source) => {
    if (!selectedComponent.value || !source?.id) return;

    disconnectDataSourceRuntime(selectedComponent.value.id, source.id);
    toast.success('实时连接已断开');
};

const validateDataSourceForm = () => {
    const bindProperties = dataSourceForm.bindings
        .filter((b) => b.type === 'property' && b.value)
        .map((b) => b.value);
    const methodNames = dataSourceForm.bindings
        .filter((b) => b.type === 'method' && b.value)
        .map((b) => b.value);
    dataSourceForm.bindProperty = bindProperties[0] || '';

    if (!bindProperties.length && !methodNames.length) {
        toast.error('请至少配置一个绑定属性或绑定方法');
        return false;
    }

    if (dataSourceForm.mode === 'local') {
        if (!String(dataSourceForm.localDataContent || '').trim()) {
            toast.error('请输入本地数据内容或先选择本地文件');
            return false;
        }
        return true;
    }

    if (dataSourceForm.mode === 'data-access') {
        if (!String(dataSourceForm.accessCode || '').trim()) {
            toast.error('请选择数据接入');
            return false;
        }
        return true;
    }

    if (dataSourceForm.mode === 'public-source') {
        if (!String(dataSourceForm.publicSourceId || '').trim()) {
            toast.error('请选择公共接口');
            return false;
        }
        return true;
    }

    if (dataSourceForm.mode === 'mqtt') {
        if (!dataSourceForm.url && !dataSourceForm.useGlobalUrl) {
            toast.error('请输入 MQTT Broker 地址');
            return false;
        }
        if (!dataSourceForm.mqttTopic) {
            toast.error('请输入 MQTT Topic');
            return false;
        }
        return true;
    }

    if (!dataSourceForm.url && !dataSourceForm.useGlobalUrl) {
        toast.error('请输入地址');
        return false;
    }

    if (dataSourceForm.mode === 'http') {
        const invalidLocalParam = (dataSourceForm.params || []).some((param) => {
            const key = String(param?.key || '').trim();
            if (!key) return false;
            if ((param?.valueSource || 'input') !== 'local') return false;
            return !String(param?.variableName || '').trim();
        });
        if (invalidLocalParam) {
            toast.error('HTTP 参数使用本地变量时，请选择变量名称');
            return false;
        }
        const invalidBodyParam = (dataSourceForm.bodyParams || []).some((param) => {
            const key = String(param?.key || '').trim();
            if (!key) return false;
            if (!['local', 'localStorage', 'cookie'].includes(param?.valueSource || 'input')) return false;
            return !String(param?.variableName || '').trim();
        });
        if (invalidBodyParam) {
            toast.error('HTTP 请求体参数使用变量时，请补全变量名称');
            return false;
        }
    }

    return true;
};

const normalizePreviewValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const resolveTemplateValue = (input = '', variableValues = {}) => {
    const text = String(input || '');
    if (!text.includes('{{')) return text;
    return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, variableName) => {
        return normalizePreviewValue(variableValues?.[variableName]);
    });
};

const getLocalStoragePreviewValue = (storageKey = '') => {
    const key = String(storageKey || '').trim();
    if (!key || typeof window === 'undefined' || !window.localStorage) return '';
    try {
        return window.localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
};

const getCookiePreviewValue = (cookieName = '') => {
    const key = String(cookieName || '').trim();
    if (!key || typeof document === 'undefined') return '';
    const entries = String(document.cookie || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean);
    const matched = entries.find((item) => item.startsWith(`${key}=`));
    if (!matched) return '';
    return decodeURIComponent(matched.slice(key.length + 1));
};

const resolveParamValue = (param = {}, variableValues = {}) => {
    const valueSource = param?.valueSource || 'input';
    if (valueSource === 'local') {
        const variableName = String(param?.variableName || '').trim();
        return normalizePreviewValue(variableValues?.[variableName]);
    }
    if (valueSource === 'localStorage') {
        return normalizePreviewValue(getLocalStoragePreviewValue(param?.variableName));
    }
    if (valueSource === 'cookie') {
        return normalizePreviewValue(getCookiePreviewValue(param?.variableName));
    }
    return resolveTemplateValue(param?.value ?? '', variableValues);
};

const stringifyHttpBodyPreview = (source, variableValues = {}) => {
    const bodyType = String(source?.bodyType || 'none').trim() || 'none';
    if (bodyType === 'none') return '';
    if (bodyType === 'json' || bodyType === 'xml') {
        return resolveTemplateValue(source?.body || '', variableValues);
    }

    const bodyParams = (source?.bodyParams || [])
        .filter((item) => String(item?.key || '').trim())
        .map((item) => ({
            key: item.key,
            value: resolveParamValue(item, variableValues),
            valueSource: item?.valueSource || 'input',
            variableName: item?.variableName || ''
        }));

    if (bodyType === 'form-data') {
        return stringifyPreview(bodyParams);
    }

    const searchParams = new URLSearchParams();
    bodyParams.forEach((item) => {
        searchParams.append(item.key, item.value ?? '');
    });
    return searchParams.toString();
};

const stringifyPreview = (value) => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value ?? '');
    }
};

const runTransformPreview = (source, rawData) => {
    return applyDataSourceTransform(source, rawData, { returnErrorObject: true });
};

const transformRangeLabel = computed(() => {
    const config = visualTransformConfig.value;
    if (config.inputPath && config.arrayPath) return `范围：${config.inputPath}.${config.arrayPath}`;
    return `范围：${config.inputPath || '完整返回'}`;
});

const transformSummaryTitle = computed(() => {
    if (visualTransformEnabled.value) return '已启用可视化数据整理';
    if (dataSourceForm.transformFn && !dataSourceForm.transformFn.includes('return data')) return '使用兼容脚本转换';
    return '未启用数据整理';
});

const transformSummaryText = computed(() => {
    if (visualTransformEnabled.value) {
        return '通过预览数据选择范围、过滤、排序和字段匹配，不需要编写代码。';
    }
    return '当前保持旧项目兼容逻辑；建议进入配置数据整理，按预览字段完成无代码匹配。';
});

const dataTransformModalSource = computed(() => buildSourcePayload());

const currentRuntimePayload = computed(() => {
    if (!selectedComponent.value?.id || !editingSourceId.value) return null;
    return getSourceRuntime({ id: editingSourceId.value }).lastPayload ?? null;
});

const parsePreviewSample = (text = '') => {
    const content = String(text || '').trim();
    if (!content) return undefined;
    try {
        return JSON.parse(content);
    } catch {
        return content;
    }
};

const loadDataTransformPreview = async (source) => {
    const mode = source?.mode || dataSourceForm.mode || 'http';
    if (mode === 'websocket' || mode === 'mqtt') {
        const runtimePayload = currentRuntimePayload.value;
        if (runtimePayload !== null && runtimePayload !== undefined) {
            return { success: true, data: runtimePayload };
        }
        if (source?.previewSampleData) {
            return { success: true, data: parsePreviewSample(source.previewSampleData) };
        }
        return {
            success: false,
            error: '暂无最近消息。请先执行联调等待一条消息，或在左侧粘贴样例消息。'
        };
    }

    const result = await fetchDataSource(source, projectStore.apiBaseUrl, selectedComponent.value?.id || '', null);
    if (!result?.success) {
        return { success: false, error: result?.error || '获取预览数据失败' };
    }
    return { success: true, data: result.data };
};

const openDataTransformModal = () => {
    if (!dataSourceForm.visualTransformConfig) {
        ensureVisualTransformConfig();
    }
    showDataTransformModal.value = true;
};

const handleDataTransformSave = ({ config, transformFn, previewSampleData, binding }) => {
    dataSourceForm.visualTransformConfig = normalizeVisualTransformConfig(config);
    dataSourceForm.transformFn = typeof transformFn === 'string' ? transformFn : dataSourceForm.transformFn;
    dataSourceForm.previewSampleData = previewSampleData || '';
    if (binding?.type && binding?.value) {
        dataSourceForm.bindings = [{
            type: binding.type,
            value: binding.value
        }];
        syncPrimaryBindProperty();
    }
};

const openRequestPreview = () => {
    if (!validateDataSourceForm()) return;

    const source = buildSourcePayload();
    const variableValues = Object.fromEntries((variableStore.variables || []).map((item) => [item.name, item.value]));
    const mode = source.mode || 'http';
    const params = (source.params || [])
        .filter((item) => String(item?.key || '').trim())
        .map((item) => ({
            key: item.key,
            value: resolveParamValue(item, variableValues),
            valueSource: item?.valueSource || 'input',
            variableName: item?.variableName || ''
        }));

    const headers = {
        ...(dataSourceStore.headersObject || {})
    };
    (source.headers || [])
        .filter((item) => String(item?.key || '').trim())
        .forEach((item) => {
            headers[item.key] = resolveTemplateValue(item.value ?? '', variableValues);
        });

    if (mode === 'http' && String(source.method || 'GET').toUpperCase() === 'POST') {
        if (!headers['Content-Type'] && !headers['content-type']) {
            if (source.bodyType === 'json') {
                headers['Content-Type'] = 'application/json;charset=UTF-8';
            } else if (source.bodyType === 'xml') {
                headers['Content-Type'] = 'application/xml;charset=UTF-8';
            } else if (source.bodyType === 'x-www-form-urlencoded') {
                headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
            }
        }
    }

    const query = new URLSearchParams();
    params.forEach((item) => {
        query.append(item.key, item.value ?? '');
    });
    const baseUrl = getDataSourceDisplayAddress(source, projectStore.apiBaseUrl, dataSourceStore.globalConfig) || '';
    const url = mode === 'data-access'
        ? ''
        : (
            query.toString()
                ? `${baseUrl}${String(baseUrl).includes('?') ? '&' : '?'}${query.toString()}`
                : baseUrl
        );

    const bodyText = mode === 'data-access'
        ? stringifyPreview({
            accessCode: source.accessCode || '',
            params: Object.fromEntries(params.map((item) => [item.key, item.value]))
        })
        : (mode === 'http' && String(source.method || 'GET').toUpperCase() === 'POST'
            ? stringifyHttpBodyPreview(source, variableValues)
            : '');

    requestPreview.value = {
        mode: getSourceModeLabel(mode),
        url,
        paramsText: stringifyPreview(params),
        headersText: stringifyPreview(mode === 'data-access' ? {} : headers),
        bodyText: bodyText || '(空)'
    };

    showRequestPreviewModal.value = true;
};

const previewCurrentDataSource = async () => {
    if (!validateDataSourceForm()) return;

    try {
        resultPreviewLoading.value = true;
        const source = buildSourcePayload();
        const result = await fetchDataSource(source, projectStore.apiBaseUrl, selectedComponent.value?.id || '', null);

        if (!result?.success) {
            toast.error(`执行预览失败: ${result?.error || '未知错误'}`);
            return;
        }

        const rawData = result?.data;
        const finalData = runTransformPreview(source, rawData);

        resultPreview.value = {
            mode: getSourceModeLabel(source.mode),
            sourceName: source.name || source.accessName || source.accessCode || '未命名数据源',
            rawText: stringifyPreview(rawData),
            finalText: stringifyPreview(finalData)
        };
        showResultPreviewModal.value = true;
    } catch (error) {
        console.error('[DataBindingEditor] preview source failed:', error);
        toast.error(`执行预览失败: ${error.message}`);
    } finally {
        resultPreviewLoading.value = false;
    }
};

const copyText = async (text) => {
    const content = String(text ?? '');
    try {
        await navigator.clipboard.writeText(content);
        return true;
    } catch {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = content;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch {
            return false;
        }
    }
};

const copyPreviewField = async (field) => {
    let text = '';
    if (field === 'url') text = requestPreview.value.url || '';
    if (field === 'params') text = requestPreview.value.paramsText || '';
    if (field === 'headers') text = requestPreview.value.headersText || '';
    if (field === 'body') text = requestPreview.value.bodyText || '';
    if (field === 'all') {
        text = [
            `模式: ${requestPreview.value.mode || ''}`,
            `URL: ${requestPreview.value.url || ''}`,
            `Params:\n${requestPreview.value.paramsText || ''}`,
            `Headers:\n${requestPreview.value.headersText || ''}`,
            `Body:\n${requestPreview.value.bodyText || ''}`
        ].join('\n\n');
    }

    const success = await copyText(text);
    if (success) {
        toast.success('已复制到剪贴板');
    } else {
        toast.error('复制失败，请手动复制');
    }
};

const buildSourcePayload = () => {
    const bindProperties = dataSourceForm.bindings
        .filter((b) => b.type === 'property' && b.value)
        .map((b) => b.value);
    const methodNames = dataSourceForm.bindings
        .filter((b) => b.type === 'method' && b.value)
        .map((b) => b.value);
    const methodBindings = methodNames.map((methodName) => ({
        enabled: true,
        methodName,
        passMode: 'finalValue'
    }));
    const isWebSocketSource = dataSourceForm.mode === 'websocket';
    const sourceData = {
        id: editingSourceId.value || `source_${Date.now()}`,
        name: dataSourceForm.name,
        mode: dataSourceForm.mode,
        bindProperty: bindProperties[0] || '',
        bindProperties,
        publicSourceId: dataSourceForm.publicSourceId,
        accessCode: dataSourceForm.accessCode,
        accessName: dataSourceForm.accessName,
        url: dataSourceForm.url,
        method: dataSourceForm.method,
        params: (dataSourceForm.params || []).map((item) => normalizeParamRow(item)),
        headers: [...dataSourceForm.headers],
        bodyType: dataSourceForm.bodyType,
        bodyParams: (dataSourceForm.bodyParams || []).map((item) => normalizeParamRow(item)),
        body: dataSourceForm.body,
        useGlobalUrl: dataSourceForm.useGlobalUrl,
        timeout: isWebSocketSource ? 30 : Number(dataSourceForm.timeout || 0),
        dataPath: isWebSocketSource ? '' : dataSourceForm.dataPath,
        socketProtocol: isWebSocketSource ? '' : dataSourceForm.socketProtocol,
        socketMessage: dataSourceForm.socketMessage,
        autoReconnect: dataSourceForm.autoReconnect,
        reconnectPeriod: isWebSocketSource ? 3000 : Number(dataSourceForm.reconnectPeriod || 3000),
        mqttTopic: dataSourceForm.mqttTopic,
        mqttQos: Number(dataSourceForm.mqttQos || 0),
        mqttClientId: dataSourceForm.mqttClientId,
        mqttUsername: dataSourceForm.mqttUsername,
        mqttPassword: dataSourceForm.mqttPassword,
        localDataFormat: dataSourceForm.localDataFormat,
        localFileName: dataSourceForm.localFileName,
        localDataContent: dataSourceForm.localDataContent,
        previewSampleData: dataSourceForm.previewSampleData,
        runOnLoad: dataSourceForm.runOnLoad === true,
        startupDelaySeconds: Math.max(0, Number(dataSourceForm.startupDelaySeconds || 0)),
        transformFn: dataSourceForm.transformFn,
        methodBindings,
        methodBinding: {
            enabled: methodBindings.length > 0,
            methodName: methodBindings[0]?.methodName || '',
            passMode: 'finalValue'
        }
    };

    if (dataSourceForm.visualTransformConfig && typeof dataSourceForm.visualTransformConfig === 'object') {
        sourceData.visualTransformConfig = normalizeVisualTransformConfig(dataSourceForm.visualTransformConfig);
    }

    return sourceData;
};

const handleLocalFileChange = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
        dataSourceForm.localFileName = file.name;
        dataSourceForm.localDataContent = await file.text();
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.txt')) {
            dataSourceForm.localDataFormat = 'text';
        } else if (lowerName.endsWith('.csv')) {
            dataSourceForm.localDataFormat = 'csv';
        } else if (lowerName.endsWith('.json')) {
            dataSourceForm.localDataFormat = 'json';
        }
        toast.success(`已加载本地文件: ${file.name}`);
    } catch (error) {
        toast.error(`读取本地文件失败: ${error.message}`);
    }
};

const normalizeParamRow = (item = {}) => {
    const allowedSources = new Set(['input', 'local', 'localStorage', 'cookie']);
    const valueSource = allowedSources.has(item?.valueSource) ? item.valueSource : 'input';
    return {
        key: item?.key || '',
        value: item?.value ?? '',
        valueSource,
        variableName: valueSource !== 'input'
            ? String(item?.variableName || '').trim()
            : ''
    };
};

// English comment.
const saveDataSource = () => {
    if (!selectedComponent.value) return;

    if (!validateDataSourceForm()) {
        return;
    }

    const sourceData = buildSourcePayload();

    if (editingSourceId.value) {
        // English comment.
        disconnectDataSourceRuntime(selectedComponent.value.id, editingSourceId.value);
        componentStore.updateDataSource(selectedComponent.value.id, editingSourceId.value, sourceData);
        applySinglePropertyBinding(sourceData.bindProperty, sourceData.id);
        toast.success('数据源已更新');
    } else {
        // English comment.
        componentStore.addDataSource(selectedComponent.value.id, sourceData);
        applySinglePropertyBinding(sourceData.bindProperty, sourceData.id);
        toast.success('数据源已添加');
    }

    closeDataSourceModal();
};

// English comment.

// English comment.
const addParam = (afterIndex) => {
    const newParam = { key: '', value: '', valueSource: 'input', variableName: '' };
    if (afterIndex < 0) {
        dataSourceForm.params.push(newParam);
    } else {
        dataSourceForm.params.splice(afterIndex + 1, 0, newParam);
    }
};

const addBodyParam = (afterIndex) => {
    const newParam = { key: '', value: '', valueSource: 'input', variableName: '' };
    if (afterIndex < 0) {
        dataSourceForm.bodyParams.push(newParam);
    } else {
        dataSourceForm.bodyParams.splice(afterIndex + 1, 0, newParam);
    }
};

const updateParamValueSource = (index, sourceType) => {
    const current = dataSourceForm.params[index] || { key: '', value: '', valueSource: 'input', variableName: '' };
    if (sourceType === 'local' || sourceType === 'localStorage' || sourceType === 'cookie') {
        dataSourceForm.params[index] = {
            ...current,
            valueSource: sourceType,
            variableName: current.variableName || '',
            value: ''
        };
        return;
    }

    dataSourceForm.params[index] = {
        ...current,
        valueSource: 'input',
        variableName: ''
    };
};

const updateParamVariableName = (index, variableName) => {
    const current = dataSourceForm.params[index] || { key: '', value: '', valueSource: 'local', variableName: '' };
    dataSourceForm.params[index] = {
        ...current,
        valueSource: current.valueSource || 'local',
        variableName: String(variableName || '').trim(),
        value: ''
    };
};

const updateBodyParamValueSource = (index, sourceType) => {
    const current = dataSourceForm.bodyParams[index] || { key: '', value: '', valueSource: 'input', variableName: '' };
    if (sourceType === 'local' || sourceType === 'localStorage' || sourceType === 'cookie') {
        dataSourceForm.bodyParams[index] = {
            ...current,
            valueSource: sourceType,
            variableName: current.variableName || '',
            value: ''
        };
        return;
    }

    dataSourceForm.bodyParams[index] = {
        ...current,
        valueSource: 'input',
        variableName: ''
    };
};

const updateBodyParamVariableName = (index, variableName) => {
    const current = dataSourceForm.bodyParams[index] || { key: '', value: '', valueSource: 'local', variableName: '' };
    dataSourceForm.bodyParams[index] = {
        ...current,
        valueSource: current.valueSource || 'local',
        variableName: String(variableName || '').trim(),
        value: ''
    };
};

// English comment.
const removeParam = (index) => {
    dataSourceForm.params.splice(index, 1);
};

const removeBodyParam = (index) => {
    dataSourceForm.bodyParams.splice(index, 1);
};

// English comment.
const ensureParamRow = () => {
    if (dataSourceForm.params.length === 0) {
        dataSourceForm.params.push({ key: '', value: '', valueSource: 'input', variableName: '' });
    }
};

const ensureBodyParamRow = () => {
    if (dataSourceForm.bodyParams.length === 0) {
        dataSourceForm.bodyParams.push({ key: '', value: '', valueSource: 'input', variableName: '' });
    }
};

// English comment.
const addHeader = (afterIndex) => {
    const newHeader = { key: '', value: '' };
    if (afterIndex < 0) {
        dataSourceForm.headers.push(newHeader);
    } else {
        dataSourceForm.headers.splice(afterIndex + 1, 0, newHeader);
    }
};

// English comment.
const removeHeader = (index) => {
    dataSourceForm.headers.splice(index, 1);
};

// English comment.
const ensureHeaderRow = () => {
    if (dataSourceForm.headers.length === 0) {
        dataSourceForm.headers.push({ key: '', value: '' });
    }
};

// English comment.
const getParamValidation = (param) => {
    const key = String(param?.key || '').trim();
    const valueSource = param?.valueSource || 'input';
    if (!key && !param?.value && !param?.variableName) return 'empty';
    if (!key) return 'incomplete';
    if (valueSource === 'local' || valueSource === 'localStorage' || valueSource === 'cookie') {
        return String(param?.variableName || '').trim() ? 'valid' : 'incomplete';
    }
    if (String(param?.value ?? '').trim()) return 'valid';
    return 'incomplete';
};

// English comment.
const getParamValidationText = (param) => {
    const valueSource = param?.valueSource || 'input';
    if (!param.key && !param.value && !param.variableName) return '-';
    if (valueSource === 'local') {
        return param.key && param.variableName ? '变量已绑定' : '不完整';
    }
    if (valueSource === 'localStorage') {
        return param.key && param.variableName ? 'localStorage 已绑定' : '不完整';
    }
    if (valueSource === 'cookie') {
        return param.key && param.variableName ? 'Cookie 已绑定' : '不完整';
    }
    if (param.key && param.value) return '格式通过';
    return '不完整';
};

// English comment.
const removeDataSourceConfirm = async (sourceId) => {
    const confirmed = await showConfirm('确定要删除这个数据源吗？', {
        title: '删除数据源',
        variant: 'danger',
        confirmText: '删除'
    });
    if (confirmed) {
        disconnectDataSourceRuntime(selectedComponent.value.id, sourceId);
        componentStore.removeDataSource(selectedComponent.value.id, sourceId);
        toast.success('数据源已删除');
    }
};

// English comment.
const getPropertyLabel = (property) => {
    if (!property) return '未绑定';
    // English comment.
    return property.replace('globalConfig.', '');
};

// English comment.
const testDataSource = async (source) => {
    try {
        toast.info('正在测试数据源...');
        const result = await fetchDataSource(source, projectStore.apiBaseUrl, selectedComponent.value?.id || '', null);

        if (!result.success) {
            toast.error(`测试失败: ${result.error}`);
            return;
        }

        if (result.data !== undefined && result.data !== null) {
            const finalData = runTransformPreview(source, result.data);
            console.log('[数据源测试] 响应:', result.data);
            console.log('[数据源测试] 转换后:', finalData);
            toast.success('测试成功，请查看控制台输出');
            return;
        }

        if (result.connected) {
            toast.success(`${getSourceModeLabel(source.mode)} 已连接，等待实时消息推送`);
            return;
        }

        toast.success('测试成功');
    } catch (error) {
        console.error('[数据源测试] 错误:', error);
        toast.error(`请求失败: ${error.message}`);
    }
};

// English comment.
const executeSingleDataSource = async (source) => {
    if (!selectedComponent.value) return;

    try {
        isExecuting.value = true;
        toast.info(`正在执行数据源: ${source.name || '未命名'}...`);

        const result = await executeDataBinding(
            selectedComponent.value.id,
            source.id,
            projectStore.apiBaseUrl
        );

        if (result.success) {
            toast.success(`数据源 "${source.name || '未命名'}" 执行成功，组件已更新`);
        } else {
            const errorMsg = result.results?.[0]?.error || '未知错误';
            toast.error(`数据源执行失败: ${errorMsg}`);
        }
    } catch (error) {
        console.error('[数据源执行] 错误:', error);
        toast.error(`执行失败: ${error.message}`);
    } finally {
        isExecuting.value = false;
    }
};

// English comment.
const executeAllDataSources = async () => {
    if (!selectedComponent.value) return;

    try {
        isExecuting.value = true;
        toast.info('正在执行所有数据源...');

        const result = await executeDataBinding(
            selectedComponent.value.id,
            null,
            projectStore.apiBaseUrl
        );

        if (result.success) {
            toast.success(`所有数据源执行成功，共 ${result.results.length} 个`);
        } else {
            const failedCount = result.results.filter(r => !r.success).length;
            toast.warning(`部分数据源执行失败: ${failedCount}/${result.results.length}`);
        }
    } catch (error) {
        console.error('[数据源执行] 错误:', error);
        toast.error(`执行失败: ${error.message}`);
    } finally {
        isExecuting.value = false;
    }
};

// English comment.
watch(selectedComponent, (component) => {
    bindingEnabled.value = component?.dataBinding?.enabled || false;
}, { immediate: true });

watch(bindingEnabled, (enabled) => {
    if (!selectedComponent.value) return;

    const currentBinding = selectedComponent.value.dataBinding || { sources: [] };
    componentStore.updateDataBinding(selectedComponent.value.id, {
        ...currentBinding,
        enabled,
        sources: currentBinding.sources || []
    });
});

watch(() => dataSourceForm.mode, (mode) => {
    if (mode === 'public-source' && !dataSourceForm.publicSourceId) {
        dataSourceForm.publicSourceId = dataSourceStore.publicDataSourceOptions[0]?.value || '';
    }
    if (mode === 'data-access') {
        ensureDataAccessCatalog();
    }
});

watch(() => dataSourceForm.accessCode, (accessCode, previous) => {
    if (String(accessCode || '').trim() === String(previous || '').trim()) return;
    syncDataAccessSelection(accessCode, { initializeParams: false });
});

watch(showDataStructureModal, (visible) => {
    if (!visible) return;
    refreshCurrentListDataPreview();
});

watch(
    () => selectedComponent.value?.id,
    () => {
        if (!showDataStructureModal.value) return;
        refreshCurrentListDataPreview();
    }
);
</script>

<style scoped>
.data-binding-editor {
    padding: 0.625rem 0.75rem 0.75rem;
    height: 100%;
    overflow-y: auto;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 180px;
    padding: 1.5rem 0.75rem;
    text-align: center;
    border: 1px dashed rgba(148, 163, 184, 0.18);
    border-radius: var(--border-radius-md);
    background: rgba(15, 23, 42, 0.32);
}

.empty-state--panel {
    min-height: 240px;
}

.empty-state__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--border-radius-md);
    color: var(--color-primary);
    background-color: rgba(var(--color-primary-rgb, 47, 125, 244), 0.12);
    border: 1px solid rgba(var(--color-primary-rgb, 47, 125, 244), 0.24);
    font-size: 0.625rem;
    font-weight: 800;
    letter-spacing: 0;
}

.empty-state__title {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 700;
}

.empty-state__desc {
    max-width: 190px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
}

.binding-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.component-summary {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    background: linear-gradient(180deg, rgba(18, 27, 42, 0.88), rgba(13, 20, 32, 0.72));
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: var(--border-radius-md);
}

.component-summary__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.component-summary__eyebrow {
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
    font-weight: 600;
}

.component-summary__name {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.component-summary__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 0.5rem;
    color: var(--color-text-secondary);
    font-size: 0.6875rem;
}

.component-summary__meta span + span::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 3px;
    margin: 0 0.5rem 0.125rem 0;
    border-radius: 50%;
    background-color: var(--color-text-muted);
}

.binding-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    height: 1.375rem;
    padding: 0 0.5rem;
    border-radius: var(--border-radius-full);
    font-size: 0.6875rem;
    font-weight: 700;
    border: 1px solid transparent;
}

.binding-status--off {
    color: var(--color-text-secondary);
    background-color: rgba(148, 163, 184, 0.1);
    border-color: rgba(148, 163, 184, 0.18);
}

.binding-status--empty {
    color: #fde68a;
    background-color: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.3);
}

.binding-status--active {
    color: #bfdbfe;
    background-color: rgba(47, 125, 244, 0.14);
    border-color: rgba(47, 125, 244, 0.32);
}

.data-access-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem;
    background-color: rgba(18, 27, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius-md);
}

.switch-row {
    position: relative;
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    cursor: pointer;
}

.switch-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

.switch-track {
    position: relative;
    width: 2rem;
    height: 1.125rem;
    border-radius: var(--border-radius-full);
    background-color: rgba(148, 163, 184, 0.18);
    border: 1px solid rgba(148, 163, 184, 0.22);
    transition: all var(--transition-fast);
}

.switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background-color: var(--color-text-secondary);
    transition: all var(--transition-fast);
}

.switch-input:checked + .switch-track {
    background-color: rgba(47, 125, 244, 0.72);
    border-color: rgba(76, 145, 255, 0.7);
}

.switch-input:checked + .switch-track .switch-thumb {
    transform: translateX(0.875rem);
    background-color: #fff;
}

.switch-input:focus-visible + .switch-track {
    box-shadow: 0 0 0 2px rgba(47, 125, 244, 0.3);
}

.switch-copy {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
}

.switch-title {
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
}

.switch-desc {
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.structure-button {
    flex-shrink: 0;
    padding-inline: 0.625rem;
}

.data-access-disabled {
    padding: 0.875rem;
    border: 1px dashed rgba(148, 163, 184, 0.16);
    border-radius: var(--border-radius-md);
    background-color: rgba(15, 23, 42, 0.28);
}

.data-access-disabled__title {
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 700;
}

.data-access-disabled__desc {
    margin-top: 0.25rem;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
}

.form-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.binding-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
}

.binding-row--unified {
    grid-template-columns: 72px minmax(0, 1fr) auto;
}

.binding-type-select {
    width: 72px;
    flex-shrink: 0;
}

.binding-value-select {
    flex: 1;
    min-width: 0;
}

.btn-inline-remove {
    height: 1.75rem;
    padding: 0 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
}

.btn-inline-remove:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.form-hint {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
}

.form-hint--compact {
    margin-bottom: 0.5rem;
}

.link-button {
    margin-left: 0.5rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-size: inherit;
    cursor: pointer;
}

.link-button:hover {
    text-decoration: underline;
}

.request-preview-json--lg {
    min-height: 220px;
}

.code-textarea {
    width: 100%;
    min-height: 80px;
    padding: 0.5rem;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-primary);
    resize: vertical;
}

.code-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.lowcode-advanced-box {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: var(--color-bg-tertiary);
}

.lowcode-advanced-box__hint {
    margin-bottom: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: 1.5;
}

.lowcode-advanced-box summary {
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.lowcode-advanced-box .code-textarea {
    margin-top: var(--space-2);
}

.visual-transform-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background: linear-gradient(180deg, rgba(20, 184, 166, 0.08), rgba(15, 23, 42, 0.42));
    border: 1px solid rgba(45, 212, 191, 0.22);
    border-radius: var(--border-radius-sm);
}

.visual-transform-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.visual-transform-toggle {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: 600;
}

.visual-transform-content {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
}

.visual-transform-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.visual-field-hints {
    padding: 0.5rem 0.625rem;
    font-size: 0.6875rem;
    line-height: 1.5;
    color: #99f6e4;
    background-color: rgba(13, 148, 136, 0.12);
    border: 1px solid rgba(45, 212, 191, 0.18);
    border-radius: var(--border-radius-sm);
}

.visual-template-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem;
    background-color: rgba(15, 23, 42, 0.34);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--border-radius-sm);
}

.visual-template-meta {
    font-size: 0.6875rem;
    color: #99f6e4;
}

.visual-template-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
}

.visual-template-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-height: 86px;
    padding: 0.625rem;
    text-align: left;
    color: var(--color-text-secondary);
    background-color: rgba(2, 6, 23, 0.36);
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.visual-template-card:hover,
.visual-template-card.active {
    color: var(--color-text-primary);
    border-color: rgba(45, 212, 191, 0.55);
    background-color: rgba(20, 184, 166, 0.12);
}

.visual-template-card__title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
}

.visual-template-card__desc,
.visual-template-card__hint {
    font-size: 0.6875rem;
    line-height: 1.45;
}

.visual-template-card__hint {
    color: #5eead4;
    word-break: break-all;
}

.visual-template-sample {
    padding: 0.5rem;
    background-color: rgba(2, 6, 23, 0.34);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--border-radius-sm);
}

.visual-template-sample summary {
    cursor: pointer;
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
}

.visual-template-sample pre {
    margin: 0.5rem 0 0;
    max-height: 180px;
    overflow: auto;
    font-size: 0.6875rem;
    line-height: 1.5;
    color: var(--color-text-primary);
    white-space: pre-wrap;
}

.visual-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.visual-table {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.visual-table-row {
    display: grid;
    grid-template-columns: 1.1fr 1.1fr 0.8fr 0.9fr 32px;
    gap: 0.375rem;
    align-items: center;
}

.visual-table-row--filter {
    grid-template-columns: 1.2fr 1fr 1fr 32px;
}

.visual-table-row--head {
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
}

.visual-empty-row {
    padding: 0.625rem;
    font-size: 0.75rem;
    text-align: center;
    color: var(--color-text-tertiary);
    background-color: rgba(15, 23, 42, 0.38);
    border: 1px dashed rgba(148, 163, 184, 0.24);
    border-radius: var(--border-radius-sm);
}

.visual-transform-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.25rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    color: #5eead4;
    background-color: rgba(20, 184, 166, 0.14);
    border: 1px solid rgba(45, 212, 191, 0.34);
    font-size: 0.625rem;
    font-weight: 700;
}

.transform-summary-panel {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 0.875rem;
    padding: 0.875rem;
    background: rgba(15, 23, 42, 0.38);
    border: 1px solid rgba(45, 212, 191, 0.22);
    border-radius: var(--border-radius-sm);
}

.transform-summary-main {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.5rem;
}

.transform-summary-title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text-primary);
}

.transform-summary-desc {
    font-size: 0.6875rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
}

.transform-summary-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
}

.transform-summary-tags span {
    padding: 0.1875rem 0.5rem;
    color: #99f6e4;
    background: rgba(20, 184, 166, 0.1);
    border: 1px solid rgba(45, 212, 191, 0.22);
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 700;
}

.transform-summary-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.body-disabled {
    padding: 0.75rem;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

/* English comment. */
.data-sources-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    padding-bottom: 0.625rem;
    border-bottom: 1px solid var(--color-border);
}

.section-heading {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
}

.section-title {
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 700;
}

.section-subtitle {
    color: var(--color-text-tertiary);
    font-size: 0.6875rem;
    line-height: 1.35;
}

.section-actions {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: 0.375rem;
    flex-shrink: 0;
}

.empty-sources {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.25rem 0.75rem;
    text-align: center;
    border: 1px dashed rgba(148, 163, 184, 0.2);
    border-radius: var(--border-radius-md);
    background: rgba(15, 23, 42, 0.3);
}

.empty-sources__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--border-radius-md);
    color: var(--color-primary);
    background-color: rgba(47, 125, 244, 0.12);
    border: 1px solid rgba(47, 125, 244, 0.28);
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1;
}

.empty-sources__title {
    color: var(--color-text-primary);
    font-size: 0.8125rem;
    font-weight: 700;
}

.empty-sources__desc {
    max-width: 210px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
}

.sources-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.source-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem;
    background: rgba(18, 27, 42, 0.58);
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: var(--border-radius-md);
    transition: all var(--transition-fast);
}

.source-item:hover {
    border-color: rgba(47, 125, 244, 0.42);
    background-color: rgba(24, 35, 56, 0.72);
}

.source-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
}

.source-main {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
}

.source-title-line {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
}

.source-name {
    min-width: 0;
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
}

.source-property {
    font-size: 0.6875rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.source-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.375rem;
}

.btn-icon {
    width: 100%;
    min-width: 0;
    height: 1.625rem;
    padding: 0 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: 700;
    background-color: rgba(15, 23, 42, 0.34);
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.btn-icon:hover {
    background-color: var(--color-bg-hover);
    border-color: rgba(47, 125, 244, 0.45);
    color: var(--color-text-primary);
}

.btn-icon--execute {
    color: var(--color-text-secondary);
}

.btn-icon.btn-danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
}

.btn-icon--execute:hover {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: #22c55e;
}

.source-details {
    font-size: 0.6875rem;
    color: rgba(226, 232, 240, 0.82);
    padding-top: 0.5rem;
    border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.source-detail-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
}

.source-detail-line--meta {
    margin-top: 0.25rem;
}

.runtime-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 52px;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
    border: 1px solid var(--color-border);
}

.runtime-badge--idle,
.runtime-badge--disconnected {
    color: #cbd5e1;
    background-color: rgba(148, 163, 184, 0.12);
    border-color: rgba(203, 213, 225, 0.28);
}

.runtime-badge--connecting,
.runtime-badge--reconnecting {
    color: #fde68a;
    background-color: rgba(245, 158, 11, 0.16);
    border-color: rgba(245, 158, 11, 0.42);
}

.runtime-badge--connected {
    color: #86efac;
    background-color: rgba(34, 197, 94, 0.16);
    border-color: rgba(34, 197, 94, 0.42);
}

.runtime-badge--error {
    color: #fca5a5;
    background-color: rgba(239, 68, 68, 0.16);
    border-color: rgba(239, 68, 68, 0.42);
}
.source-mode-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 68px;
    height: 1.35rem;
    padding: 0 0.5rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 700;
    border: 1px solid transparent;
}

.source-mode-badge--http {
    color: #67e8f9;
    background-color: rgba(6, 182, 212, 0.14);
    border-color: rgba(6, 182, 212, 0.38);
}

.source-mode-badge--data-access {
    color: #93c5fd;
    background-color: rgba(59, 130, 246, 0.14);
    border-color: rgba(59, 130, 246, 0.38);
}

.source-mode-badge--public-source {
    color: #6ee7b7;
    background-color: rgba(16, 185, 129, 0.14);
    border-color: rgba(16, 185, 129, 0.38);
}

.source-mode-badge--websocket {
    color: #fdba74;
    background-color: rgba(249, 115, 22, 0.16);
    border-color: rgba(249, 115, 22, 0.42);
}

.source-mode-badge--mqtt {
    color: #86efac;
    background-color: rgba(34, 197, 94, 0.14);
    border-color: rgba(34, 197, 94, 0.38);
}

.source-mode-badge--local {
    color: #d8b4fe;
    background-color: rgba(168, 85, 247, 0.14);
    border-color: rgba(168, 85, 247, 0.38);
}

.source-preview {
    margin-top: 0.375rem;
    padding: 0.375rem 0.5rem;
    font-size: 0.6875rem;
    line-height: 1.4;
    color: var(--color-text-primary);
    background-color: var(--color-bg-tertiary);
    border-radius: var(--border-radius-sm);
    word-break: break-all;
}

.source-error {
    margin-top: 0.375rem;
    font-size: 0.6875rem;
    color: var(--color-danger, #ef4444);
}

.detail-item--address {
    color: #dbeafe;
    word-break: break-all;
}

.source-type-selector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.btn-icon--execute {
    color: var(--color-text-secondary);
}

.btn-icon--execute-http,
.btn-icon--test-http,
.btn-icon--edit-http {
    color: #a5f3fc;
    border-color: rgba(6, 182, 212, 0.28);
    background-color: rgba(6, 182, 212, 0.08);
}

.btn-icon--execute-data-access,
.btn-icon--test-data-access,
.btn-icon--edit-data-access {
    color: #bfdbfe;
    border-color: rgba(59, 130, 246, 0.28);
    background-color: rgba(59, 130, 246, 0.08);
}

.btn-icon--execute-websocket,
.btn-icon--test-websocket,
.btn-icon--disconnect-websocket,
.btn-icon--edit-websocket {
    color: #fed7aa;
    border-color: rgba(249, 115, 22, 0.28);
    background-color: rgba(249, 115, 22, 0.08);
}

.btn-icon--execute-mqtt,
.btn-icon--test-mqtt,
.btn-icon--disconnect-mqtt,
.btn-icon--edit-mqtt {
    color: #bbf7d0;
    border-color: rgba(34, 197, 94, 0.28);
    background-color: rgba(34, 197, 94, 0.08);
}

.btn-icon--execute-local,
.btn-icon--test-local,
.btn-icon--edit-local {
    color: #e9d5ff;
    border-color: rgba(168, 85, 247, 0.28);
    background-color: rgba(168, 85, 247, 0.08);
}

.btn-icon--execute:hover {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: #22c55e;
}

.btn-icon--execute-http:hover,
.btn-icon--test-http:hover,
.btn-icon--edit-http:hover {
    background-color: rgba(6, 182, 212, 0.14);
    border-color: rgba(6, 182, 212, 0.45);
}

.btn-icon--execute-data-access:hover,
.btn-icon--test-data-access:hover,
.btn-icon--edit-data-access:hover {
    background-color: rgba(59, 130, 246, 0.14);
    border-color: rgba(59, 130, 246, 0.45);
}

.btn-icon--execute-websocket:hover,
.btn-icon--test-websocket:hover,
.btn-icon--disconnect-websocket:hover,
.btn-icon--edit-websocket:hover {
    background-color: rgba(249, 115, 22, 0.14);
    border-color: rgba(249, 115, 22, 0.45);
}

.btn-icon--execute-mqtt:hover,
.btn-icon--test-mqtt:hover,
.btn-icon--disconnect-mqtt:hover,
.btn-icon--edit-mqtt:hover {
    background-color: rgba(34, 197, 94, 0.14);
    border-color: rgba(34, 197, 94, 0.45);
}

.btn-icon--execute-local:hover,
.btn-icon--test-local:hover,
.btn-icon--edit-local:hover {
    background-color: rgba(168, 85, 247, 0.14);
    border-color: rgba(168, 85, 247, 0.45);
}
.type-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
    padding: 0.875rem 1rem;
    text-align: left;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.type-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
}

.type-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.type-card__title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.type-card__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.type-card__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.25rem;
    padding: 0 0.5rem;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-primary);
    background-color: rgba(var(--color-primary-rgb), 0.12);
    border: 1px solid rgba(var(--color-primary-rgb), 0.25);
}

.type-card__action {
    font-size: 0.75rem;
    color: var(--color-primary);
}

.type-card__desc,
.type-card__meta {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.type-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
}

.type-card__tag {
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    padding: 0 0.5rem;
    border-radius: 999px;
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
}

.type-card__meta {
    color: var(--color-text-primary);
}

.data-structure-modal {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.data-structure-header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.data-structure-table {
    max-height: 260px;
    overflow: auto;
}

.structure-json-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.structure-json {
    min-height: 220px;
}

.request-preview {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.request-preview-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.request-preview-key {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.request-preview-key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.request-preview-value {
    font-size: 0.75rem;
    color: var(--color-text-primary);
}

.request-preview-value--block {
    word-break: break-all;
}

.request-preview-json {
    min-height: 120px;
}

.detail-item {
    display: block;
}

/* English comment. */
.data-source-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.mode-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
}

.mode-grid--two {
    grid-template-columns: 1fr;
}

.form-field--full {
    grid-column: 1 / -1;
}

.checkbox-label--block {
    min-height: 32px;
    display: flex;
    align-items: center;
}

.native-file-input {
    width: 100%;
    height: 32px;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
}

.data-source-config {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.data-flow-guide {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.375rem;
    padding: 0.375rem;
    background: rgba(15, 23, 42, 0.34);
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: var(--border-radius-sm);
}

.data-flow-guide span {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 1.875rem;
    padding: 0 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: var(--border-radius-sm);
    white-space: nowrap;
}

.data-flow-guide span:nth-child(3) {
    color: #99f6e4;
    background: rgba(20, 184, 166, 0.1);
    border-color: rgba(45, 212, 191, 0.28);
}

.data-flow-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
    background-color: rgba(15, 23, 42, 0.28);
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: var(--border-radius-sm);
}

.data-flow-section--transform {
    background: linear-gradient(180deg, rgba(20, 184, 166, 0.08), rgba(15, 23, 42, 0.22));
    border-color: rgba(45, 212, 191, 0.24);
}

.data-flow-section__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.data-flow-section__title-wrap {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    min-width: 0;
}

.data-flow-section__step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.625rem;
    height: 1.625rem;
    flex: 0 0 auto;
    color: #0f172a;
    background: #99f6e4;
    border-radius: 999px;
    font-size: 0.6875rem;
    font-weight: 800;
}

.data-flow-section__title {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--color-text-primary);
}

.data-flow-section__desc {
    margin-top: 0.125rem;
    font-size: 0.6875rem;
    line-height: 1.45;
    color: var(--color-text-secondary);
}

.data-flow-section__badge {
    flex: 0 0 auto;
    padding: 0.1875rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 700;
    color: #99f6e4;
    background: rgba(20, 184, 166, 0.12);
    border: 1px solid rgba(45, 212, 191, 0.28);
    border-radius: 999px;
}

.mode-summary-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
}

.mode-summary-card__desc {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

/* English comment. */
.global-config-section {
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
}

.global-config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    user-select: none;
}

.global-config-meta {
    display: flex;
    align-items: center;
    min-width: 0;
}

.global-config-summary {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.global-config-toggle {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.global-config-content {
    padding: 0.75rem;
    border-top: 1px solid var(--color-border);
}

.config-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
}

.config-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.config-field.flex-1 {
    flex: 1;
}

.config-label {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
}

.config-hint {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
}

.timeout-field {
    min-width: 0;
}

.timeout-input {
    display: flex;
    gap: 0.25rem;
    align-items: center;
}

.timeout-unit {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
}

.divider-arrow {
    display: flex;
    justify-content: center;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    border-top: 1px solid var(--color-border);
}

.divider-arrow:hover {
    background-color: var(--color-bg-hover);
}

/* English comment. */
.address-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.address-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
}

.address-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.address-field.method-field {
    width: 100%;
}

.address-field.url-field {
    flex: 1;
}

.url-input-wrapper {
    display: flex;
    align-items: center;
    background-color: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
}

.url-prefix {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-tertiary);
    border-right: 1px solid var(--color-border);
    white-space: nowrap;
}

.url-input {
    flex: 1;
    border: none !important;
    border-radius: 0 !important;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
}

.transform-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
}

.startup-delay-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.75rem;
}

.transform-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0;
}

.transform-preset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.75rem;
    padding: 0 0.75rem;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.transform-preset:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    background-color: rgba(var(--color-primary-rgb), 0.08);
}

/* English comment. */
.params-section {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
}

.params-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    background-color: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
}

.params-tab {
    width: 100%;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: none;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
}

.params-tab:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-hover);
}

.params-tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    background-color: var(--color-bg-primary);
}

.params-content {
    background-color: var(--color-bg-primary);
}

.modal-footer-content--selector {
    justify-content: flex-end;
}

/* English comment. */
.params-table-wrapper {
    overflow-x: auto;
}

.params-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
}

.params-table th {
    padding: 0.5rem;
    text-align: left;
    font-weight: 600;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
}

.params-table td {
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--color-border);
}

.params-table tr:last-child td {
    border-bottom: none;
}

.row-number {
    color: var(--color-text-secondary);
    text-align: center;
}

.actions-cell {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
}

.param-value-cell {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr);
    gap: 0.375rem;
    align-items: center;
}

.btn-table-action {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: bold;
    background-color: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-table-action:hover:not(:disabled) {
    background-color: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.btn-table-action.btn-remove:hover:not(:disabled) {
    background-color: #ef4444;
    border-color: #ef4444;
}

.btn-table-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.result-cell {
    text-align: center;
}

.result-badge {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
    border-radius: var(--border-radius-sm);
}

.result-badge.valid {
    color: #22c55e;
    background-color: rgba(34, 197, 94, 0.1);
}

.result-badge.incomplete {
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.1);
}

.result-badge.empty {
    color: var(--color-text-secondary);
}

/* English comment. */
.body-section {
    padding: 0.75rem;
}

.body-type-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
}

.body-type-option {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
}

/* English comment. */
.global-config-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* Modal footer */
.modal-footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
}

.footer-info {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    min-width: 0;
}

.footer-tag {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.1875rem 0.625rem;
    color: #99f6e4;
    background-color: rgba(20, 184, 166, 0.12);
    border: 1px solid rgba(45, 212, 191, 0.28);
    border-radius: 999px;
    white-space: nowrap;
}

.footer-tag--muted {
    color: var(--color-text-secondary);
    background-color: rgba(148, 163, 184, 0.1);
    border-color: rgba(148, 163, 184, 0.22);
}

.footer-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.footer-actions .btn {
    min-width: 88px;
}

.transform-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.transform-hint {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
}

.transform-textarea {
    min-height: 120px;
}

@media (max-width: 720px) {
    .data-flow-guide {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .data-flow-section__header,
    .visual-transform-header,
    .transform-summary-panel,
    .modal-footer-content {
        align-items: stretch;
        flex-direction: column;
    }

    .visual-transform-grid,
    .visual-template-grid {
        grid-template-columns: 1fr;
    }

    .visual-table-row,
    .visual-table-row--filter {
        grid-template-columns: 1fr;
    }

    .visual-table-row--head {
        display: none;
    }

    .footer-actions {
        justify-content: stretch;
    }

    .footer-actions .btn {
        flex: 1 1 100%;
    }
}
</style>
