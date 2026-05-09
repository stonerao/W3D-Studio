/**
 * MeshLineRaycast - 基于 THREE.MeshLine (MIT) 适配 Three.js 0.180
 *
 * 原始项目: https://github.com/spite/THREE.MeshLine
 * 原始作者: Jaume Sanchez Elias (MIT License)
 *
 * 为 MeshLine 构建的 Mesh 提供 raycast 支持。
 * 用法: mesh.raycast = MeshLineRaycast;
 */

import * as THREE from 'three';

export function MeshLineRaycast(raycaster, intersects) {
    const inverseMatrix = new THREE.Matrix4();
    const ray = new THREE.Ray();
    const sphere = new THREE.Sphere();
    const interRay = new THREE.Vector3();

    const geometry = this.geometry;

    // 先用 boundingSphere 快速排除
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    sphere.copy(geometry.boundingSphere);
    sphere.applyMatrix4(this.matrixWorld);

    if (raycaster.ray.intersectSphere(sphere, interRay) === false) {
        return;
    }

    inverseMatrix.copy(this.matrixWorld).invert();
    ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

    const vStart = new THREE.Vector3();
    const vEnd = new THREE.Vector3();
    const interSegment = new THREE.Vector3();
    const step = this instanceof THREE.LineSegments ? 2 : 1;
    const index = geometry.index;
    const attributes = geometry.attributes;

    if (index !== null) {
        const indices = index.array;
        const positions = attributes.position.array;
        const widths = attributes.width.array;

        for (let i = 0, l = indices.length - 1; i < l; i += step) {
            const a = indices[i];
            const b = indices[i + 1];

            vStart.fromArray(positions, a * 3);
            vEnd.fromArray(positions, b * 3);

            const w = widths[Math.floor(i / 3)] !== undefined ? widths[Math.floor(i / 3)] : 1;
            const lineThreshold = raycaster.params.Line ? raycaster.params.Line.threshold : 1;
            const precision = lineThreshold + (this.material.lineWidth * w) / 2;
            const precisionSq = precision * precision;

            const distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);

            if (distSq > precisionSq) continue;

            interRay.applyMatrix4(this.matrixWorld);

            const distance = raycaster.ray.origin.distanceTo(interRay);

            if (distance < raycaster.near || distance > raycaster.far) continue;

            intersects.push({
                distance: distance,
                point: interSegment.clone().applyMatrix4(this.matrixWorld),
                index: i,
                face: null,
                faceIndex: null,
                object: this,
            });

            // 只取第一个交点
            i = l;
        }
    }
}
