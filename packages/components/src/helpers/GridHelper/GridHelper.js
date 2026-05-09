import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Helpers module component that adds a configurable ground grid to support scene scale and orientation.
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

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);

        if (this.grid) {
            this.remove(this.grid);
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }

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
