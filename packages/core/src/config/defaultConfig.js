/**
 * English comment.
 */
export const defaultConfig = {
    // English comment.
    renderer: {
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        shadowMap: {
            enabled: false,
            type: 'PCFShadowMap'
        }
    },

    // English comment.
    camera: {
        fov: 45,
        near: 0.1,
        far: 10000,
        position: [0, 100, 200],
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
    lights: {
        ambient: {
            color: '#ffffff',
            intensity: 0.5
        },
        directional: {
            color: '#ffffff',
            intensity: 1.0,
            position: [100, 100, 100],
            castShadow: false
        }
    },

    // English comment.
    scene: {
        background: null,
        fog: null
    },

    // English comment.
    performance: {
        maxFPS: 60,
        enableStats: false
    },

    // English comment.
    indexedDB: {
        enabled: false,
        dbName: 'W3DCache',
        storeName: 'resources',
        debug: false,
        version: 1
    }
};

export default defaultConfig;
