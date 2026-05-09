import { Component, Tween } from '@w3d/core';
import { getCameraModeManager } from '../../controls/shared/CameraModeManager.js';

/**
 * Animation module component that plays an ordered camera tour across saved viewpoints.
 */
export class CameraTour extends Component {
    static defaultConfig = {
        enabled: false,
        views: [],
        loop: 1,
        duration: 2000,
        easing: 'easeInOutQuad',
        autoStart: false,
        startIndex: 0,
        useViewType: true,
        syncNearFar: false,
        viewSource: 'sceneUserData'
    };

    onCreate() {
        this.views = [];
        this.activeTweens = [];
        this.modeManager = getCameraModeManager(this.scene);
        this.isModeActive = false;

        this.isTouring = false;
        this.isPaused = false;

        this.currentViewIndex = 0;
        this.currentFromIndex = 0;
        this.currentToIndex = 1;

        this.completedLoops = 0;
        this.segmentStartTime = 0;
        this.segmentElapsed = 0;
        this.segmentDuration = 0;
    }

    onMounted() {
        const resolvedViews = this.resolveViewsFromSource();
        this.setViews(resolvedViews, { restartIfPlaying: false });

        this.modeManager?.register(this, {
            mode: 'tour',
            deactivate: (reason) => this.forceDeactivate(reason)
        });

        if (this.config.enabled && this.config.autoStart) {
            this.start();
        }
    }

    onConfigUpdate(nextConfig) {
        if (Array.isArray(nextConfig.views)) {
            this.setViews(nextConfig.views);
        }

        if (nextConfig.enabled === false && (this.isTouring || this.isModeActive)) {
            this.stop({ resetToStart: true, fromManager: false });
        }

        if (
            nextConfig.enabled === true &&
            !this.isTouring &&
            !this.isPaused
        ) {
            this.start();
        }
    }

    resolveViewsFromSource() {
        if (this.config.viewSource === 'sceneUserData') {
            const sceneUserData = this.scene?.scene?.userData || {};
            const fromUserData = sceneUserData.w3dCameraViews || sceneUserData.cameraViews;
            if (Array.isArray(fromUserData) && fromUserData.length > 0) {
                return fromUserData;
            }
        }

        return Array.isArray(this.config.views) ? this.config.views : [];
    }

    normalizeVector3(value, fallback = { x: 0, y: 0, z: 0 }) {
        if (Array.isArray(value) && value.length >= 3) {
            return {
                x: Number(value[0]) || 0,
                y: Number(value[1]) || 0,
                z: Number(value[2]) || 0
            };
        }

        if (value && typeof value === 'object') {
            return {
                x: Number(value.x) || 0,
                y: Number(value.y) || 0,
                z: Number(value.z) || 0
            };
        }

        return {
            x: Number(fallback.x) || 0,
            y: Number(fallback.y) || 0,
            z: Number(fallback.z) || 0
        };
    }

    normalizeView(view = {}, index = 0) {
        const hasPerspectiveParams = view.perspectiveParams && typeof view.perspectiveParams === 'object';

        let cameraType = view.cameraType;
        if (cameraType !== 'perspective' && cameraType !== 'orthographic') {
            cameraType = hasPerspectiveParams ? 'perspective' : 'orthographic';
        }

        const normalized = {
            id: String(view.id ?? `camera-tour-view-${Date.now()}-${index}`),
            name: String(view.name || `视角 ${index + 1}`),
            cameraType,
            position: this.normalizeVector3(view.position),
            target: this.normalizeVector3(view.target ?? view.lookAt ?? view.controlsTarget ?? view.orbitTarget),
            timestamp: Number(view.timestamp ?? view.createdAt ?? Date.now()) || Date.now()
        };

        if (cameraType === 'perspective') {
            const fov = Number(view.fov ?? view.perspectiveParams?.fov ?? this.scene?.camera?.instance?.fov ?? 45);
            normalized.fov = Number.isFinite(fov) ? fov : 45;
        } else {
            const zoom = Number(view.zoom ?? view.orthographicParams?.zoom ?? this.scene?.camera?.instance?.zoom ?? 1);
            normalized.zoom = Number.isFinite(zoom) ? zoom : 1;
        }

        const near = Number(view.near ?? view.perspectiveParams?.near ?? view.orthographicParams?.near);
        const far = Number(view.far ?? view.perspectiveParams?.far ?? view.orthographicParams?.far);
        if (Number.isFinite(near) && near > 0) normalized.near = near;
        if (Number.isFinite(far) && far > 0) normalized.far = far;

        return normalized;
    }

    normalizeViews(views) {
        if (!Array.isArray(views)) return [];
        return views.map((view, index) => this.normalizeView(view, index));
    }

    getLoopCount() {
        const raw = Number(this.config.loop);
        if (!Number.isFinite(raw)) return 1;
        if (raw === 0) return 0;
        return Math.max(1, Math.min(5, Math.round(raw)));
    }

    getDuration() {
        const raw = Number(this.config.duration);
        return Number.isFinite(raw) && raw >= 0 ? raw : 2000;
    }

    normalizeStartIndex() {
        if (!this.views.length) return 0;
        const raw = Math.floor(Number(this.config.startIndex) || 0);
        const length = this.views.length;
        return ((raw % length) + length) % length;
    }

    stopTweens() {
        this.activeTweens.forEach((tween) => tween?.stop?.());
        this.activeTweens = [];
    }

    activateMode() {
        const accepted = this.modeManager?.requestActivate(this);
        if (accepted === false) return false;
        this.isModeActive = true;
        this.config.enabled = true;
        return true;
    }

    releaseMode(reason = 'manual') {
        if (!this.isModeActive) return;
        this.modeManager?.requestDeactivate(this, reason);
        this.isModeActive = false;
        this.config.enabled = false;
    }

    forceDeactivate(reason = 'camera-mode-switch') {
        this.stop({
            resetToStart: false,
            fromManager: true,
            reason
        });
    }

    getRuntimeHandles() {
        const camera = this.scene?.camera?.instance;
        const controls = this.scene?.controls?.instance;
        if (!camera || !controls?.target) {
            return { camera: null, controls: null };
        }
        return { camera, controls };
    }

    applyViewImmediately(view) {
        const normalized = this.normalizeView(view, 0);
        const { camera, controls } = this.getRuntimeHandles();
        if (!camera || !controls) return;

        if (this.config.useViewType && normalized.cameraType) {
            this.scene?.camera?.updateConfig?.({ type: normalized.cameraType });
        }

        camera.position.set(normalized.position.x, normalized.position.y, normalized.position.z);
        controls.target.set(normalized.target.x, normalized.target.y, normalized.target.z);

        if (normalized.cameraType === 'perspective' && camera.isPerspectiveCamera && Number.isFinite(normalized.fov)) {
            camera.fov = normalized.fov;
        }
        if (normalized.cameraType === 'orthographic' && camera.isOrthographicCamera && Number.isFinite(normalized.zoom)) {
            camera.zoom = normalized.zoom;
        }

        if (this.config.syncNearFar) {
            if (Number.isFinite(normalized.near) && normalized.near > 0) camera.near = normalized.near;
            if (Number.isFinite(normalized.far) && normalized.far > 0) camera.far = normalized.far;
        }

        camera.updateProjectionMatrix?.();
        controls.update?.();
    }

    createSegmentTweens(toView, duration, onComplete) {
        const { camera, controls } = this.getRuntimeHandles();
        if (!camera || !controls) {
            onComplete?.();
            return;
        }

        const targetView = this.normalizeView(toView, 0);
        if (this.config.useViewType && targetView.cameraType) {
            this.scene?.camera?.updateConfig?.({ type: targetView.cameraType });
        }

        if (duration <= 0) {
            this.applyViewImmediately(targetView);
            onComplete?.();
            return;
        }

        const tweens = [];
        let completed = 0;

        const finishOne = () => {
            completed += 1;
            if (completed >= tweens.length) {
                this.activeTweens = [];
                onComplete?.();
            }
        };

        const positionTween = Tween.to(
            camera.position,
            {
                x: targetView.position.x,
                y: targetView.position.y,
                z: targetView.position.z
            },
            duration,
            {
                easing: this.config.easing,
                onUpdate: () => {
                    controls.update?.();
                },
                onComplete: finishOne
            }
        );
        tweens.push(positionTween);

        const targetTween = Tween.to(
            controls.target,
            {
                x: targetView.target.x,
                y: targetView.target.y,
                z: targetView.target.z
            },
            duration,
            {
                easing: this.config.easing,
                onUpdate: () => {
                    controls.update?.();
                },
                onComplete: finishOne
            }
        );
        tweens.push(targetTween);

        if (targetView.cameraType === 'perspective' && camera.isPerspectiveCamera && Number.isFinite(targetView.fov)) {
            const fovTween = Tween.to(camera, { fov: targetView.fov }, duration, {
                easing: this.config.easing,
                onUpdate: () => {
                    camera.updateProjectionMatrix?.();
                },
                onComplete: finishOne
            });
            tweens.push(fovTween);
        }

        if (targetView.cameraType === 'orthographic' && camera.isOrthographicCamera && Number.isFinite(targetView.zoom)) {
            const zoomTween = Tween.to(camera, { zoom: targetView.zoom }, duration, {
                easing: this.config.easing,
                onUpdate: () => {
                    camera.updateProjectionMatrix?.();
                },
                onComplete: finishOne
            });
            tweens.push(zoomTween);
        }

        this.activeTweens = tweens;
    }

    playCurrentSegment(remainingDuration = null) {
        if (!this.isTouring || this.views.length < 2) return;

        const fromIndex = this.currentViewIndex;
        const toIndex = (fromIndex + 1) % this.views.length;
        const toView = this.views[toIndex];

        this.currentFromIndex = fromIndex;
        this.currentToIndex = toIndex;
        this.segmentDuration = remainingDuration ?? this.getDuration();
        this.segmentStartTime = Date.now();

        this.createSegmentTweens(toView, this.segmentDuration, () => {
            this.handleSegmentComplete(fromIndex, toIndex, toView);
        });
    }

    handleSegmentComplete(fromIndex, toIndex, toView) {
        if (!this.isTouring) return;

        this.currentViewIndex = toIndex;
        this.segmentElapsed = 0;

        this.emit('view-change', {
            fromIndex,
            toIndex,
            fromView: this.views[fromIndex],
            toView,
            loopIndex: this.completedLoops + 1
        });

        const startIndex = this.normalizeStartIndex();
        if (toIndex === startIndex) {
            this.completedLoops += 1;
            const loopCount = this.getLoopCount();

            this.emit('loop-complete', {
                loopIndex: this.completedLoops,
                totalLoops: loopCount,
                isInfinite: loopCount === 0
            });

            if (loopCount !== 0 && this.completedLoops >= loopCount) {
                this.isTouring = false;
                this.isPaused = false;
                this.releaseMode('tour-complete');
                this.emit('tour-complete', {
                    completedLoops: this.completedLoops,
                    totalViews: this.views.length
                });
                return;
            }
        }

        this.playCurrentSegment();
    }

    setEnabled(enabled = true) {
        if (enabled) {
            this.config.enabled = true;
            return this.start();
        }
        this.config.enabled = false;
        return this.stop({ resetToStart: true, fromManager: false, reason: 'set-enabled' });
    }

    activate() {
        return this.setEnabled(true);
    }

    deactivate() {
        return this.setEnabled(false);
    }

    start() {
        if (this.config.viewSource === 'sceneUserData') {
            const latestViews = this.resolveViewsFromSource();
            this.setViews(latestViews, { restartIfPlaying: false });
        }

        if (this.views.length < 2) {
            console.warn('CameraTour: 视角数量至少需要 2 个');
            return false;
        }

        if (!this.activateMode()) {
            return false;
        }

        this.stopTweens();
        this.isTouring = true;
        this.isPaused = false;
        this.completedLoops = 0;
        this.segmentElapsed = 0;

        this.currentViewIndex = this.normalizeStartIndex();
        this.applyViewImmediately(this.views[this.currentViewIndex]);

        this.emit('tour-start', {
            totalViews: this.views.length,
            loop: this.getLoopCount(),
            startIndex: this.currentViewIndex,
            timestamp: Date.now()
        });

        this.playCurrentSegment();
        return true;
    }

    pause() {
        if (!this.isTouring || this.isPaused) return false;

        this.segmentElapsed = Math.min(
            this.segmentDuration,
            Math.max(0, Date.now() - this.segmentStartTime)
        );

        this.stopTweens();
        this.isPaused = true;
        return true;
    }

    resume() {
        if (!this.isTouring || !this.isPaused) return false;

        const remaining = Math.max(0, this.segmentDuration - this.segmentElapsed);
        this.isPaused = false;

        if (remaining <= 0) {
            this.handleSegmentComplete(this.currentFromIndex, this.currentToIndex, this.views[this.currentToIndex]);
            return true;
        }

        this.playCurrentSegment(remaining);
        return true;
    }

    stop(options = {}) {
        const {
            resetToStart = true,
            fromManager = false,
            reason = 'manual'
        } = options;

        this.stopTweens();
        this.isTouring = false;
        this.isPaused = false;
        this.segmentElapsed = 0;
        this.completedLoops = 0;

        if (resetToStart && this.views.length > 0) {
            const startIndex = this.normalizeStartIndex();
            this.currentViewIndex = startIndex;
            this.applyViewImmediately(this.views[startIndex]);
        }

        if (!fromManager) {
            this.releaseMode(reason);
        } else {
            this.isModeActive = false;
            this.config.enabled = false;
        }

        return true;
    }

    setViews(views, options = {}) {
        const { restartIfPlaying = true } = options;
        const wasRunning = this.isTouring || this.isPaused;

        this.stopTweens();
        this.isTouring = false;
        this.isPaused = false;
        this.segmentElapsed = 0;

        const normalized = this.normalizeViews(Array.isArray(views) ? views : []);
        this.views = normalized;
        this.config.views = normalized;

        if (restartIfPlaying && wasRunning && normalized.length >= 2) {
            this.start();
            return;
        }

        if (wasRunning) {
            this.releaseMode('set-views');
        }
    }

    onDispose() {
        this.stop({
            resetToStart: false,
            fromManager: false,
            reason: 'dispose'
        });
        this.modeManager?.unregister(this);
    }
}

export default CameraTour;
