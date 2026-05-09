import { Raycaster } from './Raycaster.js';
import { EventTypes } from './EventTypes.js';

/**
 * English comment.
 */
export class EventSystem {
    /**
     * English comment.
     */
    constructor(scene) {
        this.scene = scene;

        // English comment.
        this.raycaster = new Raycaster(scene);

        // English comment.
        this.listeners = new Map();

        // English comment.
        this.hoveredObject = null;
        this.hoveredEventData = null;

        // English comment.
        this.isInitialized = false;

        /**
         * English comment.
         */
        this.enabled = true;

        // English comment.
        this.handleClick = this.onClick.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
        this.handleDoubleClick = this.onDoubleClick.bind(this);
        this.handleContextMenu = this.onContextMenu.bind(this);

        // English comment.
        this._mouseMoveRafId = null;
        this._pendingMouseMoveEvent = null;

        // English comment.
        this._interactiveCache = null;
        this._interactiveCacheDirty = true;

        // English comment.
    }

    /**
     * English comment.
     */
    init() {
        // English comment.
        if (this.isInitialized) {
            return;
        }

        // English comment.
        if (!this.scene.renderer || !this.scene.renderer.instance) {
            console.warn('EventSystem: Renderer not available, skipping initialization');
            return;
        }

        const canvas = this.scene.renderer.instance.domElement;

        canvas.addEventListener('click', this.handleClick);
        canvas.addEventListener('mousemove', this.handleMouseMove);
        canvas.addEventListener('mousedown', this.handleMouseDown);
        canvas.addEventListener('mouseup', this.handleMouseUp);
        canvas.addEventListener('dblclick', this.handleDoubleClick);
        canvas.addEventListener('contextmenu', this.handleContextMenu);

        this.isInitialized = true;
    }

    /**
     * English comment.
     */
    invalidateInteractiveCache() {
        this._interactiveCacheDirty = true;
    }

    /**
     * English comment.
     */
    getInteractiveObjects() {
        if (!this._interactiveCacheDirty && this._interactiveCache) {
            return this._interactiveCache;
        }

        const interactiveObjects = [];

        // English comment.
        this.scene.componentManager.components.forEach((component) => {
            if (component.visible === false || component.isDisposed) return;
            if (component.getInteractiveObjects) {
                const objects = component.getInteractiveObjects();
                interactiveObjects.push(...objects);
            }
        });

        this._interactiveCache = interactiveObjects;
        this._interactiveCacheDirty = false;
        return interactiveObjects;
    }

    resolveIntersectEventTarget(intersect) {
        const resolver = intersect?.object?.userData?.__w3dResolvePerformanceEventTarget;
        if (typeof resolver !== 'function') {
            return {
                object: intersect?.object || null,
                originalObject: null,
                modelTarget: null
            };
        }

        const resolved = resolver(intersect);
        return {
            object: resolved?.object || intersect?.object || null,
            originalObject: resolved?.originalObject || intersect?.object || null,
            modelTarget: resolved?.modelTarget || null
        };
    }

    createCurrentTargetData(modelTarget = null, object = null) {
        const meshName = modelTarget?.meshName || object?.name || '';
        return {
            name: meshName,
            meshName,
            nodePath: modelTarget?.nodePath || '',
            rawName: modelTarget?.rawName || object?.name || '',
            objectUuid: modelTarget?.objectUuid || object?.uuid || '',
            objectType: modelTarget?.objectType || object?.type || '',
            componentId: modelTarget?.componentId || ''
        };
    }

    createPointerEventData(type, event, intersect) {
        const resolved = this.resolveIntersectEventTarget(intersect);
        const current = this.createCurrentTargetData(resolved.modelTarget, resolved.object);
        return {
            type,
            object: resolved.object,
            originalObject: resolved.originalObject,
            point: intersect?.point,
            faceIndex: intersect?.faceIndex,
            instanceId: intersect?.instanceId,
            batchId: intersect?.batchId,
            modelTarget: resolved.modelTarget,
            current,
            intersect,
            event
        };
    }

    /**
     * English comment.
     */
    onClick(event) {
        event.preventDefault();
        if (!this.enabled) return;
        const interactiveObjects = this.getInteractiveObjects();
        const intersects = this.raycaster.raycast(event, interactiveObjects);
        if (intersects.length > 0) {
            this.emit(EventTypes.CLICK, this.createPointerEventData(EventTypes.CLICK, event, intersects[0]));
        }
    }

    /**
     * English comment.
     */
    onMouseMove(event) {
        if (!this.enabled) return;
        // English comment.
        this._pendingMouseMoveEvent = event;

        // English comment.
        if (this._mouseMoveRafId !== null) return;

        this._mouseMoveRafId = requestAnimationFrame(() => {
            this._mouseMoveRafId = null;
            const e = this._pendingMouseMoveEvent;
            this._pendingMouseMoveEvent = null;
            if (e) this._processMouseMove(e);
        });
    }

    /**
     * English comment.
     */
    _processMouseMove(event) {
        const interactiveObjects = this.getInteractiveObjects();
        const intersects = this.raycaster.raycast(event, interactiveObjects);

        if (intersects.length > 0) {
            const eventData = this.createPointerEventData(EventTypes.MOUSE_MOVE, event, intersects[0]);
            const object = eventData.object;

            // English comment.
            if (this.hoveredObject !== object) {
                // English comment.
                if (this.hoveredObject) {
                    this.emit(EventTypes.MOUSE_LEAVE, {
                        ...(this.hoveredEventData || {}),
                        type: EventTypes.MOUSE_LEAVE,
                        object: this.hoveredObject,
                        event
                    });
                }

                // English comment.
                this.hoveredObject = object;
                this.hoveredEventData = eventData;
                this.emit(EventTypes.MOUSE_ENTER, {
                    ...eventData,
                    type: EventTypes.MOUSE_ENTER,
                    object
                });
            }

            // English comment.
            this.emit(EventTypes.MOUSE_MOVE, eventData);
        } else {
            // English comment.
            if (this.hoveredObject) {
                this.emit(EventTypes.MOUSE_LEAVE, {
                    ...(this.hoveredEventData || {}),
                    type: EventTypes.MOUSE_LEAVE,
                    object: this.hoveredObject,
                    event
                });
                this.hoveredObject = null;
                this.hoveredEventData = null;
            }
        }
    }

    /**
     * English comment.
     */
    onMouseDown(event) {
        if (!this.enabled) return;
        const interactiveObjects = this.getInteractiveObjects();
        const intersects = this.raycaster.raycast(event, interactiveObjects);

        if (intersects.length > 0) {
            this.emit(EventTypes.MOUSE_DOWN, this.createPointerEventData(EventTypes.MOUSE_DOWN, event, intersects[0]));
        }
    }

    /**
     * English comment.
     */
    onMouseUp(event) {
        if (!this.enabled) return;
        const interactiveObjects = this.getInteractiveObjects();
        const intersects = this.raycaster.raycast(event, interactiveObjects);

        if (intersects.length > 0) {
            this.emit(EventTypes.MOUSE_UP, this.createPointerEventData(EventTypes.MOUSE_UP, event, intersects[0]));
        }
    }

    /**
     * English comment.
     */
    onDoubleClick(event) {
        if (!this.enabled) return;
        const interactiveObjects = this.getInteractiveObjects();
        const intersects = this.raycaster.raycast(event, interactiveObjects);

        if (intersects.length > 0) {
            this.emit(EventTypes.DOUBLE_CLICK, this.createPointerEventData(EventTypes.DOUBLE_CLICK, event, intersects[0]));
        }
    }

    /**
     * English comment.
     */
    onContextMenu(event) {
        event.preventDefault();
        if (!this.enabled) return;

        // English comment.
        const interactiveObjects = this.getInteractiveObjects();
        const interactiveIntersects = this.raycaster.raycast(event, interactiveObjects);

        if (interactiveIntersects.length > 0) {
            this.emit(EventTypes.CONTEXT_MENU, this.createPointerEventData(EventTypes.CONTEXT_MENU, event, interactiveIntersects[0]));
            return;
        }

        // English comment.
        // English comment.
        const allObjects = this.scene.scene.children;
        const allIntersects = this.raycaster.raycast(event, allObjects);

        // English comment.
        const visibleIntersect = allIntersects.find(intersect => {
            // English comment.
            let obj = intersect.object;
            while (obj) {
                if (obj.visible === false) {
                    return false;
                }
                obj = obj.parent;
            }
            return true;
        });

        if (visibleIntersect) {
            this.emit(EventTypes.CONTEXT_MENU, {
                type: EventTypes.CONTEXT_MENU,
                object: null, // English comment.
                point: visibleIntersect.point, // English comment.
                event
            });
        }
    }

    /**
     * English comment.
     */
    emit(eventType, eventData) {
        // English comment.
        const globalListeners = this.listeners.get(eventType) || [];
        globalListeners.forEach((listener) => {
            listener(eventData);
        });

        // English comment.
        if (eventData.object && eventData.object.userData.eventEmitter) {
            eventData.object.userData.eventEmitter.emit(eventType, eventData);
        }
    }

    /**
     * English comment.
     */
    on(eventType, listener) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }

        this.listeners.get(eventType).push(listener);
    }

    /**
     * English comment.
     */
    off(eventType, listener) {
        const listeners = this.listeners.get(eventType);

        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * English comment.
     */
    dispose() {
        // English comment.
        if (this._mouseMoveRafId !== null) {
            cancelAnimationFrame(this._mouseMoveRafId);
            this._mouseMoveRafId = null;
        }
        this._pendingMouseMoveEvent = null;

        // English comment.
        if (this.isInitialized && this.scene.renderer && this.scene.renderer.instance) {
            const canvas = this.scene.renderer.instance.domElement;

            canvas.removeEventListener('click', this.handleClick);
            canvas.removeEventListener('mousemove', this.handleMouseMove);
            canvas.removeEventListener('mousedown', this.handleMouseDown);
            canvas.removeEventListener('mouseup', this.handleMouseUp);
            canvas.removeEventListener('dblclick', this.handleDoubleClick);
            canvas.removeEventListener('contextmenu', this.handleContextMenu);
        }

        this.listeners.clear();
        this.hoveredObject = null;
        this.isInitialized = false;
    }
}
