import { Component } from '@w3d/core';
import * as THREE from 'three';

const CAMERA_POINT_ID_KEY = '__w3dCameraPointId';
const SUPPORTED_VIDEO_FORMATS = new Set(['mp4', 'flv', 'ws-flv', 'hls', 'rtsp', 'rtmp', 'webrtc', 'webm']);

const DEFAULT_IMAGE = Object.freeze({
    enabled: false,
    url: '',
    renderMode: 'sprite',
    size: 1,
    billboard: true,
    center: [0.5, 0],
    offset: [0, 0, 0]
});

const DEFAULT_MODEL = Object.freeze({
    enabled: false,
    url: '',
    fitSize: 1,
    scale: 1,
    rotation: [0, 0, 0],
    offset: [0, 0, 0]
});

const DEFAULT_LABEL = Object.freeze({
    enabled: false,
    usePointName: true,
    text: '',
    offset: [0, 1.2, 0],
    style: {
        fontSize: 28,
        paddingX: 18,
        paddingY: 10,
        color: '#ffffff',
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        borderColor: 'rgba(148, 163, 184, 0.28)',
        borderWidth: 2
    }
});

const DEFAULT_VIDEO = Object.freeze({
    url: '',
    format: 'hls',
    poster: '',
    title: '',
    autoplay: true,
    muted: false,
    controls: true
});

const DEFAULT_EVENT_CONFIG = Object.freeze({
    click: { enabled: true, action: 'openVideo' },
    dblclick: { enabled: false, action: 'openVideo' }
});

const DEFAULT_VIDEO_MODAL_STYLE = Object.freeze({
    preset: 'dark',
    placement: 'center',
    left: 120,
    top: 120,
    width: 920,
    height: 0
});

function clampNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function ensureVector3(value, fallback = [0, 0, 0]) {
    if (Array.isArray(value)) {
        return [
            clampNumber(value[0], fallback[0]),
            clampNumber(value[1], fallback[1]),
            clampNumber(value[2], fallback[2])
        ];
    }

    if (value && typeof value === 'object') {
        return [
            clampNumber(value.x, fallback[0]),
            clampNumber(value.y, fallback[1]),
            clampNumber(value.z, fallback[2])
        ];
    }

    return [...fallback];
}

function ensureVector2(value, fallback = [0, 0]) {
    if (Array.isArray(value)) {
        return [
            clampNumber(value[0], fallback[0]),
            clampNumber(value[1], fallback[1])
        ];
    }

    if (value && typeof value === 'object') {
        return [
            clampNumber(value.x, fallback[0]),
            clampNumber(value.y, fallback[1])
        ];
    }

    return [...fallback];
}

function normalizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim() || fallback;
}

function normalizeVideoFormat(value, fallback = DEFAULT_VIDEO.format) {
    const raw = normalizeText(value, fallback).toLowerCase();
    const format = raw === 'm3u8' ? 'hls' : raw;
    return SUPPORTED_VIDEO_FORMATS.has(format) ? format : fallback;
}

function normalizeVideoInfo(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => {
            if (item && typeof item === 'object') {
                const label = normalizeText(item.label ?? item.name ?? item.key);
                const itemValue = normalizeText(item.value ?? item.text ?? item.content);
                if (!label && !itemValue) return null;
                return {
                    label: label || `信息${index + 1}`,
                    value: itemValue
                };
            }
            const itemValue = normalizeText(item);
            if (!itemValue) return null;
            return {
                label: `信息${index + 1}`,
                value: itemValue
            };
        })
        .filter(Boolean)
        .filter((item) => item.label || item.value);
}

function deepMerge(target, source) {
    const base = target && typeof target === 'object' ? target : {};
    const patch = source && typeof source === 'object' ? source : {};
    const result = { ...base };

    Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (
            value
            && typeof value === 'object'
            && !Array.isArray(value)
            && base[key]
            && typeof base[key] === 'object'
            && !Array.isArray(base[key])
        ) {
            result[key] = deepMerge(base[key], value);
            return;
        }
        result[key] = value;
    });

    return result;
}

function cloneJson(value, fallback = null) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function normalizeImageConfig(image = {}, defaults = DEFAULT_IMAGE) {
    const source = image && typeof image === 'object' ? image : {};
    const rawRenderMode = normalizeText(source.renderMode ?? source.mode, defaults.renderMode).toLowerCase();
    const renderMode = rawRenderMode === 'plane' || rawRenderMode === 'plan' ? 'plane' : 'sprite';
    return {
        ...defaults,
        ...source,
        enabled: source.enabled === true,
        url: normalizeText(source.url),
        renderMode,
        size: clampNumber(source.size, defaults.size),
        billboard: source.billboard !== false,
        center: ensureVector2(source.center, defaults.center),
        offset: ensureVector3(source.offset, defaults.offset)
    };
}

function normalizeModelConfig(model = {}, defaults = DEFAULT_MODEL) {
    const source = model && typeof model === 'object' ? model : {};
    return {
        ...defaults,
        ...source,
        enabled: source.enabled === true,
        url: normalizeText(source.url),
        fitSize: clampNumber(source.fitSize, defaults.fitSize),
        scale: clampNumber(source.scale, defaults.scale),
        rotation: ensureVector3(source.rotation, defaults.rotation),
        offset: ensureVector3(source.offset, defaults.offset)
    };
}

function normalizeLabelConfig(label = {}, defaults = DEFAULT_LABEL) {
    const source = label && typeof label === 'object' ? label : {};
    return {
        ...defaults,
        ...source,
        enabled: source.enabled === true,
        usePointName: source.usePointName !== false,
        text: normalizeText(source.text),
        offset: ensureVector3(source.offset, defaults.offset),
        style: {
            ...(defaults.style || {}),
            ...(source.style && typeof source.style === 'object' ? source.style : {})
        }
    };
}

function normalizeVideoConfig(video = {}, defaults = DEFAULT_VIDEO) {
    const source = video && typeof video === 'object' ? video : {};
    const formatText = normalizeVideoFormat(source.format, defaults.format);
    return {
        ...defaults,
        ...source,
        url: normalizeText(source.url),
        format: formatText,
        poster: normalizeText(source.poster),
        title: normalizeText(source.title),
        autoplay: source.autoplay !== false,
        muted: source.muted === true,
        controls: source.controls !== false
    };
}

function normalizeTypeStyle(raw = {}, index = 0) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = normalizeText(source.id ?? source.type ?? source.typeId, index === 0 ? 'default' : `type_${index + 1}`);
    const resourceType = normalizeText(source.resourceType).toLowerCase();
    const resourceUrl = normalizeText(source.resourceUrl ?? source.url);
    const baseOffset = ensureVector3(source.offset, [0, 0, 0]);

    const imageSource = source.image && typeof source.image === 'object'
        ? source.image
        : (resourceType === 'image' ? {
            enabled: true,
            url: resourceUrl,
            renderMode: source.renderMode ?? source.mode,
            size: source.size,
            billboard: source.billboard,
            center: source.center,
            offset: baseOffset
        } : {});
    const modelSource = source.model && typeof source.model === 'object'
        ? source.model
        : (resourceType === 'model' ? {
            enabled: true,
            url: resourceUrl,
            fitSize: source.fitSize ?? source.size,
            scale: source.scale,
            rotation: source.rotation,
            offset: baseOffset
        } : {});

    return {
        ...source,
        id,
        name: normalizeText(source.name, id),
        color: normalizeText(source.color, '#07a6ff'),
        image: normalizeImageConfig(imageSource),
        model: normalizeModelConfig(modelSource),
        label: normalizeLabelConfig(source.label || (source.showName !== undefined ? {
            enabled: source.showName === true,
            usePointName: true
        } : undefined))
    };
}

function normalizeTypeStyles(config = {}) {
    const styles = [];
    if (Array.isArray(config?.types)) {
        styles.push(...config.types);
    }
    if (config?.typeStyles && typeof config.typeStyles === 'object' && !Array.isArray(config.typeStyles)) {
        Object.entries(config.typeStyles).forEach(([id, style]) => {
            styles.push({ id, ...(style && typeof style === 'object' ? style : {}) });
        });
    }
    return styles.map((item, index) => normalizeTypeStyle(item, index));
}

function normalizePoint(raw = {}, index = 0) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = normalizeText(source.id, `camera_point_${index + 1}`);
    const image = normalizeImageConfig(source.image);
    const model = normalizeModelConfig(source.model);
    const label = normalizeLabelConfig(source.label);
    const legacyVideo = normalizeVideoConfig(source.video);
    const videoUrl = normalizeText(source.videoUrl, legacyVideo.url);
    const videoFormat = normalizeVideoFormat(source.videoFormat, legacyVideo.format);
    const video = normalizeVideoConfig({
        ...legacyVideo,
        url: videoUrl,
        format: videoFormat
    });
    const legacyInfo = source.data && typeof source.data === 'object' ? source.data.videoInfo : null;
    return {
        ...source,
        id,
        name: normalizeText(source.name, `摄像头点位${index + 1}`),
        position: ensureVector3(source.position, [0, 0, 0]),
        type: normalizeText(source.type ?? source.typeId, 'default'),
        vendor: normalizeText(source.vendor, 'generic'),
        videoUrl,
        videoFormat,
        videoInfo: normalizeVideoInfo(source.videoInfo ?? legacyInfo),
        visible: source.visible !== false,
        image,
        model,
        label,
        video,
        data: source.data && typeof source.data === 'object' ? cloneJson(source.data, {}) : {}
    };
}

function createLabelTexture(labelConfig = {}) {
    const style = labelConfig.style || {};
    const text = normalizeText(labelConfig.text);
    if (!text) return null;

    const fontSize = Math.max(12, clampNumber(style.fontSize, 28));
    const paddingX = Math.max(4, clampNumber(style.paddingX, 18));
    const paddingY = Math.max(4, clampNumber(style.paddingY, 10));
    const fontFamily = normalizeText(style.fontFamily, 'sans-serif');
    const color = normalizeText(style.color, '#ffffff');
    const backgroundColor = normalizeText(style.backgroundColor, 'rgba(15, 23, 42, 0.78)');
    const borderColor = normalizeText(style.borderColor, 'rgba(148, 163, 184, 0.28)');
    const borderWidth = Math.max(0, clampNumber(style.borderWidth, 2));

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.font = `${fontSize}px ${fontFamily}`;
    const metrics = context.measureText(text);
    const textWidth = Math.ceil(metrics.width);
    const width = textWidth + paddingX * 2 + borderWidth * 2;
    const height = fontSize + paddingY * 2 + borderWidth * 2;

    canvas.width = Math.max(width, 2);
    canvas.height = Math.max(height, 2);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = backgroundColor;
    context.strokeStyle = borderColor;
    context.lineWidth = borderWidth;

    const radius = Math.max(4, clampNumber(style.radius, 8));
    context.beginPath();
    context.moveTo(radius, 0);
    context.lineTo(canvas.width - radius, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
    context.lineTo(canvas.width, canvas.height - radius);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
    context.lineTo(radius, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
    context.lineTo(0, radius);
    context.quadraticCurveTo(0, 0, radius, 0);
    context.closePath();
    context.fill();
    if (borderWidth > 0) {
        context.stroke();
    }

    context.font = `${fontSize}px ${fontFamily}`;
    context.fillStyle = color;
    context.textBaseline = 'middle';
    context.fillText(text, paddingX + borderWidth, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return {
        texture,
        width: canvas.width,
        height: canvas.height
    };
}

export class CameraPointManager extends Component {
    static defaultConfig = {
        points: [],
        types: [],
        typeStyles: {},
        eventConfig: cloneJson(DEFAULT_EVENT_CONFIG, {}),
        videoModalStyle: cloneJson(DEFAULT_VIDEO_MODAL_STYLE, {}),
        imageSize: 1,
        modelFitSize: 1,
        labelScale: 0.012,
        enableInteraction: true
    };

    static methodDefinitions = [
        {
            name: 'updateData',
            title: '更新点位数据',
            description: '用新的摄像头点位数组覆盖当前数据',
            params: [
                { name: 'data', title: '点位数组', type: 'array', required: true }
            ]
        },
        {
            name: 'setPoints',
            title: '设置点位',
            description: '设置当前摄像头点位数组',
            params: [
                { name: 'points', title: '点位数组', type: 'array', required: true }
            ]
        },
        {
            name: 'getPoints',
            title: '获取点位',
            description: '返回当前点位数组',
            params: []
        },
        {
            name: 'focusPoint',
            title: '聚焦点位',
            description: '将相机视角聚焦到指定点位',
            params: [
                { name: 'pointId', title: '点位 ID', type: 'string', required: true }
            ]
        },
        {
            name: 'setPointVisible',
            title: '设置点位显隐',
            description: '设置单个点位的显示状态',
            params: [
                { name: 'pointId', title: '点位 ID', type: 'string', required: true },
                { name: 'visible', title: '是否显示', type: 'boolean', required: true }
            ]
        }
    ];

    onCreate() {
        this._pointMap = new Map();
        this._interactiveObjects = [];
        this._textureLoader = new THREE.TextureLoader();
        this._textureCache = new Map();
        this._modelCache = new Map();
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();
        this._hoverPointId = null;
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerClick = this._handlePointerClick.bind(this);
        this._onPointerDoubleClick = this._handlePointerDoubleClick.bind(this);
        this._modelLoader = null;
    }

    async onMounted() {
        this._initLoaders();
        await this._rebuildAll();
        this._bindCanvasEvents();
        this.emit('mounted');
    }

    async updateConfig(newConfig = {}) {
        this.config = deepMerge(this.config || {}, newConfig || {});
        await this._rebuildAll();
        this.scene?.eventSystem?.invalidateInteractiveCache?.();
        this.emit('config-updated', { changed: Object.keys(newConfig || {}) });
    }

    async updateData(data = []) {
        await this.setPoints(data);
    }

    async setPoints(points = []) {
        await this.updateConfig({
            points: Array.isArray(points) ? cloneJson(points, []) : []
        });
        this.emit('updated', { pointCount: this._pointMap.size });
    }

    getPoints() {
        return this._normalizePoints().map((item) => cloneJson(item, item));
    }

    focusPoint(pointId) {
        const record = this._pointMap.get(String(pointId || ''));
        const target = record?.group || null;
        const camera = this.scene?.camera?.instance;
        if (!target || !camera) return false;

        const worldPosition = new THREE.Vector3();
        target.getWorldPosition(worldPosition);

        const controls = this.scene?.controls?.instance;
        if (controls?.target) {
            controls.target.copy(worldPosition);
            controls.update?.();
        }
        camera.lookAt(worldPosition);
        return true;
    }

    async setPointVisible(pointId, visible = true) {
        const targetId = String(pointId || '');
        const nextPoints = this._normalizePoints().map((item) => (
            item.id === targetId
                ? { ...item, visible: visible !== false }
                : item
        ));
        await this.setPoints(nextPoints);
    }

    raycast(event) {
        return this._intersectObjects(event).map((hit) => ({
            ...hit,
            component: this
        }));
    }

    onDispose() {
        this._unbindCanvasEvents();
        this._disposePoints();
        this._textureCache.clear();
        this._modelCache.clear();
    }

    _normalizePoints() {
        return (Array.isArray(this.config?.points) ? this.config.points : []).map((item, index) => normalizePoint(item, index));
    }

    _initLoaders() {
        if (this._modelLoader) return;
        const loaderManager = this.scene?.loaderManager;
        if (!loaderManager || typeof loaderManager.getModelLoader !== 'function') return;
        this._modelLoader = loaderManager.getModelLoader();
        if (typeof this._modelLoader.setDracoDecoderPath === 'function' && this.scene?.options?.dracoDecoderPath) {
            this._modelLoader.setDracoDecoderPath(this.scene.options.dracoDecoderPath);
        }
    }

    async _rebuildAll() {
        this._disposePoints();

        const points = this._normalizePoints();
        const typeStyles = this._getTypeStyleMap();
        for (const point of points) {
            const group = await this._createPointGroup(point, typeStyles);
            if (!group) continue;
            this.componentScene.add(group);
            this._pointMap.set(point.id, { point, group });
        }
    }

    _getTypeStyleMap() {
        const map = new Map();
        normalizeTypeStyles(this.config || {}).forEach((style) => {
            map.set(style.id, style);
        });
        return map;
    }

    _resolveVisualConfig(point, typeStyles) {
        const typeStyle = typeStyles.get(point.type) || typeStyles.get('default') || null;
        const image = point.image?.enabled === true ? point.image : (typeStyle?.image || normalizeImageConfig());
        const model = point.model?.enabled === true ? point.model : (typeStyle?.model || normalizeModelConfig());
        const label = point.label?.enabled === true ? point.label : (typeStyle?.label || normalizeLabelConfig());
        return {
            image,
            model,
            label,
            placeholderColor: typeStyle?.color || '#07a6ff'
        };
    }

    _disposePoints() {
        this._pointMap.forEach(({ group }) => {
            if (group?.parent) {
                group.parent.remove(group);
            }
            group?.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose?.();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((material) => {
                            if (material?.userData?.__disposeMap === true) {
                                material?.map?.dispose?.();
                            }
                            material?.dispose?.();
                        });
                    } else {
                        if (object.material?.userData?.__disposeMap === true) {
                            object.material.map?.dispose?.();
                        }
                        object.material.dispose?.();
                    }
                }
            });
            group?.clear?.();
        });
        this._pointMap.clear();
        this._interactiveObjects = [];
        this._hoverPointId = null;
    }

    async _createPointGroup(point, typeStyles = new Map()) {
        const group = new THREE.Group();
        group.name = point.name || point.id;
        group.visible = point.visible !== false;
        group.position.set(point.position[0], point.position[1], point.position[2]);

        let hasVisual = false;
        const visual = this._resolveVisualConfig(point, typeStyles);

        if (visual.image?.enabled && visual.image?.url) {
            const imageObject = await this._createImageSprite(point, visual.image);
            if (imageObject) {
                group.add(imageObject);
                hasVisual = true;
            }
        }

        if (visual.model?.enabled && visual.model?.url) {
            const modelObject = await this._createModelObject(point, visual.model);
            if (modelObject) {
                group.add(modelObject);
                hasVisual = true;
            }
        }

        if (visual.label?.enabled) {
            const labelObject = this._createLabelObject(point, visual.label);
            if (labelObject) {
                group.add(labelObject);
                hasVisual = true;
            }
        }

        if (!hasVisual) {
            const placeholder = this._createPlaceholderObject(visual.placeholderColor);
            group.add(placeholder);
        }

        this._tagInteractive(group, point);
        return group;
    }

    _createPlaceholderObject(color = '#07a6ff') {
        const geometry = new THREE.SphereGeometry(0.25, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'placeholder';
        return mesh;
    }

    async _createImageSprite(point, imageConfig = null) {
        const config = imageConfig || point.image || DEFAULT_IMAGE;
        const texture = await this._loadTexture(config.url);
        if (!texture) return null;

        texture.colorSpace = THREE.SRGBColorSpace;
        if (config.renderMode === 'plane') {
            return this._createImagePlane(texture, config);
        }

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });
        material.userData = {
            ...(material.userData || {}),
            __disposeMap: false
        };
        const sprite = new THREE.Sprite(material);
        const size = clampNumber(config.size, this.config.imageSize || 1);
        sprite.scale.set(size, size, 1);
        sprite.center.set(config.center[0], config.center[1]);
        sprite.position.set(config.offset[0], config.offset[1], config.offset[2]);
        sprite.userData.__cameraPointBillboard = config.billboard !== false;
        sprite.name = 'image';
        return sprite;
    }

    _createImagePlane(texture, config) {
        const size = clampNumber(config.size, this.config.imageSize || 1);
        const imageWidth = clampNumber(texture?.image?.width, 1);
        const imageHeight = clampNumber(texture?.image?.height, 1);
        const aspect = imageWidth > 0 ? imageHeight / imageWidth : 1;
        const geometry = new THREE.PlaneGeometry(size, size * aspect);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        material.userData = {
            ...(material.userData || {}),
            __disposeMap: false
        };
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(config.offset[0], config.offset[1], config.offset[2]);
        mesh.name = 'image-plane';
        return mesh;
    }

    async _createModelObject(point, modelConfig = null) {
        const config = modelConfig || point.model || DEFAULT_MODEL;
        const gltf = await this._loadModel(config.url);
        const scene = gltf?.scene ? gltf.scene.clone(true) : null;
        if (!scene) return null;

        scene.traverse((object) => {
            if (!object.isMesh) return;
            if (object.geometry) {
                object.geometry = object.geometry.clone();
            }
            if (Array.isArray(object.material)) {
                object.material = object.material.map((material) => material?.clone?.() || material);
            } else if (object.material) {
                object.material = object.material.clone();
            }
        });

        const fitSize = clampNumber(config.fitSize, this.config.modelFitSize || 1);
        if (fitSize > 0) {
            const bounds = new THREE.Box3().setFromObject(scene);
            const size = new THREE.Vector3();
            bounds.getSize(size);
            const maxDimension = Math.max(size.x, size.y, size.z);
            if (Number.isFinite(maxDimension) && maxDimension > 0) {
                scene.scale.multiplyScalar(fitSize / maxDimension);
            }
        }
        scene.scale.multiplyScalar(clampNumber(config.scale, 1));

        const rotation = ensureVector3(config.rotation, [0, 0, 0]).map((item) => THREE.MathUtils.degToRad(item));
        scene.rotation.set(rotation[0], rotation[1], rotation[2]);
        scene.position.set(config.offset[0], config.offset[1], config.offset[2]);
        scene.name = 'model';
        return scene;
    }

    _createLabelObject(point, labelConfig = null) {
        const sourceConfig = labelConfig || point.label || DEFAULT_LABEL;
        const config = {
            ...sourceConfig,
            text: sourceConfig.usePointName !== false ? point.name : sourceConfig.text
        };
        const result = createLabelTexture(config);
        if (!result) return null;

        const material = new THREE.SpriteMaterial({
            map: result.texture,
            transparent: true,
            depthWrite: false
        });
        material.userData = {
            ...(material.userData || {}),
            __disposeMap: true
        };
        const sprite = new THREE.Sprite(material);
        const scale = clampNumber(this.config.labelScale, 0.012);
        const width = Math.max(1, result.width) * scale;
        const height = Math.max(1, result.height) * scale;
        sprite.scale.set(width, height, 1);
        sprite.position.set(config.offset[0], config.offset[1], config.offset[2]);
        sprite.name = 'label';
        return sprite;
    }

    async _loadTexture(url) {
        if (!url) return null;
        if (this._textureCache.has(url)) return this._textureCache.get(url);

        const promise = new Promise((resolve) => {
            this._textureLoader.load(
                url,
                (texture) => resolve(texture),
                undefined,
                () => resolve(null)
            );
        });
        this._textureCache.set(url, promise);
        return promise;
    }

    async _loadModel(url) {
        if (!url || !this._modelLoader) return null;
        if (this._modelCache.has(url)) return this._modelCache.get(url);

        const promise = Promise.resolve()
            .then(() => this._modelLoader.load(url))
            .catch(() => null);
        this._modelCache.set(url, promise);
        return promise;
    }

    _tagInteractive(root, point) {
        root.traverse((object) => {
            if (!object.userData) object.userData = {};
            object.userData[CAMERA_POINT_ID_KEY] = point.id;
            object.userData.eventEmitter = this.eventEmitter;
            object.userData.cameraPoint = point;
            this._interactiveObjects.push(object);
        });
    }

    _bindCanvasEvents() {
        const canvas = this.scene?.renderer?.instance?.domElement;
        if (!canvas) return;
        canvas.addEventListener('mousemove', this._onPointerMove);
        canvas.addEventListener('click', this._onPointerClick);
        canvas.addEventListener('dblclick', this._onPointerDoubleClick);
    }

    _unbindCanvasEvents() {
        const canvas = this.scene?.renderer?.instance?.domElement;
        if (!canvas) return;
        canvas.removeEventListener('mousemove', this._onPointerMove);
        canvas.removeEventListener('click', this._onPointerClick);
        canvas.removeEventListener('dblclick', this._onPointerDoubleClick);
    }

    _handlePointerMove(event) {
        if (!this.config.enableInteraction) return;
        const intersections = this._intersectObjects(event);
        if (intersections.length === 0) {
            if (this._hoverPointId) {
                this._hoverPointId = null;
                this.emit('cameraPointHoverOut');
            }
            return;
        }

        const pointId = this._resolvePointId(intersections[0]);
        if (!pointId || pointId === this._hoverPointId) return;
        this._hoverPointId = pointId;
        const point = this._pointMap.get(pointId)?.point || null;
        this.emit('cameraPointHover', { pointId, point, rawEvent: event });
    }

    _handlePointerClick(event) {
        this._emitPointInteraction('cameraPointClick', event);
    }

    _handlePointerDoubleClick(event) {
        this._emitPointInteraction('cameraPointDblClick', event);
    }

    _emitPointInteraction(eventName, event) {
        if (!this.config.enableInteraction) return;
        const intersections = this._intersectObjects(event);
        if (intersections.length === 0) return;

        const hit = intersections[0];
        const pointId = this._resolvePointId(hit);
        if (!pointId) return;

        const point = this._pointMap.get(pointId)?.point || null;
        this.emit(eventName, {
            trigger: eventName === 'cameraPointDblClick' ? 'dblclick' : 'click',
            pointId,
            point,
            video: point?.video || null,
            videoUrl: point?.videoUrl || point?.video?.url || '',
            videoFormat: point?.videoFormat || point?.video?.format || DEFAULT_VIDEO.format,
            vendor: point?.vendor || 'generic',
            videoInfo: Array.isArray(point?.videoInfo) ? cloneJson(point.videoInfo, []) : [],
            rawEvent: event,
            intersection: hit
        });
    }

    _intersectObjects(event) {
        const camera = this.scene?.camera?.instance;
        const canvas = this.scene?.renderer?.instance?.domElement;
        if (!camera || !canvas || this._interactiveObjects.length === 0) return [];

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];

        this._mouse.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this._raycaster.setFromCamera(this._mouse, camera);
        return this._raycaster.intersectObjects(this._interactiveObjects, false);
    }

    _resolvePointId(hit) {
        return String(hit?.object?.userData?.[CAMERA_POINT_ID_KEY] || '').trim() || null;
    }
}

export default CameraPointManager;
