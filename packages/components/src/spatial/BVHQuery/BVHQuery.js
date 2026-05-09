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

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

/**
 * Spatial module component that builds BVH acceleration data for fast raycasting and spatial queries.
 */
export class BVHQuery extends Component {
    static defaultConfig = {
        mesh: null,
        geometry: null,

        bvhOptions: {
            strategy: 'SAH', // 'CENTER' | 'AVERAGE' | 'SAH'
            maxDepth: 40,
            maxLeafTris: 10,
            verbose: false,
            setBoundingBox: true
        },

        async: false,

        autoUpdate: false,

        showHelper: false,
        helperOptions: {
            depth: 10,
            color: 0x00ff88,
            opacity: 0.3,
            displayEdges: true
        }
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.bvh = null;

        this.targetMesh = null;

        this.targetGeometry = null;

        this.helper = null;

        this.stats = {
            lastQueryTime: 0,
            totalQueries: 0,
            averageQueryTime: 0
        };
    }

    async onMounted() {
        if (!this._initializeGeometry()) {
            return;
        }

        if (!this._validateGeometry()) {
            return;
        }

        await this.generateBVH();

        if (this.config.showHelper) {
            this.createHelper();
        }
    }

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


    async generateBVH() {
        const startTime = Date.now();

        try {
            if (this.config.async) {
                console.warn(
                    'BVHQuery: Async generation not implemented yet, using sync generation'
                );
            }

            this.bvh = new MeshBVH(this.targetGeometry, this.config.bvhOptions);

            this.targetGeometry.boundsTree = this.bvh;

            const buildTime = Date.now() - startTime;

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

    async rebuild(options = null) {
        if (this.bvh) {
            this.bvh = null;
            this.targetGeometry.boundsTree = null;
        }

        if (options) {
            this.config.bvhOptions = { ...this.config.bvhOptions, ...options };
        }

        await this.generateBVH();
    }


    raycast(ray, options = {}) {
        if (!this._checkBVH()) {
            return options.firstHitOnly ? null : [];
        }

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


    shapecast(callbacks) {
        if (!this._checkBVH()) {
            return null;
        }

        return this._executeQuery('shapecast', () => {
            return this.bvh.shapecast(callbacks);
        });
    }


    distanceToPoint(point) {
        const result = this.closestPointToPoint(point);
        return result ? result.distance : Infinity;
    }

    distanceToGeometry(geometry, geometryToBvh) {
        const result = this.closestPointToGeometry(geometry, geometryToBvh);
        return result && result.target1 ? result.target1.distance : Infinity;
    }


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

    getStats() {
        if (!this.bvh) {
            return null;
        }

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

    _updateStats(queryTime) {
        this.stats.lastQueryTime = queryTime;
        this.stats.totalQueries++;
        this.stats.averageQueryTime =
            (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + queryTime) /
            this.stats.totalQueries;
    }


    _checkBVH() {
        if (!this.bvh) {
            console.warn('BVHQuery: BVH not generated yet');
            return false;
        }
        return true;
    }

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

    onDestroy() {
        if (this.bvh) {
            this.bvh = null;
        }

        if (this.helper) {
            this.remove(this.helper);
            this.helper.dispose();
            this.helper = null;
        }

        if (this.targetGeometry && this.targetGeometry.boundsTree) {
            this.targetGeometry.boundsTree = null;
        }
    }
}
