<template>
    <div class="property-editor">
        <!-- 未选中组件 -->
        <div v-if="!selectedComponent" class="empty-state">
            <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
            </div>
            <div class="empty-text">请选择一个组件以编辑属性</div>
        </div>

        <!-- 已选中组件 -->
        <div v-else class="property-content">
            <PropertyEditorHeader
                :selected-component="selectedComponent"
                :component-metadata="componentMetadata"
                :callable-component-id="callableComponentId"
                :is-camera-jump="isCameraJump"
                @update-name="updateComponentName"
                @copy-callable-id="copyCallableId"
                @preview-camera-jump="previewCameraJump"
            />

            <!-- 属性分组 -->
            <Accordion :items="accordionItems" :default-open="['transform', 'properties']">
                <template #transform>
                    <div class="common-transform-section">
                        <TransformEditor
                            :position="componentConfig.position || [0, 0, 0]"
                            :rotation="componentConfig.rotation || [0, 0, 0]"
                            :scale="componentConfig.scale || 1"
                            :disabled="isTransformLockedInEdit"
                            :variable-bindings="selectedComponent?.variableBindings || {}"
                            @update:position="updateConfig('position', $event)"
                            @update:rotation="updateConfig('rotation', $event)"
                            @update:scale="updateConfig('scale', $event)"
                            @open-variable-binding="openVariableBinding"
                        />
                        <div class="common-visibility-card">
                            <div class="common-visibility-header">
                                <div class="common-visibility-title">显示控制</div>
                                <div class="common-visibility-summary">{{ visibilityControlSummary }}</div>
                            </div>
                            <div class="common-visibility-compact-grid">
                                <div
                                    v-for="item in visibilityControlItems"
                                    :key="item.key"
                                    class="common-visibility-compact-item"
                                >
                                    <label class="common-visibility-switch">
                                        <span class="common-visibility-switch-label">{{ item.label }}</span>
                                        <input
                                            type="checkbox"
                                            :checked="item.checked"
                                            @change="updateVisibilityControl(item.key, $event.target.checked)"
                                        >
                                    </label>
                                    <div class="common-visibility-state-row">
                                        <span class="common-visibility-state" :class="{ active: item.checked }">
                                            {{ item.stateText }}
                                        </span>
                                        <button
                                            type="button"
                                            class="variable-bind-icon"
                                            :class="{ active: item.bound }"
                                            :title="`${item.label}变量绑定`"
                                            @click="openVariableBinding(item.key)"
                                        >
                                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                                <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" />
                                                <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <template #properties>
                    <PropertyEditorFields
                        :selected-component="selectedComponent"
                        :config-schema="configSchema"
                        :get-field-value="getFieldValue"
                        :format-json-value="formatJsonValue"
                        :is-camera-jump="isCameraJump"
                        :is-camera-tour="isCameraTour"
                        :is-label3d="isLabel3D"
                        :is-migration-line="isMigrationLine"
                        :is-multi-path-animation="isMultiPathAnimation"
                        :is-area-block="isAreaBlock"
                        :is-heatmap="isHeatmap"
                        :model-loader-component-options="modelLoaderComponentOptions"
                        :label3d-component-options="label3DComponentOptions"
                        :camera-jump-mesh-options="cameraJumpMeshOptions"
                        :camera-jump-label-options="cameraJumpLabelOptions"
                        :building-point-options="buildingPointOptions"
                        :heatmap-surface-mesh-options="heatmapSurfaceMeshOptions"
                        @update-config="updateConfig"
                        @update-vector3="updateVector3"
                        @update-vector2="updateVector2"
                        @update-range="updateRange"
                        @update-json-config="updateJsonConfig"
                        @update-heatmap-surface-component="updateHeatmapSurfaceComponent"
                        @open-asset-picker="openAssetPickerForField"
                        @open-editor="handlePropertyEditorAction"
                    />
                    <div v-if="lowcodeSummaryRows.length > 0" class="lowcode-summary-list">
                        <div v-for="row in lowcodeSummaryRows" :key="row.key" class="lowcode-summary-card">
                            <div class="lowcode-summary-card__header">
                                <div>
                                    <div class="lowcode-summary-card__title">{{ row.title }}</div>
                                    <div class="lowcode-summary-card__desc">{{ row.description }}</div>
                                </div>
                                <Button v-if="row.action" variant="outline" size="sm" @click="handlePropertyEditorAction(row.action)">
                                    {{ row.actionText || '配置' }}
                                </Button>
                            </div>
                            <div class="lowcode-summary-card__metrics">
                                <div v-for="metric in row.metrics" :key="metric.label" class="lowcode-summary-card__metric">
                                    <span>{{ metric.label }}</span>
                                    <strong>{{ metric.value }}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>

                <template v-if="advancedRawFields.length > 0" #advancedraw>
                    <div class="advanced-raw-list">
                        <div class="common-visibility-desc">以下字段用于兼容旧项目和批量维护，普通配置请优先使用专用面板。</div>
                        <details v-for="field in advancedRawFields" :key="field.key" class="advanced-raw-item">
                            <summary>{{ field.label || field.key }}</summary>
                            <textarea
                                class="advanced-raw-textarea"
                                :value="formatJsonValue(getFieldValue(field.key))"
                                :placeholder="field.placeholder"
                                rows="6"
                                @blur="updateJsonConfig(field.key, $event.target.value)"
                            ></textarea>
                            <div v-if="field.description" class="common-visibility-desc">{{ field.description }}</div>
                        </details>
                    </div>
                </template>

                <!-- ModelLoader 高级功能 -->
                <template v-if="isModelLoader" #modelloader>
                    <ModelLoaderEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isGeoJSONLoader" #geojsonloader>
                    <GeoJSONLoaderEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isModelLoader" #modelstructure>
                    <ModelLoaderStructureEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isModelLoader" #modelgovernance>
                    <ModelLoaderGovernanceEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <!-- TrafficRoadsideDeviceManager 设备管理 -->
                <template v-if="isTrafficRoadsideDeviceManager" #trafficdevices>
                    <TrafficRoadsideDeviceManagerEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isPointTypeMarkerManager" #pointtypemarker>
                    <PointTypeMarkerManagerEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isCameraPointManager" #camerapoints>
                    <CameraPointManagerEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <!-- TrajectoryMove 轨迹编辑 -->
                <template v-if="isTrajectoryMove" #trajectorymove>
                    <TrajectoryMoveEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <!-- ExplodedView 楼层爆炸图配置 -->
                <template v-if="isExplodedView" #explodedview>
                    <ExplodedViewEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isDeviceExplodedView" #deviceexplodedview>
                    <DeviceExplodedViewEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>

                <template v-if="isPostProcessing" #postprocessing>
                    <PostProcessingEditor
                        v-if="selectedComponent"
                        :component-id="selectedComponent.id"
                    />
                </template>
            </Accordion>
        </div>

        <!-- 资源选择器 -->
        <AssetPickerModal
            v-model="showAssetPicker"
            :category="assetPickerCategory"
            :current-value="pendingAssetCurrentValue"
            @select="handleAssetSelect"
        />

        <Modal
            v-model="showVariableBindingModal"
            :title="`${variableBindingTargetLabel}绑定`"
            width="420px"
        >
            <div class="variable-binding-modal">
                <div class="variable-binding-field">
                    <label>变量</label>
                    <Select
                        :model-value="variableBindingDraft"
                        :options="variableBindingOptions"
                        @update:model-value="variableBindingDraft = $event"
                    />
                </div>
                <div v-if="currentVariableBindingName" class="variable-binding-current">
                    当前绑定：{{ currentVariableBindingName }}
                </div>
            </div>
            <template #footer>
                <Button variant="outline" @click="showVariableBindingModal = false">取消</Button>
                <Button variant="outline" @click="variableBindingDraft = ''">清除绑定</Button>
                <Button variant="primary" @click="saveVariableBinding">保存</Button>
            </template>
        </Modal>

        <Modal
            v-model="showCameraViewsModal"
            title="编辑视角列表"
            width="820px"
        >
            <div class="camera-views-editor">
                <div class="camera-views-editor__actions">
                    <Button variant="outline" size="sm" @click="addEmptyCameraView">
                        新增视角
                    </Button>
                    <Button variant="outline" size="sm" @click="appendCurrentCameraView">
                        保存当前视角
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllDraftCollapsed(false)">
                        全部展开
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllDraftCollapsed(true)">
                        全部收起
                    </Button>
                </div>

                <div class="camera-views-editor__insert-row">
                    <Select
                        :model-value="selectedManagerViewId"
                        :options="managerViewOptions"
                        placeholder="从视角管理选择一条视角"
                        @update:model-value="selectedManagerViewId = $event"
                    />
                    <Button variant="outline" size="sm" @click="insertSelectedManagerView">
                        插入所选视角
                    </Button>
                </div>

                <div v-if="cameraViewsDraftList.length === 0" class="camera-views-editor__empty">
                    暂无视角，请使用“新增视角”或“保存当前视角”。
                </div>

                <div v-else class="camera-views-editor__list">
                    <div
                        v-for="(view, index) in cameraViewsDraftList"
                        :key="view.id || index"
                        class="camera-view-item"
                    >
                        <div class="camera-view-item__header">
                            <div class="camera-view-item__title">视角 {{ index + 1 }}</div>
                            <div class="camera-view-item__ops">
                                <Button variant="outline" size="sm" @click="toggleDraftCollapsed(index)">
                                    {{ isDraftCollapsed(index) ? '展开' : '收起' }}
                                </Button>
                                <Button variant="outline" size="sm" :disabled="index === 0" @click="moveDraftView(index, -1)">上移</Button>
                                <Button variant="outline" size="sm" :disabled="index === cameraViewsDraftList.length - 1" @click="moveDraftView(index, 1)">下移</Button>
                                <Button variant="danger" size="sm" @click="removeDraftView(index)">删除</Button>
                            </div>
                        </div>

                        <div v-show="!isDraftCollapsed(index)" class="camera-view-grid">
                            <div class="camera-view-field camera-view-field--full">
                                <label>名称</label>
                                <Input
                                    :model-value="view.name"
                                    placeholder="请输入视角名称"
                                    @update:model-value="updateDraftName(index, $event)"
                                />
                            </div>

                            <div class="camera-view-field camera-view-field--full">
                                <label>相机类型</label>
                                <Select
                                    :model-value="view.cameraType"
                                    :options="cameraTypeOptions"
                                    @update:model-value="updateDraftCameraType(index, $event)"
                                />
                            </div>

                            <div class="camera-view-field">
                                <label>位置 X</label>
                                <Input type="number" :model-value="view.position?.x ?? 0" @update:model-value="updateDraftVector(index, 'position', 'x', $event)" />
                            </div>
                            <div class="camera-view-field">
                                <label>位置 Y</label>
                                <Input type="number" :model-value="view.position?.y ?? 0" @update:model-value="updateDraftVector(index, 'position', 'y', $event)" />
                            </div>
                            <div class="camera-view-field">
                                <label>位置 Z</label>
                                <Input type="number" :model-value="view.position?.z ?? 0" @update:model-value="updateDraftVector(index, 'position', 'z', $event)" />
                            </div>

                            <div class="camera-view-field">
                                <label>目标 X</label>
                                <Input type="number" :model-value="view.target?.x ?? 0" @update:model-value="updateDraftVector(index, 'target', 'x', $event)" />
                            </div>
                            <div class="camera-view-field">
                                <label>目标 Y</label>
                                <Input type="number" :model-value="view.target?.y ?? 0" @update:model-value="updateDraftVector(index, 'target', 'y', $event)" />
                            </div>
                            <div class="camera-view-field">
                                <label>目标 Z</label>
                                <Input type="number" :model-value="view.target?.z ?? 0" @update:model-value="updateDraftVector(index, 'target', 'z', $event)" />
                            </div>

                            <div class="camera-view-field camera-view-field--full" v-if="view.cameraType === 'perspective'">
                                <label>FOV</label>
                                <Input type="number" :model-value="view.fov ?? 45" @update:model-value="updateDraftLens(index, 'fov', $event)" />
                            </div>
                            <div class="camera-view-field camera-view-field--full" v-else>
                                <label>Zoom</label>
                                <Input type="number" :model-value="view.zoom ?? 1" @update:model-value="updateDraftLens(index, 'zoom', $event)" />
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <template #footer>
                <Button variant="outline" @click="showCameraViewsModal = false">
                    取消
                </Button>
                <Button variant="primary" @click="saveCameraViewsDraft">
                    保存
                </Button>
            </template>
        </Modal>

        <Modal
            v-model="showLabel3DLabelsModal"
            title="编辑标签列表"
            width="920px"
        >
            <div class="camera-views-editor">
                <div class="camera-views-editor__actions">
                    <Button variant="outline" size="sm" @click="addEmptyLabel3DRow">
                        新增标签
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllLabel3DCollapsed(false)">
                        全部展开
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllLabel3DCollapsed(true)">
                        全部收起
                    </Button>
                    <Button variant="outline" size="sm" @click="stopLabel3DPicking">
                        退出拾取
                    </Button>
                </div>

                <div v-if="label3DDraftList.length === 0" class="camera-views-editor__empty">
                    暂无标签，请点击“新增标签”。
                </div>

                <div v-else class="camera-views-editor__list">
                    <div
                        v-for="(item, index) in label3DDraftList"
                        :key="item.id || index"
                        class="camera-view-item"
                    >
                        <div class="camera-view-item__header">
                            <div class="camera-view-item__title">标签 {{ index + 1 }}</div>
                            <div class="camera-view-item__ops">
                                <Button variant="outline" size="sm" @click="toggleLabel3DCollapsed(index)">
                                    {{ isLabel3DCollapsed(index) ? '展开' : '收起' }}
                                </Button>
                                <Button variant="outline" size="sm" :disabled="index === 0" @click="moveLabel3DRow(index, -1)">上移</Button>
                                <Button variant="outline" size="sm" :disabled="index === label3DDraftList.length - 1" @click="moveLabel3DRow(index, 1)">下移</Button>
                                <Button variant="danger" size="sm" @click="removeLabel3DRow(index)">删除</Button>
                            </div>
                        </div>

                        <div v-show="!isLabel3DCollapsed(index)" class="label3d-editor-body">
                            <div class="label3d-section">
                                <div class="label3d-section__title">基础</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>ID</label>
                                        <Input :model-value="item.id" @update:model-value="updateLabel3DField(index, 'id', $event)" />
                                    </div>
                                    <div class="camera-view-field ">
                                        <label>文字</label>
                                        <Input :model-value="item.label" @update:model-value="updateLabel3DField(index, 'label', $event)" />
                                    </div>
                                    <div class="camera-view-field  ">
                                        <label>渲染类型</label>
                                        <Select :model-value="item.config.renderMode" :options="label3DRenderModeOptions" @update:model-value="updateLabel3DConfig(index, 'renderMode', $event)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section">
                                <div class="label3d-section__title">样式</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>文字颜色</label>
                                        <ColorPicker :model-value="item.config.textColor" @update:model-value="updateLabel3DConfig(index, 'textColor', $event)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>背景颜色</label>
                                        <Input :model-value="item.config.backgroundColor" @update:model-value="updateLabel3DConfig(index, 'backgroundColor', $event)" placeholder="如 #000000 或 rgba(0,0,0,0.7)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section" v-if="item.config.renderMode === 'sprite'">
                                <div class="label3d-section__title">Sprite 参数</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field field-group-inline">
                                        <label>自适应尺寸</label>
                                        <input
                                            type="checkbox"
                                            class="checkbox"
                                            :checked="item.config.autoSize !== false"
                                            @change="updateLabel3DAutoSize(index, $event.target.checked)"
                                        />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>尺寸(size)</label>
                                        <Input type="number" :model-value="item.config.size" @update:model-value="updateLabel3DNumber(index, ['config', 'size'], $event, 1)" />
                                    </div>
                                    <div class="camera-view-field" v-if="item.config.autoSize === false">
                                        <label>宽度</label>
                                        <Input type="number" :model-value="item.config.width" @update:model-value="updateLabel3DNumber(index, ['config', 'width'], $event, 2)" />
                                    </div>
                                    <div class="camera-view-field" v-if="item.config.autoSize === false">
                                        <label>高度</label>
                                        <Input type="number" :model-value="item.config.height" @update:model-value="updateLabel3DNumber(index, ['config', 'height'], $event, 1)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>中心点 X</label>
                                        <Input type="number" :model-value="item.config.center?.x ?? 0.5" @update:model-value="updateLabel3DNumber(index, ['config', 'center', 'x'], $event, 0.5)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>中心点 Y</label>
                                        <Input type="number" :model-value="item.config.center?.y ?? 0" @update:model-value="updateLabel3DNumber(index, ['config', 'center', 'y'], $event, 0)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section" v-else>
                                <div class="label3d-section__title">Plane 参数</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>宽度</label>
                                        <Input type="number" :model-value="item.config.width" @update:model-value="updateLabel3DNumber(index, ['config', 'width'], $event, 2)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>高度</label>
                                        <Input type="number" :model-value="item.config.height" @update:model-value="updateLabel3DNumber(index, ['config', 'height'], $event, 1)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>尺寸(size)</label>
                                        <Input type="number" :model-value="item.config.size" @update:model-value="updateLabel3DNumber(index, ['config', 'size'], $event, 1)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section">
                                <div class="label3d-section__title">位置与坐标源</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>位置 X</label>
                                        <Input type="number" :model-value="item.position.x" @update:model-value="updateLabel3DNumber(index, ['position', 'x'], $event, 0)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>位置 Y</label>
                                        <Input type="number" :model-value="item.position.y" @update:model-value="updateLabel3DNumber(index, ['position', 'y'], $event, 0)" />
                                    </div>
                                    <div class="camera-view-field">
                                        <label>位置 Z</label>
                                        <Input type="number" :model-value="item.position.z" @update:model-value="updateLabel3DNumber(index, ['position', 'z'], $event, 0)" />
                                    </div>

                                    <div class="camera-view-field camera-view-field--full">
                                        <label>从点位管理获取坐标</label>
                                        <div class="camera-views-editor__insert-row">
                                            <Select
                                                :model-value="label3DPointSelection[item.id] || ''"
                                                :options="buildingPointOptions"
                                                placeholder="选择点位"
                                                @update:model-value="setLabel3DPointSelection(item.id, $event)"
                                            />
                                            <Button variant="outline" size="sm" @click="applyBuildingPointToLabel(index)">
                                                使用点位坐标
                                            </Button>
                                        </div>
                                    </div>

                                    <div class="camera-view-field camera-view-field--full">
                                        <label>场景拾取坐标</label>
                                        <Button variant="outline" size="sm" @click="startLabel3DPicking(item.id)">
                                            拾取当前位置
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <template #footer>
                <Button variant="outline" @click="showLabel3DLabelsModal = false">
                    取消
                </Button>
                <Button variant="primary" @click="saveLabel3DLabelsDraft">
                    保存
                </Button>
            </template>
        </Modal>

        <Modal
            v-model="showMultiPathModal"
            title="编辑多轨迹数据"
            width="980px"
        >
            <div class="camera-views-editor">
                <div class="camera-views-editor__actions">
                    <Button variant="outline" size="sm" @click="addEmptyMultiPathRow">新增路径</Button>
                    <Button variant="outline" size="sm" @click="setAllMultiPathCollapsed(false)">全部展开</Button>
                    <Button variant="outline" size="sm" @click="setAllMultiPathCollapsed(true)">全部收起</Button>
                    <Button variant="outline" size="sm" @click="stopMultiPathPicking">退出拾取</Button>
                </div>

                <div v-if="multiPathDraft.paths.length === 0" class="camera-views-editor__empty">
                    暂无路径，请点击“新增路径”。
                </div>

                <div v-else class="camera-views-editor__list">
                    <div
                        v-for="(path, pathIndex) in multiPathDraft.paths"
                        :key="path.id || pathIndex"
                        class="camera-view-item"
                    >
                        <div class="camera-view-item__header">
                            <div class="camera-view-item__title">路径 {{ pathIndex + 1 }}</div>
                            <div class="camera-view-item__ops">
                                <Button variant="outline" size="sm" @click="toggleMultiPathCollapsed(pathIndex)">{{ isMultiPathCollapsed(pathIndex) ? '展开' : '收起' }}</Button>
                                <Button variant="outline" size="sm" :disabled="pathIndex === 0" @click="moveMultiPathRow(pathIndex, -1)">上移</Button>
                                <Button variant="outline" size="sm" :disabled="pathIndex === multiPathDraft.paths.length - 1" @click="moveMultiPathRow(pathIndex, 1)">下移</Button>
                                <Button variant="danger" size="sm" @click="removeMultiPathRow(pathIndex)">删除</Button>
                            </div>
                        </div>

                        <div v-show="!isMultiPathCollapsed(pathIndex)" class="label3d-editor-body">
                            <div class="label3d-section">
                                <div class="label3d-section__title">基础</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>ID</label>
                                        <Input :model-value="path.id" @update:model-value="updateMultiPathRowId(pathIndex, $event)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section">
                                <div class="label3d-section__title">路径点位</div>
                                <div class="camera-views-editor__actions">
                                    <Button variant="outline" size="sm" @click="addMultiPathPoint(pathIndex)">新增点位</Button>
                                </div>

                                <div class="camera-views-editor__list">
                                    <div
                                        v-for="(point, pointIndex) in path.data"
                                        :key="`${path.id || pathIndex}-${pointIndex}`"
                                        class="camera-view-item"
                                    >
                                        <div class="camera-view-item__header">
                                            <div class="camera-view-item__title">点 {{ pointIndex + 1 }}</div>
                                            <div class="camera-view-item__ops">
                                                <Button variant="outline" size="sm" :disabled="pointIndex === 0" @click="moveMultiPathPoint(pathIndex, pointIndex, -1)">上移</Button>
                                                <Button variant="outline" size="sm" :disabled="pointIndex === path.data.length - 1" @click="moveMultiPathPoint(pathIndex, pointIndex, 1)">下移</Button>
                                                <Button variant="danger" size="sm" :disabled="path.data.length <= 2" @click="removeMultiPathPoint(pathIndex, pointIndex)">删除</Button>
                                            </div>
                                        </div>

                                        <div class="camera-view-grid camera-view-grid--compact">
                                            <div class="camera-view-field">
                                                <label>X</label>
                                                <Input type="number" :model-value="point[0]" @update:model-value="updateMultiPathPointAxis(pathIndex, pointIndex, 0, $event)" />
                                            </div>
                                            <div class="camera-view-field">
                                                <label>Y</label>
                                                <Input type="number" :model-value="point[1]" @update:model-value="updateMultiPathPointAxis(pathIndex, pointIndex, 1, $event)" />
                                            </div>
                                            <div class="camera-view-field">
                                                <label>Z</label>
                                                <Input type="number" :model-value="point[2]" @update:model-value="updateMultiPathPointAxis(pathIndex, pointIndex, 2, $event)" />
                                            </div>

                                            <div class="camera-view-field camera-view-field--full">
                                                <label>从点位管理获取坐标</label>
                                                <div class="camera-views-editor__insert-row">
                                                    <Select
                                                        :model-value="getMultiPathPointSelection(path.id, pointIndex)"
                                                        :options="buildingPointOptions"
                                                        placeholder="选择点位"
                                                        @update:model-value="setMultiPathPointSelection(path.id, pointIndex, $event)"
                                                    />
                                                    <Button variant="outline" size="sm" @click="applyBuildingPointToMultiPathPoint(pathIndex, pointIndex)">
                                                        使用点位坐标
                                                    </Button>
                                                </div>
                                            </div>

                                            <div class="camera-view-field camera-view-field--full">
                                                <label>场景拾取坐标</label>
                                                <Button variant="outline" size="sm" @click="startMultiPathPicking(pathIndex, pointIndex)">
                                                    拾取当前位置
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showMultiPathModal = false">取消</Button>
                <Button variant="primary" @click="saveMultiPathAnimationDraft">保存</Button>
            </template>
        </Modal>

        <Modal
            v-model="showMultiPathPickConfirm"
            title="确认拾取坐标"
            width="420px"
            @close="cancelMultiPathPickConfirm"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">已拾取到坐标，确认更新该路径点位坐标？</div>
                <div class="pick-xyz-display">
                    <Input :model-value="format4(multiPathPickXyz[0])" disabled />
                    <Input :model-value="format4(multiPathPickXyz[1])" disabled />
                    <Input :model-value="format4(multiPathPickXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelMultiPathPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmMultiPathPickConfirm">确认</Button>
            </template>
        </Modal>

        <Modal
            v-model="showMigrationLineModal"
            title="编辑线条列表"
            width="980px"
        >
            <div class="camera-views-editor">
                <div class="camera-views-editor__actions">
                    <Button variant="outline" size="sm" @click="addEmptyMigrationLineRow">
                        新增线条
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllMigrationLineCollapsed(false)">
                        全部展开
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllMigrationLineCollapsed(true)">
                        全部收起
                    </Button>
                    <Button variant="outline" size="sm" @click="stopMigrationLinePicking">
                        退出拾取
                    </Button>
                </div>

                <div v-if="migrationLineDraftList.length === 0" class="camera-views-editor__empty">
                    暂无线条，请点击“新增线条”。
                </div>

                <div v-else class="camera-views-editor__list">
                    <div
                        v-for="(line, lineIndex) in migrationLineDraftList"
                        :key="line.id || lineIndex"
                        class="camera-view-item"
                    >
                        <div class="camera-view-item__header">
                            <div class="camera-view-item__title">线条 {{ lineIndex + 1 }}</div>
                            <div class="camera-view-item__ops">
                                <Button variant="outline" size="sm" @click="toggleMigrationLineCollapsed(lineIndex)">
                                    {{ isMigrationLineCollapsed(lineIndex) ? '展开' : '收起' }}
                                </Button>
                                <Button variant="outline" size="sm" :disabled="lineIndex === 0" @click="moveMigrationLineRow(lineIndex, -1)">上移</Button>
                                <Button variant="outline" size="sm" :disabled="lineIndex === migrationLineDraftList.length - 1" @click="moveMigrationLineRow(lineIndex, 1)">下移</Button>
                                <Button variant="danger" size="sm" @click="removeMigrationLineRow(lineIndex)">删除</Button>
                            </div>
                        </div>

                        <div v-show="!isMigrationLineCollapsed(lineIndex)" class="label3d-editor-body">
                            <div class="label3d-section">
                                <div class="label3d-section__title">基础</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>ID</label>
                                        <Input :model-value="line.id" @update:model-value="updateMigrationLineField(lineIndex, 'id', $event)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section">
                                <div class="label3d-section__title">点位</div>
                                <div class="camera-views-editor__actions">
                                    <Button variant="outline" size="sm" @click="addMigrationLinePoint(lineIndex)">
                                        新增点位
                                    </Button>
                                </div>

                                <div class="camera-views-editor__list">
                                    <div
                                        v-for="(point, pointIndex) in line.points"
                                        :key="`${line.id || lineIndex}-${pointIndex}`"
                                        class="camera-view-item"
                                    >
                                        <div class="camera-view-item__header">
                                            <div class="camera-view-item__title">点 {{ pointIndex + 1 }}</div>
                                            <div class="camera-view-item__ops">
                                                <Button variant="outline" size="sm" :disabled="pointIndex === 0" @click="moveMigrationLinePoint(lineIndex, pointIndex, -1)">上移</Button>
                                                <Button variant="outline" size="sm" :disabled="pointIndex === line.points.length - 1" @click="moveMigrationLinePoint(lineIndex, pointIndex, 1)">下移</Button>
                                                <Button variant="danger" size="sm" :disabled="line.points.length <= 2" @click="removeMigrationLinePoint(lineIndex, pointIndex)">删除</Button>
                                            </div>
                                        </div>

                                        <div class="camera-view-grid camera-view-grid--compact">
                                            <div class="camera-view-field">
                                                <label>X</label>
                                                <Input type="number" :model-value="point.x" @update:model-value="updateMigrationLinePoint(lineIndex, pointIndex, 'x', $event)" />
                                            </div>
                                            <div class="camera-view-field">
                                                <label>Y</label>
                                                <Input type="number" :model-value="point.y" @update:model-value="updateMigrationLinePoint(lineIndex, pointIndex, 'y', $event)" />
                                            </div>
                                            <div class="camera-view-field">
                                                <label>Z</label>
                                                <Input type="number" :model-value="point.z" @update:model-value="updateMigrationLinePoint(lineIndex, pointIndex, 'z', $event)" />
                                            </div>

                                            <div class="camera-view-field camera-view-field--full">
                                                <label>从点位管理获取坐标</label>
                                                <div class="camera-views-editor__insert-row">
                                                    <Select
                                                        :model-value="getMigrationPointSelection(line.id, pointIndex)"
                                                        :options="buildingPointOptions"
                                                        placeholder="选择点位"
                                                        @update:model-value="setMigrationPointSelection(line.id, pointIndex, $event)"
                                                    />
                                                    <Button variant="outline" size="sm" @click="applyBuildingPointToMigrationPoint(lineIndex, pointIndex)">
                                                        使用点位坐标
                                                    </Button>
                                                </div>
                                            </div>

                                            <div class="camera-view-field camera-view-field--full">
                                                <label>场景拾取坐标</label>
                                                <Button variant="outline" size="sm" @click="startMigrationLinePicking(lineIndex, pointIndex)">
                                                    拾取当前位置
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showMigrationLineModal = false">
                    取消
                </Button>
                <Button variant="primary" @click="saveMigrationLineDraft">
                    保存
                </Button>
            </template>
        </Modal>

        <Modal
            v-model="showMigrationLinePickConfirm"
            title="确认拾取坐标"
            width="420px"
            @close="cancelMigrationLinePickConfirm"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">已拾取到坐标，确认更新该点位坐标？</div>
                <div class="pick-xyz-display">
                    <Input :model-value="format4(migrationLinePickXyz[0])" disabled />
                    <Input :model-value="format4(migrationLinePickXyz[1])" disabled />
                    <Input :model-value="format4(migrationLinePickXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelMigrationLinePickConfirm">取消</Button>
                <Button variant="primary" @click="confirmMigrationLinePickConfirm">确认</Button>
            </template>
        </Modal>

        <Modal
            v-model="showHeatmapModal"
            title="编辑热力图数据与映射"
            width="980px"
        >
            <div class="camera-views-editor">
                <div class="label3d-section">
                    <div class="label3d-section__title">热力点数据</div>
                    <div class="camera-views-editor__actions">
                        <Button variant="outline" size="sm" @click="addHeatmapPoint">新增热力点</Button>
                        <Button variant="outline" size="sm" @click="importHeatmapPointsFromBuildingManager">从点位管理导入</Button>
                        <Button variant="outline" size="sm" @click="appendHeatmapPointsFromBuildingManager">追加导入</Button>
                        <Button variant="outline" size="sm" @click="autoGenerateHeatmapPointSize">按数值生成尺寸</Button>
                        <Button variant="danger" size="sm" @click="clearHeatmapPoints">清空点位</Button>
                    </div>

                    <div v-if="heatmapDraftPoints.length === 0" class="camera-views-editor__empty">
                        暂无热力点，请点击“新增热力点”。
                    </div>

                    <div v-else class="camera-views-editor__list">
                        <div
                            v-for="(point, index) in heatmapDraftPoints"
                            :key="point.id || index"
                            class="camera-view-item"
                        >
                            <div class="camera-view-item__header">
                                <div class="camera-view-item__title">热力点 {{ index + 1 }}</div>
                                <div class="camera-view-item__ops">
                                    <Button variant="outline" size="sm" :disabled="index === 0" @click="moveHeatmapPoint(index, -1)">上移</Button>
                                    <Button variant="outline" size="sm" :disabled="index === heatmapDraftPoints.length - 1" @click="moveHeatmapPoint(index, 1)">下移</Button>
                                    <Button variant="danger" size="sm" @click="removeHeatmapPoint(index)">删除</Button>
                                </div>
                            </div>

                            <div class="camera-view-grid camera-view-grid--compact">
                                <div class="camera-view-field">
                                    <label>X</label>
                                    <Input type="number" :model-value="point.x" @update:model-value="updateHeatmapPoint(index, 'x', $event)" />
                                </div>
                                <div class="camera-view-field">
                                    <label>Y</label>
                                    <Input type="number" :model-value="point.y" @update:model-value="updateHeatmapPoint(index, 'y', $event)" />
                                </div>
                                <div class="camera-view-field">
                                    <label>Z</label>
                                    <Input type="number" :model-value="point.z" @update:model-value="updateHeatmapPoint(index, 'z', $event)" />
                                </div>
                                <div class="camera-view-field">
                                    <label>Value</label>
                                    <Input type="number" :model-value="point.value" @update:model-value="updateHeatmapPoint(index, 'value', $event)" />
                                </div>
                                <div class="camera-view-field">
                                    <label>Size（可选）</label>
                                    <Input type="number" :model-value="point.size" @update:model-value="updateHeatmapPoint(index, 'size', $event)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="label3d-section">
                    <div class="label3d-section__title">颜色梯度映射</div>
                    <div class="camera-views-editor__actions">
                        <Button variant="outline" size="sm" @click="addHeatmapColorStop">新增颜色节点</Button>
                    </div>

                    <div v-if="heatmapDraftColors.length === 0" class="camera-views-editor__empty">
                        暂无颜色节点，请点击“新增颜色节点”。
                    </div>

                    <div v-else class="camera-views-editor__list">
                        <div
                            v-for="(item, index) in heatmapDraftColors"
                            :key="`color-${index}`"
                            class="camera-view-item"
                        >
                            <div class="camera-view-item__header">
                                <div class="camera-view-item__title">颜色节点 {{ index + 1 }}</div>
                                <div class="camera-view-item__ops">
                                    <Button variant="outline" size="sm" :disabled="index === 0" @click="moveHeatmapColorStop(index, -1)">上移</Button>
                                    <Button variant="outline" size="sm" :disabled="index === heatmapDraftColors.length - 1" @click="moveHeatmapColorStop(index, 1)">下移</Button>
                                    <Button variant="danger" size="sm" @click="removeHeatmapColorStop(index)">删除</Button>
                                </div>
                            </div>

                            <div class="camera-view-grid camera-view-grid--compact">
                                <div class="camera-view-field">
                                    <label>Stop（0-1）</label>
                                    <Input type="number" :model-value="item.stop" @update:model-value="updateHeatmapColorStop(index, 'stop', $event)" />
                                </div>
                                <div class="camera-view-field">
                                    <label>颜色</label>
                                    <ColorPicker :model-value="item.color" @update:model-value="updateHeatmapColorStop(index, 'color', $event)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="label3d-section">
                    <div class="label3d-section__title">阈值颜色映射</div>
                    <div class="camera-views-editor__actions">
                        <Button variant="outline" size="sm" @click="addHeatmapThreshold">新增阈值映射</Button>
                    </div>

                    <div v-if="heatmapDraftThresholds.length === 0" class="camera-views-editor__empty">
                        暂无阈值映射，可按需新增。留空时将使用颜色梯度。
                    </div>

                    <div v-else class="camera-views-editor__list">
                        <div
                            v-for="(item, index) in heatmapDraftThresholds"
                            :key="`threshold-${index}`"
                            class="camera-view-item"
                        >
                            <div class="camera-view-item__header">
                                <div class="camera-view-item__title">阈值 {{ index + 1 }}</div>
                                <div class="camera-view-item__ops">
                                    <Button variant="outline" size="sm" :disabled="index === 0" @click="moveHeatmapThreshold(index, -1)">上移</Button>
                                    <Button variant="outline" size="sm" :disabled="index === heatmapDraftThresholds.length - 1" @click="moveHeatmapThreshold(index, 1)">下移</Button>
                                    <Button variant="danger" size="sm" @click="removeHeatmapThreshold(index)">删除</Button>
                                </div>
                            </div>

                            <div class="camera-view-grid camera-view-grid--compact">
                                <div class="camera-view-field">
                                    <label>Value</label>
                                    <Input type="number" :model-value="item.value" @update:model-value="updateHeatmapThreshold(index, 'value', $event)" />
                                </div>
                                <div class="camera-view-field">
                                    <label>颜色</label>
                                    <ColorPicker :model-value="item.color" @update:model-value="updateHeatmapThreshold(index, 'color', $event)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showHeatmapModal = false">取消</Button>
                <Button variant="primary" @click="saveHeatmapDraft">保存</Button>
            </template>
        </Modal>

        <Modal
            v-model="showAreaBlockModal"
            title="编辑区域块列表"
            width="980px"
        >
            <div class="camera-views-editor">
                <div class="camera-views-editor__actions">
                    <Button variant="outline" size="sm" @click="addEmptyAreaBlockRow">
                        新增区域块
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllAreaBlockCollapsed(false)">
                        全部展开
                    </Button>
                    <Button variant="outline" size="sm" @click="setAllAreaBlockCollapsed(true)">
                        全部收起
                    </Button>
                    <Button variant="outline" size="sm" @click="stopAreaBlockPicking">
                        退出拾取
                    </Button>
                </div>

                <div v-if="areaBlockDraftList.length === 0" class="camera-views-editor__empty">
                    暂无区域块，请点击“新增区域块”。
                </div>

                <div v-else class="camera-views-editor__list">
                    <div
                        v-for="(area, areaIndex) in areaBlockDraftList"
                        :key="area.id || areaIndex"
                        class="camera-view-item"
                    >
                        <div class="camera-view-item__header">
                            <div class="camera-view-item__title">区域块 {{ areaIndex + 1 }}</div>
                            <div class="camera-view-item__ops">
                                <Button variant="outline" size="sm" @click="toggleAreaBlockCollapsed(areaIndex)">
                                    {{ isAreaBlockCollapsed(areaIndex) ? '展开' : '收起' }}
                                </Button>
                                <Button variant="outline" size="sm" :disabled="areaIndex === 0" @click="moveAreaBlockRow(areaIndex, -1)">上移</Button>
                                <Button variant="outline" size="sm" :disabled="areaIndex === areaBlockDraftList.length - 1" @click="moveAreaBlockRow(areaIndex, 1)">下移</Button>
                                <Button variant="danger" size="sm" @click="removeAreaBlockRow(areaIndex)">删除</Button>
                            </div>
                        </div>

                        <div v-show="!isAreaBlockCollapsed(areaIndex)" class="label3d-editor-body">
                            <div class="label3d-section">
                                <div class="label3d-section__title">基础</div>
                                <div class="camera-view-grid camera-view-grid--compact">
                                    <div class="camera-view-field">
                                        <label>ID</label>
                                        <Input :model-value="area.id" @update:model-value="updateAreaBlockField(areaIndex, 'id', $event)" />
                                    </div>
                                </div>
                            </div>

                            <div class="label3d-section">
                                <div class="label3d-section__title">区域点位</div>
                                <div class="camera-views-editor__actions">
                                    <Button variant="outline" size="sm" @click="addAreaBlockPoint(areaIndex)">
                                        新增点位
                                    </Button>
                                </div>

                                <div class="camera-views-editor__list">
                                    <div
                                        v-for="(point, pointIndex) in area.points"
                                        :key="`${area.id || areaIndex}-${pointIndex}`"
                                        class="camera-view-item"
                                    >
                                        <div class="camera-view-item__header">
                                            <div class="camera-view-item__title">点 {{ pointIndex + 1 }}</div>
                                            <div class="camera-view-item__ops">
                                                <Button variant="outline" size="sm" :disabled="pointIndex === 0" @click="moveAreaBlockPoint(areaIndex, pointIndex, -1)">上移</Button>
                                                <Button variant="outline" size="sm" :disabled="pointIndex === area.points.length - 1" @click="moveAreaBlockPoint(areaIndex, pointIndex, 1)">下移</Button>
                                                <Button variant="danger" size="sm" :disabled="area.points.length <= 3" @click="removeAreaBlockPoint(areaIndex, pointIndex)">删除</Button>
                                            </div>
                                        </div>

                                        <div class="camera-view-grid camera-view-grid--compact">
                                            <div class="camera-view-field">
                                                <label>X</label>
                                                <Input type="number" :model-value="point.x" @update:model-value="updateAreaBlockPoint(areaIndex, pointIndex, 'x', $event)" />
                                            </div>
                                            <div class="camera-view-field">
                                                <label>Y</label>
                                                <Input type="number" :model-value="point.y" @update:model-value="updateAreaBlockPoint(areaIndex, pointIndex, 'y', $event)" />
                                            </div>
                                            <div class="camera-view-field">
                                                <label>Z</label>
                                                <Input type="number" :model-value="point.z" @update:model-value="updateAreaBlockPoint(areaIndex, pointIndex, 'z', $event)" />
                                            </div>

                                            <div class="camera-view-field camera-view-field--full">
                                                <label>从点位管理获取坐标</label>
                                                <div class="camera-views-editor__insert-row">
                                                    <Select
                                                        :model-value="getAreaBlockPointSelection(area.id, pointIndex)"
                                                        :options="buildingPointOptions"
                                                        placeholder="选择点位"
                                                        @update:model-value="setAreaBlockPointSelection(area.id, pointIndex, $event)"
                                                    />
                                                    <Button variant="outline" size="sm" @click="applyBuildingPointToAreaBlockPoint(areaIndex, pointIndex)">
                                                        使用点位坐标
                                                    </Button>
                                                </div>
                                            </div>

                                            <div class="camera-view-field camera-view-field--full">
                                                <label>场景拾取坐标</label>
                                                <Button variant="outline" size="sm" @click="startAreaBlockPicking(areaIndex, pointIndex)">
                                                    拾取当前位置
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="showAreaBlockModal = false">
                    取消
                </Button>
                <Button variant="primary" @click="saveAreaBlockDraft">
                    保存
                </Button>
            </template>
        </Modal>

        <Modal
            v-model="showAreaBlockPickConfirm"
            title="确认拾取坐标"
            width="420px"
            @close="cancelAreaBlockPickConfirm"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">已拾取到坐标，确认更新该区域块点位坐标？</div>
                <div class="pick-xyz-display">
                    <Input :model-value="format4(areaBlockPickXyz[0])" disabled />
                    <Input :model-value="format4(areaBlockPickXyz[1])" disabled />
                    <Input :model-value="format4(areaBlockPickXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelAreaBlockPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmAreaBlockPickConfirm">确认</Button>
            </template>
        </Modal>

        <Modal
            v-model="showLabel3DPickConfirm"
            title="确认拾取坐标"
            width="420px"
            @close="cancelLabel3DPickConfirm"
        >
            <div class="pick-confirm-content">
                <div class="text-sm text-gray-600">已拾取到坐标，确认更新该标签位置？</div>
                <div class="pick-xyz-display">
                    <Input :model-value="format4(label3DPickXyz[0])" disabled />
                    <Input :model-value="format4(label3DPickXyz[1])" disabled />
                    <Input :model-value="format4(label3DPickXyz[2])" disabled />
                </div>
            </div>

            <template #footer>
                <Button variant="outline" @click="cancelLabel3DPickConfirm">取消</Button>
                <Button variant="primary" @click="confirmLabel3DPickConfirm">确认</Button>
            </template>
        </Modal>
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useVariableStore } from '../../stores/useVariableStore';
import { useComponent } from '../../composables/useComponent';
import { useToast } from '../../composables/useToast';
import { getComponent } from '../../utils/componentRegistry';
import { Validator } from '../../utils/validator';
import Input from '../ui/Input.vue';
import Select from '../ui/Select.vue';
import Slider from '../ui/Slider.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import Accordion from '../ui/Accordion.vue';
import Modal from '../ui/Modal.vue';
import Button from '../ui/Button.vue';
import TransformEditor from './TransformEditor.vue';
import ModelLoaderEditor from './ModelLoaderEditor.vue';
import GeoJSONLoaderEditor from './GeoJSONLoaderEditor.vue';
import ModelLoaderGovernanceEditor from './ModelLoaderGovernanceEditor.vue';
import ModelLoaderStructureEditor from './ModelLoaderStructureEditor.vue';
import TrafficRoadsideDeviceManagerEditor from './TrafficRoadsideDeviceManagerEditor.vue';
import PointTypeMarkerManagerEditor from './PointTypeMarkerManagerEditor.vue';
import CameraPointManagerEditor from './CameraPointManagerEditor.vue';
import TrajectoryMoveEditor from './TrajectoryMoveEditor.vue';
import ExplodedViewEditor from './ExplodedViewEditor.vue';
import DeviceExplodedViewEditor from './DeviceExplodedViewEditor.vue';
import PostProcessingEditor from './PostProcessingEditor.vue';
import AssetPickerModal from './AssetPickerModal.vue';
import PropertyEditorHeader from './PropertyEditorHeader.vue';
import PropertyEditorFields from './PropertyEditorFields.vue';

const componentStore = useComponentStore();
const sceneStore = useSceneStore();
const projectStore = useProjectStore();
const editorStore = useEditorStore();
const variableStore = useVariableStore();
const { updateComponentConfig, setComponentVisibility, applyComponentVariableBindings } = useComponent();
const toast = useToast();

const selectedComponent = computed(() => componentStore.selectedComponent);
const isEditMode = computed(() => editorStore.mode === 'edit');
const isTransformLockedInEdit = computed(() => {
    return isEditMode.value && selectedComponent.value?.locked === true;
});

// 调用命令时推荐使用的组件 ID（优先使用场景 config.id）
const callableComponentId = computed(() => {
    const comp = selectedComponent.value;
    if (!comp) return '';
    return comp?.config?.id || comp?.instance?.config?.id || comp?.id || '';
});

// 获取组件元数据
const componentMetadata = computed(() => {
    if (!selectedComponent.value) return null;
    const comp = getComponent(selectedComponent.value.type);
    return comp?.metadata || null;
});

// 获取组件配置
const componentConfig = computed(() => {
    return selectedComponent.value?.config || {};
});

const booleanVariableOptions = computed(() => ([
    { label: '未绑定变量', value: '' },
    ...(variableStore.variables || [])
        .filter((item) => String(item?.type || '') === 'boolean')
        .map((item) => ({
            label: `${item.name} (${item.type})`,
            value: item.name
        }))
]));

const VARIABLE_BINDING_FIELDS = {
    position: { label: '位置变量', type: 'transform', allowedTypes: new Set(['vector3', 'array', 'object']) },
    rotation: { label: '旋转变量', type: 'transform', allowedTypes: new Set(['vector3', 'array', 'object']) },
    scale: { label: '缩放变量', type: 'transform', allowedTypes: new Set(['number', 'vector3', 'array', 'object']) },
    visible: { label: '编辑显示变量', type: 'boolean' },
    previewVisible: { label: '预览显示变量', type: 'boolean' },
    locked: { label: '编辑锁定变量', type: 'boolean' }
};

const showVariableBindingModal = ref(false);
const variableBindingTarget = ref('');
const variableBindingDraft = ref('');

const getRootVariableBindingName = (propertyKey) => {
    return String(selectedComponent.value?.variableBindings?.[propertyKey] || '').trim();
};

const variableBindingTargetMeta = computed(() => (
    VARIABLE_BINDING_FIELDS[variableBindingTarget.value] || { label: '变量', type: 'transform' }
));

const variableBindingTargetLabel = computed(() => variableBindingTargetMeta.value.label);
const variableBindingOptions = computed(() => (
    variableBindingTargetMeta.value.type === 'boolean'
        ? booleanVariableOptions.value
        : [
            { label: '未绑定变量', value: '' },
            ...(variableStore.variables || [])
                .filter((item) => !variableBindingTargetMeta.value.allowedTypes || variableBindingTargetMeta.value.allowedTypes.has(String(item?.type || '')))
                .map((item) => ({
                    label: `${item.name} (${item.type})`,
                    value: item.name
                }))
        ]
));
const currentVariableBindingName = computed(() => getRootVariableBindingName(variableBindingTarget.value));

const visibilityControlItems = computed(() => {
    const bindings = selectedComponent.value?.variableBindings || {};
    return [
        {
            key: 'visible',
            label: '编辑',
            checked: selectedComponent.value?.visible !== false,
            stateText: selectedComponent.value?.visible !== false ? '显示' : '隐藏',
            bound: !!String(bindings.visible || '').trim()
        },
        {
            key: 'previewVisible',
            label: '预览',
            checked: selectedComponent.value?.previewVisible !== false,
            stateText: selectedComponent.value?.previewVisible !== false ? '显示' : '隐藏',
            bound: !!String(bindings.previewVisible || '').trim()
        },
        {
            key: 'locked',
            label: '锁定',
            checked: selectedComponent.value?.locked === true,
            stateText: selectedComponent.value?.locked === true ? '锁定' : '未锁',
            bound: !!String(bindings.locked || '').trim()
        }
    ];
});

const visibilityControlSummary = computed(() => {
    const hiddenCount = visibilityControlItems.value.filter((item) => !item.checked && item.key !== 'locked').length;
    const lockedText = selectedComponent.value?.locked === true ? '锁定' : '未锁';
    if (hiddenCount === 0) return `全显示 · ${lockedText}`;
    return `${hiddenCount} 隐藏 · ${lockedText}`;
});

const BASIC_HIDDEN_CONFIG_FIELDS = {
    CameraPointManager: new Set(['types', 'typeStyles', 'eventConfig', 'videoModalStyle', 'points']),
    PointTypeMarkerManager: new Set(['types', 'points', 'dataSnapshot', 'dataMapping', 'stateStyles']),
    TrajectoryMove: new Set(['points']),
    BuildingEditor: new Set(['points'])
};

const isHiddenInBasicPanel = (field) => {
    if (!field) return false;
    if (field.hidden || field.hiddenInBasicPanel) return true;
    const type = selectedComponent.value?.type || '';
    return BASIC_HIDDEN_CONFIG_FIELDS[type]?.has(field.key) === true;
};

// 获取配置 Schema（过滤掉 transform 相关的字段和隐藏字段）
const configSchema = computed(() => {
    if (!componentMetadata.value) return [];
    const baseSchema = (componentMetadata.value.configSchema || []).filter(
        (field) => !['position', 'rotation', 'scale'].includes(field.key) && !isHiddenInBasicPanel(field)
    );

    if (selectedComponent.value?.type === 'Heatmap') {
        const renderMode = String(componentConfig.value?.renderMode || 'plane');
        const showPointMarkers = Boolean(componentConfig.value?.showPointMarkers);
        const surfaceOnlyFields = new Set(['surfaceTarget.componentId', 'surfaceTarget.meshName']);
        const planeOnlyFields = new Set(['padding']);
        const pointMarkerFields = new Set(['pointMarkerSize', 'pointMarkerOpacity']);

        return baseSchema.filter((field) => {
            if (surfaceOnlyFields.has(field.key)) {
                return renderMode === 'surface';
            }
            if (planeOnlyFields.has(field.key)) {
                return renderMode === 'plane';
            }
            if (pointMarkerFields.has(field.key)) {
                return showPointMarkers;
            }
            return true;
        });
    }

    if (selectedComponent.value?.type === 'MigrationLine') {
        // MigrationLine 固定使用 MeshLine 渲染，所有字段均展示
        const meshlineFields = new Set([
            'lines',
            'globalConfig.color',
            'globalConfig.lineWidth',
            'globalConfig.speed',
            'globalConfig.duration',
            'globalConfig.loop',
            'globalConfig.autoStart',
            'globalConfig.texture',
            'globalConfig.alphaTexture',
            'globalConfig.textureRepeat',
            'globalConfig.direction',
            'globalConfig.dashArray',
            'globalConfig.dashRatio',
            'globalConfig.widthMode',
            'globalConfig.taperRatio',
            'globalConfig.sizeAttenuation',
            'globalConfig.blending',
            'globalConfig.depthTest',
            'globalConfig.segments'
        ]);

        return baseSchema.filter((field) => meshlineFields.has(field.key));
    }

    if (selectedComponent.value?.type === 'PostProcessing') {
        return baseSchema;
    }

    if (selectedComponent.value?.type !== 'CameraJump') {
        return baseSchema;
    }

    const targetType = String(componentConfig.value?.targetType || 'mesh');
    const pointSource = String(componentConfig.value?.pointTarget?.source || 'manual');
    const alwaysFields = new Set([
        'targetType',
        'distance',
        'direction.x',
        'direction.y',
        'direction.z',
        'duration',
        'speed',
        'easing',
        'autoLookAt',
        'autoStart'
    ]);
    const meshFields = new Set(['meshTarget.componentId', 'meshTarget.meshName']);
    const labelFields = new Set(['labelTarget.componentId', 'labelTarget.labelId']);
    const pointManagerFields = new Set(['pointTarget.source', 'pointTarget.pointId']);
    const pointManualFields = new Set(['pointTarget.source', 'pointTarget.position.x', 'pointTarget.position.y', 'pointTarget.position.z']);

    return baseSchema.filter((field) => {
        if (alwaysFields.has(field.key)) return true;
        if (targetType === 'mesh') return meshFields.has(field.key);
        if (targetType === 'label') return labelFields.has(field.key);
        if (targetType === 'point') {
            return pointSource === 'manager'
                ? pointManagerFields.has(field.key)
                : pointManualFields.has(field.key);
        }
        return false;
    });
});

const advancedRawFields = computed(() => {
    if (!componentMetadata.value) return [];
    return (componentMetadata.value.configSchema || []).filter((field) => {
        if (!field || field.type !== 'json') return false;
        if (!field.advancedRaw && !field.hiddenInBasicPanel) return false;
        return isHiddenInBasicPanel(field);
    });
});

// 是否是 ModelLoader 组件
const isModelLoader = computed(() => {
    return selectedComponent.value?.type === 'ModelLoader';
});

const isGaussianSplatLoader = computed(() => {
    return selectedComponent.value?.type === 'GaussianSplatLoader';
});

const isGeoJSONLoader = computed(() => {
    return selectedComponent.value?.type === 'GeoJSONLoader';
});

// 是否是 TrafficRoadsideDeviceManager 组件
const isTrafficRoadsideDeviceManager = computed(() => {
    return selectedComponent.value?.type === 'TrafficRoadsideDeviceManager';
});

const isPointTypeMarkerManager = computed(() => {
    return selectedComponent.value?.type === 'PointTypeMarkerManager';
});

const isCameraPointManager = computed(() => {
    return selectedComponent.value?.type === 'CameraPointManager';
});

// 是否是 TrajectoryMove 组件
const isTrajectoryMove = computed(() => {
    return selectedComponent.value?.type === 'TrajectoryMove';
});

// 是否是 ExplodedView 组件
const isExplodedView = computed(() => {
    return selectedComponent.value?.type === 'ExplodedView';
});

const isDeviceExplodedView = computed(() => {
    return selectedComponent.value?.type === 'DeviceExplodedView';
});

const isPostProcessing = computed(() => {
    return selectedComponent.value?.type === 'PostProcessing';
});

// 是否是 CameraTour 组件
const isCameraTour = computed(() => {
    return selectedComponent.value?.type === 'CameraTour';
});

const isCameraJump = computed(() => {
    return selectedComponent.value?.type === 'CameraJump';
});

const looksLikeLabel3DComponent = (component) => {
    if (!component || typeof component !== 'object') {
        return false;
    }

    if (component.type === 'Label3D') {
        return true;
    }

    const config = component.config && typeof component.config === 'object'
        ? component.config
        : {};

    return Array.isArray(config.labels)
        && config.globalConfig
        && typeof config.globalConfig === 'object';
};

const isLabel3D = computed(() => {
    return looksLikeLabel3DComponent(selectedComponent.value);
});

const isMigrationLine = computed(() => {
    return selectedComponent.value?.type === 'MigrationLine';
});

const isMultiPathAnimation = computed(() => {
    return selectedComponent.value?.type === 'MultiPathAnimation';
});

const isAreaBlock = computed(() => {
    return selectedComponent.value?.type === 'AreaBlock';
});

const isHeatmap = computed(() => {
    return selectedComponent.value?.type === 'Heatmap';
});

const getComponentCallableId = (component) => {
    if (!component) return '';
    return String(component?.config?.id || component?.instance?.config?.id || component?.id || '').trim();
};

const findComponentByBindingValue = (bindingValue, expectedType = '') => {
    const target = String(bindingValue || '').trim();
    if (!target) return null;

    return componentStore.components.find((item) => {
        if (expectedType && item?.type !== expectedType) return false;
        const candidates = [
            item?.id,
            item?.config?.id,
            item?.instance?.config?.id,
            item?.name,
            item?.config?.name
        ]
            .map((v) => String(v || '').trim())
            .filter(Boolean);
        return candidates.includes(target);
    }) || null;
};

const modelLoaderComponentOptions = computed(() => {
    return componentStore.components
        .filter((c) => c.type === 'ModelLoader')
        .map((loader) => ({
            value: getComponentCallableId(loader),
            label: `${loader.name || 'ModelLoader'} (${loader.id})`
        }));
});

const label3DComponentOptions = computed(() => {
    return componentStore.components
        .filter((c) => c.type === 'Label3D')
        .map((item) => ({
            value: getComponentCallableId(item),
            label: `${item.name || 'Label3D'} (${item.id})`
        }));
});

const getMeshOptionsByComponentId = (componentId) => {
    const loaderId = String(componentId || '').trim();
    if (!loaderId) return [];

    const loaderComp = findComponentByBindingValue(loaderId, 'ModelLoader');
    if (!loaderComp?.instance) return [];

    const names = new Set();
    if (typeof loaderComp.instance.getAllMeshes === 'function') {
        const meshes = loaderComp.instance.getAllMeshes();
        meshes.forEach((mesh) => {
            const name = String(mesh?.name || '').trim();
            if (name) names.add(name);
        });
    }

    return Array.from(names).map((name) => ({ value: name, label: name }));
};

const cameraJumpMeshOptions = computed(() => {
    return getMeshOptionsByComponentId(componentConfig.value?.meshTarget?.componentId || '');
});

const heatmapSurfaceMeshOptions = computed(() => {
    return getMeshOptionsByComponentId(componentConfig.value?.surfaceTarget?.componentId || '');
});

const cameraJumpLabelOptions = computed(() => {
    const labelComponentId = String(componentConfig.value?.labelTarget?.componentId || '');
    if (!labelComponentId) return [];

    const labelComp = findComponentByBindingValue(labelComponentId, 'Label3D');
    if (!labelComp) return [];

    let labels = [];
    if (typeof labelComp.instance?.getAllLabels === 'function') {
        labels = labelComp.instance.getAllLabels();
    } else {
        labels = Array.isArray(labelComp.config?.labels) ? labelComp.config.labels : [];
    }

    return labels
        .filter((item) => item && item.id)
        .map((item, index) => ({
            value: String(item.id),
            label: `${item.label || `标签 ${index + 1}`} (${item.id})`
        }));
});

const toNumberSafe = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const round4 = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return Math.round(n * 10000) / 10000;
};

const format4 = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return round4(n).toFixed(4);
};

const ensureVec3 = (position, fallback = [0, 0, 0]) => {
    if (Array.isArray(position)) {
        return [toNumberSafe(position[0], fallback[0]), toNumberSafe(position[1], fallback[1]), toNumberSafe(position[2], fallback[2])];
    }

    if (position && typeof position === 'object') {
        return [toNumberSafe(position.x, fallback[0]), toNumberSafe(position.y, fallback[1]), toNumberSafe(position.z, fallback[2])];
    }

    return [...fallback];
};

const ensureArray = (value, fallback = []) => {
    if (Array.isArray(value)) return [...value];
    return [...fallback];
};

const getArrayLength = (value) => Array.isArray(value) ? value.length : 0;

const getObjectSize = (value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;

const formatSummaryPosition = (value) => {
    const xyz = ensureVec3(value, [0, 0, 0]);
    return xyz.map((item) => round4(item)).join(', ');
};

const lowcodeSummaryRows = computed(() => {
    const type = selectedComponent.value?.type || '';
    const config = componentConfig.value || {};

    if (type === 'CameraPointManager') {
        const eventConfig = config.eventConfig && typeof config.eventConfig === 'object' ? config.eventConfig : {};
        const enabledEvents = Object.values(eventConfig).filter((item) => item?.enabled === true).length;
        const styleCount = getObjectSize(config.typeStyles) || getArrayLength(config.types);
        return [{
            key: 'camera-point-manager',
            title: '摄像头点位配置',
            description: '点位、样式、事件和视频弹窗通过专用面板维护。',
            action: 'panel:camerapoints',
            actionText: '点位管理',
            metrics: [
                { label: '点位数', value: `${getArrayLength(config.points)} 个` },
                { label: '样式数', value: `${styleCount} 个` },
                { label: '启用事件', value: `${enabledEvents} 个` },
                { label: '弹窗预设', value: config.videoModalStyle?.preset || '默认' }
            ]
        }];
    }

    if (type === 'PointTypeMarkerManager') {
        const mappingEnabled = config.dataMapping?.enabled === true ? '已启用' : '未启用';
        return [{
            key: 'point-type-marker-manager',
            title: '多类型点位配置',
            description: '类型、点位、映射和状态样式通过点位类型管理维护。',
            action: 'panel:pointtypemarker',
            actionText: '类型管理',
            metrics: [
                { label: '类型数', value: `${getArrayLength(config.types)} 个` },
                { label: '点位数', value: `${getArrayLength(config.points)} 个` },
                { label: '数据映射', value: mappingEnabled },
                { label: '状态样式', value: `${getObjectSize(config.typeStateStyles)} 个类型` }
            ]
        }];
    }

    if (type === 'TrajectoryMove') {
        const points = Array.isArray(config.points) ? config.points : [];
        return [{
            key: 'trajectory-move',
            title: '轨迹路线配置',
            description: '路线点位通过轨迹编辑面板维护。',
            action: 'panel:trajectorymove',
            actionText: '编辑路线',
            metrics: [
                { label: '点位数', value: `${points.length} 个` },
                { label: '起点', value: points[0] ? formatSummaryPosition(points[0]) : '未配置' },
                { label: '终点', value: points.length > 1 ? formatSummaryPosition(points[points.length - 1]) : '未配置' }
            ]
        }];
    }

    return [];
});

// Accordion 配置
const accordionItems = computed(() => {
    const items = [
        {
            key: 'transform',
            label: '变换',
            icon: ''
        }
    ];

    if (configSchema.value.length > 0 || lowcodeSummaryRows.value.length > 0) {
        items.push({
            key: 'properties',
            label: '属性',
            icon: ''
        });
    }

    if (advancedRawFields.value.length > 0) {
        items.push({
            key: 'advancedraw',
            label: '高级配置',
            icon: ''
        });
    }

    // 如果是 ModelLoader，添加高级功能面板
    if (isModelLoader.value) {
        items.push({
            key: 'modelloader',
            label: '高级功能',
            icon: ''
        });
        items.push({
            key: 'modelstructure',
            label: '模型结构',
            icon: ''
        });
        items.push({
            key: 'modelgovernance',
            label: '大场景治理',
            icon: ''
        });
    }

    if (isGeoJSONLoader.value) {
        items.push({
            key: 'geojsonloader',
            label: 'GeoJSON 业务配置',
            icon: '🗺️'
        });
    }

    // 如果是 TrafficRoadsideDeviceManager，添加设备管理面板
    if (isTrafficRoadsideDeviceManager.value) {
        items.push({
            key: 'trafficdevices',
            label: '设备管理',
            icon: '🚦'
        });
    }

    if (isPointTypeMarkerManager.value) {
        items.push({
            key: 'pointtypemarker',
            label: '点位类型管理',
            icon: '🧭'
        });
    }

    if (isCameraPointManager.value) {
        items.push({
            key: 'camerapoints',
            label: '摄像头点位管理',
            icon: '📷'
        });
    }

    // 如果是 TrajectoryMove，添加轨迹编辑面板
    if (isTrajectoryMove.value) {
        items.push({
            key: 'trajectorymove',
            label: '轨迹编辑',
            icon: '🛤️'
        });
    }

    // 如果是 ExplodedView，添加楼层爆炸图配置面板
    if (isExplodedView.value) {
        items.push({
            key: 'explodedview',
            label: '楼层爆炸图配置',
            icon: '🏗️'
        });
    }

    if (isDeviceExplodedView.value) {
        items.push({
            key: 'deviceexplodedview',
            label: '设备爆炸图配置',
            icon: '⚙️'
        });
    }

    if (isPostProcessing.value) {
        items.push({
            key: 'postprocessing',
            label: '后期处理配置',
            icon: '✨'
        });
    }

    return items;
});

// 验证单个字段
const validateField = (field, value) => {
    const schema = {
        [field.key]: {
            label: field.label,
            required: field.required,
            type: field.type,
            min: field.min,
            max: field.max,
            validator: field.validator
        }
    };

    return Validator.validate({ [field.key]: value }, schema);
};

// 更新组件名称
const updateComponentName = (name) => {
    if (selectedComponent.value) {
        componentStore.updateComponent(selectedComponent.value.id, { name });
    }
};

const updatePreviewVisibility = (previewVisible) => {
    if (!selectedComponent.value) return;
    componentStore.updateComponent(selectedComponent.value.id, {
        previewVisible: previewVisible !== false
    });
};

const updateRuntimeVisibility = (visible) => {
    if (!selectedComponent.value?.id) return;
    setComponentVisibility(selectedComponent.value.id, visible !== false);
};

const updateLockedState = (locked) => {
    if (!selectedComponent.value?.id) return;
    componentStore.updateComponent(selectedComponent.value.id, {
        locked: locked === true
    });
};

const updateVisibilityControl = (propertyKey, checked) => {
    if (propertyKey === 'visible') {
        updateRuntimeVisibility(checked);
        return;
    }
    if (propertyKey === 'previewVisible') {
        updatePreviewVisibility(checked);
        return;
    }
    if (propertyKey === 'locked') {
        updateLockedState(checked);
    }
};

const updateRootVariableBinding = async (propertyKey, variableName) => {
    if (!selectedComponent.value?.id || !propertyKey) return;

    const currentBindings = selectedComponent.value.variableBindings || {};
    const nextBindings = {
        ...currentBindings,
        [propertyKey]: String(variableName || '').trim()
    };

    if (!nextBindings[propertyKey]) {
        delete nextBindings[propertyKey];
    }

    componentStore.updateComponent(selectedComponent.value.id, {
        variableBindings: nextBindings
    });

    await applyComponentVariableBindings(selectedComponent.value.id);
};

const openVariableBinding = (propertyKey) => {
    if (!selectedComponent.value?.id || !VARIABLE_BINDING_FIELDS[propertyKey]) return;
    variableBindingTarget.value = propertyKey;
    variableBindingDraft.value = getRootVariableBindingName(propertyKey);
    showVariableBindingModal.value = true;
};

const saveVariableBinding = async () => {
    if (!variableBindingTarget.value) return;
    await updateRootVariableBinding(variableBindingTarget.value, variableBindingDraft.value);
    showVariableBindingModal.value = false;
};

const copyText = async (text) => {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch {
        // ignore and fallback
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
};

const copyCallableId = async () => {
    const id = callableComponentId.value;
    if (!id) {
        toast.warning('当前组件暂无可用调用ID');
        return;
    }
    const ok = await copyText(id);
    if (ok) {
        toast.success(`已复制调用ID: ${id}`);
    } else {
        toast.error('复制失败，请手动复制');
    }
};

const previewCameraJump = async () => {
    const comp = selectedComponent.value;
    if (!comp || comp.type !== 'CameraJump') return;

    const instance = comp.instance;
    if (!instance || typeof instance.jump !== 'function') {
        toast.error('视角跳转实例未就绪，无法预览');
        return;
    }

    try {
        const ok = await instance.jump();
        if (ok === false) {
            const reason = typeof instance.getLastJumpError === 'function'
                ? instance.getLastJumpError()?.message
                : '';
            toast.warning(reason ? `预览失败：${reason}` : '预览失败，请检查目标绑定与参数配置');
            return;
        }
        toast.success('已执行视角跳转预览');
    } catch (error) {
        console.error('Preview camera jump failed:', error);
        toast.error(`预览失败: ${error.message}`);
    }
};

/**
 * 读取点路径嵌套值，例如 'emitter.range' → config.emitter.range
 */
const getFieldValue = (key) => {
    const parts = key.split('.');
    let obj = componentConfig.value;
    for (const part of parts) {
        if (obj == null) return undefined;
        obj = obj[part];
    }
    return obj;
};

/**
 * 将点路径键值对转换为嵌套对象 patch
 * 例如 ('emitter.range', 0.5) → { emitter: { range: 0.5 } }
 */
const buildNestedPatch = (dotPath, value) => {
    const parts = dotPath.split('.');
    if (parts.length === 1) return { [dotPath]: value };
    const result = {};
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return result;
};

// 更新配置
const updateConfig = (key, value) => {
    if (!selectedComponent.value) return;
    if (isTransformLockedInEdit.value && ['position', 'rotation', 'scale'].includes(String(key || ''))) {
        toast.warning('组件已锁定，无法修改位置/旋转/缩放');
        return;
    }

    try {
        // 验证配置值
        const field = configSchema.value.find((f) => f.key === key);
        if (field) {
            const validationResult = validateField(field, value);
            if (!validationResult.isValid()) {
                const errors = validationResult.getErrors();
                toast.error(`配置验证失败: ${errors[key] || '无效的值'}`);
                return;
            }
        }

        // 将点路径 key 展开为嵌套 patch，交由 updateComponentConfig 深合并
        const patch = buildNestedPatch(key, value);
        updateComponentConfig(selectedComponent.value.id, patch);
    } catch (error) {
        console.error('Failed to update config:', error);
        toast.error(`更新配置失败: ${error.message}`);
    }
};

const updateHeatmapSurfaceComponent = (value) => {
    updateConfig('surfaceTarget.componentId', value);
    updateConfig('surfaceTarget.meshName', '');
};

// 更新 Vector3 值
const updateVector3 = (key, index, value) => {
    const currentValue = getFieldValue(key) || [0, 0, 0];
    const newValue = [...currentValue];
    newValue[index] = parseFloat(value) || 0;
    updateConfig(key, newValue);
};

const updateVector2 = (key, index, value) => {
    const currentValue = ensureArray(getFieldValue(key), [0, 0]);
    const newValue = [toNumberSafe(currentValue[0], 0), toNumberSafe(currentValue[1], 0)];
    newValue[index] = parseFloat(value) || 0;
    updateConfig(key, newValue);
};

const updateRange = (key, index, value) => {
    const field = configSchema.value.find((item) => item.key === key) || {};
    const currentValue = ensureArray(getFieldValue(key), Array.isArray(field.default) ? field.default : []);
    const newValue = [...currentValue];
    newValue[index] = field.type === 'numberRange' ? (parseFloat(value) || 0) : value;
    updateConfig(key, newValue);
};

// JSON 值格式化（用于显示）
const formatJsonValue = (value) => {
    if (value === undefined || value === null) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

// 更新 JSON 配置
const updateJsonConfig = (key, jsonString) => {
    if (!selectedComponent.value) return;
    try {
        const value = JSON.parse(jsonString);
        updateConfig(key, value);
    } catch (error) {
        toast.error(`JSON 格式错误: ${error.message}`);
    }
};

const handlePropertyEditorAction = (action) => {
    switch (action) {
        case 'panel:camerapoints':
            focusAccordionSection('camerapoints');
            break;
        case 'panel:pointtypemarker':
            focusAccordionSection('pointtypemarker');
            break;
        case 'panel:trajectorymove':
            focusAccordionSection('trajectorymove');
            break;
        case 'camera-views':
            openCameraViewsEditor();
            break;
        case 'label3d-labels':
            openLabel3DLabelsEditor();
            break;
        case 'migration-lines':
            openMigrationLineEditor();
            break;
        case 'multi-paths':
            openMultiPathAnimationEditor();
            break;
        case 'area-blocks':
            openAreaBlockEditor();
            break;
        case 'heatmap':
            openHeatmapEditor();
            break;
        default:
            break;
    }
};

// 资源选择器状态
const showAssetPicker = ref(false);
const assetPickerCategory = ref('model');
const pendingAssetFieldKey = ref('');
const pendingAssetCurrentValue = ref('');

// CameraTour 视角列表弹窗状态
const showCameraViewsModal = ref(false);
const cameraViewsDraftList = ref([]);
const managerViewsSource = ref([]);
const selectedManagerViewId = ref('');
const collapsedDraftViews = ref({});
const cameraTypeOptions = [
    { label: '透视相机', value: 'perspective' },
    { label: '正交相机', value: 'orthographic' }
];

const getDraftViewKey = (index) => {
    const view = cameraViewsDraftList.value[index];
    if (view?.id) return String(view.id);
    return `draft-${index}`;
};

const isDraftCollapsed = (index) => {
    const key = getDraftViewKey(index);
    return !!collapsedDraftViews.value[key];
};

const toggleDraftCollapsed = (index) => {
    const key = getDraftViewKey(index);
    collapsedDraftViews.value[key] = !collapsedDraftViews.value[key];
};

const setAllDraftCollapsed = (collapsed) => {
    const next = {};
    cameraViewsDraftList.value.forEach((view, index) => {
        const key = view?.id ? String(view.id) : `draft-${index}`;
        next[key] = !!collapsed;
    });
    collapsedDraftViews.value = next;
};

const managerViewOptions = computed(() => {
    return managerViewsSource.value.map((view, index) => ({
        value: view.id,
        label: `${view.name || `视角 ${index + 1}`} (${view.cameraType === 'perspective' ? '透视' : '正交'})`
    }));
});

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizeVector3 = (value, fallback = { x: 0, y: 0, z: 0 }) => {
    if (Array.isArray(value) && value.length >= 3) {
        return {
            x: Number(value[0]) || 0,
            y: Number(value[1]) || 0,
            z: Number(value[2]) || 0
        };
    }

    if (value && typeof value === 'object') {
        return {
            x: Number(value.x) || 0,
            y: Number(value.y) || 0,
            z: Number(value.z) || 0
        };
    }

    return {
        x: Number(fallback.x) || 0,
        y: Number(fallback.y) || 0,
        z: Number(fallback.z) || 0
    };
};

const normalizeCameraView = (view, index = 0) => {
    const raw = view && typeof view === 'object' ? view : {};
    const hasPerspectiveParams = raw.perspectiveParams && typeof raw.perspectiveParams === 'object';

    let cameraType = raw.cameraType;
    if (cameraType !== 'perspective' && cameraType !== 'orthographic') {
        cameraType = hasPerspectiveParams ? 'perspective' : 'orthographic';
    }

    const normalized = {
        id: String(raw.id ?? `camera-view-${Date.now()}-${index}`),
        name: String(raw.name || `视角 ${index + 1}`),
        cameraType,
        position: normalizeVector3(raw.position),
        target: normalizeVector3(raw.target ?? raw.lookAt ?? raw.controlsTarget ?? raw.orbitTarget),
        timestamp: Number(raw.timestamp ?? Date.now()) || Date.now()
    };

    if (cameraType === 'perspective') {
        normalized.fov = Number(raw.fov ?? raw.perspectiveParams?.fov ?? 45) || 45;
    } else {
        normalized.zoom = Number(raw.zoom ?? raw.orthographicParams?.zoom ?? 1) || 1;
    }

    return normalized;
};

const openCameraViewsEditor = () => {
    const currentViews = getFieldValue('views');
    const normalizedCurrent = Array.isArray(currentViews)
        ? currentViews.map((view, index) => normalizeCameraView(view, index))
        : [];

    const managerState = projectStore.getCameraViewsState();
    const normalizedManager = Array.isArray(managerState.views)
        ? managerState.views.map((view, index) => normalizeCameraView(view, index))
        : [];

    cameraViewsDraftList.value = normalizedCurrent;
    managerViewsSource.value = normalizedManager;
    selectedManagerViewId.value = normalizedManager[0]?.id || '';
    setAllDraftCollapsed(false);
    showCameraViewsModal.value = true;
};

const getCurrentCameraViewSnapshot = () => {
    const camera = sceneStore.sceneInstance?.camera?.instance;
    const controls = sceneStore.sceneInstance?.controls?.instance;

    if (!camera || !controls?.target) {
        return null;
    }

    const cameraType = camera.isOrthographicCamera ? 'orthographic' : 'perspective';
    const snapshot = {
        id: `camera-view-${Date.now()}`,
        name: `视角 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
        cameraType,
        position: {
            x: Number(camera.position.x) || 0,
            y: Number(camera.position.y) || 0,
            z: Number(camera.position.z) || 0
        },
        target: {
            x: Number(controls.target.x) || 0,
            y: Number(controls.target.y) || 0,
            z: Number(controls.target.z) || 0
        },
        timestamp: Date.now()
    };

    if (cameraType === 'perspective') {
        snapshot.fov = Number(camera.fov) || 45;
    } else {
        snapshot.zoom = Number(camera.zoom) || 1;
    }

    return snapshot;
};

const appendCurrentCameraView = () => {
    const snapshot = getCurrentCameraViewSnapshot();
    if (!snapshot) {
        toast.error('当前相机未就绪，无法读取视角');
        return;
    }

    const next = normalizeCameraView(snapshot, cameraViewsDraftList.value.length);
    cameraViewsDraftList.value.push(next);
    collapsedDraftViews.value[String(next.id)] = false;
    toast.success('已保存当前视角');
};

const insertSelectedManagerView = () => {
    if (!selectedManagerViewId.value) {
        toast.warning('请先选择一条视角');
        return;
    }

    const sourceView = managerViewsSource.value.find((item) => item.id === selectedManagerViewId.value);
    if (!sourceView) {
        toast.error('未找到选中的视角数据');
        return;
    }

    const inserted = normalizeCameraView({
        ...sourceView,
        id: `camera-view-${Date.now()}-${cameraViewsDraftList.value.length}`,
        timestamp: Date.now()
    }, cameraViewsDraftList.value.length);

    cameraViewsDraftList.value.push(inserted);
    collapsedDraftViews.value[String(inserted.id)] = false;
    toast.success('已插入所选视角');
};

const addEmptyCameraView = () => {
    const index = cameraViewsDraftList.value.length;
    const created = normalizeCameraView({
        id: `camera-view-${Date.now()}-${index}`,
        name: `视角 ${index + 1}`,
        cameraType: 'perspective',
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 },
        fov: 45,
        timestamp: Date.now()
    }, index);
    cameraViewsDraftList.value.push(created);
    collapsedDraftViews.value[String(created.id)] = false;
};

const updateDraftName = (index, value) => {
    const row = cameraViewsDraftList.value[index];
    if (!row) return;
    row.name = String(value || '').trim() || `视角 ${index + 1}`;
};

const updateDraftCameraType = (index, typeValue) => {
    const row = cameraViewsDraftList.value[index];
    if (!row) return;

    row.cameraType = typeValue === 'orthographic' ? 'orthographic' : 'perspective';
    if (row.cameraType === 'perspective') {
        row.fov = toNumber(row.fov, 45);
        delete row.zoom;
    } else {
        row.zoom = toNumber(row.zoom, 1);
        delete row.fov;
    }
};

const updateDraftVector = (index, group, axis, value) => {
    const row = cameraViewsDraftList.value[index];
    if (!row) return;

    if (!row[group] || typeof row[group] !== 'object') {
        row[group] = { x: 0, y: 0, z: 0 };
    }
    row[group][axis] = toNumber(value, 0);
};

const updateDraftLens = (index, key, value) => {
    const row = cameraViewsDraftList.value[index];
    if (!row) return;
    row[key] = toNumber(value, key === 'zoom' ? 1 : 45);
};

const removeDraftView = (index) => {
    const key = getDraftViewKey(index);
    if (Object.prototype.hasOwnProperty.call(collapsedDraftViews.value, key)) {
        delete collapsedDraftViews.value[key];
    }
    cameraViewsDraftList.value.splice(index, 1);
};

const moveDraftView = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= cameraViewsDraftList.value.length) return;
    const list = cameraViewsDraftList.value;
    const [item] = list.splice(index, 1);
    list.splice(nextIndex, 0, item);
};

const saveCameraViewsDraft = () => {
    const normalized = cameraViewsDraftList.value.map((view, index) => normalizeCameraView(view, index));
    if (!selectedComponent.value) return;
    updateComponentConfig(selectedComponent.value.id, {
        views: normalized,
        viewSource: 'config'
    });
    showCameraViewsModal.value = false;
    toast.success('视角列表已更新');
};

// MultiPathAnimation 弹窗状态
const showMultiPathModal = ref(false);
const multiPathDraft = ref({
    paths: []
});
const multiPathCollapsedRows = ref({});
const multiPathPointSelection = ref({});
const multiPathPickingComponentId = ref('');
const multiPathPickingTarget = ref({ pathId: '', pathIndex: -1, pointIndex: -1 });
const multiPathModalMinimizedByPicking = ref(false);
const suppressMultiPathModalCloseCleanup = ref(false);

const normalizeMultiPathPoint = (point, fallback = [0, 0, 0]) => {
    if (Array.isArray(point)) {
        return [toNumberSafe(point[0], fallback[0]), toNumberSafe(point[1], fallback[1]), toNumberSafe(point[2], fallback[2])];
    }

    const position = point?.position && typeof point.position === 'object' ? point.position : point;
    if (position && typeof position === 'object') {
        return [toNumberSafe(position.x, fallback[0]), toNumberSafe(position.y, fallback[1]), toNumberSafe(position.z, fallback[2])];
    }

    return [...fallback];
};

const normalizeMultiPathRow = (path, index = 0) => {
    const raw = path && typeof path === 'object' ? path : {};
    const pointsRaw = Array.isArray(raw.data) ? raw.data : [];
    const data = pointsRaw.map((point) => normalizeMultiPathPoint(point));

    while (data.length < 2) {
        data.push([data.length * 5, 0, 0]);
    }

    return {
        id: String(raw.id || `path_${Date.now()}_${index}`),
        data
    };
};

const normalizeMultiPathDraft = (config) => {
    const raw = config && typeof config === 'object' ? config : {};
    const pathsRaw = Array.isArray(raw.paths) ? raw.paths : [];

    return {
        paths: pathsRaw.map((path, index) => normalizeMultiPathRow(path, index))
    };
};

const getMultiPathRowKey = (index) => {
    const row = multiPathDraft.value.paths[index];
    return String(row?.id || `multi-path-row-${index}`);
};

const getMultiPathPointSelectionKey = (pathId, pointIndex) => {
    return `${String(pathId || '')}::${Number(pointIndex)}`;
};

const isMultiPathCollapsed = (index) => {
    const key = getMultiPathRowKey(index);
    return !!multiPathCollapsedRows.value[key];
};

const toggleMultiPathCollapsed = (index) => {
    const key = getMultiPathRowKey(index);
    multiPathCollapsedRows.value[key] = !multiPathCollapsedRows.value[key];
};

const setAllMultiPathCollapsed = (collapsed) => {
    const next = {};
    multiPathDraft.value.paths.forEach((path, index) => {
        const key = path?.id ? String(path.id) : `multi-path-row-${index}`;
        next[key] = !!collapsed;
    });
    multiPathCollapsedRows.value = next;
};

const openMultiPathAnimationEditor = () => {
    multiPathDraft.value = normalizeMultiPathDraft({ paths: getFieldValue('paths') });
    multiPathPickingComponentId.value = selectedComponent.value?.id || '';
    multiPathPickingTarget.value = { pathId: '', pathIndex: -1, pointIndex: -1 };
    multiPathModalMinimizedByPicking.value = false;

    const nextSelection = {};
    multiPathDraft.value.paths.forEach((path) => {
        path.data.forEach((_, pointIndex) => {
            nextSelection[getMultiPathPointSelectionKey(path.id, pointIndex)] = '';
        });
    });
    multiPathPointSelection.value = nextSelection;

    setAllMultiPathCollapsed(false);
    showMultiPathModal.value = true;
};

const addEmptyMultiPathRow = () => {
    const next = normalizeMultiPathRow({}, multiPathDraft.value.paths.length);
    multiPathDraft.value.paths.push(next);
    multiPathCollapsedRows.value[String(next.id)] = false;
    next.data.forEach((_, pointIndex) => {
        multiPathPointSelection.value[getMultiPathPointSelectionKey(next.id, pointIndex)] = '';
    });
};

const removeMultiPathRow = (index) => {
    const row = multiPathDraft.value.paths[index];
    if (row?.id && multiPathPickingTarget.value.pathId === String(row.id)) {
        multiPathPickingTarget.value = { pathId: '', pathIndex: -1, pointIndex: -1 };
    }

    if (row?.id) {
        delete multiPathCollapsedRows.value[String(row.id)];
        Object.keys(multiPathPointSelection.value).forEach((key) => {
            if (key.startsWith(`${String(row.id)}::`)) {
                delete multiPathPointSelection.value[key];
            }
        });
    }
    multiPathDraft.value.paths.splice(index, 1);
};

const moveMultiPathRow = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= multiPathDraft.value.paths.length) return;
    const list = multiPathDraft.value.paths;
    const [row] = list.splice(index, 1);
    list.splice(nextIndex, 0, row);
};

const updateMultiPathRowId = (index, value) => {
    const row = multiPathDraft.value.paths[index];
    if (!row) return;
    const oldId = String(row.id || '');
    const nextId = String(value || '').trim();
    row.id = nextId;

    if (multiPathPickingTarget.value.pathId === oldId) {
        multiPathPickingTarget.value.pathId = nextId;
    }

    if (oldId && oldId !== nextId) {
        const oldCollapsed = multiPathCollapsedRows.value[oldId];
        if (oldCollapsed !== undefined) {
            delete multiPathCollapsedRows.value[oldId];
            if (nextId) multiPathCollapsedRows.value[nextId] = oldCollapsed;
        }

        Object.keys(multiPathPointSelection.value).forEach((selectionKey) => {
            if (!selectionKey.startsWith(`${oldId}::`)) return;
            const suffix = selectionKey.slice(oldId.length + 2);
            const currentValue = multiPathPointSelection.value[selectionKey];
            delete multiPathPointSelection.value[selectionKey];
            if (nextId) {
                multiPathPointSelection.value[`${nextId}::${suffix}`] = currentValue;
            }
        });
    }
};

const focusAccordionSection = async (key) => {
    await nextTick();
    const item = document.querySelector(`[data-accordion-key="${key}"]`);
    if (!item) return;
    if (item.getAttribute('data-expanded') !== 'true') {
        item.querySelector('.accordion-header')?.click();
    }
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

const addMultiPathPoint = (pathIndex) => {
    const row = multiPathDraft.value.paths[pathIndex];
    if (!row) return;
    const last = Array.isArray(row.data[row.data.length - 1]) ? row.data[row.data.length - 1] : [0, 0, 0];
    row.data.push([toNumberSafe(last[0], 0), toNumberSafe(last[1], 0), toNumberSafe(last[2], 0)]);
    const pointIndex = row.data.length - 1;
    multiPathPointSelection.value[getMultiPathPointSelectionKey(row.id, pointIndex)] = '';
};

const removeMultiPathPoint = (pathIndex, pointIndex) => {
    const row = multiPathDraft.value.paths[pathIndex];
    if (!row || !Array.isArray(row.data) || row.data.length <= 2) return;
    const selectionValues = getMultiPathPointSelections(row.id, row.data.length);
    row.data.splice(pointIndex, 1);
    selectionValues.splice(pointIndex, 1);
    applyMultiPathPointSelections(row.id, selectionValues);
};

const moveMultiPathPoint = (pathIndex, pointIndex, delta) => {
    const row = multiPathDraft.value.paths[pathIndex];
    if (!row || !Array.isArray(row.data)) return;
    const nextIndex = pointIndex + delta;
    if (nextIndex < 0 || nextIndex >= row.data.length) return;
    const selectionValues = getMultiPathPointSelections(row.id, row.data.length);
    const [point] = row.data.splice(pointIndex, 1);
    row.data.splice(nextIndex, 0, point);
    const [selectedValue] = selectionValues.splice(pointIndex, 1);
    selectionValues.splice(nextIndex, 0, selectedValue);
    applyMultiPathPointSelections(row.id, selectionValues);
};

const updateMultiPathPointAxis = (pathIndex, pointIndex, axisIndex, value) => {
    const row = multiPathDraft.value.paths[pathIndex];
    if (!row || !Array.isArray(row.data) || !Array.isArray(row.data[pointIndex])) return;
    row.data[pointIndex][axisIndex] = toNumberSafe(value, 0);
};

const getMultiPathPointSelection = (pathId, pointIndex) => {
    return multiPathPointSelection.value[getMultiPathPointSelectionKey(pathId, pointIndex)] || '';
};

const setMultiPathPointSelection = (pathId, pointIndex, pointId) => {
    multiPathPointSelection.value[getMultiPathPointSelectionKey(pathId, pointIndex)] = String(pointId || '');
};

const getMultiPathPointSelections = (pathId, pointCount) => {
    const values = [];
    for (let i = 0; i < pointCount; i++) {
        values.push(getMultiPathPointSelection(pathId, i));
    }
    return values;
};

const applyMultiPathPointSelections = (pathId, values) => {
    Object.keys(multiPathPointSelection.value).forEach((key) => {
        if (key.startsWith(`${String(pathId)}::`)) {
            delete multiPathPointSelection.value[key];
        }
    });

    values.forEach((value, index) => {
        multiPathPointSelection.value[getMultiPathPointSelectionKey(pathId, index)] = String(value || '');
    });
};

const applyBuildingPointToMultiPathPoint = (pathIndex, pointIndex) => {
    const row = multiPathDraft.value.paths[pathIndex];
    if (!row?.data?.[pointIndex]) return;

    const selectedPointId = getMultiPathPointSelection(row.id, pointIndex);
    if (!selectedPointId) {
        toast.warning('请先选择点位');
        return;
    }

    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    const point = points.find((item) => String(item?.id || '') === String(selectedPointId));
    if (!point) {
        toast.error('未找到对应点位数据');
        return;
    }

    const [x, y, z] = ensureVec3(point.position, [0, 0, 0]).map((n) => round4(n));
    row.data[pointIndex] = [x, y, z];
    toast.success('已应用点位坐标');
};

const showMultiPathPickConfirm = computed({
    get: () => {
        const pc = componentStore.buildingPickConfirm;
        return !!pc?.visible
            && !!multiPathPickingComponentId.value
            && pc?.componentId === multiPathPickingComponentId.value;
    },
    set: (value) => {
        if (!value) componentStore.clearBuildingPickConfirm();
    }
});

const multiPathPickXyz = computed(() => {
    const pc = componentStore.buildingPickConfirm;
    const xyz = pc?.componentId === multiPathPickingComponentId.value ? pc?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const startMultiPathPicking = (pathIndex, pointIndex) => {
    if (!multiPathPickingComponentId.value) {
        toast.error('当前多轨迹组件未选中，无法拾取');
        return;
    }

    const path = multiPathDraft.value.paths[pathIndex];
    if (!path?.data?.[pointIndex]) {
        toast.error('未找到待拾取的目标点位');
        return;
    }

    multiPathPickingTarget.value = {
        pathId: String(path.id || ''),
        pathIndex,
        pointIndex
    };
    suppressMultiPathModalCloseCleanup.value = true;
    multiPathModalMinimizedByPicking.value = true;
    showMultiPathModal.value = false;

    componentStore.startBuildingPicking(
        multiPathPickingComponentId.value,
        `multi-path:${pathIndex}:${pointIndex}`
    );
    toast.info('请点击场景中的模型表面拾取坐标');
};

const stopMultiPathPicking = () => {
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();

    if (multiPathModalMinimizedByPicking.value) {
        showMultiPathModal.value = true;
        multiPathModalMinimizedByPicking.value = false;
    }
};

const confirmMultiPathPickConfirm = () => {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== multiPathPickingComponentId.value) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const { pathId, pathIndex, pointIndex } = multiPathPickingTarget.value || {};
    let resolvedPathIndex = Number.isInteger(pathIndex) ? pathIndex : -1;
    if (pathId) {
        const byIdIndex = multiPathDraft.value.paths.findIndex((path) => String(path?.id || '') === String(pathId));
        if (byIdIndex !== -1) {
            resolvedPathIndex = byIdIndex;
        }
    }

    const row = multiPathDraft.value.paths[resolvedPathIndex];
    if (!row?.data?.[pointIndex]) {
        componentStore.clearBuildingPickConfirm();
        componentStore.stopBuildingPicking();
        toast.error('未找到待更新的点位');
        return;
    }

    const [x, y, z] = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => round4(n));
    row.data[pointIndex] = [x, y, z];

    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();

    if (multiPathModalMinimizedByPicking.value) {
        showMultiPathModal.value = true;
        multiPathModalMinimizedByPicking.value = false;
    }

    toast.success('路径点位坐标已更新');
};

const cancelMultiPathPickConfirm = () => {
    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();
    if (multiPathModalMinimizedByPicking.value) {
        showMultiPathModal.value = true;
        multiPathModalMinimizedByPicking.value = false;
    }
};

const saveMultiPathAnimationDraft = () => {
    const normalized = normalizeMultiPathDraft(multiPathDraft.value);
    updateConfig('paths', normalized.paths);
    showMultiPathModal.value = false;
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    multiPathModalMinimizedByPicking.value = false;
    multiPathPickingTarget.value = { pathId: '', pathIndex: -1, pointIndex: -1 };
    toast.success('路径数据已更新');
};

watch(showMultiPathModal, (visible) => {
    if (visible) {
        suppressMultiPathModalCloseCleanup.value = false;
        return;
    }

    if (suppressMultiPathModalCloseCleanup.value) {
        suppressMultiPathModalCloseCleanup.value = false;
        return;
    }

    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    multiPathModalMinimizedByPicking.value = false;
    multiPathPickingTarget.value = { pathId: '', pathIndex: -1, pointIndex: -1 };
});

watch(
    () => [componentStore.buildingPicking?.active, showMultiPathPickConfirm.value],
    ([active, confirming]) => {
        if (!multiPathModalMinimizedByPicking.value) return;
        if (active || confirming) return;
        showMultiPathModal.value = true;
        multiPathModalMinimizedByPicking.value = false;
    }
);

// MigrationLine 线条列表弹窗状态
const showMigrationLineModal = ref(false);
const migrationLineDraftList = ref([]);
const migrationLineCollapsedRows = ref({});
const migrationLinePointSelection = ref({});
const migrationLinePickingComponentId = ref('');
const migrationLinePickingTarget = ref({ lineId: '', lineIndex: -1, pointIndex: -1 });
const migrationLineModalMinimizedByPicking = ref(false);
const suppressMigrationLineModalCloseCleanup = ref(false);

const getMigrationLineRowKey = (index) => {
    const row = migrationLineDraftList.value[index];
    return String(row?.id || `migration-line-${index}`);
};

const getMigrationPointSelectionKey = (lineId, pointIndex) => {
    return `${String(lineId || '')}::${Number(pointIndex)}`;
};

const isMigrationLineCollapsed = (index) => {
    const key = getMigrationLineRowKey(index);
    return !!migrationLineCollapsedRows.value[key];
};

const toggleMigrationLineCollapsed = (index) => {
    const key = getMigrationLineRowKey(index);
    migrationLineCollapsedRows.value[key] = !migrationLineCollapsedRows.value[key];
};

const setAllMigrationLineCollapsed = (collapsed) => {
    const next = {};
    migrationLineDraftList.value.forEach((item, index) => {
        const key = item?.id ? String(item.id) : `migration-line-${index}`;
        next[key] = !!collapsed;
    });
    migrationLineCollapsedRows.value = next;
};

const normalizeMigrationPoint = (point, fallback = { x: 0, y: 0, z: 0 }) => {
    const raw = point && typeof point === 'object' ? point : {};
    return {
        x: toNumberSafe(raw.x, fallback.x),
        y: toNumberSafe(raw.y, fallback.y),
        z: toNumberSafe(raw.z, fallback.z)
    };
};

const normalizeMigrationLineRow = (line, index = 0) => {
    const raw = line && typeof line === 'object' ? line : {};
    const pointsRaw = Array.isArray(raw.points) ? raw.points : [];
    const normalizedPoints = pointsRaw.map((point) => normalizeMigrationPoint(point));

    while (normalizedPoints.length < 2) {
        normalizedPoints.push(normalizeMigrationPoint({}, { x: normalizedPoints.length * 5, y: 0, z: 0 }));
    }

    return {
        id: String(raw.id || `line_${Date.now()}_${index}`),
        points: normalizedPoints
    };
};

const openMigrationLineEditor = () => {
    const currentLines = getFieldValue('lines');
    migrationLineDraftList.value = Array.isArray(currentLines)
        ? currentLines.map((line, index) => normalizeMigrationLineRow(line, index))
        : [];

    migrationLinePickingComponentId.value = selectedComponent.value?.id || '';
    migrationLinePickingTarget.value = { lineId: '', lineIndex: -1, pointIndex: -1 };
    migrationLineModalMinimizedByPicking.value = false;

    const nextSelection = {};
    migrationLineDraftList.value.forEach((line) => {
        line.points.forEach((_, pointIndex) => {
            nextSelection[getMigrationPointSelectionKey(line.id, pointIndex)] = '';
        });
    });
    migrationLinePointSelection.value = nextSelection;

    setAllMigrationLineCollapsed(false);
    showMigrationLineModal.value = true;
};

const addEmptyMigrationLineRow = () => {
    const next = normalizeMigrationLineRow({}, migrationLineDraftList.value.length);
    migrationLineDraftList.value.push(next);
    migrationLineCollapsedRows.value[String(next.id)] = false;
    next.points.forEach((_, pointIndex) => {
        migrationLinePointSelection.value[getMigrationPointSelectionKey(next.id, pointIndex)] = '';
    });
};

const removeMigrationLineRow = (index) => {
    const row = migrationLineDraftList.value[index];
    if (row?.id && migrationLinePickingTarget.value.lineId === String(row.id)) {
        migrationLinePickingTarget.value = { lineId: '', lineIndex: -1, pointIndex: -1 };
    }

    if (row?.id) {
        delete migrationLineCollapsedRows.value[String(row.id)];
        Object.keys(migrationLinePointSelection.value).forEach((key) => {
            if (key.startsWith(`${String(row.id)}::`)) {
                delete migrationLinePointSelection.value[key];
            }
        });
    }
    migrationLineDraftList.value.splice(index, 1);
};

const moveMigrationLineRow = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= migrationLineDraftList.value.length) return;
    const list = migrationLineDraftList.value;
    const [row] = list.splice(index, 1);
    list.splice(nextIndex, 0, row);
};

const updateMigrationLineField = (index, key, value) => {
    const row = migrationLineDraftList.value[index];
    if (!row) return;

    if (key === 'id') {
        const oldId = String(row.id || '');
        const nextId = String(value || '').trim();
        row.id = nextId;

        if (migrationLinePickingTarget.value.lineId === oldId) {
            migrationLinePickingTarget.value.lineId = nextId;
        }

        if (oldId && oldId !== nextId) {
            const oldCollapsed = migrationLineCollapsedRows.value[oldId];
            if (oldCollapsed !== undefined) {
                delete migrationLineCollapsedRows.value[oldId];
                if (nextId) migrationLineCollapsedRows.value[nextId] = oldCollapsed;
            }

            Object.keys(migrationLinePointSelection.value).forEach((selectionKey) => {
                if (!selectionKey.startsWith(`${oldId}::`)) return;
                const suffix = selectionKey.slice(oldId.length + 2);
                const currentValue = migrationLinePointSelection.value[selectionKey];
                delete migrationLinePointSelection.value[selectionKey];
                if (nextId) {
                    migrationLinePointSelection.value[`${nextId}::${suffix}`] = currentValue;
                }
            });
        }
        return;
    }

    if (key === 'type') {
        row.type = value === 'particle' ? 'particle' : 'shader';
    }
};

const addMigrationLinePoint = (lineIndex) => {
    const row = migrationLineDraftList.value[lineIndex];
    if (!row) return;
    const last = row.points[row.points.length - 1] || { x: 0, y: 0, z: 0 };
    row.points.push({ x: last.x, y: last.y, z: last.z });
    const pointIndex = row.points.length - 1;
    migrationLinePointSelection.value[getMigrationPointSelectionKey(row.id, pointIndex)] = '';
};

const removeMigrationLinePoint = (lineIndex, pointIndex) => {
    const row = migrationLineDraftList.value[lineIndex];
    if (!row || !Array.isArray(row.points) || row.points.length <= 2) return;
    const selectionValues = getMigrationLinePointSelections(row.id, row.points.length);
    row.points.splice(pointIndex, 1);
    selectionValues.splice(pointIndex, 1);
    applyMigrationLinePointSelections(row.id, selectionValues);
};

const moveMigrationLinePoint = (lineIndex, pointIndex, delta) => {
    const row = migrationLineDraftList.value[lineIndex];
    if (!row || !Array.isArray(row.points)) return;
    const nextIndex = pointIndex + delta;
    if (nextIndex < 0 || nextIndex >= row.points.length) return;

    const selectionValues = getMigrationLinePointSelections(row.id, row.points.length);

    const [point] = row.points.splice(pointIndex, 1);
    row.points.splice(nextIndex, 0, point);
    const [selectedValue] = selectionValues.splice(pointIndex, 1);
    selectionValues.splice(nextIndex, 0, selectedValue);
    applyMigrationLinePointSelections(row.id, selectionValues);
};

const updateMigrationLinePoint = (lineIndex, pointIndex, axis, value) => {
    const row = migrationLineDraftList.value[lineIndex];
    if (!row?.points?.[pointIndex]) return;
    row.points[pointIndex][axis] = toNumberSafe(value, 0);
};

const getMigrationPointSelection = (lineId, pointIndex) => {
    return migrationLinePointSelection.value[getMigrationPointSelectionKey(lineId, pointIndex)] || '';
};

const setMigrationPointSelection = (lineId, pointIndex, pointId) => {
    migrationLinePointSelection.value[getMigrationPointSelectionKey(lineId, pointIndex)] = String(pointId || '');
};

const getMigrationLinePointSelections = (lineId, pointCount) => {
    const values = [];
    for (let i = 0; i < pointCount; i++) {
        values.push(getMigrationPointSelection(lineId, i));
    }
    return values;
};

const applyMigrationLinePointSelections = (lineId, values) => {
    Object.keys(migrationLinePointSelection.value).forEach((key) => {
        if (key.startsWith(`${String(lineId)}::`)) {
            delete migrationLinePointSelection.value[key];
        }
    });

    values.forEach((value, index) => {
        migrationLinePointSelection.value[getMigrationPointSelectionKey(lineId, index)] = String(value || '');
    });
};

const applyBuildingPointToMigrationPoint = (lineIndex, pointIndex) => {
    const row = migrationLineDraftList.value[lineIndex];
    if (!row?.points?.[pointIndex]) return;

    const selectedPointId = getMigrationPointSelection(row.id, pointIndex);
    if (!selectedPointId) {
        toast.warning('请先选择点位');
        return;
    }

    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    const point = points.find((item) => String(item?.id || '') === String(selectedPointId));
    if (!point) {
        toast.error('未找到对应点位数据');
        return;
    }

    const [x, y, z] = ensureVec3(point.position, [0, 0, 0]).map((n) => round4(n));
    row.points[pointIndex] = { x, y, z };
    toast.success('已应用点位坐标');
};

const showMigrationLinePickConfirm = computed({
    get: () => {
        const pc = componentStore.buildingPickConfirm;
        return !!pc?.visible
            && !!migrationLinePickingComponentId.value
            && pc?.componentId === migrationLinePickingComponentId.value;
    },
    set: (value) => {
        if (!value) componentStore.clearBuildingPickConfirm();
    }
});

const migrationLinePickXyz = computed(() => {
    const pc = componentStore.buildingPickConfirm;
    const xyz = pc?.componentId === migrationLinePickingComponentId.value ? pc?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const startMigrationLinePicking = (lineIndex, pointIndex) => {
    if (!migrationLinePickingComponentId.value) {
        toast.error('当前迁移线组件未选中，无法拾取');
        return;
    }

    const line = migrationLineDraftList.value[lineIndex];
    if (!line?.points?.[pointIndex]) {
        toast.error('未找到待拾取的目标点位');
        return;
    }

    migrationLinePickingTarget.value = {
        lineId: String(line.id || ''),
        lineIndex,
        pointIndex
    };
    suppressMigrationLineModalCloseCleanup.value = true;
    migrationLineModalMinimizedByPicking.value = true;
    showMigrationLineModal.value = false;

    componentStore.startBuildingPicking(
        migrationLinePickingComponentId.value,
        `migration-line:${lineIndex}:${pointIndex}`
    );
    toast.info('请点击场景中的模型表面拾取坐标');
};

const stopMigrationLinePicking = () => {
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();

    if (migrationLineModalMinimizedByPicking.value) {
        showMigrationLineModal.value = true;
        migrationLineModalMinimizedByPicking.value = false;
    }
};

const confirmMigrationLinePickConfirm = () => {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== migrationLinePickingComponentId.value) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const { lineId, lineIndex, pointIndex } = migrationLinePickingTarget.value || {};
    let resolvedLineIndex = Number.isInteger(lineIndex) ? lineIndex : -1;
    if (lineId) {
        const byIdIndex = migrationLineDraftList.value.findIndex((line) => String(line?.id || '') === String(lineId));
        if (byIdIndex !== -1) {
            resolvedLineIndex = byIdIndex;
        }
    }

    const row = migrationLineDraftList.value[resolvedLineIndex];
    if (!row?.points?.[pointIndex]) {
        componentStore.clearBuildingPickConfirm();
        componentStore.stopBuildingPicking();
        toast.error('未找到待更新的点位');
        return;
    }

    const [x, y, z] = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => round4(n));
    row.points[pointIndex] = { x, y, z };

    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();

    if (migrationLineModalMinimizedByPicking.value) {
        showMigrationLineModal.value = true;
        migrationLineModalMinimizedByPicking.value = false;
    }

    toast.success('点位坐标已更新');
};

const cancelMigrationLinePickConfirm = () => {
    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();
    if (migrationLineModalMinimizedByPicking.value) {
        showMigrationLineModal.value = true;
        migrationLineModalMinimizedByPicking.value = false;
    }
};

const saveMigrationLineDraft = () => {
    const normalized = migrationLineDraftList.value.map((line, lineIndex) => normalizeMigrationLineRow(line, lineIndex));
    updateConfig('lines', normalized);
    showMigrationLineModal.value = false;
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    migrationLineModalMinimizedByPicking.value = false;
    migrationLinePickingTarget.value = { lineId: '', lineIndex: -1, pointIndex: -1 };
    toast.success('线条列表已更新');
};

watch(showMigrationLineModal, (visible) => {
    if (visible) {
        suppressMigrationLineModalCloseCleanup.value = false;
        return;
    }

    if (suppressMigrationLineModalCloseCleanup.value) {
        suppressMigrationLineModalCloseCleanup.value = false;
        return;
    }

    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    migrationLineModalMinimizedByPicking.value = false;
    migrationLinePickingTarget.value = { lineId: '', lineIndex: -1, pointIndex: -1 };
});

watch(
    () => [componentStore.buildingPicking?.active, showMigrationLinePickConfirm.value],
    ([active, confirming]) => {
        if (!migrationLineModalMinimizedByPicking.value) return;
        if (active || confirming) return;
        showMigrationLineModal.value = true;
        migrationLineModalMinimizedByPicking.value = false;
    }
);

// Heatmap 弹窗状态
const showHeatmapModal = ref(false);
const heatmapDraftPoints = ref([]);
const heatmapDraftColors = ref([]);
const heatmapDraftThresholds = ref([]);

const normalizeHeatmapPoint = (point = {}, index = 0) => {
    const raw = point && typeof point === 'object' ? point : {};
    return {
        id: String(raw.id || `point_${Date.now()}_${index}`),
        x: toNumberSafe(raw.x, 0),
        y: toNumberSafe(raw.y, 0),
        z: toNumberSafe(raw.z, 0),
        value: toNumberSafe(raw.value, 0),
        size: raw.size === '' || raw.size === null || raw.size === undefined ? null : toNumberSafe(raw.size, null)
    };
};

const normalizeHeatmapColorStop = (item = {}, index = 0, total = 1) => {
    if (typeof item === 'string') {
        return {
            stop: total <= 1 ? 0 : index / (total - 1),
            color: item || '#2563eb'
        };
    }

    const raw = item && typeof item === 'object' ? item : {};
    return {
        stop: toNumberSafe(raw.stop, total <= 1 ? 0 : index / (total - 1)),
        color: String(raw.color || '#2563eb')
    };
};

const normalizeHeatmapThreshold = (item = {}) => {
    const raw = item && typeof item === 'object' ? item : {};
    return {
        value: toNumberSafe(raw.value, 0),
        color: String(raw.color || '#22c55e')
    };
};

const openHeatmapEditor = () => {
    const currentData = getFieldValue('data');
    const currentColors = getFieldValue('colors');
    const currentThresholds = getFieldValue('thresholds');

    heatmapDraftPoints.value = Array.isArray(currentData)
        ? currentData.map((item, index) => normalizeHeatmapPoint(item, index))
        : [];

    heatmapDraftColors.value = Array.isArray(currentColors)
        ? currentColors.map((item, index, list) => normalizeHeatmapColorStop(item, index, list.length))
        : [];

    heatmapDraftThresholds.value = Array.isArray(currentThresholds)
        ? currentThresholds.map((item) => normalizeHeatmapThreshold(item))
        : [];

    showHeatmapModal.value = true;
};

const buildHeatmapPointsFromBuildingManager = () => {
    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    if (points.length === 0) {
        return [];
    }

    return points.map((item, index) => {
        const [x, y, z] = ensureVec3(item?.position, [0, 0, 0]).map((n) => round4(n));
        const value = toNumberSafe(item?.value ?? item?.intensity ?? item?.weight, 1);
        const sizeRaw = item?.size;

        return {
            id: String(item?.id || `point_${Date.now()}_${index}`),
            x,
            y,
            z,
            value,
            size: sizeRaw === '' || sizeRaw === null || sizeRaw === undefined ? null : toNumberSafe(sizeRaw, null)
        };
    });
};

const importHeatmapPointsFromBuildingManager = () => {
    const imported = buildHeatmapPointsFromBuildingManager();
    if (imported.length === 0) {
        toast.warning('点位管理中暂无可导入数据');
        return;
    }

    heatmapDraftPoints.value = imported;

    toast.success(`已导入 ${heatmapDraftPoints.value.length} 个点位`);
};

const appendHeatmapPointsFromBuildingManager = () => {
    const imported = buildHeatmapPointsFromBuildingManager();
    if (imported.length === 0) {
        toast.warning('点位管理中暂无可导入数据');
        return;
    }

    const existingIds = new Set(heatmapDraftPoints.value.map((item) => String(item?.id || '')));
    const appended = imported.map((item, index) => {
        let nextId = String(item.id || `point_${Date.now()}_${index}`);
        while (existingIds.has(nextId)) {
            nextId = `${nextId}_${index + 1}`;
        }
        existingIds.add(nextId);
        return {
            ...item,
            id: nextId
        };
    });

    heatmapDraftPoints.value.push(...appended);
    toast.success(`已追加 ${appended.length} 个点位`);
};

const autoGenerateHeatmapPointSize = () => {
    if (heatmapDraftPoints.value.length === 0) {
        toast.warning('暂无热力点可处理');
        return;
    }

    const values = heatmapDraftPoints.value.map((item) => toNumberSafe(item?.value, 0));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const minSize = toNumberSafe(getFieldValue('minSize'), 0.5);
    const maxSize = toNumberSafe(getFieldValue('maxSize'), 6);

    heatmapDraftPoints.value = heatmapDraftPoints.value.map((item) => {
        const value = toNumberSafe(item?.value, 0);
        const alpha = maxValue <= minValue ? 1 : (value - minValue) / (maxValue - minValue);
        return {
            ...item,
            size: round4(minSize + (maxSize - minSize) * alpha)
        };
    });

    toast.success('已根据数值生成点位尺寸');
};

const clearHeatmapPoints = () => {
    heatmapDraftPoints.value = [];
    toast.success('已清空热力点');
};

const addHeatmapPoint = () => {
    heatmapDraftPoints.value.push(normalizeHeatmapPoint({}, heatmapDraftPoints.value.length));
};

const removeHeatmapPoint = (index) => {
    heatmapDraftPoints.value.splice(index, 1);
};

const moveHeatmapPoint = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= heatmapDraftPoints.value.length) return;
    const [row] = heatmapDraftPoints.value.splice(index, 1);
    heatmapDraftPoints.value.splice(nextIndex, 0, row);
};

const updateHeatmapPoint = (index, key, value) => {
    const row = heatmapDraftPoints.value[index];
    if (!row) return;

    if (key === 'size') {
        row.size = value === '' ? null : toNumberSafe(value, null);
        return;
    }

    row[key] = toNumberSafe(value, 0);
};

const addHeatmapColorStop = () => {
    const length = heatmapDraftColors.value.length;
    const defaultStop = length === 0 ? 0 : Math.min(1, length / (length + 1));
    heatmapDraftColors.value.push({ stop: defaultStop, color: '#2563eb' });
};

const removeHeatmapColorStop = (index) => {
    heatmapDraftColors.value.splice(index, 1);
};

const moveHeatmapColorStop = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= heatmapDraftColors.value.length) return;
    const [row] = heatmapDraftColors.value.splice(index, 1);
    heatmapDraftColors.value.splice(nextIndex, 0, row);
};

const updateHeatmapColorStop = (index, key, value) => {
    const row = heatmapDraftColors.value[index];
    if (!row) return;
    if (key === 'stop') {
        row.stop = toNumberSafe(value, 0);
        return;
    }
    row.color = String(value || '#2563eb');
};

const addHeatmapThreshold = () => {
    heatmapDraftThresholds.value.push({ value: 0, color: '#22c55e' });
};

const removeHeatmapThreshold = (index) => {
    heatmapDraftThresholds.value.splice(index, 1);
};

const moveHeatmapThreshold = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= heatmapDraftThresholds.value.length) return;
    const [row] = heatmapDraftThresholds.value.splice(index, 1);
    heatmapDraftThresholds.value.splice(nextIndex, 0, row);
};

const updateHeatmapThreshold = (index, key, value) => {
    const row = heatmapDraftThresholds.value[index];
    if (!row) return;
    if (key === 'value') {
        row.value = toNumberSafe(value, 0);
        return;
    }
    row.color = String(value || '#22c55e');
};

const saveHeatmapDraft = () => {
    const normalizedPoints = heatmapDraftPoints.value.map((item, index) => normalizeHeatmapPoint(item, index));
    const normalizedColors = heatmapDraftColors.value
        .map((item, index, list) => normalizeHeatmapColorStop(item, index, list.length))
        .map((item) => ({
            stop: Math.max(0, Math.min(1, toNumberSafe(item.stop, 0))),
            color: String(item.color || '#2563eb')
        }))
        .sort((a, b) => a.stop - b.stop);

    const normalizedThresholds = heatmapDraftThresholds.value
        .map((item) => normalizeHeatmapThreshold(item))
        .map((item) => ({
            value: toNumberSafe(item.value, 0),
            color: String(item.color || '#22c55e')
        }))
        .sort((a, b) => a.value - b.value);

    updateConfig('data', normalizedPoints);
    updateConfig('colors', normalizedColors);
    updateConfig('thresholds', normalizedThresholds);

    showHeatmapModal.value = false;
    toast.success('热力图数据与映射已更新');
};

// AreaBlock 区域块列表弹窗状态
const showAreaBlockModal = ref(false);
const areaBlockDraftList = ref([]);
const areaBlockCollapsedRows = ref({});
const areaBlockPointSelection = ref({});
const areaBlockPickingComponentId = ref('');
const areaBlockPickingTarget = ref({ areaId: '', areaIndex: -1, pointIndex: -1 });
const areaBlockModalMinimizedByPicking = ref(false);
const suppressAreaBlockModalCloseCleanup = ref(false);

const getAreaBlockRowKey = (index) => {
    const row = areaBlockDraftList.value[index];
    return String(row?.id || `area-block-${index}`);
};

const getAreaBlockPointSelectionKey = (areaId, pointIndex) => {
    return `${String(areaId || '')}::${Number(pointIndex)}`;
};

const isAreaBlockCollapsed = (index) => {
    const key = getAreaBlockRowKey(index);
    return !!areaBlockCollapsedRows.value[key];
};

const toggleAreaBlockCollapsed = (index) => {
    const key = getAreaBlockRowKey(index);
    areaBlockCollapsedRows.value[key] = !areaBlockCollapsedRows.value[key];
};

const setAllAreaBlockCollapsed = (collapsed) => {
    const next = {};
    areaBlockDraftList.value.forEach((item, index) => {
        const key = item?.id ? String(item.id) : `area-block-${index}`;
        next[key] = !!collapsed;
    });
    areaBlockCollapsedRows.value = next;
};

const normalizeAreaBlockPoint = (point, fallback = { x: 0, y: 0, z: 0 }) => {
    if (Array.isArray(point)) {
        return {
            x: toNumberSafe(point[0], fallback.x),
            y: toNumberSafe(point[1], fallback.y),
            z: toNumberSafe(point[2], fallback.z)
        };
    }

    const raw = point && typeof point === 'object' ? point : {};
    return {
        x: toNumberSafe(raw.x, fallback.x),
        y: toNumberSafe(raw.y, fallback.y),
        z: toNumberSafe(raw.z, fallback.z)
    };
};

const normalizeAreaBlockRow = (area, index = 0) => {
    const raw = area && typeof area === 'object' ? area : {};
    const pointsRaw = Array.isArray(raw.points) ? raw.points : [];
    const normalizedPoints = pointsRaw.map((point) => normalizeAreaBlockPoint(point));

    while (normalizedPoints.length < 3) {
        normalizedPoints.push(
            normalizeAreaBlockPoint({}, { x: normalizedPoints.length * 5, y: 0, z: normalizedPoints.length === 1 ? 5 : 0 })
        );
    }

    return {
        id: String(raw.id || `area_${Date.now()}_${index}`),
        points: normalizedPoints
    };
};

const openAreaBlockEditor = () => {
    const currentAreas = getFieldValue('areas');
    areaBlockDraftList.value = Array.isArray(currentAreas)
        ? currentAreas.map((area, index) => normalizeAreaBlockRow(area, index))
        : [];

    areaBlockPickingComponentId.value = selectedComponent.value?.id || '';
    areaBlockPickingTarget.value = { areaId: '', areaIndex: -1, pointIndex: -1 };
    areaBlockModalMinimizedByPicking.value = false;

    const nextSelection = {};
    areaBlockDraftList.value.forEach((area) => {
        area.points.forEach((_, pointIndex) => {
            nextSelection[getAreaBlockPointSelectionKey(area.id, pointIndex)] = '';
        });
    });
    areaBlockPointSelection.value = nextSelection;

    setAllAreaBlockCollapsed(false);
    showAreaBlockModal.value = true;
};

const addEmptyAreaBlockRow = () => {
    const next = normalizeAreaBlockRow({}, areaBlockDraftList.value.length);
    areaBlockDraftList.value.push(next);
    areaBlockCollapsedRows.value[String(next.id)] = false;
    next.points.forEach((_, pointIndex) => {
        areaBlockPointSelection.value[getAreaBlockPointSelectionKey(next.id, pointIndex)] = '';
    });
};

const removeAreaBlockRow = (index) => {
    const row = areaBlockDraftList.value[index];
    if (row?.id && areaBlockPickingTarget.value.areaId === String(row.id)) {
        areaBlockPickingTarget.value = { areaId: '', areaIndex: -1, pointIndex: -1 };
    }

    if (row?.id) {
        delete areaBlockCollapsedRows.value[String(row.id)];
        Object.keys(areaBlockPointSelection.value).forEach((key) => {
            if (key.startsWith(`${String(row.id)}::`)) {
                delete areaBlockPointSelection.value[key];
            }
        });
    }

    areaBlockDraftList.value.splice(index, 1);
};

const moveAreaBlockRow = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= areaBlockDraftList.value.length) return;
    const list = areaBlockDraftList.value;
    const [row] = list.splice(index, 1);
    list.splice(nextIndex, 0, row);
};

const updateAreaBlockField = (index, key, value) => {
    const row = areaBlockDraftList.value[index];
    if (!row) return;

    if (key === 'id') {
        const oldId = String(row.id || '');
        const nextId = String(value || '').trim();
        row.id = nextId;

        if (areaBlockPickingTarget.value.areaId === oldId) {
            areaBlockPickingTarget.value.areaId = nextId;
        }

        if (oldId && oldId !== nextId) {
            const oldCollapsed = areaBlockCollapsedRows.value[oldId];
            if (oldCollapsed !== undefined) {
                delete areaBlockCollapsedRows.value[oldId];
                if (nextId) areaBlockCollapsedRows.value[nextId] = oldCollapsed;
            }

            Object.keys(areaBlockPointSelection.value).forEach((selectionKey) => {
                if (!selectionKey.startsWith(`${oldId}::`)) return;
                const suffix = selectionKey.slice(oldId.length + 2);
                const currentValue = areaBlockPointSelection.value[selectionKey];
                delete areaBlockPointSelection.value[selectionKey];
                if (nextId) {
                    areaBlockPointSelection.value[`${nextId}::${suffix}`] = currentValue;
                }
            });
        }
    }
};

const addAreaBlockPoint = (areaIndex) => {
    const row = areaBlockDraftList.value[areaIndex];
    if (!row) return;

    const last = row.points[row.points.length - 1] || { x: 0, y: 0, z: 0 };
    row.points.push({ x: last.x, y: last.y, z: last.z });
    const pointIndex = row.points.length - 1;
    areaBlockPointSelection.value[getAreaBlockPointSelectionKey(row.id, pointIndex)] = '';
};

const getAreaBlockPointSelection = (areaId, pointIndex) => {
    return areaBlockPointSelection.value[getAreaBlockPointSelectionKey(areaId, pointIndex)] || '';
};

const setAreaBlockPointSelection = (areaId, pointIndex, pointId) => {
    areaBlockPointSelection.value[getAreaBlockPointSelectionKey(areaId, pointIndex)] = String(pointId || '');
};

const getAreaBlockPointSelections = (areaId, pointCount) => {
    const values = [];
    for (let i = 0; i < pointCount; i++) {
        values.push(getAreaBlockPointSelection(areaId, i));
    }
    return values;
};

const applyAreaBlockPointSelections = (areaId, values) => {
    Object.keys(areaBlockPointSelection.value).forEach((key) => {
        if (key.startsWith(`${String(areaId)}::`)) {
            delete areaBlockPointSelection.value[key];
        }
    });

    values.forEach((value, index) => {
        areaBlockPointSelection.value[getAreaBlockPointSelectionKey(areaId, index)] = String(value || '');
    });
};

const removeAreaBlockPoint = (areaIndex, pointIndex) => {
    const row = areaBlockDraftList.value[areaIndex];
    if (!row || !Array.isArray(row.points) || row.points.length <= 3) return;

    const selectionValues = getAreaBlockPointSelections(row.id, row.points.length);
    row.points.splice(pointIndex, 1);
    selectionValues.splice(pointIndex, 1);
    applyAreaBlockPointSelections(row.id, selectionValues);
};

const moveAreaBlockPoint = (areaIndex, pointIndex, delta) => {
    const row = areaBlockDraftList.value[areaIndex];
    if (!row || !Array.isArray(row.points)) return;
    const nextIndex = pointIndex + delta;
    if (nextIndex < 0 || nextIndex >= row.points.length) return;

    const selectionValues = getAreaBlockPointSelections(row.id, row.points.length);

    const [point] = row.points.splice(pointIndex, 1);
    row.points.splice(nextIndex, 0, point);
    const [selectedValue] = selectionValues.splice(pointIndex, 1);
    selectionValues.splice(nextIndex, 0, selectedValue);
    applyAreaBlockPointSelections(row.id, selectionValues);
};

const updateAreaBlockPoint = (areaIndex, pointIndex, axis, value) => {
    const row = areaBlockDraftList.value[areaIndex];
    if (!row?.points?.[pointIndex]) return;
    row.points[pointIndex][axis] = toNumberSafe(value, 0);
};

const applyBuildingPointToAreaBlockPoint = (areaIndex, pointIndex) => {
    const row = areaBlockDraftList.value[areaIndex];
    if (!row?.points?.[pointIndex]) return;

    const selectedPointId = getAreaBlockPointSelection(row.id, pointIndex);
    if (!selectedPointId) {
        toast.warning('请先选择点位');
        return;
    }

    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    const point = points.find((item) => String(item?.id || '') === String(selectedPointId));
    if (!point) {
        toast.error('未找到对应点位数据');
        return;
    }

    const [x, y, z] = ensureVec3(point.position, [0, 0, 0]).map((n) => round4(n));
    row.points[pointIndex] = { x, y, z };
    toast.success('已应用点位坐标');
};

const showAreaBlockPickConfirm = computed({
    get: () => {
        const pc = componentStore.buildingPickConfirm;
        return !!pc?.visible
            && !!areaBlockPickingComponentId.value
            && pc?.componentId === areaBlockPickingComponentId.value;
    },
    set: (value) => {
        if (!value) componentStore.clearBuildingPickConfirm();
    }
});

const areaBlockPickXyz = computed(() => {
    const pc = componentStore.buildingPickConfirm;
    const xyz = pc?.componentId === areaBlockPickingComponentId.value ? pc?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const startAreaBlockPicking = (areaIndex, pointIndex) => {
    if (!areaBlockPickingComponentId.value) {
        toast.error('当前区域块组件未选中，无法拾取');
        return;
    }

    const area = areaBlockDraftList.value[areaIndex];
    if (!area?.points?.[pointIndex]) {
        toast.error('未找到待拾取的目标点位');
        return;
    }

    areaBlockPickingTarget.value = {
        areaId: String(area.id || ''),
        areaIndex,
        pointIndex
    };

    suppressAreaBlockModalCloseCleanup.value = true;
    areaBlockModalMinimizedByPicking.value = true;
    showAreaBlockModal.value = false;

    componentStore.startBuildingPicking(
        areaBlockPickingComponentId.value,
        `area-block:${areaIndex}:${pointIndex}`
    );
    toast.info('请点击场景中的模型表面拾取坐标');
};

const stopAreaBlockPicking = () => {
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();

    if (areaBlockModalMinimizedByPicking.value) {
        showAreaBlockModal.value = true;
        areaBlockModalMinimizedByPicking.value = false;
    }
};

const confirmAreaBlockPickConfirm = () => {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== areaBlockPickingComponentId.value) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const { areaId, areaIndex, pointIndex } = areaBlockPickingTarget.value || {};
    let resolvedAreaIndex = Number.isInteger(areaIndex) ? areaIndex : -1;
    if (areaId) {
        const byIdIndex = areaBlockDraftList.value.findIndex((area) => String(area?.id || '') === String(areaId));
        if (byIdIndex !== -1) {
            resolvedAreaIndex = byIdIndex;
        }
    }

    const row = areaBlockDraftList.value[resolvedAreaIndex];
    if (!row?.points?.[pointIndex]) {
        componentStore.clearBuildingPickConfirm();
        componentStore.stopBuildingPicking();
        toast.error('未找到待更新的点位');
        return;
    }

    const [x, y, z] = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => round4(n));
    row.points[pointIndex] = { x, y, z };

    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();

    if (areaBlockModalMinimizedByPicking.value) {
        showAreaBlockModal.value = true;
        areaBlockModalMinimizedByPicking.value = false;
    }

    toast.success('区域块点位坐标已更新');
};

const cancelAreaBlockPickConfirm = () => {
    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();
    if (areaBlockModalMinimizedByPicking.value) {
        showAreaBlockModal.value = true;
        areaBlockModalMinimizedByPicking.value = false;
    }
};

const saveAreaBlockDraft = () => {
    const normalized = areaBlockDraftList.value.map((area, areaIndex) => normalizeAreaBlockRow(area, areaIndex));
    updateConfig('areas', normalized);
    showAreaBlockModal.value = false;
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    areaBlockModalMinimizedByPicking.value = false;
    areaBlockPickingTarget.value = { areaId: '', areaIndex: -1, pointIndex: -1 };
    toast.success('区域块列表已更新');
};

watch(showAreaBlockModal, (visible) => {
    if (visible) {
        suppressAreaBlockModalCloseCleanup.value = false;
        return;
    }

    if (suppressAreaBlockModalCloseCleanup.value) {
        suppressAreaBlockModalCloseCleanup.value = false;
        return;
    }

    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    areaBlockModalMinimizedByPicking.value = false;
    areaBlockPickingTarget.value = { areaId: '', areaIndex: -1, pointIndex: -1 };
});

watch(
    () => [componentStore.buildingPicking?.active, showAreaBlockPickConfirm.value],
    ([active, confirming]) => {
        if (!areaBlockModalMinimizedByPicking.value) return;
        if (active || confirming) return;
        showAreaBlockModal.value = true;
        areaBlockModalMinimizedByPicking.value = false;
    }
);

// Label3D 标签列表弹窗状态
const showLabel3DLabelsModal = ref(false);
const label3DDraftList = ref([]);
const label3DCollapsedRows = ref({});
const label3DPointSelection = ref({});
const label3DPickingComponentId = ref('');
const label3DModalMinimizedByPicking = ref(false);
const suppressLabel3DModalCloseCleanup = ref(false);
const label3DRenderModeOptions = [
    { label: 'Sprite', value: 'sprite' },
    { label: 'Plane', value: 'plane' }
];

const buildingPointOptions = computed(() => {
    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    return points.map((point, index) => {
        const id = String(point?.id || `point_${index}`);
        const name = String(point?.name || `点位${index + 1}`);
        return {
            value: id,
            label: `${name} (${id})`
        };
    });
});

const getLabel3DRowKey = (index) => {
    const row = label3DDraftList.value[index];
    return String(row?.id || `label-row-${index}`);
};

const isLabel3DCollapsed = (index) => {
    const key = getLabel3DRowKey(index);
    return !!label3DCollapsedRows.value[key];
};

const toggleLabel3DCollapsed = (index) => {
    const key = getLabel3DRowKey(index);
    label3DCollapsedRows.value[key] = !label3DCollapsedRows.value[key];
};

const setAllLabel3DCollapsed = (collapsed) => {
    const next = {};
    label3DDraftList.value.forEach((item, index) => {
        const key = item?.id ? String(item.id) : `label-row-${index}`;
        next[key] = !!collapsed;
    });
    label3DCollapsedRows.value = next;
};

const setLabel3DPointSelection = (labelId, pointId) => {
    if (!labelId) return;
    label3DPointSelection.value[String(labelId)] = String(pointId || '');
};

const showLabel3DPickConfirm = computed({
    get: () => {
        const pc = componentStore.buildingPickConfirm;
        return !!pc?.visible && !!label3DPickingComponentId.value && pc?.componentId === label3DPickingComponentId.value;
    },
    set: (v) => {
        if (!v) componentStore.clearBuildingPickConfirm();
    }
});

const label3DPickXyz = computed(() => {
    const pc = componentStore.buildingPickConfirm;
    const xyz = pc?.componentId === label3DPickingComponentId.value ? pc?.xyz : null;
    return ensureVec3(xyz, [0, 0, 0]);
});

const normalizeLabel3DRow = (item, index = 0) => {
    const raw = item && typeof item === 'object' ? item : {};
    const config = raw.config && typeof raw.config === 'object' ? raw.config : {};

    return {
        id: String(raw.id || `label_${Date.now()}_${index}`),
        label: String(raw.label || `标签 ${index + 1}`),
        position: {
            x: Number(raw.position?.x) || 0,
            y: Number(raw.position?.y) || 0,
            z: Number(raw.position?.z) || 0
        },
        config: {
            renderMode: config.renderMode === 'plane' ? 'plane' : 'sprite',
            autoSize: config.autoSize !== false,
            size: Number(config.size ?? 1) || 1,
            width: Number(config.width ?? 2) || 2,
            height: Number(config.height ?? 1) || 1,
            textColor: String(config.textColor || '#ffffff'),
            backgroundColor: String(config.backgroundColor || 'rgba(0, 0, 0, 0.7)'),
            center: {
                x: Number(config.center?.x ?? 0.5),
                y: Number(config.center?.y ?? 0)
            }
        }
    };
};

const getNormalizedCurrentLabel3DList = () => {
    const currentLabels = getFieldValue('labels');
    return Array.isArray(currentLabels)
        ? currentLabels
            .map((item, index) => normalizeLabel3DRow(item, index))
            .filter((item) => item.id && item.label)
        : [];
};

const openLabel3DLabelsEditor = () => {
    const currentLabels = getFieldValue('labels');
    label3DDraftList.value = Array.isArray(currentLabels)
        ? currentLabels.map((item, index) => normalizeLabel3DRow(item, index))
        : [];
    label3DPickingComponentId.value = selectedComponent.value?.id || '';

    const nextSelection = {};
    label3DDraftList.value.forEach((item) => {
        nextSelection[item.id] = '';
    });
    label3DPointSelection.value = nextSelection;
    setAllLabel3DCollapsed(false);
    showLabel3DLabelsModal.value = true;
};

const addEmptyLabel3DRow = () => {
    const next = normalizeLabel3DRow({}, label3DDraftList.value.length);
    label3DDraftList.value.push(next);
    label3DCollapsedRows.value[String(next.id)] = false;
    label3DPointSelection.value[String(next.id)] = '';
};

const removeLabel3DRow = (index) => {
    const row = label3DDraftList.value[index];
    if (row?.id) {
        delete label3DCollapsedRows.value[String(row.id)];
        delete label3DPointSelection.value[String(row.id)];
    }
    label3DDraftList.value.splice(index, 1);
};

const moveLabel3DRow = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= label3DDraftList.value.length) return;
    const list = label3DDraftList.value;
    const [row] = list.splice(index, 1);
    list.splice(nextIndex, 0, row);
};

const updateLabel3DField = (index, key, value) => {
    const row = label3DDraftList.value[index];
    if (!row) return;

    if (key === 'id') {
        const oldId = String(row.id || '');
        const nextId = String(value || '').trim();
        row[key] = nextId;

        if (oldId && oldId !== nextId) {
            const oldCollapsed = label3DCollapsedRows.value[oldId];
            const oldPoint = label3DPointSelection.value[oldId];
            if (oldCollapsed !== undefined) {
                delete label3DCollapsedRows.value[oldId];
                if (nextId) label3DCollapsedRows.value[nextId] = oldCollapsed;
            }
            if (oldPoint !== undefined) {
                delete label3DPointSelection.value[oldId];
                if (nextId) label3DPointSelection.value[nextId] = oldPoint;
            }
        }
        return;
    }

    row[key] = String(value || '').trim();
};

const updateLabel3DConfig = (index, key, value) => {
    const row = label3DDraftList.value[index];
    if (!row) return;
    if (!row.config || typeof row.config !== 'object') {
        row.config = {};
    }
    row.config[key] = value;

    if (key === 'renderMode' && row.config.renderMode === 'sprite') {
        if (!row.config.center || typeof row.config.center !== 'object') {
            row.config.center = { x: 0.5, y: 0 };
        } else {
            row.config.center.x = Number(row.config.center.x ?? 0.5);
            row.config.center.y = Number(row.config.center.y ?? 0);
        }
    }
};

const updateLabel3DAutoSize = (index, checked) => {
    const row = label3DDraftList.value[index];
    if (!row) return;
    row.config.autoSize = !!checked;
};

const updateLabel3DNumber = (index, path, value, fallback = 0) => {
    const row = label3DDraftList.value[index];
    if (!row) return;

    const parsed = toNumberSafe(value, fallback);

    let target = row;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
        }
        target = target[key];
    }
    target[path[path.length - 1]] = parsed;
};

const applyBuildingPointToLabel = (index) => {
    const row = label3DDraftList.value[index];
    if (!row?.id) return;

    const selectedPointId = label3DPointSelection.value[String(row.id)];
    if (!selectedPointId) {
        toast.warning('请先选择点位');
        return;
    }

    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    const point = points.find((item) => String(item?.id || '') === String(selectedPointId));
    if (!point) {
        toast.error('未找到对应点位数据');
        return;
    }

    const [x, y, z] = ensureVec3(point.position, [0, 0, 0]).map((n) => round4(n));
    row.position = { x, y, z };
    toast.success('已应用点位坐标');
};

const startLabel3DPicking = (rowId) => {
    if (!label3DPickingComponentId.value) {
        toast.error('当前标签组件未选中，无法拾取');
        return;
    }

    suppressLabel3DModalCloseCleanup.value = true;
    label3DModalMinimizedByPicking.value = true;
    showLabel3DLabelsModal.value = false;

    componentStore.startBuildingPicking(label3DPickingComponentId.value, rowId || null);
    toast.info('请点击场景中的模型表面拾取坐标');
};

const stopLabel3DPicking = () => {
    componentStore.stopBuildingPicking();
    if (label3DModalMinimizedByPicking.value) {
        showLabel3DLabelsModal.value = true;
        label3DModalMinimizedByPicking.value = false;
    }
};

const confirmLabel3DPickConfirm = () => {
    const pc = componentStore.buildingPickConfirm;
    if (!pc?.visible || pc?.componentId !== label3DPickingComponentId.value) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const targetId = String(pc.pointId || '');
    if (!targetId) {
        componentStore.clearBuildingPickConfirm();
        return;
    }

    const targetIndex = label3DDraftList.value.findIndex((row) => String(row.id) === targetId);
    if (targetIndex === -1) {
        componentStore.clearBuildingPickConfirm();
        toast.error('未找到待更新的标签项');
        return;
    }

    const [x, y, z] = ensureVec3(pc.xyz, [0, 0, 0]).map((n) => round4(n));
    label3DDraftList.value[targetIndex].position = { x, y, z };
    componentStore.clearBuildingPickConfirm();
    if (label3DModalMinimizedByPicking.value) {
        showLabel3DLabelsModal.value = true;
        label3DModalMinimizedByPicking.value = false;
    }
    toast.success('标签坐标已更新');
};

const cancelLabel3DPickConfirm = () => {
    componentStore.clearBuildingPickConfirm();
    componentStore.stopBuildingPicking();
    if (label3DModalMinimizedByPicking.value) {
        showLabel3DLabelsModal.value = true;
        label3DModalMinimizedByPicking.value = false;
    }
};

const saveLabel3DLabelsDraft = async () => {
    const normalized = label3DDraftList.value
        .map((item, index) => normalizeLabel3DRow(item, index))
        .filter((item) => item.id && item.label);

    const currentNormalized = getNormalizedCurrentLabel3DList();
    const hasChanged = JSON.stringify(currentNormalized) !== JSON.stringify(normalized);

    if (!hasChanged) {
        showLabel3DLabelsModal.value = false;
        componentStore.stopBuildingPicking();
        componentStore.clearBuildingPickConfirm();
        label3DModalMinimizedByPicking.value = false;
        toast.info('标签列表无变化');
        return;
    }

    await updateComponentConfig(selectedComponent.value.id, { labels: normalized });
    showLabel3DLabelsModal.value = false;
    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    label3DModalMinimizedByPicking.value = false;
    toast.success('标签列表已更新');
};

watch(showLabel3DLabelsModal, (visible) => {
    if (visible) {
        suppressLabel3DModalCloseCleanup.value = false;
        return;
    }

    if (suppressLabel3DModalCloseCleanup.value) {
        suppressLabel3DModalCloseCleanup.value = false;
        return;
    }

    componentStore.stopBuildingPicking();
    componentStore.clearBuildingPickConfirm();
    label3DModalMinimizedByPicking.value = false;
});

watch(
    () => [componentStore.buildingPicking?.active, showLabel3DPickConfirm.value],
    ([active, confirming]) => {
        if (!label3DModalMinimizedByPicking.value) return;
        if (active || confirming) return;
        showLabel3DLabelsModal.value = true;
        label3DModalMinimizedByPicking.value = false;
    }
);

// 为指定字段打开资源选择器（用于 type: 'asset' 类型的字段）
const openAssetPickerForField = (field) => {
    // 根据 field.category 设置资源类别，默认为 'model'
    assetPickerCategory.value = field.category || 'model';
    pendingAssetFieldKey.value = field.key;
    pendingAssetCurrentValue.value = String(getFieldValue(field.key) || '').trim();
    showAssetPicker.value = true;
};

const normalizeModelFormat = (value) => {
    const s = String(value || '').toLowerCase().replace(/^\./, '');
    return ['glb', 'gltf', 'fbx'].includes(s) ? s : '';
};

const normalizeSplatFormat = (value) => {
    const s = String(value || '').toLowerCase().replace(/^\./, '');
    return ['ply', 'splat', 'ksplat', 'spz'].includes(s) ? s : '';
};

const getFileExtFromUrlOrName = (value) => {
    if (!value) return '';
    const clean = String(value).split('?')[0].split('#')[0];
    const idx = clean.lastIndexOf('.');
    return idx === -1 ? '' : clean.slice(idx + 1).toLowerCase();
};

const inferModelFormat = (asset) => {
    const candidates = [
        asset?.type,
        asset?.metadata?.fileDetails?.fileType,
        getFileExtFromUrlOrName(asset?.fileName),
        getFileExtFromUrlOrName(asset?.name),
        getFileExtFromUrlOrName(asset?.url)
    ];

    for (const candidate of candidates) {
        const format = normalizeModelFormat(candidate);
        if (format) return format;
    }

    return '';
};

const inferSplatFormat = (asset) => {
    const candidates = [
        asset?.type,
        asset?.metadata?.fileDetails?.fileType,
        getFileExtFromUrlOrName(asset?.fileName),
        getFileExtFromUrlOrName(asset?.name),
        getFileExtFromUrlOrName(asset?.url)
    ];

    for (const candidate of candidates) {
        const format = normalizeSplatFormat(candidate);
        if (format) return format;
    }

    return '';
};

// 处理资源选择
const handleAssetSelect = (asset) => {
    if (asset && asset.url && pendingAssetFieldKey.value) {
        if (pendingAssetFieldKey.value === 'url' && isModelLoader.value) {
            const format = inferModelFormat(asset);
            if (format) {
                updateConfig('format', format);
            }
        }

        if (pendingAssetFieldKey.value === 'url' && isGaussianSplatLoader.value) {
            const format = inferSplatFormat(asset);
            if (format) {
                updateConfig('format', format);
            }
        }

        updateConfig(pendingAssetFieldKey.value, asset.url);
    }
    pendingAssetFieldKey.value = '';
    pendingAssetCurrentValue.value = '';
};
</script>

<style scoped>
.property-editor {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-tertiary);
    padding: var(--space-8);
}

.empty-icon {
    margin-bottom: var(--space-4);
    opacity: 0.5;
}

.empty-icon svg {
    stroke: currentColor;
}

.empty-text {
    font-size: var(--font-size-sm);
    text-align: center;
}

.property-content {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.camera-views-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.camera-views-editor__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.camera-views-editor__insert-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    align-items: end;
}

.camera-views-editor__empty {
    padding: var(--space-4);
    text-align: center;
    color: var(--color-text-tertiary);
    border: 1px dashed var(--color-border);
    border-radius: var(--border-radius-sm);
}

.camera-views-editor__list {
    max-height: 420px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.camera-view-item {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: var(--color-bg-tertiary);
}

.camera-view-item__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
}

.camera-view-item__title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.camera-view-item__ops {
    display: flex;
    gap: var(--space-1);
}

.camera-view-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
}

.camera-view-grid--compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.label3d-editor-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.label3d-section {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: color-mix(in srgb, var(--color-bg-secondary) 92%, transparent);
}

.label3d-section__title {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--space-2);
}

.camera-view-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.camera-view-field label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
}

.camera-view-field--full {
    grid-column: 1 / -1;
}

.common-transform-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.common-visibility-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: rgba(15, 23, 42, 0.36);
}

.common-visibility-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
}

.common-visibility-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.common-visibility-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.common-visibility-summary {
    min-width: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.common-visibility-desc {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
}

.common-visibility-compact-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    width: 100%;
}

.common-visibility-compact-item {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
    padding: 7px 8px;
    border: 1px solid rgba(148, 163, 184, 0.13);
    border-radius: var(--border-radius-sm);
    background: rgba(10, 15, 24, 0.42);
}

.common-visibility-switch {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.common-visibility-switch input[type="checkbox"] {
    width: 14px;
    height: 14px;
}

.common-visibility-switch-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.common-visibility-state-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: 0;
}

.common-visibility-state {
    min-width: 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.common-visibility-state.active {
    color: #9ec7ff;
}

.variable-bind-icon {
    flex: 0 0 24px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm);
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        color var(--transition-fast);
}

.variable-bind-icon svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.variable-bind-icon:hover,
.variable-bind-icon.active {
    border-color: rgba(47, 125, 244, 0.5);
    background: rgba(47, 125, 244, 0.15);
    color: #9ec7ff;
}

.variable-binding-modal {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.variable-binding-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.variable-binding-field label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.variable-binding-current {
    padding: var(--space-2);
    border: 1px solid rgba(47, 125, 244, 0.18);
    border-radius: var(--border-radius-sm);
    background: rgba(47, 125, 244, 0.08);
    color: #bfdbfe;
    font-size: var(--font-size-xs);
}

.lowcode-summary-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
}

.lowcode-summary-card {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-3);
    background: var(--color-bg-tertiary);
}

.lowcode-summary-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
}

.lowcode-summary-card__title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.lowcode-summary-card__desc {
    margin-top: 2px;
    font-size: var(--font-size-xs);
    line-height: 1.5;
    color: var(--color-text-tertiary);
}

.lowcode-summary-card__metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
}

.lowcode-summary-card__metric {
    min-width: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
}

.lowcode-summary-card__metric span {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
}

.lowcode-summary-card__metric strong {
    display: block;
    margin-top: 2px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.advanced-raw-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.advanced-raw-item {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    padding: var(--space-2);
    background: var(--color-bg-tertiary);
}

.advanced-raw-item summary {
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
}

.advanced-raw-textarea {
    width: 100%;
    min-height: 96px;
    margin-top: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    line-height: 1.5;
    resize: vertical;
}

.advanced-raw-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

@media (max-width: 480px) {
    .common-visibility-compact-grid {
        grid-template-columns: 1fr;
    }
}
</style>

