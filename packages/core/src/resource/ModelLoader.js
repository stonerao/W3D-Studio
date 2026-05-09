import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * English comment.
 */
export class ModelLoader {
    /**
     * English comment.
     */
    constructor(indexedDBCache = null, options = {}) {
        // English comment.
        this.manager = new LoadingManager();
        this.gltfLoader = new GLTFLoader(this.manager);

        // English comment.
        this._dracoLoader = new DRACOLoader();
        this._dracoPath = options.dracoDecoderPath || '/draco/';
        this._dracoLoader.setDecoderPath(this._dracoPath);
        this.gltfLoader.setDRACOLoader(this._dracoLoader);

        // English comment.
        this._dracoPreloaded = false;
        this._dracoPreloadPromise = null;

        // English comment.
        this.fbxLoader = new FBXLoader(this.manager);

        // English comment.
        this.loader = this.gltfLoader;

        // English comment.
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
     * English comment.
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
            // English comment.
            // English comment.
            // eslint-disable-next-line no-undef
            globalThis.setTimeout(() => {
                this._dracoPreloaded = true;
                resolve();
            }, 100);
        });

        return this._dracoPreloadPromise;
    }

    /**
     * English comment.
     */
    getDracoLoader() {
        return this._dracoLoader;
    }

    /**
     * English comment.
     */
    detectFormat(url, formatHint) {
        // English comment.
        if (formatHint) {
            return formatHint.toLowerCase().replace(/^\./, '');
        }

        // English comment.
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
     * English comment.
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
        // English comment.
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

        // English comment.
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

        // English comment.
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
     * English comment.
     */
    loadGLTF(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    this._applyMaterialDepthDefaults(gltf.scene);
                    // English comment.
                    // English comment.
                    resolve({
                        scene: gltf.scene,
                        animations: gltf.animations || [],
                        cameras: gltf.cameras || [],
                        asset: gltf.asset || {},
                        parser: null, // English comment.
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
     * English comment.
     */
    loadFBX(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.fbxLoader.load(
                url,
                (object) => {
                    this._applyMaterialDepthDefaults(object);
                    // English comment.
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
     * English comment.
     */
    setDracoDecoderPath(path) {
        if (path === this._dracoPath) {
            return; // English comment.
        }
        this._dracoPath = path;
        this._dracoLoader.setDecoderPath(path);
        // English comment.
        this._dracoPreloaded = false;
        this._dracoPreloadPromise = null;
    }

    /**
     * English comment.
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
     * English comment.
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
     * English comment.
     */
    async _loadFromCache(url, cachedData, onProgress, formatHint) {
        const format = this.detectFormat(url, formatHint);

        // English comment.
        if (onProgress) {
            onProgress(1);
        }

        // English comment.
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
     * English comment.
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
     * English comment.
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
     * English comment.
     */
    async _cacheModel(url) {
        try {
            // English comment.
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            await this.cache.set(url, arrayBuffer, 'model');
        } catch (error) {
            // English comment.
            console.warn(`Failed to cache model: ${url}`, error);
        }
    }
}
