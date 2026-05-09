# W3D Studio

English | [简体中文](./README.zh-CN.md)

W3D Studio is an open-source WebGL 3D editor and SDK for building interactive scenes, digital twins, and data-driven 3D applications. The project includes a visual 3D editor for scene creation and a reusable W3D SDK for integrating rendering, components, assets, events, and animations into business systems.

The project is built with Vue 3, Three.js, Vite, and pnpm workspace. It can be used as a complete 3D editing platform or as a set of SDK packages for custom 3D application development.

## License Notice

W3D Studio is free and source-available for learning, research, personal projects, evaluation, and other non-commercial use.

Commercial use requires prior written authorization from the project owner. Commercial use includes, but is not limited to, commercial project delivery, internal production deployment for companies or organizations, SaaS services, paid products, secondary development for sale, or integration into commercial systems.

See the root `LICENSE` file for full terms.

## Core Features

### 3D Editor

`packages/editor-w3d` provides a visual 3D workspace for quickly building scenes for industrial parks, factories, transportation, device monitoring, BIM, data cities, and other digital twin scenarios.

Key editor capabilities:

- Component library: add models, data cities, markers, animations, effects, camera controls, and traffic components.
- Scene tree: manage component hierarchy, selection, visibility, locking, and deletion.
- Property inspector: configure transform, resource URLs, style, performance options, and business parameters.
- Scene settings: configure camera, controls, lighting, background, HDR environment maps, grid, and renderer options.
- Asset picker: select and apply model, texture, HDR, image, and other resource assets.
- Data binding: connect component data to APIs, field mappings, data transforms, and runtime updates.
- Variable system: manage reusable variables and bind them to component properties.
- Event system: support click, hover, component events, method calls, and event blueprint workflows.
- Point and camera view management: maintain business points, camera points, saved views, view jumps, and tours.
- Preview mode: switch from editing state to runtime preview for interaction, data, and animation validation.
- 3D AI assistant: use current scene context to suggest component operations, configuration changes, and low-risk executable actions.

### W3D SDK

W3D SDK is the 3D capability layer behind the editor. It wraps common Three.js engineering patterns so business applications can integrate 3D rendering more efficiently.

Core packages:

| Package | Description |
| --- | --- |
| `@w3d/core` | Core 3D engine with `Scene`, `Renderer`, `Camera`, `Controls`, `Light`, `Component`, `EventSystem`, `ResourceManager`, and `AnimationManager`. |
| `@w3d/components` | Built-in component library for model loading, GeoJSON data cities, HDR, path animation, markers, particles, heatmaps, post-processing, weather lighting, and traffic scenes. |
| `@w3d/utils` | Utility library for math, geometry, color, cache, events, and helper functions. |
| `@w3d/editor-w3d` | W3D Studio 3D low-code editor, usable as a standalone app or embeddable editor component. |
| `@w3d/editor-ai-gateway` | AI gateway for connecting the editor to external LLM services. |
| `@w3d/site` | Project website and documentation entry. |

The SDK can be used to:

- Create 3D scenes directly in business applications.
- Register custom 3D components with a unified lifecycle.
- Reuse built-in components for models, markers, animations, weather, lighting, and data visualization.
- Handle click, hover, raycasting, and component events through a unified event system.
- Optimize model, texture, and HDR loading with resource management and caching.

## Built-in Components

Current component categories include:

- Loaders: `ModelLoader`, `GeoJSONLoader`, `GaussianSplatLoader`, `TextureLoader`, `HDRLoader`, `DXFLoader`
- Animations: `PathAnimation`, `MultiPathAnimation`, `TrajectoryMove`, `CameraTour`, `CameraJump`, `ModelAnimation`, `MigrationLine`
- Markers: `MarkPoint`, `MarkLine`, `MarkArea`, `Label3D`, `PointTypeMarkerManager`, `CameraPointManager`
- Effects: `ParticleSystem`, `Heatmap`, `WaterEffect`, `Ocean`, `FireEffect`, `PostProcessing`, `WeatherClouds`, `WeatherLighting`, `ExplodedView`
- Controls: `FirstPersonControls`, `FlyControls`, `TransformControls`, `DeviceFocusController`
- Helpers: `GridHelper`, `AxesHelper`, `BoundingBoxHelper`
- Spatial and geometry: `BVHQuery`, `ExtrudedPolygon`, `InstancedModel`, `Mesh`
- Traffic: `TrafficRoadsideDeviceManager`

## Quick Start

### Requirements

- Node.js >= 16
- pnpm >= 8

### Install Dependencies

```bash
pnpm install
```

### Start The 3D Editor

```bash
pnpm dev
```

Or start the editor package explicitly:

```bash
pnpm dev:editor
```

### Build The Editor

```bash
pnpm build
```

### Start The AI Gateway

```bash
pnpm dev:ai
```

## SDK Example

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
    console.log('model clicked', event.object);
});
```

## Custom Components

All 3D components are built around the `Component` lifecycle. You can extend `Component` to create business-specific components and register them with `Scene` or the editor component registry.

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

## Project Structure

```text
packages/
  core/               W3D rendering engine core package
  components/         Built-in W3D 3D component library
  utils/              Shared utility package
  editor-w3d/         W3D Studio 3D editor
  editor-ai-gateway/  Editor AI gateway
  site/               Project website and documentation pages
document/
  zh/                 Chinese documentation, guides, and implementation notes
```

## Common Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the 3D editor development server |
| `pnpm dev:editor` | Start `@w3d/editor-w3d` |
| `pnpm dev:ai` | Start `@w3d/editor-ai-gateway` |
| `pnpm dev:site` | Start the project website |
| `pnpm build` | Build the 3D editor |
| `pnpm build:core` | Build the core SDK |
| `pnpm build:components` | Build the component library |
| `pnpm build:utils` | Build the utility package |
| `pnpm test` | Run tests |
| `pnpm lint` | Run ESLint |

## Documentation

- SDK guide: `document/zh/sdk-guide.md`
- Component guide: `document/zh/component-guide.md`
- API reference: `document/zh/api-reference.md`
- Model loading guide: `document/zh/model-loading-guide.md`
- FAQ: `document/zh/faq.md`
- JSON form configuration notes: `document/zh/lowcode-json-reduction/README.md`

## Open Source Positioning

W3D Studio is not just a 3D presentation page. It is designed as an extensible 3D engineering system:

- For editors: visual scene creation, configuration, preview, and delivery.
- For developers: reusable SDK packages, component protocols, event systems, and extension mechanisms.
- For business systems: embeddable, data-driven, and extensible 3D scene capabilities.

## License

W3D Studio uses a custom source-available license: free for non-commercial use, commercial use requires authorization. See `LICENSE` for details.
