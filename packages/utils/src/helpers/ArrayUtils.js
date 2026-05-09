/**
 * English comment.
 */
export class ArrayUtils {
    /**
     * English comment.
     */
    static unique(arr) {
        return [...new Set(arr)];
    }

    /**
     * English comment.
     */
    static flatten(arr, depth = 1) {
        return depth > 0
            ? arr.reduce(
                  (acc, val) => acc.concat(Array.isArray(val) ? this.flatten(val, depth - 1) : val),
                  []
              )
            : arr.slice();
    }

    /**
     * English comment.
     */
    static chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * English comment.
     */
    static shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

export default ArrayUtils;
