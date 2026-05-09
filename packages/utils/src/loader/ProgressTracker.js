/**
 * English comment.
 */
export class ProgressTracker {
    constructor() {
        this.total = 0;
        this.loaded = 0;
        this.items = new Map();
    }

    /**
     * English comment.
     */
    addItem(id, size = 1) {
        this.items.set(id, { size, loaded: 0 });
        this.total += size;
    }

    /**
     * English comment.
     */
    updateProgress(id, loaded) {
        const item = this.items.get(id);
        if (item) {
            const delta = loaded - item.loaded;
            item.loaded = loaded;
            this.loaded += delta;
        }
    }

    /**
     * English comment.
     */
    getProgress() {
        return this.total > 0 ? this.loaded / this.total : 0;
    }

    /**
     * English comment.
     */
    reset() {
        this.total = 0;
        this.loaded = 0;
        this.items.clear();
    }
}

export default ProgressTracker;
