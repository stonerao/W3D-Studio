import * as THREE from 'three';

const DEFAULT_SHADOW_MAP_TYPE = THREE.PCFShadowMap;

const SHADOW_MAP_TYPE_MAP = {
    BasicShadowMap: THREE.BasicShadowMap,
    PCFShadowMap: THREE.PCFShadowMap,
    PCFSoftShadowMap: THREE.PCFShadowMap,
    VSMShadowMap: THREE.VSMShadowMap
};

const resolveShadowMapType = (type = DEFAULT_SHADOW_MAP_TYPE) => {
    if (typeof type === 'number') {
        return type;
    }
    if (typeof type === 'string') {
        return SHADOW_MAP_TYPE_MAP[type] ?? DEFAULT_SHADOW_MAP_TYPE;
    }
    return DEFAULT_SHADOW_MAP_TYPE;
};

/**
 * English comment.
 */
export class Renderer {
    /**
     * English comment.
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            ...options
        };

        // English comment.
        this.instance = new THREE.WebGLRenderer(this.options);

        // English comment.
        this.resize();

        // English comment.
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // English comment.
        this.instance.outputColorSpace = THREE.SRGBColorSpace;

        // English comment.
        this.instance.shadowMap.enabled = false;
        this.instance.shadowMap.type = DEFAULT_SHADOW_MAP_TYPE;

        // English comment.
        this.scene.container.appendChild(this.instance.domElement);

        // English comment.
        this.handleResize = this.resize.bind(this);
    }

    /**
     * English comment.
     */
    enableShadow(enabled = true, type = DEFAULT_SHADOW_MAP_TYPE) {
        this.instance.shadowMap.enabled = enabled;
        this.instance.shadowMap.type = resolveShadowMapType(type);
    }

    /**
     * English comment.
     */
    enableResize() {
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * English comment.
     */
    disableResize() {
        window.removeEventListener('resize', this.handleResize);
    }

    /**
     * English comment.
     */
    resize() {
        const width = this.scene.container.clientWidth;
        const height = this.scene.container.clientHeight;

        this.instance.setSize(width, height);

        // English comment.
        if (this.scene.camera) {
            this.scene.camera.resize(width, height);
        }
    }

    /**
     * English comment.
     */
    render(scene, camera) {
        this.instance.render(scene, camera);
    }

    /**
     * English comment.
     */
    getDomElement() {
        return this.instance?.domElement || null;
    }

    /**
     * English comment.
     */
    setBackground(color) {
        this.instance.setClearColor(color);
    }

    /**
     * English comment.
     */
    updateConfig(config = {}) {
        if (!config || typeof config !== 'object') return;

        // English comment.
        if (config.clearColor !== undefined) {
            this.setBackground(config.clearColor);
        }

        // English comment.
        if (config.pixelRatio !== undefined) {
            this.instance.setPixelRatio(config.pixelRatio);
        }

        // English comment.
        if (config.shadowMap !== undefined) {
            if (config.shadowMap.enabled !== undefined) {
                this.instance.shadowMap.enabled = config.shadowMap.enabled;
            }
            if (config.shadowMap.type !== undefined) {
                this.instance.shadowMap.type = resolveShadowMapType(config.shadowMap.type);
            }
        }

        // English comment.
        if (config.outputColorSpace !== undefined) {
            this.instance.outputColorSpace = config.outputColorSpace;
        }

        // English comment.
        if (config.toneMapping !== undefined) {
            this.instance.toneMapping = config.toneMapping;
        }

        if (config.toneMappingExposure !== undefined) {
            this.instance.toneMappingExposure = config.toneMappingExposure;
        }
    }

    /**
     * English comment.
     */
    getConfig() {
        return {
            antialias: this.options.antialias,
            alpha: this.options.alpha,
            powerPreference: this.options.powerPreference,
            shadowMap: {
                enabled: this.instance.shadowMap.enabled,
                type: this.instance.shadowMap.type
            },
            outputColorSpace: this.instance.outputColorSpace,
            toneMapping: this.instance.toneMapping,
            toneMappingExposure: this.instance.toneMappingExposure
        };
    }

    /**
     * English comment.
     */
    dispose() {
        // English comment.
        this.disableResize();

        // English comment.
        this.instance.dispose();

        // English comment.
        if (this.instance.domElement.parentNode) {
            this.instance.domElement.parentNode.removeChild(this.instance.domElement);
        }
    }
}
