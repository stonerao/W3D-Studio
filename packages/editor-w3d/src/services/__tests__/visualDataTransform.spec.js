import { describe, expect, it, vi } from 'vitest';
import {
    applyDataSourceTransform,
    applyVisualDataTransform,
    buildDataPathOptions,
    collectFieldOptions,
    coerceValue,
    createVisualTransformPreview,
    getRowsInfo,
    getValueByPath,
    inferFieldOptions,
    normalizeVisualTransformConfig
} from '../visualDataTransform';

describe('visualDataTransform', () => {
    it('reads nested values with dot and bracket paths', () => {
        const data = { data: { rows: [{ name: 'A' }] } };

        expect(getValueByPath(data, 'data.rows[0].name')).toBe('A');
        expect(getValueByPath(data, 'data.missing', 'fallback')).toBe('fallback');
    });

    it('extracts arrays and maps fields into target paths', () => {
        const result = applyVisualDataTransform({
            data: {
                rows: [
                    { title: 'Device A', lng: '1.5', lat: '2.5', height: '3.5', active: 'true' }
                ]
            }
        }, {
            enabled: true,
            inputPath: 'data',
            arrayPath: 'rows',
            mappings: [
                { target: 'name', source: 'title', type: 'string' },
                { target: 'position.x', source: 'lng', type: 'number' },
                { target: 'position.y', source: 'lat', type: 'number' },
                { target: 'position.z', source: 'height', type: 'number' },
                { target: 'enabled', source: 'active', type: 'boolean' }
            ]
        });

        expect(result).toEqual([
            {
                name: 'Device A',
                position: { x: 1.5, y: 2.5, z: 3.5 },
                enabled: true
            }
        ]);
    });

    it('filters, sorts, and limits rows before mapping', () => {
        const result = applyVisualDataTransform({
            rows: [
                { name: 'low', value: 2 },
                { name: 'high', value: 9 },
                { name: 'mid', value: 5 }
            ]
        }, {
            enabled: true,
            arrayPath: 'rows',
            filters: [{ field: 'value', operator: 'greaterOrEqual', value: 5 }],
            sort: { field: 'value', direction: 'desc' },
            limit: { enabled: true, count: 1 },
            mappings: [{ target: 'label', source: 'name', type: 'string' }]
        });

        expect(result).toEqual([{ label: 'high' }]);
    });

    it('uses fallback values and type coercion', () => {
        const result = applyVisualDataTransform([{ id: 1 }], {
            enabled: true,
            mappings: [
                { target: 'status', source: 'status', fallback: 'offline', type: 'string' },
                { target: 'position', source: 'position', fallback: '1,2,3', type: 'vector3' }
            ]
        });

        expect(result).toEqual([
            {
                status: 'offline',
                position: { x: 1, y: 2, z: 3 }
            }
        ]);
    });

    it('keeps legacy dataPath and transformFn behavior when visual config is disabled', () => {
        const result = applyDataSourceTransform({
            dataPath: 'payload.items',
            transformFn: 'function transform(data) { return data.map((item) => ({ value: item.value * 2 })); }'
        }, {
            payload: {
                items: [{ value: 3 }]
            }
        });

        expect(result).toEqual([{ value: 6 }]);
    });

    it('uses visual config instead of legacy dataPath and transformFn when enabled', () => {
        const onTransformError = vi.fn();
        const result = applyDataSourceTransform({
            dataPath: 'missing.path',
            transformFn: 'function transform() { throw new Error("legacy should not run"); }',
            visualTransformConfig: {
                enabled: true,
                arrayPath: 'rows',
                mappings: [{ target: 'name', source: 'title' }]
            }
        }, {
            rows: [{ title: 'Visual Source' }]
        }, {
            onTransformError
        });

        expect(result).toEqual([{ name: 'Visual Source' }]);
        expect(onTransformError).not.toHaveBeenCalled();
    });

    it('normalizes config and infers field options for future UI', () => {
        const config = normalizeVisualTransformConfig({
            enabled: true,
            sort: { field: 'value', direction: 'DESC' },
            limit: { enabled: true, count: '2' },
            mappings: [{ target: 'name', source: 'title', type: 'unknown' }]
        });
        const fields = inferFieldOptions([{ title: 'A', nested: { count: 1 } }]);

        expect(config.sort.direction).toBe('desc');
        expect(config.limit.count).toBe(2);
        expect(config.mappings[0].type).toBe('auto');
        expect(fields.map((item) => item.value)).toEqual(expect.arrayContaining(['title', 'nested', 'nested.count']));
    });

    it('coerces primitive values consistently', () => {
        expect(coerceValue('12', 'number')).toBe(12);
        expect(coerceValue('false', 'boolean')).toBe(false);
        expect(coerceValue('{"a":1}', 'json')).toEqual({ a: 1 });
        expect(coerceValue([1, '2', 3], 'vector3')).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('builds preview helpers from nested response data', () => {
        const rawData = {
            data: {
                rows: [
                    { name: 'A', value: '12', status: 'online' },
                    { name: 'B', value: '8', status: 'offline' }
                ]
            }
        };

        const pathOptions = buildDataPathOptions(rawData);
        const rowsInfo = getRowsInfo(rawData.data.rows);
        const fields = collectFieldOptions(rowsInfo.rows);
        const preview = createVisualTransformPreview(rawData, {
            enabled: true,
            inputPath: 'data.rows',
            filters: [{ field: 'status', operator: 'equals', value: 'online' }],
            mappings: [{ target: 'label', source: 'name', type: 'string' }]
        });

        expect(pathOptions.map((item) => item.value)).toEqual(expect.arrayContaining(['', 'data', 'data.rows']));
        expect(rowsInfo.rowCount).toBe(2);
        expect(fields.map((item) => item.value)).toEqual(expect.arrayContaining(['name', 'value', 'status']));
        expect(preview.transformedData).toEqual([{ label: 'A' }]);
        expect(preview.transformedRowsInfo.rowCount).toBe(1);
    });

    it('uses dataset dimensions when previewing source rows', () => {
        const result = applyVisualDataTransform({
            dimensions: ['name', 'value'],
            source: [
                ['A', 1],
                ['B', 2]
            ]
        }, {
            enabled: true,
            mappings: [
                { target: 'label', source: 'name' },
                { target: 'amount', source: 'value', type: 'number' }
            ]
        });

        expect(result).toEqual([
            { label: 'A', amount: 1 },
            { label: 'B', amount: 2 }
        ]);
    });
});
