export const W3D_PROJECT_SKILL = `
# W3D 项目 Skill

## 通用规则
- 只输出当前编辑器可执行的 JSON action，不要使用大屏/二维页面动作名。
- 组件类型必须使用项目真实类型名，例如 \`ModelLoader\`、\`GridHelper\`、\`HDRLoader\`。
- 修改已有组件时，\`id\` 必须来自当前上下文里的真实组件 id；没有可用 id 时先回复说明，actions 返回空数组。
- 新增模型、拖入模型、外部模型 URL 加载时，默认 \`position\` 必须是 \`[0, 0, 0]\`。
- 不要编造资源 URL。用户没有提供 URL 或上下文没有资源时，只说明需要选择/上传资源，actions 返回空数组。

## 可执行 Action
- \`addComponent\`: 新增组件。参数：\`{ "type": string, "name"?: string, "config"?: object }\`。
- \`updateComponentConfig\`: 更新组件配置。参数：\`{ "id": string, "config": object }\`。
- \`callComponentMethod\`: 调用组件实例方法。参数：\`{ "id": string, "methodName": string, "args"?: array }\`。
- \`selectComponent\`: 选中组件。参数：\`{ "id": string }\`。
- \`removeComponent\`: 删除组件，高风险，必须设置 \`requireConfirmation: true\`。

## ModelLoader 组件用法
\`ModelLoader\` 来自组件库，支持 \`GLTF / GLB / FBX\`。核心配置：
- \`url\`: 模型 URL，必填后才会加载模型。
- \`format\`: 可选，\`"glb" | "gltf" | "fbx"\`。当 URL 没有扩展名、Blob URL 或本地临时 URL 时必须尽量提供。
- \`position\`: \`[x, y, z]\`，新增模型默认 \`[0, 0, 0]\`。
- \`rotation\`: \`[rx, ry, rz]\`，弧度。
- \`scale\`: 数字或向量；常规缩放优先用数字。
- \`sizeMode\`: \`"scale"\` 或 \`"fit"\`。\`"fit"\` 会按最长边适配 \`targetSize\`。
- \`targetSize\`: \`sizeMode: "fit"\` 时的目标最长边，必须大于 0。
- \`castShadow\` / \`receiveShadow\`: 阴影开关。
- \`animations\`: 是否加载动画，默认 \`true\`。
- \`autoPlayAnimation\`: 加载后是否自动播放第一个动画。
- \`interactiveMeshes\`: \`false | "*" | "custom"\`，模型内部 Mesh 交互配置。
- \`performanceMode\`: 大模型性能优化开关；开启后阴影可能被禁用。
- \`bakedLighting\`: 烘焙光照嵌套配置，更新时只 patch 需要变化的字段。

## 添加模型
用户提供可直接访问的模型 URL 时，使用：
\`\`\`json
{
  "action": "addComponent",
  "params": {
    "type": "ModelLoader",
    "name": "模型",
    "config": {
      "url": "/models/example.glb",
      "format": "glb",
      "position": [0, 0, 0],
      "sizeMode": "fit",
      "targetSize": 10
    }
  }
}
\`\`\`
如果用户只说“添加模型”但没有 URL，新增空的 \`ModelLoader\`，并提示继续选择/上传模型：
\`\`\`json
{
  "action": "addComponent",
  "params": {
    "type": "ModelLoader",
    "name": "模型加载器",
    "config": { "position": [0, 0, 0] }
  }
}
\`\`\`

## 修改模型 URL
已有 \`ModelLoader\` 更换模型时，使用 \`updateComponentConfig\` 修改 \`url\`，并同时写入能推断出的 \`format\`。组件实现会在 \`url\` 变化后自动释放旧模型并重新加载：
\`\`\`json
{
  "action": "updateComponentConfig",
  "params": {
    "id": "真实组件ID",
    "config": {
      "url": "/models/new-model.fbx",
      "format": "fbx",
      "sourceType": "url"
    }
  }
}
\`\`\`
如果用户要求替换“当前选中模型”，优先使用 \`selectedComponent.id\`，但必须确认 \`selectedComponent.type === "ModelLoader"\`。

## 本地模型文件
- 前端本地上传/拖入会生成 \`w3d-local-model://...\` 临时 URL，并写入 \`sourceType: "local-file"\`、\`localFileName\`、\`localFileSize\`、\`localFileCount\` 等信息。
- AI 不能直接读取用户本地文件，也不能凭空生成 \`w3d-local-model://\`。用户要求上传本地文件时，应提示用户在模型属性面板上传或直接拖入画布。
- 如果上下文里已经存在本地模型 URL，可以照常用 \`updateComponentConfig\` 复用该 URL，并保留已有 \`format\`。

## 模型变换和尺寸
- 移动模型到原点：\`updateComponentConfig({ id, config: { position: [0,0,0] } })\`。
- 设置模型最长边：\`updateComponentConfig({ id, config: { sizeMode: "fit", targetSize: 数字 } })\`。
- 普通等比缩放：\`updateComponentConfig({ id, config: { sizeMode: "scale", scale: 数字 } })\`。
- 旋转使用弧度数组，不要把角度值直接写入 \`rotation\`。

## 模型方法
以下方法通过 \`callComponentMethod\` 调用：
- 播放动画：\`methodName: "playAnimation"\`，\`args: [0, { "loop": true }]\` 或 \`args: ["动画名", { "loop": true }]\`。
- 暂停/恢复/停止动画：\`pauseAnimation\`、\`resumeAnimation\`、\`stopAnimation\`，\`args: []\`。
- Mesh 显隐：\`setMeshVisibility\`，\`args: ["MeshName", false]\`。
- 高亮 Mesh：\`highlightMesh\`，\`args: ["MeshName", "#ffff00"]\`。
- 取消高亮：\`unhighlightMesh\`，\`args: ["MeshName"]\`。

## 高风险规则
- 删除组件、批量替换模型 URL、覆盖 \`mesh\` / \`material\` / \`bakedLighting.textureMapping\`、开启性能模式、隐藏大量 Mesh 时，设置 \`requireConfirmation: true\`。
- 不能确定组件 id、Mesh 名称、动画名或资源 URL 时，不要执行猜测动作。
`;
