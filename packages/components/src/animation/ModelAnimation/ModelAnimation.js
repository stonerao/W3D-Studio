import { Component } from '@w3d/core';

/**
 * ModelAnimation 模型动画组件
 *
 * @class ModelAnimation
 * @extends Component
 * @description 播放模型自带的动画
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
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        // 停止当前动画
        this.stop();

        // 合并配置
        Object.assign(this.config, newConfig);

        // 重新播放动画
        if (this.config.target) {
            this.playAnimation();
        }
    }

    onDispose() {
        this.stop();
    }
}

export default ModelAnimation;
