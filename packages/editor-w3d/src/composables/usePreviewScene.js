import { useSceneStore } from '../stores/useSceneStore';
import { useProjectStore } from '../stores/useProjectStore';
import {
    applyBackground,
    createAndInitScene
} from './useSceneCommon';
import { syncSceneHelpers } from '../utils/sceneHelpers';

export function usePreviewScene() {
    const sceneStore = useSceneStore();
    const projectStore = useProjectStore();

    const PREVIEW_HDR_COMPONENT_NAME = '__preview_hdr_background__';

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
        await syncSceneHelpers(scene, sceneStore.sceneConfig.helpers, { isPreview: true });
    };

    const initPreviewScene = async (container, _options = {}) => {
        logger.log('[PreviewScene] init preview scene');

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
                hdrComponentName: PREVIEW_HDR_COMPONENT_NAME,
                registerComponents: true
            });

            await setupHelpers(scene);
            sceneStore.setSceneInstance(scene);
            await projectStore.restoreRuntimeIfPending(false, 'preview');

            logger.log('[PreviewScene] init complete');
            sceneStore.setLoading(false);

            return scene;
        } catch (error) {
            logger.error('[PreviewScene] init failed', error);
            sceneStore.setError(error.message);
            sceneStore.setLoading(false);
            throw error;
        }
    };

    const pausePreviewScene = () => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            logger.warn('[PreviewScene] pause skipped, scene missing');
            return false;
        }

        logger.log('[PreviewScene] pause');
        return scene.pause();
    };

    const resumePreviewScene = () => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            logger.warn('[PreviewScene] resume skipped, scene missing');
            return false;
        }

        logger.log('[PreviewScene] resume');
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

    const updatePreviewScene = async (config, forceUpdate = false) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            logger.warn('[PreviewScene] update skipped, scene missing');
            return { success: false, reason: 'scene_not_initialized' };
        }

        const normalizedConfig = config && typeof config === 'object'
            ? {
                ...config,
                components: Array.isArray(config.components)
                    ? config.components.map((component) => ({
                        ...component,
                        visible: component?.previewVisible !== false
                    }))
                    : config.components
            }
            : config;

        const background = normalizedConfig?.scene?.background;
        const shouldApplyBackground = hasOwn(normalizedConfig?.scene, 'background');
        const result = scene.update(stripBackgroundFromUpdateConfig(normalizedConfig), forceUpdate);

        if (shouldApplyBackground) {
            await applyBackground(scene, background, PREVIEW_HDR_COMPONENT_NAME);
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
            void applyBackground(sceneStore.sceneInstance, config, PREVIEW_HDR_COMPONENT_NAME)
                .catch((error) => logger.warn('[PreviewScene] background update failed', error));
        }
    };

    const disposePreviewScene = () => {
        if (!sceneStore.sceneInstance) {
            logger.log('[PreviewScene] dispose skipped, scene missing');
            return;
        }

        logger.log('[PreviewScene] dispose');
        sceneStore.resetScene();
    };

    return {
        get sceneInstance() { return sceneStore.sceneInstance; },
        get sceneConfig() { return sceneStore.sceneConfig; },
        get sceneState() { return sceneStore.sceneState; },

        initPreviewScene,
        initScene: initPreviewScene,
        pausePreviewScene,
        resumePreviewScene,
        disposePreviewScene,
        disposeScene: disposePreviewScene,

        isSceneRunning,
        isSceneInitialized,

        updatePreviewScene,
        updateBackground
    };
}
