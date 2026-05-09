/* eslint-disable no-unused-vars */
/**
 * @author
 * [Interface 接口文件]  this指向组件实例
*/
import glUtil from '@glUtil';

export default {
    /**
     * [setConfig 根据type 执行不同逻辑]
     * @DateTime 2021-08-11
     * @param    {[string]}   type      [更改类别]
     * @param    {[object]}   option    [配置参数]
     */
    setConfig(type, opts = {}) {
        const end = null;
        switch (type) {
        case 'listener': // 监听注册 { name名称, callback执行方法, triggerOnce只执行一次 }
            this.on(opts.name, opts.callback, opts.triggerOnce);
            break;
        case 'hide':
            this.pathIns.hide(opts.ids, opts.time, opts.callback); // 隐藏路径
            this.moverIns.hide(opts.ids, opts.time, opts.callback); // 隐藏物体
            break;
        case 'show':
            this.pathIns.show(opts.ids, opts.time, opts.callback); // 显示路径
            this.moverIns.show(opts.ids, opts.time, opts.callback); // 显示物体
            break;
        case 'addMover': // 添加移动物
            this.moverIns.addMover(opts);
            break;
        case 'addPath': //
            if (glUtil.isArray(opts) && opts.length) {
                opts.forEach((item) => {
                    if (this.addPath(item)) {
                        // 添加路径
                        this.config.data.push(item);
                    }
                });
            }
            break;
        case 'delete': // 删除路径和对应移动物
            this.pathIns.delPath(opts.ids); // 删除路径
            this.moverIns.delMover(opts.ids);  // 删除移动物
            this.config.data = this.config.data.filter((item) => !opts.ids.includes(item.id));
            break;
        case 'stop':// 暂停动画
            this.pathIns.stop(opts.ids);
            break;
        case 'play':// 开启动画
            this.pathIns.play(opts.ids);
            break;
        case 'radio':// 手动设置位置
            this.pathIns.setPathRadio(opts.ids, opts.radio);
            break;
        case 'aniTime':// 设置运动时间
            this.pathIns.setPathAniTime(opts.ids, opts.time);
            break;
        case 'speed':// 设置运动速度
            this.pathIns.setPathAniTime(opts.ids, opts.speed);
            break;
        default: break;
        }
        return end;
    },

    /**
     * [getConfig 根据type 获取不同返回]
     * @DateTime 2021-08-11
     * @param    {[string]}   type      [更改类别]
     * @param    {[object]}   option    [配置参数]
     */
    getConfig(type, opts = {}) {
        let end = null;
        switch (type) {
        case 'pathInfo': // 获取路径信息
            {
                const node = this.getPathNode(opts.id);
                if (node) {
                    const { id, vecs, time } = node.userData;
                    end = { id, path: vecs, position: vecs[time] };
                }
            }
            break;
        case 'bufData':
            end = this.pathIns.bufferPos;
            break;
        case 'path':
            end = this.pathIns._pathObjs[opts.id];
            break;
        case 'data':
            end = this.config.data;
            break;
        case 'radio':
            end = this.pathIns._pathObjs[opts.id].userData.radio;
            break;
        default: break;
        }
        return end;
    }
};
