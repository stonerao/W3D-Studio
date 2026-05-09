/**
 * English comment.
 */

import * as THREE from 'three';

// English comment.
const vertexShader = /* glsl */ `

// English comment.
#ifdef USE_LOGDEPTHBUF
    #ifdef USE_LOGDEPTHBUF_EXT
        varying float vFragDepth;
        varying float vIsPerspective;
    #else
        uniform float logDepthBufFC;
    #endif
#endif

// English comment.
#ifdef USE_FOG
    varying float vFogDepth;
#endif

// English comment.
attribute vec3 previous;
attribute vec3 next;
attribute float side;
attribute float width;
attribute float counters;

uniform vec2 resolution;
uniform float lineWidth;
uniform vec3 color;
uniform float opacity;
uniform float sizeAttenuation;

varying vec2 vUV;
varying vec4 vColor;
varying float vCounters;

vec2 fix(vec4 i, float aspect) {
    vec2 res = i.xy / i.w;
    res.x *= aspect;
    vCounters = counters;
    return res;
}

void main() {
    float aspect = resolution.x / resolution.y;

    vColor = vec4(color, opacity);
    vUV = uv;

    mat4 m = projectionMatrix * modelViewMatrix;
    vec4 finalPosition = m * vec4(position, 1.0);
    vec4 prevPos = m * vec4(previous, 1.0);
    vec4 nextPos = m * vec4(next, 1.0);

    vec2 currentP = fix(finalPosition, aspect);
    vec2 prevP = fix(prevPos, aspect);
    vec2 nextP = fix(nextPos, aspect);

    float w = lineWidth * width;

    vec2 dir;
    if (nextP == currentP) {
        dir = normalize(currentP - prevP);
    } else if (prevP == currentP) {
        dir = normalize(nextP - currentP);
    } else {
        vec2 dir1 = normalize(currentP - prevP);
        vec2 dir2 = normalize(nextP - currentP);
        dir = normalize(dir1 + dir2);
    }

    vec4 normal = vec4(-dir.y, dir.x, 0.0, 1.0);
    normal.xy *= 0.5 * w;
    normal *= projectionMatrix;

    if (sizeAttenuation == 0.0) {
        normal.xy *= finalPosition.w;
        normal.xy /= (vec4(resolution, 0.0, 1.0) * projectionMatrix).xy;
    }

    finalPosition.xy += normal.xy * side;

    gl_Position = finalPosition;

    // --- log depth buffer ---
    #ifdef USE_LOGDEPTHBUF
        #ifdef USE_LOGDEPTHBUF_EXT
            vFragDepth = 1.0 + gl_Position.w;
            vIsPerspective = float(isPerspectiveMatrix(projectionMatrix));
        #else
            if (gl_Position.w > 0.0) {
                gl_Position.z = log2(max(1e-6, gl_Position.w + 1.0)) * logDepthBufFC - 1.0;
                gl_Position.z *= gl_Position.w;
            }
        #endif
    #endif

    // --- fog ---
    #ifdef USE_FOG
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vFogDepth = -mvPosition.z;
    #endif
}
`;

// English comment.
const fragmentShader = /* glsl */ `

// English comment.
#ifdef USE_FOG
    uniform vec3 fogColor;
    varying float vFogDepth;
    #ifdef FOG_EXP2
        uniform float fogDensity;
    #else
        uniform float fogNear;
        uniform float fogFar;
    #endif
#endif

// --- log depth buffer ---
#ifdef USE_LOGDEPTHBUF
    #ifdef USE_LOGDEPTHBUF_EXT
        varying float vFragDepth;
        varying float vIsPerspective;
    #endif
#endif

uniform sampler2D map;
uniform sampler2D alphaMap;
uniform float useMap;
uniform float useAlphaMap;
uniform float useDash;
uniform float dashArray;
uniform float dashOffset;
uniform float dashRatio;
uniform float visibility;
uniform float alphaTest;
uniform vec2 repeat;
uniform vec2 mapOffset;

varying vec2 vUV;
varying vec4 vColor;
varying float vCounters;

void main() {

    // --- log depth buffer ---
    #ifdef USE_LOGDEPTHBUF
        #ifdef USE_LOGDEPTHBUF_EXT
            // English comment.
            float fragDepth = vFragDepth;
        #endif
    #endif

    vec4 c = vColor;

    if (useMap == 1.0) {
        vec2 mapUV = vec2(vUV.x * repeat.x + mapOffset.x, vUV.y * repeat.y + mapOffset.y);
        vec4 texColor = texture2D(map, mapUV);
        // English comment.
        c = vec4(texColor.rgb, texColor.a * vColor.a);
    }
    if (useAlphaMap == 1.0) {
        vec2 mapUV = vec2(vUV.x * repeat.x + mapOffset.x, vUV.y * repeat.y + mapOffset.y);
        c.a *= texture2D(alphaMap, mapUV).a;
    }
    if (c.a < alphaTest) discard;

    if (useDash == 1.0) {
        c.a *= ceil(mod(vCounters + dashOffset, dashArray) - (dashArray * dashRatio));
    }

    gl_FragColor = c;
    gl_FragColor.a *= step(vCounters, visibility);

    // --- fog ---
    #ifdef USE_FOG
        #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
}
`;

// English comment.

export class MeshLineMaterial extends THREE.ShaderMaterial {
    constructor(parameters = {}) {
        super({
            uniforms: {
                // English comment.
                lineWidth: { value: 1 },
                map: { value: null },
                useMap: { value: 0 },
                alphaMap: { value: null },
                useAlphaMap: { value: 0 },
                color: { value: new THREE.Color(0xffffff) },
                opacity: { value: 1 },
                resolution: { value: new THREE.Vector2(1, 1) },
                sizeAttenuation: { value: 1 },
                // English comment.
                dashArray: { value: 0 },
                dashOffset: { value: 0 },
                dashRatio: { value: 0.5 },
                useDash: { value: 0 },
                // English comment.
                visibility: { value: 1 },
                alphaTest: { value: 0 },
                repeat: { value: new THREE.Vector2(1, 1) },
                mapOffset: { value: new THREE.Vector2(0, 0) },
                // English comment.
                fogColor: { value: new THREE.Color(0x000000) },
                fogNear: { value: 1 },
                fogFar: { value: 2000 },
                fogDensity: { value: 0.00025 },
            },

            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

        this.isMeshLineMaterial = true;
        this.type = 'MeshLineMaterial';

        // English comment.
        this.fog = true;

        // English comment.
        this._defineProperties();

        // English comment.
        this.setValues(parameters);
    }

    _defineProperties() {
        const propDefs = {
            lineWidth: 'lineWidth',
            map: 'map',
            useMap: 'useMap',
            alphaMap: 'alphaMap',
            useAlphaMap: 'useAlphaMap',
            opacity: 'opacity',
            sizeAttenuation: 'sizeAttenuation',
            dashOffset: 'dashOffset',
            dashRatio: 'dashRatio',
            useDash: 'useDash',
            visibility: 'visibility',
            alphaTest: 'alphaTest',
        };

        for (const [prop, uniform] of Object.entries(propDefs)) {
            Object.defineProperty(this, prop, {
                enumerable: true,
                get() {
                    return this.uniforms[uniform].value;
                },
                set(value) {
                    this.uniforms[uniform].value = value;
                },
            });
        }

        // English comment.
        Object.defineProperty(this, 'color', {
            enumerable: true,
            get() {
                return this.uniforms.color.value;
            },
            set(value) {
                this.uniforms.color.value = value;
            },
        });

        // English comment.
        Object.defineProperty(this, 'resolution', {
            enumerable: true,
            get() {
                return this.uniforms.resolution.value;
            },
            set(value) {
                this.uniforms.resolution.value.copy(value);
            },
        });

        // English comment.
        Object.defineProperty(this, 'repeat', {
            enumerable: true,
            get() {
                return this.uniforms.repeat.value;
            },
            set(value) {
                this.uniforms.repeat.value.copy(value);
            },
        });

        // English comment.
        Object.defineProperty(this, 'mapOffset', {
            enumerable: true,
            get() {
                return this.uniforms.mapOffset.value;
            },
            set(value) {
                this.uniforms.mapOffset.value.copy(value);
            },
        });

        // English comment.
        Object.defineProperty(this, 'dashArray', {
            enumerable: true,
            get() {
                return this.uniforms.dashArray.value;
            },
            set(value) {
                this.uniforms.dashArray.value = value;
                this.uniforms.useDash.value = value !== 0 ? 1 : 0;
            },
        });
    }

    copy(source) {
        super.copy(source);

        this.lineWidth = source.lineWidth;
        this.map = source.map;
        this.useMap = source.useMap;
        this.alphaMap = source.alphaMap;
        this.useAlphaMap = source.useAlphaMap;
        this.color.copy(source.color);
        this.opacity = source.opacity;
        this.resolution.copy(source.resolution);
        this.sizeAttenuation = source.sizeAttenuation;
        this.dashArray = source.dashArray;
        this.dashOffset = source.dashOffset;
        this.dashRatio = source.dashRatio;
        this.useDash = source.useDash;
        this.visibility = source.visibility;
        this.alphaTest = source.alphaTest;
        this.repeat.copy(source.repeat);

        return this;
    }
}
