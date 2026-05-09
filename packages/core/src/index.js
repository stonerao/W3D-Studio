/*
 * @Date: 2026-01-26 19:45:04
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2026-01-26 20:53:25
 * @FilePath: \vfd-viewer\packages\core\src\index.js
 */
/**
 * English comment.
 */
import * as THREE from 'three';

// English comment.
export { Scene } from './core/Scene.js';
export { Renderer } from './core/Renderer.js';
export { Camera } from './core/Camera.js';
export { Controls } from './core/Controls.js';
export { Light } from './core/Light.js';

// English comment.
export { Component } from './component/Component.js';
export { ComponentManager } from './component/ComponentManager.js';
export { LifecycleManager } from './component/LifecycleManager.js';

// English comment.
export { EventSystem } from './event/EventSystem.js';
export { Raycaster } from './event/Raycaster.js';
export { EventTypes } from './event/EventTypes.js';

// English comment.
export { ResourceManager } from './resource/ResourceManager.js';
export { TextureLoader } from './resource/TextureLoader.js';
export { ModelLoader } from './resource/ModelLoader.js';
export { CacheManager } from './resource/CacheManager.js';
export { IndexedDBCache } from './resource/IndexedDBCache.js';
export { LoaderManager } from './resource/LoaderManager.js';

// English comment.
export { AnimationManager } from './animation/AnimationManager.js';
export { Tween } from './animation/Tween.js';

// English comment.
export { defaultConfig } from './config/defaultConfig.js';
export * from './config/constants.js';

// English comment.
export { Scene as default } from './core/Scene.js';
export { THREE };
