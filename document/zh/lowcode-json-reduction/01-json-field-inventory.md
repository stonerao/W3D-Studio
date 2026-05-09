# 组件 JSON 字段排查清单

排查范围：`packages/editor-w3d/src/utils/componentRegistry.js` 中组件 `configSchema` 暴露的 `type: 'json'` 字段，以及 `PropertyEditorFields.vue` 当前已经特殊处理的 JSON 字段。

## 统计

- 组件注册记录：31 条，`Heatmap` 重复注册已清理。
- 唯一组件：31 类。
- 当前运行时有效 JSON 字段：20 个。
- 涉及 JSON 字段的组件：10 类。
- 无 JSON 字段的组件：21 类。
- 当前已有低码编辑入口覆盖：AreaBlock、MigrationLine、MultiPathAnimation、Label3D、Heatmap、CameraTour
- 普通属性面板直接暴露 JSON 的重点问题已收口，原始 JSON 统一进入高级配置。

## 明细

| 组件 | 字段 | 源位置 | 当前表现 | 风险 | 建议 |
| --- | --- | --- | --- | --- | --- |
| Heatmap | `data` | `componentRegistry.js:1511` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| Heatmap | `colors` | `componentRegistry.js:1799` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| Heatmap | `thresholds` | `componentRegistry.js:1807` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| AreaBlock | `areas` | `componentRegistry.js:1880` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| TrajectoryMove | `points` | `componentRegistry.js:2193` | 路线摘要 + 轨迹编辑入口 | 已收口 | 属性区摘要，原始 JSON 在高级配置 |
| MultiPathAnimation | `paths` | `componentRegistry.js:2289` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| CameraTour | `views` | `componentRegistry.js:2383` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| MigrationLine | `lines` | `componentRegistry.js:2841` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| Label3D | `labels` | `componentRegistry.js:3096` | 摘要 + 编辑按钮 | 已收口 | 保留摘要 + 编辑按钮 |
| PointTypeMarkerManager | `types` | `componentRegistry.js:3496` | 类型管理入口 + 高级配置 | 已收口 | 在点位类型管理面板维护 |
| PointTypeMarkerManager | `points` | `componentRegistry.js:3505` | 点位管理入口 + 高级配置 | 已收口 | 在点位类型管理面板维护 |
| PointTypeMarkerManager | `dataSnapshot` | `componentRegistry.js:3514` | 映射配置入口 + 高级配置 | 已收口 | 通过数据绑定、导入或高级配置维护 |
| PointTypeMarkerManager | `dataMapping` | `componentRegistry.js:3523` | 映射配置入口 + 高级配置 | 已收口 | 使用模板、路径选择、字段映射表 |
| PointTypeMarkerManager | `stateStyles` | `componentRegistry.js:3532` | 状态样式表单 + 高级配置 | 已收口 | 状态样式编辑器维护 |
| CameraPointManager | `types` | `componentRegistry.js:3605` | 摄像头点位管理入口 + 高级配置 | 已收口 | 在摄像头点位管理面板维护 |
| CameraPointManager | `typeStyles` | `componentRegistry.js:3614` | 摄像头点位管理入口 + 高级配置 | 已收口 | 统一为类型样式编辑器 |
| CameraPointManager | `eventConfig` | `componentRegistry.js:3623` | 事件配置表单 + 高级配置 | 已收口 | 事件开关、动作选择或蓝图配置 |
| CameraPointManager | `videoModalStyle` | `componentRegistry.js:3632` | 弹窗样式表单 + 高级配置 | 已收口 | 预设、位置、尺寸表单 |
| CameraPointManager | `points` | `componentRegistry.js:3641` | 点位管理入口 + 高级配置 | 已收口 | 点位管理面板维护 |
| BuildingEditor | `points` | `componentRegistry.js:4675` | 普通属性区隐藏 + 高级配置 | 已收口 | 原始数据保留兼容 |

## 额外发现

`Heatmap` 原存在两次注册。当前已移除旧的基础注册，仅保留高级热力图配置。

## 已排查无 JSON 字段的组件

以下组件的 `configSchema` 未发现 `type: 'json'` 字段，当前不需要针对属性 JSON textarea 做专项改造：

| 组件 | 注册位置 | 结论 |
| --- | --- | --- |
| ModelLoader | `componentRegistry.js:293` | 无 JSON 属性字段 |
| GaussianSplatLoader | `componentRegistry.js:446` | 无 JSON 属性字段 |
| GeoJSONLoader | `componentRegistry.js:636` | 原数组 JSON 字段已改为 `vector2`、`colorRange`、`numberRange` |
| GridHelper | `componentRegistry.js:853` | 无 JSON 属性字段 |
| HDRLoader | `componentRegistry.js:900` | 无 JSON 属性字段 |
| TransformControls | `componentRegistry.js:963` | 无 JSON 属性字段 |
| FlyControls | `componentRegistry.js:993` | 无 JSON 属性字段 |
| FirstPersonControls | `componentRegistry.js:1020` | 无 JSON 属性字段 |
| BoundingBoxHelper | `componentRegistry.js:1049` | 无 JSON 属性字段 |
| ParticleSystem | `componentRegistry.js:1072` | 无 JSON 属性字段 |
| PathAnimation | `componentRegistry.js:2132` | 无 JSON 属性字段 |
| CameraJump | `componentRegistry.js:2649` | 无 JSON 属性字段 |
| ModelAnimation | `componentRegistry.js:2878` | 无 JSON 属性字段 |
| MarkArea | `componentRegistry.js:3338` | 无 JSON 属性字段 |
| MarkLine | `componentRegistry.js:3397` | 无 JSON 属性字段 |
| MarkPoint | `componentRegistry.js:3441` | 无 JSON 属性字段 |
| ExplodedView | `componentRegistry.js:3767` | 无 JSON 属性字段 |
| DeviceExplodedView | `componentRegistry.js:3957` | 无 JSON 属性字段 |
| PostProcessing | `componentRegistry.js:4153` | 无 JSON 属性字段 |
| TrafficRoadsideDeviceManager | `componentRegistry.js:4679` | 无 JSON 属性字段 |
| WeatherLighting | `componentRegistry.js:4866` | 无 JSON 属性字段 |

## 可绑定属性中的 JSON 类型

`packages/editor-w3d/src/utils/bindableProperties.js:25` 将通用 `scale` 标记为 `type: 'json'`，用于兼容单值缩放和 `[x, y, z]` 缩放。该字段不属于组件属性面板的 `configSchema`，但会影响数据绑定配置体验。

建议在数据绑定中把 `scale` 拆成低码模式：

1. 统一缩放：绑定一个数字。
2. XYZ 缩放：分别绑定 X、Y、Z。
3. 高级兼容：保留原 JSON 绑定方式，但默认折叠。

## 当前通用 JSON 渲染入口

- `packages/editor-w3d/src/components/panels/PropertyEditorFields.vue`
- `packages/editor-w3d/src/components/panels/PropertyEditor.vue`

通用兜底逻辑仍然会把未特殊处理的 `type: 'json'` 字段渲染为 textarea。后续应将该兜底逻辑改成：

1. 默认显示“该字段需要专用编辑器”的空态。
2. 对已支持字段展示摘要 + 编辑入口。
3. 仅在高级模式下显示原始 JSON。
