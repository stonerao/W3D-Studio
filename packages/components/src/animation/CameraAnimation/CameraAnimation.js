import { Component } from '@w3d/core';
import { Tween } from '@w3d/core';

/**
 * Animation module component that interpolates the active camera to a configured position and emits progress events.
 */
export class CameraAnimation extends Component {
    static defaultConfig = {
        targetPosition: null,
        targetLookAt: null,
        duration: 1000,
        easing: 'easeInOutQuad',
        autoStart: false
    };

    onMounted() {
        if (this.config.autoStart) {
            this.play();
        }
    }

    play() {
        const camera = this.scene.camera.instance;

        if (this.config.targetPosition) {
            const [x, y, z] = this.config.targetPosition;
            Tween.to(camera.position, { x, y, z }, this.config.duration, {
                easing: this.config.easing,
                onUpdate: () => {
                    this.emit('update');
                },
                onComplete: () => {
                    this.emit('complete');
                }
            });
        }
    }
}

export default CameraAnimation;
