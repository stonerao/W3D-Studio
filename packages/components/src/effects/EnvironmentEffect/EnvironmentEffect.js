
import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Effects module component that manages scene environment visuals such as sky, fog, and ambient presentation.
 */
export class EnvironmentEffect extends Component {
    static defaultConfig = {
        particleCount: 1000,
        particleSize: 0.5,
        particleTexture: '/images/particle.png',
        effectArea: { width: 50, height: 30, depth: 50, center: [0, 0, 0], followCamera: false },
        animationSpeed: 1.0,
        opacity: 0.6,
        color: 0xffffff,
        windDirection: { x: 1, y: 0, z: 0 }
    };

    static EFFECT_CONFIGS = {
        temperature: {
            name: '温度效果',
            colorStart: 0xFF6600,
            colorEnd: 0xFFAA00,
            opacityMin: 0.3,
            opacityMax: 0.6,
            sizeMin: 0.3,
            sizeMax: 0.8,
            movement: 'rise',
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
            movement: 'float',
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
            movement: 'horizontal',
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
            scaleY: 3.0,
            movement: 'fall',
            speed: 3.0,
            texture: '/images/icon-yd.png'
        },
        snow: {
            name: '下雪效果',
            colorStart: 0xFFFFFF,
            colorEnd: 0xEEEEFF,
            opacityMin: 0.7,
            opacityMax: 1.0,
            sizeMin: 0.3,
            sizeMax: 0.8,
            movement: 'snowfall',
            speed: 0.8,
            texture: '/images/icon-xh.png'
        },
        pollution: {
            name: '污染效果',
            colorStart: 0x8B7355,
            colorEnd: 0x556B2F,
            opacityMin: 0.4,
            opacityMax: 0.7,
            sizeMin: 1.5,
            sizeMax: 3.0,
            movement: 'pollution',
            speed: 0.15
        },
        noise: {
            name: '噪音效果',
            colorStart: 0xFF6600,
            colorEnd: 0xFFCC00,
            opacityMin: 0.3,
            opacityMax: 0.8,
            sizeMin: 0.2,
            sizeMax: 0.6,
            movement: 'pulse',
            speed: 2.5
        }
    };

    onMounted() {
        this.currentEffect = null;
        this.intensity = 50;

        this.particles = null;
        this.geometry = null;
        this.material = null;
        this.texture = null;

        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.velocities = null;
        this.opacities = null;

        this.effectArea = { ...this.config.effectArea };
        this._areaCenter = new THREE.Vector3();
        this._lastAreaCenter = new THREE.Vector3();

        this.loadTexture();

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

    initParticleSystem() {
        const count = this.config.particleCount;

        this.geometry = new THREE.BufferGeometry();

        this.positions = new Float32Array(count * 3);
        this.colors = new Float32Array(count * 3);
        this.sizes = new Float32Array(count);
        this.velocities = new Float32Array(count * 3);
        this.opacities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            this.positions[i3] = 0;
            this.positions[i3 + 1] = -1000;
            this.positions[i3 + 2] = 0;
            this.colors[i3] = 1;
            this.colors[i3 + 1] = 1;
            this.colors[i3 + 2] = 1;
            this.sizes[i] = 0;
            this.opacities[i] = 0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

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

        this.particles = new THREE.Points(this.geometry, this.material);
        this.particles.frustumCulled = false;
        this.particles.visible = false;

        this.scene.scene.add(this.particles);

        console.log('[EnvironmentEffect] 粒子系统初始化完成');
    }

    setEffect(effectType, intensity = 50) {
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

        if (effectConfig.texture) {
            this.loadTexture(effectConfig.texture);
        }

        this.setupParticlesForEffect(effectType, effectConfig);

        this.particles.visible = true;

        this.emit('effectChanged', {
            effectType,
            intensity: this.intensity,
            effectName: effectConfig.name
        });
    }

    setupParticlesForEffect(effectType, config) {
        const count = this.config.particleCount;
        const area = this.effectArea;
        const center = this._getAreaCenter();
        this._lastAreaCenter.copy(center);
        const intensityFactor = this.intensity / 100;

        const activeCount = Math.floor(count * intensityFactor);

        const colorStart = new THREE.Color(config.colorStart);
        const colorEnd = new THREE.Color(config.colorEnd);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            if (i < activeCount) {
                this.positions[i3] = center.x + (Math.random() - 0.5) * area.width;
                this.positions[i3 + 1] = center.y + Math.random() * area.height;
                this.positions[i3 + 2] = center.z + (Math.random() - 0.5) * area.depth;

                const t = Math.random();
                const color = new THREE.Color().lerpColors(colorStart, colorEnd, t);
                this.colors[i3] = color.r;
                this.colors[i3 + 1] = color.g;
                this.colors[i3 + 2] = color.b;

                const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
                this.sizes[i] = size;

                this.opacities[i] = config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin);

                this.setupVelocity(i, config);
            } else {
                this.positions[i3 + 1] = -1000;
                this.sizes[i] = 0;
                this.opacities[i] = 0;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;

        this.material.opacity = (config.opacityMin + config.opacityMax) / 2 * intensityFactor;
    }

    setupVelocity(index, config) {
        const i3 = index * 3;
        const speed = config.speed * this.config.animationSpeed;

        switch (config.movement) {
        case 'rise':
            this.velocities[i3] = (Math.random() - 0.5) * 0.3;
            this.velocities[i3 + 1] = speed * (0.5 + Math.random() * 0.5);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
            break;

        case 'float':
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.5;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * speed * 0.3;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5;
            break;

        case 'horizontal':
            const windDir = this.config.windDirection;
            this.velocities[i3] = windDir.x * speed * (0.8 + Math.random() * 0.4);
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            this.velocities[i3 + 2] = windDir.z * speed * (0.8 + Math.random() * 0.4);
            break;

        case 'fall':
            this.velocities[i3] = (Math.random() - 0.5) * 0.1;
            this.velocities[i3 + 1] = -speed * (0.8 + Math.random() * 0.4);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
            break;

        case 'snowfall':
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.5;
            this.velocities[i3 + 1] = -speed * (0.5 + Math.random() * 0.3);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5;
            break;

        case 'pollution':
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.8;
            this.velocities[i3 + 1] = (Math.random() - 0.3) * speed * 0.3;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.8;
            break;

        case 'pulse':
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

    clearEffect() {
        if (!this.currentEffect) return;

        console.log('[EnvironmentEffect] 清除效果');

        this.currentEffect = null;
        this.intensity = 0;

        if (this.particles) {
            this.particles.visible = false;
        }

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

        this.emit('effectCleared');
    }

    updateIntensity(intensity) {
        if (!this.currentEffect) return;

        this.intensity = Math.max(0, Math.min(100, intensity));

        const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
        if (effectConfig) {
            this.setupParticlesForEffect(this.currentEffect, effectConfig);
        }

        this.emit('intensityChanged', {
            intensity: this.intensity,
            effectType: this.currentEffect
        });
    }

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

    onUpdate(delta) {
        if (!this.currentEffect || !this.particles?.visible) return;

        const count = this.config.particleCount;
        const area = this.effectArea;
        const center = this._getAreaCenter();
        const intensityFactor = this.intensity / 100;
        const activeCount = Math.floor(count * intensityFactor);

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

        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;

            this.positions[i3] += this.velocities[i3] * delta;
            this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
            this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;

            this.handleBoundary(i, area, center);
        }

        this.geometry.attributes.position.needsUpdate = true;
    }

    handleBoundary(index, area, center) {
        const i3 = index * 3;
        const halfWidth = area.width / 2;
        const halfDepth = area.depth / 2;
        const cx = center?.x ?? 0;
        const cy = center?.y ?? 0;
        const cz = center?.z ?? 0;

        if (this.positions[i3] > cx + halfWidth) {
            this.positions[i3] = cx - halfWidth;
        } else if (this.positions[i3] < cx - halfWidth) {
            this.positions[i3] = cx + halfWidth;
        }

        const bottom = cy;
        const top = cy + area.height;
        if (this.positions[i3 + 1] > top) {
            this.positions[i3 + 1] = bottom;
            this.positions[i3] = cx + (Math.random() - 0.5) * area.width;
            this.positions[i3 + 2] = cz + (Math.random() - 0.5) * area.depth;
        } else if (this.positions[i3 + 1] < bottom) {
            this.positions[i3 + 1] = top;
            this.positions[i3] = cx + (Math.random() - 0.5) * area.width;
            this.positions[i3 + 2] = cz + (Math.random() - 0.5) * area.depth;
        }

        if (this.positions[i3 + 2] > cz + halfDepth) {
            this.positions[i3 + 2] = cz - halfDepth;
        } else if (this.positions[i3 + 2] < cz - halfDepth) {
            this.positions[i3 + 2] = cz + halfDepth;
        }
    }

    setEffectArea(width, height, depth) {
        this.effectArea = { ...this.effectArea, width, height, depth };

        if (this.currentEffect) {
            const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
            if (effectConfig) {
                this.setupParticlesForEffect(this.currentEffect, effectConfig);
            }
        }
    }

    setWindDirection(x, y, z) {
        this.config.windDirection = { x, y, z };

        if (this.currentEffect === 'wind') {
            const effectConfig = EnvironmentEffect.EFFECT_CONFIGS.wind;
            this.setupParticlesForEffect('wind', effectConfig);
        }
    }

    onDispose() {
        console.log('[EnvironmentEffect] 销毁组件');

        if (this.particles) {
            this.scene.scene.remove(this.particles);
        }

        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        if (this.material) {
            this.material.dispose();
            this.material = null;
        }

        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }

        this.particles = null;
        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.velocities = null;
        this.opacities = null;
    }
}

export default EnvironmentEffect;
