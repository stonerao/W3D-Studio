import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Geometry module component that creates extruded polygon meshes with configurable side and face materials.
 */
export class ExtrudedPolygon extends Component {
    static defaultConfig = {
        points: [],

        height: 10,

        side: {
            textureUrl: null,
            textureRepeat: [1, 1],

            useGradient: true,
            bottomColor: 0x00ff00,
            topColor: 0x0000ff
        },

        face: {
            textureUrl: null,
            textureRepeat: [1, 1],

            useGradient: false,
            bottomColor: 0xff0000,
            topColor: 0xffff00,
            gradientAngle: 0
        },

        material: {
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1.0,
            wireframe: false
        },

        extrudeSettings: {
            depth: 10,
            bevelEnabled: false,
            bevelThickness: 0,
            bevelSize: 0,
            bevelSegments: 1
        },

        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    };

    constructor(scene, config = {}) {
        super(scene, config);

        this.geometry = null;
        this.materials = [];
        this.mesh = null;

        this.textureLoader = new THREE.TextureLoader();

        this.sideTexture = null;
        this.faceTexture = null;

        this.normalizedPoints = null;
        this.sideVertexCount = 0;
        this.bottomVertexOffset = 0;
        this.topVertexOffset = 0;
    }

    async onMounted() {
        if (!this.config.points || this.config.points.length < 3) {
            console.error('ExtrudedPolygon: At least 3 points are required');
            return;
        }

        await this.createExtrudedPolygon();

        this.applyTransform();
    }

    async createExtrudedPolygon() {
        this.geometry = this.createGeometry();

        await this.createMaterials();

        this.mesh = new THREE.Mesh(this.geometry, this.materials);
        this.add(this.mesh);

        if (this.config.side.useGradient || this.config.face.useGradient) {
            this.applyGradient();
        }
    }

    createGeometry() {
        const points = this.config.points;
        const height = this.config.height;

        this.normalizedPoints = this.normalizePoints(points);

        const shape = new THREE.Shape();
        shape.moveTo(this.normalizedPoints[0].x, this.normalizedPoints[0].z);
        for (let i = 1; i < this.normalizedPoints.length; i++) {
            shape.lineTo(this.normalizedPoints[i].x, this.normalizedPoints[i].z);
        }

        const shapeGeometry = new THREE.ShapeGeometry(shape);

        const shapePositions = shapeGeometry.attributes.position.array;
        const shapeIndices = shapeGeometry.index ? shapeGeometry.index.array : null;

        const geometryData = this.buildExtrudedGeometry(
            this.normalizedPoints,
            shapePositions,
            shapeIndices,
            height
        );

        this.sideVertexCount = this.normalizedPoints.length * 4;
        this.bottomVertexOffset = this.sideVertexCount;
        const bottomFaceVertexCount = shapePositions.length / 3;
        this.topVertexOffset = this.bottomVertexOffset + bottomFaceVertexCount;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(geometryData.positions, 3)
        );
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geometryData.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geometryData.uvs, 2));
        geometry.setIndex(geometryData.indices);

        geometry.addGroup(0, geometryData.sideIndicesCount, 0);
        geometry.addGroup(
            geometryData.sideIndicesCount,
            geometryData.faceIndicesCount,
            1
        );

        shapeGeometry.dispose();

        return geometry;
    }

    normalizePoints(points) {
        const normalized = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (point.length === 2) {
                normalized.push({ x: point[0], z: point[1] });
            } else {
                normalized.push({ x: point[0], z: point[2] || 0 });
            }
        }
        return normalized;
    }

    buildExtrudedGeometry(normalizedPoints, shapePositions, shapeIndices, height) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const bounds = this.calculateBounds(normalizedPoints);

        const perimeter = this.calculatePerimeter(normalizedPoints);

        let vertexOffset = 0;

        const sideData = this.buildSideFaces(normalizedPoints, height, perimeter);
        positions.push(...sideData.positions);
        normals.push(...sideData.normals);
        uvs.push(...sideData.uvs);
        indices.push(...sideData.indices);
        vertexOffset += sideData.vertexCount;

        const sideIndicesCount = sideData.indices.length;

        const bottomData = this.buildBottomFace(shapePositions, shapeIndices, bounds);
        positions.push(...bottomData.positions);
        normals.push(...bottomData.normals);
        uvs.push(...bottomData.uvs);
        const bottomIndices = bottomData.indices.map((idx) => idx + vertexOffset);
        indices.push(...bottomIndices);
        vertexOffset += bottomData.vertexCount;

        const topData = this.buildTopFace(shapePositions, shapeIndices, bounds, height);
        positions.push(...topData.positions);
        normals.push(...topData.normals);
        uvs.push(...topData.uvs);
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

    buildSideFaces(points, height, perimeter) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let accumulatedLength = 0;

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            const dx = p2.x - p1.x;
            const dz = p2.z - p1.z;
            const edgeLength = Math.sqrt(dx * dx + dz * dz);

            const nx = -dz / edgeLength;
            const nz = dx / edgeLength;

            const u1 = accumulatedLength / perimeter;
            const u2 = (accumulatedLength + edgeLength) / perimeter;

            const baseIndex = i * 4;

            positions.push(p1.x, 0, p1.z);
            normals.push(nx, 0, nz);
            uvs.push(u1, 0.0);

            positions.push(p2.x, 0, p2.z);
            normals.push(nx, 0, nz);
            uvs.push(u2, 0.0);

            positions.push(p2.x, height, p2.z);
            normals.push(nx, 0, nz);
            uvs.push(u2, 1.0);

            positions.push(p1.x, height, p1.z);
            normals.push(nx, 0, nz);
            uvs.push(u1, 1.0);

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

    buildBottomFace(shapePositions, shapeIndices, bounds) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const vertexCount = shapePositions.length / 3;
        for (let i = 0; i < vertexCount; i++) {
            const x = shapePositions[i * 3];
            const z = shapePositions[i * 3 + 1];

            positions.push(x, 0, z);

            normals.push(0, -1, 0);

            const u = bounds.width > 0 ? (x - bounds.minX) / bounds.width : 0.5;
            const v = bounds.height > 0 ? (z - bounds.minZ) / bounds.height : 0.5;
            uvs.push(u, v);
        }

        if (shapeIndices) {
            for (let i = 0; i < shapeIndices.length; i += 3) {
                indices.push(shapeIndices[i + 2], shapeIndices[i + 1], shapeIndices[i + 0]);
            }
        } else {
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

    buildTopFace(shapePositions, shapeIndices, bounds, height) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const vertexCount = shapePositions.length / 3;
        for (let i = 0; i < vertexCount; i++) {
            const x = shapePositions[i * 3];
            const z = shapePositions[i * 3 + 1];

            positions.push(x, height, z);

            normals.push(0, 1, 0);

            const u = bounds.width > 0 ? (x - bounds.minX) / bounds.width : 0.5;
            const v = bounds.height > 0 ? (z - bounds.minZ) / bounds.height : 0.5;
            uvs.push(u, v);
        }

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

    async createMaterials() {
        const materialConfig = this.config.material;
        const sideConfig = this.config.side;
        const faceConfig = this.config.face;

        let sideMaterial;

        if (sideConfig.textureUrl) {
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
                    vertexColors: false
                });
            } catch (error) {
                console.warn(
                    'ExtrudedPolygon: Failed to load side texture, using gradient instead'
                );
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
            sideMaterial = new THREE.MeshStandardMaterial({
                color: sideConfig.useGradient ? 0xffffff : sideConfig.bottomColor,
                side: materialConfig.side,
                transparent: materialConfig.transparent,
                opacity: materialConfig.opacity,
                wireframe: materialConfig.wireframe,
                vertexColors: sideConfig.useGradient
            });
        }

        let faceMaterial;

        if (faceConfig.textureUrl) {
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
                    vertexColors: false
                });
            } catch (error) {
                console.warn('ExtrudedPolygon: Failed to load face texture, using color instead');
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
            faceMaterial = new THREE.MeshStandardMaterial({
                color: faceConfig.useGradient ? 0xffffff : faceConfig.bottomColor,
                side: materialConfig.side,
                transparent: materialConfig.transparent,
                opacity: materialConfig.opacity,
                wireframe: materialConfig.wireframe,
                vertexColors: faceConfig.useGradient
            });
        }

        this.materials = [sideMaterial, faceMaterial];
    }

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

    applyGradient() {
        if (!this.geometry) return;

        const positionAttribute = this.geometry.attributes.position;
        const colors = [];

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

        const sideBottomColor = new THREE.Color(this.config.side.bottomColor);
        const sideTopColor = new THREE.Color(this.config.side.topColor);

        const faceBottomColor = new THREE.Color(this.config.face.bottomColor);
        const faceTopColor = new THREE.Color(this.config.face.topColor);

        const angleRad = (this.config.face.gradientAngle * Math.PI) / 180;

        const epsilon = 0.001;
        for (let i = 0; i < positionAttribute.count; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);
            const z = positionAttribute.getZ(i);

            let color;

            const isBottomFace = Math.abs(y - minY) < epsilon;
            const isTopFace = Math.abs(y - maxY) < epsilon;
            const isFace = isBottomFace || isTopFace;

            if (isFace && this.config.face.useGradient) {
                const normX = rangeX > 0 ? (x - minX) / rangeX : 0.5;
                const normZ = rangeZ > 0 ? (z - minZ) / rangeZ : 0.5;

                const t = Math.cos(angleRad) * normZ + Math.sin(angleRad) * normX;

                const clampedT = Math.max(0, Math.min(1, t));

                color = new THREE.Color().lerpColors(faceBottomColor, faceTopColor, clampedT);
            } else if (!isFace && this.config.side.useGradient) {
                const t = rangeY > 0 ? (y - minY) / rangeY : 0;
                color = new THREE.Color().lerpColors(sideBottomColor, sideTopColor, t);
            } else {
                if (isFace) {
                    color = new THREE.Color(this.config.face.bottomColor);
                } else {
                    color = new THREE.Color(this.config.side.bottomColor);
                }
            }

            colors.push(color.r, color.g, color.b);
        }

        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    applyTransform() {
        if (!this.mesh) return;

        if (this.config.position) {
            this.position.set(...this.config.position);
        }

        if (this.config.rotation) {
            this.rotation.set(...this.config.rotation);
        }

        if (this.config.scale) {
            this.scale.set(...this.config.scale);
        }
    }

    updateHeight(newHeight) {
        if (!this.geometry || !this.normalizedPoints) {
            this.config.height = newHeight;
            return;
        }

        this.config.height = newHeight;

        const positions = this.geometry.attributes.position.array;

        for (let i = 0; i < this.normalizedPoints.length; i++) {
            const baseIndex = i * 4;

            const topRightIndex = (baseIndex + 2) * 3;
            positions[topRightIndex + 1] = newHeight;

            const topLeftIndex = (baseIndex + 3) * 3;
            positions[topLeftIndex + 1] = newHeight;
        }

        const topFaceVertexCount = this.geometry.attributes.position.count - this.topVertexOffset;
        for (let i = 0; i < topFaceVertexCount; i++) {
            const vertexIndex = (this.topVertexOffset + i) * 3;
            positions[vertexIndex + 1] = newHeight;
        }

        this.geometry.attributes.position.needsUpdate = true;

        if (this.config.side.useGradient || this.config.face.useGradient) {
            this.applyGradient();
        }
    }

    async updateConfig(newConfig) {
        const isOnlyHeightUpdate =
            newConfig.height !== undefined &&
            Object.keys(newConfig).length === 1 &&
            this.geometry &&
            this.normalizedPoints;

        if (isOnlyHeightUpdate) {
            this.updateHeight(newConfig.height);
            return;
        }

        if (newConfig.side) {
            this.config.side = { ...this.config.side, ...newConfig.side };
        }
        if (newConfig.face) {
            this.config.face = { ...this.config.face, ...newConfig.face };
        }
        if (newConfig.material) {
            this.config.material = { ...this.config.material, ...newConfig.material };
        }

        this.config = { ...this.config, ...newConfig };

        if (this.mesh) {
            this.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.materials.forEach((mat) => mat.dispose());
        }

        if (this.sideTexture) {
            this.sideTexture.dispose();
            this.sideTexture = null;
        }
        if (this.faceTexture) {
            this.faceTexture.dispose();
            this.faceTexture = null;
        }

        await this.createExtrudedPolygon();
        this.applyTransform();
    }

    onDestroy() {
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        this.materials.forEach((material) => {
            if (material.map) {
                material.map.dispose();
            }
            material.dispose();
        });
        this.materials = [];

        if (this.sideTexture) {
            this.sideTexture.dispose();
            this.sideTexture = null;
        }
        if (this.faceTexture) {
            this.faceTexture.dispose();
            this.faceTexture = null;
        }

        if (this.mesh) {
            this.remove(this.mesh);
            this.mesh = null;
        }
    }
}
