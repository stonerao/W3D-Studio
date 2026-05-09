/**
 * MeshLine 模块 - 适配 Three.js 0.180 的内联版本
 *
 * 基于 https://github.com/spite/THREE.MeshLine (MIT License)
 * 重构为 ES Module，移除对 THREE.ShaderChunk / THREE.UniformsLib 的依赖，
 * 着色器代码完全内联，兼容 Three.js 0.180 API。
 *
 * 用法:
 *   import { MeshLineGeometry, MeshLineMaterial, MeshLineRaycast } from './meshline';
 *
 *   const geometry = new MeshLineGeometry();
 *   geometry.setPoints(points);
 *
 *   const material = new MeshLineMaterial({
 *       color: new THREE.Color(0x00ff00),
 *       lineWidth: 2,
 *       resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
 *   });
 *
 *   const mesh = new THREE.Mesh(geometry, material);
 *   mesh.raycast = MeshLineRaycast;
 *   scene.add(mesh);
 */

export { MeshLineGeometry } from './MeshLineGeometry.js';
export { MeshLineMaterial } from './MeshLineMaterial.js';
export { MeshLineRaycast } from './MeshLineRaycast.js';
