# 平台级 JSON / 脚本输入改造方案

除组件属性面板外，平台级能力中也存在 JSON 或代码输入。这些能力不一定全部要移除，但默认入口应低码化，高级输入应收敛到“高级模式”。

## 数据绑定

相关文件：

- `packages/editor-w3d/src/components/panels/DataBindingEditor.vue`

当前问题：

- 请求体支持直接输入 JSON / XML。
- `transformFn` 需要用户编写转换函数。
- 数据结构预览以只读 JSON 展示为主。

改造方案：

1. 请求参数、请求头、请求体优先使用键值表格。
2. JSON 请求体提供“对象构建器”：
   - 字段名
   - 值来源：固定值、变量、本地存储、接口返回、组件属性
   - 值类型：字符串、数字、布尔、对象、数组
3. 数据转换提供模板化操作：
   - 取路径
   - 重命名字段
   - 过滤列表
   - 排序列表
   - 数值换算
   - 合并字段
4. `transformFn` 保留为“高级脚本转换”，默认折叠。

## 公共接口

相关文件：

- `packages/editor-w3d/src/components/panels/PublicInterfacePanel.vue`
- `packages/editor-w3d/src/components/panels/ConnectionManager.vue`

当前问题：

- 请求体、WebSocket 订阅消息、心跳消息通常直接写 JSON。

改造方案：

1. HTTP 请求体提供表单构建器。
2. WebSocket / MQTT 消息提供消息模板：
   - 订阅主题
   - 消息类型
   - 参数键值表
3. 支持从历史请求或示例生成模板。
4. 原始 JSON 消息保留在高级模式。

## 数据源配置回调

相关文件：

- `packages/editor-w3d/src/components/panels/DataSourceConfigModal.vue`

当前问题：

- `callback` 直接暴露为代码文本。

改造方案：

1. 使用“数据处理步骤”替代默认代码：
   - 选择数据路径
   - 设置默认值
   - 转换字段类型
   - 过滤无效记录
2. 需要复杂逻辑时启用高级回调脚本。

## 连接管理和协议采集

相关文件：

- `packages/editor-w3d/src/components/panels/ConnectionManager.vue`

当前问题：

- 标签 `transform` 需要写 `return value;` 形式脚本。

改造方案：

1. 标签转换改为规则表：
   - 无转换
   - 数值倍率
   - 数值偏移
   - 字符串映射
   - 布尔映射
   - 枚举映射
2. 自定义脚本作为高级转换。

## GeoJSON、大场景清单和坐标拟合

相关文件：

- `packages/editor-w3d/src/components/panels/GeoJSONLoaderEditor.vue`
- `packages/editor-w3d/src/components/panels/LargeSceneGovernancePanel.vue`
- `packages/editor-w3d/src/components/panels/TrafficCoordinateFittingEditor.vue`

当前问题：

- GeoJSON 内联数据、大场景 manifest 允许直接粘贴 JSON。
- 交通设备坐标拟合的控制点通过“控制点 JSON”textarea 导入。

改造方案：

1. 默认提供文件导入、URL、示例数据、数据预览。
2. JSON 粘贴仅放入高级入口。
3. 对常用字段提供结构化表单，例如数据源地址、坐标字段、LOD 配置、缓存开关。
4. 坐标拟合控制点使用表格维护：
   - 源坐标 X/Y/Z
   - 目标经度/纬度/高度
   - 误差预览
   - 添加、删除、导入、导出
5. 控制点 JSON 仅作为高级批量导入方式。

## 变量管理

相关文件：

- `packages/editor-w3d/src/components/panels/VariablesEditor.vue`
- `packages/editor-w3d/src/components/panels/VariableValueEditor.vue`

当前问题：

- 对象、数组变量需要编辑 JSON。

改造方案：

1. 数组变量提供列表编辑器。
2. 对象变量提供键值编辑器。
3. JSON 编辑作为高级模式，用于批量粘贴。

## 蓝图事件编辑器

相关文件：

- `packages/editor-w3d/src/components/panels/EventBlueprintEditor.vue`

当前状态：

- 事件已进入蓝图配置。
- 条件支持结构化数据来源和字段比较。
- 仍保留自定义脚本节点、脚本判断和参数表达式。

后续改造：

1. 动作参数改为参数表单和值来源选择，减少 `JS 表达式`。
2. 条件表达式提供字段比较模式作为默认选项。
3. 自定义脚本放入高级节点分类，避免普通用户优先使用。
4. 为常见动作提供专用节点，例如打开视频、设置显示、切换样式、跳转视角。
