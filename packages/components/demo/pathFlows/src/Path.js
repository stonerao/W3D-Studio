/*
 * @Description: 生成路径方法类
 * @Author:
 * @Date: 2022-02-07 16:45:39
  */
import glUtil from '@glUtil';
import PATH_SHADER from './shader';
import { handlePoints, getRotaion } from './util';

export default class PathMesh {
    constructor(ins) {
        this.pathIns = ins;
        this.config = ins.config;
        this._pathObjs = {};
        this.bufferPos = {};
    }

    /**
     * @description 添加路径
     * @author
     * @date 2022-02-07
     * @param {Objec} opt 配置项
     */
    addPath(opt) {
        const conf = {
            ...this.config,
            ...opt
        };

        const {
            id,
            geoStyle,
            autoPlay,
            size,
            isCompEvents,
            radio,
            isCurve,
            userData = {},
            loop,
            aniTime,
            speed,
            style,
            sizeAttenuation = true,
            isFade = false
        } = conf;

        // 有重复id则不创建
        if (this._pathObjs[id]) return;
        // 点位数据处理
        const {
            indexs, cIndex, vecs, length
        } = handlePoints(conf);
        // 创建geo
        const geo = this.createGeo(geoStyle, size, vecs, cIndex);
        // 创建材质
        const mtl = this.createMtl(conf, { length, size });
        glUtil.shaderMtlAddFog(mtl);
        const mesh = new THREE.Mesh(geo, mtl);
        mesh.userData = {
            ...mesh.userData,
            id,
            state: autoPlay,
            radios: indexs,
            index: 0,
            time: 0,
            originVec: conf.points,
            aniTime: speed > 0 ? length / speed : aniTime,
            lenRadio: style === 'fill' ? 0 : radio,
            isCurve,
            ceId: this.pathIns.id,
            data: userData,
            loop,
            length,
            sizeAttenuation,
            isFade
        };
        this._pathObjs[id] = mesh;
        this.pathIns.group.add(mesh);
        if (isCompEvents) {
            this.pathIns.eventArr.push(mesh);
            this.pathIns.renderer.updateEventArr(this.pathIns);
        }
        // 高性能模式 内存换计算
        if (this.bufferPos[id]) return;
        const [cBevels, position] = [geo.attributes.cBevels.array, geo.attributes.position.array];
        const [positions, bevels, rotations, rotations2D] = [[], [], [], []];
        for (let i = 0; i < cBevels.length; i += 6) {
            const pos = {
                x: position[i] - cBevels[i],
                y: position[i + 1] - cBevels[i + 1],
                z: position[i + 2] - cBevels[i + 2]
            };
            const bevel = { x: cBevels[i], y: cBevels[i + 1], z: cBevels[i + 2] };
            if (!position[i + 6]) {
                rotations.push(rotations[rotations.length - 1]);
                rotations2D.push(rotations2D[rotations2D.length - 1]);
            } else {
                const nexPos = {
                    x: position[i + 6] - cBevels[i + 6],
                    y: position[i + 7] - cBevels[i + 7],
                    z: position[i + 8] - cBevels[i + 8]
                };
                rotations.push(getRotaion(pos, nexPos));
                rotations2D.push(getRotaion(pos, nexPos, true));
            }
            positions.push(pos);
            bevels.push(bevel);
        }
        this.bufferPos[id] = {
            positions,
            rotations,
            bevels,
            rotations2D
        };
    }

    /**
     * @description 生成geo
     * @author
     * @date 2021-12-23
     * @param {String} geoStyle 路径样式
     * @param {number} size 路径宽度
     * @param {array} vecs 点位
     * @param {array} cIndex 下标
     * @returns {Object} geo
     */
    createGeo(geoStyle, size, vecs) {
        const geo = glUtil.geo.buf();

        const resVec2 = this.getVec3ToVec2(vecs);

        const pathInfo = this.getPathSlope(resVec2.vecs, geoStyle);

        const {
            indices, uvs, position, bevels
        } = this.roadBuffer({
            size,
            ...resVec2,
            ...pathInfo
        });

        geo.setIndex(indices);

        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
        geo.setAttribute('cBevels', new THREE.Float32BufferAttribute(bevels, 3));
        // geo.setAttribute('cIndex', new THREE.Float32BufferAttribute(cIndex, 1));
        return geo;
    }

    /**
     * @description 获取纹理设置
     * @author
     * @param {*} repeat 纹理重复
     * @param {*} opt 长度、宽度
     */
    getRepeat(repeat, opt) {
        let [x, y] = [1, 1];
        const { length, size } = opt;
        if (repeat[0] >= 0 && repeat[1] >= 0) {
            // 兼容以前数组配置
            x = repeat['0'];
            y = repeat['1'];
        } else {
            x = repeat.x;
            y = repeat.y;
        }
        return new THREE.Vector2(length * x | 0, size * y);
    }

    /**
     * @description 创建材质
     * @author
     * @date 2021-12-31
     */
    createMtl(config, opt) {
        const {
            txueId, radio, mtlConfig = {}, loop = true, sizeAttenuation,
            color, style, repeat, bgColor, bgTxueId, bgRepeat, isSyn = false, isFade = false
        } = config;

        const txue = this.getTxue(txueId);
        const bgTxue = this.getTxue(bgTxueId);

        const mtl = glUtil.mtl.shader({
            transparent: true,
            side: 2,
            ...mtlConfig,
            uniforms: {
                uTime: { value: 0 },
                uBgColor: { value: glUtil.getColorArr(bgColor, true) }, // 背景颜色
                uBgTxue: { value: bgTxue }, // 背景纹理
                uIsBgTxue: { value: !!bgTxue }, // 背景纹理是否加载
                uBgRepeat: { value: this.getRepeat(bgRepeat, opt) }, // 背景纹理重复
                uOpacity: { value: 1 }, // 整体显隐
                uColor: { value: glUtil.getColorArr(color, true) }, // 跑光颜色
                uTxue: { value: txue }, // 跑光纹理
                uIsTxue: { value: !!txue }, // 跑光纹理是否加载
                uRepeat: { value: this.getRepeat(repeat, opt) }, // 跑光纹理重复
                uLoop: { value: loop }, // 动画是否重复执行
                uRadio: { value: radio || 0.00001 }, // 跑光占比
                uIsSyn: { value: isSyn }, // 背景和流光是否同步
                uScale: { value: 1 }, // 相机缩放倍数
                uAutoSize: { sizeAttenuation }, // 是否开启缩放
                uIsFade: { value: isFade } // 是否首尾透明
            },
            vertexShader: PATH_SHADER.vertexShader,
            fragmentShader: style === 'flow' ? PATH_SHADER.fragmentShader1 : PATH_SHADER.fragmentShader2
        });
        return mtl;
    }

    // 获取纹理
    getTxue(txueId) {
        const txue = this.pathIns.renderer.getTxue(txueId);
        if (txue) {
            txue.wrapT = THREE.RepeatWrapping;
            txue.wrapS = THREE.RepeatWrapping;
            return txue;
        }
        return null;
    }

    /**
     * @description 获取uv，点位数据
     * @author
     * @date 2021-12-31
     * @param {Object} buffer 数据存储对象
     */
    roadBuffer(config) {
        const {
            vertices, vecY, l, beveling, bevelY, dtcRadio, size
        } = config;
        const buffer = {
            uvs: [],
            indices: [],
            position: [],
            bevels: []
        };
        for (let i = 0; i < l; i++) {
            const [m, n = m + 1] = [i * 2];
            const [x, y, z] = [beveling[m] * size, bevelY * size, beveling[n] * size];
            buffer.uvs.push(dtcRadio[i], 1, dtcRadio[i], 0); // uv

            buffer.position.push(
                vertices[m] + x,
                vecY[i] + y,
                vertices[n] + z,
                vertices[m] - x,
                vecY[i] - y,
                vertices[n] - z
            );
            buffer.bevels.push(x, y, z, -x, -y, -z);
            if (i < l - 1) { this.pathIns.sideIndices(buffer.indices, i, 0); }
        }
        return buffer;
    }

    /**
     * @description 根据路径geo样式获取构面斜率
     * @author
     * @date 2021-12-24
     * @param {Array} vecs 坐标
     * @param {String} geoStyle 路径样式
     * @returns {*}
     */
    getPathSlope(vecs, geoStyle) {
        if (geoStyle === 'plane') {
            // 平面展示
            const res = this.pathIns.getPathInfo([vecs], false, true, false);
            res.bevelY = 0;
            return res;
        }
        // 侧面展示
        const obj = {
            vertices: [],
            beveling: [],
            bevelY: 0.5
        };
        vecs.forEach((vec) => {
            obj.vertices.push(vec[0], vec[1]);
            obj.beveling.push(0, 0);
        });
        return obj;
    }

    /**
     * @description 拆分3维点为2维，方便构面
     * @author
     * @date 2021-12-24
     * @param {Array} 点位
     * @returns {Object}
     */
    getVec3ToVec2(arr) {
        const vecs = [];
        const vecY = [];
        let [dtc, cx, cy, cz, nx, ny, nz] = [0];
        const perDtcRadio = [0];
        for (let k = 0; k <= arr.length - 1; k++) {
            cx = arr[k].x;
            cy = arr[k].y;
            cz = arr[k].z;
            vecs.push([cx, cz]);
            vecY.push(cy);

            if (k > 0) {
                nx = arr[k - 1].x;
                ny = arr[k - 1].y;
                nz = arr[k - 1].z;
                dtc += Math.sqrt((cx - nx) ** 2 + (cy - ny) ** 2 + (cz - nz) ** 2);
                perDtcRadio.push(dtc);
            }
        }

        for (let index = 0; index < perDtcRadio.length; index++) {
            perDtcRadio[index] /= dtc;
        }

        return {
            l: arr.length,
            vecs,
            vecY,
            dtcRadio: perDtcRadio
        };
    }

    /**
     * @description 关键点事件
     * @author
     * @date 2022-03-04
     * @param {object} node 节点
     * @param {number} time 长度
     * @param {number} index 点位下标
     * @param {boolean} idEnd 是否最后一个点
     */
    handlerEvent(node, diffTime) {
        const {
            id, radio, radios, index, originVec, lenRadio, loop
        } = node.userData;

        if (!loop && radio > 1 + lenRadio + diffTime) {
            return;
        }

        // if (loop && node.userData.index >= radios.length && time >= (radio + 1)) {
        if (radio - diffTime <= radios[index] && radio >= radios[index]) {
            this.pathIns._triggerOutEvent('passPoint', {
                id,
                index,
                position: originVec[index]
            });
            node.userData.index++;
        }

        if (loop && radio >= 1 + lenRadio) {
            node.userData.index = 0;
            node.material.uniforms.uTime.value = -diffTime;
        }
    }

    /**
     * @description 动画
     * @author
     * @date 2021-12-30
     * @param {Number} dt
     */
    animate(dt) {
        Object.keys(this._pathObjs).forEach((key) => {
            const node = this._pathObjs[key];
            const {
                aniTime, id, state, sizeAttenuation
            } = node.userData;
            const diffTime = dt / aniTime;
            let nScale = this.pathIns.getCameraScale() / this.pathIns.cameraScale;
            nScale = nScale < 1 ? 1 : nScale;
            if (state) {
                this.handlerEvent(node, diffTime);
            }
            if (!sizeAttenuation) {
                node.material.uniforms.uScale.value = nScale;
            }

            if (node.userData.state) {
                node.material.uniforms.uTime.value += diffTime;
                const radio = node.material.uniforms.uTime.value;
                node.userData.radio = radio;
                this.pathIns._triggerOutEvent('moving', {
                    id,
                    radio
                });
                // 移动物动画
                this.pathIns.moverAnimate(id, radio, nScale);
            }
        });
    }

    // 手动设置动画展示位置
    setPathRadio(ids = [], radio) {
        Object.keys(this._pathObjs).forEach((key) => {
            const node = this._pathObjs[key];
            const {
                id
            } = node.userData;
            if (!ids.includes(id)) return;

            // let nScale = this.pathIns.getCameraScale() / this.pathIns.cameraScale;
            // nScale = nScale < 1 ? 1 : nScale;
            node.userData.radio = radio;
            node.material.uniforms.uTime.value = radio;
            // node.material.uniforms.uScale.value = nScale;
        });
    }

    // 设置运动时间
    setPathAniTime(ids = [], time) {
        Object.keys(this._pathObjs).forEach((key) => {
            const node = this._pathObjs[key];
            const {
                id
            } = node.userData;
            if (!ids.includes(id)) return;

            node.userData.aniTime = time;
        });
    }

    // 设置运动速度
    setPathSpeed(ids = [], speed) {
        if (speed <= 0) return;
        Object.keys(this._pathObjs).forEach((key) => {
            const node = this._pathObjs[key];
            const {
                id, length
            } = node.userData;
            if (!ids.includes(id)) return;

            node.userData.aniTime = length / speed;
        });
    }

    /**
     * @description 销毁mesh
     * @author
     * @date 2022-01-06
     */
    dispose() {
        Object.keys(this._pathObjs).forEach((key) => {
            const node = this._pathObjs[key];
            glUtil.disposeNode(node);
        });
        this._pathObjs = null;
    }

    /**
     * @description 删除路径
     * @author
     * @date 2022-03-05
     * @param {array} id
     */
    delPath(ids) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const node = this._pathObjs[id];
            if (!node) continue;
            glUtil.disposeNode(node);
            delete this._pathObjs[id];
            this.pathIns.eventArr = this.pathIns.eventArr.filter((m) => m.userData.id !== id);
        }
        this.pathIns.renderer.updateEventArr(this.pathIns);
    }

    /**
     * @description 停止动画
     * @author
     * @date 2022-01-06
     * @param {array} ids 路径id
     */
    stop(ids) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const node = this._pathObjs[id];
            if (!node) continue;
            node.userData.state = false;
        }
    }

    /**
     * @description 开启动画
     * @author
     * @date 2022-01-06
     * @param {array} id 路径id
     */
    play(ids) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const node = this._pathObjs[id];
            if (!node) continue;
            node.userData.state = true;
        }
    }

    // 获取对应路径节点
    getPathNode(id) {
        if (!this._pathObjs[id]) return false;
        return this._pathObjs[id];
    }

    // 显示
    show(ids, time = this.pathIns.tweenTims, callback) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const node = this._pathObjs[id];
            if (!node) continue;
            this.pathIns.setTestTween(node.material.uniforms.uOpacity, { value: 1 }, callback, time);
        }
    }

    // 隐藏
    hide(ids, time, callback) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const node = this._pathObjs[id];
            if (!node) continue;
            this.pathIns.setTestTween(node.material.uniforms.uOpacity, { value: 0 }, callback, time);
        }
    }
}
