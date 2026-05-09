import * as THREE from 'three';

/**
 * English comment.
 */
export class Light {
    /**
     * English comment.
     */
    constructor(scene) {
        this.scene = scene;
        this.lights = new Map();
    }

    /**
     * English comment.
     */
    addAmbient(options = {}) {
        const { color = '#ffffff', intensity = 0.5 } = options;

        const light = new THREE.AmbientLight(color, intensity);
        this.lights.set('ambient', light);
        this.scene.scene.add(light);

        return light;
    }

    /**
     * English comment.
     */
    addDirectional(options = {}) {
        const {
            color = '#ffffff',
            intensity = 1.0,
            position = [100, 100, 100],
            castShadow = false,
            shadowMapSize = 2048
        } = options;

        const light = new THREE.DirectionalLight(color, intensity);

        const [x, y, z] = position;
        light.position.set(x, y, z);

        // English comment.
        light.castShadow = castShadow;
        if (castShadow) {
            light.shadow.mapSize.width = shadowMapSize;
            light.shadow.mapSize.height = shadowMapSize;
            light.shadow.camera.near = 0.5;
            light.shadow.camera.far = 500;
            light.shadow.camera.left = -100;
            light.shadow.camera.right = 100;
            light.shadow.camera.top = 100;
            light.shadow.camera.bottom = -100;
        }

        this.lights.set('directional', light);
        this.scene.scene.add(light);

        return light;
    }

    /**
     * English comment.
     */
    addPoint(options = {}) {
        const {
            color = '#ffffff',
            intensity = 1.0,
            distance = 0,
            decay = 2,
            position = [0, 100, 0]
        } = options;

        const light = new THREE.PointLight(color, intensity, distance, decay);

        const [x, y, z] = position;
        light.position.set(x, y, z);

        const name = `point_${this.lights.size}`;
        this.lights.set(name, light);
        this.scene.scene.add(light);

        return light;
    }

    /**
     * English comment.
     */
    addSpot(options = {}) {
        const {
            color = '#ffffff',
            intensity = 1.0,
            distance = 0,
            angle = Math.PI / 3,
            penumbra = 0,
            decay = 2,
            position = [0, 100, 0],
            target = [0, 0, 0]
        } = options;

        const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);

        const [x, y, z] = position;
        light.position.set(x, y, z);

        const [tx, ty, tz] = target;
        light.target.position.set(tx, ty, tz);

        const name = `spot_${this.lights.size}`;
        this.lights.set(name, light);
        this.scene.scene.add(light);
        this.scene.scene.add(light.target);

        return light;
    }

    /**
     * English comment.
     */
    get(name) {
        return this.lights.get(name) || null;
    }

    /**
     * English comment.
     */
    remove(name) {
        const light = this.lights.get(name);
        if (light) {
            this.scene.scene.remove(light);

            // English comment.
            if (light.isSpotLight && light.target) {
                this.scene.scene.remove(light.target);
            }

            this.lights.delete(name);
        }
    }

    /**
     * English comment.
     */
    clear() {
        this.dispose();
    }

    /**
     * English comment.
     */
    dispose() {
        this.lights.forEach((light) => {
            this.scene.scene.remove(light);

            // English comment.
            if (light.isSpotLight && light.target) {
                this.scene.scene.remove(light.target);
            }
        });
        this.lights.clear();
    }

    /**
     * English comment.
     */
    updateConfig(config = {}) {
        if (!config || typeof config !== 'object') return;

        // English comment.
        if (config.ambient !== undefined) {
            const ambient = this.lights.get('ambient');
            if (ambient) {
                if (config.ambient.color !== undefined) {
                    ambient.color.set(config.ambient.color);
                }
                if (config.ambient.intensity !== undefined) {
                    ambient.intensity = config.ambient.intensity;
                }
            } else if (config.ambient.enabled !== false) {
                // English comment.
                this.addAmbient(config.ambient);
            }
        }

        // English comment.
        if (config.directional !== undefined) {
            const directional = this.lights.get('directional');
            if (directional) {
                if (config.directional.color !== undefined) {
                    directional.color.set(config.directional.color);
                }
                if (config.directional.intensity !== undefined) {
                    directional.intensity = config.directional.intensity;
                }
                if (config.directional.position !== undefined) {
                    const pos = config.directional.position;
                    const posArr = Array.isArray(pos) ? pos : [pos.x, pos.y, pos.z];
                    directional.position.set(posArr[0], posArr[1], posArr[2]);
                }
                if (config.directional.castShadow !== undefined) {
                    directional.castShadow = config.directional.castShadow;
                }
            } else if (config.directional.enabled !== false) {
                // English comment.
                this.addDirectional(config.directional);
            }
        }

        // English comment.
        if (config.hemisphere !== undefined) {
            const hemisphere = this.lights.get('hemisphere');
            if (hemisphere) {
                if (config.hemisphere.skyColor !== undefined) {
                    hemisphere.color.set(config.hemisphere.skyColor);
                }
                if (config.hemisphere.groundColor !== undefined) {
                    hemisphere.groundColor.set(config.hemisphere.groundColor);
                }
                if (config.hemisphere.intensity !== undefined) {
                    hemisphere.intensity = config.hemisphere.intensity;
                }
            }
        }
    }

    /**
     * English comment.
     */
    getConfig() {
        const config = {};

        const ambient = this.lights.get('ambient');
        if (ambient) {
            config.ambient = {
                enabled: true,
                color: '#' + ambient.color.getHexString(),
                intensity: ambient.intensity
            };
        }

        const directional = this.lights.get('directional');
        if (directional) {
            config.directional = {
                enabled: true,
                color: '#' + directional.color.getHexString(),
                intensity: directional.intensity,
                position: [directional.position.x, directional.position.y, directional.position.z],
                castShadow: directional.castShadow
            };
        }

        return config;
    }
}
