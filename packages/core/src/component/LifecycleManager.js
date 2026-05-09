/**
 * English comment.
 */
export class LifecycleManager {
    /**
     * English comment.
     */
    constructor() {
        // English comment.
        this.hooks = {
            onCreate: [],
            onBeforeMount: [],
            onMounted: [],
            onUpdate: [],
            onBeforeDispose: [],
            onDispose: []
        };
    }

    /**
     * English comment.
     */
    registerHook(hookName, handler) {
        if (!this.hooks[hookName]) {
            console.warn(`Unknown hook: ${hookName}`);
            return;
        }

        this.hooks[hookName].push(handler);
    }

    /**
     * English comment.
     */
    callHook(hookName, context, ...args) {
        if (!this.hooks[hookName]) {
            return;
        }

        this.hooks[hookName].forEach((handler) => {
            try {
                handler.call(context, ...args);
            } catch (error) {
                console.error(`Error in ${hookName} hook:`, error);
            }
        });
    }

    /**
     * English comment.
     */
    removeHook(hookName, handler) {
        if (!this.hooks[hookName]) {
            return;
        }

        const index = this.hooks[hookName].indexOf(handler);
        if (index > -1) {
            this.hooks[hookName].splice(index, 1);
        }
    }

    /**
     * English comment.
     */
    clear() {
        Object.keys(this.hooks).forEach((key) => {
            this.hooks[key] = [];
        });
    }
}
