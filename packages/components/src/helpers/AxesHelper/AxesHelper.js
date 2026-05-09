import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Helpers module component that displays scene axes for orientation and debugging.
 */
export class AxesHelper extends Component {
    static defaultConfig = {
        size: 50
    };

    onMounted() {
        this.axes = new THREE.AxesHelper(this.config.size);
        this.add(this.axes);
    }

    onDispose() {
        if (this.axes) {
            this.axes.geometry.dispose();
            this.axes.material.dispose();
        }
    }
}

export default AxesHelper;
