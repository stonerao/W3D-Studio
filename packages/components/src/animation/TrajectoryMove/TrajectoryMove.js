import { Component } from '@w3d/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * TrajectoryMove 轨迹移动组件
 *
 * - points: [[x,y,z], ...] 或 [{x,y,z}, ...]
 * - assetType: 'model' | 'image'
 * - modelUrl / imageUrl: 资源路径
 * - 始终沿切线方向朝前，并叠加 rotation (弧度) 偏移
 */
export class TrajectoryMove extends Component {
    static defaultConfig = {
        assetType: 'model',
        modelUrl: '',
        imageUrl: '',

        // 模型自适应大小（仅 assetType=model 生效）
        fitEnabled: true,
        fitSize: 1,
        modelScale: 1,

        points: [],
        speed: 2.0,
        loop: true,
        autoStart: true,

        // 位移/旋转偏移（弧度）
        position: [0, 0, 0],
        rotation: [0, 0, 0],

        // 资源自身缩放
        scale: [1, 1, 1]
    };

    onCreate() {
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();

        this.moverGroup = new THREE.Group();
        this.componentScene.add(this.moverGroup);

        this.assetRoot = null;

        this.curve = null;
        this.totalDistance = 0;
        this.currentDistance = 0;
        this.isPlaying = false;

        this._tmpQuat = new THREE.Quaternion();
        this._rotOffsetQuat = new THREE.Quaternion();
        this._tmpEuler = new THREE.Euler();
        this._tmpVec3A = new THREE.Vector3();
        this._tmpVec3B = new THREE.Vector3();
        this._tmpUp = new THREE.Vector3(0, 1, 0);
        this._baseForward = new THREE.Vector3(0, 0, 1);
    }

    async onMounted() {
        const points = this.normalizePoints(this.config.points);
        if (points.length < 2) {
            console.warn('TrajectoryMove: points 至少需要 2 个点');
        } else {
            this.curve = new THREE.CatmullRomCurve3(points, false);
            this.totalDistance = Math.max(this.curve.getLength(), 0);
        }

        await this.loadAsset();

        if (this.config.autoStart) {
            this.play();
        }
    }

    normalizePoints(input) {
        const points = Array.isArray(input) ? input : [];
        const out = [];

        for (const p of points) {
            if (!p) continue;
            if (Array.isArray(p) && p.length >= 3) {
                const x = Number(p[0]);
                const y = Number(p[1]);
                const z = Number(p[2]);
                if ([x, y, z].every(Number.isFinite)) out.push(new THREE.Vector3(x, y, z));
                continue;
            }
            if (typeof p === 'object') {
                const x = Number(p.x);
                const y = Number(p.y);
                const z = Number(p.z);
                if ([x, y, z].every(Number.isFinite)) out.push(new THREE.Vector3(x, y, z));
            }
        }

        return out;
    }

    async loadAsset() {
        this.clearAsset();

        const type = this.config.assetType;
        if (type === 'model') {
            const url = this.config.modelUrl;
            if (!url) return;
            await this.loadModel(url);
            return;
        }

        if (type === 'image') {
            const url = this.config.imageUrl;
            if (!url) return;
            await this.loadImage(url);
        }
    }

    async loadModel(url) {
        await new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    this.assetRoot = gltf.scene || null;
                    if (this.assetRoot) {
                        this.applyModelScaleAndFit();
                        this.moverGroup.add(this.assetRoot);
                    }
                    this.emit('loaded');
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('TrajectoryMove: 模型加载失败', error);
                    this.emit('loadError', error);
                    reject(error);
                }
            );
        });
    }

    async loadImage(url) {
        await new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;

                    const material = new THREE.SpriteMaterial({
                        map: texture,
                        transparent: true,
                        depthTest: true
                    });
                    const sprite = new THREE.Sprite(material);

                    this.assetRoot = sprite;
                    this.applyImageScale();
                    this.moverGroup.add(this.assetRoot);

                    this.emit('loaded');
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('TrajectoryMove: 图片加载失败', error);
                    this.emit('loadError', error);
                    reject(error);
                }
            );
        });
    }

    getScaleVector(value, fallback = 1) {
        if (Array.isArray(value) && value.length >= 3) {
            return new THREE.Vector3(
                Number(value[0]) || fallback,
                Number(value[1]) || fallback,
                Number(value[2]) || fallback
            );
        }

        const n = Number(value);
        if (Number.isFinite(n)) {
            return new THREE.Vector3(n, n, n);
        }

        return new THREE.Vector3(fallback, fallback, fallback);
    }

    applyImageScale() {
        if (!this.assetRoot) return;
        if (!this.assetRoot.isSprite) return;

        const s = this.getScaleVector(this.config.scale, 1);
        this.assetRoot.scale.copy(s);
    }

    applyModelScaleAndFit() {
        if (!this.assetRoot) return;

        // 1) 先做“范围内自适应大小”：让模型最大边 = fitSize（默认1）
        if (this.config.fitEnabled !== false) {
            const target = Number(this.config.fitSize);
            const targetSize = Number.isFinite(target) && target > 0 ? target : 1;

            const box = new THREE.Box3().setFromObject(this.assetRoot);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            if (Number.isFinite(maxDim) && maxDim > 0) {
                const fitScale = targetSize / maxDim;
                this.assetRoot.scale.multiplyScalar(fitScale);
            }
        }

        // 2) 再叠加用户设置的 modelScale（默认1）
        const modelScale = Number(this.config.modelScale);
        const s = Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1;
        this.assetRoot.scale.multiplyScalar(s);
    }

    clearAsset() {
        if (!this.assetRoot) return;

        try {
            this.moverGroup.remove(this.assetRoot);
        } catch {}

        // 尽量释放材质/几何体/纹理
        const disposeMaterial = (mat) => {
            if (!mat) return;
            try {
                if (mat.map) mat.map.dispose?.();
                if (mat.alphaMap) mat.alphaMap.dispose?.();
                if (mat.emissiveMap) mat.emissiveMap.dispose?.();
                if (mat.roughnessMap) mat.roughnessMap.dispose?.();
                if (mat.metalnessMap) mat.metalnessMap.dispose?.();
                mat.dispose?.();
            } catch {}
        };

        try {
            if (this.assetRoot.isSprite) {
                disposeMaterial(this.assetRoot.material);
            } else {
                this.assetRoot.traverse?.((child) => {
                    if (child.isMesh) {
                        child.geometry?.dispose?.();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(disposeMaterial);
                        } else {
                            disposeMaterial(child.material);
                        }
                    }
                });
            }
        } catch {}

        this.assetRoot = null;
    }

    play() {
        this.isPlaying = true;
        this.emit('play');
    }

    stop() {
        this.isPlaying = false;
        this.currentDistance = 0;
        this.emit('stop');
    }

    updateMoverAt(t) {
        if (!this.curve) return;

        const point = this.curve.getPointAt(t, this._tmpVec3A);
        const tangent = this.curve.getTangentAt(t, this._tmpVec3B).normalize();

        // 位置偏移
        const offset = this.config.position;
        if (Array.isArray(offset) && offset.length >= 3) {
            point.x += Number(offset[0]) || 0;
            point.y += Number(offset[1]) || 0;
            point.z += Number(offset[2]) || 0;
        }

        this.moverGroup.position.copy(point);

        // 朝向：沿切线（始终朝前）
        if (tangent.lengthSq() > 1e-8) {
            // 计算一个稳定的 lookAt
            const lookTarget = point.clone().add(tangent);
            this.moverGroup.lookAt(lookTarget);

            // 叠加 rotation 偏移（弧度）
            const rot = this.config.rotation;
            if (Array.isArray(rot) && rot.length >= 3) {
                this._tmpEuler.set(Number(rot[0]) || 0, Number(rot[1]) || 0, Number(rot[2]) || 0);
                this._rotOffsetQuat.setFromEuler(this._tmpEuler);
                this.moverGroup.quaternion.multiply(this._rotOffsetQuat);
            }
        }
    }

    onUpdate(deltaTime) {
        if (!this.isPlaying) return;
        if (!this.curve || this.totalDistance <= 0) return;

        const speed = Number(this.config.speed) || 0;
        if (speed <= 0) return;

        this.currentDistance += speed * deltaTime;

        if (this.currentDistance >= this.totalDistance) {
            if (this.config.loop) {
                this.currentDistance = this.currentDistance % this.totalDistance;
            } else {
                this.currentDistance = this.totalDistance;
                this.isPlaying = false;
                this.emit('complete');
            }
        }

        const t = THREE.MathUtils.clamp(this.currentDistance / this.totalDistance, 0, 1);
        this.updateMoverAt(t);
    }

    onDispose() {
        this.stop();
        this.clearAsset();

        try {
            this.componentScene.remove(this.moverGroup);
        } catch {}

        this.curve = null;
        this.totalDistance = 0;
        this.currentDistance = 0;
    }

    async updateConfig(newConfig) {
        this.stop();
        Object.assign(this.config, newConfig);

        // 清理并重建
        this.onDispose();

        // 重新创建 group（onDispose 会 remove）
        this.moverGroup = new THREE.Group();
        this.componentScene.add(this.moverGroup);

        await this.onMounted();
    }

    async updateData(data, options = {}) {
        const field = typeof options.field === 'string' && options.field.trim()
            ? options.field.trim()
            : 'points';
        await this.updateConfig({
            [field]: Array.isArray(data) ? data : []
        });
    }
}

export default TrajectoryMove;
