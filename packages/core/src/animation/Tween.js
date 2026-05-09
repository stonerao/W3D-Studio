/**
 * English comment.
 */
export class Tween {
    /**
     * English comment.
     */
    constructor(target, to, duration, options = {}) {
        this.target = target;
        this.to = to;
        this.duration = duration;
        this.options = {
            easing: 'linear',
            onUpdate: null,
            onComplete: null,
            ...options
        };

        // English comment.
        this.from = {};
        Object.keys(to).forEach((key) => {
            this.from[key] = target[key];
        });

        // English comment.
        this.isPlaying = false;
        this.startTime = 0;
        this.elapsed = 0;
    }

    /**
     * English comment.
     */
    start() {
        this.isPlaying = true;
        this.startTime = Date.now();
        this.update();
    }

    /**
     * English comment.
     */
    stop() {
        this.isPlaying = false;
    }

    /**
     * English comment.
     */
    update() {
        if (!this.isPlaying) return;

        this.elapsed = Date.now() - this.startTime;
        const progress = Math.min(this.elapsed / this.duration, 1);

        // English comment.
        const easedProgress = this.ease(progress);

        // English comment.
        Object.keys(this.to).forEach((key) => {
            const from = this.from[key];
            const to = this.to[key];
            this.target[key] = from + (to - from) * easedProgress;
        });

        // English comment.
        if (this.options.onUpdate) {
            this.options.onUpdate(this.target, progress);
        }

        // English comment.
        if (progress >= 1) {
            this.isPlaying = false;
            if (this.options.onComplete) {
                this.options.onComplete(this.target);
            }
        } else {
            requestAnimationFrame(() => this.update());
        }
    }

    /**
     * English comment.
     */
    ease(t) {
        const easing = this.options.easing;

        switch (easing) {
            case 'linear':
                return t;
            case 'easeInQuad':
                return t * t;
            case 'easeOutQuad':
                return t * (2 - t);
            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'easeInCubic':
                return t * t * t;
            case 'easeOutCubic':
                return --t * t * t + 1;
            case 'easeInOutCubic':
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            default:
                return t;
        }
    }

    /**
     * English comment.
     */
    static to(target, to, duration, options) {
        const tween = new Tween(target, to, duration, options);
        tween.start();
        return tween;
    }
}
