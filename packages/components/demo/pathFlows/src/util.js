/**
 * @Author:
 * 路径组件方法集合
 */

const VEC3_COM1 = new THREE.Vector3();
const VEC3_COM2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
* @description 设置曲线点位
* @author
* @date 2021-12-23
* @param {Array} array 坐标数组
* @param {Number} count 速度
* @returns {Array} 曲线点位
*/
function getCurvePoints(array, dpi) {
    const paths = [];
    const res = {
        vecs: [],
        indexs: [0],
        cIndex: []
    };
    let j = 1;
    array.forEach((n) => {
        paths.push(new THREE.Vector3().set(n.x || 0, n.y || 0, n.z || 0));
    });
    const curve = new THREE.CatmullRomCurve3(paths);

    const len = curve.getLength() * dpi | 0;

    res.vecs = curve.getSpacedPoints(len);
    for (let i = 0; i <= len; i++) {
        res.cIndex.push(i, i);
        if (i > 1) {
            const pVec = res.vecs[i - 1];
            const cVec = res.vecs[i];
            const vv = VEC3_COM1.set(array[j].x, array[j].y, array[j].z);
            if (vv.distanceTo(pVec) <= cVec.distanceTo(vv)) {
                res.indexs.push((i - 1) / len);
                j++;
            }
        }
    }
    res.indexs.push(1);
    res.length = curve.getLength();
    return res;
}

// 判断3个点是否在一条直线
function arePointsCollinear(pointA, pointB, pointC) {
    // 计算向量AB和AC
    const AB = new THREE.Vector3().subVectors(pointB, pointA);
    const AC = new THREE.Vector3().subVectors(pointC, pointA);

    // 计算叉积
    const crossProduct = new THREE.Vector3().crossVectors(AB, AC);

    // 如果叉积的长度为零，则点位于同一条直线上
    return crossProduct.length() === 0;
}

/**
 * @description 直线打点
 * @author
 * @date 2022-03-04
 * @param {array} arr
 * @returns {*}
 */
function getTranformPath(arr, size = 1, isRadius = true) {
    let jj = 0;
    const res = {
        vecs: [],
        indexs: [0],
        cIndex: []
    };
    let allLen = 0;
    const orIndexs = [0];
    if (isRadius) {
        // 顶点圆角处理
        const arrs = [arr[0]];
        for (let i = 1; i < arr.length - 1; i++) {
            let pVec = VEC3_COM1.clone().copy(arr[i - 1]);
            const vec = VEC3_COM1.clone().copy(arr[i]);
            let nVec = VEC3_COM1.clone().copy(arr[i + 1]);
            if (!nVec) break;

            if (arePointsCollinear(pVec, vec, nVec)) {
                orIndexs.push(arrs.length);
                arrs.push(vec);
                continue;
            }

            const dis1 = vec.distanceTo(pVec);
            const dis2 = vec.distanceTo(nVec);
            if (dis1 > size) {
                pVec = pVec.lerp(vec, (dis1 - size) / dis1);
            }
            if (dis2 > size) {
                nVec = nVec.lerp(vec, (dis2 - size) / dis2);
            }

            const curve = new THREE.QuadraticBezierCurve3(
                pVec, vec, nVec
            );
            const points = curve.getPoints(11);
            orIndexs.push(arrs.length + 5);
            arrs.push(...points);
        }
        arrs.push(arr[arr.length - 1]);
        orIndexs.push(arrs.length - 1);
        arr = arrs;
    }

    for (let i = 1; i < arr.length; i++) {
        const src = arr[i - 1];
        const dst = arr[i];
        const s = VEC3_COM1.set(src.x, src.y, src.z);
        const d = VEC3_COM2.set(dst.x, dst.y, dst.z);
        const length = s.distanceTo(d);
        const len = Math.ceil(length);
        for (let j = 0; j < len; j++) {
            const l = j / len;
            const v = s.clone().lerp(d, Number.isNaN(l) ? 0 : l);
            res.vecs.push(v);
            res.cIndex.push(jj, jj);
            jj++;
        }
        if (!isRadius || orIndexs.includes(i)) {
            res.indexs.push(allLen + length);
        }
        allLen += length;
    }
    const last = arr[arr.length - 1];
    res.vecs.push(new THREE.Vector3(last.x, last.y, last.z));
    res.cIndex.push(jj, jj);
    res.indexs = res.indexs.map((item) => item / allLen);
    res.length = allLen;
    return res;
}

/**
* @description 点位数据处理
* @author
* @date 2022-01-06
* @param {Object} config 配置项
*/
function handlePoints(config) {
    const {
        points = [], isCurve, dpi = 1, size, isRadius
    } = config;
    let res = {};

    if (!points || !points.length) {
        return res;
    }

    if (isCurve) {
        res = getCurvePoints(points, dpi);
    } else {
        res = getTranformPath(points, size, isRadius);
    }
    return res;
}

/**
 * @description 获取线上某比例点位
 * @author
 * @param {*} vecs 勾选线的点位
 * @param {boolean} isCurve 是否曲线
 * @param {*} raido 比例
 */
function getLerpPosition(vecs, isCurve, raido) {
    raido = raido < 0 ? 0 : raido;
    if (raido >= 1) {
        return vecs[vecs.length - 1];
    }
    const path = vecs.map((vec) => VEC3_COM1.clone().copy(vec));
    if (isCurve) {
        const  curve = new THREE.CatmullRomCurve3(path);
        return curve.getPointAt(raido);
    }
    // 线段
    let allLen = 0;
    let aR = 0;
    const lenArry = [];
    for (let i = 1; i < path.length; i++) {
        const lVec = path[i - 1];
        const cVec = path[i];
        const len = cVec.distanceTo(lVec);
        lenArry.push(len);
        allLen += len;
    }
    for (let i = 0; i < lenArry.length; i++) {
        const dr = lenArry[i] / allLen;
        if (raido <= aR + dr) {
            return path[i].clone().lerp(path[i + 1], (raido - aR) / dr);
        }
        aR += dr;
    }
    return false;
}

/**
 * @description 根据前后点获取旋转四元数
 * @author
 * @param {*} pos 当前点
 * @param {*} nextPos 下一个点
 * @param {*} state 是否平面旋转
 * @returns {*}
 */
function getRotaion(cPos, nPos, state = false) {
    const mtx = new THREE.Matrix4();
    const pos = VEC3_COM1.clone().copy(cPos);
    const nextPos = VEC3_COM2.clone().copy(nPos);
    if (state) {
        pos.y = 0;
        nextPos.y = 0;
    }
    mtx.lookAt(pos, nextPos, UP);
    mtx.multiply(
        new THREE.Matrix4().makeRotationFromEuler(
            new THREE.Euler(0, 0, 0)
        )
    );
    return new THREE.Quaternion().setFromRotationMatrix(mtx);
}

export {
    handlePoints, getLerpPosition, getRotaion
};
