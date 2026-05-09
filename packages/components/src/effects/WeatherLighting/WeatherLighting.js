import * as THREE from 'three';
import { Component } from '@w3d/core';
import { EnvironmentEffect } from '../EnvironmentEffect/EnvironmentEffect.js';
import { WeatherClouds } from '../WeatherClouds/WeatherClouds.js';
import { TrafficRoadsideDeviceManager } from '../../traffic/TrafficRoadsideDeviceManager/TrafficRoadsideDeviceManager.js';
import { getLightingPreset } from './presets.js';

function degToRad(d) {
    return (d * Math.PI) / 180;
}

function radToDeg(r) {
    return (r * 180) / Math.PI;
}

function toJulian(date) {
    return date.getTime() / 86400000 + 2440587.5;
}

function getSunPositionApprox(date, latDeg, lonDeg) {
    // 近似太阳位置（足够满足“启动获取 + ≤30min 粒度连续变化”）
    // 输出：altitude/azimuth（弧度）
    const jd = toJulian(date);
    const d = jd - 2451545.0;

    const g = degToRad(357.529 + 0.98560028 * d); // mean anomaly
    const q = degToRad(280.459 + 0.98564736 * d); // mean longitude
    const L = q + degToRad(1.915) * Math.sin(g) + degToRad(0.020) * Math.sin(2 * g); // ecliptic longitude
    const e = degToRad(23.439 - 0.00000036 * d); // obliquity

    const sinL = Math.sin(L);
    const cosL = Math.cos(L);

    const ra = Math.atan2(Math.cos(e) * sinL, cosL);
    const dec = Math.asin(Math.sin(e) * sinL);

    // Greenwich mean sidereal time (deg)
    const gmstDeg = 280.1600 + 360.9856235 * d;
    const lst = degToRad(gmstDeg) + degToRad(lonDeg);

    const H = lst - ra; // hour angle
    const lat = degToRad(latDeg);

    const altitude = Math.asin(
        Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)
    );

    // azimuth: 0 = north, eastward positive (approx)
    const azimuth = Math.atan2(
        -Math.sin(H),
        Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H)
    );

    return { altitude, azimuth };
}

function clampNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max, fallback) {
    const n = clampNumber(value, fallback);
    return Math.max(min, Math.min(max, Math.round(n)));
}

function asVector3Array(value, fallback = [0, 0, 0]) {
    if (!Array.isArray(value) || value.length < 3) return fallback;
    return [
        clampNumber(value[0], fallback[0]),
        clampNumber(value[1], fallback[1]),
        clampNumber(value[2], fallback[2])
    ];
}

function nowMs() {
    return Date.now();
}

function minutesToMs(m) {
    return clampInt(m, 1, 1440, 30) * 60 * 1000;
}

function isPlaceholderWeather(preset) {
    return preset === 'fog';
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target = {}, source = {}) {
    const result = { ...target };

    Object.entries(source || {}).forEach(([key, value]) => {
        if (isPlainObject(value) && isPlainObject(result[key])) {
            result[key] = deepMerge(result[key], value);
            return;
        }

        result[key] = Array.isArray(value) ? [...value] : value;
    });

    return result;
}

function inferTimePresetFromSunAltitude(altitudeRad) {
    // 粗略分段：满足编辑器展示与路灯联动
    if (!Number.isFinite(altitudeRad)) return 'noon';
    if (altitudeRad <= -0.05) return 'night';
    if (altitudeRad <= 0.20) return 'dawn';
    if (altitudeRad <= 0.35) return 'dusk';
    return 'noon';
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getLocalHours(date = new Date()) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function presetToHour(timePreset) {
    switch (timePreset) {
        case 'dawn':
            return 7;
        case 'noon':
            return 12;
        case 'dusk':
            return 18;
        case 'night':
            return 22;
        default:
            return null;
    }
}

export class WeatherLighting extends Component {
    static defaultConfig = {
        name: 'weather-lighting',

        // 'manual' | 'auto'
        mode: 'manual',

        // 手填经纬度
        location: {
            lat: 29.0001,
            lon: 130.0001
        },

        // 在线天气接口，可按需填写
        provider: {
            url: '',
            updateIntervalMinutes: 30,
            timeoutMs: 8000
        },

        // 天气（手动模式）
        weather: {
            preset: 'clear', // clear | rainLight | rainHeavy | snow | fog | cloudy
            enabled: true
        },

        clouds: {
            enabled: true,
            autoByWeather: true,
            renderMode: 'mesh',
            radius: 480,
            thickness: 60,
            height: 120,
            layerCount: 8,
            evolutionSpeed: 0.04,
            shapeContrast: 1.05,
            lightIntensity: 1.0,
            followCamera: false,
            followCameraY: false,
            postProcessing: {
                enabled: false,
                maxDistance: 3000,
                steps: 18
            }
        },

        // 光照
        lighting: {
            // 仅保留一个“当前时段(小时)”：0-23。
            // - 为 null 时使用本地时间（自动）
            // - 为 0-23 时固定到该小时（手动）
            timeHour: null,
            sunDistance: 200,
            // 默认开启方向光阴影，避免“看不到阴影”
            castShadow: true,
            shadowMapSize: 2048,
            // 打开阴影时，自动让场景内 Mesh 接收/投射阴影（避免“开了阴影但看不到”）
            autoApplyMeshShadows: true,
            // 阴影相机范围：默认按 area 估算；点击“适配阴影范围”后会写入
            shadowCamera: null,
            // 阴影目标点：默认跟随天气区域中心；适配后可固定为场景中心
            shadowTarget: {
                mode: 'area', // 'area' | 'scene'
                center: [0, 0, 0]
            },
            // 可选：生成一个仅接收阴影的地面，保证阴影移动肉眼可见
            shadowGround: {
                enabled: true,
                y: 0,
                opacity: 0.25
            }
        },

        // 粒子效果区域
        area: {
            enabled: true,
            followCamera: false,
            center: [0, 0, 0],
            size: [120, 60, 120]
        },

        // 夜间路灯/信号灯（TrafficRoadsideDeviceManager.devices[].type）
        roadsideLights: {
            enabled: true,
            streetLightType: 'streetLight',
            signalLightType: 'signalLight',
            streetLightIntensity: 2.0,
            signalLightIntensity: 1.2,
            distance: 35,
            decay: 2
        }
    };

    onCreate() {
        this._timers = [];

        this._envEffectName = `${this.config.name}__environmentEffect`;
        this._envEffect = null;
        this._cloudsEffectName = `${this.config.name}__weatherClouds`;
        this._cloudsEffect = null;

        this._ambientLight = null;
        this._sunLight = null;
        this._sunTarget = null;
        this._shadowGround = null;

        this._sunEnabledNow = true;

        this._sunLerp = {
            startMs: 0,
            endMs: 0,
            fromPos: new THREE.Vector3(),
            toPos: new THREE.Vector3(),
            altitudeRad: 0
        };

        this._lastWeatherPayload = null;
        this._lastWeatherAppliedPreset = null;

        this._roadsidePointLights = new Map(); // deviceId -> THREE.PointLight
        this._roadsideObservedTraffic = new Map(); // trafficInstance -> unsubscribeFn
        this._lastRoadsideSyncMs = 0;

        this._lastMeshShadowApplyMs = 0;
    }

    async onMounted() {
        this._initLights();

        // 为了遵循 SDK 组件模式：内部需要用到 EnvironmentEffect / WeatherClouds
        // 如果宿主没注册，则这里兜底注册（重复注册会被忽略）
        this.scene.registerComponent('EnvironmentEffect', EnvironmentEffect);
        this.scene.registerComponent('WeatherClouds', WeatherClouds);

        // 创建内部环境粒子组件（不暴露到编辑器组件列表）
        this._envEffect = await this.scene.add('EnvironmentEffect', {
            name: this._envEffectName,
            particleCount: 3000,
            effectArea: this._getEffectArea(),
            animationSpeed: 1.0
        });

        this._cloudsEffect = await this.scene.add('WeatherClouds', {
            name: this._cloudsEffectName,
            enabled: false,
            preset: 'clear',
            renderMode: this.config.clouds?.renderMode ?? 'mesh',
            followCamera: this.config.clouds?.followCamera ?? WeatherLighting.defaultConfig.clouds.followCamera,
            followCameraY: this.config.clouds?.followCameraY === true,
            position: [0, 0, 0],
            height: this.config.clouds?.height ?? 120,
            radius: this.config.clouds?.radius ?? 480,
            thickness: this.config.clouds?.thickness ?? 60,
            layerCount: this.config.clouds?.layerCount ?? 8,
            evolutionSpeed: this.config.clouds?.evolutionSpeed ?? 0.04,
            shapeContrast: this.config.clouds?.shapeContrast ?? 1.05,
            lightIntensity: this.config.clouds?.lightIntensity ?? 1.0,
            postProcessing: {
                enabled: this.config.clouds?.postProcessing?.enabled === true,
                maxDistance: this.config.clouds?.postProcessing?.maxDistance ?? 3000,
                steps: this.config.clouds?.postProcessing?.steps ?? 18
            }
        });

        this._applyAll();
        this._setupTimers();

        this.emit('mounted');
    }

    onDispose() {
        this._clearTimers();

        // 清理内部组件
        try {
            this.scene.remove(this._envEffectName);
        } catch {
            // ignore
        }
        try {
            this.scene.remove(this._cloudsEffectName);
        } catch {
            // ignore
        }

        // 清理灯光
        if (this._ambientLight) {
            this.componentScene.remove(this._ambientLight);
            this._ambientLight = null;
        }
        if (this._sunLight) {
            this.componentScene.remove(this._sunLight);
            this._sunLight = null;
        }
        if (this._sunTarget) {
            this.componentScene.remove(this._sunTarget);
            this._sunTarget = null;
        }

        this._disposeShadowGround();

        // 清理路灯
        this._clearRoadsideLights();
    }

    onUpdate() {
        this._updateSunLerp();

        // 模型可能在组件挂载后才加载完成：定期补开 Mesh 的 cast/receive
        this._applyMeshShadowsThrottled();

        // 路灯同步：不要每帧全量扫，节流
        const now = nowMs();
        if (now - this._lastRoadsideSyncMs > 1000) {
            this._lastRoadsideSyncMs = now;
            this._syncRoadsideLights();
        }
    }

    _applyMeshShadowsThrottled() {
        if (!this._sunLight) return;
        if (!this._sunLight.castShadow) return;
        if (!this.config.lighting?.autoApplyMeshShadows) return;

        const now = nowMs();
        // 2 秒扫一次，避免每帧 traverse
        if (now - this._lastMeshShadowApplyMs < 2000) return;
        this._lastMeshShadowApplyMs = now;

        this.scene?.scene?.traverse?.((obj) => {
            if (obj && obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });
    }

    async updateConfig(newConfig = {}) {
        this.config = deepMerge(this.config, newConfig || {});

        // 更新区域会影响粒子组件
        if (this._envEffect && (newConfig?.area || newConfig?.area?.size || newConfig?.area?.center || newConfig?.area?.followCamera)) {
            const area = this._getEffectArea();
            this._envEffect.updateConfig({ effectArea: area });
        }

        if (this._cloudsEffect && (newConfig?.area || newConfig?.clouds)) {
            const followCamera = this.config.clouds?.followCamera ?? WeatherLighting.defaultConfig.clouds.followCamera;
            const center = this._getConfiguredAreaCenter();
            this._cloudsEffect.updateConfig({
                followCamera,
                followCameraY: this.config.clouds?.followCameraY === true,
                renderMode: this.config.clouds?.renderMode ?? 'mesh',
                position: followCamera ? [0, 0, 0] : [center[0], 0, center[2]],
                height: this.config.clouds?.height ?? 120,
                radius: this.config.clouds?.radius ?? 480,
                thickness: this.config.clouds?.thickness ?? 60,
                layerCount: this.config.clouds?.layerCount ?? 8,
                evolutionSpeed: this.config.clouds?.evolutionSpeed ?? 0.04,
                shapeContrast: this.config.clouds?.shapeContrast ?? 1.05,
                lightIntensity: this.config.clouds?.lightIntensity ?? 1.0,
                postProcessing: {
                    enabled: this.config.clouds?.postProcessing?.enabled === true,
                    maxDistance: this.config.clouds?.postProcessing?.maxDistance ?? 3000,
                    steps: this.config.clouds?.postProcessing?.steps ?? 18
                }
            });
        }

        if (newConfig?.weather || newConfig?.clouds) {
            this._lastWeatherAppliedPreset = null;
        }

        this._applyAll();
        this._setupTimers();

        this.emit('config-updated', { changed: Object.keys(newConfig || {}) });
    }

    // ===== 对外 API（可选） =====

    setMode(mode) {
        this.updateConfig({ mode });
    }

    setWeatherPreset(preset) {
        this.updateConfig({ weather: { ...this.config.weather, preset } });
    }

    setTimePreset(timePreset) {
        // 兼容旧 API：转换为 timeHour
        const hour = presetToHour(timePreset);
        if (hour === null) return;
        this.setTimeHour(hour);
    }

    setTimeHour(timeHour) {
        const hour = timeHour === null || timeHour === undefined ? null : clampInt(timeHour, 0, 23, 12);
        this.updateConfig({ lighting: { ...this.config.lighting, timeHour: hour } });
    }

    _isManualTimeHour() {
        return Number.isFinite(this.config.lighting?.timeHour);
    }

    _getEffectiveTimeHour() {
        if (this._isManualTimeHour()) {
            return clampNumber(this.config.lighting?.timeHour, 12);
        }
        return getLocalHours(new Date());
    }

    _isNightHour(h) {
        // 固定夜间：20:00-次日5:00（不再暴露为参数）
        return h < 5 || h >= 20;
    }

    /**
     * 阴影诊断信息：用于快速判断“无阴影”是参数还是逻辑问题
     */
    getShadowDebugInfo() {
        const rendererShadowEnabled = !!this.scene?.renderer?.instance?.shadowMap?.enabled;
        const now = new Date();
        const hour = this._getEffectiveTimeHour();
        const dayStart = 5;
        const dayEnd = 20;
        const inDayWindow = hour >= dayStart && hour < dayEnd;

        const sunVisible = this._sunLight ? this._sunLight.visible !== false : false;
        const castShadowConfig = !!this.config.lighting?.castShadow;
        const effectiveCastShadow = !!this._sunLight?.castShadow;

        const cam = this._sunLight?.shadow?.camera;
        const shadowCamera = cam
            ? {
                left: cam.left,
                right: cam.right,
                top: cam.top,
                bottom: cam.bottom,
                near: cam.near,
                far: cam.far
            }
            : null;

        return {
            now: now.toISOString(),
            localHour: hour,
            dayWindow: { dayStartHour: dayStart, dayEndHour: dayEnd, inDayWindow },
            rendererShadowEnabled,
            sun: {
                visible: sunVisible,
                intensity: this._sunLight?.intensity ?? 0,
                position: this._sunLight ? [this._sunLight.position.x, this._sunLight.position.y, this._sunLight.position.z] : null,
                target: this._sunTarget ? [this._sunTarget.position.x, this._sunTarget.position.y, this._sunTarget.position.z] : null,
                castShadowConfig,
                effectiveCastShadow
            },
            shadowCamera
        };
    }

    /**
     * 计算并返回“让所有物体都在阴影范围内”的推荐配置（不直接写入 store）
     * 编辑器侧应将返回值 merge 后调用 updateComponentConfig。
     */
    computeShadowFit(options = {}) {
        const margin = clampNumber(options.margin, 10);

        const bounds = this._computeSceneMeshBounds();
        if (!bounds) return null;

        const { box, center, size } = bounds;

        // 用最大维度的半径来粗略覆盖（稳健优先）
        const half = Math.max(size.x, size.y, size.z) / 2 + Math.max(0, margin);
        const far = Math.max(500, half * 10);

        return {
            lighting: {
                castShadow: true,
                autoApplyMeshShadows: true,
                // 让阴影目标点固定在场景中心，避免 followCamera 导致阴影范围跑偏
                shadowTarget: {
                    mode: 'scene',
                    center: [center.x, center.y, center.z]
                },
                shadowCamera: {
                    left: -half,
                    right: half,
                    top: half,
                    bottom: -half,
                    near: 0.5,
                    far
                },
                // 默认开启接收阴影地面，并放到场景包围盒底部
                shadowGround: {
                    ...(this.config.lighting?.shadowGround || {}),
                    enabled: true,
                    y: Number.isFinite(box.min.y) ? box.min.y : 0
                }
            }
        };
    }

    async refreshNow() {
        await this._refreshWeatherOnce();
    }

    // ===== 内部：光照 =====

    _initLights() {
        // 环境光
        this._ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this._ambientLight.name = `${this.config.name}__ambient`;

        // 太阳光
        this._sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this._sunLight.name = `${this.config.name}__sun`;
        this._sunLight.castShadow = !!this.config.lighting?.castShadow;

        // DirectionalLight 的 target 需要在场景图中，才能稳定更新方向/阴影
        this._sunTarget = this._sunLight.target;
        this._sunTarget.name = `${this.config.name}__sunTarget`;

        this.componentScene.add(this._ambientLight);
        this.componentScene.add(this._sunLight);
        this.componentScene.add(this._sunTarget);

        // 初始阴影参数
        this._applySunShadowSettings();
    }

    _applySunShadowSettings() {
        if (!this._sunLight) return;

        const castShadow = !!this.config.lighting?.castShadow;
        const effectiveCastShadow = castShadow && this._sunEnabledNow && this._sunLight.visible !== false;
        this._sunLight.castShadow = effectiveCastShadow;

        if (!effectiveCastShadow) {
            return;
        }

        // renderer 阴影总开关
        try {
            this.scene?.renderer?.enableShadow?.(true);
        } catch {
            // ignore
        }

        const size = clampInt(this.config.lighting?.shadowMapSize ?? 2048, 256, 8192, 2048);
        this._sunLight.shadow.mapSize.width = size;
        this._sunLight.shadow.mapSize.height = size;

        const cam = this._sunLight.shadow.camera;

        // 优先使用“适配后的 shadowCamera”，否则用天气区域大小估算
        const sc = this.config.lighting?.shadowCamera;
        if (sc && typeof sc === 'object') {
            cam.left = clampNumber(sc.left, -60);
            cam.right = clampNumber(sc.right, 60);
            cam.top = clampNumber(sc.top, 60);
            cam.bottom = clampNumber(sc.bottom, -60);
            cam.near = clampNumber(sc.near, 0.5);
            cam.far = clampNumber(sc.far, 500);
        } else {
            const area = this._getEffectArea();
            const halfW = Math.max(1, (area.width || 120) / 2);
            const halfD = Math.max(1, (area.depth || 120) / 2);
            const half = Math.max(halfW, halfD);

            cam.left = -half;
            cam.right = half;
            cam.top = half;
            cam.bottom = -half;
            cam.near = 0.5;
            cam.far = Math.max(500, clampNumber(this.config.lighting?.sunDistance, 200) * 4);
        }
        cam.updateProjectionMatrix();

        // 轻微偏移减少阴影痤疮
        this._sunLight.shadow.bias = -0.0001;

        // 可选：自动给场景 Mesh 开启 cast/receive
        if (this.config.lighting?.autoApplyMeshShadows) {
            this.scene?.scene?.traverse?.((obj) => {
                if (obj && obj.isMesh) {
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                }
            });
        }

        // 可选：阴影接收地面
        this._ensureShadowGround();
    }

    _getShadowTargetCenter() {
        const area = this._getEffectArea();
        const areaCenter = asVector3Array(area.center, [0, 0, 0]);

        const st = this.config.lighting?.shadowTarget;
        if (st && st.mode === 'scene') {
            return asVector3Array(st.center, areaCenter);
        }
        return areaCenter;
    }

    _ensureShadowGround() {
        const sg = this.config.lighting?.shadowGround || {};
        const enabled = !!sg.enabled;

        if (!enabled) {
            this._disposeShadowGround();
            return;
        }

        if (!this._shadowGround) {
            const material = new THREE.ShadowMaterial({
                opacity: Math.max(0, Math.min(1, clampNumber(sg.opacity, 0.35)))
            });
            material.transparent = true;

            const geometry = new THREE.PlaneGeometry(1, 1);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `${this.config.name}__shadowGround`;
            mesh.rotation.x = -Math.PI / 2;
            mesh.receiveShadow = true;
            mesh.castShadow = false;

            this._shadowGround = mesh;
            this.componentScene.add(mesh);
        }

        // 更新不透明度
        const opacity = Math.max(0, Math.min(1, clampNumber(sg.opacity, 0.35)));
        if (this._shadowGround.material && this._shadowGround.material.opacity !== opacity) {
            this._shadowGround.material.opacity = opacity;
        }

        // 尺寸与位置：跟随天气区域中心，大小取 area 的 width/depth
        const area = this._getEffectArea();
        const center = asVector3Array(area.center, [0, 0, 0]);
        const y = clampNumber(sg.y, 0);
        const width = Math.max(1, clampNumber(area.width, 120));
        const depth = Math.max(1, clampNumber(area.depth, 120));

        // 仅在尺寸变化时重建几何体（避免每帧创建）
        const prevW = clampNumber(this._shadowGround.userData?._w, 0);
        const prevD = clampNumber(this._shadowGround.userData?._d, 0);
        if (Math.abs(prevW - width) > 1e-3 || Math.abs(prevD - depth) > 1e-3) {
            const oldGeo = this._shadowGround.geometry;
            this._shadowGround.geometry = new THREE.PlaneGeometry(width, depth);
            oldGeo?.dispose?.();
            this._shadowGround.userData._w = width;
            this._shadowGround.userData._d = depth;
        }

        this._shadowGround.position.set(center[0], y, center[2]);
    }

    _disposeShadowGround() {
        if (!this._shadowGround) return;
        this.componentScene.remove(this._shadowGround);
        try {
            this._shadowGround.geometry?.dispose?.();
            this._shadowGround.material?.dispose?.();
        } catch {
            // ignore
        }
        this._shadowGround = null;
    }

    _scheduleSunTarget() {
        const distance = clampNumber(this.config.lighting?.sunDistance, 200);

        const h = this._getEffectiveTimeHour();
        const dayStart = 5;
        const dayEnd = 20;

        if (this._isNightHour(h)) {
            this._sunEnabledNow = false;
            this._currentAutoTimePreset = 'night';
            if (this._sunLight) {
                this._sunLight.intensity = 0;
                this._sunLight.visible = false;
            }
            this._applySunShadowSettings();
            return;
        }

        this._sunEnabledNow = true;
        if (this._sunLight) {
            this._sunLight.visible = true;
        }

        const t = (h - dayStart) / Math.max(1e-6, dayEnd - dayStart);
        const k = Math.max(0, Math.min(1, t));

        // 简化：固定“半圆太阳路径”，不暴露偏移/角度等参数
        const minAlt = degToRad(0);
        const maxAlt = degToRad(70);
        const altitude = minAlt + Math.sin(Math.PI * k) * (maxAlt - minAlt);

        const aziStart = degToRad(90);
        const aziEnd = degToRad(270);
        const azimuth = lerp(aziStart, aziEnd, k);

        // SunCalc：azimuth 从南向西为正（Three 默认约定不一致），这里做一个稳定映射：
        // 使用球坐标，y=up。让太阳围绕场景旋转即可，不追求严苛天文方位。
        const y = Math.sin(altitude) * distance;
        const r = Math.cos(altitude) * distance;
        const x = Math.sin(azimuth) * r;
        const z = Math.cos(azimuth) * r;

        const c = this._getShadowTargetCenter();
        const target = new THREE.Vector3(c[0] + x, c[1] + y, c[2] + z);

        // 太阳照向 shadowTarget（默认=区域中心；适配后=场景中心）
        if (this._sunTarget) {
            this._sunTarget.position.set(c[0], c[1], c[2]);
        }

        if (this._isManualTimeHour()) {
            // 手动小时：立即应用，避免“还在 lerp 看起来不变化”
            this._sunLight.position.copy(target);
            this._sunLerp.startMs = 0;
            this._sunLerp.endMs = 0;
            this._sunLerp.altitudeRad = altitude;
        } else {
            // 自动本地时间：用固定粒度做平滑过渡
            const now = nowMs();
            const intervalMs = minutesToMs(10);
            this._sunLerp.startMs = now;
            this._sunLerp.endMs = now + intervalMs;
            this._sunLerp.fromPos.copy(this._sunLight.position);
            this._sunLerp.toPos.copy(target);
            this._sunLerp.altitudeRad = altitude;

            if (this._sunLight.position.lengthSq() === 0) {
                this._sunLight.position.copy(target);
            }
        }

        // 太阳光强度：随高度角变化（夜晚极低）
        const sunIntensity = Math.max(0, Math.min(1.2, Math.max(0, Math.sin(altitude)) * 1.2));
        this._sunLight.intensity = sunIntensity;

        // 阴影参数可能随 area/开关变化
        this._applySunShadowSettings();

        // 估算 timePreset（用于路灯开关）
        this._currentAutoTimePreset = inferTimePresetFromSunAltitude(altitude);
    }

    _updateSunLerp() {
        if (!this._sunLight) return;
        if (!this._sunLerp.endMs || this._sunLerp.endMs <= this._sunLerp.startMs) return;

        const now = nowMs();
        const t = (now - this._sunLerp.startMs) / (this._sunLerp.endMs - this._sunLerp.startMs);
        const k = Math.max(0, Math.min(1, t));

        this._sunLight.position.lerpVectors(this._sunLerp.fromPos, this._sunLerp.toPos, k);
    }

    _applyLightingPreset(timePreset) {
        const p = getLightingPreset(timePreset);
        if (this._ambientLight) {
            this._ambientLight.color = new THREE.Color(p.ambient.color);
            this._ambientLight.intensity = p.ambient.intensity;
        }
        if (this._sunLight) {
            this._sunLight.color = new THREE.Color(p.sun.color);
            // sun 模式下强度由太阳高度角驱动；preset 模式用预设强度
            if (this.config.lighting?.mode === 'preset') {
                this._sunLight.intensity = p.sun.intensity;
            }
        }
    }

    _applySunDirectionFromTimePreset(timePreset) {
        if (!this._sunLight) return;
        // 兼容旧逻辑：timePreset -> timeHour
        const hour = presetToHour(timePreset);
        if (hour === null) return;
        this.updateConfig({ lighting: { ...this.config.lighting, timeHour: hour } });
    }

    _computeSceneMeshBounds() {
        const root = this.scene?.scene;
        if (!root) return null;

        const box = new THREE.Box3();
        const tmp = new THREE.Box3();
        let hasAny = false;

        root.traverse((obj) => {
            if (!obj || !obj.isMesh) return;
            if (obj.name === `${this.config.name}__shadowGround`) return;
            tmp.setFromObject(obj);
            if (tmp.isEmpty()) return;
            if (!hasAny) {
                box.copy(tmp);
                hasAny = true;
            } else {
                box.union(tmp);
            }
        });

        if (!hasAny) return null;

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        return { box, center, size };
    }

    // ===== 内部：天气 =====

    _getEffectArea() {
        const area = this.config.area || {};
        const size = asVector3Array(area.size, WeatherLighting.defaultConfig.area.size);

        // followCamera: 若启用则以当前相机为中心（Y 也跟随，保持直观）
        let center = asVector3Array(area.center, WeatherLighting.defaultConfig.area.center);
        if (area.followCamera && this.scene?.camera?.instance) {
            const p = this.scene.camera.instance.position;
            center = [p.x, p.y, p.z];
        }

        return {
            width: Math.abs(size[0]),
            height: Math.abs(size[1]),
            depth: Math.abs(size[2]),
            center,
            followCamera: !!area.followCamera
        };
    }

    _getConfiguredAreaCenter() {
        return asVector3Array(this.config.area?.center, WeatherLighting.defaultConfig.area.center);
    }

    _applyWeatherPreset(preset) {
        if (!this._envEffect) return;
        if (!this.config.weather?.enabled) {
            this._envEffect.clearEffect();
            this._applyCloudPreset('clear');
            return;
        }

        // 占位：雾暂不做实际效果
        if (isPlaceholderWeather(preset)) {
            this._envEffect.clearEffect();
            this._applyCloudPreset('overcast');
            this.emit('placeholder', { feature: preset });
            return;
        }

        if (preset === 'clear') {
            this._envEffect.clearEffect();
            this._applyCloudPreset('clear');
            return;
        }

        if (preset === 'rainLight') {
            this._envEffect.setEffect('rain', 30);
            this._applyCloudPreset('cloudy');
            return;
        }

        if (preset === 'rainHeavy') {
            this._envEffect.setEffect('rain', 80);
            this._applyCloudPreset('storm');
            return;
        }

        if (preset === 'snow') {
            this._envEffect.setEffect('snow', 60);
            this._applyCloudPreset('overcast');
            return;
        }

        if (preset === 'cloudy') {
            this._envEffect.clearEffect();
            this._applyCloudPreset('cloudy');
            return;
        }

        // fallback
        this._envEffect.clearEffect();
        this._applyCloudPreset('clear');
    }

    _applyCloudPreset(preset) {
        if (!this._cloudsEffect) return;

        const cloudsConfig = this.config.clouds || {};
        if (!cloudsConfig.enabled || !cloudsConfig.autoByWeather) {
            this._cloudsEffect.updateConfig({ enabled: false });
            return;
        }

        const followCamera = cloudsConfig.followCamera ?? WeatherLighting.defaultConfig.clouds.followCamera;
        const center = this._getConfiguredAreaCenter();
        this._cloudsEffect.updateConfig({
            preset,
            followCamera,
            followCameraY: cloudsConfig.followCameraY === true,
            renderMode: cloudsConfig.renderMode ?? 'mesh',
            position: followCamera ? [0, 0, 0] : [center[0], 0, center[2]],
            height: cloudsConfig.height ?? 120,
            radius: cloudsConfig.radius ?? 480,
            thickness: cloudsConfig.thickness ?? 60,
            layerCount: cloudsConfig.layerCount ?? 8,
            evolutionSpeed: cloudsConfig.evolutionSpeed ?? 0.04,
            shapeContrast: cloudsConfig.shapeContrast ?? 1.05,
            lightIntensity: cloudsConfig.lightIntensity ?? 1.0,
            postProcessing: {
                enabled: cloudsConfig.postProcessing?.enabled === true,
                maxDistance: cloudsConfig.postProcessing?.maxDistance ?? 3000,
                steps: cloudsConfig.postProcessing?.steps ?? 18
            }
        });
    }

    async _refreshWeatherOnce() {
        const url = this.config.provider?.url;
        if (!url) return;

        const lat = clampNumber(this.config.location?.lat, 29.0001);
        const lon = clampNumber(this.config.location?.lon, 130.0001);

        const controller = new AbortController();
        const timeoutMs = clampInt(this.config.provider?.timeoutMs ?? 8000, 500, 60000, 8000);
        const t = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const full = `${url}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
            const res = await fetch(full, { signal: controller.signal });
            if (!res.ok) throw new Error(`Weather API ${res.status}`);

            const data = await res.json();
            this._lastWeatherPayload = data;

            const preset = data?.weather?.preset;
            const apiTimeHour = data?.lighting?.timeHour;
            const timePreset = data?.lighting?.timePreset;
            const mappedHour = Number.isFinite(apiTimeHour) ? clampInt(apiTimeHour, 0, 23, 12) : presetToHour(timePreset);

            // 自动模式：允许接口同时给出天气与时段
            const next = {
                weather: {
                    ...this.config.weather,
                    preset: typeof preset === 'string' ? preset : this.config.weather.preset
                },
                lighting: {
                    ...this.config.lighting,
                    // auto 模式下允许接口驱动时段：统一落到 timeHour
                    timeHour: mappedHour !== null ? mappedHour : this.config.lighting?.timeHour
                }
            };

            // 不要把 mode 改掉，只更新内部应用状态
            this.config = { ...this.config, ...next };
            this._applyAll();
            this.emit('weather-updated', data);
        } catch (error) {
            this.emit('weather-error', { error: error?.message || String(error) });
        } finally {
            clearTimeout(t);
        }
    }

    _setupTimers() {
        // 先清掉旧定时器，避免重复
        this._clearTimers();

        // 太阳：只保留 timeHour。若未设置则使用本地时间并按固定粒度刷新。
        this._scheduleSunTarget();
        if (!this._isManualTimeHour()) {
            this._timers.push(setInterval(() => this._scheduleSunTarget(), minutesToMs(10)));
        }

        // 天气：仅 auto
        if (this.config.mode === 'auto') {
            const weatherIntervalMs = minutesToMs(this.config.provider?.updateIntervalMinutes ?? 30);
            this._refreshWeatherOnce();
            this._timers.push(setInterval(() => this._refreshWeatherOnce(), weatherIntervalMs));
        }
    }

    _clearTimers() {
        for (const id of this._timers) {
            clearInterval(id);
        }
        this._timers = [];
    }

    _applyAll() {
        // 阴影开关/参数应用
        this._applySunShadowSettings();

        // 可能仅开启了 shadowGround，但 castShadow 关闭，这里也要同步一次
        this._ensureShadowGround();

        // 光照应用：按当前 hour 推导一个时段用于色温/环境光
        const tp = this._currentAutoTimePreset || 'noon';
        this._applyLightingPreset(tp);

        // 天气应用（避免重复 setEffect）
        const preset = this.config.weather?.preset || 'clear';
        if (preset !== this._lastWeatherAppliedPreset) {
            this._applyWeatherPreset(preset);
            this._lastWeatherAppliedPreset = preset;
        }

        // 路灯同步：立即做一次
        this._syncRoadsideLights();
    }

    // ===== 内部：路灯联动 =====

    _isNightNow() {
        return (this._currentAutoTimePreset || 'noon') === 'night';
    }

    _getTrafficComponents() {
        const all = this.scene?.componentManager?.getAll?.() || [];
        return all.filter((c) => c instanceof TrafficRoadsideDeviceManager);
    }

    _observeTrafficIfNeeded(traffic) {
        if (!traffic || this._roadsideObservedTraffic.has(traffic)) return;

        const handler = () => {
            // traffic 配置变化，触发一次重建
            this._syncRoadsideLights(true);
        };

        traffic.on('config-updated', handler);
        this._roadsideObservedTraffic.set(traffic, () => traffic.off('config-updated', handler));
    }

    _clearRoadsideLights() {
        // 解除监听
        for (const [, unsub] of this._roadsideObservedTraffic) {
            try { unsub(); } catch { /* ignore */ }
        }
        this._roadsideObservedTraffic.clear();

        // 移除 lights
        for (const [, light] of this._roadsidePointLights) {
            if (light.parent) {
                light.parent.remove(light);
            }
        }
        this._roadsidePointLights.clear();
    }

    _syncRoadsideLights(force = false) {
        if (!this.config.roadsideLights?.enabled) {
            if (this._roadsidePointLights.size) this._clearRoadsideLights();
            return;
        }

        const night = this._isNightNow();

        // 白天不需要灯光：直接清掉
        if (!night) {
            if (this._roadsidePointLights.size) this._clearRoadsideLights();
            return;
        }

        const traffics = this._getTrafficComponents();
        for (const t of traffics) {
            this._observeTrafficIfNeeded(t);
        }

        // 以当前 traffic devices 为真值来源
        const desired = new Map(); // deviceId -> { object, intensity }
        const streetType = this.config.roadsideLights.streetLightType || 'streetLight';
        const signalType = this.config.roadsideLights.signalLightType || 'signalLight';

        for (const traffic of traffics) {
            const devices = Array.isArray(traffic.config?.devices) ? traffic.config.devices : [];
            for (const d of devices) {
                const id = typeof d?.id === 'string' ? d.id : null;
                if (!id) continue;

                const type = d?.type;
                if (type !== streetType && type !== signalType) continue;

                const obj = traffic.getDeviceObject(id);
                if (!obj) continue;

                const intensity = type === streetType
                    ? clampNumber(this.config.roadsideLights.streetLightIntensity, 2.0)
                    : clampNumber(this.config.roadsideLights.signalLightIntensity, 1.2);

                desired.set(id, { obj, intensity });
            }
        }

        // 移除多余
        for (const [deviceId, light] of this._roadsidePointLights) {
            if (!desired.has(deviceId)) {
                if (light.parent) light.parent.remove(light);
                this._roadsidePointLights.delete(deviceId);
            }
        }

        // 创建/更新
        for (const [deviceId, meta] of desired) {
            const existing = this._roadsidePointLights.get(deviceId);
            const distance = clampNumber(this.config.roadsideLights.distance, 35);
            const decay = clampNumber(this.config.roadsideLights.decay, 2);

            if (!existing) {
                const light = new THREE.PointLight(0xffffff, meta.intensity, distance, decay);
                light.name = `${this.config.name}__roadside_${deviceId}`;
                // 稍微抬高一点，避免和模型重合
                light.position.set(0, 3, 0);
                meta.obj.add(light);
                this._roadsidePointLights.set(deviceId, light);
            } else {
                if (force) {
                    // 可能 device object 变了，确保挂载正确
                    if (existing.parent !== meta.obj) {
                        if (existing.parent) existing.parent.remove(existing);
                        meta.obj.add(existing);
                    }
                }
                existing.intensity = meta.intensity;
                existing.distance = distance;
                existing.decay = decay;
            }
        }
    }
}
