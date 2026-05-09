/*
 * @Description: 沿路径运动的mesh类
 * @Author:
 * @Date: 2022-02-07 16:44:54
*/
import glUtil from '@glUtil';
import { getLerpPosition, getRotaion } from './util';

export default class Mover {
    constructor(pathIns) {
        this.pathIns = pathIns;
        this.config = pathIns.config;
        this._MoverObjs = {};
    }

    /**
     * @description 添加沿路径移动车辆
     * @author
     * @date 2022-02-07
     * @param {Array} array 移物配置数组
     * @returns {*}
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

            // 材质设置
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
     * @description 删除移动物
     * @author
     * @date 2022-03-05
     * @param {array} ids
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
     * @description 设置车辆材质属性
     * @author
     * @date 2021-12-16
     * @param {*} mtl 材质
     * @param {*} config 配置项
     */
    setMeshMtl(mtl, config) {
        Object.keys(config).forEach((key) => {
            glUtil.eachMaterial(mtl, (m) => {
                m[key] = config[key];
            });
        });
    }

    /**
     * @description 车辆移动动画
     * @author
     * @date 2021-12-16
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
                // 性能模式，通过缓存直接获取
                const { positions, rotations, rotations2D } = this.pathIns.pathIns.bufferPos[id];
                const index = (radio * (positions.length - 1)) | 0;
                rotate = is2DView ? rotations2D[index] : rotations[index];
                frPos = positions[index];
                position = positions[index];
            } else {
                // 实时计算模式
                frPos = getLerpPosition(points, isCurve, frRadio);
                position = getLerpPosition(points, isCurve, radio);
                rotate = getRotaion(frPos, position);
            }
            node.quaternion.slerp(rotate, 1);
            node.position.set(position.x, position.y + offsetY, position.z);
        });
    }

    // 设置物体首尾透明度
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
     * @description 销毁mesh
     * @author
     * @date 2022-01-06
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
     * @description 显示移动物
     * @author
     * @param {array} ids
     * @param {*} time
     * @param {function} callback
     * @returns {*}
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

    // 隐藏
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
