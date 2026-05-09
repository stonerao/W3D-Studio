import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Marker module component that renders filled area markers for region selection and area highlighting.
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
        this.area.rotation.x = -Math.PI / 2;
        this.add(this.area);
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);

        if (this.area) {
            this.remove(this.area);
            this.area.geometry.dispose();
            this.area.material.dispose();
        }

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
