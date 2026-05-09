import { defineStore } from 'pinia';
import { ref, reactive, shallowRef, markRaw } from 'vue';

export const useSceneStore = defineStore('scene', () => {
    const DEFAULT_LOADING_CONFIG = Object.freeze({
        enabled: true,
        effect: 'spinner'
    });
    // English comment.
    const sceneInstance = shallowRef(null);
    const configVersion = ref(0);

    // English comment.
    const sceneConfig = reactive({
        // English comment.
        renderer: {
            antialias: true,
            outputColorSpace: 'srgb',
            shadowEnabled: true
        },
        // English comment.
        camera: {
            type: 'perspective', // 'perspective' | 'orthographic'
            fov: 45,
            near: 0.1,
            far: 10000,
            position: [10, 8, 15],
            lookAt: [0, 0, 0]
        },

        // English comment.
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
        // English comment.
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
        // English comment.
        background: {
            type: 'color', // 'color' | 'gradient' | 'image' | 'hdr'
            color: '#151a2b',
            gradientTop: '#87ceeb',
            gradientBottom: '#ffffff',
            imageUrl: '',
            hdrUrl: '/textures/blouberg_sunrise_2_1k.hdr'
        },
        // English comment.
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

    // English comment.
    const sceneState = reactive({
        initialized: false,
        loading: false,
        error: null
    });

    // English comment.
    const setSceneInstance = (instance) => {
        sceneInstance.value = instance ? markRaw(instance) : null;
        sceneState.initialized = !!instance;
    };

    const bumpConfigVersion = () => {
        configVersion.value += 1;
    };

    // English comment.
    const updateRendererConfig = (config) => {
        Object.assign(sceneConfig.renderer, config);
        bumpConfigVersion();
        if (sceneInstance.value) {
            // English comment.
            if (typeof sceneInstance.value.renderer?.updateConfig === 'function') {
                sceneInstance.value.renderer.updateConfig(sceneConfig.renderer);
            }

            if (config.shadowEnabled !== undefined) {
                sceneInstance.value.renderer?.enableShadow?.(config.shadowEnabled);
            }
        }
    };

    // English comment.
    const updateCameraConfig = (config) => {
        Object.assign(sceneConfig.camera, config);
        bumpConfigVersion();

        const scene = sceneInstance.value;
        if (!scene?.camera) return;

        // English comment.
        if (typeof scene.camera.updateConfig === 'function') {
            scene.camera.updateConfig(sceneConfig.camera);
        }

        // English comment.
        if (config.lookAt && scene.controls?.updateConfig) {
            const [lx, ly, lz] = sceneConfig.camera.lookAt || [0, 0, 0];
            scene.controls.updateConfig({
                target: { x: lx, y: ly, z: lz }
            });
            scene.controls.instance?.update?.();
        }
    };

    // English comment.
    const updateLightingConfig = (config) => {
        Object.assign(sceneConfig.lighting, config);
        bumpConfigVersion();
        // English comment.
    };

    // English comment.
    const updateControlsConfig = (config) => {
        Object.assign(sceneConfig.controls, config);
        bumpConfigVersion();

        const scene = sceneInstance.value;
        if (!scene?.controls) return;

        // English comment.
        if (
            typeof sceneConfig.controls.minDistance === 'number' &&
            typeof sceneConfig.controls.maxDistance === 'number' &&
            sceneConfig.controls.maxDistance < sceneConfig.controls.minDistance
        ) {
            sceneConfig.controls.maxDistance = sceneConfig.controls.minDistance;
        }

        // English comment.
        const runtimeControlsConfig = {
            ...sceneConfig.controls
        };

        // English comment.
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

    // English comment.
    const updateBackgroundConfig = (config) => {
        Object.assign(sceneConfig.background, config);
        bumpConfigVersion();
        // English comment.
    };

    // English comment.
    const updateHelpersConfig = (config) => {
        Object.assign(sceneConfig.helpers, config);
        bumpConfigVersion();
        // English comment.
    };

    // English comment.
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

    // English comment.
    const setError = (error) => {
        sceneState.error = error;
    };

    // English comment.
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
        // English comment.
        sceneInstance,
        configVersion,
        sceneConfig,
        sceneState,

        // English comment.
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

