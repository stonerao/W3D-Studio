/**
 * English comment.
 */
export class EventEmitter {
    /**
     * English comment.
     */
    constructor() {
        this.events = new Map();
    }

    /**
     * English comment.
     */
    on(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        this.events.get(event).push(listener);
        return this;
    }

    /**
     * English comment.
     */
    once(event, listener) {
        const onceWrapper = (...args) => {
            listener(...args);
            this.off(event, onceWrapper);
        };

        return this.on(event, onceWrapper);
    }

    /**
     * English comment.
     */
    off(event, listener) {
        const listeners = this.events.get(event);

        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }

        return this;
    }

    /**
     * English comment.
     */
    emit(event, ...args) {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    listener(...args);
                } catch (error) {
                    console.error(`Error in event listener for "${event}":`, error);
                }
            });
        }

        return this;
    }

    /**
     * English comment.
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }

        return this;
    }

    /**
     * English comment.
     */
    listenerCount(event) {
        const listeners = this.events.get(event);
        return listeners ? listeners.length : 0;
    }
}
