import { Component } from '@w3d/core';

/**
 * English comment.
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

    /**
     * English comment.
     */
    updateConfig(newConfig) {
        // English comment.
        this.stop();

        // English comment.
        Object.assign(this.config, newConfig);

        // English comment.
        if (this.config.target) {
            this.playAnimation();
        }
    }

    onDispose() {
        this.stop();
    }
}

export default ModelAnimation;
