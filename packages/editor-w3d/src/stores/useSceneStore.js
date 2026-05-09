import { defineStore } from 'pinia';
import { ref, reactive, shallowRef, markRaw } from 'vue';

export const useSceneStore = defineStore('scene', () => {
    const DEFAULT_LOADING_CONFIG = Object.freeze({
        enabled: true,
        effect: 'spinner'
    });
    // 场景实例（使用 shallowRef 避免 Vue 深度代理 Three.js 对象树）
    const sceneInstance = shallowRef(null);
    const configVersion = ref(0);

    // 场景配置
    const sceneConfig = reactive({
        // 渲染器配置
        renderer: {
            antialias: true,
            outputColorSpace: 'srgb',
            shadowEnabled: true
        },
        // 相机配置
        camera: {
            type: 'perspective', // 'perspective' | 'orthographic'
            fov: 45,
            near: 0.1,
            far: 10000,
            position: [10, 8, 15],
            lookAt: [0, 0, 0]
        },

        // 控制器配置（OrbitControls）
        controls: {
            enableDamping: true,
            dampingFactor: 0.05,
            enableZoom: true,
            enableRotate: true,
            enablePan: true,
            autoRotate: false,
            autoRotateSpeed: 2.0,
            minDistance: 1,
            maxDistance: 1000
        },
        // 光照配置
        lighting: {
            ambient: {
                enabled: true,
                color: '#ffffff',
                intensity: 0.6
            },
            directional: {
                enabled: true,
                color: '#ffffff',
                intensity: 0.8,
                position: [10, 10, 5],
                castShadow: true
            }
        },
        // 背景配置
        background: {
            type: 'color', // 'color' | 'gradient' | 'image' | 'hdr'
            color: '#151a2b',
            gradientTop: '#87ceeb',
            gradientBottom: '#ffffff',
            imageUrl: '',
            hdrUrl: '/textures/blouberg_sunrise_2_1k.hdr'
        },
        // 辅助显示
        helpers: {
            grid: {
                enabled: true,
                size: 200,
                divisions: 30,
                color: '#888888',
                hideInPreview: true
            },
            axes: {
                enabled: false,
                size: 5
            }
        },
        loading: {
            ...DEFAULT_LOADING_CONFIG
        }
    });

    // 场景状态
    const sceneState = reactive({
        initialized: false,
        loading: false,
        error: null
    });

    // 设置场景实例（markRaw 阻止 Vue 递归代理 Three.js 内部属性）
    const setSceneInstance = (instance) => {
        sceneInstance.value = instance ? markRaw(instance) : null;
        sceneState.initialized = !!instance;
    };

    const bumpConfigVersion = () => {
        configVersion.value += 1;
    };

    // 更新渲染器配置
    const updateRendererConfig = (config) => {
        Object.assign(sceneConfig.renderer, config);
        bumpConfigVersion();
        if (sceneInstance.value) {
            // 应用配置到场景
            if (typeof sceneInstance.value.renderer?.updateConfig === 'function') {
                sceneInstance.value.renderer.updateConfig(sceneConfig.renderer);
            }

            if (config.shadowEnabled !== undefined) {
                sceneInstance.value.renderer?.enableShadow?.(config.shadowEnabled);
            }
        }
    };

    // 更新相机配置
    const updateCameraConfig = (config) => {
        Object.assign(sceneConfig.camera, config);
        bumpConfigVersion();

        const scene = sceneInstance.value;
        if (!scene?.camera) return;

        // 通过 SDK Camera wrapper 应用配置（避免直接写 three instance）
        if (typeof scene.camera.updateConfig === 'function') {
            scene.camera.updateConfig(sceneConfig.camera);
        }

        // lookAt 同步到 controls.target
        if (config.lookAt && scene.controls?.updateConfig) {
            const [lx, ly, lz] = sceneConfig.camera.lookAt || [0, 0, 0];
            scene.controls.updateConfig({
                target: { x: lx, y: ly, z: lz }
            });
            scene.controls.instance?.update?.();
        }
    };

    // 更新光照配置
    const updateLightingConfig = (config) => {
        Object.assign(sceneConfig.lighting, config);
        bumpConfigVersion();
        // 光照更新需要重新创建光源，这部分在 useScene 中处理
    };

    // 更新控制器配置
    const updateControlsConfig = (config) => {
        Object.assign(sceneConfig.controls, config);
        bumpConfigVersion();

        const scene = sceneInstance.value;
        if (!scene?.controls) return;

        // 保护：min/max 关系
        if (
            typeof sceneConfig.controls.minDistance === 'number' &&
            typeof sceneConfig.controls.maxDistance === 'number' &&
            sceneConfig.controls.maxDistance < sceneConfig.controls.minDistance
        ) {
            sceneConfig.controls.maxDistance = sceneConfig.controls.minDistance;
        }

        // 通过 SDK Controls wrapper 应用配置
        const runtimeControlsConfig = {
            ...sceneConfig.controls
        };

        // 若未显式传 target，则与 camera.lookAt 保持一致
        if (!runtimeControlsConfig.target && sceneConfig.camera?.lookAt) {
            const [x, y, z] = sceneConfig.camera.lookAt;
            runtimeControlsConfig.target = { x, y, z };
        }

        if (typeof scene.controls.updateConfig === 'function') {
            scene.controls.updateConfig(runtimeControlsConfig);
            scene.controls.instance?.update?.();
            return;
        }
    };

    // 更新背景配置
    const updateBackgroundConfig = (config) => {
        Object.assign(sceneConfig.background, config);
        bumpConfigVersion();
        // 背景更新在 useScene 中处理
    };

    // 更新辅助显示配置
    const updateHelpersConfig = (config) => {
        Object.assign(sceneConfig.helpers, config);
        bumpConfigVersion();
        // 辅助显示更新在 useScene 中处理
    };

    // 设置加载状态
    const setLoading = (loading) => {
        sceneState.loading = loading;
    };

    const updateLoadingConfig = (config = {}) => {
        Object.assign(sceneConfig.loading, {
            ...DEFAULT_LOADING_CONFIG,
            ...(sceneConfig.loading || {}),
            ...(config || {})
        });
        bumpConfigVersion();
    };

    // 设置错误
    const setError = (error) => {
        sceneState.error = error;
    };

    // 重置场景
    const resetScene = () => {
        if (sceneInstance.value) {
            sceneInstance.value.dispose();
            sceneInstance.value = null;
        }
        sceneState.initialized = false;
        sceneState.loading = false;
        sceneState.error = null;
    };

    return {
        // 状态
        sceneInstance,
        configVersion,
        sceneConfig,
        sceneState,

        // 方法
        setSceneInstance,
        updateRendererConfig,
        updateCameraConfig,
        updateControlsConfig,
        updateLightingConfig,
        updateBackgroundConfig,
        updateHelpersConfig,
        updateLoadingConfig,
        setLoading,
        setError,
        resetScene
    };
});

