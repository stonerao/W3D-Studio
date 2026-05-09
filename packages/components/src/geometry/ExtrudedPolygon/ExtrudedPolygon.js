import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class ExtrudedPolygon extends Component {
    static defaultConfig = {
        // English comment.
        points: [], // English comment.

        // English comment.
        height: 10,

        // English comment.
        side: {
            // English comment.
            textureUrl: null, // English comment.
            textureRepeat: [1, 1], // English comment.

            // English comment.
            useGradient: true, // English comment.
            bottomColor: 0x00ff00, // English comment.
            topColor: 0x0000ff // English comment.
        },

        // English comment.
        face: {
            // English comment.
            textureUrl: null, // English comment.
            textureRepeat: [1, 1], // English comment.

            // English comment.
            useGradient: false, // English comment.
            bottomColor: 0xff0000, // English comment.
            topColor: 0xffff00, // English comment.
            gradientAngle: 0 // English comment.
        },

        // English comment.
        material: {
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1.0,
            wireframe: false
        },

        // English comment.
        extrudeSettings: {
            depth: 10, // English comment.
            bevelEnabled: false, // English comment.
            bevelThickness: 0,
            bevelSize: 0,
            bevelSegments: 1
        },

        // English comment.
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    };

    constructor(scene, config = {}) {
        super(scene, config);

        // English comment.
        this.geometry = null;
        this.materials = []; // English comment.
        this.mesh = null;

        // English comment.
        this.textureLoader = new THREE.TextureLoader();

        // English comment.
        this.sideTexture = null; // English comment.
        this.faceTexture = null; // English comment.

        // English comment.
        this.normalizedPoints = null;
        this.sideVertexCount = 0; // English comment.
        this.bottomVertexOffset = 0; // English comment.
        this.topVertexOffset = 0; // English comment.
    }

    /**
     * English comment.
     */
    async onMounted() {
        // English comment.
        if (!this.config.points || this.config.points.length < 3) {
            console.error('ExtrudedPolygon: At least 3 points are required');
            return;
        }

        // English comment.
        await this.createExtrudedPolygon();

        // English comment.
        this.applyTransform();
    }

    /**
     * English comment.
     */
    async createExtrudedPolygon() {
        // English comment.
        this.geometry = this.createGeometry();

        // English comment.
        await this.createMaterials();

        // English comment.
        this.mesh = new THREE.Mesh(this.geometry, this.materials);
        this.add(this.mesh);

        // English comment.
        if (this.config.side.useGradient || this.config.face.useGradient) {
            this.applyGradient();
        }
    }

    /**
     * English comment.
     */
    createGeometry() {
        const points = this.config.points;
        const height = this.config.height;

        // English comment.
        this.normalizedPoints = this.normalizePoints(points);

        // English comment.
        const shape = new THREE.Shape();
        shape.moveTo(this.normalizedPoints[0].x, this.normalizedPoints[0].z);
        for (let i = 1; i < this.normalizedPoints.length; i++) {
            shape.lineTo(this.normalizedPoints[i].x, this.normalizedPoints[i].z);
        }

        // English comment.
        const shapeGeometry = new THREE.ShapeGeometry(shape);

        // English comment.
        const shapePositions = shapeGeometry.attributes.position.array;
        const shapeIndices = shapeGeometry.index ? shapeGeometry.index.array : null;

        // English comment.
        const geometryData = this.buildExtrudedGeometry(
            this.normalizedPoints,
            shapePositions,
            shapeIndices,
            height
        );

        // English comment.
        this.sideVertexCount = this.normalizedPoints.length * 4;
        this.bottomVertexOffset = this.sideVertexCount;
        const bottomFaceVertexCount = shapePositions.length / 3;
        this.topVertexOffset = this.bottomVertexOffset + bottomFaceVertexCount;

        // English comment.
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(geometryData.positions, 3)
        );
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometryData.uvs, 2));
        geometry.setIndex(geometryData.indices);

        // English comment.
        geometry.addGroup(0, geometryData.sideIndicesCount, 0); // English comment.
        geometry.addGroup(
            geometryData.sideIndicesCount,
            geometryData.faceIndicesCount,
            1
        ); // English comment.

        // English comment.
        shapeGeometry.dispose();

        return geometry;
    }

    /**
     * English comment.
     */
    normalizePoints(points) {
        const normalized = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (point.length === 2) {
                // English comment.
                normalized.push({ x: point[0], z: point[1] });
            } else {
                // English comment.
                normalized.push({ x: point[0], z: point[2] || 0 });
            }
        }
        return normalized;
    }

    /**
     * English comment.
     */
    buildExtrudedGeometry(normalizedPoints, shapePositions, shapeIndices, height) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // English comment.
        const bounds = this.calculateBounds(normalizedPoints);

        // English comment.
        const perimeter = this.calculatePerimeter(normalizedPoints);

        let vertexOffset = 0;

        // English comment.
        const sideData = this.buildSideFaces(normalizedPoints, height, perimeter);
        positions.push(...sideData.positions);
        normals.push(...sideData.normals);
        uvs.push(...sideData.uvs);
        indices.push(...sideData.indices);
        vertexOffset += sideData.vertexCount;

        const sideIndicesCount = sideData.indices.length;

        // English comment.
        const bottomData = this.buildBottomFace(shapePositions, shapeIndices, bounds);
        positions.push(...bottomData.positions);
        normals.push(...bottomData.normals);
        uvs.push(...bottomData.uvs);
        // English comment.
        const bottomIndices = bottomData.indices.map((idx) => idx + vertexOffset);
        indices.push(...bottomIndices);
        vertexOffset += bottomData.vertexCount;

        // English comment.
        const topData = this.buildTopFace(shapePositions, shapeIndices, bounds, height);
        positions.push(...topData.positions);
        normals.push(...topData.normals);
        uvs.push(...topData.uvs);
        // English comment.
        const topIndices = topData.indices.map((idx) => idx + vertexOffset);
        indices.push(...topIndices);

        const faceIndicesCount = bottomIndices.length + topIndices.length;

        return {
            positions,
            normals,
            uvs,
            indices,
            sideIndicesCount,
            faceIndicesCount
        };
    }

    /**
     * English comment.
     */
    calculateBounds(points) {
        let minX = Infinity,
            maxX = -Infinity;
        let minZ = Infinity,
            maxZ = -Infinity;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        }

        return {
            minX,
            maxX,
            minZ,
            maxZ,
            width: maxX - minX,
            height: maxZ - minZ
        };
    }

    /**
     * English comment.
     */
    calculatePerimeter(points) {
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const dx = p2.x - p1.x;
            const dz = p2.z - p1.z;
            perimeter += Math.sqrt(dx * dx + dz * dz);
        }
        return perimeter;
    }

    /**
     * English comment.
     */
    buildSideFaces(points, height, perimeter) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let accumulatedLength = 0;

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            // English comment.
            const dx = p2.x - p1.x;
            const dz = p2.z - p1.z;
            const edgeLength = Math.sqrt(dx * dx + dz * dz);

            // English comment.
            const nx = -dz / edgeLength;
            const nz = dx / edgeLength;

            // English comment.
            const u1 = accumulatedLength / perimeter;
            const u2 = (accumulatedLength + edgeLength) / perimeter;

            // English comment.
            const baseIndex = i * 4;

            // English comment.
            positions.push(p1.x, 0, p1.z);
            normals.push(nx, 0, nz);
            uvs.push(u1, 0.0);

            // English comment.
            positions.push(p2.x, 0, p2.z);
            normals.push(nx, 0, nz);
            uvs.push(u2, 0.0);

            // English comment.
            positions.push(p2.x, height, p2.z);
            normals.push(nx, 0, nz);
            uvs.push(u2, 1.0);

            // English comment.
            positions.push(p1.x, height, p1.z);
            normals.push(nx, 0, nz);
            uvs.push(u1, 1.0);

            // English comment.
            indices.push(baseIndex + 0, baseIndex + 1, baseIndex + 2);
            indices.push(baseIndex + 0, baseIndex + 2, baseIndex + 3);

            accumulatedLength += edgeLength;
        }

        return {
            positions,
            normals,
            uvs,
            indices,
            vertexCount: points.length * 4
        };
    }

    /**
     * English comment.
     */
    buildBottomFace(shapePositions, shapeIndices, bounds) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // English comment.
        const vertexCount = shapePositions.length / 3;
        for (let i = 0; i < vertexCount; i++) {
            const x = shapePositions[i * 3];
            const z = shapePositions[i * 3 + 1]; // English comment.

            // English comment.
            positions.push(x, 0, z);

            // English comment.
            normals.push(0, -1, 0);

            // English comment.
            const u = bounds.width > 0 ? (x - bounds.minX) / bounds.width : 0.5;
            const v = bounds.height > 0 ? (z - bounds.minZ) / bounds.height : 0.5;
            uvs.push(u, v);
        }

        // English comment.
        if (shapeIndices) {
            for (let i = 0; i < shapeIndices.length; i += 3) {
                indices.push(shapeIndices[i + 2], shapeIndices[i + 1], shapeIndices[i + 0]);
            }
        } else {
            // English comment.
            for (let i = 0; i < vertexCount; i += 3) {
                indices.push(i + 2, i + 1, i + 0);
            }
        }

        return {
            positions,
            normals,
            uvs,
            indices,
            vertexCount
        };
    }

    /**
     * English comment.
     */
    buildTopFace(shapePositions, shapeIndices, bounds, height) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // English comment.
        const vertexCount = shapePositions.length / 3;
        for (let i = 0; i < vertexCount; i++) {
            const x = shapePositions[i * 3];
            const z = shapePositions[i * 3 + 1];

            // English comment.
            positions.push(x, height, z);

            // English comment.
            normals.push(0, 1, 0);

            // English comment.
            const u = bounds.width > 0 ? (x - bounds.minX) / bounds.width : 0.5;
            const v = bounds.height > 0 ? (z - bounds.minZ) / bounds.height : 0.5;
            uvs.push(u, v);
        }

        // English comment.
        if (shapeIndices) {
            indices.push(...shapeIndices);
        } else {
            for (let i = 0; i < vertexCount; i++) {
                indices.push(i);
            }
        }

        return {
            positions,
            normals,
            uvs,
            indices,
            vertexCount
        };
    }

    /**
     * English comment.
     */
    async createMaterials() {
        const materialConfig = this.config.material;
        const sideConfig = this.config.side;
        const faceConfig = this.config.face;

        // English comment.
        let sideMaterial;

        if (sideConfig.textureUrl) {
            // English comment.
            try {
                this.sideTexture = await this.loadTexture(sideConfig.textureUrl);
                this.sideTexture.wrapS = THREE.RepeatWrapping;
                this.sideTexture.wrapT = THREE.RepeatWrapping;
                this.sideTexture.repeat.set(
                    sideConfig.textureRepeat[0],
                    sideConfig.textureRepeat[1]
                );

                sideMaterial = new THREE.MeshStandardMaterial({
                    map: this.sideTexture,
                    side: materialConfig.side,
                    transparent: materialConfig.transparent,
                    opacity: materialConfig.opacity,
                    wireframe: materialConfig.wireframe,
                    vertexColors: false // English comment.
                });
            } catch (error) {
                console.warn(
                    'ExtrudedPolygon: Failed to load side texture, using gradient instead'
                );
                // English comment.
                sideMaterial = new THREE.MeshStandardMaterial({
                    color: sideConfig.useGradient ? 0xffffff : sideConfig.bottomColor,
                    side: materialConfig.side,
                    transparent: materialConfig.transparent,
                    opacity: materialConfig.opacity,
                    wireframe: materialConfig.wireframe,
                    vertexColors: sideConfig.useGradient
                });
            }
        } else {
            // English comment.
            sideMaterial = new THREE.MeshStandardMaterial({
                color: sideConfig.useGradient ? 0xffffff : sideConfig.bottomColor,
                side: materialConfig.side,
                transparent: materialConfig.transparent,
                opacity: materialConfig.opacity,
                wireframe: materialConfig.wireframe,
                vertexColors: sideConfig.useGradient // English comment.
            });
        }

        // English comment.
        let faceMaterial;

        if (faceConfig.textureUrl) {
            // English comment.
            try {
                this.faceTexture = await this.loadTexture(faceConfig.textureUrl);
                this.faceTexture.wrapS = THREE.RepeatWrapping;
                this.faceTexture.wrapT = THREE.RepeatWrapping;
                this.faceTexture.repeat.set(
                    faceConfig.textureRepeat[0],
                    faceConfig.textureRepeat[1]
                );

                faceMaterial = new THREE.MeshStandardMaterial({
                    map: this.faceTexture,
                    side: materialConfig.side,
                    transparent: materialConfig.transparent,
                    opacity: materialConfig.opacity,
                    wireframe: materialConfig.wireframe,
                    vertexColors: false // English comment.
                });
            } catch (error) {
                console.warn('ExtrudedPolygon: Failed to load face texture, using color instead');
                // English comment.
                faceMaterial = new THREE.MeshStandardMaterial({
                    color: faceConfig.useGradient ? 0xffffff : faceConfig.bottomColor,
                    side: materialConfig.side,
                    transparent: materialConfig.transparent,
                    opacity: materialConfig.opacity,
                    wireframe: materialConfig.wireframe,
                    vertexColors: faceConfig.useGradient
                });
            }
        } else {
            // English comment.
            faceMaterial = new THREE.MeshStandardMaterial({
                color: faceConfig.useGradient ? 0xffffff : faceConfig.bottomColor,
                side: materialConfig.side,
                transparent: materialConfig.transparent,
                opacity: materialConfig.opacity,
                wireframe: materialConfig.wireframe,
                vertexColors: faceConfig.useGradient // English comment.
            });
        }

        // English comment.
        // English comment.
        this.materials = [sideMaterial, faceMaterial];
    }

    /**
     * English comment.
     */
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load texture: ${url}`, error);
                    reject(error);
                }
            );
        });
    }

    /**
     * English comment.
     */
    applyGradient() {
        if (!this.geometry) return;

        const positionAttribute = this.geometry.attributes.position;
        const colors = [];

        // English comment.
        let minX = Infinity,
            maxX = -Infinity;
        let minY = Infinity,
            maxY = -Infinity;
        let minZ = Infinity,
            maxZ = -Infinity;

        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);
            const z = positionAttribute.getZ(i);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }

        const rangeY = maxY - minY;
        const rangeX = maxX - minX;
        const rangeZ = maxZ - minZ;

        // English comment.
        const sideBottomColor = new THREE.Color(this.config.side.bottomColor);
        const sideTopColor = new THREE.Color(this.config.side.topColor);

        // English comment.
        const faceBottomColor = new THREE.Color(this.config.face.bottomColor);
        const faceTopColor = new THREE.Color(this.config.face.topColor);

        // English comment.
        const angleRad = (this.config.face.gradientAngle * Math.PI) / 180;

        // English comment.
        const epsilon = 0.001;
        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);
            const z = positionAttribute.getZ(i);

            let color;

            // English comment.
            const isBottomFace = Math.abs(y - minY) < epsilon;
            const isTopFace = Math.abs(y - maxY) < epsilon;
            const isFace = isBottomFace || isTopFace;

            if (isFace && this.config.face.useGradient) {
                // English comment.
                // English comment.
                const normX = rangeX > 0 ? (x - minX) / rangeX : 0.5;
                const normZ = rangeZ > 0 ? (z - minZ) / rangeZ : 0.5;

                // English comment.
                // English comment.
                const t = Math.cos(angleRad) * normZ + Math.sin(angleRad) * normX;

                // English comment.
                const clampedT = Math.max(0, Math.min(1, t));

                color = new THREE.Color().lerpColors(faceBottomColor, faceTopColor, clampedT);
            } else if (!isFace && this.config.side.useGradient) {
                // English comment.
                const t = rangeY > 0 ? (y - minY) / rangeY : 0;
                color = new THREE.Color().lerpColors(sideBottomColor, sideTopColor, t);
            } else {
                // English comment.
                if (isFace) {
                    color = new THREE.Color(this.config.face.bottomColor);
                } else {
                    color = new THREE.Color(this.config.side.bottomColor);
                }
            }

            colors.push(color.r, color.g, color.b);
        }

        // English comment.
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    /**
     * English comment.
     */
    applyTransform() {
        if (!this.mesh) return;

        // English comment.
        if (this.config.position) {
            this.position.set(...this.config.position);
        }

        // English comment.
        if (this.config.rotation) {
            this.rotation.set(...this.config.rotation);
        }

        // English comment.
        if (this.config.scale) {
            this.scale.set(...this.config.scale);
        }
    }

    /**
     * English comment.
     */
    updateHeight(newHeight) {
        if (!this.geometry || !this.normalizedPoints) {
            // English comment.
            this.config.height = newHeight;
            return;
        }

        // English comment.
        this.config.height = newHeight;

        const positions = this.geometry.attributes.position.array;

        // English comment.
        for (let i = 0; i < this.normalizedPoints.length; i++) {
            // English comment.
            const baseIndex = i * 4;

            // English comment.
            const topRightIndex = (baseIndex + 2) * 3;
            positions[topRightIndex + 1] = newHeight; // English comment.

            // English comment.
            const topLeftIndex = (baseIndex + 3) * 3;
            positions[topLeftIndex + 1] = newHeight; // English comment.
        }

        // English comment.
        // English comment.
        const topFaceVertexCount = this.geometry.attributes.position.count - this.topVertexOffset;
        for (let i = 0; i < topFaceVertexCount; i++) {
            const vertexIndex = (this.topVertexOffset + i) * 3;
            positions[vertexIndex + 1] = newHeight; // English comment.
        }

        // English comment.
        this.geometry.attributes.position.needsUpdate = true;

        // English comment.
        if (this.config.side.useGradient || this.config.face.useGradient) {
            this.applyGradient();
        }
    }

    /**
     * English comment.
     */
    async updateConfig(newConfig) {
        // English comment.
        const isOnlyHeightUpdate =
            newConfig.height !== undefined &&
            Object.keys(newConfig).length === 1 &&
            this.geometry &&
            this.normalizedPoints;

        if (isOnlyHeightUpdate) {
            // English comment.
            this.updateHeight(newConfig.height);
            return;
        }

        // English comment.
        if (newConfig.side) {
            this.config.side = { ...this.config.side, ...newConfig.side };
        }
        if (newConfig.face) {
            this.config.face = { ...this.config.face, ...newConfig.face };
        }
        if (newConfig.material) {
            this.config.material = { ...this.config.material, ...newConfig.material };
        }

        // English comment.
        this.config = { ...this.config, ...newConfig };

        // English comment.
        if (this.mesh) {
            this.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.materials.forEach((mat) => mat.dispose());
        }

        // English comment.
        if (this.sideTexture) {
            this.sideTexture.dispose();
            this.sideTexture = null;
        }
        if (this.faceTexture) {
            this.faceTexture.dispose();
            this.faceTexture = null;
        }

        // English comment.
        await this.createExtrudedPolygon();
        this.applyTransform();
    }

    /**
     * English comment.
     */
    onDestroy() {
        // English comment.
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        // English comment.
        this.materials.forEach((material) => {
            if (material.map) {
                material.map.dispose();
            }
            material.dispose();
        });
        this.materials = [];

        // English comment.
        if (this.sideTexture) {
            this.sideTexture.dispose();
            this.sideTexture = null;
        }
        if (this.faceTexture) {
            this.faceTexture.dispose();
            this.faceTexture = null;
        }

        // English comment.
        if (this.mesh) {
            this.remove(this.mesh);
            this.mesh = null;
        }
    }
}
