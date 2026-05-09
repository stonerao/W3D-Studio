/**
 * English comment.
 */
export class PathUtils {
    /**
     * English comment.
     */
    static getLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dz = (p2.z || 0) - (p1.z || 0);
            length += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        return length;
    }

    /**
     * English comment.
     */
    static getPointAtDistance(points, distance) {
        let currentDistance = 0;

        for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dz = (p2.z || 0) - (p1.z || 0);
            const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (currentDistance + segmentLength >= distance) {
                const t = (distance - currentDistance) / segmentLength;
                return {
                    x: p1.x + dx * t,
                    y: p1.y + dy * t,
                    z: (p1.z || 0) + dz * t
                };
            }

            currentDistance += segmentLength;
        }

        return points[points.length - 1];
    }
}

export default PathUtils;
