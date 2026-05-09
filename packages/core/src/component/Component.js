import * as THREE from 'three';
import { EventEmitter } from '@w3d/utils';

/**
 * Component 组件基类
 * 所有组件统一继承此类，提供生命周期与事件能力。
 */
export class Component extends THREE.Group {
    static defaultConfig = {};

    /**
     * @param {Scene} scene - 场景实例
     * @param {Object} config - 组件配置
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

        // 组件运行时渲染根节点，业务组件通常把对象挂到这里。
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
     * 设置组件可见状态，并同步常见运行时根节点。
     * @param {boolean} visible - 是否可见
     * @param {{emit?: boolean}} options - 是否发出 show/hide/visibilityChange 事件
     * @returns {boolean}
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

        // 可见性变化时通知事件系统缓存失效
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
     * 切换可见状态。
     * @param {boolean} forceVisible - 可选，强制设置可见状态
     * @returns {boolean}
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
     * 获取可交互对象列表。
     * 子类可重写以提供具体可交互对象。
     * @returns {Array<THREE.Object3D>}
     */
    getInteractiveObjects() {
        return this.isMesh || this.isGroup ? [this] : [];
    }
}
