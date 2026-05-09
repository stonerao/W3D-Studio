/**
 * English comment.
 */
export class Transform {
    /**
     * English comment.
     */
    static createMatrix(position, rotation, scale) {
        // English comment.
        return {
            position: position || { x: 0, y: 0, z: 0 },
            rotation: rotation || { x: 0, y: 0, z: 0 },
            scale: scale || { x: 1, y: 1, z: 1 }
        };
    }

    /**
     * English comment.
     */
    static apply(point, transform) {
        // English comment.
        return {
            x: point.x * transform.scale.x + transform.position.x,
            y: point.y * transform.scale.y + transform.position.y,
            z: point.z * transform.scale.z + transform.position.z
        };
    }
}

export default Transform;
