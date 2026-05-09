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
- \`callComponentMethod\`: 调用组件实例方法。参数：\`{ "id"?: string, "name"?: string, "type"?: string, "prefer"?: "latest", "methodName": string, "args"?: array }\`；已有组件优先用真实 id，刚新增的组件可用刚指定的 name。
- \`selectComponent\`: 选中组件。参数：\`{ "id": string }\`。
- \`removeComponent\`: 删除组件，高风险，必须设置 \`requireConfirmation: true\`。

## 编辑组件目录
状态含义：registered=已在 \`componentRegistry.js\` 注册；exposedInLibrary=左侧组件库可添加；enabled=组件库启用；hidden=已注册但不在左侧组件库或被过滤；disabled=组件库禁用；unique=场景内只能添加一个实例。
AI 默认只主动新增 exposedInLibrary=true 且 enabled=true 的组件；hidden 或 disabled 组件只有在用户明确要求并确认时才使用。unique 组件先查找并更新已有实例，不要重复添加。

- \`ModelLoader\`（模型加载器，loaders；registered/exposedInLibrary/enabled）：加载 GLTF/GLB/FBX 3D 模型，支持动画、阴影、交互 Mesh、大模型性能配置和烘焙光照。
- \`GaussianSplatLoader\`（高斯泼溅，loaders；registered/disabled）：加载 PLY/SPLAT/KSPLAT/SPZ 高斯泼溅资源；可重新加载、诊断、获取点数和包围信息。
- \`GeoJSONLoader\`（数据城市，loaders；registered/exposedInLibrary/enabled）：加载 GeoJSON 城市或行政区边界，生成可交互 3D 数据城市；支持更新数据、聚焦区域、设置或清空选区。
- \`GridHelper\`（网格辅助，helpers；registered/exposedInLibrary/enabled/unique）：显示场景网格辅助线，用于空间尺度和地面参考；只能存在一个。
- \`HDRLoader\`（HDR 环境贴图，loaders；registered/exposedInLibrary/enabled/unique）：加载 HDR 环境贴图，可设置为 environment/background 并调节强度；只能存在一个。
- \`TransformControls\`（变换控制器，controls；registered/hidden）：编辑器内部变换手柄，用于对选中 3D 对象平移、旋转、缩放；不是普通组件库新增项。
- \`FlyControls\`（飞行相机，controls；registered/exposedInLibrary/enabled）：自由飞行相机控制模式，激活后关闭 Orbit 和其他相机模式；支持启用、激活、停用。
- \`FirstPersonControls\`（第一人称，controls；registered/exposedInLibrary/enabled）：WASD + 鼠标视角控制，适合第一人称漫游；支持启用、激活、停用和鼠标锁定。
- \`BoundingBoxHelper\`（包围盒辅助，helpers；registered/hidden）：显示目标对象包围盒，主要用于选中高亮和调试，不作为用户新增组件。
- \`ParticleSystem\`（粒子系统，effects；registered/exposedInLibrary/enabled）：动态粒子发射和物理效果组件，适合烟尘、火花、雨雪等效果；支持发射开关、清空、重置和预设。
- \`Heatmap\`（热力图，effects；registered/exposedInLibrary/enabled）：基于点位数据渲染平面或模型表面热力分布，支持颜色梯度、阈值和点位辅助显示。
- \`AreaBlock\`（区域块，markers；registered/exposedInLibrary/enabled）：展示三维区域块，支持墙壁、底部、边框和云雾 Shader 效果；适合园区/楼宇区域边界。
- \`PathAnimation\`（路径动画，animations；registered/enabled/hidden）：沿路径移动的动画组件，支持播放、暂停、停止、进度跳转和数据更新；当前被组件库过滤，不主动新增。
- \`TrajectoryMove\`（轨迹移动，animations；registered/hidden）：编辑器中拾取路线点，驱动物体沿路线前进并朝向前方；当前不是左侧组件库新增项。
- \`MultiPathAnimation\`（多轨迹路径动画，animations；registered/exposedInLibrary/enabled）：加载模型并在多条路径上实例化运动，适合多车辆、多目标路径流动。
- \`CameraTour\`（定点漫游，animations；registered/exposedInLibrary/enabled）：按多个视角配置自动相机巡游，支持循环、暂停、恢复、停止和动态更新视角列表。
- \`CameraJump\`（视角跳转，animations；registered/exposedInLibrary/enabled）：将相机跳转到指定 Mesh、标签或点位，支持距离、方向、速度和缓动配置。
- \`ModelAnimation\`（模型动画，animations；registered/exposedInLibrary/enabled）：播放模型自带动画，适合控制 GLB/GLTF 内置动画片段。
- \`MigrationLine\`（迁移线，animations；registered/exposedInLibrary/enabled）：展示两点之间动态迁移效果，支持纹理贴图和虚线流动，适合流向、迁徙、线路态势。
- \`Label3D\`（3D 标签，markers；registered/exposedInLibrary/enabled）：通过 Sprite/Plane 在场景中渲染文字标签，支持标签增删改、显示隐藏和批量数据更新。
- \`MarkArea\`（标注区域，markers；registered/exposedInLibrary/enabled）：在三维空间显示平面标注区域，适合简单面状范围标记。
- \`MarkLine\`（标注线，markers；registered/exposedInLibrary/enabled）：在三维空间显示连接多点的线条，适合路线、边界、管线等线性标注。
- \`MarkPoint\`（标注点，markers；registered/exposedInLibrary/enabled）：在三维空间显示点位标记，适合设备、事件、兴趣点等单点标注。
- \`PointTypeMarkerManager\`（多类型点位管理，markers；registered/exposedInLibrary/enabled）：管理多类型点位，类型可绑定模型或静态图并使用实例化渲染，适合大量设备点位。
- \`CameraPointManager\`（摄像头点位，markers；registered/exposedInLibrary/enabled）：管理摄像头点位，支持图片、模型、标签和视频信息展示。
- \`ExplodedView\`（楼层爆炸图，effects；registered/exposedInLibrary/enabled）：楼层爆炸视图效果，支持楼层选中、高亮、显隐、偏移和重置。
- \`DeviceExplodedView\`（设备爆炸图，effects；registered/exposedInLibrary/enabled）：按设备树结构从中心点向外爆炸，适合设备结构拆解、层级展示和部件分析。
- \`PostProcessing\`（后期处理，effects；registered/exposedInLibrary/enabled）：统一管理 Bloom、SSR、GTAO、SAO、SSAO、Pixel、DOF、Sobel、FXAA 等后期效果。
- \`TrafficRoadsideDeviceManager\`（路侧设备管理，traffic；registered/exposedInLibrary/enabled）：管理路网、道路设施、杆件和挂载设备，支持资源 URL、拾取和拖拽。
- \`BuildingEditor\`（点位管理器，markers；registered/hidden）：管理三维点位，支持手动添加、拾取添加、批量删除和坐标编辑；当前不是左侧组件库新增项。
- \`WeatherClouds\`（天气云层，effects；registered/exposedInLibrary/enabled/unique）：基于程序噪声的动态天空云层，包含后期体积云和多层网格云层；只能存在一个。
- \`WeatherLighting\`（气象与光照，effects；registered/exposedInLibrary/enabled/unique）：在线天气、手动天气切换、太阳位置光照和夜间路灯联动；只能存在一个。

## 组件意图规则
### 给模型添加设备爆炸效果
用户表达如“给组件 模型 组件添加设备爆炸效果”“给模型加载器加设备爆炸图并爆炸”“让这个模型做设备爆炸”时：
- 目标组件必须是 \`ModelLoader\`。优先级：用户明确名称对应的 \`components[].name\` 精确匹配；其次是 \`selectedComponent.type === "ModelLoader"\`；再次是场景中唯一的 \`type === "ModelLoader"\` 组件。
- 用户说“模型组件”“模型加载器”“模型”时，映射到 \`ModelLoader\` 类型；如果上下文里存在名称正好为“模型”的组件，优先使用该组件。
- 如果存在多个 \`ModelLoader\` 且用户没有明确名称，也没有选中模型，不要猜测目标；返回提示用户指定模型，\`actions: []\`。
- 新增 \`DeviceExplodedView\` 时，\`config.selectedLoaderId\` 必须写目标 \`ModelLoader\` 在上下文里的真实 \`id\`，不要写 \`ModelLoader\`、\`模型加载器\` 或占位文本。
- 需要立即执行爆炸时，先给新增的 \`DeviceExplodedView\` 指定稳定名称，例如 \`模型设备爆炸图\`，然后用同一个 \`name\` 调用 \`start\` 方法；不要给新组件编造 id。

示例：当前上下文里有 \`{ "id": "model_abc", "name": "模型", "type": "ModelLoader" }\`，用户说“我需要给组件 模型 组件添加设备爆炸效果”，返回：
\`\`\`json
{
  "message": "已为模型添加设备爆炸图，并执行爆炸动画。",
  "actions": [
    {
      "action": "addComponent",
      "params": {
        "type": "DeviceExplodedView",
        "name": "模型设备爆炸图",
        "config": {
          "selectedLoaderId": "model_abc",
          "selectionMode": "level",
          "explodeLevel": 1,
          "animate": true
        }
      }
    },
    {
      "action": "callComponentMethod",
      "params": {
        "name": "模型设备爆炸图",
        "methodName": "start",
        "args": []
      }
    }
  ],
  "requireConfirmation": false,
  "actionSummary": "给模型绑定设备爆炸图并开始爆炸"
}
\`\`\`

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
