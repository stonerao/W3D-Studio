import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class Pipeline extends Component {
    static defaultConfig = {
        pipelines: [], // English comment.
        globalConfig: {
            // English comment.
            radius: 0.5, // English comment.
            color: '#00ff00', // English comment.
            opacity: 0.8, // English comment.
            segments: 64, // English comment.
            radialSegments: 8, // English comment.
            materialType: 'standard', // English comment.
            progress: 100, // English comment.
            flow: {
                enabled: false, // English comment.
                speed: 1.0, // English comment.
                color: '#ffffff', // English comment.
                width: 0.2, // English comment.
                intensity: 1.5 // English comment.
            }
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.pipelines = new Map();

        // English comment.
        this.pipelineDataMap = new Map();

        // English comment.
        this.flowTime = 0;
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
        if (this.config.pipelines && this.config.pipelines.length > 0) {
            for (const pipelineData of this.config.pipelines) {
                await this.addPipeline(pipelineData);
            }
        }
    }

    // English comment.

    /**
     * English comment.
     */
    createPipeline(pipelineData) {
        const {
            id,
            points,
            radius,
            color,
            opacity,
            segments,
            radialSegments,
            materialType,
            progress,
            flow
        } = pipelineData;

        // English comment.
        if (!id || !points || points.length < 2) {
            console.warn('Pipeline: id and at least 2 points are required');
            return null;
        }

        // English comment.
        const pathPoints = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const curve = new THREE.CatmullRomCurve3(pathPoints);

        // English comment.
        const geometry = new THREE.TubeGeometry(
            curve,
            segments || this.globalConfig.segments,
            radius || this.globalConfig.radius,
            radialSegments || this.globalConfig.radialSegments,
            false // English comment.
        );

        // English comment.
        const material = this.createMaterial(pipelineData);

        // English comment.
        const mesh = new THREE.Mesh(geometry, material);

        // English comment.
        mesh.userData = {
            pipelineId: id,
            isPipeline: true,
            curve,
            progress: progress !== undefined ? progress : this.globalConfig.progress,
            flow: flow || this.globalConfig.flow
        };

        // English comment.
        this.applyProgress(mesh, mesh.userData.progress);

        return mesh;
    }

    /**
     * English comment.
     */
    createMaterial(pipelineData) {
        const { color, opacity, materialType, flow } = pipelineData;

        const finalColor = color || this.globalConfig.color;
        const finalOpacity = opacity !== undefined ? opacity : this.globalConfig.opacity;
        const finalMaterialType = materialType || this.globalConfig.materialType;
        const finalFlow = flow || this.globalConfig.flow;

        // English comment.
        if (finalFlow.enabled) {
            return this.createFlowMaterial(finalColor, finalOpacity, finalFlow);
        }

        // English comment.
        const materialConfig = {
            color: new THREE.Color(finalColor),
            transparent: finalOpacity < 1,
            opacity: finalOpacity,
            side: THREE.DoubleSide
        };

        switch (finalMaterialType) {
            case 'basic':
                return new THREE.MeshBasicMaterial(materialConfig);
            case 'phong':
                return new THREE.MeshPhongMaterial(materialConfig);
            case 'standard':
            default:
                return new THREE.MeshStandardMaterial({
                    ...materialConfig,
                    metalness: 0.3,
                    roughness: 0.7
                });
        }
    }

    /**
     * English comment.
     */
    createFlowMaterial(color, opacity, flowConfig) {
        const { speed, color: flowColor, width, intensity } = flowConfig;

        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: new THREE.Color(color) },
                flowColor: { value: new THREE.Color(flowColor || '#ffffff') },
                opacity: { value: opacity },
                flowSpeed: { value: speed || 1.0 },
                flowWidth: { value: width || 0.2 },
                flowIntensity: { value: intensity || 1.5 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 baseColor;
                uniform vec3 flowColor;
                uniform float opacity;
                uniform float flowSpeed;
                uniform float flowWidth;
                uniform float flowIntensity;

                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    // English comment.
                    vec3 color = baseColor;

                    // English comment.
                    float flowPos = mod(vUv.x + time * flowSpeed * 0.1, 1.0);

                    // English comment.
                    float flowMask = smoothstep(0.0, flowWidth * 0.5, flowPos) *
                                     smoothstep(flowWidth, flowWidth * 0.5, flowPos);

                    // English comment.
                    color = mix(color, flowColor, flowMask * flowIntensity);

                    // English comment.
                    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                    color += flowColor * fresnel * 0.3;

                    gl_FragColor = vec4(color, opacity);
                }
            `,
            transparent: opacity < 1,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }

    /**
     * English comment.
     */
    applyProgress(mesh, progress) {
        const geometry = mesh.geometry;
        const totalVertices = geometry.attributes.position.count;

        // English comment.
        const visibleVertices = Math.floor((totalVertices * progress) / 100);

        // English comment.
        geometry.setDrawRange(0, visibleVertices);
    }

    // English comment.

    /**
     * English comment.
     */
    async addPipeline(pipelineData) {
        const { id } = pipelineData;

        if (!id) {
            console.warn('Pipeline: id is required');
            return;
        }

        // English comment.
        if (this.pipelines.has(id)) {
            console.warn(`Pipeline: Pipeline with id "${id}" already exists`);
            return;
        }

        // English comment.
        const finalData = {
            ...this.globalConfig,
            ...pipelineData,
            id
        };

        // English comment.
        const pipelineObject = this.createPipeline(finalData);

        if (!pipelineObject) {
            return;
        }

        // English comment.
        this.add(pipelineObject);

        // English comment.
        this.pipelines.set(id, pipelineObject);
        this.pipelineDataMap.set(id, finalData);

        // English comment.
        this.emit('pipelineAdded', { pipelineId: id, pipelineData: finalData });
    }

    /**
     * English comment.
     */
    removePipeline(id) {
        const pipelineObject = this.pipelines.get(id);

        if (!pipelineObject) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        // English comment.
        this.remove(pipelineObject);

        // English comment.
        if (pipelineObject.geometry) {
            pipelineObject.geometry.dispose();
        }
        if (pipelineObject.material) {
            pipelineObject.material.dispose();
        }

        // English comment.
        this.pipelines.delete(id);
        this.pipelineDataMap.delete(id);

        // English comment.
        this.emit('pipelineRemoved', { pipelineId: id });
    }

    /**
     * English comment.
     */
    updateProgress(id, progress) {
        const pipelineObject = this.pipelines.get(id);
        const pipelineData = this.pipelineDataMap.get(id);

        if (!pipelineObject || !pipelineData) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        // English comment.
        const clampedProgress = Math.max(0, Math.min(100, progress));

        // English comment.
        this.applyProgress(pipelineObject, clampedProgress);

        // English comment.
        pipelineObject.userData.progress = clampedProgress;
        pipelineData.progress = clampedProgress;

        // English comment.
        this.emit('progressUpdated', {
            pipelineId: id,
            progress: clampedProgress
        });
    }

    /**
     * English comment.
     */
    updateFlow(id, flowConfig) {
        const pipelineObject = this.pipelines.get(id);
        const pipelineData = this.pipelineDataMap.get(id);

        if (!pipelineObject || !pipelineData) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        // English comment.
        const newFlowConfig = {
            ...pipelineObject.userData.flow,
            ...flowConfig
        };

        pipelineObject.userData.flow = newFlowConfig;
        pipelineData.flow = newFlowConfig;

        // English comment.
        if (pipelineObject.material.uniforms) {
            const { speed, color, width, intensity } = newFlowConfig;

            if (speed !== undefined) {
                pipelineObject.material.uniforms.flowSpeed.value = speed;
            }
            if (color !== undefined) {
                pipelineObject.material.uniforms.flowColor.value = new THREE.Color(color);
            }
            if (width !== undefined) {
                pipelineObject.material.uniforms.flowWidth.value = width;
            }
            if (intensity !== undefined) {
                pipelineObject.material.uniforms.flowIntensity.value = intensity;
            }
        }

        // English comment.
        this.emit('flowUpdated', {
            pipelineId: id,
            flowConfig: newFlowConfig
        });
    }

    /**
     * English comment.
     */
    updatePipeline(id, updates) {
        const pipelineData = this.pipelineDataMap.get(id);

        if (!pipelineData) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        // English comment.
        this.removePipeline(id);

        // English comment.
        const newData = {
            ...pipelineData,
            ...updates,
            id
        };

        this.addPipeline(newData);
    }

    /**
     * English comment.
     */
    getPipeline(id) {
        return this.pipelineDataMap.get(id) || null;
    }

    /**
     * English comment.
     */
    getAllPipelines() {
        return Array.from(this.pipelineDataMap.values());
    }

    /**
     * English comment.
     */
    clearPipelines() {
        const ids = Array.from(this.pipelines.keys());
        ids.forEach((id) => this.removePipeline(id));

        this.emit('pipelinesCleared');
    }

    // English comment.

    /**
     * English comment.
     */
    onUpdate(delta) {
        // English comment.
        this.flowTime += delta;

        // English comment.
        this.pipelines.forEach((pipelineObject) => {
            if (pipelineObject.userData.flow?.enabled && pipelineObject.material.uniforms) {
                pipelineObject.material.uniforms.time.value = this.flowTime;
            }
        });
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.clearPipelines();
    }
}
