const toTrimmedString = (value, fallback = '') => {
    const text = String(value ?? '').trim();
    return text || fallback;
};

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toPositiveNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const normalizeVector3 = (value, fallback = [0, 0, 0]) => {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback];
    }
    return [
        toFiniteNumber(value[0], fallback[0] || 0),
        toFiniteNumber(value[1], fallback[1] || 0),
        toFiniteNumber(value[2], fallback[2] || 0)
    ];
};

const normalizeResourceStats = (value = {}) => ({
    vertices: Math.max(0, Math.round(toFiniteNumber(value.vertices, 0))),
    triangles: Math.max(0, Math.round(toFiniteNumber(value.triangles, 0))),
    meshCount: Math.max(0, Math.round(toFiniteNumber(value.meshCount, 0))),
    geometries: Math.max(0, Math.round(toFiniteNumber(value.geometries, value.meshCount || 0))),
    textures: Math.max(0, Math.round(toFiniteNumber(value.textures, 0))),
    boundsMaxDim: toPositiveNumber(value.boundsMaxDim, 0)
});

const MANIFEST_CACHE_KEY_PREFIX = 'w3d_large_scene_manifest_cache:';

const getManifestCacheStorage = () => {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
};

export const getManifestRuntimeResourceId = (chunkKey = '', resourceId = '') => `manifest:${String(chunkKey || '').trim()}:${String(resourceId || '').trim()}`;

export const parseManifestRuntimeResourceId = (value = '') => {
    const text = String(value || '').trim();
    const match = /^manifest:([^:]+):(.+)$/.exec(text);
    if (!match) {
        return null;
    }

    return {
        chunkKey: String(match[1] || '').trim(),
        resourceId: String(match[2] || '').trim()
    };
};

const getManifestCacheKey = (resolvedUrl = '') => `${MANIFEST_CACHE_KEY_PREFIX}${String(resolvedUrl || '').trim()}`;

const loadCachedManifest = (resolvedUrl = '') => {
    const storage = getManifestCacheStorage();
    const cacheKey = getManifestCacheKey(resolvedUrl);
    if (!storage || !resolvedUrl) {
        return null;
    }

    try {
        const raw = storage.getItem(cacheKey);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const saveCachedManifest = (resolvedUrl = '', manifest = {}) => {
    const storage = getManifestCacheStorage();
    const cacheKey = getManifestCacheKey(resolvedUrl);
    if (!storage || !resolvedUrl) {
        return null;
    }

    const payload = {
        cachedAt: new Date().toISOString(),
        manifest: normalizeLargeSceneManifest(manifest)
    };

    try {
        storage.setItem(cacheKey, JSON.stringify(payload));
        return payload;
    } catch {
        return null;
    }
};

export const createDefaultLargeSceneManifestSource = () => ({
    mode: 'inline',
    url: '',
    useProjectApiBase: true,
    autoReload: false,
    cacheEnabled: true,
    preferCacheOnError: true,
    versionTag: '',
    etag: '',
    lastModified: '',
    cachedAt: '',
    cacheStatus: 'idle'
});

export const createDefaultLargeSceneManifest = () => ({
    version: 1,
    source: createDefaultLargeSceneManifestSource(),
    chunks: []
});

const normalizeManifestSource = (value = {}) => ({
    mode: value?.mode === 'url' ? 'url' : 'inline',
    url: toTrimmedString(value?.url),
    useProjectApiBase: value?.useProjectApiBase !== false,
    autoReload: value?.autoReload === true,
    cacheEnabled: value?.cacheEnabled !== false,
    preferCacheOnError: value?.preferCacheOnError !== false,
    versionTag: toTrimmedString(value?.versionTag),
    etag: toTrimmedString(value?.etag),
    lastModified: toTrimmedString(value?.lastModified),
    cachedAt: toTrimmedString(value?.cachedAt),
    cacheStatus: toTrimmedString(value?.cacheStatus, 'idle')
});

const normalizeManifestResource = (value = {}, index = 0, chunk = {}) => {
    const sourceConfig = value?.config && typeof value.config === 'object' ? value.config : {};
    const componentType = toTrimmedString(value.componentType || value.type || sourceConfig.type, 'ModelLoader');
    const resourceUrl = toTrimmedString(
        value.resourceUrl || value.url || value.modelUrl || sourceConfig.url,
        ''
    );
    const name = toTrimmedString(
        value.name || sourceConfig.name,
        `${chunk.key || 'chunk'}-resource-${index + 1}`
    );
    const id = toTrimmedString(value.id, `${chunk.key || 'chunk'}-resource-${index + 1}`);
    const stats = normalizeResourceStats(value.stats || sourceConfig.stats || {});
    const position = normalizeVector3(value.position || sourceConfig.position, [0, 0, 0]);
    const rotation = normalizeVector3(value.rotation || sourceConfig.rotation, [0, 0, 0]);
    const scaleValue = value.scale ?? sourceConfig.scale;
    const scale = Number.isFinite(Number(scaleValue)) ? Number(scaleValue) : 1;
    const center = normalizeVector3(value.center, position);

    return {
        id,
        name,
        componentType,
        resourceUrl,
        pickable: value?.pickable !== false,
        organization: {
            zone: toTrimmedString(value.organization?.zone || chunk.organization?.zone),
            floor: toTrimmedString(value.organization?.floor || chunk.organization?.floor),
            chunk: toTrimmedString(chunk.key)
        },
        center,
        stats,
        config: {
            ...sourceConfig,
            url: resourceUrl || toTrimmedString(sourceConfig.url),
            name,
            position,
            rotation,
            scale,
            castShadow: sourceConfig.castShadow === true,
            receiveShadow: sourceConfig.receiveShadow === true,
            animations: sourceConfig.animations !== false,
            autoPlayAnimation: sourceConfig.autoPlayAnimation === true,
            interactiveMeshes: sourceConfig.interactiveMeshes ?? false
        }
    };
};

const normalizeManifestChunk = (value = {}, index = 0) => {
    const key = toTrimmedString(value.key || value.chunkKey, `chunk-${index + 1}`);
    const chunk = {
        key,
        label: toTrimmedString(value.label || value.name, key),
        center: normalizeVector3(value.center, [0, 0, 0]),
        organization: {
            zone: toTrimmedString(value.organization?.zone || value.zone),
            floor: toTrimmedString(value.organization?.floor || value.floor),
            chunk: key
        }
    };

    const resources = Array.isArray(value.resources)
        ? value.resources
            .map((item, resourceIndex) => normalizeManifestResource(item, resourceIndex, chunk))
            .filter((item) => item.resourceUrl)
        : [];

    return {
        ...chunk,
        resources
    };
};

export const normalizeLargeSceneManifest = (value = {}) => {
    const source = value && typeof value === 'object' ? value : {};
    const chunks = Array.isArray(source.chunks)
        ? source.chunks.map((item, index) => normalizeManifestChunk(item, index))
        : [];

    return {
        version: 1,
        source: normalizeManifestSource(source.source || {}),
        chunks: chunks
            .filter((item) => item.key)
            .map((item) => ({
                ...item,
                resources: Array.isArray(item.resources) ? item.resources : []
            }))
    };
};

export const getLargeSceneManifestSummary = (manifest = createDefaultLargeSceneManifest()) => {
    const normalized = normalizeLargeSceneManifest(manifest);
    return {
        chunkCount: normalized.chunks.length,
        resourceCount: normalized.chunks.reduce((sum, chunk) => sum + chunk.resources.length, 0),
        sourceMode: normalized.source?.mode || 'inline',
        sourceVersionTag: normalized.source?.versionTag || '',
        sourceCacheStatus: normalized.source?.cacheStatus || 'idle'
    };
};

export const stringifyLargeSceneManifest = (manifest = createDefaultLargeSceneManifest()) => {
    return JSON.stringify(normalizeLargeSceneManifest(manifest), null, 2);
};

export const resolveManifestSourceUrl = (source = createDefaultLargeSceneManifestSource(), apiBaseUrl = '') => {
    const normalized = normalizeManifestSource(source);
    const rawUrl = normalized.url;
    if (!rawUrl) {
        return '';
    }

    if (/^https?:\/\//i.test(rawUrl)) {
        return rawUrl;
    }

    if (!normalized.useProjectApiBase || !apiBaseUrl) {
        return rawUrl;
    }

    const base = String(apiBaseUrl || '').trim();
    if (!base) {
        return rawUrl;
    }

    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const normalizedPath = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
    return `${normalizedBase}${normalizedPath}`;
};

export const fetchLargeSceneManifest = async (source = createDefaultLargeSceneManifestSource(), apiBaseUrl = '', options = {}) => {
    const normalizedSource = normalizeManifestSource(source);
    if (normalizedSource.mode !== 'url' || !normalizedSource.url) {
        throw new Error('请先配置 manifest URL');
    }

    const resolvedUrl = resolveManifestSourceUrl(normalizedSource, apiBaseUrl);
    const forceRefresh = options?.forceRefresh === true;
    const cachedEntry = normalizedSource.cacheEnabled ? loadCachedManifest(resolvedUrl) : null;
    const requestHeaders = {
        Accept: 'application/json'
    };

    if (!forceRefresh && normalizedSource.etag) {
        requestHeaders['If-None-Match'] = normalizedSource.etag;
    }
    if (!forceRefresh && normalizedSource.lastModified) {
        requestHeaders['If-Modified-Since'] = normalizedSource.lastModified;
    }

    try {
        const response = await fetch(resolvedUrl, {
            method: 'GET',
            headers: requestHeaders
        });

        if (response.status === 304 && cachedEntry?.manifest) {
            const cachedManifest = normalizeLargeSceneManifest({
                ...(cachedEntry.manifest || {}),
                source: {
                    ...(cachedEntry.manifest?.source || {}),
                    ...normalizedSource,
                    cacheStatus: forceRefresh ? 'forced-network' : 'revalidated',
                    cachedAt: cachedEntry.cachedAt || normalizedSource.cachedAt,
                    etag: response.headers.get('etag') || normalizedSource.etag,
                    lastModified: response.headers.get('last-modified') || normalizedSource.lastModified
                }
            });

            return {
                resolvedUrl,
                manifest: cachedManifest,
                fromCache: true,
                cacheStatus: forceRefresh ? 'forced-network' : 'revalidated',
                etag: cachedManifest.source?.etag || '',
                lastModified: cachedManifest.source?.lastModified || '',
                versionTag: cachedManifest.source?.versionTag || ''
            };
        }

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }

        const payload = await response.json();
        const versionTag = toTrimmedString(
            payload?.versionTag || payload?.revision || response.headers.get('x-manifest-version') || normalizedSource.versionTag
        );
        const nextSource = {
            ...normalizedSource,
            versionTag,
            etag: toTrimmedString(response.headers.get('etag'), normalizedSource.etag),
            lastModified: toTrimmedString(response.headers.get('last-modified'), normalizedSource.lastModified),
            cachedAt: new Date().toISOString(),
            cacheStatus: forceRefresh ? 'forced-network' : 'network'
        };
        const manifest = normalizeLargeSceneManifest({
            ...(payload && typeof payload === 'object' ? payload : {}),
            source: nextSource
        });

        if (normalizedSource.cacheEnabled) {
            saveCachedManifest(resolvedUrl, manifest);
        }

        return {
            resolvedUrl,
            manifest,
            fromCache: false,
            cacheStatus: forceRefresh ? 'forced-network' : 'network',
            etag: manifest.source?.etag || '',
            lastModified: manifest.source?.lastModified || '',
            versionTag: manifest.source?.versionTag || ''
        };
    } catch (error) {
        if (normalizedSource.preferCacheOnError && cachedEntry?.manifest) {
            const fallbackManifest = normalizeLargeSceneManifest({
                ...(cachedEntry.manifest || {}),
                source: {
                    ...(cachedEntry.manifest?.source || {}),
                    ...normalizedSource,
                    cacheStatus: 'fallback',
                    cachedAt: cachedEntry.cachedAt || normalizedSource.cachedAt
                }
            });

            return {
                resolvedUrl,
                manifest: fallbackManifest,
                fromCache: true,
                cacheStatus: 'fallback',
                fallbackReason: error?.message || '请求失败',
                etag: fallbackManifest.source?.etag || '',
                lastModified: fallbackManifest.source?.lastModified || '',
                versionTag: fallbackManifest.source?.versionTag || ''
            };
        }

        throw error;
    }
};

export const LARGE_SCENE_MANIFEST_EXAMPLE = stringifyLargeSceneManifest({
    source: {
        mode: 'inline',
        url: ''
    },
    chunks: [
        {
            key: 'plant-west-01',
            label: '西区子场景 01',
            center: [120, 8, -36],
            organization: {
                zone: '西区',
                floor: '1F'
            },
            resources: [
                {
                    id: 'west-01-structure',
                    name: '西区结构',
                    resourceUrl: '/models/plant/west-01-structure.glb',
                    position: [120, 0, -36],
                    rotation: [0, 0, 0],
                    scale: 1,
                    stats: {
                        triangles: 320000,
                        meshCount: 480,
                        boundsMaxDim: 96
                    }
                },
                {
                    id: 'west-01-pipeline',
                    name: '西区管线',
                    resourceUrl: '/models/plant/west-01-pipeline.glb',
                    position: [118, 0, -40],
                    scale: 1,
                    stats: {
                        triangles: 180000,
                        meshCount: 220,
                        boundsMaxDim: 64
                    }
                }
            ]
        }
    ]
});
