import * as THREE from 'three';
import { Component } from '@w3d/core';

const DEFAULT_COLOR_RANGE = ['#163bff', '#4ff3ff'];
const DEFAULT_HEIGHT_RANGE = [2, 20];
const BUILTIN_DEMO_GEOJSON = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { adcode: '310101', name: '黄浦区', value: 92 },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [121.454, 31.238],
                    [121.474, 31.244],
                    [121.488, 31.23],
                    [121.48, 31.212],
                    [121.458, 31.216],
                    [121.454, 31.238]
                ]]
            }
        },
        {
            type: 'Feature',
            properties: { adcode: '310104', name: '徐汇区', value: 78 },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [121.424, 31.216],
                    [121.462, 31.226],
                    [121.472, 31.202],
                    [121.45, 31.176],
                    [121.414, 31.188],
                    [121.424, 31.216]
                ]]
            }
        },
        {
            type: 'Feature',
            properties: { adcode: '310105', name: '长宁区', value: 64 },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [121.398, 31.234],
                    [121.428, 31.242],
                    [121.438, 31.22],
                    [121.416, 31.206],
                    [121.39, 31.214],
                    [121.398, 31.234]
                ]]
            }
        },
        {
            type: 'Feature',
            properties: { adcode: '310106', name: '静安区', value: 88 },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [121.444, 31.256],
                    [121.474, 31.262],
                    [121.486, 31.242],
                    [121.468, 31.226],
                    [121.442, 31.232],
                    [121.444, 31.256]
                ]]
            }
        }
    ]
};

const asArray = (value, fallback = []) => (Array.isArray(value) ? value : fallback);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const deepMerge = (target, source) => {
    if (Array.isArray(source)) return source.map((item) => deepMerge(undefined, item));
    if (source && typeof source === 'object') {
        const base = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
        const result = { ...base };
        Object.keys(source).forEach((key) => {
            result[key] = deepMerge(base[key], source[key]);
        });
        return result;
    }
    return source === undefined ? target : source;
};

const toHexColor = (value, fallback = '#ffffff') => {
    try {
        return `#${new THREE.Color(value || fallback).getHexString()}`;
    } catch {
        return fallback;
    }
};

const lerpColor = (from, to, t) => {
    const c1 = new THREE.Color(from);
    const c2 = new THREE.Color(to);
    return `#${c1.lerp(c2, clamp(t, 0, 1)).getHexString()}`;
};

const closeRing = (ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return [];
    const normalized = ring
        .map((point) => [toNumber(point?.[0]), toNumber(point?.[1])])
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (normalized.length < 3) return [];
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        normalized.push([...first]);
    }
    return normalized;
};

const ringArea = (ring) => {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
        area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    return area / 2;
};

const normalizePolygon = (rings) => {
    const normalized = asArray(rings)
        .map((ring) => closeRing(ring))
        .filter((ring) => ring.length >= 4);
    if (!normalized.length) return [];
    const result = [];
    normalized.forEach((ring, index) => {
        if (index === 0) {
            result.push(ringArea(ring) < 0 ? [...ring].reverse() : ring);
        } else {
            result.push(ringArea(ring) > 0 ? [...ring].reverse() : ring);
        }
    });
    return result;
};

const geometryToPolygons = (geometry) => {
    if (!geometry || typeof geometry !== 'object') return [];
    if (geometry.type === 'Polygon') return [normalizePolygon(geometry.coordinates)];
    if (geometry.type === 'MultiPolygon') {
        return asArray(geometry.coordinates).map((item) => normalizePolygon(item)).filter(Boolean);
    }
    return [];
};

const computeBounds = (features) => {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    features.forEach((feature) => {
        feature.polygons.forEach((polygon) => {
            polygon.forEach((ring) => {
                ring.forEach(([lng, lat]) => {
                    minLng = Math.min(minLng, lng);
                    maxLng = Math.max(maxLng, lng);
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                });
            });
        });
    });

    if (!Number.isFinite(minLng)) {
        return {
            minLng: 0,
            maxLng: 0,
            minLat: 0,
            maxLat: 0,
            centerLng: 0,
            centerLat: 0,
            spanLng: 1,
            spanLat: 1
        };
    }

    return {
        minLng,
        maxLng,
        minLat,
        maxLat,
        centerLng: (minLng + maxLng) / 2,
        centerLat: (minLat + maxLat) / 2,
        spanLng: Math.max(1e-6, maxLng - minLng),
        spanLat: Math.max(1e-6, maxLat - minLat)
    };
};

const centroidFromRing = (ring) => {
    if (!Array.isArray(ring) || ring.length === 0) return [0, 0];
    const sum = ring.reduce((acc, point) => {
        acc[0] += point[0];
        acc[1] += point[1];
        return acc;
    }, [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
};

const createLabelSprite = (text, config) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = Math.max(12, toNumber(config?.fontSize, 24));
    const safeText = String(text || '').trim() || 'Unnamed';
    ctx.font = `600 ${fontSize}px sans-serif`;
    const width = Math.ceil(ctx.measureText(safeText).width + 48);
    const height = Math.ceil(fontSize + 28);
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = 'rgba(6, 16, 38, 0.82)';
    ctx.strokeStyle = 'rgba(123, 226, 255, 0.88)';
    ctx.lineWidth = 2;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeRect(1, 1, width - 2, height - 2);
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = toHexColor(config?.color, '#ffffff');
    ctx.fillText(safeText, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    const aspect = width / Math.max(1, height);
    const size = fontSize * 0.08;
    sprite.scale.set(size * aspect, size, 1);
    return sprite;
};

/**
 * Loader module component that converts GeoJSON features into scene geometry for map and region visualization.
 */
export class GeoJSONLoader extends Component {
    static defaultConfig = {
        url: '',
        data: null,
        sourceType: 'url',
        coordinateSystem: {
            center: [0, 0],
            scale: 1,
            fitSize: 240,
            flipY: true
        },
        regionKey: 'adcode',
        regionNameKey: 'name',
        geometry: {
            height: 6
        },
        style: {
            fillColor: '#1f6fff',
            topColor: '#49d3ff',
            sideColor: '#0d3f8f',
            lineColor: '#9fefff',
            opacity: 0.95
        },
        visualMapping: {
            enabled: false,
            field: 'value',
            colorRange: DEFAULT_COLOR_RANGE,
            heightRange: DEFAULT_HEIGHT_RANGE,
            nullColor: '#1f2a44'
        },
        label: {
            enabled: false,
            field: 'name',
            color: '#ffffff',
            fontSize: 24,
            offsetY: 2.5
        },
        interaction: {
            hoverEnabled: true,
            selectEnabled: true,
            multiSelect: false,
            focusOnClick: false,
            hoverColor: '#ffffff',
            selectedColor: '#00ffd0'
        },
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    };

    constructor(scene, config = {}) {
        super(scene, config);
        this.regionMap = new Map();
        this.selectedRegionIds = new Set();
        this.bounds = null;
        this.handleClickBound = (event) => this.handlePointerEvent('click', event);
        this.handleEnterBound = (event) => this.handlePointerEvent('mouseenter', event);
        this.handleLeaveBound = (event) => this.handlePointerEvent('mouseleave', event);
    }

    async onMounted() {
        this.on('click', this.handleClickBound);
        this.on('mouseenter', this.handleEnterBound);
        this.on('mouseleave', this.handleLeaveBound);
        await this.reload();
    }

    onDispose() {
        this.off('click', this.handleClickBound);
        this.off('mouseenter', this.handleEnterBound);
        this.off('mouseleave', this.handleLeaveBound);
        this.clearRegions();
    }

    async updateConfig(newConfig = {}) {
        this.config = deepMerge(this.config, newConfig);
        await this.reload();
        return this.config;
    }

    getInteractiveObjects() {
        const list = [];
        this.regionMap.forEach((runtime) => {
            if (runtime.mesh) list.push(runtime.mesh);
        });
        return list;
    }

    async resolveSource() {
        if (this.config.sourceType === 'inline' || (!this.config.url && this.config.data)) {
            if (!this.config.data) throw new Error('GeoJSONLoader inline data is empty');
            return this.config.data;
        }
        const url = String(this.config.url || '').trim();
        if (!url) throw new Error('GeoJSONLoader url is empty');
        const candidates = [url];

        let lastStatus = 404;
        for (const candidate of candidates) {
            const response = await fetch(candidate);
            if (response.ok) {
                if (candidate !== url) {
                    this.config.url = candidate;
                }
                return response.json();
            }
            lastStatus = response.status;
        }

        if (url === '/mock/geojson-city-demo.json') {
            this.config.sourceType = 'inline';
            this.config.url = '';
            this.config.data = BUILTIN_DEMO_GEOJSON;
            return BUILTIN_DEMO_GEOJSON;
        }

        throw new Error(`Failed to fetch GeoJSON: ${lastStatus}`);
    }

    normalizeFeature(feature, index) {
        const polygons = geometryToPolygons(feature?.geometry);
        if (!polygons.length) return null;
        const properties = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
        const id = String(properties[this.config.regionKey] ?? properties.id ?? `region_${index + 1}`);
        const name = String(properties[this.config.regionNameKey] ?? properties.name ?? id);
        return { id, name, polygons, properties };
    }

    projectPoint([lng, lat]) {
        const bounds = this.bounds || computeBounds([]);
        const center = asArray(this.config.coordinateSystem?.center, [bounds.centerLng, bounds.centerLat]);
        const fitSize = Math.max(10, toNumber(this.config.coordinateSystem?.fitSize, 240));
        const scale = toNumber(this.config.coordinateSystem?.scale, 1);
        const worldScale = (fitSize / Math.max(bounds.spanLng, bounds.spanLat, 1e-6)) * scale;
        return new THREE.Vector2(
            (lng - toNumber(center[0], bounds.centerLng)) * worldScale,
            (lat - toNumber(center[1], bounds.centerLat)) * worldScale * (this.config.coordinateSystem?.flipY === false ? 1 : -1)
        );
    }

    async reload() {
        this.emit('loadStart', { url: this.config.url || null, sourceType: this.config.sourceType });
        try {
            const featureCollection = await this.resolveSource();
            const features = asArray(featureCollection?.features)
                .map((item, index) => this.normalizeFeature(item, index))
                .filter(Boolean);
            this.bounds = computeBounds(features);
            this.clearRegions();
            features.forEach((feature) => this.addFeature(feature));
            this.applyVisualMapping();
            this.applyTransform();
            this.scene?.eventSystem?.invalidateInteractiveCache?.();
            this.emit('loaded', this.getRegionStats());
            return true;
        } catch (error) {
            this.emit('loadError', { message: error.message, error });
            throw error;
        }
    }

    async setData(featureCollection) {
        this.config = deepMerge(this.config, { sourceType: 'inline', data: featureCollection });
        return this.reload();
    }

    async updateData(dataList = []) {
        asArray(dataList).forEach((item) => {
            const id = String(item?.id ?? item?.regionId ?? '');
            const runtime = this.regionMap.get(id);
            if (!runtime) return;
            runtime.dynamicValue = item?.value;
            if (item?.color) runtime.manualColor = item.color;
            if (item?.height !== undefined) runtime.manualHeight = toNumber(item.height, runtime.height);
        });
        this.applyVisualMapping();
        this.emit('dataUpdate', { updatedCount: asArray(dataList).length });
        return true;
    }

    focusRegion(regionId) {
        const runtime = this.regionMap.get(String(regionId || ''));
        const camera = this.scene?.camera?.instance;
        const controls = this.scene?.controls?.instance;
        if (!runtime || !camera) return false;
        const distance = Math.max(runtime.size.x, runtime.size.z, 10) * 1.8;
        if (controls?.target) {
            controls.target.copy(runtime.center);
            controls.update?.();
        }
        camera.position.set(runtime.center.x, runtime.center.y + distance * 1.2, runtime.center.z + distance);
        camera.lookAt(runtime.center);
        this.scene?.renderOnce?.();
        return true;
    }

    setSelectedRegions(ids = []) {
        this.selectedRegionIds = new Set(asArray(ids).map((item) => String(item)));
        this.refreshRegionStates();
        this.emitSelectionChange();
        return true;
    }

    clearSelection() {
        this.selectedRegionIds.clear();
        this.refreshRegionStates();
        this.emitSelectionChange();
        return true;
    }

    getRegionMeta(regionId) {
        const runtime = this.regionMap.get(String(regionId || ''));
        if (!runtime) return null;
        return {
            id: runtime.id,
            name: runtime.name,
            properties: { ...runtime.properties },
            bounds: {
                center: runtime.center.toArray(),
                size: runtime.size.toArray()
            },
            value: runtime.dynamicValue ?? runtime.properties?.[this.config.visualMapping?.field || 'value'] ?? null
        };
    }

    getRegionStats() {
        return {
            regionCount: this.regionMap.size,
            selectedCount: this.selectedRegionIds.size,
            sourceType: this.config.sourceType,
            bounds: this.bounds
        };
    }

    addFeature(feature) {
        const group = new THREE.Group();
        group.name = `${this.name}_${feature.id}`;
        let combinedBox = null;
        feature.polygons.forEach((polygon, polygonIndex) => {
            const shape = new THREE.Shape();
            polygon[0].map((point) => this.projectPoint(point)).forEach((point, pointIndex) => {
                if (pointIndex === 0) shape.moveTo(point.x, point.y);
                else shape.lineTo(point.x, point.y);
            });
            for (let i = 1; i < polygon.length; i += 1) {
                const hole = new THREE.Path();
                polygon[i].map((point) => this.projectPoint(point)).forEach((point, pointIndex) => {
                    if (pointIndex === 0) hole.moveTo(point.x, point.y);
                    else hole.lineTo(point.x, point.y);
                });
                shape.holes.push(hole);
            }

            const height = Math.max(0.1, toNumber(this.config.geometry?.height, 6));
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
            geometry.rotateX(Math.PI / 2);
            geometry.translate(0, height, 0);

            const mesh = new THREE.Mesh(geometry, [
                new THREE.MeshStandardMaterial({
                    color: this.config.style?.sideColor || '#0d3f8f',
                    transparent: true,
                    opacity: toNumber(this.config.style?.opacity, 0.95),
                    roughness: 0.7,
                    metalness: 0.04
                }),
                new THREE.MeshStandardMaterial({
                    color: this.config.style?.topColor || this.config.style?.fillColor || '#1f6fff',
                    transparent: true,
                    opacity: toNumber(this.config.style?.opacity, 0.95),
                    roughness: 0.55,
                    metalness: 0.08
                })
            ]);
            mesh.userData.eventEmitter = this.eventEmitter;
            mesh.userData.geoRegionId = feature.id;
            mesh.userData.geoRegionName = feature.name;
            mesh.userData.geoRegionProps = feature.properties;
            mesh.userData.geoPolygonIndex = polygonIndex;
            group.add(mesh);

            const outlinePoints = polygon[0].map((point) => this.projectPoint(point));
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(
                outlinePoints.map((point) => new THREE.Vector3(point.x, height + 0.12, point.y))
            );
            const line = new THREE.LineLoop(
                lineGeometry,
                new THREE.LineBasicMaterial({ color: this.config.style?.lineColor || '#9fefff', transparent: true, opacity: 0.92 })
            );
            group.add(line);

            const box = new THREE.Box3().setFromObject(mesh);
            combinedBox = combinedBox ? combinedBox.union(box) : box.clone();
        });

        if (!combinedBox) return;

        let labelSprite = null;
        if (this.config.label?.enabled) {
            const labelField = this.config.label?.field || this.config.regionNameKey || 'name';
            const [lng, lat] = centroidFromRing(feature.polygons[0][0]);
            const projected = this.projectPoint([lng, lat]);
            labelSprite = createLabelSprite(feature.properties?.[labelField] ?? feature.name, this.config.label);
            labelSprite.position.set(projected.x, toNumber(this.config.geometry?.height, 6) + toNumber(this.config.label?.offsetY, 2.5), projected.y);
            group.add(labelSprite);
        }

        this.componentScene.add(group);
        this.regionMap.set(feature.id, {
            id: feature.id,
            name: feature.name,
            properties: feature.properties,
            group,
            mesh: group.children.find((item) => item.isMesh) || null,
            lines: group.children.filter((item) => item.isLine),
            labelSprite,
            center: combinedBox.getCenter(new THREE.Vector3()),
            size: combinedBox.getSize(new THREE.Vector3()),
            height: toNumber(this.config.geometry?.height, 6),
            hover: false,
            baseTopColor: toHexColor(this.config.style?.topColor || this.config.style?.fillColor, '#1f6fff'),
            baseSideColor: toHexColor(this.config.style?.sideColor, '#0d3f8f'),
            baseLineColor: toHexColor(this.config.style?.lineColor, '#9fefff')
        });
    }

    applyVisualMapping() {
        const mapping = this.config.visualMapping || {};
        const values = [];
        this.regionMap.forEach((runtime) => {
            const value = runtime.dynamicValue ?? runtime.properties?.[mapping.field || 'value'];
            if (Number.isFinite(Number(value))) values.push(Number(value));
        });
        const min = values.length ? Math.min(...values) : 0;
        const max = values.length ? Math.max(...values) : 1;
        const span = Math.max(1e-6, max - min);

        this.regionMap.forEach((runtime) => {
            const value = runtime.dynamicValue ?? runtime.properties?.[mapping.field || 'value'];
            const numeric = Number(value);
            const t = Number.isFinite(numeric) ? (numeric - min) / span : 0;
            const topColor = runtime.manualColor
                || (mapping.enabled && Number.isFinite(numeric)
                    ? lerpColor(mapping.colorRange?.[0] || DEFAULT_COLOR_RANGE[0], mapping.colorRange?.[1] || DEFAULT_COLOR_RANGE[1], t)
                    : runtime.baseTopColor);
            const sideColor = mapping.enabled && Number.isFinite(numeric)
                ? lerpColor(runtime.baseSideColor, topColor, 0.35)
                : runtime.baseSideColor;
            const lineColor = topColor;
            const height = runtime.manualHeight !== undefined
                ? runtime.manualHeight
                : (mapping.enabled && Number.isFinite(numeric)
                    ? THREE.MathUtils.lerp(
                        toNumber(mapping.heightRange?.[0], DEFAULT_HEIGHT_RANGE[0]),
                        toNumber(mapping.heightRange?.[1], DEFAULT_HEIGHT_RANGE[1]),
                        clamp(t, 0, 1)
                    )
                    : toNumber(this.config.geometry?.height, 6));

            runtime.height = height;
            this.applyRuntimeStyle(runtime, { topColor, sideColor, lineColor, height });
        });
        this.refreshRegionStates();
    }

    applyRuntimeStyle(runtime, { topColor, sideColor, lineColor, height }) {
        if (runtime.mesh) {
            const sideMaterial = runtime.mesh.material?.[0];
            const topMaterial = runtime.mesh.material?.[1];
            if (sideMaterial?.color) sideMaterial.color.set(sideColor);
            if (topMaterial?.color) topMaterial.color.set(topColor);

            const shape = runtime.mesh.geometry.parameters?.shapes;
            if (shape) {
                runtime.mesh.geometry.dispose();
                const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.1, height), bevelEnabled: false });
                geometry.rotateX(Math.PI / 2);
                geometry.translate(0, Math.max(0.1, height), 0);
                runtime.mesh.geometry = geometry;
            }
        }

        runtime.lines.forEach((line) => {
            if (line.material?.color) line.material.color.set(lineColor);
            const pos = line.geometry?.attributes?.position;
            if (pos) {
                for (let i = 0; i < pos.count; i += 1) pos.setY(i, height + 0.12);
                pos.needsUpdate = true;
            }
        });

        if (runtime.labelSprite) {
            runtime.labelSprite.position.y = height + toNumber(this.config.label?.offsetY, 2.5);
        }

        const box = new THREE.Box3().setFromObject(runtime.group);
        runtime.center = box.getCenter(new THREE.Vector3());
        runtime.size = box.getSize(new THREE.Vector3());
        runtime.topColor = toHexColor(topColor, runtime.baseTopColor);
        runtime.sideColor = toHexColor(sideColor, runtime.baseSideColor);
        runtime.lineColor = toHexColor(lineColor, runtime.baseLineColor);
    }

    refreshRegionStates() {
        this.regionMap.forEach((runtime) => {
            const selected = this.selectedRegionIds.has(runtime.id);
            const hovered = runtime.hover;
            const topColor = selected
                ? this.config.interaction?.selectedColor || '#00ffd0'
                : (hovered ? this.config.interaction?.hoverColor || '#ffffff' : runtime.topColor || runtime.baseTopColor);
            const sideColor = selected || hovered ? lerpColor(runtime.baseSideColor, topColor, 0.4) : runtime.sideColor || runtime.baseSideColor;
            const lineColor = selected || hovered ? topColor : runtime.lineColor || runtime.baseLineColor;

            if (runtime.mesh) {
                const sideMaterial = runtime.mesh.material?.[0];
                const topMaterial = runtime.mesh.material?.[1];
                if (sideMaterial?.color) sideMaterial.color.set(sideColor);
                if (topMaterial?.color) topMaterial.color.set(topColor);
            }
            runtime.lines.forEach((line) => {
                if (line.material?.color) line.material.color.set(lineColor);
            });
        });
    }

    handlePointerEvent(type, eventData) {
        const regionId = String(eventData?.object?.userData?.geoRegionId || '');
        const runtime = this.regionMap.get(regionId);
        if (!runtime) return;
        const payload = {
            id: runtime.id,
            name: runtime.name,
            properties: { ...runtime.properties },
            bounds: {
                center: runtime.center.toArray(),
                size: runtime.size.toArray()
            },
            value: runtime.dynamicValue ?? runtime.properties?.[this.config.visualMapping?.field || 'value'] ?? null,
            rawEvent: eventData
        };

        if (type === 'mouseenter') {
            runtime.hover = true;
            this.refreshRegionStates();
            this.emit('regionHover', payload);
            return;
        }
        if (type === 'mouseleave') {
            runtime.hover = false;
            this.refreshRegionStates();
            this.emit('regionMouseLeave', payload);
            return;
        }

        if (this.config.interaction?.selectEnabled !== false) {
            if (this.config.interaction?.multiSelect) {
                if (this.selectedRegionIds.has(runtime.id)) this.selectedRegionIds.delete(runtime.id);
                else this.selectedRegionIds.add(runtime.id);
            } else {
                this.selectedRegionIds = new Set([runtime.id]);
            }
            this.refreshRegionStates();
            this.emitSelectionChange();
        }
        if (this.config.interaction?.focusOnClick) this.focusRegion(runtime.id);
        this.emit('regionClick', payload);
    }

    emitSelectionChange() {
        const ids = Array.from(this.selectedRegionIds);
        this.emit('selectionChange', {
            ids,
            regions: ids.map((id) => this.getRegionMeta(id)).filter(Boolean)
        });
    }

    clearRegions() {
        this.regionMap.forEach((runtime) => {
            runtime.group?.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach((item) => item?.dispose?.());
                    else obj.material.dispose?.();
                }
                if (obj.material?.map) obj.material.map.dispose?.();
            });
            this.componentScene.remove(runtime.group);
        });
        this.regionMap.clear();
        this.selectedRegionIds.clear();
    }

    applyTransform() {
        const position = asArray(this.config.position, [0, 0, 0]);
        const rotation = asArray(this.config.rotation, [0, 0, 0]);
        const scale = asArray(this.config.scale, [1, 1, 1]);
        this.componentScene.position.set(toNumber(position[0]), toNumber(position[1]), toNumber(position[2]));
        this.componentScene.rotation.set(toNumber(rotation[0]), toNumber(rotation[1]), toNumber(rotation[2]));
        this.componentScene.scale.set(toNumber(scale[0], 1), toNumber(scale[1], 1), toNumber(scale[2], 1));
    }
}
