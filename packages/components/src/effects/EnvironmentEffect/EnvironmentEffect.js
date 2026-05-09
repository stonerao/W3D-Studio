/**
 * EnvironmentEffect 环境效果组件
 *
 * @class EnvironmentEffect
 * @extends Component
 * @description 提供温度、湿度、风速、雨量等环境效果的粒子系统实现
 *
 * @example
 * const envEffect = await scene.add('EnvironmentEffect', {
 *     particleCount: 1000,
 *     particleTexture: '/images/particle.png'
 * });
 *
 * // 设置雨量效果
 * envEffect.setEffect('rain', 70);
 *
 * // 清除效果
 * envEffect.clearEffect();
 */

import { Component } from '@w3d/core';
import * as THREE from 'three';

export class EnvironmentEffect extends Component {
    /**
     * 默认配置
     */
    static defaultConfig = {
        particleCount: 1000,                    // 粒子数量
        particleSize: 0.5,                      // 粒子大小
        particleTexture: '/images/particle.png', // 粒子纹理路径
        effectArea: { width: 50, height: 30, depth: 50, center: [0, 0, 0], followCamera: false }, // 效果区域范围
        animationSpeed: 1.0,                    // 动画速度倍率
        opacity: 0.6,                           // 粒子透明度
        color: 0xffffff,                        // 粒子颜色
        windDirection: { x: 1, y: 0, z: 0 }     // 风向（用于风速效果）
    };

    /**
     * 效果类型配置
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
            movement: 'rise',       // 向上飘动
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
            movement: 'float',      // 漂浮
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
            movement: 'horizontal', // 水平移动
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
            scaleY: 3.0,            // 雨滴拉伸
            movement: 'fall',       // 向下掉落
            speed: 3.0,
            texture: '/images/icon-yd.png' // 雨滴图标
        },
        snow: {
            name: '下雪效果',
            colorStart: 0xFFFFFF,
            colorEnd: 0xEEEEFF,
            opacityMin: 0.7,
            opacityMax: 1.0,
            sizeMin: 0.3,
            sizeMax: 0.8,
            movement: 'snowfall',   // 雪花飘落
            speed: 0.8,
            texture: '/images/icon-xh.png' // 雪花图标
        },
        pollution: {
            name: '污染效果',
            colorStart: 0x8B7355,   // 棕褐色（烟雾）
            colorEnd: 0x556B2F,     // 暗橄榄绿（有毒气体）
            opacityMin: 0.4,
            opacityMax: 0.7,
            sizeMin: 1.5,
            sizeMax: 3.0,           // 较大粒子模拟浓雾
            movement: 'pollution',  // 污染雾气漂浮
            speed: 0.15
        },
        noise: {
            name: '噪音效果',
            colorStart: 0xFF6600,   // 橙色（警示色）
            colorEnd: 0xFFCC00,     // 黄色
            opacityMin: 0.3,
            opacityMax: 0.8,
            sizeMin: 0.2,
            sizeMax: 0.6,
            movement: 'pulse',      // 脉冲波动
            speed: 2.5
        }
    };

    /**
     * 组件挂载
     */
    onMounted() {
        // 当前效果类型
        this.currentEffect = null;
        // 当前效果强度（0-100）
        this.intensity = 50;

        // 粒子系统相关
        this.particles = null;
        this.geometry = null;
        this.material = null;
        this.texture = null;

        // 粒子属性缓冲区
        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.velocities = null;
        this.opacities = null;

        // 效果区域
        this.effectArea = { ...this.config.effectArea };
        this._areaCenter = new THREE.Vector3();
        this._lastAreaCenter = new THREE.Vector3();

        // 加载纹理
        this.loadTexture();

        // 初始化粒子系统
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
     * 加载粒子纹理
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
     * 初始化粒子系统
     */
    initParticleSystem() {
        const count = this.config.particleCount;

        // 创建几何体
        this.geometry = new THREE.BufferGeometry();

        // 初始化位置数组
        this.positions = new Float32Array(count * 3);
        // 初始化颜色数组
        this.colors = new Float32Array(count * 3);
        // 初始化大小数组
        this.sizes = new Float32Array(count);
        // 初始化速度数组（用于动画）
        this.velocities = new Float32Array(count * 3);
        // 初始化透明度数组
        this.opacities = new Float32Array(count);

        // 设置初始位置（隐藏在场景外）
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            this.positions[i3] = 0;
            this.positions[i3 + 1] = -1000; // 隐藏
            this.positions[i3 + 2] = 0;
            this.colors[i3] = 1;
            this.colors[i3 + 1] = 1;
            this.colors[i3 + 2] = 1;
            this.sizes[i] = 0;
            this.opacities[i] = 0;
        }

        // 设置几何体属性
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

        // 创建着色器材质（支持顶点颜色和大小）
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

        // 创建粒子系统
        this.particles = new THREE.Points(this.geometry, this.material);
        this.particles.frustumCulled = false;
        this.particles.visible = false; // 初始隐藏

        // 添加到场景
        this.scene.scene.add(this.particles);

        console.log('[EnvironmentEffect] 粒子系统初始化完成');
    }

    /**
     * 设置环境效果
     * @param {string} effectType - 效果类型：'temperature' | 'humidity' | 'wind' | 'rain' | 'none'
     * @param {number} intensity - 效果强度（0-100，默认 50）
     */
    setEffect(effectType, intensity = 50) {
        // 清除效果
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

        // 如果效果配置中有专用纹理，则加载该纹理
        if (effectConfig.texture) {
            this.loadTexture(effectConfig.texture);
        }

        // 根据效果类型初始化粒子
        this.setupParticlesForEffect(effectType, effectConfig);

        // 显示粒子系统
        this.particles.visible = true;

        // 发送效果变更事件
        this.emit('effectChanged', {
            effectType,
            intensity: this.intensity,
            effectName: effectConfig.name
        });
    }

    /**
     * 根据效果类型设置粒子属性
     */
    setupParticlesForEffect(effectType, config) {
        const count = this.config.particleCount;
        const area = this.effectArea;
        const center = this._getAreaCenter();
        this._lastAreaCenter.copy(center);
        const intensityFactor = this.intensity / 100;

        // 实际使用的粒子数量（根据强度调整）
        const activeCount = Math.floor(count * intensityFactor);

        // 颜色插值
        const colorStart = new THREE.Color(config.colorStart);
        const colorEnd = new THREE.Color(config.colorEnd);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            if (i < activeCount) {
                // 随机位置
                this.positions[i3] = center.x + (Math.random() - 0.5) * area.width;
                this.positions[i3 + 1] = center.y + Math.random() * area.height;
                this.positions[i3 + 2] = center.z + (Math.random() - 0.5) * area.depth;

                // 随机颜色（在开始和结束颜色之间插值）
                const t = Math.random();
                const color = new THREE.Color().lerpColors(colorStart, colorEnd, t);
                this.colors[i3] = color.r;
                this.colors[i3 + 1] = color.g;
                this.colors[i3 + 2] = color.b;

                // 随机大小
                const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
                this.sizes[i] = size;

                // 随机透明度
                this.opacities[i] = config.opacityMin + Math.random() * (config.opacityMax - config.opacityMin);

                // 设置速度（根据运动类型）
                this.setupVelocity(i, config);
            } else {
                // 隐藏未使用的粒子
                this.positions[i3 + 1] = -1000;
                this.sizes[i] = 0;
                this.opacities[i] = 0;
            }
        }

        // 更新缓冲区
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;

        // 更新材质透明度
        this.material.opacity = (config.opacityMin + config.opacityMax) / 2 * intensityFactor;
    }

    /**
     * 设置粒子速度
     */
    setupVelocity(index, config) {
        const i3 = index * 3;
        const speed = config.speed * this.config.animationSpeed;

        switch (config.movement) {
        case 'rise': // 温度 - 向上
            this.velocities[i3] = (Math.random() - 0.5) * 0.3; // 轻微水平摆动
            this.velocities[i3 + 1] = speed * (0.5 + Math.random() * 0.5);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
            break;

        case 'float': // 湿度 - 漂浮
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.5;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * speed * 0.3;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5;
            break;

        case 'horizontal': // 风速 - 水平
            const windDir = this.config.windDirection;
            this.velocities[i3] = windDir.x * speed * (0.8 + Math.random() * 0.4);
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            this.velocities[i3 + 2] = windDir.z * speed * (0.8 + Math.random() * 0.4);
            break;

        case 'fall': // 雨量 - 下落
            this.velocities[i3] = (Math.random() - 0.5) * 0.1;
            this.velocities[i3 + 1] = -speed * (0.8 + Math.random() * 0.4);
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
            break;

        case 'snowfall': // 下雪 - 缓慢飘落带摇摆
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.5; // 水平摇摆
            this.velocities[i3 + 1] = -speed * (0.5 + Math.random() * 0.3); // 缓慢下落
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.5; // 水平摇摆
            break;

        case 'pollution': // 污染 - 缓慢漂浮的浓雾
            this.velocities[i3] = (Math.random() - 0.5) * speed * 0.8;
            this.velocities[i3 + 1] = (Math.random() - 0.3) * speed * 0.3; // 轻微上升趋势
            this.velocities[i3 + 2] = (Math.random() - 0.5) * speed * 0.8;
            break;

        case 'pulse': // 噪音 - 脉冲式扩散
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
     * 清除当前环境效果
     */
    clearEffect() {
        if (!this.currentEffect) return;

        console.log('[EnvironmentEffect] 清除效果');

        this.currentEffect = null;
        this.intensity = 0;

        // 隐藏粒子系统
        if (this.particles) {
            this.particles.visible = false;
        }

        // 重置所有粒子
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

        // 发送效果清除事件
        this.emit('effectCleared');
    }

    /**
     * 更新效果强度
     * @param {number} intensity - 效果强度（0-100）
     */
    updateIntensity(intensity) {
        if (!this.currentEffect) return;

        this.intensity = Math.max(0, Math.min(100, intensity));

        // 重新设置粒子
        const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
        if (effectConfig) {
            this.setupParticlesForEffect(this.currentEffect, effectConfig);
        }

        // 发送强度变更事件
        this.emit('intensityChanged', {
            intensity: this.intensity,
            effectType: this.currentEffect
        });
    }

    /**
     * 获取当前效果信息
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
     * 每帧更新
     */
    onUpdate(delta) {
        if (!this.currentEffect || !this.particles?.visible) return;

        const count = this.config.particleCount;
        const area = this.effectArea;
        const center = this._getAreaCenter();
        const intensityFactor = this.intensity / 100;
        const activeCount = Math.floor(count * intensityFactor);

        // 跟随相机：把粒子整体平移到新中心（保持相对分布不跳变）
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

        // 更新粒子位置
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;

            // 应用速度
            this.positions[i3] += this.velocities[i3] * delta;
            this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
            this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;

            // 边界检测和循环
            this.handleBoundary(i, area, center);
        }

        // 更新位置缓冲区
        this.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * 处理粒子边界
     */
    handleBoundary(index, area, center) {
        const i3 = index * 3;
        const halfWidth = area.width / 2;
        const halfDepth = area.depth / 2;
        const cx = center?.x ?? 0;
        const cy = center?.y ?? 0;
        const cz = center?.z ?? 0;

        // X 轴边界
        if (this.positions[i3] > cx + halfWidth) {
            this.positions[i3] = cx - halfWidth;
        } else if (this.positions[i3] < cx - halfWidth) {
            this.positions[i3] = cx + halfWidth;
        }

        // Y 轴边界
        const bottom = cy;
        const top = cy + area.height;
        if (this.positions[i3 + 1] > top) {
            this.positions[i3 + 1] = bottom;
            // 重新随机 X 和 Z 位置
            this.positions[i3] = cx + (Math.random() - 0.5) * area.width;
            this.positions[i3 + 2] = cz + (Math.random() - 0.5) * area.depth;
        } else if (this.positions[i3 + 1] < bottom) {
            this.positions[i3 + 1] = top;
            // 重新随机 X 和 Z 位置
            this.positions[i3] = cx + (Math.random() - 0.5) * area.width;
            this.positions[i3 + 2] = cz + (Math.random() - 0.5) * area.depth;
        }

        // Z 轴边界
        if (this.positions[i3 + 2] > cz + halfDepth) {
            this.positions[i3 + 2] = cz - halfDepth;
        } else if (this.positions[i3 + 2] < cz - halfDepth) {
            this.positions[i3 + 2] = cz + halfDepth;
        }
    }

    /**
     * 设置效果区域
     */
    setEffectArea(width, height, depth) {
        this.effectArea = { ...this.effectArea, width, height, depth };

        // 如果当前有效果，重新设置粒子
        if (this.currentEffect) {
            const effectConfig = EnvironmentEffect.EFFECT_CONFIGS[this.currentEffect];
            if (effectConfig) {
                this.setupParticlesForEffect(this.currentEffect, effectConfig);
            }
        }
    }

    /**
     * 设置风向（用于风速效果）
     */
    setWindDirection(x, y, z) {
        this.config.windDirection = { x, y, z };

        // 如果当前是风速效果，重新设置粒子
        if (this.currentEffect === 'wind') {
            const effectConfig = EnvironmentEffect.EFFECT_CONFIGS.wind;
            this.setupParticlesForEffect('wind', effectConfig);
        }
    }

    /**
     * 组件销毁
     */
    onDispose() {
        console.log('[EnvironmentEffect] 销毁组件');

        // 从场景移除
        if (this.particles) {
            this.scene.scene.remove(this.particles);
        }

        // 释放几何体
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }

        // 释放材质
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }

        // 释放纹理
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }

        // 清空引用
        this.particles = null;
        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.velocities = null;
        this.opacities = null;
    }
}

export default EnvironmentEffect;
