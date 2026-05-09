/* English comment. */
import glUtil from '@glUtil';
import { getLerpPosition, getRotaion } from './util';

export default class Mover {
    constructor(pathIns) {
        this.pathIns = pathIns;
        this.config = pathIns.config;
        this._MoverObjs = {};
    }

    /**
     * English comment.
     */
    addMover(array) {
        array.forEach((opt) => {
            const {
                mesh,
                id,
                offsetY = 0,
                mtlConfig = { transparent: true },
                scale,
                isCompEvents = false,
                isFade = true,
                offsetRadio = 0,
                userData = {},
                callback,
                is2DView = false,
                pfmMode = false
            } = opt;
            if (!mesh) return;
            const pathNode = this.pathIns.getPathNode(id);
            if (!pathNode) return;

            const {
                isCurve
            } = pathNode.userData;

            const { points } = this.pathIns.config.data.filter((item) => item.id === id)[0];

            // English comment.
            if (mtlConfig) this.setMeshMtl(mesh.material, mtlConfig);
            mesh.userData = {
                ...mesh.userData,
                ...userData,
                isCurve,
                id,
                offsetY,
                isFade,
                points,
                offsetRadio,
                callback,
                scale,
                pfmMode,
                is2DView
            };

            if (scale) {
                mesh.scale.copy(scale);
            }

            if (isCompEvents) {
                this.pathIns.eventArr.push(mesh);
                this.pathIns.renderer.updateEventArr(this.pathIns);
            }

            if (!this._MoverObjs[id]) {
                this._MoverObjs[id] = [];
            }

            this._MoverObjs[id].push(mesh);
        });
    }

    /**
     * English comment.
     */
    delMover(ids) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const nodes = this._MoverObjs[id];
            if (!nodes) continue;
            nodes.forEach((node) => {
                glUtil.disposeNode(node);
                this.pathIns.eventArr = this.pathIns.eventArr.filter((m) => m.userData.id !== id);
            });
            delete this._MoverObjs[id];
        }
        this.pathIns.renderer.updateEventArr(this.pathIns);
    }

    /**
     * English comment.
     */
    setMeshMtl(mtl, config) {
        Object.keys(config).forEach((key) => {
            glUtil.eachMaterial(mtl, (m) => {
                m[key] = config[key];
            });
        });
    }

    /**
     * English comment.
     */
    animate(id, uTime, sc) {
        if (!this._MoverObjs[id]) return;
        this._MoverObjs[id].forEach((node) => {
            if (node.userData.id !== id) return;
            const {
                isFade,
                oldRadio,
                isCurve,
                points,
                offsetY,
                offsetRadio,
                callback,
                scale,
                state = true,
                pfmMode,
                is2DView
            } = node.userData;
            if (!state) {
                return;
            }

            const radio = uTime + offsetRadio > 1 ? 1 : uTime + offsetRadio;

            if (!oldRadio || oldRadio < 0 || radio < 0) {
                node.userData.oldRadio = radio;
                return;
            }

            if (callback) {
                callback(node, radio);
            }

            node.userData.oldRadio = radio;

            if (!node.visible) return;

            if (sc !== 1 && scale) {
                node.scale.set(sc * scale.x, sc * scale.y, sc * scale.z);
            }

            if (isFade) {
                this.setSEOpacity(node, radio);
            }

            let [position, frPos, rotate] = ['', '', ''];
            const frRadio = oldRadio >= 1 ? 0.999999 : oldRadio;

            if (pfmMode) {
                // English comment.
                const { positions, rotations, rotations2D } = this.pathIns.pathIns.bufferPos[id];
                const index = (radio * (positions.length - 1)) | 0;
                rotate = is2DView ? rotations2D[index] : rotations[index];
                frPos = positions[index];
                position = positions[index];
            } else {
                // English comment.
                frPos = getLerpPosition(points, isCurve, frRadio);
                position = getLerpPosition(points, isCurve, radio);
                rotate = getRotaion(frPos, position);
            }
            node.quaternion.slerp(rotate, 1);
            node.position.set(position.x, position.y + offsetY, position.z);
        });
    }

    // English comment.
    setSEOpacity(node, radio) {
        const op = radio <= 0.1 ? radio * 10 : (1 - radio) * 10;
        node.traverse((item) => {
            glUtil.eachMaterial(item.material, (mtl) => {
                mtl.opacity = op;
                mtl.needsUpdate = true;
            });
        });
    }

    /**
     * English comment.
     */
    dispose() {
        Object.keys(this._MoverObjs).forEach((key) => {
            this._MoverObjs[key].forEach((node) => {
                glUtil.disposeNode(node);
            });
        });
        this._MoverObjs = null;
    }

    /**
     * English comment.
     */
    show(ids, time, callback) {
        for (let i = 0; i < ids.length; i++) {
            const nodes = this._MoverObjs[ids[i]];
            nodes.forEach((node) => {
                node.visible = true;
                this.pathIns.setTestTween(node.material, { opacity: 1 }, callback, time);
            });
        }
    }

    // English comment.
    hide(ids, time, callback) {
        for (let i = 0; i < ids.length; i++) {
            const nodes = this._MoverObjs[ids[i]];
            nodes.forEach((node) => {
                this.pathIns.setTestTween(node.material, { opacity: 0 }, () => {
                    glUtil.exeFunction(callback);
                    node.visible = false;
                }, time);
            });
        }
    }
}
