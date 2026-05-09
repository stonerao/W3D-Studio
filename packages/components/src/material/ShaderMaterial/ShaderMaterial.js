import { Component } from '@w3d/core';
import * as THREE from 'three';
import {
    createPresetMaterial,
    hasPreset,
    getPresetDefaults,
    getAvailablePresets
} from './presets/index.js';

/**
 * English comment.
 */
export class ShaderMaterial extends Component {
    static defaultConfig = {
        // English comment.
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.materials = new Map();

        // English comment.
        this.time = 0;
    }

    /**
     * English comment.
     */
    onMounted() {
        this.emit('mounted', {
            name: this.name
        });
    }

    /**
     * English comment.
     */
    onUpdate(delta) {
        // English comment.
        this.time += delta;

        // English comment.
        this.materials.forEach((material) => {
            if (material.uniforms && material.uniforms.time) {
                material.uniforms.time.value = this.time;
            }
        });
    }

    /**
     * English comment.
     */
    createMaterial(name, config = {}) {
        if (!name) {
            // eslint-disable-next-line no-console
            console.error('ShaderMaterial: 材质名称不能为空');
            return null;
        }

        if (this.materials.has(name)) {
            // eslint-disable-next-line no-console
            console.warn(`ShaderMaterial: 材质 "${name}" 已存在，将被覆盖`);
            // English comment.
            const oldMaterial = this.materials.get(name);
            oldMaterial.dispose();
        }

        // English comment.
        let finalConfig = config;
        if (config.preset) {
            const presetConfig = createPresetMaterial(config.preset, config);
            if (!presetConfig) {
                // eslint-disable-next-line no-console
                console.error(
                    `ShaderMaterial: 预设材质 "${config.preset}" 不存在。可用预设: ${getAvailablePresets().join(', ')}`
                );
                return null;
            }
            // English comment.
            finalConfig = { ...presetConfig, ...config };
        }

        // English comment.
        const material = new THREE.ShaderMaterial({
            vertexShader: finalConfig.vertexShader || this.getDefaultVertexShader(),
            fragmentShader: finalConfig.fragmentShader || this.getDefaultFragmentShader(),
            uniforms: finalConfig.uniforms || {},
            transparent: finalConfig.transparent !== undefined ? finalConfig.transparent : false,
            side: finalConfig.side !== undefined ? finalConfig.side : THREE.FrontSide,
            wireframe: finalConfig.wireframe !== undefined ? finalConfig.wireframe : false,
            depthTest: finalConfig.depthTest !== undefined ? finalConfig.depthTest : true,
            depthWrite: finalConfig.depthWrite !== undefined ? finalConfig.depthWrite : true
        });

        // English comment.
        this.materials.set(name, material);

        // English comment.
        this.emit('materialCreated', {
            name,
            material
        });

        return material;
    }

    /**
     * English comment.
     */
    getMaterial(name, params) {
        // English comment.
        if (this.materials.has(name)) {
            const material = this.materials.get(name);

            // English comment.
            if (params) {
                Object.keys(params).forEach((key) => {
                    if (material.uniforms && material.uniforms[key]) {
                        const value = params[key];
                        // English comment.
                        if (
                            typeof value === 'string' &&
                            (value.startsWith('#') || value.startsWith('rgb'))
                        ) {
                            material.uniforms[key].value = new THREE.Color(value);
                        } else {
                            material.uniforms[key].value = value;
                        }
                    }
                });
            }

            return material;
        }

        // English comment.
        if (params !== undefined && hasPreset(name)) {
            // English comment.
            return this.createMaterial(name, {
                preset: name,
                ...params
            });
        }

        // English comment.
        if (params === undefined) {
            // eslint-disable-next-line no-console
            console.warn(`ShaderMaterial: 材质 "${name}" 不存在`);
        } else {
            // eslint-disable-next-line no-console
            console.warn(
                `ShaderMaterial: 材质 "${name}" 不存在，且不是有效的预设材质。可用预设: ${getAvailablePresets().join(', ')}`
            );
        }

        return null;
    }

    /**
     * English comment.
     */
    removeMaterial(name) {
        if (!this.materials.has(name)) {
            // eslint-disable-next-line no-console
            console.warn(`ShaderMaterial: 材质 "${name}" 不存在`);
            return false;
        }

        const material = this.materials.get(name);
        material.dispose();
        this.materials.delete(name);

        // English comment.
        this.emit('materialRemoved', {
            name
        });

        return true;
    }

    /**
     * English comment.
     */
    getAllMaterials() {
        const result = [];
        this.materials.forEach((material, name) => {
            result.push({ name, material });
        });
        return result;
    }

    /**
     * English comment.
     */
    updateUniform(name, uniformName, value) {
        const material = this.getMaterial(name);
        if (!material) {
            return false;
        }

        if (!material.uniforms[uniformName]) {
            // eslint-disable-next-line no-console
            console.warn(`ShaderMaterial: 材质 "${name}" 中不存在 uniform "${uniformName}"`);
            return false;
        }

        material.uniforms[uniformName].value = value;

        // English comment.
        this.emit('uniformUpdated', {
            materialName: name,
            uniformName,
            value
        });

        return true;
    }

    /**
     * English comment.
     */
    getAvailablePresets() {
        return getAvailablePresets();
    }

    /**
     * English comment.
     */
    getPresetDefaults(presetName) {
        return getPresetDefaults(presetName);
    }

    /**
     * English comment.
     */
    getDefaultVertexShader() {
        return `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    /**
     * English comment.
     */
    getDefaultFragmentShader() {
        return `
            varying vec2 vUv;
            void main() {
                gl_FragColor = vec4(vUv.x, vUv.y, 0.5, 1.0);
            }
        `;
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.materials.forEach((material) => {
            material.dispose();
        });
        this.materials.clear();

        this.emit('disposed');
    }
}
