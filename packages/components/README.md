# @w3d/components

> W3D 内置组件库

## 📦 安装

```bash
npm install @w3d/components @w3d/core three
```

## 🚀 使用

```javascript
import { Scene } from '@w3d/core';
import { ModelLoader, PathAnimation } from '@w3d/components';

const scene = new Scene('#app').init();

// 注册组件
scene.registerComponent('ModelLoader', ModelLoader);
scene.registerComponent('PathAnimation', PathAnimation);

// 使用组件
const model = await scene.add('ModelLoader', {
    name: 'robot',
    url: '/models/robot.glb'
});
```

## 📚 组件分类

### 加载器组件（Loaders）

- **ModelLoader** - GLTF/GLB 模型加载器
- **TextureLoader** - 纹理加载器
- **HDRLoader** - HDR 环境贴图加载器

### 动画组件（Animation）

- **PathAnimation** - 路径动画
- **CameraAnimation** - 相机动画
- **ModelAnimation** - 模型动画
- **MigrationLine** - 迁移线动画（支持 Shader/Particle/Line2 三种渲染方式）

### 标注组件（Markers）

- **MarkPoint** - 标注点
- **MarkLine** - 标注线
- **MarkArea** - 标注区域
- **Label3D** - 三维标签（Canvas 文字纹理）

### 特效组件（Effects）

- **ParticleSystem** - 粒子系统
- **WaterEffect** - 水面效果
- **FireEffect** - 火焰效果

### 控制组件（Controls）

- **FirstPersonControls** - 第一人称控制
- **FlyControls** - 飞行控制
- **TransformControls** - 变换控制

### 辅助组件（Helpers）

- **GridHelper** - 网格辅助
- **AxesHelper** - 坐标轴辅助
- **BoundingBoxHelper** - 包围盒辅助

## 📖 文档

详细文档请查看 [组件系统文档](../../docs/component-system.md)

## 📄 许可证

免费开放源码，商用需取得授权。详见仓库根目录 `LICENSE`。
