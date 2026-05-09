import * as THREE from 'three';

/**
 * English comment.
 */
export class Camera {
    /**
     * English comment.
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
        // English comment.
        const width = this.scene.container.clientWidth;
        const height = this.scene.container.clientHeight;
        const aspect = width / height;

        this.instance = new THREE.PerspectiveCamera(
            this.options.fov,
            aspect,
            this.options.near,
            this.options.far
        );

        // English comment.
        const [x, y, z] = this.options.position;
        this.instance.position.set(x, y, z);

        // English comment.
        const [lx, ly, lz] = this.options.lookAt;
        this.instance.lookAt(lx, ly, lz);

        // English comment.
        this.scene.scene.add(this.instance);
    }

    /**
     * English comment.
     */
    setPosition(x, y, z) {
        this.instance.position.set(x, y, z);
    }

    /**
     * English comment.
     */
    lookAt(x, y, z) {
        this.instance.lookAt(x, y, z);
    }

    /**
     * English comment.
     */
    resize(width, height) {
        this.instance.aspect = width / height;
        this.instance.updateProjectionMatrix();
    }

    /**
     * English comment.
     */
    getPosition() {
        return this.instance.position.clone();
    }

    /**
     * English comment.
     */
    getDirection() {
        const direction = new THREE.Vector3();
        this.instance.getWorldDirection(direction);
        return direction;
    }

    /**
     * English comment.
     */
    updateConfig(config = {}) {
        if (!config || typeof config !== 'object') return;

        // English comment.
        if (config.fov !== undefined && config.fov !== this.options.fov) {
            this.options.fov = config.fov;
            this.instance.fov = config.fov;
            this.instance.updateProjectionMatrix();
        }

        // English comment.
        if (config.near !== undefined && config.near !== this.options.near) {
            this.options.near = config.near;
            this.instance.near = config.near;
            this.instance.updateProjectionMatrix();
        }

        // English comment.
        if (config.far !== undefined && config.far !== this.options.far) {
            this.options.far = config.far;
            this.instance.far = config.far;
            this.instance.updateProjectionMatrix();
        }

        // English comment.
        if (config.position !== undefined) {
            const pos = Array.isArray(config.position) ? config.position : [config.position.x, config.position.y, config.position.z];
            if (pos[0] !== undefined && pos[1] !== undefined && pos[2] !== undefined) {
                this.options.position = pos;
                this.instance.position.set(pos[0], pos[1], pos[2]);
            }
        }

        // English comment.
        if (config.lookAt !== undefined) {
            const lookAt = Array.isArray(config.lookAt) ? config.lookAt : [config.lookAt.x, config.lookAt.y, config.lookAt.z];
            if (lookAt[0] !== undefined && lookAt[1] !== undefined && lookAt[2] !== undefined) {
                this.options.lookAt = lookAt;
                this.instance.lookAt(lookAt[0], lookAt[1], lookAt[2]);
            }
        }
    }

    /**
     * English comment.
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
     * English comment.
     */
    dispose() {
        if (this.instance.parent) {
            this.instance.parent.remove(this.instance);
        }
    }
}
