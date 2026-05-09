const LOCAL_MODEL_SCHEME = 'w3d-local-model://';
const SUPPORTED_MODEL_FORMATS = new Set(['glb', 'gltf', 'fbx']);

const registry = new Map();
let assetCounter = 0;
let resolverInstalled = false;

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
        registry.forEach((asset) => {
            asset.urls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
        });
        registry.clear();
    });
};

export const createLocalModelAsset = (filesLike) => {
    const files = Array.from(filesLike || []).filter((file) => file && typeof file.name === 'string');
    const modelFiles = getSupportedModelFiles(files);
    const primaryFile = modelFiles[0];
    if (!primaryFile) return null;

    installResolver();

    const assetId = `local_model_${Date.now()}_${++assetCounter}`;
    const urls = new Map();

    files.forEach((file) => {
        const objectUrl = URL.createObjectURL(file);
        const path = getFilePath(file);
        const keys = [
            normalizePath(path),
            normalizePath(file.name),
            normalizePath(getBaseName(path || file.name))
        ].filter(Boolean);

        keys.forEach((key) => urls.set(key, objectUrl));
    });

    const primaryPath = getFilePath(primaryFile) || primaryFile.name;
    const format = inferLocalModelFormat(primaryFile);
    const fileName = primaryFile.name || getBaseName(primaryPath);
    const displayName = fileName.replace(/\.[^.]+$/, '') || '本地模型';

    registry.set(assetId, {
        assetId,
        primaryPath,
        urls,
        files
    });

    return {
        url: `${LOCAL_MODEL_SCHEME}${assetId}/${encodePath(primaryPath || fileName)}`,
        format,
        name: displayName,
        fileName,
        fileSize: primaryFile.size || 0,
        fileCount: files.length,
        lastModified: primaryFile.lastModified || 0,
        sourceType: 'local-file'
    };
};

export const createLocalModelAssetFromDataTransfer = (dataTransfer) => {
    return createLocalModelAsset(dataTransfer?.files || []);
};

export const isPotentialFileDrag = (event) => {
    const types = Array.from(event?.dataTransfer?.types || []);
    return types.includes('Files');
};
