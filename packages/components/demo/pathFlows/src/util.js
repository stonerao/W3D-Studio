/**
 * English comment.
 */

const VEC3_COM1 = new THREE.Vector3();
const VEC3_COM2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * English comment.
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

// English comment.
function arePointsCollinear(pointA, pointB, pointC) {
    // English comment.
    const AB = new THREE.Vector3().subVectors(pointB, pointA);
    const AC = new THREE.Vector3().subVectors(pointC, pointA);

    // English comment.
    const crossProduct = new THREE.Vector3().crossVectors(AB, AC);

    // English comment.
    return crossProduct.length() === 0;
}

/**
 * English comment.
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
        // English comment.
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
 * English comment.
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
 * English comment.
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
    // English comment.
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
 * English comment.
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
