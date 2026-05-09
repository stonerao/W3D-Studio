import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * MarkArea 标注区域组件
 *
 * @class MarkArea
 * @extends Component
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
        // 默认水平放置
        this.area.rotation.x = -Math.PI / 2;
        this.add(this.area);
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        // 合并配置
        Object.assign(this.config, newConfig);

        // 移除旧的区域
        if (this.area) {
            this.remove(this.area);
            this.area.geometry.dispose();
            this.area.material.dispose();
        }

        // 重新创建
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
