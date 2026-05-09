import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class MarkLine extends Component {
    static defaultConfig = {
        points: [],
        color: '#00ff00',
        lineWidth: 2
    };

    onMounted() {
        this.createLine();
    }

    createLine() {
        if (this.config.points.length < 2) return;

        const points = this.config.points.map(
            (p) => new THREE.Vector3(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2])
        );

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.config.color,
            linewidth: this.config.lineWidth
        });

        this.line = new THREE.Line(geometry, material);
        this.add(this.line);
    }

    /**
     * English comment.
     */
    updateConfig(newConfig) {
        // English comment.
        Object.assign(this.config, newConfig);

        // English comment.
        if (this.line) {
            this.remove(this.line);
            this.line.geometry.dispose();
            this.line.material.dispose();
            this.line = null;
        }

        // English comment.
        this.createLine();
    }

    onDispose() {
        if (this.line) {
            this.line.geometry.dispose();
            this.line.material.dispose();
        }
    }
}

export default MarkLine;
