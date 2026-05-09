import { useHistoryStore } from '../stores/useHistoryStore';
import { useComponentStore } from '../stores/useComponentStore';

/**
 * English comment.
 */
export function useHistory() {
    const historyStore = useHistoryStore();
    const componentStore = useComponentStore();

    /**
     * English comment.
     */
    const createAddComponentCommand = (componentData) => {
        return {
            name: `添加组件: ${componentData.name}`,
            data: { componentData },
            execute: async () => {
                // English comment.
                // English comment.
            },
            undo: async () => {
                // English comment.
                componentStore.removeComponent(componentData.id);
            }
        };
    };

    /**
     * English comment.
     */
    const createRemoveComponentCommand = (component) => {
        // English comment.
        const savedComponent = {
            id: component.id,
            name: component.name,
            type: component.type,
            config: { ...component.config },
            visible: component.visible,
            previewVisible: component.previewVisible !== false,
            variableBindings: component.variableBindings ? { ...component.variableBindings } : {},
            locked: component.locked,
            events: component.events ? [...component.events] : [],
            createdAt: component.createdAt
        };

        return {
            name: `删除组件: ${component.name}`,
            data: { component: savedComponent },
            execute: async () => {
                // English comment.
            },
            undo: async () => {
                // English comment.
                // English comment.
                // English comment.
                componentStore.addComponent(savedComponent);

                // English comment.
                // English comment.
                console.warn('[History] 撤销删除组件需要重新创建场景实例（待实现）');
            }
        };
    };

    /**
     * English comment.
     */
    const createUpdateConfigCommand = (componentId, oldConfig, newConfig) => {
        const component = componentStore.getComponentById(componentId);
        const componentName = component ? component.name : componentId;

        return {
            name: `修改属性: ${componentName}`,
            data: { componentId, oldConfig, newConfig },
            execute: async () => {
                // English comment.
            },
            undo: async () => {
                // English comment.
                componentStore.updateComponent(componentId, { config: oldConfig });

                // English comment.
                const component = componentStore.getComponentById(componentId);
                if (component?.instance?.updateConfig) {
                    await component.instance.updateConfig(oldConfig);
                }
            }
        };
    };

    /**
     * English comment.
     */
    const createRenameComponentCommand = (componentId, oldName, newName) => {
        return {
            name: `重命名组件: ${oldName} → ${newName}`,
            data: { componentId, oldName, newName },
            execute: async () => {
                // English comment.
            },
            undo: async () => {
                // English comment.
                componentStore.updateComponent(componentId, { name: oldName });
            }
        };
    };

    /**
     * English comment.
     */
    const createAddEventCommand = (componentId, event) => {
        const component = componentStore.getComponentById(componentId);
        const componentName = component ? component.name : componentId;

        return {
            name: `添加事件: ${componentName} - ${event.type}`,
            data: { componentId, event },
            execute: async () => {
                // English comment.
            },
            undo: async () => {
                // English comment.
                componentStore.removeEvent(componentId, event.id);
            }
        };
    };

    /**
     * English comment.
     */
    const createRemoveEventCommand = (componentId, event) => {
        const component = componentStore.getComponentById(componentId);
        const componentName = component ? component.name : componentId;

        return {
            name: `删除事件: ${componentName} - ${event.type}`,
            data: { componentId, event },
            execute: async () => {
                // English comment.
            },
            undo: async () => {
                // English comment.
                componentStore.addEvent(componentId, event);
            }
        };
    };

    /**
     * English comment.
     */
    const createUpdateEventCommand = (componentId, eventId, oldEvent, newEvent) => {
        const component = componentStore.getComponentById(componentId);
        const componentName = component ? component.name : componentId;

        return {
            name: `修改事件: ${componentName} - ${oldEvent.type}`,
            data: { componentId, eventId, oldEvent, newEvent },
            execute: async () => {
                // English comment.
            },
            undo: async () => {
                // English comment.
                componentStore.updateEvent(componentId, eventId, oldEvent);
            }
        };
    };

    return {
        // English comment.
        executeCommand: historyStore.executeCommand,
        undo: historyStore.undo,
        redo: historyStore.redo,
        clear: historyStore.clear,
        getHistory: historyStore.getHistory,

        // English comment.
        canUndo: historyStore.canUndo,
        canRedo: historyStore.canRedo,
        historyCount: historyStore.historyCount,

        // English comment.
        createAddComponentCommand,
        createRemoveComponentCommand,
        createUpdateConfigCommand,
        createRenameComponentCommand,
        createAddEventCommand,
        createRemoveEventCommand,
        createUpdateEventCommand
    };
}

