/* eslint-disable no-unused-vars */
/**
 * English comment.
 */
import glUtil from '@glUtil';

export default {
    /**
     * English comment.
     */
    setConfig(type, opts = {}) {
        const end = null;
        switch (type) {
        case 'listener': // English comment.
            this.on(opts.name, opts.callback, opts.triggerOnce);
            break;
        case 'hide':
            this.pathIns.hide(opts.ids, opts.time, opts.callback); // English comment.
            this.moverIns.hide(opts.ids, opts.time, opts.callback); // English comment.
            break;
        case 'show':
            this.pathIns.show(opts.ids, opts.time, opts.callback); // English comment.
            this.moverIns.show(opts.ids, opts.time, opts.callback); // English comment.
            break;
        case 'addMover': // English comment.
            this.moverIns.addMover(opts);
            break;
        case 'addPath': //
            if (glUtil.isArray(opts) && opts.length) {
                opts.forEach((item) => {
                    if (this.addPath(item)) {
                        // English comment.
                        this.config.data.push(item);
                    }
                });
            }
            break;
        case 'delete': // English comment.
            this.pathIns.delPath(opts.ids); // English comment.
            this.moverIns.delMover(opts.ids);  // English comment.
            this.config.data = this.config.data.filter((item) => !opts.ids.includes(item.id));
            break;
        case 'stop':// English comment.
            this.pathIns.stop(opts.ids);
            break;
        case 'play':// English comment.
            this.pathIns.play(opts.ids);
            break;
        case 'radio':// English comment.
            this.pathIns.setPathRadio(opts.ids, opts.radio);
            break;
        case 'aniTime':// English comment.
            this.pathIns.setPathAniTime(opts.ids, opts.time);
            break;
        case 'speed':// English comment.
            this.pathIns.setPathAniTime(opts.ids, opts.speed);
            break;
        default: break;
        }
        return end;
    },

    /**
     * English comment.
     */
    getConfig(type, opts = {}) {
        let end = null;
        switch (type) {
        case 'pathInfo': // English comment.
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
