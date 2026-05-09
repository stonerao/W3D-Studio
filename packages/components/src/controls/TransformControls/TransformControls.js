import { Component } from '@w3d/core';
import { TransformControls as ThreeTransformControls } from 'three/examples/jsm/controls/TransformControls.js';

/**
 * Controls module component that exposes transform handles for translating, rotating, and scaling selected objects.
 */
export class TransformControls extends Component {
    static defaultConfig = {
        mode: 'translate',
        size: 1,
        space: 'world',
        enabled: true,
        showX: true,
        showY: true,
        showZ: true,
        translationSnap: null,
        rotationSnap: null,
        scaleSnap: null,
        disableOrbitOnDrag: true
    };

    onCreate() {
        this.control = null;

        this.attachedObject = null;

        this.eventHandlers = {
            change: null,
            draggingChanged: null,
            objectChange: null,
            mouseDown: null,
            mouseUp: null
        };
        this.orbitLockKey = `transform-controls:${this.name || 'default'}`;
    }

    onMounted() {
        this.control = new ThreeTransformControls(
            this.scene.camera.instance,
            this.scene.renderer.instance.domElement
        );
        this.applyConfig();

        	const gizmo =  this.control.getHelper();
        this.scene.scene.add( gizmo );

        // this.scene.scene.add(this.control);

        this.setupEventListeners();

        this.emit('mounted', { control: this.control });
    }

    applyConfig() {
        if (!this.control) return;

        const {
            mode,
            size,
            space,
            enabled,
            showX,
            showY,
            showZ,
            translationSnap,
            rotationSnap,
            scaleSnap
        } = this.config;

        this.control.setMode(mode);
        this.control.setSize(size);
        this.control.setSpace(space);
        this.control.enabled = enabled;
        this.control.showX = showX;
        this.control.showY = showY;
        this.control.showZ = showZ;

        if (translationSnap !== null) {
            this.control.setTranslationSnap(translationSnap);
        }
        if (rotationSnap !== null) {
            this.control.setRotationSnap(rotationSnap);
        }
        if (scaleSnap !== null) {
            this.control.setScaleSnap(scaleSnap);
        }
    }

    setupEventListeners() {
        if (!this.control) return;

        this.eventHandlers.change = (_event) => {
            this.emit('change', {
                object: this.attachedObject,
                control: this.control
            });
        };
        this.control.addEventListener('change', this.eventHandlers.change);

        this.eventHandlers.draggingChanged = (event) => {
            const isDragging = event.value;

            if (this.config.disableOrbitOnDrag && this.scene.controls) {
                if (isDragging) {
                    if (typeof this.scene.controls.acquireLock === 'function') {
                        this.scene.controls.acquireLock(this.orbitLockKey);
                    } else {
                        this.scene.controls.instance.enabled = false;
                    }
                } else if (typeof this.scene.controls.releaseLock === 'function') {
                    this.scene.controls.releaseLock(this.orbitLockKey);
                } else {
                    this.scene.controls.instance.enabled = true;
                }
            }

            this.emit('dragging-changed', {
                dragging: isDragging,
                object: this.attachedObject
            });
        };
        this.control.addEventListener('dragging-changed', this.eventHandlers.draggingChanged);

        this.eventHandlers.objectChange = () => {
            this.emit('object-change', {
                object: this.attachedObject,
                position: this.attachedObject?.position.toArray(),
                rotation: this.attachedObject?.rotation.toArray(),
                scale: this.attachedObject?.scale.toArray()
            });
        };
        this.control.addEventListener('objectChange', this.eventHandlers.objectChange);

        this.eventHandlers.mouseDown = () => {
            this.emit('mouse-down', {
                object: this.attachedObject
            });
        };
        this.control.addEventListener('mouseDown', this.eventHandlers.mouseDown);

        this.eventHandlers.mouseUp = () => {
            this.emit('mouse-up', {
                object: this.attachedObject
            });
        };
        this.control.addEventListener('mouseUp', this.eventHandlers.mouseUp);
    }

    attach(object) {
        if (!this.control) {
            console.warn('TransformControls: Control not initialized');
            return;
        }

        if (!object) {
            console.warn('TransformControls: Object is null or undefined');
            return;
        }

        this.attachedObject = object;
        this.control.attach(object);

        this.emit('attached', { object });
    }

    detach() {
        if (!this.control) return;

        const previousObject = this.attachedObject;
        this.control.detach();
        this.attachedObject = null;

        this.emit('detached', { object: previousObject });
    }

    setMode(mode) {
        if (!this.control) return;

        const validModes = ['translate', 'rotate', 'scale'];
        if (!validModes.includes(mode)) {
            console.warn(`TransformControls: Invalid mode "${mode}". Valid modes: ${validModes.join(', ')}`);
            return;
        }

        this.control.setMode(mode);
        this.config.mode = mode;

        this.emit('mode-changed', { mode });
    }

    setEnabled(enabled) {
        if (!this.control) return;

        this.control.enabled = enabled;
        this.config.enabled = enabled;

        this.emit('enabled-changed', { enabled });
    }

    setSpace(space) {
        if (!this.control) return;

        const validSpaces = ['world', 'local'];
        if (!validSpaces.includes(space)) {
            console.warn(`TransformControls: Invalid space "${space}". Valid spaces: ${validSpaces.join(', ')}`);
            return;
        }

        this.control.setSpace(space);
        this.config.space = space;

        this.emit('space-changed', { space });
    }

    setSize(size) {
        if (!this.control) return;

        this.control.setSize(size);
        this.config.size = size;

        this.emit('size-changed', { size });
    }

    setTranslationSnap(snap) {
        if (!this.control) return;

        this.control.setTranslationSnap(snap);
        this.config.translationSnap = snap;

        this.emit('translation-snap-changed', { snap });
    }

    setRotationSnap(snap) {
        if (!this.control) return;

        this.control.setRotationSnap(snap);
        this.config.rotationSnap = snap;

        this.emit('rotation-snap-changed', { snap });
    }

    setScaleSnap(snap) {
        if (!this.control) return;

        this.control.setScaleSnap(snap);
        this.config.scaleSnap = snap;

        this.emit('scale-snap-changed', { snap });
    }

    setAxisVisible(axis, show) {
        if (!this.control) return;

        const axisLower = axis.toLowerCase();
        if (axisLower === 'x') {
            this.control.showX = show;
            this.config.showX = show;
        } else if (axisLower === 'y') {
            this.control.showY = show;
            this.config.showY = show;
        } else if (axisLower === 'z') {
            this.control.showZ = show;
            this.config.showZ = show;
        }

        this.emit('axis-visibility-changed', { axis, show });
    }

    reset() {
        if (!this.control) return;

        this.control.reset();

        this.emit('reset');
    }

    getMode() {
        return this.control?.mode || this.config.mode;
    }

    getSpace() {
        return this.control?.space || this.config.space;
    }

    getAttachedObject() {
        return this.attachedObject;
    }

    getControl() {
        return this.control;
    }

    onDispose() {
        if (this.control) {
            Object.keys(this.eventHandlers).forEach(key => {
                if (this.eventHandlers[key]) {
                    this.control.removeEventListener(key, this.eventHandlers[key]);
                }
            });

            this.detach();

            this.control.dispose();
            this.control = null;
        }

        if (this.scene?.controls && typeof this.scene.controls.releaseLock === 'function') {
            this.scene.controls.releaseLock(this.orbitLockKey);
        }

        this.attachedObject = null;
        this.eventHandlers = {};
    }
}

export default TransformControls;
