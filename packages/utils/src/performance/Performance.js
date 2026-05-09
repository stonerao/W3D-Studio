/**
 * English comment.
 */
export class Performance {
    constructor() {
        this.marks = new Map();
        this.measures = new Map();
    }

    /**
     * English comment.
     */
    mark(name) {
        this.marks.set(name, performance.now());
    }

    /**
     * English comment.
     */
    measure(name, startMark, endMark) {
        const start = this.marks.get(startMark);
        const end = this.marks.get(endMark);

        if (start && end) {
            const duration = end - start;
            this.measures.set(name, duration);
            return duration;
        }

        return 0;
    }

    /**
     * English comment.
     */
    getMeasure(name) {
        return this.measures.get(name) || 0;
    }

    /**
     * English comment.
     */
    clear() {
        this.marks.clear();
        this.measures.clear();
    }
}

export default Performance;
