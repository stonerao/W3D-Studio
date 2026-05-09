import { Component } from '@w3d/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const FLOAT_EPSILON = 0.000001;

const CLOUD_PRESETS = {
    clear: {
        enabled: false,
        coverage: 0.04,
        opacity: 0.18,
        density: 0.35,
        softness: 0.32,
        cloudColor: '#ffffff',
        shadowColor: '#d7e3ef',
        windSpeed: 0.025
    },
    scattered: {
        enabled: true,
        coverage: 0.28,
        opacity: 0.62,
        density: 0.75,
        softness: 0.24,
        cloudColor: '#ffffff',
        shadowColor: '#b7c4d8',
        windSpeed: 0.042
    },
    cloudy: {
        enabled: true,
        coverage: 0.58,
        opacity: 0.82,
        density: 1.0,
        softness: 0.22,
        cloudColor: '#f2f6fb',
        shadowColor: '#8795aa',
        windSpeed: 0.052
    },
    overcast: {
        enabled: true,
        coverage: 0.82,
        opacity: 0.88,
        density: 1.15,
        softness: 0.18,
        cloudColor: '#dfe6ef',
        shadowColor: '#667386',
        windSpeed: 0.046
    },
    storm: {
        enabled: true,
        coverage: 0.92,
        opacity: 0.94,
        density: 1.28,
        softness: 0.15,
        cloudColor: '#c8d0dc',
        shadowColor: '#394455',
        windSpeed: 0.075
    }
};

const CLOUD_SHADER = {
    vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;

        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vLocalPosition = position;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform float uCoverage;
        uniform float uOpacity;
        uniform float uDensity;
        uniform float uSoftness;
        uniform float uNoiseScale;
        uniform float uLayerOffset;
        uniform float uLayerRatio;
        uniform float uHorizonFade;
        uniform float uEvolutionSpeed;
        uniform float uShapeContrast;
        uniform float uLightIntensity;
        uniform vec2 uWindVelocity;
        uniform vec3 uCloudColor;
        uniform vec3 uShadowColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float hash3(vec3 p) {
            p = fract(p * vec3(123.34, 456.21, 789.43));
            p += dot(p, p.yzx + 45.32);
            return fract((p.x + p.y) * p.z);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
            float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash3(i + vec3(1.0, 1.0, 1.0));

            float nx00 = mix(n000, n100, f.x);
            float nx10 = mix(n010, n110, f.x);
            float nx01 = mix(n001, n101, f.x);
            float nx11 = mix(n011, n111, f.x);
            float nxy0 = mix(nx00, nx10, f.y);
            float nxy1 = mix(nx01, nx11, f.y);
            return mix(nxy0, nxy1, f.z);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.52;
            mat2 rotate = mat2(1.62, 1.18, -1.18, 1.62);

            for (int i = 0; i < 5; i++) {
                value += amplitude * noise(p);
                p = rotate * p + vec2(11.5, 7.3);
                amplitude *= 0.48;
            }

            return value;
        }

        float fbm3(vec3 p) {
            float value = 0.0;
            float amplitude = 0.54;
            mat3 rotate = mat3(
                0.80, 0.36, -0.48,
                -0.30, 0.93, 0.20,
                0.52, -0.02, 0.85
            );

            for (int i = 0; i < 5; i++) {
                value += amplitude * noise3(p);
                p = rotate * p * 2.04 + vec3(8.7, 3.1, 5.6);
                amplitude *= 0.48;
            }

            return value;
        }

        void main() {
            vec2 centeredUv = abs(vUv * 2.0 - 1.0);
            float edgeDistance = length(vUv * 2.0 - 1.0);
            float horizon = 1.0 - smoothstep(max(0.0, 1.0 - uHorizonFade), 1.0, edgeDistance);

            vec2 uv = vWorldPosition.xz / max(uNoiseScale, 0.001);
            vec2 windPrimary = uWindVelocity * uTime;
            vec2 windSecondary = uWindVelocity * uTime * 0.37;
            float vertical = clamp(uLayerRatio, 0.0, 1.0);
            float evolution = uTime * uEvolutionSpeed + uLayerOffset * 0.013;

            vec3 shapePosition = vec3(uv + windPrimary + vec2(uLayerOffset, -uLayerOffset * 0.37), vertical * 2.2 + evolution);
            float shapeNoise = fbm3(shapePosition);
            float billowNoise = fbm3(shapePosition * 2.35 + vec3(windSecondary, 7.4));
            float detailNoise = fbm(uv * 5.0 - windSecondary * 1.6 + vec2(2.7, 8.3) + uLayerOffset);
            float cloudField = shapeNoise * 0.58 + billowNoise * 0.30 + detailNoise * 0.12;
            cloudField = pow(clamp(cloudField, 0.0, 1.0), max(0.35, 1.35 - uShapeContrast * 0.35));

            float threshold = mix(0.88, 0.26, clamp(uCoverage, 0.0, 1.0));
            float cloudAlpha = smoothstep(threshold, threshold + max(0.01, uSoftness), cloudField);
            float verticalProfile = smoothstep(0.00, 0.22, vertical) * (1.0 - smoothstep(0.86, 1.0, vertical));
            verticalProfile = max(verticalProfile, 0.32 * (1.0 - vertical));
            float erosion = smoothstep(0.15, 0.85, billowNoise + verticalProfile * 0.18);
            cloudAlpha *= clamp(uOpacity, 0.0, 1.0) * max(0.0, uDensity) * horizon * verticalProfile * erosion;

            vec3 sunDirection = normalize(uSunDirection);
            vec3 cloudNormal = normalize(vWorldNormal);
            float topLight = clamp(dot(cloudNormal, sunDirection) * 0.5 + 0.5, 0.0, 1.0);
            float selfShadow = smoothstep(threshold + 0.05, threshold + 0.42, cloudField + vertical * 0.16);
            float heightLight = mix(0.58, 1.15, vertical);
            float rimLight = pow(max(dot(normalize(vec3(vUv.x - 0.5, 0.22, vUv.y - 0.5)), normalize(vec3(sunDirection.x, abs(sunDirection.y) + 0.2, sunDirection.z))), 0.0), 3.0);
            float cloudBody = smoothstep(threshold + 0.02, threshold + max(0.05, uSoftness) + 0.24, cloudField);
            vec3 color = mix(uShadowColor, uCloudColor, cloudBody * 0.72 + selfShadow * 0.28);
            color *= mix(0.62, 1.25, topLight) * heightLight * uLightIntensity;
            color += uSunColor * rimLight * (0.18 + 0.32 * selfShadow) * uLightIntensity;

            if (cloudAlpha < 0.01) discard;
            gl_FragColor = vec4(color, clamp(cloudAlpha, 0.0, 0.98));
        }
    `
};

const POST_PROCESSING_CLOUD_SHADER = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uProjectionMatrixInverse: { value: new THREE.Matrix4() },
        uCameraMatrixWorld: { value: new THREE.Matrix4() },
        uCameraPosition: { value: new THREE.Vector3() },
        uCloudWorldToLocal: { value: new THREE.Matrix4() },
        uLayerThickness: { value: 90 },
        uCoverage: { value: 0.58 },
        uOpacity: { value: 0.72 },
        uDensity: { value: 1.0 },
        uSoftness: { value: 0.2 },
        uNoiseScale: { value: 180 },
        uShapeContrast: { value: 1.1 },
        uEvolutionSpeed: { value: 0.035 },
        uLightIntensity: { value: 1.0 },
        uMaxDistance: { value: 3000 },
        uHorizonFade: { value: 0.08 },
        uSteps: { value: 18 },
        uWindVelocity: { value: new THREE.Vector2(0.055, 0.012) },
        uCloudColor: { value: new THREE.Color('#f2f6fb') },
        uShadowColor: { value: new THREE.Color('#748196') },
        uSunColor: { value: new THREE.Color('#fff2ce') },
        uSunDirection: { value: new THREE.Vector3(0.35, 0.76, 0.25).normalize() }
    },
    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform mat4 uProjectionMatrixInverse;
        uniform mat4 uCameraMatrixWorld;
        uniform vec3 uCameraPosition;
        uniform mat4 uCloudWorldToLocal;
        uniform float uLayerThickness;
        uniform float uCoverage;
        uniform float uOpacity;
        uniform float uDensity;
        uniform float uSoftness;
        uniform float uNoiseScale;
        uniform float uShapeContrast;
        uniform float uEvolutionSpeed;
        uniform float uLightIntensity;
        uniform float uMaxDistance;
        uniform float uHorizonFade;
        uniform int uSteps;
        uniform vec2 uWindVelocity;
        uniform vec3 uCloudColor;
        uniform vec3 uShadowColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;
        varying vec2 vUv;

        float hash(vec3 p) {
            p = fract(p * vec3(123.34, 456.21, 789.43));
            p += dot(p, p.yzx + 45.32);
            return fract((p.x + p.y) * p.z);
        }

        float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            float n000 = hash(i + vec3(0.0, 0.0, 0.0));
            float n100 = hash(i + vec3(1.0, 0.0, 0.0));
            float n010 = hash(i + vec3(0.0, 1.0, 0.0));
            float n110 = hash(i + vec3(1.0, 1.0, 0.0));
            float n001 = hash(i + vec3(0.0, 0.0, 1.0));
            float n101 = hash(i + vec3(1.0, 0.0, 1.0));
            float n011 = hash(i + vec3(0.0, 1.0, 1.0));
            float n111 = hash(i + vec3(1.0, 1.0, 1.0));

            float nx00 = mix(n000, n100, f.x);
            float nx10 = mix(n010, n110, f.x);
            float nx01 = mix(n001, n101, f.x);
            float nx11 = mix(n011, n111, f.x);
            return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
        }

        float fbm(vec3 p) {
            float value = 0.0;
            float amplitude = 0.54;
            mat3 rotate = mat3(
                0.80, 0.36, -0.48,
                -0.30, 0.93, 0.20,
                0.52, -0.02, 0.85
            );

            for (int i = 0; i < 5; i++) {
                value += amplitude * noise(p);
                p = rotate * p * 2.04 + vec3(8.7, 3.1, 5.6);
                amplitude *= 0.48;
            }

            return value;
        }

        vec3 getRayDirection(vec2 uv) {
            vec2 ndc = uv * 2.0 - 1.0;
            vec4 clip = vec4(ndc, 1.0, 1.0);
            vec4 view = uProjectionMatrixInverse * clip;
            view.xyz /= max(view.w, 0.000001);
            return normalize((uCameraMatrixWorld * vec4(normalize(view.xyz), 0.0)).xyz);
        }

        float sampleCloudDensity(vec3 localPosition) {
            float thickness = max(uLayerThickness, 0.001);
            float height01 = clamp(localPosition.y / thickness, 0.0, 1.0);
            float verticalProfile = smoothstep(0.02, 0.25, height01) * (1.0 - smoothstep(0.78, 1.0, height01));
            verticalProfile = max(verticalProfile, 0.28 * (1.0 - height01));

            vec2 wind = uWindVelocity * uTime;
            float evolution = uTime * uEvolutionSpeed;
            vec3 p = vec3(localPosition.xz / max(uNoiseScale, 0.001) + wind, height01 * 2.6 + evolution);
            float shape = fbm(p);
            float billow = fbm(p * 2.45 + vec3(wind * 0.32, 7.3));
            float detail = fbm(p * 5.25 + vec3(-wind * 1.5, 13.1));
            float field = shape * 0.58 + billow * 0.30 + detail * 0.12;
            field = pow(clamp(field, 0.0, 1.0), max(0.35, 1.35 - uShapeContrast * 0.35));

            float threshold = mix(0.88, 0.26, clamp(uCoverage, 0.0, 1.0));
            float density = smoothstep(threshold, threshold + max(0.01, uSoftness), field);
            density *= verticalProfile;
            density *= smoothstep(0.10, 0.85, billow + verticalProfile * 0.18);
            return clamp(density, 0.0, 1.0);
        }

        vec3 shadeCloud(vec3 localPosition, float density, float height01, vec3 rayDirWorld, float stepLength) {
            vec3 sunDirection = normalize(uSunDirection);
            vec3 localSunDirection = normalize((uCloudWorldToLocal * vec4(sunDirection, 0.0)).xyz);
            float lightProbeA = sampleCloudDensity(localPosition + localSunDirection * stepLength * 1.5);
            float lightProbeB = sampleCloudDensity(localPosition + localSunDirection * stepLength * 3.5);
            float transmittance = exp(-(lightProbeA * 0.9 + lightProbeB * 1.2) * max(uDensity, 0.0));
            float forwardScatter = pow(max(dot(rayDirWorld, sunDirection), 0.0), 5.0);
            float topLight = mix(0.55, 1.18, height01);
            vec3 bodyColor = mix(uShadowColor, uCloudColor, transmittance * 0.72 + density * 0.28);
            bodyColor *= topLight * uLightIntensity;
            bodyColor += uSunColor * forwardScatter * (0.18 + density * 0.26) * uLightIntensity;
            return bodyColor;
        }

        void main() {
            vec4 baseColor = texture2D(tDiffuse, vUv);
            vec3 rayDirWorld = getRayDirection(vUv);
            vec3 rayOriginLocal = (uCloudWorldToLocal * vec4(uCameraPosition, 1.0)).xyz;
            vec3 rayDirLocal = (uCloudWorldToLocal * vec4(rayDirWorld, 0.0)).xyz;
            float rayY = rayDirLocal.y;
            float thickness = max(uLayerThickness, 0.001);

            if (abs(rayY) < 0.0001) {
                gl_FragColor = baseColor;
                return;
            }

            float t0 = (0.0 - rayOriginLocal.y) / rayY;
            float t1 = (thickness - rayOriginLocal.y) / rayY;
            float tNear = max(min(t0, t1), 0.0);
            float tFar = min(max(t0, t1), max(uMaxDistance, 1.0));

            if (tFar <= tNear) {
                gl_FragColor = baseColor;
                return;
            }

            int steps = uSteps;
            float travel = tFar - tNear;
            float stepLength = travel / float(steps);
            float localRayY = abs(normalize(rayDirLocal).y);
            float edgeFade = smoothstep(0.0, max(0.001, uHorizonFade), localRayY);
            vec3 accumulatedColor = vec3(0.0);
            float accumulatedAlpha = 0.0;

            for (int i = 0; i < 32; i++) {
                if (i >= steps) break;
                float jitter = fract(sin(dot(vUv * uResolution + vec2(float(i)), vec2(12.9898, 78.233))) * 43758.5453);
                float t = tNear + (float(i) + 0.35 + jitter * 0.30) * stepLength;
                vec3 localPosition = rayOriginLocal + rayDirLocal * t;
                float height01 = clamp(localPosition.y / thickness, 0.0, 1.0);
                float density = sampleCloudDensity(localPosition);
                float sampleAlpha = 1.0 - exp(-density * max(uDensity, 0.0) * stepLength / thickness * 3.2);
                sampleAlpha *= clamp(uOpacity, 0.0, 1.0) * edgeFade;
                sampleAlpha = clamp(sampleAlpha, 0.0, 0.42);

                vec3 sampleColor = shadeCloud(localPosition, density, height01, rayDirWorld, stepLength);
                float weight = (1.0 - accumulatedAlpha) * sampleAlpha;
                accumulatedColor += sampleColor * weight;
                accumulatedAlpha += weight;

                if (accumulatedAlpha > 0.96) break;
            }

            vec3 color = mix(baseColor.rgb, accumulatedColor / max(accumulatedAlpha, 0.0001), clamp(accumulatedAlpha, 0.0, 1.0));
            gl_FragColor = vec4(color, baseColor.a);
        }
    `
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (target = {}, source = {}) => {
    const result = { ...target };
    Object.entries(source || {}).forEach(([key, value]) => {
        if (isPlainObject(value) && isPlainObject(result[key])) {
            result[key] = deepMerge(result[key], value);
            return;
        }
        result[key] = Array.isArray(value) ? [...value] : value;
    });
    return result;
};

const clamp = (value, min, max) => THREE.MathUtils.clamp(value, min, max);

const toFiniteNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toPositiveNumber = (value, fallback = 1) => Math.max(FLOAT_EPSILON, toFiniteNumber(value, fallback));

const toInteger = (value, fallback, min, max) => {
    const n = Math.round(toFiniteNumber(value, fallback));
    return clamp(n, min, max);
};

const toVector2Array = (value, fallback = [1, 0]) => {
    if (!Array.isArray(value) || value.length < 2) return [...fallback];
    return [
        toFiniteNumber(value[0], fallback[0]),
        toFiniteNumber(value[1], fallback[1])
    ];
};

const toVector3Array = (value, fallback = [0, 0, 0]) => {
    if (!Array.isArray(value) || value.length < 3) return [...fallback];
    return [
        toFiniteNumber(value[0], fallback[0]),
        toFiniteNumber(value[1], fallback[1]),
        toFiniteNumber(value[2], fallback[2])
    ];
};

const toScaleArray = (value) => {
    if (Array.isArray(value)) {
        const fallback = [1, 1, 1];
        return [0, 1, 2].map((index) => toPositiveNumber(value[index], fallback[index]));
    }
    const scalar = toPositiveNumber(value, 1);
    return [scalar, scalar, scalar];
};

const setColorUniform = (uniform, value, fallback) => {
    const color = new THREE.Color(value || fallback);
    uniform.value.copy(color);
};

const disposePass = (pass) => {
    if (pass && typeof pass.dispose === 'function') {
        pass.dispose();
    }
};

/**
 * Effects module component that renders volumetric-style cloud layers driven by weather configuration.
 */
export class WeatherClouds extends Component {
    static defaultConfig = {
        name: 'weather-clouds',
        enabled: true,
        preset: 'cloudy',
        renderMode: 'mesh',
        followCamera: false,
        followCameraY: false,
        height: 120,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        radius: 480,
        thickness: 60,
        layerCount: 8,
        segments: 96,
        coverage: 0.58,
        opacity: 0.82,
        density: 1.0,
        softness: 0.22,
        noiseScale: 155,
        horizonFade: 0.2,
        evolutionSpeed: 0.04,
        shapeContrast: 1.05,
        lightIntensity: 1.0,
        cloudColor: '#f2f6fb',
        shadowColor: '#8795aa',
        sunColor: '#fff2ce',
        sunDirection: [0.35, 0.76, 0.25],
        wind: {
            direction: [1, 0.2],
            speed: 0.052
        },
        postProcessing: {
            enabled: false,
            maxDistance: 3000,
            steps: 18
        }
    };

    static presets = CLOUD_PRESETS;

    constructor(scene, config = {}) {
        super(scene, config);
        this.config = deepMerge(WeatherClouds.defaultConfig, config);

        this.cloudGroup = new THREE.Group();
        this.cloudGroup.name = `${this.name}_cloud_group`;
        this.meshes = [];
        this.materials = [];
        this.elapsedTime = 0;
        this._lastGeometryKey = '';
        this._cameraFollowPosition = new THREE.Vector3();
        this._cloudWorldToLocal = new THREE.Matrix4();

        this.postComposer = null;
        this.postRenderPass = null;
        this.postCloudPass = null;
        this.postOutputPass = null;
        this.originalSceneRender = null;
        this.renderProxy = null;
        this.width = 1;
        this.height = 1;
        this.handleResize = null;
    }

    onMounted() {
        this.componentScene.add(this.cloudGroup);
        this.rebuildCloudLayers();
        this.applyConfigToRuntime();
        if (this.isPostProcessingActive()) {
            this.setupPostProcessing();
        }
        this.handleResize = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.handleResize);
        this.emit('mounted');
    }

    onUpdate(delta) {
        if (this.config.enabled === false) return;
        this.elapsedTime += Number.isFinite(delta) ? delta : 0;

        if (this.config.followCamera) {
            this.syncToCamera();
        }

        this.materials.forEach((material) => {
            material.uniforms.uTime.value = this.elapsedTime;
        });

        this.updatePostProcessingTime();
    }

    updateConfig(newConfig = {}) {
        const wasPostProcessingActive = this.isPostProcessingActive();
        const nextConfig = deepMerge(this.config || {}, newConfig || {});

        if (newConfig?.preset && CLOUD_PRESETS[newConfig.preset]) {
            const preset = CLOUD_PRESETS[newConfig.preset];
            nextConfig.enabled = preset.enabled;
            nextConfig.coverage = preset.coverage;
            nextConfig.opacity = preset.opacity;
            nextConfig.density = preset.density;
            nextConfig.softness = preset.softness;
            nextConfig.cloudColor = preset.cloudColor;
            nextConfig.shadowColor = preset.shadowColor;
            nextConfig.wind = {
                ...(nextConfig.wind || {}),
                speed: preset.windSpeed
            };
        }

        this.config = nextConfig;

        if (this.hasGeometryConfigChanged()) {
            this.rebuildCloudLayers();
        }

        this.applyConfigToRuntime();
        this.syncPostProcessingLifecycle(wasPostProcessingActive);
        this.emit('config-updated', { changed: Object.keys(newConfig || {}) });
    }

    setPreset(preset) {
        if (!CLOUD_PRESETS[preset]) return false;
        this.updateConfig({ preset });
        return true;
    }

    setCoverage(coverage) {
        this.updateConfig({ coverage: clamp(toFiniteNumber(coverage, this.config.coverage), 0, 1) });
    }

    setWindSpeed(speed) {
        this.updateConfig({
            wind: {
                ...(this.config.wind || {}),
                speed: Math.max(0, toFiniteNumber(speed, this.config.wind?.speed || 0))
            }
        });
    }

    setSunDirection(direction) {
        this.updateConfig({ sunDirection: toVector3Array(direction, this.config.sunDirection) });
    }

    enable() {
        this.updateConfig({ enabled: true });
    }

    disable() {
        this.updateConfig({ enabled: false });
    }

    getCloudInfo() {
        return {
            enabled: this.config.enabled !== false,
            preset: this.config.preset,
            renderMode: this.config.renderMode,
            postProcessing: this.isPostProcessingActive(),
            height: this.config.height,
            followCameraY: this.config.followCameraY === true,
            coverage: this.config.coverage,
            opacity: this.config.opacity,
            layerCount: this.meshes.length
        };
    }

    isPostProcessingActive() {
        return this.config.enabled !== false
            && this.config.postProcessing?.enabled === true;
    }

    getRendererInstance() {
        return this.scene?.renderer?.instance || this.scene?.renderer || null;
    }

    syncSizeFromRenderer() {
        const renderer = this.getRendererInstance();
        const domElement = renderer?.domElement;
        const width = domElement?.clientWidth || window.innerWidth || 1;
        const height = domElement?.clientHeight || window.innerHeight || 1;
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
    }

    getGeometryKey() {
        const radius = toPositiveNumber(this.config.radius, WeatherClouds.defaultConfig.radius);
        const thickness = Math.max(0, toFiniteNumber(this.config.thickness, WeatherClouds.defaultConfig.thickness));
        const layerCount = toInteger(this.config.layerCount, WeatherClouds.defaultConfig.layerCount, 1, 8);
        const segments = toInteger(this.config.segments, WeatherClouds.defaultConfig.segments, 16, 192);
        return [radius, thickness, layerCount, segments].join(':');
    }

    hasGeometryConfigChanged() {
        return this._lastGeometryKey !== this.getGeometryKey();
    }

    createCloudMaterial(layerIndex, layerCount) {
        const layerRatio = layerCount <= 1 ? 0 : layerIndex / Math.max(1, layerCount - 1);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: this.elapsedTime },
                uCoverage: { value: 0.5 },
                uOpacity: { value: 0.7 },
                uDensity: { value: 1 },
                uSoftness: { value: 0.22 },
                uNoiseScale: { value: 155 },
                uLayerOffset: { value: layerRatio * 17.0 },
                uLayerRatio: { value: layerRatio },
                uHorizonFade: { value: 0.2 },
                uEvolutionSpeed: { value: 0.04 },
                uShapeContrast: { value: 1.05 },
                uLightIntensity: { value: 1.0 },
                uWindVelocity: { value: new THREE.Vector2(0.016, 0) },
                uCloudColor: { value: new THREE.Color('#ffffff') },
                uShadowColor: { value: new THREE.Color('#8795aa') },
                uSunColor: { value: new THREE.Color('#fff2ce') },
                uSunDirection: { value: new THREE.Vector3(0.35, 0.76, 0.25).normalize() }
            },
            vertexShader: CLOUD_SHADER.vertexShader,
            fragmentShader: CLOUD_SHADER.fragmentShader,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending,
            toneMapped: true
        });

        material.userData.layerOpacityFactor = (1.65 / Math.max(1, layerCount)) * (1 - layerRatio * 0.12);
        return material;
    }

    rebuildCloudLayers() {
        this.clearCloudLayers();

        const radius = toPositiveNumber(this.config.radius, WeatherClouds.defaultConfig.radius);
        const thickness = Math.max(0, toFiniteNumber(this.config.thickness, WeatherClouds.defaultConfig.thickness));
        const layerCount = toInteger(this.config.layerCount, WeatherClouds.defaultConfig.layerCount, 1, 8);
        const segments = toInteger(this.config.segments, WeatherClouds.defaultConfig.segments, 16, 192);
        const rings = Math.max(8, Math.floor(segments / 2));

        for (let index = 0; index < layerCount; index += 1) {
            const layerRatio = layerCount <= 1 ? 0 : index / Math.max(1, layerCount - 1);
            const layerRadius = radius + thickness * layerRatio * 0.35;
            const geometry = new THREE.PlaneGeometry(
                layerRadius * 2,
                layerRadius * 2,
                segments,
                rings
            );
            const material = this.createCloudMaterial(index, layerCount);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `${this.name}_layer_${index + 1}`;
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = thickness * layerRatio;
            mesh.frustumCulled = false;
            mesh.renderOrder = -20 + (layerCount - index);
            mesh.userData.weatherClouds = true;
            this.cloudGroup.add(mesh);
            this.meshes.push(mesh);
            this.materials.push(material);
        }

        this._lastGeometryKey = this.getGeometryKey();
    }

    clearCloudLayers() {
        this.meshes.forEach((mesh) => {
            mesh.parent?.remove(mesh);
            mesh.geometry?.dispose?.();
        });

        this.materials.forEach((material) => {
            material.dispose?.();
        });

        this.meshes = [];
        this.materials = [];
        this.cloudGroup.clear();
    }

    setupPostProcessing() {
        const renderer = this.getRendererInstance();
        const scene = this.scene?.scene;
        const camera = this.scene?.camera?.instance;

        if (!renderer || !scene || !camera) {
            return;
        }

        if (!this.postComposer) {
            this.syncSizeFromRenderer();
            this.postComposer = new EffectComposer(renderer);
            this.postComposer.setSize(this.width, this.height);
            this.postRenderPass = new RenderPass(scene, camera);
            this.postCloudPass = new ShaderPass(POST_PROCESSING_CLOUD_SHADER);
            this.postOutputPass = new OutputPass();
            this.postComposer.addPass(this.postRenderPass);
            this.postComposer.addPass(this.postCloudPass);
            this.postComposer.addPass(this.postOutputPass);
        }

        this.applyPostProcessingUniforms();
        this.syncPostProcessingCamera();
        this.takeOverRenderer();
        this.emit('postProcessingSetup');
    }

    disposePostProcessing() {
        [
            this.postRenderPass,
            this.postCloudPass,
            this.postOutputPass
        ].forEach(disposePass);

        if (this.postComposer) {
            this.postComposer.dispose?.();
            this.postComposer = null;
        }

        this.postRenderPass = null;
        this.postCloudPass = null;
        this.postOutputPass = null;
    }

    takeOverRenderer() {
        if (!this.scene?.renderer || this.originalSceneRender) {
            return;
        }

        this.originalSceneRender = this.scene.renderer.render.bind(this.scene.renderer);
        this.renderProxy = (scene, camera) => {
            if (this.isPostProcessingActive() && this.postComposer) {
                this.syncPostProcessingCamera();
                this.postComposer.render();
                return;
            }
            this.originalSceneRender?.(scene, camera);
        };
        this.renderProxy.__weatherCloudsOwner = this;
        this.scene.renderer.render = this.renderProxy;
    }

    restoreRenderer() {
        if (!this.scene?.renderer || !this.originalSceneRender) {
            return;
        }

        if (this.scene.renderer.render === this.renderProxy) {
            this.scene.renderer.render = this.originalSceneRender;
        }

        this.originalSceneRender = null;
        this.renderProxy = null;
    }

    syncPostProcessingLifecycle(wasPostProcessingActive = false) {
        const isActive = this.isPostProcessingActive();

        if (isActive) {
            this.setupPostProcessing();
            return;
        }

        if (wasPostProcessingActive || this.postComposer || this.originalSceneRender) {
            this.restoreRenderer();
            this.disposePostProcessing();
        }
    }

    getWindVelocity() {
        const windDirection = toVector2Array(this.config.wind?.direction, WeatherClouds.defaultConfig.wind.direction);
        const windSpeed = Math.max(0, toFiniteNumber(this.config.wind?.speed, WeatherClouds.defaultConfig.wind.speed));
        const wind = new THREE.Vector2(windDirection[0], windDirection[1]);

        if (wind.lengthSq() <= FLOAT_EPSILON) {
            wind.set(1, 0);
        }

        return wind.normalize().multiplyScalar(windSpeed);
    }

    applyPostProcessingUniforms() {
        if (!this.postCloudPass) {
            return;
        }

        const postConfig = this.config.postProcessing || {};
        const defaultPostConfig = WeatherClouds.defaultConfig.postProcessing;
        const uniforms = this.postCloudPass.material.uniforms;
        const thickness = Math.max(1, toFiniteNumber(this.config.thickness, WeatherClouds.defaultConfig.thickness));
        const coverage = clamp(toFiniteNumber(this.config.coverage, WeatherClouds.defaultConfig.coverage), 0, 1);
        const opacity = clamp(toFiniteNumber(this.config.opacity, WeatherClouds.defaultConfig.opacity), 0, 1);
        const density = clamp(toFiniteNumber(this.config.density, WeatherClouds.defaultConfig.density), 0, 5);
        const softness = clamp(toFiniteNumber(this.config.softness, WeatherClouds.defaultConfig.softness), 0.01, 0.8);
        const noiseScale = toPositiveNumber(this.config.noiseScale, WeatherClouds.defaultConfig.noiseScale);
        const horizonFade = clamp(toFiniteNumber(this.config.horizonFade, WeatherClouds.defaultConfig.horizonFade), 0.001, 0.6);
        const evolutionSpeed = clamp(toFiniteNumber(this.config.evolutionSpeed, WeatherClouds.defaultConfig.evolutionSpeed), 0, 2);
        const shapeContrast = clamp(toFiniteNumber(this.config.shapeContrast, WeatherClouds.defaultConfig.shapeContrast), 0.2, 3);
        const lightIntensity = clamp(toFiniteNumber(this.config.lightIntensity, WeatherClouds.defaultConfig.lightIntensity), 0, 4);
        const maxDistance = Math.max(1, toFiniteNumber(postConfig.maxDistance, defaultPostConfig.maxDistance));
        const steps = toInteger(postConfig.steps, defaultPostConfig.steps, 4, 32);
        const sunDirection = toVector3Array(this.config.sunDirection, WeatherClouds.defaultConfig.sunDirection);

        uniforms.uResolution.value.set(this.width, this.height);
        uniforms.uLayerThickness.value = thickness;
        uniforms.uCoverage.value = coverage;
        uniforms.uOpacity.value = opacity;
        uniforms.uDensity.value = density;
        uniforms.uSoftness.value = softness;
        uniforms.uNoiseScale.value = noiseScale;
        uniforms.uShapeContrast.value = shapeContrast;
        uniforms.uEvolutionSpeed.value = evolutionSpeed;
        uniforms.uLightIntensity.value = lightIntensity;
        uniforms.uMaxDistance.value = maxDistance;
        uniforms.uHorizonFade.value = horizonFade;
        uniforms.uSteps.value = steps;
        uniforms.uWindVelocity.value.copy(this.getWindVelocity());
        uniforms.uSunDirection.value.set(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
        setColorUniform(uniforms.uCloudColor, this.config.cloudColor, WeatherClouds.defaultConfig.cloudColor);
        setColorUniform(uniforms.uShadowColor, this.config.shadowColor, WeatherClouds.defaultConfig.shadowColor);
        setColorUniform(uniforms.uSunColor, this.config.sunColor, WeatherClouds.defaultConfig.sunColor);
    }

    syncPostProcessingCamera() {
        if (!this.postCloudPass) {
            return;
        }

        const camera = this.scene?.camera?.instance;
        if (!camera) {
            return;
        }

        camera.updateMatrixWorld?.();
        camera.updateProjectionMatrix?.();
        this.componentScene.updateMatrixWorld(true);
        this._cloudWorldToLocal.copy(this.componentScene.matrixWorld).invert();

        const uniforms = this.postCloudPass.material.uniforms;
        uniforms.uProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
        uniforms.uCameraMatrixWorld.value.copy(camera.matrixWorld);
        uniforms.uCameraPosition.value.copy(camera.position);
        uniforms.uCloudWorldToLocal.value.copy(this._cloudWorldToLocal);
        uniforms.uResolution.value.set(this.width, this.height);
        uniforms.uTime.value = this.elapsedTime;
    }

    updatePostProcessingTime() {
        if (!this.postCloudPass || !this.isPostProcessingActive()) {
            return;
        }

        this.postCloudPass.material.uniforms.uTime.value = this.elapsedTime;
    }

    onWindowResize() {
        this.syncSizeFromRenderer();

        if (this.postComposer) {
            this.postComposer.setSize(this.width, this.height);
        }

        this.applyPostProcessingUniforms();
        this.syncPostProcessingCamera();
        this.emit('resize', { width: this.width, height: this.height });
    }

    applyConfigToRuntime() {
        this.applyVisibility();
        this.applyTransform();
        this.applyMaterialUniforms();
        this.applyPostProcessingUniforms();
        this.syncPostProcessingCamera();
    }

    applyVisibility() {
        const enabled = this.config.enabled !== false;
        this.componentScene.visible = enabled;
        this.cloudGroup.visible = enabled && !this.isPostProcessingActive();
    }

    applyTransform() {
        const rotation = toVector3Array(this.config.rotation, WeatherClouds.defaultConfig.rotation);
        const scale = toScaleArray(this.config.scale);

        this.componentScene.rotation.set(rotation[0], rotation[1], rotation[2]);
        this.componentScene.scale.set(scale[0], scale[1], scale[2]);

        if (this.config.followCamera) {
            this.syncToCamera();
            return;
        }

        const position = toVector3Array(this.config.position, WeatherClouds.defaultConfig.position);
        const height = toFiniteNumber(this.config.height, WeatherClouds.defaultConfig.height) + position[1];
        this.componentScene.position.set(position[0], height, position[2]);
    }

    syncToCamera() {
        const cameraPosition = this.scene?.camera?.instance?.position;
        const offset = toVector3Array(this.config.position, WeatherClouds.defaultConfig.position);
        const height = toFiniteNumber(this.config.height, WeatherClouds.defaultConfig.height) + offset[1];
        const followCameraY = this.config.followCameraY === true;
        const followCameraXZ = !this.isPostProcessingActive();

        if (cameraPosition) {
            this._cameraFollowPosition.set(
                (followCameraXZ ? cameraPosition.x : 0) + offset[0],
                (followCameraY ? cameraPosition.y : 0) + height,
                (followCameraXZ ? cameraPosition.z : 0) + offset[2]
            );
        } else {
            this._cameraFollowPosition.set(offset[0], height, offset[2]);
        }

        this.componentScene.position.copy(this._cameraFollowPosition);
    }

    applyMaterialUniforms() {
        const coverage = clamp(toFiniteNumber(this.config.coverage, WeatherClouds.defaultConfig.coverage), 0, 1);
        const opacity = clamp(toFiniteNumber(this.config.opacity, WeatherClouds.defaultConfig.opacity), 0, 1);
        const density = clamp(toFiniteNumber(this.config.density, WeatherClouds.defaultConfig.density), 0, 3);
        const softness = clamp(toFiniteNumber(this.config.softness, WeatherClouds.defaultConfig.softness), 0.01, 0.8);
        const noiseScale = toPositiveNumber(this.config.noiseScale, WeatherClouds.defaultConfig.noiseScale);
        const horizonFade = clamp(toFiniteNumber(this.config.horizonFade, WeatherClouds.defaultConfig.horizonFade), 0.03, 0.95);
        const evolutionSpeed = clamp(toFiniteNumber(this.config.evolutionSpeed, WeatherClouds.defaultConfig.evolutionSpeed), 0, 1);
        const shapeContrast = clamp(toFiniteNumber(this.config.shapeContrast, WeatherClouds.defaultConfig.shapeContrast), 0.2, 3);
        const lightIntensity = clamp(toFiniteNumber(this.config.lightIntensity, WeatherClouds.defaultConfig.lightIntensity), 0, 3);
        const sunDirection = toVector3Array(this.config.sunDirection, WeatherClouds.defaultConfig.sunDirection);
        const windDirection = toVector2Array(this.config.wind?.direction, WeatherClouds.defaultConfig.wind.direction);
        const windSpeed = Math.max(0, toFiniteNumber(this.config.wind?.speed, WeatherClouds.defaultConfig.wind.speed));
        const wind = new THREE.Vector2(windDirection[0], windDirection[1]);

        if (wind.lengthSq() <= FLOAT_EPSILON) {
            wind.set(1, 0);
        }
        wind.normalize().multiplyScalar(windSpeed);

        this.materials.forEach((material) => {
            const opacityFactor = toFiniteNumber(material.userData.layerOpacityFactor, 1);
            material.uniforms.uCoverage.value = coverage;
            material.uniforms.uOpacity.value = opacity * opacityFactor;
            material.uniforms.uDensity.value = density;
            material.uniforms.uSoftness.value = softness;
            material.uniforms.uNoiseScale.value = noiseScale;
            material.uniforms.uHorizonFade.value = horizonFade;
            material.uniforms.uEvolutionSpeed.value = evolutionSpeed;
            material.uniforms.uShapeContrast.value = shapeContrast;
            material.uniforms.uLightIntensity.value = lightIntensity;
            material.uniforms.uWindVelocity.value.copy(wind);
            material.uniforms.uSunDirection.value.set(sunDirection[0], sunDirection[1], sunDirection[2]).normalize();
            setColorUniform(material.uniforms.uCloudColor, this.config.cloudColor, WeatherClouds.defaultConfig.cloudColor);
            setColorUniform(material.uniforms.uShadowColor, this.config.shadowColor, WeatherClouds.defaultConfig.shadowColor);
            setColorUniform(material.uniforms.uSunColor, this.config.sunColor, WeatherClouds.defaultConfig.sunColor);
            material.needsUpdate = true;
        });
    }

    getInteractiveObjects() {
        return [];
    }

    onDispose() {
        if (this.handleResize) {
            window.removeEventListener('resize', this.handleResize);
            this.handleResize = null;
        }

        this.restoreRenderer();
        this.disposePostProcessing();
        this.clearCloudLayers();
        if (this.cloudGroup.parent) {
            this.cloudGroup.parent.remove(this.cloudGroup);
        }
    }
}

export default WeatherClouds;
