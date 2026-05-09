const toTemplate = (componentType, template) => Object.freeze({
    componentType,
    ...template,
    mappings: Object.freeze((template.mappings || []).map((item) => Object.freeze({
        fallback: '',
        type: 'auto',
        ...item,
        sourceAliases: Object.freeze(item.sourceAliases || [item.target])
    }))),
    sample: Object.freeze(template.sample || [])
});

export const COMPONENT_VISUAL_DATA_TEMPLATES = Object.freeze({
    Heatmap: Object.freeze([
        toTemplate('Heatmap', {
            id: 'heatmap-points',
            label: '热力点位',
            description: '把接口行数据整理成热力图点位数组，至少需要 x/z/value。',
            binding: { type: 'property', value: 'data' },
            outputHint: '[{ x, y, z, value, size }]',
            arrayPath: '',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'pointId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'title', 'label', 'pointName'] },
                { target: 'x', sourceAliases: ['x', 'lng', 'lon', 'longitude'], type: 'number' },
                { target: 'y', sourceAliases: ['y', 'height', 'alt', 'altitude'], type: 'number', fallback: 0 },
                { target: 'z', sourceAliases: ['z', 'lat', 'latitude'], type: 'number' },
                { target: 'value', sourceAliases: ['value', 'heat', 'count', 'score', 'num'], type: 'number' },
                { target: 'size', sourceAliases: ['size', 'radius', 'weight'], type: 'number' }
            ],
            sample: [
                { id: 'heat_001', name: 'A区', x: 12, y: 0, z: 5, value: 80, size: 3 }
            ]
        })
    ]),
    Label3D: Object.freeze([
        toTemplate('Label3D', {
            id: 'label3d-labels',
            label: '三维标签',
            description: '把接口行数据整理成标签列表，至少需要 id/label/position。',
            binding: { type: 'property', value: 'labels' },
            outputHint: '[{ id, label, position:{ x,y,z }, config }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'labelId', 'code'] },
                { target: 'label', sourceAliases: ['label', 'text', 'name', 'title'] },
                { target: 'type', sourceAliases: ['type', 'category', 'kind'] },
                { target: 'position.x', sourceAliases: ['x', 'lng', 'lon', 'longitude'], type: 'number' },
                { target: 'position.y', sourceAliases: ['y', 'height', 'alt', 'altitude'], type: 'number' },
                { target: 'position.z', sourceAliases: ['z', 'lat', 'latitude'], type: 'number' },
                { target: 'config.textColor', sourceAliases: ['color', 'textColor', 'fontColor'] },
                { target: 'config.size', sourceAliases: ['size', 'scale'], type: 'number' }
            ],
            sample: [
                { id: 'label_001', label: '监测点', position: { x: 8, y: 3, z: -2 }, config: { textColor: '#22d3ee', size: 1 } }
            ]
        })
    ]),
    PointTypeMarkerManager: Object.freeze([
        toTemplate('PointTypeMarkerManager', {
            id: 'point-type-markers',
            label: '多类型点位',
            description: '把接口行数据整理成点位列表，用 typeId 区分图标/模型类型。',
            binding: { type: 'property', value: 'points' },
            outputHint: '[{ id, name, typeId, position:{ x,y,z }, data }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'pointId', 'deviceId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'pointName', 'deviceName', 'title'] },
                { target: 'typeId', sourceAliases: ['typeId', 'type_id', 'type', 'category'], fallback: 'default' },
                { target: 'position.x', sourceAliases: ['x', 'lng', 'lon', 'longitude'], type: 'number' },
                { target: 'position.y', sourceAliases: ['y', 'height', 'alt', 'altitude'], type: 'number' },
                { target: 'position.z', sourceAliases: ['z', 'lat', 'latitude'], type: 'number' },
                { target: 'scale', sourceAliases: ['scale', 'size'], type: 'number' },
                { target: 'visible', sourceAliases: ['visible', 'enabled', 'show'], type: 'boolean', fallback: true },
                { target: 'data.status', sourceAliases: ['status', 'state'] },
                { target: 'data.level', sourceAliases: ['level', 'alarmLevel', 'grade'] }
            ],
            sample: [
                { id: 'point_001', name: '摄像头A', typeId: 'camera', position: { x: 6, y: 0, z: -3 }, visible: true, data: { status: 'online' } }
            ]
        })
    ]),
    TrafficRoadsideDeviceManager: Object.freeze([
        toTemplate('TrafficRoadsideDeviceManager', {
            id: 'traffic-device-positions',
            label: '设备位置更新',
            description: '按设备 id 或 name 匹配现有路侧设备，只更新 x/y/z 坐标。',
            binding: { type: 'method', value: 'updateData' },
            outputHint: '[{ id/name, x, y, z }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'deviceId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'deviceName', 'title'] },
                { target: 'x', sourceAliases: ['x', 'lng', 'lon', 'longitude'], type: 'number' },
                { target: 'y', sourceAliases: ['y', 'height', 'alt', 'altitude'], type: 'number' },
                { target: 'z', sourceAliases: ['z', 'lat', 'latitude'], type: 'number' }
            ],
            sample: [
                { id: 'device_001', name: '信号灯A', x: -12, y: 0, z: 4 }
            ]
        })
    ]),
    MigrationLine: Object.freeze([
        toTemplate('MigrationLine', {
            id: 'migration-line-start-end',
            label: '起点终点迁移线',
            description: '接口每行包含起点/终点坐标时使用，生成 points[0] 和 points[1]。',
            binding: { type: 'property', value: 'lines' },
            outputHint: '[{ id, name, points:[start,end], color, speed }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'lineId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'lineName', 'title'] },
                { target: 'points.0.x', sourceAliases: ['startX', 'fromX', 'sourceX', 'x1', 'startLng'], type: 'number' },
                { target: 'points.0.y', sourceAliases: ['startY', 'fromY', 'sourceY', 'y1', 'startHeight'], type: 'number', fallback: 0 },
                { target: 'points.0.z', sourceAliases: ['startZ', 'fromZ', 'sourceZ', 'z1', 'startLat'], type: 'number' },
                { target: 'points.1.x', sourceAliases: ['endX', 'toX', 'targetX', 'x2', 'endLng'], type: 'number' },
                { target: 'points.1.y', sourceAliases: ['endY', 'toY', 'targetY', 'y2', 'endHeight'], type: 'number', fallback: 0 },
                { target: 'points.1.z', sourceAliases: ['endZ', 'toZ', 'targetZ', 'z2', 'endLat'], type: 'number' },
                { target: 'color', sourceAliases: ['color', 'lineColor'] },
                { target: 'speed', sourceAliases: ['speed', 'velocity'], type: 'number' }
            ],
            sample: [
                { id: 'line_001', name: 'A到B', points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 8 }], color: '#22c55e' }
            ]
        }),
        toTemplate('MigrationLine', {
            id: 'migration-line-points-array',
            label: '已有 points 数组',
            description: '接口已经返回 points/path/coords 数组时使用。',
            binding: { type: 'property', value: 'lines' },
            outputHint: '[{ id, name, points:[{x,y,z}], color }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'lineId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'lineName', 'title'] },
                { target: 'points', sourceAliases: ['points', 'path', 'coords', 'coordinates'], type: 'json' },
                { target: 'color', sourceAliases: ['color', 'lineColor'] },
                { target: 'speed', sourceAliases: ['speed', 'velocity'], type: 'number' }
            ],
            sample: [
                { id: 'line_001', name: '路径A', points: [{ x: 0, y: 0, z: 0 }, { x: 6, y: 4, z: 8 }], color: '#3b82f6' }
            ]
        })
    ]),
    AreaBlock: Object.freeze([
        toTemplate('AreaBlock', {
            id: 'area-block-points-array',
            label: '区域 points 数组',
            description: '接口每行已经包含 points/vertices 多边形点数组时使用。',
            binding: { type: 'property', value: 'areas' },
            outputHint: '[{ id, name, points:[{x,y,z}], userData }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'areaId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'areaName', 'title'] },
                { target: 'points', sourceAliases: ['points', 'vertices', 'polygon', 'path', 'coords'], type: 'json' },
                { target: 'userData.category', sourceAliases: ['category', 'type'] },
                { target: 'userData.color', sourceAliases: ['color', 'fillColor'] },
                { target: 'wallHeight', sourceAliases: ['height', 'wallHeight'], type: 'number' }
            ],
            sample: [
                { id: 'area_001', name: '园区A', points: [{ x: -5, y: 0, z: -5 }, { x: 5, y: 0, z: -5 }, { x: 5, y: 0, z: 5 }] }
            ]
        }),
        toTemplate('AreaBlock', {
            id: 'area-block-three-points',
            label: '三点区域字段',
            description: '接口每行包含 p1/p2/p3 三组坐标时使用。',
            binding: { type: 'property', value: 'areas' },
            outputHint: '[{ id, name, points:[p1,p2,p3] }]',
            mappings: [
                { target: 'id', sourceAliases: ['id', 'areaId', 'code'] },
                { target: 'name', sourceAliases: ['name', 'areaName', 'title'] },
                { target: 'points.0.x', sourceAliases: ['p1x', 'x1', 'point1X'], type: 'number' },
                { target: 'points.0.y', sourceAliases: ['p1y', 'y1', 'point1Y'], type: 'number', fallback: 0 },
                { target: 'points.0.z', sourceAliases: ['p1z', 'z1', 'point1Z'], type: 'number' },
                { target: 'points.1.x', sourceAliases: ['p2x', 'x2', 'point2X'], type: 'number' },
                { target: 'points.1.y', sourceAliases: ['p2y', 'y2', 'point2Y'], type: 'number', fallback: 0 },
                { target: 'points.1.z', sourceAliases: ['p2z', 'z2', 'point2Z'], type: 'number' },
                { target: 'points.2.x', sourceAliases: ['p3x', 'x3', 'point3X'], type: 'number' },
                { target: 'points.2.y', sourceAliases: ['p3y', 'y3', 'point3Y'], type: 'number', fallback: 0 },
                { target: 'points.2.z', sourceAliases: ['p3z', 'z3', 'point3Z'], type: 'number' }
            ],
            sample: [
                { id: 'area_001', name: '三角区', points: [{ x: -5, y: 0, z: -5 }, { x: 5, y: 0, z: -5 }, { x: 0, y: 0, z: 5 }] }
            ]
        })
    ])
});

const normalizeKey = (value = '') => String(value || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');

export const getVisualDataTemplates = (componentType = '') => {
    return COMPONENT_VISUAL_DATA_TEMPLATES[componentType] || [];
};

export const getVisualDataTemplate = (componentType = '', templateId = '') => {
    return getVisualDataTemplates(componentType).find((item) => item.id === templateId) || null;
};

export const getVisualDataTemplateMapping = (template, target = '') => {
    return (template?.mappings || []).find((item) => item.target === target) || null;
};

export const getVisualDataTemplateTargetOptions = (template) => {
    return (template?.mappings || []).map((item) => ({
        label: item.target,
        value: item.target
    }));
};

const toSourceOptions = (sourceFields = []) => {
    return sourceFields
        .map((item) => ({
            label: String(item?.label || item?.value || item || ''),
            value: String(item?.value || item?.label || item || '')
        }))
        .filter((item) => item.value);
};

export const pickTemplateSourceField = (mapping = {}, sourceFields = []) => {
    const aliases = mapping.sourceAliases || [mapping.target];
    const sourceOptions = toSourceOptions(sourceFields);
    const normalizedAliases = aliases.map((item) => normalizeKey(item));
    const exact = sourceOptions.find((item) => normalizedAliases.includes(normalizeKey(item.value)));
    if (exact) return exact.value;
    const fuzzy = sourceOptions.find((item) => {
        const fieldKey = normalizeKey(item.value);
        return normalizedAliases.some((alias) => fieldKey.includes(alias) || alias.includes(fieldKey));
    });
    if (fuzzy) return fuzzy.value;
    return aliases[0] || mapping.target || '';
};

export const buildVisualTransformConfigFromTemplate = (template, options = {}) => {
    const currentConfig = options.currentConfig || {};
    return {
        version: 1,
        enabled: true,
        templateId: template?.id || '',
        templateName: template?.label || '',
        componentType: template?.componentType || '',
        inputPath: String(currentConfig.inputPath || template?.inputPath || ''),
        arrayPath: String(currentConfig.arrayPath || template?.arrayPath || ''),
        filters: Array.isArray(currentConfig.filters) ? currentConfig.filters.map((item) => ({ ...item })) : [],
        sort: {
            field: String(currentConfig.sort?.field || ''),
            direction: currentConfig.sort?.direction || 'none'
        },
        limit: {
            enabled: currentConfig.limit?.enabled === true,
            count: Number(currentConfig.limit?.count || 0)
        },
        mappings: (template?.mappings || []).map((mapping) => ({
            target: mapping.target,
            source: pickTemplateSourceField(mapping, options.sourceFields || []),
            fallback: mapping.fallback ?? '',
            type: mapping.type || 'auto'
        }))
    };
};
