# 各组件低码化改造方案

## P0：截图中直接暴露大量 JSON 的组件

### CameraPointManager 摄像头点位

当前问题：

- `types`
- `typeStyles`
- `eventConfig`
- `videoModalStyle`
- `points`

这些字段仍在属性区展示为 JSON。虽然已有 `CameraPointManagerEditor.vue`，但属性区未收口，导致用户仍会看到大量 JSON。

改造方案：

1. 在 `PropertyEditor.vue` 的 `configSchema` 中过滤上述字段。
2. 在属性区保留“摄像头点位配置摘要”：
   - 点位数量
   - 类型样式数量
   - 点击弹窗是否启用
   - 双击弹窗是否启用
   - 视频弹窗预设
3. 摘要卡片提供“打开点位管理”按钮，跳转或展开 `CameraPointManagerEditor`。
4. 在 `CameraPointManagerEditor.vue` 中继续完善低码控件：
   - 类型样式：图片、模型、标签、颜色、缩放、偏移、旋转
   - 事件：点击/双击开关、动作选择、弹窗开关
   - 视频弹窗：预设、位置、宽高、固定坐标
5. JSON 导入/导出保留在管理面板工具栏，不在属性区展示。

### PointTypeMarkerManager 多类型点位管理

当前问题：

- `types`
- `points`
- `dataSnapshot`
- `dataMapping`
- `stateStyles`

这些字段结构复杂，普通用户不应手写 JSON。

改造方案：

1. 在属性区过滤上述字段。
2. `PointTypeMarkerManagerEditor.vue` 作为唯一配置入口。
3. 增加或强化以下低码配置：
   - 类型管理：类型名称、类型 ID、资源类型、图片/模型资源、颜色、缩放、偏移。
   - 点位管理：点位名称、类型、坐标、显示状态、单点覆盖样式。
   - 数据映射：模板选择、路径选择、字段映射表。
   - 状态样式：normal/hover/click/highlight 分组表单。
4. `dataSnapshot` 仅通过数据绑定、导入 JSON、预览结果写入，不提供手写 textarea。

### TrajectoryMove 轨迹移动

当前问题：

- `points` 仍是 JSON 字段。
- 已有 `TrajectoryMoveEditor.vue`，但属性区仍展示 JSON。

改造方案：

1. 属性区隐藏 `points`。
2. 显示路线摘要：
   - 点位数量
   - 起点
   - 终点
3. 提供“编辑路线”按钮，打开或定位到轨迹编辑面板。
4. 保留画布拾取、手动新增点、坐标表格、导入/导出。

## P1：已有弹窗编辑器，但需要去掉 JSON 兜底

### Heatmap 热力图

当前字段：

- `data`
- `colors`
- `thresholds`

现状已有热力点、颜色节点、阈值映射编辑弹窗。后续重点不是新增编辑器，而是避免任何情况下回退到 JSON textarea。

改造方案：

1. 属性区只显示摘要 + 编辑按钮。
2. 颜色梯度使用颜色节点列表，不允许手写数组。
3. 阈值映射使用表格行：值、颜色、删除、排序。
4. 支持导入点位文件，但不提供默认手写 JSON。

### CameraTour 定点漫游

当前字段：

- `views`

现状已有视角列表编辑弹窗。

改造方案：

1. 属性区只显示视角数量 + 编辑按钮。
2. 支持从视角管理器插入视角。
3. 保留保存当前视角、新增视角、排序、删除。

### Label3D 标签

当前字段：

- `labels`

现状已有标签列表编辑弹窗。

改造方案：

1. 属性区只显示标签数量 + 编辑按钮。
2. 标签配置包含：文本、位置、颜色、背景、渲染模式、锚点、缩放、可见状态。
3. 复杂样式使用表单和颜色选择器。

### MigrationLine 迁移线

当前字段：

- `lines`

现状已有线条编辑弹窗。

改造方案：

1. 属性区只显示线条数量 + 编辑按钮。
2. 线条点位使用列表和坐标表格。
3. 全局线条样式继续使用普通属性控件。

### MultiPathAnimation 多轨迹路径动画

当前字段：

- `paths`

现状已有多轨迹编辑弹窗。

改造方案：

1. 属性区只显示路径数量 + 编辑按钮。
2. 路径内部点位使用可排序列表。
3. 模型资源、缩放、速度等继续使用表单属性。

### AreaBlock 区域块

当前字段：

- `areas`

现状已有区域块编辑弹窗。

改造方案：

1. 属性区只显示区域数量 + 编辑按钮。
2. 区域点位使用坐标列表和拾取能力。
3. 区域样式使用颜色、透明度、高度等控件。

## P2：需要新增结构化控件的组件

### GeoJSONLoader 数据城市

当前字段：

- `coordinateSystem.center`
- `visualMapping.colorRange`
- `visualMapping.heightRange`

改造方案：

1. `coordinateSystem.center` 改成经度、纬度两个数字输入。
2. `visualMapping.colorRange` 改成起始颜色、结束颜色两个颜色选择器。
3. `visualMapping.heightRange` 改成最小高度、最大高度两个数字输入。
4. `GeoJSONLoaderEditor.vue` 中的“内联 GeoJSON”输入改为导入文件、示例数据、数据预览为主；手写 JSON 放入高级模式。

### BuildingEditor 点位数据

当前字段：

- `points`

现状：

- 组件库中已标注 BuildingEditor 移除，但注册表仍保留。

改造方案：

1. 如果该组件仍需要使用，复用点位管理器的点位表格和拾取交互。
2. 如果不再对外开放，移除或隐藏该组件 schema，避免在属性面板出现 JSON。

## 通用属性面板改造

目标文件：

- `PropertyEditor.vue`
- `PropertyEditorFields.vue`
- `componentRegistry.js`

建议步骤：

1. 保留旧配置字段的读写兼容，不直接删除历史字段。
2. 增加 `jsonEditorMode`、`editor` 或 `hiddenInBasicPanel` 元数据，例如：
   - `editor: 'camera-point-manager'`
   - `editor: 'point-type-marker-manager'`
   - `editor: 'heatmap-points'`
3. `PropertyEditorFields.vue` 不再默认 textarea 渲染所有 JSON。
4. 无专用编辑器的 JSON 字段显示“暂不支持低码编辑”，并提供高级模式入口。
5. 逐步将可结构化字段改成新的 schema 类型：
   - `vector2`
   - `colorRange`
   - `numberRange`
   - `pointList`
   - `styleStateMap`
   - `eventActionMap`

普通用户看到的是摘要、按钮、表单和列表；开发者模式才允许直接查看或粘贴原始 JSON。
