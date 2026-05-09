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
 * Renderer 渲染器类
 *
 * @class Renderer
 * @description WebGL 渲染器的封装和管理
 */
export class Renderer {
    /**
     * 创建渲染器实例
     *
     * @param {Scene} scene - 场景实例
     * @param {Object} options - 配置选项
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

        // 创建 WebGL 渲染器
        this.instance = new THREE.WebGLRenderer(this.options);

        // 设置渲染器大小
        this.resize();

        // 设置像素比（限制最大値为 2，避免 4K/Retina 屏幕将渲染分辨率成倍增大导致帧率下降）
        this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 设置色彩空间
        this.instance.outputColorSpace = THREE.SRGBColorSpace;

        // 启用阴影
        this.instance.shadowMap.enabled = false;
        this.instance.shadowMap.type = DEFAULT_SHADOW_MAP_TYPE;

        // 添加到容器
        this.scene.container.appendChild(this.instance.domElement);

        // 监听窗口大小变化
        this.handleResize = this.resize.bind(this);
    }

    /**
     * 启用阴影
     *
     * @param {boolean} enabled - 是否启用
     * @param {number} type - 阴影类型
     */
    enableShadow(enabled = true, type = DEFAULT_SHADOW_MAP_TYPE) {
        this.instance.shadowMap.enabled = enabled;
        this.instance.shadowMap.type = resolveShadowMapType(type);
    }

    /**
     * 启用自动调整大小
     */
    enableResize() {
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * 禁用自动调整大小
     */
    disableResize() {
        window.removeEventListener('resize', this.handleResize);
    }

    /**
     * 调整渲染器大小
     */
    resize() {
        const width = this.scene.container.clientWidth;
        const height = this.scene.container.clientHeight;

        this.instance.setSize(width, height);

        // 更新相机
        if (this.scene.camera) {
            this.scene.camera.resize(width, height);
        }
    }

    /**
     * 渲染场景
     *
     * @param {THREE.Scene} scene - Three.js 场景
     * @param {THREE.Camera} camera - Three.js 相机
     */
    render(scene, camera) {
        this.instance.render(scene, camera);
    }

    /**
     * 获取渲染器的 DOM 元素（canvas）
     * @returns {HTMLCanvasElement|null}
     */
    getDomElement() {
        return this.instance?.domElement || null;
    }

    /**
     * 设置背景色
     *
     * @param {string|number} color - 颜色值
     */
    setBackground(color) {
        this.instance.setClearColor(color);
    }

    /**
     * 更新渲染器配置
     *
     * @param {Object} config - 配置选项
     */
    updateConfig(config = {}) {
        if (!config || typeof config !== 'object') return;

        // 更新背景色
        if (config.clearColor !== undefined) {
            this.setBackground(config.clearColor);
        }

        // 更新像素比
        if (config.pixelRatio !== undefined) {
            this.instance.setPixelRatio(config.pixelRatio);
        }

        // 更新阴影设置
        if (config.shadowMap !== undefined) {
            if (config.shadowMap.enabled !== undefined) {
                this.instance.shadowMap.enabled = config.shadowMap.enabled;
            }
            if (config.shadowMap.type !== undefined) {
                this.instance.shadowMap.type = resolveShadowMapType(config.shadowMap.type);
            }
        }

        // 更新色彩空间
        if (config.outputColorSpace !== undefined) {
            this.instance.outputColorSpace = config.outputColorSpace;
        }

        // 更新色调映射
        if (config.toneMapping !== undefined) {
            this.instance.toneMapping = config.toneMapping;
        }

        if (config.toneMappingExposure !== undefined) {
            this.instance.toneMappingExposure = config.toneMappingExposure;
        }
    }

    /**
     * 获取当前配置
     *
     * @returns {Object} 当前配置
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
     * 销毁渲染器
     */
    dispose() {
        // 移除事件监听
        this.disableResize();

        // 销毁渲染器
        this.instance.dispose();

        // 移除 DOM 元素
        if (this.instance.domElement.parentNode) {
            this.instance.domElement.parentNode.removeChild(this.instance.domElement);
        }
    }
}
