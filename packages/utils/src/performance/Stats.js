/**
 * English comment.
 */
export class Stats {
    constructor() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
    }

    /**
     * English comment.
     */
    update() {
        this.frameCount++;
        const currentTime = performance.now();
        const delta = currentTime - this.lastTime;

        if (delta >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / delta);
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }

    /**
     * English comment.
     */
    getFPS() {
        return this.fps;
    }
}

export default Stats;
