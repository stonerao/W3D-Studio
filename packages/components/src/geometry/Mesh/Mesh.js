import { Component } from '@w3d/core';
import * as THREE from 'three';
import {
    createPresetMaterial,
    getAvailablePresets
} from '../../material/ShaderMaterial/presets/index.js';

/**
 * English comment.
 */
export class Mesh extends Component {
    static defaultConfig = {
        // English comment.
        type: 'Box',

        // English comment.
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],

        // English comment.
        width: 1,
        height: 1,
        depth: 1,
        widthSegments: 1,
        heightSegments: 1,
        depthSegments: 1,

        // English comment.
        radius: 1,
        // widthSegments: 32,
        // heightSegments: 32,
        phiStart: 0,
        phiLength: Math.PI * 2,
        sphereThetaStart: 0,
        sphereThetaLength: Math.PI,

        // English comment.
        radiusTop: 1,
        radiusBottom: 1,
        // height: 1,
        radialSegments: 32,
        // heightSegments: 1,
        openEnded: false,
        thetaStart: 0,
        thetaLength: Math.PI * 2,

        // English comment.
        // radius: 1,
        // height: 1,
        // radialSegments: 32,
        // heightSegments: 1,
        // openEnded: false,
        // thetaStart: 0,
        // thetaLength: Math.PI * 2,

        // English comment.
        // width: 1,
        // height: 1,
        // widthSegments: 1,
        // heightSegments: 1,

        // English comment.
        // radius: 1,
        tube: 0.4,
        // radialSegments: 16,
        tubularSegments: 100,
        arc: Math.PI * 2,

        // English comment.
        // radius: 1,
        // tube: 0.4,
        // tubularSegments: 64,
        // radialSegments: 8,
        p: 2,
        q: 3,

        // English comment.
        // radius: 1,
        detail: 0,

        // English comment.
        materialType: 'standard',

        // English comment.
        shaderPreset: 'basicColor',

        // English comment.
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

        // English comment.
        shaderUniforms: {
            // English comment.
            // basicColor: { color: '#00ff00' }
            // gradient: { color1: '#ff0000', color2: '#0000ff' }
            // animated: { color: '#00ff00', speed: 1.0 }
            // diffusion: { uBaseColor: '#3319cc', uSpeed: 1.0, uIntensity: 1.0 }
        },

        // English comment.
        castShadow: true,
        receiveShadow: true
    };

    /**
     * English comment.
     */
    onCreate() {
        console.log(`[Mesh] 创建几何体组件: ${this.config.type}`);

        try {
            // English comment.
            this.geometry = this.createGeometry();

            // English comment.
            this.material = this.createMaterial();

            // English comment.
            this.mesh = new THREE.Mesh(this.geometry, this.material);
            this.mesh.name = this.config.name || `mesh_${this.config.type}`;

            // English comment.
            this.componentScene.add(this.mesh);

            console.log(`[Mesh] 几何体创建成功: ${this.config.type}`);
        } catch (error) {
            console.error('[Mesh] 创建几何体失败:', error);
            throw error;
        }
    }

    /**
     * English comment.
     */
    onMounted() {
        // English comment.
        if (this.config.position) {
            const [x, y, z] = this.config.position;
            this.mesh.position.set(x, y, z);
        }

        // English comment.
        if (this.config.rotation) {
            const [x, y, z] = this.config.rotation;
            this.mesh.rotation.set(x, y, z);
        }

        // English comment.
        if (this.config.scale) {
            if (Array.isArray(this.config.scale)) {
                const [x, y, z] = this.config.scale;
                this.mesh.scale.set(x, y, z);
            } else {
                this.mesh.scale.setScalar(this.config.scale);
            }
        }

        // English comment.
        this.mesh.castShadow = this.config.castShadow;
        this.mesh.receiveShadow = this.config.receiveShadow;

        console.log('[Mesh] 组件挂载完成');
    }

    /**
     * English comment.
     */
    onUpdate(delta) {
        // English comment.
        if (this.config.materialType === 'shader' && this.material && this.material.uniforms) {
            if (this.material.uniforms.time) {
                this.shaderTime = (this.shaderTime || 0) + delta;
                this.material.uniforms.time.value = this.shaderTime;
            }
        }
    }

    /**
     * English comment.
     */
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

    /**
     * English comment.
     */
    createMaterial() {
        const { materialType } = this.config;

        if (materialType === 'shader') {
            return this.createShaderMaterial();
        } else {
            return this.createStandardMaterial();
        }
    }

    /**
     * English comment.
     */
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

    /**
     * English comment.
     */
    createShaderMaterial() {
        const { shaderPreset, shaderUniforms } = this.config;

        // English comment.
        const presetConfig = createPresetMaterial(shaderPreset, shaderUniforms || {});

        if (!presetConfig) {
            console.warn(
                `[Mesh] 着色器预设 "${shaderPreset}" 不存在，使用默认标准材质。可用预设: ${getAvailablePresets().join(', ')}`
            );
            return this.createStandardMaterial();
        }

        // English comment.
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

        // English comment.
        this.shaderTime = 0;

        return material;
    }

    /**
     * English comment.
     */
    updateGeometry(params) {
        // English comment.
        Object.assign(this.config, params);

        // English comment.
        if (this.geometry) {
            this.geometry.dispose();
        }

        // English comment.
        this.geometry = this.createGeometry();
        this.mesh.geometry = this.geometry;

        console.log('[Mesh] 几何体参数已更新');
    }

    /**
     * English comment.
     */
    updateMaterial(params) {
        const { materialType } = this.config;

        if (materialType === 'shader') {
            // English comment.
            this.updateShaderMaterial(params);
        } else {
            // English comment.
            this.updateStandardMaterial(params);
        }

        console.log('[Mesh] 材质参数已更新');
    }

    /**
     * English comment.
     */
    updateStandardMaterial(params) {
        // English comment.
        if (!this.material) {
            console.warn('[Mesh] 材质未初始化,无法更新');
            return;
        }

        // English comment.
        if (!(this.material instanceof THREE.MeshStandardMaterial)) {
            console.warn('[Mesh] 当前材质不是 MeshStandardMaterial,无法更新标准材质参数');
            return;
        }

        // English comment.
        Object.assign(this.config.material, params);

        // English comment.
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

        // English comment.
        this.material.needsUpdate = true;

        console.log('[Mesh] 标准材质参数已更新:', params);
    }

    /**
     * English comment.
     */
    updateShaderMaterial(params) {
        Object.assign(this.config.shaderUniforms, params);

        if (!this.material || !this.material.uniforms) {
            console.warn('[Mesh] 着色器材质未初始化');
            return;
        }

        // English comment.
        Object.keys(params).forEach((key) => {
            if (this.material.uniforms[key]) {
                const value = params[key];
                // English comment.
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

    /**
     * English comment.
     */
    switchMaterialType(materialType, options = {}) {
        if (this.config.materialType === materialType) {
            console.log(`[Mesh] 材质类型已经是 ${materialType}`);
            return;
        }

        // English comment.
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

        // English comment.
        if (this.material) {
            this.material.dispose();
        }

        // English comment.
        this.material = this.createMaterial();
        this.mesh.material = this.material;

        console.log(`[Mesh] 材质类型已切换为: ${materialType}`);
    }

    /**
     * English comment.
     */
    updateShaderPreset(preset, uniforms = {}) {
        if (this.config.materialType !== 'shader') {
            console.warn('[Mesh] 当前不是着色器材质，无法更新预设');
            return;
        }

        this.config.shaderPreset = preset;
        this.config.shaderUniforms = { ...this.config.shaderUniforms, ...uniforms };

        // English comment.
        if (this.material) {
            this.material.dispose();
        }

        // English comment.
        this.material = this.createShaderMaterial();
        this.mesh.material = this.material;

        console.log(`[Mesh] 着色器预设已更新为: ${preset}`);
    }

    /**
     * English comment.
     */
    onDispose() {
        console.log('[Mesh] 销毁几何体组件');

        // English comment.
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        // English comment.
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }

        // English comment.
        if (this.mesh) {
            this.componentScene.remove(this.mesh);
            this.mesh = null;
        }
    }

    /**
     * English comment.
     */
    getInteractiveObjects() {
        return this.mesh ? [this.mesh] : [];
    }
}
