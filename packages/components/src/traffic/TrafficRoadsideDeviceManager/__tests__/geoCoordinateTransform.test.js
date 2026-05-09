import { describe, expect, it } from 'vitest';
import {
    GEO_FIT_METHODS,
    createTrafficGeoCoordinateTransformer
} from '../geoCoordinateTransform.js';

const ORIGIN = [121.4737, 31.2304, 8.5];

const approxArray = (actual, expected, epsilon = 1e-4) => {
    expect(actual).toHaveLength(expected.length);
    actual.forEach((value, index) => {
        expect(Math.abs(value - expected[index])).toBeLessThan(epsilon);
    });
};

const toGeoControlPoints = (method, items) => {
    const geoIdentity = createTrafficGeoCoordinateTransformer({
        mode: 'geo',
        originLngLatAlt: ORIGIN,
        fitting: {
            method: GEO_FIT_METHODS.NONE,
            controlPoints: []
        }
    });

    return {
        mode: 'geo',
        originLngLatAlt: ORIGIN,
        fitting: {
            method,
            controlPoints: items.map((item, index) => ({
                id: `cp_${index + 1}`,
                name: `CP${index + 1}`,
                model: item.model,
                geo: geoIdentity.localToGeo(item.worldLocal)
            }))
        }
    };
};

describe('geoCoordinateTransform', () => {
    it('solves 2D four-parameter fitting', () => {
        const angle = Math.PI / 6;
        const scale = 2.25;
        const tx = 120;
        const ty = 8;
        const tz = -64;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const forward = ([x, y, z]) => [
            tx + scale * (cos * x - sin * z),
            ty + scale * y,
            tz + scale * (sin * x + cos * z)
        ];

        const points = [
            [0, 0, 0],
            [12, 0, 0],
            [0, 0, 18],
            [5, 2, 9]
        ].map((model) => ({
            model,
            worldLocal: forward(model)
        }));

        const transformer = createTrafficGeoCoordinateTransformer(
            toGeoControlPoints(GEO_FIT_METHODS.SIMILARITY_2D, points)
        );

        expect(transformer.fitResult.valid).toBe(true);
        approxArray(transformer.modelToLocal([4, 1.5, 7]), forward([4, 1.5, 7]), 1e-4);
        approxArray(transformer.geoToModel(transformer.localToGeo(forward([4, 1.5, 7]))), [4, 1.5, 7], 1e-4);
    });

    it('solves 3D seven-parameter fitting', () => {
        const scale = 1.7;
        const tx = -48;
        const ty = 16;
        const tz = 33;

        const rotate = ([x, y, z]) => [
            0 * x + -1 * y + 0 * z,
            1 * x + 0 * y + 0 * z,
            0 * x + 0 * y + 1 * z
        ];

        const forward = (model) => {
            const rotated = rotate(model);
            return [
                tx + scale * rotated[0],
                ty + scale * rotated[1],
                tz + scale * rotated[2]
            ];
        };

        const points = [
            [0, 0, 0],
            [10, 0, 0],
            [0, 6, 0],
            [0, 0, 12],
            [5, 3, 7]
        ].map((model) => ({
            model,
            worldLocal: forward(model)
        }));

        const transformer = createTrafficGeoCoordinateTransformer(
            toGeoControlPoints(GEO_FIT_METHODS.SIMILARITY_3D, points)
        );

        expect(transformer.fitResult.valid).toBe(true);
        approxArray(transformer.modelToLocal([2, 4, 8]), forward([2, 4, 8]), 1e-4);
        approxArray(transformer.geoToModel(transformer.localToGeo(forward([2, 4, 8]))), [2, 4, 8], 1e-4);
    });

    it('solves affine fitting', () => {
        const forward = ([x, y, z]) => [
            10 + 1.2 * x + 0.1 * y - 0.05 * z,
            -8 + 0.2 * x + 0.95 * y + 0.08 * z,
            4 - 0.12 * x + 0.04 * y + 1.1 * z
        ];

        const points = [
            [0, 0, 0],
            [8, 0, 0],
            [0, 7, 0],
            [0, 0, 5],
            [3, 4, 2]
        ].map((model) => ({
            model,
            worldLocal: forward(model)
        }));

        const transformer = createTrafficGeoCoordinateTransformer(
            toGeoControlPoints(GEO_FIT_METHODS.AFFINE, points)
        );

        expect(transformer.fitResult.valid).toBe(true);
        approxArray(transformer.modelToLocal([2, 5, 3]), forward([2, 5, 3]), 1e-4);
        approxArray(transformer.geoToModel(transformer.localToGeo(forward([2, 5, 3]))), [2, 5, 3], 1e-4);
    });
});
