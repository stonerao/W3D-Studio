import { useSceneStore } from '../stores/useSceneStore';
import { useComponentStore } from '../stores/useComponentStore';
import { useDataSourceStore } from '../stores/useDataSourceStore';
import { useVariableStore } from '../stores/useVariableStore';
import { getComponent } from '../utils/componentRegistry';
import { useEventSystem } from './useEventSystem';
import { tagInstanceForPicking } from '../utils/picking';
import { executeRuntimeDataSource } from '../services/dataSourceRuntime';
import { applyDataSourceTransform } from '../services/visualDataTransform';
import { translateDisplayText } from '../i18n';

/**
 * English comment.
 */
export function useComponent() {
    const sceneStore = useSceneStore();
    const componentStore = useComponentStore();
    const dataSourceStore = useDataSourceStore();
    const variableStore = useVariableStore();
    const eventSystem = useEventSystem();

    const HIGHLIGHT_KEY = '__w3dEditorSelectionBoxHelper';
    const CAMERA_EXCLUSIVE_TYPES = new Set([
        'FlyControls',
        'FirstPersonControls',
        'CameraTour'
    ]);

    // English comment.
    const devLog = (...args) => { if (import.meta?.env?.DEV) console.log(...args); };

    const generateUniqueName = (baseName) => {
        const existingNames = new Set((componentStore.components || []).map((c) => c.name));
        if (!existingNames.has(baseName)) return baseName;

        // English comment.
        let index = 1;
        let newName = `${baseName}${index}`;
        while (existingNames.has(newName)) {
            index += 1;
            newName = `${baseName}${index}`;
        }
        return newName;
    };

    const cloneJsonSafe = (value, fallback = value) => {
        try {
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

    const remapMethodCallConfigForDuplicate = (config, sourceId, targetId) => {
        if (!config || typeof config !== 'object') return null;
        const cloned = cloneJsonSafe(config, {});
        return {
            ...cloned,
            targetComponentId: remapComponentIdReference(cloned.targetComponentId || '', sourceId, targetId),
            parameters: Array.isArray(cloned.parameters)
                ? cloned.parameters.map((param) => cloneJsonSafe(param, param))
                : []
        };
    };

    const remapBlueprintForDuplicate = (blueprint, sourceId, targetId, eventIdMap = new Map()) => {
        const cloned = cloneJsonSafe(blueprint, null);
        if (!cloned || typeof cloned !== 'object') return null;

        if (Array.isArray(cloned.nodes)) {
            cloned.nodes = cloned.nodes.map((node) => {
                const nextNode = cloneJsonSafe(node, node);
                if (!nextNode?.data || typeof nextNode.data !== 'object') return nextNode;

                const data = nextNode.data;
                if (Object.prototype.hasOwnProperty.call(data, 'targetComponentId')) {
                    data.targetComponentId = remapComponentIdReference(data.targetComponentId, sourceId, targetId);
                }
                if (Object.prototype.hasOwnProperty.call(data, 'componentId')) {
                    data.componentId = remapComponentIdReference(data.componentId, sourceId, targetId);
                }
                if (data.eventId && eventIdMap.has(String(data.eventId))) {
                    data.eventId = eventIdMap.get(String(data.eventId));
                }
                if (Array.isArray(data.conditionInputs)) {
                    data.conditionInputs = data.conditionInputs.map((input) => {
                        const nextInput = cloneJsonSafe(input, input);
                        if (nextInput && typeof nextInput === 'object' && Object.prototype.hasOwnProperty.call(nextInput, 'componentId')) {
                            nextInput.componentId = remapComponentIdReference(nextInput.componentId, sourceId, targetId);
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

    const repairStaleSelfEventReferences = (component) => {
        const staleReferenceIds = [
            component?.config?.id,
            component?.instance?.config?.id
        ]
            .map((item) => String(item || ''))
            .filter((item) => item && item !== component.id);
        const events = Array.isArray(component?.events) ? component.events : [];
        if (staleReferenceIds.length === 0 || events.length === 0) return;

        const eventIdMap = new Map(events.map((event) => [
            String(event?.id || ''),
            String(event?.id || '')
        ]));
        const repairedEvents = events.map((event) => ({
            ...cloneJsonSafe(event, {}),
            methodCallConfig: remapMethodCallConfigForDuplicate(event.methodCallConfig, staleReferenceIds, component.id),
            blueprint: event.blueprint
                ? remapBlueprintForDuplicate(event.blueprint, staleReferenceIds, component.id, eventIdMap)
                : null,
            targetFilter: event.targetFilter ? cloneJsonSafe(event.targetFilter, null) : null
        }));

        try {
            eventSystem.replaceComponentEvents(component.id, repairedEvents);
        } catch (error) {
            console.warn(`[Component] Failed to repair stale event references: ${component.name}`, error);
        }
    };

    const resolvePublicDataSource = (source = {}) => {
        if (source?.mode !== 'public-source') return source;

        const publicSource = dataSourceStore.getPublicDataSourceById(source.publicSourceId || '');
        if (!publicSource) {
            throw new Error('Public data source not found');
        }

        return {
            ...cloneJsonSafe(publicSource),
            ...cloneJsonSafe(source),
            id: source.id || publicSource.id,
            mode: publicSource.mode,
            name: source.name || publicSource.name,
            accessCode: publicSource.accessCode || source.accessCode || '',
            accessName: source.accessName || publicSource.name || '',
            method: publicSource.method || source.method || 'GET',
            url: publicSource.mode === 'websocket'
                ? (publicSource.websocketUrl || publicSource.url || source.url || '')
                : (publicSource.url || source.url || ''),
            websocketUrl: publicSource.websocketUrl || source.websocketUrl || '',
            params: Array.isArray(publicSource.params) && publicSource.params.length ? publicSource.params : (source.params || []),
            headers: Array.isArray(publicSource.headers) && publicSource.headers.length ? publicSource.headers : (source.headers || []),
            bodyType: publicSource.bodyType || source.bodyType || 'none',
            bodyParams: Array.isArray(publicSource.bodyParams) && publicSource.bodyParams.length ? publicSource.bodyParams : (source.bodyParams || []),
            body: typeof publicSource.body === 'string' && publicSource.body.length ? publicSource.body : (source.body || ''),
            timeout: Number(publicSource.timeout || source.timeout || 30),
            useGlobalUrl: source.useGlobalUrl !== false,
            publicSourceId: source.publicSourceId || publicSource.id
        };
    };

    const syncRuntimeVisibility = (instance, visible) => {
        if (!instance || typeof visible !== 'boolean') return;

        if (typeof instance.setVisible === 'function') {
            instance.setVisible(visible, { emit: false });
            return;
        }

        instance.visible = visible;

        const runtimeRoots = [
            instance.componentScene,
            instance.group,
            instance.object3d,
            instance.mesh,
            instance.model
        ];

        runtimeRoots.forEach((root) => {
            if (root && typeof root.visible === 'boolean') {
                root.visible = visible;
            }
        });
    };

    const clearSelectionHighlight = () => {
        const scene = sceneStore.sceneInstance;
        if (!scene) return;

        try {
            scene.remove(HIGHLIGHT_KEY);
        } catch (error) {
            void error;
        }
    };

    const highlightComponent = (componentId) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) return;

        clearSelectionHighlight();

        const component = componentStore.getComponentById(componentId);
        const instance = component?.instance;
        const root = instance?.componentScene || instance?.group || instance?.object3d || instance?.mesh;
        if (!root) return;

        // English comment.
        // English comment.
        scene
            .add('BoundingBoxHelper', {
                name: HIGHLIGHT_KEY,
                target: root,
                color: '#ffff00',
                autoUpdate: false
            })
            .catch(() => {});
    };

    const refreshSelectionHighlight = (componentId = componentStore.selectedComponent?.id) => {
        if (componentId) {
            highlightComponent(componentId);
            return;
        }
        clearSelectionHighlight();
    };

    const rebuildComponentInstance = async (componentId, nextFullConfig) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            throw new Error('Scene not initialized');
        }

        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        if (component.instance) {
            try {
                scene.remove(component.name);
            } catch (error) {
                console.warn(`[Component] Failed to remove existing instance: ${component.name}`, error);
            }
            componentStore.updateComponentInstance(componentId, null);
        }

        const finalConfig = {
            ...(nextFullConfig || {}),
            name: component.name,
            id: component.id
        };

        const instance = await scene.add(component.type, finalConfig);
        if (instance?.config) {
            instance.config.id = component.id;
        }
        componentStore.updateComponent(componentId, { config: finalConfig });
        componentStore.updateComponentInstance(componentId, instance);

        tagInstanceForPicking(componentId, instance);

        syncRuntimeVisibility(instance, component.visible);

        eventSystem.attachExistingEventsToInstance(componentId);
        return instance;
    };

    /**
     * English comment.
     */
    const addComponent = async (type, config = {}) => {
        devLog('[useComponent] addComponent 被调用，type:', type, 'config:', config);

        const scene = sceneStore.sceneInstance;
        if (!scene) {
            console.error('[useComponent] 场景未初始化！');
            throw new Error('Scene not initialized');
        }

        devLog('[useComponent] 场景实例存在，scene:', scene);

        try {
            // English comment.
            const componentInfo = getComponent(type);
            if (!componentInfo) {
                console.error('[useComponent] 组件类型未找到:', type);
                throw new Error(`Component type "${type}" not found`);
            }

            devLog('[useComponent] 组件信息:', componentInfo);

            // English comment.
            const displayName = translateDisplayText(componentInfo.metadata?.displayName || type);
            const baseName = config.name || displayName;
            const name = generateUniqueName(baseName);

            // English comment.
            const finalConfig = {
                ...componentInfo.metadata.defaultConfig,
                ...config,
                name
            };

            devLog('[useComponent] 最终配置:', finalConfig);

            // English comment.
            devLog('[useComponent] 调用 scene.add...');
            const instance = await scene.add(type, finalConfig);
            devLog('[useComponent] scene.add 完成，instance:', instance);

            // English comment.
            const componentData = componentStore.addComponent({
                name,
                type,
                config: finalConfig,
                instance
            });

            // English comment.
            if (instance && componentData.id) {
                if (!instance.config) instance.config = {};
                instance.config.id = componentData.id;
            }
            componentStore.updateComponent(componentData.id, {
                config: {
                    ...finalConfig,
                    id: componentData.id
                }
            });

            syncRuntimeVisibility(instance, componentData.visible !== false);

            devLog('[useComponent] 组件已添加到 store，componentData:', componentData);

            tagInstanceForPicking(componentData.id, instance);
            if (CAMERA_EXCLUSIVE_TYPES.has(type) && finalConfig.enabled !== false) {
                await enforceExclusiveCameraComponents(componentData.id);
            }

            // English comment.
            selectComponent(componentData.id);

            devLog(`[useComponent] ✅ 组件添加成功: ${type}`, componentData);

            return componentData;
        } catch (error) {
            console.error('[useComponent] ❌ 添加组件失败:', error);
            throw error;
        }
    };

    /**
     * English comment.
     */
    const renameComponent = async (componentId, newName) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            throw new Error('Scene not initialized');
        }

        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        const trimmed = typeof newName === 'string' ? newName.trim() : '';
        if (!trimmed) return null;

        const oldName = component.name;
        const uniqueName = generateUniqueName(trimmed);
        if (uniqueName === oldName) return component;

        // English comment.
        if (component.instance) {
            try {
                scene.remove(oldName);
            } catch (error) {
                console.warn(`[Component] Failed to remove old instance by name: ${oldName}`, error);
            }
            componentStore.updateComponentInstance(componentId, null);
        }

        const nextConfig = {
            ...(component.config || {}),
            name: uniqueName,
            id: componentId
        };

        const instance = await scene.add(component.type, nextConfig);
        if (instance?.config) {
            instance.config.id = componentId;
        }
        componentStore.updateComponent(componentId, {
            name: uniqueName,
            config: nextConfig
        });
        componentStore.updateComponentInstance(componentId, instance);

        tagInstanceForPicking(componentId, instance);

        syncRuntimeVisibility(instance, component.visible);

        eventSystem.attachExistingEventsToInstance(componentId);
        // English comment.
        if (componentStore.selectedComponent?.id === componentId) {
            highlightComponent(componentId);
        }
        return componentStore.getComponentById(componentId) || null;
    };

    /**
     * English comment.
     */
    const duplicateComponent = async (componentId) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            throw new Error('Scene not initialized');
        }

        const source = componentStore.getComponentById(componentId);
        if (!source) {
            throw new Error(`Component not found: ${componentId}`);
        }

        const baseName = `${source.name}_copy`;
        const name = generateUniqueName(baseName);
        const config = {
            ...cloneJsonSafe(source.config || {}),
            name
        };
        delete config.id;

        const instance = await scene.add(source.type, config);

        const created = componentStore.addComponent({
            name,
            type: source.type,
            config,
            visible: source.visible !== false,
            previewVisible: source.previewVisible !== false,
            variableBindings: cloneJsonSafe(source.variableBindings || {}),
            instance
        });

        const duplicatedConfig = {
            ...config,
            id: created.id
        };
        if (instance) {
            if (!instance.config) instance.config = {};
            instance.config.id = created.id;
        }
        componentStore.updateComponent(created.id, {
            config: duplicatedConfig
        });
        tagInstanceForPicking(created.id, instance);

        // English comment.
        componentStore.updateComponent(created.id, {
            visible: !!source.visible,
            previewVisible: source.previewVisible !== false,
            variableBindings: cloneJsonSafe(source.variableBindings || {}),
            locked: !!source.locked
        });
        syncRuntimeVisibility(instance, !!source.visible);

        // English comment.
        const sourceEvents = Array.isArray(source.events) ? source.events : [];
        const sourceReferenceIds = [
            source.id,
            source.config?.id,
            source.instance?.config?.id
        ].map((item) => String(item || '')).filter(Boolean);
        const eventIdMap = new Map(sourceEvents.map((event) => [
            String(event?.id || ''),
            `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        ]));
        const duplicatedEvents = sourceEvents.map((event) => {
            const eventId = eventIdMap.get(String(event?.id || '')) || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const blueprint = remapBlueprintForDuplicate(event.blueprint, sourceReferenceIds, created.id, eventIdMap);
            return {
                ...cloneJsonSafe(event, {}),
                id: eventId,
                type: event.type,
                enabled: event.enabled !== undefined ? event.enabled : true,
                handlerType: event.handlerType || 'code',
                handler: event.handler,
                methodCallConfig: remapMethodCallConfigForDuplicate(event.methodCallConfig, sourceReferenceIds, created.id),
                blueprint,
                blueprintTriggerNodeId: event.blueprintTriggerNodeId || '',
                targetFilter: event.targetFilter ? cloneJsonSafe(event.targetFilter, null) : null,
                description: event.description || '',
                createdAt: Date.now()
            };
        });

        componentStore.updateComponent(created.id, {
            events: duplicatedEvents
        });

        eventSystem.attachExistingEventsToInstance(created.id);
        selectComponent(created.id);
        return componentStore.getComponentById(created.id) || created;
    };

    /**
     * English comment.
     */
    const removeComponent = (componentId) => {
        const scene = sceneStore.sceneInstance;
        if (!scene) {
            throw new Error('Scene not initialized');
        }

        try {
            const wasSelected = componentStore.selectedComponent?.id === componentId;
            const component = componentStore.getComponentById(componentId);
            if (!component) {
                throw new Error(`Component not found: ${componentId}`);
            }
            if (component.locked) {
                throw new Error(`Component is locked: ${component.name}`);
            }

            // English comment.
            scene.remove(component.name);

            // English comment.
            componentStore.removeComponent(componentId);

            if (wasSelected) {
                componentStore.deselectComponent();
                clearSelectionHighlight();
            }

            devLog(`Component removed: ${component.name}`);
        } catch (error) {
            console.error('Failed to remove component:', error);
            throw error;
        }
    };

    /**
     * English comment.
     */
    /**
     * English comment.
     */
    const deepMergeConfig = (target, source) => {
        const result = { ...target };
        for (const key in source) {
            if (
                source[key] !== null &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key])
            ) {
                result[key] = deepMergeConfig(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    };

    const syncComponentEnabledState = async (component, enabled) => {
        const nextConfig = deepMergeConfig(component.config || {}, { enabled });
        nextConfig.name = component.name;
        nextConfig.id = component.id;
        componentStore.updateComponent(component.id, { config: nextConfig });

        if (!component.instance) return;

        try {
            if (typeof component.instance.updateConfig === 'function') {
                await component.instance.updateConfig({
                    enabled,
                    id: component.id,
                    name: component.name
                });
            } else {
                await rebuildComponentInstance(component.id, nextConfig);
            }
        } catch (error) {
            console.warn(`[Component] failed to sync enabled state: ${component.name}`, error);
        }
    };

    const enforceExclusiveCameraComponents = async (activeComponentId = '') => {
        const targets = (componentStore.components || []).filter((item) => {
            if (!item || item.id === activeComponentId) return false;
            if (!CAMERA_EXCLUSIVE_TYPES.has(item.type)) return false;
            return item.config?.enabled !== false;
        });

        for (const target of targets) {
            await syncComponentEnabledState(target, false);
        }
    };

    const updateComponentConfig = async (componentId, config) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        repairStaleSelfEventReferences(component);

        // English comment.
        const newConfig = deepMergeConfig(component.config || {}, config || {});
        // English comment.
        newConfig.name = component.name;
        newConfig.id = component.id;

        // English comment.
        componentStore.updateComponent(componentId, { config: newConfig });

        // English comment.
        if (component.instance) {
            try {
                if (component.instance.config) {
                    component.instance.config.id = component.id;
                }
                const shouldRebuildInstance =
                    component.type === 'Label3D' &&
                    Object.prototype.hasOwnProperty.call(config || {}, 'labels');

                if (!shouldRebuildInstance && typeof component.instance.updateConfig === 'function') {
                    await component.instance.updateConfig({
                        ...(config || {}),
                        id: component.id,
                        name: component.name
                    });
                } else {
                    await rebuildComponentInstance(componentId, newConfig);
                }
            } catch (error) {
                // English comment.
                console.warn(`[Component] Runtime instance sync failed (non-fatal): ${component.name}`, error);
            }
        }

        const shouldEnforceExclusiveCamera = (
            CAMERA_EXCLUSIVE_TYPES.has(component.type) &&
            Object.prototype.hasOwnProperty.call(config || {}, 'enabled') &&
            config.enabled === true
        );
        if (shouldEnforceExclusiveCamera) {
            await enforceExclusiveCameraComponents(componentId);
        }

        devLog(`Component config updated: ${component.name}`, config);
    };

    /**
     * English comment.
     */
    const selectComponent = (componentId) => {
        componentStore.selectComponent(componentId);

        if (componentId) {
            highlightComponent(componentId);
        } else {
            clearSelectionHighlight();
        }
    };

    /**
     * English comment.
     */
    const deselectComponent = () => {
        componentStore.deselectComponent();
        clearSelectionHighlight();
    };

    /**
     * English comment.
     */
    const toggleComponentVisibility = (componentId) => {
        const component = componentStore.toggleComponentVisibility(componentId);
        if (component && component.instance) {
            syncRuntimeVisibility(component.instance, component.visible);
            devLog(`Component visibility toggled: ${component.name} -> ${component.visible}`);
        }
    };

    const setComponentVisibility = (componentId, visible) => {
        const component = componentStore.setComponentVisibility(componentId, visible);
        if (component && component.instance) {
            syncRuntimeVisibility(component.instance, component.visible);
            devLog(`Component visibility updated: ${component.name} -> ${component.visible}`);
        }
    };

    const normalizeBooleanStateValue = (value) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (!normalized) return false;
            if (['false', '0', 'off', 'no', 'hidden', 'hide'].includes(normalized)) return false;
            if (['true', '1', 'on', 'yes', 'visible', 'show'].includes(normalized)) return true;
        }
        return Boolean(value);
    };

    const normalizeNumberStateValue = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const normalizeVector3StateValue = (value, fallback = [0, 0, 0]) => {
        if (Array.isArray(value)) {
            return [0, 1, 2].map((index) => normalizeNumberStateValue(value[index], fallback[index]));
        }

        if (value && typeof value === 'object') {
            return ['x', 'y', 'z'].map((key, index) => {
                const objectValue = value[key] ?? value[index];
                return normalizeNumberStateValue(objectValue, fallback[index]);
            });
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [...fallback];

            try {
                return normalizeVector3StateValue(JSON.parse(trimmed), fallback);
            } catch {
                const parts = trimmed
                    .split(/[,\s，]+/)
                    .map((item) => item.trim())
                    .filter(Boolean);
                if (parts.length >= 3) {
                    return [0, 1, 2].map((index) => normalizeNumberStateValue(parts[index], fallback[index]));
                }
            }
        }

        return [...fallback];
    };

    const normalizeScaleStateValue = (value, fallback = 1) => {
        if (typeof value === 'number') {
            const nextValue = normalizeNumberStateValue(value, fallback);
            return nextValue > 0 ? nextValue : fallback;
        }

        if (Array.isArray(value) || (value && typeof value === 'object')) {
            return normalizeVector3StateValue(value, [fallback, fallback, fallback]).map((item) => (item > 0 ? item : fallback));
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return fallback;

            try {
                return normalizeScaleStateValue(JSON.parse(trimmed), fallback);
            } catch {
                if (trimmed.includes(',') || trimmed.includes(' ') || trimmed.includes('，')) {
                    return normalizeScaleStateValue(trimmed.split(/[,\s，]+/).filter(Boolean), fallback);
                }
                return normalizeScaleStateValue(Number(trimmed), fallback);
            }
        }

        return fallback;
    };

    const isStateEqual = (currentValue, nextValue) => {
        try {
            return JSON.stringify(currentValue) === JSON.stringify(nextValue);
        } catch {
            return currentValue === nextValue;
        }
    };

    const applyRootComponentProperty = async (componentId, propertyKey, value) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) return false;

        if (propertyKey === 'visible') {
            const nextVisible = normalizeBooleanStateValue(value);
            if (component.visible === nextVisible) return false;
            setComponentVisibility(componentId, nextVisible);
            return true;
        }

        if (propertyKey === 'previewVisible') {
            const nextPreviewVisible = normalizeBooleanStateValue(value);
            if (component.previewVisible === nextPreviewVisible) return false;
            componentStore.updateComponent(componentId, {
                previewVisible: nextPreviewVisible
            });
            return true;
        }

        if (propertyKey === 'locked') {
            const nextLocked = normalizeBooleanStateValue(value);
            if (component.locked === nextLocked) return false;
            componentStore.updateComponent(componentId, {
                locked: nextLocked
            });
            return true;
        }

        if (propertyKey === 'position') {
            const nextPosition = normalizeVector3StateValue(value, component.config?.position || [0, 0, 0]);
            if (isStateEqual(component.config?.position || [0, 0, 0], nextPosition)) return false;
            await updateComponentConfig(componentId, { position: nextPosition });
            return true;
        }

        if (propertyKey === 'rotation') {
            const nextRotation = normalizeVector3StateValue(value, component.config?.rotation || [0, 0, 0]);
            if (isStateEqual(component.config?.rotation || [0, 0, 0], nextRotation)) return false;
            await updateComponentConfig(componentId, { rotation: nextRotation });
            return true;
        }

        if (propertyKey === 'scale') {
            const nextScale = normalizeScaleStateValue(value, component.config?.scale || 1);
            if (isStateEqual(component.config?.scale || 1, nextScale)) return false;
            await updateComponentConfig(componentId, { scale: nextScale });
            return true;
        }

        return false;
    };

    const applyComponentVariableBindings = async (componentId) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) return false;

        const bindings = component.variableBindings || {};
        let applied = false;

        for (const [propertyKey, variableName] of Object.entries(bindings)) {
            const name = String(variableName || '').trim();
            if (!name) continue;
            const variable = variableStore.getVariableByName(name);
            if (!variable) continue;
            if (await applyRootComponentProperty(componentId, propertyKey, variable.value)) {
                applied = true;
            }
        }

        return applied;
    };

    const applyAllComponentVariableBindings = async () => {
        const tasks = (componentStore.components || []).map((component) => applyComponentVariableBindings(component.id));
        await Promise.all(tasks);
    };

    /**
     * English comment.
     */
    const getComponents = () => {
        return componentStore.components;
    };

    /**
     * English comment.
     */
    const getSelectedComponent = () => {
        return componentStore.selectedComponent;
    };

    /**
     * English comment.
     */
    const clearAllComponents = () => {
        const scene = sceneStore.sceneInstance;
        const unlockedComponents = (componentStore.components || []).filter((component) => !component?.locked);
        const removedSelected = unlockedComponents.some((component) => component?.id === componentStore.selectedComponent?.id);
        if (scene) {
            unlockedComponents.forEach((component) => {
                try {
                    scene.remove(component.name);
                    componentStore.removeComponent(component.id);
                } catch (error) {
                    console.error(`Failed to remove component: ${component.name}`, error);
                }
            });
        }
        if (removedSelected) {
            componentStore.deselectComponent();
            clearSelectionHighlight();
        } else if (componentStore.selectedComponent?.locked) {
            selectComponent(componentStore.selectedComponent.id);
        }
    };

    // English comment.

    /**
     * English comment.
     */
    const executeMethodBinding = async (component, source, finalValue) => {
        const instance = component?.instance;
        if (!instance) return;

        const bindingList = [];
        if (Array.isArray(source?.methodBindings)) {
            source.methodBindings.forEach((item) => bindingList.push(item));
        } else if (source?.methodBinding) {
            bindingList.push(source.methodBinding);
        }

        for (const binding of bindingList) {
            const methodName = String(binding?.methodName || '').trim();
            if (!binding?.enabled || !methodName) continue;
            if (methodName === 'requestData' || methodName === 'executeDataBinding') continue;

            const method = instance?.[methodName];
            if (typeof method !== 'function') {
                console.warn(`[DataBinding] Method not found: ${methodName}`);
                continue;
            }

            try {
                await method.call(instance, finalValue);
            } catch (error) {
                console.warn(`[DataBinding] Method execute failed: ${methodName}`, error);
            }
        }
    };

    const executeDataBinding = async (componentId, sourceId = null, apiBaseUrl = '') => {
        const component = componentStore.getComponentById(componentId);
        if (!component?.dataBinding?.enabled) {
            return { success: false, message: '数据绑定未启用' };
        }

        const sources = component.dataBinding.sources || [];
        if (sources.length === 0) {
            return { success: false, message: '没有配置数据源' };
        }

        const results = [];
        const sourcesToExecute = sourceId
            ? sources.filter(s => s.id === sourceId)
            : sources;

        for (const source of sourcesToExecute) {
            try {
                const applySourceData = async (rawData) => {
                    const data = applyDataSourceTransform(source, rawData, {
                        onTransformError: (error) => {
                            console.warn('[DataBinding] 数据转换函数执行失败:', error);
                        }
                    });

                    const bindProperties = Array.isArray(source.bindProperties) && source.bindProperties.length
                        ? source.bindProperties
                        : (source.bindProperty ? [source.bindProperty] : []);

                    let mergedUpdateData = null;
                    for (const path of bindProperties) {
                        const bindPath = String(path || '').trim();
                        if (!bindPath) continue;
                        if (await applyRootComponentProperty(componentId, bindPath, data)) continue;
                        const nextData = setNestedValue({}, bindPath, data);
                        mergedUpdateData = mergedUpdateData ? deepMergeConfig(mergedUpdateData, nextData) : nextData;
                    }

                    if (mergedUpdateData) {
                        await updateComponentConfig(componentId, mergedUpdateData);
                    }
                    await executeMethodBinding(component, source, data);
                    return data;
                };

                const result = await fetchDataSource(source, apiBaseUrl, componentId, applySourceData);
                if (result.success) {
                    const appliedData = result.data === null || result.data === undefined
                        ? result.data
                        : await applySourceData(result.data);

                    results.push({
                        sourceId: source.id,
                        success: true,
                        data: appliedData,
                        connected: result.connected || false,
                        live: result.live || false,
                        mode: result.mode || source.mode || 'http'
                    });
                    continue;
                }

                results.push({ sourceId: source.id, success: false, error: result.error });
            } catch (error) {
                console.error(`[DataBinding] 数据源 ${source.name} 请求失败:`, error);
                results.push({ sourceId: source.id, success: false, error: error.message });
            }
        }

        return {
            success: results.every(r => r.success),
            results
        };
    };

    /**
     * English comment.
     */
    const fetchDataSource = async (source, apiBaseUrl = '', componentId = '', onData) => {
        try {
            const resolvedSource = resolvePublicDataSource(source);
            return await executeRuntimeDataSource({
                source: resolvedSource,
                apiBaseUrl,
                componentId,
                onData,
                globalConfig: {
                    ...dataSourceStore.globalConfig,
                    headersObject: dataSourceStore.headersObject,
                    variableValues: Object.fromEntries(
                        (variableStore.variables || []).map((item) => [item.name, item.value])
                    )
                }
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    /**
     * English comment.
     */
    const setNestedValue = (obj, path, value) => {
        const result = { ...obj };
        const keys = path.split('.');
        let current = result;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            current[key] = current[key] ? { ...current[key] } : {};
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
        return result;
    };

    return {
        // English comment.
        components: componentStore.components,
        selectedComponent: componentStore.selectedComponent,

        // English comment.
        addComponent,
        removeComponent,
        updateComponentConfig,
        renameComponent,
        duplicateComponent,
        selectComponent,
        deselectComponent,
        clearSelectionHighlight,
        refreshSelectionHighlight,
        toggleComponentVisibility,
        setComponentVisibility,
        applyComponentVariableBindings,
        applyAllComponentVariableBindings,
        getComponents,
        getSelectedComponent,
        clearAllComponents,

        // English comment.
        executeDataBinding,
        fetchDataSource
    };
}

