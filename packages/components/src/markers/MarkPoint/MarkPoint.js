import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Marker module component that renders interactive point markers with configurable icon, label, and event behavior.
 */
export class MarkPoint extends Component {
    static defaultConfig = {
        position: [0, 0, 0],
        color: '#ff0000',
        size: 1,
        label: ''
    };

    onMounted() {
        this.createMarker();
    }

    createMarker() {
        const geometry = new THREE.SphereGeometry(this.config.size, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: this.config.color });
        this.marker = new THREE.Mesh(geometry, material);

        const pos = this.config.position;
        const x = Array.isArray(pos) ? pos[0] : (pos.x || 0);
        const y = Array.isArray(pos) ? pos[1] : (pos.y || 0);
        const z = Array.isArray(pos) ? pos[2] : (pos.z || 0);
        this.marker.position.set(x, y, z);

        this.add(this.marker);
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);

        if (this.marker) {
            this.remove(this.marker);
            this.marker.geometry.dispose();
            this.marker.material.dispose();
        }

        this.createMarker();
    }

    onDispose() {
        if (this.marker) {
            this.marker.geometry.dispose();
            this.marker.material.dispose();
        }
    }
}

export default MarkPoint;
