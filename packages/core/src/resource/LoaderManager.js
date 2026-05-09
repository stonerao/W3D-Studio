import { ModelLoader } from './ModelLoader.js';
import { TextureLoader } from './TextureLoader.js';

/**
 * LoaderManager 全局加载器管理器
 *
 * @class LoaderManager
 * @description 统一管理所有加载器实例，实现单例模式
 * 避免每个组件实例都创建独立的加载器，提高性能和内存使用效率
 *
 * @example
 * // 在 Scene 中初始化
 * this.loaderManager = new LoaderManager(this.indexedDBCache);
 *
 * // 在组件中使用
 * const modelLoader = this.scene.loaderManager.getModelLoader();
 * const model = await modelLoader.load('/models/robot.glb');
 */
export class LoaderManager {
    /**
     * 创建加载器管理器实例
     *
     * @param {IndexedDBCache} indexedDBCache - IndexedDB 缓存实例（可选）
     * @param {Object} options - 配置选项
     * @param {string} options.dracoDecoderPath - Draco 解码器路径
     */
    constructor(indexedDBCache = null, options = {}) {
        this.indexedDBCache = indexedDBCache;
        this.options = options;

        // 加载器实例缓存
        this._modelLoader = null;
        this._textureLoader = null;

        // Draco 配置
        this._dracoDecoderPath = options.dracoDecoderPath || '/draco/';
    }

    /**
     * 获取模型加载器（单例）
     *
     * @returns {ModelLoader} ModelLoader 实例
     */
    getModelLoader() {
        if (!this._modelLoader) {
            // 1) 优先通过构造参数传入（当前版本 ModelLoader 已支持 options.dracoDecoderPath）
            // 2) 同时再调用一次 setDracoDecoderPath：
            //    - 兼容旧版 ModelLoader（不消费 options 的场景）
            //    - 也避免 LoaderManager 先 setDracoDecoderPath()、后首次 getModelLoader() 时丢配置
            this._modelLoader = new ModelLoader(this.indexedDBCache, {
                dracoDecoderPath: this._dracoDecoderPath
            });

            if (
                typeof this._dracoDecoderPath === 'string' &&
                typeof this._modelLoader.setDracoDecoderPath === 'function'
            ) {
                this._modelLoader.setDracoDecoderPath(this._dracoDecoderPath);
            }
        }
        return this._modelLoader;
    }

    /**
     * 获取纹理加载器（单例）
     *
     * @returns {TextureLoader} TextureLoader 实例
     */
    getTextureLoader() {
        if (!this._textureLoader) {
            this._textureLoader = new TextureLoader(this.indexedDBCache);
        }
        return this._textureLoader;
    }

    /**
     * 设置 Draco 解码器路径
     * 会同步更新已创建的 ModelLoader 实例
     *
     * @param {string} path - Draco 解码器路径
     */
    setDracoDecoderPath(path) {
        this._dracoDecoderPath = path;

        // 如果 ModelLoader 已经创建，同步更新
        if (this._modelLoader) {
            this._modelLoader.setDracoDecoderPath(path);
        }
    }

    /**
     * 获取当前 Draco 解码器路径
     *
     * @returns {string} Draco 解码器路径
     */
    getDracoDecoderPath() {
        return this._dracoDecoderPath;
    }

    /**
     * 预加载 Draco 解码器
     *
     * @returns {Promise<void>}
     */
    async preloadDraco() {
        const modelLoader = this.getModelLoader();
        return modelLoader.preloadDraco();
    }

    /**
     * 更新 IndexedDB 缓存实例
     * 用于在缓存初始化后更新
     *
     * @param {IndexedDBCache} indexedDBCache - IndexedDB 缓存实例
     */
    setIndexedDBCache(indexedDBCache) {
        this.indexedDBCache = indexedDBCache;

        // 更新已创建的加载器实例
        if (this._modelLoader) {
            this._modelLoader.cache = indexedDBCache;
        }
        if (this._textureLoader) {
            this._textureLoader.cache = indexedDBCache;
        }
    }

    /**
     * 清理所有加载器资源
     */
    dispose() {
        if (this._modelLoader) {
            // ModelLoader 可能有需要清理的资源（如 DRACOLoader Workers）
            if (typeof this._modelLoader.dispose === 'function') {
                this._modelLoader.dispose();
            }
            this._modelLoader = null;
        }

        if (this._textureLoader) {
            this._textureLoader = null;
        }
    }
}

export default LoaderManager;
