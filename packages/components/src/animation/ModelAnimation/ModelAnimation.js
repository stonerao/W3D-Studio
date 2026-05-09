import { Component } from '@w3d/core';

/**
 * Animation module component that controls embedded model animation clips and playback state.
 */
export class ModelAnimation extends Component {
    static defaultConfig = {
        target: null,
        clipIndex: 0,
        loop: true,
        timeScale: 1.0
    };

    onMounted() {
        if (this.config.target) {
            this.playAnimation();
        }
    }

    playAnimation() {
        const target = this.config.target;
        if (!target || !target.animations) return;

        const clip = target.animations[this.config.clipIndex];
        if (clip) {
            this.action = this.scene.animationManager.play(target.model, clip, {
                loop: this.config.loop,
                timeScale: this.config.timeScale
            });
        }
    }

    stop() {
        if (this.action) {
            this.action.stop();
        }
    }

    updateConfig(newConfig) {
        this.stop();

        Object.assign(this.config, newConfig);

        if (this.config.target) {
            this.playAnimation();
        }
    }

    onDispose() {
        this.stop();
    }
}

export default ModelAnimation;
