<template>
    <Modal
        :model-value="modelValue"
        title="事件蓝图编辑器"
        width="90vw"
        :draggable="false"
        :close-on-click-outside="false"
        @update:model-value="emit('update:modelValue', $event)"
        @close="handleCancel"
    >
        <div class="blueprint-shell" @keydown.stop @keyup.stop>
            <aside class="blueprint-sidebar">
                <div class="sidebar-title">节点类型</div>

                <div class="palette-group">
                    <div class="palette-title">事件入口</div>
                    <div
                        v-for="item in eventPaletteItems"
                        :key="item.eventType"
                        class="palette-item palette-item--event"
                        draggable="true"
                        @dragstart="handlePaletteDragStart($event, { type: 'trigger', eventType: item.eventType })"
                    >
                        <span>{{ item.label }}</span>
                    </div>
                </div>

                <div class="palette-group">
                    <div class="palette-title">流程控制</div>
                    <div
                        class="palette-item palette-item--flow"
                        draggable="true"
                        @dragstart="handlePaletteDragStart($event, { type: 'condition' })"
                    >
                        判断条件
                    </div>
                </div>

                <div class="palette-group">
                    <div class="palette-title">执行动作</div>
                    <div
                        class="palette-item palette-item--action"
                        draggable="true"
                        @dragstart="handlePaletteDragStart($event, { type: 'method' })"
                    >
                        调用组件方法
                    </div>
                    <div
                        class="palette-item palette-item--variable"
                        draggable="true"
                        @dragstart="handlePaletteDragStart($event, { type: 'variable' })"
                    >
                        设置变量
                    </div>
                </div>

                <details class="palette-group palette-group--advanced">
                    <summary class="palette-title">高级节点</summary>
                    <div
                        class="palette-item palette-item--code"
                        draggable="true"
                        @dragstart="handlePaletteDragStart($event, { type: 'code' })"
                    >
                        自定义脚本
                    </div>
                </details>
            </aside>

            <main class="blueprint-main">
                <div class="blueprint-toolbar">
                    <div class="toolbar-title">
                        <strong>{{ component?.name || '未选中组件' }}</strong>
                        <span>{{ triggerNodes.length }} 个事件入口</span>
                    </div>
                    <div class="toolbar-actions">
                        <Button variant="outline" size="sm" @click="autoLayout">自动排列</Button>
                        <Button variant="outline" size="sm" @click="addTriggerAtDefaultPosition">添加入口</Button>
                    </div>
                </div>

                <div
                    ref="canvasRef"
                    class="blueprint-canvas"
                    @dragover.prevent
                    @drop="handleCanvasDrop"
                    @mousedown="handleCanvasMouseDown"
                    @contextmenu.prevent="closeContextMenu"
                >
                    <svg class="edge-layer">
                        <path
                            v-for="edge in draft.edges"
                            :key="edge.id"
                            class="edge-path"
                            :class="{ selected: selectedEdgeId === edge.id }"
                            :d="getEdgePath(edge)"
                            @mousedown.stop="selectEdge(edge.id)"
                            @contextmenu.prevent.stop="openEdgeContextMenu(edge.id, $event)"
                        />
                        <path
                            v-if="connecting"
                            class="edge-path edge-path--preview"
                            :d="getPreviewEdgePath()"
                        />
                    </svg>

                    <div
                        v-for="node in draft.nodes"
                        :key="node.id"
                        class="flow-node"
                        :class="[
                            `flow-node--${node.type}`,
                            { selected: selectedNodeId === node.id }
                        ]"
                        :style="{ left: `${node.x}px`, top: `${node.y}px` }"
                        @mousedown.left.stop="startNodeDrag($event, node)"
                        @click.stop="selectNode(node.id)"
                        @contextmenu.prevent.stop="openNodeContextMenu(node.id, $event)"
                    >
                        <button
                            v-if="node.type !== 'root'"
                            class="node-handle node-handle--input"
                            type="button"
                            @mouseup.stop="finishConnect(node)"
                        />
                        <div class="node-header">
                            <span class="node-type">{{ getNodeTypeLabel(node) }}</span>
                            <span v-if="node.type === 'trigger' && node.data.enabled === false" class="node-badge">停用</span>
                        </div>
                        <div class="node-body">
                            {{ getNodeSummary(node) }}
                        </div>
                        <button
                            v-if="node.type !== 'code'"
                            class="node-handle node-handle--output"
                            type="button"
                            @mousedown.stop="startConnect(node, $event)"
                        />
                        <button
                            v-else
                            class="node-handle node-handle--output"
                            type="button"
                            @mousedown.stop="startConnect(node, $event)"
                        />
                    </div>

                    <div
                        v-if="contextMenu.visible"
                        class="context-menu"
                        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
                        @mousedown.stop
                    >
                        <button v-if="contextMenu.kind === 'node'" @click="deleteSelectedNode">删除节点</button>
                        <button v-if="contextMenu.kind === 'edge'" @click="deleteSelectedEdge">删除连线</button>
                    </div>
                </div>
            </main>

            <aside class="blueprint-inspector">
                <div class="inspector-title">节点属性</div>
                <div v-if="!selectedNode" class="inspector-empty">选择一个节点进行配置</div>

                <template v-else>
                    <div class="form-group">
                        <label>节点名称</label>
                        <input
                            v-model="selectedNode.data.label"
                            class="form-input"
                            :disabled="selectedNode.type === 'root'"
                        />
                    </div>

                    <template v-if="selectedNode.type === 'trigger'">
                        <div class="form-group">
                            <label>事件类型</label>
                            <Select
                                :model-value="selectedNode.data.eventType"
                                :options="eventTypeOptions"
                                @update:model-value="(value) => updateSelectedNodeData({ eventType: value })"
                            />
                        </div>
                        <label class="checkbox-row">
                            <input
                                type="checkbox"
                                :checked="selectedNode.data.enabled !== false"
                                @change="updateSelectedNodeData({ enabled: $event.target.checked })"
                            />
                            启用事件入口
                        </label>

                        <div v-if="shouldShowTargetFilter(selectedNode)" class="target-filter-section">
                            <div class="target-filter-header">
                                <div>
                                    <div class="target-filter-title">命中目标</div>
                                    <div class="target-filter-summary">{{ selectedTargetSummary }}</div>
                                </div>
                                <span class="target-filter-count">{{ modelMeshCount }} Mesh</span>
                            </div>

                            <div class="target-mode-tabs">
                                <button
                                    v-for="mode in targetModeOptions"
                                    :key="mode.value"
                                    type="button"
                                    class="target-mode-tab"
                                    :class="{ active: selectedTargetModeValue === mode.value }"
                                    @click="setSelectedTargetMode(mode.value)"
                                >
                                    {{ mode.label }}
                                </button>
                            </div>

                            <div v-if="selectedTargetFilter.mode === 'all'" class="target-filter-warning">
                                全部模式会把当前模型的 Mesh 全部加入射线检测，仅适合小模型。
                            </div>

                            <template v-else>
                                <div class="target-actions">
                                    <input
                                        v-model="targetSearchQuery"
                                        class="form-input"
                                        placeholder="搜索 Mesh / 物体节点"
                                    />
                                    <button
                                        type="button"
                                        class="text-btn"
                                        @click="toggleEventTargetPicking"
                                    >
                                        {{ isEventTargetPickingActive ? '停止拾取' : '场景拾取' }}
                                    </button>
                                    <button type="button" class="text-btn" @click="clearSelectedTargets">清空</button>
                                </div>

                                <label class="checkbox-row target-checkbox-row">
                                    <input
                                        type="checkbox"
                                        :checked="selectedTargetFilter.includeChildren !== false"
                                        @change="setSelectedTargetIncludeChildren($event.target.checked)"
                                    />
                                    物体节点包含下级 Mesh
                                </label>

                                <div class="target-tree-title">当前模型结构</div>

                                <div v-if="modelTargetTree.length === 0" class="target-empty">
                                    模型未加载或没有可选择的结构节点。
                                </div>
                                <div v-else class="target-tree">
                                    <div
                                        v-for="item in renderedVisibleTargetNodes"
                                        :key="item.node.id"
                                        class="target-tree-row"
                                        :class="{ selected: isTargetNodeSelected(item.node), disabled: !isTargetNodeSelectable(item.node) }"
                                        :style="{ paddingLeft: `${8 + item.level * 14}px` }"
                                        @click="toggleTargetNode(item.node)"
                                    >
                                        <button
                                            v-if="item.node.children?.length"
                                            type="button"
                                            class="target-expand-btn"
                                            @click.stop="toggleTargetNodeExpanded(item.node.id)"
                                        >
                                            {{ isTargetNodeExpanded(item.node.id) ? '▾' : '▸' }}
                                        </button>
                                        <span v-else class="target-expand-spacer"></span>
                                        <input
                                            type="checkbox"
                                            :checked="isTargetNodeSelected(item.node)"
                                            :disabled="!isTargetNodeSelectable(item.node)"
                                            @click.stop
                                            @change="toggleTargetNode(item.node)"
                                        />
                                        <span class="target-node-name" :title="item.node.nodePath || item.node.name">
                                            {{ item.node.name }}
                                        </span>
                                        <span class="target-node-type">{{ item.node.isMesh ? 'Mesh' : item.node.type }}</span>
                                    </div>
                                    <div v-if="visibleTargetOverflowCount > 0" class="target-tree-overflow">
                                        已显示前 {{ TARGET_TREE_RENDER_LIMIT }} 条，剩余 {{ visibleTargetOverflowCount }} 条请通过搜索或场景拾取定位。
                                    </div>
                                </div>

                                <div v-if="selectedTargetTags.length" class="target-tags">
                                    <button
                                        v-for="tag in selectedTargetTags"
                                        :key="tag.key"
                                        type="button"
                                        class="target-tag"
                                        @click="removeSelectedTarget(tag)"
                                    >
                                        {{ tag.label }} ×
                                    </button>
                                </div>
                            </template>
                        </div>
                    </template>

                    <template v-if="selectedNode.type === 'condition'">
                        <div class="form-group">
                            <label>判断模式</label>
                            <Select
                                :model-value="selectedConditionMode"
                                :options="conditionModeOptions"
                                @update:model-value="handleConditionModeChange"
                            />
                        </div>

                        <div class="form-group">
                            <div class="param-header">
                                <label>数据来源</label>
                                <button class="text-btn" type="button" @click="addSelectedConditionInput">添加</button>
                            </div>
                            <div v-if="selectedConditionInputs.length === 0" class="field-hint">
                                配置参与判断的数据，并设置引用名称供条件使用。
                            </div>
                            <div
                                v-for="(input, index) in selectedConditionInputs"
                                :key="input.id || index"
                                class="condition-input"
                            >
                                <div class="condition-input-row">
                                    <input
                                        v-model="input.alias"
                                        class="form-input code-field"
                                        placeholder="引用名称，如 status"
                                    />
                                    <Select
                                        :model-value="input.source || 'variable'"
                                        :options="conditionSourceOptions"
                                        @update:model-value="(value) => handleConditionInputSourceChange(input, value)"
                                    />
                                    <button class="icon-btn" type="button" @click="removeSelectedConditionInput(index)">×</button>
                                </div>

                                <div v-if="input.source === 'variable'" class="condition-input-body">
                                    <Select
                                        :model-value="input.variableName"
                                        :options="variableOptions"
                                        placeholder="选择全局变量"
                                        @update:model-value="(value) => { input.variableName = value; }"
                                    />
                                    <input v-model="input.path" class="form-input code-field" placeholder="字段路径（可选），如 level" />
                                </div>

                                <div v-else-if="input.source === 'localStorage' || input.source === 'sessionStorage'" class="condition-input-body">
                                    <input v-model="input.key" class="form-input code-field" placeholder="缓存键名，如 token" />
                                    <input v-model="input.path" class="form-input code-field" placeholder="字段路径（可选），如 user.name" />
                                </div>

                                <div v-else-if="input.source === 'eventData'" class="condition-input-body">
                                    <input v-model="input.path" class="form-input code-field" placeholder="字段路径（可选），如 value" />
                                </div>

                                <div v-else-if="input.source === 'eventArg'" class="condition-input-body condition-input-body--two">
                                    <input v-model="input.argIndex" class="form-input code-field" placeholder="参数索引，如 0" />
                                    <input v-model="input.path" class="form-input code-field" placeholder="字段路径（可选）" />
                                </div>

                                <div v-else-if="input.source === 'componentConfig' || input.source === 'componentInstance'" class="condition-input-body">
                                    <Select
                                        :model-value="input.componentId"
                                        :options="conditionComponentOptions"
                                        placeholder="默认使用当前组件"
                                        @update:model-value="(value) => { input.componentId = value; }"
                                    />
                                    <input v-model="input.path" class="form-input code-field" placeholder="组件字段路径，如 config.visible" />
                                </div>

                                <div v-else-if="input.source === 'publicSource'" class="condition-input-body">
                                    <Select
                                        :model-value="input.publicSourceId"
                                        :options="publicSourceOptions"
                                        placeholder="选择公共接口"
                                        @update:model-value="(value) => { input.publicSourceId = value; }"
                                    />
                                    <input v-model="input.path" class="form-input code-field" placeholder="返回字段路径（可选），如 total" />
                                </div>

                                <div v-else-if="input.source === 'static'" class="condition-input-body">
                                    <textarea
                                        v-model="input.value"
                                        class="form-textarea code-field condition-mini-editor"
                                        spellcheck="false"
                                        placeholder="常量值，如 10、true、online 或 {&quot;level&quot;: 1}"
                                    />
                                </div>

                                <div v-else-if="input.source === 'code'" class="condition-input-body">
                                    <textarea
                                        v-model="input.code"
                                        class="form-textarea code-field condition-code-editor"
                                        spellcheck="false"
                                        placeholder="async ({ eventData, variables, inputs }) => {\n  return eventData\n}"
                                    />
                                </div>
                            </div>
                        </div>

                        <div v-if="selectedConditionMode === 'expression'" class="form-group">
                            <label>判断条件</label>
                            <textarea
                                v-model="selectedNode.data.expression"
                                class="form-textarea code-field"
                                spellcheck="false"
                                placeholder="status === 'online' && variables.speed > 0"
                            />
                            <div class="field-hint">可使用已配置的数据引用名，也可使用 variables、eventData、eventArgs。</div>
                        </div>

                        <div v-else-if="selectedConditionMode === 'compare'" class="form-group">
                            <label>比较规则</label>
                            <div class="compare-grid">
                                <input
                                    v-model="selectedNode.data.leftExpression"
                                    class="form-input code-field"
                                    placeholder="要比较的值，如 status"
                                />
                                <Select
                                    :model-value="selectedNode.data.operator || 'eq'"
                                    :options="conditionOperatorOptions"
                                    @update:model-value="(value) => updateSelectedNodeData({ operator: value })"
                                />
                                <input
                                    v-model="selectedNode.data.rightExpression"
                                    class="form-input code-field"
                                    placeholder="目标值，如 'online' 或 limit"
                                />
                            </div>
                        </div>

                        <div v-else class="form-group">
                            <label>脚本判断</label>
                            <textarea
                                v-model="selectedNode.data.conditionCode"
                                class="form-textarea code-field code-editor"
                                spellcheck="false"
                                placeholder="async ({ eventData, variables, inputs, getComponent }) => {\n  return true\n}"
                            />
                            <div class="field-hint">返回 true 时继续执行；返回 false 时中止当前分支。</div>
                        </div>
                    </template>

                    <template v-if="selectedNode.type === 'method'">
                        <div class="form-group">
                            <label>目标组件</label>
                            <Select
                                :model-value="selectedNode.data.targetComponentId"
                                :options="componentOptions"
                                placeholder="选择目标组件"
                                @update:model-value="handleMethodTargetChange"
                            />
                        </div>
                        <div class="form-group">
                            <label>调用方法</label>
                            <Select
                                :model-value="selectedNode.data.methodName"
                                :options="selectedMethodOptions"
                                placeholder="选择方法"
                                @update:model-value="handleMethodNameChange"
                            />
                            <div v-if="selectedMethodDescription" class="field-hint">{{ selectedMethodDescription }}</div>
                        </div>

                        <div v-if="shouldShowMethodTargetPicker" class="target-filter-section method-target-section">
                            <div class="target-filter-header">
                                <div>
                                    <div class="target-filter-title">物体(多选)</div>
                                    <div class="target-filter-summary">{{ selectedMethodTargetSummary }}</div>
                                </div>
                                <span class="target-filter-count">{{ selectedMethodMeshCount }} Mesh</span>
                            </div>

                            <div class="target-mode-tabs">
                                <button
                                    v-for="mode in targetModeOptions"
                                    :key="mode.value"
                                    type="button"
                                    class="target-mode-tab"
                                    :class="{ active: selectedMethodTargetModeValue === mode.value }"
                                    @click="setSelectedMethodTargetMode(mode.value)"
                                >
                                    {{ mode.label }}
                                </button>
                            </div>

                            <div v-if="selectedMethodTargetUsesExpression" class="target-filter-warning">
                                当前动作会在事件触发时使用表达式解析目标物体。
                            </div>

                            <div v-else-if="selectedMethodTargetFilter.mode === 'all'" class="target-filter-warning">
                                当前动作会作用于目标模型加载器内的全部 Mesh。
                            </div>

                            <template v-else>
                                <div class="target-actions target-actions--method">
                                    <input
                                        v-model="methodTargetSearchQuery"
                                        class="form-input"
                                        placeholder="搜索 Mesh / 物体节点"
                                    />
                                    <button type="button" class="text-btn" @click="setSelectedMethodTargetToCurrent">当前物体</button>
                                    <button type="button" class="text-btn" @click="clearSelectedMethodTargets">清空</button>
                                </div>

                                <label class="checkbox-row target-checkbox-row">
                                    <input
                                        type="checkbox"
                                        :checked="selectedMethodTargetFilter.includeChildren !== false"
                                        @change="setSelectedMethodTargetIncludeChildren($event.target.checked)"
                                    />
                                    物体节点包含下级 Mesh
                                </label>

                                <div class="target-tree-title">目标模型结构</div>
                                <div v-if="selectedMethodTargetTree.length === 0" class="target-empty">
                                    模型未加载或没有可选择的结构节点。
                                </div>
                                <div v-else class="target-tree">
                                    <div
                                        v-for="item in renderedVisibleMethodTargetNodes"
                                        :key="item.node.id"
                                        class="target-tree-row"
                                        :class="{ selected: isMethodTargetNodeSelected(item.node), disabled: !isMethodTargetNodeSelectable(item.node) }"
                                        :style="{ paddingLeft: `${8 + item.level * 14}px` }"
                                        @click="toggleMethodTargetNode(item.node)"
                                    >
                                        <button
                                            v-if="item.node.children?.length"
                                            type="button"
                                            class="target-expand-btn"
                                            @click.stop="toggleMethodTargetNodeExpanded(item.node.id)"
                                        >
                                            {{ isMethodTargetNodeExpanded(item.node.id) ? '▾' : '▸' }}
                                        </button>
                                        <span v-else class="target-expand-spacer"></span>
                                        <input
                                            type="checkbox"
                                            :checked="isMethodTargetNodeSelected(item.node)"
                                            :disabled="!isMethodTargetNodeSelectable(item.node)"
                                            @click.stop
                                            @change="toggleMethodTargetNode(item.node)"
                                        />
                                        <span class="target-node-name" :title="item.node.nodePath || item.node.name">
                                            {{ item.node.name }}
                                        </span>
                                        <span class="target-node-type">{{ item.node.isMesh ? 'Mesh' : item.node.type }}</span>
                                    </div>
                                    <div v-if="visibleMethodTargetOverflowCount > 0" class="target-tree-overflow">
                                        已显示前 {{ TARGET_TREE_RENDER_LIMIT }} 条，剩余 {{ visibleMethodTargetOverflowCount }} 条请通过搜索定位。
                                    </div>
                                </div>

                                <div v-if="selectedMethodTargetTags.length" class="target-tags">
                                    <button
                                        v-for="tag in selectedMethodTargetTags"
                                        :key="tag.key"
                                        type="button"
                                        class="target-tag"
                                        @click="removeSelectedMethodTarget(tag)"
                                    >
                                        {{ tag.label }} ×
                                    </button>
                                </div>
                            </template>
                        </div>

                        <div v-if="shouldShowCameraJumpPointEditor" class="camera-jump-section">
                            <div class="target-filter-header">
                                <div>
                                    <div class="target-filter-title">跳转点位</div>
                                    <div class="target-filter-summary">
                                        {{ selectedCameraJumpPointSource === 'manager' ? '从点位管理器选择' : '自定义三维坐标' }}
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>点位来源</label>
                                <Select
                                    :model-value="selectedCameraJumpPointSource"
                                    :options="[
                                        { value: 'manager', label: '点位管理器' },
                                        { value: 'manual', label: '自定义坐标' }
                                    ]"
                                    @update:model-value="handleCameraJumpPointSourceChange"
                                />
                            </div>

                            <div v-if="selectedCameraJumpPointSource === 'manager'" class="form-group">
                                <label>点位</label>
                                <Select
                                    :model-value="selectedCameraJumpPointId"
                                    :options="buildingPointOptions"
                                    placeholder="选择点位"
                                    @update:model-value="updateCameraJumpPointId"
                                />
                                <div v-if="buildingPointOptions.length === 0" class="field-hint">点位管理器暂无点位。</div>
                            </div>

                            <div v-else class="form-group">
                                <label>三维坐标</label>
                                <div class="vector3-row">
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpPointPosition.x"
                                        placeholder="X"
                                        step="0.1"
                                        @input="updateCameraJumpPointPosition('x', $event.target.value)"
                                    />
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpPointPosition.y"
                                        placeholder="Y"
                                        step="0.1"
                                        @input="updateCameraJumpPointPosition('y', $event.target.value)"
                                    />
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpPointPosition.z"
                                        placeholder="Z"
                                        step="0.1"
                                        @input="updateCameraJumpPointPosition('z', $event.target.value)"
                                    />
                                </div>
                            </div>
                        </div>

                        <div v-if="shouldShowCameraJumpMeshEditor" class="camera-jump-section">
                            <div class="target-filter-header">
                                <div>
                                    <div class="target-filter-title">跳转模型节点</div>
                                    <div class="target-filter-summary">{{ selectedCameraJumpMeshSummary }}</div>
                                </div>
                                <span class="target-filter-count">{{ selectedCameraJumpMeshCount }} Mesh</span>
                            </div>

                            <div class="form-group">
                                <label>模型组件</label>
                                <Select
                                    :model-value="selectedCameraJumpMeshComponentId"
                                    :options="modelLoaderComponentOptions"
                                    placeholder="选择模型加载器"
                                    @update:model-value="handleCameraJumpMeshComponentChange"
                                />
                            </div>

                            <template v-if="selectedCameraJumpMeshComponentId">
                                <div class="target-actions target-actions--compact">
                                    <input
                                        v-model="cameraJumpMeshSearchQuery"
                                        class="form-input"
                                        placeholder="搜索 Mesh / 模型节点"
                                    />
                                    <button type="button" class="text-btn" @click="clearCameraJumpMeshTarget">清空</button>
                                </div>

                                <label class="checkbox-row target-checkbox-row">
                                    <input
                                        type="checkbox"
                                        :checked="selectedCameraJumpMeshIncludeChildren !== false"
                                        @change="setCameraJumpMeshIncludeChildren($event.target.checked)"
                                    />
                                    模型节点包含下级 Mesh
                                </label>

                                <div class="target-tree-title">目标模型结构</div>
                                <div v-if="selectedCameraJumpMeshTree.length === 0" class="target-empty">
                                    模型未加载或没有可选择的结构节点。
                                </div>
                                <div v-else class="target-tree">
                                    <div
                                        v-for="item in renderedVisibleCameraJumpMeshNodes"
                                        :key="item.node.id"
                                        class="target-tree-row target-tree-row--single"
                                        :class="{ selected: isCameraJumpMeshNodeSelected(item.node), disabled: !isCameraJumpMeshNodeSelectable(item.node) }"
                                        :style="{ paddingLeft: `${8 + item.level * 14}px` }"
                                        @click="selectCameraJumpMeshNode(item.node)"
                                    >
                                        <button
                                            v-if="item.node.children?.length"
                                            type="button"
                                            class="target-expand-btn"
                                            @click.stop="toggleCameraJumpMeshNodeExpanded(item.node.id)"
                                        >
                                            {{ isCameraJumpMeshNodeExpanded(item.node.id) ? '▾' : '▸' }}
                                        </button>
                                        <span v-else class="target-expand-spacer"></span>
                                        <input
                                            type="radio"
                                            :checked="isCameraJumpMeshNodeSelected(item.node)"
                                            :disabled="!isCameraJumpMeshNodeSelectable(item.node)"
                                            @click.stop
                                            @change="selectCameraJumpMeshNode(item.node)"
                                        />
                                        <span class="target-node-name" :title="item.node.nodePath || item.node.name">
                                            {{ item.node.name }}
                                        </span>
                                        <span class="target-node-type">{{ item.node.isMesh ? 'Mesh' : item.node.type }}</span>
                                    </div>
                                    <div v-if="visibleCameraJumpMeshOverflowCount > 0" class="target-tree-overflow">
                                        已显示前 {{ TARGET_TREE_RENDER_LIMIT }} 条，剩余 {{ visibleCameraJumpMeshOverflowCount }} 条请通过搜索定位。
                                    </div>
                                </div>
                            </template>
                        </div>

                        <div v-if="shouldShowCameraJumpPointEditor || shouldShowCameraJumpMeshEditor" class="camera-jump-section camera-jump-section--compact">
                            <div class="target-filter-title">跳转参数</div>
                            <div class="camera-jump-grid">
                                <label>
                                    <span>相机距离</span>
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpPayload.distance ?? 8"
                                        step="0.1"
                                        @input="updateCameraJumpPayloadNumber('distance', $event.target.value, 8)"
                                    />
                                </label>
                                <label>
                                    <span>时长(ms)</span>
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpPayload.duration ?? 1200"
                                        step="100"
                                        @input="updateCameraJumpPayloadNumber('duration', $event.target.value, 1200)"
                                    />
                                </label>
                                <label>
                                    <span>速度</span>
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpPayload.speed ?? 1"
                                        step="0.1"
                                        @input="updateCameraJumpPayloadNumber('speed', $event.target.value, 1)"
                                    />
                                </label>
                                <label class="camera-jump-checkbox">
                                    <input
                                        type="checkbox"
                                        :checked="selectedCameraJumpPayload.autoLookAt !== false"
                                        @change="updateCameraJumpAutoLookAt($event.target.checked)"
                                    />
                                    自动看向目标
                                </label>
                            </div>
                            <div class="form-group">
                                <label>观察方向</label>
                                <div class="vector3-row">
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpDirection.x"
                                        placeholder="X"
                                        step="0.1"
                                        @input="updateCameraJumpDirection('x', $event.target.value)"
                                    />
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpDirection.y"
                                        placeholder="Y"
                                        step="0.1"
                                        @input="updateCameraJumpDirection('y', $event.target.value)"
                                    />
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :value="selectedCameraJumpDirection.z"
                                        placeholder="Z"
                                        step="0.1"
                                        @input="updateCameraJumpDirection('z', $event.target.value)"
                                    />
                                </div>
                            </div>
                        </div>

                        <div v-if="shouldShowMaterialPropsEditor" class="form-group material-props-editor">
                            <div class="param-header">
                                <label>材质属性</label>
                                <button class="text-btn" type="button" @click="addSelectedMaterialProp">添加</button>
                            </div>
                            <div v-if="selectedMaterialPropRows.length === 0" class="field-hint">
                                添加需要批量更新的材质属性。
                            </div>
                            <div
                                v-for="row in selectedMaterialPropRows"
                                :key="row.key"
                                class="material-prop-row"
                            >
                                <Select
                                    :model-value="row.key"
                                    :options="materialPropOptions"
                                    placeholder="选择属性"
                                    @update:model-value="(value) => handleMaterialPropKeyChange(row.key, value)"
                                />

                                <input
                                    v-if="getMaterialPropType(row.key) === 'color'"
                                    class="form-input material-color-input"
                                    type="color"
                                    :value="getMaterialPropInputValue(row.key, row.value)"
                                    @input="updateMaterialPropValue(row.key, $event.target.value)"
                                />

                                <label
                                    v-else-if="getMaterialPropType(row.key) === 'boolean'"
                                    class="checkbox-row material-checkbox-row"
                                >
                                    <input
                                        type="checkbox"
                                        :checked="getMaterialPropInputValue(row.key, row.value)"
                                        @change="updateMaterialPropValue(row.key, $event.target.checked)"
                                    />
                                    {{ getMaterialPropBooleanLabel(row.key, row.value) }}
                                </label>

                                <div
                                    v-else-if="getMaterialPropType(row.key) === 'number'"
                                    class="material-number-field"
                                >
                                    <input
                                        class="material-range-input"
                                        type="range"
                                        :min="getMaterialPropDefinition(row.key)?.min ?? 0"
                                        :max="getMaterialPropDefinition(row.key)?.max ?? 1"
                                        :step="getMaterialPropDefinition(row.key)?.step ?? 0.01"
                                        :value="getMaterialPropInputValue(row.key, row.value)"
                                        @input="updateMaterialPropValue(row.key, $event.target.value)"
                                    />
                                    <input
                                        class="form-input code-field"
                                        type="number"
                                        :min="getMaterialPropDefinition(row.key)?.min"
                                        :max="getMaterialPropDefinition(row.key)?.max"
                                        :step="getMaterialPropDefinition(row.key)?.step ?? 0.01"
                                        :value="getMaterialPropInputValue(row.key, row.value)"
                                        @input="updateMaterialPropValue(row.key, $event.target.value)"
                                    />
                                </div>

                                <Select
                                    v-else-if="getMaterialPropType(row.key) === 'select'"
                                    :model-value="getMaterialPropInputValue(row.key, row.value)"
                                    :options="getMaterialPropDefinition(row.key)?.options || []"
                                    @update:model-value="(value) => updateMaterialPropValue(row.key, value)"
                                />

                                <input
                                    v-else
                                    class="form-input code-field"
                                    :value="String(row.value ?? '')"
                                    placeholder="JS 表达式"
                                    @input="updateMaterialPropValue(row.key, $event.target.value)"
                                />

                                <button class="icon-btn" type="button" @click="removeSelectedMaterialProp(row.key)">×</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <div class="param-header">
                                <label>参数</label>
                                <button class="text-btn" type="button" @click="addSelectedMethodParam">添加</button>
                            </div>
                            <div
                                v-for="item in selectedMethodParameterRows"
                                :key="item.index"
                                class="param-row"
                            >
                                <input
                                    v-model="item.param.key"
                                    class="form-input"
                                    :placeholder="getMethodParamKeyPlaceholder(item.param)"
                                />
                                <Select
                                    :model-value="''"
                                    :options="eventFieldOptions"
                                    placeholder="事件字段"
                                    @update:model-value="(value) => insertMethodParamEventField(item.param, value)"
                                />
                                <input
                                    v-model="item.param.value"
                                    class="form-input code-field"
                                    :placeholder="getMethodParamValuePlaceholder(item.param)"
                                />
                                <button class="icon-btn" type="button" @click="removeSelectedMethodParam(item.index)">×</button>
                            </div>
                        </div>
                    </template>

                    <template v-if="selectedNode.type === 'variable'">
                        <div class="form-group">
                            <label>目标变量</label>
                            <Select
                                :model-value="selectedNode.data.variableName"
                                :options="variableOptions"
                                placeholder="选择变量"
                                @update:model-value="(value) => updateSelectedNodeData({ variableName: value })"
                            />
                        </div>
                        <div class="form-group">
                            <div class="param-header">
                                <label>变量值</label>
                                <Select
                                    :model-value="''"
                                    :options="eventFieldOptions"
                                    placeholder="事件字段"
                                    @update:model-value="insertVariableEventField"
                                />
                            </div>
                            <textarea
                                v-model="selectedNode.data.valueExpression"
                                class="form-textarea code-field"
                                spellcheck="false"
                                placeholder="current.name"
                            />
                            <div class="field-hint">可使用 eventData、current、modelTarget、meshName、nodePath、variables。</div>
                        </div>
                    </template>

                    <template v-if="selectedNode.type === 'code'">
                        <div class="form-group">
                            <label>自定义脚本</label>
                            <textarea
                                v-model="selectedNode.data.code"
                                class="form-textarea code-field code-editor"
                                spellcheck="false"
                                placeholder="async ({ eventData, component, getComponent }) => {}"
                            />
                        </div>
                    </template>

                    <Button
                        v-if="selectedNode.type !== 'root'"
                        variant="outline"
                        size="sm"
                        class="delete-node-btn"
                        @click="deleteSelectedNode"
                    >
                        删除节点
                    </Button>
                </template>
            </aside>
        </div>

        <template #footer>
            <div class="footer-left">
                <span v-if="validationMessage" class="validation-message">{{ validationMessage }}</span>
            </div>
            <Button variant="outline" @click="handleCancel">取消</Button>
            <Button variant="primary" :disabled="disabled" @click="handleSave">保存蓝图</Button>
        </template>
    </Modal>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch, onUnmounted } from 'vue';
import Button from '../ui/Button.vue';
import Select from '../ui/Select.vue';
import Modal from '../ui/Modal.vue';
import { useComponentStore } from '../../stores/useComponentStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useVariableStore } from '../../stores/useVariableStore';
import { useDataSourceStore } from '../../stores/useDataSourceStore';
import { useToast } from '../../composables/useToast';
import { getComponent } from '../../utils/componentRegistry';
import { getEventMetadata, getEventTypesByCategory, EventCategory } from '../../config/eventTypes';

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    component: {
        type: Object,
        default: null
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue', 'save']);
const componentStore = useComponentStore();
const projectStore = useProjectStore();
const variableStore = useVariableStore();
const dataSourceStore = useDataSourceStore();
const toast = useToast();

const NODE_WIDTH = 190;
const NODE_HEIGHT = 74;
const MODEL_LOADER_INTERACTION_EVENTS = new Set(['onClick', 'onDoubleClick', 'onHover', 'onHoverOut']);
const METHOD_TARGET_PARAM_KEY = 'targets';
const MATERIAL_PROPS_PARAM_KEY = 'materialProps';
const CAMERA_JUMP_PAYLOAD_PARAM_KEY = 'payload';
const ALL_CLICK_MESH_LIMIT = 200;
const ALL_HOVER_MESH_LIMIT = 50;
const TARGET_TREE_RENDER_LIMIT = 300;
const TARGET_TREE_AUTO_EXPAND_MESH_LIMIT = 300;

const MATERIAL_PROP_SCHEMA = Object.freeze({
    color: Object.freeze({
        label: '基础颜色',
        type: 'color',
        defaultValue: '#ffffff'
    }),
    opacity: Object.freeze({
        label: '透明度',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5
    }),
    transparent: Object.freeze({
        label: '启用透明',
        type: 'boolean',
        defaultValue: true
    }),
    metalness: Object.freeze({
        label: '金属度',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0
    }),
    roughness: Object.freeze({
        label: '粗糙度',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.5
    }),
    emissive: Object.freeze({
        label: '自发光颜色',
        type: 'color',
        defaultValue: '#000000'
    }),
    emissiveIntensity: Object.freeze({
        label: '自发光强度',
        type: 'number',
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 1
    }),
    wireframe: Object.freeze({
        label: '线框模式',
        type: 'boolean',
        defaultValue: false
    }),
    side: Object.freeze({
        label: '渲染面',
        type: 'select',
        defaultValue: 'FrontSide',
        options: Object.freeze([
            Object.freeze({ label: '正面 (FrontSide)', value: 'FrontSide' }),
            Object.freeze({ label: '背面 (BackSide)', value: 'BackSide' }),
            Object.freeze({ label: '双面 (DoubleSide)', value: 'DoubleSide' })
        ])
    }),
    depthWrite: Object.freeze({
        label: '写入深度',
        type: 'boolean',
        defaultValue: true
    }),
    depthTest: Object.freeze({
        label: '深度测试',
        type: 'boolean',
        defaultValue: true
    }),
    alphaTest: Object.freeze({
        label: 'Alpha 阈值',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0
    }),
    envMapIntensity: Object.freeze({
        label: '环境贴图强度',
        type: 'number',
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 1
    }),
    lightMapIntensity: Object.freeze({
        label: '烘焙光照强度',
        type: 'number',
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 1
    })
});

const canvasRef = ref(null);
const selectedNodeId = ref('');
const selectedEdgeId = ref('');
const validationMessage = ref('');
const paletteDragPayload = ref(null);
const targetSearchQuery = ref('');
const expandedTargetNodes = ref(new Set());
const methodTargetSearchQuery = ref('');
const expandedMethodTargetNodes = ref(new Set());
const cameraJumpMeshSearchQuery = ref('');
const expandedCameraJumpMeshNodes = ref(new Set());
const eventTargetPickingNodeId = ref('');
const eventTargetPickingComponentId = ref('');
const modelStructureRevision = ref(0);
const minimizedForPicking = ref(false);
const skipNextOpenReload = ref(false);
const restoringAfterPicking = ref(false);
const lastHandledPickToken = ref(0);
const dragState = ref(null);
const connecting = ref(null);
const pointerPosition = reactive({ x: 0, y: 0 });
const contextMenu = reactive({
    visible: false,
    kind: '',
    id: '',
    x: 0,
    y: 0
});

const draft = reactive({
    version: 1,
    componentId: '',
    componentName: '',
    nodes: [],
    edges: []
});

const createId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const cloneJson = (value, fallback = null) => {
    try {
        if (value === undefined) return fallback;
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
};

const isPlainObjectValue = (value) => value && typeof value === 'object' && !Array.isArray(value);

const eventTypeOptions = computed(() => {
    const categories = [
        EventCategory.LIFECYCLE,
        EventCategory.INTERACTION,
        EventCategory.DATA,
        EventCategory.ANIMATION
    ];

    return categories.flatMap((category) => (
        getEventTypesByCategory(category).map((type) => {
            const meta = getEventMetadata(type);
            return {
                value: type,
                label: meta?.displayName || type
            };
        })
    ));
});

const eventPaletteItems = computed(() => eventTypeOptions.value.map((item) => ({
    eventType: item.value,
    label: item.label
})));

const triggerNodes = computed(() => draft.nodes.filter((node) => node.type === 'trigger'));
const selectedNode = computed(() => draft.nodes.find((node) => node.id === selectedNodeId.value) || null);

const componentOptions = computed(() => componentStore.components.map((component) => ({
    value: component.id,
    label: component.name || component.id
})));

const modelLoaderComponentOptions = computed(() => (
    componentStore.components
        .filter((component) => component?.type === 'ModelLoader')
        .map((component) => ({
            value: component.id,
            label: `${component.name || 'ModelLoader'} (${component.id})`
        }))
));

const buildingPointOptions = computed(() => {
    const points = Array.isArray(projectStore.buildingPoints) ? projectStore.buildingPoints : [];
    return points.map((point, index) => {
        const id = String(point?.id || `point_${index + 1}`).trim();
        const name = String(point?.name || `点位 ${index + 1}`).trim();
        return {
            value: id,
            label: `${name} (${id})`
        };
    });
});

const materialPropOptions = Object.entries(MATERIAL_PROP_SCHEMA).map(([value, definition]) => ({
    value,
    label: `${definition.label} (${value})`
}));

const eventFieldOptions = [
    { value: 'current.name', label: '当前 Mesh 名称' },
    { value: 'current.nodePath', label: '当前节点路径' },
    { value: 'current.objectUuid', label: '当前对象 UUID' },
    { value: 'current.componentId', label: '当前组件 ID' },
    { value: 'modelTarget', label: '当前目标对象' },
    { value: 'point', label: '命中点坐标' },
    { value: 'point?.x', label: '命中点 X' },
    { value: 'point?.y', label: '命中点 Y' },
    { value: 'point?.z', label: '命中点 Z' },
    { value: 'eventData.type', label: '事件类型' }
];

const getMethodDefinitions = (targetComponentId) => {
    if (!targetComponentId) return [];
    const targetComponent = componentStore.components.find((item) => item.id === targetComponentId);
    if (!targetComponent) return [];
    const registryEntry = getComponent(targetComponent.type);
    return registryEntry?.metadata?.methods || [];
};

const getMethodOptions = (targetComponentId) => (
    getMethodDefinitions(targetComponentId).map((method) => {
        const name = String(method?.name || '').trim();
        const title = String(method?.title || method?.label || name).trim();
        return {
            value: name,
            label: title && title !== name ? `${title} (${name})` : (title || name)
        };
    }).filter((item) => item.value)
);

const selectedMethodOptions = computed(() => getMethodOptions(selectedNode.value?.data?.targetComponentId));
const selectedMethodDefinitions = computed(() => getMethodDefinitions(selectedNode.value?.data?.targetComponentId));
const selectedMethodDefinition = computed(() => {
    const methodName = String(selectedNode.value?.data?.methodName || '').trim().toLowerCase();
    if (!methodName) return null;
    return selectedMethodDefinitions.value.find((method) => String(method?.name || '').trim().toLowerCase() === methodName) || null;
});
const selectedMethodDescription = computed(() => selectedMethodDefinition.value?.description || '');
const selectedMethodParamDefinitions = computed(() => (
    Array.isArray(selectedMethodDefinition.value?.params) ? selectedMethodDefinition.value.params : []
));
const selectedMethodParamDefinitionMap = computed(() => {
    const map = new Map();
    selectedMethodParamDefinitions.value.forEach((param) => {
        const name = String(param?.name || '').trim();
        if (name) map.set(name, param);
    });
    return map;
});

const conditionModeOptions = [
    { value: 'expression', label: '条件表达式' },
    { value: 'compare', label: '字段比较' },
    { value: 'code', label: '脚本判断' }
];

const targetModeOptions = [
    { value: 'target', label: '指定目标' },
    { value: 'all', label: '全部' }
];

const conditionSourceOptions = [
    { value: 'variable', label: '全局变量' },
    { value: 'localStorage', label: '本地存储' },
    { value: 'sessionStorage', label: '会话存储' },
    { value: 'eventData', label: '事件数据' },
    { value: 'eventArg', label: '事件参数' },
    { value: 'componentConfig', label: '组件配置' },
    { value: 'componentInstance', label: '组件实例' },
    { value: 'publicSource', label: '公共接口' },
    { value: 'static', label: '常量' },
    { value: 'code', label: '脚本返回值' }
];

const conditionOperatorOptions = [
    { value: 'truthy', label: '为真' },
    { value: 'falsy', label: '为假' },
    { value: 'eq', label: '等于' },
    { value: 'neq', label: '不等于' },
    { value: 'gt', label: '大于' },
    { value: 'gte', label: '大于等于' },
    { value: 'lt', label: '小于' },
    { value: 'lte', label: '小于等于' },
    { value: 'contains', label: '包含' },
    { value: 'notContains', label: '不包含' },
    { value: 'empty', label: '为空' },
    { value: 'notEmpty', label: '不为空' },
    { value: 'regex', label: '匹配正则' }
];

const variableOptions = computed(() => variableStore.variables.map((variable) => ({
    value: variable.name,
    label: `${variable.name} (${variable.type})`
})));

const publicSourceOptions = computed(() => dataSourceStore.publicDataSourceOptions || []);

const conditionComponentOptions = computed(() => [
    { value: '', label: '当前组件' },
    ...componentStore.components.map((component) => ({
        value: component.id,
        label: component.name || component.id
    }))
]);

const selectedConditionMode = computed(() => {
    if (selectedNode.value?.type !== 'condition') return 'expression';
    return selectedNode.value.data.conditionMode || 'expression';
});

const selectedConditionInputs = computed(() => {
    if (selectedNode.value?.type !== 'condition') return [];
    if (!Array.isArray(selectedNode.value.data.conditionInputs)) {
        selectedNode.value.data.conditionInputs = [];
    }
    return selectedNode.value.data.conditionInputs;
});

const isModelLoaderComponent = computed(() => props.component?.type === 'ModelLoader');
const modelInstance = computed(() => props.component?.instance || null);
const modelTargetTree = computed(() => {
    void modelStructureRevision.value;
    const tree = modelInstance.value?.getModelStructureTree?.();
    return Array.isArray(tree) ? tree : [];
});

const modelMeshCount = computed(() => {
    if (typeof modelInstance.value?.getMeshCount === 'function') {
        return modelInstance.value.getMeshCount();
    }
    const meshes = modelInstance.value?.getAllMeshes?.();
    return Array.isArray(meshes) ? meshes.length : 0;
});

const shouldUseTargetFilter = (eventType) => (
    isModelLoaderComponent.value && MODEL_LOADER_INTERACTION_EVENTS.has(eventType)
);

const shouldShowTargetFilter = (node) => (
    node?.type === 'trigger' && shouldUseTargetFilter(node?.data?.eventType)
);

const createDefaultTargetFilter = (mode = 'target') => ({
    enabled: true,
    mode,
    meshNames: [],
    nodePaths: [],
    includeChildren: true
});

const normalizeTargetFilter = (filter = null, eventType = '') => {
    if (!shouldUseTargetFilter(eventType)) return null;
    const mode = filter?.mode === 'all' ? 'all' : 'target';
    return {
        enabled: filter?.enabled !== false,
        mode,
        meshNames: Array.isArray(filter?.meshNames)
            ? [...new Set(filter.meshNames.map((item) => String(item || '').trim()).filter(Boolean))]
            : [],
        nodePaths: Array.isArray(filter?.nodePaths)
            ? [...new Set(filter.nodePaths.map((item) => String(item || '').trim()).filter(Boolean))]
            : [],
        includeChildren: filter?.includeChildren !== false
    };
};

const ensureNodeTargetFilter = (node, legacyAll = false) => {
    if (!node || node.type !== 'trigger') return null;
    if (!shouldUseTargetFilter(node.data?.eventType)) {
        delete node.data.targetFilter;
        return null;
    }

    const fallback = legacyAll ? createDefaultTargetFilter('all') : createDefaultTargetFilter('target');
    node.data.targetFilter = normalizeTargetFilter(node.data.targetFilter || fallback, node.data.eventType);
    return node.data.targetFilter;
};

const selectedTargetFilter = computed(() => {
    if (!shouldShowTargetFilter(selectedNode.value)) return createDefaultTargetFilter('target');
    return ensureNodeTargetFilter(selectedNode.value) || createDefaultTargetFilter('target');
});

const selectedTargetModeValue = computed(() => (
    selectedTargetFilter.value.mode === 'all' ? 'all' : 'target'
));

const flattenTargetNodes = (nodes = [], level = 0, result = []) => {
    nodes.forEach((node) => {
        result.push({ node, level });
        if (Array.isArray(node.children) && node.children.length > 0) {
            flattenTargetNodes(node.children, level + 1, result);
        }
    });
    return result;
};

const allTargetNodes = computed(() => flattenTargetNodes(modelTargetTree.value));

const targetNodeByPath = computed(() => {
    const map = new Map();
    allTargetNodes.value.forEach(({ node }) => {
        if (node?.nodePath) map.set(node.nodePath, node);
    });
    return map;
});

const targetNodeMatchesSearch = (node, query) => {
    if (!query) return true;
    const text = `${node?.name || ''} ${node?.nodePath || ''} ${node?.type || ''}`.toLowerCase();
    if (text.includes(query)) return true;
    return Array.isArray(node?.children) && node.children.some((child) => targetNodeMatchesSearch(child, query));
};

const flattenVisibleTargetNodes = (
    nodes = [],
    level = 0,
    query = '',
    result = [],
    expandedSet = expandedTargetNodes.value
) => {
    nodes.forEach((node) => {
        if (!targetNodeMatchesSearch(node, query)) return;
        result.push({ node, level });
        const expanded = query || expandedSet.has(node.id);
        if (expanded && Array.isArray(node.children) && node.children.length > 0) {
            flattenVisibleTargetNodes(node.children, level + 1, query, result, expandedSet);
        }
    });
    return result;
};

const visibleTargetNodes = computed(() => {
    const query = String(targetSearchQuery.value || '').trim().toLowerCase();
    return flattenVisibleTargetNodes(modelTargetTree.value, 0, query);
});
const renderedVisibleTargetNodes = computed(() => (
    visibleTargetNodes.value.length > TARGET_TREE_RENDER_LIMIT
        ? visibleTargetNodes.value.slice(0, TARGET_TREE_RENDER_LIMIT)
        : visibleTargetNodes.value
));
const visibleTargetOverflowCount = computed(() => Math.max(
    0,
    visibleTargetNodes.value.length - renderedVisibleTargetNodes.value.length
));

const selectedMethodTargetComponent = computed(() => {
    if (selectedNode.value?.type !== 'method') return null;
    const targetComponentId = selectedNode.value.data?.targetComponentId || '';
    return componentStore.components.find((item) => item.id === targetComponentId) || null;
});

const selectedMethodTargetInstance = computed(() => selectedMethodTargetComponent.value?.instance || null);
const selectedMethodTargetTree = computed(() => {
    void modelStructureRevision.value;
    const tree = selectedMethodTargetInstance.value?.getModelStructureTree?.();
    return Array.isArray(tree) ? tree : [];
});

const selectedMethodMeshCount = computed(() => {
    if (typeof selectedMethodTargetInstance.value?.getMeshCount === 'function') {
        return selectedMethodTargetInstance.value.getMeshCount();
    }
    const meshes = selectedMethodTargetInstance.value?.getAllMeshes?.();
    return Array.isArray(meshes) ? meshes.length : 0;
});

const methodSupportsMeshTargets = computed(() => (
    selectedMethodTargetComponent.value?.type === 'ModelLoader'
    && selectedMethodParamDefinitions.value.some((param) => param?.name === 'targets')
));

const shouldShowMethodTargetPicker = computed(() => (
    selectedNode.value?.type === 'method' && methodSupportsMeshTargets.value
));

const isMaterialPropsMethod = computed(() => {
    const methodName = String(selectedNode.value?.data?.methodName || '').trim().toLowerCase();
    return selectedMethodTargetComponent.value?.type === 'ModelLoader'
        && ['setmeshesmaterial', 'updatemeshesmaterial'].includes(methodName);
});

const allMethodTargetNodes = computed(() => flattenTargetNodes(selectedMethodTargetTree.value));

const methodTargetNodeByPath = computed(() => {
    const map = new Map();
    allMethodTargetNodes.value.forEach(({ node }) => {
        if (node?.nodePath) map.set(node.nodePath, node);
    });
    return map;
});

const visibleMethodTargetNodes = computed(() => {
    const query = String(methodTargetSearchQuery.value || '').trim().toLowerCase();
    return flattenVisibleTargetNodes(selectedMethodTargetTree.value, 0, query, [], expandedMethodTargetNodes.value);
});
const renderedVisibleMethodTargetNodes = computed(() => (
    visibleMethodTargetNodes.value.length > TARGET_TREE_RENDER_LIMIT
        ? visibleMethodTargetNodes.value.slice(0, TARGET_TREE_RENDER_LIMIT)
        : visibleMethodTargetNodes.value
));
const visibleMethodTargetOverflowCount = computed(() => Math.max(
    0,
    visibleMethodTargetNodes.value.length - renderedVisibleMethodTargetNodes.value.length
));

const parseMethodParamValue = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;

    if (
        (raw.startsWith('{') && raw.endsWith('}')) ||
        (raw.startsWith('[') && raw.endsWith(']'))
    ) {
        try {
            return JSON.parse(raw);
        } catch {
            // 兼容蓝图参数里常见的 JS 对象字面量写法
        }
    }

    try {
        // eslint-disable-next-line no-new-func
        return new Function(`return (${raw});`)();
    } catch {
        return raw;
    }
};

const formatMethodParamValue = (value) => {
    if (value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value ?? '');
    }
};

const normalizeMethodTargetFilter = (filter = null) => {
    const source = filter && typeof filter === 'object' ? filter : {};
    return {
        mode: source.mode === 'all' ? 'all' : 'target',
        meshNames: Array.isArray(source.meshNames)
            ? [...new Set(source.meshNames.map((item) => String(item || '').trim()).filter(Boolean))]
            : [],
        nodePaths: Array.isArray(source.nodePaths)
            ? [...new Set(source.nodePaths.map((item) => String(item || '').trim()).filter(Boolean))]
            : [],
        includeChildren: source.includeChildren !== false
    };
};

const getSelectedMethodParam = (key) => {
    if (!selectedNode.value || selectedNode.value.type !== 'method') return null;
    const params = Array.isArray(selectedNode.value.data.parameters)
        ? selectedNode.value.data.parameters
        : [];
    return params.find((param) => String(param?.key || '').trim() === key) || null;
};

const ensureSelectedMethodParam = (key, defaultValue = '') => {
    if (!selectedNode.value || selectedNode.value.type !== 'method') return null;
    if (!Array.isArray(selectedNode.value.data.parameters)) {
        selectedNode.value.data.parameters = [];
    }

    let param = getSelectedMethodParam(key);
    if (!param) {
        param = { key, value: defaultValue };
        selectedNode.value.data.parameters.push(param);
    }
    return param;
};

const getSelectedCameraJumpPayload = () => {
    const param = getSelectedMethodParam(CAMERA_JUMP_PAYLOAD_PARAM_KEY);
    const parsed = parseMethodParamValue(param?.value);
    const payload = isPlainObjectValue(parsed) ? { ...parsed } : {};
    const params = Array.isArray(selectedNode.value?.data?.parameters)
        ? selectedNode.value.data.parameters
        : [];
    params.forEach((item) => {
        const key = String(item?.key || '').trim();
        if (!key || key === CAMERA_JUMP_PAYLOAD_PARAM_KEY) return;
        payload[key] = parseMethodParamValue(item?.value);
    });
    return payload;
};

const setSelectedCameraJumpPayload = (payload) => {
    const normalized = isPlainObjectValue(payload) ? payload : {};
    const param = ensureSelectedMethodParam(CAMERA_JUMP_PAYLOAD_PARAM_KEY, '{}');
    if (param) {
        param.value = formatMethodParamValue(normalized);
    }
};

const selectedCameraJumpPayload = computed(() => (
    selectedNode.value?.type === 'method' ? getSelectedCameraJumpPayload() : {}
));

const selectedMethodNameLower = computed(() => (
    String(selectedNode.value?.data?.methodName || '').trim().toLowerCase()
));

const isCameraJumpMethod = computed(() => (
    selectedNode.value?.type === 'method'
    && selectedMethodTargetComponent.value?.type === 'CameraJump'
));

const shouldShowCameraJumpPointEditor = computed(() => (
    isCameraJumpMethod.value && selectedMethodNameLower.value === 'jumptopoint'
));

const shouldShowCameraJumpMeshEditor = computed(() => (
    isCameraJumpMethod.value && selectedMethodNameLower.value === 'jumptomesh'
));

const selectedCameraJumpPointSource = computed(() => (
    (selectedCameraJumpPayload.value?.pointTarget?.source || selectedCameraJumpPayload.value?.source) === 'manager' ? 'manager' : 'manual'
));

const selectedCameraJumpPointPosition = computed(() => {
    const position = selectedCameraJumpPayload.value?.pointTarget?.position || selectedCameraJumpPayload.value?.position || {};
    return {
        x: Number(position.x) || 0,
        y: Number(position.y) || 0,
        z: Number(position.z) || 0
    };
});

const selectedCameraJumpMeshLoaderComponent = computed(() => {
    const componentId = String(
        selectedCameraJumpPayload.value?.componentId
        || selectedCameraJumpPayload.value?.meshTarget?.componentId
        || ''
    ).trim();
    if (!componentId) return null;
    return componentStore.components.find((item) => item?.id === componentId && item.type === 'ModelLoader') || null;
});

const selectedCameraJumpMeshLoaderInstance = computed(() => selectedCameraJumpMeshLoaderComponent.value?.instance || null);

const selectedCameraJumpMeshTree = computed(() => {
    void modelStructureRevision.value;
    const tree = selectedCameraJumpMeshLoaderInstance.value?.getModelStructureTree?.();
    return Array.isArray(tree) ? tree : [];
});

const selectedCameraJumpMeshCount = computed(() => {
    if (typeof selectedCameraJumpMeshLoaderInstance.value?.getMeshCount === 'function') {
        return selectedCameraJumpMeshLoaderInstance.value.getMeshCount();
    }
    const meshes = selectedCameraJumpMeshLoaderInstance.value?.getAllMeshes?.();
    return Array.isArray(meshes) ? meshes.length : 0;
});

const allCameraJumpMeshNodes = computed(() => flattenTargetNodes(selectedCameraJumpMeshTree.value));

const cameraJumpMeshNodeByPath = computed(() => {
    const map = new Map();
    allCameraJumpMeshNodes.value.forEach(({ node }) => {
        if (node?.nodePath) map.set(node.nodePath, node);
    });
    return map;
});

const visibleCameraJumpMeshNodes = computed(() => {
    const query = String(cameraJumpMeshSearchQuery.value || '').trim().toLowerCase();
    return flattenVisibleTargetNodes(selectedCameraJumpMeshTree.value, 0, query, [], expandedCameraJumpMeshNodes.value);
});

const renderedVisibleCameraJumpMeshNodes = computed(() => (
    visibleCameraJumpMeshNodes.value.length > TARGET_TREE_RENDER_LIMIT
        ? visibleCameraJumpMeshNodes.value.slice(0, TARGET_TREE_RENDER_LIMIT)
        : visibleCameraJumpMeshNodes.value
));

const visibleCameraJumpMeshOverflowCount = computed(() => Math.max(
    0,
    visibleCameraJumpMeshNodes.value.length - renderedVisibleCameraJumpMeshNodes.value.length
));

const selectedCameraJumpPointId = computed(() => (
    String(selectedCameraJumpPayload.value?.pointTarget?.pointId || selectedCameraJumpPayload.value?.pointId || '').trim()
));

const selectedCameraJumpDirection = computed(() => {
    const direction = selectedCameraJumpPayload.value?.direction || {};
    return {
        x: toFiniteNumber(direction.x, 1),
        y: toFiniteNumber(direction.y, 0.35),
        z: toFiniteNumber(direction.z, 1)
    };
});

const selectedCameraJumpMeshComponentId = computed(() => (
    String(selectedCameraJumpPayload.value?.componentId || selectedCameraJumpPayload.value?.meshTarget?.componentId || '').trim()
));

const selectedCameraJumpMeshIncludeChildren = computed(() => (
    selectedCameraJumpPayload.value?.includeChildren ?? selectedCameraJumpPayload.value?.meshTarget?.includeChildren ?? true
));

const selectedCameraJumpMeshSummary = computed(() => {
    const payload = selectedCameraJumpPayload.value || {};
    const meshName = String(payload.meshName || payload.meshTarget?.meshName || '').trim();
    if (meshName) return meshName;
    const nodePath = String(payload.nodePath || payload.meshTarget?.nodePath || '').trim();
    if (nodePath) {
        const node = cameraJumpMeshNodeByPath.value.get(nodePath);
        return `${node?.name || nodePath}${selectedCameraJumpMeshIncludeChildren.value === false ? '' : ' 含子级'}`;
    }
    return '未选目标';
});

const getSelectedMethodTargetFilter = () => {
    const param = getSelectedMethodParam(METHOD_TARGET_PARAM_KEY);
    return normalizeMethodTargetFilter(parseMethodParamValue(param?.value));
};

const getSelectedMethodTargetRawValue = () => (
    String(getSelectedMethodParam(METHOD_TARGET_PARAM_KEY)?.value ?? '').trim()
);

const isDynamicTargetExpression = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    const parsed = parseMethodParamValue(raw);
    if (isPlainObjectValue(parsed)) return false;
    return /\b(current|eventData|modelTarget|meshName|nodePath)\b/.test(raw);
};

const setSelectedMethodTargetFilter = (filter) => {
    const normalized = normalizeMethodTargetFilter(filter);
    const param = ensureSelectedMethodParam(METHOD_TARGET_PARAM_KEY, formatMethodParamValue(normalized));
    if (param) {
        param.value = formatMethodParamValue(normalized);
    }
};

const selectedMethodTargetFilter = computed(() => getSelectedMethodTargetFilter());

const selectedMethodTargetUsesExpression = computed(() => (
    isDynamicTargetExpression(getSelectedMethodTargetRawValue())
));

const getSelectedMaterialProps = () => {
    const param = getSelectedMethodParam(MATERIAL_PROPS_PARAM_KEY);
    const parsed = parseMethodParamValue(param?.value);
    return isPlainObjectValue(parsed) ? { ...parsed } : {};
};

const canEditSelectedMaterialProps = computed(() => {
    if (!isMaterialPropsMethod.value) return false;
    const param = getSelectedMethodParam(MATERIAL_PROPS_PARAM_KEY);
    if (!param || !String(param.value ?? '').trim()) return true;
    return isPlainObjectValue(parseMethodParamValue(param.value));
});

const shouldShowMaterialPropsEditor = computed(() => isMaterialPropsMethod.value && canEditSelectedMaterialProps.value);

const selectedMaterialPropRows = computed(() => {
    if (!shouldShowMaterialPropsEditor.value) return [];
    return Object.entries(getSelectedMaterialProps()).map(([key, value]) => ({ key, value }));
});

const setSelectedMaterialProps = (props = {}) => {
    const param = ensureSelectedMethodParam(MATERIAL_PROPS_PARAM_KEY, '{}');
    if (param) {
        param.value = formatMethodParamValue(props);
    }
};

const getMaterialPropDefinition = (key) => MATERIAL_PROP_SCHEMA[key] || null;

const getMaterialPropType = (key) => getMaterialPropDefinition(key)?.type || 'text';

const getDefaultMaterialPropValue = (key) => {
    const definition = getMaterialPropDefinition(key);
    if (definition?.defaultValue !== undefined) return definition.defaultValue;
    if (definition?.type === 'boolean') return false;
    if (definition?.type === 'number') return definition.min ?? 0;
    if (definition?.type === 'color') return '#ffffff';
    return '';
};

const clampMaterialNumber = (key, value) => {
    const definition = getMaterialPropDefinition(key);
    let number = Number(value);
    if (!Number.isFinite(number)) {
        number = Number(definition?.defaultValue ?? definition?.min ?? 0);
    }
    if (Number.isFinite(Number(definition?.min))) {
        number = Math.max(Number(definition.min), number);
    }
    if (Number.isFinite(Number(definition?.max))) {
        number = Math.min(Number(definition.max), number);
    }
    return number;
};

const normalizeMaterialPropValue = (key, value) => {
    const type = getMaterialPropType(key);
    if (type === 'boolean') {
        return value === true || value === 'true';
    }
    if (type === 'number') {
        return clampMaterialNumber(key, value);
    }
    if (type === 'color') {
        return String(value || getDefaultMaterialPropValue(key));
    }
    if (type === 'select') {
        return String(value || getDefaultMaterialPropValue(key));
    }
    return value;
};

const getMaterialPropInputValue = (key, value) => (
    normalizeMaterialPropValue(
        key,
        value === undefined ? getDefaultMaterialPropValue(key) : value
    )
);

const getMaterialPropBooleanLabel = (key, value) => (
    getMaterialPropInputValue(key, value) ? '开启' : '关闭'
);

const updateMaterialPropValue = (key, value) => {
    if (!key) return;
    const props = getSelectedMaterialProps();
    props[key] = normalizeMaterialPropValue(key, value);
    setSelectedMaterialProps(props);
};

const addSelectedMaterialProp = () => {
    if (!shouldShowMaterialPropsEditor.value) return;
    const props = getSelectedMaterialProps();
    const nextKey = Object.keys(MATERIAL_PROP_SCHEMA).find((key) => props[key] === undefined);
    if (!nextKey) return;
    props[nextKey] = getDefaultMaterialPropValue(nextKey);
    setSelectedMaterialProps(props);
};

const handleMaterialPropKeyChange = (oldKey, nextKey) => {
    const normalizedKey = String(nextKey || '').trim();
    if (!normalizedKey || normalizedKey === oldKey) return;
    const props = getSelectedMaterialProps();
    delete props[oldKey];
    props[normalizedKey] = getDefaultMaterialPropValue(normalizedKey);
    setSelectedMaterialProps(props);
};

const removeSelectedMaterialProp = (key) => {
    const props = getSelectedMaterialProps();
    delete props[key];
    setSelectedMaterialProps(props);
};

const selectedMethodTargetModeValue = computed(() => (
    selectedMethodTargetFilter.value.mode === 'all' ? 'all' : 'target'
));

const selectedMethodTargetTags = computed(() => {
    const filter = selectedMethodTargetFilter.value;
    if (filter.mode === 'all') return [];

    const meshTags = filter.meshNames.map((name) => ({
        key: `mesh:${name}`,
        type: 'mesh',
        value: name,
        label: name
    }));
    const objectTags = filter.nodePaths.map((nodePath) => {
        const node = methodTargetNodeByPath.value.get(nodePath);
        return {
            key: `object:${nodePath}`,
            type: 'object',
            value: nodePath,
            label: node?.name || nodePath
        };
    });

    return [...meshTags, ...objectTags];
});

const selectedMethodTargetSummary = computed(() => {
    if (selectedMethodTargetUsesExpression.value) return '事件触发时的当前物体';
    const filter = selectedMethodTargetFilter.value;
    if (filter.mode === 'all') return '全部 Mesh';

    const meshCount = filter.meshNames.length;
    const objectCount = filter.nodePaths.length;
    if (!meshCount && !objectCount) return '未选目标';
    if (meshCount === 1 && objectCount === 0) return filter.meshNames[0];
    if (meshCount === 0 && objectCount === 1) {
        const node = methodTargetNodeByPath.value.get(filter.nodePaths[0]);
        return `${node?.name || '1 个物体'}${filter.includeChildren ? ' 含子级' : ''}`;
    }

    const parts = [];
    if (meshCount) parts.push(`${meshCount} 个 Mesh`);
    if (objectCount) parts.push(`${objectCount} 个物体${filter.includeChildren ? ' 含子级' : ''}`);
    return parts.join(' / ');
});

const selectedMethodParameterRows = computed(() => {
    if (selectedNode.value?.type !== 'method') return [];
    const params = Array.isArray(selectedNode.value.data.parameters) ? selectedNode.value.data.parameters : [];
    return params
        .map((param, index) => ({ param, index }))
        .filter((item) => !(shouldShowMethodTargetPicker.value && item.param?.key === METHOD_TARGET_PARAM_KEY))
        .filter((item) => !(shouldShowMaterialPropsEditor.value && item.param?.key === MATERIAL_PROPS_PARAM_KEY))
        .filter((item) => !((shouldShowCameraJumpPointEditor.value || shouldShowCameraJumpMeshEditor.value) && item.param?.key === CAMERA_JUMP_PAYLOAD_PARAM_KEY));
});

const selectedTargetTags = computed(() => {
    const filter = selectedTargetFilter.value;
    if (filter.mode === 'all') return [];

    const meshTags = filter.meshNames.map((name) => ({
        key: `mesh:${name}`,
        type: 'mesh',
        value: name,
        label: name
    }));
    const objectTags = filter.nodePaths.map((nodePath) => {
        const node = targetNodeByPath.value.get(nodePath);
        return {
            key: `object:${nodePath}`,
            type: 'object',
            value: nodePath,
            label: node?.name || nodePath
        };
    });

    return [...meshTags, ...objectTags];
});

const getTargetSummary = (eventType, filter = null) => {
    if (!shouldUseTargetFilter(eventType)) return '';
    const normalized = normalizeTargetFilter(filter, eventType) || createDefaultTargetFilter('target');
    if (normalized.mode === 'all') return '全部 Mesh';

    const meshCount = normalized.meshNames.length;
    const objectCount = normalized.nodePaths.length;
    if (!meshCount && !objectCount) return '未选目标';
    if (meshCount === 1 && objectCount === 0) return normalized.meshNames[0];
    if (meshCount === 0 && objectCount === 1) {
        const node = targetNodeByPath.value.get(normalized.nodePaths[0]);
        return `${node?.name || '1 个物体'}${normalized.includeChildren ? ' 含子级' : ''}`;
    }

    const parts = [];
    if (meshCount) parts.push(`${meshCount} 个 Mesh`);
    if (objectCount) parts.push(`${objectCount} 个物体${normalized.includeChildren ? ' 含子级' : ''}`);
    return parts.join(' / ');
};

const selectedTargetSummary = computed(() => (
    getTargetSummary(selectedNode.value?.data?.eventType, selectedTargetFilter.value)
));

const isEventTargetPickingActive = computed(() => (
    !!componentStore.meshPicking?.active
    && componentStore.meshPicking?.componentId === props.component?.id
    && componentStore.meshPicking?.source === 'event-target'
));

const getEventLabel = (eventType) => {
    const option = eventTypeOptions.value.find((item) => item.value === eventType);
    return option?.label || eventType || '未选择事件';
};

const createRootNode = (component) => ({
    id: 'component_root',
    type: 'root',
    x: 40,
    y: 120,
    data: {
        label: component?.name || '组件'
    }
});

const createTriggerNode = (eventType = '', x = 300, y = 100, options = {}) => {
    const resolvedEventType = eventType || eventTypeOptions.value[0]?.value || '';
    const node = {
        id: createId('trigger'),
        type: 'trigger',
        x,
        y,
        data: {
            label: getEventLabel(resolvedEventType),
            eventType: resolvedEventType,
            enabled: true,
            eventId: '',
            createdAt: Date.now()
        }
    };
    ensureNodeTargetFilter(node, options.legacyAll === true);
    return node;
};

const createMethodNode = (x = 580, y = 100, config = {}) => ({
    id: createId('method'),
    type: 'method',
    x,
    y,
    data: {
        label: '调用组件方法',
        targetComponentId: config.targetComponentId || '',
        methodName: config.methodName || '',
        parameters: Array.isArray(config.parameters)
            ? cloneJson(config.parameters, [])
            : []
    }
});

const createVariableNode = (x = 580, y = 100, config = {}) => ({
    id: createId('variable'),
    type: 'variable',
    x,
    y,
    data: {
        label: '设置变量',
        variableName: config.variableName || variableOptions.value[0]?.value || '',
        valueExpression: config.valueExpression || 'current.name'
    }
});

const createCodeNode = (x = 580, y = 100, code = '') => ({
    id: createId('code'),
    type: 'code',
    x,
    y,
    data: {
        label: '自定义脚本',
        code: code || `async ({ eventData, component, getComponent }) => {\n  console.log('事件触发', eventData, component)\n}`
    }
});

const createConditionNode = (x = 580, y = 100) => ({
    id: createId('condition'),
    type: 'condition',
    x,
    y,
    data: {
        label: '判断条件',
        conditionMode: 'expression',
        conditionInputs: [],
        expression: 'true',
        leftExpression: '',
        operator: 'eq',
        rightExpression: '',
        conditionCode: `async ({ eventData, variables, inputs }) => {\n  return true\n}`
    }
});

const connectNodes = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const duplicated = draft.edges.some((edge) => edge.source === sourceId && edge.target === targetId);
    if (duplicated) return;
    draft.edges.push({
        id: createId('edge'),
        source: sourceId,
        target: targetId
    });
};

const buildBlueprintFromEvents = () => {
    const component = props.component;
    const events = Array.isArray(component?.events) ? component.events : [];
    const saved = events.find((event) => event?.blueprint)?.blueprint;
    if (saved?.nodes && saved?.edges) {
        const eventByTriggerId = new Map(events.map((event) => [event?.blueprintTriggerNodeId, event]));
        return {
            version: 1,
            componentId: component?.id || '',
            componentName: component?.name || '',
            nodes: cloneJson(saved.nodes, []).map((node) => {
                const nextNode = {
                    ...node,
                    data: { ...(node.data || {}) }
                };
                if (nextNode.type === 'trigger') {
                    const linkedEvent = eventByTriggerId.get(nextNode.id);
                    if (linkedEvent?.targetFilter) {
                        nextNode.data.targetFilter = cloneJson(linkedEvent.targetFilter, null);
                    }
                    ensureNodeTargetFilter(nextNode, !nextNode.data.targetFilter);
                }
                return nextNode;
            }),
            edges: cloneJson(saved.edges, [])
        };
    }

    const nodes = [createRootNode(component)];
    const edges = [];

    events.forEach((event, index) => {
        const y = 70 + index * 130;
        const trigger = createTriggerNode(event.type, 300, y, { legacyAll: !event.targetFilter });
        trigger.data.enabled = event.enabled !== false;
        trigger.data.eventId = event.id || '';
        trigger.data.createdAt = event.createdAt || Date.now();
        trigger.data.label = getEventLabel(event.type);
        if (event.targetFilter) {
            trigger.data.targetFilter = normalizeTargetFilter(event.targetFilter, event.type);
        }
        nodes.push(trigger);
        edges.push({ id: createId('edge'), source: 'component_root', target: trigger.id });

        if (event.handlerType === 'method') {
            const method = createMethodNode(580, y, event.methodCallConfig || {});
            nodes.push(method);
            edges.push({ id: createId('edge'), source: trigger.id, target: method.id });
        } else {
            const migratedCode = event.handler
                ? `async ({ eventArgs }) => {\n  const handler = ${event.handler}\n  return await handler(...eventArgs)\n}`
                : '';
            const code = createCodeNode(580, y, migratedCode);
            nodes.push(code);
            edges.push({ id: createId('edge'), source: trigger.id, target: code.id });
        }
    });

    return {
        version: 1,
        componentId: component?.id || '',
        componentName: component?.name || '',
        nodes,
        edges
    };
};

const loadDraft = () => {
    const next = buildBlueprintFromEvents();
    draft.version = next.version || 1;
    draft.componentId = next.componentId;
    draft.componentName = next.componentName;
    draft.nodes = next.nodes?.length ? next.nodes : [createRootNode(props.component)];
    draft.edges = Array.isArray(next.edges) ? next.edges : [];
    selectedNodeId.value = draft.nodes[0]?.id || '';
    selectedEdgeId.value = '';
    validationMessage.value = '';
    closeContextMenu();
};

const refreshModelStructure = () => {
    modelStructureRevision.value += 1;
};

const bindModelStructureRefresh = (instance) => {
    if (!instance || typeof instance.on !== 'function') {
        return () => {};
    }

    const eventNames = ['loadStart', 'loadComplete', 'loaded', 'loadError', 'error'];
    const handler = () => refreshModelStructure();
    eventNames.forEach((eventName) => instance.on(eventName, handler));

    return () => {
        if (typeof instance.off !== 'function') return;
        eventNames.forEach((eventName) => instance.off(eventName, handler));
    };
};

watch(
    () => [props.modelValue, props.component?.id],
    ([visible, componentId]) => {
        if (visible) {
            if (skipNextOpenReload.value && minimizedForPicking.value && componentId === eventTargetPickingComponentId.value) {
                clearPickingMinimizeState();
                return;
            }
            loadDraft();
            refreshModelStructure();
        }
    },
    { immediate: true }
);

watch(
    modelInstance,
    (instance, _previous, onCleanup) => {
        const unbind = bindModelStructureRefresh(instance);
        onCleanup(unbind);
        refreshModelStructure();
    },
    { immediate: true }
);

watch(
    selectedMethodTargetInstance,
    (instance, _previous, onCleanup) => {
        const unbind = bindModelStructureRefresh(instance);
        onCleanup(unbind);
        refreshModelStructure();
    },
    { immediate: true }
);

watch(
    selectedCameraJumpMeshLoaderInstance,
    (instance, _previous, onCleanup) => {
        const unbind = bindModelStructureRefresh(instance);
        onCleanup(unbind);
        refreshModelStructure();
    },
    { immediate: true }
);

watch(modelTargetTree, (tree) => {
    const shouldAutoExpand = modelMeshCount.value <= TARGET_TREE_AUTO_EXPAND_MESH_LIMIT;
    const rootIds = shouldAutoExpand ? tree.map((node) => node.id).filter(Boolean) : [];
    expandedTargetNodes.value = new Set(rootIds);
}, { immediate: true });

watch(selectedMethodTargetTree, (tree) => {
    const shouldAutoExpand = selectedMethodMeshCount.value <= TARGET_TREE_AUTO_EXPAND_MESH_LIMIT;
    const rootIds = shouldAutoExpand ? tree.map((node) => node.id).filter(Boolean) : [];
    expandedMethodTargetNodes.value = new Set(rootIds);
}, { immediate: true });

watch(selectedCameraJumpMeshTree, (tree) => {
    const shouldAutoExpand = selectedCameraJumpMeshCount.value <= TARGET_TREE_AUTO_EXPAND_MESH_LIMIT;
    const rootIds = shouldAutoExpand ? tree.map((node) => node.id).filter(Boolean) : [];
    expandedCameraJumpMeshNodes.value = new Set(rootIds);
}, { immediate: true });

watch(
    () => componentStore.meshPickResult?.token,
    (token) => {
        if (!token || (!props.modelValue && !minimizedForPicking.value)) return;
        const result = componentStore.meshPickResult;
        const targetNode = draft.nodes.find((node) => node.id === eventTargetPickingNodeId.value) || selectedNode.value;
        if (
            result?.source !== 'event-target' ||
            result?.componentId !== props.component?.id ||
            !shouldShowTargetFilter(targetNode)
        ) {
            return;
        }

        const meshName = String(result.meshName || '').trim();
        if (!meshName) return;
        const filter = normalizeTargetFilter(targetNode.data.targetFilter, targetNode.data.eventType) || createDefaultTargetFilter('target');
        targetNode.data.targetFilter = {
            ...filter,
            mode: 'target',
            meshNames: [...new Set([...filter.meshNames, meshName])]
        };
        lastHandledPickToken.value = Number(token) || Date.now();
        validationMessage.value = '';
        componentStore.clearMeshPickResult();
        restoreBlueprintAfterPicking();
    }
);

watch(
    () => componentStore.meshPicking?.active,
    (active, wasActive) => {
        if (active || !wasActive || !minimizedForPicking.value) return;
        const result = componentStore.meshPickResult;
        const hasPendingResult = (
            result?.source === 'event-target' &&
            result?.componentId === eventTargetPickingComponentId.value &&
            result?.token &&
            result.token !== lastHandledPickToken.value
        );
        if (hasPendingResult) return;
        restoreBlueprintAfterPicking();
    }
);

const getCanvasPoint = (event) => {
    const rect = canvasRef.value?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
};

const handlePaletteDragStart = (event, payload) => {
    paletteDragPayload.value = payload;
    event.dataTransfer?.setData('application/json', JSON.stringify(payload));
    event.dataTransfer?.setData('text/plain', payload.type);
};

const createNodeFromPayload = (payload, x, y) => {
    if (payload.type === 'trigger') return createTriggerNode(payload.eventType, x, y);
    if (payload.type === 'method') return createMethodNode(x, y);
    if (payload.type === 'variable') return createVariableNode(x, y);
    if (payload.type === 'code') return createCodeNode(x, y);
    if (payload.type === 'condition') return createConditionNode(x, y);
    return null;
};

const handleCanvasDrop = (event) => {
    if (props.disabled) return;
    let payload = paletteDragPayload.value;
    try {
        const raw = event.dataTransfer?.getData('application/json');
        if (raw) payload = JSON.parse(raw);
    } catch {
        // keep ref payload
    }
    if (!payload) return;

    const point = getCanvasPoint(event);
    const node = createNodeFromPayload(payload, point.x - NODE_WIDTH / 2, point.y - NODE_HEIGHT / 2);
    if (!node) return;
    draft.nodes.push(node);
    selectedNodeId.value = node.id;
    selectedEdgeId.value = '';
    paletteDragPayload.value = null;
};

const handleCanvasMouseDown = () => {
    selectedNodeId.value = '';
    selectedEdgeId.value = '';
    closeContextMenu();
};

const selectNode = (nodeId) => {
    selectedNodeId.value = nodeId;
    selectedEdgeId.value = '';
    closeContextMenu();
};

const selectEdge = (edgeId) => {
    selectedEdgeId.value = edgeId;
    selectedNodeId.value = '';
    closeContextMenu();
};

const startNodeDrag = (event, node) => {
    selectNode(node.id);
    dragState.value = {
        nodeId: node.id,
        startX: event.clientX,
        startY: event.clientY,
        nodeX: node.x,
        nodeY: node.y
    };
    document.addEventListener('mousemove', handleNodeDragMove);
    document.addEventListener('mouseup', stopNodeDrag);
};

const handleNodeDragMove = (event) => {
    const state = dragState.value;
    if (!state) return;
    const node = draft.nodes.find((item) => item.id === state.nodeId);
    if (!node) return;
    node.x = Math.max(0, state.nodeX + event.clientX - state.startX);
    node.y = Math.max(0, state.nodeY + event.clientY - state.startY);
};

const stopNodeDrag = () => {
    dragState.value = null;
    document.removeEventListener('mousemove', handleNodeDragMove);
    document.removeEventListener('mouseup', stopNodeDrag);
};

const startConnect = (node, event) => {
    connecting.value = {
        sourceId: node.id
    };
    Object.assign(pointerPosition, getCanvasPoint(event));
    document.addEventListener('mousemove', handleConnectMove);
    document.addEventListener('mouseup', stopConnect);
};

const handleConnectMove = (event) => {
    Object.assign(pointerPosition, getCanvasPoint(event));
};

const stopConnect = () => {
    connecting.value = null;
    document.removeEventListener('mousemove', handleConnectMove);
    document.removeEventListener('mouseup', stopConnect);
};

const finishConnect = (targetNode) => {
    if (!connecting.value) return;
    connectNodes(connecting.value.sourceId, targetNode.id);
    stopConnect();
};

const getNodeAnchor = (node, side = 'right') => ({
    x: node.x + (side === 'right' ? NODE_WIDTH : 0),
    y: node.y + NODE_HEIGHT / 2
});

const getEdgePath = (edge) => {
    const source = draft.nodes.find((node) => node.id === edge.source);
    const target = draft.nodes.find((node) => node.id === edge.target);
    if (!source || !target) return '';
    const start = getNodeAnchor(source, 'right');
    const end = getNodeAnchor(target, 'left');
    const dx = Math.max(90, Math.abs(end.x - start.x) * 0.45);
    return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
};

const getPreviewEdgePath = () => {
    if (!connecting.value) return '';
    const source = draft.nodes.find((node) => node.id === connecting.value.sourceId);
    if (!source) return '';
    const start = getNodeAnchor(source, 'right');
    const end = pointerPosition;
    const dx = Math.max(90, Math.abs(end.x - start.x) * 0.45);
    return `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
};

const getNodeTypeLabel = (node) => {
    if (node.type === 'root') return '组件';
    if (node.type === 'trigger') return '事件入口';
    if (node.type === 'condition') return '判断';
    if (node.type === 'method') return '执行动作';
    if (node.type === 'variable') return '设置变量';
    if (node.type === 'code') return '自定义脚本';
    return node.type;
};

const getNodeSummary = (node) => {
    if (node.type === 'root') return node.data.label || '组件';
    if (node.type === 'trigger') {
        const targetSummary = getTargetSummary(node.data.eventType, node.data.targetFilter);
        return targetSummary ? `${getEventLabel(node.data.eventType)} · ${targetSummary}` : getEventLabel(node.data.eventType);
    }
    if (node.type === 'condition') {
        const inputCount = Array.isArray(node.data.conditionInputs) ? node.data.conditionInputs.length : 0;
        const suffix = inputCount ? ` / ${inputCount} 个输入` : '';
        if ((node.data.conditionMode || 'expression') === 'compare') {
            const operatorLabel = conditionOperatorOptions.find((item) => item.value === node.data.operator)?.label || '比较';
            return `${node.data.leftExpression || '左值'} ${operatorLabel} ${node.data.rightExpression || '右值'}${suffix}`;
        }
        if (node.data.conditionMode === 'code') return `脚本判断通过后继续${suffix}`;
        return `${node.data.expression || 'true'}${suffix}`;
    }
    if (node.type === 'method') {
        const target = componentStore.components.find((item) => item.id === node.data.targetComponentId);
        return `${target?.name || '未选择组件'} / ${node.data.methodName || '未选择方法'}`;
    }
    if (node.type === 'variable') {
        return `${node.data.variableName || '未选择变量'} = ${node.data.valueExpression || 'undefined'}`;
    }
    if (node.type === 'code') {
        return String(node.data.code || '').trim() ? '已配置自定义脚本' : '未配置自定义脚本';
    }
    return '';
};

const updateSelectedNodeData = (updates) => {
    if (!selectedNode.value) return;
    Object.assign(selectedNode.value.data, updates);
    if (updates.eventType) {
        selectedNode.value.data.label = getEventLabel(updates.eventType);
        ensureNodeTargetFilter(selectedNode.value);
    }
};

const createMethodParamRow = (paramDefinition) => ({
    key: String(paramDefinition?.name || '').trim(),
    value: formatMethodParamValue(paramDefinition?.defaultValue)
});

const createDefaultCameraJumpPayload = (methodName = '') => {
    const normalized = String(methodName || '').trim().toLowerCase();
    if (normalized === 'jumptopoint') {
        return {
            pointTarget: {
                source: 'manual',
                pointId: '',
                position: { x: 0, y: 0, z: 0 }
            }
        };
    }
    if (normalized === 'jumptomesh') {
        return {
            componentId: modelLoaderComponentOptions.value[0]?.value || '',
            meshName: '',
            nodePath: '',
            includeChildren: true
        };
    }
    return {};
};

const getDefaultMethodParameters = (methodDefinition = null) => {
    const params = Array.isArray(methodDefinition?.params) ? methodDefinition.params : [];
    return params
        .filter((param) => param?.defaultValue !== undefined)
        .map((param) => createMethodParamRow(param))
        .filter((param) => param.key);
};

const handleMethodNameChange = (methodName) => {
    const method = selectedMethodDefinitions.value.find(
        (item) => String(item?.name || '').trim() === String(methodName || '').trim()
    );
    const normalizedMethodName = String(methodName || '').trim().toLowerCase();
    const isCameraJumpTarget = selectedMethodTargetComponent.value?.type === 'CameraJump';
    const parameters = isCameraJumpTarget && ['jumptopoint', 'jumptomesh'].includes(normalizedMethodName)
        ? [{
            key: CAMERA_JUMP_PAYLOAD_PARAM_KEY,
            value: formatMethodParamValue(createDefaultCameraJumpPayload(normalizedMethodName))
        }]
        : getDefaultMethodParameters(method);

    updateSelectedNodeData({
        methodName,
        parameters
    });
    methodTargetSearchQuery.value = '';
    cameraJumpMeshSearchQuery.value = '';
};

const getMethodParamDefinition = (param = {}) => {
    const key = String(param?.key || '').trim();
    return key ? selectedMethodParamDefinitionMap.value.get(key) : null;
};

const getMethodParamKeyPlaceholder = (param) => {
    const definition = getMethodParamDefinition(param);
    return definition?.title || definition?.name || 'key';
};

const getMethodParamValuePlaceholder = (param) => {
    const definition = getMethodParamDefinition(param);
    if (!definition) return 'JS 表达式';
    return definition.description || `${definition.title || definition.name}（${definition.type || 'string'}）`;
};

const insertMethodParamEventField = (param, expression) => {
    if (!param || !expression) return;
    param.value = expression;
};

const insertVariableEventField = (expression) => {
    if (!selectedNode.value || selectedNode.value.type !== 'variable' || !expression) return;
    selectedNode.value.data.valueExpression = expression;
};

const toFiniteNumber = (value, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
};

const updateSelectedCameraJumpPayload = (patch) => {
    if (!isCameraJumpMethod.value) return;
    setSelectedCameraJumpPayload({
        ...selectedCameraJumpPayload.value,
        ...(patch || {})
    });
};

const handleCameraJumpPointSourceChange = (source) => {
    const nextSource = source === 'manager' ? 'manager' : 'manual';
    const currentPosition = selectedCameraJumpPointPosition.value;
    const pointId = nextSource === 'manager'
        ? (selectedCameraJumpPayload.value?.pointTarget?.pointId || buildingPointOptions.value[0]?.value || '')
        : '';
    updateSelectedCameraJumpPayload({
        ...selectedCameraJumpPayload.value,
        source: nextSource,
        pointId,
        position: currentPosition,
        pointTarget: {
            ...(selectedCameraJumpPayload.value?.pointTarget || {}),
            source: nextSource,
            pointId,
            position: currentPosition
        }
    });
};

const updateCameraJumpPointId = (pointId) => {
    updateSelectedCameraJumpPayload({
        ...selectedCameraJumpPayload.value,
        source: 'manager',
        pointId,
        pointTarget: {
            ...(selectedCameraJumpPayload.value?.pointTarget || {}),
            source: 'manager',
            pointId
        }
    });
};

const updateCameraJumpPointPosition = (axis, value) => {
    const current = selectedCameraJumpPointPosition.value;
    const position = {
        ...current,
        [axis]: toFiniteNumber(value, current[axis])
    };
    updateSelectedCameraJumpPayload({
        ...selectedCameraJumpPayload.value,
        source: 'manual',
        pointId: '',
        position,
        pointTarget: {
            ...(selectedCameraJumpPayload.value?.pointTarget || {}),
            source: 'manual',
            pointId: '',
            position
        }
    });
};

const updateCameraJumpPayloadNumber = (key, value, fallback = 0) => {
    updateSelectedCameraJumpPayload({
        [key]: toFiniteNumber(value, fallback)
    });
};

const updateCameraJumpDirection = (axis, value) => {
    const current = selectedCameraJumpPayload.value?.direction || {};
    const fallback = axis === 'y' ? 0.35 : 1;
    updateSelectedCameraJumpPayload({
        direction: {
            x: toFiniteNumber(current.x, 1),
            y: toFiniteNumber(current.y, 0.35),
            z: toFiniteNumber(current.z, 1),
            [axis]: toFiniteNumber(value, fallback)
        }
    });
};

const updateCameraJumpAutoLookAt = (autoLookAt) => {
    updateSelectedCameraJumpPayload({
        autoLookAt: autoLookAt !== false
    });
};

const handleCameraJumpMeshComponentChange = (componentId) => {
    const current = selectedCameraJumpPayload.value || {};
    updateSelectedCameraJumpPayload({
        ...current,
        componentId,
        meshName: '',
        nodePath: '',
        includeChildren: true,
        meshTarget: {
            ...(current.meshTarget || {}),
            componentId,
            meshName: '',
            nodePath: '',
            includeChildren: true
        }
    });
    cameraJumpMeshSearchQuery.value = '';
};

const isCameraJumpMeshNodeSelectable = (node) => {
    if (!node) return false;
    if (node.isMesh === true) {
        return !!String(node.name || '').trim() && !String(node.name || '').startsWith('Unnamed');
    }
    return !!node.nodePath && Array.isArray(node.meshNames) && node.meshNames.length > 0;
};

const isCameraJumpMeshNodeSelected = (node) => {
    if (!node) return false;
    const payload = selectedCameraJumpPayload.value || {};
    const selectedMeshName = String(payload.meshName || payload.meshTarget?.meshName || '').trim();
    const selectedNodePath = String(payload.nodePath || payload.meshTarget?.nodePath || '').trim();
    if (node.isMesh === true) return !!selectedMeshName && selectedMeshName === node.name;
    return !!selectedNodePath && selectedNodePath === node.nodePath;
};

const selectCameraJumpMeshNode = (node) => {
    if (!shouldShowCameraJumpMeshEditor.value || !isCameraJumpMeshNodeSelectable(node)) return;
    const componentId = selectedCameraJumpMeshLoaderComponent.value?.id || selectedCameraJumpPayload.value?.componentId || '';
    const includeChildren = selectedCameraJumpMeshIncludeChildren.value !== false;

    if (node.isMesh === true) {
        const meshName = String(node.name || '').trim();
        updateSelectedCameraJumpPayload({
            ...selectedCameraJumpPayload.value,
            componentId,
            meshName,
            nodePath: '',
            includeChildren: true,
            meshTarget: {
                ...(selectedCameraJumpPayload.value?.meshTarget || {}),
                componentId,
                meshName,
                nodePath: '',
                includeChildren: true
            }
        });
        return;
    }

    const nodePath = String(node.nodePath || '').trim();
    updateSelectedCameraJumpPayload({
        ...selectedCameraJumpPayload.value,
        componentId,
        meshName: '',
        nodePath,
        includeChildren,
        meshTarget: {
            ...(selectedCameraJumpPayload.value?.meshTarget || {}),
            componentId,
            meshName: '',
            nodePath,
            includeChildren
        }
    });
};

const setCameraJumpMeshIncludeChildren = (includeChildren) => {
    const current = selectedCameraJumpPayload.value || {};
    updateSelectedCameraJumpPayload({
        ...current,
        includeChildren: includeChildren !== false,
        meshTarget: {
            ...(current.meshTarget || {}),
            includeChildren: includeChildren !== false
        }
    });
};

const clearCameraJumpMeshTarget = () => {
    const current = selectedCameraJumpPayload.value || {};
    updateSelectedCameraJumpPayload({
        ...current,
        meshName: '',
        nodePath: '',
        meshTarget: {
            ...(current.meshTarget || {}),
            meshName: '',
            nodePath: ''
        }
    });
};

const isCameraJumpMeshNodeExpanded = (nodeId) => expandedCameraJumpMeshNodes.value.has(nodeId);

const toggleCameraJumpMeshNodeExpanded = (nodeId) => {
    const next = new Set(expandedCameraJumpMeshNodes.value);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    expandedCameraJumpMeshNodes.value = next;
};

const setSelectedMethodTargetToCurrent = () => {
    const param = ensureSelectedMethodParam(METHOD_TARGET_PARAM_KEY, '');
    if (param) {
        param.value = '({ meshNames: [current.name] })';
    }
};

const setSelectedMethodTargetMode = (mode) => {
    if (!shouldShowMethodTargetPicker.value) return;
    const nextMode = mode === 'all' ? 'all' : 'target';
    const filter = selectedMethodTargetFilter.value;
    setSelectedMethodTargetFilter({
        ...filter,
        mode: nextMode,
        meshNames: nextMode === 'all' ? [] : filter.meshNames,
        nodePaths: nextMode === 'all' ? [] : filter.nodePaths,
        includeChildren: filter.includeChildren !== false
    });
};

const setSelectedMethodTargetIncludeChildren = (includeChildren) => {
    if (!shouldShowMethodTargetPicker.value) return;
    setSelectedMethodTargetFilter({
        ...selectedMethodTargetFilter.value,
        includeChildren: includeChildren !== false
    });
};

const isMethodTargetNodeSelectable = (node) => {
    if (!node || selectedMethodTargetFilter.value.mode === 'all') return false;
    if (node.isMesh === true) {
        return !!String(node.name || '').trim() && !String(node.name || '').startsWith('Unnamed');
    }
    return !!node.nodePath && Array.isArray(node.meshNames) && node.meshNames.length > 0;
};

const isMethodTargetNodeSelected = (node) => {
    if (!node) return false;
    const filter = selectedMethodTargetFilter.value;
    if (filter.mode === 'all') return false;
    if (node.isMesh === true) return filter.meshNames.includes(node.name);
    return filter.nodePaths.includes(node.nodePath);
};

const toggleMethodTargetNode = (node) => {
    if (!shouldShowMethodTargetPicker.value || !isMethodTargetNodeSelectable(node)) return;
    const filter = selectedMethodTargetFilter.value;

    if (node.isMesh === true) {
        const meshName = String(node.name || '').trim();
        const meshNames = new Set(filter.meshNames);
        if (meshNames.has(meshName)) meshNames.delete(meshName);
        else meshNames.add(meshName);
        setSelectedMethodTargetFilter({
            ...filter,
            mode: 'target',
            meshNames: [...meshNames]
        });
        return;
    }

    const nodePath = String(node.nodePath || '').trim();
    const nodePaths = new Set(filter.nodePaths);
    if (nodePaths.has(nodePath)) nodePaths.delete(nodePath);
    else nodePaths.add(nodePath);
    setSelectedMethodTargetFilter({
        ...filter,
        mode: 'target',
        nodePaths: [...nodePaths]
    });
};

const removeSelectedMethodTarget = (tag) => {
    if (!shouldShowMethodTargetPicker.value) return;
    const filter = selectedMethodTargetFilter.value;
    if (tag.type === 'mesh') {
        setSelectedMethodTargetFilter({
            ...filter,
            meshNames: filter.meshNames.filter((name) => name !== tag.value)
        });
        return;
    }
    setSelectedMethodTargetFilter({
        ...filter,
        nodePaths: filter.nodePaths.filter((path) => path !== tag.value)
    });
};

const clearSelectedMethodTargets = () => {
    if (!shouldShowMethodTargetPicker.value) return;
    setSelectedMethodTargetFilter({
        ...selectedMethodTargetFilter.value,
        meshNames: [],
        nodePaths: []
    });
};

const isMethodTargetNodeExpanded = (nodeId) => expandedMethodTargetNodes.value.has(nodeId);

const toggleMethodTargetNodeExpanded = (nodeId) => {
    const next = new Set(expandedMethodTargetNodes.value);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    expandedMethodTargetNodes.value = next;
};

const setSelectedTargetMode = (mode) => {
    if (!shouldShowTargetFilter(selectedNode.value)) return;
    const nextMode = mode === 'all' ? 'all' : 'target';
    selectedNode.value.data.targetFilter = {
        ...selectedTargetFilter.value,
        mode: nextMode,
        meshNames: nextMode === 'all' ? [] : selectedTargetFilter.value.meshNames,
        nodePaths: nextMode === 'all' ? [] : selectedTargetFilter.value.nodePaths,
        includeChildren: selectedTargetFilter.value.includeChildren !== false
    };
};

const setSelectedTargetIncludeChildren = (includeChildren) => {
    if (!shouldShowTargetFilter(selectedNode.value)) return;
    selectedNode.value.data.targetFilter = {
        ...selectedTargetFilter.value,
        includeChildren: includeChildren !== false
    };
};

const isTargetNodeSelectable = (node) => {
    if (!node) return false;
    if (selectedTargetFilter.value.mode === 'all') return false;
    if (node.isMesh === true) {
        return !!String(node.name || '').trim() && !String(node.name || '').startsWith('Unnamed');
    }
    return !!node.nodePath && Array.isArray(node.meshNames) && node.meshNames.length > 0;
};

const isTargetNodeSelected = (node) => {
    if (!node) return false;
    const filter = selectedTargetFilter.value;
    if (filter.mode === 'all') return false;
    if (node.isMesh === true) return filter.meshNames.includes(node.name);
    return filter.nodePaths.includes(node.nodePath);
};

const toggleTargetNode = (node) => {
    if (!shouldShowTargetFilter(selectedNode.value) || !isTargetNodeSelectable(node)) return;
    const filter = selectedTargetFilter.value;

    if (node.isMesh === true) {
        const meshName = String(node.name || '').trim();
        const meshNames = new Set(filter.meshNames);
        if (meshNames.has(meshName)) meshNames.delete(meshName);
        else meshNames.add(meshName);
        selectedNode.value.data.targetFilter = {
            ...filter,
            mode: 'target',
            meshNames: [...meshNames]
        };
        return;
    }

    const nodePath = String(node.nodePath || '').trim();
    const nodePaths = new Set(filter.nodePaths);
    if (nodePaths.has(nodePath)) nodePaths.delete(nodePath);
    else nodePaths.add(nodePath);
    selectedNode.value.data.targetFilter = {
        ...filter,
        mode: 'target',
        nodePaths: [...nodePaths]
    };
};

const removeSelectedTarget = (tag) => {
    if (!shouldShowTargetFilter(selectedNode.value)) return;
    const filter = selectedTargetFilter.value;
    if (tag.type === 'mesh') {
        selectedNode.value.data.targetFilter = {
            ...filter,
            meshNames: filter.meshNames.filter((name) => name !== tag.value)
        };
        return;
    }
    selectedNode.value.data.targetFilter = {
        ...filter,
        nodePaths: filter.nodePaths.filter((path) => path !== tag.value)
    };
};

const clearSelectedTargets = () => {
    if (!shouldShowTargetFilter(selectedNode.value)) return;
    selectedNode.value.data.targetFilter = {
        ...selectedTargetFilter.value,
        meshNames: [],
        nodePaths: []
    };
};

const isTargetNodeExpanded = (nodeId) => expandedTargetNodes.value.has(nodeId);

const toggleTargetNodeExpanded = (nodeId) => {
    const next = new Set(expandedTargetNodes.value);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    expandedTargetNodes.value = next;
};

const minimizeBlueprintForPicking = () => {
    minimizedForPicking.value = true;
    skipNextOpenReload.value = true;
    restoringAfterPicking.value = false;
    eventTargetPickingComponentId.value = props.component?.id || '';
    emit('update:modelValue', false);
};

const restoreBlueprintAfterPicking = () => {
    if (!minimizedForPicking.value || restoringAfterPicking.value) return;
    restoringAfterPicking.value = true;
    emit('update:modelValue', true);
};

const clearPickingMinimizeState = () => {
    minimizedForPicking.value = false;
    skipNextOpenReload.value = false;
    restoringAfterPicking.value = false;
    eventTargetPickingNodeId.value = '';
    eventTargetPickingComponentId.value = '';
};

const toggleEventTargetPicking = () => {
    if (!props.component?.id || selectedTargetFilter.value.mode === 'all') return;
    if (isEventTargetPickingActive.value) {
        componentStore.stopMeshPicking();
        clearPickingMinimizeState();
        return;
    }
    eventTargetPickingNodeId.value = selectedNode.value?.id || '';
    componentStore.startMeshPicking(props.component.id, 'event-target');
    validationMessage.value = '请点击场景中的模型 Mesh 进行目标拾取';
    minimizeBlueprintForPicking();
};

const handleMethodTargetChange = (targetComponentId) => {
    updateSelectedNodeData({
        targetComponentId,
        methodName: '',
        parameters: []
    });
    methodTargetSearchQuery.value = '';
    cameraJumpMeshSearchQuery.value = '';
};

const createConditionInput = (source = 'variable') => ({
    id: createId('input'),
    alias: `value${selectedConditionInputs.value.length + 1}`,
    source,
    variableName: variableOptions.value[0]?.value || '',
    key: '',
    path: '',
    argIndex: 0,
    componentId: '',
    publicSourceId: publicSourceOptions.value[0]?.value || '',
    value: '',
    code: `async ({ eventData, variables, inputs }) => {\n  return eventData\n}`
});

const handleConditionModeChange = (conditionMode) => {
    const updates = { conditionMode };
    if (conditionMode === 'expression' && !String(selectedNode.value?.data?.expression || '').trim()) {
        updates.expression = 'true';
    }
    if (conditionMode === 'compare') {
        updates.leftExpression = selectedNode.value?.data?.leftExpression || 'value1';
        updates.operator = selectedNode.value?.data?.operator || 'eq';
        updates.rightExpression = selectedNode.value?.data?.rightExpression || '';
    }
    if (conditionMode === 'code' && !String(selectedNode.value?.data?.conditionCode || '').trim()) {
        updates.conditionCode = `async ({ eventData, variables, inputs }) => {\n  return true\n}`;
    }
    updateSelectedNodeData(updates);
};

const addSelectedConditionInput = () => {
    if (!selectedNode.value || selectedNode.value.type !== 'condition') return;
    if (!Array.isArray(selectedNode.value.data.conditionInputs)) {
        selectedNode.value.data.conditionInputs = [];
    }
    selectedNode.value.data.conditionInputs.push(createConditionInput());
};

const removeSelectedConditionInput = (index) => {
    if (!selectedNode.value || selectedNode.value.type !== 'condition') return;
    selectedNode.value.data.conditionInputs.splice(index, 1);
};

const handleConditionInputSourceChange = (input, source) => {
    if (!input) return;
    input.source = source;
    if (source === 'variable' && !input.variableName) {
        input.variableName = variableOptions.value[0]?.value || '';
    }
    if (source === 'publicSource' && !input.publicSourceId) {
        input.publicSourceId = publicSourceOptions.value[0]?.value || '';
    }
};

const addSelectedMethodParam = () => {
    if (!selectedNode.value || selectedNode.value.type !== 'method') return;
    if (!Array.isArray(selectedNode.value.data.parameters)) {
        selectedNode.value.data.parameters = [];
    }

    const existingKeys = new Set(
        selectedNode.value.data.parameters
            .map((param) => String(param?.key || '').trim())
            .filter(Boolean)
    );
    const nextDefinition = selectedMethodParamDefinitions.value.find((param) => {
        const name = String(param?.name || '').trim();
        return name && !existingKeys.has(name);
    });

    selectedNode.value.data.parameters.push(
        nextDefinition ? createMethodParamRow(nextDefinition) : { key: '', value: '' }
    );
};

const removeSelectedMethodParam = (index) => {
    if (!selectedNode.value || selectedNode.value.type !== 'method') return;
    selectedNode.value.data.parameters.splice(index, 1);
};

const openNodeContextMenu = (nodeId, event) => {
    if (nodeId === 'component_root') return;
    selectedNodeId.value = nodeId;
    selectedEdgeId.value = '';
    contextMenu.visible = true;
    contextMenu.kind = 'node';
    contextMenu.id = nodeId;
    const point = getCanvasPoint(event);
    contextMenu.x = point.x;
    contextMenu.y = point.y;
};

const openEdgeContextMenu = (edgeId, event) => {
    selectedEdgeId.value = edgeId;
    selectedNodeId.value = '';
    contextMenu.visible = true;
    contextMenu.kind = 'edge';
    contextMenu.id = edgeId;
    const point = getCanvasPoint(event);
    contextMenu.x = point.x;
    contextMenu.y = point.y;
};

const closeContextMenu = () => {
    contextMenu.visible = false;
    contextMenu.kind = '';
    contextMenu.id = '';
};

const deleteSelectedEdge = () => {
    const edgeId = selectedEdgeId.value || contextMenu.id;
    const index = draft.edges.findIndex((edge) => edge.id === edgeId);
    if (index >= 0) draft.edges.splice(index, 1);
    selectedEdgeId.value = '';
    closeContextMenu();
};

const deleteSelectedNode = () => {
    const nodeId = selectedNodeId.value || contextMenu.id;
    if (!nodeId || nodeId === 'component_root') return;
    const index = draft.nodes.findIndex((node) => node.id === nodeId);
    if (index >= 0) draft.nodes.splice(index, 1);
    draft.edges = draft.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    selectedNodeId.value = '';
    closeContextMenu();
};

const autoLayout = () => {
    const root = draft.nodes.find((node) => node.id === 'component_root');
    if (root) {
        root.x = 40;
        root.y = 120;
    }

    triggerNodes.value.forEach((trigger, index) => {
        trigger.x = 300;
        trigger.y = 60 + index * 150;
        const reachable = collectReachable(trigger.id);
        let column = 0;
        reachable.forEach((nodeId) => {
            const node = draft.nodes.find((item) => item.id === nodeId);
            if (!node || node.type === 'trigger') return;
            column += 1;
            node.x = 560 + (column - 1) * 260;
            node.y = trigger.y;
        });
    });
};

const addTriggerAtDefaultPosition = () => {
    const y = 70 + triggerNodes.value.length * 130;
    const trigger = createTriggerNode(eventTypeOptions.value[0]?.value || '', 300, y);
    draft.nodes.push(trigger);
    connectNodes('component_root', trigger.id);
    selectedNodeId.value = trigger.id;
};

const collectReachable = (startNodeId) => {
    const visited = new Set();
    const stack = [startNodeId];
    while (stack.length) {
        const current = stack.pop();
        draft.edges
            .filter((edge) => edge.source === current)
            .forEach((edge) => {
                if (visited.has(edge.target)) return;
                visited.add(edge.target);
                stack.push(edge.target);
            });
    }
    return Array.from(visited);
};

const validateBlueprint = () => {
    const errors = [];
    const triggers = triggerNodes.value;
    if (!triggers.length) {
        errors.push('至少需要一个事件入口');
    }

    triggers.forEach((trigger) => {
        if (!trigger.data.eventType) {
            errors.push('事件入口缺少事件类型');
        }
        if (shouldUseTargetFilter(trigger.data.eventType)) {
            const filter = normalizeTargetFilter(trigger.data.targetFilter, trigger.data.eventType);
            if (!filter) return;
            const eventLabel = getEventLabel(trigger.data.eventType);
            if (filter.mode !== 'all' && filter.meshNames.length === 0 && filter.nodePaths.length === 0) {
                errors.push(`${eventLabel} 需要选择至少一个命中目标`);
            }
            if (filter.mode === 'all') {
                const limit = ['onHover', 'onHoverOut'].includes(trigger.data.eventType)
                    ? ALL_HOVER_MESH_LIMIT
                    : ALL_CLICK_MESH_LIMIT;
                if (modelMeshCount.value > limit) {
                    errors.push(`${eventLabel} 的全部模式最多支持 ${limit} 个 Mesh，请改为指定目标`);
                }
            }
        }
    });

    draft.nodes.forEach((node) => {
        if (node.type === 'method') {
            if (!node.data.targetComponentId || !node.data.methodName) {
                errors.push('调用组件方法节点未配置完整');
            }
        }
        if (node.type === 'variable') {
            if (!node.data.variableName || !String(node.data.valueExpression || '').trim()) {
                errors.push('设置变量节点未配置完整');
            }
        }
        if (node.type === 'code' && !String(node.data.code || '').trim()) {
            errors.push('自定义脚本节点不能为空');
        }
        if (node.type === 'condition') {
            const mode = node.data.conditionMode || 'expression';
            if (mode === 'code' && !String(node.data.conditionCode || '').trim()) {
                errors.push('请填写脚本判断内容');
            }
            const aliases = new Set();
            (Array.isArray(node.data.conditionInputs) ? node.data.conditionInputs : []).forEach((input) => {
                const alias = String(input?.alias || '').trim();
                if (!alias) return;
                if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(alias)) {
                    errors.push(`数据引用名“${alias}”只能使用字母、数字、下划线，且不能以数字开头`);
                }
                if (aliases.has(alias)) {
                    errors.push(`数据引用名“${alias}”重复，请换一个`);
                }
                aliases.add(alias);
            });
        }
    });

    return errors;
};

const compileEvents = () => {
    const errors = validateBlueprint();
    if (errors.length) {
        validationMessage.value = errors[0];
        toast.warning(errors[0], '提示');
        return null;
    }

    const blueprint = {
        version: 1,
        componentId: props.component?.id || '',
        componentName: props.component?.name || '',
        updatedAt: Date.now(),
        nodes: cloneJson(draft.nodes, []),
        edges: cloneJson(draft.edges, [])
    };

    const root = blueprint.nodes.find((node) => node.id === 'component_root');
    if (root) {
        root.data = {
            ...(root.data || {}),
            label: props.component?.name || root.data?.label || '组件'
        };
    }

    return blueprint.nodes
        .filter((node) => node.type === 'trigger')
        .map((trigger) => {
            const eventId = trigger.data.eventId || createId('event');
            trigger.data.eventId = eventId;
            const targetFilter = normalizeTargetFilter(trigger.data.targetFilter, trigger.data.eventType);
            if (targetFilter) {
                trigger.data.targetFilter = targetFilter;
            } else {
                delete trigger.data.targetFilter;
            }
            return {
                id: eventId,
                type: trigger.data.eventType,
                enabled: trigger.data.enabled !== false,
                handlerType: 'blueprint',
                handler: '',
                methodCallConfig: null,
                blueprint,
                blueprintTriggerNodeId: trigger.id,
                targetFilter,
                description: '蓝图事件流',
                createdAt: trigger.data.createdAt || Date.now()
            };
        });
};

const handleSave = async () => {
    if (props.disabled) return;
    const events = compileEvents();
    if (!events) return;
    if (isEventTargetPickingActive.value) {
        componentStore.stopMeshPicking();
    }
    clearPickingMinimizeState();
    emit('save', events);
    await nextTick();
    emit('update:modelValue', false);
};

const handleCancel = () => {
    if (isEventTargetPickingActive.value) {
        componentStore.stopMeshPicking();
    }
    clearPickingMinimizeState();
    emit('update:modelValue', false);
};

onUnmounted(() => {
    stopNodeDrag();
    stopConnect();
    if (isEventTargetPickingActive.value) {
        componentStore.stopMeshPicking();
    }
    clearPickingMinimizeState();
});
</script>

<style scoped>
.blueprint-shell {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 360px;
    height: 76vh;
    min-height: 620px;
    overflow: hidden;
    background: #121418;
    color: #d7dde7;
}

.blueprint-sidebar,
.blueprint-inspector {
    min-width: 0;
    overflow: auto;
    background: #171a20;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding: 14px;
}

.blueprint-inspector {
    border-right: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-title,
.inspector-title {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 12px;
}

.palette-group {
    margin-bottom: 18px;
}

.palette-title {
    font-size: 12px;
    color: #8b95a5;
    margin-bottom: 8px;
}

.palette-group--advanced {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 12px;
}

.palette-group--advanced summary {
    cursor: pointer;
}

.palette-item {
    padding: 9px 10px;
    margin-bottom: 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(180deg, #2a2f38, #1c2027);
    color: #dce6f4;
    font-size: 12px;
    cursor: grab;
    user-select: none;
}

.palette-item--event {
    border-left: 3px solid #d34b4b;
}

.palette-item--flow {
    border-left: 3px solid #d8b24b;
}

.palette-item--action {
    border-left: 3px solid #3b9bdc;
}

.palette-item--variable {
    border-left: 3px solid #3bdc9f;
}

.palette-item--code {
    border-left: 3px solid #a65eea;
}

.blueprint-main {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
}

.blueprint-toolbar {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: #171a20;
}

.toolbar-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
}

.toolbar-title span {
    color: #8993a3;
}

.toolbar-actions {
    display: flex;
    gap: 8px;
}

.blueprint-canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background-color: #1b1e23;
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px),
        linear-gradient(rgba(255, 255, 255, 0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
    background-size: 48px 48px, 48px 48px, 12px 12px, 12px 12px;
}

.edge-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.edge-path {
    pointer-events: stroke;
    fill: none;
    stroke: rgba(214, 220, 230, 0.72);
    stroke-width: 3;
    cursor: pointer;
}

.edge-path.selected {
    stroke: #4db2ff;
    stroke-width: 4;
}

.edge-path--preview {
    stroke: #5cc8ff;
    stroke-dasharray: 8 6;
}

.flow-node {
    position: absolute;
    width: 190px;
    min-height: 74px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(180deg, #2b3038, #11151a);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
    user-select: none;
}

.flow-node.selected {
    border-color: #4db2ff;
    box-shadow: 0 0 0 2px rgba(77, 178, 255, 0.25), 0 10px 22px rgba(0, 0, 0, 0.45);
}

.flow-node--root .node-header {
    background: linear-gradient(90deg, #303744, #1e242d);
}

.flow-node--trigger .node-header {
    background: linear-gradient(90deg, #833232, #2b1414);
}

.flow-node--condition .node-header {
    background: linear-gradient(90deg, #766123, #2b2410);
}

.flow-node--method .node-header {
    background: linear-gradient(90deg, #1f5a86, #102535);
}

.flow-node--variable .node-header {
    background: linear-gradient(90deg, #287153, #102a21);
}

.flow-node--code .node-header {
    background: linear-gradient(90deg, #61368a, #21142f);
}

.node-header {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    border-radius: 8px 8px 0 0;
    font-size: 12px;
    font-weight: 700;
}

.node-badge {
    color: #ffcf70;
    font-size: 11px;
}

.node-body {
    padding: 10px;
    min-height: 44px;
    color: #d5deec;
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
}

.node-handle {
    position: absolute;
    z-index: 2;
    width: 12px;
    height: 12px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid #cdd5df;
    background: #11151a;
    cursor: crosshair;
}

.node-handle--input {
    left: -7px;
    top: 31px;
}

.node-handle--output {
    right: -7px;
    top: 31px;
}

.context-menu {
    position: absolute;
    z-index: 20;
    min-width: 110px;
    padding: 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #242a33;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
}

.context-menu button {
    width: 100%;
    border: 0;
    border-radius: 4px;
    padding: 7px 8px;
    background: transparent;
    color: #f1b4b4;
    text-align: left;
    cursor: pointer;
}

.context-menu button:hover {
    background: rgba(255, 255, 255, 0.08);
}

.inspector-empty {
    color: #8b95a5;
    font-size: 12px;
    padding: 20px 0;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-bottom: 14px;
}

.form-group label,
.checkbox-row {
    font-size: 12px;
    color: #a9b3c2;
}

.form-input,
.form-textarea {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    background: #101318;
    color: #e2e8f2;
    font-size: 12px;
    padding: 8px;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: #4db2ff;
}

.form-textarea {
    min-height: 90px;
    resize: vertical;
}

.code-field {
    font-family: Consolas, Monaco, 'Courier New', monospace;
}

.code-editor {
    min-height: 220px;
}

.checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
}

.target-filter-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    margin-bottom: 14px;
    border: 1px solid rgba(77, 178, 255, 0.22);
    border-radius: 8px;
    background: rgba(77, 178, 255, 0.045);
}

.target-filter-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.target-filter-title {
    font-size: 12px;
    font-weight: 700;
    color: #dce8f8;
}

.target-filter-summary,
.target-filter-count {
    color: #8fa0b6;
    font-size: 11px;
    line-height: 1.5;
}

.target-mode-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
}

.target-mode-tab {
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 7px 6px;
    background: #111821;
    color: #aebbd0;
    font-size: 12px;
    cursor: pointer;
}

.target-mode-tab.active {
    border-color: #4d8dff;
    background: rgba(47, 125, 244, 0.22);
    color: #eaf2ff;
}

.target-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 6px;
}

.target-actions--compact {
    grid-template-columns: minmax(0, 1fr) auto;
}

.target-actions--method {
    grid-template-columns: minmax(0, 1fr) auto auto;
}

.target-checkbox-row {
    margin-bottom: 0;
}

.target-filter-warning,
.target-empty {
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 207, 112, 0.08);
    color: #ffcf70;
    font-size: 11px;
    line-height: 1.5;
}

.target-empty {
    background: rgba(255, 255, 255, 0.04);
    color: #8795a8;
}

.target-tree-title {
    color: #9aacc4;
    font-size: 11px;
    font-weight: 700;
}

.target-tree {
    max-height: 210px;
    overflow: auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(10, 13, 18, 0.56);
}

.target-tree-row {
    display: grid;
    grid-template-columns: 16px 14px minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 4px 8px;
    color: #c7d1df;
    font-size: 12px;
    cursor: pointer;
}

.target-tree-row:hover {
    background: rgba(255, 255, 255, 0.06);
}

.target-tree-row.selected {
    background: rgba(47, 125, 244, 0.18);
}

.target-tree-row.disabled {
    color: #6e7b8e;
    cursor: default;
}

.target-tree-row--single {
    grid-template-columns: 16px 14px minmax(0, 1fr) auto;
}

.target-expand-btn {
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #9eafc5;
    cursor: pointer;
}

.target-expand-spacer {
    width: 16px;
}

.target-node-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.target-node-type {
    color: #758399;
    font-size: 10px;
}

.target-tree-overflow {
    padding: 8px 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    color: #8ba0bc;
    font-size: 11px;
    line-height: 1.5;
    background: rgba(15, 23, 42, 0.42);
}

.target-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.target-tag {
    max-width: 100%;
    border: 1px solid rgba(77, 178, 255, 0.26);
    border-radius: 999px;
    padding: 4px 8px;
    background: rgba(77, 178, 255, 0.12);
    color: #cfe5ff;
    font-size: 11px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.field-hint {
    color: #7f8a9a;
    font-size: 11px;
    line-height: 1.5;
}

.camera-jump-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    margin-bottom: 14px;
    border: 1px solid rgba(99, 179, 237, 0.2);
    border-radius: 8px;
    background: rgba(56, 139, 253, 0.04);
}

.camera-jump-section--compact {
    gap: 12px;
}

.camera-jump-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}

.camera-jump-grid label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
    color: #a9b3c2;
    font-size: 12px;
}

.camera-jump-grid label.camera-jump-checkbox {
    flex-direction: row;
    align-items: center;
    justify-content: center;
}

.camera-jump-checkbox input {
    margin-right: 6px;
}

.vector3-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
}

.condition-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    margin-bottom: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.025);
}

.condition-input-row {
    display: grid;
    grid-template-columns: minmax(0, 86px) minmax(0, 1fr) 28px;
    gap: 6px;
    align-items: start;
}

.condition-input-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
}

.condition-input-body--two {
    grid-template-columns: 84px minmax(0, 1fr);
}

.condition-mini-editor {
    min-height: 70px;
}

.condition-code-editor {
    min-height: 120px;
}

.compare-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
}

.param-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.param-row {
    display: grid;
    grid-template-columns: 84px 104px minmax(0, 1fr) 28px;
    gap: 6px;
    margin-bottom: 6px;
}

.material-props-editor {
    gap: 8px;
}

.material-prop-row {
    display: grid;
    grid-template-columns: minmax(120px, 0.9fr) minmax(0, 1.1fr) 28px;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}

.material-color-input {
    height: 34px;
    padding: 3px;
}

.material-checkbox-row {
    min-height: 34px;
    margin-bottom: 0;
    align-items: center;
}

.material-number-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 72px;
    align-items: center;
    gap: 6px;
}

.material-range-input {
    min-width: 0;
}

.text-btn,
.icon-btn {
    border: 0;
    background: transparent;
    color: #5cc8ff;
    cursor: pointer;
}

.icon-btn {
    color: #f1b4b4;
    font-size: 18px;
}

.delete-node-btn {
    width: 100%;
}

.footer-left {
    margin-right: auto;
}

.validation-message {
    color: #ffcf70;
    font-size: 12px;
}
</style>
