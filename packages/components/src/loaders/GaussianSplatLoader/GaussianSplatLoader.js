import * as THREE from 'three';
import { Component } from '@w3d/core';
import {
    DropInViewer,
    LogLevel,
    RenderMode,
    SceneFormat,
    SceneRevealMode,
    SplatRenderMode
} from '@mkkellogg/gaussian-splats-3d';

const FORMAT_MAP = {
    splat: SceneFormat.Splat,
    ksplat: SceneFormat.KSplat,
    ply: SceneFormat.Ply,
    spz: SceneFormat.Spz
};

const MIN_PROXY_SIZE = 0.01;

const RELOAD_KEYS = new Set([
    'url',
    'format',
    'antialiased',
    'kernel2DSize',
    'gpuAcceleratedSort',
    'integerBasedSort',
    'freeIntermediateSplatData',
    'optimizeSplatData',
    'progressiveLoad',
    'splatAlphaRemovalThreshold',
    'renderMode',
    'sphericalHarmonicsDegree'
]);

/**
 * Loader module component that displays Gaussian splat assets with configurable transform and render behavior.
 */
export class GaussianSplatLoader extends Component {
    static defaultConfig = {
        url: '',
        format: '',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        splatScale: 1,
        pointCloudMode: false,
        antialiased: false,
        kernel2DSize: 0.3,
        gpuAcceleratedSort: false,
        sharedMemoryForWorkers: false,
        integerBasedSort: true,
        progressiveLoad: false,
        freeIntermediateSplatData: false,
        optimizeSplatData: true,
        focalAdjustment: 1.0,
        splatAlphaRemovalThreshold: 1,
        renderMode: '3d',
        sphericalHarmonicsDegree: 0
    };

    async onMounted() {
        this.dropInViewer = null;
        this.object3d = null;
        this.splatMesh = null;
        this.interactiveProxy = null;
        this.interactiveObjects = [];
        this.currentLoadTask = null;
        this._viewerReady = false;
        this.config.gpuAcceleratedSort = false;
        this.config.sharedMemoryForWorkers = false;

        const renderer = this.scene?.renderer?.instance;
        if (renderer?.capabilities && renderer.capabilities.isWebGL2 !== true) {
            console.warn('GaussianSplatLoader: WebGL2 is not available, splat rendering may fail');
        }
        if (globalThis?.crossOriginIsolated !== true) {
            console.warn('GaussianSplatLoader: crossOriginIsolated=false, SharedArrayBuffer worker path will be disabled');
        }

        if (!this.config.url) {
            console.warn('GaussianSplatLoader: url is required');
            return;
        }

        try {
            await this.reload();
        } catch (error) {
            // Catch so ComponentManager.add() can still register the component.
            // The error is already logged & emitted inside reload().
            console.warn('GaussianSplatLoader: initial load failed (component still registered)', error);
        }
    }

    onUpdate() {
        if (!this.dropInViewer) return;
        const viewer = this.dropInViewer.viewer;
        if (!viewer) return;
        const renderer = this.scene?.renderer?.instance;
        const camera = this.scene?.camera?.instance;
        if (!renderer || !camera) return;
        // callbackMesh.onBeforeRender also triggers this during the render pass,
        // but calling it here in the update phase is more robust: it guarantees
        // init() runs, uniforms are computed, and the sort worker receives camera
        // data even if the callbackMesh is somehow skipped.
        viewer.update(renderer, camera);
    }

    normalizeFormat(value = '') {
        const format = String(value || '').trim().toLowerCase().replace(/^\./, '');
        return FORMAT_MAP[format] !== undefined ? format : '';
    }

    inferFormatFromUrl(url = '') {
        const clean = String(url || '').split('?')[0].split('#')[0].toLowerCase();
        const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1) : '';
        return this.normalizeFormat(ext);
    }

    resolveSceneFormat() {
        const format = this.normalizeFormat(this.config.format) || this.inferFormatFromUrl(this.config.url);
        return format ? FORMAT_MAP[format] : undefined;
    }

    resolveViewerOptions() {
        // Editor environment is not guaranteed to be cross-origin isolated.
        // Force-disable SharedArrayBuffer / GPU sort paths to avoid worker DataCloneError.
        const safeWorkerMode = {
            gpuAcceleratedSort: false,
            sharedMemoryForWorkers: false,
            enableSIMDInSort: false
        };

        // NOTE: DropInViewer constructor ALWAYS overrides options.camera = undefined
        // and options.renderer = undefined. Renderer/camera reach the Viewer via
        // updateForDropInMode(renderer, camera) called inside viewer.update().
        // sceneRevealMode is NOT reset by DropInViewer and passes through correctly.
        return {
            ...safeWorkerMode,
            integerBasedSort: this.config.integerBasedSort !== false,
            antialiased: this.config.antialiased === true,
            kernel2DSize: Number(this.config.kernel2DSize ?? 0.3) || 0.3,
            freeIntermediateSplatData: this.config.freeIntermediateSplatData === true,
            optimizeSplatData: this.config.optimizeSplatData !== false,
            sphericalHarmonicsDegree: Math.max(0, Math.min(2, Number(this.config.sphericalHarmonicsDegree ?? 0) || 0)),
            focalAdjustment: Number(this.config.focalAdjustment ?? 1) || 1,
            renderMode: RenderMode.Always,
            logLevel: LogLevel.Info,
            // SceneRevealMode.Instant skips the gradual distance-based fade-in
            // (vColor.a *= distanceLoadFadeInFactor in the vertex shader).
            // With Default mode, visibleRegionFadeStartRadius starts at 0 and
            // are completely transparent for the first ~381 frames (~6 seconds
            // at 60fps). In an editor context, show all splats immediately.
            sceneRevealMode: SceneRevealMode.Instant,
            splatRenderMode: this.config.renderMode === '2d'
                ? SplatRenderMode.TwoD
                : SplatRenderMode.ThreeD
        };
    }

    enforceSafeWorkerMode() {
        const viewer = this.dropInViewer?.viewer;
        if (!viewer) return;

        viewer.sharedMemoryForWorkers = false;
        viewer.gpuAcceleratedSort = false;
        viewer.enableSIMDInSort = false;
    }

    resolveLoadOptions() {
        const resolvedFormat = this.resolveSceneFormat();
        const options = {
            showLoadingUI: false,
            progressiveLoad: this.config.progressiveLoad === true,
            splatAlphaRemovalThreshold: Math.max(0, Math.min(255, Number(this.config.splatAlphaRemovalThreshold ?? 1) || 1)),
            onProgress: (percent) => {
                const normalized = percent > 1 ? percent / 100 : percent;
                this.emit('loadProgress', {
                    progress: Math.max(0, Math.min(1, normalized))
                });
            }
        };

        if (resolvedFormat !== undefined) {
            options.format = resolvedFormat;
        }

        return options;
    }

    applyTransform() {
        const position = Array.isArray(this.config.position) ? this.config.position : [0, 0, 0];
        const rotation = Array.isArray(this.config.rotation) ? this.config.rotation : [0, 0, 0];
        const scaleValue = this.config.scale;

        this.componentScene.position.set(
            Number(position[0] ?? 0) || 0,
            Number(position[1] ?? 0) || 0,
            Number(position[2] ?? 0) || 0
        );
        this.componentScene.rotation.set(
            Number(rotation[0] ?? 0) || 0,
            Number(rotation[1] ?? 0) || 0,
            Number(rotation[2] ?? 0) || 0
        );

        if (Array.isArray(scaleValue)) {
            this.componentScene.scale.set(
                Number(scaleValue[0] ?? 1) || 1,
                Number(scaleValue[1] ?? 1) || 1,
                Number(scaleValue[2] ?? 1) || 1
            );
        } else {
            const scalar = Number(scaleValue ?? 1) || 1;
            this.componentScene.scale.setScalar(scalar);
        }
    }

    applyRuntimeConfig() {
        this.applyTransform();

        const viewer = this.dropInViewer?.viewer;
        if (!viewer) return;

        // `viewer.splatMesh` may exist before internal splat buffers are fully ready.
        // Use the mesh reference captured after `addSplatScene` resolves to avoid calling
        // scale APIs too early and crashing during incremental config sync.
        const splatMesh = this.splatMesh || null;

        if (splatMesh) {
            const splatScale = Math.max(0, Number(this.config.splatScale ?? 1) || 1);
            try {
                splatMesh.setSplatScale?.(splatScale);
            } catch (error) {
                console.warn('GaussianSplatLoader: setSplatScale failed', error);
            }
            try {
                splatMesh.setPointCloudModeEnabled?.(this.config.pointCloudMode === true);
            } catch (error) {
                console.warn('GaussianSplatLoader: setPointCloudModeEnabled failed', error);
            }
        }

        viewer.focalAdjustment = Number(this.config.focalAdjustment ?? 1) || 1;
        try {
            viewer.setActiveSphericalHarmonicsDegrees?.(
                Math.max(0, Math.min(2, Number(this.config.sphericalHarmonicsDegree ?? 0) || 0))
            );
        } catch (error) {
            console.warn('GaussianSplatLoader: setActiveSphericalHarmonicsDegrees failed', error);
        }
    }

    ensureInteractiveProxy() {
        if (this.interactiveProxy) {
            return this.interactiveProxy;
        }

        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        material.depthWrite = false;
        material.colorWrite = false;

        this.interactiveProxy = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            material
        );
        this.interactiveProxy.name = `${this.name}_interactive_proxy`;
        this.interactiveProxy.frustumCulled = false;
        this.interactiveProxy.userData.eventEmitter = this.eventEmitter;
        this.interactiveObjects = [this.interactiveProxy];

        return this.interactiveProxy;
    }

    disposeInteractiveProxy() {
        if (!this.interactiveProxy) {
            this.interactiveObjects = [];
            return;
        }

        if (this.interactiveProxy.parent) {
            this.interactiveProxy.parent.remove(this.interactiveProxy);
        }

        this.interactiveProxy.geometry?.dispose?.();
        this.interactiveProxy.material?.dispose?.();
        this.interactiveProxy = null;
        this.interactiveObjects = [];
    }

    updateInteractiveProxy() {
        const splatMesh = this.dropInViewer?.viewer?.splatMesh;
        if (!splatMesh) {
            this.disposeInteractiveProxy();
            return;
        }

        let box = null;
        if (typeof splatMesh.computeBoundingBox === 'function') {
            try {
                box = splatMesh.computeBoundingBox(true);
            } catch (error) {
                console.warn('GaussianSplatLoader: compute bounding box failed', error);
            }
        }

        if (!box || box.isEmpty()) {
            box = new THREE.Box3().setFromObject(splatMesh);
        }

        if (!box || box.isEmpty()) {
            this.disposeInteractiveProxy();
            return;
        }

        const proxy = this.ensureInteractiveProxy();
        if (proxy.parent !== splatMesh) {
            splatMesh.add(proxy);
        }

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        proxy.position.copy(center);
        proxy.scale.set(
            Math.max(size.x || 0, MIN_PROXY_SIZE),
            Math.max(size.y || 0, MIN_PROXY_SIZE),
            Math.max(size.z || 0, MIN_PROXY_SIZE)
        );
        proxy.updateMatrixWorld(true);
    }

    async createViewer() {
        // Remove any leftover children from a previous viewer cycle.
        while (this.componentScene.children.length > 0) {
            this.componentScene.remove(this.componentScene.children[0]);
        }

        const viewerOptions = this.resolveViewerOptions();
        this.dropInViewer = new DropInViewer(viewerOptions);
        this.enforceSafeWorkerMode();
        this.object3d = this.dropInViewer;
        this.splatMesh = null;
        this._viewerReady = false;

        if (this.dropInViewer.callbackMesh?.userData) {
            this.dropInViewer.callbackMesh.userData.__editorIgnoreRaycast = true;
        }

        this.componentScene.add(this.dropInViewer);

        // Verify the scene graph: componentScene must be part of the main scene.
        const inMainScene = this.componentScene.parent === this.scene?.scene;
        if (!inMainScene) {
            console.error(
                'GaussianSplatLoader: componentScene is NOT attached to the main scene!',
                'parent:', this.componentScene.parent
            );
        }

        // Before splat scene is loaded we only apply transform;
        // runtime mesh options are applied after `loadSplat` resolves.
        this.applyTransform();

        console.log(
            `GaussianSplatLoader[${this.name}]: viewer created`,
            '| inMainScene:', inMainScene,
            '| callbackMesh:', !!this.dropInViewer.callbackMesh,
            '| splatMesh:', !!this.dropInViewer.splatMesh
        );
    }

    async disposeViewer() {
        if (this.currentLoadTask?.abort) {
            try {
                this.currentLoadTask.abort('GaussianSplatLoader reload/dispose');
            } catch {
                // ignore abort errors
            }
        }
        this.currentLoadTask = null;

        if (!this.dropInViewer) {
            this.disposeInteractiveProxy();
            this.splatMesh = null;
            this.object3d = null;
            return;
        }

        this.disposeInteractiveProxy();

        if (this.dropInViewer.parent) {
            this.dropInViewer.parent.remove(this.dropInViewer);
        }

        try {
            await this.dropInViewer.dispose?.();
        } catch (error) {
            console.warn('GaussianSplatLoader: dispose viewer failed', error);
        }

        this.dropInViewer = null;
        this.splatMesh = null;
        this.object3d = null;
    }

    async loadSplat() {
        if (!this.dropInViewer || !this.config.url) return;

        this.enforceSafeWorkerMode();
        this.emit('loadStart', { url: this.config.url });
        console.log(`GaussianSplatLoader[${this.name}]: loading ${this.config.url}`);

        const loadTask = this.dropInViewer.addSplatScene(this.config.url, this.resolveLoadOptions());
        this.currentLoadTask = loadTask;

        await loadTask;

        if (this.currentLoadTask !== loadTask) {
            return;
        }

        this.currentLoadTask = null;
        this.splatMesh = this.dropInViewer.viewer?.splatMesh || null;
        this._viewerReady = true;

        // Defensive: force splatMesh.visible = true.
        // SplatMesh starts with visible=false and is only set to true inside
        // build() when scenes.length > 0. If there's any timing issue, force it.
        if (this.splatMesh) {
            this.splatMesh.visible = true;
        }

        this.applyRuntimeConfig();
        this.updateInteractiveProxy();

        // Force one explicit viewer.update() so uniforms (focal, viewport) and
        // the SceneRevealMode.Instant flag are applied immediately.
        const renderer = this.scene?.renderer?.instance;
        const camera = this.scene?.camera?.instance;
        if (renderer && camera && this.dropInViewer.viewer) {
            this.dropInViewer.viewer.update(renderer, camera);
        }

        // Post-load validation: surface any issues that would make splats invisible.
        this._validatePostLoad();

        this.emit('loadComplete', {
            url: this.config.url,
            format: this.normalizeFormat(this.config.format) || this.inferFormatFromUrl(this.config.url),
            splatCount: this.getSplatCount()
        });
    }

    /** Diagnostics that run once after a successful load. */
    _validatePostLoad() {
        const viewer = this.dropInViewer?.viewer;
        const mesh = this.splatMesh;
        const tag = `GaussianSplatLoader[${this.name}]`;

        if (!viewer) {
            console.warn(`${tag}: viewer is null after load`);
            return;
        }
        if (!viewer.initialized) {
            console.warn(`${tag}: viewer.initialized is false — init() may not have run`);
        }
        if (!viewer.splatRenderReady) {
            console.warn(`${tag}: viewer.splatRenderReady is false — sort may not have completed`);
        }
        if (!mesh) {
            console.warn(`${tag}: splatMesh is null after load`);
            return;
        }

        const geom = mesh.geometry;
        const ic = geom?.instanceCount ?? -1;
        const splatCount = mesh.getSplatCount?.() ?? 0;
        const visible = mesh.visible;

        if (!visible) {
            console.warn(`${tag}: splatMesh.visible is FALSE — splats will not render`);
        }
        if (ic <= 0) {
            console.warn(`${tag}: geometry.instanceCount = ${ic} — nothing to draw (sort may have failed)`);
        }

        const mat = mesh.material;
        const focal = mat?.uniforms?.focal?.value;
        const viewport = mat?.uniforms?.viewport?.value;

        if (focal && focal.x === 0 && focal.y === 0) {
            console.warn(`${tag}: focal uniform is (0,0) — splats will project to zero size`);
        }
        if (viewport && viewport.x === 0 && viewport.y === 0) {
            console.warn(`${tag}: viewport uniform is (0,0) — renderer size may be unknown`);
        }

        const fadeInComplete = mat?.uniforms?.fadeInComplete?.value;
        const visibleRadius = mesh?.visibleRegionFadeStartRadius ?? -1;
        const revealMode = viewer?.sceneRevealMode;

        if (fadeInComplete === 0) {
            console.warn(
                `${tag}: fadeInComplete uniform = 0 \u2014 splats outside visibleRegionFadeStartRadius (${visibleRadius.toFixed?.(3)}) are transparent.`,
                `sceneRevealMode=${revealMode} (should be SceneRevealMode.Instant=2 to bypass fade)`
            );
        }

        console.log(
            `${tag}: post-load state`,
            `| visible: ${visible}`,
            `| instanceCount: ${ic}`,
            `| splatCount: ${splatCount}`,
            `| initialized: ${viewer.initialized}`,
            `| splatRenderReady: ${viewer.splatRenderReady}`,
            `| sceneRevealMode: ${revealMode}`,
            `| fadeInComplete: ${fadeInComplete}`,
            `| focal: (${focal?.x?.toFixed(1)}, ${focal?.y?.toFixed(1)})`,
            `| viewport: (${viewport?.x?.toFixed(0)}, ${viewport?.y?.toFixed(0)})`,
            `| inSceneGraph: ${!!mesh.parent}`
        );
    }

    /**
     * Returns a comprehensive state snapshot for debugging.
     * Call from browser console: component.diagnose()
     */
    diagnose() {
        const viewer = this.dropInViewer?.viewer;
        const mesh = viewer?.splatMesh;
        const geom = mesh?.geometry;
        const mat = mesh?.material;
        const renderer = this.scene?.renderer?.instance;
        const camera = this.scene?.camera?.instance;

        const state = {
            name: this.name,
            url: this.config.url,
            isMounted: this.isMounted,
            isDisposed: this.isDisposed,
            _viewerReady: this._viewerReady,
            hasDropInViewer: !!this.dropInViewer,
            hasViewer: !!viewer,
            viewerInitialized: viewer?.initialized ?? false,
            splatRenderReady: viewer?.splatRenderReady ?? false,
            sceneRevealMode: viewer?.sceneRevealMode ?? null,
            sortWorkerExists: !!viewer?.sortWorker,
            hasSplatMesh: !!mesh,
            splatMeshVisible: mesh?.visible ?? false,
            instanceCount: geom?.instanceCount ?? -1,
            splatCount: mesh?.getSplatCount?.() ?? 0,
            fadeInComplete: mat?.uniforms?.fadeInComplete?.value ?? null,
            visibleRegionFadeStartRadius: mesh?.visibleRegionFadeStartRadius ?? null,
            visibleRegionBufferRadius: mesh?.visibleRegionBufferRadius ?? null,
            focalX: mat?.uniforms?.focal?.value?.x ?? null,
            focalY: mat?.uniforms?.focal?.value?.y ?? null,
            viewportX: mat?.uniforms?.viewport?.value?.x ?? null,
            viewportY: mat?.uniforms?.viewport?.value?.y ?? null,
            componentSceneInMainScene: this.componentScene?.parent === this.scene?.scene,
            dropInViewerInComponentScene: this.dropInViewer?.parent === this.componentScene,
            splatMeshInDropInViewer: mesh?.parent === this.dropInViewer,
            callbackMeshExists: !!this.dropInViewer?.callbackMesh,
            hasRenderer: !!renderer,
            hasCamera: !!camera,
            rendererSize: renderer ? { w: renderer.domElement?.width, h: renderer.domElement?.height } : null,
            crossOriginIsolated: globalThis?.crossOriginIsolated ?? false
        };

        console.table(state);
        return state;
    }

    async reload() {
        if (!this.config.url) {
            await this.disposeViewer();
            return;
        }

        await this.disposeViewer();
        await this.createViewer();

        try {
            await this.loadSplat();
        } catch (error) {
            console.error('GaussianSplatLoader: Failed to load splat', error);
            const message = String(error?.message || error || '');
            if (message.includes('SharedArrayBuffer') || message.includes('crossOriginIsolated')) {
                console.warn('GaussianSplatLoader: SharedArrayBuffer requires COOP/COEP; try sharedMemoryForWorkers=false');
            }
            this.emit('error', { error });
            throw error;
        }
    }

    getSplatCount() {
        return this.dropInViewer?.viewer?.splatMesh?.getSplatCount?.() || 0;
    }

    getBounds() {
        if (!this.dropInViewer) return null;

        const box = new THREE.Box3().setFromObject(this.componentScene);
        if (box.isEmpty()) return null;

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        return {
            center: [center.x, center.y, center.z],
            size: [size.x, size.y, size.z],
            maxDim: Math.max(size.x, size.y, size.z),
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z]
        };
    }

    getInteractiveObjects() {
        return this.interactiveObjects || [];
    }

    raycast(event) {
        const viewer = this.dropInViewer?.viewer;
        const splatMesh = viewer?.splatMesh;
        const splatRaycaster = viewer?.raycaster;
        const renderer = this.scene?.renderer?.instance;
        const camera = this.scene?.camera?.instance;

        if (!event || !viewer || !splatMesh || !splatRaycaster || !renderer || !camera) {
            return [];
        }

        const rect = renderer.domElement.getBoundingClientRect();
        const screenPosition = new THREE.Vector2(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
        const screenDimensions = new THREE.Vector2(rect.width, rect.height);
        const hits = [];

        splatRaycaster.setFromCameraAndScreenPosition(camera, screenPosition, screenDimensions);
        splatRaycaster.intersectSplatMesh(splatMesh, hits);

        return hits
            .sort((a, b) => (a?.distance || Infinity) - (b?.distance || Infinity))
            .map((hit) => ({
                object: this.interactiveProxy || splatMesh,
                point: hit?.origin?.clone?.() || null,
                normal: hit?.normal?.clone?.() || null,
                distance: Number(hit?.distance) || 0,
                isSplatHit: true
            }));
    }

    async updateConfig(newConfig = {}) {
        const shouldReload = Object.keys(newConfig).some((key) => RELOAD_KEYS.has(key));

        this.config = {
            ...this.config,
            ...newConfig,
            gpuAcceleratedSort: false,
            sharedMemoryForWorkers: false
        };

        if (shouldReload) {
            try {
                await this.reload();
            } catch (error) {
                console.warn('GaussianSplatLoader: reload after config change failed', error);
            }
        } else {
            this.applyRuntimeConfig();
        }

        this.emit('configUpdated', this.config);
    }

    onDispose() {
        // Synchronously detach the DropInViewer from the scene graph BEFORE
        // Component.dispose() traverses componentScene to dispose child
        if (this.dropInViewer) {
            if (this.dropInViewer.parent) {
                this.dropInViewer.parent.remove(this.dropInViewer);
            }
        }
        this.disposeInteractiveProxy();
        this._viewerReady = false;

        // Async cleanup (sort worker termination etc.) runs in background.
        const viewer = this.dropInViewer;
        if (viewer) {
            this.dropInViewer = null;
            this.splatMesh = null;
            this.object3d = null;
            Promise.resolve().then(() => viewer.dispose?.()).catch(() => {});
        }
    }
}

export default GaussianSplatLoader;
