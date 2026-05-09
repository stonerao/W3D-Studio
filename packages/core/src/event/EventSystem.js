import { Raycaster } from './Raycaster.js';
import { EventTypes } from './EventTypes.js';

/**
 * EventSystem 事件系统
 *
 * @class EventSystem
 * @description 事件分发和射线拾取
 */
export class EventSystem {
    /**
     * 创建事件系统实例
     *
     * @param {Scene} scene - 场景实例
     */
    constructor(scene) {
        this.scene = scene;

        // 射线拾取器
        this.raycaster = new Raycaster(scene);

        // 事件监听器
        this.listeners = new Map();

        // 当前悬停的对象
        this.hoveredObject = null;
        this.hoveredEventData = null;

        // 初始化状态
        this.isInitialized = false;

        /**
         * 事件系统启用开关
         * 设为 false 时，所有交互事件（click, dblclick, hover 等）将被静默忽略，
         * 不执行射线检测也不分发事件。用于编辑模式下禁用三维场景内的交互。
         * @type {boolean}
         */
        this.enabled = true;

        // 绑定事件处理函数
        this.handleClick = this.onClick.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
        this.handleDoubleClick = this.onDoubleClick.bind(this);
        this.handleContextMenu = this.onContextMenu.bind(this);

        // mousemove RAF 节流：避免每帧多次射线检测
        this._mouseMoveRafId = null;
        this._pendingMouseMoveEvent = null;

        // 交互对象缓存（脏标记模式，组件增删时失效）
        this._interactiveCache = null;
        this._interactiveCacheDirty = true;

        // 注意：不在构造函数中调用 init()，等待 renderer 创建后再调用
    }

    /**
     * 初始化事件监听
     */
    init() {
        // 检查是否已经初始化
        if (this.isInitialized) {
            return;
        }

        // 检查 renderer 是否可用
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
     * 标记交互对象缓存过期（组件增删 / 可见性变化时调用）
     */
    invalidateInteractiveCache() {
        this._interactiveCacheDirty = true;
    }

    /**
     * 收集所有可交互的对象（带脏标记缓存，避免每次事件都重新遍历）
     *
     * @returns {Array<THREE.Object3D>} 可交互的对象数组
     */
    getInteractiveObjects() {
        if (!this._interactiveCacheDirty && this._interactiveCache) {
            return this._interactiveCache;
        }

        const interactiveObjects = [];

        // 遍历场景中的所有组件
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
     * 点击事件处理
     *
     * @param {MouseEvent} event - 鼠标事件
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
     * 鼠标移动事件处理（RAF 节流，每帧最多执行一次射线检测）
     *
     * @param {MouseEvent} event - 鼠标事件
     */
    onMouseMove(event) {
        if (!this.enabled) return;
        // 始终保存最新事件，下一帧使用最新位置
        this._pendingMouseMoveEvent = event;

        // 本帧已安排处理则跳过，实现节流
        if (this._mouseMoveRafId !== null) return;

        this._mouseMoveRafId = requestAnimationFrame(() => {
            this._mouseMoveRafId = null;
            const e = this._pendingMouseMoveEvent;
            this._pendingMouseMoveEvent = null;
            if (e) this._processMouseMove(e);
        });
    }

    /**
     * 鼠标移动的实际处理逻辑（由 onMouseMove 通过 RAF 调度）
     *
     * @param {MouseEvent} event - 鼠标事件
     */
    _processMouseMove(event) {
        const interactiveObjects = this.getInteractiveObjects();
        const intersects = this.raycaster.raycast(event, interactiveObjects);

        if (intersects.length > 0) {
            const eventData = this.createPointerEventData(EventTypes.MOUSE_MOVE, event, intersects[0]);
            const object = eventData.object;

            // 处理悬停进入
            if (this.hoveredObject !== object) {
                // 悬停离开
                if (this.hoveredObject) {
                    this.emit(EventTypes.MOUSE_LEAVE, {
                        ...(this.hoveredEventData || {}),
                        type: EventTypes.MOUSE_LEAVE,
                        object: this.hoveredObject,
                        event
                    });
                }

                // 悬停进入
                this.hoveredObject = object;
                this.hoveredEventData = eventData;
                this.emit(EventTypes.MOUSE_ENTER, {
                    ...eventData,
                    type: EventTypes.MOUSE_ENTER,
                    object
                });
            }

            // 悬停移动
            this.emit(EventTypes.MOUSE_MOVE, eventData);
        } else {
            // 鼠标离开所有对象
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
     * 鼠标按下事件处理
     *
     * @param {MouseEvent} event - 鼠标事件
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
     * 鼠标抬起事件处理
     *
     * @param {MouseEvent} event - 鼠标事件
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
     * 双击事件处理
     *
     * @param {MouseEvent} event - 鼠标事件
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
     * 右键菜单事件处理
     *
     * @param {MouseEvent} event - 鼠标事件
     */
    onContextMenu(event) {
        event.preventDefault();
        if (!this.enabled) return;

        // 优先检测可交互对象
        const interactiveObjects = this.getInteractiveObjects();
        const interactiveIntersects = this.raycaster.raycast(event, interactiveObjects);

        if (interactiveIntersects.length > 0) {
            this.emit(EventTypes.CONTEXT_MENU, this.createPointerEventData(EventTypes.CONTEXT_MENU, event, interactiveIntersects[0]));
            return;
        }

        // 如果没有点击到可交互对象，检测所有场景对象（仅可见的）
        // 这样可以获取正确的 3D 位置用于添加新点位
        const allObjects = this.scene.scene.children;
        const allIntersects = this.raycaster.raycast(event, allObjects);

        // 过滤出第一个可见的交点
        const visibleIntersect = allIntersects.find(intersect => {
            // 递归检查对象及其所有父对象的可见性
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
                object: null, // 表示不是可交互对象
                point: visibleIntersect.point, // 但提供 3D 位置
                event
            });
        }
    }

    /**
     * 触发事件
     *
     * @param {string} eventType - 事件类型
     * @param {Object} eventData - 事件数据
     */
    emit(eventType, eventData) {
        // 触发全局事件
        const globalListeners = this.listeners.get(eventType) || [];
        globalListeners.forEach((listener) => {
            listener(eventData);
        });

        // 触发对象事件
        if (eventData.object && eventData.object.userData.eventEmitter) {
            eventData.object.userData.eventEmitter.emit(eventType, eventData);
        }
    }

    /**
     * 监听事件
     *
     * @param {string} eventType - 事件类型
     * @param {Function} listener - 事件监听器
     */
    on(eventType, listener) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }

        this.listeners.get(eventType).push(listener);
    }

    /**
     * 移除事件监听
     *
     * @param {string} eventType - 事件类型
     * @param {Function} listener - 事件监听器
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
     * 销毁事件系统
     */
    dispose() {
        // 取消待处理的 mousemove RAF，防止销毁后回调仍执行
        if (this._mouseMoveRafId !== null) {
            cancelAnimationFrame(this._mouseMoveRafId);
            this._mouseMoveRafId = null;
        }
        this._pendingMouseMoveEvent = null;

        // 只有在已初始化且 renderer 存在时才移除事件监听器
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
