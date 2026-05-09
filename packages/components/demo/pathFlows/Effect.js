/* English comment. */

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
        // English comment.
        this.animate = (dt) => {
            if (!this.config.isAnimate) return; // eslint-disable-line
            this.pathIns.animate(dt);
        };
    }

    // English comment.
    setDefaultConfig(dfConfig) {
        glUtil.copy(dfConfig, {
            isCompEvents: false, // English comment.
            mtlConfig: { // English comment.
                transparent: true
            },
            geoStyle: 'plane', // English comment.
            size: 1, // English comment.
            isCurve: true, // English comment.
            autoPlay: true, // English comment.
            bgColor: 'rgba(255,255,255,0)', // English comment.
            bgTxueId: '', // English comment.
            bgRepeat: { x: 1, y: 1 }, // English comment.
            style: 'fill', // English comment.
            aniTime: 10, // English comment.
            speed: 0, // English comment.
            color: 'rgba(255,255,255,1)', // English comment.
            txueId: '', // English comment.
            repeat: { x: 1, y: 1 }, // English comment.
            radio: 0.001, // English comment.
            loop: true, // English comment.
            isSyn: false, // English comment.
            sizeAttenuation: true, // English comment.
            dpi: 10, // English comment.
            isRadius: true, // English comment.
            isFade: false, // English comment.
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

    // English comment.
    disposeCompEft() {
        this.pathIns.dispose();
        this.moverIns.dispose();
    }

    // English comment.
    compEftInit() {
        this.moverIns = new Mover(this);
        this.pathIns = new Path(this);

        // English comment.
        this.config.data.forEach((opt) => this.addPath(opt, false));

        // English comment.
        this._triggerInnerEvent('mounted', { val: this.config.name });
    }

    // English comment.
    getCameraScale() {
        const { camera, scene } = this.renderer;
        const fov = camera.fov * PI;  // English comment.
        const { aspect } = camera;
        const distance = camera.position.distanceTo(scene.position);  // English comment.
        return (2 * Math.tan(fov / 2) * distance) / aspect;
    }

    /**
     * English comment.
     */
    isSelfCom(node) {
        return node.userData.ceId === this.id;
    }

    // English comment.
    onMouseDown(e, array) {
        if (array && array[0] && this.isSelfCom(array[0].object)) {
            const mesh = array[0].object;
            const data = this.getOutData(mesh);
            this.selData = data;
            return [e, data];
        }
        return [e, []];
    }

    // English comment.
    onMouseIn(e, array) {
        if (array && array[0] && this.isSelfCom(array[0].object)) {
            const mesh = array[0].object;
            const data = this.getOutData(mesh);
            this.selData = data;
            return [e, data];
        }
        return [e, []];
    }

    // English comment.
    onMouseOut(e) {
        if (this.selData) {
            const data = glUtil.extend(true, this.selData, {});
            this.selData = null;
            return [e, data];
        }
        return [e, []];
    }

    // English comment.
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

    // English comment.
    getPathNode(id) {
        return this.pathIns.getPathNode(id);
    }

    /**
     * English comment.
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

    // English comment.
    moverAnimate(id, radio, scale) {
        this.moverIns.animate(id, radio, scale);
    }

    // English comment.
    /**
     * English comment.
     */
    setConfig(type, opts) {
        return Interface.setConfig.call(this, type, opts);
    }

    /**
     * English comment.
     */
    getConfig(type, opts) {
        return Interface.getConfig.call(this, type, opts);
    }
}
// English comment.
PathFlows.description = '路径动画';

export default PathFlows;
