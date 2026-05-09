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
 * English comment.
 */
export class Scene {
    /**
     * English comment.
     */
    constructor(container, options = {}) {
        // English comment.
        this.container =
            typeof container === 'string' ? document.querySelector(container) : container;

        if (!this.container) {
            throw new Error('Container not found');
        }
        // English comment.
        this.options = Object.assign(
            {
                isRendering: true,
                isResize: true
            },
            options
        );

        // English comment.
        this.scene = new THREE.Scene();

        // English comment.
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.light = null;

        // English comment.
        this.componentManager = new ComponentManager(this);
        this.eventSystem = new EventSystem(this);
        this.resourceManager = new ResourceManager(this);
        this.animationManager = new AnimationManager(this);

        // English comment.
        this.indexedDBCache = null;
        if (this.options.indexedDB) {
            this.indexedDBCache = new IndexedDBCache(this.options.indexedDB);
        }

        // English comment.
        this.loaderManager = new LoaderManager(this.indexedDBCache, {
            dracoDecoderPath: this.options.dracoDecoderPath || '/draco/'
        });

        // English comment.
        this.isInitialized = false;
        this.isRunning = false;

        // English comment.
        this.animationFrameId = null;
    }

    /**
     * English comment.
     */
    async init() {
        if (this.isInitialized) {
            console.warn('Scene already initialized');
            return this;
        }

        // English comment.
        if (this.indexedDBCache) {
            await this.indexedDBCache.init();
        }

        // English comment.
        if (!this.renderer) {
            this.renderer = new Renderer(this, this.options.renderer);
        }

        // English comment.
        if (!this.camera) {
            this.camera = new Camera(this, this.options.camera);
        }

        // English comment.
        if (!this.controls) {
            this.controls = new Controls(this, this.options.controls);
        }

        // English comment.
        if (!this.light) {
            this.light = new Light(this, this.options.lights);
        }

        // English comment.
        this.eventSystem.init();

        // English comment.
        if (this.options.isResize) {
            this.enableResize();
        }

        // English comment.
        this.isInitialized = true;

        // English comment.
        this.start();
        return this;
    }

    /**
     * English comment.
     */
    enableResize() {
        if (this.renderer) {
            this.renderer.enableResize();
        }
    }

    /**
     * English comment.
     */
    disableResize() {
        if (this.renderer) {
            this.renderer.disableResize();
        }
    }

    /**
     * English comment.
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.animate();
    }

    /**
     * English comment.
     */
    renderOnce() {
        if (!this.renderer || !this.camera) return;
        this.renderer.render(this.scene, this.camera.instance);
    }

    /**
     * English comment.
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
     * English comment.
     */
    pause() {
        if (!this.isRunning) {
            return false;
        }
        this.stop();
        return true;
    }

    /**
     * English comment.
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
     * English comment.
     */
    update(config, forceUpdate = false) {
        if (!this.isInitialized) {
            console.warn('[Scene] Scene not initialized, cannot update');
            return { success: false, reason: 'not_initialized' };
        }

        const { scene: sceneConfig = {}, components: componentsConfig = [] } = config || {};
        const updatedItems = [];

        // English comment.
        const currentConfig = this._currentConfig || {};

        // English comment.
        if (this.renderer && sceneConfig.renderer) {
            const shouldUpdateRenderer = forceUpdate ||
                !this._deepEqual(currentConfig.renderer, sceneConfig.renderer);

            if (shouldUpdateRenderer) {
                this.renderer.updateConfig(sceneConfig.renderer);
                updatedItems.push('renderer');
            }
        }

        // English comment.
        if (sceneConfig.background) {
            const shouldUpdateBackground = forceUpdate ||
                !this._deepEqual(currentConfig.background, sceneConfig.background);

            if (shouldUpdateBackground) {
                this._updateBackground(sceneConfig.background);
                updatedItems.push('background');
            }
        }

        // English comment.
        if (this.camera && sceneConfig.camera) {
            const shouldUpdateCamera = forceUpdate ||
                !this._deepEqual(currentConfig.camera, sceneConfig.camera);

            if (shouldUpdateCamera) {
                this.camera.updateConfig(sceneConfig.camera);
                updatedItems.push('camera');
            }
        }

        // English comment.
        if (this.controls && sceneConfig.controls) {
            const shouldUpdateControls = forceUpdate ||
                !this._deepEqual(currentConfig.controls, sceneConfig.controls);

            if (shouldUpdateControls) {
                this.controls.updateConfig(sceneConfig.controls);
                updatedItems.push('controls');
            }
        }

        // English comment.
        if (this.light && sceneConfig.lighting) {
            const shouldUpdateLighting = forceUpdate ||
                !this._deepEqual(currentConfig.lighting, sceneConfig.lighting);

            if (shouldUpdateLighting) {
                this.light.updateConfig(sceneConfig.lighting);
                updatedItems.push('lighting');
            }
        }

        // English comment.
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

        // English comment.
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
     * English comment.
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
            // English comment.
            const instance = this.componentManager.get(name);
            if (!instance) {
                missingCount++;
                continue;
            }

            // English comment.
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
     * English comment.
     */
    _updateBackground(backgroundConfig) {
        if (!backgroundConfig) return;

        // English comment.
        if (backgroundConfig.color !== undefined) {
            this.scene.background = new THREE.Color(backgroundConfig.color);
        }

        // English comment.
        // if (backgroundConfig.environment) { ... }
    }

    /**
     * English comment.
     */
    _deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a === b;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return a === b;

        // English comment.
        if (Array.isArray(a)) {
            if (!Array.isArray(b) || a.length !== b.length) return false;
            try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
        }

        // English comment.
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
            if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
            const va = a[key];
            const vb = b[key];
            if (va === vb) continue;
            // English comment.
            if (va !== null && typeof va === 'object' && vb !== null && typeof vb === 'object') {
                try { if (JSON.stringify(va) !== JSON.stringify(vb)) return false; } catch { return false; }
            } else {
                return false;
            }
        }
        return true;
    }

    /**
     * English comment.
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
     * English comment.
     */
    animate() {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame(() => this.animate());

        // English comment.
        this.animationManager.update();

        // English comment.
        this.componentManager.update();

        // English comment.
        if (this.controls) {
            this.controls.update();
        }

        // English comment.
        if (this.renderer && this.camera && this.options.isRendering) {
            this.renderer.render(this.scene, this.camera.instance);
        }
    }

    /**
     * English comment.
     */
    async add(componentName, config = {}) {
        console.log('[Scene] 添加组件:', componentName, config);
        return this.componentManager.add(componentName, config);
    }

    /**
     * English comment.
     */
    get(name) {
        return this.componentManager.get(name);
    }

    /**
     * English comment.
     */
    remove(name) {
        this.componentManager.remove(name);
    }

    /**
     * English comment.
     */
    registerComponent(name, ComponentClass) {
        this.componentManager.register(name, ComponentClass);
    }

    /**
     * English comment.
     */
    dispose() {
        // English comment.
        this.stop();

        // English comment.
        this.disableResize();

        // English comment.
        this.componentManager.dispose();

        // English comment.
        this.eventSystem.dispose();

        // English comment.
        this.resourceManager.dispose();

        // English comment.
        this.animationManager.dispose();

        // English comment.
        if (this.loaderManager) {
            this.loaderManager.dispose();
        }

        // English comment.
        if (this.indexedDBCache) {
            this.indexedDBCache.close();
        }

        // English comment.
        if (this.renderer) {
            this.renderer.dispose();
        }

        // English comment.
        this.scene.clear();

        // English comment.
        this.isInitialized = false;
    }
}
