import * as THREE from 'three';
import { Scene } from '@w3d/core';
import { getAllComponents } from '../utils/componentRegistry';

/**
 * 场景公共逻辑
 * 提取编辑模式和预览模式共用的方法
 */

const HDR_COMPONENT_NAME = '__hdr_background__';
const GRADIENT_TEXTURE_KEY = '__gradient_background_texture__';
const MANAGED_BACKGROUND_TEXTURE_KEY = '__managed_background_texture__';
const BACKGROUND_APPLY_TOKEN_KEY = '__background_apply_token__';

/**
 * 清理 HDR 背景组件
 * @param {Scene} scene - 场景实例
 * @param {string} hdrComponentName - HDR 组件实例 name
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
 * 清理编辑器受管背景纹理（渐变/图片）
 * @param {Scene} scene - 场景实例
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
 * 创建渐变纹理
 * @param {string} topColor - 顶部颜色
 * @param {string} bottomColor - 底部颜色
 * @returns {THREE.CanvasTexture|null} 纹理对象
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
 * 注册所有组件到场景
 * @param {Scene} scene - 场景实例
 */
export const registerAllComponents = (scene) => {
    const components = getAllComponents();
    components.forEach((comp) => {
        scene.registerComponent(comp.name, comp.class);
    });
};

/**
 * 应用场景背景（优先使用 SDK LoaderManager / Scene.add）
 * @param {Scene} scene - 场景实例
 * @param {Object} background - 背景配置
 * @param {string} hdrComponentName - HDR 组件实例 name（可选，用于区分编辑/预览模式）
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
 * 构建场景配置对象
 * @param {Object} sceneConfig - 场景配置
 * @returns {Object} 用于创建 Scene 的配置
 */
export const buildSceneOptions = (sceneConfig) => {
    const { renderer, camera, controls } = sceneConfig;

    return {
        // Scene 全局选项（对齐 @w3d/core Scene.constructor 默认字段）
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

        // Light.updateConfig 使用的是 sceneConfig.lighting（Scene.init 会创建 this.light）
        lights: sceneConfig?.lighting
    };
};

/**
 * 创建并初始化 Scene（对齐 SDK 约定流程）
 * - new Scene(container, buildSceneOptions(sceneConfig))
 * - 注册组件（确保 HDRLoader 等可用）
 * - await scene.init()（内部会按 isResize 自动 enableResize，并 start 渲染）
 * - 应用 lighting / shadow / background
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

    // 初始光照：使用 Light.updateConfig（与 Scene.update 行为一致）
    if (sceneConfig?.lighting && scene.light?.updateConfig) {
        scene.light.updateConfig(sceneConfig.lighting);
    }

    // 初始阴影：Renderer.enableShadow
    if (sceneConfig?.renderer?.shadowEnabled) {
        scene.renderer?.enableShadow?.(true);
    }

    await applyBackground(scene, background ?? sceneConfig?.background, hdrComponentName);
    return scene;
};
