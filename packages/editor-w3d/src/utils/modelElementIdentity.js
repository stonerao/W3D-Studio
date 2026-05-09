const normalizeName = (value) => {
    if (!value) {
        return '';
    }

    return String(value).trim();
};

export const getModelHitIdentity = (object) => {
    const meta = object?.userData?.__w3dModelTargetMeta;
    if (meta && typeof meta === 'object') {
        return {
            meshName: normalizeName(meta.meshName),
            nodePath: normalizeName(meta.nodePath),
            rawName: normalizeName(meta.rawName)
        };
    }

    const names = [];
    let current = object;
    let meshName = '';
    let depth = 0;

    while (current && depth < 24) {
        const currentName = normalizeName(current.name);
        if (currentName) {
            names.unshift(currentName);
            if (!meshName) {
                meshName = currentName;
            }
        }

        current = current.parent;
        depth += 1;
    }

    return {
        meshName,
        nodePath: names.join('/'),
        rawName: normalizeName(object?.name)
    };
};
