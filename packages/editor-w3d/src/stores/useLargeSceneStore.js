import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useProjectStore } from './useProjectStore';
import {
    createDefaultLargeSceneManifest,
    fetchLargeSceneManifest,
    getLargeSceneManifestSummary,
    normalizeLargeSceneManifest,
    parseManifestRuntimeResourceId,
    resolveManifestSourceUrl
} from '../utils/largeSceneManifest';

const GOVERNANCE_DIMENSIONS = ['zone', 'floor', 'chunk'];

const createDefaultThresholds = () => ({
    fpsWarning: 24,
    drawCallsWarning: 1500,
    frameTrianglesWarning: 1500000,
    geometriesWarning: 1200,
    texturesWarning: 256,
    modelTrianglesWarning: 250000,
    modelMeshesWarning: 300,
    modelDistanceWarning: 800
});

const createDefaultSettings = () => ({
    diagnosticsEnabled: false,
    autoRefreshMs: 1200,
    chunkStreaming: {
        enabled: false,
        preloadDistance: 450,
        prefetchDistance: 620,
        releaseDistance: 700,
        maxConcurrentLoads: 1,
        prefetchBudgetEnabled: false,
        maxResidentTriangles: 3000000,
        maxResidentResources: 12,
        maxResidentGeometries: 1200,
        maxResidentTextures: 256
    },
    thresholds: createDefaultThresholds()
});

const createDefaultGroupActivation = () => ({
    zone: {},
    floor: {},
    chunk: {}
});

const createDefaultSceneSummary = () => ({
    fps: 0,
    drawCalls: 0,
    frameTriangles: 0,
    geometries: 0,
    textures: 0,
    points: 0,
    lines: 0,
    meshes: 0,
    modelCount: 0,
    activeGovernanceCount: 0,
    visibleModelCount: 0,
    culledModelCount: 0,
    loadedModelCount: 0,
    unloadedModelCount: 0,
    loadingModelCount: 0,
    manifestResourceCount: 0,
    loadedManifestResourceCount: 0,
    chunkCount: 0,
    activeChunkCount: 0,
    totalVertices: 0,
    totalTriangles: 0,
    riskModelCount: 0
});

const clampPositiveInteger = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.round(numeric);
};

const normalizeGroupActivation = (value = {}) => {
    const normalized = createDefaultGroupActivation();

    GOVERNANCE_DIMENSIONS.forEach((dimension) => {
        const source = value?.[dimension];
        normalized[dimension] = source && typeof source === 'object'
            ? Object.fromEntries(
                Object.entries(source)
                    .filter(([key]) => typeof key === 'string' && key.trim())
                    .map(([key, enabled]) => [key.trim(), enabled !== false])
            )
            : {};
    });

    return normalized;
};

const normalizeSettings = (value = {}) => {
    const defaults = createDefaultSettings();
    const thresholds = value?.thresholds || {};

    return {
        diagnosticsEnabled: value?.diagnosticsEnabled === undefined
            ? defaults.diagnosticsEnabled
            : value?.diagnosticsEnabled !== false,
        autoRefreshMs: clampPositiveInteger(value?.autoRefreshMs, defaults.autoRefreshMs),
        chunkStreaming: {
            enabled: Boolean(value?.chunkStreaming?.enabled),
            preloadDistance: clampPositiveInteger(value?.chunkStreaming?.preloadDistance, defaults.chunkStreaming.preloadDistance),
            prefetchDistance: clampPositiveInteger(
                Math.max(
                    Number(value?.chunkStreaming?.prefetchDistance) || 0,
                    Number(value?.chunkStreaming?.preloadDistance) || defaults.chunkStreaming.preloadDistance
                ),
                defaults.chunkStreaming.prefetchDistance
            ),
            releaseDistance: clampPositiveInteger(
                Math.max(
                    Number(value?.chunkStreaming?.releaseDistance) || 0,
                    Number(value?.chunkStreaming?.prefetchDistance) || Number(value?.chunkStreaming?.preloadDistance) || defaults.chunkStreaming.preloadDistance
                ),
                defaults.chunkStreaming.releaseDistance
            ),
            maxConcurrentLoads: clampPositiveInteger(value?.chunkStreaming?.maxConcurrentLoads, defaults.chunkStreaming.maxConcurrentLoads),
            prefetchBudgetEnabled: value?.chunkStreaming?.prefetchBudgetEnabled === true,
            maxResidentTriangles: clampPositiveInteger(value?.chunkStreaming?.maxResidentTriangles, defaults.chunkStreaming.maxResidentTriangles),
            maxResidentResources: clampPositiveInteger(value?.chunkStreaming?.maxResidentResources, defaults.chunkStreaming.maxResidentResources),
            maxResidentGeometries: clampPositiveInteger(value?.chunkStreaming?.maxResidentGeometries, defaults.chunkStreaming.maxResidentGeometries),
            maxResidentTextures: clampPositiveInteger(value?.chunkStreaming?.maxResidentTextures, defaults.chunkStreaming.maxResidentTextures)
        },
        thresholds: {
            fpsWarning: clampPositiveInteger(thresholds.fpsWarning, defaults.thresholds.fpsWarning),
            drawCallsWarning: clampPositiveInteger(thresholds.drawCallsWarning, defaults.thresholds.drawCallsWarning),
            frameTrianglesWarning: clampPositiveInteger(thresholds.frameTrianglesWarning, defaults.thresholds.frameTrianglesWarning),
            geometriesWarning: clampPositiveInteger(thresholds.geometriesWarning, defaults.thresholds.geometriesWarning),
            texturesWarning: clampPositiveInteger(thresholds.texturesWarning, defaults.thresholds.texturesWarning),
            modelTrianglesWarning: clampPositiveInteger(thresholds.modelTrianglesWarning, defaults.thresholds.modelTrianglesWarning),
            modelMeshesWarning: clampPositiveInteger(thresholds.modelMeshesWarning, defaults.thresholds.modelMeshesWarning),
            modelDistanceWarning: clampPositiveInteger(thresholds.modelDistanceWarning, defaults.thresholds.modelDistanceWarning)
        }
    };
};

export const useLargeSceneStore = defineStore('large-scene', () => {
    const projectStore = useProjectStore();

    const settings = ref(createDefaultSettings());
    const groupActivation = ref(createDefaultGroupActivation());
    const pinnedChunks = ref([]);
    const manualActiveChunks = ref([]);
    const manifest = ref(createDefaultLargeSceneManifest());
    const manifestFetchState = ref({
        loading: false,
        loadedAt: '',
        error: '',
        resolvedUrl: '',
        fromCache: false,
        cacheStatus: 'idle',
        versionTag: '',
        etag: '',
        lastModified: '',
        fallbackReason: ''
    });
    const currentFps = ref(0);
    const sceneSummary = ref(createDefaultSceneSummary());
    const modelDiagnostics = ref([]);
    const chunkDiagnostics = ref([]);
    const lastUpdatedAt = ref('');
    const refreshNonce = ref(0);

    const rehydrateSettingsFromProject = () => {
        const next = projectStore.getLargeSceneGovernanceState?.() || {};
        settings.value = normalizeSettings(next.settings || {});
        groupActivation.value = normalizeGroupActivation(next.groupActivation || {});
        pinnedChunks.value = Array.isArray(next.pinnedChunks)
            ? next.pinnedChunks.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
            : [];
        manifest.value = normalizeLargeSceneManifest(next.manifest || {});
    };

    const persistSettings = (markUnsaved = true) => {
        projectStore.setLargeSceneGovernanceState?.({
            settings: settings.value,
            groupActivation: groupActivation.value,
            pinnedChunks: pinnedChunks.value,
            manifest: manifest.value,
            markUnsaved
        });
    };

    const setManifest = (nextManifest, { markUnsaved = true } = {}) => {
        manifest.value = normalizeLargeSceneManifest(nextManifest || {});
        persistSettings(markUnsaved);
    };

    const clearManifest = ({ markUnsaved = true } = {}) => {
        manifest.value = createDefaultLargeSceneManifest();
        manifestFetchState.value = {
            loading: false,
            loadedAt: '',
            error: '',
            resolvedUrl: '',
            fromCache: false,
            cacheStatus: 'idle',
            versionTag: '',
            etag: '',
            lastModified: '',
            fallbackReason: ''
        };
        persistSettings(markUnsaved);
    };

    const updateManifestResource = (chunkKey = '', resourceId = '', patch = {}, { markUnsaved = true } = {}) => {
        const normalizedChunkKey = String(chunkKey || '').trim();
        const normalizedResourceId = String(resourceId || '').trim();
        if (!normalizedChunkKey || !normalizedResourceId) {
            return null;
        }

        let hasChanged = false;
        manifest.value = normalizeLargeSceneManifest({
            ...manifest.value,
            chunks: (manifest.value?.chunks || []).map((chunk) => {
                if (chunk.key !== normalizedChunkKey) {
                    return chunk;
                }

                return {
                    ...chunk,
                    resources: (chunk.resources || []).map((resource) => {
                        if (resource.id !== normalizedResourceId) {
                            return resource;
                        }

                        hasChanged = true;
                        return {
                            ...resource,
                            ...(patch && typeof patch === 'object' ? patch : {})
                        };
                    })
                };
            })
        });

        if (hasChanged) {
            persistSettings(markUnsaved);
        }

        return hasChanged ? manifest.value : null;
    };

    const updateManifestResourceByRuntimeId = (runtimeComponentId = '', patch = {}, options = {}) => {
        const parsed = parseManifestRuntimeResourceId(runtimeComponentId);
        if (!parsed) {
            return null;
        }
        return updateManifestResource(parsed.chunkKey, parsed.resourceId, patch, options);
    };

    const updateManifestSource = (patch = {}, { markUnsaved = true } = {}) => {
        manifest.value = normalizeLargeSceneManifest({
            ...manifest.value,
            source: {
                ...(manifest.value?.source || {}),
                ...(patch || {})
            }
        });
        persistSettings(markUnsaved);
    };

    const loadManifestFromSource = async ({ markUnsaved = true, forceRefresh = false } = {}) => {
        manifestFetchState.value = {
            ...manifestFetchState.value,
            loading: true,
            error: ''
        };

        try {
            const result = await fetchLargeSceneManifest(manifest.value?.source || {}, projectStore.apiBaseUrl || '', { forceRefresh });
            manifest.value = result.manifest;
            manifestFetchState.value = {
                loading: false,
                loadedAt: new Date().toISOString(),
                error: '',
                resolvedUrl: result.resolvedUrl || resolveManifestSourceUrl(manifest.value?.source || {}, projectStore.apiBaseUrl || ''),
                fromCache: result.fromCache === true,
                cacheStatus: result.cacheStatus || manifest.value?.source?.cacheStatus || 'idle',
                versionTag: result.versionTag || manifest.value?.source?.versionTag || '',
                etag: result.etag || manifest.value?.source?.etag || '',
                lastModified: result.lastModified || manifest.value?.source?.lastModified || '',
                fallbackReason: result.fallbackReason || ''
            };
            persistSettings(markUnsaved);
            return manifest.value;
        } catch (error) {
            manifestFetchState.value = {
                ...manifestFetchState.value,
                loading: false,
                error: error?.message || 'manifest 拉取失败',
                fallbackReason: ''
            };
            throw error;
        }
    };

    const updateSettings = (patch = {}, { markUnsaved = true } = {}) => {
        settings.value = normalizeSettings({
            ...settings.value,
            ...patch,
            chunkStreaming: {
                ...settings.value.chunkStreaming,
                ...(patch.chunkStreaming || {})
            },
            thresholds: {
                ...settings.value.thresholds,
                ...(patch.thresholds || {})
            }
        });
        persistSettings(markUnsaved);
    };

    const resetSettings = ({ markUnsaved = true } = {}) => {
        settings.value = createDefaultSettings();
        persistSettings(markUnsaved);
    };

    const setCurrentFps = (value) => {
        const numeric = Number(value);
        currentFps.value = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0;
    };

    const setRuntimeSnapshot = ({ scene = {}, models = [], chunks = [] } = {}) => {
        const nextSceneSummary = {
            ...createDefaultSceneSummary(),
            ...scene,
            fps: currentFps.value || Number(scene?.fps) || 0
        };

        const normalizedModels = Array.isArray(models)
            ? models.map((item) => ({
                componentId: item.componentId || '',
                componentName: item.componentName || '',
                meshCount: Number(item.meshCount) || 0,
                vertices: Number(item.vertices) || 0,
                triangles: Number(item.triangles) || 0,
                distance: Number.isFinite(Number(item.distance)) ? Number(item.distance) : null,
                distanceText: item.distanceText || '-',
                visible: item.visible !== false,
                culled: Boolean(item.culled),
                governanceEnabled: Boolean(item.governanceEnabled),
                distanceCullingEnabled: Boolean(item.distanceCullingEnabled),
                lodEnabled: Boolean(item.lodEnabled),
                streamingEnabled: Boolean(item.streamingEnabled),
                loadState: item.loadState || 'loaded',
                loadStateText: item.loadStateText || '已加载',
                focusable: item.focusable !== false,
                runtimeOnly: Boolean(item.runtimeOnly),
                resourceSource: item.resourceSource || 'component',
                sourceChunk: item.sourceChunk || '',
                lodLevel: item.lodLevel || 'high',
                lodLevelText: item.lodLevelText || '高精度',
                maxVisibleDistance: Number(item.maxVisibleDistance) || 0,
                boundsMaxDim: Number(item.boundsMaxDim) || 0,
                activeMeshCount: Number(item.activeMeshCount) || 0,
                hiddenMeshCount: Number(item.hiddenMeshCount) || 0,
                prefetched: Boolean(item.prefetched),
                organization: {
                    zone: item.organization?.zone || '',
                    floor: item.organization?.floor || '',
                    chunk: item.organization?.chunk || ''
                },
                hiddenByOrganization: Array.isArray(item.hiddenByOrganization) ? item.hiddenByOrganization : [],
                suggestions: Array.isArray(item.suggestions) ? item.suggestions : [],
                riskFlags: Array.isArray(item.riskFlags) ? item.riskFlags : []
            }))
            : [];

        const normalizedChunks = Array.isArray(chunks)
            ? chunks.map((item) => ({
                key: item.key || '',
                distance: Number.isFinite(Number(item.distance)) ? Number(item.distance) : null,
                distanceText: item.distanceText || '-',
                targetActive: item.targetActive !== false,
                targetResident: item.targetResident !== false,
                currentActive: Boolean(item.currentActive),
                pinned: Boolean(item.pinned),
                manuallyActivated: Boolean(item.manuallyActivated),
                prefetched: Boolean(item.prefetched),
                totalCount: Number(item.totalCount) || 0,
                loadedCount: Number(item.loadedCount) || 0,
                unloadedCount: Number(item.unloadedCount) || 0,
                loadingCount: Number(item.loadingCount) || 0,
                componentCount: Number(item.componentCount) || 0,
                manifestCount: Number(item.manifestCount) || 0,
                riskyCount: Number(item.riskyCount) || 0,
                queueState: item.queueState || 'idle',
                budgetBlocked: Boolean(item.budgetBlocked),
                center: Array.isArray(item.center) ? item.center : []
            }))
            : [];

        modelDiagnostics.value = normalizedModels;
        chunkDiagnostics.value = normalizedChunks;
        sceneSummary.value = {
            ...nextSceneSummary,
            modelCount: normalizedModels.filter((item) => !item.runtimeOnly).length,
            activeGovernanceCount: normalizedModels.filter((item) => !item.runtimeOnly && item.governanceEnabled).length,
            visibleModelCount: normalizedModels.filter((item) => !item.runtimeOnly && item.visible && !item.culled).length,
            culledModelCount: normalizedModels.filter((item) => !item.runtimeOnly && item.culled).length,
            loadedModelCount: normalizedModels.filter((item) => !item.runtimeOnly && item.loadState === 'loaded').length,
            unloadedModelCount: normalizedModels.filter((item) => !item.runtimeOnly && item.loadState === 'unloaded').length,
            loadingModelCount: normalizedModels.filter((item) => !item.runtimeOnly && (item.loadState === 'loading' || item.loadState === 'unloading')).length,
            manifestResourceCount: normalizedModels.filter((item) => item.runtimeOnly).length,
            loadedManifestResourceCount: normalizedModels.filter((item) => item.runtimeOnly && item.loadState === 'loaded').length,
            chunkCount: normalizedChunks.length,
            activeChunkCount: normalizedChunks.filter((item) => item.currentActive).length,
            riskModelCount: normalizedModels.filter((item) => item.riskFlags.length > 0).length
        };
        lastUpdatedAt.value = new Date().toISOString();
    };

    const requestRefresh = () => {
        refreshNonce.value += 1;
    };

    const setChunkPinned = (chunkKey, pinned, { markUnsaved = true } = {}) => {
        const key = String(chunkKey || '').trim();
        if (!key) {
            return;
        }

        const next = new Set(pinnedChunks.value || []);
        if (pinned === false) {
            next.delete(key);
        } else {
            next.add(key);
        }
        pinnedChunks.value = Array.from(next).sort((left, right) => left.localeCompare(right, 'zh-CN'));
        persistSettings(markUnsaved);
    };

    const setChunkManualActive = (chunkKey, active) => {
        const key = String(chunkKey || '').trim();
        if (!key) {
            return;
        }

        const next = new Set(manualActiveChunks.value || []);
        if (active === false) {
            next.delete(key);
        } else {
            next.add(key);
        }
        manualActiveChunks.value = Array.from(next).sort((left, right) => left.localeCompare(right, 'zh-CN'));
        requestRefresh();
    };

    const setGroupActive = (dimension, key, active, { markUnsaved = true } = {}) => {
        if (!GOVERNANCE_DIMENSIONS.includes(dimension) || !key) {
            return;
        }

        groupActivation.value = normalizeGroupActivation({
            ...groupActivation.value,
            [dimension]: {
                ...groupActivation.value[dimension],
                [key]: active !== false
            }
        });
        persistSettings(markUnsaved);
    };

    const setAllGroupsActive = (dimension, active, { markUnsaved = true } = {}) => {
        if (!GOVERNANCE_DIMENSIONS.includes(dimension)) {
            return;
        }

        const nextDimensionState = { ...(groupActivation.value[dimension] || {}) };
        Object.keys(nextDimensionState).forEach((key) => {
            nextDimensionState[key] = active !== false;
        });

        groupActivation.value = normalizeGroupActivation({
            ...groupActivation.value,
            [dimension]: nextDimensionState
        });
        persistSettings(markUnsaved);
    };

    const sceneWarnings = computed(() => {
        const warnings = [];
        const thresholds = settings.value.thresholds;
        const summary = sceneSummary.value;

        if (summary.fps > 0 && summary.fps <= thresholds.fpsWarning) {
            warnings.push(`FPS 偏低（${summary.fps}）`);
        }
        if (summary.drawCalls >= thresholds.drawCallsWarning) {
            warnings.push(`Draw Calls 偏高（${summary.drawCalls}）`);
        }
        if (summary.frameTriangles >= thresholds.frameTrianglesWarning) {
            warnings.push(`帧三角面偏高（${summary.frameTriangles.toLocaleString('zh-CN')}）`);
        }
        if (summary.geometries >= thresholds.geometriesWarning) {
            warnings.push(`几何体数量偏高（${summary.geometries}）`);
        }
        if (summary.textures >= thresholds.texturesWarning) {
            warnings.push(`纹理数量偏高（${summary.textures}）`);
        }

        return warnings;
    });

    const riskyModels = computed(() => modelDiagnostics.value.filter((item) => item.riskFlags.length > 0));

    const activeChunks = computed(() => chunkDiagnostics.value.filter((item) => item.currentActive));

    const manifestSummary = computed(() => getLargeSceneManifestSummary(manifest.value));

    const organizationGroups = computed(() => {
        const result = createDefaultGroupActivation();

        GOVERNANCE_DIMENSIONS.forEach((dimension) => {
            const counters = new Map();

            modelDiagnostics.value.forEach((item) => {
                const key = item.organization?.[dimension];
                if (!key) {
                    return;
                }

                const current = counters.get(key) || { count: 0, riskyCount: 0 };
                current.count += 1;
                if (item.riskFlags.length > 0) {
                    current.riskyCount += 1;
                }
                counters.set(key, current);
            });

            result[dimension] = Array.from(counters.entries())
                .map(([key, info]) => ({
                    key,
                    count: info.count,
                    riskyCount: info.riskyCount,
                    active: groupActivation.value?.[dimension]?.[key] !== false
                }))
                .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key, 'zh-CN'));
        });

        return result;
    });

    rehydrateSettingsFromProject();

    return {
        settings,
        groupActivation,
        pinnedChunks,
        manualActiveChunks,
        manifest,
        manifestFetchState,
        currentFps,
        sceneSummary,
        modelDiagnostics,
        chunkDiagnostics,
        lastUpdatedAt,
        refreshNonce,
        sceneWarnings,
        riskyModels,
        activeChunks,
        manifestSummary,
        organizationGroups,
        rehydrateSettingsFromProject,
        updateSettings,
        resetSettings,
        setManifest,
        clearManifest,
        updateManifestResource,
        updateManifestResourceByRuntimeId,
        updateManifestSource,
        loadManifestFromSource,
        setCurrentFps,
        setRuntimeSnapshot,
        requestRefresh,
        setGroupActive,
        setAllGroupsActive,
        setChunkPinned,
        setChunkManualActive
    };
});
