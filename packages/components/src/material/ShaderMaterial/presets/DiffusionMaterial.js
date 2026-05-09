import * as THREE from 'three';

/**
 * English comment.
 */
export function createDiffusionMaterial(params = {}) {
    const {
        speed = 1.0,
        intensity = 1.0,
        baseColor = '#3319cc', // English comment.
        noiseTexture = '/images/n_3.png'
    } = params;

    // English comment.
    const textureLoader = new THREE.TextureLoader();
    const noiseTextureObj = textureLoader.load(noiseTexture);
    noiseTextureObj.wrapS = THREE.RepeatWrapping;
    noiseTextureObj.wrapT = THREE.RepeatWrapping;

    return {
        vertexShader: `
            varying vec2 vUv;
            varying vec2 vPosition;

            void main() {
                vUv = uv;
                // English comment.
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vPosition = mvPosition.xy;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec2 uResolution;
            uniform sampler2D uNoiseTexture;
            uniform float uSpeed;
            uniform float uIntensity;
            uniform vec3 uBaseColor;

            varying vec2 vUv;
            varying vec2 vPosition;

            #define tau 6.2831853

            // English comment.
            mat2 makem2(in float theta) {
                float c = cos(theta);
                float s = sin(theta);
                return mat2(c, -s, s, c);
            }

            // English comment.
            float noise(in vec2 x) {
                return texture2D(uNoiseTexture, x * 0.01).x;
            }

            // English comment.
            // English comment.
            float fbm(in vec2 p) {
                float z = 2.0;
                float rz = 0.0;
                vec2 bp = p;

                // English comment.
                for (float i = 1.0; i < 6.0; i++) {
                    // English comment.
                    rz += abs((noise(p) - 0.5) * 2.0) / z;
                    z = z * 2.0;
                    p = p * 2.0;
                }
                return rz;
            }

            // English comment.
            // English comment.
            float dualfbm(in vec2 p, float time) {
                // English comment.
                vec2 p2 = p * 0.7;
                vec2 basis = vec2(
                    fbm(p2 - time * 1.6),
                    fbm(p2 + time * 1.7)
                );
                basis = (basis - 0.5) * 0.2;
                p += basis;

                // English comment.
                return fbm(p * makem2(time * 0.2));
            }

            // English comment.
            // English comment.
            float circ(vec2 p) {
                float r = length(p);
                r = log(sqrt(r));
                return abs(mod(r * 4.0, tau) - 3.14) * 3.0 + 0.2;
            }

            void main() {
                // English comment.
                float uTime = time * 0.15 * uSpeed;

                // English comment.
                vec2 p = vUv - 0.5;

                // English comment.
                // English comment.
                if (uResolution.x > 0.0 && uResolution.y > 0.0) {
                    p.x *= uResolution.x / uResolution.y;
                }

                // English comment.
                p *= 4.0;

                // English comment.
                float rz = dualfbm(p, uTime);

                // English comment.
                p /= exp(mod(uTime * 10.0, 3.14159));

                // English comment.
                rz *= pow(abs(0.1 - circ(p)), 0.9);

                // English comment.
                // English comment.
                vec3 col = (uBaseColor * uIntensity) / rz;

                // English comment.
                col = pow(abs(col), vec3(0.99));

                gl_FragColor = vec4(col, 1.0);
            }
        `,
        uniforms: {
            time: { value: 0.0 }, // English comment.
            uResolution: { value: new THREE.Vector2(512, 512) },
            uNoiseTexture: { value: noiseTextureObj },
            uSpeed: { value: speed },
            uIntensity: { value: intensity },
            uBaseColor: { value: new THREE.Color(baseColor) }
        },
        side: THREE.DoubleSide,
        // English comment.
        transparent: false,
        depthWrite: true
    };
}

/**
 * English comment.
 */
export function getDiffusionMaterialDefaults() {
    return {
        speed: 1.0,
        intensity: 1.0,
        baseColor: '#3319cc',
        noiseTexture: '/images/n_3.png'
    };
}

/**
 * English comment.
 */
export const DiffusionMaterialMeta = {
    name: 'diffusion',
    displayName: '扩散材质',
    description: '电流扩散效果材质，使用双重分形布朗运动和噪声纹理创建复杂的动画效果',
    author: 'Based on "Noise animation - Electric" by nimitz (stormoid.com)',
    license: 'CC BY-NC-SA 3.0',
    params: {
        speed: {
            type: 'number',
            default: 1.0,
            min: 0.1,
            max: 5.0,
            step: 0.1,
            description: '动画速度'
        },
        intensity: {
            type: 'number',
            default: 1.0,
            min: 0.1,
            max: 3.0,
            step: 0.1,
            description: '效果强度'
        },
        baseColor: {
            type: 'color',
            default: '#3319cc',
            description: '基础颜色'
        },
        noiseTexture: {
            type: 'string',
            default: '/images/n_3.png',
            description: '噪声纹理路径'
        }
    }
};
