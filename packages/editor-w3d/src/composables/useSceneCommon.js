import * as THREE from 'three';
import { Scene } from '@w3d/core';
import { getAllComponents } from '../utils/componentRegistry';

/**
 * English comment.
 */

const HDR_COMPONENT_NAME = '__hdr_background__';
const GRADIENT_TEXTURE_KEY = '__gradient_background_texture__';
const MANAGED_BACKGROUND_TEXTURE_KEY = '__managed_background_texture__';
const BACKGROUND_APPLY_TOKEN_KEY = '__background_apply_token__';

/**
 * English comment.
 */
export const clearHDRBackground = (scene, hdrComponentName = HDR_COMPONENT_NAME) => {
    const namesToRemove = new Set([HDR_COMPONENT_NAME, hdrComponentName].filter(Boolean));

    for (const name of namesToRemove) {
        try {
            scene?.remove?.(name);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[SceneCommon] Failed to remove HDRLoader component', error);
        }
    }

    if (scene?.scene) {
        scene.scene.environment = null;
    }
};

/**
 * English comment.
 */
export const disposeManagedBackground = (scene) => {
    const threeScene = scene?.scene;
    if (!threeScene) return;

    const tex = threeScene.userData?.[MANAGED_BACKGROUND_TEXTURE_KEY] || threeScene.userData?.[GRADIENT_TEXTURE_KEY];
    if (tex) {
        try {
            tex.dispose?.();
        } catch {
            // ignore dispose errors
        }
    }

    if (!threeScene.userData) threeScene.userData = {};
    if (threeScene.background === tex) {
        threeScene.background = null;
    }
    threeScene.userData[MANAGED_BACKGROUND_TEXTURE_KEY] = null;
    threeScene.userData[GRADIENT_TEXTURE_KEY] = null;
};

export const disposeGradientBackground = disposeManagedBackground;

const markBackgroundApplyStart = (scene) => {
    const threeScene = scene?.scene;
    if (!threeScene) return 0;
    if (!threeScene.userData) threeScene.userData = {};
    const token = Number(threeScene.userData[BACKGROUND_APPLY_TOKEN_KEY] || 0) + 1;
    threeScene.userData[BACKGROUND_APPLY_TOKEN_KEY] = token;
    return token;
};

const isCurrentBackgroundApply = (scene, token) => {
    return scene?.scene?.userData?.[BACKGROUND_APPLY_TOKEN_KEY] === token;
};

const setManagedBackgroundTexture = (scene, texture) => {
    const threeScene = scene?.scene;
    if (!threeScene || !texture) return;
    if (!threeScene.userData) threeScene.userData = {};
    threeScene.userData[MANAGED_BACKGROUND_TEXTURE_KEY] = texture;
    threeScene.background = texture;
};

const patchSceneDisposeForBackground = (scene) => {
    if (!scene || scene.__w3dBackgroundDisposePatched) return;
    const originalDispose = scene.dispose?.bind(scene);
    if (typeof originalDispose !== 'function') return;
    scene.dispose = () => {
        disposeManagedBackground(scene);
        return originalDispose();
    };
    scene.__w3dBackgroundDisposePatched = true;
};

/**
 * English comment.
 */
export const createGradientTexture = (topColor, bottomColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, topColor || '#87ceeb');
    gradient.addColorStop(1, bottomColor || '#ffffff');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

/**
 * English comment.
 */
export const registerAllComponents = (scene) => {
    const components = getAllComponents();
    components.forEach((comp) => {
        scene.registerComponent(comp.name, comp.class);
    });
};

/**
 * English comment.
 */
export const applyBackground = async (scene, background, hdrComponentName = HDR_COMPONENT_NAME) => {
    if (!scene || !background) return;
    const applyToken = markBackgroundApplyStart(scene);

    switch (background.type) {
    case 'color':
        clearHDRBackground(scene, hdrComponentName);
        disposeManagedBackground(scene);
        scene.scene.background = new THREE.Color(background.color);
        break;
    case 'gradient': {
        clearHDRBackground(scene, hdrComponentName);
        disposeManagedBackground(scene);
        const tex = createGradientTexture(background.gradientTop, background.gradientBottom);
        if (tex) {
            scene.scene.userData[GRADIENT_TEXTURE_KEY] = tex;
            setManagedBackgroundTexture(scene, tex);
        } else {
            scene.scene.background = new THREE.Color(background.gradientTop || '#87ceeb');
        }
        break;
    }
    case 'image': {
        clearHDRBackground(scene, hdrComponentName);
        disposeManagedBackground(scene);
        if (!background.imageUrl) break;

        try {
            const textureLoader = scene.loaderManager?.getTextureLoader?.();
            let texture = null;
            if (textureLoader?.load) {
                texture = await textureLoader.load(background.imageUrl);
            } else {
                const fallbackLoader = new THREE.TextureLoader();
                texture = await new Promise((resolve, reject) => {
                    fallbackLoader.load(background.imageUrl, resolve, undefined, reject);
                });
            }
            if (!isCurrentBackgroundApply(scene, applyToken)) {
                texture?.dispose?.();
                break;
            }
            setManagedBackgroundTexture(scene, texture);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[SceneCommon] Failed to load background image:', error);
        }

        break;
    }
    case 'hdr':
        if (!background.hdrUrl) {
            clearHDRBackground(scene, hdrComponentName);
            disposeManagedBackground(scene);
            break;
        }

        clearHDRBackground(scene, hdrComponentName);
        disposeManagedBackground(scene);
        const hdrInstance = await scene.add('HDRLoader', {
            name: hdrComponentName,
            url: background.hdrUrl,
            asEnvironment: true,
            asBackground: true
        });
        if (!isCurrentBackgroundApply(scene, applyToken)) {
            if (scene.get?.(hdrComponentName) === hdrInstance) {
                scene.remove(hdrComponentName);
            }
        }
        break;
    default:
        clearHDRBackground(scene, hdrComponentName);
        disposeManagedBackground(scene);
        scene.scene.background = new THREE.Color('#554f4a');
    }
};

/**
 * English comment.
 */
export const buildSceneOptions = (sceneConfig) => {
    const { renderer, camera, controls } = sceneConfig;

    return {
        // English comment.
        isRendering: sceneConfig?.isRendering ?? true,
        isResize: sceneConfig?.isResize ?? true,
        indexedDB: sceneConfig?.indexedDB,
        dracoDecoderPath: sceneConfig?.dracoDecoderPath,

        renderer: {
            antialias: renderer?.antialias ?? true,
            alpha: renderer?.alpha,
            powerPreference: renderer?.powerPreference,
            outputColorSpace: renderer?.outputColorSpace
        },
        camera: {
            type: camera?.type,
            fov: camera?.fov ?? 75,
            near: camera?.near,
            far: camera?.far,
            position: camera?.position ?? [0, 5, 10],
            lookAt: camera?.lookAt ?? [0, 0, 0],
            viewSize: camera?.viewSize,
            zoom: camera?.zoom
        },
        controls: {
            enableDamping: controls?.enableDamping ?? true,
            dampingFactor: controls?.dampingFactor ?? 0.05,
            enableZoom: controls?.enableZoom ?? true,
            enableRotate: controls?.enableRotate ?? true,
            enablePan: controls?.enablePan ?? true,
            autoRotate: controls?.autoRotate ?? false,
            autoRotateSpeed: controls?.autoRotateSpeed ?? 2.0,
            minDistance: controls?.minDistance ?? 1,
            maxDistance: controls?.maxDistance ?? 1000,
            target: {
                x: camera?.lookAt?.[0] ?? 0,
                y: camera?.lookAt?.[1] ?? 0,
                z: camera?.lookAt?.[2] ?? 0
            }
        },

        // English comment.
        lights: sceneConfig?.lighting
    };
};

/**
 * English comment.
 */
export const createAndInitScene = async ({
    container,
    sceneConfig,
    background,
    hdrComponentName = HDR_COMPONENT_NAME,
    registerComponents = true
}) => {
    const sceneOptions = buildSceneOptions(sceneConfig || {});
    const scene = new Scene(container, sceneOptions);
    patchSceneDisposeForBackground(scene);

    if (registerComponents) {
        registerAllComponents(scene);
    }

    await scene.init();

    // English comment.
    if (sceneConfig?.lighting && scene.light?.updateConfig) {
        scene.light.updateConfig(sceneConfig.lighting);
    }

    // English comment.
    if (sceneConfig?.renderer?.shadowEnabled) {
        scene.renderer?.enableShadow?.(true);
    }

    await applyBackground(scene, background ?? sceneConfig?.background, hdrComponentName);
    return scene;
};
