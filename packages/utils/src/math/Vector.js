/**
 * English comment.
 */
export class Vector {
    /**
     * English comment.
     */
    static distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = (p2.z || 0) - (p1.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * English comment.
     */
    static normalize(v) {
        const length = Math.sqrt(v.x * v.x + v.y * v.y + (v.z || 0) * (v.z || 0));
        return {
            x: v.x / length,
            y: v.y / length,
            z: (v.z || 0) / length
        };
    }

    /**
     * English comment.
     */
    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y + (v1.z || 0) * (v2.z || 0);
    }

    /**
     * English comment.
     */
    static cross(v1, v2) {
        return {
            x: v1.y * (v2.z || 0) - (v1.z || 0) * v2.y,
            y: (v1.z || 0) * v2.x - v1.x * (v2.z || 0),
            z: v1.x * v2.y - v1.y * v2.x
        };
    }
}

export default Vector;
