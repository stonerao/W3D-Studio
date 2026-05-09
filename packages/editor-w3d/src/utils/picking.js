// Picking helpers shared across editor modules

export const PICK_ID_KEY = '__w3dEditorComponentId';
export const PICK_META_KEY = '__w3dEditorPickMeta';

export function tagInstanceForPicking(componentId, instance, metadata = {}) {
    const root = instance?.componentScene || instance?.group || instance?.object3d || instance?.mesh;
    if (!root || typeof root.traverse !== 'function') return;

    root.traverse((obj) => {
        if (!obj.userData) obj.userData = {};
        obj.userData[PICK_ID_KEY] = componentId;
        obj.userData[PICK_META_KEY] = {
            componentId,
            ...(metadata && typeof metadata === 'object' ? metadata : {})
        };
    });
}

export function findComponentIdFromObject(object) {
    let current = object;
    while (current) {
        const id = current?.userData?.[PICK_ID_KEY];
        if (id) return id;
        current = current.parent;
    }
    return null;
}

export function getPickingMetadataFromObject(object) {
    let current = object;
    while (current) {
        const meta = current?.userData?.[PICK_META_KEY];
        if (meta && typeof meta === 'object') {
            return meta;
        }
        const id = current?.userData?.[PICK_ID_KEY];
        if (id) {
            return { componentId: id };
        }
        current = current.parent;
    }
    return null;
}
