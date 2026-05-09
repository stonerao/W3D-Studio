import * as THREE from 'three';

/**
 * English comment.
 */
export class AnimationManager {
    /**
     * English comment.
     */
    constructor(scene) {
        this.scene = scene;

        // English comment.
        this.mixers = new Map();

        // English comment.
        this.clock = new THREE.Clock();
    }

    /**
     * English comment.
     */
    createMixer(object) {
        const mixer = new THREE.AnimationMixer(object);
        this.mixers.set(object.uuid, mixer);
        return mixer;
    }

    /**
     * English comment.
     */
    getMixer(object) {
        return this.mixers.get(object.uuid) || null;
    }

    /**
     * English comment.
     */
    play(object, clip, options = {}) {
        let mixer = this.getMixer(object);

        if (!mixer) {
            mixer = this.createMixer(object);
        }

        const action = mixer.clipAction(clip);

        // English comment.
        if (options.loop !== undefined) {
            action.setLoop(options.loop);
        }
        if (options.timeScale !== undefined) {
            action.setEffectiveTimeScale(options.timeScale);
        }
        if (options.weight !== undefined) {
            action.setEffectiveWeight(options.weight);
        }

        action.play();

        return action;
    }

    /**
     * English comment.
     */
    stop(object) {
        const mixer = this.getMixer(object);

        if (mixer) {
            mixer.stopAllAction();
        }
    }

    /**
     * English comment.
     */
    update() {
        const delta = this.clock.getDelta();

        this.mixers.forEach((mixer) => {
            mixer.update(delta);
        });
    }

    /**
     * English comment.
     */
    remove(object) {
        const mixer = this.getMixer(object);

        if (mixer) {
            mixer.stopAllAction();
            this.mixers.delete(object.uuid);
        }
    }

    /**
     * English comment.
     */
    dispose() {
        this.mixers.forEach((mixer) => {
            mixer.stopAllAction();
        });

        this.mixers.clear();
    }
}
