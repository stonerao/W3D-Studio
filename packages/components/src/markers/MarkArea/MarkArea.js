import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class MarkArea extends Component {
    static defaultConfig = {
        width: 10,
        height: 10,
        color: '#0000ff',
        opacity: 0.3
    };

    onMounted() {
        this.createArea();
    }

    createArea() {
        const geometry = new THREE.PlaneGeometry(this.config.width, this.config.height);
        const material = new THREE.MeshBasicMaterial({
            color: this.config.color,
            transparent: true,
            opacity: this.config.opacity,
            side: THREE.DoubleSide
        });

        this.area = new THREE.Mesh(geometry, material);
        // English comment.
        this.area.rotation.x = -Math.PI / 2;
        this.add(this.area);
    }

    /**
     * English comment.
     */
    updateConfig(newConfig) {
        // English comment.
        Object.assign(this.config, newConfig);

        // English comment.
        if (this.area) {
            this.remove(this.area);
            this.area.geometry.dispose();
            this.area.material.dispose();
        }

        // English comment.
        this.createArea();
    }

    onDispose() {
        if (this.area) {
            this.area.geometry.dispose();
            this.area.material.dispose();
        }
    }
}

export default MarkArea;
