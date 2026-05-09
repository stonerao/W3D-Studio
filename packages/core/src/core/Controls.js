import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * English comment.
 */
export class Controls {
    /**
     * English comment.
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            enabled: true,
            enableDamping: true,
            dampingFactor: 0.05,
            enableZoom: true,
            enableRotate: true,
            enablePan: true,
            autoRotate: false,
            autoRotateSpeed: 2.0,
            minDistance: 1,
            maxDistance: 1000,
            target: { x: 0, y: 0, z: 0 },
            ...options
        };

        // English comment.
        this.baseEnabled = this.options.enabled !== false;
        this.orbitLocks = new Set();

        this.instance = new OrbitControls(
            this.scene.camera.instance,
            this.scene.renderer.instance.domElement
        );

        this.applyOptions();
    }

    /**
     * English comment.
     */
    applyOptions() {
        if (!this.instance) return;
        this.instance.enableDamping = this.options.enableDamping;
        this.instance.dampingFactor = this.options.dampingFactor;
        this.instance.enableZoom = this.options.enableZoom;
        this.instance.enableRotate = this.options.enableRotate;
        this.instance.enablePan = this.options.enablePan;
        this.instance.autoRotate = this.options.autoRotate;
        this.instance.autoRotateSpeed = this.options.autoRotateSpeed;
        this.instance.minDistance = this.options.minDistance;
        this.instance.maxDistance = this.options.maxDistance;
        this.instance.target.set(
            this.options.target.x,
            this.options.target.y,
            this.options.target.z
        );
        this.applyEnabledState();
    }

    /**
     * English comment.
     */
    applyEnabledState() {
        if (!this.instance) return;
        this.instance.enabled = this.baseEnabled && this.orbitLocks.size === 0;
    }

    /**
     * English comment.
     */
    update() {
        if (
            this.instance.enabled &&
            (this.instance.enableDamping || this.instance.autoRotate)
        ) {
            this.instance.update();
        }
    }

    /**
     * English comment.
     */
    addEventListener(event, handler) {
        this.instance?.addEventListener?.(event, handler);
    }

    /**
     * English comment.
     */
    removeEventListener(event, handler) {
        this.instance?.removeEventListener?.(event, handler);
    }

    /**
     * English comment.
     */
    enableAutoRotate(enabled = true, speed = 2.0) {
        this.instance.autoRotate = enabled;
        this.instance.autoRotateSpeed = speed;
    }

    /**
     * English comment.
     */
    setTarget(x, y, z) {
        this.instance.target.set(x, y, z);
        this.instance.update();
    }

    /**
     * English comment.
     */
    reset() {
        this.instance.reset();
    }

    /**
     * English comment.
     */
    acquireLock(reason = 'default') {
        const key = String(reason || 'default');
        this.orbitLocks.add(key);
        this.applyEnabledState();
        return key;
    }

    /**
     * English comment.
     */
    releaseLock(reason = 'default') {
        const key = String(reason || 'default');
        this.orbitLocks.delete(key);
        this.applyEnabledState();
    }

    /**
     * English comment.
     */
    clearLocks() {
        this.orbitLocks.clear();
        this.applyEnabledState();
    }

    /**
     * English comment.
     */
    setEnabled(enabled = true) {
        this.baseEnabled = !!enabled;
        this.options.enabled = this.baseEnabled;
        this.applyEnabledState();
    }

    /**
     * English comment.
     */
    updateConfig(config = {}) {
        if (!config || typeof config !== 'object') return;

        if (config.enableDamping !== undefined) {
            this.options.enableDamping = config.enableDamping;
            this.instance.enableDamping = config.enableDamping;
        }

        if (config.dampingFactor !== undefined) {
            this.options.dampingFactor = config.dampingFactor;
            this.instance.dampingFactor = config.dampingFactor;
        }

        if (config.enableZoom !== undefined) {
            this.options.enableZoom = config.enableZoom;
            this.instance.enableZoom = config.enableZoom;
        }

        if (config.enableRotate !== undefined) {
            this.options.enableRotate = config.enableRotate;
            this.instance.enableRotate = config.enableRotate;
        }

        if (config.enablePan !== undefined) {
            this.options.enablePan = config.enablePan;
            this.instance.enablePan = config.enablePan;
        }

        if (config.autoRotate !== undefined) {
            this.options.autoRotate = config.autoRotate;
            this.instance.autoRotate = config.autoRotate;
        }

        if (config.autoRotateSpeed !== undefined) {
            this.options.autoRotateSpeed = config.autoRotateSpeed;
            this.instance.autoRotateSpeed = config.autoRotateSpeed;
        }

        if (config.minDistance !== undefined) {
            this.options.minDistance = config.minDistance;
            this.instance.minDistance = config.minDistance;
        }

        if (config.maxDistance !== undefined) {
            this.options.maxDistance = config.maxDistance;
            this.instance.maxDistance = config.maxDistance;
        }

        if (config.enabled !== undefined) {
            this.setEnabled(config.enabled);
        }

        if (config.target !== undefined) {
            const target = config.target;
            this.options.target = { ...target };
            this.instance.target.set(
                target.x !== undefined ? target.x : this.instance.target.x,
                target.y !== undefined ? target.y : this.instance.target.y,
                target.z !== undefined ? target.z : this.instance.target.z
            );
        }
    }

    /**
     * English comment.
     */
    getConfig() {
        return {
            enabled: this.baseEnabled,
            enableDamping: this.options.enableDamping,
            dampingFactor: this.options.dampingFactor,
            enableZoom: this.options.enableZoom,
            enableRotate: this.options.enableRotate,
            enablePan: this.options.enablePan,
            autoRotate: this.options.autoRotate,
            autoRotateSpeed: this.options.autoRotateSpeed,
            minDistance: this.options.minDistance,
            maxDistance: this.options.maxDistance,
            target: { ...this.options.target }
        };
    }

    /**
     * English comment.
     */
    dispose() {
        this.instance.dispose();
    }
}
