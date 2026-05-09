/**
 * English comment.
 */

import { Component } from '@w3d/core';
import * as THREE from 'three';

export class EnvironmentEffect extends Component {
    /**
     * English comment.
     */
    static defaultConfig = {
        particleCount: 1000,                    // English comment.
        particleSize: 0.5,                      // English comment.
        particleTexture: '/images/particle.png', // English comment.
        effectArea: { width: 50, height: 30, depth: 50, center: [0, 0, 0], followCamera: false }, // English comment.
        animationSpeed: 1.0,                    // English comment.
        opacity: 0.6,                           // English comment.
        color: 0xffffff,                        // English comment.
        windDirection: { x: 1, y: 0, z: 0 }     // English comment.
    };

    /**
     * English comment.
     */
    static EFFECT_CONFIGS = {
        temperature: {
            name: '温度效果',
            colorStart: 0xFF6600,
            colorEnd: 0xFFAA00,
            opacityMin: 0.3,
            opacityMax: 0.6,
            sizeMin: 0.3,
            sizeMax: 0.8,
            movement: 'rise',       // English comment.
            speed: 0.5
        },
        humidity: {
            name: '湿度效果',
            colorStart: 0xFFFFFF,
            colorEnd: 0xCCEEFF,
            opacityMin: 0.2,
            opacityMax: 0.5,
            sizeMin: 0.8,
            sizeMax: 1.5,
            movement: 'float',      // English comment.
            speed: 0.2
        },
        wind: {
            name: '风速效果',
            colorStart: 0xCCCCCC,
            colorEnd: 0xEEEEEE,
            opacityMin: 0.4,
            opacityMax: 0.7,
            sizeMin: 0.4,
            sizeMax: 1.0,
            movement: 'horizontal', // English comment.
            speed: 2.0
        },
        rain: {
            name: '雨量效果',
            colorStart: 0xAADDFF,
            colorEnd: 0x88CCFF,
            opacityMin: 0.6,
            opacityMax: 0.9,
            sizeMin: 0.1,
            sizeMax: 0.3,
            scaleY: 3.0,            // English comment.
            movement: 'fall',       // English comment.
            speed: 3.0,
            texture: '/images/icon-yd.png' // English comment.
        },
        snow: {
            name: '下雪效果',
            colorStart: 0xFFFFFF,
            colorEnd: 0xEEEEFF,
            opacityMin: 0.7,
            opacityMax: 1.0,
            sizeMin: 0.3,
            sizeMax: 0.8,
            movement: 'snowfall',   // English comment.
            speed: 0.8,
            texture: '/images/icon-xh.png' // English comment.
        },
        pollution: {
            name: '污染效果',
            colorStart: 0x8B7355,   // English comment.
            colorEnd: 0x556B2F,     // English comment.
            opacityMin: 0.4,
            opacityMax: 0.7,
            sizeMin: 1.5,
            sizeMax: 3.0,           // English comment.
            movement: 'pollution',  // English comment.
            speed: 0.15
        },
        noise: {
            name: '噪音效果',
            colorStart: 0xFF6600,   // English comment.
            colorEnd: 0xFFCC00,     // English comment.
            opacityMin: 0.3,
            opacityMax: 0.8,
            sizeMin: 0.2,
            sizeMax: 0.6,
            movement: 'pulse',      // English comment.
            speed: 2.5
        }
    };

    /**
     * English comment.
     */
    onMounted() {
        // English comment.
        this.currentEffect = null;
        // English comment.
        this.intensity = 50;

        // English comment.
        this.particles = null;
        this.geometry = null;
        this.material = null;
        this.texture = null;

        // English comment.
        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.velocities = null;
        this.opacities = null;

        // English comment.
        this.effectArea = { ...this.config.effectArea };
        this._areaCenter = new THREE.Vector3();
        this._lastAreaCenter = new THREE.Vector3();

        // English comment.
        this.loadTexture();

        // English comment.
        this.initParticleSystem();
    }

    onConfigUpdate(config) {
        if (config?.effectArea) {
            this.effectArea = { ...this.effectArea, ...config.effectArea };

            if (this.currentEffect) {
                const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
                if (effectConfig) {
                    this.setupParticlesForEffect(this.currentEffect, effectConfig);
                }
            }
        }
    }

    _getAreaCenter() {
        const area = this.effectArea || {};
        if (area.followCamera && this.scene?.camera?.instance) {
            const p = this.scene.camera.instance.position;
            return this._areaCenter.set(p.x, p.y, p.z);
        }

        const c = Array.isArray(area.center) ? area.center : null;
        const x = Number.isFinite(Number(c?.[0])) ? Number(c[0]) : 0;
        const y = Number.isFinite(Number(c?.[1])) ? Number(c[1]) : 0;
        const z = Number.isFinite(Number(c?.[2])) ? Number(c[2]) : 0;
        return this._areaCenter.set(x, y, z);
    }

    /**
     * English comment.
     */
    loadTexture(texturePath) {
        const textureLoader = new THREE.TextureLoader();
        const path = texturePath || this.config.particleTexture;
        this.texture = textureLoader.load(path, () => {
            console.log('[EnvironmentEffect] 粒子纹理加载完成:', path);
            if (this.material) {
                this.material.map = this.texture;
                this.material.needsUpdate = true;
            }
        }, undefined, (error) => {
            console.warn('[EnvironmentEffect] 粒子纹理加载失败，使用默认渲染:', error);
        });
    }

    /**
     * English comment.
     */
    initParticleSystem() {
        const count = this.config.particleCount;

        // English comment.
        this.geometry = new THREE.BufferGeometry();

        // English comment.
        this.positions = new Float32Array(count * 3);
        // English comment.
        this.colors = new Float32Array(count * 3);
        // English comment.
        this.sizes = new Float32Array(count);
        // English comment.
        this.velocities = new Float32Array(count * 3);
        // English comment.
        this.opacities = new Float32Array(count);

        // English comment.
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            this.positions[i3] = 0;
            this.positions[i3 + 1] = -1000; // English comment.
            this.positions[i3 + 2] = 0;
            this.colors[i3] = 1;
            this.colors[i3 + 1] = 1;
            this.colors[i3 + 2] = 1;
            this.sizes[i] = 0;
            this.opacities[i] = 0;
        }

        // English comment.
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        // English comment.
        this.material = new THREE.PointsMaterial({
            size: this.config.particleSize,
            map: this.texture,
            vertexColors: true,
            transparent: true,
            opacity: this.config.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        // English comment.
        this.particles = new THREE.Points(this.geometry, this.material);
        this.particles.frustumCulled = false;
        this.particles.visible = false; // English comment.

        // English comment.
        this.scene.scene.add(this.particles);

        console.log('[EnvironmentEffect] 粒子系统初始化完成');
    }

    /**
     * English comment.
     */
    setEffect(effectType, intensity = 50) {
        // English comment.
        if (!effectType || effectType === 'none') {
            this.clearEffect();
            return;
        }

        const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[effectType];
        if (!effectConfig) {
            console.warn(`[EnvironmentEffect] 未知的效果类型: ${effectType}`);
            return;
        }

        console.log(`[EnvironmentEffect] 设置效果: ${effectConfig.name}, 强度: ${intensity}`);

        this.currentEffect = effectType;
        this.intensity = Math.max(0, Math.min(100, intensity));

        // English comment.
        if (effectConfig.texture) {
            this.loadTexture(effectConfig.texture);
        }

        // English comment.
        this.setupParticlesForEffect(effectType, effectConfig);

        // English comment.
        this.particles.visible = true;

        // English comment.
        this.emit('effectChanged', {
            effectType,
            intensity: this.intensity,
            effectName: effectConfig.name
        });
    }

    /**
     * English comment.
     */
    setupParticlesForEffect(effectType, config) {
        const count = this.config.particleCount;
        const area = this.effectArea;
        const center = this._getAreaCenter();
        this._lastAreaCenter.copy(center);
        const intensityFactor = this.intensity / 100;

        // English comment.
        const activeCount = Math.floor(count * intensityFactor);

        // English comment.
        const colorStart = new THREE.Color(config.colorStart);
        const colorEnd = new THREE.Color(config.colorEnd);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            if (i < activeCount) {
                // English comment.
                this.positions[i3] = center.x + (Math.random() - 0.5) * area.width;
                this.positions[i3 + 1] = center.y + Math.random() * area.height;
                this.positions[i3 + 2] = center.z + (Math.random() - 0.5) * area.depth;

                // English comment.
                const t = Math.random();
                const color = new THREE.Color().lerpColors(colorStart, colorEnd, t);
                this.colors[i3] = color.r;
                this.colors[i3 + 1] = color.g;
                this.colors[i3 + 2] = color.b;

                // English comment.
                const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
                this.sizes[i] = size;

                // English comment.
                this.opacities[i] = config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin);

                // English comment.
                this.setupVelocity(i, config);
            } else {
                // English comment.
                this.positions[i3 + 1] = -1000;
                this.sizes[i] = 0;
                this.opacities[i] = 0;
            }
        }

        // English comment.
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;

        // English comment.
        this.material.opacity = (config.opacityMin + config.opacityMax) / 2 * intensityFactor;
    }

    /**
     * English comment.
     */
    setupVelocity(index, config) {
        const i3 = index * 3;
        const speed = config.speed * this.config.animationSpeed;

        switch (config.movement) {
        case 'rise': // English comment.
            this.velocities[i3] = (Math.random() - 0.5) * 0.3; // English comment.
            this.velocities[i3 + 1] = speed * (0.5 + Math.random() * 0.5);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
            break;

        case 'float': // English comment.
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.5;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * speed * 0.3;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5;
            break;

        case 'horizontal': // English comment.
            const windDir = this.config.windDirection;
            this.velocities[i3] = windDir.x * speed * (0.8 + Math.random() * 0.4);
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            this.velocities[i3 + 2] = windDir.z * speed * (0.8 + Math.random() * 0.4);
            break;

        case 'fall': // English comment.
            this.velocities[i3] = (Math.random() - 0.5) * 0.1;
            this.velocities[i3 + 1] = -speed * (0.8 + Math.random() * 0.4);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
            break;

        case 'snowfall': // English comment.
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.5; // English comment.
            this.velocities[i3 + 1] = -speed * (0.5 + Math.random() * 0.3); // English comment.
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5; // English comment.
            break;

        case 'pollution': // English comment.
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.8;
            this.velocities[i3 + 1] = (Math.random() - 0.3) * speed * 0.3; // English comment.
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.8;
            break;

        case 'pulse': // English comment.
            const angle = Math.random() * Math.PI * 2;
            const radius = speed * (0.5 + Math.random() * 0.5);
            this.velocities[i3] = Math.cos(angle) * radius;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * speed * 0.3;
            this.velocities[i3 + 2] = Math.sin(angle) * radius;
            break;

        default:
            this.velocities[i3] = 0;
            this.velocities[i3 + 1] = 0;
            this.velocities[i3 + 2] = 0;
        }
    }

    /**
     * English comment.
     */
    clearEffect() {
        if (!this.currentEffect) return;

        console.log('[EnvironmentEffect] 清除效果');

        this.currentEffect = null;
        this.intensity = 0;

        // English comment.
        if (this.particles) {
            this.particles.visible = false;
        }

        // English comment.
        const count = this.config.particleCount;
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            this.positions[i3 + 1] = -1000;
            this.sizes[i] = 0;
        }

        if (this.geometry) {
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.size.needsUpdate = true;
        }

        // English comment.
        this.emit('effectCleared');
    }

    /**
     * English comment.
     */
    updateIntensity(intensity) {
        if (!this.currentEffect) return;

        this.intensity = Math.max(0, Math.min(100, intensity));

        // English comment.
        const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
        if (effectConfig) {
            this.setupParticlesForEffect(this.currentEffect, effectConfig);
        }

        // English comment.
        this.emit('intensityChanged', {
            intensity: this.intensity,
            effectType: this.currentEffect
        });
    }

    /**
     * English comment.
     */
    getEffectInfo() {
        if (!this.currentEffect) {
            return { effectType: null, effectName: '无', intensity: 0 };
        }

        const config = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
        return {
            effectType: this.currentEffect,
            effectName: config?.name || this.currentEffect,
            intensity: this.intensity
        };
    }

    /**
     * English comment.
     */
    onUpdate(delta) {
        if (!this.currentEffect || !this.particles?.visible) return;

        const count = this.config.particleCount;
        const area = this.effectArea;
        const center = this._getAreaCenter();
        const intensityFactor = this.intensity / 100;
        const activeCount = Math.floor(count * intensityFactor);

        // English comment.
        const dx = center.x - this._lastAreaCenter.x;
        const dy = center.y - this._lastAreaCenter.y;
        const dz = center.z - this._lastAreaCenter.z;
        if (dx !== 0 || dy !== 0 || dz !== 0) {
            for (let i = 0; i < activeCount; i++) {
                const i3 = i * 3;
                this.positions[i3] += dx;
                this.positions[i3 + 1] += dy;
                this.positions[i3 + 2] += dz;
            }
            this._lastAreaCenter.copy(center);
        }

        // English comment.
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;

            // English comment.
            this.positions[i3] += this.velocities[i3] * delta;
            this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
            this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;

            // English comment.
            this.handleBoundary(i, area, center);
        }

        // English comment.
        this.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * English comment.
     */
    handleBoundary(index, area, center) {
        const i3 = index * 3;
        const halfWidth = area.width / 2;
        const halfDepth = area.depth / 2;
        const cx = center?.x ?? 0;
        const cy = center?.y ?? 0;
        const cz = center?.z ?? 0;

        // English comment.
        if (this.positions[i3] > cx + halfWidth) {
            this.positions[i3] = cx - halfWidth;
        } else if (this.positions[i3] < cx - halfWidth) {
            this.positions[i3] = cx + halfWidth;
        }

        // English comment.
        const bottom = cy;
        const top = cy + area.height;
        if (this.positions[i3 + 1] > top) {
            this.positions[i3 + 1] = bottom;
            // English comment.
            this.positions[i3] = cx + (Math.random() - 0.5) * area.width;
            this.positions[i3 + 2] = cz + (Math.random() - 0.5) * area.depth;
        } else if (this.positions[i3 + 1] < bottom) {
            this.positions[i3 + 1] = top;
            // English comment.
            this.positions[i3] = cx + (Math.random() - 0.5) * area.width;
            this.positions[i3 + 2] = cz + (Math.random() - 0.5) * area.depth;
        }

        // English comment.
        if (this.positions[i3 + 2] > cz + halfDepth) {
            this.positions[i3 + 2] = cz - halfDepth;
        } else if (this.positions[i3 + 2] < cz - halfDepth) {
            this.positions[i3 + 2] = cz + halfDepth;
        }
    }

    /**
     * English comment.
     */
    setEffectArea(width, height, depth) {
        this.effectArea = { ...this.effectArea, width, height, depth };

        // English comment.
        if (this.currentEffect) {
            const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
            if (effectConfig) {
                this.setupParticlesForEffect(this.currentEffect, effectConfig);
            }
        }
    }

    /**
     * English comment.
     */
    setWindDirection(x, y, z) {
        this.config.windDirection = { x, y, z };

        // English comment.
        if (this.currentEffect === 'wind') {
            const effectConfig = EnvironmentEffect.EFFECT_CONFIGS.wind;
            this.setupParticlesForEffect('wind', effectConfig);
        }
    }

    /**
     * English comment.
     */
    onDispose() {
        console.log('[EnvironmentEffect] 销毁组件');

        // English comment.
        if (this.particles) {
            this.scene.scene.remove(this.particles);
        }

        // English comment.
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        // English comment.
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }

        // English comment.
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }

        // English comment.
        this.particles = null;
        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.velocities = null;
        this.opacities = null;
    }
}

export default EnvironmentEffect;
