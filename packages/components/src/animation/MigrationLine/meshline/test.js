/**
 * English comment.
 */

import * as THREE from 'three';
import { MeshLineGeometry, MeshLineMaterial, MeshLineRaycast } from './index.js';

export function runMeshLineTest(scene) {
    console.log('=== MeshLine 适配测试开始 ===');

    // English comment.
    console.log('[Test 1] MeshLineGeometry 构造...');
    const geometry = new MeshLineGeometry();
    console.assert(geometry.isMeshLine === true, 'isMeshLine 应为 true');
    console.assert(geometry.type === 'MeshLine', 'type 应为 MeshLine');
    console.log('  ✓ 构造成功');

    // English comment.
    console.log('[Test 2] setPoints (Vector3[])...');
    const points = [];
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        points.push(new THREE.Vector3(
            Math.cos(t * Math.PI * 2) * 10,
            Math.sin(t * Math.PI * 4) * 2,
            Math.sin(t * Math.PI * 2) * 10
        ));
    }
    geometry.setPoints(points);
    console.assert(geometry.getAttribute('position') !== null, 'position attribute 应存在');
    console.assert(geometry.getAttribute('previous') !== null, 'previous attribute 应存在');
    console.assert(geometry.getAttribute('next') !== null, 'next attribute 应存在');
    console.assert(geometry.getAttribute('side') !== null, 'side attribute 应存在');
    console.assert(geometry.getAttribute('width') !== null, 'width attribute 应存在');
    console.assert(geometry.getAttribute('uv') !== null, 'uv attribute 应存在');
    console.assert(geometry.getAttribute('counters') !== null, 'counters attribute 应存在');
    console.assert(geometry.index !== null, 'index 应存在');
    console.log(`  ✓ 顶点数: ${geometry.getAttribute('position').count}`);
    console.log(`  ✓ 索引数: ${geometry.index.count}`);

    // English comment.
    console.log('[Test 3] setPoints 带 widthCallback...');
    const geometry2 = new MeshLineGeometry();
    geometry2.setPoints(points, (p) => 1 - p); // English comment.
    const widthAttr = geometry2.getAttribute('width');
    console.assert(widthAttr.array[0] === 1, '首端宽度应为 1');
    console.assert(widthAttr.array[widthAttr.count - 1] < 0.02, '末端宽度应接近 0');
    console.log('  ✓ 宽度回调工作正常');

    // English comment.
    console.log('[Test 4] MeshLineMaterial 构造...');
    const material = new MeshLineMaterial({
        color: new THREE.Color(0x00ff00),
        lineWidth: 2,
        resolution: new THREE.Vector2(1920, 1080),
        dashArray: 0.1,
        dashRatio: 0.5,
        transparent: true,
        depthTest: true,
    });
    console.assert(material.isMeshLineMaterial === true, 'isMeshLineMaterial 应为 true');
    console.assert(material.lineWidth === 2, 'lineWidth 应为 2');
    console.assert(material.dashArray === 0.1, 'dashArray 应为 0.1');
    console.assert(material.uniforms.useDash.value === 1, 'useDash 应自动设为 1');
    console.assert(material.fog === true, 'fog 应为 true');
    console.log('  ✓ 材质创建成功');

    // English comment.
    console.log('[Test 5] 创建 THREE.Mesh...');
    const mesh = new THREE.Mesh(geometry, material);
    mesh.raycast = MeshLineRaycast;
    console.assert(mesh.isMesh === true, '应为 Mesh 实例');
    console.log('  ✓ Mesh 创建成功');

    if (scene) {
        scene.add(mesh);
        console.log('  ✓ 已添加到场景');
    }

    // English comment.
    console.log('[Test 6] dashOffset 动画驱动...');
    const initial = material.dashOffset;
    material.dashOffset = initial - 0.01;
    console.assert(material.dashOffset === initial - 0.01, 'dashOffset 应可动态更新');
    console.log('  ✓ dashOffset 动画驱动正常');

    // English comment.
    console.log('[Test 7] advance 方法...');
    const geometry3 = new MeshLineGeometry();
    const trailPoints = [];
    for (let i = 0; i < 50; i++) {
        trailPoints.push(new THREE.Vector3(i, 0, 0));
    }
    geometry3.setPoints(trailPoints);
    const posBefore = geometry3.getAttribute('position').array.slice(-6);
    geometry3.advance(new THREE.Vector3(50, 1, 0));
    const posAfter = geometry3.getAttribute('position').array.slice(-6);
    console.assert(posAfter[0] === 50, 'advance 后末尾 x 应为 50');
    console.assert(posAfter[1] === 1, 'advance 后末尾 y 应为 1');
    console.log('  ✓ advance 方法正常');

    // English comment.
    console.log('[Test 8] 纹理贴图设置...');
    const texMaterial = new MeshLineMaterial({
        lineWidth: 3,
        useMap: 1,
        map: null, // English comment.
        repeat: new THREE.Vector2(4, 1),
        resolution: new THREE.Vector2(1920, 1080),
    });
    console.assert(texMaterial.useMap === 1, 'useMap 应为 1');
    console.assert(texMaterial.repeat.x === 4, 'repeat.x 应为 4');
    console.log('  ✓ 纹理参数设置正常');

    console.log('=== MeshLine 适配测试全部通过 ===');

    return { geometry, material, mesh };
}
