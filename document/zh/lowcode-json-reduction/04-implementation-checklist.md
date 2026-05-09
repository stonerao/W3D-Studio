# 实施清单

## P0：先消除截图中的大段 JSON

| 项 | 目标文件 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| CameraPointManager 属性收口 | `PropertyEditor.vue`、`PropertyEditorFields.vue`、`CameraPointManagerEditor.vue` | 已完成 | 属性区不再显示 `types`、`typeStyles`、`eventConfig`、`videoModalStyle`、`points` 的 JSON textarea，只显示摘要和“打开点位管理” |
| CameraPointManager 事件配置低码化 | `CameraPointManagerEditor.vue`、`EventBlueprintEditor.vue` | 已完成 | 点击、双击、悬停等事件通过蓝图或动作选择配置，不手写 `eventConfig` |
| CameraPointManager 视频弹窗样式低码化 | `CameraPointManagerEditor.vue` | 已完成 | 弹窗预设、位置、宽度、高度、固定坐标通过表单配置 |
| PointTypeMarkerManager 属性收口 | `PropertyEditor.vue`、`PointTypeMarkerManagerEditor.vue` | 已完成 | 属性区不再显示类型、点位、映射、状态样式 JSON |
| PointTypeMarkerManager 状态样式编辑器 | `PropertyEditor.vue`、`PointTypeMarkerManagerEditor.vue` | 已完成 | normal、hover、click、highlight 按分组表单编辑 |
| TrajectoryMove 路线点位收口 | `PropertyEditor.vue`、`TrajectoryMoveEditor.vue` | 已完成 | 属性区只显示路线摘要和“编辑路线”，点位维护进入轨迹编辑面板 |

## P1：已有编辑器的 JSON 兜底收口

| 项 | 目标文件 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| Heatmap | `PropertyEditorFields.vue`、`PropertyEditor.vue` | 已完成 | 热力点、颜色梯度、阈值映射仅显示摘要和编辑按钮 |
| AreaBlock | `PropertyEditorFields.vue`、`PropertyEditor.vue` | 已完成 | 区域列表不显示 JSON textarea，使用区域编辑弹窗 |
| MigrationLine | `PropertyEditorFields.vue`、`PropertyEditor.vue` | 已完成 | 线条列表不显示 JSON textarea，使用线条编辑弹窗 |
| MultiPathAnimation | `PropertyEditorFields.vue`、`PropertyEditor.vue` | 已完成 | 路径列表不显示 JSON textarea，使用多路径编辑弹窗 |
| CameraTour | `PropertyEditorFields.vue`、`PropertyEditor.vue` | 已完成 | 视角列表不显示 JSON textarea，使用视角列表编辑 |
| Label3D | `PropertyEditorFields.vue`、`PropertyEditor.vue` | 已完成 | 标签列表不显示 JSON textarea，使用标签列表编辑 |

## P2：结构化控件和高级模式

| 项 | 目标文件 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| GeoJSONLoader 数组字段表单化 | `componentRegistry.js`、`GeoJSONLoaderEditor.vue` | 已完成 | 坐标中心、颜色范围、高度范围改为数字/颜色控件 |
| GeoJSON 内联 JSON 高级化 | `GeoJSONLoaderEditor.vue` | 已完成 | 默认入口为 URL、文件导入、示例数据和预览，粘贴 JSON 放入高级模式 |
| 交通坐标拟合控制点表格化 | `TrafficCoordinateFittingEditor.vue` | 已完成 | 控制点默认通过表格维护，JSON 粘贴仅作为高级批量导入 |
| BuildingEditor 清理 | `componentRegistry.js` | 已完成 | 普通属性区隐藏点位 JSON，原始数据保留在高级配置 |
| 绑定属性 scale 类型治理 | `DataBindingEditor.vue` | 部分完成 | 普通属性绑定继续使用变量选择；缩放专用三轴绑定后续单独补强 |
| HTTP Body 构建器 | `DataBindingEditor.vue`、`PublicInterfacePanel.vue`、`ConnectionManager.vue` | 部分完成 | 原始 JSON/XML 默认折叠到高级配置；对象构建器后续可继续增强 |
| 数据转换低码化 | `DataBindingEditor.vue`、`DataSourceConfigModal.vue` | 已完成 | 默认使用路径选择和转换模板；脚本折叠到高级模式 |
| 变量对象/数组编辑器 | `VariableValueEditor.vue` | 已完成 | 对象使用键值树，数组使用列表表格，JSON 编辑仅作为高级批量输入 |
| 蓝图高级脚本收口 | `EventBlueprintEditor.vue` | 已完成 | 普通动作优先使用专用节点，自定义脚本归入高级节点 |

## 通用验收

1. 普通属性区不出现高度超过单行输入的大段 JSON textarea。
2. 需要维护列表、点位、路径、样式、事件时，必须有“摘要 + 编辑入口”。
3. 仍需要保留的 JSON/脚本能力统一命名为“高级模式”，默认折叠。
4. 导入/导出 JSON 可以保留，但不能成为默认配置方式。
5. 旧项目配置正常加载，保存后不丢失原字段。
