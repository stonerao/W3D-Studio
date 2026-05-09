# W3D Studio

[English](./README.md) | 简体中文

W3D Studio 是一个面向 WebGL 三维场景搭建、业务可视化和低代码交付的开源项目。项目由三维编辑器和 W3D SDK 两部分组成：编辑器用于可视化搭建、配置和预览三维场景，SDK 用于在业务系统中集成三维渲染、组件、资源、事件和动画能力。

项目基于 Vue 3、Three.js、Vite 和 pnpm workspace 构建，采用 monorepo 组织方式，既可以作为完整的三维编辑器使用，也可以只引用 SDK 包开发自定义三维应用。

## 授权说明

W3D Studio 当前免费开放源码，允许用于学习、研究、个人项目和非商业用途。

如需将本项目或其衍生版本用于商业场景，包括但不限于商业项目交付、企业内部生产系统、SaaS 服务、收费产品、二次开发后销售、作为商业系统的一部分集成或部署，需要提前取得项目作者的商业授权。

详细条款请查看根目录 `LICENSE` 文件。

## 核心能力

### 三维编辑器

`packages/editor-w3d` 提供可视化三维编辑工作台，适合园区、工厂、交通、设备监控、BIM、数据城市等场景的快速搭建。

主要能力包括：

- 组件库：通过左侧组件库添加模型、数据城市、标注、动画、特效、相机控制和交通组件。
- 场景树：管理场景组件层级、选中状态、显示隐藏和删除操作。
- 属性面板：配置组件位置、旋转、缩放、资源地址、样式、性能参数和业务参数。
- 场景设置：配置相机、控制器、灯光、背景、HDR 环境贴图、网格和渲染选项。
- 资源选择：支持模型、贴图、HDR、图片等资源选择和字段回填。
- 数据接入：支持组件级数据绑定、字段映射、数据转换和接口数据驱动。
- 变量系统：管理可复用变量，并将变量绑定到组件属性。
- 事件系统：支持点击、悬停、组件事件、方法调用和事件蓝图联动。
- 点位与视角管理：维护业务点位、摄像头点位、视角保存、视角跳转和巡游配置。
- 预览模式：将编辑态配置切换到运行态预览，验证交互、数据和动画效果。
- 三维 AI：结合当前场景上下文，辅助生成组件操作、配置建议和低风险自动执行动作。

### W3D SDK

W3D SDK 是编辑器底层的三维能力层，封装 Three.js 的常用工程能力，降低业务系统接入三维场景的成本。

核心包包括：

| 包 | 说明 |
| --- | --- |
| `@w3d/core` | 三维引擎核心，提供 `Scene`、`Renderer`、`Camera`、`Controls`、`Light`、`Component`、`EventSystem`、`ResourceManager`、`AnimationManager` 等能力。 |
| `@w3d/components` | 内置组件库，提供模型加载、GeoJSON 数据城市、HDR、路径动画、标注、粒子、热力图、后期处理、天气光照、路侧设备等组件。 |
| `@w3d/utils` | 工具函数库，提供数学、几何、颜色、缓存、事件和通用辅助能力。 |
| `@w3d/editor-w3d` | 三维低代码编辑器，可作为独立应用运行，也可作为编辑器组件集成。 |
| `@w3d/editor-ai-gateway` | 编辑器 AI 网关，用于连接外部大模型服务。 |
| `@w3d/site` | 项目站点与文档页面。 |

SDK 适合以下使用方式：

- 在业务项目中直接创建三维场景。
- 注册自定义三维组件并接入统一生命周期。
- 复用内置组件构建模型展示、点位标注、路径动画、天气光照和数据可视化。
- 使用统一事件系统处理点击、悬停、射线拾取和组件事件。
- 通过资源管理和缓存能力优化模型、贴图和 HDR 加载。

## 内置组件

当前组件库覆盖以下分类：

- 加载器：`ModelLoader`、`GeoJSONLoader`、`GaussianSplatLoader`、`TextureLoader`、`HDRLoader`、`DXFLoader`
- 动画：`PathAnimation`、`MultiPathAnimation`、`TrajectoryMove`、`CameraTour`、`CameraJump`、`ModelAnimation`、`MigrationLine`
- 标注：`MarkPoint`、`MarkLine`、`MarkArea`、`Label3D`、`PointTypeMarkerManager`、`CameraPointManager`
- 特效：`ParticleSystem`、`Heatmap`、`WaterEffect`、`Ocean`、`FireEffect`、`PostProcessing`、`WeatherClouds`、`WeatherLighting`、`ExplodedView`
- 控制：`FirstPersonControls`、`FlyControls`、`TransformControls`、`DeviceFocusController`
- 辅助：`GridHelper`、`AxesHelper`、`BoundingBoxHelper`
- 空间与几何：`BVHQuery`、`ExtrudedPolygon`、`InstancedModel`、`Mesh`
- 交通：`TrafficRoadsideDeviceManager`

## 快速开始

### 环境要求

- Node.js >= 16
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 启动三维编辑器

```bash
pnpm dev
```

或显式启动编辑器包：

```bash
pnpm dev:editor
```

### 构建编辑器

```bash
pnpm build
```

### 启动 AI 网关

```bash
pnpm dev:ai
```

## SDK 使用示例

```javascript
import { Scene } from '@w3d/core';
import { ModelLoader, PathAnimation } from '@w3d/components';

const scene = new Scene('#app', {
    renderer: {
        antialias: true,
        shadowEnabled: true
    },
    camera: {
        fov: 45,
        position: [0, 100, 200],
        lookAt: [0, 0, 0]
    },
    controls: {
        enableDamping: true
    }
});

scene.registerComponent('ModelLoader', ModelLoader);
scene.registerComponent('PathAnimation', PathAnimation);

await scene.init();

const model = await scene.add('ModelLoader', {
    name: 'robot',
    url: '/models/robot.glb',
    scale: 2
});

model.on('click', (event) => {
    console.log('点击模型', event.object);
});
```

## 自定义组件

所有三维组件都基于 `Component` 生命周期开发。你可以继承 `Component` 创建业务组件，然后注册到 `Scene` 或编辑器组件库中。

```javascript
import { Component } from '@w3d/core';
import * as THREE from 'three';

class RotatingBox extends Component {
    static defaultConfig = {
        color: '#00ff00',
        size: 1
    };

    onCreate() {
        const geometry = new THREE.BoxGeometry(this.config.size, this.config.size, this.config.size);
        const material = new THREE.MeshStandardMaterial({ color: this.config.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.add(this.mesh);
    }

    onUpdate(delta) {
        this.mesh.rotation.y += delta;
    }

    getInteractiveObjects() {
        return [this.mesh];
    }

    onDispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

scene.registerComponent('RotatingBox', RotatingBox);
await scene.add('RotatingBox', { color: '#ff0000', size: 2 });
```

## 项目结构

```text
packages/
  core/               W3D 渲染引擎核心包
  components/         W3D 内置三维组件库
  utils/              通用工具函数库
  editor-w3d/         W3D Studio 三维编辑器
  editor-ai-gateway/  编辑器 AI 网关
  site/               项目站点与文档页面
document/
  zh/                 中文设计文档、使用说明和实现记录
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动三维编辑器开发服务 |
| `pnpm dev:editor` | 启动 `@w3d/editor-w3d` |
| `pnpm dev:ai` | 启动 `@w3d/editor-ai-gateway` |
| `pnpm dev:site` | 启动项目站点 |
| `pnpm build` | 构建三维编辑器 |
| `pnpm build:core` | 构建核心 SDK |
| `pnpm build:components` | 构建组件库 |
| `pnpm build:utils` | 构建工具库 |
| `pnpm test` | 执行测试 |
| `pnpm lint` | 执行 ESLint 检查 |

## 文档入口

- SDK 指南：`document/zh/sdk-guide.md`
- 组件指南：`document/zh/component-guide.md`
- API 参考：`document/zh/api-reference.md`
- 模型加载指南：`document/zh/model-loading-guide.md`
- 常见问题：`document/zh/faq.md`
- JSON 配置表单化改造记录：`document/zh/lowcode-json-reduction/README.md`

## 开源定位

W3D Studio 的目标不是只做一个三维展示页面，而是沉淀一套可扩展的三维工程体系：

- 对编辑人员，提供可视化搭建、配置、预览和交付能力。
- 对开发人员，提供可复用的 SDK、组件协议、事件系统和扩展机制。
- 对业务系统，提供可嵌入、可接入数据、可持续扩展的三维场景能力。

## License

W3D Studio 使用自定义授权协议：免费开放源码，商用需取得授权。详见 `LICENSE`。
