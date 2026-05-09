/**
 * English comment.
 */

// English comment.
export const VERSION = '2.0.0';

// English comment.
export const BUILD_DATE = '2025-10-09';

// English comment.
export const RenderMode = {
    NORMAL: 'normal',
    WIREFRAME: 'wireframe',
    POINTS: 'points'
};

// English comment.
export const ShadowType = {
    BASIC: 'BasicShadowMap',
    PCF: 'PCFShadowMap',
    // English comment.
    PCF_SOFT: 'PCFSoftShadowMap',
    VSM: 'VSMShadowMap'
};

// English comment.
export const TextureFilter = {
    NEAREST: 'NearestFilter',
    LINEAR: 'LinearFilter',
    NEAREST_MIPMAP_NEAREST: 'NearestMipmapNearestFilter',
    NEAREST_MIPMAP_LINEAR: 'NearestMipmapLinearFilter',
    LINEAR_MIPMAP_NEAREST: 'LinearMipmapNearestFilter',
    LINEAR_MIPMAP_LINEAR: 'LinearMipmapLinearFilter'
};

// English comment.
export const TextureWrap = {
    REPEAT: 'RepeatWrapping',
    CLAMP: 'ClampToEdgeWrapping',
    MIRROR: 'MirroredRepeatWrapping'
};

// English comment.
export const BlendMode = {
    NORMAL: 'NormalBlending',
    ADDITIVE: 'AdditiveBlending',
    SUBTRACTIVE: 'SubtractiveBlending',
    MULTIPLY: 'MultiplyBlending'
};

// English comment.
export const ComponentState = {
    CREATED: 'created',
    MOUNTED: 'mounted',
    UPDATED: 'updated',
    DISPOSED: 'disposed'
};

// English comment.
export const ResourceType = {
    TEXTURE: 'texture',
    MODEL: 'model',
    AUDIO: 'audio',
    VIDEO: 'video',
    JSON: 'json'
};

// English comment.
export const LoopMode = {
    ONCE: 'LoopOnce',
    REPEAT: 'LoopRepeat',
    PING_PONG: 'LoopPingPong'
};

export default {
    VERSION,
    BUILD_DATE,
    RenderMode,
    ShadowType,
    TextureFilter,
    TextureWrap,
    BlendMode,
    ComponentState,
    ResourceType,
    LoopMode
};
