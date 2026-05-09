const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);
const WGS84_EP2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);

export const GEO_FIT_METHODS = Object.freeze({
    NONE: 'none',
    SIMILARITY_2D: 'similarity2d',
    SIMILARITY_3D: 'similarity3d',
    AFFINE: 'affine'
});

const FIT_METHOD_LABELS = Object.freeze({
    [GEO_FIT_METHODS.NONE]: '未启用拟合',
    [GEO_FIT_METHODS.SIMILARITY_2D]: '2D 四参数',
    [GEO_FIT_METHODS.SIMILARITY_3D]: '3D 七参数',
    [GEO_FIT_METHODS.AFFINE]: '仿射'
});

const FIT_METHOD_MIN_POINTS = Object.freeze({
    [GEO_FIT_METHODS.NONE]: 0,
    [GEO_FIT_METHODS.SIMILARITY_2D]: 2,
    [GEO_FIT_METHODS.SIMILARITY_3D]: 3,
    [GEO_FIT_METHODS.AFFINE]: 4
});

const SUPPORTED_AXES = new Set(['xEast_yUp_zNorth']);
const FIT_METHODS = new Set(Object.values(GEO_FIT_METHODS));
const EPSILON = 1e-10;

function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function almostZero(value, epsilon = EPSILON) {
    return Math.abs(Number(value) || 0) <= epsilon;
}

function cloneVec3(value, fallback = [0, 0, 0]) {
    return [
        toFiniteNumber(value?.[0], fallback[0]),
        toFiniteNumber(value?.[1], fallback[1]),
        toFiniteNumber(value?.[2], fallback[2])
    ];
}

function addVec3(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subVec3(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec3(v, scalar) {
    return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function dotVec3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lengthVec3(v) {
    return Math.sqrt(dotVec3(v, v));
}

function averageVec3(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return [0, 0, 0];
    }

    const total = list.reduce((sum, item) => addVec3(sum, item), [0, 0, 0]);
    return scaleVec3(total, 1 / list.length);
}

function multiplyMat3Vec3(matrix, vector) {
    return [
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2]
    ];
}

function transposeMat3(matrix) {
    return [
        [matrix[0][0], matrix[1][0], matrix[2][0]],
        [matrix[0][1], matrix[1][1], matrix[2][1]],
        [matrix[0][2], matrix[1][2], matrix[2][2]]
    ];
}

function determinantMat3(matrix) {
    return (
        matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
        - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
        + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
    );
}

function invertMat3(matrix) {
    const det = determinantMat3(matrix);
    if (almostZero(det)) return null;

    const invDet = 1 / det;
    return [
        [
            (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) * invDet,
            (matrix[0][2] * matrix[2][1] - matrix[0][1] * matrix[2][2]) * invDet,
            (matrix[0][1] * matrix[1][2] - matrix[0][2] * matrix[1][1]) * invDet
        ],
        [
            (matrix[1][2] * matrix[2][0] - matrix[1][0] * matrix[2][2]) * invDet,
            (matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0]) * invDet,
            (matrix[0][2] * matrix[1][0] - matrix[0][0] * matrix[1][2]) * invDet
        ],
        [
            (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]) * invDet,
            (matrix[0][1] * matrix[2][0] - matrix[0][0] * matrix[2][1]) * invDet,
            (matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]) * invDet
        ]
    ];
}

function multiplyMat4Vec4(matrix, vector) {
    return [
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2] + matrix[0][3] * vector[3],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2] + matrix[1][3] * vector[3],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2] + matrix[2][3] * vector[3],
        matrix[3][0] * vector[0] + matrix[3][1] * vector[1] + matrix[3][2] * vector[2] + matrix[3][3] * vector[3]
    ];
}

function normalizeVec4(vector) {
    const length = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
    if (almostZero(length)) return null;
    return vector.map((item) => item / length);
}

function solveLinearSystem(matrix, vector) {
    const size = Array.isArray(matrix) ? matrix.length : 0;
    if (!size || !Array.isArray(vector) || vector.length !== size) {
        return null;
    }

    const augmented = matrix.map((row, rowIndex) => [
        ...(Array.isArray(row) ? row.slice(0, size).map((item) => toFiniteNumber(item, 0)) : Array(size).fill(0)),
        toFiniteNumber(vector[rowIndex], 0)
    ]);

    for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
        let maxRow = pivotIndex;
        let maxValue = Math.abs(augmented[pivotIndex][pivotIndex]);

        for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
            const candidate = Math.abs(augmented[rowIndex][pivotIndex]);
            if (candidate > maxValue) {
                maxValue = candidate;
                maxRow = rowIndex;
            }
        }

        if (almostZero(maxValue)) {
            return null;
        }

        if (maxRow !== pivotIndex) {
            const temp = augmented[pivotIndex];
            augmented[pivotIndex] = augmented[maxRow];
            augmented[maxRow] = temp;
        }

        const pivotValue = augmented[pivotIndex][pivotIndex];
        for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
            augmented[pivotIndex][columnIndex] /= pivotValue;
        }

        for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
            if (rowIndex === pivotIndex) continue;
            const factor = augmented[rowIndex][pivotIndex];
            if (almostZero(factor)) continue;

            for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
                augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex];
            }
        }
    }

    return augmented.map((row) => row[size]);
}

function degToRad(value) {
    return (Number(value) || 0) * (Math.PI / 180);
}

function radToDeg(value) {
    return (Number(value) || 0) * (180 / Math.PI);
}

function geodeticToEcef(geo) {
    const [lng, lat, alt] = cloneVec3(geo);
    const lonRad = degToRad(lng);
    const latRad = degToRad(lat);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);
    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

    return [
        (n + alt) * cosLat * cosLon,
        (n + alt) * cosLat * sinLon,
        (n * (1 - WGS84_E2) + alt) * sinLat
    ];
}

function ecefToGeodetic(ecef) {
    const [x, y, z] = cloneVec3(ecef);
    const p = Math.sqrt(x * x + y * y);
    const lon = Math.atan2(y, x);
    const theta = Math.atan2(z * WGS84_A, p * WGS84_B);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const lat = Math.atan2(
        z + WGS84_EP2 * WGS84_B * sinTheta * sinTheta * sinTheta,
        p - WGS84_E2 * WGS84_A * cosTheta * cosTheta * cosTheta
    );
    const sinLat = Math.sin(lat);
    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    const alt = (p / Math.max(Math.cos(lat), EPSILON)) - n;

    return [radToDeg(lon), radToDeg(lat), alt];
}

function buildEcefToEnuRotation(originGeo) {
    const [lng, lat] = cloneVec3(originGeo);
    const lonRad = degToRad(lng);
    const latRad = degToRad(lat);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);

    return [
        [-sinLon, cosLon, 0],
        [-sinLat * cosLon, -sinLat * sinLon, cosLat],
        [cosLat * cosLon, cosLat * sinLon, sinLat]
    ];
}

function enuToSceneLocal(enu) {
    return [enu[0], enu[2], enu[1]];
}

function sceneLocalToEnu(local) {
    return [local[0], local[2], local[1]];
}

function geodeticToSceneLocal(geo, originGeo) {
    const originEcef = geodeticToEcef(originGeo);
    const pointEcef = geodeticToEcef(geo);
    const diff = subVec3(pointEcef, originEcef);
    const ecefToEnu = buildEcefToEnuRotation(originGeo);
    const enu = multiplyMat3Vec3(ecefToEnu, diff);
    return enuToSceneLocal(enu);
}

function sceneLocalToGeodetic(local, originGeo) {
    const enu = sceneLocalToEnu(local);
    const enuToEcef = transposeMat3(buildEcefToEnuRotation(originGeo));
    const originEcef = geodeticToEcef(originGeo);
    const diff = multiplyMat3Vec3(enuToEcef, enu);
    return ecefToGeodetic(addVec3(originEcef, diff));
}

function looksUnsetOrigin(origin) {
    return almostZero(origin[0]) && almostZero(origin[1]) && almostZero(origin[2]);
}

export function getGeoFitMethodLabel(method) {
    return FIT_METHOD_LABELS[method] || FIT_METHOD_LABELS[GEO_FIT_METHODS.NONE];
}

function normalizeGeoTriplet(raw) {
    if (Array.isArray(raw) && raw.length >= 3) {
        return cloneVec3(raw);
    }

    if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.geo) && raw.geo.length >= 3) {
            return cloneVec3(raw.geo);
        }

        if (Array.isArray(raw.world) && raw.world.length >= 3) {
            return cloneVec3(raw.world);
        }

        if (Array.isArray(raw.lngLat) && raw.lngLat.length >= 2) {
            return [
                toFiniteNumber(raw.lngLat[0], 0),
                toFiniteNumber(raw.lngLat[1], 0),
                toFiniteNumber(raw.alt, 0)
            ];
        }

        if (isFiniteNumber(raw.lng) && isFiniteNumber(raw.lat)) {
            return [
                toFiniteNumber(raw.lng, 0),
                toFiniteNumber(raw.lat, 0),
                toFiniteNumber(raw.alt, 0)
            ];
        }
    }

    return null;
}

export function normalizeGeoControlPoint(rawPoint, index = 0) {
    const source = rawPoint && typeof rawPoint === 'object' ? rawPoint : {};
    const model = cloneVec3(source.model ?? source.xyz ?? source.position ?? [0, 0, 0]);
    const geo = normalizeGeoTriplet(source.geo ?? source.world ?? source);
    const id = String(source.id || `control_point_${index + 1}`);
    const name = String(source.name || `控制点${index + 1}`);

    return {
        id,
        name,
        model,
        geo,
        valid: Array.isArray(geo) && geo.length >= 3
    };
}

export function normalizeTrafficCoordinateSystemConfig(rawConfig = {}) {
    const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const fittingSource = source.fitting && typeof source.fitting === 'object' ? source.fitting : {};
    const rawControlPoints = Array.isArray(fittingSource.controlPoints)
        ? fittingSource.controlPoints
        : [];
    const controlPoints = rawControlPoints.map((item, index) => normalizeGeoControlPoint(item, index));

    const method = FIT_METHODS.has(fittingSource.method)
        ? fittingSource.method
        : GEO_FIT_METHODS.NONE;

    const originLngLatAlt = cloneVec3(source.originLngLatAlt ?? source.origin ?? [0, 0, 0]);
    const resolvedOrigin = looksUnsetOrigin(originLngLatAlt) && controlPoints[0]?.valid
        ? cloneVec3(controlPoints[0].geo, originLngLatAlt)
        : originLngLatAlt;

    return {
        mode: source.mode === 'geo' ? 'geo' : 'xyz',
        axis: SUPPORTED_AXES.has(source.axis) ? source.axis : 'xEast_yUp_zNorth',
        originLngLatAlt: resolvedOrigin,
        fitting: {
            method,
            controlPoints
        }
    };
}

function buildFitPairs(controlPoints, originLngLatAlt) {
    return controlPoints
        .filter((item) => item?.valid)
        .map((item) => ({
            ...item,
            worldLocal: geodeticToSceneLocal(item.geo, originLngLatAlt)
        }));
}

function buildResidualSummary(pairs, forward) {
    const residuals = pairs.map((pair) => {
        const estimated = forward(pair.model);
        const delta = subVec3(estimated, pair.worldLocal);
        const residual = lengthVec3(delta);

        return {
            id: pair.id,
            name: pair.name,
            residual,
            delta,
            model: cloneVec3(pair.model),
            geo: cloneVec3(pair.geo),
            worldLocal: cloneVec3(pair.worldLocal),
            estimated: cloneVec3(estimated)
        };
    });

    const rms = residuals.length
        ? Math.sqrt(residuals.reduce((sum, item) => sum + item.residual * item.residual, 0) / residuals.length)
        : 0;
    const maxResidual = residuals.reduce((maxValue, item) => Math.max(maxValue, item.residual), 0);

    return {
        residuals,
        rms,
        maxResidual
    };
}

function buildInvalidFitResult(method, controlPointCount, message) {
    return {
        method,
        label: getGeoFitMethodLabel(method),
        valid: false,
        controlPointCount,
        minRequired: FIT_METHOD_MIN_POINTS[method] || 0,
        message,
        parameters: null,
        residuals: [],
        rms: null,
        maxResidual: null,
        forward: (value) => cloneVec3(value),
        inverse: (value) => cloneVec3(value)
    };
}

function fitSimilarity2D(pairs) {
    if (pairs.length < FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.SIMILARITY_2D]) {
        return buildInvalidFitResult(
            GEO_FIT_METHODS.SIMILARITY_2D,
            pairs.length,
            `2D 四参数拟合至少需要 ${FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.SIMILARITY_2D]} 个有效控制点`
        );
    }

    const source2D = pairs.map((pair) => [pair.model[0], pair.model[2]]);
    const target2D = pairs.map((pair) => [pair.worldLocal[0], pair.worldLocal[2]]);

    const sourceMean = source2D.reduce((sum, item) => [sum[0] + item[0], sum[1] + item[1]], [0, 0]).map((item) => item / pairs.length);
    const targetMean = target2D.reduce((sum, item) => [sum[0] + item[0], sum[1] + item[1]], [0, 0]).map((item) => item / pairs.length);

    let sumA = 0;
    let sumB = 0;
    let sumSourceNorm = 0;

    for (let index = 0; index < pairs.length; index += 1) {
        const sx = source2D[index][0] - sourceMean[0];
        const sz = source2D[index][1] - sourceMean[1];
        const tx = target2D[index][0] - targetMean[0];
        const tz = target2D[index][1] - targetMean[1];

        sumA += sx * tx + sz * tz;
        sumB += sx * tz - sz * tx;
        sumSourceNorm += sx * sx + sz * sz;
    }

    if (almostZero(sumSourceNorm)) {
        return buildInvalidFitResult(GEO_FIT_METHODS.SIMILARITY_2D, pairs.length, '2D 控制点在模型平面上退化，无法解算');
    }

    const angle = Math.atan2(sumB, sumA);
    const scale = Math.sqrt(sumA * sumA + sumB * sumB) / sumSourceNorm;
    if (almostZero(scale)) {
        return buildInvalidFitResult(GEO_FIT_METHODS.SIMILARITY_2D, pairs.length, '2D 拟合尺度退化，无法解算');
    }

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tx = targetMean[0] - scale * (cos * sourceMean[0] - sin * sourceMean[1]);
    const tz = targetMean[1] - scale * (sin * sourceMean[0] + cos * sourceMean[1]);
    const ty = pairs.reduce((sum, pair) => sum + (pair.worldLocal[1] - scale * pair.model[1]), 0) / pairs.length;

    const forward = (model) => {
        const point = cloneVec3(model);
        return [
            tx + scale * (cos * point[0] - sin * point[2]),
            ty + scale * point[1],
            tz + scale * (sin * point[0] + cos * point[2])
        ];
    };

    const inverse = (worldLocal) => {
        const point = cloneVec3(worldLocal);
        const dx = point[0] - tx;
        const dz = point[2] - tz;
        return [
            (cos * dx + sin * dz) / scale,
            (point[1] - ty) / scale,
            (-sin * dx + cos * dz) / scale
        ];
    };

    const summary = buildResidualSummary(pairs, forward);

    return {
        method: GEO_FIT_METHODS.SIMILARITY_2D,
        label: getGeoFitMethodLabel(GEO_FIT_METHODS.SIMILARITY_2D),
        valid: true,
        controlPointCount: pairs.length,
        minRequired: FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.SIMILARITY_2D],
        message: '2D 四参数拟合已完成',
        parameters: {
            translation: [tx, ty, tz],
            scale,
            rotationRad: [0, angle, 0],
            rotationDeg: [0, radToDeg(angle), 0]
        },
        residuals: summary.residuals,
        rms: summary.rms,
        maxResidual: summary.maxResidual,
        forward,
        inverse
    };
}

function buildHornMatrix(covariance) {
    const sxx = covariance[0][0];
    const sxy = covariance[0][1];
    const sxz = covariance[0][2];
    const syx = covariance[1][0];
    const syy = covariance[1][1];
    const syz = covariance[1][2];
    const szx = covariance[2][0];
    const szy = covariance[2][1];
    const szz = covariance[2][2];

    return [
        [sxx + syy + szz, syz - szy, szx - sxz, sxy - syx],
        [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
        [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
        [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz]
    ];
}

function dominantQuaternionFromCovariance(covariance) {
    const hornMatrix = buildHornMatrix(covariance);
    let vector = [1, 0, 0, 0];

    for (let iteration = 0; iteration < 64; iteration += 1) {
        const next = normalizeVec4(multiplyMat4Vec4(hornMatrix, vector));
        if (!next) break;

        const delta = Math.max(
            Math.abs(next[0] - vector[0]),
            Math.abs(next[1] - vector[1]),
            Math.abs(next[2] - vector[2]),
            Math.abs(next[3] - vector[3])
        );

        vector = next;
        if (delta < 1e-12) break;
    }

    return normalizeVec4(vector) || [1, 0, 0, 0];
}

function quaternionToMat3(quaternion) {
    const normalized = normalizeVec4(quaternion) || [1, 0, 0, 0];
    const [w, x, y, z] = normalized;
    const xx = x * x;
    const yy = y * y;
    const zz = z * z;
    const xy = x * y;
    const xz = x * z;
    const yz = y * z;
    const wx = w * x;
    const wy = w * y;
    const wz = w * z;

    return [
        [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
        [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
        [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
    ];
}

function fitSimilarity3D(pairs) {
    if (pairs.length < FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.SIMILARITY_3D]) {
        return buildInvalidFitResult(
            GEO_FIT_METHODS.SIMILARITY_3D,
            pairs.length,
            `3D 七参数拟合至少需要 ${FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.SIMILARITY_3D]} 个有效控制点`
        );
    }

    const sourceMean = averageVec3(pairs.map((pair) => pair.model));
    const targetMean = averageVec3(pairs.map((pair) => pair.worldLocal));

    const covariance = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];

    let sourceNorm = 0;
    for (const pair of pairs) {
        const sourceCentered = subVec3(pair.model, sourceMean);
        const targetCentered = subVec3(pair.worldLocal, targetMean);
        sourceNorm += dotVec3(sourceCentered, sourceCentered);

        for (let row = 0; row < 3; row += 1) {
            for (let column = 0; column < 3; column += 1) {
                covariance[row][column] += targetCentered[row] * sourceCentered[column];
            }
        }
    }

    if (almostZero(sourceNorm)) {
        return buildInvalidFitResult(GEO_FIT_METHODS.SIMILARITY_3D, pairs.length, '3D 控制点退化，无法解算旋转与尺度');
    }

    const quaternion = dominantQuaternionFromCovariance(covariance);
    const rotation = transposeMat3(quaternionToMat3(quaternion));
    let scaleNumerator = 0;

    for (const pair of pairs) {
        const sourceCentered = subVec3(pair.model, sourceMean);
        const targetCentered = subVec3(pair.worldLocal, targetMean);
        scaleNumerator += dotVec3(targetCentered, multiplyMat3Vec3(rotation, sourceCentered));
    }

    const scale = scaleNumerator / sourceNorm;
    if (!Number.isFinite(scale) || almostZero(scale)) {
        return buildInvalidFitResult(GEO_FIT_METHODS.SIMILARITY_3D, pairs.length, '3D 拟合尺度退化，无法解算');
    }

    const translation = subVec3(targetMean, scaleVec3(multiplyMat3Vec3(rotation, sourceMean), scale));
    const inverseRotation = transposeMat3(rotation);

    const forward = (model) => addVec3(scaleVec3(multiplyMat3Vec3(rotation, cloneVec3(model)), scale), translation);
    const inverse = (worldLocal) => {
        const shifted = subVec3(cloneVec3(worldLocal), translation);
        return multiplyMat3Vec3(inverseRotation, scaleVec3(shifted, 1 / scale));
    };

    const summary = buildResidualSummary(pairs, forward);

    return {
        method: GEO_FIT_METHODS.SIMILARITY_3D,
        label: getGeoFitMethodLabel(GEO_FIT_METHODS.SIMILARITY_3D),
        valid: true,
        controlPointCount: pairs.length,
        minRequired: FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.SIMILARITY_3D],
        message: '3D 七参数拟合已完成',
        parameters: {
            translation,
            scale,
            rotationMatrix: rotation,
            quaternion
        },
        residuals: summary.residuals,
        rms: summary.rms,
        maxResidual: summary.maxResidual,
        forward,
        inverse
    };
}

function fitAffine(pairs) {
    if (pairs.length < FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.AFFINE]) {
        return buildInvalidFitResult(
            GEO_FIT_METHODS.AFFINE,
            pairs.length,
            `仿射拟合至少需要 ${FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.AFFINE]} 个有效控制点`
        );
    }

    const normalMatrix = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];
    const targetVectors = {
        x: [0, 0, 0, 0],
        y: [0, 0, 0, 0],
        z: [0, 0, 0, 0]
    };

    for (const pair of pairs) {
        const row = [pair.model[0], pair.model[1], pair.model[2], 1];

        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                normalMatrix[i][j] += row[i] * row[j];
            }
        }

        targetVectors.x = targetVectors.x.map((item, index) => item + row[index] * pair.worldLocal[0]);
        targetVectors.y = targetVectors.y.map((item, index) => item + row[index] * pair.worldLocal[1]);
        targetVectors.z = targetVectors.z.map((item, index) => item + row[index] * pair.worldLocal[2]);
    }

    const coeffX = solveLinearSystem(normalMatrix, targetVectors.x);
    const coeffY = solveLinearSystem(normalMatrix, targetVectors.y);
    const coeffZ = solveLinearSystem(normalMatrix, targetVectors.z);

    if (!coeffX || !coeffY || !coeffZ) {
        return buildInvalidFitResult(GEO_FIT_METHODS.AFFINE, pairs.length, '仿射拟合矩阵退化，无法解算');
    }

    const matrix = [
        [coeffX[0], coeffX[1], coeffX[2]],
        [coeffY[0], coeffY[1], coeffY[2]],
        [coeffZ[0], coeffZ[1], coeffZ[2]]
    ];
    const translation = [coeffX[3], coeffY[3], coeffZ[3]];
    const inverseMatrix = invertMat3(matrix);

    if (!inverseMatrix) {
        return buildInvalidFitResult(GEO_FIT_METHODS.AFFINE, pairs.length, '仿射矩阵不可逆，无法完成反算');
    }

    const forward = (model) => addVec3(multiplyMat3Vec3(matrix, cloneVec3(model)), translation);
    const inverse = (worldLocal) => multiplyMat3Vec3(inverseMatrix, subVec3(cloneVec3(worldLocal), translation));
    const summary = buildResidualSummary(pairs, forward);

    return {
        method: GEO_FIT_METHODS.AFFINE,
        label: getGeoFitMethodLabel(GEO_FIT_METHODS.AFFINE),
        valid: true,
        controlPointCount: pairs.length,
        minRequired: FIT_METHOD_MIN_POINTS[GEO_FIT_METHODS.AFFINE],
        message: '仿射拟合已完成',
        parameters: {
            matrix,
            translation
        },
        residuals: summary.residuals,
        rms: summary.rms,
        maxResidual: summary.maxResidual,
        forward,
        inverse
    };
}

export function solveTrafficGeoCoordinateFit(rawCoordinateSystem = {}) {
    const coordinateSystem = normalizeTrafficCoordinateSystemConfig(rawCoordinateSystem);
    const method = coordinateSystem.fitting.method;
    const pairs = buildFitPairs(coordinateSystem.fitting.controlPoints, coordinateSystem.originLngLatAlt);

    if (method === GEO_FIT_METHODS.NONE) {
        return buildInvalidFitResult(
            GEO_FIT_METHODS.NONE,
            pairs.length,
            '未启用控制点拟合，按 ENU 原点直接换算'
        );
    }

    switch (method) {
        case GEO_FIT_METHODS.SIMILARITY_2D:
            return fitSimilarity2D(pairs);
        case GEO_FIT_METHODS.SIMILARITY_3D:
            return fitSimilarity3D(pairs);
        case GEO_FIT_METHODS.AFFINE:
            return fitAffine(pairs);
        default:
            return buildInvalidFitResult(method, pairs.length, '未知的拟合方式');
    }
}

export function createTrafficGeoCoordinateTransformer(rawCoordinateSystem = {}) {
    const coordinateSystem = normalizeTrafficCoordinateSystemConfig(rawCoordinateSystem);
    const fitResult = solveTrafficGeoCoordinateFit(coordinateSystem);
    const forward = fitResult.valid ? fitResult.forward : (value) => cloneVec3(value);
    const inverse = fitResult.valid ? fitResult.inverse : (value) => cloneVec3(value);

    return {
        coordinateSystem,
        fitResult,
        hasFit: !!fitResult.valid,
        originLngLatAlt: cloneVec3(coordinateSystem.originLngLatAlt),
        modelToLocal(model) {
            return forward(model);
        },
        localToModel(local) {
            return inverse(local);
        },
        geoToLocal(geo) {
            return geodeticToSceneLocal(geo, coordinateSystem.originLngLatAlt);
        },
        localToGeo(local) {
            return sceneLocalToGeodetic(local, coordinateSystem.originLngLatAlt);
        },
        geoToModel(geo) {
            return inverse(geodeticToSceneLocal(geo, coordinateSystem.originLngLatAlt));
        },
        modelToGeo(model) {
            return sceneLocalToGeodetic(forward(model), coordinateSystem.originLngLatAlt);
        }
    };
}
