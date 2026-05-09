import * as THREE from 'three';
import { Component, ModelLoader as CoreModelLoader } from '@w3d/core';
import { handleBake } from './Bake';

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const MODEL_TARGET_META_KEY = '__w3dModelTargetMeta';
const BATCH_PROXY_KEY = '__w3dPerformanceBatchProxy';
const BATCH_MESH_KEY = '__w3dPerformanceBatchMesh';
const MERGED_FACE_RANGES_KEY = '__w3dMergedFaceRanges';
const MERGED_EVENT_TARGET_RESOLVER_KEY = '__w3dResolvePerformanceEventTarget';

const normalizeTargetName = (value) => String(value || '').trim();

const isValidTargetName = (value) => {
    const text = normalizeTargetName(value);
    return !!text && !text.startsWith('__') && !text.startsWith('Unnamed');
};

const getTargetPathSegment = (object, index = 0) => {
    const name = normalizeTargetName(object?.name);
    if (name) return name;
    return normalizeTargetName(object?.uuid) || `node_${index}`;
};

const deepMerge = (target, source) => {
    if (Array.isArray(source)) {
        return source.map((item) => deepMerge(undefined, item));
    }

    if (isPlainObject(source)) {
        const base = isPlainObject(target) ? target : {};
        const result = { ...base };
        Object.keys(source).forEach((key) => {
            result[key] = deepMerge(base[key], source[key]);
        });
        return result;
    }

    return source === undefined ? target : source;
};

/**
 * English comment.
 */
export class ModelLoader extends Component {
    /**
     * English comment.
     */
    static defaultConfig = {
        url: '',
        format: '', // English comment.
        scale: 1,
        sizeMode: 'scale',
        targetSize: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        dracoDecoderPath: '/draco/',
        autoPreloadDraco: false,
        freezeWorldMatrix: false,
        castShadow: false,
        receiveShadow: false,
        animations: true,
        autoPlayAnimation: false,
        interactiveMeshes: false,
        eventInteractiveMeshes: false,
        interactiveMeshThreshold: 80,
        interactiveMeshFallback: 'firstN', // 'none' | 'firstN'
        performanceMode: false,
        subtreeActivation: {
            enabled: false,
            visibleNames: [],
            hiddenNames: []
        },
        // English comment.
        bakedLighting: {
            enabled: false, // English comment.
            textureMapping: {}, // English comment.
            mode: 'map', // English comment.
            intensity: 1.0, // English comment.
            autoApply: true, // English comment.
            deferApply: false,
            deferDelay: 0,
            disableInEditor: false,
            channel: 1 // English comment.
        },
        material: {
            'material_1': {
                color: '#ffffff',
                transparent: false
            }
        },
        mesh: {
            'mesh_1': {
                name: 'mesh_1',
                material: 'material_1',
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 }
            }
        }
    };

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        this.interactiveObjects = [];

        // English comment.
        this.textureLoader = null;
        this.bakedTextureCache = new Map();
        this.bakedTextureLoadPromises = new Map();
        this.bakedMaterialCache = new Map();
        this.originalMaterials = new Map(); // English comment.
        this.performanceOptimizationState = this.createPerformanceOptimizationState();
        this.optimizationDummy = new THREE.Object3D();
        this.performanceBatchState = null;
        this.baseBounds = null;
        this.loadVersion = 0;
        this.isLoading = false;
        this.loadProgress = 0;
        this.loadError = null;
        this.allMeshesCache = [];
        this.meshNameMapCache = new Map();
        this.modelNodePathMap = new Map();
        this.modelStructureTreeCache = null;
        this.pendingBakedLightingTimer = null;
        this.hasWarnedFreezeWithAnimations = false;

        // English comment.
        const loaderManager = this.scene?.loaderManager;
        if (loaderManager && typeof loaderManager.getModelLoader === 'function') {
            this.coreLoader = loaderManager.getModelLoader();
        } else {
            // English comment.
            this.coreLoader = new CoreModelLoader(this.scene?.indexedDBCache || null, {
                dracoDecoderPath: this.config.dracoDecoderPath || '/draco/'
            });
        }

        if (this.config.dracoDecoderPath) {
            this.coreLoader.setDracoDecoderPath(this.config.dracoDecoderPath);
        }

        if (this.config.autoPreloadDraco && this.coreLoader?.preloadDraco) {
            this.coreLoader.preloadDraco().catch(() => {});
        }

        this.loadModel()
            .then(() => {
                // English comment.
                // English comment.
                this.setupInteractiveObjects();
            })
            .catch((error) => {
                // English comment.
                // eslint-disable-next-line no-console
                console.error('ModelLoader: Model loading failed in onMounted', error);
            });

        // English comment.
        // English comment.
    }

    /**
     * English comment.
     */
    async loadModel() {
        console.log('ModelLoader start');
        if (!this.config.url) {
            this.isLoading = false;
            this.loadProgress = 0;
            this.loadError = null;
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: url is required');
            return;
        }

        // eslint-disable-next-line no-console
        console.log('[ModelLoader][Debug] loadModel input', {
            name: this.name,
            url: this.config.url,
            format: this.config.format || null,
            dracoDecoderPath: this.config.dracoDecoderPath || null
        });

        const loadVersion = ++this.loadVersion;
        this.isLoading = true;
        this.loadProgress = 0;
        this.loadError = null;

        try {
            const normalizeFormat = (value) => {
                const s = String(value || '').toLowerCase().replace(/^\./, '');
                return ['glb', 'gltf', 'fbx'].includes(s) ? s : '';
            };

            const hasPathExtension = (value) => {
                const raw = String(value || '');
                const pathOnly = raw.split('?')[0].split('#')[0];
                return /\.(glb|gltf|fbx)$/i.test(pathOnly);
            };

            const normalizeLoadUrl = (rawUrl, format) => {
                const safeUrl = String(rawUrl || '');
                if (!safeUrl) return safeUrl;

                const normalizedFormat = normalizeFormat(format);
                if (!normalizedFormat || safeUrl.startsWith('blob:') || hasPathExtension(safeUrl)) {
                    return safeUrl;
                }

                const joiner = safeUrl.includes('?') ? '&' : '?';
                return `${safeUrl}${joiner}__w3d_ext=.${normalizedFormat}`;
            };

            const requestUrl = normalizeLoadUrl(this.config.url, this.config.format);

            this.emit('loadStart', { url: requestUrl, progress: this.loadProgress });

            // English comment.
            const modelData = await this.coreLoader.load(
                requestUrl,
                (progress) => {
                    const nextProgress = Number.isFinite(Number(progress))
                        ? Math.min(1, Math.max(0, Number(progress)))
                        : 0;
                    this.loadProgress = nextProgress;
                    // English comment.
                    this.emit('loadProgress', { progress: nextProgress });
                    this.emit('progress', { progress: nextProgress }); // English comment.
                },
                this.config.format || undefined
            );

            if (loadVersion !== this.loadVersion || this.isDisposed) {
                this.disposeModelResources(modelData?.scene || null);
                return;
            }

            // eslint-disable-next-line no-console
            console.log('[ModelLoader][Debug] coreLoader.load result', {
                url: requestUrl,
                formatHint: this.config.format || null,
                resolvedType: modelData?.type,
                hasScene: !!modelData?.scene,
                animations: modelData?.animations?.length || 0
            });

            if (this.model) {
                this.disposeModelResources(this.model);
            }

            this.modelData = modelData;
            this.model = modelData.scene;
            this.animations = modelData.animations || [];

            this.gltf = {
                scene: modelData.scene,
                animations: modelData.animations,
                cameras: modelData.cameras,
                asset: modelData.asset,
                userData: modelData.userData
            };

            this.baseBounds = this.measureModelBounds();

            // English comment.
            this.applyTransform();

            // English comment.
            this.applyShadow();

            // English comment.
            if (this.config.animations && this.animations.length > 0) {
                this.setupAnimations(this.animations);
            }

            if (this.isPerformanceModeEnabled()) {
                this.applyPerformanceOptimization();
            }

            this.rebuildMeshCache();
            this.applySubtreeActivation();
            this.applyFreezeWorldMatrix();

            // English comment.
            const loadCompleteData = {
                modelData,
                type: modelData.type,
                gltf: this.gltf, // English comment.
                model: this.model
            };

            if (this.config.bakedLighting.enabled && this.config.bakedLighting.autoApply) {
                this.scheduleBakedLightingApply();
            }
            this.componentScene.add(this.model);
            // English comment.
            this.applyMeshAndMaterialConfig();

            this.isLoading = false;
            this.loadProgress = 1;
            this.loadError = null;
            this.emit('loadComplete', loadCompleteData);
            this.emit('loaded', loadCompleteData); // English comment.
        } catch (error) {
            if (loadVersion !== this.loadVersion || this.isDisposed) {
                return;
            }
            this.isLoading = false;
            this.loadError = error;
            // eslint-disable-next-line no-console
            console.error('ModelLoader: Failed to load model', error);
            // eslint-disable-next-line no-console
            console.error('[ModelLoader][Debug] loadModel failed context', {
                name: this.name,
                url: this.config.url,
                format: this.config.format || null,
                error: error?.message || String(error)
            });
            // English comment.
            this.emit('loadError', { error });
            this.emit('error', { error }); // English comment.
        }
    }

    /**
     * English comment.
     */
    applyTransform() {
        if (!this.model) return;

        // English comment.
        const scale = this.getResolvedModelScale();
        this.model.scale.set(scale, scale, scale);

        // English comment.
        const [x, y, z] = this.config.position;
        this.model.position.set(x, y, z);

        // English comment.
        const [rx, ry, rz] = this.config.rotation;
        this.model.rotation.set(rx, ry, rz);
    }

    getScaleMultiplier() {
        const scale = this.config.scale;

        if (typeof scale === 'number') {
            return Number.isFinite(scale) && scale > 0 ? scale : 1;
        }

        if (Array.isArray(scale)) {
            const numeric = Number(scale[0]);
            return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
        }

        if (scale && typeof scale === 'object') {
            const numeric = Number(scale.x);
            return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
        }

        return 1;
    }

    getFitScaleByMaxDimension() {
        if (!this.model || this.config.sizeMode !== 'fit') {
            return 1;
        }

        const targetSize = Number(this.config.targetSize);
        if (!Number.isFinite(targetSize) || targetSize <= 0) {
            return 1;
        }

        const maxDim = Number(this.baseBounds?.maxDim);
        if (!Number.isFinite(maxDim) || maxDim <= 0) {
            return 1;
        }

        return targetSize / maxDim;
    }

    getResolvedModelScale() {
        return this.getScaleMultiplier() * this.getFitScaleByMaxDimension();
    }

    /**
     * English comment.
     */
    applyShadow() {
        if (!this.model) return;
        const castShadow = this.isPerformanceModeEnabled() ? false : this.config.castShadow;
        const receiveShadow = this.isPerformanceModeEnabled() ? false : this.config.receiveShadow;

        this.getMeshListSnapshot().forEach((child) => {
            child.castShadow = castShadow;
            child.receiveShadow = receiveShadow;
        });
    }

    /**
     * English comment.
     */
    setupAnimations(animations) {
        this.animations = animations;
        this.mixer = this.scene.animationManager.createMixer(this.model);
        this.currentAction = null;
        this.animationSpeed = 1.0;
        this.isAnimationPlaying = false;

        // English comment.
        this.emit('animationLoaded', {
            animations: this.getAnimationNames(),
            count: animations.length
        });

        // English comment.
        if (this.config.autoPlayAnimation && animations.length > 0) {
            this.playAnimation(0);
        }
    }

    /**
     * English comment.
     */
    playAnimation(index, options = {}) {
        if (!this.animations || !this.mixer) return;

        if (isPlainObject(index)) {
            options = index.options || index;
            index = index.index ?? index.name ?? index.animationName ?? 0;
        }

        const clip =
            typeof index === 'number'
                ? this.animations[index]
                : this.animations.find((a) => a.name === index);

        if (!clip) {
            // eslint-disable-next-line no-console
            console.warn(`ModelLoader: Animation "${index}" not found`);
            return;
        }

        if (this.currentAction) {
            const fadeOutTime = options.fadeOut || 0.5;
            this.currentAction.fadeOut(fadeOutTime);
        }

        const action = this.mixer.clipAction(clip);

        // English comment.
        if (options.loop !== undefined) {
            action.setLoop(
                options.loop ? THREE.LoopRepeat : THREE.LoopOnce,
                options.loop ? Infinity : 1
            );
        } else {
            action.setLoop(THREE.LoopRepeat, Infinity);
        }

        // English comment.
        action.setEffectiveTimeScale(this.animationSpeed);

        // English comment.
        const fadeInTime = options.fadeIn || 0.5;
        action.reset().fadeIn(fadeInTime).play();

        this.currentAction = action;
        this.currentAnimationName = clip.name;
        this.isAnimationPlaying = true;

        this.emit('animationStarted', {
            name: clip.name,
            duration: clip.duration
        });

        // English comment.
        const onFinished = () => {
            this.emit('animationFinished', { name: clip.name });
            this.mixer.removeEventListener('finished', onFinished);
        };
        this.mixer.addEventListener('finished', onFinished);
    }

    /**
     * English comment.
     */
    pauseAnimation() {
        if (this.currentAction && this.isAnimationPlaying) {
            this.currentAction.paused = true;
            this.isAnimationPlaying = false;
            this.emit('animationPaused', { name: this.currentAnimationName });
        }
    }

    /**
     * English comment.
     */
    resumeAnimation() {
        if (this.currentAction && !this.isAnimationPlaying) {
            this.currentAction.paused = false;
            this.isAnimationPlaying = true;
            this.emit('animationResumed', { name: this.currentAnimationName });
        }
    }

    /**
     * English comment.
     */
    stopAnimation() {
        if (this.currentAction) {
            this.currentAction.stop();
            this.isAnimationPlaying = false;
            this.emit('animationStopped', { name: this.currentAnimationName });
        }
    }

    /**
     * English comment.
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
        if (this.currentAction) {
            this.currentAction.setEffectiveTimeScale(speed);
        }
    }

    /**
     * English comment.
     */
    getAnimationNames() {
        if (!this.animations) return [];
        return this.animations.map(
            (clip) => clip.name || `Animation ${this.animations.indexOf(clip)}`
        );
    }

    /**
     * English comment.
     */
    getCurrentAnimationName() {
        return this.currentAnimationName || null;
    }

    /**
     * English comment.
     */
    isPlaying() {
        return this.isAnimationPlaying;
    }

    /**
     * English comment.
     */
    getModel() {
        return this.model;
    }

    /**
     * English comment.
     */
    getMeshByName(name) {
        const meshName = String(name || '').trim();
        const batchRecord = this.getBatchProxyRecordByMeshName(meshName);
        if (batchRecord?.mesh) {
            return batchRecord.mesh;
        }

        if (!this.model) {
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: Model not loaded yet');
            return null;
        }

        return this.meshNameMapCache.get(meshName) || null;
    }

    /**
     * English comment.
     */
    findMesh(criteria) {
        if (!this.model) {
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: Model not loaded yet');
            return null;
        }

        let foundMesh = null;
        this.model.traverse((child) => {
            if (child.isMesh) {
                let matches = true;

                if (criteria.name && child.name !== criteria.name) {
                    matches = false;
                }

                if (criteria.type && child.type !== criteria.type) {
                    matches = false;
                }

                if (criteria.filter && !criteria.filter(child)) {
                    matches = false;
                }

                if (matches) {
                    foundMesh = child;
                }
            }
        });

        return foundMesh;
    }

    /**
     * English comment.
     */
    getAllMeshes() {
        if (!this.model) {
            const records = this.performanceBatchState?.sourceMeshRecords;
            if (Array.isArray(records) && records.length > 0) {
                return records.map((record) => record?.mesh).filter(Boolean);
            }

            // eslint-disable-next-line no-console
            console.warn('ModelLoader: Model not loaded yet');
            return [];
        }

        return [...this.allMeshesCache];
    }

    /**
     * English comment.
     */
    getMeshNames() {
        const meshes = this.getAllMeshes();
        return meshes.map((mesh) => mesh.name).filter((name) => name);
    }

    getMeshCount() {
        if (Array.isArray(this.allMeshesCache) && this.allMeshesCache.length > 0) {
            return this.allMeshesCache.length;
        }
        return this.getAllMeshes().length;
    }

    createPerformanceOptimizationState() {
        return {
            enabled: false,
            level: this.getPerformanceModeLevel(),
            strategy: '',
            meshCountBefore: 0,
            meshCountAfter: 0,
            optimizedMeshCount: 0,
            instancedGroupCount: 0,
            batchedMeshCount: 0,
            batchedInstanceCount: 0,
            drawCallEstimate: 0,
            skippedMeshCount: 0,
            explosionCompatible: false,
            sourceMaterialCount: 0,
            unifiedMaterial: false,
            materialSimplifiedMeshCount: 0,
            skippedReason: ''
        };
    }

    getPerformanceModeLevel() {
        const mode = this.config?.performanceMode;
        if (mode === true) return 'aggressive';
        if (mode === false || mode === null || mode === undefined) return 'off';
        const normalized = String(mode).trim().toLowerCase();
        if (normalized === 'safe' || normalized === 'aggressive') return normalized;
        return normalized === 'off' ? 'off' : 'aggressive';
    }

    isPerformanceModeEnabled() {
        return this.getPerformanceModeLevel() !== 'off';
    }

    isAggressivePerformanceMode() {
        return this.getPerformanceModeLevel() === 'aggressive';
    }

    isEditorRuntime() {
        if (typeof window === 'undefined') return false;
        const pathname = String(window.location?.pathname || '');
        const hash = String(window.location?.hash || '');
        return /\/editor(\/|$)/.test(pathname) || /\/editor(\/|$)/.test(hash);
    }

    shouldSkipBakedLightingInCurrentRuntime() {
        return this.config?.bakedLighting?.disableInEditor === true && this.isEditorRuntime();
    }

    getPerformanceOptimizationSummary() {
        return {
            ...this.createPerformanceOptimizationState(),
            ...(this.performanceOptimizationState || {}),
            enabled: this.isPerformanceModeEnabled()
        };
    }

    simplifyMeshMaterialForPerformance(mesh) {
        if (!mesh?.material) return;

        this.forEachMeshMaterial(mesh, (material) => {
            if (!material) return;
            material.side = THREE.FrontSide;
            material.depthWrite = true;
            material.depthTest = true;
            material.transparent = false;
            material.vertexColors = false;
            if ('forceSinglePass' in material) {
                material.forceSinglePass = true;
            }
            material.needsUpdate = true;
        });
    }

    buildInstancingGroupKey(mesh) {
        if (!mesh?.geometry || !mesh?.material || Array.isArray(mesh.material)) {
            return '';
        }

        if (mesh.isSkinnedMesh || (Array.isArray(mesh.morphTargetInfluences) && mesh.morphTargetInfluences.length > 0)) {
            return '';
        }

        return [
            mesh.geometry.uuid,
            mesh.material.uuid,
            Number(mesh.castShadow === true),
            Number(mesh.receiveShadow === true)
        ].join('|');
    }

    hasMeshLevelOverrides() {
        return Object.keys(this.config?.mesh || {}).length > 0;
    }

    disposePerformanceBatchState() {
        const state = this.performanceBatchState;
        if (!state) return;

        state.sourceMeshRecords?.forEach((record) => {
            if (record?.mesh?.userData) {
                delete record.mesh.userData[BATCH_PROXY_KEY];
            }
            if (record?.mesh) {
                record.mesh.geometry?.dispose?.();
                if (Array.isArray(record.mesh.material)) {
                    record.mesh.material.forEach((material) => material?.dispose?.());
                } else {
                    record.mesh.material?.dispose?.();
                }
                record.mesh.geometry = null;
                record.mesh.material = null;
                record.mesh.visible = false;
            }
        });

        state.batchedMeshes?.forEach((batchedMesh) => {
            batchedMesh.parent?.remove(batchedMesh);
            batchedMesh.geometry?.dispose?.();
            if (Array.isArray(batchedMesh.material)) {
                batchedMesh.material.forEach((material) => material?.dispose?.());
            } else {
                batchedMesh.material?.dispose?.();
            }
        });

        this.performanceBatchState = null;
    }

    disposeMeshRenderResources(mesh) {
        if (!mesh) return;

        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => material?.dispose?.());
        } else {
            mesh.material?.dispose?.();
        }
        mesh.geometry = null;
        mesh.material = null;
    }

    createPerformanceSourceProxy(mesh, proxyMaterial) {
        const proxy = new THREE.Object3D();
        proxy.name = mesh.name || '';
        proxy.type = 'PerformanceMeshProxy';
        proxy.position.copy(mesh.position);
        proxy.quaternion.copy(mesh.quaternion);
        proxy.scale.copy(mesh.scale);
        proxy.matrix.copy(mesh.matrix);
        proxy.matrixWorld.copy(mesh.matrixWorld);
        proxy.matrixAutoUpdate = mesh.matrixAutoUpdate;
        proxy.visible = false;
        proxy.castShadow = mesh.castShadow === true;
        proxy.receiveShadow = mesh.receiveShadow === true;
        proxy.frustumCulled = mesh.frustumCulled !== false;
        proxy.layers.mask = mesh.layers.mask;
        proxy.geometry = new THREE.BufferGeometry();
        if (mesh.geometry) {
            if (!mesh.geometry.boundingBox) {
                mesh.geometry.computeBoundingBox?.();
            }
            if (!mesh.geometry.boundingSphere) {
                mesh.geometry.computeBoundingSphere?.();
            }
            proxy.geometry.boundingBox = mesh.geometry.boundingBox?.clone?.() || null;
            proxy.geometry.boundingSphere = mesh.geometry.boundingSphere?.clone?.() || null;
        }
        proxy.material = proxyMaterial || null;
        proxy.userData = {
            ...(mesh.userData || {}),
            __w3dPerformanceSourceDeleted: true,
            __w3dPerformanceProxyType: 'Object3D'
        };

        while (mesh.children.length > 0) {
            proxy.add(mesh.children[0]);
        }

        return proxy;
    }

    replaceSourceMeshWithProxy(sourceMesh, proxy) {
        const parent = sourceMesh?.parent || null;
        if (!parent || !proxy) return;

        const index = parent.children.indexOf(sourceMesh);
        if (index >= 0) {
            parent.children.splice(index, 1, proxy);
            proxy.parent = parent;
            sourceMesh.parent = null;
            return;
        }

        parent.add(proxy);
        parent.remove(sourceMesh);
    }

    getBatchProxyRecordByMeshName(meshName) {
        const name = String(meshName || '').trim();
        if (!name || !this.performanceBatchState) return null;
        return this.performanceBatchState.meshNameMap?.get(name) || null;
    }

    enforcePerformanceProxyHidden(records = null) {
        const state = this.performanceBatchState;
        if (!state) return;

        const targetRecords = Array.isArray(records) && records.length > 0
            ? records
            : state.sourceMeshRecords;
        targetRecords.forEach((record) => {
            if (record?.mesh) {
                record.mesh.visible = false;
            }
        });
        state.proxyVisibilityEnforced = true;
    }

    setPerformanceRenderVisible(visible) {
        const state = this.performanceBatchState;
        if (!state) return false;

        const nextVisible = visible !== false;
        const visibilityChanged = state.renderVisible !== nextVisible;
        state.batchedMeshes?.forEach((mesh) => {
            if (mesh) {
                mesh.visible = nextVisible;
            }
        });
        state.renderVisible = nextVisible;
        if (visibilityChanged || state.proxyVisibilityEnforced !== true) {
            this.enforcePerformanceProxyHidden();
        }
        return true;
    }

    setBatchProxyVisible(meshName, visible) {
        const record = this.getBatchProxyRecordByMeshName(meshName);
        if (!record) return false;

        record.proxyVisible = visible !== false;
        if (record.mesh) {
            record.mesh.visible = false;
        }
        if (record.batchedMesh?.isBatchedMesh) {
            record.batchedMesh.setVisibleAt?.(record.instanceId, this.isBatchProxyRenderVisible(record));
        } else {
            this.syncPerformanceBatchMatrices(true, [record]);
        }
        return true;
    }

    isBatchProxyRenderVisible(record) {
        if (!record || record.proxyVisible === false) return false;

        let parent = record.mesh?.parent || null;
        while (parent) {
            if (parent.visible === false) return false;
            if (parent === this.model) break;
            parent = parent.parent || null;
        }

        return true;
    }

    hasMatrixChanged(matrix, previousElements = []) {
        const elements = matrix?.elements || [];
        for (let index = 0; index < 16; index += 1) {
            if (Math.abs((elements[index] || 0) - (previousElements[index] || 0)) > 1e-8) {
                return true;
            }
        }
        return false;
    }

    copyMatrixElements(matrix, target = []) {
        const elements = matrix?.elements || [];
        for (let index = 0; index < 16; index += 1) {
            target[index] = elements[index] || 0;
        }
        return target;
    }

    syncPerformanceBatchMatrices(force = false, targetRecords = null) {
        const state = this.performanceBatchState;
        if (!state || !this.model) return;

        this.model.updateWorldMatrix(true, true);
        state.rootInverseMatrix.copy(this.model.matrixWorld).invert();

        if (state.mergedMesh) {
            if (state.materialTopologyDirty === true) {
                this.rebuildMergedMaterialsFromRecords();
            }

            const geometry = state.mergedMesh.geometry;
            const positionAttr = geometry?.getAttribute?.('position');
            const normalAttr = geometry?.getAttribute?.('normal');
            let positionDirty = false;
            let normalDirty = false;
            const records = Array.isArray(targetRecords) && targetRecords.length > 0
                ? targetRecords
                : state.sourceMeshRecords;
            const shouldSyncMaterial = state.materialDirty === true;

            records.forEach((record) => {
                if (!record?.mesh) return;

                record.mesh.updateWorldMatrix(true, false);
                state.tempMatrix.multiplyMatrices(state.rootInverseMatrix, record.mesh.matrixWorld);

                const visible = this.isBatchProxyRenderVisible(record);
                const matrixDirty = force || this.hasMatrixChanged(state.tempMatrix, record.lastMatrixElements);
                const visibleDirty = force || record.lastRenderVisible !== visible;
                if (shouldSyncMaterial) {
                    this.syncMergedMaterialFromRecord(record);
                }
                if (!matrixDirty && !visibleDirty) return;

                if (positionAttr && record.sourcePositionAttr) {
                    if (visible) {
                        for (let index = 0; index < record.vertexCount; index += 1) {
                            state.tempVector.set(
                                record.sourcePositionAttr.getX(index),
                                record.sourcePositionAttr.getY(index),
                                record.sourcePositionAttr.getZ(index)
                            ).applyMatrix4(state.tempMatrix);
                            positionAttr.setXYZ(
                                record.vertexStart + index,
                                state.tempVector.x,
                                state.tempVector.y,
                                state.tempVector.z
                            );
                        }
                    } else {
                        for (let index = 0; index < record.vertexCount; index += 1) {
                            positionAttr.setXYZ(record.vertexStart + index, 0, 0, 0);
                        }
                    }
                    positionDirty = true;
                }

                if (normalAttr && record.sourceNormalAttr) {
                    if (visible) {
                        state.tempNormalMatrix.getNormalMatrix(state.tempMatrix);
                        for (let index = 0; index < record.vertexCount; index += 1) {
                            state.tempVector.set(
                                record.sourceNormalAttr.getX(index),
                                record.sourceNormalAttr.getY(index),
                                record.sourceNormalAttr.getZ(index)
                            ).applyNormalMatrix(state.tempNormalMatrix).normalize();
                            normalAttr.setXYZ(
                                record.vertexStart + index,
                                state.tempVector.x,
                                state.tempVector.y,
                                state.tempVector.z
                            );
                        }
                    } else {
                        for (let index = 0; index < record.vertexCount; index += 1) {
                            normalAttr.setXYZ(record.vertexStart + index, 0, 0, 1);
                        }
                    }
                    normalDirty = true;
                }

                record.lastRenderVisible = visible;
                record.lastMatrixElements = this.copyMatrixElements(state.tempMatrix, record.lastMatrixElements);
            });

            if (positionDirty) {
                positionAttr.needsUpdate = true;
                geometry.computeBoundingBox?.();
                geometry.computeBoundingSphere?.();
            }
            if (normalDirty) {
                normalAttr.needsUpdate = true;
            }
            if (shouldSyncMaterial) {
                state.materialDirty = false;
            }
            return;
        }

        const records = Array.isArray(targetRecords) && targetRecords.length > 0
            ? targetRecords
            : state.sourceMeshRecords;
        records.forEach((record) => {
            if (!record?.mesh || !record.batchedMesh) return;
            record.mesh.updateWorldMatrix(true, false);
            state.tempMatrix.multiplyMatrices(state.rootInverseMatrix, record.mesh.matrixWorld);
            record.batchedMesh.setMatrixAt(record.instanceId, state.tempMatrix);
            record.batchedMesh.setVisibleAt(record.instanceId, this.isBatchProxyRenderVisible(record));
        });

        state.batchedMeshes.forEach((batchedMesh) => {
            batchedMesh.computeBoundingBox?.();
            batchedMesh.computeBoundingSphere?.();
        });
    }

    syncMergedMaterialFromRecord(record) {
        if (!record?.mergedMesh || !record.mesh?.material) return;

        const targetMaterial = Array.isArray(record.mergedMesh.material)
            ? record.mergedMesh.material[record.materialIndex]
            : record.mergedMesh.material;
        const sourceMaterial = Array.isArray(record.mesh.material)
            ? record.mesh.material[0]
            : record.mesh.material;
        if (!targetMaterial || !sourceMaterial) return;

        targetMaterial.copy(sourceMaterial);
        targetMaterial.needsUpdate = true;
    }

    markPerformanceMaterialsDirty(topologyDirty = false) {
        const state = this.performanceBatchState;
        if (!state?.mergedMesh) return;
        state.materialDirty = true;
        if (topologyDirty) {
            state.materialTopologyDirty = true;
        }
    }

    clonePerformanceRenderMaterial(material) {
        const cloned = material?.clone?.() || material || null;
        if (cloned) {
            cloned.vertexColors = false;
            cloned.needsUpdate = true;
        }
        return cloned;
    }

    disposeMaterialResource(material) {
        if (Array.isArray(material)) {
            material.forEach((item) => item?.dispose?.());
            return;
        }
        material?.dispose?.();
    }

    getRecordMaterial(record) {
        const material = record?.mesh?.material;
        return Array.isArray(material) ? material[0] : material;
    }

    rebuildMergedMaterialsFromRecords() {
        const state = this.performanceBatchState;
        const mergedMesh = state?.mergedMesh;
        const geometry = mergedMesh?.geometry;
        if (!state || !mergedMesh || !geometry) return false;

        const materialKeyToIndex = new Map();
        const mergedMaterials = [];
        let currentMaterialIndex = -1;
        let currentGroupStart = 0;

        geometry.clearGroups?.();

        const flushGroup = (endIndex) => {
            if (currentMaterialIndex < 0 || endIndex <= currentGroupStart) return;
            geometry.addGroup(currentGroupStart, endIndex - currentGroupStart, currentMaterialIndex);
        };

        state.sourceMeshRecords.forEach((record) => {
            const sourceMaterial = this.getRecordMaterial(record);
            const materialKey = this.getBatchMaterialKey(sourceMaterial) || sourceMaterial?.uuid || `record:${record.instanceId}`;
            if (!materialKeyToIndex.has(materialKey)) {
                materialKeyToIndex.set(materialKey, mergedMaterials.length);
                mergedMaterials.push(this.clonePerformanceRenderMaterial(sourceMaterial));
            }

            const materialIndex = materialKeyToIndex.get(materialKey);
            if (currentMaterialIndex !== materialIndex) {
                flushGroup(record.indexStart);
                currentMaterialIndex = materialIndex;
                currentGroupStart = record.indexStart;
            }
            record.materialIndex = materialIndex;
        });

        const lastRecord = state.sourceMeshRecords[state.sourceMeshRecords.length - 1];
        flushGroup(lastRecord ? lastRecord.indexStart + lastRecord.indexCount : 0);

        const previousMaterial = mergedMesh.material;
        mergedMesh.material = mergedMaterials;
        this.disposeMaterialResource(previousMaterial);
        mergedMesh.userData.performanceMode = {
            ...(mergedMesh.userData.performanceMode || {}),
            materialCount: mergedMaterials.length,
            sourceMaterialCount: mergedMaterials.length
        };

        if (this.performanceOptimizationState) {
            this.performanceOptimizationState.drawCallEstimate = mergedMaterials.length;
            this.performanceOptimizationState.sourceMaterialCount = mergedMaterials.length;
        }

        state.materialDirty = false;
        state.materialTopologyDirty = false;
        return true;
    }

    findPerformanceRecordByFaceIndex(faceIndex) {
        const state = this.performanceBatchState;
        const numericFaceIndex = Number(faceIndex);
        if (!state || !Number.isFinite(numericFaceIndex)) return null;

        const records = state.sourceMeshRecords || [];
        let low = 0;
        let high = records.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const record = records[mid];
            if (numericFaceIndex < record.faceStart) {
                high = mid - 1;
            } else if (numericFaceIndex > record.faceEnd) {
                low = mid + 1;
            } else {
                return record;
            }
        }
        return null;
    }

    resolvePerformanceEventTarget(hit) {
        const record = this.findPerformanceRecordByFaceIndex(hit?.faceIndex);
        if (!record?.mesh) return null;

        return {
            object: record.mesh,
            originalObject: hit?.object || null,
            modelTarget: {
                meshName: record.meshName || record.mesh?.name || '',
                nodePath: record.nodePath || '',
                rawName: record.rawName || record.meshName || '',
                objectType: record.mesh?.type || 'PerformanceMeshProxy',
                objectUuid: record.sourceObjectUuid || record.mesh?.uuid || '',
                componentId: this.config?.id || ''
            }
        };
    }

    canMergeMeshForPerformance(mesh) {
        if (!mesh?.isMesh || mesh.isBatchedMesh || !mesh.geometry || !mesh.material || Array.isArray(mesh.material)) {
            return false;
        }

        if (mesh.isSkinnedMesh || (Array.isArray(mesh.morphTargetInfluences) && mesh.morphTargetInfluences.length > 0)) {
            return false;
        }

        return !!mesh.geometry.attributes?.position && !!this.getBatchMaterialKey(mesh.material);
    }

    getMergeableMeshesAndAttributeLayouts(meshes = []) {
        const layouts = new Map();
        const mergeMeshes = [];
        let skippedMeshCount = 0;

        meshes.forEach((mesh) => {
            if (!this.canMergeMeshForPerformance(mesh)) {
                skippedMeshCount += 1;
                return;
            }

            const geometryAttrs = Object.entries(mesh.geometry.attributes || {});
            const hasConflict = geometryAttrs.some(([name, attr]) => {
                const existing = layouts.get(name);
                if (!existing) return false;
                return existing.itemSize !== attr.itemSize
                    || existing.normalized !== (attr.normalized === true)
                    || existing.ArrayCtor !== attr.array.constructor;
            });

            if (hasConflict) {
                skippedMeshCount += 1;
                return;
            }

            geometryAttrs.forEach(([name, attr]) => {
                if (layouts.has(name)) return;
                layouts.set(name, {
                    name,
                    itemSize: attr.itemSize,
                    normalized: attr.normalized === true,
                    ArrayCtor: attr.array.constructor
                });
            });

            mergeMeshes.push(mesh);
        });

        return {
            meshes: mergeMeshes,
            attributeLayouts: [...layouts.values()],
            skippedMeshCount
        };
    }

    copyAttributeValue(sourceAttr, targetAttr, targetIndex, sourceIndex) {
        const itemSize = targetAttr.itemSize || sourceAttr?.itemSize || 1;
        for (let itemIndex = 0; itemIndex < itemSize; itemIndex += 1) {
            let value = sourceAttr?.getComponent?.(sourceIndex, itemIndex);
            if (value === undefined) {
                if (itemIndex === 0) value = sourceAttr?.getX?.(sourceIndex);
                else if (itemIndex === 1) value = sourceAttr?.getY?.(sourceIndex);
                else if (itemIndex === 2) value = sourceAttr?.getZ?.(sourceIndex);
                else if (itemIndex === 3) value = sourceAttr?.getW?.(sourceIndex);
            }
            targetAttr.setComponent(targetIndex, itemIndex, value ?? 0);
        }
    }

    getPerformanceVertexColor(material, target = new THREE.Color()) {
        target.set(0xffffff);
        if (material?.color?.isColor) {
            target.copy(material.color);
        }
        if (material?.emissive?.isColor) {
            target.r = Math.min(1, target.r + material.emissive.r * 0.35);
            target.g = Math.min(1, target.g + material.emissive.g * 0.35);
            target.b = Math.min(1, target.b + material.emissive.b * 0.35);
        }
        return target;
    }

    getPerformanceVertexColorKey(material) {
        const color = this.getPerformanceVertexColor(material, new THREE.Color());
        return `${color.r.toFixed(5)}|${color.g.toFixed(5)}|${color.b.toFixed(5)}`;
    }

    createUnifiedPerformanceMaterial(sourceMaterials = []) {
        const numericAverage = (key, fallback) => {
            const values = sourceMaterials
                .map((material) => Number(material?.[key]))
                .filter((value) => Number.isFinite(value));
            if (!values.length) return fallback;
            return values.reduce((sum, value) => sum + value, 0) / values.length;
        };

        return new THREE.MeshStandardMaterial({
            name: '__w3d_unified_performance_material',
            color: 0xffffff,
            vertexColors: true,
            roughness: numericAverage('roughness', 0.72),
            metalness: numericAverage('metalness', 0.05),
            side: THREE.FrontSide,
            transparent: false,
            depthWrite: true,
            depthTest: true
        });
    }

    applyBatchedPerformanceOptimization(allMeshes, summary) {
        this.disposePerformanceBatchState();

        const mergeResult = this.getMergeableMeshesAndAttributeLayouts(allMeshes);
        const mergeMeshes = mergeResult.meshes;
        const skippedMeshCount = mergeResult.skippedMeshCount;
        if (!mergeMeshes.length) {
            summary.meshCountAfter = allMeshes.length;
            summary.skippedMeshCount = skippedMeshCount;
            summary.skippedReason = 'no-batchable-mesh';
            this.performanceOptimizationState = summary;
            return summary;
        }

        this.model.updateWorldMatrix(true, true);
        const rootInverseMatrix = new THREE.Matrix4().copy(this.model.matrixWorld).invert();
        const sourceMeshRecords = [];
        const meshNameMap = new Map();
        const nodePathMap = new Map();
        const attributeLayouts = mergeResult.attributeLayouts.filter((layout) => layout.name !== 'color');
        const materialKeyToIndex = new Map();
        const mergedMaterials = [];
        const orderedMeshes = [...mergeMeshes].sort((a, b) => {
            return this.getBatchMaterialKey(a.material).localeCompare(this.getBatchMaterialKey(b.material));
        });

        orderedMeshes.forEach((mesh) => {
            const materialKey = this.getBatchMaterialKey(mesh.material);
            if (!materialKeyToIndex.has(materialKey)) {
                materialKeyToIndex.set(materialKey, materialKeyToIndex.size);
                const material = mesh.material?.clone?.() || mesh.material;
                if (material) {
                    material.vertexColors = false;
                    material.needsUpdate = true;
                }
                mergedMaterials.push(material);
            }
        });

        const totalVertexCount = orderedMeshes.reduce((sum, mesh) => {
            return sum + (mesh.geometry.attributes?.position?.count || 0);
        }, 0);
        const totalIndexCount = orderedMeshes.reduce((sum, mesh) => {
            const positionCount = mesh.geometry.attributes?.position?.count || 0;
            return sum + (mesh.geometry.index?.count || positionCount);
        }, 0);

        const mergedGeometry = new THREE.BufferGeometry();
        const mergedAttributes = new Map();
        attributeLayouts.forEach((layout) => {
            const array = new layout.ArrayCtor(totalVertexCount * layout.itemSize);
            const attr = new THREE.BufferAttribute(array, layout.itemSize, layout.normalized);
            mergedGeometry.setAttribute(layout.name, attr);
            mergedAttributes.set(layout.name, attr);
        });

        const IndexArrayCtor = totalVertexCount > 65535 ? Uint32Array : Uint16Array;
        const mergedIndex = new IndexArrayCtor(totalIndexCount);
        const faceRanges = [];
        let vertexCursor = 0;
        let indexCursor = 0;
        let currentGroupMaterial = -1;
        let currentGroupStart = 0;

        const flushGroup = () => {
            if (currentGroupMaterial < 0 || indexCursor <= currentGroupStart) return;
            mergedGeometry.addGroup(currentGroupStart, indexCursor - currentGroupStart, currentGroupMaterial);
        };

        orderedMeshes.forEach((mesh) => {
            const geometry = mesh.geometry;
            const positionAttr = geometry.getAttribute('position');
            const normalAttr = geometry.getAttribute('normal');
            const vertexCount = positionAttr.count;
            const sourceIndex = geometry.index;
            const indexCount = sourceIndex?.count || vertexCount;
            const materialIndex = materialKeyToIndex.get(this.getBatchMaterialKey(mesh.material)) || 0;
            const proxyMaterial = mesh.material?.clone?.() || null;
            const proxy = this.createPerformanceSourceProxy(mesh, proxyMaterial);

            if (currentGroupMaterial !== materialIndex) {
                flushGroup();
                currentGroupMaterial = materialIndex;
                currentGroupStart = indexCursor;
            }

            attributeLayouts.forEach((layout) => {
                const sourceAttr = geometry.getAttribute(layout.name);
                const targetAttr = mergedAttributes.get(layout.name);
                for (let index = 0; index < vertexCount; index += 1) {
                    this.copyAttributeValue(sourceAttr, targetAttr, vertexCursor + index, index);
                }
            });

            for (let index = 0; index < indexCount; index += 1) {
                const sourceVertexIndex = sourceIndex ? sourceIndex.getX(index) : index;
                mergedIndex[indexCursor + index] = vertexCursor + sourceVertexIndex;
            }

            const targetMeta = mesh.userData?.[MODEL_TARGET_META_KEY] || {};
            const record = {
                mesh: proxy,
                meshName: mesh.name || '',
                nodePath: targetMeta.nodePath || '',
                rawName: targetMeta.rawName || mesh.name || '',
                batchedMesh: null,
                mergedMesh: null,
                instanceId: sourceMeshRecords.length,
                materialIndex,
                vertexStart: vertexCursor,
                vertexCount,
                indexStart: indexCursor,
                indexCount,
                faceStart: Math.floor(indexCursor / 3),
                faceEnd: Math.floor((indexCursor + indexCount - 1) / 3),
                sourcePositionAttr: positionAttr.clone?.() || positionAttr,
                sourceNormalAttr: normalAttr?.clone?.() || normalAttr || null,
                originalVisible: mesh.visible !== false,
                proxyVisible: mesh.visible !== false,
                originalMatrix: mesh.matrix.clone(),
                sourceObjectUuid: mesh.uuid,
                sourceGeometryDisposed: true,
                lastRenderVisible: null,
                lastMatrixElements: []
            };

            proxy.userData[BATCH_PROXY_KEY] = record;
            this.replaceSourceMeshWithProxy(mesh, proxy);
            this.disposeMeshRenderResources(mesh);
            sourceMeshRecords.push(record);
            const faceRangeMeta = {
                faceStart: record.faceStart,
                faceEnd: record.faceEnd,
                meshName: record.meshName,
                nodePath: record.nodePath,
                rawName: record.rawName,
                sourceObjectUuid: record.sourceObjectUuid
            };
            record.faceRangeMeta = faceRangeMeta;
            faceRanges.push(faceRangeMeta);

            if (record.meshName && !meshNameMap.has(record.meshName)) {
                meshNameMap.set(record.meshName, record);
            }
            if (record.nodePath) {
                if (!nodePathMap.has(record.nodePath)) {
                    nodePathMap.set(record.nodePath, []);
                }
                nodePathMap.get(record.nodePath).push(record);
            }

            vertexCursor += vertexCount;
            indexCursor += indexCount;
        });
        flushGroup();

        mergedGeometry.setIndex(new THREE.BufferAttribute(mergedIndex, 1));
        const mergedMesh = new THREE.Mesh(mergedGeometry, mergedMaterials);
        mergedMesh.name = `__w3d_merged_${this.name || 'model'}`;
        mergedMesh.castShadow = orderedMeshes.some((mesh) => mesh.castShadow);
        mergedMesh.receiveShadow = orderedMeshes.some((mesh) => mesh.receiveShadow);
        mergedMesh.frustumCulled = true;
        mergedMesh.userData = {
            ...(mergedMesh.userData || {}),
            [BATCH_MESH_KEY]: true,
            [MERGED_FACE_RANGES_KEY]: faceRanges,
            [MERGED_EVENT_TARGET_RESOLVER_KEY]: (hit) => this.resolvePerformanceEventTarget(hit),
            performanceMode: {
                strategy: 'merged-textured-materials',
                sourceMeshCount: sourceMeshRecords.length,
                sourceMaterialCount: mergedMaterials.length,
                materialCount: mergedMaterials.length,
                texturePreserved: true
            }
        };
        sourceMeshRecords.forEach((record) => {
            record.batchedMesh = mergedMesh;
            record.mergedMesh = mergedMesh;
        });

        this.model.add(mergedMesh);

        this.performanceBatchState = {
            batchedMeshes: [mergedMesh],
            mergedMesh,
            sourceMeshRecords,
            meshNameMap,
            nodePathMap,
            rootInverseMatrix,
            tempMatrix: new THREE.Matrix4(),
            tempVector: new THREE.Vector3(),
            tempNormalMatrix: new THREE.Matrix3(),
            renderVisible: true,
            proxyVisibilityEnforced: true,
            materialDirty: false,
            materialTopologyDirty: false
        };
        this.syncPerformanceBatchMatrices(true);

        summary.strategy = 'merged-textured-materials';
        summary.meshCountAfter = allMeshes.length;
        summary.optimizedMeshCount = sourceMeshRecords.length;
        summary.batchedMeshCount = 1;
        summary.batchedInstanceCount = sourceMeshRecords.length;
        summary.drawCallEstimate = mergedMaterials.length;
        summary.skippedMeshCount = skippedMeshCount;
        summary.sourceMaterialCount = mergedMaterials.length;
        summary.unifiedMaterial = false;
        summary.explosionCompatible = true;
        return summary;
    }

    applyPerformanceOptimization() {
        if (!this.model) return this.getPerformanceOptimizationSummary();

        const summary = this.createPerformanceOptimizationState();
        const allMeshes = this.getMeshListSnapshot();
        allMeshes.forEach((child) => {
            this.simplifyMeshMaterialForPerformance(child);
        });

        summary.enabled = true;
        summary.meshCountBefore = allMeshes.length;
        summary.materialSimplifiedMeshCount = allMeshes.length;

        if (this.animations?.length || !this.isAggressivePerformanceMode()) {
            summary.meshCountAfter = allMeshes.length;
            summary.skippedReason = this.animations?.length ? 'animations' : 'safe-mode';
            this.performanceOptimizationState = summary;
            return summary;
        }

        this.applyBatchedPerformanceOptimization(allMeshes, summary);
        this.performanceOptimizationState = summary;
        this.rebuildMeshCache();
        return summary;
    }

    applyInstancedPerformanceOptimization(allMeshes, summary) {
        if (!this.model) return summary;

        this.model.updateWorldMatrix(true, true);
        const rootInverseMatrix = new THREE.Matrix4().copy(this.model.matrixWorld).invert();
        const instancingGroups = new Map();

        allMeshes.forEach((mesh) => {
            const key = this.buildInstancingGroupKey(mesh);
            if (!key) return;
            if (!instancingGroups.has(key)) {
                instancingGroups.set(key, []);
            }
            instancingGroups.get(key).push(mesh);
        });

        instancingGroups.forEach((meshes) => {
            if (!Array.isArray(meshes) || meshes.length < 2) return;

            const [firstMesh] = meshes;
            const instancedMesh = new THREE.InstancedMesh(firstMesh.geometry, firstMesh.material, meshes.length);
            instancedMesh.name = `${firstMesh.name || 'mesh'}__instanced_${meshes.length}`;
            instancedMesh.castShadow = meshes.some((mesh) => mesh.castShadow);
            instancedMesh.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
            instancedMesh.frustumCulled = firstMesh.frustumCulled;
            instancedMesh.renderOrder = firstMesh.renderOrder || 0;
            instancedMesh.userData = {
                ...firstMesh.userData,
                performanceMode: {
                    sourceMeshNames: meshes.map((mesh) => mesh.name).filter(Boolean),
                    instanceCount: meshes.length
                }
            };

            meshes.forEach((mesh, index) => {
                mesh.updateWorldMatrix(true, false);
                const localMatrix = new THREE.Matrix4().multiplyMatrices(rootInverseMatrix, mesh.matrixWorld);
                instancedMesh.setMatrixAt(index, localMatrix);
            });

            instancedMesh.instanceMatrix.needsUpdate = true;
            this.model.add(instancedMesh);

            meshes.forEach((mesh) => {
                mesh.parent?.remove(mesh);
            });

            summary.optimizedMeshCount += meshes.length;
            summary.instancedGroupCount += 1;
        });

        summary.meshCountAfter = this.getAllMeshes().length;
        this.performanceOptimizationState = summary;
        this.rebuildMeshCache();
        return summary;
    }

    rebuildMeshCache() {
        if (!this.model) {
            this.allMeshesCache = [];
            this.meshNameMapCache = new Map();
            this.modelNodePathMap = new Map();
            this.modelStructureTreeCache = null;
            return;
        }

        const meshes = [];
        const meshNameMap = new Map();
        const nodePathMap = new Map();
        const batchMeshNameMap = new Map();
        const batchNodePathMap = new Map();

        const visit = (object, parentPath = '', siblingIndex = 0) => {
            if (!object) return;
            if (object.userData?.[BATCH_MESH_KEY] === true) return;

            const segment = getTargetPathSegment(object, siblingIndex);
            const nodePath = parentPath ? `${parentPath}/${segment}` : segment;
            nodePathMap.set(nodePath, object);

            if (!object.userData) object.userData = {};

            const isPerformanceProxy = object.userData?.[BATCH_PROXY_KEY] !== undefined;
            const isMeshLike = object.isMesh || isPerformanceProxy;
            const meshName = isMeshLike && isValidTargetName(object.name) ? object.name : '';
            object.userData[MODEL_TARGET_META_KEY] = {
                meshName,
                rawName: normalizeTargetName(object.name),
                nodePath,
                objectType: object.type || '',
                objectUuid: object.uuid || '',
                componentId: this.config?.id || ''
            };

            if (isPerformanceProxy) {
                const record = object.userData[BATCH_PROXY_KEY];
                if (record) {
                    record.meshName = meshName || record.meshName || object.name || '';
                    record.nodePath = nodePath;
                    record.rawName = normalizeTargetName(object.name) || record.rawName || record.meshName || '';
                    record.faceRangeMeta = record.faceRangeMeta || null;
                    if (record.faceRangeMeta) {
                        record.faceRangeMeta.meshName = record.meshName;
                        record.faceRangeMeta.nodePath = record.nodePath;
                        record.faceRangeMeta.rawName = record.rawName;
                    }
                    if (record.meshName && !batchMeshNameMap.has(record.meshName)) {
                        batchMeshNameMap.set(record.meshName, record);
                    }
                    if (record.nodePath) {
                        if (!batchNodePathMap.has(record.nodePath)) {
                            batchNodePathMap.set(record.nodePath, []);
                        }
                        batchNodePathMap.get(record.nodePath).push(record);
                    }
                }
            }

            if (isMeshLike) {
                meshes.push(object);
                if (object.name && !meshNameMap.has(object.name)) {
                    meshNameMap.set(object.name, object);
                }
            }

            if (Array.isArray(object.children)) {
                object.children.forEach((child, index) => visit(child, nodePath, index));
            }
        };

        const roots = Array.isArray(this.model.children) && this.model.children.length > 0
            ? this.model.children
            : [this.model];
        roots.forEach((child, index) => visit(child, '', index));

        this.allMeshesCache = meshes;
        this.meshNameMapCache = meshNameMap;
        this.modelNodePathMap = nodePathMap;
        this.modelStructureTreeCache = null;
        if (this.performanceBatchState) {
            this.performanceBatchState.meshNameMap = batchMeshNameMap;
            this.performanceBatchState.nodePathMap = batchNodePathMap;
        }
    }

    getMeshListSnapshot() {
        if (Array.isArray(this.allMeshesCache) && this.allMeshesCache.length > 0) {
            return [...this.allMeshesCache];
        }

        if (!this.model) {
            return [];
        }

        const meshes = [];
        this.model.traverse((child) => {
            if (
                child?.userData?.[BATCH_MESH_KEY] !== true &&
                (child?.isMesh || child?.userData?.[BATCH_PROXY_KEY] !== undefined)
            ) {
                meshes.push(child);
            }
        });
        return meshes;
    }

    getRenderableMeshListSnapshot() {
        if (!this.performanceBatchState) {
            return this.getMeshListSnapshot();
        }
        return [...(this.performanceBatchState.batchedMeshes || [])];
    }

    getBatchRecordsByMeshNames(meshNames = []) {
        if (!this.performanceBatchState) return [];
        const names = Array.isArray(meshNames) ? meshNames : [meshNames];
        const records = [];
        const seen = new Set();

        names.forEach((name) => {
            const record = this.getBatchProxyRecordByMeshName(name);
            if (!record || seen.has(record.instanceId)) return;
            seen.add(record.instanceId);
            records.push(record);
        });

        return records;
    }

    getModelTargetMeta(object) {
        if (!object) return null;
        return object.userData?.[MODEL_TARGET_META_KEY] || null;
    }

    getModelStructureTreeFromBatchRecords() {
        const records = this.performanceBatchState?.sourceMeshRecords;
        if (!Array.isArray(records) || records.length === 0) return [];

        const appendUnique = (list, value) => {
            const text = String(value || '').trim();
            if (text && !list.includes(text)) list.push(text);
        };
        const formatSegmentName = (segment = '') => String(segment || '').replace(/::\d+$/, '') || 'Unnamed';
        const root = {
            id: `node:${this.name || 'model'}:performance-root`,
            nodePath: '',
            name: this.name || '模型结构',
            type: 'Group',
            isMesh: false,
            children: [],
            meshNames: []
        };
        const pathMap = new Map([['', root]]);

        records.forEach((record, index) => {
            const meshName = String(record?.meshName || record?.rawName || `mesh_${index}`).trim();
            if (!meshName) return;

            const rawPath = String(record?.nodePath || meshName).trim();
            const segments = rawPath.split('/').map((item) => item.trim()).filter(Boolean);
            const safeSegments = segments.length ? segments : [meshName];
            let parent = root;
            let currentPath = '';
            appendUnique(root.meshNames, meshName);

            safeSegments.forEach((segment, segmentIndex) => {
                currentPath = currentPath ? `${currentPath}/${segment}` : segment;
                let node = pathMap.get(currentPath);
                const isLeaf = segmentIndex === safeSegments.length - 1;

                if (!node) {
                    node = {
                        id: `node:${currentPath}`,
                        nodePath: currentPath,
                        name: isLeaf ? (record.rawName || meshName || formatSegmentName(segment)) : formatSegmentName(segment),
                        type: isLeaf ? 'PerformanceMeshProxy' : 'Group',
                        isMesh: isLeaf,
                        children: [],
                        meshNames: []
                    };
                    pathMap.set(currentPath, node);
                    parent.children.push(node);
                }

                appendUnique(node.meshNames, meshName);
                parent = node;
            });
        });

        return root.children.length > 0 ? [root] : [];
    }

    getModelStructureTree() {
        if (!this.model) return this.getModelStructureTreeFromBatchRecords();
        if (Array.isArray(this.modelStructureTreeCache)) {
            return this.modelStructureTreeCache;
        }

        const buildNode = (object, parentPath = '', siblingIndex = 0) => {
            if (object?.userData?.[BATCH_MESH_KEY] === true) {
                return null;
            }

            const segment = getTargetPathSegment(object, siblingIndex);
            const nodePath = parentPath ? `${parentPath}/${segment}` : segment;
            const children = Array.isArray(object?.children)
                ? object.children.flatMap((child, index) => {
                    const node = buildNode(child, nodePath, index);
                    return node ? [node] : [];
                })
                : [];

            const isPerformanceProxy = object?.userData?.[BATCH_PROXY_KEY] !== undefined;
            const isMesh = object?.isMesh === true || isPerformanceProxy;
            const meshNames = isMesh && isValidTargetName(object?.name)
                ? [object.name]
                : children.flatMap((child) => child.meshNames || []);

            if (!isMesh && !isValidTargetName(object?.name)) {
                return children.length === 1
                    ? children[0]
                    : {
                        id: `node:${nodePath}`,
                        nodePath,
                        name: object?.name || object?.uuid || 'Unnamed',
                        type: object?.type || 'Object3D',
                        isMesh: false,
                        children,
                        meshNames: [...new Set(meshNames)]
                    };
            }

            return {
                id: `node:${nodePath}`,
                nodePath,
                name: object?.name || object?.uuid || 'Unnamed',
                type: object?.type || 'Object3D',
                isMesh,
                children,
                meshNames: [...new Set(meshNames)]
            };
        };

        const roots = Array.isArray(this.model.children) && this.model.children.length > 0
            ? this.model.children
            : [this.model];

        const tree = roots.flatMap((child, index) => {
            const node = buildNode(child, '', index);
            return node ? [node] : [];
        });
        this.modelStructureTreeCache = tree.length > 0 ? tree : this.getModelStructureTreeFromBatchRecords();
        return this.modelStructureTreeCache;
    }

    getMaterialTextureSignature(material) {
        const textureKeys = [
            'map',
            'normalMap',
            'roughnessMap',
            'metalnessMap',
            'aoMap',
            'lightMap',
            'emissiveMap',
            'alphaMap'
        ];

        return textureKeys
            .map((key) => {
                const texture = material?.[key];
                return `${key}:${texture?.uuid || texture?.source?.uuid || ''}`;
            })
            .join('|');
    }

    getBatchMaterialKey(material) {
        if (!material) return '';

        const color = material.color?.getHexString?.() || '';
        const emissive = material.emissive?.getHexString?.() || '';
        let customProgramKey = '';
        try {
            customProgramKey = typeof material.customProgramCacheKey === 'function'
                ? material.customProgramCacheKey()
                : '';
        } catch {
            customProgramKey = '';
        }
        return [
            material.type || 'Material',
            color,
            emissive,
            material.opacity ?? 1,
            Number(material.transparent === true),
            material.alphaTest ?? 0,
            material.side ?? THREE.FrontSide,
            Number(material.depthWrite !== false),
            Number(material.depthTest !== false),
            Number(material.wireframe === true),
            material.metalness ?? '',
            material.roughness ?? '',
            material.lightMapIntensity ?? '',
            Number(material.userData?.__w3dBakePatched === true),
            material.userData?.__w3dBakeIntensity ?? '',
            customProgramKey,
            this.getMaterialTextureSignature(material)
        ].join('|');
    }

    getBatchGeometryKey(geometry) {
        if (!geometry?.attributes?.position) return '';

        const attributes = Object.keys(geometry.attributes || {}).sort().map((name) => {
            const attr = geometry.attributes[name];
            const arrayType = attr?.array?.constructor?.name || '';
            return `${name}:${attr?.itemSize || 0}:${Number(attr?.normalized === true)}:${arrayType}`;
        });

        const morphKeys = Object.keys(geometry.morphAttributes || {});
        if (morphKeys.length > 0) {
            return '';
        }

        return [
            geometry.index ? 'indexed' : 'non-indexed',
            ...attributes
        ].join('|');
    }

    buildBatchGroupKey(mesh) {
        if (!mesh?.isMesh || mesh.isBatchedMesh || !mesh.geometry || !mesh.material || Array.isArray(mesh.material)) {
            return '';
        }

        if (mesh.isSkinnedMesh || (Array.isArray(mesh.morphTargetInfluences) && mesh.morphTargetInfluences.length > 0)) {
            return '';
        }

        const materialKey = this.getBatchMaterialKey(mesh.material);
        const geometryKey = this.getBatchGeometryKey(mesh.geometry);
        if (!materialKey || !geometryKey) return '';

        return [
            materialKey,
            geometryKey,
            Number(mesh.castShadow === true),
            Number(mesh.receiveShadow === true)
        ].join('||');
    }

    getMeshNamesForNodePaths(nodePaths = [], includeChildren = true) {
        const paths = Array.isArray(nodePaths) ? nodePaths.map((item) => String(item || '').trim()).filter(Boolean) : [];
        if (!paths.length) return [];

        const names = new Set();
        if (!this.model) {
            const nodePathMap = this.performanceBatchState?.nodePathMap;
            if (!(nodePathMap instanceof Map)) return [];

            paths.forEach((nodePath) => {
                nodePathMap.forEach((records, recordPath) => {
                    const matched = includeChildren
                        ? (recordPath === nodePath || recordPath.startsWith(`${nodePath}/`))
                        : recordPath === nodePath;
                    if (!matched) return;
                    (Array.isArray(records) ? records : [records]).forEach((record) => {
                        const meshName = String(record?.meshName || record?.rawName || '').trim();
                        if (meshName) names.add(meshName);
                    });
                });
            });

            return [...names];
        }

        paths.forEach((nodePath) => {
            const object = this.modelNodePathMap?.get(nodePath);
            if (!object) return;

            const addMeshName = (mesh) => {
                const isMeshLike = mesh?.isMesh || mesh?.userData?.[BATCH_PROXY_KEY] !== undefined;
                if (isMeshLike && isValidTargetName(mesh.name)) {
                    names.add(mesh.name);
                }
            };

            addMeshName(object);

            if (!Array.isArray(object.children)) return;
            object.children.forEach((child) => {
                if (includeChildren) {
                    if (typeof child.traverse === 'function') {
                        child.traverse(addMeshName);
                    } else {
                        addMeshName(child);
                    }
                    return;
                }
                addMeshName(child);
            });
        });

        return [...names];
    }

    scheduleBakedLightingApply() {
        if (!this.config?.bakedLighting?.enabled || !this.config?.bakedLighting?.autoApply) {
            return;
        }

        if (this.pendingBakedLightingTimer) {
            globalThis.clearTimeout?.(this.pendingBakedLightingTimer);
            this.pendingBakedLightingTimer = null;
        }

        const runApply = () => {
            this.pendingBakedLightingTimer = null;
            this.applyBakedLighting(this.config.bakedLighting.textureMapping, {
                mode: this.config.bakedLighting.mode,
                intensity: this.config.bakedLighting.intensity
            }).catch((error) => {
                // eslint-disable-next-line no-console
                console.error('ModelLoader: Failed to apply baked lighting', error);
            });
        };

        if (this.config.bakedLighting.deferApply) {
            const delay = Math.max(0, Number(this.config.bakedLighting.deferDelay) || 0);
            this.pendingBakedLightingTimer = globalThis.setTimeout(runApply, delay);
            return;
        }

        runApply();
    }

    applyFreezeWorldMatrix() {
        if (!this.model) return;

        const shouldFreeze = this.config.freezeWorldMatrix === true && !(this.animations?.length > 0);
        if (this.config.freezeWorldMatrix === true && this.animations?.length > 0 && !this.hasWarnedFreezeWithAnimations) {
            this.hasWarnedFreezeWithAnimations = true;
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: freezeWorldMatrix is ignored when animations are present');
        }

        this.model.traverse((child) => {
            child.matrixAutoUpdate = !shouldFreeze;
            if (shouldFreeze) {
                child.updateMatrix();
            }
        });

        if (shouldFreeze) {
            this.model.updateMatrixWorld(true);
        }
    }

    applySubtreeActivation() {
        if (!this.model) return;

        const subtreeActivation = this.config?.subtreeActivation || {};
        if (subtreeActivation.enabled !== true) {
            return;
        }

        const visibleNames = new Set(Array.isArray(subtreeActivation.visibleNames) ? subtreeActivation.visibleNames : []);
        const hiddenNames = new Set(Array.isArray(subtreeActivation.hiddenNames) ? subtreeActivation.hiddenNames : []);

        const toggleSubtree = (name, visible) => {
            const target = this.model.getObjectByName?.(name);
            if (!target) return;
            const recordsToSync = [];
            target.traverse((child) => {
                const record = child?.userData?.[BATCH_PROXY_KEY];
                if (record) {
                    record.proxyVisible = visible !== false;
                    child.visible = false;
                    recordsToSync.push(record);
                    return;
                }
                if (child?.userData?.[BATCH_MESH_KEY] === true) {
                    child.visible = visible !== false;
                    return;
                }
                child.visible = visible;
            });
            if (recordsToSync.length > 0) {
                this.syncPerformanceBatchMatrices(true, recordsToSync);
            }
        };

        hiddenNames.forEach((name) => toggleSubtree(name, false));
        visibleNames.forEach((name) => toggleSubtree(name, true));
        this.enforcePerformanceProxyHidden();
    }

    /**
     * English comment.
     */
    setupInteractiveObjects() {
        if (!this.model) {
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: Model not loaded, cannot setup interactive objects');
            return;
        }

        const interactiveMeshes = this.getResolvedInteractiveMeshes();

        const allMeshes = this.getAllMeshes();
        allMeshes.forEach((mesh) => {
            if (mesh.userData.eventEmitter) {
                delete mesh.userData.eventEmitter;
            }
        });
        if (this.performanceBatchState?.mergedMesh?.userData?.eventEmitter) {
            delete this.performanceBatchState.mergedMesh.userData.eventEmitter;
        }

        this.interactiveObjects = [];

        const invalidateInteractiveCache = () => {
            this.scene?.eventSystem?.invalidateInteractiveCache?.();
        };

        if (
            interactiveMeshes === false ||
            interactiveMeshes === null ||
            interactiveMeshes === undefined
        ) {
            invalidateInteractiveCache();
            return;
        }

        if (this.performanceBatchState?.mergedMesh) {
            const mergedMesh = this.performanceBatchState.mergedMesh;
            mergedMesh.userData.eventEmitter = this.eventEmitter;
            mergedMesh.userData[MERGED_EVENT_TARGET_RESOLVER_KEY] = (hit) => this.resolvePerformanceEventTarget(hit);
            this.performanceBatchState.sourceMeshRecords.forEach((record) => {
                if (record?.mesh?.userData) {
                    record.mesh.userData.eventEmitter = this.eventEmitter;
                }
            });
            this.interactiveObjects = [mergedMesh];
            invalidateInteractiveCache();
            return;
        }

        if (interactiveMeshes === '*') {
            const threshold = Math.max(0, Number(this.config.interactiveMeshThreshold) || 0);
            const fallback = String(this.config.interactiveMeshFallback || 'firstN');
            const shouldLimit = threshold > 0 && allMeshes.length > threshold;

            if (shouldLimit && fallback === 'none') {
                // eslint-disable-next-line no-console
                console.warn(`ModelLoader: interactive mesh count ${allMeshes.length} exceeds threshold ${threshold}, events disabled`);
                invalidateInteractiveCache();
                return;
            }

            this.interactiveObjects = shouldLimit && fallback === 'firstN'
                ? allMeshes.slice(0, threshold)
                : [...allMeshes];

            this.interactiveObjects.forEach((mesh) => {
                mesh.userData.eventEmitter = this.eventEmitter;
            });

            // English comment.
            if (allMeshes.length > 50 || shouldLimit) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[W3D Performance Warning] ModelLoader: Interactive mesh count=${allMeshes.length}, active=${this.interactiveObjects.length}. ` +
                        'Consider specifying only interactive meshes using interactiveMeshes: [\'mesh1\', \'mesh2\'].'
                );
            }
            invalidateInteractiveCache();
            return;
        }

        if (Array.isArray(interactiveMeshes)) {
            const foundMeshes = [];
            const notFoundMeshes = [];

            interactiveMeshes.forEach((meshName) => {
                const mesh = this.getMeshByName(meshName);
                if (mesh) {
                    foundMeshes.push(mesh);
                } else {
                    notFoundMeshes.push(meshName);
                }
            });

            this.interactiveObjects = foundMeshes;

            // English comment.
            this.interactiveObjects.forEach((mesh) => {
                mesh.userData.eventEmitter = this.eventEmitter;
            });

            // English comment.
            if (notFoundMeshes.length > 0) {
                // eslint-disable-next-line no-console
                console.warn(
                    `ModelLoader: The following mesh names were not found in the model: ${notFoundMeshes.join(', ')}. ` +
                        `Available meshes: ${this.getMeshNames().join(', ')}`
                );
            }

            invalidateInteractiveCache();
            return;
        }

        // eslint-disable-next-line no-console
        console.warn(
            `ModelLoader: Invalid interactiveMeshes configuration: ${interactiveMeshes}. ` +
                'Expected: false, \'*\', or array of mesh names.'
        );
        invalidateInteractiveCache();
    }

    getResolvedInteractiveMeshes() {
        const manualMeshes = this.config?.interactiveMeshes;
        const eventMeshes = this.config?.eventInteractiveMeshes;

        if (manualMeshes === '*' || eventMeshes === '*') {
            return '*';
        }

        const merged = new Set();
        if (Array.isArray(manualMeshes)) {
            manualMeshes.forEach((name) => {
                const text = String(name || '').trim();
                if (text) merged.add(text);
            });
        }
        if (Array.isArray(eventMeshes)) {
            eventMeshes.forEach((name) => {
                const text = String(name || '').trim();
                if (text) merged.add(text);
            });
        }

        return merged.size > 0 ? [...merged] : false;
    }

    /**
     * English comment.
     */
    getInteractiveObjects() {
        return this.interactiveObjects || [];
    }

    /**
     * English comment.
     */
    setInteractiveMeshes(meshes) {
        this.config.interactiveMeshes = meshes;
        this.setupInteractiveObjects();
    }

    setEventInteractiveMeshes(meshes) {
        this.config.eventInteractiveMeshes = meshes;
        this.setupInteractiveObjects();
    }

    /**
     * English comment.
     */
    isMeshInteractive(mesh) {
        return this.interactiveObjects.includes(mesh);
    }

    /**
     * English comment.
     */
    async applyBakedLighting(textureMapping = {}, options = {}) {
        if (this.shouldSkipBakedLightingInCurrentRuntime()) {
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: skip baked lighting in editor mode by config');
            return;
        }

        if (!this.model) {
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: 模型未加载，无法应用烘焙光照');
            return;
        }

        const {
            mode = 'map',
            intensity = 1.0,
            channel = this.config.bakedLighting.channel ?? 1, // English comment.
            flipY = this.config.bakedLighting.flipY ?? false, // English comment.
            IndependentMaterial = this.config.bakedLighting.IndependentMaterial ?? true // English comment.
        } = options;

        try {
            // English comment.
            if (!this.textureLoader) {
                this.textureLoader = new THREE.TextureLoader();
            }

            const meshes = this.getMeshListSnapshot();
            const applyTasks = [];

            // English comment.
            for (const mesh of meshes) {
                const meshName = mesh.name;
                let texturePath = null;
                let matchSource = '';

                if (textureMapping[meshName]) {
                    texturePath = textureMapping[meshName];
                    matchSource = `Mesh自身 "${meshName}"`;
                }

                if (!texturePath && mesh.parent) {
                    let currentParent = mesh.parent;
                    let level = 1;

                    while (currentParent && level <= 3) {
                        const parentName = currentParent.name;

                        if (parentName && textureMapping[parentName]) {
                            texturePath = textureMapping[parentName];
                            matchSource = `父级${level}?"${parentName}"`;
                            break;
                        }

                        currentParent = currentParent.parent;
                        level++;
                    }
                }

                if (texturePath) {
                    applyTasks.push({
                        mesh,
                        texturePath,
                        matchSource
                    });
                }
            }

            const uniqueTexturePaths = [...new Set(applyTasks.map((item) => item.texturePath))];
            const preloadResults = await Promise.allSettled(
                uniqueTexturePaths.map((texturePath) => this.loadBakeTexture(texturePath, flipY))
            );

            preloadResults.forEach((result) => {
                if (result.status === 'rejected') {
                    // eslint-disable-next-line no-console
                    console.error('纹理加载失败:', result.reason);
                }
            });

            let appliedCount = 0;
            const chunkSize = Math.max(20, Number(this.config.bakedLighting?.applyChunkSize) || 48);
            for (let index = 0; index < applyTasks.length; index += chunkSize) {
                const chunk = applyTasks.slice(index, index + chunkSize);
                chunk.forEach(({ mesh, texturePath }) => {
                    const texture = this.bakedTextureCache.get(texturePath);
                    if (!texture) return;
                    this.applyTextureToMesh({
                        mesh,
                        texture,
                        texturePath,
                        mode,
                        intensity,
                        channel,
                        IndependentMaterial
                    });
                    appliedCount++;
                });
                if (index + chunkSize < applyTasks.length) {
                    await this.waitForNextFrame();
                }
            }

            if (this.performanceBatchState?.mergedMesh) {
                this.markPerformanceMaterialsDirty(true);
                this.syncPerformanceBatchMatrices(false);
            }

            // English comment.
            this.emit('bakedLightingApplied', { appliedCount, mode, intensity });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('应用烘焙光照失败:', error);
            this.emit('bakedLightingError', { error: error.message });
        }
    }

    /**
     * English comment.
     */
    async loadBakeTexture(texturePath, flipY = false) {
        if (this.bakedTextureCache.has(texturePath)) {
            return this.bakedTextureCache.get(texturePath);
        }

        if (this.bakedTextureLoadPromises.has(texturePath)) {
            return this.bakedTextureLoadPromises.get(texturePath);
        }

        const loadPromise = new Promise((resolve, reject) => {
            this.textureLoader.load(
                texturePath,
                (texture) => {
                    texture.flipY = flipY;
                    texture.colorSpace = THREE.SRGBColorSpace;
                    this.bakedTextureCache.set(texturePath, texture);
                    this.bakedTextureLoadPromises.delete(texturePath);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    this.bakedTextureLoadPromises.delete(texturePath);
                    // eslint-disable-next-line no-console
                    console.error(`纹理加载失败: ${texturePath}`, error);
                    reject(new Error(`纹理加载失败: ${texturePath} - ${error.message}`));
                }
            );
        });

        this.bakedTextureLoadPromises.set(texturePath, loadPromise);
        return loadPromise;
    }

    waitForNextFrame() {
        return new Promise((resolve) => {
            const raf = globalThis.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
            raf(() => resolve());
        });
    }

    buildBakedMaterialCacheKey(mesh, texturePath, mode, intensity, channel, IndependentMaterial) {
        const originalMaterial = this.originalMaterials.get(mesh.uuid) || mesh.material;
        const baseKey = [
            originalMaterial?.uuid || 'material',
            texturePath || '',
            mode || 'map',
            intensity ?? 1,
            channel ?? 1
        ].join('|');

        return IndependentMaterial ? `${baseKey}|mesh:${mesh.uuid}` : baseKey;
    }

    getOrCreateBakedMaterial({ mesh, texture, texturePath, mode, intensity, channel = 1, IndependentMaterial }) {
        const originalMaterial = this.originalMaterials.get(mesh.uuid) || mesh.material;
        const cacheKey = this.buildBakedMaterialCacheKey(mesh, texturePath, mode, intensity, channel, IndependentMaterial);

        if (this.bakedMaterialCache.has(cacheKey)) {
            return this.bakedMaterialCache.get(cacheKey);
        }

        const material = originalMaterial.clone();
        texture.channel = channel;

        if (mode === 'lightMap') {
            material.lightMap = texture;
            material.lightMapIntensity = intensity;
        } else if (mode === 'bake') {
            handleBake({ material, texture, intensity });
        } else {
            material.map = texture;
        }

        material.needsUpdate = true;
        this.bakedMaterialCache.set(cacheKey, material);
        return material;
    }

    /**
     * English comment.
     */
    applyTextureToMesh({ mesh, texture, texturePath, mode, intensity, channel = 1, IndependentMaterial }) {
        if (!this.originalMaterials.has(mesh.uuid)) {
            this.originalMaterials.set(mesh.uuid, mesh.material);
        }

        mesh.material = this.getOrCreateBakedMaterial({
            mesh,
            texture,
            texturePath,
            mode,
            intensity,
            channel,
            IndependentMaterial
        });
        mesh.material.needsUpdate = true;
        if (mesh.userData?.[BATCH_PROXY_KEY]) {
            this.markPerformanceMaterialsDirty(true);
        }
    }

    /**
     * English comment.
     */
    updateBakedIntensity(intensity) {
        if (!this.model) return;

        this.getMeshListSnapshot().forEach((child) => {
            if (child.material.lightMap) {
                child.material.lightMapIntensity = intensity;
                child.material.needsUpdate = true;
            }
        });
        if (this.performanceBatchState?.mergedMesh) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false);
        }
    }

    /**
     * English comment.
     */
    removeBakedLighting() {
        if (!this.model) return;

        let removedCount = 0;

        this.getMeshListSnapshot().forEach((child) => {
            const originalMaterial = this.originalMaterials.get(child.uuid);
            if (originalMaterial) {
                child.material = originalMaterial;
                removedCount++;
            }
        });

        // English comment.
        this.originalMaterials.clear();
        this.bakedMaterialCache.forEach((material) => material?.dispose?.());
        this.bakedMaterialCache.clear();

        if (this.performanceBatchState?.mergedMesh) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false);
        }

        // English comment.
        this.emit('bakedLightingRemoved', { removedCount });
    }

    /**
     * English comment.
     */
    async handleBakedLightingConfigUpdate(bakedLightingConfig) {
        if (!this.model) {
            // eslint-disable-next-line no-console
            console.warn('[ModelLoader] 模型未加载，无法更新烘焙光照');
            return;
        }

        if (bakedLightingConfig?.disableInEditor === true && this.isEditorRuntime()) {
            this.removeBakedLighting();
            // eslint-disable-next-line no-console
            console.log('[ModelLoader] 编辑态已按配置跳过烘焙贴图加载');
            return;
        }

        // eslint-disable-next-line no-console
        console.log('[ModelLoader] 更新烘焙光照配置:', bakedLightingConfig);

        // English comment.
        if (!bakedLightingConfig.enabled) {
            this.removeBakedLighting();
            // eslint-disable-next-line no-console
            console.log('[ModelLoader] 烘焙光照已禁用并移除');
            return;
        }

        const { textureMapping, mode, intensity, channel, flipY, IndependentMaterial } = bakedLightingConfig;

        this.removeBakedLighting();

        // English comment.
        try {
            await this.applyBakedLighting(textureMapping || {}, {
                mode: mode || 'bake',
                intensity: intensity || 1.0,
                channel: channel !== undefined ? channel : 1,
                flipY: flipY || false,
                IndependentMaterial: IndependentMaterial !== undefined ? IndependentMaterial : true
            });

            // eslint-disable-next-line no-console
            console.log('[ModelLoader] 烘焙光照配置已更新并应用');

            // English comment.
            this.emit('bakedLightingConfigUpdated', bakedLightingConfig);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[ModelLoader] 更新烘焙光照失败:', error);
            this.emit('bakedLightingError', { error: error.message });
        }
    }

    /**
     * English comment.
     */
    _resolveTarget(target) {
        if (!this.model) {
            // eslint-disable-next-line no-console
            console.warn('ModelLoader: model not loaded');
            return null;
        }

        // English comment.
        if (typeof target === 'string') {
            let foundObject = null;
            this.model.traverse((child) => {
                if (child.name === target && !foundObject) {
                    foundObject = child;
                }
            });

            if (!foundObject) {
                // eslint-disable-next-line no-console
                console.warn(`ModelLoader: target "${target}" not found`);
            }

            return foundObject;
        }

        // English comment.
        if (target && (target.isMesh || target.isGroup || target.isObject3D)) {
            return target;
        }

        // eslint-disable-next-line no-console
        console.warn('ModelLoader: invalid target');
        return null;
    }

    /**
     * English comment.
     */
    _collectMeshes(targetObject) {
        const meshes = [];
        const isMeshLike = (object) => object?.isMesh || object?.userData?.[BATCH_PROXY_KEY] !== undefined;

        if (isMeshLike(targetObject)) {
            meshes.push(targetObject);
        } else {
            targetObject.traverse((child) => {
                if (isMeshLike(child)) {
                    meshes.push(child);
                }
            });
        }

        return meshes;
    }

    /**
     * English comment.
     */
    enableBaking(target, options = {}) {
        const { lightMapIntensity = 1.0, mode = 'lightMap' } = options;

        const targetObject = this._resolveTarget(target);
        if (!targetObject) {
            return {
                success: false,
                affectedCount: 0,
                message: 'Target not found or invalid'
            };
        }

        const meshes = this._collectMeshes(targetObject);

        if (meshes.length === 0) {
            return {
                success: false,
                affectedCount: 0,
                message: 'No mesh found under target'
            };
        }

        let enabledCount = 0;

        meshes.forEach((mesh) => {
            const texturePath = this.config.bakedLighting.textureMapping[mesh.name];

            if (!texturePath) {
                // eslint-disable-next-line no-console
                console.warn(`ModelLoader: Mesh "${mesh.name}" 没有配置烘焙贴图路径`);
                return;
            }

            // English comment.
            if (!this.bakedTextureCache.has(texturePath)) {
                // eslint-disable-next-line no-console
                console.warn(`ModelLoader: 烘焙贴图 "${texturePath}" 尚未加载，请先调用 applyBakedLighting()`);
                return;
            }

            const texture = this.bakedTextureCache.get(texturePath);

            // English comment.
            if (!this.originalMaterials.has(mesh.uuid)) {
                this.originalMaterials.set(mesh.uuid, mesh.material.clone());
            }

            // English comment.
            if (mode === 'lightMap') {
                mesh.material.lightMap = texture;
                mesh.material.lightMapIntensity = lightMapIntensity;
            } else if (mode === 'map') {
                mesh.material.map = texture;
            }

            mesh.material.needsUpdate = true;
            enabledCount++;
        });

        if (this.performanceBatchState?.mergedMesh && enabledCount > 0) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false);
        }

        const targetName = typeof target === 'string' ? target : targetObject.name || 'unnamed-target';

        return {
            success: enabledCount > 0,
            affectedCount: enabledCount,
            message: `Enabled baked texture for ${enabledCount} mesh(es) under "${targetName}"`
        };
    }

    /**
     * English comment.
     */
    disableBaking(target) {
        const targetObject = this._resolveTarget(target);
        if (!targetObject) {
            return {
                success: false,
                affectedCount: 0,
                message: 'Target not found or invalid'
            };
        }

        const meshes = this._collectMeshes(targetObject);

        if (meshes.length === 0) {
            return {
                success: false,
                affectedCount: 0,
                message: 'No mesh found under target'
            };
        }

        let disabledCount = 0;

        meshes.forEach((mesh) => {
            // English comment.
            const originalMaterial = this.originalMaterials.get(mesh.uuid);

            if (originalMaterial) {
                // English comment.
                if (mesh.material && mesh.material !== originalMaterial) {
                    mesh.material.dispose();
                }

                // English comment.
                mesh.material = originalMaterial;
                mesh.material.needsUpdate = true;

                // English comment.
                this.originalMaterials.delete(mesh.uuid);

                disabledCount++;
            }
        });

        if (this.performanceBatchState?.mergedMesh && disabledCount > 0) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false);
        }

        const targetName = typeof target === 'string' ? target : targetObject.name || 'unnamed-target';

        return {
            success: disabledCount > 0,
            affectedCount: disabledCount,
            message: `Disabled baked texture for ${disabledCount} mesh(es) under "${targetName}"`
        };
    }

    /**
     * English comment.
     */
    updateBaking(target, options = {}) {
        const { lightMapIntensity } = options;

        if (lightMapIntensity === undefined) {
            return {
                success: false,
                affectedCount: 0,
                message: 'Missing required option: lightMapIntensity'
            };
        }

        const targetObject = this._resolveTarget(target);
        if (!targetObject) {
            return {
                success: false,
                affectedCount: 0,
                message: 'Target not found or invalid'
            };
        }

        const meshes = this._collectMeshes(targetObject);

        if (meshes.length === 0) {
            return {
                success: false,
                affectedCount: 0,
                message: 'No mesh found under target'
            };
        }

        let updatedCount = 0;

        meshes.forEach((mesh) => {
            if (mesh.material.lightMap) {
                mesh.material.lightMapIntensity = lightMapIntensity;
                mesh.material.needsUpdate = true;
                updatedCount++;
            }
        });

        if (this.performanceBatchState?.mergedMesh && updatedCount > 0) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false);
        }

        const targetName = typeof target === 'string' ? target : targetObject.name || 'unnamed-target';

        return {
            success: updatedCount > 0,
            affectedCount: updatedCount,
            message: `Updated baked texture parameters for ${updatedCount} mesh(es) under "${targetName}"`
        };
    }

    /**
      *
      *
     * @returns {Promise<void>}
     */
    async updateConfig(newConfig) {
        // English comment.
        const oldUrl = this.config.url;
        const oldPerformanceMode = this.isPerformanceModeEnabled();
        const previousBakedLightingConfig = deepMerge({}, this.config.bakedLighting || {});

        // English comment.
        this.config = deepMerge(this.config, newConfig || {});

        if (newConfig.material !== undefined || newConfig.mesh !== undefined) {
            this.applyMeshAndMaterialConfig();
        }

        // English comment.
        if (newConfig.bakedLighting !== undefined) {
            await this.handleBakedLightingConfigUpdate(
                deepMerge(previousBakedLightingConfig, newConfig.bakedLighting || {})
            );
        }

        const urlChanged = newConfig.url !== undefined && newConfig.url !== oldUrl;
        const performanceModeChanged = (
            Object.prototype.hasOwnProperty.call(newConfig, 'performanceMode') &&
            oldPerformanceMode !== this.isPerformanceModeEnabled()
        );

        if (urlChanged || performanceModeChanged) {
            // eslint-disable-next-line no-console
            console.log('[ModelLoader] Reloading model after config change', {
                urlChanged,
                performanceModeChanged,
                previousUrl: oldUrl,
                nextUrl: this.config.url,
                performanceMode: this.config.performanceMode === true
            });

            const previousModel = this.model;

            if (previousModel) {
                this.disposeModelResources(previousModel);
                this.model = null;
            }
            this.modelData = null;
            this.gltf = null;
            this.animations = [];
            this.performanceOptimizationState = this.createPerformanceOptimizationState();
            this.rebuildMeshCache();

            // English comment.
            if (this.mixer) {
                this.scene.animationManager.remove(previousModel);
                this.mixer = null;
            }

            // English comment.
            await this.loadModel();
        } else {
            if (
                newConfig.scale !== undefined ||
                newConfig.sizeMode !== undefined ||
                newConfig.targetSize !== undefined ||
                newConfig.position !== undefined ||
                newConfig.rotation !== undefined
            ) {
                this.applyTransform();
            }

            if (newConfig.castShadow !== undefined || newConfig.receiveShadow !== undefined) {
                this.applyShadow();
            }

            if (
                newConfig.interactiveMeshes !== undefined ||
                newConfig.eventInteractiveMeshes !== undefined ||
                performanceModeChanged
            ) {
                this.setupInteractiveObjects();
            }

            if (
                newConfig.freezeWorldMatrix !== undefined ||
                newConfig.subtreeActivation !== undefined ||
                newConfig.mesh !== undefined
            ) {
                this.applySubtreeActivation();
                this.applyFreezeWorldMatrix();
            }

            if (newConfig.autoPreloadDraco === true && this.coreLoader?.preloadDraco) {
                this.coreLoader.preloadDraco().catch(() => {});
            }
        }

        // English comment.
        this.emit('configUpdated', this.config);
    }

    /**
      *
     * @returns {{center:[number,number,number], size:[number,number,number], maxDim:number, min:[number,number,number], max:[number,number,number]}|null}
     */
    getBounds() {
        if (!this.model) return null;

        const box = new THREE.Box3().setFromObject(this.model);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);

        return {
            center: [center.x, center.y, center.z],
            size: [size.x, size.y, size.z],
            maxDim,
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z]
        };
    }

    measureModelBounds() {
        if (!this.model) return null;

        const box = new THREE.Box3().setFromObject(this.model);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);

        return {
            center: [center.x, center.y, center.z],
            size: [size.x, size.y, size.z],
            maxDim,
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z]
        };
    }

    /**
     * English comment.
     */
    getGeometryStats() {
        if (!this.model) return null;

        let vertices = 0;
        let triangles = 0;

        if (this.performanceBatchState) {
            this.performanceBatchState.sourceMeshRecords.forEach((record) => {
                vertices += Number(record.vertexCount) || 0;
                triangles += (Number(record.indexCount) || 0) / 3;
            });

            return {
                vertices: Math.floor(vertices),
                triangles: Math.floor(triangles)
            };
        }

        const meshes = this.getMeshListSnapshot();

        meshes.forEach((child) => {
            if (!child.geometry) return;
            const geometry = child.geometry;
            const instanceMultiplier = child.isInstancedMesh ? Number(child.count || 0) || 1 : 1;

            const positionAttr = geometry.attributes?.position;
            if (positionAttr?.count) {
                vertices += positionAttr.count * instanceMultiplier;
            }

            const indexAttr = geometry.index;
            if (indexAttr?.count) {
                triangles += (indexAttr.count / 3) * instanceMultiplier;
            } else if (positionAttr?.count) {
                triangles += (positionAttr.count / 3) * instanceMultiplier;
            }
        });

        return {
            vertices: Math.floor(vertices),
            triangles: Math.floor(triangles)
        };
    }


    /**
     * English comment.
     */
    applyMeshAndMaterialConfig() {
        if (!this.model) return;

        const { material: materialConfig, mesh: meshConfig } = this.config;
        const meshNameMap = this.meshNameMapCache;

        // English comment.
        if (meshConfig && typeof meshConfig === 'object') {
            Object.entries(meshConfig).forEach(([meshName, config]) => {
                const mesh = meshNameMap.get(meshName);
                if (!mesh) return;

                // English comment.
                if (config.position) {
                    mesh.position.set(
                        config.position.x ?? mesh.position.x,
                        config.position.y ?? mesh.position.y,
                        config.position.z ?? mesh.position.z
                    );
                }

                // English comment.
                if (config.rotation) {
                    mesh.rotation.set(
                        config.rotation.x ?? mesh.rotation.x,
                        config.rotation.y ?? mesh.rotation.y,
                        config.rotation.z ?? mesh.rotation.z
                    );
                }

                // English comment.
                if (config.scale) {
                    mesh.scale.set(
                        config.scale.x ?? mesh.scale.x,
                        config.scale.y ?? mesh.scale.y,
                        config.scale.z ?? mesh.scale.z
                    );
                }

                if (config.visible !== undefined) {
                    if (this.setBatchProxyVisible(meshName, config.visible)) {
                        mesh.visible = false;
                    } else {
                        mesh.visible = config.visible;
                    }
                }

                // English comment.
                if (config.material && materialConfig && materialConfig[config.material]) {
                    this.applyMaterialToMesh(mesh, materialConfig[config.material]);
                }
            });
        }

        // English comment.
        if (materialConfig && typeof materialConfig === 'object') {
            this.getAllMeshes().forEach((child) => {
                if (!child.material) return;
                const materialName = child.material.name || child.name;
                if (materialConfig[materialName]) {
                    this.applyMaterialToMesh(child, materialConfig[materialName]);
                }
            });
        }

        if (this.performanceBatchState?.mergedMesh) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(true);
        }
        this.enforcePerformanceProxyHidden();
    }

    forEachMeshMaterial(mesh, callback) {
        if (!mesh || !mesh.material || typeof callback !== 'function') return;

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
                if (mat) callback(mat);
            });
            return;
        }

        callback(mesh.material);
    }

    normalizeMaterialBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true') return true;
            if (normalized === 'false') return false;
        }
        return Boolean(value);
    }

    normalizeMaterialNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    resolveMaterialSide(value) {
        if (typeof value === 'number') return value;
        const map = {
            FrontSide: THREE.FrontSide,
            BackSide: THREE.BackSide,
            DoubleSide: THREE.DoubleSide,
            frontside: THREE.FrontSide,
            backside: THREE.BackSide,
            doubleside: THREE.DoubleSide,
            front: THREE.FrontSide,
            back: THREE.BackSide,
            double: THREE.DoubleSide
        };
        const key = String(value || '').trim();
        return map[key] ?? map[key.toLowerCase()];
    }

    /**
     * English comment.
     */
    applyMaterialToMesh(mesh, materialConfig) {
        if (!mesh || !mesh.material) return;

        this.forEachMeshMaterial(mesh, (material) => {
            if (!material) return;

            if (materialConfig.color !== undefined && material.color?.set) {
                material.color.set(materialConfig.color);
            }

            if (materialConfig.transparent !== undefined) {
                material.transparent = this.normalizeMaterialBoolean(materialConfig.transparent);
            }

            if (materialConfig.opacity !== undefined) {
                material.opacity = this.normalizeMaterialNumber(materialConfig.opacity, material.opacity ?? 1);
                if (material.opacity < 1) {
                    material.transparent = true;
                }
            }

            if (materialConfig.emissive !== undefined && material.emissive?.set) {
                material.emissive.set(materialConfig.emissive);
            }

            if (materialConfig.emissiveIntensity !== undefined && material.emissiveIntensity !== undefined) {
                material.emissiveIntensity = this.normalizeMaterialNumber(
                    materialConfig.emissiveIntensity,
                    material.emissiveIntensity
                );
            }

            if (materialConfig.metalness !== undefined && material.metalness !== undefined) {
                material.metalness = this.normalizeMaterialNumber(materialConfig.metalness, material.metalness);
            }

            if (materialConfig.roughness !== undefined && material.roughness !== undefined) {
                material.roughness = this.normalizeMaterialNumber(materialConfig.roughness, material.roughness);
            }

            if (materialConfig.side !== undefined) {
                const side = this.resolveMaterialSide(materialConfig.side);
                if (side !== undefined) {
                    material.side = side;
                }
            }

            if (materialConfig.wireframe !== undefined) {
                material.wireframe = this.normalizeMaterialBoolean(materialConfig.wireframe);
            }

            if (materialConfig.depthWrite !== undefined) {
                material.depthWrite = this.normalizeMaterialBoolean(materialConfig.depthWrite);
            }

            if (materialConfig.depthTest !== undefined) {
                material.depthTest = this.normalizeMaterialBoolean(materialConfig.depthTest);
            }

            if (materialConfig.alphaTest !== undefined && material.alphaTest !== undefined) {
                material.alphaTest = this.normalizeMaterialNumber(materialConfig.alphaTest, material.alphaTest);
            }

            if (materialConfig.envMapIntensity !== undefined && material.envMapIntensity !== undefined) {
                material.envMapIntensity = this.normalizeMaterialNumber(
                    materialConfig.envMapIntensity,
                    material.envMapIntensity
                );
            }

            if (materialConfig.lightMapIntensity !== undefined && material.lightMapIntensity !== undefined) {
                material.lightMapIntensity = this.normalizeMaterialNumber(
                    materialConfig.lightMapIntensity,
                    material.lightMapIntensity
                );
            }

            material.needsUpdate = true;
        });

        const record = mesh?.userData?.[BATCH_PROXY_KEY];
        if (record && this.performanceBatchState?.mergedMesh) {
            this.markPerformanceMaterialsDirty(true);
        }
    }

    normalizeActionStringList(value) {
        if (Array.isArray(value)) {
            return value
                .flatMap((item) => this.normalizeActionStringList(item))
                .map((item) => String(item || '').trim())
                .filter(Boolean);
        }

        if (typeof value === 'string') {
            return value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        }

        if (value === null || value === undefined) return [];
        return [String(value).trim()].filter(Boolean);
    }

    resolveMeshActionTargetNames(targets = {}) {
        const targetConfig = (
            typeof targets === 'string' ||
            Array.isArray(targets) ||
            targets === null ||
            targets === undefined
        )
            ? { meshNames: targets }
            : targets;

        if (targetConfig?.mode === 'all' || targetConfig?.all === true) {
            return this.getMeshNames();
        }

        const names = new Set();
        [
            targetConfig?.meshName,
            targetConfig?.name,
            targetConfig?.target,
            targetConfig?.meshNames,
            targetConfig?.names,
            targetConfig?.targets
        ].forEach((value) => {
            this.normalizeActionStringList(value).forEach((name) => names.add(name));
        });

        const nodePaths = this.normalizeActionStringList(
            targetConfig?.nodePaths || targetConfig?.nodePath || targetConfig?.objectPaths || targetConfig?.objectPath
        );
        if (nodePaths.length > 0) {
            this.getMeshNamesForNodePaths(nodePaths, targetConfig?.includeChildren !== false)
                .forEach((name) => names.add(name));
        }

        return [...names].filter((name) => this.getMeshByName(name));
    }

    resolveMeshActionTargets(targets = {}) {
        const meshNames = this.resolveMeshActionTargetNames(targets);
        const meshes = [];
        const records = [];
        const seenMeshes = new Set();
        const seenRecords = new Set();

        meshNames.forEach((meshName) => {
            const mesh = this.getMeshByName(meshName);
            if (!mesh || seenMeshes.has(mesh.uuid || meshName)) return;

            seenMeshes.add(mesh.uuid || meshName);
            meshes.push(mesh);

            const record = mesh.userData?.[BATCH_PROXY_KEY] || this.getBatchProxyRecordByMeshName(meshName);
            const recordKey = record?.instanceId ?? record?.meshName;
            if (record && !seenRecords.has(recordKey)) {
                seenRecords.add(recordKey);
                records.push(record);
            }
        });

        return { meshNames: meshes.map((mesh) => mesh.name).filter(Boolean), meshes, records };
    }

    getMeshActionTargetsFromOptions(options = {}) {
        if (!isPlainObject(options)) return options;
        if (options.targets !== undefined) return options.targets;
        if (options.target !== undefined) return options.target;
        return {
            mode: options.targetMode || options.mode,
            meshName: options.meshName,
            meshNames: options.meshNames || options.names,
            nodePath: options.nodePath || options.objectPath,
            nodePaths: options.nodePaths || options.objectPaths,
            includeChildren: options.includeChildren
        };
    }

    normalizeActionNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : undefined;
    }

    normalizeActionVector3(value, options = {}) {
        const allowScalar = options.allowScalar === true;

        if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
            const number = this.normalizeActionNumber(value);
            if (number === undefined || !allowScalar) return null;
            return { x: number, y: number, z: number };
        }

        if (Array.isArray(value)) {
            const vector = {};
            const x = this.normalizeActionNumber(value[0]);
            const y = this.normalizeActionNumber(value[1]);
            const z = this.normalizeActionNumber(value[2]);
            if (x !== undefined) vector.x = x;
            if (y !== undefined) vector.y = y;
            if (z !== undefined) vector.z = z;
            return Object.keys(vector).length ? vector : null;
        }

        if (!isPlainObject(value)) return null;

        const vector = {};
        ['x', 'y', 'z'].forEach((axis) => {
            const number = this.normalizeActionNumber(value[axis]);
            if (number !== undefined) vector[axis] = number;
        });
        return Object.keys(vector).length ? vector : null;
    }

    normalizeTransformOperation(operation = 'set') {
        const normalized = String(operation || 'set').trim().toLowerCase();
        if (['add', 'increment', 'delta', 'relative'].includes(normalized)) return 'add';
        if (['multiply', 'mul', 'scale'].includes(normalized)) return 'multiply';
        return 'set';
    }

    normalizeRotationUnit(unit = 'deg') {
        const normalized = String(unit || 'deg').trim().toLowerCase();
        return ['rad', 'radian', 'radians'].includes(normalized) ? 'rad' : 'deg';
    }

    normalizeRotationVector(value, unit = 'deg') {
        const vector = this.normalizeActionVector3(value);
        if (!vector) return null;
        if (this.normalizeRotationUnit(unit) === 'rad') return vector;

        const converted = {};
        ['x', 'y', 'z'].forEach((axis) => {
            if (vector[axis] !== undefined) {
                converted[axis] = THREE.MathUtils.degToRad(vector[axis]);
            }
        });
        return converted;
    }

    applyVectorOperation(targetVector, value, operation = 'set') {
        if (!targetVector || !value) return false;
        let changed = false;

        ['x', 'y', 'z'].forEach((axis) => {
            const number = this.normalizeActionNumber(value[axis]);
            if (number === undefined) return;

            if (operation === 'add') {
                targetVector[axis] += number;
            } else if (operation === 'multiply') {
                targetVector[axis] *= number;
            } else {
                targetVector[axis] = number;
            }
            changed = true;
        });

        return changed;
    }

    syncMeshActionRecords(records = [], force = true) {
        if (!this.performanceBatchState) return;
        const validRecords = Array.isArray(records) ? records.filter(Boolean) : [];
        if (validRecords.length > 0) {
            this.syncPerformanceBatchMatrices(force, validRecords);
        } else {
            this.syncPerformanceBatchMatrices(force);
        }
        this.enforcePerformanceProxyHidden();
    }

    applyTransformToMesh(mesh, transform = {}, operation = 'set') {
        if (!mesh) return false;

        let changed = false;
        if (transform.position) {
            changed = this.applyVectorOperation(mesh.position, transform.position, operation) || changed;
        }
        if (transform.rotation) {
            changed = this.applyVectorOperation(mesh.rotation, transform.rotation, operation) || changed;
        }
        if (transform.scale) {
            changed = this.applyVectorOperation(mesh.scale, transform.scale, operation) || changed;
        }

        if (changed) {
            mesh.updateMatrix?.();
            mesh.updateMatrixWorld?.(true);
        }
        return changed;
    }

    setMeshTransform(options = {}) {
        const targetInfo = this.resolveMeshActionTargets(this.getMeshActionTargetsFromOptions(options));
        const operation = this.normalizeTransformOperation(options.operation || options.transformOperation || 'set');
        const rotationUnit = options.rotationUnit || options.unit || 'deg';
        const transform = {
            position: this.normalizeActionVector3(options.position),
            rotation: this.normalizeRotationVector(options.rotation, rotationUnit),
            scale: this.normalizeActionVector3(options.scale, { allowScalar: true })
        };

        let affectedCount = 0;
        targetInfo.meshes.forEach((mesh) => {
            if (this.applyTransformToMesh(mesh, transform, operation)) {
                affectedCount++;
            }
        });

        if (affectedCount > 0) {
            this.syncMeshActionRecords(targetInfo.records, true);
        }

        const payload = {
            meshNames: targetInfo.meshNames,
            transform,
            operation,
            affectedCount
        };
        this.emit('meshTransformUpdated', payload);

        return {
            success: affectedCount > 0,
            affectedCount,
            meshNames: targetInfo.meshNames
        };
    }

    setMeshPosition(options = {}) {
        return this.setMeshTransform({
            ...options,
            position: options.position ?? options.value
        });
    }

    setMeshRotation(options = {}) {
        return this.setMeshTransform({
            ...options,
            rotation: options.rotation ?? options.value,
            rotationUnit: options.rotationUnit || options.unit || 'deg'
        });
    }

    setMeshScale(options = {}) {
        return this.setMeshTransform({
            ...options,
            scale: options.scale ?? options.value
        });
    }

    setMeshesMaterial(options = {}) {
        const targetInfo = this.resolveMeshActionTargets(this.getMeshActionTargetsFromOptions(options));
        const materialProps = options.materialProps || options.material || options.props || {};

        if (!isPlainObject(materialProps)) {
            console.warn('ModelLoader: setMeshesMaterial requires materialProps object');
            return { success: false, affectedCount: 0, meshNames: [] };
        }

        let affectedCount = 0;
        targetInfo.meshes.forEach((mesh) => {
            if (!mesh?.material) return;
            this.applyMaterialToMesh(mesh, materialProps);
            affectedCount++;
        });

        if (affectedCount > 0 && this.performanceBatchState) {
            this.syncMeshActionRecords(targetInfo.records, false);
        }

        const payload = {
            meshNames: targetInfo.meshNames,
            materialProps,
            affectedCount
        };
        this.emit('meshMaterialUpdated', payload);

        return {
            success: affectedCount > 0,
            affectedCount,
            meshNames: targetInfo.meshNames
        };
    }

    updateMeshesMaterial(options = {}) {
        return this.setMeshesMaterial(options);
    }

    /**
     * English comment.
     */
    updateMeshMaterial(meshName, materialProps) {
        if (isPlainObject(meshName) && materialProps === undefined) {
            return this.setMeshesMaterial({
                ...meshName,
                targets: meshName.targets ?? meshName.target ?? {
                    meshName: meshName.meshName,
                    meshNames: meshName.meshNames,
                    nodePath: meshName.nodePath,
                    nodePaths: meshName.nodePaths,
                    includeChildren: meshName.includeChildren
                },
                materialProps: meshName.materialProps || meshName.material || meshName.props
            });
        }

        const mesh = this.getMeshByName(meshName);
        if (!mesh) {
            console.warn(`ModelLoader: Mesh "${meshName}" not found`);
            return;
        }

        this.applyMaterialToMesh(mesh, materialProps);
        const record = mesh.userData?.[BATCH_PROXY_KEY];
        if (record && this.performanceBatchState?.mergedMesh) {
            this.syncPerformanceBatchMatrices(true, [record]);
        }

        // English comment.
        this.emit('meshMaterialUpdated', { meshName, materialProps });
    }

    /**
     * English comment.
     */
    updateMeshTransform(meshName, transform) {
        if (isPlainObject(meshName) && transform === undefined) {
            return this.setMeshTransform(meshName);
        }

        const mesh = this.getMeshByName(meshName);
        if (!mesh) {
            console.warn(`ModelLoader: Mesh "${meshName}" not found`);
            return;
        }

        this.applyTransformToMesh(mesh, transform || {}, 'set');

        const record = mesh.userData?.[BATCH_PROXY_KEY];
        if (record && this.performanceBatchState?.mergedMesh) {
            this.syncPerformanceBatchMatrices(true, [record]);
        }

        // English comment.
        this.emit('meshTransformUpdated', { meshName, transform });
    }

    /**
     * English comment.
     */
    getMeshMaterialProps(meshName) {
        const mesh = this.getMeshByName(meshName);
        if (!mesh || !mesh.material) return null;

        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (!material) return null;
        const props = {
            color: material.color ? '#' + material.color.getHexString() : '#ffffff',
            transparent: material.transparent || false,
            opacity: material.opacity !== undefined ? material.opacity : 1.0,
            wireframe: material.wireframe || false,
            side: material.side,
            depthWrite: material.depthWrite !== undefined ? material.depthWrite : true,
            depthTest: material.depthTest !== undefined ? material.depthTest : true
        };

        if (material.metalness !== undefined) {
            props.metalness = material.metalness;
        }
        if (material.roughness !== undefined) {
            props.roughness = material.roughness;
        }
        if (material.emissive) {
            props.emissive = '#' + material.emissive.getHexString();
        }
        if (material.emissiveIntensity !== undefined) {
            props.emissiveIntensity = material.emissiveIntensity;
        }

        return props;
    }

    /**
     * English comment.
     */
    getMeshTransform(meshName) {
        const mesh = this.getMeshByName(meshName);
        if (!mesh) return null;
        const record = mesh.userData?.[BATCH_PROXY_KEY];

        return {
            position: {
                x: mesh.position.x,
                y: mesh.position.y,
                z: mesh.position.z
            },
            rotation: {
                x: mesh.rotation.x,
                y: mesh.rotation.y,
                z: mesh.rotation.z
            },
            scale: {
                x: mesh.scale.x,
                y: mesh.scale.y,
                z: mesh.scale.z
            },
            visible: record ? this.isBatchProxyRenderVisible(record) : mesh.visible
        };
    }

    /**
     * English comment.
     */
    getMeshesInfo() {
        if (!this.model) return [];

        return this.getMeshListSnapshot().map((child) => ({
            name: child.name || 'unnamed',
            uuid: child.uuid,
            materialName: child.material?.name || 'default',
            materialType: child.material?.type || 'unknown',
            visible: child.userData?.[BATCH_PROXY_KEY]
                ? this.isBatchProxyRenderVisible(child.userData[BATCH_PROXY_KEY])
                : child.visible,
            position: {
                x: child.position.x,
                y: child.position.y,
                z: child.position.z
            },
            rotation: {
                x: child.rotation.x,
                y: child.rotation.y,
                z: child.rotation.z
            },
            scale: {
                x: child.scale.x,
                y: child.scale.y,
                z: child.scale.z
            }
        }));
    }

    /**
     * English comment.
     */
    setMeshVisibility(meshName, visible) {
        if (isPlainObject(meshName) && visible === undefined) {
            const targetInfo = this.resolveMeshActionTargets(this.getMeshActionTargetsFromOptions(meshName));
            const nextVisible = meshName.visible !== false;
            let affectedCount = 0;

            targetInfo.meshNames.forEach((name) => {
                const record = this.getBatchProxyRecordByMeshName(name);
                if (record) {
                    record.proxyVisible = nextVisible;
                    if (record.mesh) {
                        record.mesh.visible = false;
                    }
                    affectedCount++;
                    return;
                }

                const mesh = this.getMeshByName(name);
                if (!mesh) return;
                mesh.visible = nextVisible;
                affectedCount++;
            });

            if (affectedCount > 0 && this.performanceBatchState?.mergedMesh) {
                this.syncPerformanceBatchMatrices(true, targetInfo.records);
            }

            this.emit('meshVisibilityChanged', {
                meshNames: targetInfo.meshNames,
                visible: nextVisible,
                affectedCount
            });
            return {
                success: affectedCount > 0,
                affectedCount,
                meshNames: targetInfo.meshNames
            };
        }

        if (this.setBatchProxyVisible(meshName, visible)) {
            this.emit('meshVisibilityChanged', { meshName, visible });
            return;
        }

        const mesh = this.getMeshByName(meshName);
        if (mesh) {
            mesh.visible = visible;
            this.emit('meshVisibilityChanged', { meshName, visible });
        }
    }

    hideMeshesExcept(options = {}) {
        const targets = this.getMeshActionTargetsFromOptions(options);
        const targetInfo = this.resolveMeshActionTargets(targets);
        const showSet = new Set(targetInfo.meshNames);

        if (showSet.size === 0) {
            return { success: false, affectedCount: 0, meshNames: [] };
        }

        let affectedCount = 0;
        if (this.performanceBatchState) {
            this.performanceBatchState.sourceMeshRecords.forEach((record) => {
                const visible = showSet.has(record.meshName);
                if (record.proxyVisible !== visible) affectedCount++;
                record.proxyVisible = visible;
                if (record.mesh) {
                    record.mesh.visible = false;
                }
            });
            this.syncPerformanceBatchMatrices(true);
        } else {
            this.getMeshListSnapshot().forEach((mesh) => {
                const visible = showSet.has(mesh.name);
                if (mesh.visible !== visible) affectedCount++;
                mesh.visible = visible;
            });
        }

        this.emit('meshVisibilityChanged', {
            meshNames: targetInfo.meshNames,
            visible: true,
            mode: 'hideMeshesExcept',
            affectedCount
        });

        return {
            success: true,
            affectedCount,
            meshNames: targetInfo.meshNames
        };
    }

    showOnlyMeshes(options = {}) {
        return this.hideMeshesExcept(options);
    }

    /**
     * English comment.
     */
    highlightMesh(meshName, color = '#ffff00') {
        const mesh = this.getMeshByName(meshName);
        if (!mesh || !mesh.material) return;

        // English comment.
        if (!mesh.userData._originalColor) {
            mesh.userData._originalColor = mesh.material.color.clone();
            mesh.userData._originalEmissive = mesh.material.emissive?.clone();
        }

        // English comment.
        if (mesh.material.emissive) {
            mesh.material.emissive = new THREE.Color(color);
            mesh.material.emissiveIntensity = 0.3;
        } else {
            mesh.material.color = new THREE.Color(color);
        }
        mesh.material.needsUpdate = true;
        if (mesh.userData?.[BATCH_PROXY_KEY]) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false, [mesh.userData[BATCH_PROXY_KEY]]);
        }
    }

    highlightAlarmMesh(meshName, options = {}) {
        const mesh = this.getMeshByName(meshName);
        if (!mesh || !mesh.material) return;

        const color = options.color || '#ff4d4f';
        const intensity = Number.isFinite(Number(options.intensity))
            ? Math.max(0, Number(options.intensity))
            : 0.6;

        const applyToMaterial = (material) => {
            if (!material) return;

            if (!mesh.userData._alarmOriginalMaterialState) {
                mesh.userData._alarmOriginalMaterialState = new WeakMap();
            }

            if (!mesh.userData._alarmOriginalMaterialState.has(material)) {
                mesh.userData._alarmOriginalMaterialState.set(material, {
                    color: material.color?.clone?.() || null,
                    emissive: material.emissive?.clone?.() || null,
                    emissiveIntensity: material.emissiveIntensity ?? 0,
                    opacity: material.opacity ?? 1
                });
            }

            if (material.emissive) {
                material.emissive = new THREE.Color(color);
                material.emissiveIntensity = intensity;
            } else if (material.color) {
                material.color = new THREE.Color(color);
            }

            if (options.blink) {
                material.transparent = true;
                material.opacity = 0.55;
            }

            material.needsUpdate = true;
        };

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(applyToMaterial);
        } else {
            applyToMaterial(mesh.material);
        }
        if (mesh.userData?.[BATCH_PROXY_KEY]) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false, [mesh.userData[BATCH_PROXY_KEY]]);
        }
    }

    /**
     * English comment.
     */
    unhighlightMesh(meshName) {
        const mesh = this.getMeshByName(meshName);
        if (!mesh || !mesh.material) return;

        // English comment.
        if (mesh.userData._originalColor) {
            mesh.material.color = mesh.userData._originalColor;
            delete mesh.userData._originalColor;
        }
        if (mesh.userData._originalEmissive && mesh.material.emissive) {
            mesh.material.emissive = mesh.userData._originalEmissive;
            mesh.material.emissiveIntensity = 0;
            delete mesh.userData._originalEmissive;
        }
        mesh.material.needsUpdate = true;
        if (mesh.userData?.[BATCH_PROXY_KEY]) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false, [mesh.userData[BATCH_PROXY_KEY]]);
        }
    }

    clearAlarmMeshHighlight(meshName) {
        const mesh = this.getMeshByName(meshName);
        if (!mesh || !mesh.material || !mesh.userData._alarmOriginalMaterialState) return;

        const restoreMaterial = (material) => {
            if (!material) return;
            const state = mesh.userData._alarmOriginalMaterialState.get(material);
            if (!state) return;

            if (state.color && material.color) {
                material.color.copy(state.color);
            }
            if (state.emissive && material.emissive) {
                material.emissive.copy(state.emissive);
                material.emissiveIntensity = state.emissiveIntensity ?? 0;
            } else if (material.emissive) {
                material.emissiveIntensity = state.emissiveIntensity ?? 0;
            }
            if (typeof state.opacity === 'number') {
                material.opacity = state.opacity;
            }
            material.needsUpdate = true;
        };

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(restoreMaterial);
        } else {
            restoreMaterial(mesh.material);
        }

        delete mesh.userData._alarmOriginalMaterialState;
        if (mesh.userData?.[BATCH_PROXY_KEY]) {
            this.markPerformanceMaterialsDirty(true);
            this.syncPerformanceBatchMatrices(false, [mesh.userData[BATCH_PROXY_KEY]]);
        }
    }

    clearAllAlarmMeshHighlights() {
        this.getMeshListSnapshot().forEach((mesh) => {
            if (mesh?.userData?._alarmOriginalMaterialState) {
                this.clearAlarmMeshHighlight(mesh.name);
            }
        });
    }

    /**
     * English comment.
     */
    isolateMesh(meshNames) {
        if (isPlainObject(meshNames)) {
            return this.hideMeshesExcept(meshNames);
        }

        const namesToShow = Array.isArray(meshNames) ? meshNames : [meshNames];
        if (this.performanceBatchState) {
            const showSet = new Set(namesToShow.map((name) => String(name || '').trim()).filter(Boolean));
            this.performanceBatchState.sourceMeshRecords.forEach((record) => {
                const visible = showSet.has(record.meshName);
                record.proxyVisible = visible;
                if (record.mesh) {
                    record.mesh.visible = false;
                }
                record.batchedMesh?.setVisibleAt?.(record.instanceId, this.isBatchProxyRenderVisible(record));
            });
            if (this.performanceBatchState.mergedMesh) {
                this.syncPerformanceBatchMatrices(true);
            }
            return;
        }

        this.getMeshListSnapshot().forEach((child) => {
            child.visible = namesToShow.includes(child.name);
        });
    }

    /**
      *
     */
    showAllMeshes() {
        if (this.performanceBatchState) {
            this.performanceBatchState.sourceMeshRecords.forEach((record) => {
                record.proxyVisible = true;
                if (record.mesh) {
                    record.mesh.visible = false;
                }
                record.batchedMesh?.setVisibleAt?.(record.instanceId, this.isBatchProxyRenderVisible(record));
            });
            if (this.performanceBatchState.mergedMesh) {
                this.syncPerformanceBatchMatrices(true);
            }
            return;
        }

        this.getMeshListSnapshot().forEach((child) => {
            child.visible = true;
        });
    }

    onUpdate(delta) {
        void delta;
        if (this.performanceBatchState?.mergedMesh) {
            return;
        }
        this.syncPerformanceBatchMatrices();
    }

    disposeModelResources(model) {
        if (!model) return;

        if (model === this.model) {
            this.disposePerformanceBatchState();
        }

        if (this.mixer && model === this.model) {
            this.scene.animationManager.remove(model);
            this.mixer = null;
            this.currentAction = null;
            this.currentAnimationName = null;
            this.isAnimationPlaying = false;
        }

        model.parent?.remove(model);
        model.traverse((child) => {
            if (!child?.isMesh) return;
            child.geometry?.dispose?.();
            if (Array.isArray(child.material)) {
                child.material.forEach((material) => material?.dispose?.());
            } else {
                child.material?.dispose?.();
            }
        });
    }

    /**
      *
     */
    onDispose() {
        this.clearAllAlarmMeshHighlights?.();
        if (this.mixer) {
            this.scene.animationManager.remove(this.model);
        }

        // English comment.
        if (this.bakedTextureCache) {
            this.bakedTextureCache.forEach((texture) => {
                texture.dispose();
            });
            this.bakedTextureCache.clear();
        }
        if (this.bakedTextureLoadPromises) {
            this.bakedTextureLoadPromises.clear();
        }
        if (this.bakedMaterialCache) {
            this.bakedMaterialCache.forEach((material) => material?.dispose?.());
            this.bakedMaterialCache.clear();
        }

        if (this.originalMaterials) {
            this.originalMaterials.clear();
        }

        this.loadVersion += 1;
        this.isLoading = false;
        this.loadProgress = 0;
        this.loadError = null;
        if (this.pendingBakedLightingTimer) {
            globalThis.clearTimeout?.(this.pendingBakedLightingTimer);
            this.pendingBakedLightingTimer = null;
        }

        if (this.model) {
            this.disposeModelResources(this.model);
            this.model = null;
        }
        this.rebuildMeshCache();
    }
}

export default ModelLoader;
