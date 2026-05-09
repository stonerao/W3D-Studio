import { Component } from '@w3d/core';
import * as THREE from 'three';

const IMAGE_TYPE = 'image';
const MODEL_TYPE = 'model';
const DEVICE_ID_KEY = '__w3dPointTypeMarkerPointId';

const DEFAULT_TYPE = Object.freeze({
    id: 'default',
    name: 'Default',
    resourceType: IMAGE_TYPE,
    resourceUrl: '',
    color: '#07a6ff',
    size: 2,
    scale: 1,
    offset: [0, 0, 0],
    visible: true
});

const DEFAULT_STATE_STYLES = Object.freeze({
    normal: {
        color: null,
        scaleMultiplier: 1,
        opacity: 1,
        offset: [0, 0, 0]
    },
    hover: {
        color: '#1d4ed8',
        scaleMultiplier: 1.1,
        opacity: 1,
        offset: [0, 0, 0]
    },
    click: {
        color: '#ef4444',
        scaleMultiplier: 1.2,
        opacity: 1,
        offset: [0, 0, 0]
    },
    highlight: {
        color: '#facc15',
        scaleMultiplier: 1.25,
        opacity: 1,
        offset: [0, 0, 0]
    }
});

const DEFAULT_DATA_MAPPING = Object.freeze({
    enabled: false,
    template: 'separate', // separate | list | grouped
    paths: {
        types: 'types',
        points: 'points',
        list: 'list',
        groupedPoints: 'points'
    },
    typeFields: {
        id: 'id',
        name: 'name',
        resourceType: 'resourceType',
        resourceUrl: 'resourceUrl',
        color: 'color',
        size: 'size',
        scale: 'scale',
        offset: 'offset',
        visible: 'visible'
    },
    pointFields: {
        id: 'id',
        name: 'name',
        typeId: 'typeId',
        position: 'position',
        x: 'x',
        y: 'y',
        z: 'z',
        scale: 'scale',
        offset: 'offset',
        color: 'color',
        visible: 'visible',
        data: 'data'
    }
});

function clampNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function hasValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
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

function getByPath(source, path, fallback = undefined) {
    if (!path) return source === undefined ? fallback : source;
    const keys = String(path).split('.').filter(Boolean);
    let current = source;
    for (const key of keys) {
        if (current === null || current === undefined) return fallback;
        current = current[key];
    }
    return current === undefined ? fallback : current;
}

function pickMappedValue(source, path, fallback = undefined) {
    if (!path) return fallback;
    const value = getByPath(source, path, undefined);
    return value === undefined ? fallback : value;
}

function normalizeColorValue(value, fallback = '#07a6ff') {
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    return text || fallback;
}

function clamp01(value, fallback = 1) {
    const n = clampNumber(value, fallback);
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

function parseHexColor(value, fallbackHex = 0x07a6ff) {
    try {
        const color = new THREE.Color(value || fallbackHex);
        return color.getHex();
    } catch {
        return fallbackHex;
    }
}

function normalizeType(raw = {}, index = 0) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = String(source.id || `type_${index + 1}`).trim() || `type_${index + 1}`;
    const resourceType = source.resourceType === MODEL_TYPE ? MODEL_TYPE : IMAGE_TYPE;
    return {
        ...DEFAULT_TYPE,
        ...source,
        id,
        name: String(source.name || `Type ${index + 1}`),
        resourceType,
        resourceUrl: typeof source.resourceUrl === 'string' ? source.resourceUrl.trim() : '',
        color: normalizeColorValue(source.color, DEFAULT_TYPE.color),
        size: clampNumber(source.size, 2),
        scale: clampNumber(source.scale, 1),
        offset: ensureVector3(source.offset, [0, 0, 0]),
        visible: source.visible !== false
    };
}

function normalizePoint(raw = {}, index = 0, fallbackTypeId = DEFAULT_TYPE.id) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = String(source.id || `point_${index + 1}`).trim() || `point_${index + 1}`;
    const hasScale = hasValue(source.scale);
    return {
        ...source,
        id,
        name: String(source.name || `Point ${index + 1}`),
        typeId: String(source.typeId || fallbackTypeId).trim() || fallbackTypeId,
        position: ensureVector3(source.position, [0, 0, 0]),
        scale: hasScale ? clampNumber(source.scale, 1) : null,
        offset: source.offset === undefined ? null : ensureVector3(source.offset, [0, 0, 0]),
        color: source.color ? normalizeColorValue(source.color, DEFAULT_TYPE.color) : null,
        visible: source.visible !== false,
        data: source.data && typeof source.data === 'object' ? source.data : {}
    };
}

function normalizeStateStyle(style, fallback) {
    const source = style && typeof style === 'object' ? style : {};
    return {
        color: source.color === undefined || source.color === null
            ? fallback.color
            : normalizeColorValue(source.color, fallback.color || DEFAULT_TYPE.color),
        scaleMultiplier: clampNumber(source.scaleMultiplier, fallback.scaleMultiplier),
        opacity: clampNumber(source.opacity, fallback.opacity),
        offset: ensureVector3(source.offset, fallback.offset)
    };
}

function deepMerge(target, source) {
    const base = target && typeof target === 'object' ? target : {};
    const patch = source && typeof source === 'object' ? source : {};
    const result = { ...base };
    Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = deepMerge(base[key] || {}, value);
            return;
        }
        result[key] = value;
    });
    return result;
}

/**
 * Marker module component that manages typed point markers and shared marker rendering rules.
 */
export class PointTypeMarkerManager extends Component {
    static defaultConfig = {
        types: [{ ...DEFAULT_TYPE }],
        points: [],
        stateStyles: { ...DEFAULT_STATE_STYLES },
        typeStateStyles: {},
        dataMapping: { ...DEFAULT_DATA_MAPPING },
        dataSnapshot: null,
        maxPoints: 1000,
        imageSize: 1,
        imageTintEnabled: false,
        modelFitSize: 1,
        imageBillboard: true,
        enableInteraction: true
    };

    static methodDefinitions = [
        {
            name: 'getAllPoints',
            title: '获取全部点位',
            description: '返回当前组件内所有点位数据',
            params: []
        },
        {
            name: 'setAllVisible',
            title: '设置全部点位显隐',
            description: '统一设置所有点位的显示或隐藏状态',
            params: [
                {
                    name: 'visible',
                    title: '是否显示',
                    description: 'true 显示，false 隐藏',
                    type: 'boolean',
                    required: false,
                    defaultValue: true
                }
            ]
        },
        {
            name: 'setTypeVisible',
            title: '设置类型显隐',
            description: '设置指定类型点位的显示或隐藏状态',
            params: [
                {
                    name: 'typeId',
                    title: '类型ID',
                    description: '目标类型的唯一标识',
                    type: 'string',
                    required: true
                },
                {
                    name: 'visible',
                    title: '是否显示',
                    description: 'true 显示，false 隐藏',
                    type: 'boolean',
                    required: false,
                    defaultValue: true
                }
            ]
        },
        {
            name: 'updateTypePoints',
            title: '更新类型点位数据',
            description: '批量更新指定类型点位的 data 字段',
            params: [
                {
                    name: 'typeId',
                    title: '类型ID',
                    description: '目标类型的唯一标识',
                    type: 'string',
                    required: true
                },
                {
                    name: 'payload',
                    title: '更新数据',
                    description: '用于合并或替换的对象数据',
                    type: 'object',
                    required: true,
                    defaultValue: {}
                },
                {
                    name: 'options',
                    title: '更新选项',
                    description: 'mode=merge|replace，默认 merge',
                    type: 'object',
                    required: false,
                    defaultValue: { mode: 'merge' }
                }
            ]
        },
        {
            name: 'setPointState',
            title: '设置点位状态',
            description: '设置单个点位为 hover/click/highlight 状态',
            params: [
                {
                    name: 'pointId',
                    title: '点位ID',
                    description: '目标点位的唯一标识',
                    type: 'string',
                    required: true
                },
                {
                    name: 'state',
                    title: '状态名称',
                    description: '可选: hover / click / highlight',
                    type: 'string',
                    required: true
                },
                {
                    name: 'active',
                    title: '是否激活',
                    description: 'true 激活该状态，false 清除该状态',
                    type: 'boolean',
                    required: false,
                    defaultValue: true
                }
            ]
        },
        {
            name: 'clearPointState',
            title: '清除点位状态',
            description: '清除单个点位的 hover/click/highlight 状态',
            params: [
                {
                    name: 'pointId',
                    title: '点位ID',
                    description: '目标点位的唯一标识',
                    type: 'string',
                    required: true
                }
            ]
        },
        {
            name: 'clearAllStates',
            title: '清除全部状态',
            description: '清除所有点位的状态标记',
            params: []
        }
    ];

    onCreate() {
        this._modelCache = new Map();
        this._textureCache = new Map();
        this._batchMap = new Map();
        this._interactiveMeshes = [];
        this._typeMap = new Map();
        this._pointMap = new Map();
        this._highlightPointIds = new Set();
        this._clickedPointIds = new Set();
        this._hoverPointId = null;
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();
        this._matrix = new THREE.Matrix4();
        this._position = new THREE.Vector3();
        this._quaternion = new THREE.Quaternion();
        this._scale = new THREE.Vector3();
        this._color = new THREE.Color();
        this._imageGeometry = new THREE.PlaneGeometry(1, 1);
        this._textureLoader = new THREE.TextureLoader();
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerClick = this._handlePointerClick.bind(this);
    }

    async onMounted() {
        await this._rebuildAll();
        this._bindCanvasEvents();
    }

    async updateConfig(newConfig = {}) {
        this.config = deepMerge(this.config || {}, newConfig || {});
        if (
            Object.prototype.hasOwnProperty.call(newConfig || {}, 'dataSnapshot') &&
            this.config?.dataMapping?.enabled
        ) {
            const mapped = this._mapDataSnapshot(this.config.dataSnapshot);
            if (mapped.types) this.config.types = mapped.types;
            if (mapped.points) this.config.points = mapped.points;
        }
        await this._rebuildAll();
    }

    async updateData(data, options = {}) {
        const patch = options && typeof options === 'object' && options.config && typeof options.config === 'object'
            ? { ...options.config }
            : {};

        const source = data && typeof data === 'object' ? data : null;
        const mode = String(options?.mode || source?.mode || '').toLowerCase();

        if (mode === 'snapshot' || Object.prototype.hasOwnProperty.call(source || {}, 'dataSnapshot')) {
            patch.dataSnapshot = source?.dataSnapshot ?? source ?? null;
            await this.updateConfig(patch);
            return { success: true, mode: 'snapshot' };
        }

        if (Array.isArray(data)) {
            patch.points = data;
        } else if (source) {
            if (Array.isArray(source.types)) patch.types = source.types;
            if (Array.isArray(source.points)) patch.points = source.points;
            if (source.dataMapping && typeof source.dataMapping === 'object') patch.dataMapping = source.dataMapping;
        } else {
            patch.points = [];
        }

        await this.updateConfig(patch);
        return {
            success: true,
            mode: 'direct',
            typeCount: Array.isArray(patch.types) ? patch.types.length : undefined,
            pointCount: Array.isArray(patch.points) ? patch.points.length : undefined
        };
    }

    onUpdate() {
        if (!this.config.imageBillboard) return;
        if (!this.scene?.camera?.instance) return;

        let changed = false;
        const cameraQuaternion = this.scene.camera.instance.quaternion;
        this._batchMap.forEach((batch) => {
            if (batch.kind !== IMAGE_TYPE) return;
            changed = this._refreshImageBatchMatrices(batch, cameraQuaternion) || changed;
        });

        if (changed) {
            this.emit('updated');
        }
    }

    onDispose() {
        this._unbindCanvasEvents();
        this._disposeBatches();
        this._modelCache.clear();
        this._textureCache.clear();
        this._pointMap.clear();
        this._typeMap.clear();
        this._highlightPointIds.clear();
        this._clickedPointIds.clear();
        this._hoverPointId = null;
        this._imageGeometry.dispose();
    }

    getInteractiveObjects() {
        return [...this._interactiveMeshes];
    }

    raycast(event) {
        const intersections = this._intersectInstances(event);
        return intersections.map((hit) => {
            const pointId = this._resolvePointIdFromIntersection(hit);
            return {
                object: hit.object,
                point: hit.point,
                distance: hit.distance,
                instanceId: hit.instanceId,
                pointId
            };
        });
    }

    getAllPoints() {
        return Array.from(this._pointMap.values()).map((point) => ({
            ...point,
            position: [...point.position]
        }));
    }

    async setAllVisible(visible = true) {
        const points = Array.isArray(this.config?.points) ? this.config.points : [];
        if (!points.length) {
            return { success: true, affectedCount: 0 };
        }

        const nextVisible = visible !== false;
        let affectedCount = 0;
        const nextPoints = points.map((point) => {
            const source = point && typeof point === 'object' ? point : {};
            const currentVisible = source.visible !== false;
            if (currentVisible !== nextVisible) {
                affectedCount += 1;
            }
            return {
                ...source,
                visible: nextVisible
            };
        });

        this.config.points = nextPoints;
        await this._rebuildAll();
        return { success: true, affectedCount };
    }

    async setTypeVisible(typeId, visible = true) {
        const tid = String(typeId || '').trim();
        if (!tid) {
            return { success: false, affectedCount: 0, message: 'typeId is required' };
        }

        const types = Array.isArray(this.config?.types) ? this.config.types : [];
        const targetType = types.find((type) => String(type?.id || '').trim() === tid);
        if (!targetType) {
            return { success: false, affectedCount: 0, message: `type not found: ${tid}` };
        }

        const nextVisible = visible !== false;
        let changed = false;
        const nextTypes = types.map((type) => {
            const currentId = String(type?.id || '').trim();
            if (currentId !== tid) return type;
            const source = type && typeof type === 'object' ? type : {};
            const currentVisible = source.visible !== false;
            changed = currentVisible !== nextVisible;
            return {
                ...source,
                visible: nextVisible
            };
        });

        const points = Array.isArray(this.config?.points) ? this.config.points : [];
        const affectedCount = points.filter((point) => String(point?.typeId || '').trim() === tid).length;

        this.config.types = nextTypes;
        if (changed || affectedCount > 0) {
            await this._rebuildAll();
        }

        return { success: true, typeId: tid, affectedCount };
    }

    async updateTypePoints(typeId, payload = {}, options = {}) {
        const tid = String(typeId || '').trim();
        if (!tid) {
            return { success: false, affectedCount: 0, message: 'typeId is required' };
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return { success: false, affectedCount: 0, message: 'payload must be an object' };
        }

        const types = Array.isArray(this.config?.types) ? this.config.types : [];
        const hasType = types.some((type) => String(type?.id || '').trim() === tid);
        if (!hasType) {
            return { success: false, affectedCount: 0, message: `type not found: ${tid}` };
        }

        const points = Array.isArray(this.config?.points) ? this.config.points : [];
        const mode = options?.mode === 'replace' ? 'replace' : 'merge';
        let affectedCount = 0;
        const nextPoints = points.map((point) => {
            const source = point && typeof point === 'object' ? point : {};
            if (String(source.typeId || '').trim() !== tid) {
                return source;
            }
            affectedCount += 1;
            const currentData = source.data && typeof source.data === 'object' && !Array.isArray(source.data)
                ? source.data
                : {};
            const nextData = mode === 'replace' ? { ...payload } : deepMerge(currentData, payload);
            return {
                ...source,
                data: nextData
            };
        });

        this.config.points = nextPoints;
        if (affectedCount > 0) {
            await this._rebuildAll();
        }
        return { success: true, typeId: tid, affectedCount, mode };
    }

    setPointState(pointId, state, active = true) {
        if (!pointId || !state) return false;
        const pid = String(pointId);
        if (!this._pointMap.has(pid)) return false;

        switch (state) {
        case 'hover':
            this._setHoverPoint(active ? pid : null);
            return true;
        case 'click':
            if (active) this._clickedPointIds.add(pid);
            else this._clickedPointIds.delete(pid);
            this._refreshPointVisual(pid);
            return true;
        case 'highlight':
            if (active) this._highlightPointIds.add(pid);
            else this._highlightPointIds.delete(pid);
            this._refreshPointVisual(pid);
            return true;
        default:
            return false;
        }
    }

    clearPointState(pointId) {
        if (!pointId) return false;
        const pid = String(pointId);
        this._clickedPointIds.delete(pid);
        this._highlightPointIds.delete(pid);
        if (this._hoverPointId === pid) {
            this._hoverPointId = null;
        }
        this._refreshPointVisual(pid);
        return true;
    }

    clearAllStates() {
        this._clickedPointIds.clear();
        this._highlightPointIds.clear();
        this._hoverPointId = null;
        this._refreshAllVisuals();
    }

    async _rebuildAll() {
        this._disposeBatches();
        this._typeMap.clear();
        this._pointMap.clear();
        this._interactiveMeshes = [];
        this._highlightPointIds.clear();
        this._clickedPointIds.clear();
        this._hoverPointId = null;

        const normalizedTypes = this._normalizeTypes(this.config.types);
        normalizedTypes.forEach((type) => this._typeMap.set(type.id, type));

        const normalizedPoints = this._normalizePoints(this.config.points, normalizedTypes[0]?.id || DEFAULT_TYPE.id);
        normalizedPoints.forEach((point) => this._pointMap.set(point.id, point));

        const groups = this._groupPointsByBatch(normalizedPoints);
        for (const [batchKey, group] of groups) {
            const batch = await this._createBatch(batchKey, group.type, group.points);
            if (!batch) continue;
            this._batchMap.set(batchKey, batch);
        }

        this._refreshAllVisuals();
        this.emit('rebuild', { pointCount: this._pointMap.size, typeCount: this._typeMap.size });
    }

    _normalizeTypes(rawTypes) {
        const source = Array.isArray(rawTypes) && rawTypes.length > 0 ? rawTypes : [DEFAULT_TYPE];
        const types = source.map((item, index) => normalizeType(item, index));
        const idSet = new Set();
        return types.map((item, index) => {
            if (!idSet.has(item.id)) {
                idSet.add(item.id);
                return item;
            }
            const next = {
                ...item,
                id: `${item.id}_${index + 1}`
            };
            idSet.add(next.id);
            return next;
        });
    }

    _normalizePoints(rawPoints, fallbackTypeId) {
        const source = Array.isArray(rawPoints) ? rawPoints : [];
        const maxPoints = Math.max(0, Math.floor(clampNumber(this.config.maxPoints, 1000)));
        const limited = maxPoints > 0 ? source.slice(0, maxPoints) : [];
        return limited.map((item, index) => normalizePoint(item, index, fallbackTypeId));
    }

    _getDataMappingConfig() {
        const merged = deepMerge(DEFAULT_DATA_MAPPING, this.config.dataMapping || {});
        return {
            ...merged,
            template: ['separate', 'list', 'grouped'].includes(merged.template) ? merged.template : 'separate'
        };
    }

    _mapTypeItem(source, index = 0, fields = {}) {
        const raw = {
            id: pickMappedValue(source, fields.id, undefined),
            name: pickMappedValue(source, fields.name, undefined),
            resourceType: pickMappedValue(source, fields.resourceType, undefined),
            resourceUrl: pickMappedValue(source, fields.resourceUrl, undefined),
            color: pickMappedValue(source, fields.color, undefined),
            size: pickMappedValue(source, fields.size, undefined),
            scale: pickMappedValue(source, fields.scale, undefined),
            offset: pickMappedValue(source, fields.offset, undefined),
            visible: pickMappedValue(source, fields.visible, undefined)
        };
        return normalizeType(raw, index);
    }

    _mapPointItem(source, index = 0, fields = {}, fallbackTypeId = DEFAULT_TYPE.id) {
        const mappedPosition = pickMappedValue(source, fields.position, undefined);
        const x = pickMappedValue(source, fields.x, undefined);
        const y = pickMappedValue(source, fields.y, undefined);
        const z = pickMappedValue(source, fields.z, undefined);
        const position = mappedPosition !== undefined
            ? mappedPosition
            : [x ?? 0, y ?? 0, z ?? 0];

        const raw = {
            id: pickMappedValue(source, fields.id, undefined),
            name: pickMappedValue(source, fields.name, undefined),
            typeId: pickMappedValue(source, fields.typeId, fallbackTypeId),
            position,
            scale: pickMappedValue(source, fields.scale, undefined),
            offset: pickMappedValue(source, fields.offset, undefined),
            color: pickMappedValue(source, fields.color, undefined),
            visible: pickMappedValue(source, fields.visible, undefined),
            data: pickMappedValue(source, fields.data, source)
        };
        return normalizePoint(raw, index, fallbackTypeId);
    }

    _mapDataSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            return {};
        }

        const mapping = this._getDataMappingConfig();
        const next = {};

        if (mapping.template === 'list') {
            const list = getByPath(snapshot, mapping.paths.list, []);
            if (Array.isArray(list)) {
                const fallbackTypeId = this.config?.types?.[0]?.id || DEFAULT_TYPE.id;
                next.points = list.map((item, index) => (
                    this._mapPointItem(item, index, mapping.pointFields, fallbackTypeId)
                ));
            }
            return next;
        }

        if (mapping.template === 'grouped') {
            const sourceTypes = getByPath(snapshot, mapping.paths.types, []);
            if (Array.isArray(sourceTypes)) {
                const mappedTypes = sourceTypes.map((item, index) => (
                    this._mapTypeItem(item, index, mapping.typeFields)
                ));
                next.types = mappedTypes;

                const points = [];
                let globalPointIndex = 0;
                sourceTypes.forEach((typeItem, typeIndex) => {
                    const fallbackTypeId = mappedTypes[typeIndex]?.id || DEFAULT_TYPE.id;
                    const list = getByPath(typeItem, mapping.paths.groupedPoints, []);
                    if (!Array.isArray(list)) return;
                    list.forEach((pointItem) => {
                        points.push(this._mapPointItem(pointItem, globalPointIndex, mapping.pointFields, fallbackTypeId));
                        globalPointIndex += 1;
                    });
                });
                next.points = points;
            }
            return next;
        }

        // separate
        const sourceTypes = getByPath(snapshot, mapping.paths.types, []);
        const sourcePoints = getByPath(snapshot, mapping.paths.points, []);
        if (Array.isArray(sourceTypes)) {
            next.types = sourceTypes.map((item, index) => this._mapTypeItem(item, index, mapping.typeFields));
        }
        if (Array.isArray(sourcePoints)) {
            const fallbackTypeId = next.types?.[0]?.id || this.config?.types?.[0]?.id || DEFAULT_TYPE.id;
            next.points = sourcePoints.map((item, index) => (
                this._mapPointItem(item, index, mapping.pointFields, fallbackTypeId)
            ));
        }
        return next;
    }

    _groupPointsByBatch(points) {
        const groups = new Map();
        points.forEach((point) => {
            const type = this._typeMap.get(point.typeId) || this._typeMap.values().next().value || DEFAULT_TYPE;
            if (!type?.visible || !point.visible) return;
            const key = `${type.id}::${type.resourceType}::${type.resourceUrl || '__default__'}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    type,
                    points: []
                });
            }
            groups.get(key).points.push(point);
        });
        return groups;
    }

    async _createBatch(batchKey, type, points) {
        if (!type || !Array.isArray(points) || points.length === 0) return null;

        if (type.resourceType === MODEL_TYPE) {
            return this._createModelBatch(batchKey, type, points);
        }
        return this._createImageBatch(batchKey, type, points);
    }

    async _createImageBatch(batchKey, type, points) {
        const count = points.length;
        let map = null;
        if (type.resourceUrl) {
            map = await this._getTexture(type.resourceUrl);
        }
        const imageTintEnabled = this.config?.imageTintEnabled === true;

        const material = new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            vertexColors: imageTintEnabled,
            toneMapped: false,
            color: 0xffffff
        });
        this._applyInstancedOpacityMaterial(material);

        const geometry = this._imageGeometry.clone();
        const opacityAttribute = this._createInstanceOpacityAttribute(count);
        geometry.setAttribute('instanceOpacity', opacityAttribute);

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.name = `ptm_image_${type.id}`;
        mesh.userData.ptmBatchKey = batchKey;
        mesh.userData.eventEmitter = this.eventEmitter;

        this.componentScene.add(mesh);
        this._interactiveMeshes.push(mesh);

        const batch = {
            key: batchKey,
            kind: IMAGE_TYPE,
            type,
            points,
            mesh,
            entries: [{ mesh, localOffset: [0, 0, 0], localScale: [1, 1, 1], opacityAttribute }]
        };
        this._tagMeshPointIds(mesh, points);
        return batch;
    }

    async _createModelBatch(batchKey, type, points) {
        const meshes = await this._extractSourceMeshes(type.resourceUrl);
        if (!meshes.length) {
            return this._createImageBatch(batchKey, { ...type, resourceType: IMAGE_TYPE }, points);
        }

        const entries = [];
        points.forEach((point) => {
            point.__runtimeSource = type.resourceUrl || '__default_model__';
        });

        for (let i = 0; i < meshes.length; i += 1) {
            const source = meshes[i];
            const material = source.material.clone();
            material.vertexColors = true;
            material.transparent = material.transparent || true;
            this._applyInstancedOpacityMaterial(material);

            const geometry = source.geometry.clone();
            const opacityAttribute = this._createInstanceOpacityAttribute(points.length);
            geometry.setAttribute('instanceOpacity', opacityAttribute);

            const mesh = new THREE.InstancedMesh(geometry, material, points.length);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.name = `ptm_model_${type.id}_${i}`;
            mesh.userData.ptmBatchKey = batchKey;
            mesh.userData.eventEmitter = this.eventEmitter;
            this.componentScene.add(mesh);
            this._interactiveMeshes.push(mesh);
            this._tagMeshPointIds(mesh, points);
            entries.push({
                mesh,
                localOffset: source.localOffset || [0, 0, 0],
                localScale: source.localScale || [1, 1, 1],
                opacityAttribute
            });
        }

        return {
            key: batchKey,
            kind: MODEL_TYPE,
            type,
            points,
            mesh: entries[0]?.mesh || null,
            entries
        };
    }

    _tagMeshPointIds(mesh, points) {
        mesh.userData.__ptmPointIds = points.map((point) => point.id);
        mesh.userData[DEVICE_ID_KEY] = true;
    }

    async _extractSourceMeshes(url) {
        const cacheKey = url || '__default_model__';
        if (this._modelCache.has(cacheKey)) {
            return this._modelCache.get(cacheKey);
        }

        let loaded = null;
        try {
            const modelLoader = this.scene?.loaderManager?.getModelLoader?.();
            if (modelLoader && url) {
                loaded = await modelLoader.load(url);
            }
        } catch (error) {
            console.warn('[PointTypeMarkerManager] model load failed', url, error);
        }

        const sceneObject = loaded?.scene;
        if (!sceneObject) {
            this._modelCache.set(cacheKey, []);
            return [];
        }

        const bounds = new THREE.Box3().setFromObject(sceneObject);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const maxDimension = Math.max(size.x, size.y, size.z);
        const fitScale = maxDimension > 0
            ? clampNumber(this.config.modelFitSize, 1) / maxDimension
            : 1;

        const items = [];
        sceneObject.traverse((child) => {
            if (!child?.isMesh || !child.geometry || !child.material) return;
            items.push({
                geometry: child.geometry,
                material: Array.isArray(child.material) ? child.material[0] : child.material,
                localOffset: [child.position.x, child.position.y, child.position.z],
                localScale: [fitScale, fitScale, fitScale]
            });
        });

        this._modelCache.set(cacheKey, items);
        return items;
    }

    async _getTexture(url) {
        if (!url) return null;
        if (this._textureCache.has(url)) {
            return this._textureCache.get(url);
        }

        const texture = await new Promise((resolve) => {
            this._textureLoader.load(
                url,
                (t) => resolve(t),
                undefined,
                (error) => {
                    console.warn('[PointTypeMarkerManager] texture load failed', { url, error });
                    resolve(null);
                }
            );
        });

        if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            console.log('[PointTypeMarkerManager] texture loaded', {
                url,
                width: texture.image?.width || 0,
                height: texture.image?.height || 0
            });
        }
        this._textureCache.set(url, texture);
        return texture;
    }

    _getStateStyles(typeId = '') {
        const merged = deepMerge(DEFAULT_STATE_STYLES, this.config.stateStyles || {});
        const byType = this.config?.typeStateStyles && typeof this.config.typeStateStyles === 'object'
            ? this.config.typeStateStyles
            : {};
        const typePatch = typeId ? (byType[typeId] || {}) : {};
        const withType = deepMerge(merged, typePatch);
        return {
            normal: normalizeStateStyle(withType.normal, DEFAULT_STATE_STYLES.normal),
            hover: normalizeStateStyle(withType.hover, DEFAULT_STATE_STYLES.hover),
            click: normalizeStateStyle(withType.click, DEFAULT_STATE_STYLES.click),
            highlight: normalizeStateStyle(withType.highlight, DEFAULT_STATE_STYLES.highlight)
        };
    }

    _resolvePointState(pointId) {
        if (this._clickedPointIds.has(pointId)) return 'click';
        if (this._hoverPointId === pointId) return 'hover';
        if (this._highlightPointIds.has(pointId)) return 'highlight';
        return 'normal';
    }

    _refreshAllVisuals() {
        const cameraQuaternion = this.scene?.camera?.instance?.quaternion || null;
        this._batchMap.forEach((batch) => {
            if (batch.kind === IMAGE_TYPE) {
                this._refreshImageBatchMatrices(batch, cameraQuaternion);
            } else {
                this._refreshModelBatchMatrices(batch);
            }
            this._refreshBatchColors(batch);
        });
    }

    _refreshPointVisual(pointId) {
        this._batchMap.forEach((batch) => {
            const index = batch.points.findIndex((point) => point.id === pointId);
            if (index < 0) return;
            const cameraQuaternion = this.scene?.camera?.instance?.quaternion || null;
            if (batch.kind === IMAGE_TYPE) {
                this._refreshImageBatchInstance(batch, index, cameraQuaternion);
            } else {
                this._refreshModelBatchInstance(batch, index);
            }
            this._refreshBatchInstanceColor(batch, index);
        });
    }

    _refreshImageBatchMatrices(batch, cameraQuaternion = null) {
        let changed = false;
        for (let i = 0; i < batch.points.length; i += 1) {
            changed = this._refreshImageBatchInstance(batch, i, cameraQuaternion) || changed;
        }
        if (changed) {
            batch.mesh.instanceMatrix.needsUpdate = true;
        }
        return changed;
    }

    _refreshImageBatchInstance(batch, index, cameraQuaternion = null) {
        const point = batch.points[index];
        if (!point) return false;
        const type = batch.type || DEFAULT_TYPE;
        const styles = this._getStateStyles(type.id);
        const state = this._resolvePointState(point.id);
        const style = styles[state] || styles.normal;
        const defaultPointScale = hasValue(type?.size)
            ? clampNumber(type.size, 2)
            : clampNumber(type?.scale, 1);
        const baseScale = point.scale === null ? defaultPointScale : clampNumber(point.scale, defaultPointScale);
        const size = clampNumber(type.size, 2) * clampNumber(this.config.imageSize, 1);
        const scaleValue = baseScale * clampNumber(style.scaleMultiplier, 1);
        const baseOffset = point.offset ? ensureVector3(point.offset, [0, 0, 0]) : ensureVector3(type.offset, [0, 0, 0]);
        const stateOffset = ensureVector3(style.offset, [0, 0, 0]);
        const position = ensureVector3(point.position, [0, 0, 0]);

        this._position.set(
            position[0] + baseOffset[0] + stateOffset[0],
            position[1] + baseOffset[1] + stateOffset[1],
            position[2] + baseOffset[2] + stateOffset[2]
        );

        if (this.config.imageBillboard && cameraQuaternion) {
            this._quaternion.copy(cameraQuaternion);
        } else {
            this._quaternion.identity();
        }

        this._scale.set(size * scaleValue, size * scaleValue, 1);
        this._matrix.compose(this._position, this._quaternion, this._scale);
        batch.mesh.setMatrixAt(index, this._matrix);
        return true;
    }

    _refreshModelBatchMatrices(batch) {
        batch.entries.forEach((entry) => {
            for (let i = 0; i < batch.points.length; i += 1) {
                this._refreshModelBatchInstance(batch, i, entry);
            }
            entry.mesh.instanceMatrix.needsUpdate = true;
        });
    }

    _refreshModelBatchInstance(batch, index, forceEntry = null) {
        const point = batch.points[index];
        if (!point) return;
        const type = batch.type || DEFAULT_TYPE;
        const styles = this._getStateStyles(type.id);
        const state = this._resolvePointState(point.id);
        const style = styles[state] || styles.normal;

        const defaultPointScale = hasValue(type?.size)
            ? clampNumber(type.size, 2)
            : clampNumber(type?.scale, 1);
        const baseScale = point.scale === null ? defaultPointScale : clampNumber(point.scale, defaultPointScale);
        const stateScale = clampNumber(style.scaleMultiplier, 1);
        const position = ensureVector3(point.position, [0, 0, 0]);
        const baseOffset = point.offset ? ensureVector3(point.offset, [0, 0, 0]) : ensureVector3(type.offset, [0, 0, 0]);
        const stateOffset = ensureVector3(style.offset, [0, 0, 0]);

        const entries = forceEntry ? [forceEntry] : batch.entries;
        entries.forEach((entry) => {
            const localOffset = ensureVector3(entry.localOffset, [0, 0, 0]);
            const localScale = ensureVector3(entry.localScale, [1, 1, 1]);
            this._position.set(
                position[0] + baseOffset[0] + stateOffset[0] + localOffset[0] * baseScale * stateScale,
                position[1] + baseOffset[1] + stateOffset[1] + localOffset[1] * baseScale * stateScale,
                position[2] + baseOffset[2] + stateOffset[2] + localOffset[2] * baseScale * stateScale
            );
            this._quaternion.identity();
            this._scale.set(
                localScale[0] * baseScale * stateScale,
                localScale[1] * baseScale * stateScale,
                localScale[2] * baseScale * stateScale
            );
            this._matrix.compose(this._position, this._quaternion, this._scale);
            entry.mesh.setMatrixAt(index, this._matrix);
        });
    }

    _refreshBatchColors(batch) {
        for (let i = 0; i < batch.points.length; i += 1) {
            this._refreshBatchInstanceColor(batch, i);
        }
    }

    _refreshBatchInstanceColor(batch, index) {
        const point = batch.points[index];
        if (!point) return;
        const type = batch.type || DEFAULT_TYPE;
        const styles = this._getStateStyles(type.id);
        const state = this._resolvePointState(point.id);
        const style = styles[state] || styles.normal;
        const imageTintEnabled = this.config?.imageTintEnabled === true;
        if (batch.kind === IMAGE_TYPE && !imageTintEnabled) {
            const entries = batch.entries || [];
            entries.forEach((entry) => {
                if (entry.opacityAttribute) {
                    entry.opacityAttribute.setX(index, clamp01(style.opacity, 1));
                    entry.opacityAttribute.needsUpdate = true;
                }
            });
            return;
        }
        const colorValue = batch.kind === IMAGE_TYPE && !imageTintEnabled
            ? '#ffffff'
            : (style.color || point.color || type.color || DEFAULT_TYPE.color);
        const colorHex = parseHexColor(colorValue, parseHexColor(DEFAULT_TYPE.color, 0x07a6ff));
        const opacity = clamp01(style.opacity, 1);
        this._color.setHex(colorHex);

        const entries = batch.entries || [];
        entries.forEach((entry) => {
            entry.mesh.setColorAt(index, this._color);
            if (entry.mesh.instanceColor) {
                entry.mesh.instanceColor.needsUpdate = true;
            }
            if (entry.opacityAttribute) {
                entry.opacityAttribute.setX(index, opacity);
                entry.opacityAttribute.needsUpdate = true;
            }
        });
    }

    _createInstanceOpacityAttribute(count) {
        const safeCount = Math.max(0, Math.floor(clampNumber(count, 0)));
        const attr = new THREE.InstancedBufferAttribute(new Float32Array(safeCount), 1);
        for (let i = 0; i < safeCount; i += 1) {
            attr.setX(i, 1);
        }
        attr.needsUpdate = true;
        return attr;
    }

    _applyInstancedOpacityMaterial(material) {
        if (!material) return;
        if (material.userData?.__ptmInstancedOpacityPatched) return;

        material.transparent = true;
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader
                .replace(
                    '#include <common>',
                    '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;'
                )
                .replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;'
                );

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    '#include <common>',
                    '#include <common>\nvarying float vInstanceOpacity;'
                )
                .replace(
                    '#include <dithering_fragment>',
                    'gl_FragColor.a *= clamp(vInstanceOpacity, 0.0, 1.0);\n#include <dithering_fragment>'
                );
        };
        material.userData = {
            ...(material.userData || {}),
            __ptmInstancedOpacityPatched: true
        };
        material.needsUpdate = true;
    }

    _disposeBatches() {
        this._batchMap.forEach((batch) => {
            (batch.entries || []).forEach((entry) => {
                const mesh = entry.mesh;
                if (mesh?.parent) {
                    mesh.parent.remove(mesh);
                }
                mesh?.geometry?.dispose?.();
                if (Array.isArray(mesh?.material)) {
                    mesh.material.forEach((material) => material?.dispose?.());
                } else {
                    mesh?.material?.dispose?.();
                }
            });
        });
        this._batchMap.clear();
        this._interactiveMeshes = [];
    }

    _bindCanvasEvents() {
        const canvas = this.scene?.renderer?.instance?.domElement;
        if (!canvas) return;
        canvas.addEventListener('mousemove', this._onPointerMove);
        canvas.addEventListener('click', this._onPointerClick);
    }

    _unbindCanvasEvents() {
        const canvas = this.scene?.renderer?.instance?.domElement;
        if (!canvas) return;
        canvas.removeEventListener('mousemove', this._onPointerMove);
        canvas.removeEventListener('click', this._onPointerClick);
    }

    _handlePointerMove(event) {
        if (!this.config.enableInteraction) return;
        if (this.scene?.eventSystem && this.scene.eventSystem.enabled === false) return;
        const intersections = this._intersectInstances(event);
        if (intersections.length === 0) {
            this._setHoverPoint(null);
            return;
        }
        const pointId = this._resolvePointIdFromIntersection(intersections[0]);
        this._setHoverPoint(pointId);
    }

    _handlePointerClick(event) {
        if (!this.config.enableInteraction) return;
        if (this.scene?.eventSystem && this.scene.eventSystem.enabled === false) return;
        const intersections = this._intersectInstances(event);
        if (intersections.length === 0) return;
        const pointId = this._resolvePointIdFromIntersection(intersections[0]);
        if (!pointId) return;

        if (this._clickedPointIds.has(pointId)) {
            this._clickedPointIds.delete(pointId);
        } else {
            this._clickedPointIds.add(pointId);
        }
        this._refreshPointVisual(pointId);
        this.emit('pointClick', { pointId });
    }

    _setHoverPoint(pointId) {
        const next = pointId || null;
        if (this._hoverPointId === next) return;
        const prev = this._hoverPointId;
        this._hoverPointId = next;
        if (prev) this._refreshPointVisual(prev);
        if (next) this._refreshPointVisual(next);
        if (next) {
            this.emit('pointHover', { pointId: next });
        } else {
            this.emit('pointHoverOut');
        }
    }

    _intersectInstances(event) {
        const camera = this.scene?.camera?.instance;
        const canvas = this.scene?.renderer?.instance?.domElement;
        if (!camera || !canvas || this._interactiveMeshes.length === 0) return [];

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];

        this._mouse.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this._raycaster.setFromCamera(this._mouse, camera);
        return this._raycaster.intersectObjects(this._interactiveMeshes, false);
    }

    _resolvePointIdFromIntersection(intersection) {
        if (!intersection) return null;
        const object = intersection.object;
        const instanceId = intersection.instanceId;
        if (!object?.userData?.__ptmPointIds) return null;
        if (!Number.isInteger(instanceId)) return null;
        return object.userData.__ptmPointIds[instanceId] || null;
    }
}

export default PointTypeMarkerManager;
