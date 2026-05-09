import * as THREE from 'three';
import { Component } from '@w3d/core';

export class Weather extends Component {
    constructor(scene, options = {}) {
        super(scene, options);
        this.type = options.type || 'rain'; // 'rain' or 'snow'
        this.count = options.count || 10000;
        this.speed = options.speed || 1.0;
        this.size = options.size || (this.type === 'rain' ? 0.1 : 0.5);
        this.color = options.color || 0xffffff;
        this.area = options.area || 100; // Range of the weather effect
        this.height = options.height || 50; // Height of the weather effect

        this._particles = null;
        this._geometry = null;
        this._material = null;
    }

    onMounted() {
        this._initParticles();
        this.add(this._particles);
    }

    onDispose() {
        if (this._particles) {
            this.remove(this._particles);
        }
        if (this._geometry) {
            this._geometry.dispose();
        }
        if (this._material) {
            this._material.dispose();
        }
    }

    onUpdate(deltaTime) {
        if (!this._particles) return;

        const positions = this._geometry.attributes.position.array;
        const velocities = this._geometry.attributes.velocity.array;

        for (let i = 0; i < this.count; i++) {
            // Update Y position
            positions[i * 3 + 1] -= velocities[i] * this.speed * (deltaTime * 60); // Scale by deltaTime

            // Reset if below ground (assuming ground is at 0 or slightly below)
            if (positions[i * 3 + 1] < -this.height / 2) {
                positions[i * 3 + 1] = this.height / 2;
                positions[i * 3] = (Math.random() - 0.5) * this.area;
                positions[i * 3 + 2] = (Math.random() - 0.5) * this.area;
            }

            // Add some horizontal movement for snow
            if (this.type === 'snow') {
                positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.02 * this.speed;
                positions[i * 3 + 2] += Math.cos(Date.now() * 0.001 + i) * 0.02 * this.speed;
            }
        }

        this._geometry.attributes.position.needsUpdate = true;
    }

    _initParticles() {
        this._geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];

        for (let i = 0; i < this.count; i++) {
            positions.push((Math.random() - 0.5) * this.area); // x
            positions.push((Math.random() - 0.5) * this.height); // y
            positions.push((Math.random() - 0.5) * this.area); // z

            // Random velocity for each particle
            velocities.push(Math.random() * 0.5 + 0.5);
        }

        this._geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this._geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 1));

        // Simple procedural texture generation could be added here if we don't want to rely on external assets
        // For now, we'll use PointsMaterial with simple shapes

        this._material = new THREE.PointsMaterial({
            color: this.color,
            size: this.size,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        // If rain, we might want to stretch the points to look like streaks
        // But standard PointsMaterial doesn't support stretching easily without custom shader.
        // For simplicity in this V1, we stick to Points.
        // A custom shader would be better for rain streaks.

        this._particles = new THREE.Points(this._geometry, this._material);
    }

    setType(type) {
        this.type = type;
        this.onDisable();
        this.onEnable(); // Re-init
    }
}
