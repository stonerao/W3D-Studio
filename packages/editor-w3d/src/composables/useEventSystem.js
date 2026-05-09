import { useComponentStore } from '../stores/useComponentStore';
import { useVariableStore } from '../stores/useVariableStore';
import { useDataSourceStore } from '../stores/useDataSourceStore';
import { getEventMetadata } from '../config/eventTypes';
import { executeRuntimeDataSource } from '../services/dataSourceRuntime';
import { getModelHitIdentity } from '../utils/modelElementIdentity';

const MODEL_TARGET_META_KEY = '__w3dModelTargetMeta';
const MODEL_LOADER_INTERACTION_EVENTS = new Set(['onClick', 'onDoubleClick', 'onHover', 'onHoverOut']);

/**
 * English comment.
 */
export function useEventSystem() {
    const componentStore = useComponentStore();
    const variableStore = useVariableStore();
    const dataSourceStore = useDataSourceStore();

    const isEventConfigBlocked = (component) => {
        void component;
        return false;
    };

    const normalizeTargetFilter = (filter = null) => {
        if (!filter || typeof filter !== 'object') return null;
        const mode = filter.mode === 'all' ? 'all' : 'target';
        return {
            enabled: filter.enabled !== false,
            mode,
            meshNames: Array.isArray(filter.meshNames)
                ? [...new Set(filter.meshNames.map((item) => String(item || '').trim()).filter(Boolean))]
                : [],
            nodePaths: Array.isArray(filter.nodePaths)
                ? [...new Set(filter.nodePaths.map((item) => String(item || '').trim()).filter(Boolean))]
                : [],
            includeChildren: filter.includeChildren !== false
        };
    };

    const getEventsForComponent = (componentId, fallbackEvents = null) => {
        if (Array.isArray(fallbackEvents)) return fallbackEvents;
        const component = componentStore.getComponentById(componentId);
        return Array.isArray(component?.events) ? component.events : [];
    };

    const deriveModelLoaderEventInteractiveMeshes = (component, events = []) => {
        if (!component || component.type !== 'ModelLoader') return false;

        const instance = component.instance;
        const names = new Set();
        let needsAllMeshes = false;
        let needsExistingDerivedMeshes = false;

        events.forEach((event) => {
            if (!event || event.enabled === false || !MODEL_LOADER_INTERACTION_EVENTS.has(event.type)) return;
            const filter = normalizeTargetFilter(event.targetFilter);
            if (!filter || filter.enabled === false) return;

            if (filter.mode === 'all') {
                const meshNames = typeof instance?.getMeshNames === 'function' ? instance.getMeshNames() : [];
                if (Array.isArray(meshNames) && meshNames.length > 0) {
                    meshNames.forEach((name) => {
                        const text = String(name || '').trim();
                        if (text) names.add(text);
                    });
                } else {
                    const existing = component.config?.eventInteractiveMeshes;
                    if (Array.isArray(existing) && existing.length > 0) {
                        existing.forEach((name) => {
                            const text = String(name || '').trim();
                            if (text) names.add(text);
                        });
                    } else {
                        needsAllMeshes = true;
                    }
                }
                return;
            }

            if (filter.nodePaths.length > 0) {
                const modelReady = !!(instance?.getModel?.() || instance?.model);
                if (!modelReady) {
                    needsExistingDerivedMeshes = true;
                } else {
                    const meshNames = typeof instance?.getMeshNamesForNodePaths === 'function'
                        ? instance.getMeshNamesForNodePaths(filter.nodePaths, filter.includeChildren)
                        : [];
                    meshNames.forEach((name) => {
                        const text = String(name || '').trim();
                        if (text) names.add(text);
                    });
                }
            }

            filter.meshNames.forEach((name) => {
                const text = String(name || '').trim();
                if (text) names.add(text);
            });
        });

        if (names.size === 0 && needsExistingDerivedMeshes) {
            const existing = component.config?.eventInteractiveMeshes;
            if (existing === '*') return '*';
            if (Array.isArray(existing) && existing.length > 0) return [...existing];
        }
        if (needsAllMeshes && names.size === 0) return '*';
        return names.size > 0 ? [...names] : false;
    };

    const syncModelLoaderEventInteractiveMeshes = (componentId, events = null) => {
        const component = componentStore.getComponentById(componentId);
        if (!component || component.type !== 'ModelLoader') return;

        const sourceEvents = getEventsForComponent(componentId, events);
        const eventInteractiveMeshes = deriveModelLoaderEventInteractiveMeshes(component, sourceEvents);
        componentStore.updateComponent(componentId, {
            config: {
                ...(component.config || {}),
                eventInteractiveMeshes
            }
        });

        if (typeof component.instance?.setEventInteractiveMeshes === 'function') {
            component.instance.setEventInteractiveMeshes(eventInteractiveMeshes);
        } else if (component.instance) {
            component.instance.config = {
                ...(component.instance.config || {}),
                eventInteractiveMeshes
            };
            component.instance.setupInteractiveObjects?.();
        }
    };

    const createEventCurrentTarget = (target = null, object = null) => {
        const meshName = target?.meshName || object?.name || '';
        return {
            name: meshName,
            meshName,
            nodePath: target?.nodePath || '',
            rawName: target?.rawName || object?.name || '',
            objectType: target?.objectType || object?.type || '',
            objectUuid: target?.objectUuid || object?.uuid || '',
            componentId: target?.componentId || ''
        };
    };

    const ensureEventCurrentTarget = (eventData, target = null) => {
        if (!eventData || typeof eventData !== 'object') return null;
        if (!eventData.current) {
            eventData.current = createEventCurrentTarget(target || eventData.modelTarget, eventData.object);
        }
        return eventData.current;
    };

    const getEventModelTarget = (eventData, componentId = '') => {
        if (!eventData || typeof eventData !== 'object') return null;
        if (eventData.modelTarget) {
            ensureEventCurrentTarget(eventData, eventData.modelTarget);
            return eventData.modelTarget;
        }

        const object = eventData.object;
        if (!object) return null;

        const meta = object.userData?.[MODEL_TARGET_META_KEY] || null;
        const identity = meta || getModelHitIdentity(object);
        const target = {
            meshName: identity.meshName || '',
            nodePath: identity.nodePath || '',
            rawName: identity.rawName || '',
            objectType: identity.objectType || object.type || '',
            objectUuid: identity.objectUuid || object.uuid || '',
            componentId: identity.componentId || componentId || ''
        };

        eventData.modelTarget = target;
        ensureEventCurrentTarget(eventData, target);
        return target;
    };

    const createTargetFilterMatcher = (filter = null, componentId = '') => {
        const normalized = normalizeTargetFilter(filter);
        if (!normalized || normalized.enabled === false || normalized.mode === 'all') {
            return () => true;
        }

        const meshNameSet = new Set(normalized.meshNames);
        const nodePathSet = new Set(normalized.nodePaths);
        const nodePathPrefixes = normalized.nodePaths.filter(Boolean);
        return (eventData) => {
            const target = getEventModelTarget(eventData, componentId);
            if (target?.meshName && meshNameSet.has(target.meshName)) return true;

            if (nodePathSet.size === 0) return false;
            const nodePath = String(target?.nodePath || '');
            if (!nodePath) return false;
            if (nodePathSet.has(nodePath)) return true;

            return nodePathPrefixes.some((prefix) => {
                if (!nodePath.startsWith(`${prefix}/`)) return false;
                if (normalized.includeChildren) return true;
                const rest = nodePath.slice(prefix.length + 1);
                return !!rest && !rest.includes('/');
            });
        };
    };

    /**
     * English comment.
     */
    const bindEvent = (componentId, eventType, eventConfig = {}) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        if (isEventConfigBlocked(component)) {
            throw new Error('性能优化模式已启用，ModelLoader 不支持事件配置');
        }

        const metadata = getEventMetadata(eventType);
        if (!metadata) {
            throw new Error(`Unknown event type: ${eventType}`);
        }

        // English comment.
        const event = {
            id: eventConfig.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: eventType,
            enabled: eventConfig.enabled !== undefined ? eventConfig.enabled : true,
            // English comment.
            handlerType: eventConfig.handlerType || 'code',
            // English comment.
            handler: eventConfig.handler || metadata.example,
            // English comment.
            methodCallConfig: eventConfig.methodCallConfig || null,
            blueprint: eventConfig.blueprint || null,
            blueprintTriggerNodeId: eventConfig.blueprintTriggerNodeId || '',
            targetFilter: normalizeTargetFilter(eventConfig.targetFilter),
            description: eventConfig.description || '',
            createdAt: eventConfig.createdAt || Date.now()
        };

        // English comment.
        componentStore.addEvent(componentId, event);
        syncModelLoaderEventInteractiveMeshes(componentId);

        // English comment.
        if (event.enabled && component.instance) {
            attachEventToInstance(component.instance, event);
        }

        console.log(`Event bound: ${eventType} to ${component.name}`, event);

        return event;
    };

    /**
     * English comment.
     */
    const unbindEvent = (componentId, eventId) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        const event = component.events?.find((e) => e.id === eventId);
        if (!event) {
            throw new Error(`Event not found: ${eventId}`);
        }

        // English comment.
        if (component.instance) {
            detachEventFromInstance(component.instance, event);
        }

        // English comment.
        componentStore.removeEvent(componentId, eventId);
        syncModelLoaderEventInteractiveMeshes(componentId);

        console.log(`Event unbound: ${event.type} from ${component.name}`);
    };

    /**
     * English comment.
     */
    const updateEvent = (componentId, eventId, updates) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        const event = component.events?.find((e) => e.id === eventId);
        if (!event) {
            throw new Error(`Event not found: ${eventId}`);
        }

        // English comment.
        const enabledChanged = updates.enabled !== undefined && updates.enabled !== event.enabled;

        // English comment.
        componentStore.updateEvent(componentId, eventId, updates);
        syncModelLoaderEventInteractiveMeshes(componentId);

        // English comment.
        if (component.instance) {
            if (enabledChanged) {
                if (updates.enabled) {
                    attachEventToInstance(component.instance, { ...event, ...updates });
                } else {
                    detachEventFromInstance(component.instance, event);
                }
            } else if (event.enabled) {
                // English comment.
                detachEventFromInstance(component.instance, event);
                attachEventToInstance(component.instance, { ...event, ...updates });
            }
        }

        console.log(`Event updated: ${event.type}`, updates);
    };

    /**
     * English comment.
     */
    const toggleEvent = (componentId, eventId) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) return;

        const event = component.events?.find((e) => e.id === eventId);
        if (!event) return;

        updateEvent(componentId, eventId, { enabled: !event.enabled });
    };

    const normalizeRuntimeEvent = (event = {}) => ({
        id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: event.type,
        enabled: event.enabled !== undefined ? event.enabled : true,
        handlerType: event.handlerType || 'code',
        handler: event.handler || '',
        methodCallConfig: event.methodCallConfig || null,
        blueprint: event.blueprint || null,
        blueprintTriggerNodeId: event.blueprintTriggerNodeId || '',
        targetFilter: normalizeTargetFilter(event.targetFilter),
        description: event.description || '',
        createdAt: event.createdAt || Date.now()
    });

    const replaceComponentEvents = (componentId, nextEvents = []) => {
        const component = componentStore.getComponentById(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }
        if (isEventConfigBlocked(component)) {
            throw new Error('性能优化模式已启用，ModelLoader 不支持事件配置');
        }

        const currentEvents = Array.isArray(component.events) ? [...component.events] : [];
        if (component.instance) {
            currentEvents.forEach((event) => detachEventFromInstance(component.instance, event));
        }

        const normalizedEvents = Array.isArray(nextEvents)
            ? nextEvents.map((event) => normalizeRuntimeEvent(event)).filter((event) => event.type)
            : [];

        componentStore.updateComponent(componentId, { events: normalizedEvents });
        syncModelLoaderEventInteractiveMeshes(componentId, normalizedEvents);

        if (component.instance) {
            normalizedEvents.forEach((event) => {
                if (event.enabled) attachEventToInstance(component.instance, event);
            });
        }

        return normalizedEvents;
    };

    /**
     * English comment.
     */
    const triggerEvent = (componentId, eventType, ...args) => {
        const component = componentStore.getComponentById(componentId);
        if (!component || !component.events) return;

        const events = component.events.filter((e) => e.type === eventType && e.enabled);

        events.forEach((event) => {
            try {
                if (event.handlerType === 'blueprint') {
                    createBlueprintHandler(event, componentId, component.instance)(...args);
                } else if (event.handlerType === 'method') {
                    createComponentMethodCallHandler(event.methodCallConfig)(...args);
                } else {
                    executeEventHandler(event.handler, args);
                }
            } catch (error) {
                console.error(`Error executing event handler: ${event.type}`, error);
            }
        });
    };

    const lifecycleHookMap = {
        onLoaded: 'onLoaded',
        onMounted: 'onMounted',
        onUnmount: 'onDispose',
        onUpdate: 'onUpdate'
    };

    /**
     * English comment.
     */
    const interactiveEventMap = {
        onClick: 'click',
        onDoubleClick: 'dblclick',
        onHover: 'mouseenter',
        onHoverOut: 'mouseleave'
    };

    const ensureLifecycleBucket = (instance, eventType) => {
        const methodName = lifecycleHookMap[eventType];
        if (!methodName) return null;

        if (!instance._eventLifecycleBuckets) {
            instance._eventLifecycleBuckets = {};
        }

        if (!instance._eventLifecycleBuckets[eventType]) {
            const original = typeof instance[methodName] === 'function' ? instance[methodName] : null;
            instance._eventLifecycleBuckets[eventType] = {
                methodName,
                original,
                handlers: new Map()
            };
        }

        return instance._eventLifecycleBuckets[eventType];
    };

    const rebuildLifecycleWrapper = (instance, eventType) => {
        const bucket = instance?._eventLifecycleBuckets?.[eventType];
        if (!bucket) return;

        const { methodName, original, handlers } = bucket;
        if (!handlers || handlers.size === 0) {
            if (original) {
                instance[methodName] = original;
            } else {
                delete instance[methodName];
            }
            delete instance._eventLifecycleBuckets[eventType];
            return;
        }

        instance[methodName] = function (...args) {
            if (typeof original === 'function') {
                original.apply(this, args);
            }
            handlers.forEach((fn) => {
                try {
                    fn.call(this, ...args);
                } catch (error) {
                    console.error(`Error executing ${eventType} handler`, error);
                }
            });
        };
    };

    /**
     * English comment.
     */
    const attachEventToInstance = (instance, event) => {
        if (!instance || !event.enabled) return;

        const componentId = instance?.config?.id;
        const component = componentId
            ? componentStore.getComponentById(componentId)
            : null;
        if (isEventConfigBlocked(component)) {
            return;
        }

        try {
            // English comment.
            let handlerFn;
            if (event.handlerType === 'method') {
                // English comment.
                handlerFn = createComponentMethodCallHandler(event.methodCallConfig);
            } else if (event.handlerType === 'blueprint') {
                handlerFn = createBlueprintHandler(event, componentId, instance);
            } else {
                // English comment.
                handlerFn = createHandlerFunction(event.handler);
            }

            // English comment.
            switch (event.type) {
            case 'onLoaded':
            case 'onMounted':
            case 'onUnmount':
            case 'onUpdate': {
                const bucket = ensureLifecycleBucket(instance, event.type);
                if (bucket) {
                    bucket.handlers.set(event.id, handlerFn);
                    rebuildLifecycleWrapper(instance, event.type);
                }
                break;
            }

                // English comment.
            case 'onClick':
            case 'onDoubleClick':
            case 'onHover':
            case 'onHoverOut': {
                const coreEventName = interactiveEventMap[event.type];
                if (!coreEventName) break;

                const targetMatcher = createTargetFilterMatcher(event.targetFilter, componentId);

                // English comment.
                const wrappedHandler = (eventData) => {
                    try {
                        getEventModelTarget(eventData, componentId);
                        if (!targetMatcher(eventData)) return;
                        handlerFn(eventData, instance);
                    } catch (err) {
                        console.error(`Error executing ${event.type} handler:`, err);
                    }
                };

                // English comment.
                if (!instance._interactiveHandlers) {
                    instance._interactiveHandlers = {};
                }
                instance._interactiveHandlers[event.id] = {
                    coreEventName,
                    handler: wrappedHandler
                };

                // English comment.
                // English comment.
                // mesh.userData.eventEmitter.emit(eventType, eventData)
                // English comment.
                // English comment.
                if (typeof instance.on === 'function') {
                    instance.on(coreEventName, wrappedHandler);
                }

                console.log(`Interactive event bound: ${event.type} (${coreEventName}) to ${instance.name}`);
                break;
            }

            default:
                console.warn(`Unknown event type: ${event.type}`);
            }

            // English comment.
            if (!instance._eventHandlers) {
                instance._eventHandlers = {};
            }
            instance._eventHandlers[event.id] = handlerFn;
        } catch (error) {
            console.error(`Failed to attach event: ${event.type}`, error);
        }
    };

    /**
     * English comment.
     */
    const detachEventFromInstance = (instance, event) => {
        if (!instance || !instance._eventHandlers) return;

        try {
            // English comment.
            delete instance._eventHandlers[event.id];

            // English comment.
            switch (event.type) {
            case 'onLoaded':
            case 'onMounted':
            case 'onUnmount':
            case 'onUpdate': {
                const bucket = instance?._eventLifecycleBuckets?.[event.type];
                if (bucket) {
                    bucket.handlers.delete(event.id);
                    rebuildLifecycleWrapper(instance, event.type);
                }
                break;
            }

            case 'onClick':
            case 'onDoubleClick':
            case 'onHover':
            case 'onHoverOut': {
                const record = instance._interactiveHandlers?.[event.id];
                if (record) {
                    // English comment.
                    if (typeof instance.off === 'function') {
                        instance.off(record.coreEventName, record.handler);
                    }
                    delete instance._interactiveHandlers[event.id];
                }
                break;
            }
            }
        } catch (error) {
            console.error(`Failed to detach event: ${event.type}`, error);
        }
    };

    /**
     * English comment.
     */
    const createComponentMethodCallHandler = (methodCallConfig) => {
        if (!methodCallConfig) {
            return () => {};
        }

        const canInvokeMethod = (instance, methodName) => {
            if (!instance || !methodName) return false;
            if (typeof instance[methodName] === 'function') return true;
            if (methodName === 'setVisible') {
                return typeof instance.setVisible === 'function'
                    || typeof instance.show === 'function'
                    || typeof instance.hide === 'function'
                    || 'visible' in instance;
            }
            if (methodName === 'toggle') {
                return typeof instance.toggle === 'function' || (typeof instance.show === 'function' && typeof instance.hide === 'function');
            }
            return false;
        };

        const invokeMethod = (instance, methodName, args = []) => {
            if (typeof instance[methodName] === 'function') {
                instance[methodName](...args);
                return true;
            }

            if (methodName === 'setVisible') {
                const nextVisible = args[0] !== false;
                if (typeof instance.setVisible === 'function') {
                    instance.setVisible(nextVisible, ...args.slice(1));
                    return true;
                }
                if (nextVisible) {
                    if (typeof instance.show === 'function') {
                        instance.show();
                        return true;
                    }
                } else if (typeof instance.hide === 'function') {
                    instance.hide();
                    return true;
                }
                if ('visible' in instance) {
                    instance.visible = nextVisible;
                    return true;
                }
            }

            if (methodName === 'toggle') {
                if (typeof instance.toggle === 'function') {
                    instance.toggle(...args);
                    return true;
                }
                if (typeof instance.show === 'function' && typeof instance.hide === 'function') {
                    if (instance.visible === false) {
                        instance.show();
                    } else {
                        instance.hide();
                    }
                    return true;
                }
            }

            return false;
        };

        return (...eventArgs) => {
            const { targetComponentId, methodName, parameters } = methodCallConfig;

            // English comment.
            const targetComponent = componentStore.getComponentById(targetComponentId);
            if (!targetComponent || !targetComponent.instance) {
                console.warn(`Target component not found or not initialized: ${targetComponentId}`);
                return;
            }

            // English comment.
            if (!canInvokeMethod(targetComponent.instance, methodName)) {
                console.warn(`Method ${methodName} not found on component ${targetComponent.name}`);
                return;
            }

            // English comment.
            const resolvedParams = resolveMethodParameters(parameters, eventArgs);

            // English comment.
            try {
                if (Array.isArray(resolvedParams)) {
                    invokeMethod(targetComponent.instance, methodName, resolvedParams);
                } else {
                    invokeMethod(targetComponent.instance, methodName, [resolvedParams]);
                }
                console.log(`Called ${methodName} on ${targetComponent.name} with params:`, resolvedParams);
            } catch (error) {
                console.error(`Error calling ${methodName} on ${targetComponent.name}:`, error);
            }
        };
    };

    /**
     * English comment.
     */
    const resolveMethodParameters = (parameters = [], eventArgs = []) => {
        const hasLegacyShape = parameters.some((p) => {
            if (!p || typeof p !== 'object') return false;
            return (
                'source' in p ||
                'type' in p ||
                'defaultValue' in p ||
                'index' in p
            );
        });

        // English comment.
        if (hasLegacyShape) {
            return parameters.map((param) => {
                switch (param.source) {
                case 'static':
                    // English comment.
                    return parseValue(param.value, param.type);

                case 'url':
                    // English comment.
                    return getUrlParameter(param.key);

                case 'localStorage':
                    // localStorage
                    return getLocalStorageValue(param.key);

                case 'sessionStorage':
                    // sessionStorage
                    return getSessionStorageValue(param.key);

                case 'event':
                    // English comment.
                    return eventArgs[param.index] || param.defaultValue;

                default:
                    return param.defaultValue;
                }
            });
        }

        // English comment.
        const paramsObject = {};
        parameters.forEach((param) => {
            const key = (param?.key ?? '').trim();
            if (!key) return;
            paramsObject[key] = evaluateJsExpression(param?.value, eventArgs);
        });
        return paramsObject;
    };

    /**
     * English comment.
     */
    const evaluateJsExpression = (input, eventArgs = []) => {
        const raw = String(input ?? '').trim();
        if (!raw) return undefined;

        // English comment.
        if (
            (raw.startsWith('{') && raw.endsWith('}')) ||
            (raw.startsWith('[') && raw.endsWith(']'))
        ) {
            try {
                return JSON.parse(raw);
            } catch {
                // English comment.
            }
        }

        // eslint-disable-next-line no-new-func
        const eventData = eventArgs[0] && typeof eventArgs[0] === 'object' ? eventArgs[0] : {};
        const modelTarget = getEventModelTarget(eventData) || eventData.modelTarget || null;
        const current = ensureEventCurrentTarget(eventData, modelTarget) || {};
        const variables = toVariableValueMap();
        const fn = new Function(
            'Date',
            'Math',
            'location',
            'window',
            'localStorage',
            'sessionStorage',
            'eventArgs',
            'eventData',
            'modelTarget',
            'current',
            'meshName',
            'nodePath',
            'point',
            'object',
            'variables',
            'getVariableValue',
            `return (${raw});`
        );

        try {
            const win = typeof window !== 'undefined' ? window : undefined;
            const loc = win?.location;
            const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
            const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
            return fn(
                Date,
                Math,
                loc,
                win,
                ls,
                ss,
                eventArgs,
                eventData,
                modelTarget,
                current,
                current.meshName || '',
                current.nodePath || '',
                eventData.point,
                eventData.object,
                variables,
                (name) => variableStore.getValue(name)
            );
        } catch {
            return raw;
        }
    };

    /**
     * English comment.
     */
    const parseValue = (value, type) => {
        switch (type) {
        case 'number':
            return Number(value);
        case 'boolean':
            return Boolean(value);
        case 'object':
            try {
                return typeof value === 'string' ? JSON.parse(value) : value;
            } catch {
                return value;
            }
        default:
            return value;
        }
    };

    /**
     * English comment.
     */
    const getUrlParameter = (key) => {
        const params = new URLSearchParams(window.location.search);
        return params.get(key);
    };

    /**
     * English comment.
     */
    const getLocalStorageValue = (key) => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    };

    /**
     * English comment.
     */
    const getSessionStorageValue = (key) => {
        try {
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    };

    /**
     * English comment.
     */
    const createHandlerFunction = (handlerCode) => {
        try {
            // English comment.
            // eslint-disable-next-line no-new-func
            return new Function('return ' + handlerCode)();
        } catch (error) {
            console.error('Failed to create handler function:', error);
            return () => {};
        }
    };

    const toVariableValueMap = () => Object.fromEntries(
        (variableStore.variables || []).map((item) => [item.name, item.value])
    );

    const normalizePath = (path = '') => {
        return String(path || '')
            .trim()
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .map((item) => item.trim())
            .filter(Boolean);
    };

    const getPathValue = (source, path = '') => {
        const segments = normalizePath(path);
        if (!segments.length) return source;

        let value = source;
        for (const segment of segments) {
            if (value === null || value === undefined) return undefined;
            value = value[segment];
        }
        return value;
    };

    const parseMaybeJsonValue = (value) => {
        if (typeof value !== 'string') return value;
        const raw = value.trim();
        if (!raw) return value;
        if (
            (raw.startsWith('{') && raw.endsWith('}')) ||
            (raw.startsWith('[') && raw.endsWith(']'))
        ) {
            try {
                return JSON.parse(raw);
            } catch {
                return value;
            }
        }
        return value;
    };

    const parseStaticConditionValue = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw === 'null') return null;
        if (raw === 'undefined') return undefined;
        if (!Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
        return parseMaybeJsonValue(raw);
    };

    const getStorageValue = (storageType, key, path = '') => {
        const storageKey = String(key || '').trim();
        if (!storageKey) return undefined;
        try {
            const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
            const raw = storage.getItem(storageKey);
            return getPathValue(parseMaybeJsonValue(raw), path);
        } catch {
            return undefined;
        }
    };

    const createBlueprintContext = (eventArgs, sourceComponentId, sourceInstance) => {
        const sourceComponent = componentStore.getComponentById(sourceComponentId);
        const eventData = eventArgs[0] && typeof eventArgs[0] === 'object' ? eventArgs[0] : {};
        const modelTarget = getEventModelTarget(eventData, sourceComponentId) || eventData.modelTarget || null;
        const current = ensureEventCurrentTarget(eventData, modelTarget) || {};
        const component = eventArgs[eventArgs.length - 1] || sourceInstance || sourceComponent?.instance || null;
        const variables = toVariableValueMap();

        return {
            eventArgs,
            eventData,
            modelTarget,
            current,
            meshName: current.meshName || '',
            nodePath: current.nodePath || '',
            point: eventData?.point,
            component,
            sourceComponent,
            sourceComponentId,
            components: componentStore.components,
            variables,
            inputs: {},
            getComponent: (componentId) => componentStore.getComponentById(componentId),
            getVariable: (name) => variableStore.getVariableByName(name),
            getVariableValue: (name) => variableStore.getValue(name),
            setVariableValue: (name, value) => variableStore.setVariableValueByName(name, value),
            getLocalStorage: (key, path = '') => getStorageValue('localStorage', key, path),
            getSessionStorage: (key, path = '') => getStorageValue('sessionStorage', key, path),
            getPathValue,
            callComponentMethod: (targetComponentId, methodName, parameters = []) => {
                return createComponentMethodCallHandler({
                    targetComponentId,
                    methodName,
                    parameters: Array.isArray(parameters)
                        ? parameters
                        : Object.entries(parameters || {}).map(([key, value]) => ({ key, value }))
                })(...eventArgs);
            }
        };
    };

    const getBlueprintTriggerNodeId = (event, blueprint) => {
        if (event.blueprintTriggerNodeId) return event.blueprintTriggerNodeId;
        const nodes = Array.isArray(blueprint?.nodes) ? blueprint.nodes : [];
        const matched = nodes.find((node) => (
            node?.type === 'trigger'
            && (node?.data?.eventId === event.id || node?.data?.eventType === event.type)
        ));
        return matched?.id || '';
    };

    const evaluateBlueprintExpression = async (expression, context, inputs = {}) => {
        const raw = String(expression || '').trim();
        if (!raw) return undefined;
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(
                'context',
                'inputs',
                'variables',
                'eventArgs',
                'eventData',
                'component',
                'sourceComponent',
                'getComponent',
                `with (context) { with (inputs) { return (${raw}); } }`
            );
            return await Promise.resolve(fn(
                context,
                inputs,
                context.variables,
                context.eventArgs,
                context.eventData,
                context.component,
                context.sourceComponent,
                context.getComponent
            ));
        } catch (error) {
            console.warn('[EventBlueprint] 表达式执行失败:', raw, error);
            return undefined;
        }
    };

    const runBlueprintCodeValue = async (code, context, inputs = {}) => {
        const raw = String(code || '').trim();
        if (!raw) return undefined;
        try {
            const handler = createHandlerFunction(raw);
            const payload = {
                ...context,
                context,
                inputs
            };
            return await Promise.resolve(
                handler.length >= 2
                    ? handler(context, inputs)
                    : handler(payload)
            );
        } catch (error) {
            console.warn('[EventBlueprint] 代码返回执行失败:', error);
            return undefined;
        }
    };

    const executePublicConditionSource = async (input, context) => {
        const sourceId = String(input?.publicSourceId || '').trim();
        if (!sourceId) return undefined;
        const publicSource = dataSourceStore.getPublicDataSourceById(sourceId);
        if (!publicSource) return undefined;

        try {
            const result = await executeRuntimeDataSource({
                source: { ...publicSource },
                componentId: context.sourceComponentId,
                globalConfig: {
                    ...dataSourceStore.globalConfig,
                    headersObject: dataSourceStore.headersObject,
                    variableValues: context.variables
                }
            });
            const base = result?.data !== undefined ? result.data : result;
            return getPathValue(base, input?.path || '');
        } catch (error) {
            console.warn('[EventBlueprint] 公共数据源输入执行失败:', publicSource.name || sourceId, error);
            return undefined;
        }
    };

    const resolveConditionInputValue = async (input, context, inputs = {}) => {
        const source = input?.source || 'variable';
        const path = input?.path || '';

        if (source === 'variable') {
            return getPathValue(variableStore.getValue(input?.variableName), path);
        }
        if (source === 'localStorage' || source === 'sessionStorage') {
            return getStorageValue(source, input?.key, path);
        }
        if (source === 'eventData') {
            return getPathValue(context.eventData, path);
        }
        if (source === 'eventArg') {
            const argIndex = Number(input?.argIndex || 0);
            return getPathValue(context.eventArgs[argIndex], path);
        }
        if (source === 'componentConfig') {
            const component = input?.componentId
                ? componentStore.getComponentById(input.componentId)
                : context.sourceComponent;
            return getPathValue(component, path || 'config');
        }
        if (source === 'componentInstance') {
            const component = input?.componentId
                ? componentStore.getComponentById(input.componentId)
                : context.sourceComponent;
            return getPathValue(component?.instance, path);
        }
        if (source === 'publicSource') {
            return executePublicConditionSource(input, context);
        }
        if (source === 'static') {
            return parseStaticConditionValue(input?.value);
        }
        if (source === 'code') {
            return runBlueprintCodeValue(input?.code, context, inputs);
        }

        return undefined;
    };

    const resolveBlueprintConditionInputs = async (conditionInputs = [], context) => {
        const inputs = {};
        const rows = Array.isArray(conditionInputs) ? conditionInputs : [];

        for (const input of rows) {
            const alias = String(input?.alias || '').trim();
            if (!alias || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(alias)) continue;
            inputs[alias] = await resolveConditionInputValue(input, context, inputs);
        }

        context.inputs = inputs;
        return inputs;
    };

    const isEmptyValue = (value) => {
        if (value === null || value === undefined || value === '') return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    };

    const compareBlueprintValues = (left, operator, right) => {
        switch (operator) {
        case 'truthy':
            return !!left;
        case 'falsy':
            return !left;
        case 'neq':
            return left !== right;
        case 'gt':
            return Number(left) > Number(right);
        case 'gte':
            return Number(left) >= Number(right);
        case 'lt':
            return Number(left) < Number(right);
        case 'lte':
            return Number(left) <= Number(right);
        case 'contains':
            if (Array.isArray(left)) return left.includes(right);
            return String(left ?? '').includes(String(right ?? ''));
        case 'notContains':
            if (Array.isArray(left)) return !left.includes(right);
            return !String(left ?? '').includes(String(right ?? ''));
        case 'empty':
            return isEmptyValue(left);
        case 'notEmpty':
            return !isEmptyValue(left);
        case 'regex':
            try {
                return new RegExp(String(right ?? '')).test(String(left ?? ''));
            } catch {
                return false;
            }
        case 'eq':
        default:
            return left === right;
        }
    };

    const evaluateComparisonOperand = async (expression, context, inputs) => {
        const raw = String(expression ?? '').trim();
        const value = await evaluateBlueprintExpression(raw || 'undefined', context, inputs);
        if (value === undefined && raw && raw !== 'undefined') {
            return parseStaticConditionValue(raw);
        }
        return value;
    };

    const evaluateBlueprintCondition = async (node, context) => {
        const data = node?.data || {};
        const mode = data.conditionMode || 'expression';
        const inputs = await resolveBlueprintConditionInputs(data.conditionInputs, context);

        if (mode === 'code') {
            return !!(await runBlueprintCodeValue(data.conditionCode, context, inputs));
        }

        if (mode === 'compare') {
            const left = await evaluateComparisonOperand(data.leftExpression, context, inputs);
            const right = await evaluateComparisonOperand(data.rightExpression, context, inputs);
            return compareBlueprintValues(left, data.operator || 'eq', right);
        }

        const expression = data.expression || 'true';
        return !!(await evaluateBlueprintExpression(expression, context, inputs));
    };

    const createBlueprintHandler = (event, sourceComponentId, sourceInstance) => {
        const blueprint = event?.blueprint;
        const nodes = Array.isArray(blueprint?.nodes) ? blueprint.nodes : [];
        const edges = Array.isArray(blueprint?.edges) ? blueprint.edges : [];
        const triggerNodeId = getBlueprintTriggerNodeId(event, blueprint);

        if (!nodes.length || !triggerNodeId) {
            return () => {};
        }

        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        const outgoingMap = new Map();
        edges.forEach((edge) => {
            if (!edge?.source || !edge?.target) return;
            if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
            outgoingMap.get(edge.source).push(edge);
        });

        const runNode = async (nodeId, context, stack = new Set()) => {
            if (!nodeId || stack.has(nodeId)) return;
            const node = nodeMap.get(nodeId);
            if (!node) return;

            const nextStack = new Set(stack);
            nextStack.add(nodeId);

            if (node.type === 'condition') {
                const passed = await evaluateBlueprintCondition(node, context);
                if (!passed) return;
            } else if (node.type === 'method') {
                createComponentMethodCallHandler({
                    targetComponentId: node.data?.targetComponentId || '',
                    methodName: node.data?.methodName || '',
                    parameters: Array.isArray(node.data?.parameters) ? node.data.parameters : []
                })(...context.eventArgs);
            } else if (node.type === 'variable') {
                const variableName = String(node.data?.variableName || '').trim();
                if (variableName) {
                    const value = await evaluateBlueprintExpression(node.data?.valueExpression || 'undefined', context, context.inputs);
                    variableStore.setVariableValueByName(variableName, value);
                    context.variables = toVariableValueMap();
                }
            } else if (node.type === 'code') {
                const codeHandler = createHandlerFunction(node.data?.code || '');
                await Promise.resolve(
                    codeHandler.length >= 2
                        ? codeHandler(...context.eventArgs)
                        : codeHandler(context)
                );
            }

            const outgoing = outgoingMap.get(nodeId) || [];
            for (const edge of outgoing) {
                await runNode(edge.target, context, nextStack);
            }
        };

        return async (...eventArgs) => {
            try {
                const context = createBlueprintContext(eventArgs, sourceComponentId, sourceInstance);
                const outgoing = outgoingMap.get(triggerNodeId) || [];
                for (const edge of outgoing) {
                    await runNode(edge.target, context);
                }
            } catch (error) {
                console.error('[EventBlueprint] 执行失败:', error);
            }
        };
    };

    /**
     * English comment.
     */
    const executeEventHandler = (handlerCode, args) => {
        const handlerFn = createHandlerFunction(handlerCode);
        handlerFn(...args);
    };

    /**
     * English comment.
     */
    const attachExistingEventsToInstance = (componentId) => {
        const component = componentStore.getComponentById(componentId);
        if (!component || !component.instance || !Array.isArray(component.events)) return;
        if (isEventConfigBlocked(component)) return;

        syncModelLoaderEventInteractiveMeshes(componentId, component.events);
        component.events.forEach((event) => {
            if (event?.enabled) {
                attachEventToInstance(component.instance, event);
            }
        });
    };

    /**
     * English comment.
     */
    const attachAllExistingEvents = () => {
        componentStore.components.forEach((c) => attachExistingEventsToInstance(c.id));
    };

    return {
        bindEvent,
        unbindEvent,
        updateEvent,
        toggleEvent,
        replaceComponentEvents,
        triggerEvent,
        attachExistingEventsToInstance,
        attachAllExistingEvents
    };
}

