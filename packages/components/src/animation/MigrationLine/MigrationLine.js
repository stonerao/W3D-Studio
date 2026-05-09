import { Component } from '@w3d/core';
import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial, MeshLineRaycast } from './meshline/index.js';

/**
 * English comment.
 */
export class MigrationLine extends Component {
    static defaultConfig = {
        lines: [], // English comment.
        areas: [], // English comment.
        markers: [], // English comment.
        globalConfig: {
            // English comment.
            color: '#00ff00',
            size: 2,
            speed: 1, // English comment.
            duration: 3000, // English comment.
            loop: true,
            delay: 0,
            autoStart: true,
            lineWidth: 2, // English comment.
            texture: '', // English comment.
            alphaTexture: '', // English comment.
            textureRepeat: 4, // English comment.
            dashArray: 0.1, // English comment.
            dashRatio: 0.5, // English comment.
            direction: 1, // English comment.
            sizeAttenuation: true, // English comment.
            segments: 200, // English comment.
            widthMode: 'constant', // 'constant' | 'taper' | 'wave'
            taperRatio: 0.5, // English comment.
            depthTest: true, // English comment.
            blending: 'normal', // 'normal' | 'additive'
            // English comment.
            showWall: true,
            showBottom: true,
            showBorder: true,
            wallHeight: 5,
            wallOpacity: 0.5,
            bottomOpacity: 0.5,
            borderWidth: 2,
            borderGlow: true,
            animationSpeed: 1.0,
            // English comment.
            markerType: 'sprite', // 'sprite' | 'plane'
            markerSize: 5,
            markerOpacity: 1.0,
            markerColor: '#ffffff',
            markerSizeAttenuation: true // English comment.
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.migrationLines = new Map();

        // English comment.
        this.lineDataMap = new Map();

        // English comment.
        this.animationStates = new Map();

        // English comment.
        this.areaBlocks = new Map();

        // English comment.
        this.areaDataMap = new Map();

        // English comment.
        this.imageMarkers = new Map();

        // English comment.
        this.markerDataMap = new Map();

        // English comment.
        this.textureCache = new Map();

        // English comment.
        this.textureLoader = new THREE.TextureLoader();

        // English comment.
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredArea = null;
        this.hoveredMarker = null;

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
        if (this.config.lines && this.config.lines.length > 0) {
            for (const lineData of this.config.lines) {
                await this.createLine(lineData);
            }
        }

        // English comment.
        if (this.config.areas && this.config.areas.length > 0) {
            for (const areaData of this.config.areas) {
                await this.addArea(areaData);
            }
        }

        // English comment.
        if (this.config.markers && this.config.markers.length > 0) {
            for (const markerData of this.config.markers) {
                await this.addImageMarker(markerData);
            }
        }

        // English comment.
        this.setupMouseEvents();
    }

    /**
     * English comment.
     */
    async createLine(lineData) {
        const { id, points, type, userData } = lineData;

        if (!id || !points || points.length < 2) {
            console.warn('MigrationLine: id and at least 2 points are required');
            return;
        }

        // English comment.
        const lineConfig = {
            ...this.globalConfig,
            ...lineData
        };

        // English comment.
        const curve = this.createCurve(points);

        // English comment.
        const lineObject = await this.createMeshLine(curve, lineConfig);

        // English comment.
        lineObject.userData = {
            lineId: id,
            customData: userData,
            curve: curve,
            config: lineConfig,
            type: 'meshline'
        };

        // English comment.
        this.add(lineObject);

        console.log('[MigrationLine] Line added to scene:', {
            id,
            type: 'meshline',
            visible: lineObject.visible,
            objectType: lineObject.type,
            childrenCount: this.children.length
        });

        // English comment.
        this.migrationLines.set(id, lineObject);
        this.lineDataMap.set(id, lineData);

        // English comment.
        const animationState = {
            isPlaying: lineConfig.autoStart,
            isPaused: false,
            progress: 0,
            startTime: lineConfig.autoStart ? Date.now() + lineConfig.delay : 0,
            delay: lineConfig.delay,
            hasStarted: false
        };
        this.animationStates.set(id, animationState);

        // English comment.

        // English comment.
        if (lineConfig.autoStart && lineConfig.delay === 0) {
            this.emit('start', { lineId: id, userData });
            animationState.hasStarted = true;
        }
    }

    /**
     * English comment.
     */
    createCurve(points) {
        const vectors = points.map((p) => new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0));
        return new THREE.CatmullRomCurve3(vectors, false);
    }

    /**
     * English comment.
     */
    _getResolution() {
        if (this.scene && this.scene.renderer && this.scene.renderer.instance) {
            const size = new THREE.Vector2();
            this.scene.renderer.instance.getSize(size);
            return size;
        }
        return new THREE.Vector2(window.innerWidth, window.innerHeight);
    }

    /**
     * English comment.
     */
    _getWidthCallback(config) {
        switch (config.widthMode) {
            case 'taper':
                // English comment.
                return (p) => 1 - p * (config.taperRatio || 0.5);
            case 'wave':
                // English comment.
                return (p) => 0.5 + Math.sin(p * Math.PI * 4) * 0.5;
            case 'constant':
            default:
                return null; // English comment.
        }
    }

    /**
     * English comment.
     */
    async createMeshLine(curve, config) {
        const segments = config.segments || 200;
        const curvePoints = curve.getPoints(segments);

        // English comment.
        const geometry = new MeshLineGeometry();
        const widthCallback = this._getWidthCallback(config);
        geometry.setPoints(curvePoints, widthCallback);

        // English comment.
        const materialParams = {
            color: new THREE.Color(config.color),
            lineWidth: config.lineWidth || 2,
            resolution: this._getResolution(),
            sizeAttenuation: config.sizeAttenuation !== false ? 1 : 0,
            transparent: true,
            depthTest: config.depthTest !== false,
            depthWrite: false,
        };

        // English comment.
        if (config.blending === 'additive') {
            materialParams.blending = THREE.AdditiveBlending;
        }

        // English comment.
        if (config.dashArray && config.dashArray > 0) {
            materialParams.dashArray = config.dashArray;
            materialParams.dashRatio = config.dashRatio || 0.5;
            materialParams.dashOffset = 0;
        }

        // English comment.
        if (config.texture) {
            try {
                const texture = await this._loadLineTexture(config.texture);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                materialParams.map = texture;
                materialParams.useMap = 1;
                materialParams.repeat = new THREE.Vector2(config.textureRepeat || 4, 1);
            } catch (err) {
                console.warn('[MigrationLine] Failed to load texture:', config.texture, err);
            }
        }

        // English comment.
        if (config.alphaTexture) {
            try {
                const alphaTexture = await this._loadLineTexture(config.alphaTexture);
                alphaTexture.wrapS = THREE.RepeatWrapping;
                alphaTexture.wrapT = THREE.RepeatWrapping;
                materialParams.alphaMap = alphaTexture;
                materialParams.useAlphaMap = 1;
            } catch (err) {
                console.warn('[MigrationLine] Failed to load alphaTexture:', config.alphaTexture, err);
            }
        }

        const material = new MeshLineMaterial(materialParams);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.raycast = MeshLineRaycast;
        mesh.frustumCulled = false;

        // English comment.
        const onResize = () => {
            material.resolution = this._getResolution();
        };
        window.addEventListener('resize', onResize);
        mesh.userData.onResize = onResize;

        console.log('[MigrationLine] MeshLine created:', {
            segments,
            lineWidth: config.lineWidth,
            dashArray: config.dashArray,
            texture: config.texture || '(none)',
            widthMode: config.widthMode || 'constant',
        });

        return mesh;
    }

    /**
     * English comment.
     */
    _loadLineTexture(url) {
        if (this.textureCache.has(url)) {
            return Promise.resolve(this.textureCache.get(url));
        }
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    this.textureCache.set(url, texture);
                    resolve(texture);
                },
                undefined,
                reject
            );
        });
    }

    /**
     * English comment.
     */
    updateMeshLine(lineObject, progress, delta) {
        const material = lineObject.material;
        const config = lineObject.userData.config;
        // English comment.
        const speed = (config.speed !== undefined ? config.speed : 1);
        const dir = (config.direction === -1) ? 1 : -1; // English comment.

        // English comment.
        material.uniforms.visibility.value = 1.0;

        // English comment.
        if (material.uniforms.dashArray.value > 0) {
            material.uniforms.dashOffset.value += dir * delta * speed * 0.08;
        }

        // English comment.
        if (material.uniforms.useMap.value === 1) {
            material.uniforms.mapOffset.value.x += dir * delta * speed * 0.15;
        }
    }

    /**
     * English comment.
     */
    createShaderLine(curve, config) {
        const points = curve.getPoints(100);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // English comment.
        const indices = new Float32Array(points.length);
        for (let i = 0; i < points.length; i++) {
            indices[i] = i / (points.length - 1);
        }
        geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));

        // English comment.
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(config.color) },
                uProgress: { value: 0 },
                uGlowIntensity: { value: config.glowIntensity },
                uFlowSpeed: { value: config.flowSpeed }
            },
            vertexShader: `
                attribute float aIndex;
                varying float vIndex;
                varying vec3 vPosition;

                void main() {
                    vIndex = aIndex;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColor;
                uniform float uProgress;
                uniform float uGlowIntensity;
                uniform float uFlowSpeed;

                varying float vIndex;
                varying vec3 vPosition;

                void main() {
                    // English comment.
                    float flow = mod(vIndex - uTime * uFlowSpeed, 1.0);

                    // English comment.
                    float alpha = smoothstep(0.0, 0.1, flow) * smoothstep(1.0, 0.9, flow);

                    // English comment.
                    float glow = pow(alpha, 0.5) * uGlowIntensity;

                    // English comment.
                    if (vIndex > uProgress) {
                        discard;
                    }

                    vec3 finalColor = uColor * (1.0 + glow);
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return new THREE.Line(geometry, material);
    }

    /**
     * English comment.
     */
    createParticleLine(curve, config) {
        // English comment.
        const particleCount = config.particleCount;
        const geometry = new THREE.BufferGeometry();

        console.log('[MigrationLine] Creating particle line:', {
            configParticleCount: config.particleCount,
            actualParticleCount: particleCount,
            particleSize: config.particleSize,
            trailLength: config.trailLength,
            color: config.color,
            curveLength: curve.getLength()
        });

        // English comment.
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const alphas = new Float32Array(particleCount);

        // English comment.
        console.log('[MigrationLine] Distributing particles along curve...');
        for (let i = 0; i < particleCount; i++) {
            // English comment.
            const t = i / (particleCount - 1);

            // English comment.
            const point = curve.getPoint(t);

            // English comment.
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;

            // English comment.
            sizes[i] = config.particleSize;

            // English comment.
            alphas[i] = 0;

            // English comment.
            if (i < 3) {
                console.log(
                    `  Particle ${i} (t=${t.toFixed(3)}): (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})`
                );
            }
        }

        console.log('[MigrationLine] Particles distributed:', {
            firstPosition: [
                positions[0].toFixed(2),
                positions[1].toFixed(2),
                positions[2].toFixed(2)
            ],
            lastPosition: [
                positions[(particleCount - 1) * 3].toFixed(2),
                positions[(particleCount - 1) * 3 + 1].toFixed(2),
                positions[(particleCount - 1) * 3 + 2].toFixed(2)
            ]
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

        // English comment.
        // English comment.
        // English comment.
        // English comment.
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(config.color) },
                uTime: { value: 0 } // English comment.
            },
            vertexShader: `
                uniform float uTime;
                attribute float size;
                attribute float alpha;
                varying float vAlpha;

                void main() {
                    vAlpha = alpha;  // 使用 alpha 属性控制透明度
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                    // English comment.
                    // English comment.
                    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
                    // English comment.
                    float sizeMultiplier = 0.8 + pulse * 0.4;

                    gl_PointSize = size * 10.0 * sizeMultiplier;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                varying float vAlpha;

                void main() {
                    // English comment.
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    if (dist > 0.5) discard;

                    // English comment.
                    // English comment.
                    float brightness = sin(uTime * 3.0) * 0.2 + 1.0; // 1.0 到 1.2 之间
                    vec3 color = uColor * brightness;

                    // English comment.
                    float alpha = (1.0 - dist * 2.0) * vAlpha;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true
        });

        const points = new THREE.Points(geometry, material);
        points.userData.particleCount = particleCount;
        points.userData.trailLength = config.trailLength;

        console.log('[MigrationLine] Particle line created:', {
            particleCount: points.userData.particleCount,
            trailLength: points.userData.trailLength,
            visible: points.visible,
            materialType: material.type
        });

        return points;
    }

    /**
     * English comment.
     */
    onUpdate(delta) {
        const currentTime = Date.now();

        this.migrationLines.forEach((lineObject, id) => {
            const state = this.animationStates.get(id);
            const config = lineObject.userData.config;
            const type = lineObject.userData.type;

            if (!state || !state.isPlaying) return;

            // English comment.
            if (!state.hasStarted) {
                if (currentTime >= state.startTime) {
                    state.hasStarted = true;
                    this.emit('start', {
                        lineId: id,
                        userData: lineObject.userData.customData
                    });
                } else {
                    return;
                }
            }

            // English comment.
            const elapsed = currentTime - state.startTime;
            let progress = elapsed / config.duration;

            // English comment.
            if (progress >= 1) {
                if (config.loop) {
                    state.startTime = currentTime;
                    progress = 0;
                    this.emit('loop', {
                        lineId: id,
                        userData: lineObject.userData.customData
                    });
                } else {
                    progress = 1;
                    state.isPlaying = false;
                    this.emit('complete', {
                        lineId: id,
                        userData: lineObject.userData.customData
                    });
                }
            }

            state.progress = progress;

            // English comment.
            switch (type) {
                case 'meshline':
                    this.updateMeshLine(lineObject, progress, delta);
                    break;
                case 'shader':
                    this.updateShaderLine(lineObject, progress, delta);
                    break;
                case 'particle':
                    this.updateParticleLine(lineObject, progress, delta);
                    break;
            }

            // English comment.
            this.emit('update', {
                lineId: id,
                progress: progress,
                userData: lineObject.userData.customData
            });
        });

        // English comment.
        this.areaBlocks.forEach((areaObject) => {
            this.updateAreaBlock(areaObject, delta);
        });
    }

    /**
     * English comment.
     */
    updateShaderLine(lineObject, progress, delta) {
        const material = lineObject.material;
        material.uniforms.uTime.value += delta;
        material.uniforms.uProgress.value = progress;
    }

    /**
     * English comment.
     */
    initializeParticles(lineObject) {
        const geometry = lineObject.geometry;
        const positions = geometry.attributes.position.array;
        const alphas = geometry.attributes.alpha.array;
        const curve = lineObject.userData.curve;
        const particleCount = lineObject.userData.particleCount;

        console.log('[MigrationLine] Initializing particles (fixed positions):', {
            particleCount,
            curveLength: curve.getLength(),
            curvePoints: curve.points.length
        });

        // English comment.
        for (let i = 0; i < particleCount; i++) {
            // English comment.
            const t = i / (particleCount - 1);

            // English comment.
            const point = curve.getPoint(t);

            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;

            // English comment.
            if (i < 3) {
                console.log(`  Particle ${i} (t=${t.toFixed(3)}):`, {
                    x: point.x.toFixed(2),
                    y: point.y.toFixed(2),
                    z: point.z.toFixed(2)
                });
            }

            // English comment.
            alphas[i] = 0;
        }

        // English comment.
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.alpha.needsUpdate = true;

        console.log('[MigrationLine] Particles initialized:', {
            firstPosition: [positions[0], positions[1], positions[2]],
            lastPosition: [
                positions[(particleCount - 1) * 3],
                positions[(particleCount - 1) * 3 + 1],
                positions[(particleCount - 1) * 3 + 2]
            ],
            totalParticles: particleCount
        });
    }

    /**
     * English comment.
     */
    updateParticleLine(lineObject, progress, delta) {
        const geometry = lineObject.geometry;
        const material = lineObject.material;
        const alphas = geometry.attributes.alpha.array;
        const particleCount = lineObject.userData.particleCount;
        const trailLength = lineObject.userData.trailLength;

        // English comment.
        material.uniforms.uTime.value += delta;

        // English comment.
        if (!this._particleUpdateInitialized) {
            this._particleUpdateInitialized = true;
            console.log('[MigrationLine] First particle update:', {
                particleCount,
                alphasArrayLength: alphas.length,
                trailLength,
                geometryParticleCount: geometry.attributes.position.count,
                match: particleCount === alphas.length
            });
        }

        let visibleCount = 0;
        let maxAlpha = 0;
        let minVisibleIndex = -1;
        let maxVisibleIndex = -1;

        // English comment.
        for (let i = 0; i < particleCount; i++) {
            // English comment.
            const particleT = i / (particleCount - 1);

            // English comment.
            let distance = progress - particleT;

            // English comment.
            const config = lineObject.userData.config;
            if (config.loop && distance < -0.5) {
                distance += 1; // English comment.
            }

            // English comment.
            // English comment.
            // English comment.
            if (distance >= 0 && distance <= trailLength) {
                // English comment.
                const fadeRatio = 1 - distance / trailLength;
                alphas[i] = fadeRatio;
                visibleCount++;
                maxAlpha = Math.max(maxAlpha, fadeRatio);

                if (minVisibleIndex === -1) minVisibleIndex = i;
                maxVisibleIndex = i;
            } else {
                // English comment.
                alphas[i] = 0;
            }
        }

        // English comment.
        if (!this._particleDebugCounter) this._particleDebugCounter = 0;
        this._particleDebugCounter++;
        if (this._particleDebugCounter % 60 === 0) {
            console.log('[MigrationLine] Particle update:', {
                progress: progress.toFixed(3),
                particleCount,
                visibleCount,
                visibleRange:
                    minVisibleIndex >= 0 ? `[${minVisibleIndex}, ${maxVisibleIndex}]` : 'none',
                maxAlpha: maxAlpha.toFixed(3),
                trailLength,
                uTime: material.uniforms.uTime.value.toFixed(2),
                visible: lineObject.visible
            });
        }

        // English comment.
        geometry.attributes.alpha.needsUpdate = true;
    }

    /**
     * English comment.
     */
    async addLine(lineData) {
        await this.createLine(lineData);
    }

    /**
     * English comment.
     */
    removeLine(id) {
        const lineObject = this.migrationLines.get(id);

        if (!lineObject) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        // English comment.
        if (lineObject.geometry) {
            lineObject.geometry.dispose();
        }
        if (lineObject.material) {
            lineObject.material.dispose();
        }

        // English comment.
        if (lineObject.userData.onResize) {
            window.removeEventListener('resize', lineObject.userData.onResize);
        }

        // English comment.
        this.remove(lineObject);

        // English comment.
        this.migrationLines.delete(id);
        this.lineDataMap.delete(id);
        this.animationStates.delete(id);
    }

    /**
     * English comment.
     */
    startLine(id) {
        const state = this.animationStates.get(id);
        if (!state) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        if (!state.isPlaying) {
            state.isPlaying = true;
            state.isPaused = false;
            state.startTime =
                Date.now() - (state.progress * this.lineDataMap.get(id).duration || 0);
        }
    }

    /**
     * English comment.
     */
    pauseLine(id) {
        const state = this.animationStates.get(id);
        if (!state) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        if (state.isPlaying) {
            state.isPlaying = false;
            state.isPaused = true;
        }
    }

    /**
     * English comment.
     */
    stopLine(id) {
        const state = this.animationStates.get(id);
        if (!state) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        state.isPlaying = false;
        state.isPaused = false;
        state.progress = 0;
        state.startTime = Date.now();
        state.hasStarted = false;
    }

    /**
     * English comment.
     */
    async updateLine(id, updates) {
        const lineObject = this.migrationLines.get(id);
        const lineData = this.lineDataMap.get(id);

        if (!lineObject || !lineData) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        // English comment.
        Object.assign(lineData, updates);

        // English comment.
        if (updates.points || updates.type) {
            // English comment.
            const currentState = this.animationStates.get(id);

            // English comment.
            this.removeLine(id);

            // English comment.
            await this.createLine(lineData);

            // English comment.
            if (currentState) {
                this.animationStates.set(id, currentState);
            }
        } else {
            // English comment.
            Object.assign(lineObject.userData.config, updates);

            if (lineObject.material.isMeshLineMaterial) {
                // English comment.
                const mat = lineObject.material;
                if (updates.color !== undefined) {
                    mat.uniforms.color.value.set(updates.color);
                }
                if (updates.lineWidth !== undefined) {
                    mat.uniforms.lineWidth.value = updates.lineWidth;
                }
                if (updates.dashArray !== undefined) {
                    mat.uniforms.dashArray.value = updates.dashArray;
                    mat.uniforms.useDash.value = updates.dashArray > 0 ? 1 : 0;
                }
                if (updates.dashRatio !== undefined) {
                    mat.uniforms.dashRatio.value = updates.dashRatio;
                }
                if (updates.opacity !== undefined) {
                    mat.uniforms.opacity.value = updates.opacity;
                }
                if (updates.depthTest !== undefined) {
                    mat.depthTest = updates.depthTest;
                }
                if (updates.blending !== undefined) {
                    mat.blending = updates.blending === 'additive'
                        ? THREE.AdditiveBlending
                        : THREE.NormalBlending;
                    mat.needsUpdate = true;
                }
                if (updates.sizeAttenuation !== undefined) {
                    mat.uniforms.sizeAttenuation.value = updates.sizeAttenuation ? 1 : 0;
                }
                // English comment.
                if (updates.texture !== undefined || updates.alphaTexture !== undefined || updates.textureRepeat !== undefined) {
                    this.removeLine(id);
                    await this.createLine({ ...lineData, ...updates });
                    return;
                }
            } else {
                // English comment.
                if (updates.color) {
                    const color = new THREE.Color(updates.color);
                    if (lineObject.material.uniforms && lineObject.material.uniforms.uColor) {
                        lineObject.material.uniforms.uColor.value = color;
                    } else if (lineObject.material.color) {
                        lineObject.material.color = color;
                    }
                }
            }
        }
    }

    /**
     * English comment.
     */
    startAll() {
        this.animationStates.forEach((state, id) => {
            this.startLine(id);
        });
    }

    /**
     * English comment.
     */
    stopAll() {
        this.animationStates.forEach((state, id) => {
            this.stopLine(id);
        });
    }

    /**
     * English comment.
     */
    pauseAll() {
        this.animationStates.forEach((state, id) => {
            this.pauseLine(id);
        });
    }

    /**
     * English comment.
     */
    getLine(id) {
        return this.lineDataMap.get(id);
    }

    /**
     * English comment.
     */
    getAllLines() {
        return Array.from(this.lineDataMap.values());
    }

    /**
     * English comment.
     */
    getLineState(id) {
        return this.animationStates.get(id);
    }

    /**
     * English comment.
     */
    clearLines() {
        const ids = Array.from(this.migrationLines.keys());
        ids.forEach((id) => this.removeLine(id));
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

    /**
     * English comment.
     */
    createAreaBlock(points, config) {
        if (!points || points.length < 3) {
            console.warn('MigrationLine: Area block requires at least 3 points');
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
            console.warn('MigrationLine: id and at least 3 points are required for area block');
            return;
        }

        // English comment.
        const areaConfig = {
            ...this.config.globalConfig,
            ...areaData,
            id
        };

        // English comment.
        const areaObject = this.createAreaBlock(points, areaConfig);
        if (!areaObject) return;

        // English comment.
        areaObject.userData = {
            ...areaObject.userData,
            id,
            config: areaConfig,
            customData: userData
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
            console.warn(`MigrationLine: Area with id "${id}" not found`);
            return;
        }

        // English comment.
        this.remove(areaObject);

        // English comment.
        areaObject.children.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

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
        return this.areaDataMap.get(id);
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

    // English comment.

    /**
     * English comment.
     */
    async loadTexture(url) {
        // English comment.
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }

        // English comment.
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // English comment.
                    this.textureCache.set(url, texture);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load texture: ${url}`, error);
                    reject(error);
                }
            );
        });
    }

    /**
     * English comment.
     */
    async createImageMarker(markerData) {
        const {
            id,
            position,
            type = 'sprite',
            state,
            images,
            size = 5,
            scale = { x: 1, y: 1 },
            offset = { x: 0, y: 0, z: 0 },
            color = '#ffffff',
            opacity = 1.0,
            sizeAttenuation = true,
            userData = {}
        } = markerData;

        // English comment.
        if (!id || !position || !images) {
            console.warn('ImageMarker: id, position, and images are required');
            return null;
        }

        // English comment.
        const currentState = state || Object.keys(images)[0];
        const imageUrl = images[currentState];

        if (!imageUrl) {
            console.warn(`ImageMarker: No image found for state "${currentState}"`);
            return null;
        }

        // English comment.
        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for marker "${id}"`, error);
            return null;
        }

        let markerObject;

        if (type === 'sprite') {
            // English comment.
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: new THREE.Color(color),
                opacity: opacity,
                transparent: true,
                sizeAttenuation: sizeAttenuation
            });

            markerObject = new THREE.Sprite(material);
            markerObject.scale.set(size * scale.x, size * scale.y, 1);
        } else if (type === 'plane') {
            // English comment.
            const geometry = new THREE.PlaneGeometry(size * scale.x, size * scale.y);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                color: new THREE.Color(color),
                opacity: opacity,
                transparent: true,
                side: THREE.DoubleSide
            });

            markerObject = new THREE.Mesh(geometry, material);
        } else {
            console.warn(`ImageMarker: Unknown type "${type}", using sprite`);
            // English comment.
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: new THREE.Color(color),
                opacity: opacity,
                transparent: true,
                sizeAttenuation: sizeAttenuation
            });

            markerObject = new THREE.Sprite(material);
            markerObject.scale.set(size * scale.x, size * scale.y, 1);
        }

        // English comment.
        markerObject.position.set(
            position.x + offset.x,
            position.y + offset.y,
            position.z + offset.z
        );

        // English comment.
        markerObject.userData = {
            ...userData,
            markerId: id,
            markerType: type,
            isImageMarker: true
        };

        return markerObject;
    }

    /**
     * English comment.
     */
    async addImageMarker(markerData) {
        const { id } = markerData;

        if (!id) {
            console.warn('ImageMarker: id is required');
            return;
        }

        // English comment.
        if (this.imageMarkers.has(id)) {
            console.warn(`ImageMarker: Marker with id "${id}" already exists`);
            return;
        }

        // English comment.
        const markerObject = await this.createImageMarker(markerData);

        if (!markerObject) {
            return;
        }

        // English comment.
        this.add(markerObject);

        // English comment.
        this.imageMarkers.set(id, markerObject);

        // English comment.
        const currentState = markerData.state || Object.keys(markerData.images)[0];
        this.markerDataMap.set(id, {
            ...markerData,
            state: currentState
        });

        // English comment.
        this.emit('markerAdded', { markerId: id, markerData });
    }

    /**
     * English comment.
     */
    async updateMarkerState(id, newState) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        const { images } = markerData;
        const imageUrl = images[newState];

        if (!imageUrl) {
            console.warn(`ImageMarker: No image found for state "${newState}"`);
            return;
        }

        // English comment.
        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for state "${newState}"`, error);
            return;
        }

        // English comment.
        if (markerObject.material) {
            markerObject.material.map = texture;
            markerObject.material.needsUpdate = true;
        }

        // English comment.
        const oldState = markerData.state;

        // English comment.
        markerData.state = newState;
        this.markerDataMap.set(id, markerData);

        // English comment.
        this.emit('markerStateChanged', {
            markerId: id,
            oldState,
            newState
        });
    }

    /**
     * English comment.
     */
    updateMarker(id, updates) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        // English comment.
        if (updates.size !== undefined) {
            const scale = markerData.scale || { x: 1, y: 1 };
            if (markerObject.isSprite) {
                markerObject.scale.set(updates.size * scale.x, updates.size * scale.y, 1);
            } else {
                markerObject.scale.set(scale.x, scale.y, 1);
                markerObject.geometry.dispose();
                markerObject.geometry = new THREE.PlaneGeometry(
                    updates.size * scale.x,
                    updates.size * scale.y
                );
            }
            markerData.size = updates.size;
        }

        // English comment.
        if (updates.color !== undefined && markerObject.material) {
            markerObject.material.color.set(updates.color);
            markerData.color = updates.color;
        }

        // English comment.
        if (updates.opacity !== undefined && markerObject.material) {
            markerObject.material.opacity = updates.opacity;
            markerData.opacity = updates.opacity;
        }

        // English comment.
        if (updates.offset !== undefined) {
            const position = markerData.position;
            const offset = { ...markerData.offset, ...updates.offset };
            markerObject.position.set(
                position.x + offset.x,
                position.y + offset.y,
                position.z + offset.z
            );
            markerData.offset = offset;
        }

        // English comment.
        if (updates.scale !== undefined) {
            const size = markerData.size || 5;
            const scale = { ...markerData.scale, ...updates.scale };
            if (markerObject.isSprite) {
                markerObject.scale.set(size * scale.x, size * scale.y, 1);
            } else {
                markerObject.geometry.dispose();
                markerObject.geometry = new THREE.PlaneGeometry(size * scale.x, size * scale.y);
            }
            markerData.scale = scale;
        }

        // English comment.
        this.markerDataMap.set(id, markerData);
    }

    /**
     * English comment.
     */
    removeMarker(id) {
        const markerObject = this.imageMarkers.get(id);

        if (!markerObject) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        // English comment.
        this.remove(markerObject);

        // English comment.
        if (markerObject.geometry) {
            markerObject.geometry.dispose();
        }
        if (markerObject.material) {
            markerObject.material.dispose();
        }

        // English comment.
        this.imageMarkers.delete(id);
        this.markerDataMap.delete(id);

        // English comment.
        this.emit('markerRemoved', { markerId: id });
    }

    /**
     * English comment.
     */
    getMarker(id) {
        return this.markerDataMap.get(id);
    }

    /**
     * English comment.
     */
    getAllMarkers() {
        return Array.from(this.markerDataMap.values());
    }

    /**
     * English comment.
     */
    clearMarkers() {
        const ids = Array.from(this.imageMarkers.keys());
        ids.forEach((id) => this.removeMarker(id));
    }

    // English comment.

    /**
     * English comment.
     */
    setupMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            console.warn(
                '[MigrationLine] Cannot setup mouse events: scene/renderer/domElement not ready'
            );
            return;
        }

        const domElement = this.scene.renderer.domElement;

        // English comment.
        this.onMouseClick = this.handleMouseClick.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);

        // English comment.
        domElement.addEventListener('click', this.onMouseClick);
        domElement.addEventListener('mousemove', this.onMouseMove);

        console.log('[MigrationLine] Mouse events setup successfully');
    }

    /**
     * English comment.
     */
    removeMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            return;
        }

        const domElement = this.scene.renderer.domElement;

        // English comment.
        if (this.onMouseClick) {
            domElement.removeEventListener('click', this.onMouseClick);
        }
        if (this.onMouseMove) {
            domElement.removeEventListener('mousemove', this.onMouseMove);
        }
    }

    /**
     * English comment.
     */
    handleMouseClick(event) {
        console.log('[MigrationLine] handleMouseClick called', {
            clientX: event.clientX,
            clientY: event.clientY
        });

        const intersectedMarker = this.getIntersectedMarker(event);

        console.log('[MigrationLine] Intersected marker:', intersectedMarker);

        if (intersectedMarker) {
            const markerId = intersectedMarker.userData.markerId;
            const markerData = this.markerDataMap.get(markerId);

            console.log('[MigrationLine] Emitting markerClick event:', { markerId, markerData });

            // English comment.
            this.emit('markerClick', {
                markerId,
                markerData,
                markerObject: intersectedMarker
            });
        } else {
            console.log('[MigrationLine] No marker intersected');
        }
    }

    /**
     * English comment.
     */
    handleMouseMove(event) {
        const intersectedMarker = this.getIntersectedMarker(event);

        // English comment.
        if (intersectedMarker) {
            const markerId = intersectedMarker.userData.markerId;

            // English comment.
            if (!this.hoveredMarker || this.hoveredMarker.userData.markerId !== markerId) {
                // English comment.
                if (this.hoveredMarker) {
                    const prevMarkerId = this.hoveredMarker.userData.markerId;
                    const prevMarkerData = this.markerDataMap.get(prevMarkerId);

                    this.emit('markerMouseLeave', {
                        markerId: prevMarkerId,
                        markerData: prevMarkerData,
                        markerObject: this.hoveredMarker
                    });
                }

                // English comment.
                const markerData = this.markerDataMap.get(markerId);
                this.emit('markerMouseEnter', {
                    markerId,
                    markerData,
                    markerObject: intersectedMarker
                });

                this.hoveredMarker = intersectedMarker;
            }
        } else {
            // English comment.
            if (this.hoveredMarker) {
                const markerId = this.hoveredMarker.userData.markerId;
                const markerData = this.markerDataMap.get(markerId);

                this.emit('markerMouseLeave', {
                    markerId,
                    markerData,
                    markerObject: this.hoveredMarker
                });

                this.hoveredMarker = null;
            }
        }
    }

    /**
     * English comment.
     */
    getIntersectedMarker(event) {
        if (!this.scene || !this.scene.camera || !this.scene.renderer) {
            console.warn('[MigrationLine] getIntersectedMarker: scene/camera/renderer not ready');
            return null;
        }

        const domElement = this.scene.renderer.domElement;
        const rect = domElement.getBoundingClientRect();

        // English comment.
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        console.log('[MigrationLine] Mouse position:', {
            normalized: { x: this.mouse.x, y: this.mouse.y },
            client: { x: event.clientX, y: event.clientY },
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        });

        // English comment.
        this.raycaster.setFromCamera(this.mouse, this.scene.camera);

        // English comment.
        const markerObjects = Array.from(this.imageMarkers.values());

        console.log('[MigrationLine] Marker objects count:', markerObjects.length);
        console.log('[MigrationLine] Marker objects:', markerObjects);

        if (markerObjects.length === 0) {
            console.warn('[MigrationLine] No marker objects to intersect');
            return null;
        }

        // English comment.
        const intersects = this.raycaster.intersectObjects(markerObjects, false);

        console.log('[MigrationLine] Intersects:', intersects);

        if (intersects.length > 0) {
            console.log('[MigrationLine] Found intersection:', intersects[0]);
            return intersects[0].object;
        }

        return null;
    }

    /**
     * English comment.
     */
    onDispose() {
        // English comment.
        this.removeMouseEvents();

        // English comment.
        this.clearLines();

        // English comment.
        this.clearAreas();

        // English comment.
        this.clearMarkers();

        // English comment.
        this.textureCache.forEach((texture) => {
            texture.dispose();
        });
        this.textureCache.clear();
    }

    /**
     * English comment.
     */
    async updateConfig(newConfig) {
        // English comment.
        if (newConfig.globalConfig) {
            Object.assign(this.globalConfig, newConfig.globalConfig);

            // English comment.
            if (!newConfig.lines) {
                const gc = newConfig.globalConfig;

                // English comment.
                const needsRebuild = gc.texture !== undefined
                    || gc.alphaTexture !== undefined
                    || gc.textureRepeat !== undefined
                    || gc.segments !== undefined
                    || gc.widthMode !== undefined
                    || gc.taperRatio !== undefined;

                if (needsRebuild) {
                    const existingLines = Array.from(this.lineDataMap.values());
                    this.clearLines();
                    for (const lineData of existingLines) {
                        await this.createLine(lineData);
                    }
                } else {
                    this.migrationLines.forEach((lineObject) => {
                        if (!lineObject.material.isMeshLineMaterial) return;
                        const mat = lineObject.material;
                        // English comment.
                        Object.assign(lineObject.userData.config, gc);
                        if (gc.color !== undefined) mat.uniforms.color.value.set(gc.color);
                        if (gc.lineWidth !== undefined) mat.uniforms.lineWidth.value = gc.lineWidth;
                        if (gc.dashArray !== undefined) {
                            mat.uniforms.dashArray.value = gc.dashArray;
                            mat.uniforms.useDash.value = gc.dashArray > 0 ? 1 : 0;
                        }
                        if (gc.dashRatio !== undefined) mat.uniforms.dashRatio.value = gc.dashRatio;
                        if (gc.opacity !== undefined) mat.uniforms.opacity.value = gc.opacity;
                        // English comment.
                        if (gc.depthTest !== undefined) mat.depthTest = gc.depthTest;
                        if (gc.sizeAttenuation !== undefined) {
                            mat.uniforms.sizeAttenuation.value = gc.sizeAttenuation ? 1 : 0;
                        }
                        if (gc.blending !== undefined) {
                            mat.blending = gc.blending === 'additive'
                                ? THREE.AdditiveBlending
                                : THREE.NormalBlending;
                            mat.needsUpdate = true;
                        }
                    });
                }
            }
        }

        // English comment.
        if (newConfig.lines) {
            this.clearLines();
            this.config.lines = newConfig.lines;
            for (const lineData of newConfig.lines) {
                await this.createLine(lineData);
            }
        }

        // English comment.
        if (newConfig.areas) {
            this.clearAreas();
            this.config.areas = newConfig.areas;
            for (const areaData of newConfig.areas) {
                await this.addArea(areaData);
            }
        }

        // English comment.
        if (newConfig.markers) {
            this.clearMarkers();
            this.config.markers = newConfig.markers;
            for (const markerData of newConfig.markers) {
                await this.addImageMarker(markerData);
            }
        }
    }

    async updateData(data, options = {}) {
        console.log(data, options)
        const field = typeof options.field === 'string' && options.field.trim()
            ? options.field.trim()
            : 'lines';
        await this.updateConfig({
            [field]: Array.isArray(data) ? data : []
        });
    }
}

export default MigrationLine;
