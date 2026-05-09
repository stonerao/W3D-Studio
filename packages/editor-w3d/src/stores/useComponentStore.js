import { defineStore } from 'pinia';
import { ref, computed, markRaw } from 'vue';
import { normalizeVisualTransformConfig } from '../services/visualDataTransform';

export const useComponentStore = defineStore('component', () => {
    const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key);

    const cloneJsonSafe = (value, fallback = value) => {
        try {
            if (value === undefined) return fallback;
            return JSON.parse(JSON.stringify(value));
        } catch {
            return fallback;
        }
    };

    const remapComponentIdReference = (value, sourceIds, targetId) => {
        const rawValue = String(value || '');
        const sourceIdList = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
        return sourceIdList.some((sourceId) => rawValue && rawValue === String(sourceId || ''))
            ? targetId
            : value;
    };

    const remapMethodCallConfig = (config, sourceIds, targetId) => {
        if (!config || typeof config !== 'object') return null;
        const cloned = cloneJsonSafe(config, {});
        return {
            ...cloned,
            targetComponentId: remapComponentIdReference(cloned.targetComponentId || '', sourceIds, targetId),
            parameters: Array.isArray(cloned.parameters)
                ? cloned.parameters.map((param) => cloneJsonSafe(param, param))
                : []
        };
    };

    const remapBlueprintComponentReferences = (blueprint, sourceIds, targetId) => {
        const cloned = cloneJsonSafe(blueprint, null);
        if (!cloned || typeof cloned !== 'object') return null;

        if (Array.isArray(cloned.nodes)) {
            cloned.nodes = cloned.nodes.map((node) => {
                const nextNode = cloneJsonSafe(node, node);
                if (!nextNode?.data || typeof nextNode.data !== 'object') return nextNode;

                const data = nextNode.data;
                if (hasOwn(data, 'targetComponentId')) {
                    data.targetComponentId = remapComponentIdReference(data.targetComponentId, sourceIds, targetId);
                }
                if (hasOwn(data, 'componentId')) {
                    data.componentId = remapComponentIdReference(data.componentId, sourceIds, targetId);
                }
                if (Array.isArray(data.conditionInputs)) {
                    data.conditionInputs = data.conditionInputs.map((input) => {
                        const nextInput = cloneJsonSafe(input, input);
                        if (nextInput && typeof nextInput === 'object' && hasOwn(nextInput, 'componentId')) {
                            nextInput.componentId = remapComponentIdReference(nextInput.componentId, sourceIds, targetId);
                        }
                        return nextInput;
                    });
                }
                if (Array.isArray(data.parameters)) {
                    data.parameters = data.parameters.map((param) => cloneJsonSafe(param, param));
                }
                return nextNode;
            });
        }

        if (Array.isArray(cloned.edges)) {
            cloned.edges = cloned.edges.map((edge) => cloneJsonSafe(edge, edge));
        }

        return cloned;
    };

    const normalizeComponentEventsForIdentity = (events, sourceIds, targetId) => {
        const sourceIdList = Array.isArray(sourceIds)
            ? [...new Set(sourceIds.map((item) => String(item || '')).filter(Boolean))]
            : [];
        if (!Array.isArray(events)) return [];
        if (sourceIdList.length === 0) return events;

        return events.map((event) => {
            const nextEvent = cloneJsonSafe(event, event);
            return {
                ...nextEvent,
                methodCallConfig: remapMethodCallConfig(nextEvent.methodCallConfig, sourceIdList, targetId),
                blueprint: nextEvent.blueprint
                    ? remapBlueprintComponentReferences(nextEvent.blueprint, sourceIdList, targetId)
                    : null,
                targetFilter: nextEvent.targetFilter ? cloneJsonSafe(nextEvent.targetFilter, null) : null
            };
        });
    };

    const normalizeDataSourceForStore = (source = {}) => {
        const nextSource = { ...source };
        if (hasOwn(source, 'visualTransformConfig') && source.visualTransformConfig && typeof source.visualTransformConfig === 'object') {
            nextSource.visualTransformConfig = normalizeVisualTransformConfig(source.visualTransformConfig);
        }
        return nextSource;
    };

    const normalizeDataBindingForStore = (dataBinding) => {
        if (!dataBinding || typeof dataBinding !== 'object') return dataBinding || null;
        return {
            ...dataBinding,
            sources: Array.isArray(dataBinding.sources)
                ? dataBinding.sources.map((source) => normalizeDataSourceForStore(source))
                : []
        };
    };

    const createTrafficSelectedDeviceState = () => ({
        componentId: null,
        deviceId: null
    });

    const createTrafficPickingState = () => ({
        active: false,
        componentId: null,
        deviceId: null
    });

    const createTrajectoryPickingState = () => ({
        active: false,
        componentId: null
    });

    const createBuildingPickingState = () => ({
        active: false,
        componentId: null,
        pointId: null
    });

    const createTrafficPickConfirmState = () => ({
        visible: false,
        componentId: null,
        deviceId: null,
        xyz: null
    });

    const createTrajectoryPickConfirmState = () => ({
        visible: false,
        componentId: null,
        xyz: null
    });

    const createBuildingPickConfirmState = () => ({
        visible: false,
        componentId: null,
        pointId: null,
        xyz: null
    });

    const createMeshPickingState = () => ({
        active: false,
        componentId: null,
        source: null
    });

    const createMeshPickResultState = () => ({
        token: 0,
        componentId: null,
        meshName: '',
        source: null,
        nodePath: '',
        rawName: ''
    });

    const createCanvasSubSelectionState = () => ({
        componentId: null,
        targetType: '',
        targetId: '',
        payload: null
    });

    // English comment.
    const components = ref([]);
    const serialVersion = ref(0);

    // English comment.
    const selectedComponentId = ref(null);

    // English comment.
    const trafficSelectedDevice = ref(createTrafficSelectedDeviceState());

    // English comment.
    const trafficPicking = ref(createTrafficPickingState());

    // English comment.
    const trajectoryPicking = ref(createTrajectoryPickingState());

    // English comment.
    const buildingPicking = ref(createBuildingPickingState());

    // English comment.
    const trafficPickConfirm = ref(createTrafficPickConfirmState());

    // English comment.
    const trajectoryPickConfirm = ref(createTrajectoryPickConfirmState());

    // English comment.
    const buildingPickConfirm = ref(createBuildingPickConfirmState());
    const meshPicking = ref(createMeshPickingState());
    const meshPickResult = ref(createMeshPickResultState());
    const canvasSubSelection = ref(createCanvasSubSelectionState());

    // English comment.
    let componentCounter = 0;

    // English comment.
    const componentMap = new Map();

    const getComponentById = (id) => componentMap.get(id) || null;

    const bumpSerialVersion = () => {
        serialVersion.value += 1;
    };

    // English comment.
    // English comment.
    const getReactiveComponent = (id) => {
        if (!componentMap.has(id)) return null;
        return components.value.find((c) => c.id === id) || null;
    };

    const resetEditorInteractionState = () => {
        trafficSelectedDevice.value = createTrafficSelectedDeviceState();
        trafficPicking.value = createTrafficPickingState();
        trajectoryPicking.value = createTrajectoryPickingState();
        buildingPicking.value = createBuildingPickingState();
        trafficPickConfirm.value = createTrafficPickConfirmState();
        trajectoryPickConfirm.value = createTrajectoryPickConfirmState();
        buildingPickConfirm.value = createBuildingPickConfirmState();
        meshPicking.value = createMeshPickingState();
        meshPickResult.value = createMeshPickResultState();
        canvasSubSelection.value = createCanvasSubSelectionState();
    };

    const clearComponentLinkedEditorState = (componentId) => {
        if (!componentId) return;

        if (selectedComponentId.value === componentId) {
            selectedComponentId.value = null;
        }

        if (trafficSelectedDevice.value?.componentId === componentId) {
            trafficSelectedDevice.value = createTrafficSelectedDeviceState();
        }
        if (trafficPicking.value?.componentId === componentId) {
            trafficPicking.value = createTrafficPickingState();
        }
        if (trajectoryPicking.value?.componentId === componentId) {
            trajectoryPicking.value = createTrajectoryPickingState();
        }
        if (buildingPicking.value?.componentId === componentId) {
            buildingPicking.value = createBuildingPickingState();
        }
        if (trafficPickConfirm.value?.componentId === componentId) {
            trafficPickConfirm.value = createTrafficPickConfirmState();
        }
        if (trajectoryPickConfirm.value?.componentId === componentId) {
            trajectoryPickConfirm.value = createTrajectoryPickConfirmState();
        }
        if (buildingPickConfirm.value?.componentId === componentId) {
            buildingPickConfirm.value = createBuildingPickConfirmState();
        }
        if (meshPicking.value?.componentId === componentId) {
            meshPicking.value = createMeshPickingState();
        }
        if (meshPickResult.value?.componentId === componentId) {
            meshPickResult.value = createMeshPickResultState();
        }
        if (canvasSubSelection.value?.componentId === componentId) {
            canvasSubSelection.value = createCanvasSubSelectionState();
        }
    };

    const replaceLinkedComponentId = (oldId, nextId) => {
        if (!oldId || !nextId || oldId === nextId) return;

        if (selectedComponentId.value === oldId) {
            selectedComponentId.value = nextId;
        }
        if (trafficSelectedDevice.value?.componentId === oldId) {
            trafficSelectedDevice.value.componentId = nextId;
        }
        if (trafficPicking.value?.componentId === oldId) {
            trafficPicking.value.componentId = nextId;
        }
        if (trajectoryPicking.value?.componentId === oldId) {
            trajectoryPicking.value.componentId = nextId;
        }
        if (buildingPicking.value?.componentId === oldId) {
            buildingPicking.value.componentId = nextId;
        }
        if (trafficPickConfirm.value?.componentId === oldId) {
            trafficPickConfirm.value.componentId = nextId;
        }
        if (trajectoryPickConfirm.value?.componentId === oldId) {
            trajectoryPickConfirm.value.componentId = nextId;
        }
        if (buildingPickConfirm.value?.componentId === oldId) {
            buildingPickConfirm.value.componentId = nextId;
        }
        if (meshPicking.value?.componentId === oldId) {
            meshPicking.value.componentId = nextId;
        }
        if (meshPickResult.value?.componentId === oldId) {
            meshPickResult.value.componentId = nextId;
        }
        if (canvasSubSelection.value?.componentId === oldId) {
            canvasSubSelection.value.componentId = nextId;
        }
    };

    const stopAllPickings = (except = '') => {
        if (except !== 'traffic') {
            trafficPicking.value = createTrafficPickingState();
        }
        if (except !== 'trajectory') {
            trajectoryPicking.value = createTrajectoryPickingState();
        }
        if (except !== 'building') {
            buildingPicking.value = createBuildingPickingState();
        }
        if (except !== 'mesh') {
            meshPicking.value = createMeshPickingState();
        }
    };

    const clearAllPickConfirms = (except = '') => {
        if (except !== 'traffic') {
            trafficPickConfirm.value = createTrafficPickConfirmState();
        }
        if (except !== 'trajectory') {
            trajectoryPickConfirm.value = createTrajectoryPickConfirmState();
        }
        if (except !== 'building') {
            buildingPickConfirm.value = createBuildingPickConfirmState();
        }
    };

    const setCanvasSubSelection = (componentId, targetType = '', targetId = '', payload = null) => {
        canvasSubSelection.value = {
            componentId: componentId || null,
            targetType: String(targetType || ''),
            targetId: String(targetId || ''),
            payload: payload && typeof payload === 'object' ? { ...payload } : null
        };
    };

    const clearCanvasSubSelection = (componentId = '') => {
        if (componentId && canvasSubSelection.value?.componentId !== componentId) return;
        canvasSubSelection.value = createCanvasSubSelectionState();
    };

    // English comment.
    const componentIndexMap = new Map();
    const rebuildIndexMap = () => {
        componentIndexMap.clear();
        components.value.forEach((c, i) => componentIndexMap.set(c.id, i));
    };

    // English comment.
    const raycastCapableIds = new Set();

    // English comment.
    const selectedComponent = computed(() => {
        const id = selectedComponentId.value;
        if (!id) return null;
        if (!componentMap.has(id)) return null;
        // English comment.
        void serialVersion.value;
        const idx = componentIndexMap.get(id);
        if (idx == null) return null;
        return components.value[idx] || null;
    });

    // English comment.
    const addComponent = (componentData) => {
        const component = {
            id: `component_${++componentCounter}`,
            name: componentData.name || `Component ${componentCounter}`,
            type: componentData.type,
            config: componentData.config || {},
            instance: componentData.instance ? markRaw(componentData.instance) : null,
            visible: componentData.visible !== false,
            previewVisible: componentData.previewVisible !== false,
            variableBindings: componentData.variableBindings ? { ...componentData.variableBindings } : {},
            locked: false,
            events: [], // English comment.
            dataBinding: normalizeDataBindingForStore(componentData.dataBinding), // English comment.
            createdAt: Date.now()
        };

        components.value.push(component);
        componentMap.set(component.id, component);
        componentIndexMap.set(component.id, components.value.length - 1);
        // English comment.
        if (component.instance && typeof component.instance.raycast === 'function') {
            raycastCapableIds.add(component.id);
        }
        bumpSerialVersion();
        return component;
    };

    // English comment.
    const removeComponent = (componentId) => {
        const index = components.value.findIndex((c) => c.id === componentId);
        if (index !== -1) {
            const component = components.value[index];
            components.value.splice(index, 1);
            componentMap.delete(componentId);
            componentIndexMap.delete(componentId);
            raycastCapableIds.delete(componentId);
            // English comment.
            rebuildIndexMap();
            clearComponentLinkedEditorState(componentId);
            bumpSerialVersion();

            return component;
        }
        return null;
    };

    // English comment.
    // English comment.
    // English comment.
    const updateComponent = (componentId, updates) => {
        const component = getReactiveComponent(componentId);
        if (!component || !updates || typeof updates !== 'object') return null;

        const hasIdUpdate = Object.prototype.hasOwnProperty.call(updates, 'id');
        if (!hasIdUpdate) {
            Object.assign(component, updates);
            bumpSerialVersion();
            return component;
        }

        const { id: nextIdRaw, ...rest } = updates;
        const nextId = String(nextIdRaw || '').trim();

        if (!nextId || nextId === componentId) {
            Object.assign(component, rest);
            bumpSerialVersion();
            return component;
        }

        if (componentMap.has(nextId)) {
            console.warn(`[ComponentStore] updateComponent ignored id change: target id already exists (${nextId})`);
            Object.assign(component, rest);
            bumpSerialVersion();
            return component;
        }

        const rawComponent = getComponentById(componentId);
        componentMap.delete(componentId);
        component.id = nextId;
        Object.assign(component, rest);
        componentMap.set(nextId, rawComponent); // English comment.
        replaceLinkedComponentId(componentId, nextId);
        bumpSerialVersion();
        return component;
    };

    // English comment.
    const updateComponentInstance = (componentId, instance) => {
        const component = getReactiveComponent(componentId);
        if (component) {
            component.instance = instance ? markRaw(instance) : null;
            // English comment.
            if (instance && typeof instance.raycast === 'function') {
                raycastCapableIds.add(componentId);
            } else {
                raycastCapableIds.delete(componentId);
            }
            bumpSerialVersion();
            return component;
        }
        return null;
    };

    // English comment.
    const selectComponent = (componentId) => {
        const nextId = getComponentById(componentId) ? componentId : null;
        selectedComponentId.value = nextId;
        if (!nextId || canvasSubSelection.value?.componentId !== nextId) {
            canvasSubSelection.value = createCanvasSubSelectionState();
        }
    };

    // English comment.
    const deselectComponent = () => {
        selectedComponentId.value = null;
        canvasSubSelection.value = createCanvasSubSelectionState();
    };

    // English comment.

    const setTrafficSelectedDevice = (componentId, deviceId) => {
        trafficSelectedDevice.value = {
            componentId,
            deviceId
        };
    };

    const clearTrafficSelectedDevice = (componentId) => {
        if (trafficSelectedDevice.value?.componentId !== componentId) return;
        trafficSelectedDevice.value = {
            componentId: null,
            deviceId: null
        };
    };

    const startTrafficPicking = (componentId, deviceId) => {
        stopAllPickings('traffic');
        clearAllPickConfirms('traffic');
        trafficPicking.value = {
            active: true,
            componentId,
            deviceId
        };
    };

    const stopTrafficPicking = () => {
        trafficPicking.value = {
            active: false,
            componentId: null,
            deviceId: null
        };
    };

    // English comment.

    const startTrajectoryPicking = (componentId) => {
        stopAllPickings('trajectory');
        clearAllPickConfirms('trajectory');
        trajectoryPicking.value = {
            active: true,
            componentId
        };
    };

    const stopTrajectoryPicking = () => {
        trajectoryPicking.value = {
            active: false,
            componentId: null
        };
    };

    const requestTrajectoryPickConfirm = (componentId, xyz) => {
        trajectoryPickConfirm.value = {
            visible: true,
            componentId,
            xyz
        };
    };

    const clearTrajectoryPickConfirm = () => {
        trajectoryPickConfirm.value = {
            visible: false,
            componentId: null,
            xyz: null
        };
    };

    // English comment.

    const startBuildingPicking = (componentId, pointId = null) => {
        stopAllPickings('building');
        clearAllPickConfirms('building');
        buildingPicking.value = {
            active: true,
            componentId,
            pointId
        };
    };

    const stopBuildingPicking = () => {
        buildingPicking.value = {
            active: false,
            componentId: null,
            pointId: null
        };
    };

    const requestBuildingPickConfirm = (componentId, xyz, pointId = null) => {
        buildingPickConfirm.value = {
            visible: true,
            componentId,
            pointId,
            xyz
        };
    };

    const clearBuildingPickConfirm = () => {
        buildingPickConfirm.value = {
            visible: false,
            componentId: null,
            pointId: null,
            xyz: null
        };
    };

    const requestTrafficPickConfirm = (componentId, deviceId, xyz) => {
        trafficPickConfirm.value = {
            visible: true,
            componentId,
            deviceId,
            xyz
        };
    };

    const clearTrafficPickConfirm = () => {
        trafficPickConfirm.value = {
            visible: false,
            componentId: null,
            deviceId: null,
            xyz: null
        };
    };

    // English comment.

    const startMeshPicking = (componentId, source = 'generic') => {
        stopAllPickings('mesh');
        meshPicking.value = {
            active: true,
            componentId,
            source
        };
    };

    const stopMeshPicking = () => {
        meshPicking.value = createMeshPickingState();
    };

    const completeMeshPicking = (componentId, meshName, source = 'generic', meta = {}) => {
        meshPickResult.value = {
            token: Date.now(),
            componentId,
            meshName: String(meshName || ''),
            source,
            nodePath: String(meta?.nodePath || ''),
            rawName: String(meta?.rawName || '')
        };
        meshPicking.value = createMeshPickingState();
    };

    const clearMeshPickResult = () => {
        meshPickResult.value = createMeshPickResultState();
    };

    // English comment.
    const toggleComponentVisibility = (componentId) => {
        const component = getReactiveComponent(componentId);
        if (component) {
            component.visible = !component.visible;
            bumpSerialVersion();
            return component;
        }
        return null;
    };

    const setComponentVisibility = (componentId, visible) => {
        const component = getReactiveComponent(componentId);
        if (component) {
            component.visible = visible !== false;
            bumpSerialVersion();
            return component;
        }
        return null;
    };

    // English comment.
    const getComponentsByType = (type) => {
        return components.value.filter((c) => c.type === type);
    };

    // English comment.
    const getComponentByName = (name) => {
        return components.value.find((c) => c.name === name);
    };

    // English comment.
    const clearComponents = () => {
        components.value = [];
        componentMap.clear();
        componentIndexMap.clear();
        raycastCapableIds.clear();
        selectedComponentId.value = null;
        resetEditorInteractionState();
        componentCounter = 0;
        bumpSerialVersion();
    };

    /**
     * English comment.
     */
    const hydrateComponents = (list) => {
        const sourceList = Array.isArray(list) ? list : [];
        components.value = sourceList.map((item, index) => {
            const raw = item && typeof item === 'object' ? item : {};
            const id = String(raw.id || `component_${index + 1}`);
            const rawConfig = raw.config && typeof raw.config === 'object' ? raw.config : {};
            const staleSelfReferenceIds = [rawConfig.id]
                .map((value) => String(value || ''))
                .filter((value) => value && value !== id);
            return {
                ...raw,
                id,
                config: {
                    ...rawConfig,
                    id
                },
                visible: raw.visible !== false,
                previewVisible: raw.previewVisible !== false,
                variableBindings: raw.variableBindings ? { ...raw.variableBindings } : {},
                events: normalizeComponentEventsForIdentity(raw.events, staleSelfReferenceIds, id),
                dataBinding: normalizeDataBindingForStore(raw.dataBinding),
                instance: raw.instance ? markRaw(raw.instance) : null
            };
        });
        componentMap.clear();
        raycastCapableIds.clear();
        components.value.forEach((c) => {
            componentMap.set(c.id, c);
            if (c.instance && typeof c.instance.raycast === 'function') {
                raycastCapableIds.add(c.id);
            }
        });
        rebuildIndexMap();
        selectedComponentId.value = null;
        resetEditorInteractionState();

        let maxCounter = 0;
        for (const item of components.value) {
            const match = typeof item?.id === 'string' ? item.id.match(/^component_(\d+)$/) : null;
            if (match) {
                const n = Number(match[1]);
                if (Number.isFinite(n)) {
                    maxCounter = Math.max(maxCounter, n);
                }
            }
        }
        componentCounter = maxCounter;
        bumpSerialVersion();
    };

    // English comment.

    // English comment.
    const addEvent = (componentId, event) => {
        const component = getReactiveComponent(componentId);
        if (!component || !event || typeof event !== 'object') return null;

        if (!component.events) {
            component.events = [];
        }

        const nextEvent = { ...event };
        const eventId = String(nextEvent.id || '').trim() || `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (component.events.some((item) => String(item?.id || '') === eventId)) {
            console.warn(`[ComponentStore] addEvent ignored duplicated event id: ${eventId}`);
            return null;
        }

        nextEvent.id = eventId;
        component.events.push(nextEvent);
        bumpSerialVersion();
        return nextEvent;
    };

    // English comment.
    const removeEvent = (componentId, eventId) => {
        const component = getReactiveComponent(componentId);
        if (component && component.events) {
            const index = component.events.findIndex((e) => e.id === eventId);
            if (index !== -1) {
                const event = component.events[index];
                component.events.splice(index, 1);
                bumpSerialVersion();
                return event;
            }
        }
        return null;
    };

    // English comment.
    const updateEvent = (componentId, eventId, updates) => {
        const component = getReactiveComponent(componentId);
        if (component && component.events) {
            const event = component.events.find((e) => e.id === eventId);
            if (event) {
                if (updates && Object.prototype.hasOwnProperty.call(updates, 'id')) {
                    const nextId = String(updates.id || '').trim();
                    if (!nextId) {
                        const { id: _id, ...rest } = updates;
                        Object.assign(event, rest);
                        bumpSerialVersion();
                        return event;
                    }
                    const duplicated = component.events.some((item) => item !== event && String(item?.id || '') === nextId);
                    if (duplicated) {
                        console.warn(`[ComponentStore] updateEvent ignored duplicated event id: ${nextId}`);
                        const { id: _id, ...rest } = updates;
                        Object.assign(event, rest);
                        bumpSerialVersion();
                        return event;
                    }
                }
                Object.assign(event, updates);
                bumpSerialVersion();
                return event;
            }
        }
        return null;
    };

    // English comment.
    const getComponentEvents = (componentId) => {
        const component = getComponentById(componentId);
        const source = Array.isArray(component?.events) ? component.events : [];
        return source.map((item) => ({ ...item }));
    };

    // English comment.

    // English comment.
    const updateDataBinding = (componentId, dataBinding) => {
        const component = getReactiveComponent(componentId);
        if (component) {
            component.dataBinding = normalizeDataBindingForStore(dataBinding);
            bumpSerialVersion();
            return component;
        }
        return null;
    };

    // English comment.
    const getDataBinding = (componentId) => {
        const component = getComponentById(componentId);
        return component?.dataBinding || null;
    };

    // English comment.
    const addDataSource = (componentId, dataSource) => {
        const component = getReactiveComponent(componentId);
        if (!component || !dataSource || typeof dataSource !== 'object') return null;

        if (!component.dataBinding) {
            component.dataBinding = { enabled: true, sources: [] };
        }
        if (!component.dataBinding.sources) {
            component.dataBinding.sources = [];
        }

        const nextSource = normalizeDataSourceForStore(dataSource);
        const sourceId = String(nextSource.id || '').trim() || `source_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (component.dataBinding.sources.some((s) => String(s?.id || '') === sourceId)) {
            console.warn(`[ComponentStore] addDataSource ignored duplicated source id: ${sourceId}`);
            return null;
        }

        nextSource.id = sourceId;
        component.dataBinding.sources.push(nextSource);
        bumpSerialVersion();
        return component;
    };

    // English comment.
    const updateDataSource = (componentId, sourceId, updates) => {
        const component = getReactiveComponent(componentId);
        if (component?.dataBinding?.sources) {
            const sourceIndex = component.dataBinding.sources.findIndex(s => s.id === sourceId);
            if (sourceIndex !== -1) {
                const currentSource = component.dataBinding.sources[sourceIndex];
                const normalizedUpdates = normalizeDataSourceForStore(updates || {});
                if (updates && Object.prototype.hasOwnProperty.call(updates, 'id')) {
                    const nextId = String(normalizedUpdates.id || '').trim();
                    if (!nextId) {
                        const { id: _id, ...rest } = normalizedUpdates;
                        component.dataBinding.sources[sourceIndex] = {
                            ...currentSource,
                            ...rest
                        };
                        bumpSerialVersion();
                        return component;
                    }
                    const duplicated = component.dataBinding.sources.some((s, idx) => idx !== sourceIndex && String(s?.id || '') === nextId);
                    if (duplicated) {
                        console.warn(`[ComponentStore] updateDataSource ignored duplicated source id: ${nextId}`);
                        const { id: _id, ...rest } = normalizedUpdates;
                        component.dataBinding.sources[sourceIndex] = {
                            ...currentSource,
                            ...rest
                        };
                        bumpSerialVersion();
                        return component;
                    }
                }
                component.dataBinding.sources[sourceIndex] = {
                    ...currentSource,
                    ...normalizedUpdates
                };
                bumpSerialVersion();
                return component;
            }
        }
        return null;
    };

    // English comment.
    const removeDataSource = (componentId, sourceId) => {
        const component = getReactiveComponent(componentId);
        if (component?.dataBinding?.sources) {
            component.dataBinding.sources = component.dataBinding.sources.filter(s => s.id !== sourceId);
            bumpSerialVersion();
            return component;
        }
        return null;
    };

    return {
        // English comment.
        components,
        serialVersion,
        selectedComponentId,
        selectedComponent,
        raycastCapableIds,

        // English comment.
        trafficSelectedDevice,
        trafficPicking,
        trafficPickConfirm,

        // English comment.
        trajectoryPicking,
        trajectoryPickConfirm,

        // English comment.
        buildingPicking,
        buildingPickConfirm,
        meshPicking,
        meshPickResult,
        canvasSubSelection,

        // English comment.
        addComponent,
        removeComponent,
        updateComponent,
        updateComponentInstance,
        selectComponent,
        deselectComponent,
        toggleComponentVisibility,
        setComponentVisibility,
        getComponentsByType,
        getComponentByName,
        getComponentById,
        clearComponents,
        hydrateComponents,

        // English comment.
        setTrafficSelectedDevice,
        clearTrafficSelectedDevice,
        startTrafficPicking,
        stopTrafficPicking,
        requestTrafficPickConfirm,
        clearTrafficPickConfirm,

        // English comment.
        startTrajectoryPicking,
        stopTrajectoryPicking,
        requestTrajectoryPickConfirm,
        clearTrajectoryPickConfirm,

        // English comment.
        startBuildingPicking,
        stopBuildingPicking,
        requestBuildingPickConfirm,
        clearBuildingPickConfirm,
        setCanvasSubSelection,
        clearCanvasSubSelection,
        startMeshPicking,
        stopMeshPicking,
        completeMeshPicking,
        clearMeshPickResult,

        // English comment.
        addEvent,
        removeEvent,
        updateEvent,
        getComponentEvents,

        // English comment.
        updateDataBinding,
        getDataBinding,
        addDataSource,
        updateDataSource,
        removeDataSource
    };
});

