import { useSceneStore } from '../stores/useSceneStore';
import { useProjectStore } from '../stores/useProjectStore';
import {
    applyBackground,
    createAndInitScene
} from './useSceneCommon';
import { syncGridHelper, syncSceneHelpers } from '../utils/sceneHelpers';

export function useEditorScene() {
    const sceneStore = useSceneStore();
    const projectStore = useProjectStore();

    const EDITOR_HDR_COMPONENT_NAME = '__editor_hdr_background__';

    const logger = {
        log: (...args) => {
            if (import.meta?.env?.DEV) {
                // eslint-disable-next-line no-console
                console.log(...args);
            }
        },
        warn: (...args) => {
            if (import.meta?.env?.DEV) {
                // eslint-disable-next-line no-console
                console.warn(...args);
            }
        },
        error: (...args) => {
            // eslint-disable-next-line no-console
            console.error(...args);
        }
    };

    const setupHelpers = async (scene) => {
        await syncSceneHelpers(scene, sceneStore.sceneConfig.helpers, { isPreview: false });
    };

    const initEditorScene = async (container) => {
        logger.log('[EditorScene] init editor scene');

        if (!container) {
            throw new Error('Scene container is required');
        }

        try {
            sceneStore.setLoading(true);
            sceneStore.setError(null);

            const scene = await createAndInitScene({
                container,
                sceneConfig: sceneStore.sceneConfig,
                background: sceneStore.sceneConfig.background,
                hdrComponentName: EDITOR_HDR_COMPONENT_NAME,
                registerComponents: true
            });

            await setupHelpers(scene);
            sceneStore.setSceneInstance(scene);
            await projectStore.restoreRuntimeIfPending(false, 'editor');

            logger.log('[EditorScene] init complete');
            sceneStore.setLoading(false);

            return scene;
        } catch (error) {
            logger.error('[EditorScene] init failed', error);
            sceneStore.setError(error.message);
            sceneStore.setLoading(false);
            throw error;
        }
    };

    const pauseEditorScene = () => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            logger.warn('[EditorScene] pause skipped, scene missing');
            return false;
        }

        logger.log('[EditorScene] pause');
        return scene.pause();
    };

    const resumeEditorScene = () => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            logger.warn('[EditorScene] resume skipped, scene missing');
            return false;
        }

        logger.log('[EditorScene] resume');
        return scene.resume();
    };

    const isSceneRunning = () => {
        return sceneStore.sceneInstance?.isRunning ?? false;
    };

    const isSceneInitialized = () => {
        return sceneStore.sceneInstance?.isInitialized ?? false;
    };

    const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key);

    const stripBackgroundFromUpdateConfig = (config) => {
        if (!hasOwn(config?.scene, 'background')) return config;
        const sceneConfig = { ...config.scene };
        delete sceneConfig.background;
        return {
            ...config,
            scene: sceneConfig
        };
    };

    const syncBackgroundCurrentConfig = (scene, background) => {
        scene._currentConfig = {
            ...(scene._currentConfig || {}),
            background: background ? { ...background } : background
        };
    };

    const updateEditorScene = async (config, forceUpdate = false) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            logger.warn('[EditorScene] update skipped, scene missing');
            return { success: false, reason: 'scene_not_initialized' };
        }

        const background = config?.scene?.background;
        const shouldApplyBackground = hasOwn(config?.scene, 'background');
        const result = scene.update(stripBackgroundFromUpdateConfig(config), forceUpdate);

        if (shouldApplyBackground) {
            await applyBackground(scene, background, EDITOR_HDR_COMPONENT_NAME);
            syncBackgroundCurrentConfig(scene, background);
            if (result.success && !result.updatedItems?.includes('background')) {
                result.updatedItems = [...(result.updatedItems || []), 'background'];
            }
        }

        return result;
    };

    const updateBackground = (config) => {
        sceneStore.updateBackgroundConfig(config);
        if (sceneStore.sceneInstance) {
            void applyBackground(sceneStore.sceneInstance, config, EDITOR_HDR_COMPONENT_NAME)
                .catch((error) => logger.warn('[EditorScene] background update failed', error));
        }
    };

    const updateLighting = async (config) => {
        sceneStore.updateLightingConfig(config);
    };

    const toggleGridHelper = async (enabled) => {
        sceneStore.updateHelpersConfig({
            grid: { ...sceneStore.sceneConfig.helpers?.grid, enabled }
        });

        if (sceneStore.sceneInstance) {
            await syncGridHelper(
                sceneStore.sceneInstance,
                sceneStore.sceneConfig.helpers?.grid,
                { isPreview: false }
            );
        }
    };

    const disposeEditorScene = () => {
        if (!sceneStore.sceneInstance) {
            logger.log('[EditorScene] dispose skipped, scene missing');
            return;
        }

        logger.log('[EditorScene] dispose');
        sceneStore.resetScene();
    };

    return {
        get sceneInstance() { return sceneStore.sceneInstance; },
        get sceneConfig() { return sceneStore.sceneConfig; },
        get sceneState() { return sceneStore.sceneState; },

        initEditorScene,
        initScene: initEditorScene,
        pauseEditorScene,
        resumeEditorScene,
        disposeEditorScene,
        disposeScene: disposeEditorScene,

        isSceneRunning,
        isSceneInitialized,

        updateEditorScene,
        updateBackground,
        updateLighting,
        toggleGridHelper
    };
}
