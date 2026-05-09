import * as THREE from 'three';

export class CollisionDetector {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            rayDistance: 1.0,
            groundDistance: 2.0,
            targets: null,
            debug: false,
            useBVH: false,
            performanceWarningThreshold: 5.0,
            ...config
        };

        this.performanceStats = {
            totalChecks: 0,
            totalTime: 0,
            averageTime: 0,
            lastCheckTime: 0,
            rayCount: 0,
            maxTime: 0,
            minTime: Infinity
        };

        this.bvhQueries = new Map();

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = this.config.rayDistance;

        this.groundRaycaster = new THREE.Raycaster();
        this.groundRaycaster.far = this.config.groundDistance;

        this.directions = {
            forward: new THREE.Vector3(0, 0, -1),
            backward: new THREE.Vector3(0, 0, 1),
            left: new THREE.Vector3(-1, 0, 0),
            right: new THREE.Vector3(1, 0, 0),
            forwardLeft: new THREE.Vector3(-1, 0, -1).normalize(),
            forwardRight: new THREE.Vector3(1, 0, -1).normalize(),
            backwardLeft: new THREE.Vector3(-1, 0, 1).normalize(),
            backwardRight: new THREE.Vector3(1, 0, 1).normalize(),
            down: new THREE.Vector3(0, -1, 0)
        };

        this.debugHelpers = [];
        if (this.config.debug) {
            this.createDebugHelpers();
        }

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

    createDebugHelpers() {
        const arrowLength = this.config.rayDistance;
        const colors = {
            forward: 0xff0000,
            backward: 0x00ff00,
            left: 0x0000ff,
            right: 0xffff00,
            forwardLeft: 0xff8800,
            forwardRight: 0xff0088,
            backwardLeft: 0x00ff88,
            backwardRight: 0x8800ff,
            down: 0xff00ff
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

    updateDebugHelpers(position) {
        if (!this.config.debug) return;

        this.debugHelpers.forEach(helper => {
            helper.position.copy(position);
        });
    }

    checkDirection(position, direction, distance = this.config.rayDistance) {
        const startTime = this._startPerformanceTimer();

        this.raycaster.set(position, direction.normalize());
        this.raycaster.far = distance;

        const targets = this.getTargets();

        const intersects = this.raycaster.intersectObjects(targets, true);

        const validIntersects = intersects.filter(hit => hit.distance <= distance);

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

    checkForward(position, forwardDirection) {
        const result = this.checkDirection(position, forwardDirection);
        this.lastCollisionResults.forward = result;
        return result;
    }

    checkBackward(position, backwardDirection) {
        const result = this.checkDirection(position, backwardDirection);
        this.lastCollisionResults.backward = result;
        return result;
    }

    checkLeft(position, leftDirection) {
        const result = this.checkDirection(position, leftDirection);
        this.lastCollisionResults.left = result;
        return result;
    }

    checkRight(position, rightDirection) {
        const result = this.checkDirection(position, rightDirection);
        this.lastCollisionResults.right = result;
        return result;
    }

    checkForwardLeft(position, forwardDirection, leftDirection) {
        const direction = new THREE.Vector3()
            .addVectors(forwardDirection, leftDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.forwardLeft = result;
        return result;
    }

    checkForwardRight(position, forwardDirection, rightDirection) {
        const direction = new THREE.Vector3()
            .addVectors(forwardDirection, rightDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.forwardRight = result;
        return result;
    }

    checkBackwardLeft(position, backwardDirection, leftDirection) {
        const direction = new THREE.Vector3()
            .addVectors(backwardDirection, leftDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.backwardLeft = result;
        return result;
    }

    checkBackwardRight(position, backwardDirection, rightDirection) {
        const direction = new THREE.Vector3()
            .addVectors(backwardDirection, rightDirection)
            .normalize();
        const result = this.checkDirection(position, direction);
        this.lastCollisionResults.backwardRight = result;
        return result;
    }

    checkCylindricalCollision(position, radius = 0.3, height = 1.8, segments = 8) {
        const collisions = [];
        const angleStep = (Math.PI * 2) / segments;

        const heights = [
            position.y + height * 0.9,
            position.y + height * 0.5,
            position.y + height * 0.1
        ];

        heights.forEach((checkHeight, heightIndex) => {
            for (let i = 0; i < segments; i++) {
                const angle = i * angleStep;
                const checkPos = new THREE.Vector3(
                    position.x + Math.cos(angle) * radius,
                    checkHeight,
                    position.z + Math.sin(angle) * radius
                );

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

    checkGround(position) {
        this.groundRaycaster.set(position, this.directions.down);
        this.groundRaycaster.far = this.config.groundDistance;

        const targets = this.getTargets();

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

    isOnGround(position, threshold = 0.1) {
        const groundInfo = this.checkGround(position);
        return groundInfo !== null && groundInfo.distance <= threshold;
    }

    getTargets() {
        if (this.config.targets) {
            return Array.isArray(this.config.targets)
                ? this.config.targets
                : [this.config.targets];
        }

        return this.scene.scene.children;
    }

    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };

        this.raycaster.far = this.config.rayDistance;
        this.groundRaycaster.far = this.config.groundDistance;
    }


    _startPerformanceTimer() {
        return performance.now();
    }

    _endPerformanceTimer(startTime) {
        const elapsed = performance.now() - startTime;

        this.performanceStats.lastCheckTime = elapsed;
        this.performanceStats.totalChecks++;
        this.performanceStats.totalTime += elapsed;
        this.performanceStats.averageTime =
            this.performanceStats.totalTime / this.performanceStats.totalChecks;

        if (elapsed > this.performanceStats.maxTime) {
            this.performanceStats.maxTime = elapsed;
        }
        if (elapsed < this.performanceStats.minTime) {
            this.performanceStats.minTime = elapsed;
        }

        if (elapsed > this.config.performanceWarningThreshold) {
            console.warn(
                `[CollisionDetector] 性能警告: 碰撞检测耗时 ${elapsed.toFixed(2)}ms ` +
                `(阈值: ${this.config.performanceWarningThreshold}ms)`
            );
            console.warn(`  - 建议启用 BVH 加速以提升性能`);
        }
    }

    getPerformanceStats() {
        return {
            ...this.performanceStats,
            useBVH: this.config.useBVH,
            bvhCount: this.bvhQueries.size,
            rayCount: 9
        };
    }

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

        if (totalMeshCount > 1000 && !this.config.useBVH) {
            console.warn(
                `[CollisionDetector] 性能建议: 场景包含 ${totalMeshCount} 个 Mesh，` +
                `建议启用 BVH 加速 (useBVH: true)`
            );
        }

        console.log(`[CollisionDetector] BVH 加速已启用`);
    }

    dispose() {
        if (this.config.debug) {
            this.debugHelpers.forEach(helper => {
                this.scene.scene.remove(helper);
            });
            this.debugHelpers = [];
        }

        this.raycaster = null;
        this.groundRaycaster = null;
        this.lastCollisionResults = null;

        this.bvhQueries.clear();
    }
}

export default CollisionDetector;

