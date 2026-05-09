import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class GridHelper extends Component {
    static defaultConfig = {
        size: 100,
        divisions: 10,
        colorCenterLine: '#444444',
        colorGrid: '#888888'
    };

    onMounted() {
        this.createGrid();
    }

    createGrid() {
        this.grid = new THREE.GridHelper(
            this.config.size,
            this.config.divisions,
            this.config.colorCenterLine,
            this.config.colorGrid
        );

        this.add(this.grid);
    }

    /**
     * English comment.
     */
    updateConfig(newConfig) {
        // English comment.
        Object.assign(this.config, newConfig);

        // English comment.
        if (this.grid) {
            this.remove(this.grid);
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }

        // English comment.
        this.createGrid();
    }

    onDispose() {
        if (this.grid) {
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }
    }
}

export default GridHelper;
