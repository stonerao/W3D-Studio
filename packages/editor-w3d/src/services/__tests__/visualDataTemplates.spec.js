import { describe, expect, it } from 'vitest';
import {
    buildVisualTransformConfigFromTemplate,
    getVisualDataTemplate,
    getVisualDataTemplates,
    pickTemplateSourceField
} from '../visualDataTemplates';

describe('visualDataTemplates', () => {
    it('provides component templates for common 3D data components', () => {
        expect(getVisualDataTemplates('Heatmap')).toHaveLength(1);
        expect(getVisualDataTemplates('MigrationLine').length).toBeGreaterThanOrEqual(2);
        expect(getVisualDataTemplates('AreaBlock').length).toBeGreaterThanOrEqual(2);
        expect(getVisualDataTemplates('Label3D')).toHaveLength(1);
        expect(getVisualDataTemplates('PointTypeMarkerManager')).toHaveLength(1);
        expect(getVisualDataTemplates('TrafficRoadsideDeviceManager')).toHaveLength(1);
    });

    it('builds visual transform config from a component template and source fields', () => {
        const template = getVisualDataTemplate('TrafficRoadsideDeviceManager', 'traffic-device-positions');
        const config = buildVisualTransformConfigFromTemplate(template, {
            sourceFields: [
                { label: '设备编码', value: 'deviceId' },
                { label: '经度', value: 'longitude' },
                { label: '高度', value: 'altitude' },
                { label: '纬度', value: 'latitude' }
            ]
        });

        expect(config.enabled).toBe(true);
        expect(config.templateId).toBe('traffic-device-positions');
        expect(config.mappings).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: 'id', source: 'deviceId' }),
            expect.objectContaining({ target: 'x', source: 'longitude', type: 'number' }),
            expect.objectContaining({ target: 'y', source: 'altitude', type: 'number' }),
            expect.objectContaining({ target: 'z', source: 'latitude', type: 'number' })
        ]));
    });

    it('falls back to aliases when source fields are unknown', () => {
        const template = getVisualDataTemplate('Heatmap', 'heatmap-points');
        const valueMapping = template.mappings.find((item) => item.target === 'value');

        expect(pickTemplateSourceField(valueMapping, [])).toBe('value');
    });
});
