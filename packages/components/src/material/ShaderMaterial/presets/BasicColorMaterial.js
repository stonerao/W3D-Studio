import * as THREE from 'three';

/**
 * English comment.
 */
export function createBasicColorMaterial(params = {}) {
    const {
        color = '#00ff00'
    } = params;

    return {
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying vec2 vUv;
            varying vec3 vNormal;
            
            void main() {
                // English comment.
                vec3 light = normalize(vec3(1.0, 1.0, 1.0));
                float dProd = max(0.0, dot(vNormal, light));
                
                // English comment.
                vec3 finalColor = color * (0.3 + 0.7 * dProd);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        uniforms: {
            color: { value: new THREE.Color(color) }
        },
        side: THREE.DoubleSide
    };
}

/**
 * English comment.
 */
export function getBasicColorMaterialDefaults() {
    return {
        color: '#00ff00'
    };
}

/**
 * English comment.
 */
export const BasicColorMaterialMeta = {
    name: 'basicColor',
    displayName: '基础颜色材质',
    description: '单色着色材质，带有简单的漫反射光照效果',
    params: {
        color: {
            type: 'color',
            default: '#00ff00',
            description: '材质颜色'
        }
    }
};

