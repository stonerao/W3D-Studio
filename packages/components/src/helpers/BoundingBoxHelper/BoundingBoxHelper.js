import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Helpers module component that renders bounding boxes around target objects for inspection and alignment.
 */
export class BoundingBoxHelper extends Component {
    static defaultConfig = {
        target: null,
        color: '#ffff00',
        autoUpdate: true
    };

    onMounted() {
        this.helper = null;
        this._createOrUpdateHelper(true);
    }

    onUpdate() {
        if (!this.config.autoUpdate) return;
        this._createOrUpdateHelper(false);
    }

    updateConfig(newConfig) {
        super.updateConfig(newConfig);
        this._createOrUpdateHelper(true);
    }

    _createOrUpdateHelper(forceRecreate = false) {
        const target = this.config.target;
        if (!target) {
            if (this.helper) {
                this.remove(this.helper);
                this.helper.geometry?.dispose?.();
                this.helper.material?.dispose?.();
                this.helper = null;
            }
            return;
        }

        if (!this.helper || forceRecreate) {
            if (this.helper) {
                this.remove(this.helper);
                this.helper.geometry?.dispose?.();
                this.helper.material?.dispose?.();
            }

            this.helper = new THREE.BoxHelper(target, this.config.color);
            this.add(this.helper);
        }

        this.helper.setFromObject(target);

        if (this.config.color && this.helper.material?.color?.set) {
            this.helper.material.color.set(this.config.color);
        }
    }

    onDispose() {
        if (this.helper) {
            this.helper.geometry.dispose();
            this.helper.material.dispose();
        }
    }
}

export default BoundingBoxHelper;
