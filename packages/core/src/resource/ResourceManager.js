import { EventEmitter } from '@w3d/utils';
import { EventTypes } from '../event/EventTypes.js';

/**
 * English comment.
 */
export class ResourceManager {
    /**
     * English comment.
     */
    constructor(scene) {
        this.scene = scene;

        // English comment.
        this.cache = new Map();

        // English comment.
        this.loadQueue = [];

        // English comment.
        this.eventEmitter = new EventEmitter();

        // English comment.
        this.stats = {
            total: 0,
            loaded: 0,
            failed: 0
        };
    }

    /**
     * English comment.
     */
    async load(url, type, loader) {
        // English comment.
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        // English comment.
        this.eventEmitter.emit(EventTypes.RESOURCE_LOAD_START, { url, type });
        this.stats.total++;

        try {
            // English comment.
            const resource = await loader(url, (progress) => {
                // English comment.
                this.eventEmitter.emit(EventTypes.RESOURCE_LOAD_PROGRESS, {
                    url,
                    type,
                    progress
                });
            });

            // English comment.
            this.cache.set(url, resource);
            this.stats.loaded++;

            // English comment.
            this.eventEmitter.emit(EventTypes.RESOURCE_LOAD_COMPLETE, {
                url,
                type,
                resource
            });

            return resource;
        } catch (error) {
            this.stats.failed++;

            // English comment.
            this.eventEmitter.emit(EventTypes.RESOURCE_LOAD_ERROR, {
                url,
                type,
                error
            });

            throw error;
        }
    }

    /**
     * English comment.
     */
    get(url) {
        return this.cache.get(url);
    }

    /**
     * English comment.
     */
    remove(url) {
        this.cache.delete(url);
    }

    /**
     * English comment.
     */
    clear() {
        this.cache.clear();
        this.stats = {
            total: 0,
            loaded: 0,
            failed: 0
        };
    }

    /**
     * English comment.
     */
    getStats() {
        return {
            ...this.stats,
            progress: this.stats.total > 0 ? this.stats.loaded / this.stats.total : 0
        };
    }

    /**
     * English comment.
     */
    on(event, handler) {
        this.eventEmitter.on(event, handler);
    }

    /**
     * English comment.
     */
    dispose() {
        this.clear();
        this.eventEmitter.removeAllListeners();
    }
}
