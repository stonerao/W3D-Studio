import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class AreaBlock extends Component {
    static defaultConfig = {
        areas: [], // English comment.
        globalConfig: {
            // English comment.
            color: '#00ff00',
            showWall: true,
            showBottom: true,
            showBorder: true,
            wallHeight: 5,
            wallOpacity: 0.5,
            bottomOpacity: 0.5,
            borderWidth: 2,
            borderColor: null, // English comment.
            borderGlow: true,
            animationSpeed: 1.0,
            opacity: 0.5
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.areaBlocks = new Map();

        // English comment.
        this.areaDataMap = new Map();

        // English comment.
        this.clock = new THREE.Clock();
    }

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        // English comment.
        if (this.config.areas && this.config.areas.length > 0) {
            for (const areaData of this.config.areas) {
                await this.addArea(areaData);
            }
        }
    }

    /**
     * English comment.
     */
    onUpdate() {
        const delta = this.clock.getDelta();

        // English comment.
        this.areaBlocks.forEach((areaObject) => {
            this.updateAreaBlock(areaObject, delta);
        });
    }

    // English comment.

    /**
     * English comment.
     */
    createCloudShaderMaterial(config) {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2(1024, 1024) },
                color: { value: new THREE.Color(config.color || '#00ff00') },
                opacity: { value: config.wallOpacity || 0.5 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;

                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec2 resolution;
                uniform vec3 color;
                uniform float opacity;

                varying vec2 vUv;
                varying vec3 vPosition;

                // English comment.
                vec4 textureRND2D(vec2 uv) {
                    uv = floor(fract(uv) * 1e3);
                    float v = uv.x + uv.y * 1e3;
                    return fract(1e5 * sin(vec4(v * 1e-2, (v + 1.0) * 1e-2, (v + 1e3) * 1e-2, (v + 1e3 + 1.0) * 1e-2)));
                }

                // English comment.
                float noise(vec2 p) {
                    vec2 f = fract(p * 1e3);
                    vec4 r = textureRND2D(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
                }

                // English comment.
                float cloud(vec2 p) {
                    float v = 0.0;
                    v += noise(p * 1.0) * 0.50000;
                    v += noise(p * 2.0) * 0.2;
                    v += noise(p * 4.0) * 0.12500;
                    v += noise(p * 8.0) * 0.06250;
                    v += noise(p * 16.0) * 0.03125;
                    return v * v * v;
                }

                void main() {
                    vec2 p = vUv * 0.05 + 0.5;
                    vec3 c = vec3(0.0, 0.0, 0.2);

                    // English comment.
                    c.rgb += vec3(0.6, 0.6, 0.8) * cloud(p * 0.3 + time * 0.0002) * 0.6;
                    c.gbr += vec3(0.8, 0.8, 1.0) * cloud(p * 0.2 + time * 0.0002) * 0.8;
                    c.grb += vec3(1.0, 1.0, 1.0) * cloud(p * 0.1 + time * 0.0002) * 1.0;

                    // English comment.
                    vec3 finalColor = mix(c, color, 0.5);

                    gl_FragColor = vec4(finalColor, opacity);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }

    // English comment.

    /**
     * English comment.
     */
    createAreaBlock(points, config) {
        if (!points || points.length < 3) {
            console.warn('AreaBlock: Area block requires at least 3 points');
            return null;
        }

        const group = new THREE.Group();
        group.userData.type = 'areaBlock';

        // English comment.
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z);
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].z);
        }
        shape.lineTo(points[0].x, points[0].z); // English comment.

        // English comment.
        if (config.showWall !== false) {
            const wallHeight = config.wallHeight || 5;

            // English comment.
            const wallGeometry = new THREE.BufferGeometry();
            const vertices = [];
            const uvs = [];
            const indices = [];

            // English comment.
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];

                const baseIndex = i * 4;

                // English comment.
                vertices.push(
                    p1.x,
                    p1.y || 0,
                    p1.z,
                    p2.x,
                    p2.y || 0,
                    p2.z,
                    p1.x,
                    (p1.y || 0) + wallHeight,
                    p1.z,
                    p2.x,
                    (p2.y || 0) + wallHeight,
                    p2.z
                );

                // English comment.
                const segmentLength = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.z - p1.z, 2)
                );
                uvs.push(0, 0, segmentLength / wallHeight, 0, 0, 1, segmentLength / wallHeight, 1);

                // English comment.
                indices.push(
                    baseIndex,
                    baseIndex + 1,
                    baseIndex + 2,
                    baseIndex + 1,
                    baseIndex + 3,
                    baseIndex + 2
                );
            }

            wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            wallGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            wallGeometry.setIndex(indices);
            wallGeometry.computeVertexNormals();

            // English comment.
            const wallMaterial = this.createCloudShaderMaterial({
                ...config,
                opacity: config.wallOpacity || config.opacity || 0.5
            });
            const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
            wallMesh.userData.isWall = true;
            group.add(wallMesh);
        }

        // English comment.
        if (config.showBottom !== false) {
            // English comment.
            const bottomGeometry = new THREE.ShapeGeometry(shape);

            // English comment.
            const bottomMaterial = this.createCloudShaderMaterial({
                ...config,
                opacity: config.bottomOpacity || config.opacity || 0.5
            });

            const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
            bottomMesh.rotation.x = -Math.PI / 2; // English comment.
            bottomMesh.position.y = 0; // English comment.
            bottomMesh.userData.isBottom = true;
            group.add(bottomMesh);
        }

        // English comment.
        if (config.showBorder !== false) {
            const borderGeometry = new THREE.BufferGeometry();
            const borderVertices = [];

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                borderVertices.push(p.x, p.y || 0, p.z);
            }
            // English comment.
            borderVertices.push(points[0].x, points[0].y || 0, points[0].z);

            borderGeometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(borderVertices, 3)
            );

            const borderMaterial = new THREE.LineBasicMaterial({
                color: new THREE.Color(config.borderColor || config.color || '#00ff00'),
                linewidth: config.borderWidth || 2,
                transparent: true,
                opacity: config.opacity || 0.8
            });

            const borderLine = new THREE.Line(borderGeometry, borderMaterial);
            borderLine.userData.isBorder = true;
            group.add(borderLine);
        }

        // English comment.
        const interactionGeometry = new THREE.ShapeGeometry(shape);
        const interactionMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        const interactionMesh = new THREE.Mesh(interactionGeometry, interactionMaterial);
        interactionMesh.rotation.x = -Math.PI / 2; // English comment.
        interactionMesh.userData.isInteraction = true;
        interactionMesh.userData.areaId = config.id;
        group.add(interactionMesh);

        return group;
    }

    /**
     * English comment.
     */
    updateAreaBlock(areaObject, delta) {
        // English comment.
        areaObject.children.forEach((child) => {
            if ((child.userData.isWall || child.userData.isBottom) && child.material.uniforms) {
                child.material.uniforms.time.value += delta;
            }
        });
    }

    /**
     * English comment.
     */
    async addArea(areaData) {
        const { id, points, userData } = areaData;

        if (!id || !points || points.length < 3) {
            console.warn('AreaBlock: id and at least 3 points are required');
            return;
        }

        // English comment.
        if (this.areaBlocks.has(id)) {
            console.warn(`AreaBlock: Area with id "${id}" already exists`);
            return;
        }

        // English comment.
        const areaConfig = {
            ...this.globalConfig,
            ...areaData,
            id
        };

        // English comment.
        const areaObject = this.createAreaBlock(points, areaConfig);
        if (!areaObject) return;

        // English comment.
        areaObject.userData = {
            ...userData,
            areaId: id,
            isAreaBlock: true
        };

        // English comment.
        this.add(areaObject);

        // English comment.
        this.areaBlocks.set(id, areaObject);
        this.areaDataMap.set(id, areaData);

        // English comment.
        this.emit('areaAdded', { areaId: id, areaData });
    }

    /**
     * English comment.
     */
    removeArea(id) {
        const areaObject = this.areaBlocks.get(id);

        if (!areaObject) {
            console.warn(`AreaBlock: Area with id "${id}" not found`);
            return;
        }

        // English comment.
        areaObject.children.forEach((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                child.material.dispose();
            }
        });

        // English comment.
        this.remove(areaObject);

        // English comment.
        this.areaBlocks.delete(id);
        this.areaDataMap.delete(id);

        // English comment.
        this.emit('areaRemoved', { areaId: id });
    }

    /**
     * English comment.
     */
    getArea(id) {
        return this.areaDataMap.get(id) || null;
    }

    /**
     * English comment.
     */
    getAllAreas() {
        return Array.from(this.areaDataMap.values());
    }

    /**
     * English comment.
     */
    clearAreas() {
        const ids = Array.from(this.areaBlocks.keys());
        ids.forEach((id) => this.removeArea(id));
    }

    /**
     * English comment.
     */
    async updateConfig(newConfig) {
        // English comment.
        if (newConfig.globalConfig) {
            Object.assign(this.globalConfig, newConfig.globalConfig);
        }

        // English comment.
        if (newConfig.areas) {
            this.clearAreas();
            this.config.areas = newConfig.areas;
            for (const areaData of newConfig.areas) {
                await this.addArea(areaData);
            }
        }
    }

    async updateData(data, options = {}) {
        const patch = options && typeof options === 'object' && options.config && typeof options.config === 'object'
            ? { ...options.config }
            : {};

        if (Array.isArray(data)) {
            patch.areas = data;
        } else if (data && typeof data === 'object') {
            patch.areas = Array.isArray(data.areas) ? data.areas : [];
        } else {
            patch.areas = [];
        }

        await this.updateConfig(patch);
        return {
            success: true,
            count: Array.isArray(patch.areas) ? patch.areas.length : 0
        };
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.clearAreas();
    }
}

export default AreaBlock;
