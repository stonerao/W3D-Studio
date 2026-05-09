import * as THREE from 'three';

/**
 * Raycaster 射线拾取器
 *
 * @class Raycaster
 * @description 射线拾取和碰撞检测
 */
export class Raycaster {
    /**
     * 创建射线拾取器实例
     *
     * @param {Scene} scene - 场景实例
     */
    constructor(scene) {
        this.scene = scene;

        // Three.js 射线拾取器
        this.instance = new THREE.Raycaster();

        // 鼠标位置
        this.mouse = new THREE.Vector2();

        // 预分配 intersectPlane 用到的临时对象，避免每次调用都创建新对象（GC 压力）
        this._tempPlane = new THREE.Plane();
        this._tempNormal = new THREE.Vector3();
        this._tempPlaneOut = new THREE.Vector3();
    }

    /**
     * 更新鼠标位置
     *
     * @param {MouseEvent} event - 鼠标事件
     */
    updateMousePosition(event) {
        const rect = this.scene.renderer.instance.domElement.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /**
     * 射线拾取
     *
     * @param {MouseEvent} event - 鼠标事件
     * @param {Array} objects - 要检测的对象数组（可选）
     * @returns {Array} 相交对象数组
     */
    raycast(event, objects = null) {
        // 更新鼠标位置
        this.updateMousePosition(event);

        // 更新射线
        this.instance.setFromCamera(this.mouse, this.scene.camera.instance);

        // 获取要检测的对象
        const targets = objects || this.scene.scene.children;

        // 执行射线检测
        const intersects = this.instance.intersectObjects(targets, true);

        // 过滤不可见对象：检查对象及其所有父级的可见性
        // 同时忽略被编辑器标记为不参与拾取的对象（例如 TransformControls gizmo）
        const visibleIntersects = intersects.filter((intersect) => {
            let obj = intersect.object;
            while (obj) {
                if (obj.visible === false) return false;
                if (obj.userData && obj.userData.__editorIgnoreRaycast) return false;
                obj = obj.parent;
            }
            return true;
        });

        return visibleIntersects;
    }

    /**
     * 与平面求交（常用于空白区域投射到地面/工作平面）
     *
     * @param {MouseEvent} event - 鼠标事件
     * @param {{normal?: [number, number, number], constant?: number}} plane - 平面参数
     * @returns {THREE.Vector3|null} 交点（世界坐标）
     */
    intersectPlane(event, plane = {}) {
        if (!event) return null;

        const normalArr = Array.isArray(plane.normal) ? plane.normal : [0, 1, 0];
        const constant = Number.isFinite(plane.constant) ? plane.constant : 0;

        // 更新鼠标位置 + 射线
        this.updateMousePosition(event);
        this.instance.setFromCamera(this.mouse, this.scene.camera.instance);

        // 复用预分配对象，避免 GC 压力
        this._tempNormal.set(normalArr[0] || 0, normalArr[1] ?? 1, normalArr[2] || 0);
        this._tempPlane.normal.copy(this._tempNormal);
        this._tempPlane.constant = constant;

        const hit = this.instance.ray.intersectPlane(this._tempPlane, this._tempPlaneOut);
        // clone 防止调用方拱持将在下次调用时被覆写的建设
        return hit ? this._tempPlaneOut.clone() : null;
    }

    /**
     * 与地面（y=0）平面求交的便捷方法
     * @param {MouseEvent} event - 鼠标事件
     * @returns {THREE.Vector3|null} 交点（世界坐标）
     */
    intersectGround(event) {
        return this.intersectPlane(event, { normal: [0, 1, 0], constant: 0 });
    }

    /**
     * 从屏幕坐标获取世界坐标
     *
     * @param {number} x - 屏幕 X 坐标
     * @param {number} y - 屏幕 Y 坐标
     * @param {number} z - 深度值（0-1）
     * @returns {THREE.Vector3} 世界坐标
     */
    screenToWorld(x, y, z = 0) {
        const vector = new THREE.Vector3(x, y, z);
        vector.unproject(this.scene.camera.instance);
        return vector;
    }

    /**
     * 从世界坐标获取屏幕坐标
     *
     * @param {THREE.Vector3} worldPosition - 世界坐标
     * @returns {THREE.Vector2} 屏幕坐标
     */
    worldToScreen(worldPosition) {
        const vector = worldPosition.clone();
        vector.project(this.scene.camera.instance);

        const rect = this.scene.renderer.instance.domElement.getBoundingClientRect();

        return new THREE.Vector2(
            ((vector.x + 1) * rect.width) / 2 + rect.left,
            (-(vector.y - 1) * rect.height) / 2 + rect.top
        );
    }
}
