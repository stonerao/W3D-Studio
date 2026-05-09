import { Component } from '@w3d/core';
import * as THREE from 'three';
import {
    MeshBVH,
    MeshBVHHelper,
    acceleratedRaycast,
    computeBoundsTree,
    disposeBoundsTree,
    CONTAINED,
    INTERSECTED,
    NOT_INTERSECTED,
    StaticGeometryGenerator
} from 'three-mesh-bvh';

// English comment.
// English comment.
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

/**
 * English comment.
 */
export class BVHQuery extends Component {
    static defaultConfig = {
        // English comment.
        mesh: null,
        geometry: null,

        // English comment.
        bvhOptions: {
            strategy: 'SAH', // 'CENTER' | 'AVERAGE' | 'SAH'
            maxDepth: 40, // English comment.
            maxLeafTris: 10, // English comment.
            verbose: false, // English comment.
            setBoundingBox: true // English comment.
        },

        // English comment.
        async: false,

        // English comment.
        autoUpdate: false,

        // English comment.
        showHelper: false,
        helperOptions: {
            depth: 10, // English comment.
            color: 0x00ff88, // English comment.
            opacity: 0.3, // English comment.
            displayEdges: true // English comment.
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.bvh = null;

        // English comment.
        this.targetMesh = null;

        // English comment.
        this.targetGeometry = null;

        // English comment.
        this.helper = null;

        // English comment.
        this.stats = {
            lastQueryTime: 0,
            totalQueries: 0,
            averageQueryTime: 0
        };
    }

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        if (!this._initializeGeometry()) {
            return;
        }

        // English comment.
        if (!this._validateGeometry()) {
            return;
        }

        // English comment.
        await this.generateBVH();

        // English comment.
        if (this.config.showHelper) {
            this.createHelper();
        }
    }

    /**
     * English comment.
     */
    _initializeGeometry() {
        if (this.config.mesh) {
            this.targetMesh = this.config.mesh;
            this.targetGeometry = this.targetMesh.geometry;
        } else if (this.config.geometry) {
            this.targetGeometry = this.config.geometry;
        } else {
            console.warn('BVHQuery: No mesh or geometry provided');
            return false;
        }

        return true;
    }

    /**
     * English comment.
     */
    _validateGeometry() {
        if (!this.targetGeometry) {
            const error = new Error('Target geometry is null or undefined');
            console.error('BVHQuery:', error.message);
            this.emit('error', { type: 'initialization', error });
            return false;
        }

        if (!this.targetGeometry.isBufferGeometry) {
            const error = new Error('Target geometry must be a BufferGeometry');
            console.error('BVHQuery:', error.message);
            this.emit('error', { type: 'initialization', error });
            return false;
        }

        return true;
    }

    // English comment.

    /**
     * English comment.
     */
    async generateBVH() {
        const startTime = Date.now();

        try {
            // English comment.
            if (this.config.async) {
                console.warn(
                    'BVHQuery: Async generation not implemented yet, using sync generation'
                );
            }

            this.bvh = new MeshBVH(this.targetGeometry, this.config.bvhOptions);

            // English comment.
            this.targetGeometry.boundsTree = this.bvh;

            const buildTime = Date.now() - startTime;

            // English comment.
            this.emit('bvhGenerated', {
                buildTime,
                stats: this.getStats()
            });
        } catch (error) {
            console.error('BVHQuery: Failed to generate BVH', error);
            this.emit('error', { type: 'generation', error });
            throw error;
        }
    }

    /**
     * English comment.
     */
    refit(nodeIndices = null) {
        if (!this.bvh) {
            console.warn('BVHQuery: BVH not generated yet');
            return;
        }

        try {
            this.bvh.refit(nodeIndices);
            this.emit('bvhRefitted', { nodeIndices });
        } catch (error) {
            console.error('BVHQuery: Failed to refit BVH', error);
            this.emit('error', { type: 'refit', error });
        }
    }

    /**
     * English comment.
     */
    async rebuild(options = null) {
        // English comment.
        if (this.bvh) {
            this.bvh = null;
            this.targetGeometry.boundsTree = null;
        }

        // English comment.
        if (options) {
            this.config.bvhOptions = { ...this.config.bvhOptions, ...options };
        }

        // English comment.
        await this.generateBVH();
    }

    // English comment.

    /**
     * English comment.
     */
    raycast(ray, options = {}) {
        if (!this._checkBVH()) {
            return options.firstHitOnly ? null : [];
        }

        // English comment.
        if (!ray || !ray.origin || !ray.direction) {
            console.error('BVHQuery: Invalid ray parameter. Expected THREE.Ray object.');
            return options.firstHitOnly ? null : [];
        }

        const { side = THREE.FrontSide, firstHitOnly = false, near = 0, far = Infinity } = options;

        return this._executeQuery(
            'raycast',
            () => {
                return firstHitOnly
                    ? this.bvh.raycastFirst(ray, side, near, far)
                    : this.bvh.raycast(ray, side, near, far);
            },
            firstHitOnly ? null : []
        );
    }

    // English comment.

    /**
     * English comment.
     */
    closestPointToPoint(point, options = {}) {
        if (!this._checkBVH()) {
            return null;
        }

        const { minThreshold = 0, maxThreshold = Infinity } = options;

        return this._executeQuery('closestPointToPoint', () => {
            const target = {};
            return this.bvh.closestPointToPoint(point, target, minThreshold, maxThreshold);
        });
    }

    /**
     * English comment.
     */
    closestPointToGeometry(geometry, geometryToBvh, options = {}) {
        if (!this._checkBVH()) {
            return null;
        }

        const { minThreshold = 0, maxThreshold = Infinity } = options;

        return this._executeQuery('closestPointToGeometry', () => {
            const target1 = {};
            const target2 = {};
            this.bvh.closestPointToGeometry(
                geometry,
                geometryToBvh,
                target1,
                target2,
                minThreshold,
                maxThreshold
            );
            return { target1, target2 };
        });
    }

    // English comment.

    /**
     * English comment.
     */
    intersectsSphere(sphere) {
        if (!this._checkBVH()) {
            return false;
        }

        return this._executeQuery(
            'intersectsSphere',
            () => {
                return this.bvh.intersectsSphere(sphere);
            },
            false
        );
    }

    /**
     * English comment.
     */
    intersectsBox(box, boxToBvh = null) {
        if (!this._checkBVH()) {
            return false;
        }

        return this._executeQuery(
            'intersectsBox',
            () => {
                return this.bvh.intersectsBox(box, boxToBvh);
            },
            false
        );
    }

    /**
     * English comment.
     */
    intersectsGeometry(geometry, geometryToBvh) {
        if (!this._checkBVH()) {
            return false;
        }

        return this._executeQuery(
            'intersectsGeometry',
            () => {
                return this.bvh.intersectsGeometry(geometry, geometryToBvh);
            },
            false
        );
    }

    // English comment.

    /**
     * English comment.
     */
    shapecast(callbacks) {
        if (!this._checkBVH()) {
            return null;
        }

        return this._executeQuery('shapecast', () => {
            return this.bvh.shapecast(callbacks);
        });
    }

    // English comment.

    /**
     * English comment.
     */
    distanceToPoint(point) {
        const result = this.closestPointToPoint(point);
        return result ? result.distance : Infinity;
    }

    /**
     * English comment.
     */
    distanceToGeometry(geometry, geometryToBvh) {
        const result = this.closestPointToGeometry(geometry, geometryToBvh);
        return result && result.target1 ? result.target1.distance : Infinity;
    }

    // English comment.

    /**
     * English comment.
     */
    createHelper() {
        if (!this.bvh) {
            console.warn('BVHQuery: BVH not generated yet');
            return null;
        }

        if (this.helper) {
            this.remove(this.helper);
            this.helper.dispose();
        }

        const options = this.config.helperOptions;

        this.helper = new MeshBVHHelper(this.targetMesh || this.bvh, options.depth);
        this.helper.color.set(options.color);
        this.helper.opacity = options.opacity;
        this.helper.displayEdges = options.displayEdges;
        this.helper.update();

        this.add(this.helper);

        return this.helper;
    }

    /**
     * English comment.
     */
    updateHelper(options = {}) {
        if (!this.helper) {
            return;
        }

        if (options.depth !== undefined) {
            this.helper.depth = options.depth;
        }
        if (options.color !== undefined) {
            this.helper.color.set(options.color);
        }
        if (options.opacity !== undefined) {
            this.helper.opacity = options.opacity;
        }
        if (options.displayEdges !== undefined) {
            this.helper.displayEdges = options.displayEdges;
        }

        this.helper.update();
    }

    /**
     * English comment.
     */
    toggleHelper(visible = null) {
        if (!this.helper) {
            if (visible !== false) {
                this.createHelper();
            }
            return;
        }

        if (visible === null) {
            this.helper.visible = !this.helper.visible;
        } else {
            this.helper.visible = visible;
        }
    }

    /**
     * English comment.
     */
    getStats() {
        if (!this.bvh) {
            return null;
        }

        // English comment.
        let nodeCount = 0;
        let leafNodeCount = 0;

        this.bvh.shapecast({
            intersectsBounds: (box, isLeaf) => {
                nodeCount++;
                if (isLeaf) {
                    leafNodeCount++;
                }
                return INTERSECTED;
            }
        });

        return {
            nodeCount,
            leafNodeCount,
            triangleCount: this.targetGeometry.index
                ? this.targetGeometry.index.count / 3
                : this.targetGeometry.attributes.position.count / 3,
            ...this.stats
        };
    }

    /**
     * English comment.
     */
    _updateStats(queryTime) {
        this.stats.lastQueryTime = queryTime;
        this.stats.totalQueries++;
        this.stats.averageQueryTime =
            (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + queryTime) /
            this.stats.totalQueries;
    }

    // English comment.

    /**
     * English comment.
     */
    _checkBVH() {
        if (!this.bvh) {
            console.warn('BVHQuery: BVH not generated yet');
            return false;
        }
        return true;
    }

    /**
     * English comment.
     */
    _executeQuery(queryType, queryFn, defaultValue = null) {
        const startTime = Date.now();

        try {
            const result = queryFn();
            const queryTime = Date.now() - startTime;

            this._updateStats(queryTime);

            this.emit('queryComplete', {
                type: queryType,
                result,
                queryTime
            });

            return result;
        } catch (error) {
            console.error(`BVHQuery: ${queryType} failed`, error);
            this.emit('error', { type: queryType, error });
            return defaultValue;
        }
    }

    /**
     * English comment.
     */
    onDestroy() {
        // English comment.
        if (this.bvh) {
            this.bvh = null;
        }

        // English comment.
        if (this.helper) {
            this.remove(this.helper);
            this.helper.dispose();
            this.helper = null;
        }

        // English comment.
        if (this.targetGeometry && this.targetGeometry.boundsTree) {
            this.targetGeometry.boundsTree = null;
        }
    }
}
