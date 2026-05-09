/**
 * English comment.
 */
export class MemoryCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    /**
     * English comment.
     */
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * English comment.
     */
    get(key) {
        const item = this.cache.get(key);
        return item ? item.value : null;
    }

    /**
     * English comment.
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * English comment.
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * English comment.
     */
    clear() {
        this.cache.clear();
    }
}

export default MemoryCache;
