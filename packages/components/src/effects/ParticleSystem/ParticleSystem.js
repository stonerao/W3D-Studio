import { Component } from '@w3d/core';
import * as THREE from 'three';

/**
 * Effects module component that renders configurable particle emitters for atmosphere, flow, and visual feedback.
 */
export class ParticleSystem extends Component {
    static defaultConfig = {
        //        'stars' | 'fountain' | 'waterfall' | 'splash' |
        //        'campfire' | 'lava' | 'raindrops' | 'snowflakes' |
        //        'leaves' | 'cloud' | 'steam' | 'starfield' | 'nebula'
        preset: '',

        count: 1000,
        size: 1.0,
        color: '#ffffff',
        opacity: 0.8,
        lifetime: 5.0,
        speedCoefficient: 1.0,

        colorEnd: '',
        sizeEnd: 0,
        opacityEnd: 0,

        emitter: {
            shape: 'point',        // 'point' | 'sphere' | 'box' | 'cone'
            position: [0, 0, 0],
            range: 1.0,
            width: null,
            height: null,
            depth: null,
            rate: 100,
            autoStart: true,
            direction: [0, 1, 0],
            spread: 90
        },

        physics: {
            gravity: -9.8,
            damping: 0.98,
            velocity: { min: 2, max: 8 },
            rotationSpeed: { min: 0, max: 0 }
        },

        blending: 'additive',  // 'normal' | 'additive' | 'multiply' | 'screen'
        transparent: true,
        sizeAttenuation: true,

        texture: null,
        textureRepeat: [1, 1],
        textureOffset: [0, 0],

        useCustomShader: false,
        shaderType: 'glow',    // 'glow' | 'sparkle' | 'fire' | 'smoke'
        depthWrite: false,

        shaderUniforms: {
            uTime: 0.0,
            uGlowIntensity: 1.0,
            uSparkleFrequency: 10.0,
            uNoiseScale: 1.0
        }
    };

    onMounted() {
        this.textureLoader = new THREE.TextureLoader();
        this.loadedTexture = null;
        this.isTextureLoading = false;

        this._presetChangeTimer = null;
        this._lastPresetChangeTime = 0;
        this._presetChangeDebounceDelay = 100;

        this.initializeParticleSystem();

        this.clock = new THREE.Clock();

        this.isEmitting = this.config.emitter.autoStart;

        this.stats = {
            activeParticles: 0,
            totalEmitted: 0
        };

        if (this.config.texture) {
            this.loadTexture(this.config.texture);
        }
    }

    initializeParticleSystem() {
        const count = this.config.count;

        this.particles = [];
        this.emissionAccumulator = 0;

        this.geometry = new THREE.BufferGeometry();

        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const particle = {
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: this.config.lifetime,
                size: this.config.size,
                active: false
            };
            this.particles.push(particle);

            const i3 = i * 3;
            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;

            const color = new THREE.Color(this.config.color);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;

            sizes[i] = particle.size;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this.createMaterial();

        this.particlePoints = new THREE.Points(this.geometry, this.material);
        this.componentScene.add(this.particlePoints);

        console.log(this.componentScene);
    }

    getBlendingMode(mode) {
        switch (mode) {
            case 'additive':
                return THREE.AdditiveBlending;
            case 'multiply':
                return THREE.MultiplyBlending;
            case 'screen':
                return THREE.CustomBlending;
            default:
                return THREE.NormalBlending;
        }
    }

    createMaterial() {
        if (this.config.useCustomShader) {
            this.material = this.createShaderMaterial();
        } else {
            this.material = this.createPointsMaterial();
        }
    }

    createPointsMaterial() {
        const materialConfig = {
            size: this.config.size,
            color: new THREE.Color(this.config.color),
            transparent: this.config.transparent,
            opacity: this.config.opacity,
            blending: this.getBlendingMode(this.config.blending),
            vertexColors: true,
            sizeAttenuation: this.config.sizeAttenuation,
            depthWrite: this.config.depthWrite
        };

        if (this.loadedTexture) {
            materialConfig.map = this.loadedTexture;
            materialConfig.alphaMap = this.loadedTexture;
        }

        return new THREE.PointsMaterial(materialConfig);
    }

    createShaderMaterial() {
        const shaderConfig = this.getShaderConfig(this.config.shaderType);

        const uniforms = {
            uTime: { value: this.config.shaderUniforms.uTime },
            uTexture: { value: this.loadedTexture },
            uColor: { value: new THREE.Color(this.config.color) },
            uOpacity: { value: this.config.opacity },
            uSize: { value: this.config.size },
            ...shaderConfig.uniforms
        };

        return new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: shaderConfig.vertexShader,
            fragmentShader: shaderConfig.fragmentShader,
            transparent: this.config.transparent,
            blending: this.getBlendingMode(this.config.blending),
            depthWrite: this.config.depthWrite,
            vertexColors: true
        });
    }

    getShaderConfig(shaderType) {
        const configs = {
            glow: {
                uniforms: {
                    uGlowIntensity: { value: this.config.shaderUniforms.uGlowIntensity }
                },
                vertexShader: this.getGlowVertexShader(),
                fragmentShader: this.getGlowFragmentShader()
            },
            sparkle: {
                uniforms: {
                    uSparkleFrequency: { value: this.config.shaderUniforms.uSparkleFrequency }
                },
                vertexShader: this.getSparkleVertexShader(),
                fragmentShader: this.getSparkleFragmentShader()
            },
            fire: {
                uniforms: {
                    uNoiseScale: { value: this.config.shaderUniforms.uNoiseScale }
                },
                vertexShader: this.getFireVertexShader(),
                fragmentShader: this.getFireFragmentShader()
            },
            smoke: {
                uniforms: {
                    uNoiseScale: { value: this.config.shaderUniforms.uNoiseScale }
                },
                vertexShader: this.getSmokeVertexShader(),
                fragmentShader: this.getSmokeFragmentShader()
            }
        };

        return configs[shaderType] || configs.glow;
    }

    loadTexture(texturePath) {
        if (this.isTextureLoading) return;

        this.isTextureLoading = true;
        this.emit('textureLoadStart', { path: texturePath });

        this.textureLoader.load(
            texturePath,
            (texture) => {
                this.loadedTexture = texture;
                this.loadedTexture.wrapS = THREE.RepeatWrapping;
                this.loadedTexture.wrapT = THREE.RepeatWrapping;
                this.loadedTexture.repeat.set(...this.config.textureRepeat);
                this.loadedTexture.offset.set(...this.config.textureOffset);

                this.updateMaterialTexture();

                this.isTextureLoading = false;
                this.emit('textureLoaded', { texture: this.loadedTexture, path: texturePath });
            },
            (progress) => {
                this.emit('textureLoadProgress', {
                    progress: (progress.loaded / progress.total) * 100,
                    path: texturePath
                });
            },
            (error) => {
                console.error('纹理加载失败:', error);
                this.isTextureLoading = false;
                this.emit('textureLoadError', { error, path: texturePath });
            }
        );
    }

    updateMaterialTexture() {
        if (!this.material) return;

        if (this.material.isShaderMaterial) {
            this.material.uniforms.uTexture.value = this.loadedTexture;
        } else {
            this.material.map = this.loadedTexture;
            this.material.alphaMap = this.loadedTexture;
            this.material.needsUpdate = true;
        }
    }

    /**
     * Glow Vertex Shader
     */
    getGlowVertexShader() {
        return `
            attribute float size;
            attribute vec3 color;

            uniform float uTime;
            uniform float uSize;

            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vColor = color;

                float life = 1.0 - (uTime * 0.1);
                vAlpha = smoothstep(0.0, 0.3, life) * smoothstep(1.0, 0.7, life);

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * uSize * (300.0 / -mvPosition.z);

                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }

    /**
     * Glow Fragment Shader
     */
    getGlowFragmentShader() {
        return `
            uniform sampler2D uTexture;
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uGlowIntensity;

            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                float glow = 1.0 - smoothstep(0.0, 0.5, dist);
                glow = pow(glow, 2.0) * uGlowIntensity;

                vec4 texColor = vec4(1.0);
                if (uTexture != null) {
                    texColor = texture2D(uTexture, gl_PointCoord);
                }

                vec3 finalColor = vColor * uColor * glow;
                float finalAlpha = vAlpha * uOpacity * texColor.a * glow;

                gl_FragColor = vec4(finalColor, finalAlpha);
            }
        `;
    }

    /**
     * Sparkle Vertex Shader
     */
    getSparkleVertexShader() {
        return `
            attribute float size;
            attribute vec3 color;

            uniform float uTime;
            uniform float uSize;
            uniform float uSparkleFrequency;

            varying vec3 vColor;
            varying float vAlpha;
            varying float vSparkle;

            void main() {
                vColor = color;

                float sparkle = sin(uTime * uSparkleFrequency + position.x * 10.0) * 0.5 + 0.5;
                vSparkle = sparkle;
                vAlpha = sparkle;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * uSize * (300.0 / -mvPosition.z) * (0.5 + sparkle * 0.5);

                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }

    /**
     * Sparkle Fragment Shader
     */
    getSparkleFragmentShader() {
        return `
            uniform sampler2D uTexture;
            uniform vec3 uColor;
            uniform float uOpacity;

            varying vec3 vColor;
            varying float vAlpha;
            varying float vSparkle;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                float angle = atan(center.y, center.x);
                float star = abs(sin(angle * 4.0)) * 0.5 + 0.5;
                float sparkle = (1.0 - smoothstep(0.0, 0.4, dist)) * star * vSparkle;

                vec4 texColor = vec4(1.0);
                if (uTexture != null) {
                    texColor = texture2D(uTexture, gl_PointCoord);
                }

                vec3 finalColor = vColor * uColor * sparkle;
                float finalAlpha = vAlpha * uOpacity * texColor.a * sparkle;

                gl_FragColor = vec4(finalColor, finalAlpha);
            }
        `;
    }

    /**
     * Fire Vertex Shader
     */
    getFireVertexShader() {
        return `
            attribute float size;
            attribute vec3 color;

            uniform float uTime;
            uniform float uSize;
            uniform float uNoiseScale;

            varying vec3 vColor;
            varying float vAlpha;
            varying vec2 vUv;

            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                vColor = color;
                vUv = uv;

                vec3 pos = position;
                float n = noise(pos.xz * uNoiseScale + uTime * 0.5);
                pos.x += sin(uTime * 2.0 + n * 10.0) * 0.5;
                pos.y += uTime * 2.0;

                float heightFade = 1.0 - smoothstep(0.0, 10.0, pos.y);
                vAlpha = heightFade;

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * uSize * (300.0 / -mvPosition.z);

                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }

    /**
     * Fire Fragment Shader
     */
    getFireFragmentShader() {
        return `
            uniform sampler2D uTexture;
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uTime;

            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                float flame = 1.0 - smoothstep(0.0, 0.5, dist);
                flame *= (sin(uTime * 5.0) * 0.1 + 0.9);

                vec3 fireColor = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 0.0), flame);
                fireColor = mix(fireColor, vColor, 0.5);

                vec4 texColor = vec4(1.0);
                if (uTexture != null) {
                    texColor = texture2D(uTexture, gl_PointCoord);
                }

                vec3 finalColor = fireColor * uColor * flame;
                float finalAlpha = vAlpha * uOpacity * texColor.a * flame;

                gl_FragColor = vec4(finalColor, finalAlpha);
            }
        `;
    }

    /**
     * Smoke Vertex Shader
     */
    getSmokeVertexShader() {
        return `
            attribute float size;
            attribute vec3 color;

            uniform float uTime;
            uniform float uSize;
            uniform float uNoiseScale;

            varying vec3 vColor;
            varying float vAlpha;

            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                vColor = color;

                vec3 pos = position;
                float n1 = noise(pos.xz * uNoiseScale + uTime * 0.3);
                float n2 = noise(pos.xz * uNoiseScale * 2.0 + uTime * 0.2);

                pos.x += (n1 - 0.5) * 2.0;
                pos.z += (n2 - 0.5) * 2.0;
                pos.y += uTime * 1.0;

                float heightFade = 1.0 - smoothstep(0.0, 15.0, pos.y);
                vAlpha = heightFade * 0.6;

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * uSize * (300.0 / -mvPosition.z) * (1.0 + pos.y * 0.1);

                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }

    /**
     * Smoke Fragment Shader
     */
    getSmokeFragmentShader() {
        return `
            uniform sampler2D uTexture;
            uniform vec3 uColor;
            uniform float uOpacity;

            varying vec3 vColor;
            varying float vAlpha;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                float smoke = 1.0 - smoothstep(0.0, 0.5, dist);
                smoke = pow(smoke, 0.5);

                vec3 smokeColor = mix(vec3(0.3, 0.3, 0.3), vec3(0.8, 0.8, 0.8), smoke);
                smokeColor = mix(smokeColor, vColor, 0.3);

                vec4 texColor = vec4(1.0);
                if (uTexture != null) {
                    texColor = texture2D(uTexture, gl_PointCoord);
                }

                vec3 finalColor = smokeColor * uColor;
                float finalAlpha = vAlpha * uOpacity * texColor.a * smoke;

                gl_FragColor = vec4(finalColor, finalAlpha);
            }
        `;
    }

    onUpdate(deltaTime) {
        if (!this.particles || !this.geometry) return;

        if (this.material && this.material.isShaderMaterial) {
            this.material.uniforms.uTime.value += deltaTime;
        }

        this.updateParticles(deltaTime);

        if (this.isEmitting) {
            this.emitParticles(deltaTime);
        }

        this.updateGeometry();
    }

    updateParticles(deltaTime) {
        let activeCount = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            if (!particle.active) continue;

            particle.life += deltaTime;

            if (particle.life >= particle.maxLife) {
                particle.active = false;
                continue;
            }

            activeCount++;

            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

            particle.velocity.y += this.config.physics.gravity * deltaTime;

            particle.velocity.multiplyScalar(this.config.physics.damping);
        }

        this.stats.activeParticles = activeCount;
    }

    emitParticles(deltaTime) {
        this.emissionAccumulator += this.config.emitter.rate * deltaTime;

        const emitCount = Math.floor(this.emissionAccumulator);
        this.emissionAccumulator -= emitCount;

        for (let i = 0; i < emitCount; i++) {
            this.emitSingleParticle();
        }
    }

    emitSingleParticle() {
        const particle = this.particles.find((p) => !p.active);
        if (!particle) return;

        particle.active = true;
        particle.life = 0;
        particle.maxLife = this.config.lifetime * (0.8 + Math.random() * 0.4);

        this.setParticlePosition(particle);

        this.setParticleVelocity(particle);

        particle.size = this.config.size * (0.5 + Math.random() * 0.5);

        this.stats.totalEmitted++;
    }

    setParticlePosition(particle) {
        const emitter = this.config.emitter;
        const pos = emitter.position;
        const range = emitter.range;

        switch (emitter.shape) {
            case 'point':
                particle.position.set(pos[0], pos[1], pos[2]);
                break;

            case 'sphere':
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const radius = Math.random() * range;
                particle.position.set(
                    pos[0] + radius * Math.sin(theta) * Math.cos(phi),
                    pos[1] + radius * Math.cos(theta),
                    pos[2] + radius * Math.sin(theta) * Math.sin(phi)
                );
                break;

            case 'box': {
                const bw = emitter.width  ?? range * 2;
                const bh = emitter.height ?? range * 2;
                const bd = emitter.depth  ?? range * 2;
                particle.position.set(
                    pos[0] + (Math.random() - 0.5) * bw,
                    pos[1] + (Math.random() - 0.5) * bh,
                    pos[2] + (Math.random() - 0.5) * bd
                );
                break;
            }

            case 'cone':
                const angle = Math.random() * Math.PI * 2;
                const radius2 = Math.random() * range;
                particle.position.set(
                    pos[0] + radius2 * Math.cos(angle),
                    pos[1],
                    pos[2] + radius2 * Math.sin(angle)
                );
                break;
        }
    }

    setParticleVelocity(particle) {
        const velocity = this.config.physics.velocity;
        const speedCoefficient = this.config.speedCoefficient ?? 1.0;
        const speed = (velocity.min + Math.random() * (velocity.max - velocity.min)) * speedCoefficient;

        const dir = this.config.emitter?.direction ?? [0, 1, 0];
        const spreadDeg = this.config.emitter?.spread ?? 90;
        const spreadRad = Math.min(spreadDeg, 180) * Math.PI / 180;

        const baseDir = new THREE.Vector3(dir[0], dir[1], dir[2]);
        if (baseDir.lengthSq() < 1e-6) baseDir.set(0, 1, 0);
        baseDir.normalize();

        const up = Math.abs(baseDir.y) < 0.99
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0);
        const perpX = new THREE.Vector3().crossVectors(baseDir, up).normalize();
        const perpZ = new THREE.Vector3().crossVectors(baseDir, perpX).normalize();

        const cosMax = Math.cos(spreadRad);
        const cosAngle = cosMax + Math.random() * (1 - cosMax);
        const sinAngle = Math.sqrt(1 - cosAngle * cosAngle);
        const azimuth = Math.random() * Math.PI * 2;

        particle.velocity
            .copy(baseDir).multiplyScalar(cosAngle)
            .addScaledVector(perpX, sinAngle * Math.cos(azimuth))
            .addScaledVector(perpZ, sinAngle * Math.sin(azimuth))
            .normalize()
            .multiplyScalar(speed);

        const rot = this.config.physics?.rotationSpeed;
        if (rot && (rot.min !== 0 || rot.max !== 0)) {
            particle.rotationSpeed = rot.min + Math.random() * (rot.max - rot.min);
        } else {
            particle.rotationSpeed = 0;
        }
    }

    updateGeometry() {
        const positions = this.geometry.attributes.position.array;
        const colors = this.geometry.attributes.color.array;
        const sizes = this.geometry.attributes.size.array;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const i3 = i * 3;

            if (particle.active) {
                positions[i3] = particle.position.x;
                positions[i3 + 1] = particle.position.y;
                positions[i3 + 2] = particle.position.z;

                const lifeRatio = particle.life / particle.maxLife;

                const sizeStart = particle.size;
                const sizeEnd   = this.config.sizeEnd ?? 0;
                const curSize   = sizeStart + (sizeEnd - sizeStart) * lifeRatio;
                sizes[i] = Math.max(0, curSize);

                const opStart = this.config.opacity   ?? 0.8;
                const opEnd   = this.config.opacityEnd ?? 0;
                const alpha   = opStart + (opEnd - opStart) * lifeRatio;

                const startColor = new THREE.Color(this.config.color);
                const endColor   = this.config.colorEnd
                    ? new THREE.Color(this.config.colorEnd)
                    : null;
                const lerpedColor = endColor
                    ? startColor.clone().lerp(endColor, lifeRatio)
                    : startColor;

                colors[i3]     = lerpedColor.r * alpha;
                colors[i3 + 1] = lerpedColor.g * alpha;
                colors[i3 + 2] = lerpedColor.b * alpha;
            } else {
                sizes[i] = 0;
                colors[i3] = 0;
                colors[i3 + 1] = 0;
                colors[i3 + 2] = 0;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
    }
    startEmission() {
        this.isEmitting = true;
    }

    stopEmission() {
        this.isEmitting = false;
    }

    toggleEmission() {
        this.isEmitting = !this.isEmitting;
        return this.isEmitting;
    }

    clearParticles() {
        if (!this.particles) return;

        this.particles.forEach((particle) => {
            particle.active = false;
            particle.life = 0;
            particle.position.set(0, 0, 0);
            particle.velocity.set(0, 0, 0);
        });
        this.stats.activeParticles = 0;
        this.stats.totalEmitted = 0;

        if (this.geometry) {
            const positions = this.geometry.attributes.position.array;
            const colors = this.geometry.attributes.color.array;
            const sizes = this.geometry.attributes.size.array;

            for (let i = 0; i < this.particles.length; i++) {
                const i3 = i * 3;
                positions[i3] = 0;
                positions[i3 + 1] = 0;
                positions[i3 + 2] = 0;
                sizes[i] = 0;
            }

            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.size.needsUpdate = true;
        }
    }

    reset() {
        this.clearParticles();
        this.stats.totalEmitted = 0;
        this.emissionAccumulator = 0;
        this.isEmitting = this.config.emitter.autoStart;
    }

    updateConfig(newConfig) {
        if (
            newConfig.preset !== undefined &&
            newConfig.preset !== '' &&
            newConfig.preset !== this.config.preset &&
            !this._applyingPreset
        ) {
            this._applyingPreset = true;
            this.config.preset = newConfig.preset;
            this.setPreset(newConfig.preset);
            this._applyingPreset = false;
            return;
        }

        const oldCount   = this.config.count;
        const oldTexture = this.config.texture;

        const flattenKeys = (obj, prefix = '') => {
            const keys = {};
            for (const k in obj) {
                const full = prefix ? `${prefix}.${k}` : k;
                if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
                    Object.assign(keys, flattenKeys(obj[k], full));
                } else {
                    keys[full] = obj[k];
                }
            }
            return keys;
        };
        const flat = flattenKeys(newConfig);

        this.config = this.mergeConfig(this.config, newConfig);

        const newCount = this.config.count;
        if (newCount !== oldCount && newCount > 0) {
            const wasEmitting = this.isEmitting;
            this.isEmitting = false;

            if (this.particlePoints) {
                this.componentScene.remove(this.particlePoints);
                this.particlePoints = null;
            }
            if (this.geometry) { this.geometry.dispose(); this.geometry = null; }
            if (this.material) { this.material.dispose(); this.material = null; }

            this.particles = [];
            this.emissionAccumulator = 0;
            this.stats.activeParticles = 0;
            this.stats.totalEmitted = 0;

            this.initializeParticleSystem();
            this.isEmitting = wasEmitting;
            return;
        }

        const materialDirtyKeys = [
            'useCustomShader', 'shaderType', 'blending',
            'color', 'opacity', 'size',
            'transparent', 'depthWrite', 'sizeAttenuation'
        ];
        const needsRecreateMaterial = materialDirtyKeys.some((k) => k in flat);

        if (needsRecreateMaterial) {
            if (this.material) {
                this.material.dispose();
                this.material = null;
            }
            this.createMaterial();
            if (this.particlePoints) {
                this.particlePoints.material = this.material;
            }
        } else if (this.material) {
            if (this.material.isShaderMaterial) {
                if ('color' in flat)   this.material.uniforms.uColor?.value?.setStyle?.(this.config.color);
                if ('opacity' in flat) this.material.uniforms.uOpacity && (this.material.uniforms.uOpacity.value = this.config.opacity);
                if ('size' in flat)    this.material.uniforms.uSize    && (this.material.uniforms.uSize.value   = this.config.size);
                if (newConfig.shaderUniforms) {
                    Object.keys(newConfig.shaderUniforms).forEach((k) => {
                        if (this.material.uniforms[k]) this.material.uniforms[k].value = newConfig.shaderUniforms[k];
                    });
                }
            } else {
                if ('color' in flat)   this.material.color?.setStyle?.(this.config.color);
                if ('size' in flat)    this.material.size    = this.config.size;
                if ('opacity' in flat) this.material.opacity = this.config.opacity;
            }
            this.material.needsUpdate = true;
        }

        if ('texture' in flat) {
            const nextTexture = this.config.texture;
            if (nextTexture && nextTexture !== oldTexture) {
                this.loadTexture(nextTexture);
            } else if (!nextTexture && this.loadedTexture) {
                this.loadedTexture.dispose?.();
                this.loadedTexture = null;
                this.updateMaterialTexture();
            }
        }

        if (this.loadedTexture) {
            if (newConfig.textureRepeat) this.loadedTexture.repeat.set(...this.config.textureRepeat);
            if (newConfig.textureOffset) this.loadedTexture.offset.set(...this.config.textureOffset);
        }

    }

    getStats() {
        return {
            ...this.stats,
            isEmitting: this.isEmitting,
            totalParticles: this.particles.length
        };
    }

    setPreset(presetName) {
        if (this._presetChangeTimer) {
            clearTimeout(this._presetChangeTimer);
            this._presetChangeTimer = null;
        }

        const now = Date.now();
        if (now - this._lastPresetChangeTime < this._presetChangeDebounceDelay) {
            this._presetChangeTimer = setTimeout(() => {
                this.setPreset(presetName);
            }, this._presetChangeDebounceDelay);
            return;
        }
        this._lastPresetChangeTime = now;

        const presets = {
            fire: {
                color: '#ff4500',
                size: 1.5,
                lifetime: 3.0,
                emitter: {
                    shape: 'point',
                    rate: 200
                },
                physics: {
                    gravity: -2,
                    velocity: { min: 3, max: 8 }
                },
                blending: 'additive'
            },
            smoke: {
                color: '#888888',
                size: 2.0,
                lifetime: 8.0,
                emitter: {
                    shape: 'sphere',
                    range: 0.5,
                    rate: 50
                },
                physics: {
                    gravity: -1,
                    velocity: { min: 1, max: 3 }
                },
                blending: 'normal'
            },
            rain: {
                color: '#4169e1',
                size: 0.5,
                lifetime: 4.0,
                emitter: {
                    shape: 'box',
                    range: 10,
                    position: [0, 10, 0],
                    rate: 500
                },
                physics: {
                    gravity: -20,
                    velocity: { min: 8, max: 12 }
                },
                blending: 'normal'
            },
            snow: {
                color: '#ffffff',
                size: 1.0,
                lifetime: 10.0,
                emitter: {
                    shape: 'box',
                    range: 8,
                    position: [0, 8, 0],
                    rate: 100
                },
                physics: {
                    gravity: -2,
                    velocity: { min: 0.5, max: 2 }
                },
                blending: 'normal'
            },
            stars: {
                color: '#ffff00',
                size: 2.0,
                lifetime: 6.0,
                emitter: {
                    shape: 'sphere',
                    range: 5,
                    rate: 30
                },
                physics: {
                    gravity: 0,
                    velocity: { min: 0.1, max: 0.5 }
                },
                blending: 'additive'
            },
            explosion: {
                color: '#ff6600',
                size: 1.5,
                lifetime: 2.0,
                emitter: {
                    shape: 'point',
                    rate: 1000
                },
                physics: {
                    gravity: -5,
                    velocity: { min: 10, max: 20 }
                },
                blending: 'additive'
            },
            fountain: {
                color: '#00bfff',
                size: 0.8,
                lifetime: 4.0,
                emitter: {
                    shape: 'point',
                    position: [0, 0, 0],
                    rate: 150
                },
                physics: {
                    gravity: -12,
                    damping: 0.98,
                    velocity: { min: 8, max: 15 }
                },
                blending: 'normal',
                opacity: 0.7
            },
            waterfall: {
                color: '#87ceeb',
                size: 0.6,
                lifetime: 5.0,
                emitter: {
                    shape: 'box',
                    range: 3,
                    position: [0, 8, 0],
                    rate: 400
                },
                physics: {
                    gravity: -18,
                    damping: 0.99,
                    velocity: { min: 5, max: 8 }
                },
                blending: 'normal',
                opacity: 0.6
            },
            splash: {
                color: '#1e90ff',
                size: 0.5,
                lifetime: 1.5,
                emitter: {
                    shape: 'point',
                    position: [0, 0, 0],
                    rate: 300
                },
                physics: {
                    gravity: -15,
                    damping: 0.95,
                    velocity: { min: 8, max: 18 }
                },
                blending: 'normal',
                opacity: 0.8
            },
            campfire: {
                color: '#ff6347',
                size: 1.2,
                lifetime: 3.5,
                emitter: {
                    shape: 'sphere',
                    range: 0.3,
                    position: [0, 0, 0],
                    rate: 120
                },
                physics: {
                    gravity: -3,
                    damping: 0.96,
                    velocity: { min: 2, max: 6 }
                },
                blending: 'additive',
                opacity: 0.9
            },
            lava: {
                color: '#ff4500',
                size: 1.8,
                lifetime: 2.5,
                emitter: {
                    shape: 'point',
                    position: [0, 0, 0],
                    rate: 80
                },
                physics: {
                    gravity: -8,
                    damping: 0.92,
                    velocity: { min: 10, max: 20 }
                },
                blending: 'additive',
                opacity: 1.0
            },
            raindrops: {
                color: '#4682b4',
                size: 0.4,
                lifetime: 3.5,
                emitter: {
                    shape: 'box',
                    range: 12,
                    position: [0, 12, 0],
                    rate: 600
                },
                physics: {
                    gravity: -25,
                    damping: 1.0,
                    velocity: { min: 10, max: 15 }
                },
                blending: 'normal',
                opacity: 0.7
            },
            snowflakes: {
                color: '#f0f8ff',
                size: 1.2,
                lifetime: 12.0,
                emitter: {
                    shape: 'box',
                    range: 10,
                    position: [0, 10, 0],
                    rate: 80
                },
                physics: {
                    gravity: -1.5,
                    damping: 0.99,
                    velocity: { min: 0.3, max: 1.5 }
                },
                blending: 'normal',
                opacity: 0.9
            },
            leaves: {
                color: '#8b4513',
                size: 1.5,
                lifetime: 8.0,
                emitter: {
                    shape: 'box',
                    range: 6,
                    position: [0, 8, 0],
                    rate: 40
                },
                physics: {
                    gravity: -3,
                    damping: 0.97,
                    velocity: { min: 1, max: 3 }
                },
                blending: 'normal',
                opacity: 0.85
            },
            cloud: {
                color: '#d3d3d3',
                size: 3.0,
                lifetime: 15.0,
                emitter: {
                    shape: 'sphere',
                    range: 2,
                    position: [0, 5, 0],
                    rate: 20
                },
                physics: {
                    gravity: -0.5,
                    damping: 0.99,
                    velocity: { min: 0.2, max: 0.8 }
                },
                blending: 'normal',
                opacity: 0.5
            },
            steam: {
                color: '#e0e0e0',
                size: 1.5,
                lifetime: 6.0,
                emitter: {
                    shape: 'sphere',
                    range: 0.4,
                    position: [0, 0, 0],
                    rate: 60
                },
                physics: {
                    gravity: -2,
                    damping: 0.98,
                    velocity: { min: 2, max: 5 }
                },
                blending: 'normal',
                opacity: 0.6
            },
            starfield: {
                color: '#fffacd',
                size: 1.5,
                lifetime: 8.0,
                emitter: {
                    shape: 'sphere',
                    range: 15,
                    position: [0, 0, 0],
                    rate: 50
                },
                physics: {
                    gravity: 0,
                    damping: 1.0,
                    velocity: { min: 0.05, max: 0.2 }
                },
                blending: 'additive',
                opacity: 0.9
            },
            nebula: {
                color: '#9370db',
                size: 4.0,
                lifetime: 20.0,
                emitter: {
                    shape: 'sphere',
                    range: 8,
                    position: [0, 0, 0],
                    rate: 15
                },
                physics: {
                    gravity: 0,
                    damping: 0.995,
                    velocity: { min: 0.1, max: 0.5 }
                },
                blending: 'additive',
                opacity: 0.7
            }
        };

        const preset = presets[presetName];
        if (preset) {
            this.isEmitting = false;

            this.clearParticles();

            this.emissionAccumulator = 0;
            this.stats.activeParticles = 0;
            this.stats.totalEmitted = 0;

            if (this.clock) {
                this.clock = new THREE.Clock();
            }

            if (this.material && this.material.isShaderMaterial && this.material.uniforms.uTime) {
                this.material.uniforms.uTime.value = 0;
            }

            if (this.material) {
                this.material.dispose();
                this.material = null;
            }

            this.updateConfig(preset);

            if (this.particlePoints && this.material) {
                this.particlePoints.material = this.material;
            }

            if (this.geometry) {
                this.geometry.attributes.position.needsUpdate = true;
                this.geometry.attributes.color.needsUpdate = true;
                this.geometry.attributes.size.needsUpdate = true;
            }

            this.isEmitting = this.config.emitter.autoStart !== false;

            if (presetName === 'explosion') {
                this.isEmitting = true;
                setTimeout(() => {
                    this.stopEmission();
                }, 200);
            }

            console.log(`[ParticleSystem] Preset changed to: ${presetName}`);
        }
    }

    mergeConfig(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.mergeConfig(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    onDispose() {
        if (this._presetChangeTimer) {
            clearTimeout(this._presetChangeTimer);
            this._presetChangeTimer = null;
        }

        if (this.geometry) {
            this.geometry.dispose();
        }

        if (this.material) {
            this.material.dispose();
        }

        if (this.particlePoints) {
            this.componentScene.remove(this.particlePoints);
        }

        if (this.loadedTexture) {
            this.loadedTexture.dispose();
        }

        this.particles = null;
        this.geometry = null;
        this.material = null;
        this.particlePoints = null;
        this.clock = null;
        this.textureLoader = null;
        this.loadedTexture = null;
    }
}

export default ParticleSystem;
