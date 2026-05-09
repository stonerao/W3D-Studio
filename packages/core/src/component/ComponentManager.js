/**
 * English comment.
 */
export class ComponentManager {
    /**
     * English comment.
     */
    constructor(scene) {
        this.scene = scene;

        // English comment.
        this.registry = new Map();

        // English comment.
        this.components = new Map();
    }

    /**
     * English comment.
     */
    register(name, ComponentClass) {
        if (this.registry.has(name)) {
            console.warn(`Component "${name}" already registered`);
            return;
        }

        this.registry.set(name, ComponentClass);
    }

    /**
     * English comment.
     */
    async add(componentName, config = {}) {
        // English comment.
        const ComponentClass = this.registry.get(componentName);

        if (!ComponentClass) {
            throw new Error(`Component "${componentName}" not registered`);
        }

        // English comment.
        const component = new ComponentClass(this.scene, config);

        // English comment.
        component.onCreate();

        // English comment.
        component.onBeforeMount();

        // English comment.
        this.scene.scene.add(component);

        // English comment.
        component.isMounted = true;

        // English comment.
        await component.onMounted();

        // English comment.
        const name = config.name || component.name;
        this.components.set(name, component);

        // English comment.
        this.scene.eventSystem?.invalidateInteractiveCache?.();

        return component;
    }

    /**
     * English comment.
     */
    get(name) {
        return this.components.get(name) || null;
    }

    /**
     * English comment.
     */
    remove(name) {
        const component = this.components.get(name);

        if (component) {
            component.dispose();
            this.components.delete(name);
            // English comment.
            this.scene.eventSystem?.invalidateInteractiveCache?.();
        }
    }

    /**
     * English comment.
     */
    update() {
        this.components.forEach((component) => {
            if (component.isDisposed || component.visible === false) return;
            component.update();
        });
    }

    /**
     * English comment.
     */
    getAll() {
        return Array.from(this.components.values());
    }

    /**
     * English comment.
     */
    dispose() {
        this.components.forEach((component) => {
            component.dispose();
        });

        this.components.clear();
        this.registry.clear();
    }
}
