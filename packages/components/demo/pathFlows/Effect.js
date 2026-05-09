/*
 * @Description: 路径生成工具，包含路径样式，沿路径运动
 * @Author:
 * @Date: 2021-12-23 16:30:04
  */

import glUtil from '@glUtil';
import { EffectBase } from '@glMain';
import Path from './src/Path';
import Mover from './src/Mover';
import Interface from './Interface';

const PI = Math.PI / 180;

class PathFlows extends EffectBase {
    constructor(render) {
        super(render);
        this.cameraScale = this.getCameraScale();
        // 动画部分
        this.animate = (dt) => {
            if (!this.config.isAnimate) return; // eslint-disable-line
            this.pathIns.animate(dt);
        };
    }

    // 添加默认参数 用于默认业务参数，公共参数继承
    setDefaultConfig(dfConfig) {
        glUtil.copy(dfConfig, {
            isCompEvents: false, // 开启事件
            mtlConfig: { // 路径材质
                transparent: true
            },
            geoStyle: 'plane', // 路径样式,平面 plane || 垂直侧面 side
            size: 1, // 在平面的宽度或侧面的高度
            isCurve: true, // 是否曲线
            autoPlay: true, // 自动播放
            bgColor: 'rgba(255,255,255,0)', // 路径颜色
            bgTxueId: '', // 路径纹理id,
            bgRepeat: { x: 1, y: 1 }, // 路径纹理重复,
            style: 'fill', // 跑光样式 1:填充效果 2.跑光效果 fill flow
            aniTime: 10, // 动画时间 s
            speed: 0, // 动画速度  速度大于0是用速度
            color: 'rgba(255,255,255,1)', // 跑光颜色,
            txueId: '', // 跑光纹理id
            repeat: { x: 1, y: 1 }, // 跑光纹理重复,
            radio: 0.001, // 跑光效果下 长度占比
            loop: true, // 动画循环
            isSyn: false, // 背景是否和跑光同步显示
            sizeAttenuation: true, // //是否跟随相机缩放
            dpi: 10, // 点位密度
            isRadius: true, // 直线拐点是否圆角处理
            isFade: false, // 是否首尾透明
            data: [
                // {
                //     id: 'path1',
                //     userData:{
                //         name:'path'
                //     },
                //     points: [
                //         {
                //             x: 0,
                //             y: 20,
                //             z: 0
                //         },
                //         {
                //             x: 22,
                //             y: 10,
                //             z: 0
                //         }
                //     ]
                // }
            ]
        });
    }

    // 销毁 这里只需销毁当前效果会内存泄漏的对象，继承的由公共销毁
    disposeCompEft() {
        this.pathIns.dispose();
        this.moverIns.dispose();
    }

    // 效果初始化
    compEftInit() {
        this.moverIns = new Mover(this);
        this.pathIns = new Path(this);

        // 添加路径
        this.config.data.forEach((opt) => this.addPath(opt, false));

        // 触发对应的生命周期
        this._triggerInnerEvent('mounted', { val: this.config.name });
    }

    // 获取相机缩放
    getCameraScale() {
        const { camera, scene } = this.renderer;
        const fov = camera.fov * PI;  // 将角度转换为弧度
        const { aspect } = camera;
        const distance = camera.position.distanceTo(scene.position);  // 相机到场景的距离
        return (2 * Math.tan(fov / 2) * distance) / aspect;
    }

    /**
     * @description 判断组件选中组件是否自己
     * @author
     * @param {Object3D} node
     */
    isSelfCom(node) {
        return node.userData.ceId === this.id;
    }

    // 鼠标点击
    onMouseDown(e, array) {
        if (array && array[0] && this.isSelfCom(array[0].object)) {
            const mesh = array[0].object;
            const data = this.getOutData(mesh);
            this.selData = data;
            return [e, data];
        }
        return [e, []];
    }

    // 鼠标移入
    onMouseIn(e, array) {
        if (array && array[0] && this.isSelfCom(array[0].object)) {
            const mesh = array[0].object;
            const data = this.getOutData(mesh);
            this.selData = data;
            return [e, data];
        }
        return [e, []];
    }

    // 鼠标移出
    onMouseOut(e) {
        if (this.selData) {
            const data = glUtil.extend(true, this.selData, {});
            this.selData = null;
            return [e, data];
        }
        return [e, []];
    }

    // 获取对外数据
    getOutData(node) {
        const { id: cId, data } = node.userData;
        const { id: pId, data: pData } = node.parent.userData;
        let path;
        let res;
        if (this.pathIns._pathObjs[cId]) {
            path = this.getPathNode(cId);
            res = data;
        } else if (this.pathIns._pathObjs[pId]) {
            path = this.getPathNode(pId);
            res = pData;
        } else {
            return false;
        }

        const { id, state } = path.userData;
        return {
            id,
            state,
            ...res
        };
    }

    // 获取路径节点
    getPathNode(id) {
        return this.pathIns.getPathNode(id);
    }

    /**
     * @description 添加路径
     * @author
     * @date 2021-12-23
     * @param {object} config 路径信息
     * @memberof PathFlows
     */
    addPath(config, state = true) {
        if (!config.id || !config.points || !config.points.length) {
            return false;
        }

        if (state) {
            for (let i = 0; i < this.config.data.length; i++) {
                if (this.config.data[i].id === config.id) {
                    return false;
                }
            }
        }

        this.pathIns.addPath(config);
        return true;
    }

    // 移动物动画
    moverAnimate(id, radio, scale) {
        this.moverIns.animate(id, radio, scale);
    }

    // 对外接口
    /**
     * [setConfig 根据type设置不同效果]
     * @DateTime 2021-08-11
     * @param    {[string]}   type      [更改类别]
     * @param    {[object]}   opts      [配置参数]
     */
    setConfig(type, opts) {
        return Interface.setConfig.call(this, type, opts);
    }

    /**
     * [getConfig 根据type 获取不同返回]
     * @DateTime 2021-08-11
     * @param    {[string]}   type      [更改类别]
     * @param    {[object]}   opts      [配置参数]
     */
    getConfig(type, opts) {
        return Interface.getConfig.call(this, type, opts);
    }
}
// 组件描述
PathFlows.description = '路径动画';

export default PathFlows;
