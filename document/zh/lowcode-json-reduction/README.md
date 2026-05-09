# 低码属性配置改造文档

## 背景

当前三维编辑器的通用属性面板会把 `type: 'json'` 的字段渲染为 JSON 文本输入框。对于低码平台，这会让配置人员需要理解数组、对象、字段路径和脚本语法，容易造成配置门槛高、输入错误和维护困难。

本专题用于跟踪“减少 JSON 和代码编写”的改造工作。

## 排查范围

- 组件注册表：`packages/editor-w3d/src/utils/componentRegistry.js`
- 属性渲染器：`packages/editor-w3d/src/components/panels/PropertyEditorFields.vue`
- 专用属性面板：`packages/editor-w3d/src/components/panels/PropertyEditor.vue`
- 可绑定属性：`packages/editor-w3d/src/utils/bindableProperties.js`
- 平台级输入：数据绑定、公共接口、连接管理、变量管理、GeoJSON、大场景清单、蓝图事件编辑器

当前注册表中共 31 个唯一组件，发现 11 类组件存在 JSON 配置字段；其余 20 类组件已排查，未发现 `type: 'json'` 属性字段。

## 文档清单

| 文档 | 内容 |
| --- | --- |
| [01-json-field-inventory.md](./01-json-field-inventory.md) | 当前组件 JSON 字段排查清单 |
| [02-component-modification-plan.md](./02-component-modification-plan.md) | 各组件低码化改造方案 |
| [03-platform-input-modification-plan.md](./03-platform-input-modification-plan.md) | 平台级 JSON / 脚本输入改造方案 |
| [04-implementation-checklist.md](./04-implementation-checklist.md) | 分阶段实施清单和验收项 |

## 改造原则

1. 属性配置优先通过表单、选择器、列表编辑器、点位拾取、资源选择器完成。
2. JSON 输入只保留在“高级/开发者模式”中，不作为默认配置入口。
3. 代码输入只保留在明确的高级能力中，例如蓝图脚本节点、数据转换高级模式。
4. 组件属性面板不应同时展示“低码编辑器”和“原始 JSON 文本框”。
5. 数据导入/导出可以继续支持 JSON 文件，但应与手写 JSON 文本框区分。

## 验收标准

1. 普通组件属性区不再直接出现大段 JSON textarea。
2. 点位、路径、标签、样式、事件等复杂结构均有专用编辑界面。
3. 数据绑定、公共接口、连接管理等平台能力提供模板化配置和预览选择。
4. 保留导入/导出 JSON 能力，便于批量迁移和高级维护。
5. 旧项目数据结构保持兼容，不要求用户手动迁移 JSON。

## 优先级

| 优先级 | 范围 | 原因 |
| --- | --- | --- |
| P0 | CameraPointManager、PointTypeMarkerManager、TrajectoryMove | 当前最容易在右侧属性区暴露大段 JSON，且属于点位、事件、轨迹等高频配置 |
| P1 | Heatmap、AreaBlock、MigrationLine、MultiPathAnimation、CameraTour、Label3D | 已有弹窗或摘要编辑能力，主要问题是通用 JSON 兜底仍需收口 |
| P2 | GeoJSONLoader、BuildingEditor、平台级数据/脚本输入 | 需要新增结构化控件或迁移到高级模式 |

## 当前开发状态

- 已完成通用属性面板 JSON 兜底收口：默认不再直接展示原始 JSON textarea。
- 已完成 P0/P1 组件普通属性区收口：复杂字段显示摘要、跳转专用编辑器或进入高级配置。
- 已完成 GeoJSON 数组字段表单化、交通坐标控制点表格化、变量对象/数组结构化编辑。
- 已将数据绑定、公共接口、连接管理、大场景清单、蓝图脚本等原始 JSON/脚本输入默认折叠到高级配置。
- 已通过 `pnpm --filter @w3d/editor-w3d build` 构建检查。
