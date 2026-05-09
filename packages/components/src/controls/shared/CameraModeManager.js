const SCENE_MANAGER_KEY = '__w3dCameraModeManager__';

/**
 * 场景级相机模式仲裁器。
 * 统一管理 Orbit / Fly / FirstPerson / Tour 的互斥关系。
 */
export class CameraModeManager {
    constructor(scene) {
        this.scene = scene;
        this.activeComponent = null;
        this.activeMode = 'orbit';
        this.adapters = new Map();
    }

    register(component, adapter = {}) {
        if (!component) return;
        const mode = String(adapter.mode || 'custom');
        const lockKey = adapter.lockKey || this.createLockKey(mode, component);
        this.adapters.set(component, {
            mode,
            deactivate: adapter.deactivate,
            lockKey
        });
    }

    unregister(component) {
        if (!component) return;
        const adapter = this.adapters.get(component);
        if (this.activeComponent === component) {
            this.releaseOrbitLock(adapter);
            this.activeComponent = null;
            this.activeMode = 'orbit';
            this.syncOrbitState();
        }
        this.adapters.delete(component);
    }

    requestActivate(component) {
        const next = this.adapters.get(component);
        if (!next) return false;

        if (this.activeComponent === component) {
            this.acquireOrbitLock(next);
            this.syncOrbitState();
            return true;
        }

        const prevComponent = this.activeComponent;
        const prev = prevComponent ? this.adapters.get(prevComponent) : null;
        if (prevComponent && prev) {
            try {
                prev.deactivate?.('camera-mode-switch');
            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn('[CameraModeManager] failed to deactivate previous mode', error);
            }
            this.releaseOrbitLock(prev);
        }

        this.activeComponent = component;
        this.activeMode = next.mode;
        this.acquireOrbitLock(next);
        this.syncOrbitState();
        return true;
    }

    requestDeactivate(component, reason = 'manual') {
        if (!component || this.activeComponent !== component) return false;
        void reason;

        const current = this.adapters.get(component);
        this.releaseOrbitLock(current);
        this.activeComponent = null;
        this.activeMode = 'orbit';
        this.syncOrbitState();
        return true;
    }

    getState() {
        return {
            activeMode: this.activeMode,
            hasActiveCameraComponent: !!this.activeComponent
        };
    }

    createLockKey(mode, component) {
        const name = component?.name || component?.config?.name || component?.uuid || 'camera';
        return `camera-mode:${mode}:${String(name)}`;
    }

    getSceneControls() {
        return this.scene?.controls || null;
    }

    acquireOrbitLock(adapter) {
        if (!adapter) return;
        const controls = this.getSceneControls();
        if (!controls?.instance) return;

        if (typeof controls.acquireLock === 'function') {
            controls.acquireLock(adapter.lockKey);
            return;
        }

        controls.instance.enabled = false;
    }

    releaseOrbitLock(adapter) {
        if (!adapter) return;
        const controls = this.getSceneControls();
        if (!controls?.instance) return;

        if (typeof controls.releaseLock === 'function') {
            controls.releaseLock(adapter.lockKey);
            return;
        }

        controls.instance.enabled = true;
    }

    syncOrbitState() {
        const controls = this.getSceneControls();
        if (!controls?.instance) return;

        if (typeof controls.applyEnabledState === 'function') {
            controls.applyEnabledState();
            return;
        }

        controls.instance.enabled = !this.activeComponent;
    }
}

export function getCameraModeManager(scene) {
    if (!scene) return null;
    if (!scene[SCENE_MANAGER_KEY]) {
        scene[SCENE_MANAGER_KEY] = new CameraModeManager(scene);
    }
    return scene[SCENE_MANAGER_KEY];
}
