import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * GridHelper 网格辅助组件
 *
 * @class GridHelper
 * @extends Component
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
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        // 合并配置
        Object.assign(this.config, newConfig);

        // 移除旧的网格
        if (this.grid) {
            this.remove(this.grid);
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }

        // 重新创建
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
