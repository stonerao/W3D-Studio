import * as THREE from 'three';
import { EventEmitter } from '@w3d/utils';

/**
 * English comment.
 */
export class Component extends THREE.Group {
    static defaultConfig = {};

    /**
     * English comment.
     */
    constructor(scene, config = {}) {
        super();

        this.scene = scene;
        this.config = {
            ...this.constructor.defaultConfig,
            ...config
        };

        this.name = this.config.name || `component_${Date.now()}`;
        this.eventEmitter = new EventEmitter();

        // English comment.
        this.componentScene = new THREE.Group();
        this.componentScene.name = `${this.name}_scene`;
        this.componentScene.visible = this.visible !== false;
        scene.scene.add(this.componentScene);

        this.isMounted = false;
        this.isDisposed = false;

        this.clock = new THREE.Clock();
        this.deltaTime = 0;
    }

    onCreate() {}

    onBeforeMount() {}

    onMounted() {}

    onUpdate(delta) {
        void delta;
    }

    onBeforeDispose() {}

    onDispose() {}

    update() {
        if (!this.isMounted || this.isDisposed) return;

        this.deltaTime = this.clock.getDelta();
        this.onUpdate(this.deltaTime);
    }

    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        this.onConfigUpdate && this.onConfigUpdate(this.config);
    }

    on(event, handler) {
        this.eventEmitter.on(event, handler);
        return this;
    }

    off(event, handler) {
        this.eventEmitter.off(event, handler);
        return this;
    }

    emit(event, data) {
        this.eventEmitter.emit(event, data);
        return this;
    }

    show() {
        return this.setVisible(true);
    }

    hide() {
        return this.setVisible(false);
    }

    /**
     * English comment.
     */
    setVisible(visible = true, options = {}) {
        const nextVisible = visible !== false;
        const prevVisible = this.visible !== false;

        this.visible = nextVisible;

        const runtimeRoots = [
            this.componentScene,
            this.group,
            this.object3d,
            this.mesh,
            this.model
        ];

        runtimeRoots.forEach((root) => {
            if (root && typeof root.visible === 'boolean') {
                root.visible = nextVisible;
            }
        });

        // English comment.
        if (prevVisible !== nextVisible) {
            this.scene?.eventSystem?.invalidateInteractiveCache?.();
        }

        const shouldEmit = options.emit !== false;
        if (shouldEmit && prevVisible !== nextVisible) {
            this.emit(nextVisible ? 'show' : 'hide');
            this.emit('visibilityChange', {
                visible: nextVisible,
                previousVisible: prevVisible
            });
        }

        return nextVisible;
    }

    /**
     * English comment.
     */
    toggle(forceVisible) {
        if (typeof forceVisible === 'boolean') {
            return this.setVisible(forceVisible);
        }
        return this.setVisible(this.visible === false);
    }

    dispose() {
        if (this.isDisposed) return;

        this.onBeforeDispose();

        this.isDisposed = true;
        this.isMounted = false;

        this.eventEmitter.removeAllListeners();

        this.onDispose();

        this.clear();

        if (this.parent) {
            this.parent.remove(this);
        }

        if (this.componentScene) {
            if (this.scene && this.scene.scene) {
                this.scene.scene.remove(this.componentScene);
            }
            this.componentScene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m) => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            this.componentScene.clear();
        }
    }

    /**
     * English comment.
     */
    getInteractiveObjects() {
        return this.isMesh || this.isGroup ? [this] : [];
    }
}
