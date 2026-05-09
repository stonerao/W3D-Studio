import { Component } from '@w3d/core';
import { FlyControls as ThreeFlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { getCameraModeManager } from '../shared/CameraModeManager.js';

/**
 * Controls module component that provides free-flight camera navigation for large 3D scenes.
 */
export class FlyControls extends Component {
    static defaultConfig = {
        enabled: true,
        moveSpeed: 12,
        rollSpeed: 1.0,
        dragToLook: true,
        autoForward: false
    };

    onCreate() {
        this.controller = null;
        this.isActive = false;
        this.modeManager = getCameraModeManager(this.scene);
    }

    onMounted() {
        const camera = this.scene?.camera?.instance;
        const domElement = this.scene?.renderer?.instance?.domElement;
        if (!camera || !domElement) {
            // eslint-disable-next-line no-console
            console.warn('FlyControls mounted but camera/domElement is not ready');
            return;
        }

        this.controller = new ThreeFlyControls(camera, domElement);
        this.applyControlConfig();

        this.modeManager?.register(this, {
            mode: 'fly',
            deactivate: (reason) => this.deactivate(reason, { fromManager: true })
        });

        if (this.config.enabled !== false) {
            this.activate({ fromManager: false });
        } else {
            this.setEnabled(false);
        }
    }

    onConfigUpdate() {
        this.applyControlConfig();

        if (this.config.enabled === false && this.isActive) {
            this.deactivate('config', { fromManager: false });
        }

        if (this.config.enabled !== false && !this.isActive) {
            this.activate({ fromManager: false });
        }
    }

    applyControlConfig() {
        if (!this.controller) return;
        this.controller.movementSpeed = Number(this.config.moveSpeed) || 12;
        this.controller.rollSpeed = Number(this.config.rollSpeed) || 1.0;
        this.controller.dragToLook = this.config.dragToLook !== false;
        this.controller.autoForward = !!this.config.autoForward;
        this.controller.enabled = this.isActive;
    }

    setEnabled(enabled = true) {
        if (enabled) {
            return this.activate({ fromManager: false });
        }
        return this.deactivate('manual', { fromManager: false });
    }

    activate({ fromManager = false } = {}) {
        if (this.isActive) return true;
        if (!this.controller) return false;

        if (!fromManager) {
            const accepted = this.modeManager?.requestActivate(this);
            if (accepted === false) return false;
        }

        this.isActive = true;
        this.config.enabled = true;
        this.controller.enabled = true;
        this.emit('active-change', true);
        return true;
    }

    deactivate(reason = 'manual', { fromManager = false } = {}) {
        if (!this.isActive) return false;

        this.isActive = false;
        this.config.enabled = false;
        if (this.controller) {
            this.controller.enabled = false;
        }

        if (!fromManager) {
            this.modeManager?.requestDeactivate(this, reason);
        }

        this.emit('active-change', false);
        return true;
    }

    onUpdate(delta) {
        if (!this.isActive || !this.controller) return;
        this.controller.update(delta);
    }

    onDispose() {
        this.deactivate('dispose', { fromManager: false });
        this.modeManager?.unregister(this);

        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }
    }
}

export default FlyControls;
