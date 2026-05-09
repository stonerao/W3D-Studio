import * as THREE from 'three';

/**
 * Camera 相机类
 *
 * @class Camera
 * @description 相机的创建和控制
 */
export class Camera {
    /**
     * 创建相机实例
     *
     * @param {Scene} scene - 场景实例
     * @param {Object} options - 配置选项
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            fov: 45,
            near: 0.1,
            far: 10000,
            position: [0, 100, 200],
            lookAt: [0, 0, 0],
            ...options
        };
        // 创建透视相机
        const width = this.scene.container.clientWidth;
        const height = this.scene.container.clientHeight;
        const aspect = width / height;

        this.instance = new THREE.PerspectiveCamera(
            this.options.fov,
            aspect,
            this.options.near,
            this.options.far
        );

        // 设置相机位置
        const [x, y, z] = this.options.position;
        this.instance.position.set(x, y, z);

        // 设置相机朝向
        const [lx, ly, lz] = this.options.lookAt;
        this.instance.lookAt(lx, ly, lz);

        // 添加到场景
        this.scene.scene.add(this.instance);
    }

    /**
     * 设置相机位置
     *
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {number} z - Z 坐标
     */
    setPosition(x, y, z) {
        this.instance.position.set(x, y, z);
    }

    /**
     * 设置相机朝向
     *
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {number} z - Z 坐标
     */
    lookAt(x, y, z) {
        this.instance.lookAt(x, y, z);
    }

    /**
     * 调整相机大小
     *
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    resize(width, height) {
        this.instance.aspect = width / height;
        this.instance.updateProjectionMatrix();
    }

    /**
     * 获取相机位置
     *
     * @returns {THREE.Vector3} 相机位置
     */
    getPosition() {
        return this.instance.position.clone();
    }

    /**
     * 获取相机方向
     *
     * @returns {THREE.Vector3} 相机方向
     */
    getDirection() {
        const direction = new THREE.Vector3();
        this.instance.getWorldDirection(direction);
        return direction;
    }

    /**
     * 更新相机配置
     *
     * @param {Object} config - 配置选项
     */
    updateConfig(config = {}) {
        if (!config || typeof config !== 'object') return;

        // 更新 FOV
        if (config.fov !== undefined && config.fov !== this.options.fov) {
            this.options.fov = config.fov;
            this.instance.fov = config.fov;
            this.instance.updateProjectionMatrix();
        }

        // 更新近平面
        if (config.near !== undefined && config.near !== this.options.near) {
            this.options.near = config.near;
            this.instance.near = config.near;
            this.instance.updateProjectionMatrix();
        }

        // 更新远平面
        if (config.far !== undefined && config.far !== this.options.far) {
            this.options.far = config.far;
            this.instance.far = config.far;
            this.instance.updateProjectionMatrix();
        }

        // 更新位置
        if (config.position !== undefined) {
            const pos = Array.isArray(config.position) ? config.position : [config.position.x, config.position.y, config.position.z];
            if (pos[0] !== undefined && pos[1] !== undefined && pos[2] !== undefined) {
                this.options.position = pos;
                this.instance.position.set(pos[0], pos[1], pos[2]);
            }
        }

        // 更新看向点
        if (config.lookAt !== undefined) {
            const lookAt = Array.isArray(config.lookAt) ? config.lookAt : [config.lookAt.x, config.lookAt.y, config.lookAt.z];
            if (lookAt[0] !== undefined && lookAt[1] !== undefined && lookAt[2] !== undefined) {
                this.options.lookAt = lookAt;
                this.instance.lookAt(lookAt[0], lookAt[1], lookAt[2]);
            }
        }
    }

    /**
     * 获取当前配置
     *
     * @returns {Object} 当前配置
     */
    getConfig() {
        return {
            fov: this.options.fov,
            near: this.options.near,
            far: this.options.far,
            position: [...this.options.position],
            lookAt: [...this.options.lookAt]
        };
    }

    /**
     * 销毁相机
     */
    dispose() {
        if (this.instance.parent) {
            this.instance.parent.remove(this.instance);
        }
    }
}
