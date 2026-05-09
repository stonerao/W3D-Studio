/**
 * English comment.
 */
export class CacheManager {
    /**
     * English comment.
     */
    constructor() {
        // English comment.
        this.cache = new Map();

        // English comment.
        this.maxSize = 100;

        // English comment.
        this.currentSize = 0;
    }

    /**
     * English comment.
     */
    set(key, value, size = 0) {
        // English comment.
        if (this.currentSize + size > this.maxSize * 1024 * 1024) {
            this.evict();
        }

        this.cache.set(key, {
            value,
            size,
            timestamp: Date.now()
        });

        this.currentSize += size;
    }

    /**
     * English comment.
     */
    get(key) {
        const item = this.cache.get(key);

        if (item) {
            // English comment.
            item.timestamp = Date.now();
            return item.value;
        }

        return null;
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
        const item = this.cache.get(key);

        if (item) {
            this.currentSize -= item.size;
            this.cache.delete(key);
        }
    }

    /**
     * English comment.
     */
    clear() {
        this.cache.clear();
        this.currentSize = 0;
    }

    /**
     * English comment.
     */
    evict() {
        // English comment.
        let oldestKey = null;
        let oldestTime = Infinity;

        this.cache.forEach((item, key) => {
            if (item.timestamp < oldestTime) {
                oldestTime = item.timestamp;
                oldestKey = key;
            }
        });

        // English comment.
        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    /**
     * English comment.
     */
    getStats() {
        return {
            count: this.cache.size,
            size: this.currentSize,
            maxSize: this.maxSize * 1024 * 1024,
            usage: this.currentSize / (this.maxSize * 1024 * 1024)
        };
    }
}
