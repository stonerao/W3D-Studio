const BAKE_PATCH_KEY = '__w3dBakePatched';
const BAKE_SHADER_KEY = '__w3dBakeShader';
const BAKE_INTENSITY_KEY = '__w3dBakeIntensity';
const BAKE_CACHE_KEY = 'w3d-bake-v2';

function ensureBakeUserData(material) {
    if (!material.userData) {
        material.userData = {};
    }
    return material.userData;
}

function updateBakeUniform(material) {
    const shader = material?.userData?.[BAKE_SHADER_KEY];
    if (shader?.uniforms?.uBakeIntensity) {
        shader.uniforms.uBakeIntensity.value = material.userData[BAKE_INTENSITY_KEY] ?? 1.0;
    }
}

function patchBakeShader(material) {
    const userData = ensureBakeUserData(material);
    if (userData[BAKE_PATCH_KEY]) {
        updateBakeUniform(material);
        return;
    }

    const previousOnBeforeCompile = material.onBeforeCompile;
    const previousCustomProgramCacheKey = material.customProgramCacheKey;

    material.onBeforeCompile = (shader, renderer) => {
        if (typeof previousOnBeforeCompile === 'function') {
            previousOnBeforeCompile.call(material, shader, renderer);
        }

        shader.uniforms.uBakeIntensity = {
            value: material.userData[BAKE_INTENSITY_KEY] ?? 1.0
        };
        material.userData[BAKE_SHADER_KEY] = shader;

        if (!shader.fragmentShader.includes('uniform float uBakeIntensity;')) {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <lightmap_pars_fragment>',
                `#include <lightmap_pars_fragment>
uniform float uBakeIntensity;`
            );
        }

        if (!shader.fragmentShader.includes('outgoingLight *= bakeCol;')) {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                `#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif

#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif

#ifdef USE_LIGHTMAP
vec3 bakeCol = texture2D( lightMap, vLightMapUv ).rgb * uBakeIntensity;
outgoingLight *= bakeCol;
#endif

gl_FragColor = vec4( outgoingLight, diffuseColor.a );`
            );
        }
    };

    material.customProgramCacheKey = function customProgramCacheKey() {
        const previous = typeof previousCustomProgramCacheKey === 'function'
            ? previousCustomProgramCacheKey.call(this)
            : '';
        return `${previous}|${BAKE_CACHE_KEY}`;
    };

    userData[BAKE_PATCH_KEY] = true;
}

export const handleBake = ({ mesh, material: inputMaterial, texture, intensity = 1.0 }) => {
    const material = inputMaterial || mesh?.material;
    if (!material || Array.isArray(material)) return;

    const userData = ensureBakeUserData(material);
    userData[BAKE_INTENSITY_KEY] = intensity;

    // Reuse three.js built-in lightMap UV pipeline and neutralize the
    // default additive lightMap effect by setting intensity to 0.
    material.lightMap = texture;
    material.lightMapIntensity = 0;

    patchBakeShader(material);
    updateBakeUniform(material);
};
