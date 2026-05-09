import { Component } from '@w3d/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { LuminosityShader } from 'three/examples/jsm/shaders/LuminosityShader.js';
import { SobelOperatorShader } from 'three/examples/jsm/shaders/SobelOperatorShader.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ReflectorForSSRPass } from 'three/examples/jsm/objects/ReflectorForSSRPass.js';

const REORDERABLE_EFFECTS = ['gtao', 'ssao', 'sao', 'ssr', 'bloom', 'dof', 'sobel', 'pixel', 'fxaa'];
const DEFAULT_PIPELINE = ['render', ...REORDERABLE_EFFECTS, 'output'];

const PIXEL_SHADER = {
    uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        pixelSize: { value: 6 }
    },
    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float pixelSize;
        varying vec2 vUv;

        void main() {
            vec2 cell = max(vec2(pixelSize) / max(resolution, vec2(1.0)), vec2(0.000001));
            vec2 uv = cell * floor(vUv / cell);
            gl_FragColor = texture2D(tDiffuse, uv);
        }
    `
};

const createDefaultConfig = () => ({
    enabled: true,
    pipeline: [...DEFAULT_PIPELINE],
    sobel: {
        enabled: false
    },
    ssr: {
        enabled: false,
        resolutionScale: 0.5,
        thickness: 0.018,
        infiniteThick: false,
        fresnel: true,
        distanceAttenuation: true,
        maxDistance: 0.1,
        bouncing: false,
        output: 0,
        opacity: 1,
        blur: true,
        groundReflector: null,
        selects: null
    },
    bloom: {
        enabled: false,
        threshold: 0,
        strength: 1,
        radius: 0,
        exposure: 1
    },
    gtao: {
        enabled: false,
        radius: 0.5,
        distanceExponent: 2,
        thickness: 10,
        scale: 1,
        samples: 16,
        distanceFallOff: 1,
        output: 0
    },
    sao: {
        enabled: false,
        output: 0,
        saoBias: 0.5,
        saoIntensity: 0.18,
        saoScale: 1,
        saoKernelRadius: 100,
        saoMinResolution: 0,
        saoBlur: true,
        saoBlurRadius: 8,
        saoBlurStdDev: 4,
        saoBlurDepthCutoff: 0.01
    },
    ssao: {
        enabled: false,
        kernelRadius: 8,
        minDistance: 0.005,
        maxDistance: 0.1,
        output: 0
    },
    dof: {
        enabled: false,
        focus: 1,
        aperture: 0.025,
        maxblur: 0.01
    },
    pixel: {
        enabled: false,
        pixelSize: 6
    },
    fxaa: {
        enabled: false
    }
});

const cloneJson = (value) => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (target, source) => {
    const output = isPlainObject(target) ? { ...target } : {};
    if (!isPlainObject(source)) {
        return output;
    }

    Object.entries(source).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            output[key] = [...value];
            return;
        }
        if (isPlainObject(value)) {
            output[key] = deepMerge(output[key], value);
            return;
        }
        output[key] = value;
    });

    return output;
};

const normalizePipeline = (pipeline) => {
    const middle = [];

    if (Array.isArray(pipeline)) {
        pipeline.forEach((entry) => {
            const type = String(entry || '').trim();
            if (!REORDERABLE_EFFECTS.includes(type) || middle.includes(type)) {
                return;
            }
            middle.push(type);
        });
    }

    REORDERABLE_EFFECTS.forEach((type) => {
        if (!middle.includes(type)) {
            middle.push(type);
        }
    });

    return ['render', ...middle, 'output'];
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const disposePass = (pass) => {
    if (pass && typeof pass.dispose === 'function') {
        pass.dispose();
    }
};

/**
 * Unified scene-level post-processing component.
 */
/**
 * Effects module component that manages screen-space post-processing passes for the renderer.
 */
export class PostProcessing extends Component {
    static defaultConfig = createDefaultConfig();

    static normalizeConfig(config = {}) {
        const defaults = createDefaultConfig();
        const legacyEffects = isPlainObject(config.effects) ? config.effects : {};
        const legacyAO = isPlainObject(config.ao) ? config.ao : {};

        const normalized = {
            ...defaults,
            ...config,
            pipeline: normalizePipeline(config.pipeline),
            sobel: {
                ...defaults.sobel,
                ...(isPlainObject(config.sobel) ? config.sobel : {})
            },
            ssr: {
                ...defaults.ssr,
                ...(isPlainObject(config.ssr) ? config.ssr : {})
            },
            bloom: {
                ...defaults.bloom,
                ...(isPlainObject(config.bloom) ? config.bloom : {})
            },
            gtao: {
                ...defaults.gtao,
                ...legacyAO,
                ...(isPlainObject(config.gtao) ? config.gtao : {})
            },
            sao: {
                ...defaults.sao,
                ...(isPlainObject(config.sao) ? config.sao : {})
            },
            ssao: {
                ...defaults.ssao,
                ...(isPlainObject(config.ssao) ? config.ssao : {})
            },
            dof: {
                ...defaults.dof,
                ...(isPlainObject(config.dof) ? config.dof : {})
            },
            pixel: {
                ...defaults.pixel,
                ...(isPlainObject(config.pixel) ? config.pixel : {})
            },
            fxaa: {
                ...defaults.fxaa,
                ...(isPlainObject(config.fxaa) ? config.fxaa : {})
            }
        };

        if (!hasOwn(normalized.sobel, 'enabled') && hasOwn(legacyEffects, 'sobel')) normalized.sobel.enabled = legacyEffects.sobel;
        if (!hasOwn(normalized.ssr, 'enabled') && hasOwn(legacyEffects, 'ssr')) normalized.ssr.enabled = legacyEffects.ssr;
        if (!hasOwn(normalized.bloom, 'enabled') && hasOwn(legacyEffects, 'bloom')) normalized.bloom.enabled = legacyEffects.bloom;
        if (!hasOwn(normalized.gtao, 'enabled') && hasOwn(legacyEffects, 'ao')) normalized.gtao.enabled = legacyEffects.ao;
        if (!hasOwn(normalized.fxaa, 'enabled') && hasOwn(legacyEffects, 'fxaa')) normalized.fxaa.enabled = legacyEffects.fxaa;

        normalized.effects = {
            sobel: normalized.sobel.enabled === true,
            ssr: normalized.ssr.enabled === true,
            bloom: normalized.bloom.enabled === true,
            ao: normalized.gtao.enabled === true,
            gtao: normalized.gtao.enabled === true,
            sao: normalized.sao.enabled === true,
            ssao: normalized.ssao.enabled === true,
            dof: normalized.dof.enabled === true,
            pixel: normalized.pixel.enabled === true,
            fxaa: normalized.fxaa.enabled === true
        };

        return normalized;
    }

    constructor(scene, config = {}) {
        super(scene, config);

        this.config = PostProcessing.normalizeConfig(this.config || config);

        this.composer = null;
        this.renderPass = null;
        this.sobelPass = null;
        this.sobelLuminosityPass = null;
        this.ssrPass = null;
        this.bloomPass = null;
        this.gtaoPass = null;
        this.saoPass = null;
        this.ssaoPass = null;
        this.dofPass = null;
        this.pixelPass = null;
        this.fxaaPass = null;
        this.outputPass = null;
        this.groundReflector = null;
        this.originalSceneRender = null;
        this.renderProxy = null;

        this.width = 1;
        this.height = 1;
    }

    getRendererInstance() {
        return this.scene?.renderer?.instance || this.scene?.renderer || null;
    }

    syncSizeFromRenderer() {
        const renderer = this.getRendererInstance();
        const domElement = renderer?.domElement;
        const width = domElement?.clientWidth || window.innerWidth || 1;
        const height = domElement?.clientHeight || window.innerHeight || 1;
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
    }

    createComposer() {
        const renderer = this.getRendererInstance();
        if (!renderer) {
            return;
        }

        this.syncSizeFromRenderer();
        this.composer = new EffectComposer(renderer);
        this.composer.setSize(this.width, this.height);
    }

    async onMounted() {
        this.createComposer();
        this.setupEffects();
        this.takeOverRenderer();

        this.handleResize = this.onWindowResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        this.emit('mounted');
    }

    takeOverRenderer() {
        if (!this.scene?.renderer || this.originalSceneRender) {
            return;
        }

        this.originalSceneRender = this.scene.renderer.render.bind(this.scene.renderer);
        this.renderProxy = (scene, camera) => {
            if (this.config?.enabled !== false && this.composer) {
                this.composer.render();
                return;
            }
            this.originalSceneRender?.(scene, camera);
        };
        this.scene.renderer.render = this.renderProxy;
    }

    restoreRenderer() {
        if (!this.scene?.renderer || !this.originalSceneRender) {
            return;
        }

        if (this.scene.renderer.render === this.renderProxy) {
            this.scene.renderer.render = this.originalSceneRender;
        }

        this.originalSceneRender = null;
        this.renderProxy = null;
    }

    getPipeline() {
        return normalizePipeline(this.config.pipeline);
    }

    isEffectEnabled(type) {
        if (this.config?.enabled === false) {
            return false;
        }
        if (type === 'render' || type === 'output') {
            return true;
        }
        return this.config?.[type]?.enabled === true;
    }

    needsOutputPass() {
        return REORDERABLE_EFFECTS.some((type) => this.isEffectEnabled(type));
    }

    setupEffects() {
        if (!this.composer) {
            return;
        }

        this.getPipeline().forEach((type) => {
            switch (type) {
                case 'render':
                    this.setupRenderPass();
                    break;
                case 'gtao':
                    if (this.isEffectEnabled(type)) this.setupGTAO();
                    break;
                case 'ssao':
                    if (this.isEffectEnabled(type)) this.setupSSAO();
                    break;
                case 'sao':
                    if (this.isEffectEnabled(type)) this.setupSAO();
                    break;
                case 'ssr':
                    if (this.isEffectEnabled(type)) this.setupSSR();
                    break;
                case 'bloom':
                    if (this.isEffectEnabled(type)) this.setupBloom();
                    break;
                case 'dof':
                    if (this.isEffectEnabled(type)) this.setupDOF();
                    break;
                case 'sobel':
                    if (this.isEffectEnabled(type)) this.setupSobel();
                    break;
                case 'pixel':
                    if (this.isEffectEnabled(type)) this.setupPixel();
                    break;
                case 'fxaa':
                    if (this.isEffectEnabled(type)) this.setupFXAA();
                    break;
                case 'output':
                    if (this.needsOutputPass()) this.setupOutputPass();
                    break;
                default:
                    break;
            }
        });
    }

    setupRenderPass() {
        this.renderPass = new RenderPass(this.scene.scene, this.scene.camera.instance);
        this.composer.addPass(this.renderPass);
    }

    setupOutputPass() {
        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
    }

    setupSobel() {
        this.sobelLuminosityPass = new ShaderPass(LuminosityShader);
        this.composer.addPass(this.sobelLuminosityPass);

        this.sobelPass = new ShaderPass(SobelOperatorShader);
        this.updateSobelResolution();
        this.composer.addPass(this.sobelPass);

        this.emit('sobelSetup');
    }

    updateSobelResolution() {
        if (!this.sobelPass) {
            return;
        }

        this.sobelPass.uniforms.resolution.value.x = this.width * window.devicePixelRatio;
        this.sobelPass.uniforms.resolution.value.y = this.height * window.devicePixelRatio;
    }

    setupPixel() {
        this.pixelPass = new ShaderPass(PIXEL_SHADER);
        this.applyPixelSettings();
        this.composer.addPass(this.pixelPass);
        this.emit('pixelSetup');
    }

    applyPixelSettings() {
        if (!this.pixelPass) {
            return;
        }

        this.pixelPass.material.uniforms.resolution.value.set(this.width, this.height);
        this.pixelPass.material.uniforms.pixelSize.value = Math.max(1, Number(this.config.pixel.pixelSize) || 1);
    }

    setupFXAA() {
        this.fxaaPass = new ShaderPass(FXAAShader);
        this.updateFXAAResolution();
        this.composer.addPass(this.fxaaPass);

        this.emit('fxaaSetup');
    }

    updateFXAAResolution() {
        if (!this.fxaaPass) {
            return;
        }

        this.fxaaPass.material.uniforms.resolution.value.x = 1 / (this.width * window.devicePixelRatio);
        this.fxaaPass.material.uniforms.resolution.value.y = 1 / (this.height * window.devicePixelRatio);
    }

    setupSSR() {
        const config = this.config.ssr;

        if (config.groundReflector?.enabled) {
            const geometry = new THREE.PlaneGeometry(1, 1);
            this.groundReflector = new ReflectorForSSRPass(geometry, {
                clipBias: config.groundReflector.clipBias || 0.0003,
                textureWidth: this.width,
                textureHeight: this.height,
                color: config.groundReflector.color || 0x888888,
                useDepthTexture: true
            });
            this.groundReflector.material.depthWrite = false;
            this.groundReflector.rotation.x = -Math.PI / 2;
            this.groundReflector.visible = false;
            this.scene.scene.add(this.groundReflector);
        }

        this.ssrPass = new SSRPass({
            renderer: this.getRendererInstance(),
            scene: this.scene.scene,
            camera: this.scene.camera.instance,
            width: this.width,
            height: this.height,
            groundReflector: this.groundReflector,
            selects: config.selects
        });

        this.applySSRSettings();
        this.composer.addPass(this.ssrPass);
        this.emit('ssrSetup');
    }

    applySSRSettings() {
        if (!this.ssrPass) {
            return;
        }

        const config = this.config.ssr;
        this.ssrPass.resolutionScale = config.resolutionScale;
        this.ssrPass.thickness = config.thickness;
        this.ssrPass.infiniteThick = config.infiniteThick;
        this.ssrPass.fresnel = config.fresnel;
        this.ssrPass.distanceAttenuation = config.distanceAttenuation;
        this.ssrPass.maxDistance = config.maxDistance;
        this.ssrPass.bouncing = config.bouncing;
        this.ssrPass.output = config.output ?? SSRPass.OUTPUT.Default;
        this.ssrPass.opacity = config.opacity;
        this.ssrPass.blur = config.blur;

        if (this.groundReflector) {
            this.groundReflector.fresnel = config.fresnel;
            this.groundReflector.distanceAttenuation = config.distanceAttenuation;
            this.groundReflector.maxDistance = config.maxDistance;
            this.groundReflector.opacity = config.opacity;
        }
    }

    setupBloom() {
        const config = this.config.bloom;
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            config.strength,
            config.radius,
            config.threshold
        );
        this.applyBloomSettings();
        this.composer.addPass(this.bloomPass);
        this.emit('bloomSetup');
    }

    applyBloomSettings() {
        if (!this.bloomPass) {
            return;
        }

        const config = this.config.bloom;
        const renderer = this.getRendererInstance();

        this.bloomPass.threshold = config.threshold;
        this.bloomPass.strength = config.strength;
        this.bloomPass.radius = config.radius;

        if (renderer && config.exposure !== undefined) {
            renderer.toneMappingExposure = Math.pow(config.exposure, 4.0);
        }
    }

    setupGTAO() {
        this.gtaoPass = new GTAOPass(
            this.scene.scene,
            this.scene.camera.instance,
            this.width,
            this.height
        );

        this.applyGTAOMaterial();
        this.applyGTAOOutput();
        this.composer.addPass(this.gtaoPass);
        this.emit('gtaoSetup');
    }

    applyGTAOMaterial() {
        if (!this.gtaoPass) {
            return;
        }

        const config = this.config.gtao;
        this.gtaoPass.updateGtaoMaterial({
            radius: config.radius,
            distanceExponent: config.distanceExponent,
            thickness: config.thickness,
            scale: config.scale,
            samples: config.samples,
            distanceFallOff: config.distanceFallOff
        });
    }

    applyGTAOOutput() {
        if (!this.gtaoPass) {
            return;
        }

        const config = this.config.gtao;
        if (this.renderPass) {
            this.renderPass.enabled = true;
        }

        switch (config.output) {
            case 0:
                this.gtaoPass.output = GTAOPass.OUTPUT.Off;
                this.gtaoPass.enabled = true;
                break;
            case 1:
                this.gtaoPass.output = GTAOPass.OUTPUT.Default;
                this.gtaoPass.enabled = true;
                break;
            case 2:
                this.gtaoPass.output = GTAOPass.OUTPUT.Diffuse;
                this.gtaoPass.enabled = false;
                break;
            case 3:
                this.gtaoPass.output = GTAOPass.OUTPUT.Denoise;
                this.gtaoPass.enabled = true;
                if (this.renderPass) {
                    this.renderPass.enabled = false;
                }
                break;
            default:
                this.gtaoPass.output = GTAOPass.OUTPUT.Off;
                this.gtaoPass.enabled = true;
                break;
        }
    }

    setupSAO() {
        this.saoPass = new SAOPass(
            this.scene.scene,
            this.scene.camera.instance,
            new THREE.Vector2(this.width, this.height)
        );
        this.applySAOSettings();
        this.composer.addPass(this.saoPass);
        this.emit('saoSetup');
    }

    applySAOSettings() {
        if (!this.saoPass) {
            return;
        }

        const config = this.config.sao;
        Object.assign(this.saoPass.params, {
            output: config.output,
            saoBias: config.saoBias,
            saoIntensity: config.saoIntensity,
            saoScale: config.saoScale,
            saoKernelRadius: config.saoKernelRadius,
            saoMinResolution: config.saoMinResolution,
            saoBlur: config.saoBlur,
            saoBlurRadius: config.saoBlurRadius,
            saoBlurStdDev: config.saoBlurStdDev,
            saoBlurDepthCutoff: config.saoBlurDepthCutoff
        });
    }

    setupSSAO() {
        this.ssaoPass = new SSAOPass(
            this.scene.scene,
            this.scene.camera.instance,
            this.width,
            this.height
        );
        this.applySSAOSettings();
        this.composer.addPass(this.ssaoPass);
        this.emit('ssaoSetup');
    }

    applySSAOSettings() {
        if (!this.ssaoPass) {
            return;
        }

        const config = this.config.ssao;
        this.ssaoPass.kernelRadius = config.kernelRadius;
        this.ssaoPass.minDistance = config.minDistance;
        this.ssaoPass.maxDistance = config.maxDistance;
        this.ssaoPass.output = config.output;
    }

    setupDOF() {
        this.dofPass = new BokehPass(this.scene.scene, this.scene.camera.instance, {
            focus: this.config.dof.focus,
            aperture: this.config.dof.aperture,
            maxblur: this.config.dof.maxblur
        });
        this.applyDOFSettings();
        this.composer.addPass(this.dofPass);
        this.emit('dofSetup');
    }

    applyDOFSettings() {
        if (!this.dofPass) {
            return;
        }

        const config = this.config.dof;
        this.dofPass.uniforms.focus.value = config.focus;
        this.dofPass.uniforms.aperture.value = config.aperture;
        this.dofPass.uniforms.maxblur.value = config.maxblur;
    }

    setEnabled(enabled = true) {
        this.config.enabled = enabled !== false;
        this.emit('enabledChanged', { enabled: this.config.enabled });
        return this.config.enabled;
    }

    enable() { return this.setEnabled(true); }

    disable() { return this.setEnabled(false); }

    toggleEnabled() { return this.setEnabled(this.config.enabled === false); }

    toggleSobel(enabled) { this.updateConfig({ sobel: { enabled } }); }
    toggleSSR(enabled) { this.updateConfig({ ssr: { enabled } }); }
    toggleBloom(enabled) { this.updateConfig({ bloom: { enabled } }); }
    toggleGTAO(enabled) { this.updateConfig({ gtao: { enabled } }); }
    toggleAO(enabled) { this.toggleGTAO(enabled); }
    toggleSAO(enabled) { this.updateConfig({ sao: { enabled } }); }
    toggleSSAO(enabled) { this.updateConfig({ ssao: { enabled } }); }
    toggleDOF(enabled) { this.updateConfig({ dof: { enabled } }); }
    togglePixel(enabled) { this.updateConfig({ pixel: { enabled } }); }
    toggleFXAA(enabled) { this.updateConfig({ fxaa: { enabled } }); }

    updateSobel(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { sobel: config || {} }));
        this.updateSobelResolution();
        this.emit('sobelUpdated', config);
    }

    updateSSR(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { ssr: config || {} }));
        this.applySSRSettings();
        this.emit('ssrUpdated', config);
    }

    updateBloom(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { bloom: config || {} }));
        this.applyBloomSettings();
        this.emit('bloomUpdated', config);
    }

    updateGTAO(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { gtao: config || {} }));
        this.applyGTAOMaterial();
        this.applyGTAOOutput();
        this.emit('gtaoUpdated', config);
    }

    updateAO(config) {
        this.updateGTAO(config);
    }

    updateSAO(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { sao: config || {} }));
        this.applySAOSettings();
        this.emit('saoUpdated', config);
    }

    updateSSAO(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { ssao: config || {} }));
        this.applySSAOSettings();
        this.emit('ssaoUpdated', config);
    }

    updateDOF(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { dof: config || {} }));
        this.applyDOFSettings();
        this.emit('dofUpdated', config);
    }

    updatePixel(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { pixel: config || {} }));
        this.applyPixelSettings();
        this.emit('pixelUpdated', config);
    }

    updateFXAA(config) {
        this.config = PostProcessing.normalizeConfig(deepMerge(this.config, { fxaa: config || {} }));
        this.updateFXAAResolution();
        this.emit('fxaaUpdated', config);
    }

    requiresRebuild(partialConfig = {}) {
        if (hasOwn(partialConfig, 'pipeline')) {
            return true;
        }

        const effectKeys = ['sobel', 'ssr', 'bloom', 'gtao', 'ao', 'sao', 'ssao', 'dof', 'pixel', 'fxaa'];
        for (const key of effectKeys) {
            const section = partialConfig[key];
            if (!isPlainObject(section)) {
                continue;
            }
            if (hasOwn(section, 'enabled')) {
                return true;
            }
            if (key === 'ssr' && (hasOwn(section, 'groundReflector') || hasOwn(section, 'selects'))) {
                return true;
            }
        }

        return false;
    }

    rebuildComposer() {
        this.disposeComposer();
        this.createComposer();
        this.setupEffects();
        this.emit('composerRebuilt');
    }

    disposeComposer() {
        if (this.groundReflector) {
            this.scene.scene.remove(this.groundReflector);
            this.groundReflector.dispose();
            this.groundReflector = null;
        }

        [
            this.sobelPass,
            this.sobelLuminosityPass,
            this.ssrPass,
            this.bloomPass,
            this.gtaoPass,
            this.saoPass,
            this.ssaoPass,
            this.dofPass,
            this.pixelPass,
            this.fxaaPass,
            this.outputPass
        ].forEach(disposePass);

        if (this.composer) {
            this.composer.dispose();
            this.composer = null;
        }

        this.renderPass = null;
        this.sobelPass = null;
        this.sobelLuminosityPass = null;
        this.ssrPass = null;
        this.bloomPass = null;
        this.gtaoPass = null;
        this.saoPass = null;
        this.ssaoPass = null;
        this.dofPass = null;
        this.pixelPass = null;
        this.fxaaPass = null;
        this.outputPass = null;
    }

    getAOMap() {
        return this.gtaoPass ? this.gtaoPass.gtaoMap : null;
    }

    async updateConfig(newConfig = {}) {
        const nextConfig = PostProcessing.normalizeConfig(deepMerge(cloneJson(this.config), newConfig || {}));
        const shouldRebuild = this.requiresRebuild(newConfig);
        const enabledChanged = hasOwn(newConfig, 'enabled') && nextConfig.enabled !== this.config.enabled;
        this.config = nextConfig;

        if (!this.composer) {
            return;
        }

        if (enabledChanged) {
            this.emit('enabledChanged', { enabled: this.config.enabled });
        }

        if (shouldRebuild) {
            this.rebuildComposer();
            return;
        }

        if (hasOwn(newConfig, 'sobel')) this.updateSobel(newConfig.sobel);
        if (hasOwn(newConfig, 'ssr')) this.updateSSR(newConfig.ssr);
        if (hasOwn(newConfig, 'bloom')) this.updateBloom(newConfig.bloom);
        if (hasOwn(newConfig, 'gtao') || hasOwn(newConfig, 'ao')) this.updateGTAO(newConfig.gtao || newConfig.ao);
        if (hasOwn(newConfig, 'sao')) this.updateSAO(newConfig.sao);
        if (hasOwn(newConfig, 'ssao')) this.updateSSAO(newConfig.ssao);
        if (hasOwn(newConfig, 'dof')) this.updateDOF(newConfig.dof);
        if (hasOwn(newConfig, 'pixel')) this.updatePixel(newConfig.pixel);
        if (hasOwn(newConfig, 'fxaa')) this.updateFXAA(newConfig.fxaa);
    }

    onWindowResize() {
        this.syncSizeFromRenderer();

        if (this.composer) {
            this.composer.setSize(this.width, this.height);
        }

        [
            this.ssrPass,
            this.gtaoPass,
            this.saoPass,
            this.ssaoPass,
            this.dofPass,
            this.bloomPass
        ].forEach((pass) => {
            if (pass?.setSize) {
                pass.setSize(this.width, this.height);
            }
        });

        this.updateSobelResolution();
        this.applyPixelSettings();
        this.updateFXAAResolution();

        if (this.groundReflector) {
            this.groundReflector.getRenderTarget().setSize(this.width, this.height);
            this.groundReflector.resolution.set(this.width, this.height);
        }

        this.emit('resize', { width: this.width, height: this.height });
    }

    onUpdate() {}

    onDispose() {
        if (this.handleResize) {
            window.removeEventListener('resize', this.handleResize);
        }

        this.restoreRenderer();
        this.disposeComposer();
        this.emit('disposed');
    }

    getInteractiveObjects() {
        return [];
    }
}

export default PostProcessing;
