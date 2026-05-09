import { Component } from '@w3d/core';
import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial, MeshLineRaycast } from './meshline/index.js';

/**
 * MigrationLine 迁移线动画组件
 *
 * @class MigrationLine
 * @extends Component
 * @description 在三维空间中展示从一个点到另一个点（或多个点）的动态迁移效果
 */
export class MigrationLine extends Component {
    static defaultConfig = {
        lines: [], // 迁移线数据数组
        areas: [], // 区域块数据数组
        markers: [], // 图片点位数据数组
        globalConfig: {
            // MeshLine 全局配置
            color: '#00ff00',
            size: 2,
            speed: 1, // 动画流动速度（统一控制虚线/纹理流动）
            duration: 3000, // 毫秒
            loop: true,
            delay: 0,
            autoStart: true,
            lineWidth: 2, // 线宽（世界单位或像素，取决于 sizeAttenuation）
            texture: '', // 纹理图片 URL（箭头/流光等，沿线贴图）
            alphaTexture: '', // 透明度纹理 URL
            textureRepeat: 4, // 纹理沿线重复次数
            dashArray: 0.1, // 虚线周期（0=实线）默认0.1产生流动点动画
            dashRatio: 0.5, // 虚线可见比例（0=全实，0.9=小圆点效果）
            direction: 1, // 动画方向：1=正向（起点→终点），-1=反向（终点→起点）
            sizeAttenuation: true, // 线宽是否随距离衰减
            segments: 200, // 曲线细分段数
            widthMode: 'constant', // 'constant' | 'taper' | 'wave'
            taperRatio: 0.5, // taper 模式收窄比例
            depthTest: true, // 深度测试
            blending: 'normal', // 'normal' | 'additive'
            // Area Block 特定配置
            showWall: true,
            showBottom: true,
            showBorder: true,
            wallHeight: 5,
            wallOpacity: 0.5,
            bottomOpacity: 0.5,
            borderWidth: 2,
            borderGlow: true,
            animationSpeed: 1.0,
            // Image Marker 特定配置
            markerType: 'sprite', // 'sprite' | 'plane'
            markerSize: 5,
            markerOpacity: 1.0,
            markerColor: '#ffffff',
            markerSizeAttenuation: true // Sprite 大小是否随距离衰减
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // 迁移线对象映射表 (id -> lineObject)
        this.migrationLines = new Map();

        // 迁移线数据映射表 (id -> lineData)
        this.lineDataMap = new Map();

        // 动画状态映射表 (id -> animationState)
        this.animationStates = new Map();

        // 区域块对象映射表 (id -> areaObject)
        this.areaBlocks = new Map();

        // 区域块数据映射表 (id -> areaData)
        this.areaDataMap = new Map();

        // 图片点位对象映射表 (id -> markerObject)
        this.imageMarkers = new Map();

        // 图片点位数据映射表 (id -> markerData)
        this.markerDataMap = new Map();

        // 纹理缓存 (url -> texture)
        this.textureCache = new Map();

        // 纹理加载器
        this.textureLoader = new THREE.TextureLoader();

        // 鼠标交互相关
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredArea = null;
        this.hoveredMarker = null;

        // 时钟
        this.clock = new THREE.Clock();
    }

    /**
     * 组件挂载完成
     */
    async onMounted() {
        // 合并全局配置
        this.globalConfig = {
            ...this.constructor.defaultConfig.globalConfig,
            ...this.config.globalConfig
        };

        // 创建所有迁移线
        if (this.config.lines && this.config.lines.length > 0) {
            for (const lineData of this.config.lines) {
                await this.createLine(lineData);
            }
        }

        // 创建所有区域块
        if (this.config.areas && this.config.areas.length > 0) {
            for (const areaData of this.config.areas) {
                await this.addArea(areaData);
            }
        }

        // 创建所有图片点位
        if (this.config.markers && this.config.markers.length > 0) {
            for (const markerData of this.config.markers) {
                await this.addImageMarker(markerData);
            }
        }

        // 设置鼠标交互事件监听
        this.setupMouseEvents();
    }

    /**
     * 创建单条迁移线
     * @param {Object} lineData - 迁移线数据
     */
    async createLine(lineData) {
        const { id, points, type, userData } = lineData;

        if (!id || !points || points.length < 2) {
            console.warn('MigrationLine: id and at least 2 points are required');
            return;
        }

        // 合并配置
        const lineConfig = {
            ...this.globalConfig,
            ...lineData
        };

        // 创建路径曲线
        const curve = this.createCurve(points);

        // 始终使用 MeshLine 渲染
        const lineObject = await this.createMeshLine(curve, lineConfig);

        // 设置 userData
        lineObject.userData = {
            lineId: id,
            customData: userData,
            curve: curve,
            config: lineConfig,
            type: 'meshline'
        };

        // 添加到场景
        this.add(lineObject);

        console.log('[MigrationLine] Line added to scene:', {
            id,
            type: 'meshline',
            visible: lineObject.visible,
            objectType: lineObject.type,
            childrenCount: this.children.length
        });

        // 保存到映射表
        this.migrationLines.set(id, lineObject);
        this.lineDataMap.set(id, lineData);

        // 初始化动画状态
        const animationState = {
            isPlaying: lineConfig.autoStart,
            isPaused: false,
            progress: 0,
            startTime: lineConfig.autoStart ? Date.now() + lineConfig.delay : 0,
            delay: lineConfig.delay,
            hasStarted: false
        };
        this.animationStates.set(id, animationState);

        // 粒子位置已在 createParticleLine() 中初始化完成，无需额外处理

        // 如果自动开始，触发 start 事件
        if (lineConfig.autoStart && lineConfig.delay === 0) {
            this.emit('start', { lineId: id, userData });
            animationState.hasStarted = true;
        }
    }

    /**
     * 创建路径曲线
     * @param {Array} points - 路径点数组
     * @returns {THREE.CatmullRomCurve3}
     */
    createCurve(points) {
        const vectors = points.map((p) => new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0));
        return new THREE.CatmullRomCurve3(vectors, false);
    }

    /**
     * 获取渲染器分辨率（MeshLine 材质必需）
     * @returns {THREE.Vector2}
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
     * 根据 widthMode 生成宽度回调函数
     * @param {Object} config
     * @returns {Function|null}
     */
    _getWidthCallback(config) {
        switch (config.widthMode) {
            case 'taper':
                // 从头到尾逐渐变细
                return (p) => 1 - p * (config.taperRatio || 0.5);
            case 'wave':
                // 正弦波形宽度
                return (p) => 0.5 + Math.sin(p * Math.PI * 4) * 0.5;
            case 'constant':
            default:
                return null; // 默认宽度 1
        }
    }

    /**
     * 创建 MeshLine 效果的迁移线（基于三角形带，支持纹理/线宽/虚线）
     * @param {THREE.CatmullRomCurve3} curve - 路径曲线
     * @param {Object} config - 配置
     * @returns {Promise<THREE.Mesh>}
     */
    async createMeshLine(curve, config) {
        const segments = config.segments || 200;
        const curvePoints = curve.getPoints(segments);

        // 构建 MeshLine 几何体
        const geometry = new MeshLineGeometry();
        const widthCallback = this._getWidthCallback(config);
        geometry.setPoints(curvePoints, widthCallback);

        // 准备材质参数
        const materialParams = {
            color: new THREE.Color(config.color),
            lineWidth: config.lineWidth || 2,
            resolution: this._getResolution(),
            sizeAttenuation: config.sizeAttenuation !== false ? 1 : 0,
            transparent: true,
            depthTest: config.depthTest !== false,
            depthWrite: false,
        };

        // 混合模式
        if (config.blending === 'additive') {
            materialParams.blending = THREE.AdditiveBlending;
        }

        // 虚线配置
        if (config.dashArray && config.dashArray > 0) {
            materialParams.dashArray = config.dashArray;
            materialParams.dashRatio = config.dashRatio || 0.5;
            materialParams.dashOffset = 0;
        }

        // 加载纹理（如果配置了）
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

        // 加载透明度纹理
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

        // 监听窗口 resize 更新 resolution
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
     * 加载线条纹理（带缓存）
     * @param {string} url
     * @returns {Promise<THREE.Texture>}
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
     * 更新 MeshLine 动画
     * - dashOffset 持续偏移实现虚线/流光流动
     * - 纹理 UV offset 实现纹理流动
     * - visibility 始终为 1（全线展示，避免循环闪烁）
     * @param {THREE.Mesh} lineObject
     * @param {number} progress - 动画进度 0~1
     * @param {number} delta - 帧时间增量
     */
    updateMeshLine(lineObject, progress, delta) {
        const material = lineObject.material;
        const config = lineObject.userData.config;
        // speed 为统一流动速度参数；direction: 1=正向, -1=反向
        const speed = (config.speed !== undefined ? config.speed : 1);
        const dir = (config.direction === -1) ? 1 : -1; // dashOffset 递减=正向流动，取反即反向

        // 始终展示完整线条（将 visibility 固定为 1，避免循环时闪烁）
        material.uniforms.visibility.value = 1.0;

        // 虚线流动动画：dir 控制流动方向
        if (material.uniforms.dashArray.value > 0) {
            material.uniforms.dashOffset.value += dir * delta * speed * 0.08;
        }

        // 纹理 UV 流动动画（通过 mapOffset uniform 驱动，ShaderMaterial 不自动应用 texture.offset）
        if (material.uniforms.useMap.value === 1) {
            material.uniforms.mapOffset.value.x += dir * delta * speed * 0.15;
        }
    }

    /**
     * 创建 Shader 效果的迁移线（旧版保留）
     * @param {THREE.CatmullRomCurve3} curve - 路径曲线
     * @param {Object} config - 配置
     * @returns {THREE.Line}
     */
    createShaderLine(curve, config) {
        const points = curve.getPoints(100);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // 添加顶点索引属性（用于 shader 动画）
        const indices = new Float32Array(points.length);
        for (let i = 0; i < points.length; i++) {
            indices[i] = i / (points.length - 1);
        }
        geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));

        // 创建 Shader 材质
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
                    // 流动效果
                    float flow = mod(vIndex - uTime * uFlowSpeed, 1.0);

                    // 渐变透明度
                    float alpha = smoothstep(0.0, 0.1, flow) * smoothstep(1.0, 0.9, flow);

                    // 发光效果
                    float glow = pow(alpha, 0.5) * uGlowIntensity;

                    // 根据进度显示
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
     * 创建粒子效果的迁移线
     * @param {THREE.CatmullRomCurve3} curve - 路径曲线
     * @param {Object} config - 配置
     * @returns {THREE.Points}
     */
    createParticleLine(curve, config) {
        // 注意：实际粒子数量可能与配置不同（如果被手动修改）
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

        // 初始化粒子属性数组
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const alphas = new Float32Array(particleCount);

        // 将粒子均匀分布在曲线路径上
        console.log('[MigrationLine] Distributing particles along curve...');
        for (let i = 0; i < particleCount; i++) {
            // 计算粒子在曲线上的位置参数（0 到 1）
            const t = i / (particleCount - 1);

            // 获取曲线上该位置的坐标
            const point = curve.getPoint(t);

            // 设置粒子位置
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;

            // 设置粒子大小
            sizes[i] = config.particleSize;

            // 初始透明度设为 0（通过 update 方法控制显示）
            alphas[i] = 0;

            // 输出前 3 个粒子的位置用于调试
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

        // 创建粒子材质
        // 粒子动画结合两种方式：
        // 1. 通过修改 alpha 属性实现拖尾效果（光波移动）
        // 2. 通过 uTime uniform 实现粒子大小的脉动效果（呼吸动画）
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(config.color) },
                uTime: { value: 0 } // 用于基于时间的动画效果
            },
            vertexShader: `
                uniform float uTime;
                attribute float size;
                attribute float alpha;
                varying float vAlpha;

                void main() {
                    vAlpha = alpha;  // 使用 alpha 属性控制透明度
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                    // 添加基于时间的大小脉动效果（呼吸动画）
                    // sin 函数产生 -1 到 1 的值，转换为 0 到 1 的范围
                    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
                    // 粒子大小在基础大小的 80% 到 120% 之间变化
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
                    // 创建圆形粒子
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    if (dist > 0.5) discard;

                    // 添加基于时间的颜色高亮效果
                    // 粒子在原色和更亮的颜色之间渐变
                    float brightness = sin(uTime * 3.0) * 0.2 + 1.0; // 1.0 到 1.2 之间
                    vec3 color = uColor * brightness;

                    // 从中心到边缘渐变，并应用 alpha 控制
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
     * 更新动画
     * @param {number} delta - 时间增量
     */
    onUpdate(delta) {
        const currentTime = Date.now();

        this.migrationLines.forEach((lineObject, id) => {
            const state = this.animationStates.get(id);
            const config = lineObject.userData.config;
            const type = lineObject.userData.type;

            if (!state || !state.isPlaying) return;

            // 处理延迟
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

            // 计算进度
            const elapsed = currentTime - state.startTime;
            let progress = elapsed / config.duration;

            // 处理循环
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

            // 根据类型更新动画
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

            // 触发更新事件
            this.emit('update', {
                lineId: id,
                progress: progress,
                userData: lineObject.userData.customData
            });
        });

        // 更新所有区域块
        this.areaBlocks.forEach((areaObject) => {
            this.updateAreaBlock(areaObject, delta);
        });
    }

    /**
     * 更新 Shader 线条动画
     */
    updateShaderLine(lineObject, progress, delta) {
        const material = lineObject.material;
        material.uniforms.uTime.value += delta;
        material.uniforms.uProgress.value = progress;
    }

    /**
     * 初始化粒子位置（固定位置，只设置一次）
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

        // 将粒子均匀分布在整条曲线上（固定位置）
        for (let i = 0; i < particleCount; i++) {
            // 计算粒子在曲线上的位置（0 到 1）
            const t = i / (particleCount - 1);

            // 获取粒子在曲线上的固定位置
            const point = curve.getPoint(t);

            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = point.z;

            // 调试：输出前 3 个粒子的位置
            if (i < 3) {
                console.log(`  Particle ${i} (t=${t.toFixed(3)}):`, {
                    x: point.x.toFixed(2),
                    y: point.y.toFixed(2),
                    z: point.z.toFixed(2)
                });
            }

            // 初始透明度设为 0（通过 update 方法控制显示）
            alphas[i] = 0;
        }

        // 标记 position 需要更新（仅此一次）
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
     * 更新粒子线条动画
     * 实现原理：
     * - 粒子位置固定在曲线上（0 到 1 均匀分布）
     * - 通过透明度控制显示：只显示进度点附近的粒子（拖尾效果）
     * - 通过 uTime 控制粒子大小和亮度的脉动效果（呼吸动画）
     */
    updateParticleLine(lineObject, progress, delta) {
        const geometry = lineObject.geometry;
        const material = lineObject.material;
        const alphas = geometry.attributes.alpha.array;
        const particleCount = lineObject.userData.particleCount;
        const trailLength = lineObject.userData.trailLength;

        // 更新基于时间的动画效果
        material.uniforms.uTime.value += delta;

        // 首次调用时输出详细信息
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

        // 遍历所有粒子，根据当前进度计算透明度
        for (let i = 0; i < particleCount; i++) {
            // 计算粒子在曲线上的位置（0 到 1）
            const particleT = i / (particleCount - 1);

            // 计算粒子与当前进度的距离（负值表示在进度点之前）
            let distance = progress - particleT;

            // 处理循环：如果启用循环，考虑环形距离
            const config = lineObject.userData.config;
            if (config.loop && distance < -0.5) {
                distance += 1; // 循环到下一轮
            }

            // 计算透明度：
            // - 如果粒子在进度点之后的 trailLength 范围内（拖尾），显示并渐变
            // - 否则完全透明
            if (distance >= 0 && distance <= trailLength) {
                // 在拖尾范围内，从 1（进度点）到 0（拖尾末端）渐变
                const fadeRatio = 1 - distance / trailLength;
                alphas[i] = fadeRatio;
                visibleCount++;
                maxAlpha = Math.max(maxAlpha, fadeRatio);

                if (minVisibleIndex === -1) minVisibleIndex = i;
                maxVisibleIndex = i;
            } else {
                // 不在拖尾范围内，完全透明
                alphas[i] = 0;
            }
        }

        // 调试：每 60 帧输出一次状态（约 1 秒）
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

        // 更新 GPU 缓冲区
        geometry.attributes.alpha.needsUpdate = true;
    }

    /**
     * 添加迁移线
     * @param {Object} lineData - 迁移线数据
     */
    async addLine(lineData) {
        await this.createLine(lineData);
    }

    /**
     * 移除迁移线
     * @param {string} id - 迁移线 ID
     */
    removeLine(id) {
        const lineObject = this.migrationLines.get(id);

        if (!lineObject) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        // 清理资源
        if (lineObject.geometry) {
            lineObject.geometry.dispose();
        }
        if (lineObject.material) {
            lineObject.material.dispose();
        }

        // 清理 Line2 的 resize 监听
        if (lineObject.userData.onResize) {
            window.removeEventListener('resize', lineObject.userData.onResize);
        }

        // 从场景移除
        this.remove(lineObject);

        // 从映射表移除
        this.migrationLines.delete(id);
        this.lineDataMap.delete(id);
        this.animationStates.delete(id);
    }

    /**
     * 开始播放指定迁移线动画
     * @param {string} id - 迁移线 ID
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
     * 暂停指定迁移线动画
     * @param {string} id - 迁移线 ID
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
     * 停止指定迁移线动画
     * @param {string} id - 迁移线 ID
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
     * 更新迁移线配置
     * @param {string} id - 迁移线 ID
     * @param {Object} updates - 更新数据
     */
    async updateLine(id, updates) {
        const lineObject = this.migrationLines.get(id);
        const lineData = this.lineDataMap.get(id);

        if (!lineObject || !lineData) {
            console.warn(`MigrationLine: Line with id "${id}" not found`);
            return;
        }

        // 更新数据
        Object.assign(lineData, updates);

        // 如果更新了关键属性，需要重新创建
        if (updates.points || updates.type) {
            // 保存当前状态
            const currentState = this.animationStates.get(id);

            // 移除旧的
            this.removeLine(id);

            // 创建新的
            await this.createLine(lineData);

            // 恢复状态
            if (currentState) {
                this.animationStates.set(id, currentState);
            }
        } else {
            // 只更新配置
            Object.assign(lineObject.userData.config, updates);

            if (lineObject.material.isMeshLineMaterial) {
                // ==== MeshLine 材质属性实时更新 ====
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
                // 纹理变更需要重建（导步异步）
                if (updates.texture !== undefined || updates.alphaTexture !== undefined || updates.textureRepeat !== undefined) {
                    this.removeLine(id);
                    await this.createLine({ ...lineData, ...updates });
                    return;
                }
            } else {
                // 旧版 shader/particle 线 — 只处理颜色
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
     * 开始所有迁移线动画
     */
    startAll() {
        this.animationStates.forEach((state, id) => {
            this.startLine(id);
        });
    }

    /**
     * 停止所有迁移线动画
     */
    stopAll() {
        this.animationStates.forEach((state, id) => {
            this.stopLine(id);
        });
    }

    /**
     * 暂停所有迁移线动画
     */
    pauseAll() {
        this.animationStates.forEach((state, id) => {
            this.pauseLine(id);
        });
    }

    /**
     * 获取迁移线数据
     * @param {string} id - 迁移线 ID
     * @returns {Object}
     */
    getLine(id) {
        return this.lineDataMap.get(id);
    }

    /**
     * 获取所有迁移线数据
     * @returns {Array}
     */
    getAllLines() {
        return Array.from(this.lineDataMap.values());
    }

    /**
     * 获取迁移线状态
     * @param {string} id - 迁移线 ID
     * @returns {Object}
     */
    getLineState(id) {
        return this.animationStates.get(id);
    }

    /**
     * 清除所有迁移线
     */
    clearLines() {
        const ids = Array.from(this.migrationLines.keys());
        ids.forEach((id) => this.removeLine(id));
    }

    // ==================== 区域块相关方法 ====================

    /**
     * 创建区域块的云雾 Shader 材质
     * @param {Object} config - 配置
     * @returns {THREE.ShaderMaterial}
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

                // 随机纹理函数
                vec4 textureRND2D(vec2 uv) {
                    uv = floor(fract(uv) * 1e3);
                    float v = uv.x + uv.y * 1e3;
                    return fract(1e5 * sin(vec4(v * 1e-2, (v + 1.0) * 1e-2, (v + 1e3) * 1e-2, (v + 1e3 + 1.0) * 1e-2)));
                }

                // 噪声函数
                float noise(vec2 p) {
                    vec2 f = fract(p * 1e3);
                    vec4 r = textureRND2D(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(r.x, r.y, f.x), mix(r.z, r.w, f.x), f.y);
                }

                // 云雾函数
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

                    // 云雾效果
                    c.rgb += vec3(0.6, 0.6, 0.8) * cloud(p * 0.3 + time * 0.0002) * 0.6;
                    c.gbr += vec3(0.8, 0.8, 1.0) * cloud(p * 0.2 + time * 0.0002) * 0.8;
                    c.grb += vec3(1.0, 1.0, 1.0) * cloud(p * 0.1 + time * 0.0002) * 1.0;

                    // 应用颜色和透明度
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
     * 创建区域块
     * @param {Array} points - 区域点数组
     * @param {Object} config - 配置
     * @returns {THREE.Group}
     */
    createAreaBlock(points, config) {
        if (!points || points.length < 3) {
            console.warn('MigrationLine: Area block requires at least 3 points');
            return null;
        }

        const group = new THREE.Group();
        group.userData.type = 'areaBlock';

        // 创建 2D 形状
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z);
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].z);
        }
        shape.lineTo(points[0].x, points[0].z); // 闭合

        // 创建墙壁面片（如果启用）
        if (config.showWall !== false) {
            const wallHeight = config.wallHeight || 5;

            // 创建墙壁几何体
            const wallGeometry = new THREE.BufferGeometry();
            const vertices = [];
            const uvs = [];
            const indices = [];

            // 为每条边创建墙壁面片
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];

                const baseIndex = i * 4;

                // 四个顶点（底部两个，顶部两个）
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

                // UV 坐标
                const segmentLength = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.z - p1.z, 2)
                );
                uvs.push(0, 0, segmentLength / wallHeight, 0, 0, 1, segmentLength / wallHeight, 1);

                // 索引（两个三角形）
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

            // 创建云雾材质
            const wallMaterial = this.createCloudShaderMaterial({
                ...config,
                opacity: config.wallOpacity || config.opacity || 0.5
            });
            const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
            wallMesh.userData.isWall = true;
            group.add(wallMesh);
        }

        // 创建底部面片（如果启用）
        if (config.showBottom !== false) {
            // 使用 ShapeGeometry 创建底部面片
            const bottomGeometry = new THREE.ShapeGeometry(shape);

            // 创建云雾材质（使用底部透明度）
            const bottomMaterial = this.createCloudShaderMaterial({
                ...config,
                opacity: config.bottomOpacity || config.opacity || 0.5
            });

            const bottomMesh = new THREE.Mesh(bottomGeometry, bottomMaterial);
            bottomMesh.rotation.x = -Math.PI / 2; // 旋转到水平面
            bottomMesh.position.y = 0; // 确保在 y=0 平面上
            bottomMesh.userData.isBottom = true;
            group.add(bottomMesh);
        }

        // 创建边框（如果启用）
        if (config.showBorder !== false) {
            const borderGeometry = new THREE.BufferGeometry();
            const borderVertices = [];

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                borderVertices.push(p.x, p.y || 0, p.z);
            }
            // 闭合边框
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

        // 创建交互检测用的平面（不可见）
        const interactionGeometry = new THREE.ShapeGeometry(shape);
        const interactionMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        const interactionMesh = new THREE.Mesh(interactionGeometry, interactionMaterial);
        interactionMesh.rotation.x = -Math.PI / 2; // 旋转到水平面
        interactionMesh.userData.isInteraction = true;
        interactionMesh.userData.areaId = config.id;
        group.add(interactionMesh);

        return group;
    }

    /**
     * 更新区域块动画
     * @param {THREE.Group} areaObject - 区域块对象
     * @param {number} delta - 时间增量
     */
    updateAreaBlock(areaObject, delta) {
        // 更新墙壁和底部材质的时间 uniform
        areaObject.children.forEach((child) => {
            if ((child.userData.isWall || child.userData.isBottom) && child.material.uniforms) {
                child.material.uniforms.time.value += delta;
            }
        });
    }

    /**
     * 添加区域块
     * @param {Object} areaData - 区域块数据
     */
    async addArea(areaData) {
        const { id, points, userData } = areaData;

        if (!id || !points || points.length < 3) {
            console.warn('MigrationLine: id and at least 3 points are required for area block');
            return;
        }

        // 合并配置
        const areaConfig = {
            ...this.config.globalConfig,
            ...areaData,
            id
        };

        // 创建区域块
        const areaObject = this.createAreaBlock(points, areaConfig);
        if (!areaObject) return;

        // 设置 userData
        areaObject.userData = {
            ...areaObject.userData,
            id,
            config: areaConfig,
            customData: userData
        };

        // 添加到场景
        this.add(areaObject);

        // 保存到映射表
        this.areaBlocks.set(id, areaObject);
        this.areaDataMap.set(id, areaData);

        // 触发添加事件
        this.emit('areaAdded', { areaId: id, areaData });
    }

    /**
     * 移除区域块
     * @param {string} id - 区域块 ID
     */
    removeArea(id) {
        const areaObject = this.areaBlocks.get(id);

        if (!areaObject) {
            console.warn(`MigrationLine: Area with id "${id}" not found`);
            return;
        }

        // 从场景中移除
        this.remove(areaObject);

        // 清理几何体和材质
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

        // 从映射表中移除
        this.areaBlocks.delete(id);
        this.areaDataMap.delete(id);

        // 触发移除事件
        this.emit('areaRemoved', { areaId: id });
    }

    /**
     * 获取区域块数据
     * @param {string} id - 区域块 ID
     * @returns {Object}
     */
    getArea(id) {
        return this.areaDataMap.get(id);
    }

    /**
     * 获取所有区域块数据
     * @returns {Array}
     */
    getAllAreas() {
        return Array.from(this.areaDataMap.values());
    }

    /**
     * 清除所有区域块
     */
    clearAreas() {
        const ids = Array.from(this.areaBlocks.keys());
        ids.forEach((id) => this.removeArea(id));
    }

    // ==================== 图片点位相关方法 ====================

    /**
     * 加载纹理（带缓存）
     * @param {string} url - 图片 URL
     * @returns {Promise<THREE.Texture>}
     */
    async loadTexture(url) {
        // 检查缓存
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }

        // 加载纹理
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // 缓存纹理
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
     * 创建图片点位
     * @param {Object} markerData - 点位数据
     * @returns {Promise<THREE.Object3D>}
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

        // 验证必需参数
        if (!id || !position || !images) {
            console.warn('ImageMarker: id, position, and images are required');
            return null;
        }

        // 确定当前状态
        const currentState = state || Object.keys(images)[0];
        const imageUrl = images[currentState];

        if (!imageUrl) {
            console.warn(`ImageMarker: No image found for state "${currentState}"`);
            return null;
        }

        // 加载纹理
        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for marker "${id}"`, error);
            return null;
        }

        let markerObject;

        if (type === 'sprite') {
            // 创建 Sprite
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
            // 创建 Plane
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
            // 默认使用 sprite
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

        // 设置位置
        markerObject.position.set(
            position.x + offset.x,
            position.y + offset.y,
            position.z + offset.z
        );

        // 存储用户数据
        markerObject.userData = {
            ...userData,
            markerId: id,
            markerType: type,
            isImageMarker: true
        };

        return markerObject;
    }

    /**
     * 添加图片点位
     * @param {Object} markerData - 点位数据
     */
    async addImageMarker(markerData) {
        const { id } = markerData;

        if (!id) {
            console.warn('ImageMarker: id is required');
            return;
        }

        // 检查是否已存在
        if (this.imageMarkers.has(id)) {
            console.warn(`ImageMarker: Marker with id "${id}" already exists`);
            return;
        }

        // 创建点位对象
        const markerObject = await this.createImageMarker(markerData);

        if (!markerObject) {
            return;
        }

        // 添加到场景
        this.add(markerObject);

        // 保存到映射表
        this.imageMarkers.set(id, markerObject);

        // 保存点位数据
        const currentState = markerData.state || Object.keys(markerData.images)[0];
        this.markerDataMap.set(id, {
            ...markerData,
            state: currentState
        });

        // 触发添加事件
        this.emit('markerAdded', { markerId: id, markerData });
    }

    /**
     * 更新点位状态（切换图片）
     * @param {string} id - 点位 ID
     * @param {string} newState - 新状态
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

        // 加载新纹理
        let texture;
        try {
            texture = await this.loadTexture(imageUrl);
        } catch (error) {
            console.error(`ImageMarker: Failed to load image for state "${newState}"`, error);
            return;
        }

        // 更新材质纹理
        if (markerObject.material) {
            markerObject.material.map = texture;
            markerObject.material.needsUpdate = true;
        }

        // 保存旧状态
        const oldState = markerData.state;

        // 更新数据
        markerData.state = newState;
        this.markerDataMap.set(id, markerData);

        // 触发状态切换事件
        this.emit('markerStateChanged', {
            markerId: id,
            oldState,
            newState
        });
    }

    /**
     * 更新点位配置
     * @param {string} id - 点位 ID
     * @param {Object} updates - 更新的配置
     */
    updateMarker(id, updates) {
        const markerObject = this.imageMarkers.get(id);
        const markerData = this.markerDataMap.get(id);

        if (!markerObject || !markerData) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        // 更新大小
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

        // 更新颜色
        if (updates.color !== undefined && markerObject.material) {
            markerObject.material.color.set(updates.color);
            markerData.color = updates.color;
        }

        // 更新透明度
        if (updates.opacity !== undefined && markerObject.material) {
            markerObject.material.opacity = updates.opacity;
            markerData.opacity = updates.opacity;
        }

        // 更新位置偏移
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

        // 更新缩放
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

        // 更新数据
        this.markerDataMap.set(id, markerData);
    }

    /**
     * 移除图片点位
     * @param {string} id - 点位 ID
     */
    removeMarker(id) {
        const markerObject = this.imageMarkers.get(id);

        if (!markerObject) {
            console.warn(`ImageMarker: Marker "${id}" not found`);
            return;
        }

        // 从场景中移除
        this.remove(markerObject);

        // 释放资源
        if (markerObject.geometry) {
            markerObject.geometry.dispose();
        }
        if (markerObject.material) {
            markerObject.material.dispose();
        }

        // 从映射表中移除
        this.imageMarkers.delete(id);
        this.markerDataMap.delete(id);

        // 触发移除事件
        this.emit('markerRemoved', { markerId: id });
    }

    /**
     * 获取点位数据
     * @param {string} id - 点位 ID
     * @returns {Object}
     */
    getMarker(id) {
        return this.markerDataMap.get(id);
    }

    /**
     * 获取所有点位数据
     * @returns {Array}
     */
    getAllMarkers() {
        return Array.from(this.markerDataMap.values());
    }

    /**
     * 清除所有点位
     */
    clearMarkers() {
        const ids = Array.from(this.imageMarkers.keys());
        ids.forEach((id) => this.removeMarker(id));
    }

    // ==================== 鼠标交互相关方法 ====================

    /**
     * 设置鼠标事件监听
     */
    setupMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            console.warn(
                '[MigrationLine] Cannot setup mouse events: scene/renderer/domElement not ready'
            );
            return;
        }

        const domElement = this.scene.renderer.domElement;

        // 绑定事件处理函数（保存引用以便后续移除）
        this.onMouseClick = this.handleMouseClick.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);

        // 添加事件监听
        domElement.addEventListener('click', this.onMouseClick);
        domElement.addEventListener('mousemove', this.onMouseMove);

        console.log('[MigrationLine] Mouse events setup successfully');
    }

    /**
     * 移除鼠标事件监听
     */
    removeMouseEvents() {
        if (!this.scene || !this.scene.renderer || !this.scene.renderer.domElement) {
            return;
        }

        const domElement = this.scene.renderer.domElement;

        // 移除事件监听
        if (this.onMouseClick) {
            domElement.removeEventListener('click', this.onMouseClick);
        }
        if (this.onMouseMove) {
            domElement.removeEventListener('mousemove', this.onMouseMove);
        }
    }

    /**
     * 处理鼠标点击事件
     * @param {MouseEvent} event - 鼠标事件
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

            // 触发点击事件
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
     * 处理鼠标移动事件
     * @param {MouseEvent} event - 鼠标事件
     */
    handleMouseMove(event) {
        const intersectedMarker = this.getIntersectedMarker(event);

        // 检查鼠标移入/移出
        if (intersectedMarker) {
            const markerId = intersectedMarker.userData.markerId;

            // 如果是新的点位，触发移入事件
            if (!this.hoveredMarker || this.hoveredMarker.userData.markerId !== markerId) {
                // 先触发之前点位的移出事件
                if (this.hoveredMarker) {
                    const prevMarkerId = this.hoveredMarker.userData.markerId;
                    const prevMarkerData = this.markerDataMap.get(prevMarkerId);

                    this.emit('markerMouseLeave', {
                        markerId: prevMarkerId,
                        markerData: prevMarkerData,
                        markerObject: this.hoveredMarker
                    });
                }

                // 触发新点位的移入事件
                const markerData = this.markerDataMap.get(markerId);
                this.emit('markerMouseEnter', {
                    markerId,
                    markerData,
                    markerObject: intersectedMarker
                });

                this.hoveredMarker = intersectedMarker;
            }
        } else {
            // 鼠标不在任何点位上，触发移出事件
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
     * 获取鼠标位置相交的点位
     * @param {MouseEvent} event - 鼠标事件
     * @returns {THREE.Object3D|null}
     */
    getIntersectedMarker(event) {
        if (!this.scene || !this.scene.camera || !this.scene.renderer) {
            console.warn('[MigrationLine] getIntersectedMarker: scene/camera/renderer not ready');
            return null;
        }

        const domElement = this.scene.renderer.domElement;
        const rect = domElement.getBoundingClientRect();

        // 计算鼠标在 Three.js 坐标系中的位置（-1 到 1）
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        console.log('[MigrationLine] Mouse position:', {
            normalized: { x: this.mouse.x, y: this.mouse.y },
            client: { x: event.clientX, y: event.clientY },
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        });

        // 更新射线
        this.raycaster.setFromCamera(this.mouse, this.scene.camera);

        // 获取所有点位对象
        const markerObjects = Array.from(this.imageMarkers.values());

        console.log('[MigrationLine] Marker objects count:', markerObjects.length);
        console.log('[MigrationLine] Marker objects:', markerObjects);

        if (markerObjects.length === 0) {
            console.warn('[MigrationLine] No marker objects to intersect');
            return null;
        }

        // 检测相交
        const intersects = this.raycaster.intersectObjects(markerObjects, false);

        console.log('[MigrationLine] Intersects:', intersects);

        if (intersects.length > 0) {
            console.log('[MigrationLine] Found intersection:', intersects[0]);
            return intersects[0].object;
        }

        return null;
    }

    /**
     * 组件销毁
     */
    onDispose() {
        // 移除鼠标事件监听
        this.removeMouseEvents();

        // 清除所有迁移线
        this.clearLines();

        // 清除所有区域块
        this.clearAreas();

        // 清除所有图片点位
        this.clearMarkers();

        // 清除纹理缓存
        this.textureCache.forEach((texture) => {
            texture.dispose();
        });
        this.textureCache.clear();
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    async updateConfig(newConfig) {
        // 更新全局配置
        if (newConfig.globalConfig) {
            Object.assign(this.globalConfig, newConfig.globalConfig);

            // 如果只有 globalConfig 变化而没有 lines 内容，即时更新已存在线条的材质属性
            if (!newConfig.lines) {
                const gc = newConfig.globalConfig;

                // 纹理相关变化需要重建线条（涉及异步加载）
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
                        // 将 globalConfig 变更合并到 userData.config
                        Object.assign(lineObject.userData.config, gc);
                        if (gc.color !== undefined) mat.uniforms.color.value.set(gc.color);
                        if (gc.lineWidth !== undefined) mat.uniforms.lineWidth.value = gc.lineWidth;
                        if (gc.dashArray !== undefined) {
                            mat.uniforms.dashArray.value = gc.dashArray;
                            mat.uniforms.useDash.value = gc.dashArray > 0 ? 1 : 0;
                        }
                        if (gc.dashRatio !== undefined) mat.uniforms.dashRatio.value = gc.dashRatio;
                        if (gc.opacity !== undefined) mat.uniforms.opacity.value = gc.opacity;
                        // direction 存储在 userData.config 中，updateMeshLine 每帧读取，无需额外处理
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

        // 更新迁移线数据
        if (newConfig.lines) {
            this.clearLines();
            this.config.lines = newConfig.lines;
            for (const lineData of newConfig.lines) {
                await this.createLine(lineData);
            }
        }

        // 更新区域数据
        if (newConfig.areas) {
            this.clearAreas();
            this.config.areas = newConfig.areas;
            for (const areaData of newConfig.areas) {
                await this.addArea(areaData);
            }
        }

        // 更新图片点位数据
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
