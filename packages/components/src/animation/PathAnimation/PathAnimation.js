import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * English comment.
 */
export class PathAnimation extends Component {
    static defaultConfig = {
        path: [],
        speed: 1.0, // English comment.
        loop: true, // English comment.
        pingPong: false, // English comment.
        autoStart: false, // English comment.
        lookAtDirection: 'forward', // English comment.
        customRotation: [0, 0, 0], // English comment.
        easing: 'linear', // English comment.
        showPath: true, // English comment.
        pathColor: '#00ff88', // English comment.
        pathWidth: 2 // English comment.
    };

    onMounted() {
        if (this.config.path.length < 2) {
            console.warn('PathAnimation: path must have at least 2 points');
            return;
        }

        // English comment.
        this.createPath();

        // English comment.
        if (this.config.showPath) {
            this.createPathVisualization();
        }

        // English comment.
        this.isPlaying = false;
        this.isPaused = false;
        this.progress = 0;
        this.totalDistance = 0;
        this.currentDistance = 0;
        this.direction = 1; // English comment.
        this.startTime = 0;
        this.pausedTime = 0;

        // English comment.
        this.calculateTotalDistance();

        // English comment.
        this.setPositionAtProgress(0);

        if (this.config.autoStart) {
            this.play();
        }
    }

    createPath() {
        const points = this.config.path.map(
            (p) => new THREE.Vector3(p.x || p[0], p.y || p[1], p.z || p[2])
        );
        this.curve = new THREE.CatmullRomCurve3(points, false); // English comment.
        this.pathPoints = points;
    }

    createPathVisualization() {
        if (this.pathLine) {
            // English comment.
            this.scene.scene.remove(this.pathLine);
        }

        // English comment.
        const points = this.curve.getPoints(100);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.config.pathColor,
            linewidth: this.config.pathWidth
        });

        this.pathLine = new THREE.Line(geometry, material);
        // English comment.
        this.scene.scene.add(this.pathLine);

        // English comment.
        this.createPathMarkers();
    }

    createPathMarkers() {
        if (this.pathMarkers) {
            // English comment.
            this.pathMarkers.forEach((marker) => this.scene.scene.remove(marker));
        }

        this.pathMarkers = [];
        const markerGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: this.config.pathColor });

        this.pathPoints.forEach((point, index) => {
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(point);
            // English comment.
            this.scene.scene.add(marker);
            this.pathMarkers.push(marker);
        });
    }

    calculateTotalDistance() {
        this.totalDistance = this.curve.getLength();
    }

    play() {
        if (this.isPaused) {
            // English comment.
            this.startTime = Date.now() - this.pausedTime;
            this.isPaused = false;
        } else {
            // English comment.
            this.startTime = Date.now();
        }
        this.isPlaying = true;
        this.emit('play');
    }

    pause() {
        if (this.isPlaying) {
            this.isPlaying = false;
            this.isPaused = true;
            this.pausedTime = Date.now() - this.startTime;
            this.emit('pause');
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.progress = 0;
        this.currentDistance = 0;
        this.direction = 1;
        this.setPositionAtProgress(0);
        this.emit('stop');
    }

    reset() {
        this.stop();
        this.emit('reset');
    }

    // English comment.
    applyEasing(t) {
        switch (this.config.easing) {
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return 1 - (1 - t) * (1 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            case 'linear':
            default:
                return t;
        }
    }

    setPositionAtProgress(progress) {
        if (!this.curve) return;

        const easedProgress = this.applyEasing(progress);
        const point = this.curve.getPoint(easedProgress);
        this.position.copy(point);

        // English comment.
        this.updateLookAt(easedProgress);

        this.emit('update', {
            progress: progress,
            easedProgress: easedProgress,
            point: point.clone(),
            currentDistance: this.currentDistance,
            totalDistance: this.totalDistance
        });
    }

    updateLookAt(progress) {
        const direction = this.config.lookAtDirection;

        if (direction === 'fixed') {
            // English comment.
            return;
        }

        if (direction === 'custom') {
            // English comment.
            this.rotation.set(
                this.config.customRotation[0],
                this.config.customRotation[1],
                this.config.customRotation[2]
            );
            return;
        }

        // English comment.
        let lookAtPoint;
        const currentPoint = this.curve.getPoint(progress);

        if (direction === 'forward') {
            const nextProgress = Math.min(progress + 0.01, 1);
            lookAtPoint = this.curve.getPoint(nextProgress);
        } else if (direction === 'backward') {
            const prevProgress = Math.max(progress - 0.01, 0);
            lookAtPoint = this.curve.getPoint(prevProgress);
        } else if (direction === 'up') {
            lookAtPoint = currentPoint.clone().add(new THREE.Vector3(0, 1, 0));
        } else if (direction === 'down') {
            lookAtPoint = currentPoint.clone().add(new THREE.Vector3(0, -1, 0));
        }

        if (lookAtPoint && !lookAtPoint.equals(currentPoint)) {
            this.lookAt(lookAtPoint);
        }
    }

    onUpdate(deltaTime) {
        if (!this.isPlaying || !this.curve) return;

        // English comment.
        const moveDistance = this.config.speed * deltaTime;
        this.currentDistance += moveDistance * this.direction;

        // English comment.
        let newProgress = this.currentDistance / this.totalDistance;

        // English comment.
        if (this.config.pingPong) {
            // English comment.
            if (newProgress >= 1) {
                newProgress = 1;
                this.direction = -1;
                this.emit('reachEnd');
            } else if (newProgress <= 0) {
                newProgress = 0;
                this.direction = 1;
                this.emit('reachStart');
            }
        } else if (this.config.loop) {
            // English comment.
            if (newProgress >= 1) {
                newProgress = 0;
                this.currentDistance = 0;
                this.emit('complete');
            }
        } else {
            // English comment.
            if (newProgress >= 1) {
                newProgress = 1;
                this.stop();
                this.emit('complete');
                return;
            }
        }

        this.progress = newProgress;
        this.setPositionAtProgress(this.progress);
    }

    // English comment.
    jumpToProgress(progress) {
        progress = Math.max(0, Math.min(1, progress));
        this.progress = progress;
        this.currentDistance = progress * this.totalDistance;
        this.setPositionAtProgress(progress);
        this.emit('jump', { progress });
    }

    // English comment.
    jumpToPoint(pointIndex) {
        if (pointIndex < 0 || pointIndex >= this.pathPoints.length) {
            console.warn('PathAnimation: Invalid point index');
            return;
        }

        const progress = pointIndex / (this.pathPoints.length - 1);
        this.jumpToProgress(progress);
    }

    // English comment.
    updatePath(newPath) {
        this.config.path = newPath;
        this.createPath();
        this.calculateTotalDistance();

        if (this.config.showPath) {
            this.createPathVisualization();
        }

        // English comment.
        this.reset();
        this.emit('pathUpdated');
    }

    // English comment.
    addPathPoint(point, index = -1) {
        if (index === -1) {
            this.config.path.push(point);
        } else {
            this.config.path.splice(index, 0, point);
        }
        this.updatePath(this.config.path);
    }

    // English comment.
    removePathPoint(index) {
        if (this.config.path.length <= 2) {
            console.warn('PathAnimation: Cannot remove point, minimum 2 points required');
            return;
        }

        this.config.path.splice(index, 1);
        this.updatePath(this.config.path);
    }

    // English comment.
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);

        if (newConfig.path) {
            this.updatePath(newConfig.path);
        }

        if (newConfig.showPath !== undefined) {
            if (newConfig.showPath && !this.pathLine) {
                this.createPathVisualization();
            } else if (!newConfig.showPath && this.pathLine) {
                // English comment.
                this.scene.scene.remove(this.pathLine);
                this.pathMarkers?.forEach((marker) => this.scene.scene.remove(marker));
                this.pathLine = null;
                this.pathMarkers = null;
            }
        }

        this.emit('configUpdated', newConfig);
    }

    // English comment.
    updateData(data, options = {}) {
        const field = typeof options.field === 'string' && options.field.trim()
            ? options.field.trim()
            : 'path';
        this.updateConfig({
            [field]: Array.isArray(data) ? data : []
        });
    }

    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            progress: this.progress,
            currentDistance: this.currentDistance,
            totalDistance: this.totalDistance,
            direction: this.direction,
            pathPointCount: this.pathPoints?.length || 0
        };
    }

    onDispose() {
        this.stop();

        // English comment.
        if (this.pathLine) {
            this.scene.scene.remove(this.pathLine);
            this.pathLine = null;
        }
        if (this.pathMarkers) {
            this.pathMarkers.forEach((marker) => this.scene.scene.remove(marker));
            this.pathMarkers = null;
        }
    }
}

export default PathAnimation;
