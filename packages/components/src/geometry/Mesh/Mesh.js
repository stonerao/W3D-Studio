import { Component } from '@w3d/core';
import * as THREE from 'three';
import {
    createPresetMaterial,
    getAvailablePresets
} from '../../material/ShaderMaterial/presets/index.js';

/**
 * Geometry module component that creates basic mesh primitives with configurable geometry, material, and transform data.
 */
export class Mesh extends Component {
    static defaultConfig = {
        type: 'Box',

        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],

        width: 1,
        height: 1,
        depth: 1,
        widthSegments: 1,
        heightSegments: 1,
        depthSegments: 1,

        radius: 1,
        // widthSegments: 32,
        // heightSegments: 32,
        phiStart: 0,
        phiLength: Math.PI * 2,
        sphereThetaStart: 0,
        sphereThetaLength: Math.PI,

        radiusTop: 1,
        radiusBottom: 1,
        // height: 1,
        radialSegments: 32,
        // heightSegments: 1,
        openEnded: false,
        thetaStart: 0,
        thetaLength: Math.PI * 2,

        // radius: 1,
        // height: 1,
        // radialSegments: 32,
        // heightSegments: 1,
        // openEnded: false,
        // thetaStart: 0,
        // thetaLength: Math.PI * 2,

        // width: 1,
        // height: 1,
        // widthSegments: 1,
        // heightSegments: 1,

        // radius: 1,
        tube: 0.4,
        // radialSegments: 16,
        tubularSegments: 100,
        arc: Math.PI * 2,

        // radius: 1,
        // tube: 0.4,
        // tubularSegments: 64,
        // radialSegments: 8,
        p: 2,
        q: 3,

        // radius: 1,
        detail: 0,

        materialType: 'standard',

        shaderPreset: 'basicColor',

        material: {
            color: '#00ff00',
            wireframe: false,
            transparent: false,
            opacity: 1.0,
            metalness: 0.5,
            roughness: 0.5,
            emissive: '#000000',
            emissiveIntensity: 0,
            side: THREE.FrontSide // FrontSide, BackSide, DoubleSide
        },

        shaderUniforms: {
            // basicColor: { color: '#00ff00' }
            // gradient: { color1: '#ff0000', color2: '#0000ff' }
            // animated: { color: '#00ff00', speed: 1.0 }
            // diffusion: { uBaseColor: '#3319cc', uSpeed: 1.0, uIntensity: 1.0 }
        },

        castShadow: true,
        receiveShadow: true
    };

    onCreate() {
        console.log(`[Mesh] 创建几何体组件: ${this.config.type}`);

        try {
            this.geometry = this.createGeometry();

            this.material = this.createMaterial();

            this.mesh = new THREE.Mesh(this.geometry, this.material);
            this.mesh.name = this.config.name || `mesh_${this.config.type}`;

            this.componentScene.add(this.mesh);

            console.log(`[Mesh] 几何体创建成功: ${this.config.type}`);
        } catch (error) {
            console.error('[Mesh] 创建几何体失败:', error);
            throw error;
        }
    }

    onMounted() {
        if (this.config.position) {
            const [x, y, z] = this.config.position;
            this.mesh.position.set(x, y, z);
        }

        if (this.config.rotation) {
            const [x, y, z] = this.config.rotation;
            this.mesh.rotation.set(x, y, z);
        }

        if (this.config.scale) {
            if (Array.isArray(this.config.scale)) {
                const [x, y, z] = this.config.scale;
                this.mesh.scale.set(x, y, z);
            } else {
                this.mesh.scale.setScalar(this.config.scale);
            }
        }

        this.mesh.castShadow = this.config.castShadow;
        this.mesh.receiveShadow = this.config.receiveShadow;

        console.log('[Mesh] 组件挂载完成');
    }

    onUpdate(delta) {
        if (this.config.materialType === 'shader' && this.material && this.material.uniforms) {
            if (this.material.uniforms.time) {
                this.shaderTime = (this.shaderTime || 0) + delta;
                this.material.uniforms.time.value = this.shaderTime;
            }
        }
    }

    createGeometry() {
        const { type } = this.config;

        switch (type) {
        case 'Plane':
            return new THREE.PlaneGeometry(
                this.config.width,
                this.config.height,
                this.config.widthSegments,
                this.config.heightSegments
            );

        case 'Box':
            return new THREE.BoxGeometry(
                this.config.width,
                this.config.height,
                this.config.depth,
                this.config.widthSegments,
                this.config.heightSegments,
                this.config.depthSegments
            );

        case 'Sphere':
            return new THREE.SphereGeometry(
                this.config.radius,
                this.config.widthSegments || 32,
                this.config.heightSegments || 32,
                this.config.phiStart,
                this.config.phiLength,
                this.config.sphereThetaStart ?? this.config.thetaStart,
                this.config.sphereThetaLength ?? this.config.thetaLength
            );

        case 'Cylinder':
            return new THREE.CylinderGeometry(
                this.config.radiusTop,
                this.config.radiusBottom,
                this.config.height,
                this.config.radialSegments,
                this.config.heightSegments,
                this.config.openEnded,
                this.config.thetaStart,
                this.config.thetaLength
            );

        case 'Cone':
            return new THREE.ConeGeometry(
                this.config.radius,
                this.config.height,
                this.config.radialSegments || 32,
                this.config.heightSegments || 1,
                this.config.openEnded,
                this.config.thetaStart,
                this.config.thetaLength
            );

        case 'Torus':
            return new THREE.TorusGeometry(
                this.config.radius,
                this.config.tube,
                this.config.radialSegments || 16,
                this.config.tubularSegments,
                this.config.arc
            );

        case 'TorusKnot':
            return new THREE.TorusKnotGeometry(
                this.config.radius,
                this.config.tube,
                this.config.tubularSegments || 64,
                this.config.radialSegments || 8,
                this.config.p,
                this.config.q
            );

        case 'Dodecahedron':
            return new THREE.DodecahedronGeometry(this.config.radius, this.config.detail);

        case 'Icosahedron':
            return new THREE.IcosahedronGeometry(this.config.radius, this.config.detail);

        case 'Octahedron':
            return new THREE.OctahedronGeometry(this.config.radius, this.config.detail);

        case 'Tetrahedron':
            return new THREE.TetrahedronGeometry(this.config.radius, this.config.detail);

        default:
            console.warn(`[Mesh] 未知的几何体类型: ${type}，使用默认 Box`);
            return new THREE.BoxGeometry(1, 1, 1);
        }
    }

    createMaterial() {
        const { materialType } = this.config;

        if (materialType === 'shader') {
            return this.createShaderMaterial();
        } else {
            return this.createStandardMaterial();
        }
    }

    createStandardMaterial() {
        const mat = this.config.material;

        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(mat.color),
            wireframe: mat.wireframe,
            transparent: mat.transparent,
            opacity: mat.opacity,
            metalness: mat.metalness,
            roughness: mat.roughness,
            emissive: new THREE.Color(mat.emissive),
            emissiveIntensity: mat.emissiveIntensity,
            side: mat.side
        });
    }

    createShaderMaterial() {
        const { shaderPreset, shaderUniforms } = this.config;

        const presetConfig = createPresetMaterial(shaderPreset, shaderUniforms || {});

        if (!presetConfig) {
            console.warn(
                `[Mesh] 着色器预设 "${shaderPreset}" 不存在，使用默认标准材质。可用预设: ${getAvailablePresets().join(', ')}`
            );
            return this.createStandardMaterial();
        }

        const material = new THREE.ShaderMaterial({
            vertexShader: presetConfig.vertexShader,
            fragmentShader: presetConfig.fragmentShader,
            uniforms: presetConfig.uniforms || {},
            transparent: presetConfig.transparent !== undefined ? presetConfig.transparent : false,
            side: presetConfig.side !== undefined ? presetConfig.side : THREE.FrontSide,
            wireframe: presetConfig.wireframe !== undefined ? presetConfig.wireframe : false,
            depthTest: presetConfig.depthTest !== undefined ? presetConfig.depthTest : true,
            depthWrite: presetConfig.depthWrite !== undefined ? presetConfig.depthWrite : true
        });

        this.shaderTime = 0;

        return material;
    }

    updateGeometry(params) {
        Object.assign(this.config, params);

        if (this.geometry) {
            this.geometry.dispose();
        }

        this.geometry = this.createGeometry();
        this.mesh.geometry = this.geometry;

        console.log('[Mesh] 几何体参数已更新');
    }

    updateMaterial(params) {
        const { materialType } = this.config;

        if (materialType === 'shader') {
            this.updateShaderMaterial(params);
        } else {
            this.updateStandardMaterial(params);
        }

        console.log('[Mesh] 材质参数已更新');
    }

    updateStandardMaterial(params) {
        if (!this.material) {
            console.warn('[Mesh] 材质未初始化,无法更新');
            return;
        }

        if (!(this.material instanceof THREE.MeshStandardMaterial)) {
            console.warn('[Mesh] 当前材质不是 MeshStandardMaterial,无法更新标准材质参数');
            return;
        }

        Object.assign(this.config.material, params);

        if (params.color !== undefined) {
            this.material.color.set(params.color);
        }
        if (params.wireframe !== undefined) {
            this.material.wireframe = params.wireframe;
        }
        if (params.transparent !== undefined) {
            this.material.transparent = params.transparent;
        }
        if (params.opacity !== undefined) {
            this.material.opacity = params.opacity;
        }
        if (params.metalness !== undefined) {
            this.material.metalness = params.metalness;
        }
        if (params.roughness !== undefined) {
            this.material.roughness = params.roughness;
        }
        if (params.emissive !== undefined) {
            this.material.emissive.set(params.emissive);
        }
        if (params.emissiveIntensity !== undefined) {
            this.material.emissiveIntensity = params.emissiveIntensity;
        }
        if (params.side !== undefined) {
            this.material.side = params.side;
        }

        this.material.needsUpdate = true;

        console.log('[Mesh] 标准材质参数已更新:', params);
    }

    updateShaderMaterial(params) {
        Object.assign(this.config.shaderUniforms, params);

        if (!this.material || !this.material.uniforms) {
            console.warn('[Mesh] 着色器材质未初始化');
            return;
        }

        Object.keys(params).forEach((key) => {
            if (this.material.uniforms[key]) {
                const value = params[key];
                if (
                    typeof value === 'string' &&
                    (value.startsWith('#') || value.startsWith('rgb'))
                ) {
                    this.material.uniforms[key].value = new THREE.Color(value);
                } else {
                    this.material.uniforms[key].value = value;
                }
            }
        });

        this.material.needsUpdate = true;
    }

    switchMaterialType(materialType, options = {}) {
        if (this.config.materialType === materialType) {
            console.log(`[Mesh] 材质类型已经是 ${materialType}`);
            return;
        }

        this.config.materialType = materialType;

        if (materialType === 'shader' && options.shaderPreset) {
            this.config.shaderPreset = options.shaderPreset;
        }

        if (options.shaderUniforms) {
            this.config.shaderUniforms = {
                ...this.config.shaderUniforms,
                ...options.shaderUniforms
            };
        }

        if (this.material) {
            this.material.dispose();
        }

        this.material = this.createMaterial();
        this.mesh.material = this.material;

        console.log(`[Mesh] 材质类型已切换为: ${materialType}`);
    }

    updateShaderPreset(preset, uniforms = {}) {
        if (this.config.materialType !== 'shader') {
            console.warn('[Mesh] 当前不是着色器材质，无法更新预设');
            return;
        }

        this.config.shaderPreset = preset;
        this.config.shaderUniforms = { ...this.config.shaderUniforms, ...uniforms };

        if (this.material) {
            this.material.dispose();
        }

        this.material = this.createShaderMaterial();
        this.mesh.material = this.material;

        console.log(`[Mesh] 着色器预设已更新为: ${preset}`);
    }

    onDispose() {
        console.log('[Mesh] 销毁几何体组件');

        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        if (this.material) {
            this.material.dispose();
            this.material = null;
        }

        if (this.mesh) {
            this.componentScene.remove(this.mesh);
            this.mesh = null;
        }
    }

    getInteractiveObjects() {
        return this.mesh ? [this.mesh] : [];
    }
}
