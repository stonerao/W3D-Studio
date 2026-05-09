import { Component } from '@w3d/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * MultiPathAnimation 多轨迹路径动画组件
 *
 * @class MultiPathAnimation
 * @extends Component
 * @description 支持加载模型并在多条路径上进行实例化渲染的动画组件
 */
export class MultiPathAnimation extends Component {
    static defaultConfig = {
        modelUrl: '',              // 模型文件路径
        paths: [],                 // 路径配置数组 [{ id, data: [[x,y,z], ...] }]
        vehiclesPerPath: 5,       // 每条路径上的车辆数量
        scale: [1, 1, 1],         // 组件缩放（保留兼容）
        instancedScale: [2, 2, 2], // 实例模型缩放（仅作用于 instancedMesh）
        position: [0, 0, 0],      // 模型位置偏移
        rotation: [0, 0, 0],      // 模型旋转偏移（弧度）
        speed: 10,                // 移动速度 (单位/秒)
        loop: true,               // 是否循环
        autoStart: true,          // 自动开始
        lookAtDirection: 'forward', // 朝向模式
        showPath: true,           // 显示路径轨迹
        pathColor: '#ffaa00',     // 路径颜色
        pathWidth: 2              // 路径线宽
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

        // 加载模型
        await this.loadModel();

        // 创建路径曲线
        this.createPaths();

        // 创建路径可视化
        if (this.config.showPath) {
            this.createPathVisualization();
        }

        // 初始化动画状态
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

                    // 获取模型的几何体和材质
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

                    // 创建 InstancedMesh（总车辆数 = 路径数 × 每条路径车辆数）
                    const instanceCount = this.normalizedPaths.length * this.config.vehiclesPerPath;
                    this.instancedMesh = new THREE.InstancedMesh(
                        geometry,
                        material,
                        instanceCount
                    );

                    // 添加到场景
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
        // 清理旧的路径线
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

            // 为每条路径创建多个车辆
            for (let vehicleIndex = 0; vehicleIndex < this.config.vehiclesPerPath; vehicleIndex++) {
                // 让车辆在路径上均匀分布
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

        // 兼容 pathCar.json 格式：{ points: [{ position: {x,y,z} }, ...] }
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

        // 兼容单一路径对象 { id, data: [[x,y,z], ...] }
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

            // 计算移动距离
            const moveDistance = this.config.speed * deltaTime;
            anim.currentDistance += moveDistance;

            // 计算进度
            let newProgress = anim.currentDistance / anim.totalDistance;

            // 处理循环
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

            // 计算位置
            const position = new THREE.Vector3(
                point.x + this.config.position[0],
                point.y + this.config.position[1],
                point.z + this.config.position[2]
            );

            // 计算朝向
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

            // 旋转偏移（始终生效）
            const offsetRotation = new THREE.Euler(
                this.config.rotation[0],
                this.config.rotation[1],
                this.config.rotation[2]
            );
            const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetRotation);
            const finalQuaternion = baseQuaternion.multiply(offsetQuaternion);

            // 创建变换矩阵（在实例矩阵里应用缩放，避免全局缩放影响路径）
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

            // 设置实例的变换矩阵
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

        // 清理路径线
        this.pathLines.forEach((line) => {
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
            this.scene.scene.remove(line);
        });
        this.pathLines = [];

        // 清理 InstancedMesh
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

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    async updateConfig(newConfig) {
        // 停止当前动画
        this.stop();

        // 合并配置
        Object.assign(this.config, newConfig);

        // 清理并重建
        this.onDispose();

        // 重新初始化
        this.isReady = false;
        this.curves = [];
        this.pathLines = [];
        this.animations = [];
        this.normalizedPaths = [];

        // 重新挂载
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
