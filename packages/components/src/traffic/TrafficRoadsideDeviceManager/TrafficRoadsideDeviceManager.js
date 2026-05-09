import { Component } from '@w3d/core';
import * as THREE from 'three';
import {
    createTrafficGeoCoordinateTransformer,
    normalizeTrafficCoordinateSystemConfig
} from './geoCoordinateTransform.js';

const DEVICE_ID_KEY = '__w3dRoadsideDeviceId';

const DEFAULT_DEVICE = {
    id: '',
    name: '',
    type: 'pole',
    parentId: null,
    xyz: [0, 0, 0],
    lngLat: null,
    alt: 0,
    rotation: [0, 0, 0],
    scale: 1,
    resourceType: 'model',
    resourceUrl: ''
};

function clampNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function asVector3Array(value, fallback = [0, 0, 0]) {
    if (!Array.isArray(value) || value.length < 3) return [...fallback];
    return [
        clampNumber(value[0], fallback[0]),
        clampNumber(value[1], fallback[1]),
        clampNumber(value[2], fallback[2])
    ];
}

function normalizeMatchKey(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function readRootPositionPatch(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const x = Number(source.x);
    const y = Number(source.y);
    const z = Number(source.z);
    if (![x, y, z].every(Number.isFinite)) {
        return null;
    }

    const id = normalizeMatchKey(source.id ?? source.deviceId);
    const name = normalizeMatchKey(source.name ?? source.deviceName);
    if (!id && !name) {
        return null;
    }

    return { id, name, xyz: [x, y, z] };
}

function guessResourceTypeByUrl(url, fallback = 'model') {
    if (typeof url !== 'string') return fallback;
    const lower = url.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
        return 'image';
    }
    return 'model';
}

function degreesToRadians3(degArr) {
    const degreeValues = asVector3Array(degArr, [0, 0, 0]);
    return degreeValues.map((item) => THREE.MathUtils.degToRad(item));
}

function deepMergeConfig(target, source) {
    const base = target && typeof target === 'object' ? target : {};
    const patch = source && typeof source === 'object' ? source : {};
    const result = { ...base };

    for (const key of Object.keys(patch)) {
        const value = patch[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = deepMergeConfig(base[key] || {}, value);
        } else {
            result[key] = value;
        }
    }

    return result;
}

export class TrafficRoadsideDeviceManager extends Component {
    static defaultConfig = {
        coordinateSystem: {
            mode: 'xyz',
            originLngLatAlt: [0, 0, 0],
            axis: 'xEast_yUp_zNorth',
            fitting: {
                method: 'none',
                controlPoints: []
            }
        },
        devices: [],
        dracoDecoderPath: '/draco/',
        imageSize: 2,
        modelFitBoxSize: 5
    };

    onCreate() {
        this._deviceGroups = new Map();
        this._modelLoader = null;
        this._textureLoader = new THREE.TextureLoader();
        this._gltfCache = new Map();
        this._textureCache = new Map();
        this._disposedResources = {
            geometry: new WeakSet(),
            material: new WeakSet(),
            texture: new WeakSet()
        };
        this._coordinateTransformer = createTrafficGeoCoordinateTransformer(
            normalizeTrafficCoordinateSystemConfig(this.config?.coordinateSystem || {})
        );
    }

    async onMounted() {
        this._initLoaders();
        await this._rebuildAll();
        this.emit('mounted');
    }

    async updateConfig(newConfig = {}) {
        this.config = deepMergeConfig(this.config || {}, newConfig || {});
        this._coordinateTransformer = createTrafficGeoCoordinateTransformer(
            normalizeTrafficCoordinateSystemConfig(this.config.coordinateSystem || {})
        );

        await this._reconcileAll();
        this.emit('config-updated', { changed: Object.keys(newConfig || {}) });
    }

    async updateData(data, options = {}) {
        const field = typeof options.field === 'string' && options.field.trim()
            ? options.field.trim()
            : 'devices';
        if (field === 'devices' && this._isPositionPatchList(data)) {
            return this.updateDevicePositions(data);
        }
        await this.updateConfig({
            [field]: Array.isArray(data) ? data : []
        });
    }

    async updateDevicePositions(data) {
        const patches = Array.isArray(data)
            ? data.map(readRootPositionPatch).filter(Boolean)
            : [];
        if (!patches.length) {
            return { updated: 0, unmatched: [] };
        }

        const currentDevices = Array.isArray(this.config?.devices) ? this.config.devices : [];
        const idIndexMap = new Map();
        const nameIndexMap = new Map();
        currentDevices.forEach((device, index) => {
            const id = normalizeMatchKey(device?.id);
            const name = normalizeMatchKey(device?.name);
            if (id && !idIndexMap.has(id)) idIndexMap.set(id, index);
            if (name && !nameIndexMap.has(name)) nameIndexMap.set(name, index);
        });

        const nextDevices = currentDevices.map((device) => ({ ...device }));
        const updatedIndexes = new Set();
        const unmatched = [];

        patches.forEach((patch) => {
            let index = patch.id ? idIndexMap.get(patch.id) : undefined;
            if (index === undefined && patch.name) {
                index = nameIndexMap.get(patch.name);
            }

            if (index === undefined) {
                unmatched.push({ id: patch.id, name: patch.name });
                return;
            }

            nextDevices[index] = this._mergeDevicePositionPatch(nextDevices[index], patch);
            updatedIndexes.add(index);
        });

        if (updatedIndexes.size > 0) {
            await this.updateConfig({ devices: nextDevices });
        }

        const result = {
            updated: updatedIndexes.size,
            unmatched
        };
        this.emit('device-positions-updated', result);
        return result;
    }

    getDeviceObject(deviceId) {
        return this._deviceGroups.get(deviceId) || null;
    }

    getDeviceIdFromObject(object) {
        let current = object;
        while (current) {
            const deviceId = current?.userData?.[DEVICE_ID_KEY];
            if (deviceId) return deviceId;
            current = current.parent;
        }
        return null;
    }

    _initLoaders() {
        if (this._modelLoader) return;

        const loaderManager = this.scene?.loaderManager;
        if (!loaderManager || typeof loaderManager.getModelLoader !== 'function') {
            throw new Error('[TrafficRoadsideDeviceManager] scene.loaderManager.getModelLoader is not available');
        }

        this._modelLoader = loaderManager.getModelLoader();

        if (this.config?.dracoDecoderPath) {
            if (typeof loaderManager.setDracoDecoderPath === 'function') {
                loaderManager.setDracoDecoderPath(this.config.dracoDecoderPath);
            }
            if (typeof this._modelLoader.setDracoDecoderPath === 'function') {
                this._modelLoader.setDracoDecoderPath(this.config.dracoDecoderPath);
            }
        }
    }

    _normalizeDevices(devices) {
        const list = Array.isArray(devices) ? devices : [];
        return list.map((raw, index) => {
            const source = raw && typeof raw === 'object' ? raw : {};
            const id = typeof source.id === 'string' && source.id.trim()
                ? source.id.trim()
                : `device_${Date.now()}_${index}`;
            const resourceUrl = typeof source.resourceUrl === 'string'
                ? source.resourceUrl
                : (typeof source.url === 'string' ? source.url : '');
            const resourceType = source.resourceType || guessResourceTypeByUrl(resourceUrl);

            return {
                ...DEFAULT_DEVICE,
                ...source,
                id,
                name: typeof source.name === 'string' ? source.name : '',
                type: typeof source.type === 'string' && source.type ? source.type : 'pole',
                parentId: source.parentId || null,
                xyz: asVector3Array(source.xyz ?? source.position ?? DEFAULT_DEVICE.xyz, DEFAULT_DEVICE.xyz),
                rotation: asVector3Array(source.rotation ?? DEFAULT_DEVICE.rotation, DEFAULT_DEVICE.rotation),
                scale: clampNumber(source.scale, DEFAULT_DEVICE.scale),
                lngLat: Array.isArray(source.lngLat) && source.lngLat.length >= 2
                    ? [clampNumber(source.lngLat[0]), clampNumber(source.lngLat[1])]
                    : null,
                alt: clampNumber(source.alt, 0),
                resourceType,
                resourceUrl
            };
        });
    }

    _isPositionPatchList(data) {
        return Array.isArray(data) && data.length > 0 && data.every((item) => !!readRootPositionPatch(item));
    }

    _mergeDevicePositionPatch(device, patch) {
        const nextDevice = {
            ...(device || {}),
            xyz: [...patch.xyz]
        };

        if ((this.config?.coordinateSystem?.mode || 'xyz') === 'geo' && this._coordinateTransformer?.modelToGeo) {
            const geo = this._coordinateTransformer.modelToGeo(patch.xyz);
            nextDevice.lngLat = [clampNumber(geo?.[0], 0), clampNumber(geo?.[1], 0)];
            nextDevice.alt = clampNumber(geo?.[2], 0);
        }

        return nextDevice;
    }

    _computeDeviceWorldPosition(device) {
        const mode = this.config.coordinateSystem?.mode || 'xyz';
        if (mode === 'xyz') {
            return asVector3Array(device.xyz, [0, 0, 0]);
        }

        if (device.lngLat && device.lngLat.length >= 2) {
            const lng = clampNumber(device.lngLat[0]);
            const lat = clampNumber(device.lngLat[1]);
            const alt = clampNumber(device.alt, 0);
            return this._coordinateTransformer.geoToModel([lng, lat, alt]);
        }

        return asVector3Array(device.xyz, [0, 0, 0]);
    }

    _tagDevicePicking(group, deviceId) {
        group.traverse((object) => {
            if (!object.userData) object.userData = {};
            object.userData[DEVICE_ID_KEY] = deviceId;
        });
    }

    async _loadGltf(url) {
        if (!url) return null;
        if (this._gltfCache.has(url)) return this._gltfCache.get(url);

        if (!this._modelLoader) {
            this._initLoaders();
        }

        const promise = Promise.resolve().then(() => this._modelLoader.load(url));
        this._gltfCache.set(url, promise);
        return promise;
    }

    async _loadTexture(url) {
        if (!url) return null;
        if (this._textureCache.has(url)) return this._textureCache.get(url);

        const promise = new Promise((resolve, reject) => {
            this._textureLoader.load(
                url,
                (texture) => resolve(texture),
                undefined,
                (error) => reject(error)
            );
        });

        this._textureCache.set(url, promise);
        return promise;
    }

    _clearGroup(group) {
        if (!group) return;

        group.traverse((object) => {
            if (object.isMesh) {
                const geometry = object.geometry;
                if (geometry && !this._disposedResources.geometry.has(geometry)) {
                    this._disposedResources.geometry.add(geometry);
                    geometry.dispose?.();
                }

                if (Array.isArray(object.material)) {
                    object.material.forEach((material) => this._disposeMaterial(material));
                } else {
                    this._disposeMaterial(object.material);
                }
            }

            if (object.isSprite) {
                this._disposeMaterial(object.material);
            }
        });

        group.clear();
    }

    _disposeMaterial(material) {
        if (!material || this._disposedResources.material.has(material)) return;
        this._disposedResources.material.add(material);
        material.dispose?.();
    }

    async _createDeviceVisual(device) {
        const group = new THREE.Group();
        group.name = device.name || device.id;

        if (!group.userData) group.userData = {};
        group.userData.__resourceUrl = device.resourceUrl || '';
        group.userData.__resourceType = device.resourceType || guessResourceTypeByUrl(device.resourceUrl);

        const position = this._computeDeviceWorldPosition(device);
        group.position.set(position[0], position[1], position[2]);

        const rotation = degreesToRadians3(device.rotation);
        group.rotation.set(rotation[0], rotation[1], rotation[2]);

        const scale = clampNumber(device.scale, 1);
        group.scale.setScalar(scale);

        const url = device.resourceUrl;
        const resourceType = device.resourceType || guessResourceTypeByUrl(url);

        if (!url) {
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = 'placeholder';
            group.add(mesh);
        } else if (resourceType === 'image') {
            try {
                const texture = await this._loadTexture(url);
                if (texture) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
                    const sprite = new THREE.Sprite(material);
                    sprite.name = 'image';
                    const size = clampNumber(this.config.imageSize, 2);
                    sprite.scale.set(size, size, 1);
                    group.add(sprite);
                }
            } catch (error) {
                console.warn('[TrafficRoadsideDeviceManager] Failed to load image:', url, error);
            }
        } else {
            try {
                const gltf = await this._loadGltf(url);
                if (gltf?.scene) {
                    const scene = gltf.scene.clone(true);
                    scene.traverse((object) => {
                        if (!object.isMesh) return;
                        if (object.geometry) object.geometry = object.geometry.clone();
                        if (Array.isArray(object.material)) {
                            object.material = object.material.map((material) => (material ? material.clone() : material));
                        } else if (object.material) {
                            object.material = object.material.clone();
                        }
                    });

                    const boxSize = clampNumber(this.config.modelFitBoxSize, 5);
                    if (boxSize > 0) {
                        const bounds = new THREE.Box3().setFromObject(scene);
                        const size = new THREE.Vector3();
                        bounds.getSize(size);
                        const maxDimension = Math.max(size.x, size.y, size.z);
                        if (Number.isFinite(maxDimension) && maxDimension > 0) {
                            scene.scale.multiplyScalar(boxSize / maxDimension);
                        }
                    }

                    scene.name = 'model';
                    group.add(scene);
                }
            } catch (error) {
                console.warn('[TrafficRoadsideDeviceManager] Failed to load model:', url, error);
            }
        }

        this._tagDevicePicking(group, device.id);
        return group;
    }

    _linkMountedDevices(normalizedDevices) {
        const deviceMap = new Map(normalizedDevices.map((device) => [device.id, device]));

        for (const device of normalizedDevices) {
            if (!device.parentId || !deviceMap.has(device.parentId)) continue;

            const childGroup = this._deviceGroups.get(device.id);
            const parentGroup = this._deviceGroups.get(device.parentId);
            if (!childGroup || !parentGroup) continue;

            try {
                parentGroup.attach(childGroup);
            } catch {
                parentGroup.add(childGroup);
            }
        }
    }

    async _rebuildAll() {
        for (const group of this._deviceGroups.values()) {
            try {
                if (group.parent) group.parent.remove(group);
            } catch {
                // ignore
            }
            this._clearGroup(group);
        }

        this._deviceGroups.clear();
        await this._reconcileAll();
    }

    async _reconcileAll() {
        this._coordinateTransformer = createTrafficGeoCoordinateTransformer(
            normalizeTrafficCoordinateSystemConfig(this.config.coordinateSystem || {})
        );

        const devices = this._normalizeDevices(this.config.devices);
        const nextIds = new Set(devices.map((device) => device.id));

        for (const [deviceId, group] of this._deviceGroups.entries()) {
            if (nextIds.has(deviceId)) continue;
            try {
                if (group.parent) group.parent.remove(group);
            } catch {
                // ignore
            }
            this._clearGroup(group);
            this._deviceGroups.delete(deviceId);
        }

        for (const device of devices) {
            const existing = this._deviceGroups.get(device.id);
            if (!existing) {
                const group = await this._createDeviceVisual(device);
                this._deviceGroups.set(device.id, group);
                this.componentScene.add(group);
                this.emit('device-added', { device });
                continue;
            }

            const position = this._computeDeviceWorldPosition(device);
            existing.position.set(position[0], position[1], position[2]);

            const rotation = degreesToRadians3(device.rotation);
            existing.rotation.set(rotation[0], rotation[1], rotation[2]);

            const scale = clampNumber(device.scale, 1);
            existing.scale.setScalar(scale);

            const url = device.resourceUrl;
            const resourceType = device.resourceType || guessResourceTypeByUrl(url);
            const oldUrl = existing.userData?.__resourceUrl;
            const oldType = existing.userData?.__resourceType;

            if (oldUrl !== url || oldType !== resourceType) {
                this._clearGroup(existing);
                const rebuilt = await this._createDeviceVisual(device);
                const children = [...rebuilt.children];
                children.forEach((child) => existing.add(child));

                existing.userData = {
                    ...(existing.userData || {}),
                    __resourceUrl: url,
                    __resourceType: resourceType
                };

                this.emit('device-updated', { device, changed: ['resource'] });
            } else {
                this.emit('device-updated', { device, changed: ['transform'] });
            }
        }

        this._linkMountedDevices(devices);
    }

    onDispose() {
        for (const group of this._deviceGroups.values()) {
            try {
                if (group.parent) group.parent.remove(group);
            } catch {
                // ignore
            }
            this._clearGroup(group);
        }

        this._deviceGroups.clear();
        this._gltfCache.clear();

        for (const texturePromise of this._textureCache.values()) {
            try {
                Promise.resolve(texturePromise).then((texture) => {
                    if (texture && !this._disposedResources.texture.has(texture)) {
                        this._disposedResources.texture.add(texture);
                        texture.dispose?.();
                    }
                });
            } catch {
                // ignore
            }
        }

        this._textureCache.clear();
        this._modelLoader = null;
        this._textureLoader = null;
    }
}

export default TrafficRoadsideDeviceManager;
