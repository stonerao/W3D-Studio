import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
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

    /**
     * English comment.
     */
    updateConfig(newConfig) {
        // English comment.
        Object.assign(this.config, newConfig);

        // English comment.
        if (this.marker) {
            this.remove(this.marker);
            this.marker.geometry.dispose();
            this.marker.material.dispose();
        }

        // English comment.
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
