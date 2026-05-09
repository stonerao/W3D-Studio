import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Effects module component that renders pipeline geometry and flow-style visual feedback.
 */
export class Pipeline extends Component {
    static defaultConfig = {
        pipelines: [],
        globalConfig: {
            radius: 0.5,
            color: '#00ff00',
            opacity: 0.8,
            segments: 64,
            radialSegments: 8,
            materialType: 'standard',
            progress: 100,
            flow: {
                enabled: false,
                speed: 1.0,
                color: '#ffffff',
                width: 0.2,
                intensity: 1.5
            }
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.pipelines = new Map();

        this.pipelineDataMap = new Map();

        this.flowTime = 0;
    }

    async onMounted() {
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        if (this.config.pipelines && this.config.pipelines.length > 0) {
            for (const pipelineData of this.config.pipelines) {
                await this.addPipeline(pipelineData);
            }
        }
    }


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

        if (!id || !points || points.length < 2) {
            console.warn('Pipeline: id and at least 2 points are required');
            return null;
        }

        const pathPoints = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const curve = new THREE.CatmullRomCurve3(pathPoints);

        const geometry = new THREE.TubeGeometry(
            curve,
            segments || this.globalConfig.segments,
            radius || this.globalConfig.radius,
            radialSegments || this.globalConfig.radialSegments,
            false
        );

        const material = this.createMaterial(pipelineData);

        const mesh = new THREE.Mesh(geometry, material);

        mesh.userData = {
            pipelineId: id,
            isPipeline: true,
            curve,
            progress: progress !== undefined ? progress : this.globalConfig.progress,
            flow: flow || this.globalConfig.flow
        };

        this.applyProgress(mesh, mesh.userData.progress);

        return mesh;
    }

    createMaterial(pipelineData) {
        const { color, opacity, materialType, flow } = pipelineData;

        const finalColor = color || this.globalConfig.color;
        const finalOpacity = opacity !== undefined ? opacity : this.globalConfig.opacity;
        const finalMaterialType = materialType || this.globalConfig.materialType;
        const finalFlow = flow || this.globalConfig.flow;

        if (finalFlow.enabled) {
            return this.createFlowMaterial(finalColor, finalOpacity, finalFlow);
        }

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
                    vec3 color = baseColor;

                    float flowPos = mod(vUv.x + time * flowSpeed * 0.1, 1.0);

                    float flowMask = smoothstep(0.0, flowWidth * 0.5, flowPos) *
                                     smoothstep(flowWidth, flowWidth * 0.5, flowPos);

                    color = mix(color, flowColor, flowMask * flowIntensity);

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

    applyProgress(mesh, progress) {
        const geometry = mesh.geometry;
        const totalVertices = geometry.attributes.position.count;

        const visibleVertices = Math.floor((totalVertices * progress) / 100);

        geometry.setDrawRange(0, visibleVertices);
    }


    async addPipeline(pipelineData) {
        const { id } = pipelineData;

        if (!id) {
            console.warn('Pipeline: id is required');
            return;
        }

        if (this.pipelines.has(id)) {
            console.warn(`Pipeline: Pipeline with id "${id}" already exists`);
            return;
        }

        const finalData = {
            ...this.globalConfig,
            ...pipelineData,
            id
        };

        const pipelineObject = this.createPipeline(finalData);

        if (!pipelineObject) {
            return;
        }

        this.add(pipelineObject);

        this.pipelines.set(id, pipelineObject);
        this.pipelineDataMap.set(id, finalData);

        this.emit('pipelineAdded', { pipelineId: id, pipelineData: finalData });
    }

    removePipeline(id) {
        const pipelineObject = this.pipelines.get(id);

        if (!pipelineObject) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        this.remove(pipelineObject);

        if (pipelineObject.geometry) {
            pipelineObject.geometry.dispose();
        }
        if (pipelineObject.material) {
            pipelineObject.material.dispose();
        }

        this.pipelines.delete(id);
        this.pipelineDataMap.delete(id);

        this.emit('pipelineRemoved', { pipelineId: id });
    }

    updateProgress(id, progress) {
        const pipelineObject = this.pipelines.get(id);
        const pipelineData = this.pipelineDataMap.get(id);

        if (!pipelineObject || !pipelineData) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        const clampedProgress = Math.max(0, Math.min(100, progress));

        this.applyProgress(pipelineObject, clampedProgress);

        pipelineObject.userData.progress = clampedProgress;
        pipelineData.progress = clampedProgress;

        this.emit('progressUpdated', {
            pipelineId: id,
            progress: clampedProgress
        });
    }

    updateFlow(id, flowConfig) {
        const pipelineObject = this.pipelines.get(id);
        const pipelineData = this.pipelineDataMap.get(id);

        if (!pipelineObject || !pipelineData) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        const newFlowConfig = {
            ...pipelineObject.userData.flow,
            ...flowConfig
        };

        pipelineObject.userData.flow = newFlowConfig;
        pipelineData.flow = newFlowConfig;

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

        this.emit('flowUpdated', {
            pipelineId: id,
            flowConfig: newFlowConfig
        });
    }

    updatePipeline(id, updates) {
        const pipelineData = this.pipelineDataMap.get(id);

        if (!pipelineData) {
            console.warn(`Pipeline: Pipeline "${id}" not found`);
            return;
        }

        this.removePipeline(id);

        const newData = {
            ...pipelineData,
            ...updates,
            id
        };

        this.addPipeline(newData);
    }

    getPipeline(id) {
        return this.pipelineDataMap.get(id) || null;
    }

    getAllPipelines() {
        return Array.from(this.pipelineDataMap.values());
    }

    clearPipelines() {
        const ids = Array.from(this.pipelines.keys());
        ids.forEach((id) => this.removePipeline(id));

        this.emit('pipelinesCleared');
    }


    onUpdate(delta) {
        this.flowTime += delta;

        this.pipelines.forEach((pipelineObject) => {
            if (pipelineObject.userData.flow?.enabled && pipelineObject.material.uniforms) {
                pipelineObject.material.uniforms.time.value = this.flowTime;
            }
        });
    }

    onDispose() {
        this.clearPipelines();
    }
}
