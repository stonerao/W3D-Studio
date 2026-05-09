import * as THREE from 'three';

/**
 * English comment.
 */
export class CollisionDetector {
    /**
     * English comment.
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            // English comment.
            rayDistance: 1.0,
            // English comment.
            groundDistance: 2.0,
            // English comment.
            targets: null,
            // English comment.
            debug: false,
            // English comment.
            useBVH: false,
            // English comment.
            performanceWarningThreshold: 5.0,
            ...config
        };

        // English comment.
        this.performanceStats = {
            totalChecks: 0,          // English comment.
            totalTime: 0,            // English comment.
            averageTime: 0,          // English comment.
            lastCheckTime: 0,        // English comment.
            rayCount: 0,             // English comment.
            maxTime: 0,              // English comment.
            minTime: Infinity        // English comment.
        };

        // English comment.
        this.bvhQueries = new Map();  // English comment.

        // English comment.
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = this.config.rayDistance;

        // English comment.
        this.groundRaycaster = new THREE.Raycaster();
        this.groundRaycaster.far = this.config.groundDistance;

        // English comment.
        this.directions = {
            forward: new THREE.Vector3(0, 0, -1),
            backward: new THREE.Vector3(0, 0, 1),
            left: new THREE.Vector3(-1, 0, 0),
            right: new THREE.Vector3(1, 0, 0),
            // English comment.
            forwardLeft: new THREE.Vector3(-1, 0, -1).normalize(),
            forwardRight: new THREE.Vector3(1, 0, -1).normalize(),
            backwardLeft: new THREE.Vector3(-1, 0, 1).normalize(),
            backwardRight: new THREE.Vector3(1, 0, 1).normalize(),
            down: new THREE.Vector3(0, -1, 0)
        };

        // English comment.
        this.debugHelpers = [];
        if (this.config.debug) {
            this.createDebugHelpers();
        }

        // English comment.
        this.lastCollisionResults = {
            forward: null,
            backward: null,
            left: null,
            right: null,
            forwardLeft: null,
            forwardRight: null,
            backwardLeft: null,
            backwardRight: null,
            ground: null
        };
    }

    /**
     * English comment.
     */
    createDebugHelpers() {
        const arrowLength = this.config.rayDistance;
        const colors = {
            forward: 0xff0000,      // English comment.
            backward: 0x00ff00,     // English comment.
            left: 0x0000ff,         // English comment.
            right: 0xffff00,        // English comment.
            forwardLeft: 0xff8800,  // English comment.
            forwardRight: 0xff0088, // English comment.
            backwardLeft: 0x00ff88, // English comment.
            backwardRight: 0x8800ff,// English comment.
            down: 0xff00ff          // English comment.
        };

        Object.keys(this.directions).forEach(key => {
            const arrow = new THREE.ArrowHelper(
                this.directions[key],
                new THREE.Vector3(0, 0, 0),
                key === 'down' ? this.config.groundDistance : arrowLength,
                colors[key] || 0xffffff
            );
            arrow.name = `collision_debug_${key}`;
            this.debugHelpers.push(arrow);
            this.scene.scene.add(arrow);
        });
    }

    /**
     * English comment.
     */
    updateDebugHelpers(position) {
        if (!this.config.debug) return;

        this.debugHelpers.forEach(helper => {
            helper.position.copy(position);
        });
    }

    /**
     * English comment.
     */
    checkDirection(position, direction, distance = this.config.rayDistance) {
        // English comment.
        const startTime = this._startPerformanceTimer();

        // English comment.
        this.raycaster.set(position, direction.normalize());
        this.raycaster.far = distance;

        // English comment.
        const targets = this.getTargets();

        // English comment.
        const intersects = this.raycaster.intersectObjects(targets, true);

        // English comment.
        const validIntersects = intersects.filter(hit => hit.distance <= distance);

        // English comment.
        this._endPerformanceTimer(startTime);

        if (validIntersects.length > 0) {
            return {
                hit: true,
                distance: validIntersects[0].distance,
                point: validIntersects[0].point,
                normal: validIntersects[0].face?.normal || new THREE.Vector3(0, 1, 0),
                object: validIntersects[0].object
            };
        }

        return null;
    }

    /**
     * English comment.
     */
    checkForward(position, forwardDirection) {
        const result = this.checkDirection(position, forwardDirection);
        this.lastCollisionResults.forward = result;
        return result;
    }

    /**
     * English comment.
     */
    checkBackward(position, backwardDirection) {
        const result = this.checkDirection(position, backwardDirection);
        this.lastCollisionResults.backward = result;
        return result;
    }

    /**
     * English comment.
     */
    checkLeft(position, leftDirection) {
        const result = this.checkDirection(position, leftDirection);
        this.lastCollisionResults.left = result;
        return result;
    }

    /**
     * English comment.
     */
    checkRight(position, rightDirection) {
        const result = this.checkDirection(position, rightDirection);
        this.lastCollisionResults.right = result;
        return result;
    }

    /**
     * English comment.
     */
    checkForwardLeft(position, forwardDirection, leftDirection) {
        const direction = new THREE.Vector3()
            .addVectors(forwardDirection, leftDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.forwardLeft = result;
        return result;
    }

    /**
     * English comment.
     */
    checkForwardRight(position, forwardDirection, rightDirection) {
        const direction = new THREE.Vector3()
            .addVectors(forwardDirection, rightDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.forwardRight = result;
        return result;
    }

    /**
     * English comment.
     */
    checkBackwardLeft(position, backwardDirection, leftDirection) {
        const direction = new THREE.Vector3()
            .addVectors(backwardDirection, leftDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.backwardLeft = result;
        return result;
    }

    /**
     * English comment.
     */
    checkBackwardRight(position, backwardDirection, rightDirection) {
        const direction = new THREE.Vector3()
            .addVectors(backwardDirection, rightDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.backwardRight = result;
        return result;
    }

    /**
     * English comment.
     */
    checkCylindricalCollision(position, radius = 0.3, height = 1.8, segments = 8) {
        const collisions = [];
        const angleStep = (Math.PI * 2) / segments;

        // English comment.
        const heights = [
            position.y + height * 0.9,  // English comment.
            position.y + height * 0.5,  // English comment.
            position.y + height * 0.1   // English comment.
        ];

        heights.forEach((checkHeight, heightIndex) => {
            for (let i = 0; i < segments; i++) {
                const angle = i * angleStep;
                const checkPos = new THREE.Vector3(
                    position.x + Math.cos(angle) * radius,
                    checkHeight,
                    position.z + Math.sin(angle) * radius
                );

                // English comment.
                const direction = new THREE.Vector3(
                    Math.cos(angle),
                    0,
                    Math.sin(angle)
                );

                const collision = this.checkDirection(checkPos, direction, radius * 0.5);
                if (collision) {
                    collisions.push({
                        ...collision,
                        angle: angle,
                        heightLevel: heightIndex,
                        checkPosition: checkPos.clone()
                    });
                }
            }
        });

        return {
            hasCollision: collisions.length > 0,
            collisions: collisions,
            count: collisions.length
        };
    }

    /**
     * English comment.
     */
    checkGround(position) {
        // English comment.
        this.groundRaycaster.set(position, this.directions.down);
        this.groundRaycaster.far = this.config.groundDistance;

        // English comment.
        const targets = this.getTargets();

        // English comment.
        const intersects = this.groundRaycaster.intersectObjects(targets, true);

        if (intersects.length > 0) {
            const result = {
                hit: true,
                distance: intersects[0].distance,
                point: intersects[0].point,
                normal: intersects[0].face?.normal || new THREE.Vector3(0, 1, 0),
                object: intersects[0].object
            };
            this.lastCollisionResults.ground = result;
            return result;
        }

        this.lastCollisionResults.ground = null;
        return null;
    }

    /**
     * English comment.
     */
    isOnGround(position, threshold = 0.1) {
        const groundInfo = this.checkGround(position);
        return groundInfo !== null && groundInfo.distance <= threshold;
    }

    /**
     * English comment.
     */
    getTargets() {
        if (this.config.targets) {
            // English comment.
            return Array.isArray(this.config.targets)
                ? this.config.targets
                : [this.config.targets];
        }

        // English comment.
        return this.scene.scene.children;
    }

    /**
     * English comment.
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };

        // English comment.
        this.raycaster.far = this.config.rayDistance;
        this.groundRaycaster.far = this.config.groundDistance;
    }

    // English comment.

    /**
     * English comment.
     */
    _startPerformanceTimer() {
        return performance.now();
    }

    /**
     * English comment.
     */
    _endPerformanceTimer(startTime) {
        const elapsed = performance.now() - startTime;

        this.performanceStats.lastCheckTime = elapsed;
        this.performanceStats.totalChecks++;
        this.performanceStats.totalTime += elapsed;
        this.performanceStats.averageTime =
            this.performanceStats.totalTime / this.performanceStats.totalChecks;

        // English comment.
        if (elapsed > this.performanceStats.maxTime) {
            this.performanceStats.maxTime = elapsed;
        }
        if (elapsed < this.performanceStats.minTime) {
            this.performanceStats.minTime = elapsed;
        }

        // English comment.
        if (elapsed > this.config.performanceWarningThreshold) {
            console.warn(
                `[CollisionDetector] 性能警告: 碰撞检测耗时 ${elapsed.toFixed(2)}ms ` +
                `(阈值: ${this.config.performanceWarningThreshold}ms)`
            );
            console.warn(`  - 建议启用 BVH 加速以提升性能`);
        }
    }

    /**
     * English comment.
     */
    getPerformanceStats() {
        return {
            ...this.performanceStats,
            useBVH: this.config.useBVH,
            bvhCount: this.bvhQueries.size,
            rayCount: 9  // English comment.
        };
    }

    /**
     * English comment.
     */
    resetPerformanceStats() {
        this.performanceStats = {
            totalChecks: 0,
            totalTime: 0,
            averageTime: 0,
            lastCheckTime: 0,
            rayCount: 0,
            maxTime: 0,
            minTime: Infinity
        };
    }

    // English comment.

    /**
     * English comment.
     */
    async initializeBVH() {
        if (!this.config.useBVH) {
            return;
        }

        const targets = this.getTargets();
        let totalMeshCount = 0;

        for (const target of targets) {
            let meshCount = 0;
            target.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                }
            });
            totalMeshCount += meshCount;
        }

        console.log(`[CollisionDetector] 检测到 ${totalMeshCount} 个 Mesh`);

        // English comment.
        if (totalMeshCount > 1000 && !this.config.useBVH) {
            console.warn(
                `[CollisionDetector] 性能建议: 场景包含 ${totalMeshCount} 个 Mesh，` +
                `建议启用 BVH 加速 (useBVH: true)`
            );
        }

        console.log(`[CollisionDetector] BVH 加速已启用`);
    }

    /**
     * English comment.
     */
    dispose() {
        // English comment.
        if (this.config.debug) {
            this.debugHelpers.forEach(helper => {
                this.scene.scene.remove(helper);
            });
            this.debugHelpers = [];
        }

        // English comment.
        this.raycaster = null;
        this.groundRaycaster = null;
        this.lastCollisionResults = null;

        // English comment.
        this.bvhQueries.clear();
    }
}

export default CollisionDetector;

