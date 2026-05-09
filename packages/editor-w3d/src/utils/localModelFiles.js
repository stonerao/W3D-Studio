const LOCAL_MODEL_SCHEME = 'w3d-local-model://';
const LOCAL_MODEL_DB_NAME = 'W3DLocalModelAssets';
const LOCAL_MODEL_DB_VERSION = 1;
const LOCAL_MODEL_ASSET_STORE = 'assets';
const LOCAL_MODEL_FILE_STORE = 'files';
const SUPPORTED_MODEL_FORMATS = new Set(['glb', 'gltf', 'fbx']);

const registry = new Map();
let assetCounter = 0;
let resolverInstalled = false;
let dbPromise = null;

const normalizePath = (value = '') => {
    let text = String(value || '').trim().replace(/\\/g, '/');
    try {
        text = decodeURIComponent(text);
    } catch {
        // keep original text
    }
    return text.replace(/^\.?\//, '').toLowerCase();
};

const getBaseName = (value = '') => {
    const clean = String(value || '').split('?')[0].split('#')[0].replace(/\\/g, '/');
    return clean.split('/').filter(Boolean).pop() || clean;
};

const getFilePath = (file) => file?.webkitRelativePath || file?.name || '';

const encodePath = (value = '') => {
    return String(value || '')
        .replace(/\\/g, '/')
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/');
};

const getIndexedDB = () => globalThis?.indexedDB || null;

const openLocalModelDB = async () => {
    const indexedDB = getIndexedDB();
    if (!indexedDB) return null;

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(LOCAL_MODEL_DB_NAME, LOCAL_MODEL_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            let assetStore = null;
            let fileStore = null;

            if (!db.objectStoreNames.contains(LOCAL_MODEL_ASSET_STORE)) {
                assetStore = db.createObjectStore(LOCAL_MODEL_ASSET_STORE, { keyPath: 'assetId' });
            } else {
                assetStore = request.transaction.objectStore(LOCAL_MODEL_ASSET_STORE);
            }

            if (!assetStore.indexNames.contains('createdAt')) {
                assetStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            if (!db.objectStoreNames.contains(LOCAL_MODEL_FILE_STORE)) {
                fileStore = db.createObjectStore(LOCAL_MODEL_FILE_STORE, { keyPath: 'fileKey' });
            } else {
                fileStore = request.transaction.objectStore(LOCAL_MODEL_FILE_STORE);
            }

            if (!fileStore.indexNames.contains('assetId')) {
                fileStore.createIndex('assetId', 'assetId', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error || new Error('Failed to open local model IndexedDB'));
        };
        request.onblocked = () => {
            console.warn('[LocalModelFiles] IndexedDB open is blocked');
        };
    });

    try {
        return await dbPromise;
    } catch (error) {
        console.warn('[LocalModelFiles] IndexedDB unavailable:', error);
        return null;
    }
};

const runTransaction = (db, storeNames, mode, executor) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Array.isArray(storeNames)
        ? storeNames.reduce((acc, name) => {
            acc[name] = transaction.objectStore(name);
            return acc;
        }, {})
        : transaction.objectStore(storeNames);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));

    try {
        executor(stores, transaction);
    } catch (error) {
        transaction.abort();
        reject(error);
    }
});

const buildFileKeys = (path = '', fileName = '') => {
    return [
        normalizePath(path),
        normalizePath(fileName),
        normalizePath(getBaseName(path || fileName))
    ].filter(Boolean);
};

const revokeAssetUrls = (asset) => {
    if (!asset?.urls) return;
    asset.urls.forEach((objectUrl) => {
        try {
            URL.revokeObjectURL(objectUrl);
        } catch {
            // ignore
        }
    });
};

const registerAssetFiles = ({ assetId, primaryPath, files, metadata = {} }) => {
    if (!assetId || !Array.isArray(files) || files.length === 0) return null;

    installResolver();

    const previous = registry.get(assetId);
    if (previous) {
        revokeAssetUrls(previous);
    }

    const urls = new Map();
    const runtimeFiles = [];

    files.forEach((entry) => {
        const blob = entry?.blob || entry?.file;
        if (!blob) return;

        const path = entry.path || entry.fileName || blob.name || '';
        const fileName = entry.fileName || blob.name || getBaseName(path);
        const objectUrl = URL.createObjectURL(blob);

        buildFileKeys(path, fileName).forEach((key) => urls.set(key, objectUrl));
        runtimeFiles.push(blob);
    });

    const asset = {
        assetId,
        primaryPath,
        urls,
        files: runtimeFiles,
        metadata
    };

    registry.set(assetId, asset);
    return asset;
};

const persistLocalModelAsset = async ({ assetRecord, fileRecords }) => {
    const db = await openLocalModelDB();
    if (!db) return false;

    await runTransaction(
        db,
        [LOCAL_MODEL_ASSET_STORE, LOCAL_MODEL_FILE_STORE],
        'readwrite',
        (stores) => {
            stores[LOCAL_MODEL_ASSET_STORE].put(assetRecord);
            fileRecords.forEach((record) => {
                stores[LOCAL_MODEL_FILE_STORE].put(record);
            });
        }
    );

    return true;
};

const loadPersistedLocalModelAsset = async (assetId) => {
    const db = await openLocalModelDB();
    if (!db) return null;

    const assetRecord = await new Promise((resolve, reject) => {
        const transaction = db.transaction([LOCAL_MODEL_ASSET_STORE], 'readonly');
        const store = transaction.objectStore(LOCAL_MODEL_ASSET_STORE);
        const request = store.get(assetId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Failed to read local model asset'));
    });

    if (!assetRecord) return null;

    const fileRecords = await new Promise((resolve, reject) => {
        const transaction = db.transaction([LOCAL_MODEL_FILE_STORE], 'readonly');
        const store = transaction.objectStore(LOCAL_MODEL_FILE_STORE);
        const index = store.index('assetId');
        const request = index.getAll(assetId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Failed to read local model files'));
    });

    return {
        assetRecord,
        fileRecords
    };
};

export const inferLocalModelFormat = (value = '') => {
    const fileName = typeof value === 'string' ? value : value?.name;
    const clean = String(fileName || '').split('?')[0].split('#')[0];
    const index = clean.lastIndexOf('.');
    if (index === -1) return '';
    const ext = clean.slice(index + 1).toLowerCase();
    return SUPPORTED_MODEL_FORMATS.has(ext) ? ext : '';
};

export const isLocalModelUrl = (url = '') => String(url || '').startsWith(LOCAL_MODEL_SCHEME);

export const localModelAccept = '.glb,.gltf,.fbx,.bin,.png,.jpg,.jpeg,.webp,.ktx2,.dds,.basis,.hdr,.exr';

export const getSupportedModelFiles = (filesLike) => {
    return Array.from(filesLike || []).filter((file) => inferLocalModelFormat(file));
};

export const hasSupportedModelFiles = (filesLike) => getSupportedModelFiles(filesLike).length > 0;

const parseLocalModelUrl = (url = '') => {
    const text = String(url || '');
    if (!text.startsWith(LOCAL_MODEL_SCHEME)) return null;

    const rest = text.slice(LOCAL_MODEL_SCHEME.length);
    const slashIndex = rest.indexOf('/');
    if (slashIndex === -1) {
        return { assetId: rest, path: '' };
    }

    const assetId = rest.slice(0, slashIndex);
    const encodedPath = rest.slice(slashIndex + 1).split('?')[0].split('#')[0];
    let path = encodedPath;
    try {
        path = decodeURIComponent(encodedPath);
    } catch {
        // keep encoded path
    }
    return { assetId, path };
};

const makeResolveCandidates = (resourceUrl = '', rootPath = '') => {
    const raw = String(resourceUrl || '');
    const pathOnly = raw.split('?')[0].split('#')[0];
    const candidates = [
        normalizePath(pathOnly),
        normalizePath(getBaseName(pathOnly))
    ];

    try {
        const parsed = new URL(raw);
        candidates.push(normalizePath(parsed.pathname));
        candidates.push(normalizePath(getBaseName(parsed.pathname)));
    } catch {
        // raw may be a relative path
    }

    if (rootPath && !raw.includes('://') && !raw.startsWith('/')) {
        const rootParts = String(rootPath).replace(/\\/g, '/').split('/');
        rootParts.pop();
        candidates.push(normalizePath([...rootParts, raw].join('/')));
    }

    return [...new Set(candidates.filter(Boolean))];
};

export const resolveLocalModelUrl = (resourceUrl = '', rootUrl = '') => {
    const resourceInfo = parseLocalModelUrl(resourceUrl);
    const rootInfo = parseLocalModelUrl(rootUrl);
    const assetId = resourceInfo?.assetId || rootInfo?.assetId;
    if (!assetId) return resourceUrl;

    const asset = registry.get(assetId);
    if (!asset) return resourceUrl;

    const requestedPath = resourceInfo?.path || resourceUrl;
    const candidates = makeResolveCandidates(requestedPath, rootInfo?.path || asset.primaryPath);
    for (const candidate of candidates) {
        const objectUrl = asset.urls.get(candidate);
        if (objectUrl) return objectUrl;
    }

    return resourceUrl;
};

const installResolver = () => {
    if (resolverInstalled || typeof globalThis === 'undefined') return;
    resolverInstalled = true;

    globalThis.__W3D_LOCAL_MODEL_FILES__ = {
        isLocalModelUrl,
        resolveUrl: resolveLocalModelUrl
    };

    globalThis.addEventListener?.('beforeunload', () => {
        registry.forEach((asset) => revokeAssetUrls(asset));
        registry.clear();
    });
};

export const restoreLocalModelAsset = async (urlOrAssetId = '') => {
    installResolver();

    const info = parseLocalModelUrl(urlOrAssetId);
    const assetId = info?.assetId || String(urlOrAssetId || '').trim();
    if (!assetId) return { restored: false, reason: 'empty_asset_id' };
    if (registry.has(assetId)) return { restored: true, cached: true, assetId };

    try {
        const persisted = await loadPersistedLocalModelAsset(assetId);
        if (!persisted?.assetRecord || !Array.isArray(persisted.fileRecords) || persisted.fileRecords.length === 0) {
            return { restored: false, reason: 'not_found', assetId };
        }

        registerAssetFiles({
            assetId,
            primaryPath: persisted.assetRecord.primaryPath,
            files: persisted.fileRecords.map((record) => ({
                blob: record.blob,
                path: record.path,
                fileName: record.fileName
            })),
            metadata: persisted.assetRecord
        });

        return { restored: true, cached: false, assetId };
    } catch (error) {
        console.warn('[LocalModelFiles] Failed to restore local model asset:', error);
        return { restored: false, reason: 'error', error, assetId };
    }
};

export const restoreLocalModelAssetsFromComponents = async (components = []) => {
    const assetIds = new Set();

    (Array.isArray(components) ? components : []).forEach((component) => {
        const config = component?.config || {};
        const info = parseLocalModelUrl(config.url);
        if (info?.assetId) assetIds.add(info.assetId);
        if (config.localAssetId) assetIds.add(String(config.localAssetId));
    });

    const results = [];
    for (const assetId of assetIds) {
        // Preserve sequence to avoid IndexedDB transaction pressure with large files.
        // eslint-disable-next-line no-await-in-loop
        results.push(await restoreLocalModelAsset(assetId));
    }

    return {
        total: assetIds.size,
        restored: results.filter((item) => item.restored).length,
        missing: results.filter((item) => !item.restored)
    };
};

export const createLocalModelAsset = async (filesLike) => {
    const files = Array.from(filesLike || []).filter((file) => file && typeof file.name === 'string');
    const modelFiles = getSupportedModelFiles(files);
    const primaryFile = modelFiles[0];
    if (!primaryFile) return null;

    installResolver();

    const assetId = `local_model_${Date.now()}_${++assetCounter}`;
    const primaryPath = getFilePath(primaryFile) || primaryFile.name;
    const format = inferLocalModelFormat(primaryFile);
    const fileName = primaryFile.name || getBaseName(primaryPath);
    const displayName = fileName.replace(/\.[^.]+$/, '') || '本地模型';
    const now = Date.now();

    const fileEntries = files.map((file, index) => {
        const path = getFilePath(file) || file.name;
        return {
            file,
            blob: file,
            path,
            fileName: file.name || getBaseName(path),
            fileKey: `${assetId}::${index}`,
            size: file.size || 0,
            type: file.type || '',
            lastModified: file.lastModified || 0
        };
    });

    registerAssetFiles({
        assetId,
        primaryPath,
        files: fileEntries,
        metadata: {
            assetId,
            primaryPath,
            fileName,
            format
        }
    });

    let persisted = false;
    try {
        const assetRecord = {
            assetId,
            primaryPath,
            format,
            fileName,
            displayName,
            fileSize: primaryFile.size || 0,
            fileCount: files.length,
            lastModified: primaryFile.lastModified || 0,
            createdAt: now,
            updatedAt: now
        };
        const fileRecords = fileEntries.map((entry) => ({
            fileKey: entry.fileKey,
            assetId,
            path: entry.path,
            fileName: entry.fileName,
            size: entry.size,
            type: entry.type,
            lastModified: entry.lastModified,
            blob: entry.blob
        }));

        persisted = await persistLocalModelAsset({ assetRecord, fileRecords });
    } catch (error) {
        console.warn('[LocalModelFiles] Failed to persist local model asset:', error);
    }

    return {
        url: `${LOCAL_MODEL_SCHEME}${assetId}/${encodePath(primaryPath || fileName)}`,
        assetId,
        format,
        name: displayName,
        fileName,
        fileSize: primaryFile.size || 0,
        fileCount: files.length,
        lastModified: primaryFile.lastModified || 0,
        sourceType: 'local-file',
        persisted
    };
};

export const createLocalModelAssetFromDataTransfer = async (dataTransfer) => {
    return createLocalModelAsset(dataTransfer?.files || []);
};

export const isPotentialFileDrag = (event) => {
    const types = Array.from(event?.dataTransfer?.types || []);
    return types.includes('Files');
};
