import * as THREE from 'three';

/**
 * English comment.
 */
export class Raycaster {
    /**
     * English comment.
     */
    constructor(scene) {
        this.scene = scene;

        // English comment.
        this.instance = new THREE.Raycaster();

        // English comment.
        this.mouse = new THREE.Vector2();

        // English comment.
        this._tempPlane = new THREE.Plane();
        this._tempNormal = new THREE.Vector3();
        this._tempPlaneOut = new THREE.Vector3();
    }

    /**
     * English comment.
     */
    updateMousePosition(event) {
        const rect = this.scene.renderer.instance.domElement.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /**
     * English comment.
     */
    raycast(event, objects = null) {
        // English comment.
        this.updateMousePosition(event);

        // English comment.
        this.instance.setFromCamera(this.mouse, this.scene.camera.instance);

        // English comment.
        const targets = objects || this.scene.scene.children;

        // English comment.
        const intersects = this.instance.intersectObjects(targets, true);

        // English comment.
        // English comment.
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
     * English comment.
     */
    intersectPlane(event, plane = {}) {
        if (!event) return null;

        const normalArr = Array.isArray(plane.normal) ? plane.normal : [0, 1, 0];
        const constant = Number.isFinite(plane.constant) ? plane.constant : 0;

        // English comment.
        this.updateMousePosition(event);
        this.instance.setFromCamera(this.mouse, this.scene.camera.instance);

        // English comment.
        this._tempNormal.set(normalArr[0] || 0, normalArr[1] ?? 1, normalArr[2] || 0);
        this._tempPlane.normal.copy(this._tempNormal);
        this._tempPlane.constant = constant;

        const hit = this.instance.ray.intersectPlane(this._tempPlane, this._tempPlaneOut);
        // English comment.
        return hit ? this._tempPlaneOut.clone() : null;
    }

    /**
     * English comment.
     */
    intersectGround(event) {
        return this.intersectPlane(event, { normal: [0, 1, 0], constant: 0 });
    }

    /**
     * English comment.
     */
    screenToWorld(x, y, z = 0) {
        const vector = new THREE.Vector3(x, y, z);
        vector.unproject(this.scene.camera.instance);
        return vector;
    }

    /**
     * English comment.
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
