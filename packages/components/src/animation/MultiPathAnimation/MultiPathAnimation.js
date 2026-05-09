import { Component } from '@w3d/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Animation module component that coordinates multiple path animations for synchronized scene movement.
 */
export class MultiPathAnimation extends Component {
    static defaultConfig = {
        modelUrl: '',
        paths: [],
        vehiclesPerPath: 5,
        scale: [1, 1, 1],
        instancedScale: [2, 2, 2],
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        speed: 10,
        loop: true,
        autoStart: true,
        lookAtDirection: 'forward',
        showPath: true,
        pathColor: '#ffaa00',
        pathWidth: 2
    };

    onCreate() {
        this.loader = new GLTFLoader();
        this.instancedMesh = null;
        this.animations = [];
        this.curves = [];
        this.pathLines = [];
        this.normalizedPaths = [];
        this.isReady = false;
    }

    async onMounted() {
        this.normalizedPaths = this.normalizePaths();
        if (!this.config.modelUrl || this.normalizedPaths.length === 0) {
            console.warn('MultiPathAnimation: modelUrl 或 paths 未配置');
            return;
        }

        await this.loadModel();

        this.createPaths();

        if (this.config.showPath) {
            this.createPathVisualization();
        }

        this.initAnimations();

        this.isReady = true;
        this.emit('ready');

        if (this.config.autoStart) {
            this.play();
        }
    }

    async loadModel() {
        return new Promise((resolve, reject) => {
            this.loader.load(
                this.config.modelUrl,
                (gltf) => {
                    const model = gltf.scene;

                    let geometry = null;
                    let material = null;

                    model.traverse((child) => {
                        if (child.isMesh && !geometry) {
                            geometry = child.geometry;
                            material = child.material;
                        }
                    });

                    if (!geometry) {
                        console.error('MultiPathAnimation: 模型中未找到几何体');
                        reject(new Error('No geometry found'));
                        return;
                    }

                    const instanceCount = this.normalizedPaths.length * this.config.vehiclesPerPath;
                    this.instancedMesh = new THREE.InstancedMesh(
                        geometry,
                        material,
                        instanceCount
                    );

                    this.componentScene.add(this.instancedMesh);

                    console.log(`MultiPathAnimation: 模型加载成功，创建 ${instanceCount} 个实例`);
                    this.emit('loaded');
                    resolve();
                },
                (progress) => {
                    const percent = (progress.loaded / progress.total) * 100;
                    this.emit('loadProgress', { percent });
                },
                (error) => {
                    console.error('MultiPathAnimation: 模型加载失败', error);
                    this.emit('loadError', error);
                    reject(error);
                }
            );
        });
    }

    createPaths() {
        this.curves = this.normalizedPaths.map((pathConfig) => {
            const points = pathConfig.data.map(
                (p) => new THREE.Vector3(p[0], p[1], p[2])
            );
            return new THREE.CatmullRomCurve3(points, false);
        });
    }

    createPathVisualization() {
        this.pathLines.forEach((line) => this.scene.scene.remove(line));
        this.pathLines = [];

        this.curves.forEach((curve, index) => {
            const points = curve.getPoints(100);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: this.config.pathColor,
                linewidth: this.config.pathWidth
            });

            const line = new THREE.Line(geometry, material);
            this.scene.scene.add(line);
            this.pathLines.push(line);
        });
    }

    initAnimations() {
        this.animations = [];
        let instanceIndex = 0;

        this.normalizedPaths.forEach((pathConfig, pathIndex) => {
            const curve = this.curves[pathIndex];
            const totalDistance = curve.getLength();

            for (let vehicleIndex = 0; vehicleIndex < this.config.vehiclesPerPath; vehicleIndex++) {
                const initialProgress = vehicleIndex / this.config.vehiclesPerPath;

                this.animations.push({
                    index: instanceIndex++,
                    pathId: pathConfig.id,
                    pathIndex,
                    vehicleIndex,
                    curve,
                    progress: initialProgress,
                    currentDistance: initialProgress * totalDistance,
                    totalDistance,
                    isPlaying: false,
                    matrix: new THREE.Matrix4()
                });
            }
        });
    }

    normalizePaths() {
        let raw = this.config.paths;

        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw);
            } catch {
                raw = [];
            }
        }

        if (Array.isArray(raw)) {
            return raw;
        }

        if (raw && Array.isArray(raw.points)) {
            const data = raw.points
                .map((p) => {
                    const pos = p?.position || p;
                    const x = pos?.x ?? pos?.[0] ?? 0;
                    const y = pos?.y ?? pos?.[1] ?? 0;
                    const z = pos?.z ?? pos?.[2] ?? 0;
                    return [x, y, z];
                })
                .filter((p) => p.length === 3);

            if (data.length > 0) {
                return [{ id: raw.id || 'path_1', data }];
            }
        }

        if (raw && Array.isArray(raw.data)) {
            return [raw];
        }

        return [];
    }

    play() {
        if (!this.isReady) {
            console.warn('MultiPathAnimation: 组件未准备就绪');
            return;
        }

        this.animations.forEach((anim) => {
            anim.isPlaying = true;
        });

        this.emit('play');
    }

    pause() {
        this.animations.forEach((anim) => {
            anim.isPlaying = false;
        });

        this.emit('pause');
    }

    stop() {
        this.animations.forEach((anim) => {
            anim.isPlaying = false;
            anim.progress = 0;
            anim.currentDistance = 0;
        });

        this.updateInstances();
        this.emit('stop');
    }

    reset() {
        this.stop();
        this.emit('reset');
    }

    onUpdate(deltaTime) {
        if (!this.isReady || !this.instancedMesh) return;

        let anyPlaying = false;

        this.animations.forEach((anim) => {
            if (!anim.isPlaying) return;

            anyPlaying = true;

            const moveDistance = this.config.speed * deltaTime;
            anim.currentDistance += moveDistance;

            let newProgress = anim.currentDistance / anim.totalDistance;

            if (this.config.loop && newProgress >= 1) {
                newProgress = 0;
                anim.currentDistance = 0;
                this.emit('complete', { pathId: anim.pathId, index: anim.index });
            } else if (newProgress >= 1) {
                newProgress = 1;
                anim.isPlaying = false;
                this.emit('complete', { pathId: anim.pathId, index: anim.index });
            }

            anim.progress = newProgress;
        });

        if (anyPlaying) {
            this.updateInstances();
        }
    }

    updateInstances() {
        if (!this.instancedMesh) return;

        this.animations.forEach((anim) => {
            const point = anim.curve.getPoint(anim.progress);

            const position = new THREE.Vector3(
                point.x + this.config.position[0],
                point.y + this.config.position[1],
                point.z + this.config.position[2]
            );

            const baseQuaternion = new THREE.Quaternion();
            const lookAtMode = this.config.lookAtDirection || 'forward';

            if (lookAtMode === 'forward' || lookAtMode === 'backward') {
                const nextProgress = Math.min(anim.progress + 0.01, 1);
                const nextPoint = anim.curve.getPoint(nextProgress);
                const direction = new THREE.Vector3()
                    .subVectors(nextPoint, point)
                    .normalize();

                if (direction.length() > 0) {
                    if (lookAtMode === 'backward') direction.negate();
                    const up = new THREE.Vector3(0, 1, 0);
                    const targetMatrix = new THREE.Matrix4().lookAt(
                        new THREE.Vector3(0, 0, 0),
                        direction,
                        up
                    );
                    baseQuaternion.setFromRotationMatrix(targetMatrix);
                }
            }

            const offsetRotation = new THREE.Euler(
                this.config.rotation[0],
                this.config.rotation[1],
                this.config.rotation[2]
            );
            const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetRotation);
            const finalQuaternion = baseQuaternion.multiply(offsetQuaternion);

            const scaleValue = this.config.instancedScale ?? this.config.scale;
            const scaleVector = Array.isArray(scaleValue)
                ? scaleValue
                : [scaleValue, scaleValue, scaleValue];
            const matrix = new THREE.Matrix4();
            matrix.compose(
                position,
                finalQuaternion,
                new THREE.Vector3(scaleVector[0], scaleVector[1], scaleVector[2])
            );

            this.instancedMesh.setMatrixAt(anim.index, matrix);
        });

        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    getStatus() {
        return {
            isReady: this.isReady,
            totalVehicles: this.animations.length,
            pathCount: this.config.paths.length,
            vehiclesPerPath: this.config.vehiclesPerPath,
            animations: this.animations.map((anim) => ({
                pathId: anim.pathId,
                pathIndex: anim.pathIndex,
                vehicleIndex: anim.vehicleIndex,
                index: anim.index,
                isPlaying: anim.isPlaying,
                progress: anim.progress
            }))
        };
    }

    onDispose() {
        this.stop();

        this.pathLines.forEach((line) => {
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
            this.scene.scene.remove(line);
        });
        this.pathLines = [];

        if (this.instancedMesh) {
            if (this.instancedMesh.geometry) {
                this.instancedMesh.geometry.dispose();
            }
            if (this.instancedMesh.material) {
                if (Array.isArray(this.instancedMesh.material)) {
                    this.instancedMesh.material.forEach((mat) => mat.dispose());
                } else {
                    this.instancedMesh.material.dispose();
                }
            }
            this.componentScene.remove(this.instancedMesh);
            this.instancedMesh = null;
        }

        this.curves = [];
        this.animations = [];
    }

    async updateConfig(newConfig) {
        this.stop();

        Object.assign(this.config, newConfig);

        this.onDispose();

        this.isReady = false;
        this.curves = [];
        this.pathLines = [];
        this.animations = [];
        this.normalizedPaths = [];

        await this.onMounted();
    }

    async updateData(data, options = {}) {
        const field = typeof options.field === 'string' && options.field.trim()
            ? options.field.trim()
            : 'paths';
        await this.updateConfig({
            [field]: Array.isArray(data) ? data : []
        });
    }
}

export default MultiPathAnimation;
