import { useSceneStore } from '../stores/useSceneStore';
import { useProjectStore } from '../stores/useProjectStore';
import { applyBackground as applySceneBackground, createAndInitScene } from './useSceneCommon';
import { syncGridHelper, syncSceneHelpers } from '../utils/sceneHelpers';

export function useScene() {
    const sceneStore = useSceneStore();
    const projectStore = useProjectStore();

    const EDITOR_HDR_COMPONENT_NAME = '__editor_hdr_background__';

    const initScene = async (container) => {
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
            sceneStore.setLoading(false);
            return scene;
        } catch (error) {
            sceneStore.setError(error.message);
            sceneStore.setLoading(false);
            throw error;
        }
    };

    const applyBackground = async (scene) => {
        const { background } = sceneStore.sceneConfig;
        await applySceneBackground(scene, background, EDITOR_HDR_COMPONENT_NAME);
    };

    const setupHelpers = async (scene) => {
        await syncSceneHelpers(scene, sceneStore.sceneConfig.helpers, { isPreview: false });
    };

    const updateBackground = (config) => {
        sceneStore.updateBackgroundConfig(config);
        if (sceneStore.sceneInstance) {
            void applyBackground(sceneStore.sceneInstance);
        }
    };

    const updateLighting = async (config) => {
        sceneStore.updateLightingConfig(config);
    };

    const toggleGridHelper = async (enabled) => {
        sceneStore.updateHelpersConfig({
            grid: { ...sceneStore.sceneConfig.helpers.grid, enabled }
        });

        if (sceneStore.sceneInstance) {
            await syncGridHelper(sceneStore.sceneInstance, sceneStore.sceneConfig.helpers.grid, { isPreview: false });
        }
    };

    const disposeScene = () => {
        sceneStore.resetScene();
    };

    return {
        sceneInstance: sceneStore.sceneInstance,
        sceneConfig: sceneStore.sceneConfig,
        sceneState: sceneStore.sceneState,

        initScene,
        updateBackground,
        updateLighting,
        toggleGridHelper,
        disposeScene
    };
}
