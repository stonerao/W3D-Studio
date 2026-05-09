import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { Camera } from './Camera.js';
import { Controls } from './Controls.js';
import { Light } from './Light.js';
import { ComponentManager } from '../component/ComponentManager.js';
import { EventSystem } from '../event/EventSystem.js';
import { ResourceManager } from '../resource/ResourceManager.js';
import { AnimationManager } from '../animation/AnimationManager.js';
import { IndexedDBCache } from '../resource/IndexedDBCache.js';
import { LoaderManager } from '../resource/LoaderManager.js';

/**
 * Scene 场景类
 *
 * @class Scene
 * @description 场景的创建、初始化和管理，是整个 SDK 的入口类
 *
 * @example
 * const scene = new Scene('#app')
 *     .camera({ position: [0, 100, 200] })
 *     .light('ambient', { color: '#fff', intensity: 0.8 })
 *     .init();
 */
export class Scene {
    /**
     * 创建场景实例
     *
     * @param {string|HTMLElement} container - 容器选择器或 DOM 元素
     * @param {Object} options - 配置选项
     */
    constructor(container, options = {}) {
        // 容器元素
        this.container =
            typeof container === 'string' ? document.querySelector(container) : container;

        if (!this.container) {
            throw new Error('Container not found');
        }
        // 配置选项
        this.options = Object.assign(
            {
                isRendering: true,
                isResize: true
            },
            options
        );

        // Three.js 场景
        this.scene = new THREE.Scene();

        // 核心模块
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.light = null;

        // 管理器
        this.componentManager = new ComponentManager(this);
        this.eventSystem = new EventSystem(this);
        this.resourceManager = new ResourceManager(this);
        this.animationManager = new AnimationManager(this);

        // IndexedDB 缓存管理器
        this.indexedDBCache = null;
        if (this.options.indexedDB) {
            this.indexedDBCache = new IndexedDBCache(this.options.indexedDB);
        }

        // 全局加载器管理器（单例模式，所有组件共享）
        this.loaderManager = new LoaderManager(this.indexedDBCache, {
            dracoDecoderPath: this.options.dracoDecoderPath || '/draco/'
        });

        // 状态
        this.isInitialized = false;
        this.isRunning = false;

        // 动画帧 ID
        this.animationFrameId = null;
    }

    /**
     * 初始化场景
     *
     * @returns {Scene} 返回自身，支持链式调用
     */
    async init() {
        if (this.isInitialized) {
            console.warn('Scene already initialized');
            return this;
        }

        // 初始化 IndexedDB 缓存（如果启用）
        if (this.indexedDBCache) {
            await this.indexedDBCache.init();
        }

        // 初始化渲染器
        if (!this.renderer) {
            this.renderer = new Renderer(this, this.options.renderer);
        }

        // 初始化相机
        if (!this.camera) {
            this.camera = new Camera(this, this.options.camera);
        }

        // 初始化控制器
        if (!this.controls) {
            this.controls = new Controls(this, this.options.controls);
        }

        // 初始化灯光
        if (!this.light) {
            this.light = new Light(this, this.options.lights);
        }

        // 初始化事件系统（在 renderer 创建后）
        this.eventSystem.init();

        // ✅ 根据配置启用或禁用窗口大小自动调整
        if (this.options.isResize) {
            this.enableResize();
        }

        // 标记为已初始化
        this.isInitialized = true;

        // 开始渲染循环
        this.start();
        return this;
    }

    /**
     * 启用窗口大小自动调整
     */
    enableResize() {
        if (this.renderer) {
            this.renderer.enableResize();
        }
    }

    /**
     * 禁用窗口大小自动调整
     */
    disableResize() {
        if (this.renderer) {
            this.renderer.disableResize();
        }
    }

    /**
     * 开始渲染循环
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.animate();
    }

    /**
     * 渲染一帧（不改变渲染循环状态）
     * 常用于截图/缩略图等需要“立即刷新一帧”的场景
     */
    renderOnce() {
        if (!this.renderer || !this.camera) return;
        this.renderer.render(this.scene, this.camera.instance);
    }

    /**
     * 停止渲染循环（不销毁资源）
     * 与 dispose() 不同，stop() 只停止渲染循环，保留所有场景资源
     */
    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * 暂停渲染循环
     * 与 stop() 功能相同，提供语义化的别名
     * @returns {boolean} 是否成功暂停
     */
    pause() {
        if (!this.isRunning) {
            return false;
        }
        this.stop();
        return true;
    }

    /**
     * 恢复渲染循环
     * 与 start() 功能相同，提供语义化的别名
     * @returns {boolean} 是否成功恢复
     */
    resume() {
        if (this.isRunning) {
            return false;
        }
        if (!this.isInitialized) {
            console.warn('[Scene] Cannot resume: scene not initialized');
            return false;
        }
        this.start();
        return true;
    }

    /**
     * 更新场景配置（增量更新）
     *
     * @param {Object} config - 项目配置对象
     * @param {Object} config.scene - 场景配置（包含 renderer, camera, controls, lighting, background 等）
     * @param {Array} config.components - 组件列表
     * @param {boolean} forceUpdate - 是否强制更新所有配置（默认 false，只更新变化的部分）
     * @returns {Object} 更新结果，包含更新了哪些配置项
     * @memberof Scene
     */
    update(config, forceUpdate = false) {
        if (!this.isInitialized) {
            console.warn('[Scene] Scene not initialized, cannot update');
            return { success: false, reason: 'not_initialized' };
        }

        const { scene: sceneConfig = {}, components: componentsConfig = [] } = config || {};
        const updatedItems = [];

        // 保存当前配置用于对比
        const currentConfig = this._currentConfig || {};

        // 更新渲染器配置
        if (this.renderer && sceneConfig.renderer) {
            const shouldUpdateRenderer = forceUpdate ||
                !this._deepEqual(currentConfig.renderer, sceneConfig.renderer);

            if (shouldUpdateRenderer) {
                this.renderer.updateConfig(sceneConfig.renderer);
                updatedItems.push('renderer');
            }
        }

        // 更新背景配置
        if (sceneConfig.background) {
            const shouldUpdateBackground = forceUpdate ||
                !this._deepEqual(currentConfig.background, sceneConfig.background);

            if (shouldUpdateBackground) {
                this._updateBackground(sceneConfig.background);
                updatedItems.push('background');
            }
        }

        // 更新相机配置
        if (this.camera && sceneConfig.camera) {
            const shouldUpdateCamera = forceUpdate ||
                !this._deepEqual(currentConfig.camera, sceneConfig.camera);

            if (shouldUpdateCamera) {
                this.camera.updateConfig(sceneConfig.camera);
                updatedItems.push('camera');
            }
        }

        // 更新控制器配置
        if (this.controls && sceneConfig.controls) {
            const shouldUpdateControls = forceUpdate ||
                !this._deepEqual(currentConfig.controls, sceneConfig.controls);

            if (shouldUpdateControls) {
                this.controls.updateConfig(sceneConfig.controls);
                updatedItems.push('controls');
            }
        }

        // 更新灯光配置
        if (this.light && sceneConfig.lighting) {
            const shouldUpdateLighting = forceUpdate ||
                !this._deepEqual(currentConfig.lighting, sceneConfig.lighting);

            if (shouldUpdateLighting) {
                this.light.updateConfig(sceneConfig.lighting);
                updatedItems.push('lighting');
            }
        }

        // 更新组件（按 name 匹配实例，调用组件的 updateConfig）
        if (Array.isArray(componentsConfig)) {
            const shouldUpdateComponents = forceUpdate ||
                !this._deepEqual(currentConfig.components, componentsConfig);

            if (shouldUpdateComponents) {
                const componentUpdateResult = this._updateComponents(componentsConfig);
                if (
                    componentUpdateResult.updatedCount > 0 ||
                    componentUpdateResult.missingCount > 0
                ) {
                    updatedItems.push('components');
                }
            }
        }

        // 保存当前配置用于下次对比
        this._currentConfig = {
            renderer: sceneConfig.renderer ? { ...sceneConfig.renderer } : currentConfig.renderer,
            background: sceneConfig.background ? { ...sceneConfig.background } : currentConfig.background,
            camera: sceneConfig.camera ? { ...sceneConfig.camera } : currentConfig.camera,
            controls: sceneConfig.controls ? { ...sceneConfig.controls } : currentConfig.controls,
            lighting: sceneConfig.lighting ? { ...sceneConfig.lighting } : currentConfig.lighting,
            components: Array.isArray(componentsConfig) ? componentsConfig.map((c) => ({ ...c })) : currentConfig.components
        };

        if (updatedItems.length > 0) {
            console.log('[Scene] 更新完成:', updatedItems);
        } else {
            console.log('[Scene] 配置未变化，跳过更新');
        }

        return {
            success: true,
            updatedItems,
            forceUpdate
        };
    }

    /**
     * 增量更新组件（仅更新已存在的组件实例）
     * - config.components 是一个数组，元素通常形如：{ id, name, type, config, visible, ... }
     * - 通过 name 在 ComponentManager 中查找对应实例，执行 instance.updateConfig(component.config)
     * @private
     * @param {Array} componentsConfig - 组件配置数组
     * @returns {{updatedCount:number, missingCount:number}}
     */
    _updateComponents(componentsConfig) {
        let updatedCount = 0;
        let missingCount = 0;
        for (const componentData of componentsConfig) {
            if (!componentData || typeof componentData !== 'object') continue;

            const name = componentData.name || componentData?.config?.name;
            if (!name) {
                missingCount++;
                continue;
            }
            // 查找实例
            const instance = this.componentManager.get(name);
            if (!instance) {
                missingCount++;
                continue;
            }

            // visible 作为运行时状态，直接同步到实例
            if (typeof componentData.visible === 'boolean') {
                if (typeof instance.setVisible === 'function') {
                    instance.setVisible(componentData.visible, { emit: false });
                } else {
                    instance.visible = componentData.visible;
                }
            }

            const nextConfig = {
                ...(componentData.config || {}),
                name
            };

            try {
                const maybePromise = instance.updateConfig?.(nextConfig);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.catch((error) => {
                        console.error(`[Scene] Component updateConfig failed: ${name}`, error);
                    });
                }
                updatedCount++;
            } catch (error) {
                console.error(`[Scene] Component updateConfig threw: ${name}`, error);
            }
        }

        return { updatedCount, missingCount };
    }

    /**
     * 更新背景配置
     * @private
     * @param {Object} backgroundConfig - 背景配置
     */
    _updateBackground(backgroundConfig) {
        if (!backgroundConfig) return;

        // 更新背景色
        if (backgroundConfig.color !== undefined) {
            this.scene.background = new THREE.Color(backgroundConfig.color);
        }

        // 如果有 HDR 环境贴图配置，可以在这里处理
        // if (backgroundConfig.environment) { ... }
    }

    /**
     * 深度比较两个对象是否相等
     * @private
     * @param {any} a - 对象 A
     * @param {any} b - 对象 B
     * @returns {boolean} 是否相等
     */
    _deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a === b;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return a === b;

        // 数组：元素数不同直接不等；内容用 JSON.stringify（组件配置数组通常较小）
        if (Array.isArray(a)) {
            if (!Array.isArray(b) || a.length !== b.length) return false;
            try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
        }

        // 普通对象：浅层键值比较，避免对大对象整体序列化
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
            const va = a[key];
            const vb = b[key];
            if (va === vb) continue;
            // 嵌套对象/数组：允许递归一层
            if (va !== null && typeof va === 'object' && vb !== null && typeof vb === 'object') {
                try { if (JSON.stringify(va) !== JSON.stringify(vb)) return false; } catch { return false; }
            } else {
                return false;
            }
        }
        return true;
    }

    /**
     * 获取当前场景配置
     * @returns {Object} 当前场景配置
     */
    getConfig() {
        return {
            renderer: this.renderer?.getConfig?.() || {},
            camera: this.camera?.getConfig?.() || {},
            controls: this.controls?.getConfig?.() || {},
            lighting: this.light?.getConfig?.() || {}
        };
    }

    /**
     * 动画循环
     */
    animate() {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame(() => this.animate());

        // 更新动画管理器
        this.animationManager.update();

        // 更新组件
        this.componentManager.update();

        // 更新控制器
        if (this.controls) {
            this.controls.update();
        }

        // 渲染场景
        if (this.renderer && this.camera && this.options.isRendering) {
            this.renderer.render(this.scene, this.camera.instance);
        }
    }

    /**
     * 添加组件
     *
     * @param {string} componentName - 组件名称
     * @param {Object} config - 组件配置
     * @returns {Promise<Component>} 组件实例
     */
    async add(componentName, config = {}) {
        console.log('[Scene] 添加组件:', componentName, config);
        return this.componentManager.add(componentName, config);
    }

    /**
     * 获取组件
     *
     * @param {string} name - 组件名称
     * @returns {Component|null} 组件实例
     */
    get(name) {
        return this.componentManager.get(name);
    }

    /**
     * 移除组件
     *
     * @param {string} name - 组件名称
     */
    remove(name) {
        this.componentManager.remove(name);
    }

    /**
     * 注册组件
     *
     * @param {string} name - 组件名称
     * @param {Class} ComponentClass - 组件类
     */
    registerComponent(name, ComponentClass) {
        this.componentManager.register(name, ComponentClass);
    }

    /**
     * 销毁场景
     */
    dispose() {
        // 停止渲染
        this.stop();

        // 禁用窗口大小自动调整
        this.disableResize();

        // 销毁组件
        this.componentManager.dispose();

        // 销毁事件系统
        this.eventSystem.dispose();

        // 销毁资源管理器
        this.resourceManager.dispose();

        // 销毁动画管理器
        this.animationManager.dispose();

        // 销毁加载器管理器
        if (this.loaderManager) {
            this.loaderManager.dispose();
        }

        // 关闭 IndexedDB 连接
        if (this.indexedDBCache) {
            this.indexedDBCache.close();
        }

        // 销毁渲染器
        if (this.renderer) {
            this.renderer.dispose();
        }

        // 清空场景
        this.scene.clear();

        // 标记为未初始化
        this.isInitialized = false;
    }
}
