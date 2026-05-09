export const HELPER_NAMES = {
    grid: 'grid-helper',
    axes: 'axes-helper'
};

export const DEFAULT_HELPERS_CONFIG = {
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
};

export const cloneHelpersConfig = (helpers = DEFAULT_HELPERS_CONFIG) => {
    return {
        grid: {
            ...DEFAULT_HELPERS_CONFIG.grid,
            ...(helpers?.grid || {})
        },
        axes: {
            ...DEFAULT_HELPERS_CONFIG.axes,
            ...(helpers?.axes || {})
        }
    };
};

export const getSceneHelper = (scene, name) => {
    if (!scene || !name) return null;
    return scene.get?.(name) || scene.getComponentByName?.(name) || null;
};

export const removeSceneHelper = (scene, name) => {
    const existing = getSceneHelper(scene, name);
    if (existing) {
        scene.remove(name);
    }
};

export const syncGridHelper = async (scene, gridConfig = {}, { isPreview = false } = {}) => {
    if (!scene) return;

    removeSceneHelper(scene, HELPER_NAMES.grid);

    const shouldShowGrid = Boolean(gridConfig.enabled) && (!isPreview || gridConfig.hideInPreview === false);
    if (!shouldShowGrid) {
        return;
    }

    await scene.add('GridHelper', {
        name: HELPER_NAMES.grid,
        size: gridConfig.size || 20,
        divisions: gridConfig.divisions || 20,
        color: gridConfig.color || '#888888'
    });
};

export const syncAxesHelper = async (scene, axesConfig = {}) => {
    if (!scene) return;

    removeSceneHelper(scene, HELPER_NAMES.axes);

    if (!axesConfig.enabled) {
        return;
    }

    await scene.add('AxesHelper', {
        name: HELPER_NAMES.axes,
        size: axesConfig.size || 5
    });
};

export const syncSceneHelpers = async (scene, helpers = {}, options = {}) => {
    if (!scene) return;

    await syncGridHelper(scene, helpers.grid, options);
    await syncAxesHelper(scene, helpers.axes, options);
};
