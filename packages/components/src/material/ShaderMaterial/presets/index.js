
import {
    createBasicColorMaterial,
    getBasicColorMaterialDefaults,
    BasicColorMaterialMeta
} from './BasicColorMaterial.js';

import {
    createGradientMaterial,
    getGradientMaterialDefaults,
    GradientMaterialMeta
} from './GradientMaterial.js';

import {
    createAnimatedMaterial,
    getAnimatedMaterialDefaults,
    AnimatedMaterialMeta
} from './AnimatedMaterial.js';

import {
    createDiffusionMaterial,
    getDiffusionMaterialDefaults,
    DiffusionMaterialMeta
} from './DiffusionMaterial.js';

export const PRESET_FACTORIES = {
    basicColor: createBasicColorMaterial,
    gradient: createGradientMaterial,
    animated: createAnimatedMaterial,
    diffusion: createDiffusionMaterial
};

export const PRESET_DEFAULTS = {
    basicColor: getBasicColorMaterialDefaults,
    gradient: getGradientMaterialDefaults,
    animated: getAnimatedMaterialDefaults,
    diffusion: getDiffusionMaterialDefaults
};

export const PRESET_META = {
    basicColor: BasicColorMaterialMeta,
    gradient: GradientMaterialMeta,
    animated: AnimatedMaterialMeta,
    diffusion: DiffusionMaterialMeta
};

export function getAvailablePresets() {
    return Object.keys(PRESET_FACTORIES);
}

export function hasPreset(presetName) {
    return presetName in PRESET_FACTORIES;
}

export function getPresetDefaults(presetName) {
    const defaultsGetter = PRESET_DEFAULTS[presetName];
    return defaultsGetter ? defaultsGetter() : null;
}

export function getPresetMeta(presetName) {
    return PRESET_META[presetName] || null;
}

export function createPresetMaterial(presetName, params = {}) {
    const factory = PRESET_FACTORIES[presetName];
    if (!factory) {
        // eslint-disable-next-line no-console
        console.error(`ShaderMaterial: 预设材质 "${presetName}" 不存在`);
        return null;
    }
    return factory(params);
}

export {
    createBasicColorMaterial,
    createGradientMaterial,
    createAnimatedMaterial,
    createDiffusionMaterial
};
