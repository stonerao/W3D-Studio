import * as THREE from 'three';
import { watch } from 'vue';
import { useComponentStore } from '../stores/useComponentStore';
import { useLargeSceneStore } from '../stores/useLargeSceneStore';
import { useSceneStore } from '../stores/useSceneStore';
import { useEventSystem } from './useEventSystem';
import { tagInstanceForPicking } from '../utils/picking';
import { getComponent } from '../utils/componentRegistry';

let initialized = false;
let timerId = null;
let stopRefreshWatch = null;
let stopSettingsWatch = null;

const GOVERNANCE_DIMENSIONS = ['zone', 'floor', 'chunk'];
const LOD_LEVEL_TEXT = {
    high: '高精度',
    medium: '中精度',
    low: '低精度'
};
const LOAD_STATE_TEXT = {
    loaded: '已加载',
    unloaded: '已释放',
    loading: '加载中',
    unloading: '释放中'
};

const componentSnapshotCache = new Map();
const componentLoadState = new Map();
const manifestResourceSnapshotCache = new Map();
const manifestResourceLoadState = new Map();
const manifestRuntimeInstances = new Map();
const chunkRuntimeState = new Map();
const chunkOperations = new Map();

const EMPTY_CHUNK_STREAMING_RESULT = Object.freeze({
    chunkEntries: [],
    chunkDiagnostics: []
});

const tempVector = new THREE.Vector3();
const tempCenterVector = new THREE.Vector3();
const tempSizeVector = new THREE.Vector3();
const tempBox = new THREE.Box3();

const normalizePositiveNumber = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return numeric;
};

const normalizeRatio = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.min(1, Math.max(0.001, numeric));
};

const normalizeModelGovernance = (value = {}) => ({
    enabled: Boolean(value?.enabled),
    organization: {
        zone: String(value?.organization?.zone || '').trim(),
        floor: String(value?.organization?.floor || '').trim(),
        chunk: String(value?.organization?.chunk || '').trim()
    },
    distanceCulling: {
        enabled: Boolean(value?.distanceCulling?.enabled),
        maxVisibleDistance: normalizePositiveNumber(value?.distanceCulling?.maxVisibleDistance, 800)
    },
    lod: {
        enabled: Boolean(value?.lod?.enabled),
        midDistance: normalizePositiveNumber(value?.lod?.midDistance, 280),
        farDistance: normalizePositiveNumber(value?.lod?.farDistance, 560),
        mediumMeshRatio: normalizeRatio(value?.lod?.mediumMeshRatio, 0.015),
        lowMeshRatio: normalizeRatio(value?.lod?.lowMeshRatio, 0.04),
        preserveInteractiveMeshes: value?.lod?.preserveInteractiveMeshes !== false
    },
    streaming: {
        enabled: Boolean(value?.streaming?.enabled)
    },
    thresholds: {
        trianglesWarning: Number(value?.thresholds?.trianglesWarning) || 0,
        meshesWarning: Number(value?.thresholds?.meshesWarning) || 0
    }
});

const getComponentRoot = (instance) => {
    return instance?.componentScene || instance?.group || instance?.object3d || instance?.mesh || null;
};

const formatDistance = (value) => {
    if (!Number.isFinite(value)) {
        return '-';
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} km`;
    }
    return `${value.toFixed(1)} m`;
};

const isInteractiveMesh = (component, meshName) => {
    const interactiveMeshes = component?.config?.interactiveMeshes;
    const eventInteractiveMeshes = component?.config?.eventInteractiveMeshes;
    if (interactiveMeshes === '*' || eventInteractiveMeshes === '*') {
        return true;
    }
    return (
        (Array.isArray(interactiveMeshes) && interactiveMeshes.includes(meshName)) ||
        (Array.isArray(eventInteractiveMeshes) && eventInteractiveMeshes.includes(meshName))
    );
};

const getMeshBaseVisible = (component, meshName) => {
    return component?.config?.mesh?.[meshName]?.visible !== false;
};

const getLodLevel = (governance, distance) => {
    if (!governance.enabled || !governance.lod.enabled || !Number.isFinite(distance)) {
        return 'high';
    }

    const farDistance = Math.max(governance.lod.farDistance, governance.lod.midDistance + 20);
    if (distance >= farDistance) {
        return 'low';
    }
    if (distance >= governance.lod.midDistance) {
        return 'medium';
    }
    return 'high';
};

const getMeshSizeRatio = (mesh, modelMaxDim) => {
    if (!mesh || !modelMaxDim) {
        return 1;
    }

    const cachedRatio = Number(mesh.userData?.__w3dLargeSceneSizeRatio);
    const cachedSource = Number(mesh.userData?.__w3dLargeSceneModelMaxDim);
    if (Number.isFinite(cachedRatio) && cachedSource === modelMaxDim) {
        return cachedRatio;
    }

    tempBox.setFromObject(mesh);
    tempBox.getSize(tempSizeVector);
    const meshMaxDim = Math.max(tempSizeVector.x, tempSizeVector.y, tempSizeVector.z);
    const ratio = modelMaxDim > 0 ? Math.min(1, Math.max(0, meshMaxDim / modelMaxDim)) : 1;

    mesh.userData.__w3dLargeSceneSizeRatio = ratio;
    mesh.userData.__w3dLargeSceneModelMaxDim = modelMaxDim;

    return ratio;
};

const createRecommendedCullingDistance = (diagnostic, globalThresholds) => {
    const sizeBased = Math.round(Math.max(180, (diagnostic.boundsMaxDim || 20) * 12));
    const distanceBased = Number.isFinite(diagnostic.distance)
        ? Math.round(Math.max(diagnostic.distance * 1.15, globalThresholds.modelDistanceWarning))
        : globalThresholds.modelDistanceWarning;
    return Math.min(5000, Math.max(sizeBased, distanceBased));
};

const createRecommendedLodConfig = (diagnostic) => {
    const farDistance = diagnostic.maxVisibleDistance > 0
        ? Math.max(260, Math.round(diagnostic.maxVisibleDistance * 0.65))
        : (Number.isFinite(diagnostic.distance) ? Math.max(260, Math.round(diagnostic.distance * 0.8)) : 560);
    const midDistance = Math.max(120, Math.round(farDistance * 0.5));
    const lowMeshRatio = diagnostic.meshCount >= 600 ? 0.05 : 0.04;
    const mediumMeshRatio = diagnostic.meshCount >= 300 ? 0.02 : 0.015;

    return {
        enabled: true,
        midDistance,
        farDistance: Math.max(farDistance, midDistance + 80),
        mediumMeshRatio,
        lowMeshRatio,
        preserveInteractiveMeshes: true
    };
};

const buildModelRiskFlags = (diagnostic, globalThresholds) => {
    const flags = [];

    if (diagnostic.triangles >= (diagnostic.modelTrianglesWarning || globalThresholds.modelTrianglesWarning)) {
        flags.push(`三角面 ${diagnostic.triangles.toLocaleString('zh-CN')}`);
    }
    if (diagnostic.meshCount >= (diagnostic.modelMeshesWarning || globalThresholds.modelMeshesWarning)) {
        flags.push(`Mesh ${diagnostic.meshCount}`);
    }
    if (Number.isFinite(diagnostic.distance) && diagnostic.distance >= globalThresholds.modelDistanceWarning) {
        flags.push(`距离 ${formatDistance(diagnostic.distance)}`);
    }
    if (diagnostic.culled) {
        flags.push('已被距离治理隐藏');
    }
    if (diagnostic.hiddenMeshCount > 0 && diagnostic.lodEnabled) {
        flags.push(`LOD 隐藏 ${diagnostic.hiddenMeshCount} Mesh`);
    }
    if (diagnostic.streamingEnabled && diagnostic.loadState === 'unloaded') {
        flags.push('已按分块释放');
    }

    return flags;
};

const buildSuggestions = (diagnostic, globalThresholds) => {
    const suggestions = [];

    if (diagnostic.riskFlags.length > 0 && !diagnostic.governanceEnabled) {
        suggestions.push({
            id: 'enable-governance',
            label: '启用治理',
            patch: {
                enabled: true
            }
        });
    }

    if (
        (diagnostic.triangles >= globalThresholds.modelTrianglesWarning || diagnostic.meshCount >= globalThresholds.modelMeshesWarning) &&
        !diagnostic.lodEnabled
    ) {
        suggestions.push({
            id: 'enable-lod',
            label: '启用 LOD',
            patch: {
                enabled: true,
                lod: createRecommendedLodConfig(diagnostic)
            }
        });
    }

    if (diagnostic.organization.chunk && !diagnostic.streamingEnabled) {
        suggestions.push({
            id: 'enable-streaming',
            label: '加入分块流式',
            patch: {
                enabled: true,
                streaming: {
                    enabled: true
                }
            }
        });
    }

    if (Number.isFinite(diagnostic.distance) && diagnostic.distance >= globalThresholds.modelDistanceWarning && !diagnostic.distanceCullingEnabled) {
        const maxVisibleDistance = createRecommendedCullingDistance(diagnostic, globalThresholds);
        suggestions.push({
            id: 'enable-distance-culling',
            label: `启用 ${maxVisibleDistance}m 裁剪`,
            patch: {
                enabled: true,
                distanceCulling: {
                    enabled: true,
                    maxVisibleDistance
                }
            }
        });
    }

    return suggestions.slice(0, 4);
};

const getComponentSnapshotFallback = (component) => {
    const configPosition = Array.isArray(component?.config?.position) ? component.config.position : [0, 0, 0];
    return {
        geometryStats: {
            vertices: 0,
            triangles: 0
        },
        meshCount: 0,
        bounds: {
            center: [Number(configPosition[0]) || 0, Number(configPosition[1]) || 0, Number(configPosition[2]) || 0],
            size: [0, 0, 0],
            maxDim: 0,
            min: [0, 0, 0],
            max: [0, 0, 0]
        }
    };
};

const buildGeometryStatsFromMeshes = (meshes = [], fallback = {}) => {
    let vertices = 0;
    let triangles = 0;

    meshes.forEach((mesh) => {
        if (!mesh?.isMesh || !mesh.geometry) {
            return;
        }

        const geometry = mesh.geometry;
        const positionAttr = geometry.attributes?.position;
        if (positionAttr?.count) {
            vertices += positionAttr.count;
        }

        const indexAttr = geometry.index;
        if (indexAttr?.count) {
            triangles += indexAttr.count / 3;
        } else if (positionAttr?.count) {
            triangles += positionAttr.count / 3;
        }
    });

    return {
        vertices: Math.floor(vertices || Number(fallback?.vertices) || 0),
        triangles: Math.floor(triangles || Number(fallback?.triangles) || 0)
    };
};

const buildMemoryStatsFromMeshes = (meshes = [], fallback = {}) => {
    const geometryIds = new Set();
    const textureIds = new Set();

    meshes.forEach((mesh) => {
        const geometryId = mesh?.geometry?.uuid || mesh?.geometry?.id;
        if (geometryId) {
            geometryIds.add(String(geometryId));
        }

        const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material].filter(Boolean);
        materials.forEach((material) => {
            Object.values(material || {}).forEach((value) => {
                if (value?.isTexture) {
                    textureIds.add(String(value.uuid || value.id || ''));
                }
            });
        });
    });

    return {
        geometries: geometryIds.size || Number(fallback?.geometries) || meshes.length || 0,
        textures: textureIds.size || Number(fallback?.textures) || 0
    };
};

const normalizeBoundsSnapshot = (bounds, fallbackBounds = {}) => ({
    center: Array.isArray(bounds?.center) ? bounds.center : (fallbackBounds.center || [0, 0, 0]),
    size: Array.isArray(bounds?.size) ? bounds.size : (fallbackBounds.size || [0, 0, 0]),
    maxDim: Number(bounds?.maxDim) || Number(fallbackBounds.maxDim) || 0,
    min: Array.isArray(bounds?.min) ? bounds.min : (fallbackBounds.min || [0, 0, 0]),
    max: Array.isArray(bounds?.max) ? bounds.max : (fallbackBounds.max || [0, 0, 0])
});

const readWorldMatrix = (object) => {
    if (!object) {
        return null;
    }

    object.updateWorldMatrix?.(true, false);
    const elements = object.matrixWorld?.elements;
    return Array.isArray(elements) || elements?.length === 16 ? Array.from(elements) : null;
};

const isSameWorldMatrix = (left, right) => {
    if (!left || !right || left.length !== right.length) {
        return false;
    }

    for (let index = 0; index < left.length; index += 1) {
        if (Math.abs(Number(left[index]) - Number(right[index])) > 1e-6) {
            return false;
        }
    }

    return true;
};

const cacheComponentSnapshot = (component) => {
    const fallback = getComponentSnapshotFallback(component);
    if (!component?.instance) {
        return componentSnapshotCache.get(component?.id) || fallback;
    }

    const instance = component.instance;
    const root = getComponentRoot(instance);
    const worldMatrix = readWorldMatrix(root);
    const cached = componentSnapshotCache.get(component.id);

    if (
        cached?.instance === instance
        && cached.meshCount > 0
        && isSameWorldMatrix(cached.worldMatrix, worldMatrix)
    ) {
        return cached;
    }

    const meshes = cached?.instance === instance && Array.isArray(cached.meshes)
        ? cached.meshes
        : (instance.getAllMeshes?.() || []);
    const geometryStats = cached?.instance === instance
        ? cached.geometryStats
        : buildGeometryStatsFromMeshes(meshes);
    const memoryStats = cached?.instance === instance
        ? cached.memoryStats
        : buildMemoryStatsFromMeshes(meshes);
    const bounds = normalizeBoundsSnapshot(instance.getBounds?.(), fallback.bounds);

    const snapshot = {
        instance,
        meshes,
        meshCount: meshes.length,
        geometryStats,
        memoryStats,
        bounds,
        worldMatrix
    };

    componentSnapshotCache.set(component.id, snapshot);
    return snapshot;
};

const getLoadState = (component) => {
    if (componentLoadState.has(component.id)) {
        return componentLoadState.get(component.id);
    }
    return component.instance ? 'loaded' : 'unloaded';
};

const setLoadState = (componentId, state) => {
    componentLoadState.set(componentId, state);
};

const getManifestResourceRuntimeId = (chunkKey, resourceId) => `manifest:${chunkKey}:${resourceId}`;

const getManifestResourceName = (chunkKey, resourceId) => `__w3d_chunk__${chunkKey}__${resourceId}`;

const getManifestResourceFallback = (resource) => ({
    geometryStats: {
        vertices: Number(resource?.stats?.vertices) || 0,
        triangles: Number(resource?.stats?.triangles) || 0
    },
    memoryStats: {
        geometries: Number(resource?.stats?.geometries) || Number(resource?.stats?.meshCount) || 0,
        textures: Number(resource?.stats?.textures) || 0
    },
    meshCount: Number(resource?.stats?.meshCount) || 0,
    bounds: {
        center: Array.isArray(resource?.center) ? resource.center : [0, 0, 0],
        size: [0, 0, 0],
        maxDim: Number(resource?.stats?.boundsMaxDim) || 0,
        min: [0, 0, 0],
        max: [0, 0, 0]
    }
});

const getManifestResourceState = (resourceKey) => {
    if (manifestResourceLoadState.has(resourceKey)) {
        return manifestResourceLoadState.get(resourceKey);
    }
    return manifestRuntimeInstances.has(resourceKey) ? 'loaded' : 'unloaded';
};

const setManifestResourceState = (resourceKey, state) => {
    manifestResourceLoadState.set(resourceKey, state);
};

const cacheManifestResourceSnapshot = (resourceKey, resource, instance = null) => {
    const fallback = getManifestResourceFallback(resource);
    if (!instance) {
        const cached = manifestResourceSnapshotCache.get(resourceKey) || fallback;
        manifestResourceSnapshotCache.set(resourceKey, cached);
        return cached;
    }

    const root = getComponentRoot(instance);
    const worldMatrix = readWorldMatrix(root);
    const cached = manifestResourceSnapshotCache.get(resourceKey);

    if (
        cached?.instance === instance
        && cached.meshCount > 0
        && isSameWorldMatrix(cached.worldMatrix, worldMatrix)
    ) {
        return cached;
    }

    const meshes = cached?.instance === instance && Array.isArray(cached.meshes)
        ? cached.meshes
        : (instance.getAllMeshes?.() || []);
    const geometryStats = cached?.instance === instance
        ? cached.geometryStats
        : buildGeometryStatsFromMeshes(meshes, fallback.geometryStats);
    const memoryStats = cached?.instance === instance
        ? cached.memoryStats
        : buildMemoryStatsFromMeshes(meshes, fallback.memoryStats);
    const bounds = normalizeBoundsSnapshot(instance.getBounds?.(), fallback.bounds);

    const snapshot = {
        instance,
        meshes,
        meshCount: meshes.length || Number(resource?.stats?.meshCount) || 0,
        geometryStats,
        memoryStats,
        bounds,
        worldMatrix
    };

    manifestResourceSnapshotCache.set(resourceKey, snapshot);
    return snapshot;
};

const restoreLoadedModelVisualState = (component) => {
    if (component.type !== 'ModelLoader' || !component.instance) {
        return;
    }

    const root = getComponentRoot(component.instance);
    if (root) {
        root.visible = component.visible !== false;
    }

    const meshes = component.instance.getAllMeshes?.() || [];
    const baseCastShadow = component.config?.castShadow === true;
    const baseReceiveShadow = component.config?.receiveShadow === true;

    if (component.instance.performanceBatchState) {
        component.instance.setPerformanceRenderVisible?.(component.visible !== false);
        const renderMeshes = component.instance.getRenderableMeshListSnapshot?.() || [];
        renderMeshes.forEach((mesh) => {
            mesh.castShadow = baseCastShadow;
            mesh.receiveShadow = baseReceiveShadow;
        });
        return;
    }

    meshes.forEach((mesh) => {
        if (!mesh) {
            return;
        }
        mesh.visible = getMeshBaseVisible(component, mesh.name);
        mesh.castShadow = baseCastShadow;
        mesh.receiveShadow = baseReceiveShadow;
    });
};

const getComponentCenter = (component) => {
    const snapshot = componentSnapshotCache.get(component.id) || getComponentSnapshotFallback(component);
    return Array.isArray(snapshot.bounds?.center) ? snapshot.bounds.center : [0, 0, 0];
};

const getChunkEntries = (components, manifest) => {
    const chunkMap = new Map();

    (Array.isArray(manifest?.chunks) ? manifest.chunks : []).forEach((chunk) => {
        const chunkKey = String(chunk?.key || '').trim();
        if (!chunkKey) {
            return;
        }

        chunkMap.set(chunkKey, {
            key: chunkKey,
            componentMembers: [],
            manifestResources: Array.isArray(chunk.resources) ? chunk.resources : [],
            manifestChunk: chunk,
            organization: chunk.organization || {
                zone: '',
                floor: '',
                chunk: chunkKey
            }
        });
    });

    components.forEach((component) => {
        const governance = normalizeModelGovernance(component.config?.largeScene || {});
        const chunkKey = governance.organization.chunk;
        cacheComponentSnapshot(component);
        if (!chunkKey || !governance.streaming.enabled) {
            return;
        }

        if (!chunkMap.has(chunkKey)) {
            chunkMap.set(chunkKey, {
                key: chunkKey,
                componentMembers: [],
                manifestResources: [],
                manifestChunk: null,
                organization: governance.organization
            });
        }

        chunkMap.get(chunkKey).componentMembers.push({
            component,
            governance
        });
    });

    return chunkMap;
};

const getChunkCenter = (entry) => {
    if (Array.isArray(entry?.manifestChunk?.center) && entry.manifestChunk.center.length === 3) {
        return entry.manifestChunk.center;
    }

    const total = [0, 0, 0];
    let count = 0;

    (entry?.componentMembers || []).forEach(({ component }) => {
        const center = getComponentCenter(component);
        total[0] += Number(center[0]) || 0;
        total[1] += Number(center[1]) || 0;
        total[2] += Number(center[2]) || 0;
        count += 1;
    });

    (entry?.manifestResources || []).forEach((resource) => {
        const center = Array.isArray(resource.center) ? resource.center : [0, 0, 0];
        total[0] += Number(center[0]) || 0;
        total[1] += Number(center[1]) || 0;
        total[2] += Number(center[2]) || 0;
        count += 1;
    });

    if (!count) {
        return [0, 0, 0];
    }

    return [total[0] / count, total[1] / count, total[2] / count];
};

const getChunkDistance = (cameraPosition, center) => {
    if (!cameraPosition || !Array.isArray(center) || center.length !== 3) {
        return null;
    }
    tempCenterVector.set(center[0], center[1], center[2]);
    return cameraPosition.distanceTo(tempCenterVector);
};

const shouldChunkBeActive = ({ chunkKey, distance, settings, selectedComponentId, members, pinnedChunks, manualActiveChunks }) => {
    if (Array.isArray(pinnedChunks) && pinnedChunks.includes(chunkKey)) {
        return true;
    }

    if (Array.isArray(manualActiveChunks) && manualActiveChunks.includes(chunkKey)) {
        return true;
    }

    if (!settings.chunkStreaming.enabled) {
        return true;
    }

    const containsSelected = members.some(({ component }) => component.id === selectedComponentId);
    if (containsSelected) {
        return true;
    }

    if (!Number.isFinite(distance)) {
        return true;
    }

    const previous = chunkRuntimeState.get(chunkKey);
    if (distance <= settings.chunkStreaming.preloadDistance) {
        return true;
    }
    if (distance >= settings.chunkStreaming.releaseDistance) {
        return false;
    }
    return previous?.targetActive !== false;
};

const shouldChunkBePrefetched = ({ chunkKey, distance, settings, selectedComponentId, members, pinnedChunks, manualActiveChunks }) => {
    if (shouldChunkBeActive({ chunkKey, distance, settings, selectedComponentId, members, pinnedChunks, manualActiveChunks })) {
        return true;
    }

    if (!settings.chunkStreaming.enabled) {
        return true;
    }

    if (!Number.isFinite(distance)) {
        return true;
    }

    return distance <= settings.chunkStreaming.prefetchDistance;
};

const getChunkLoadPriority = ({ distance, targetActive, containsSelected, pinned, manuallyActivated }) => {
    const normalizedDistance = Number.isFinite(distance) ? distance : 999999;
    let priority = targetActive ? normalizedDistance : normalizedDistance + 100000;

    if (containsSelected) {
        priority -= 4000;
    }
    if (pinned) {
        priority -= 3000;
    }
    if (manuallyActivated) {
        priority -= 2000;
    }

    return priority;
};

const getChunkResidentStats = (entry) => {
    let triangles = 0;
    let resources = 0;
    let geometries = 0;
    let textures = 0;

    (entry?.componentMembers || []).forEach(({ component }) => {
        const snapshot = component.instance
            ? cacheComponentSnapshot(component)
            : (componentSnapshotCache.get(component.id) || getComponentSnapshotFallback(component));
        triangles += Number(snapshot?.geometryStats?.triangles) || 0;
        geometries += Number(snapshot?.memoryStats?.geometries) || 0;
        textures += Number(snapshot?.memoryStats?.textures) || 0;
        resources += 1;
    });

    (entry?.manifestResources || []).forEach((resource) => {
        const resourceKey = getManifestResourceRuntimeId(entry.key, resource.id);
        const runtime = manifestRuntimeInstances.get(resourceKey);
        const snapshot = runtime?.instance
            ? cacheManifestResourceSnapshot(resourceKey, resource, runtime.instance)
            : (manifestResourceSnapshotCache.get(resourceKey) || getManifestResourceFallback(resource));
        triangles += Number(snapshot?.geometryStats?.triangles) || 0;
        geometries += Number(snapshot?.memoryStats?.geometries) || 0;
        textures += Number(snapshot?.memoryStats?.textures) || 0;
        resources += 1;
    });

    return {
        triangles,
        resources,
        geometries,
        textures
    };
};

const getResidentBudgetUsage = (chunkEntries = []) => {
    let residentTriangles = 0;
    let residentResources = 0;
    let residentGeometries = 0;
    let residentTextures = 0;

    chunkEntries.forEach((entry) => {
        (entry?.componentMembers || []).forEach(({ component }) => {
            if (!component.instance) {
                return;
            }
            const snapshot = cacheComponentSnapshot(component);
            residentTriangles += Number(snapshot?.geometryStats?.triangles) || 0;
            residentGeometries += Number(snapshot?.memoryStats?.geometries) || 0;
            residentTextures += Number(snapshot?.memoryStats?.textures) || 0;
            residentResources += 1;
        });

        (entry?.manifestResources || []).forEach((resource) => {
            const resourceKey = getManifestResourceRuntimeId(entry.key, resource.id);
            const runtime = manifestRuntimeInstances.get(resourceKey);
            if (!runtime?.instance) {
                return;
            }
            const snapshot = cacheManifestResourceSnapshot(resourceKey, resource, runtime.instance);
            residentTriangles += Number(snapshot?.geometryStats?.triangles) || 0;
            residentGeometries += Number(snapshot?.memoryStats?.geometries) || 0;
            residentTextures += Number(snapshot?.memoryStats?.textures) || 0;
            residentResources += 1;
        });
    });

    return {
        residentTriangles,
        residentResources,
        residentGeometries,
        residentTextures
    };
};

const canFitPrefetchBudget = (settings, usage, candidateStats) => {
    const budget = settings?.chunkStreaming || {};
    if (!budget.prefetchBudgetEnabled) {
        return true;
    }

    const triangleBudget = Number(budget.maxResidentTriangles) || 0;
    const resourceBudget = Number(budget.maxResidentResources) || 0;
    const geometryBudget = Number(budget.maxResidentGeometries) || 0;
    const textureBudget = Number(budget.maxResidentTextures) || 0;
    const nextTriangles = (Number(usage?.residentTriangles) || 0) + (Number(candidateStats?.triangles) || 0);
    const nextResources = (Number(usage?.residentResources) || 0) + (Number(candidateStats?.resources) || 0);
    const nextGeometries = (Number(usage?.residentGeometries) || 0) + (Number(candidateStats?.geometries) || 0);
    const nextTextures = (Number(usage?.residentTextures) || 0) + (Number(candidateStats?.textures) || 0);

    const triangleAllowed = triangleBudget <= 0 || nextTriangles <= triangleBudget;
    const resourceAllowed = resourceBudget <= 0 || nextResources <= resourceBudget;
    const geometryAllowed = geometryBudget <= 0 || nextGeometries <= geometryBudget;
    const textureAllowed = textureBudget <= 0 || nextTextures <= textureBudget;

    return triangleAllowed && resourceAllowed && geometryAllowed && textureAllowed;
};

const unloadChunk = async (scene, entry, componentStore) => {
    for (const { component } of entry.componentMembers) {
        if (!component.instance) {
            setLoadState(component.id, 'unloaded');
            continue;
        }

        cacheComponentSnapshot(component);
        setLoadState(component.id, 'unloading');
        try {
            scene.remove(component.name);
        } catch (error) {
            component.instance?.dispose?.();
            void error;
        }
        componentStore.updateComponentInstance(component.id, null);
        setLoadState(component.id, 'unloaded');
    }

    for (const resource of entry.manifestResources) {
        const resourceKey = getManifestResourceRuntimeId(entry.key, resource.id);
        const runtime = manifestRuntimeInstances.get(resourceKey);

        if (!runtime?.instance) {
            setManifestResourceState(resourceKey, 'unloaded');
            continue;
        }

        cacheManifestResourceSnapshot(resourceKey, resource, runtime.instance);
        setManifestResourceState(resourceKey, 'unloading');
        try {
            scene.remove(runtime.name);
        } catch (error) {
            runtime.instance?.dispose?.();
            void error;
        }
        manifestRuntimeInstances.delete(resourceKey);
        setManifestResourceState(resourceKey, 'unloaded');
    }
};

    const loadChunk = async (scene, entry, componentStore, eventSystem) => {
    for (const { component } of entry.componentMembers) {
        if (component.instance) {
            cacheComponentSnapshot(component);
            setLoadState(component.id, 'loaded');
            continue;
        }

        setLoadState(component.id, 'loading');
        try {
            const finalConfig = {
                ...(component.config || {}),
                name: component.name,
                id: component.id
            };
            const instance = await scene.add(component.type, finalConfig);
            componentStore.updateComponentInstance(component.id, instance);
            if (typeof component.visible === 'boolean') {
                if (typeof instance.setVisible === 'function') {
                    instance.setVisible(component.visible, { emit: false });
                } else {
                    instance.visible = component.visible;
                }
            }
            tagInstanceForPicking(component.id, instance, {
                componentType: component.type,
                sourceType: 'component',
                runtimeOnly: false
            });
            eventSystem.attachExistingEventsToInstance(component.id);
            cacheComponentSnapshot({ ...component, instance });
            setLoadState(component.id, 'loaded');
        } catch (error) {
            console.warn(`[LargeScene] Failed to load chunk member: ${component.name}`, error);
            setLoadState(component.id, 'unloaded');
        }
    }

    for (const resource of entry.manifestResources) {
        const resourceKey = getManifestResourceRuntimeId(entry.key, resource.id);
        const existing = manifestRuntimeInstances.get(resourceKey);

        if (existing?.instance) {
            cacheManifestResourceSnapshot(resourceKey, resource, existing.instance);
            setManifestResourceState(resourceKey, 'loaded');
            continue;
        }

        setManifestResourceState(resourceKey, 'loading');

        try {
            const componentInfo = getComponent(resource.componentType);
            const finalConfig = {
                ...(componentInfo?.metadata?.defaultConfig || {}),
                ...(resource.config || {}),
                name: getManifestResourceName(entry.key, resource.id),
                id: resourceKey,
                largeScene: {
                    enabled: true,
                    organization: resource.organization || entry.organization || { chunk: entry.key }
                }
            };
            const instance = await scene.add(resource.componentType, finalConfig);
            manifestRuntimeInstances.set(resourceKey, {
                key: resourceKey,
                name: finalConfig.name,
                instance,
                resource,
                chunkKey: entry.key
            });
            tagInstanceForPicking(resourceKey, instance, {
                componentType: resource.componentType,
                sourceType: 'manifest',
                runtimeOnly: true,
                chunkKey: entry.key,
                resourceId: resource.id,
                pickable: resource.pickable !== false,
                resourceName: resource.name || resource.id
            });
            cacheManifestResourceSnapshot(resourceKey, resource, instance);
            setManifestResourceState(resourceKey, 'loaded');
        } catch (error) {
            console.warn(`[LargeScene] Failed to load manifest resource: ${resource.name}`, error);
            setManifestResourceState(resourceKey, 'unloaded');
        }
    }
};

const scheduleChunkTransition = (chunkKey, transition) => {
    if (chunkOperations.has(chunkKey)) {
        return;
    }

    const promise = transition().finally(() => {
        chunkOperations.delete(chunkKey);
    });

    chunkOperations.set(chunkKey, promise);
};

const cleanupStaleManifestResources = (scene, chunkEntries) => {
    const activeChunkKeys = new Set(chunkEntries.map((entry) => entry.key));
    const activeResourceKeys = new Set(
        chunkEntries.flatMap((entry) => entry.manifestResources.map((resource) => getManifestResourceRuntimeId(entry.key, resource.id)))
    );

    manifestRuntimeInstances.forEach((runtime, resourceKey) => {
        if (activeResourceKeys.has(resourceKey)) {
            return;
        }

        try {
            scene.remove(runtime.name);
        } catch (error) {
            runtime.instance?.dispose?.();
            void error;
        }

        manifestRuntimeInstances.delete(resourceKey);
        setManifestResourceState(resourceKey, 'unloaded');
    });

    Array.from(chunkRuntimeState.keys()).forEach((chunkKey) => {
        if (!activeChunkKeys.has(chunkKey)) {
            chunkRuntimeState.delete(chunkKey);
        }
    });
};

const hasDisabledGroupOverrides = (groupActivation = {}) => {
    return GOVERNANCE_DIMENSIONS.some((dimension) => {
        return Object.values(groupActivation?.[dimension] || {}).some((active) => active === false);
    });
};

const hasActiveLargeSceneGovernance = (components = []) => {
    return components.some((component) => {
        if (component?.type !== 'ModelLoader') {
            return false;
        }

        const governance = normalizeModelGovernance(component.config?.largeScene || {});
        if (!governance.enabled) {
            return false;
        }

        return governance.distanceCulling.enabled
            || governance.lod.enabled
            || governance.streaming.enabled
            || GOVERNANCE_DIMENSIONS.some((dimension) => Boolean(governance.organization?.[dimension]));
    });
};

export function useLargeSceneRuntime() {
    if (initialized) {
        return {};
    }

    const componentStore = useComponentStore();
    const sceneStore = useSceneStore();
    const largeSceneStore = useLargeSceneStore();
    const eventSystem = useEventSystem();

    const cleanupRuntimeArtifacts = () => {
        const scene = sceneStore.sceneInstance;

        manifestRuntimeInstances.forEach((runtime) => {
            if (scene) {
                try {
                    scene.remove(runtime.name);
                } catch (error) {
                    runtime.instance?.dispose?.();
                    void error;
                }
            }
        });

        componentStore.components.forEach((component) => {
            restoreLoadedModelVisualState(component);
        });

        manifestRuntimeInstances.clear();
        manifestResourceLoadState.clear();
        manifestResourceSnapshotCache.clear();
        chunkOperations.clear();
        chunkRuntimeState.clear();
    };

    const syncChunkStreaming = (cameraPosition) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            return EMPTY_CHUNK_STREAMING_RESULT;
        }

        const modelComponents = componentStore.components.filter((component) => component.type === 'ModelLoader');
        const chunkEntries = Array.from(getChunkEntries(modelComponents, largeSceneStore.manifest).values());
        const chunkDiagnostics = [];
        const chunkDiagnosticMap = new Map();
        const loadCandidates = [];
        const unloadCandidates = [];
        const selectedComponentId = componentStore.selectedComponentId?.value || null;
        const pinnedChunks = largeSceneStore.pinnedChunks || [];
        const manualActiveChunks = largeSceneStore.manualActiveChunks || [];

        cleanupStaleManifestResources(scene, chunkEntries);

        chunkEntries.forEach((entry) => {
            const center = getChunkCenter(entry);
            const distance = getChunkDistance(cameraPosition, center);
            const pinned = Array.isArray(pinnedChunks) && pinnedChunks.includes(entry.key);
            const manuallyActivated = Array.isArray(manualActiveChunks) && manualActiveChunks.includes(entry.key);
            const containsSelected = entry.componentMembers.some(({ component }) => component.id === selectedComponentId);
            const targetActive = shouldChunkBeActive({
                chunkKey: entry.key,
                distance,
                settings: largeSceneStore.settings,
                selectedComponentId,
                members: entry.componentMembers,
                pinnedChunks,
                manualActiveChunks
            });
            const targetResident = shouldChunkBePrefetched({
                chunkKey: entry.key,
                distance,
                settings: largeSceneStore.settings,
                selectedComponentId,
                members: entry.componentMembers,
                pinnedChunks,
                manualActiveChunks
            });
            const previous = chunkRuntimeState.get(entry.key) || {};
            const currentActive = entry.componentMembers.some(({ component }) => component.instance)
                || entry.manifestResources.some((resource) => manifestRuntimeInstances.has(getManifestResourceRuntimeId(entry.key, resource.id)));
            const hasUnloadedMembers = entry.componentMembers.some(({ component }) => !component.instance)
                || entry.manifestResources.some((resource) => !manifestRuntimeInstances.has(getManifestResourceRuntimeId(entry.key, resource.id)));

            chunkRuntimeState.set(entry.key, {
                currentActive,
                targetActive,
                targetResident,
                prefetched: targetResident && !targetActive,
                pinned,
                manuallyActivated,
                containsSelected,
                center,
                priority: getChunkLoadPriority({ distance, targetActive, containsSelected, pinned, manuallyActivated })
            });

            if (targetResident && hasUnloadedMembers && !chunkOperations.has(entry.key)) {
                loadCandidates.push({
                    entry,
                    center,
                    distance,
                    pinned,
                    manuallyActivated,
                    containsSelected,
                    targetActive,
                    targetResident,
                    priority: getChunkLoadPriority({ distance, targetActive, containsSelected, pinned, manuallyActivated })
                });
            } else if (!targetResident && currentActive && !chunkOperations.has(entry.key)) {
                unloadCandidates.push({
                    entry,
                    center,
                    pinned,
                    manuallyActivated,
                    targetActive,
                    targetResident
                });
            } else if (previous.targetActive !== targetActive || previous.targetResident !== targetResident) {
                chunkRuntimeState.set(entry.key, {
                    currentActive,
                    targetActive,
                    targetResident,
                    prefetched: targetResident && !targetActive,
                    pinned,
                    manuallyActivated,
                    containsSelected,
                    center,
                    priority: getChunkLoadPriority({ distance, targetActive, containsSelected, pinned, manuallyActivated })
                });
            }

            const componentMembers = entry.componentMembers.map(({ component }) => component);
            const manifestMembers = entry.manifestResources.map((resource) => ({
                resource,
                resourceKey: getManifestResourceRuntimeId(entry.key, resource.id),
                state: getManifestResourceState(getManifestResourceRuntimeId(entry.key, resource.id))
            }));
            const diagnostic = {
                key: entry.key,
                distance,
                distanceText: formatDistance(distance),
                targetActive,
                targetResident,
                currentActive,
                pinned,
                manuallyActivated,
                prefetched: targetResident && !targetActive,
                totalCount: componentMembers.length + manifestMembers.length,
                componentCount: componentMembers.length,
                manifestCount: manifestMembers.length,
                loadedCount: componentMembers.filter((component) => getLoadState(component) === 'loaded').length
                    + manifestMembers.filter((item) => item.state === 'loaded').length,
                unloadedCount: componentMembers.filter((component) => getLoadState(component) === 'unloaded').length
                    + manifestMembers.filter((item) => item.state === 'unloaded').length,
                loadingCount: componentMembers.filter((component) => {
                    const state = getLoadState(component);
                    return state === 'loading' || state === 'unloading';
                }).length + manifestMembers.filter((item) => item.state === 'loading' || item.state === 'unloading').length,
                riskyCount: componentMembers.filter((component) => {
                    const snapshot = componentSnapshotCache.get(component.id) || getComponentSnapshotFallback(component);
                    const governance = normalizeModelGovernance(component.config?.largeScene || {});
                    return (snapshot.geometryStats?.triangles || 0) >= (governance.thresholds.trianglesWarning || largeSceneStore.settings.thresholds.modelTrianglesWarning);
                }).length + manifestMembers.filter(({ resource, resourceKey }) => {
                    const snapshot = manifestResourceSnapshotCache.get(resourceKey) || getManifestResourceFallback(resource);
                    return (snapshot.geometryStats?.triangles || 0) >= largeSceneStore.settings.thresholds.modelTrianglesWarning;
                }).length,
                center,
                queueState: chunkOperations.has(entry.key)
                    ? (targetResident ? (targetActive ? 'loading' : 'prefetching') : 'unloading')
                    : (targetResident ? (targetActive ? 'ready' : 'prefetched') : 'idle'),
                budgetBlocked: false
            };
            chunkDiagnostics.push(diagnostic);
            chunkDiagnosticMap.set(entry.key, diagnostic);
        });

        const concurrency = Math.max(1, Number(largeSceneStore.settings.chunkStreaming?.maxConcurrentLoads) || 1);
        const residentBudgetUsage = getResidentBudgetUsage(chunkEntries);
        loadCandidates
            .sort((left, right) => left.priority - right.priority || left.entry.key.localeCompare(right.entry.key, 'zh-CN'));

        let availableSlots = Math.max(0, concurrency - chunkOperations.size);
        loadCandidates.forEach((candidate) => {
            if (availableSlots <= 0) {
                return;
            }

            const candidateStats = getChunkResidentStats(candidate.entry);
            const budgetBlocked = !candidate.targetActive && !canFitPrefetchBudget(largeSceneStore.settings, residentBudgetUsage, candidateStats);
            if (budgetBlocked) {
                const diagnostic = chunkDiagnosticMap.get(candidate.entry.key);
                if (diagnostic) {
                    diagnostic.budgetBlocked = true;
                    diagnostic.queueState = 'budget-blocked';
                }
                return;
            }

            scheduleChunkTransition(candidate.entry.key, async () => {
                await loadChunk(scene, candidate.entry, componentStore, eventSystem);
                chunkRuntimeState.set(candidate.entry.key, {
                    currentActive: true,
                    targetActive: candidate.targetActive,
                    targetResident: candidate.targetResident,
                    prefetched: candidate.targetResident && !candidate.targetActive,
                    pinned: candidate.pinned,
                    manuallyActivated: candidate.manuallyActivated,
                    containsSelected: candidate.containsSelected,
                    center: candidate.center,
                    priority: candidate.priority
                });
            });
            residentBudgetUsage.residentTriangles += candidateStats.triangles;
            residentBudgetUsage.residentResources += candidateStats.resources;
            residentBudgetUsage.residentGeometries += candidateStats.geometries;
            residentBudgetUsage.residentTextures += candidateStats.textures;
            availableSlots -= 1;
        });

        const remainingSlots = Math.max(0, concurrency - chunkOperations.size);
        unloadCandidates.slice(0, remainingSlots || unloadCandidates.length).forEach((candidate) => {
            scheduleChunkTransition(candidate.entry.key, async () => {
                await unloadChunk(scene, candidate.entry, componentStore);
                chunkRuntimeState.set(candidate.entry.key, {
                    currentActive: false,
                    targetActive: false,
                    targetResident: false,
                    prefetched: false,
                    pinned: candidate.pinned,
                    manuallyActivated: candidate.manuallyActivated,
                    containsSelected: false,
                    center: candidate.center,
                    priority: 0
                });
            });
        });

        return {
            chunkEntries,
            chunkDiagnostics: chunkDiagnostics.sort((left, right) => (right.loadedCount - left.loadedCount) || left.key.localeCompare(right.key, 'zh-CN'))
        };
    };

    const collectSnapshot = () => {
        const sceneInstance = sceneStore.sceneInstance;
        const camera = sceneInstance?.camera?.instance;
        const rendererInfo = sceneInstance?.renderer?.instance?.info;
        const thresholds = largeSceneStore.settings.thresholds;
        const groupActivation = largeSceneStore.groupActivation || {};
        const modelComponents = componentStore.components.filter((component) => component.type === 'ModelLoader');
        const diagnosticsEnabled = largeSceneStore.settings.diagnosticsEnabled === true;
        const runtimeDemand = diagnosticsEnabled
            || largeSceneStore.settings.chunkStreaming?.enabled === true
            || hasDisabledGroupOverrides(groupActivation)
            || hasActiveLargeSceneGovernance(modelComponents)
            || (Array.isArray(largeSceneStore.pinnedChunks) && largeSceneStore.pinnedChunks.length > 0)
            || (Array.isArray(largeSceneStore.manualActiveChunks) && largeSceneStore.manualActiveChunks.length > 0);

        if (!runtimeDemand) {
            const needsCleanup = manifestRuntimeInstances.size > 0
                || chunkRuntimeState.size > 0
                || chunkOperations.size > 0
                || componentSnapshotCache.size > 0
                || componentLoadState.size > 0;

            if (needsCleanup) {
                cleanupRuntimeArtifacts();
                componentSnapshotCache.clear();
                componentLoadState.clear();
            }

            largeSceneStore.setRuntimeSnapshot({
                scene: {
                    drawCalls: rendererInfo?.render?.calls || 0,
                    frameTriangles: rendererInfo?.render?.triangles || 0,
                    geometries: rendererInfo?.memory?.geometries || 0,
                    textures: rendererInfo?.memory?.textures || 0,
                    points: rendererInfo?.render?.points || 0,
                    lines: rendererInfo?.render?.lines || 0,
                    meshes: 0,
                    totalVertices: 0,
                    totalTriangles: 0
                },
                models: [],
                chunks: []
            });
            return;
        }

        const cameraPosition = camera?.position || null;
        const {
            chunkEntries = EMPTY_CHUNK_STREAMING_RESULT.chunkEntries,
            chunkDiagnostics = EMPTY_CHUNK_STREAMING_RESULT.chunkDiagnostics
        } = syncChunkStreaming(cameraPosition) || EMPTY_CHUNK_STREAMING_RESULT;

        let totalVertices = 0;
        let totalTriangles = 0;

        const componentModels = modelComponents
            .map((component) => {
                const governance = normalizeModelGovernance(component.config?.largeScene || {});
                const snapshot = cacheComponentSnapshot(component);
                const instance = component.instance;
                const root = instance ? getComponentRoot(instance) : null;
                const geometryStats = snapshot.geometryStats || { vertices: 0, triangles: 0 };
                const bounds = snapshot.bounds || getComponentSnapshotFallback(component).bounds;
                const meshes = Array.isArray(snapshot.meshes) ? snapshot.meshes : [];
                const meshCount = instance ? meshes.length : Number(snapshot.meshCount) || 0;
                const loadState = getLoadState(component);
                const chunkState = governance.organization.chunk ? chunkRuntimeState.get(governance.organization.chunk) : null;

                totalVertices += Number(geometryStats.vertices) || 0;
                totalTriangles += Number(geometryStats.triangles) || 0;

                let distance = null;
                if (cameraPosition && bounds?.center?.length === 3) {
                    tempCenterVector.set(bounds.center[0], bounds.center[1], bounds.center[2]);
                    distance = cameraPosition.distanceTo(tempCenterVector);
                } else if (cameraPosition && root?.getWorldPosition) {
                    root.getWorldPosition(tempVector);
                    distance = cameraPosition.distanceTo(tempVector);
                }

                const hiddenByOrganization = GOVERNANCE_DIMENSIONS.filter((dimension) => {
                    const tag = governance.organization[dimension];
                    return tag && groupActivation?.[dimension]?.[tag] === false;
                });

                const maxVisibleDistance = governance.distanceCulling.maxVisibleDistance;
                const culled = Boolean(
                    instance &&
                    governance.enabled &&
                    governance.distanceCulling.enabled &&
                    Number.isFinite(distance) &&
                    maxVisibleDistance > 0 &&
                    distance > maxVisibleDistance
                );

                const renderable = chunkState ? chunkState.targetActive !== false : true;
                const prefetched = Boolean(chunkState?.prefetched && loadState === 'loaded');
                const runtimeVisible = loadState === 'loaded' && renderable && component.visible !== false && hiddenByOrganization.length === 0 && !culled;
                const lodLevel = getLodLevel(governance, distance);
                const modelMaxDim = Number(bounds?.maxDim) || 0;
                const baseCastShadow = component.config?.castShadow === true;
                const baseReceiveShadow = component.config?.receiveShadow === true;

                let activeMeshCount = 0;
                let hiddenMeshCount = 0;

                if (instance?.performanceBatchState) {
                    instance.setPerformanceRenderVisible?.(runtimeVisible);
                    const renderMeshes = instance.getRenderableMeshListSnapshot?.() || [];
                    renderMeshes.forEach((mesh) => {
                        mesh.castShadow = runtimeVisible && baseCastShadow;
                        mesh.receiveShadow = runtimeVisible && baseReceiveShadow;
                    });
                    activeMeshCount = runtimeVisible ? renderMeshes.length : 0;
                    hiddenMeshCount = runtimeVisible ? 0 : meshCount;
                } else {

                    meshes.forEach((mesh) => {
                        const baseVisible = getMeshBaseVisible(component, mesh.name);
                        let lodVisible = true;

                        if (runtimeVisible && governance.enabled && governance.lod.enabled) {
                            const preserveInteractive = governance.lod.preserveInteractiveMeshes && isInteractiveMesh(component, mesh.name);
                            if (!preserveInteractive) {
                                const sizeRatio = getMeshSizeRatio(mesh, modelMaxDim);
                                if (lodLevel === 'low' && sizeRatio < governance.lod.lowMeshRatio) {
                                    lodVisible = false;
                                } else if (lodLevel === 'medium' && sizeRatio < governance.lod.mediumMeshRatio) {
                                    lodVisible = false;
                                }
                            }
                        }

                        mesh.visible = baseVisible && lodVisible;

                        if (lodLevel === 'high' || !governance.enabled || !governance.lod.enabled) {
                            mesh.castShadow = baseCastShadow;
                            mesh.receiveShadow = baseReceiveShadow;
                        } else if (lodLevel === 'medium') {
                            mesh.castShadow = false;
                            mesh.receiveShadow = baseReceiveShadow && mesh.visible;
                        } else {
                            mesh.castShadow = false;
                            mesh.receiveShadow = false;
                        }

                        if (runtimeVisible) {
                            if (mesh.visible) {
                                activeMeshCount += 1;
                            } else {
                                hiddenMeshCount += 1;
                            }
                        }
                    });
                }

                if (loadState !== 'loaded') {
                    activeMeshCount = 0;
                    hiddenMeshCount = meshCount;
                }

                if (root) {
                    root.visible = runtimeVisible;
                }

                const diagnostic = {
                    componentId: component.id,
                    componentName: component.name || component.id,
                    focusable: true,
                    runtimeOnly: false,
                    resourceSource: 'component',
                    sourceChunk: governance.organization.chunk,
                    meshCount,
                    activeMeshCount,
                    hiddenMeshCount,
                    vertices: Number(geometryStats.vertices) || 0,
                    triangles: Number(geometryStats.triangles) || 0,
                    distance,
                    distanceText: formatDistance(distance),
                    visible: runtimeVisible,
                    culled,
                    governanceEnabled: governance.enabled,
                    distanceCullingEnabled: governance.distanceCulling.enabled,
                    lodEnabled: governance.lod.enabled,
                    streamingEnabled: governance.streaming.enabled,
                    loadState,
                    loadStateText: prefetched ? '已预取' : (LOAD_STATE_TEXT[loadState] || LOAD_STATE_TEXT.loaded),
                    lodLevel,
                    lodLevelText: LOD_LEVEL_TEXT[lodLevel] || LOD_LEVEL_TEXT.high,
                    maxVisibleDistance,
                    modelTrianglesWarning: governance.thresholds.trianglesWarning,
                    modelMeshesWarning: governance.thresholds.meshesWarning,
                    boundsMaxDim: modelMaxDim,
                    organization: governance.organization,
                    hiddenByOrganization,
                    prefetched
                };

                diagnostic.riskFlags = diagnosticsEnabled
                    ? buildModelRiskFlags(diagnostic, thresholds)
                    : [];
                diagnostic.suggestions = diagnosticsEnabled
                    ? buildSuggestions(diagnostic, thresholds)
                    : [];

                return diagnostic;
            })
            .sort((left, right) => right.triangles - left.triangles || right.meshCount - left.meshCount);

        const manifestModels = chunkEntries
            .flatMap((entry) => entry.manifestResources.map((resource) => {
                const resourceKey = getManifestResourceRuntimeId(entry.key, resource.id);
                const runtime = manifestRuntimeInstances.get(resourceKey);
                const snapshot = cacheManifestResourceSnapshot(resourceKey, resource, runtime?.instance || null);
                const bounds = snapshot.bounds || getManifestResourceFallback(resource).bounds;
                const loadState = getManifestResourceState(resourceKey);
                const root = runtime?.instance ? getComponentRoot(runtime.instance) : null;
                const meshCount = Number(snapshot.meshCount) || 0;
                let distance = null;

                if (cameraPosition && bounds?.center?.length === 3) {
                    tempCenterVector.set(bounds.center[0], bounds.center[1], bounds.center[2]);
                    distance = cameraPosition.distanceTo(tempCenterVector);
                }

                const organization = resource.organization || entry.organization || { chunk: entry.key };
                const chunkState = chunkRuntimeState.get(entry.key) || null;
                const hiddenByOrganization = GOVERNANCE_DIMENSIONS.filter((dimension) => {
                    const tag = organization?.[dimension];
                    return tag && groupActivation?.[dimension]?.[tag] === false;
                });
                const prefetched = Boolean(chunkState?.prefetched && loadState === 'loaded');
                const runtimeVisible = loadState === 'loaded' && chunkState?.targetActive !== false && hiddenByOrganization.length === 0;

                if (root) {
                    root.visible = runtimeVisible;
                }

                const diagnostic = {
                    componentId: resourceKey,
                    componentName: resource.name || resource.id,
                    focusable: false,
                    runtimeOnly: true,
                    resourceSource: 'manifest',
                    sourceChunk: entry.key,
                    meshCount,
                    activeMeshCount: runtimeVisible ? meshCount : 0,
                    hiddenMeshCount: runtimeVisible ? 0 : meshCount,
                    vertices: Number(snapshot.geometryStats?.vertices) || 0,
                    triangles: Number(snapshot.geometryStats?.triangles) || 0,
                    distance,
                    distanceText: formatDistance(distance),
                    visible: runtimeVisible,
                    culled: false,
                    governanceEnabled: true,
                    distanceCullingEnabled: false,
                    lodEnabled: false,
                    streamingEnabled: true,
                    loadState,
                    loadStateText: prefetched ? '已预取' : (LOAD_STATE_TEXT[loadState] || LOAD_STATE_TEXT.loaded),
                    lodLevel: 'high',
                    lodLevelText: '清单分片',
                    maxVisibleDistance: 0,
                    modelTrianglesWarning: largeSceneStore.settings.thresholds.modelTrianglesWarning,
                    modelMeshesWarning: largeSceneStore.settings.thresholds.modelMeshesWarning,
                    boundsMaxDim: Number(bounds?.maxDim) || 0,
                    organization,
                    hiddenByOrganization,
                    suggestions: [],
                    prefetched
                };

                diagnostic.riskFlags = diagnosticsEnabled
                    ? buildModelRiskFlags(diagnostic, thresholds)
                    : [];
                return diagnostic;
            }))
            .sort((left, right) => right.triangles - left.triangles || right.meshCount - left.meshCount);

        const models = [...componentModels, ...manifestModels]
            .sort((left, right) => right.triangles - left.triangles || right.meshCount - left.meshCount);

        largeSceneStore.setRuntimeSnapshot({
            scene: {
                drawCalls: rendererInfo?.render?.calls || 0,
                frameTriangles: rendererInfo?.render?.triangles || 0,
                geometries: rendererInfo?.memory?.geometries || 0,
                textures: rendererInfo?.memory?.textures || 0,
                points: rendererInfo?.render?.points || 0,
                lines: rendererInfo?.render?.lines || 0,
                meshes: models.reduce((sum, item) => sum + item.meshCount, 0),
                totalVertices,
                totalTriangles
            },
            models,
            chunks: chunkDiagnostics
        });
    };

    const restartTimer = () => {
        if (timerId) {
            window.clearInterval(timerId);
            timerId = null;
        }

        const delay = Math.max(400, Number(largeSceneStore.settings.autoRefreshMs) || 1200);
        timerId = window.setInterval(collectSnapshot, delay);
        collectSnapshot();
    };

    stopRefreshWatch = watch(
        () => largeSceneStore.refreshNonce,
        () => {
            collectSnapshot();
        }
    );

    stopSettingsWatch = watch(
        () => [
            largeSceneStore.settings.autoRefreshMs,
            JSON.stringify(largeSceneStore.groupActivation || {}),
            JSON.stringify(largeSceneStore.settings.chunkStreaming || {})
        ],
        () => {
            restartTimer();
        }
    );

    restartTimer();
    initialized = true;

    return {
        disposeLargeSceneRuntime: () => {
            if (timerId) {
                window.clearInterval(timerId);
                timerId = null;
            }
            if (stopRefreshWatch) {
                stopRefreshWatch();
                stopRefreshWatch = null;
            }
            if (stopSettingsWatch) {
                stopSettingsWatch();
                stopSettingsWatch = null;
            }
            cleanupRuntimeArtifacts();
            componentSnapshotCache.clear();
            componentLoadState.clear();
            initialized = false;
        }
    };
}
