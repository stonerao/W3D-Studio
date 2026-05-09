import { Component } from '@w3d/core';
import * as THREE from 'three';

const DEFAULT_MAX_HEAT_POINTS = 1024;
const DEFAULT_RESOLUTION = 256;
const MAX_GRADIENT_STOPS = 16;
const FLOAT_EPSILON = 0.0001;
const AXIS_KEYS = ['x', 'y', 'z'];

const AXIS_VECTORS = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
};

const AXIS_PAIRS = {
    auto: null,
    xz: { u: 'x', v: 'z', fixed: 'y' },
    xy: { u: 'x', v: 'y', fixed: 'z' },
    yz: { u: 'y', v: 'z', fixed: 'x' }
};

const clamp = (value, min, max) => THREE.MathUtils.clamp(value, min, max);
const lerp = (start, end, alpha) => THREE.MathUtils.lerp(start, end, alpha);

const toFiniteNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toPositiveInteger = (value, fallback, min = 1, max = 4096) => {
    const n = Math.round(toFiniteNumber(value, fallback));
    return clamp(n, min, max);
};

const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / Math.max(FLOAT_EPSILON, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

const deepMerge = (target = {}, source = {}) => {
    const result = { ...target };

    Object.keys(source || {}).forEach((key) => {
        const sourceValue = source[key];
        if (
            sourceValue &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            target[key] &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])
        ) {
            result[key] = deepMerge(target[key], sourceValue);
            return;
        }

        result[key] = sourceValue;
    });

    return result;
};

const getAxisValue = (vector, axis) => vector?.[axis] ?? 0;

const setAxisValue = (vector, axis, value) => {
    if (vector) vector[axis] = value;
    return vector;
};

const getAxisVector = (axis) => (AXIS_VECTORS[axis] || AXIS_VECTORS.y).clone();

const getRemainingAxis = (uAxis, vAxis) => (
    AXIS_KEYS.find((axis) => axis !== uAxis && axis !== vAxis) || 'y'
);

const toColorHex = (color) => `#${color.getHexString()}`;

export class Heatmap extends Component {
    static defaultConfig = {
        data: [
            { x: -6, z: -3, value: 10 },
            { x: -2, z: 1, value: 35 },
            { x: 1, z: -2, value: 55 },
            { x: 4, z: 3, value: 80 },
            { x: 7, z: -1, value: 95 }
        ],
        renderMode: 'plane',
        projectionAxis: 'auto',
        surfaceTarget: {
            componentId: '',
            meshName: ''
        },
        size: 2,
        sizeByValue: true,
        minSize: 0.5,
        maxSize: 6,
        threshold: 0,
        minValue: null,
        maxValue: null,
        resolution: DEFAULT_RESOLUTION,
        maxHeatPoints: DEFAULT_MAX_HEAT_POINTS,
        padding: 1.5,
        opacity: 0.78,
        blending: 'additive',
        softness: 0.72,
        intensity: 1.15,
        coreIntensity: 0.55,
        lowCutoff: 0.02,
        contourSteps: 0,
        falloff: 'gaussian',
        height: 0,
        overlayOffset: 0.04,
        showPointMarkers: false,
        pointMarkerSize: 0.35,
        pointMarkerOpacity: 0.92,
        colors: ['#102a6b', '#00b8ff', '#29f0b4', '#ffe066', '#ff8c42', '#ff3b30'],
        thresholds: []
    };

    constructor(scene, config = {}) {
        super(scene, config);
        this.heatSurfaceMesh = null;
        this.pointMarkersMesh = null;
        this.heatGroup = new THREE.Group();
        this.lastResolvedTargetMesh = null;
        this.lastProjectionContext = null;
        this.lastHeatField = null;
        this.lastValueRange = { min: 0, max: 1 };
        this.lastRenderInfo = {
            requestedRenderMode: 'plane',
            actualRenderMode: 'plane',
            pointCount: 0,
            clippedPoints: 0,
            resolution: 0,
            warning: ''
        };
    }

    onMounted() {
        this.componentScene.add(this.heatGroup);
        this.renderHeatmap();
    }

    onUpdate() {
        this.syncSurfaceOverlayTransform();
    }

    updateConfig(newConfig = {}) {
        this.config = deepMerge(this.config, newConfig);
        this.renderHeatmap();
    }

    updateData(data, options = {}) {
        const patch = options && typeof options === 'object' && options.config && typeof options.config === 'object'
            ? { ...options.config }
            : {};

        if (Array.isArray(data)) {
            patch.data = data;
        } else if (data && typeof data === 'object') {
            patch.data = Array.isArray(data.data) ? data.data : [];
        } else {
            patch.data = [];
        }

        this.updateConfig(patch);
        return {
            success: true,
            count: Array.isArray(patch.data) ? patch.data.length : 0
        };
    }

    disposeMesh(mesh) {
        if (!mesh) return;

        mesh.parent?.remove(mesh);

        if (mesh.geometry) {
            mesh.geometry.dispose();
        }

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
            if (!material) return;
            if (material.map) material.map.dispose();
            if (material.alphaMap && material.alphaMap !== material.map) {
                material.alphaMap.dispose();
            }
            material.dispose();
        });
    }

    clearHeatmapMeshes() {
        if (this.heatSurfaceMesh) {
            this.disposeMesh(this.heatSurfaceMesh);
            this.heatSurfaceMesh = null;
        }

        if (this.pointMarkersMesh) {
            this.disposeMesh(this.pointMarkersMesh);
            this.pointMarkersMesh = null;
        }

        this.lastResolvedTargetMesh = null;
        this.lastProjectionContext = null;
        this.lastHeatField = null;
    }

    normalizePoint(rawPoint, index) {
        if (!rawPoint) return null;

        let point = rawPoint;
        if (Array.isArray(rawPoint)) {
            if (rawPoint.length >= 4) {
                point = { x: rawPoint[0], y: rawPoint[1], z: rawPoint[2], value: rawPoint[3] };
            } else if (rawPoint.length === 3) {
                point = { x: rawPoint[0], z: rawPoint[1], value: rawPoint[2] };
            } else if (rawPoint.length === 2) {
                point = { x: rawPoint[0], z: rawPoint[1], value: 0 };
            }
        }

        const sourcePosition = point.position || null;
        const x = Number(point.x ?? sourcePosition?.x ?? sourcePosition?.[0] ?? 0);
        const y = Number(point.y ?? sourcePosition?.y ?? sourcePosition?.[1] ?? this.config.height ?? 0);
        const z = Number(point.z ?? sourcePosition?.z ?? sourcePosition?.[2] ?? 0);
        const value = Number(point.value ?? point.v ?? point.intensity ?? point.weight ?? 0);
        const size = point.size !== undefined ? Number(point.size) : null;

        return {
            id: point.id || `heat_${index}`,
            x,
            y,
            z,
            value: Number.isFinite(value) ? value : 0,
            size: Number.isFinite(size) ? size : null
        };
    }

    getRenderMode() {
        const mode = String(this.config.renderMode || 'plane');
        return mode === 'surface' ? 'surface' : 'plane';
    }

    getValueRange(points) {
        const values = points.map((item) => item.value).filter((item) => Number.isFinite(item));
        if (values.length === 0) {
            return { min: 0, max: 1 };
        }

        const autoMin = Math.min(...values);
        const autoMax = Math.max(...values);

        const min = Number.isFinite(this.config.minValue) ? Number(this.config.minValue) : autoMin;
        const max = Number.isFinite(this.config.maxValue) ? Number(this.config.maxValue) : autoMax;
        if (max <= min) {
            return { min, max: min + 1 };
        }

        return { min, max };
    }

    getGradientStops() {
        const colors = Array.isArray(this.config.colors) ? this.config.colors : [];
        if (colors.length === 0) {
            return [
                { stop: 0, color: new THREE.Color('#1e3a8a') },
                { stop: 1, color: new THREE.Color('#ef4444') }
            ];
        }

        const hasObjectStop = colors.some((item) => item && typeof item === 'object' && item.color);
        if (hasObjectStop) {
            return colors
                .map((item, index) => {
                    if (item && typeof item === 'object') {
                        const stop = Number(item.stop);
                        return {
                            stop: Number.isFinite(stop)
                                ? Math.max(0, Math.min(1, stop))
                                : index / Math.max(1, colors.length - 1),
                            color: new THREE.Color(item.color || '#ffffff')
                        };
                    }

                    return {
                        stop: index / Math.max(1, colors.length - 1),
                        color: new THREE.Color(String(item))
                    };
                })
                .sort((a, b) => a.stop - b.stop);
        }

        return colors.map((item, index) => ({
            stop: index / Math.max(1, colors.length - 1),
            color: new THREE.Color(String(item))
        }));
    }

    getColorByThresholds(value) {
        const thresholds = Array.isArray(this.config.thresholds) ? this.config.thresholds : [];
        if (thresholds.length === 0) return null;

        const sorted = thresholds
            .filter((item) => item && Number.isFinite(Number(item.value)) && item.color)
            .map((item) => ({
                value: Number(item.value),
                color: new THREE.Color(String(item.color))
            }))
            .sort((a, b) => a.value - b.value);

        if (sorted.length === 0) return null;

        let targetColor = sorted[0].color;
        for (const item of sorted) {
            if (value >= item.value) {
                targetColor = item.color;
            }
        }
        return targetColor.clone();
    }

    getColorByGradient(value, min, max) {
        const thresholdColor = this.getColorByThresholds(value);
        if (thresholdColor) return thresholdColor;

        const stops = this.getGradientStops();
        if (stops.length === 1) return stops[0].color.clone();

        const normalized = clamp((value - min) / Math.max(FLOAT_EPSILON, max - min), 0, 1);
        let left = stops[0];
        let right = stops[stops.length - 1];

        for (let index = 0; index < stops.length - 1; index += 1) {
            const current = stops[index];
            const next = stops[index + 1];
            if (normalized >= current.stop && normalized <= next.stop) {
                left = current;
                right = next;
                break;
            }
        }

        const range = Math.max(FLOAT_EPSILON, right.stop - left.stop);
        const alpha = clamp((normalized - left.stop) / range, 0, 1);
        return left.color.clone().lerp(right.color, alpha);
    }

    buildColorRamp(valueRange) {
        const thresholds = Array.isArray(this.config.thresholds) ? this.config.thresholds : [];
        const validThresholds = thresholds
            .filter((item) => item && Number.isFinite(Number(item.value)) && item.color)
            .map((item) => ({
                stop: clamp(
                    (Number(item.value) - valueRange.min) / Math.max(FLOAT_EPSILON, valueRange.max - valueRange.min),
                    0,
                    1
                ),
                color: new THREE.Color(String(item.color))
            }))
            .sort((a, b) => a.stop - b.stop);

        if (validThresholds.length > 0) {
            return validThresholds;
        }

        return this.getGradientStops().slice(0, MAX_GRADIENT_STOPS);
    }

    getPointRadius(pointValue, pointSize, min, max) {
        if (Number.isFinite(pointSize)) {
            return Math.max(0.01, pointSize);
        }

        const baseSize = Number(this.config.size) || 1;
        if (!this.config.sizeByValue) {
            return Math.max(0.01, baseSize);
        }

        const minSize = Number(this.config.minSize) || 0.1;
        const maxSize = Number(this.config.maxSize) || baseSize;
        const normalized = clamp((pointValue - min) / Math.max(FLOAT_EPSILON, max - min), 0, 1);
        return lerp(minSize, maxSize, normalized);
    }

    getPointIntensity(pointValue, min, max) {
        const normalized = clamp((pointValue - min) / Math.max(FLOAT_EPSILON, max - min), 0, 1);
        const baseIntensity = Math.max(0.1, Number(this.config.intensity) || 1.15);
        return baseIntensity * lerp(0.85, 1.45, normalized);
    }

    getPointSpread(radius) {
        const softness = clamp(Number(this.config.softness) || 0.72, 0.05, 1);
        return Math.max(0.05, radius * lerp(0.7, 1.35, softness));
    }

    getSceneComponents() {
        const result = [];
        const mapA = this.scene?.componentManager?.components;
        const mapB = this.scene?.components;

        const collect = (source) => {
            if (!source) return;
            if (source instanceof Map) {
                source.forEach((value) => {
                    if (value) result.push(value);
                });
                return;
            }
            if (Array.isArray(source)) {
                source.forEach((value) => {
                    if (value) result.push(value);
                });
                return;
            }
            if (typeof source === 'object') {
                Object.values(source).forEach((value) => {
                    if (value) result.push(value);
                });
            }
        };

        collect(mapA);
        if (mapB !== mapA) {
            collect(mapB);
        }

        return result;
    }

    resolveComponentById(componentId, predicate = null) {
        const sceneComponents = this.getSceneComponents();
        if (!sceneComponents.length) return null;

        const targetId = String(componentId || '').trim();
        const byId = [];
        const fallback = [];

        for (const comp of sceneComponents) {
            const accepted = typeof predicate === 'function' ? predicate(comp) : true;
            if (!accepted) continue;

            if (!targetId) {
                fallback.push(comp);
                continue;
            }

            const candidateIds = [
                comp?.config?.id,
                comp?.id,
                comp?.config?.name,
                comp?.name
            ]
                .map((value) => String(value || '').trim())
                .filter(Boolean);

            if (candidateIds.includes(targetId)) {
                byId.push(comp);
            }
        }

        if (byId.length > 0) return byId[0];
        if (!targetId && fallback.length > 0) return fallback[0];
        return null;
    }

    resolveSurfaceMesh() {
        const targetConfig = this.config.surfaceTarget || {};
        const componentId = String(targetConfig.componentId || '').trim();
        const meshName = String(targetConfig.meshName || '').trim();

        if (componentId) {
            const loader = this.resolveComponentById(
                componentId,
                (comp) => typeof comp?.getMeshByName === 'function' || typeof comp?.getAllMeshes === 'function'
            );
            if (loader) {
                if (meshName && typeof loader.getMeshByName === 'function') {
                    const mesh = loader.getMeshByName(meshName);
                    if (mesh?.isMesh) return mesh;
                }

                if (!meshName && typeof loader.getAllMeshes === 'function') {
                    const meshes = loader.getAllMeshes();
                    if (meshes[0]?.isMesh) return meshes[0];
                }
            }
        }

        if (meshName && this.scene?.scene?.getObjectByName) {
            const object = this.scene.scene.getObjectByName(meshName);
            if (object?.isMesh) return object;
        }

        return null;
    }

    resolveAxisConfig(boxSize = new THREE.Vector3(1, 1, 1)) {
        const requested = String(this.config.projectionAxis || 'auto');
        if (AXIS_PAIRS[requested]) {
            return AXIS_PAIRS[requested];
        }

        const ranked = AXIS_KEYS
            .map((axis) => ({
                axis,
                size: Math.abs(Number(boxSize?.[axis] ?? 0))
            }))
            .sort((a, b) => b.size - a.size);

        const uAxis = ranked[0]?.axis || 'x';
        const vAxis = ranked[1]?.axis || (uAxis === 'x' ? 'z' : 'x');

        return {
            u: uAxis,
            v: vAxis,
            fixed: getRemainingAxis(uAxis, vAxis)
        };
    }

    getBlendingConfig(mode) {
        switch (mode) {
            case 'multiply':
                return { blending: THREE.MultiplyBlending };
            case 'screen':
                return {
                    blending: THREE.CustomBlending,
                    blendEquation: THREE.AddEquation,
                    blendEquationAlpha: THREE.AddEquation,
                    blendSrc: THREE.OneFactor,
                    blendDst: THREE.OneMinusSrcColorFactor,
                    blendSrcAlpha: THREE.OneFactor,
                    blendDstAlpha: THREE.OneMinusSrcAlphaFactor
                };
            case 'normal':
                return { blending: THREE.NormalBlending };
            case 'additive':
            default:
                return { blending: THREE.AdditiveBlending };
        }
    }

    createOverlayMaterial(texture) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            toneMapped: false
        });

        Object.assign(material, this.getBlendingConfig(this.config.blending));
        return material;
    }

    preparePoints(points, valueRange) {
        const maxPoints = toPositiveInteger(
            this.config.maxHeatPoints,
            DEFAULT_MAX_HEAT_POINTS,
            1,
            4096
        );

        return points
            .map((point) => {
                const radius = this.getPointRadius(point.value, point.size, valueRange.min, valueRange.max);
                const normalizedValue = clamp(
                    (point.value - valueRange.min) / Math.max(FLOAT_EPSILON, valueRange.max - valueRange.min),
                    0,
                    1
                );

                return {
                    ...point,
                    radius,
                    spread: this.getPointSpread(radius),
                    intensity: this.getPointIntensity(point.value, valueRange.min, valueRange.max),
                    normalizedValue,
                    worldPosition: new THREE.Vector3(point.x, point.y, point.z)
                };
            })
            .sort((left, right) => right.value - left.value)
            .slice(0, maxPoints);
    }

    buildPlaneContext(points) {
        if (points.length === 0) return null;

        const worldBox = new THREE.Box3();
        points.forEach((point) => {
            worldBox.expandByPoint(point.worldPosition);
        });

        const boxSize = worldBox.getSize(new THREE.Vector3());
        const axes = this.resolveAxisConfig(boxSize);
        const fixedAxis = axes.fixed;
        const padding = Math.max(0, toFiniteNumber(this.config.padding, 1.5));

        let minU = Infinity;
        let maxU = -Infinity;
        let minV = Infinity;
        let maxV = -Infinity;
        let fixedValueTotal = 0;

        for (const point of points) {
            const u = getAxisValue(point.worldPosition, axes.u);
            const v = getAxisValue(point.worldPosition, axes.v);
            const influence = point.spread * 3.2 + padding;

            minU = Math.min(minU, u - influence);
            maxU = Math.max(maxU, u + influence);
            minV = Math.min(minV, v - influence);
            maxV = Math.max(maxV, v + influence);
            fixedValueTotal += getAxisValue(point.worldPosition, fixedAxis);
        }

        if (!Number.isFinite(minU) || !Number.isFinite(maxU) || !Number.isFinite(minV) || !Number.isFinite(maxV)) {
            return null;
        }

        const sizeU = Math.max(0.5, maxU - minU);
        const sizeV = Math.max(0.5, maxV - minV);
        const center = new THREE.Vector3();
        setAxisValue(center, axes.u, (minU + maxU) / 2);
        setAxisValue(center, axes.v, (minV + maxV) / 2);
        setAxisValue(center, fixedAxis, fixedValueTotal / points.length);

        return {
            type: 'plane',
            axes,
            minU,
            maxU,
            minV,
            maxV,
            sizeU,
            sizeV,
            center
        };
    }

    buildSurfaceContext() {
        const targetMesh = this.resolveSurfaceMesh();
        if (!targetMesh?.isMesh || !targetMesh.geometry) {
            return null;
        }

        const geometry = targetMesh.geometry;
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }

        const localBox = geometry.boundingBox?.clone();
        if (!localBox || localBox.isEmpty()) {
            return null;
        }

        const size = localBox.getSize(new THREE.Vector3());
        const axes = this.resolveAxisConfig(size);
        const centerLocal = localBox.getCenter(new THREE.Vector3());
        const centerWorld = targetMesh.localToWorld(centerLocal.clone());
        const worldScale = targetMesh.getWorldScale
            ? targetMesh.getWorldScale(new THREE.Vector3())
            : new THREE.Vector3(1, 1, 1);

        return {
            type: 'surface',
            targetMesh,
            localBox,
            axes,
            minU: getAxisValue(localBox.min, axes.u),
            maxU: getAxisValue(localBox.max, axes.u),
            minV: getAxisValue(localBox.min, axes.v),
            maxV: getAxisValue(localBox.max, axes.v),
            sizeU: Math.max(FLOAT_EPSILON, size[axes.u] || 0),
            sizeV: Math.max(FLOAT_EPSILON, size[axes.v] || 0),
            scaleU: Math.max(FLOAT_EPSILON, Math.abs(worldScale[axes.u]) || 1),
            scaleV: Math.max(FLOAT_EPSILON, Math.abs(worldScale[axes.v]) || 1),
            centerLocal,
            centerWorld
        };
    }

    resolveRenderContext(points) {
        if (this.getRenderMode() !== 'surface') {
            return this.buildPlaneContext(points);
        }

        const surfaceContext = this.buildSurfaceContext();
        if (surfaceContext) {
            return surfaceContext;
        }

        const fallbackContext = this.buildPlaneContext(points);
        if (fallbackContext) {
            fallbackContext.fallbackFromSurface = true;
        }

        return fallbackContext;
    }

    projectWorldPositionToContext(worldPosition, context) {
        if (context.type === 'surface' && context.targetMesh) {
            const localPosition = context.targetMesh.worldToLocal(worldPosition.clone());
            return {
                u: getAxisValue(localPosition, context.axes.u),
                v: getAxisValue(localPosition, context.axes.v),
                localPosition
            };
        }

        return {
            u: getAxisValue(worldPosition, context.axes.u),
            v: getAxisValue(worldPosition, context.axes.v),
            localPosition: null
        };
    }

    projectPointsForContext(points, context) {
        if (!context) return [];

        const projected = [];
        let clippedPoints = 0;

        for (const point of points) {
            const coordinates = this.projectWorldPositionToContext(point.worldPosition, context);
            let renderSpread = point.spread;

            if (context.type === 'surface') {
                renderSpread = Math.max(
                    0.01,
                    (point.spread / context.scaleU + point.spread / context.scaleV) * 0.5
                );

                const margin = renderSpread * 3.2;
                const outsideBounds = (
                    coordinates.u < context.minU - margin ||
                    coordinates.u > context.maxU + margin ||
                    coordinates.v < context.minV - margin ||
                    coordinates.v > context.maxV + margin
                );

                if (outsideBounds) {
                    clippedPoints += 1;
                    continue;
                }
            }

            projected.push({
                ...point,
                ...coordinates,
                renderSpread
            });
        }

        context.clippedPoints = clippedPoints;
        return projected;
    }

    buildHeatField(points, context) {
        if (points.length === 0) return null;

        const resolution = toPositiveInteger(this.config.resolution, DEFAULT_RESOLUTION, 32, 1024);
        const sizeU = Math.max(FLOAT_EPSILON, context.sizeU);
        const sizeV = Math.max(FLOAT_EPSILON, context.sizeV);
        const stepU = sizeU / resolution;
        const stepV = sizeV / resolution;
        const falloff = String(this.config.falloff || 'gaussian');
        const heatValues = new Float32Array(resolution * resolution);
        let peak = 0;

        for (const point of points) {
            const spread = Math.max(FLOAT_EPSILON, point.renderSpread);
            const influence = falloff === 'linear' ? spread : spread * 3.2;

            const minX = clamp(
                Math.floor((point.u - influence - context.minU) / stepU),
                0,
                resolution - 1
            );
            const maxX = clamp(
                Math.ceil((point.u + influence - context.minU) / stepU),
                0,
                resolution - 1
            );
            const minY = clamp(
                Math.floor((point.v - influence - context.minV) / stepV),
                0,
                resolution - 1
            );
            const maxY = clamp(
                Math.ceil((point.v + influence - context.minV) / stepV),
                0,
                resolution - 1
            );

            for (let gridY = minY; gridY <= maxY; gridY += 1) {
                const sampleV = context.minV + (gridY + 0.5) * stepV;
                const deltaV = sampleV - point.v;

                for (let gridX = minX; gridX <= maxX; gridX += 1) {
                    const sampleU = context.minU + (gridX + 0.5) * stepU;
                    const deltaU = sampleU - point.u;
                    const distanceSquared = deltaU * deltaU + deltaV * deltaV;

                    let contribution = 0;
                    if (falloff === 'linear') {
                        const distance = Math.sqrt(distanceSquared);
                        contribution = point.intensity * Math.max(
                            0,
                            1 - distance / Math.max(FLOAT_EPSILON, influence)
                        );
                    } else {
                        contribution = point.intensity * Math.exp(-distanceSquared / (2 * spread * spread));
                    }

                    if (contribution <= 0.000001) continue;

                    const index = gridY * resolution + gridX;
                    heatValues[index] += contribution;
                    peak = Math.max(peak, heatValues[index]);
                }
            }
        }

        if (peak <= FLOAT_EPSILON) {
            return null;
        }

        return {
            resolution,
            peak,
            heatValues,
            normalizedValues: null,
            minU: context.minU,
            minV: context.minV,
            stepU,
            stepV,
            sizeU,
            sizeV
        };
    }

    createHeatTexture(heatField, valueRange) {
        const { resolution, heatValues, peak } = heatField;
        const textureData = new Uint8Array(resolution * resolution * 4);
        const normalizedValues = new Float32Array(resolution * resolution);
        const lowCutoff = clamp(toFiniteNumber(this.config.lowCutoff, 0.02), 0, 1);
        const opacity = clamp(toFiniteNumber(this.config.opacity, 0.78), 0, 1);
        const softness = clamp(toFiniteNumber(this.config.softness, 0.72), 0.05, 1);
        const coreIntensity = Math.max(0, toFiniteNumber(this.config.coreIntensity, 0.55));
        const contourSteps = Math.max(0, Math.floor(toFiniteNumber(this.config.contourSteps, 0)));
        const valueSpan = Math.max(FLOAT_EPSILON, valueRange.max - valueRange.min);

        for (let index = 0; index < heatValues.length; index += 1) {
            const normalized = clamp(heatValues[index] / Math.max(FLOAT_EPSILON, peak), 0, 1);
            normalizedValues[index] = normalized;

            const outputIndex = index * 4;
            if (normalized <= lowCutoff) {
                textureData[outputIndex + 0] = 0;
                textureData[outputIndex + 1] = 0;
                textureData[outputIndex + 2] = 0;
                textureData[outputIndex + 3] = 0;
                continue;
            }

            const remapped = contourSteps > 1
                ? Math.round(normalized * (contourSteps - 1)) / Math.max(1, contourSteps - 1)
                : normalized;
            const value = valueRange.min + remapped * valueSpan;
            const color = this.getColorByGradient(value, valueRange.min, valueRange.max);

            const body = smoothstep(lowCutoff, 0.32, normalized);
            const glow = Math.pow(normalized, lerp(1.45, 0.65, softness));
            const core = Math.pow(normalized, 1.1) * (0.3 + coreIntensity * 0.85);
            const brightness = 0.75 + glow * 0.75 + core * 0.45;
            const alpha = clamp((body * 0.72 + glow * 0.42 + core * 0.28) * opacity, 0, 1);

            color.multiplyScalar(brightness);

            textureData[outputIndex + 0] = Math.round(clamp(color.r, 0, 1) * 255);
            textureData[outputIndex + 1] = Math.round(clamp(color.g, 0, 1) * 255);
            textureData[outputIndex + 2] = Math.round(clamp(color.b, 0, 1) * 255);
            textureData[outputIndex + 3] = Math.round(alpha * 255);
        }

        const texture = new THREE.DataTexture(textureData, resolution, resolution, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;

        if ('colorSpace' in texture && THREE.SRGBColorSpace) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }

        return {
            texture,
            normalizedValues
        };
    }

    createPlaneOverlayMesh(context, texture) {
        const geometry = new THREE.PlaneGeometry(context.sizeU, context.sizeV, 1, 1);
        const material = this.createOverlayMaterial(texture);
        const mesh = new THREE.Mesh(geometry, material);

        const uVector = getAxisVector(context.axes.u);
        const vVector = getAxisVector(context.axes.v);
        const normalVector = new THREE.Vector3().crossVectors(uVector, vVector).normalize();
        const basisMatrix = new THREE.Matrix4().makeBasis(uVector, vVector, normalVector);

        mesh.quaternion.setFromRotationMatrix(basisMatrix);
        mesh.position.copy(context.center);

        const offset = toFiniteNumber(this.config.overlayOffset, 0.04);
        if (Math.abs(offset) > FLOAT_EPSILON) {
            mesh.position.addScaledVector(getAxisVector(context.axes.fixed), offset);
        }

        mesh.renderOrder = 10;
        mesh.userData.heatmapRole = 'surface';
        mesh.userData.heatmapComponentId = this.config.id || this.name;
        return mesh;
    }

    buildSurfaceOverlayGeometry(context) {
        const baseGeometry = context.targetMesh.geometry;
        const geometry = baseGeometry.clone();
        const positionAttribute = geometry.getAttribute('position');
        if (!positionAttribute) {
            return null;
        }

        const uvArray = new Float32Array(positionAttribute.count * 2);
        for (let index = 0; index < positionAttribute.count; index += 1) {
            const point = {
                x: positionAttribute.getX(index),
                y: positionAttribute.getY(index),
                z: positionAttribute.getZ(index)
            };
            const u = (getAxisValue(point, context.axes.u) - context.minU) / Math.max(FLOAT_EPSILON, context.sizeU);
            const v = (getAxisValue(point, context.axes.v) - context.minV) / Math.max(FLOAT_EPSILON, context.sizeV);

            uvArray[index * 2] = clamp(u, 0, 1);
            uvArray[index * 2 + 1] = clamp(v, 0, 1);
        }

        geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
        return geometry;
    }

    getSurfaceOffsetVector(context) {
        const localNormal = getAxisVector(context.axes.fixed);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(context.targetMesh.matrixWorld);
        return localNormal.applyMatrix3(normalMatrix).normalize();
    }

    applySurfaceTransform(mesh, context) {
        context.targetMesh.updateWorldMatrix?.(true, false);
        context.targetMesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);

        const offset = toFiniteNumber(this.config.overlayOffset, 0.04);
        if (Math.abs(offset) > FLOAT_EPSILON) {
            mesh.position.addScaledVector(this.getSurfaceOffsetVector(context), offset);
        }
    }

    createSurfaceOverlayMesh(context, texture) {
        const geometry = this.buildSurfaceOverlayGeometry(context);
        if (!geometry) return null;

        const material = this.createOverlayMaterial(texture);
        const mesh = new THREE.Mesh(geometry, material);
        this.applySurfaceTransform(mesh, context);

        mesh.renderOrder = (context.targetMesh.renderOrder || 0) + 1;
        mesh.userData.heatmapRole = 'surface';
        mesh.userData.heatmapComponentId = this.config.id || this.name;
        return mesh;
    }

    getMarkerLiftVector(context) {
        if (context?.type === 'surface') {
            return this.getSurfaceOffsetVector(context);
        }

        return getAxisVector(context?.axes?.fixed || 'y');
    }

    createPointMarkers(points, valueRange, context) {
        if (!this.config.showPointMarkers || points.length === 0) {
            return null;
        }

        const markerSize = Math.max(0.05, toFiniteNumber(this.config.pointMarkerSize, 0.35));
        const markerOpacity = clamp(toFiniteNumber(this.config.pointMarkerOpacity, 0.92), 0, 1);
        const geometry = new THREE.SphereGeometry(0.5, 10, 10);
        const material = new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: markerOpacity,
            depthWrite: false,
            depthTest: true,
            toneMapped: false,
            vertexColors: true
        });

        Object.assign(material, this.getBlendingConfig(this.config.blending));

        const mesh = new THREE.InstancedMesh(geometry, material, points.length);
        const dummy = new THREE.Object3D();
        const liftVector = this.getMarkerLiftVector(context);

        points.forEach((point, index) => {
            const scale = markerSize * lerp(0.75, 1.6, point.normalizedValue);
            dummy.position.copy(point.worldPosition).addScaledVector(liftVector, markerSize * 0.6);
            dummy.scale.setScalar(Math.max(0.05, scale));
            dummy.updateMatrix();

            mesh.setMatrixAt(index, dummy.matrix);
            mesh.setColorAt(index, this.getColorByGradient(point.value, valueRange.min, valueRange.max));
        });

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }

        mesh.renderOrder = 11;
        mesh.userData.heatmapRole = 'points';
        mesh.userData.heatmapComponentId = this.config.id || this.name;
        return mesh;
    }

    syncSurfaceOverlayTransform() {
        if (
            !this.heatSurfaceMesh ||
            this.lastProjectionContext?.type !== 'surface' ||
            !this.lastProjectionContext?.targetMesh
        ) {
            return;
        }

        this.applySurfaceTransform(this.heatSurfaceMesh, this.lastProjectionContext);
    }

    sampleHeatAtWorldPosition(worldPosition) {
        if (!this.lastHeatField || !this.lastProjectionContext) {
            return null;
        }

        const point = worldPosition?.isVector3
            ? worldPosition.clone()
            : new THREE.Vector3(
                toFiniteNumber(worldPosition?.x, 0),
                toFiniteNumber(worldPosition?.y, 0),
                toFiniteNumber(worldPosition?.z, 0)
            );

        const coordinates = this.projectWorldPositionToContext(point, this.lastProjectionContext);
        const { minU, minV, stepU, stepV, resolution, normalizedValues } = this.lastHeatField;

        if (
            coordinates.u < this.lastProjectionContext.minU ||
            coordinates.u > this.lastProjectionContext.maxU ||
            coordinates.v < this.lastProjectionContext.minV ||
            coordinates.v > this.lastProjectionContext.maxV
        ) {
            return {
                inside: false,
                normalized: 0,
                value: this.lastValueRange.min
            };
        }

        const x = clamp(Math.floor((coordinates.u - minU) / stepU), 0, resolution - 1);
        const y = clamp(Math.floor((coordinates.v - minV) / stepV), 0, resolution - 1);
        const index = y * resolution + x;
        const normalized = normalizedValues?.[index] ?? 0;

        return {
            inside: true,
            normalized,
            value: this.lastValueRange.min + normalized * (this.lastValueRange.max - this.lastValueRange.min),
            grid: { x, y }
        };
    }

    getLegendStops() {
        return this.buildColorRamp(this.lastValueRange).map((item) => ({
            stop: item.stop,
            value: this.lastValueRange.min + item.stop * (this.lastValueRange.max - this.lastValueRange.min),
            color: toColorHex(item.color)
        }));
    }

    getLastRenderInfo() {
        return { ...this.lastRenderInfo };
    }

    getInteractiveObjects() {
        const objects = [];
        if (this.heatSurfaceMesh) objects.push(this.heatSurfaceMesh);
        if (this.pointMarkersMesh) objects.push(this.pointMarkersMesh);
        return objects;
    }

    renderHeatmap() {
        this.clearHeatmapMeshes();

        const source = Array.isArray(this.config.data) ? this.config.data : [];
        const normalizedPoints = source
            .map((item, index) => this.normalizePoint(item, index))
            .filter(Boolean);

        const threshold = toFiniteNumber(this.config.threshold, 0);
        const visiblePoints = normalizedPoints.filter((item) => item.value >= threshold);
        const valueRange = this.getValueRange(visiblePoints);
        const preparedPoints = this.preparePoints(visiblePoints, valueRange);
        const requestedRenderMode = this.getRenderMode();

        if (preparedPoints.length === 0) {
            this.lastRenderInfo = {
                requestedRenderMode,
                actualRenderMode: requestedRenderMode,
                pointCount: 0,
                clippedPoints: 0,
                resolution: 0,
                warning: ''
            };
            this.lastValueRange = valueRange;
            return;
        }

        const context = this.resolveRenderContext(preparedPoints);
        if (!context) {
            this.lastRenderInfo = {
                requestedRenderMode,
                actualRenderMode: requestedRenderMode,
                pointCount: 0,
                clippedPoints: 0,
                resolution: 0,
                warning: 'Failed to resolve heatmap render context'
            };
            this.lastValueRange = valueRange;
            return;
        }

        const projectedPoints = this.projectPointsForContext(preparedPoints, context);
        const warning = context.fallbackFromSurface
            ? 'Target mesh not found, fallback to plane mode'
            : '';

        const heatField = this.buildHeatField(projectedPoints, context);
        if (heatField) {
            const { texture, normalizedValues } = this.createHeatTexture(heatField, valueRange);
            heatField.normalizedValues = normalizedValues;

            const surfaceMesh = context.type === 'surface'
                ? this.createSurfaceOverlayMesh(context, texture)
                : this.createPlaneOverlayMesh(context, texture);

            if (surfaceMesh) {
                this.heatGroup.add(surfaceMesh);
                this.heatSurfaceMesh = surfaceMesh;
            } else {
                texture.dispose();
            }
        }

        const pointMarkers = this.createPointMarkers(projectedPoints, valueRange, context);
        if (pointMarkers) {
            this.heatGroup.add(pointMarkers);
            this.pointMarkersMesh = pointMarkers;
        }

        this.lastResolvedTargetMesh = context.targetMesh || null;
        this.lastProjectionContext = context;
        this.lastHeatField = heatField;
        this.lastValueRange = valueRange;
        this.lastRenderInfo = {
            requestedRenderMode,
            actualRenderMode: context.type,
            pointCount: projectedPoints.length,
            clippedPoints: context.clippedPoints || 0,
            resolution: heatField?.resolution || 0,
            warning,
            targetMeshName: context.targetMesh?.name || ''
        };
    }

    onDispose() {
        this.clearHeatmapMeshes();
        this.heatGroup.clear();
    }
}

export default Heatmap;
