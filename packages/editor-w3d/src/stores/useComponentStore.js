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

    // 组件列表（场景中已添加的组件）
    const components = ref([]);
    const serialVersion = ref(0);

    // 选中的组件 ID
    const selectedComponentId = ref(null);

    // 路侧设备管理：选中的设备（仅编辑器态，不参与项目持久化）
    const trafficSelectedDevice = ref(createTrafficSelectedDeviceState());

    // 路侧设备管理：拾取坐标模式（仅编辑器态，不参与项目持久化）
    const trafficPicking = ref(createTrafficPickingState());

    // 轨迹移动：拾取路线点位模式（仅编辑器态，不参与项目持久化）
    const trajectoryPicking = ref(createTrajectoryPickingState());

    // 点位管理器：拾取点位模式（仅编辑器态，不参与项目持久化）
    const buildingPicking = ref(createBuildingPickingState());

    // 路侧设备管理：拾取坐标确认（仅编辑器态，不参与项目持久化）
    const trafficPickConfirm = ref(createTrafficPickConfirmState());

    // 轨迹移动：拾取坐标确认（仅编辑器态，不参与项目持久化）
    const trajectoryPickConfirm = ref(createTrajectoryPickConfirmState());

    // 点位管理器：拾取坐标确认（仅编辑器态，不参与项目持久化）
    const buildingPickConfirm = ref(createBuildingPickConfirmState());
    const meshPicking = ref(createMeshPickingState());
    const meshPickResult = ref(createMeshPickResultState());
    const canvasSubSelection = ref(createCanvasSubSelectionState());

    // 组件计数器（用于生成唯一 ID）
    let componentCounter = 0;

    // 组件 Map，用于 O(1) ID 查找（与 components 数组保持同步）
    const componentMap = new Map();

    const getComponentById = (id) => componentMap.get(id) || null;

    const bumpSerialVersion = () => {
        serialVersion.value += 1;
    };

    // ★ 返回响应式 Proxy 的组件引用（用于所有需要触发 UI 更新的变更操作）
    //   componentMap 存 raw 引用仅做 O(1) 存在性判断；真正赋值走 Proxy 才能触发 computed/watcher。
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

    // id → index 快速映射，随 components 数组增删同步维护
    const componentIndexMap = new Map();
    const rebuildIndexMap = () => {
        componentIndexMap.clear();
        components.value.forEach((c, i) => componentIndexMap.set(c.id, i));
    };

    // 支持自定义 raycast 的组件 id 集合（addComponent / removeComponent / updateComponentInstance 时维护）
    const raycastCapableIds = new Set();

    // 获取选中的组件（O(1) 查找，通过 index 映射直接取 Proxy 引用）
    const selectedComponent = computed(() => {
        const id = selectedComponentId.value;
        if (!id) return null;
        if (!componentMap.has(id)) return null;
        // 依赖 serialVersion 确保增删时重新计算
        void serialVersion.value;
        const idx = componentIndexMap.get(id);
        if (idx == null) return null;
        return components.value[idx] || null;
    });

    // 添加组件（instance 使用 markRaw 避免 Three.js 对象被 Vue 深度代理）
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
            events: [], // 事件列表
            dataBinding: normalizeDataBindingForStore(componentData.dataBinding), // 数据接入配置
            createdAt: Date.now()
        };

        components.value.push(component);
        componentMap.set(component.id, component);
        componentIndexMap.set(component.id, components.value.length - 1);
        // 标记 raycast 能力
        if (component.instance && typeof component.instance.raycast === 'function') {
            raycastCapableIds.add(component.id);
        }
        bumpSerialVersion();
        return component;
    };

    // 删除组件
    const removeComponent = (componentId) => {
        const index = components.value.findIndex((c) => c.id === componentId);
        if (index !== -1) {
            const component = components.value[index];
            components.value.splice(index, 1);
            componentMap.delete(componentId);
            componentIndexMap.delete(componentId);
            raycastCapableIds.delete(componentId);
            // splice 改变了后续元素的索引，重建映射
            rebuildIndexMap();
            clearComponentLinkedEditorState(componentId);
            bumpSerialVersion();

            return component;
        }
        return null;
    };

    // 更新组件配置
    // ★ 使用 getReactiveComponent（Vue 响应式 Proxy）做 Object.assign，
    //   确保 SET 走 Proxy 陷阱，触发 computed/watcher 依赖更新。
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
        componentMap.set(nextId, rawComponent); // componentMap 维护 raw 引用用于快速查找
        replaceLinkedComponentId(componentId, nextId);
        bumpSerialVersion();
        return component;
    };

    // 更新组件实例（markRaw 阻止 Vue 递归代理 Three.js 对象）
    const updateComponentInstance = (componentId, instance) => {
        const component = getReactiveComponent(componentId);
        if (component) {
            component.instance = instance ? markRaw(instance) : null;
            // 更新 raycast 能力缓存
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

    // 选中组件
    const selectComponent = (componentId) => {
        const nextId = getComponentById(componentId) ? componentId : null;
        selectedComponentId.value = nextId;
        if (!nextId || canvasSubSelection.value?.componentId !== nextId) {
            canvasSubSelection.value = createCanvasSubSelectionState();
        }
    };

    // 取消选中
    const deselectComponent = () => {
        selectedComponentId.value = null;
        canvasSubSelection.value = createCanvasSubSelectionState();
    };

    // ========== 路侧设备管理（编辑器态） ==========

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

    // ========== 轨迹移动：路线拾取（编辑器态） ==========

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

    // ========== 点位管理器：点位拾取（编辑器态） ==========

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

    // ========== Mesh 吸管拾取（编辑器态） ==========

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

    // 切换组件可见性
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

    // 根据类型获取组件
    const getComponentsByType = (type) => {
        return components.value.filter((c) => c.type === type);
    };

    // 根据名称获取组件
    const getComponentByName = (name) => {
        return components.value.find((c) => c.name === name);
    };

    // 清空所有组件
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
     * 从项目数据恢复组件列表（保留原始 id）
     * 同时同步内部计数器，避免后续 addComponent 产生 id 冲突。
     * @param {Array} list - 组件列表
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

    // ========== 事件管理方法 ==========

    // 添加事件到组件（★ 使用响应式代理确保 UI 立即感知变化）
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

    // 移除组件的事件（★ 使用响应式代理确保 UI 立即感知变化）
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

    // 更新组件的事件（★ 使用响应式代理确保 handlerType 等切换时 UI 立即响应）
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

    // 获取组件的所有事件
    const getComponentEvents = (componentId) => {
        const component = getComponentById(componentId);
        const source = Array.isArray(component?.events) ? component.events : [];
        return source.map((item) => ({ ...item }));
    };

    // ========== 数据接入方法 ==========

    // 更新组件的数据接入配置（支持多数据源）
    const updateDataBinding = (componentId, dataBinding) => {
        const component = getReactiveComponent(componentId);
        if (component) {
            component.dataBinding = normalizeDataBindingForStore(dataBinding);
            bumpSerialVersion();
            return component;
        }
        return null;
    };

    // 获取组件的数据接入配置
    const getDataBinding = (componentId) => {
        const component = getComponentById(componentId);
        return component?.dataBinding || null;
    };

    // 添加数据源
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

    // 更新数据源
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

    // 删除数据源
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
        // 状态
        components,
        serialVersion,
        selectedComponentId,
        selectedComponent,
        raycastCapableIds,

        // 路侧设备管理（编辑器态）
        trafficSelectedDevice,
        trafficPicking,
        trafficPickConfirm,

        // 轨迹移动拾取（编辑器态）
        trajectoryPicking,
        trajectoryPickConfirm,

        // 点位管理器拾取（编辑器态）
        buildingPicking,
        buildingPickConfirm,
        meshPicking,
        meshPickResult,
        canvasSubSelection,

        // 组件方法
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

        // 路侧设备管理方法（编辑器态）
        setTrafficSelectedDevice,
        clearTrafficSelectedDevice,
        startTrafficPicking,
        stopTrafficPicking,
        requestTrafficPickConfirm,
        clearTrafficPickConfirm,

        // 轨迹移动拾取方法（编辑器态）
        startTrajectoryPicking,
        stopTrajectoryPicking,
        requestTrajectoryPickConfirm,
        clearTrajectoryPickConfirm,

        // 点位管理器拾取方法（编辑器态）
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

        // 事件方法
        addEvent,
        removeEvent,
        updateEvent,
        getComponentEvents,

        // 数据接入方法
        updateDataBinding,
        getDataBinding,
        addDataSource,
        updateDataSource,
        removeDataSource
    };
});

