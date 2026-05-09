import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Controls 控制器类
 *
 * @class Controls
 * @description 轨道控制器等交互控制
 */
export class Controls {
    /**
     * 创建控制器实例
     *
     * @param {Scene} scene - 场景实例
     * @param {Object} options - 配置选项
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

        // Orbit 的“基础开关”与“锁”分离，支持多方互斥管控
        this.baseEnabled = this.options.enabled !== false;
        this.orbitLocks = new Set();

        this.instance = new OrbitControls(
            this.scene.camera.instance,
            this.scene.renderer.instance.domElement
        );

        this.applyOptions();
    }

    /**
     * 应用配置选项
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
     * 根据基础开关与锁状态刷新 enabled。
     */
    applyEnabledState() {
        if (!this.instance) return;
        this.instance.enabled = this.baseEnabled && this.orbitLocks.size === 0;
    }

    /**
     * 更新控制器
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
     * 代理 OrbitControls 事件监听（例如 'change'）
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    addEventListener(event, handler) {
        this.instance?.addEventListener?.(event, handler);
    }

    /**
     * 移除事件监听
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    removeEventListener(event, handler) {
        this.instance?.removeEventListener?.(event, handler);
    }

    /**
     * 启用自动旋转
     *
     * @param {boolean} enabled - 是否启用
     * @param {number} speed - 旋转速度
     */
    enableAutoRotate(enabled = true, speed = 2.0) {
        this.instance.autoRotate = enabled;
        this.instance.autoRotateSpeed = speed;
    }

    /**
     * 设置目标点
     *
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {number} z - Z 坐标
     */
    setTarget(x, y, z) {
        this.instance.target.set(x, y, z);
        this.instance.update();
    }

    /**
     * 重置控制器
     */
    reset() {
        this.instance.reset();
    }

    /**
     * 获取 Orbit 控制权锁。
     * @param {string} reason - 锁标识
     * @returns {string}
     */
    acquireLock(reason = 'default') {
        const key = String(reason || 'default');
        this.orbitLocks.add(key);
        this.applyEnabledState();
        return key;
    }

    /**
     * 释放 Orbit 控制权锁。
     * @param {string} reason - 锁标识
     */
    releaseLock(reason = 'default') {
        const key = String(reason || 'default');
        this.orbitLocks.delete(key);
        this.applyEnabledState();
    }

    /**
     * 清空所有 Orbit 锁。
     */
    clearLocks() {
        this.orbitLocks.clear();
        this.applyEnabledState();
    }

    /**
     * 设置 Orbit 基础启用状态（未上锁时生效）。
     * @param {boolean} enabled
     */
    setEnabled(enabled = true) {
        this.baseEnabled = !!enabled;
        this.options.enabled = this.baseEnabled;
        this.applyEnabledState();
    }

    /**
     * 更新控制器配置
     *
     * @param {Object} config - 配置选项
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
     * 获取当前配置
     *
     * @returns {Object} 当前配置
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
     * 销毁控制器
     */
    dispose() {
        this.instance.dispose();
    }
}
