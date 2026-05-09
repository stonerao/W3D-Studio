import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useSceneStore } from './useSceneStore';
import { useComponentStore } from './useComponentStore';
import { useVariableStore } from './useVariableStore';
import { useDataSourceStore } from './useDataSourceStore';
import { useAlarmStore } from './useAlarmStore';
import { useTrendStore } from './useTrendStore';
import { useToast } from '../composables/useToast';
import { useEventSystem } from '../composables/useEventSystem';
import { tagInstanceForPicking } from '../utils/picking';
import { getComponentMethodDefinitions } from '../utils/componentRegistry';
import { t } from '../i18n';

/**
 * English comment.
 */
export const useProjectStore = defineStore('project', () => {
    const CAMERA_EXCLUSIVE_TYPES = new Set([
        'FlyControls',
        'FirstPersonControls',
        'CameraTour'
    ]);
    const MODEL_COMPONENT_TYPES = new Set(['ModelLoader', 'GaussianSplatLoader']);
    const MODEL_LOAD_SUCCESS_EVENTS = ['loadComplete', 'loaded'];
    const MODEL_LOAD_ERROR_EVENTS = ['loadError', 'error'];

    // English comment.

    // English comment.
    const projectName = ref(t('project.untitledName'));

    // English comment.
    const projectVersion = ref('1.0.0');

    // English comment.
    const apiBaseUrl = ref('http://localhost:3000/');

    // English comment.
    const lastSavedAt = ref(null);

    // English comment.
    const hasUnsavedChanges = ref(false);

    // English comment.
    const autoSaveEnabled = ref(true);

    // English comment.
    const autoSaveInterval = ref(60000); // English comment.

    // English comment.
    const cameraViews = ref([]);
    const currentCameraViewId = ref(null);

    // English comment.
    const buildingPoints = ref([]);
    const buildingPointCoordinateSystem = ref({
        mode: 'xyz',
        originLngLatAlt: [0, 0, 0],
        axis: 'xEast_yUp_zNorth',
        fitting: {
            method: 'none',
            controlPoints: []
        }
    });

    // English comment.
    const largeSceneGovernanceState = ref({});

    // English comment.
    const pendingRuntimeRestore = ref(false);

    // English comment.

    // English comment.
    const projectInfo = computed(() => ({
        name: projectName.value,
        version: projectVersion.value,
        apiBaseUrl: apiBaseUrl.value,
        lastSavedAt: lastSavedAt.value,
        hasUnsavedChanges: hasUnsavedChanges.value
    }));

    // English comment.

    const cloneJsonSafe = (value, fallback = null) => {
        try {
            if (value === undefined) return fallback;
            return JSON.parse(JSON.stringify(value));
        } catch {
            return fallback;
        }
    };

    const normalizeEventForStore = (event = {}) => ({
        id: event.id,
        type: event.type,
        enabled: event.enabled !== undefined ? event.enabled : true,
        handlerType: event.handlerType || 'code',
        handler: event.handler || '',
        methodCallConfig: event.methodCallConfig
            ? {
                targetComponentId: event.methodCallConfig.targetComponentId || '',
                methodName: event.methodCallConfig.methodName || '',
                parameters: Array.isArray(event.methodCallConfig.parameters)
                    ? event.methodCallConfig.parameters.map((param) => ({
                        key: param?.key ?? '',
                        value: param?.value ?? ''
                    }))
                    : []
            }
            : null,
        blueprint: event.blueprint ? cloneJsonSafe(event.blueprint, null) : null,
        blueprintTriggerNodeId: event.blueprintTriggerNodeId || '',
        targetFilter: event.targetFilter ? cloneJsonSafe(event.targetFilter, null) : null,
        description: event.description || '',
        createdAt: event.createdAt || Date.now()
    });

    const syncCameraViewsToSceneUserData = () => {
        const sceneStore = useSceneStore();
        const userData = sceneStore.sceneInstance?.scene?.userData;
        if (!userData) return;

        userData.w3dCameraViews = Array.isArray(cameraViews.value) ? cameraViews.value : [];
        userData.w3dCurrentCameraViewId = currentCameraViewId.value || null;
    };

    const syncBuildingPointsToSceneUserData = () => {
        const sceneStore = useSceneStore();
        const userData = sceneStore.sceneInstance?.scene?.userData;
        if (!userData) return;

        userData.w3dBuildingPoints = Array.isArray(buildingPoints.value) ? buildingPoints.value : [];
        userData.w3dBuildingPointCoordinateSystem = buildingPointCoordinateSystem.value && typeof buildingPointCoordinateSystem.value === 'object'
            ? buildingPointCoordinateSystem.value
            : {};
    };

    // English comment.
    const _methodDefCache = new Map();
    const _cacheMethodDefs = (type) => {
        const defs = getComponentMethodDefinitions(type);
        _methodDefCache.set(type, defs);
        return defs;
    };

    /**
     * English comment.
     */
    const serializeProject = () => {
        const sceneStore = useSceneStore();
        const componentStore = useComponentStore();
        const variableStore = useVariableStore();
        const dataSourceStore = useDataSourceStore();
        const alarmStore = useAlarmStore();
        const trendStore = useTrendStore();

        const runtimeScene = sceneStore.sceneInstance;

        // English comment.
        const runtimeCamera = runtimeScene?.camera?.instance;
        const runtimeControls = runtimeScene?.controls?.instance;

        const cameraPosition = runtimeCamera
            ? [runtimeCamera.position.x, runtimeCamera.position.y, runtimeCamera.position.z]
            : [...sceneStore.sceneConfig.camera.position];

        const cameraLookAt = runtimeControls?.target
            ? [runtimeControls.target.x, runtimeControls.target.y, runtimeControls.target.z]
            : [...sceneStore.sceneConfig.camera.lookAt];

        const cameraFov = typeof runtimeCamera?.fov === 'number'
            ? runtimeCamera.fov
            : sceneStore.sceneConfig.camera.fov;

        // English comment.
        // English comment.

        const projectData = {
            schemaVersion: 1,
            version: projectVersion.value,
            name: projectName.value,
            apiBaseUrl: apiBaseUrl.value,
            savedAt: new Date().toISOString(),

            // English comment.
            scene: {
                renderer: { ...sceneStore.sceneConfig.renderer },
                camera: {
                    ...sceneStore.sceneConfig.camera,
                    position: cameraPosition,
                    lookAt: cameraLookAt,
                    fov: cameraFov
                },
                lighting: { ...sceneStore.sceneConfig.lighting },
                background: { ...sceneStore.sceneConfig.background },
                loading: { ...sceneStore.sceneConfig.loading },
                helpers: { ...sceneStore.sceneConfig.helpers }
            },


            // English comment.
            components: componentStore.components.map((component) => ({
                methodDefinitions: _methodDefCache.get(component.type)
                    ?? _cacheMethodDefs(component.type),
                id: component.id,
                name: component.name,
                type: component.type,
                config: { ...component.config },
                visible: component.visible,
                previewVisible: component.previewVisible !== false,
                variableBindings: component.variableBindings ? { ...component.variableBindings } : {},
                locked: component.locked,
                events: component.events ? component.events.map((event) => ({
                    ...normalizeEventForStore(event)
                })) : [],
                dataBinding: component.dataBinding ? { ...component.dataBinding } : null,
                createdAt: component.createdAt
            })),

            // English comment.
            variables: variableStore.serialize(),

            // English comment.
            dataSourceConfig: dataSourceStore.serialize(),

            // English comment.
            alarmRules: alarmStore.serialize(),

            // English comment.
            trendState: trendStore.serialize(),

            // English comment.
            ui: {
                cameraViews: Array.isArray(cameraViews.value) ? cameraViews.value : [],
                currentCameraViewId: currentCameraViewId.value || null,
                buildingPoints: Array.isArray(buildingPoints.value) ? buildingPoints.value : [],
                buildingPointCoordinateSystem: buildingPointCoordinateSystem.value && typeof buildingPointCoordinateSystem.value === 'object'
                    ? buildingPointCoordinateSystem.value
                    : {},
                largeSceneGovernance: largeSceneGovernanceState.value && typeof largeSceneGovernanceState.value === 'object'
                    ? largeSceneGovernanceState.value
                    : {}
            }
        };

        return projectData;
    };

    /**
     * English comment.
     */
    const migrateProjectData = (raw) => {
        const data = raw && typeof raw === 'object' ? raw : {};

        // English comment.
        const schemaVersion = Number.isFinite(Number(data.schemaVersion))
            ? Number(data.schemaVersion)
            : 1;

        // English comment.
        const scene = data.scene || data.sceneConfig || {};

        const ui = data.ui && typeof data.ui === 'object' ? data.ui : {};

        // English comment.
        const migratedCameraViews = Array.isArray(ui.cameraViews)
            ? ui.cameraViews
            : (Array.isArray(data.cameraViews) ? data.cameraViews : []);

        const migratedCurrentCameraViewId = ui.currentCameraViewId
            ?? data.currentViewId
            ?? data.selectedViewId
            ?? null;
        // English comment.
        let migratedBuildingPoints = Array.isArray(ui.buildingPoints) ? ui.buildingPoints : [];

        // English comment.
        if (migratedBuildingPoints.length === 0 && Array.isArray(data.components)) {
            const buildingEditorComponent = data.components.find(c => c.type === 'BuildingEditor');
            if (buildingEditorComponent?.config?.points) {
                migratedBuildingPoints = Array.isArray(buildingEditorComponent.config.points)
                    ? buildingEditorComponent.config.points
                    : [];
            }
        }

        return {
            schemaVersion,
            version: data.version || '1.0.0',
            name: data.name || t('project.untitledName'),
            apiBaseUrl: data.apiBaseUrl || 'http://localhost:3000/',
            savedAt: data.savedAt,
            scene,
            components: Array.isArray(data.components) ? data.components : [],
            ui: {
                ...ui,
                cameraViews: migratedCameraViews,
                currentCameraViewId: migratedCurrentCameraViewId,
                buildingPoints: migratedBuildingPoints,
                buildingPointCoordinateSystem: ui.buildingPointCoordinateSystem && typeof ui.buildingPointCoordinateSystem === 'object'
                    ? ui.buildingPointCoordinateSystem
                    : {
                        mode: 'xyz',
                        originLngLatAlt: [0, 0, 0],
                        axis: 'xEast_yUp_zNorth',
                        fitting: {
                            method: 'none',
                            controlPoints: []
                        }
                    },
                largeSceneGovernance: ui.largeSceneGovernance && typeof ui.largeSceneGovernance === 'object'
                    ? ui.largeSceneGovernance
                    : {}
            },
            variables: Array.isArray(data.variables)
                ? data.variables
                : (Array.isArray(data.sharedVariables) ? data.sharedVariables : []),
            dataSourceConfig: data.dataSourceConfig || null,
            trendState: data.trendState && typeof data.trendState === 'object' ? data.trendState : null,
            alarmRules: Array.isArray(data.alarmRules)
                ? data.alarmRules
                : (data.alarmRules && typeof data.alarmRules === 'object'
                    ? data.alarmRules
                    : [])
        };
    };

    /**
     * English comment.
     */
    const getRuntimeComponentVisibility = (component, runtimeMode = 'editor') => {
        if (runtimeMode === 'preview') {
            return component?.previewVisible !== false;
        }
        return component?.visible !== false;
    };

    const deserializeProject = async (projectData, runtimeMode = 'editor') => {
        const sceneStore = useSceneStore();
        const componentStore = useComponentStore();
        const variableStore = useVariableStore();
        const dataSourceStore = useDataSourceStore();
        const alarmStore = useAlarmStore();
        const trendStore = useTrendStore();
        useEventSystem();

        try {
            const migrated = migrateProjectData(projectData);

            // English comment.
            if (sceneStore.sceneInstance) {
                componentStore.components.forEach((component) => {
                    try {
                        sceneStore.sceneInstance.remove(component.name);
                    } catch (error) {
                        console.warn(`[Project] Failed to remove component from scene: ${component.name}`, error);
                    }
                });
            }

            // English comment.
            projectName.value = migrated.name || t('project.untitledName');
            projectVersion.value = migrated.version || '1.0.0';
            apiBaseUrl.value = migrated.apiBaseUrl || 'http://localhost:3000/';

            // English comment.
            if (migrated.scene) {
                // English comment.
                if (migrated.scene.renderer) {
                    sceneStore.updateRendererConfig(migrated.scene.renderer);
                }
                if (migrated.scene.camera) {
                    sceneStore.updateCameraConfig(migrated.scene.camera);
                }
                if (migrated.scene.lighting) {
                    sceneStore.updateLightingConfig(migrated.scene.lighting);
                }
                if (migrated.scene.background) {
                    sceneStore.updateBackgroundConfig(migrated.scene.background);
                }
                if (migrated.scene.controls) {
                    sceneStore.updateControlsConfig(migrated.scene.controls);
                }
                if (migrated.scene.helpers) {
                    sceneStore.updateHelpersConfig(migrated.scene.helpers);
                }
                if (migrated.scene.loading) {
                    sceneStore.updateLoadingConfig(migrated.scene.loading);
                }
            }

            // English comment.
            const restoredComponents = [];
            if (migrated.components && Array.isArray(migrated.components)) {
                for (const componentData of migrated.components) {
                    restoredComponents.push({
                        id: componentData.id,
                        name: componentData.name,
                        type: componentData.type,
                        config: { ...componentData.config },
                        instance: null,
                        visible: componentData.visible !== undefined ? componentData.visible : true,
                        previewVisible: componentData.previewVisible !== undefined ? componentData.previewVisible : true,
                        variableBindings: componentData.variableBindings ? { ...componentData.variableBindings } : {},
                        locked: componentData.locked || false,
                        events: Array.isArray(componentData.events)
                            ? componentData.events.map((event) => normalizeEventForStore(event))
                            : [],
                        dataBinding: componentData.dataBinding || null,
                        createdAt: componentData.createdAt || Date.now()
                    });
                }
            }

            const enabledCameraControls = restoredComponents.filter((item) => (
                item &&
                CAMERA_EXCLUSIVE_TYPES.has(item.type) &&
                item.config?.enabled !== false
            ));
            if (enabledCameraControls.length > 1) {
                const keepId = enabledCameraControls[enabledCameraControls.length - 1].id;
                restoredComponents.forEach((item) => {
                    if (!item || item.id === keepId) return;
                    if (!CAMERA_EXCLUSIVE_TYPES.has(item.type)) return;
                    item.config = {
                        ...(item.config || {}),
                        enabled: false
                    };
                });
            }

            componentStore.hydrateComponents(restoredComponents);

            // English comment.
            if (migrated.variables && Array.isArray(migrated.variables)) {
                variableStore.deserialize(migrated.variables);
            }

            // English comment.
            cameraViews.value = Array.isArray(migrated.ui?.cameraViews)
                ? migrated.ui.cameraViews
                : [];
            currentCameraViewId.value = migrated.ui?.currentCameraViewId
                ? String(migrated.ui.currentCameraViewId)
                : null;
            syncCameraViewsToSceneUserData();

            // English comment.
            buildingPoints.value = Array.isArray(migrated.ui?.buildingPoints)
                ? migrated.ui.buildingPoints
                : [];
            buildingPointCoordinateSystem.value = migrated.ui?.buildingPointCoordinateSystem && typeof migrated.ui.buildingPointCoordinateSystem === 'object'
                ? migrated.ui.buildingPointCoordinateSystem
                : {
                    mode: 'xyz',
                    originLngLatAlt: [0, 0, 0],
                    axis: 'xEast_yUp_zNorth',
                    fitting: {
                        method: 'none',
                        controlPoints: []
                    }
                };
            syncBuildingPointsToSceneUserData();

            largeSceneGovernanceState.value = migrated.ui?.largeSceneGovernance && typeof migrated.ui.largeSceneGovernance === 'object'
                ? migrated.ui.largeSceneGovernance
                : {};

            // English comment.
            if (migrated.dataSourceConfig) {
                dataSourceStore.deserialize(migrated.dataSourceConfig);
            }

            alarmStore.deserialize(migrated.alarmRules);

            if (migrated.trendState) {
                trendStore.deserialize(migrated.trendState);
            }

            lastSavedAt.value = migrated.savedAt || null;

            // English comment.
            // English comment.

            // English comment.
            if (sceneStore.sceneInstance) {
                await restoreRuntimeToScene(runtimeMode);
                pendingRuntimeRestore.value = false;
            } else {
                pendingRuntimeRestore.value = true;
            }

            console.log('[Project] Project loaded successfully');
        } catch (error) {
            console.error('[Project] Failed to deserialize project:', error);
            throw error;
        }
    };

    /**
     * English comment.
     */
    const restoreRuntimeToScene = async (runtimeMode = 'editor') => {
        const sceneStore = useSceneStore();
        const componentStore = useComponentStore();
        const eventSystem = useEventSystem();

        const scene = sceneStore.sceneInstance;
        if (!scene) {
            console.warn('[Project] restoreRuntimeToScene: Scene 未初始化');
            return false;
        }

        syncCameraViewsToSceneUserData();

        console.log('[Project] 开始恢复组件实例，共 %d 个组件', componentStore.components.length);
        const modelLoadTasks = [];

        const waitForModelLoad = (component, instance, timeoutMs = 120000) => {
            if (!component || !MODEL_COMPONENT_TYPES.has(component.type)) {
                return null;
            }
            if (!instance || typeof instance.on !== 'function') {
                return Promise.resolve({
                    componentId: component.id,
                    status: 'skipped',
                    reason: 'instance_has_no_events'
                });
            }
            if (!component.config?.url) {
                return Promise.resolve({
                    componentId: component.id,
                    status: 'skipped',
                    reason: 'empty_url'
                });
            }

            if (component.type === 'ModelLoader' && instance.model) {
                return Promise.resolve({
                    componentId: component.id,
                    status: 'loaded'
                });
            }
            if (component.type === 'GaussianSplatLoader' && instance.splatMesh) {
                return Promise.resolve({
                    componentId: component.id,
                    status: 'loaded'
                });
            }

            return new Promise((resolve) => {
                let settled = false;
                let timer = null;
                const unsubscribers = [];

                const cleanup = () => {
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    unsubscribers.forEach((off) => {
                        try {
                            off();
                        } catch {
                            // ignore
                        }
                    });
                    unsubscribers.length = 0;
                };

                const settle = (status, payload = null) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve({
                        componentId: component.id,
                        status,
                        payload
                    });
                };

                const bind = (eventName, status) => {
                    const handler = (payload) => settle(status, payload);
                    instance.on?.(eventName, handler);
                    if (typeof instance.off === 'function') {
                        unsubscribers.push(() => instance.off(eventName, handler));
                    }
                };

                MODEL_LOAD_SUCCESS_EVENTS.forEach((eventName) => bind(eventName, 'loaded'));
                MODEL_LOAD_ERROR_EVENTS.forEach((eventName) => bind(eventName, 'error'));

                timer = setTimeout(() => {
                    settle('timeout');
                }, timeoutMs);
            });
        };

        for (const component of componentStore.components) {
            try {
                // English comment.
                if (component.instance) {
                    try {
                        scene.remove(component.name);
                    } catch (error) {
                        console.warn(`[Project] Failed to remove existing instance: ${component.name}`, error);
                    }
                    componentStore.updateComponentInstance(component.id, null);
                }

                const finalConfig = {
                    ...(component.config || {}),
                    name: component.name,
                    id: component.id
                };

                const instance = await scene.add(component.type, finalConfig);
                if (!instance) {
                    console.warn('[Project] 组件实例创建失败:', component.name, component.type);
                    continue;
                }

                console.log('[Project] 组件实例已创建:', component.name, component.type);
                componentStore.updateComponentInstance(component.id, instance);

                const runtimeVisible = getRuntimeComponentVisibility(component, runtimeMode);
                if (typeof runtimeVisible === 'boolean') {
                    if (typeof instance.setVisible === 'function') {
                        instance.setVisible(runtimeVisible, { emit: false });
                    } else {
                        instance.visible = runtimeVisible;
                        [instance.componentScene, instance.group, instance.object3d, instance.mesh, instance.model].forEach((root) => {
                            if (root && typeof root.visible === 'boolean') {
                                root.visible = runtimeVisible;
                            }
                        });
                    }
                }

                tagInstanceForPicking(component.id, instance);

                eventSystem.attachExistingEventsToInstance(component.id);

                const modelTask = waitForModelLoad(component, instance);
                if (modelTask) {
                    modelLoadTasks.push(modelTask);
                }
            } catch (error) {
                console.error(`[Project] Failed to restore component: ${component.name} (${component.type})`, error);
            }
        }

        if (modelLoadTasks.length > 0) {
            const modelLoadResults = await Promise.allSettled(modelLoadTasks);
            const summary = {
                loaded: 0,
                error: 0,
                timeout: 0,
                skipped: 0
            };

            modelLoadResults.forEach((result) => {
                if (result.status !== 'fulfilled') {
                    summary.error += 1;
                    return;
                }
                const key = result.value?.status;
                if (key && Object.prototype.hasOwnProperty.call(summary, key)) {
                    summary[key] += 1;
                    return;
                }
                summary.error += 1;
            });

            console.log('[Project] 模型加载等待完成:', summary);
        }

        pendingRuntimeRestore.value = false;
        return true;
    };

    /**
     * English comment.
     */
    const restoreRuntimeIfPending = async (force = false, runtimeMode = 'editor') => {
        if (!pendingRuntimeRestore.value && !force) return { restored: false, reason: 'not pending' };

        const result = await restoreRuntimeToScene(runtimeMode);
        if (result) {
            pendingRuntimeRestore.value = false;
        }
        return { restored: result };
    };

    /**
     * English comment.
     */
    const saveToLocalStorage = async () => {
        const toast = useToast();
        try {
            const projectData = serializeProject();

            // English comment.
            await new Promise((resolve) => setTimeout(resolve, 0));

            const jsonString = JSON.stringify(projectData, null, 2);

            localStorage.setItem('w3d_editor_project', jsonString);
            localStorage.setItem('w3d_editor_project_name', projectName.value);

            lastSavedAt.value = new Date().toISOString();
            hasUnsavedChanges.value = false;

            if (import.meta?.env?.DEV) console.log('[Project] Project saved to localStorage');
            toast.success(t('project.savedLocal'));
            return true;
        } catch (error) {
            console.error('[Project] Failed to save to localStorage:', error);
            toast.error(t('project.saveFailed', { message: error.message }));
            return false;
        }
    };

    /**
     * English comment.
     */
    const loadFromLocalStorage = async () => {
        const toast = useToast();
        try {
            const jsonString = localStorage.getItem('w3d_editor_project');
            if (!jsonString) {
                console.log('[Project] No saved project found in localStorage');
                toast.warning(t('project.noSavedProject'));
                return false;
            }

            const projectData = JSON.parse(jsonString);
            await deserializeProject(projectData, 'editor');

            lastSavedAt.value = projectData.savedAt || null;
            hasUnsavedChanges.value = false;

            console.log('[Project] Project loaded from localStorage');
            toast.success(t('project.loaded'));
            return true;
        } catch (error) {
            console.error('[Project] Failed to load from localStorage:', error);
            toast.error(t('project.loadFailed', { message: error.message }));
            return false;
        }
    };

    /**
     * English comment.
     */
    const exportToJSON = () => {
        try {
            const projectData = serializeProject();
            const jsonString = JSON.stringify(projectData, null, 2);

            // English comment.
            const blob = new Blob([jsonString], { type: 'application/json' });

            // English comment.
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${projectName.value}_${Date.now()}.json`;

            // English comment.
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // English comment.
            URL.revokeObjectURL(url);

            console.log('[Project] Project exported to JSON file');
            return true;
        } catch (error) {
            console.error('[Project] Failed to export to JSON:', error);
            return false;
        }
    };

    /**
     * English comment.
     */
    const importFromJSON = async (file) => {
        try {
            const text = await file.text();
            const projectData = JSON.parse(text);

            await deserializeProject(projectData, 'editor');

            hasUnsavedChanges.value = true; // English comment.

            console.log('[Project] Project imported from JSON file');
            return true;
        } catch (error) {
            console.error('[Project] Failed to import from JSON:', error);
            throw error;
        }
    };

    /**
     * English comment.
     */
    const clearLocalStorage = () => {
        try {
            localStorage.removeItem('w3d_editor_project');
            localStorage.removeItem('w3d_editor_project_name');
            console.log('[Project] LocalStorage cleared');
            return true;
        } catch (error) {
            console.error('[Project] Failed to clear localStorage:', error);
            return false;
        }
    };

    /**
     * English comment.
     */
    const markAsUnsaved = () => {
        hasUnsavedChanges.value = true;
    };

    const markAsSaved = (savedAt = null) => {
        lastSavedAt.value = savedAt || new Date().toISOString();
        hasUnsavedChanges.value = false;
    };

    /**
     * English comment.
     */
    const setCameraViewsState = ({ views = [], currentViewId = null, markUnsaved = true } = {}) => {
        cameraViews.value = Array.isArray(views) ? views : [];
        currentCameraViewId.value = currentViewId ? String(currentViewId) : null;
        syncCameraViewsToSceneUserData();
        if (markUnsaved) {
            hasUnsavedChanges.value = true;
        }
    };

    const getCameraViewsState = () => ({
        views: Array.isArray(cameraViews.value) ? cameraViews.value : [],
        currentViewId: currentCameraViewId.value
    });

    /**
     * English comment.
     */
    const setBuildingPointsState = ({ points = [], markUnsaved = true } = {}) => {
        buildingPoints.value = Array.isArray(points) ? points : [];
        syncBuildingPointsToSceneUserData();
        if (markUnsaved) {
            hasUnsavedChanges.value = true;
        }
    };

    const getBuildingPointsState = () => ({
        points: Array.isArray(buildingPoints.value) ? buildingPoints.value : [],
        coordinateSystem: buildingPointCoordinateSystem.value && typeof buildingPointCoordinateSystem.value === 'object'
            ? buildingPointCoordinateSystem.value
            : {}
    });

    const setBuildingPointCoordinateState = ({ coordinateSystem = {}, markUnsaved = true } = {}) => {
        buildingPointCoordinateSystem.value = coordinateSystem && typeof coordinateSystem === 'object'
            ? coordinateSystem
            : {
                mode: 'xyz',
                originLngLatAlt: [0, 0, 0],
                axis: 'xEast_yUp_zNorth',
                fitting: {
                    method: 'none',
                    controlPoints: []
                }
            };
        syncBuildingPointsToSceneUserData();
        if (markUnsaved) {
            hasUnsavedChanges.value = true;
        }
    };

    const setLargeSceneGovernanceState = ({ settings = {}, groupActivation = {}, pinnedChunks = [], manifest = {}, markUnsaved = true } = {}) => {
        largeSceneGovernanceState.value = {
            settings: settings && typeof settings === 'object' ? settings : {},
            groupActivation: groupActivation && typeof groupActivation === 'object' ? groupActivation : {},
            pinnedChunks: Array.isArray(pinnedChunks) ? pinnedChunks : [],
            manifest: manifest && typeof manifest === 'object' ? manifest : {}
        };
        if (markUnsaved) {
            hasUnsavedChanges.value = true;
        }
    };

    const getLargeSceneGovernanceState = () => ({
        settings: largeSceneGovernanceState.value?.settings && typeof largeSceneGovernanceState.value.settings === 'object'
            ? largeSceneGovernanceState.value.settings
            : {},
        groupActivation: largeSceneGovernanceState.value?.groupActivation && typeof largeSceneGovernanceState.value.groupActivation === 'object'
            ? largeSceneGovernanceState.value.groupActivation
            : {},
        pinnedChunks: Array.isArray(largeSceneGovernanceState.value?.pinnedChunks)
            ? largeSceneGovernanceState.value.pinnedChunks
            : [],
        manifest: largeSceneGovernanceState.value?.manifest && typeof largeSceneGovernanceState.value.manifest === 'object'
            ? largeSceneGovernanceState.value.manifest
            : {}
    });

    // English comment.

    /**
     * English comment.
     */
    const updateSettings = (settings) => {
        if (settings.name !== undefined) {
            projectName.value = settings.name;
        }
        if (settings.apiBaseUrl !== undefined) {
            apiBaseUrl.value = settings.apiBaseUrl;
        }
        hasUnsavedChanges.value = true;
    };

    // English comment.

    return {
        // English comment.
        projectName,
        projectVersion,
        apiBaseUrl,
        lastSavedAt,
        hasUnsavedChanges,
        autoSaveEnabled,
        autoSaveInterval,
        pendingRuntimeRestore,
        cameraViews,
        currentCameraViewId,
        buildingPoints,
        buildingPointCoordinateSystem,
        largeSceneGovernanceState,

        // English comment.
        projectInfo,

        // English comment.
        serializeProject,
        deserializeProject,
        restoreRuntimeToScene,
        restoreRuntimeIfPending,
        saveToLocalStorage,
        loadFromLocalStorage,
        exportToJSON,
        importFromJSON,
        clearLocalStorage,
        markAsUnsaved,
        markAsSaved,
        updateSettings,
        setCameraViewsState,
        getCameraViewsState,
        setBuildingPointsState,
        getBuildingPointsState,
        setBuildingPointCoordinateState,
        setLargeSceneGovernanceState,
        getLargeSceneGovernanceState
    };
});

