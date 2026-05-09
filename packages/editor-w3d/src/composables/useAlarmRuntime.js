import { ref, watch } from 'vue';
import { useAlarmStore, ALARM_SEVERITIES, ALARM_ACTION_TYPES } from '../stores/useAlarmStore';
import { useSceneStore } from '../stores/useSceneStore';
import { useComponentStore } from '../stores/useComponentStore';
import { useToast } from './useToast';

const ALARM_HIGHLIGHT_PREFIX = '__w3dAlarmHighlight__';

const SEVERITY_COLOR_MAP = {
    [ALARM_SEVERITIES.CRITICAL]: '#ef4444',
    [ALARM_SEVERITIES.MAJOR]: '#f97316',
    [ALARM_SEVERITIES.WARNING]: '#f59e0b',
    [ALARM_SEVERITIES.INFO]: '#3b82f6'
};

let initialized = false;
let stopSync = null;
const currentEffectCleanups = new Map();
const currentLegacyHighlightMeta = new Map();
const handledTransientActionKeys = new Set();

const screenFlashState = ref({
    visible: false,
    color: '#ef4444',
    opacity: 0.22,
    durationMs: 1600,
    blinkCount: 2,
    alarmId: '',
    key: 0
});

const alarmModalState = ref({
    visible: false,
    title: '',
    message: '',
    severity: ALARM_SEVERITIES.WARNING,
    alarmId: ''
});

const getHighlightName = (ruleId) => `${ALARM_HIGHLIGHT_PREFIX}${ruleId}`;

const getComponentRoot = (component) => {
    const instance = component?.instance;
    return instance?.componentScene || instance?.group || instance?.object3d || instance?.mesh || null;
};

const removeHighlight = (scene, helperName) => {
    if (!scene || !helperName) return;
    try {
        scene.remove(helperName);
    } catch {
        // ignore stale helper cleanup failures
    }
};

const buildTransientActionKey = (alarm, action, index) => {
    return [
        alarm.id,
        index,
        action?.type || 'unknown',
        action?.componentId || '',
        action?.meshName || '',
        action?.labelId || '',
        alarm.lastTriggeredAt || alarm.triggeredAt || 0
    ].join(':');
};

const buildPersistentActionKey = (alarm, action, index) => {
    return [
        alarm.id,
        index,
        action?.type || 'unknown',
        action?.componentId || '',
        action?.meshName || '',
        action?.labelId || ''
    ].join(':');
};

const closeAlarmModal = () => {
    alarmModalState.value.visible = false;
};

const debugAlarmRuntime = (label, payload) => {
    console.log(`[AlarmRuntime] ${label}`, payload);
};

export function useAlarmRuntime() {
    const alarmStore = useAlarmStore();
    const sceneStore = useSceneStore();
    const componentStore = useComponentStore();
    const toast = useToast();

    const triggerScreenFlash = (alarm, action) => {
        debugAlarmRuntime('triggerScreenFlash', {
            alarmId: alarm?.id,
            ruleId: alarm?.ruleId,
            action
        });
        screenFlashState.value = {
            visible: true,
            color: action?.color || SEVERITY_COLOR_MAP[alarm.severity] || '#ef4444',
            opacity: Number(action?.opacity ?? 0.22),
            durationMs: Number(action?.durationMs ?? 1600),
            blinkCount: Number(action?.blinkCount ?? 2),
            alarmId: alarm.id,
            key: screenFlashState.value.key + 1
        };
    };

    const openAlarmModal = (alarm) => {
        debugAlarmRuntime('openAlarmModal', {
            alarmId: alarm?.id,
            ruleId: alarm?.ruleId,
            title: alarm?.title,
            message: alarm?.message
        });
        alarmModalState.value = {
            visible: true,
            title: alarm.title || alarm.ruleName || '告警提示',
            message: alarm.message || '告警已触发',
            severity: alarm.severity || ALARM_SEVERITIES.WARNING,
            alarmId: alarm.id
        };
    };

    const syncLegacyComponentHighlights = () => {
        const scene = sceneStore.sceneInstance;

        if (!scene) {
            currentLegacyHighlightMeta.clear();
            return;
        }

        const nextHighlightMeta = new Map();

        for (const alarm of alarmStore.activeAlarms) {
            if (Array.isArray(alarm.actionsSnapshot) && alarm.actionsSnapshot.length > 0) continue;
            if (!alarm.targetComponentId) continue;

            const component = componentStore.getComponentById(alarm.targetComponentId);
            const target = getComponentRoot(component);
            if (!target) continue;

            const helperName = getHighlightName(alarm.ruleId);
            const color = SEVERITY_COLOR_MAP[alarm.severity] || '#ef4444';
            nextHighlightMeta.set(helperName, {
                componentId: alarm.targetComponentId,
                color,
                target
            });
        }

        for (const [helperName] of currentLegacyHighlightMeta.entries()) {
            if (!nextHighlightMeta.has(helperName)) {
                removeHighlight(scene, helperName);
                currentLegacyHighlightMeta.delete(helperName);
            }
        }

        for (const [helperName, nextMeta] of nextHighlightMeta.entries()) {
            const prevMeta = currentLegacyHighlightMeta.get(helperName);
            const shouldRefresh = !prevMeta
                || prevMeta.componentId !== nextMeta.componentId
                || prevMeta.color !== nextMeta.color
                || prevMeta.target !== nextMeta.target;

            if (!shouldRefresh) continue;

            removeHighlight(scene, helperName);
            currentLegacyHighlightMeta.set(helperName, nextMeta);

            scene.add('BoundingBoxHelper', {
                name: helperName,
                target: nextMeta.target,
                color: nextMeta.color,
                autoUpdate: true
            }).catch(() => {
                currentLegacyHighlightMeta.delete(helperName);
            });
        }
    };

    const buildHighlightCleanup = (alarm, action) => {
        const component = componentStore.getComponentById(action.componentId);
        const instance = component?.instance;
        if (!instance) return null;

        if (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_MODEL) {
            if (typeof instance.highlightAlarmMesh === 'function') {
                instance.highlightAlarmMesh(action.meshName, action);
                return () => instance.clearAlarmMeshHighlight?.(action.meshName);
            }

            if (typeof instance.highlightMesh === 'function') {
                instance.highlightMesh(action.meshName, action.color || '#ef4444');
                return () => instance.unhighlightMesh?.(action.meshName);
            }
        }

        if (action.type === ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D) {
            if (typeof instance.highlightLabel === 'function') {
                instance.highlightLabel(action.labelId, action);
                return () => instance.unhighlightLabel?.(action.labelId);
            }
        }

        return null;
    };

    const syncPersistentEffects = () => {
        const nextEffectKeys = new Set();

        for (const alarm of alarmStore.activeAlarms) {
            const actions = Array.isArray(alarm.actionsSnapshot) ? alarm.actionsSnapshot : [];
            actions.forEach((action, index) => {
                if (
                    action?.type !== ALARM_ACTION_TYPES.HIGHLIGHT_MODEL
                    && action?.type !== ALARM_ACTION_TYPES.HIGHLIGHT_LABEL3D
                ) {
                    return;
                }

                const key = buildPersistentActionKey(alarm, action, index);
                nextEffectKeys.add(key);

                if (!currentEffectCleanups.has(key)) {
                    const cleanup = buildHighlightCleanup(alarm, action);
                    if (typeof cleanup === 'function') {
                        currentEffectCleanups.set(key, cleanup);
                    }
                }
            });
        }

        for (const [key, cleanup] of currentEffectCleanups.entries()) {
            if (nextEffectKeys.has(key)) continue;
            try {
                cleanup?.();
            } catch {
                // ignore stale cleanup failure
            }
            currentEffectCleanups.delete(key);
        }
    };

    const syncTransientEffects = () => {
        debugAlarmRuntime('syncTransientEffects:start', {
            activeAlarmCount: alarmStore.activeAlarms.length,
            handledTransientCount: handledTransientActionKeys.size,
            alarms: alarmStore.activeAlarms.map((alarm) => ({
                id: alarm.id,
                ruleId: alarm.ruleId,
                title: alarm.title,
                actions: Array.isArray(alarm.actionsSnapshot)
                    ? alarm.actionsSnapshot.map((action) => action?.type)
                    : []
            }))
        });
        const activeTransientKeys = new Set();

        for (const alarm of alarmStore.activeAlarms) {
            const actions = Array.isArray(alarm.actionsSnapshot) ? alarm.actionsSnapshot : [];

            actions.forEach((action, index) => {
                if (
                    action?.type !== ALARM_ACTION_TYPES.TOAST
                    && action?.type !== ALARM_ACTION_TYPES.MODAL
                    && action?.type !== ALARM_ACTION_TYPES.SCREEN_FLASH
                ) {
                    return;
                }

                const key = buildTransientActionKey(alarm, action, index);
                activeTransientKeys.add(key);
                if (handledTransientActionKeys.has(key)) return;

                handledTransientActionKeys.add(key);

                if (action.type === ALARM_ACTION_TYPES.TOAST) {
                    debugAlarmRuntime('toastAction', {
                        key,
                        alarmId: alarm.id,
                        title: alarm.title || alarm.ruleName,
                        message: alarm.message
                    });
                    toast.show({
                        type: alarm.severity === ALARM_SEVERITIES.INFO ? 'info' : 'warning',
                        title: alarm.title || alarm.ruleName || '告警提示',
                        message: alarm.message || '告警已触发',
                        duration: Number(action.durationMs || 3000)
                    });
                    return;
                }

                if (action.type === ALARM_ACTION_TYPES.MODAL) {
                    debugAlarmRuntime('modalAction', {
                        key,
                        alarmId: alarm.id
                    });
                    openAlarmModal(alarm);
                    return;
                }

                if (action.type === ALARM_ACTION_TYPES.SCREEN_FLASH) {
                    debugAlarmRuntime('screenFlashAction', {
                        key,
                        alarmId: alarm.id
                    });
                    triggerScreenFlash(alarm, action);
                }
            });
        }

        for (const key of Array.from(handledTransientActionKeys)) {
            const alarmId = String(key).split(':')[0];
            const stillActive = alarmStore.activeAlarms.some((alarm) => alarm.id === alarmId);
            if (!stillActive || activeTransientKeys.has(key)) continue;
            handledTransientActionKeys.delete(key);
        }
    };

    const syncEffects = () => {
        debugAlarmRuntime('syncEffects', {
            activeAlarmIds: alarmStore.activeAlarms.map((alarm) => alarm.id),
            activeAlarmRuleIds: alarmStore.activeAlarms.map((alarm) => alarm.ruleId)
        });
        syncLegacyComponentHighlights();
        syncPersistentEffects();
        syncTransientEffects();
    };

    if (!initialized) {
        stopSync = watch(
            () => ({
                scene: sceneStore.sceneInstance,
                activeAlarms: alarmStore.activeAlarms.map((alarm) => ({
                    id: alarm.id,
                    ruleId: alarm.ruleId,
                    severity: alarm.severity,
                    targetComponentId: alarm.targetComponentId,
                    title: alarm.title,
                    message: alarm.message,
                    triggeredAt: alarm.triggeredAt,
                    lastTriggeredAt: alarm.lastTriggeredAt,
                    actionsSnapshot: (alarm.actionsSnapshot || []).map((action) => ({ ...action }))
                })),
                components: componentStore.components.map((component) => ({
                    id: component.id,
                    instance: component.instance
                }))
            }),
            () => {
                syncEffects();
            },
            { deep: true, immediate: true }
        );

        initialized = true;
    }

    return {
        screenFlashState,
        alarmModalState,
        closeAlarmModal,
        syncAlarmRuntimeEffects: syncEffects,
        disposeAlarmRuntime: () => {
            if (stopSync) {
                stopSync();
                stopSync = null;
            }

            for (const cleanup of currentEffectCleanups.values()) {
                try {
                    cleanup?.();
                } catch {
                    // ignore
                }
            }

            currentEffectCleanups.clear();
            currentLegacyHighlightMeta.clear();
            handledTransientActionKeys.clear();
            screenFlashState.value = {
                visible: false,
                color: '#ef4444',
                opacity: 0.22,
                durationMs: 1600,
                blinkCount: 2,
                alarmId: '',
                key: 0
            };
            alarmModalState.value = {
                visible: false,
                title: '',
                message: '',
                severity: ALARM_SEVERITIES.WARNING,
                alarmId: ''
            };
            initialized = false;
        }
    };
}
