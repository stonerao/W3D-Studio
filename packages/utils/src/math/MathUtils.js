/**
 * English comment.
 */
export class MathUtils {
    /**
     * English comment.
     */
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * English comment.
     */
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * English comment.
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * English comment.
     */
    static lerp(start, end, t) {
        return start + (end - start) * t;
    }

    /**
     * English comment.
     */
    static map(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }

    /**
     * English comment.
     */
    static random(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    }

    /**
     * English comment.
     */
    static randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    }

    /**
     * English comment.
     */
    static isPowerOfTwo(value) {
        return (value & (value - 1)) === 0 && value !== 0;
    }

    /**
     * English comment.
     */
    static ceilPowerOfTwo(value) {
        return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
    }

    /**
     * English comment.
     */
    static floorPowerOfTwo(value) {
        return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
    }
}

export default MathUtils;
