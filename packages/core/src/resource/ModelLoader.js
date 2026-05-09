import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * ModelLoader 模型加载器
 *
 * @class ModelLoader
 * @description 支持 GLTF/GLB/FBX 格式的模型加载
 */
export class ModelLoader {
    /**
     * 创建模型加载器实例
     *
     * @param {IndexedDBCache} indexedDBCache - IndexedDB 缓存实例（可选）
     * @param {Object} options - 配置选项
     * @param {string} options.dracoDecoderPath - Draco 解码器路径
     */
    constructor(indexedDBCache = null, options = {}) {
        // GLTF/GLB 加载器
        this.manager = new LoadingManager();
        this.gltfLoader = new GLTFLoader(this.manager);

        // 单例 DRACOLoader 实例
        this._dracoLoader = new DRACOLoader();
        this._dracoPath = options.dracoDecoderPath || '/draco/';
        this._dracoLoader.setDecoderPath(this._dracoPath);
        this.gltfLoader.setDRACOLoader(this._dracoLoader);

        // Draco 预加载状态
        this._dracoPreloaded = false;
        this._dracoPreloadPromise = null;

        // FBX 加载器
        this.fbxLoader = new FBXLoader(this.manager);

        // 保持向后兼容
        this.loader = this.gltfLoader;

        // IndexedDB 缓存
        this.cache = indexedDBCache;
        this.parsedModelCache = new Map();
        this.pendingLoads = new Map();
    }

    _applyMaterialDepthDefaults(root) {
        root?.traverse?.((child) => {
            if (!child?.isMesh || !child.material) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
                if (!material) return;
                if ('depthWrite' in material) {
                    material.depthWrite = true;
                }
                if ('depthTest' in material) {
                    material.depthTest = true;
                }
                material.needsUpdate = true;
            });
        });
    }

    /**
     * 预加载 Draco 解码器
     * 确保在加载模型前解码器已完全初始化
     *
     * @returns {Promise<void>}
     */
    async preloadDraco() {
        if (this._dracoPreloaded) {
            return;
        }

        if (this._dracoPreloadPromise) {
            return this._dracoPreloadPromise;
        }

        this._dracoPreloadPromise = new Promise((resolve) => {
            this._dracoLoader.preload();
            // DRACOLoader.preload() 是同步启动异步加载的
            // 通过短暂延迟确保 Worker 初始化完成
            // eslint-disable-next-line no-undef
            globalThis.setTimeout(() => {
                this._dracoPreloaded = true;
                resolve();
            }, 100);
        });

        return this._dracoPreloadPromise;
    }

    /**
     * 获取 DRACOLoader 实例（单例）
     *
     * @returns {DRACOLoader} DRACOLoader 实例
     */
    getDracoLoader() {
        return this._dracoLoader;
    }

    /**
     * 根据文件扩展名检测模型格式
     *
     * Blob URL（如 blob:http://.../<uuid>）没有扩展名，此时会返回 null。
     * 调用方可通过 formatHint 参数显式指定格式，优先级高于 URL 检测。
     *
     * @param {string} url - 模型 URL
     * @param {string} [formatHint] - 可选的格式提示（如 'glb'、'gltf'、'fbx'）
     * @returns {string|null} 模型格式，无法检测时返回 null
     */
    detectFormat(url, formatHint) {
        // 调用方显式提供格式时，直接使用（去掉可能携带的前缀点号）
        if (formatHint) {
            return formatHint.toLowerCase().replace(/^\./, '');
        }

        // Blob URL 没有路径扩展名，无法自动检测
        if (url.startsWith('blob:')) {
            return null;
        }

        const extension = url.split('.').pop().toLowerCase().split('?')[0];
        return extension || null;
    }

    _isEphemeralUrl(url) {
        const text = String(url || '');
        return text.startsWith('blob:') || text.startsWith('w3d-local-model://');
    }

    async _withLocalURLResolver(rootUrl, task) {
        const registry = globalThis?.__W3D_LOCAL_MODEL_FILES__;
        if (!registry?.resolveUrl || !registry?.isLocalModelUrl?.(rootUrl)) {
            return task();
        }

        this.manager.setURLModifier((resourceUrl) => (
            registry.resolveUrl(resourceUrl, rootUrl) || resourceUrl
        ));

        try {
            return await task();
        } finally {
            this.manager.setURLModifier(null);
        }
    }

    /**
     * 加载模型（自动检测格式）
     *
     * @param {string} url - 模型 URL
     * @param {Function} onProgress - 进度回调
     * @param {string} [formatHint] - 可选的格式提示，当 URL 为 Blob URL 时必须提供
     * @returns {Promise<Object>} 统一的模型对象
     */
    async load(url, onProgress, formatHint) {
        const cacheKey = this._buildCacheKey(url, formatHint);
        const shouldUsePersistentCache = !this._isEphemeralUrl(url);
        const parsedModel = this.parsedModelCache.get(cacheKey);
        if (parsedModel) {
            if (onProgress) onProgress(1);
            return this._cloneModelData(parsedModel);
        }

        const pendingLoad = this.pendingLoads.get(cacheKey);
        if (pendingLoad) {
            if (onProgress) onProgress(1);
            return pendingLoad.then((modelData) => this._cloneModelData(modelData));
        }

        const loadTask = (async () => {
        // 尝试从 IndexedDB 缓存加载
        if (this.cache && shouldUsePersistentCache) {
            const cachedData = await this.cache.get(url);
            if (cachedData) {
                // eslint-disable-next-line no-console
                console.log('[CoreModelLoader][Debug] cache hit', {
                    url,
                    formatHint: formatHint || null,
                    cachedBytes: cachedData?.byteLength || 0
                });
                const cachedModelData = await this._loadFromCache(url, cachedData, onProgress, formatHint);
                this.parsedModelCache.set(cacheKey, cachedModelData);
                return cachedModelData;
            }
        }

        // 从网络加载
        const format = this.detectFormat(url, formatHint);
        // eslint-disable-next-line no-console
        console.log('[CoreModelLoader][Debug] load start', {
            url,
            formatHint: formatHint || null,
            detectedFormat: format || null
        });
        let resolvedFormat = format;

        const modelData = await this._withLocalURLResolver(url, async () => {
            switch (format) {
            case 'fbx':
                return await this.loadFBX(url, onProgress);
            case 'gltf':
            case 'glb':
                return await this.loadGLTF(url, onProgress);
            default:
                // eslint-disable-next-line no-console
                console.warn('[CoreModelLoader][Debug] format unresolved, fallback probing', {
                    url,
                    formatHint: formatHint || null
                });
                resolvedFormat = null;
                return await this._tryLoadWithFallbackFormats(url, onProgress);
            }
        });
        if (!resolvedFormat) {
            resolvedFormat = modelData?.type || null;
        }

        // 缓存到 IndexedDB
        if (this.cache && shouldUsePersistentCache && modelData && resolvedFormat) {
            await this._cacheModel(url);
        }

        this.parsedModelCache.set(cacheKey, modelData);
        return modelData;
        })();

        this.pendingLoads.set(cacheKey, loadTask);

        try {
            const modelData = await loadTask;
            return this._cloneModelData(modelData);
        } finally {
            this.pendingLoads.delete(cacheKey);
        }
    }

    async _tryLoadWithFallbackFormats(url, onProgress) {
        const errors = [];

        try {
            // eslint-disable-next-line no-console
            console.log('[CoreModelLoader][Debug] fallback try GLTF/GLB', { url });
            return await this.loadGLTF(url, onProgress);
        } catch (error) {
            errors.push(`GLTF/GLB: ${error?.message || String(error)}`);
        }

        try {
            // eslint-disable-next-line no-console
            console.log('[CoreModelLoader][Debug] fallback try FBX', { url });
            return await this.loadFBX(url, onProgress);
        } catch (error) {
            errors.push(`FBX: ${error?.message || String(error)}`);
        }

        // eslint-disable-next-line no-console
        console.error('[CoreModelLoader][Debug] fallback failed', {
            url,
            errors
        });

        throw new Error(
            `不支持的模型格式或加载失败: ${url}。支持的格式: .gltf, .glb, .fbx。尝试结果: ${errors.join(' | ')}`
        );
    }

    /**
     * 加载 GLTF/GLB 模型
     *
     * @param {string} url - 模型 URL
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Object>} GLTF 对象
     */
    loadGLTF(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    this._applyMaterialDepthDefaults(gltf.scene);
                    // 返回统一的格式
                    // 注意：移除 parser 引用，避免 DRACOLoader Worker postMessage 克隆错误
                    resolve({
                        scene: gltf.scene,
                        animations: gltf.animations || [],
                        cameras: gltf.cameras || [],
                        asset: gltf.asset || {},
                        parser: null, // parser 包含不可克隆的对象，设为 null
                        userData: gltf.userData || {},
                        type: 'gltf'
                    });
                },
                (progress) => {
                    if (onProgress && progress.total > 0) {
                        const percent = progress.loaded / progress.total;
                        onProgress(percent);
                    }
                },
                (error) => {
                    reject(new Error(`GLTF 加载失败: ${error.message}`));
                }
            );
        });
    }

    /**
     * 加载 FBX 模型
     *
     * @param {string} url - 模型 URL
     * @param {Function} onProgress - 进度回调
     * @returns {Promise<Object>} 统一格式的 FBX 对象
     */
    loadFBX(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.fbxLoader.load(
                url,
                (object) => {
                    this._applyMaterialDepthDefaults(object);
                    // 将 FBX 对象转换为统一的格式（类似 GLTF）
                    const animations = object.animations || [];

                    resolve({
                        scene: object,
                        animations: animations,
                        cameras: [],
                        asset: { generator: 'FBXLoader' },
                        parser: null,
                        userData: object.userData || {},
                        type: 'fbx'
                    });
                },
                (progress) => {
                    if (onProgress && progress.total > 0) {
                        const percent = progress.loaded / progress.total;
                        onProgress(percent);
                    }
                },
                (error) => {
                    reject(new Error(`FBX 加载失败: ${error.message}`));
                }
            );
        });
    }

    /**
     * 设置 Draco 解码器路径
     * 复用现有的 DRACOLoader 实例，避免重复创建
     *
     * @param {string} path - 解码器路径
     */
    setDracoDecoderPath(path) {
        if (path === this._dracoPath) {
            return; // 路径未变，无需更新
        }
        this._dracoPath = path;
        this._dracoLoader.setDecoderPath(path);
        // 路径变更后重置预加载状态
        this._dracoPreloaded = false;
        this._dracoPreloadPromise = null;
    }

    /**
     * 获取当前 Draco 解码器路径
     *
     * @returns {string} 解码器路径
     */
    getDracoDecoderPath() {
        return this._dracoPath;
    }

    _buildCacheKey(url, formatHint) {
        const normalizedFormat = String(formatHint || '').trim().toLowerCase().replace(/^\./, '');
        return [String(url || ''), normalizedFormat, this._dracoPath || ''].join('|');
    }

    _containsSkinnedMesh(root) {
        let found = false;
        root?.traverse?.((child) => {
            if (child?.isSkinnedMesh) {
                found = true;
            }
        });
        return found;
    }

    _cloneScene(scene) {
        const clonedRoot = this._containsSkinnedMesh(scene)
            ? cloneSkeleton(scene)
            : scene.clone(true);

        clonedRoot.traverse((child) => {
            if (!child?.isMesh) return;

            if (child.geometry?.clone) {
                child.geometry = child.geometry.clone();
            }

            if (Array.isArray(child.material)) {
                child.material = child.material.map((material) => material?.clone?.() || material);
            } else if (child.material?.clone) {
                child.material = child.material.clone();
            }
        });

        return clonedRoot;
    }

    _cloneModelData(modelData) {
        if (!modelData?.scene) {
            return modelData;
        }

        return {
            ...modelData,
            scene: this._cloneScene(modelData.scene),
            animations: Array.isArray(modelData.animations) ? [...modelData.animations] : [],
            cameras: Array.isArray(modelData.cameras) ? [...modelData.cameras] : [],
            asset: modelData.asset ? { ...modelData.asset } : {},
            userData: modelData.userData ? { ...modelData.userData } : {}
        };
    }

    /**
     * 销毁加载器资源
     */
    dispose() {
        if (this._dracoLoader) {
            this._dracoLoader.dispose();
            this._dracoLoader = null;
        }
        this._dracoPreloaded = false;
        this._dracoPreloadPromise = null;
        this.parsedModelCache.clear();
        this.pendingLoads.clear();
    }

    /**
     * 从缓存加载模型
     *
     * @private
     * @param {string} url - 模型 URL
     * @param {ArrayBuffer} cachedData - 缓存的数据
     * @param {Function} onProgress - 进度回调
     * @param {string} [formatHint] - 可选的格式提示
     * @returns {Promise<Object>} 统一的模型对象
     */
    async _loadFromCache(url, cachedData, onProgress, formatHint) {
        const format = this.detectFormat(url, formatHint);

        // 模拟进度回调
        if (onProgress) {
            onProgress(1);
        }

        // 根据格式解析缓存数据
        switch (format) {
        case 'gltf':
        case 'glb':
            return this._parseGLTFFromCache(cachedData);
        case 'fbx':
            return this._parseFBXFromCache(cachedData);
        default:
            throw new Error(`不支持的模型格式: ${format}`);
        }
    }

    /**
     * 从缓存解析 GLTF/GLB 模型
     *
     * @private
     * @param {ArrayBuffer} data - 缓存的数据
     * @returns {Promise<Object>} GLTF 对象
     */
    _parseGLTFFromCache(data) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.parse(
                data,
                '',
                (gltf) => {
                    this._applyMaterialDepthDefaults(gltf.scene);
                    resolve({
                        scene: gltf.scene,
                        animations: gltf.animations || [],
                        cameras: gltf.cameras || [],
                        asset: gltf.asset || {},
                        parser: gltf.parser,
                        userData: gltf.userData || {},
                        type: 'gltf'
                    });
                },
                (error) => {
                    reject(new Error(`GLTF 解析失败: ${error.message}`));
                }
            );
        });
    }

    /**
     * 从缓存解析 FBX 模型
     *
     * @private
     * @param {ArrayBuffer} data - 缓存的数据
     * @returns {Promise<Object>} 统一格式的 FBX 对象
     */
    _parseFBXFromCache(data) {
        return new Promise((resolve, reject) => {
            try {
                const object = this.fbxLoader.parse(data, '');
                this._applyMaterialDepthDefaults(object);
                const animations = object.animations || [];

                resolve({
                    scene: object,
                    animations: animations,
                    cameras: [],
                    asset: { generator: 'FBXLoader' },
                    parser: null,
                    userData: object.userData || {},
                    type: 'fbx'
                });
            } catch (error) {
                reject(new Error(`FBX 解析失败: ${error.message}`));
            }
        });
    }

    /**
     * 缓存模型到 IndexedDB
     *
     * @private
     * @param {string} url - 模型 URL
     * @param {string} format - 模型格式
     * @returns {Promise<void>}
     */
    async _cacheModel(url) {
        try {
            // 重新获取原始数据以缓存
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            await this.cache.set(url, arrayBuffer, 'model');
        } catch (error) {
            // 缓存失败不影响主流程
            console.warn(`Failed to cache model: ${url}`, error);
        }
    }
}
