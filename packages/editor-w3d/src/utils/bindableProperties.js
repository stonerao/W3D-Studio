import { getComponent } from './componentRegistry';

const EXCLUDED_KEYS = new Set(['id', 'name']);
const DEFAULT_PROPERTIES = [
    {
        label: '位置',
        value: 'position',
        group: '变换',
        type: 'vector3',
        description: '控制组件的位置，支持 [x, y, z] 或 { x, y, z }',
        defaultValue: [0, 0, 0]
    },
    {
        label: '旋转',
        value: 'rotation',
        group: '变换',
        type: 'vector3',
        description: '控制组件的旋转，单位为弧度，支持 [x, y, z] 或 { x, y, z }',
        defaultValue: [0, 0, 0]
    },
    {
        label: '缩放',
        value: 'scale',
        group: '变换',
        type: 'json',
        description: '控制组件缩放，支持单个数值或 [x, y, z]',
        defaultValue: 1
    }
];
const ROOT_BINDABLE_PROPERTIES = Object.freeze([
    {
        label: '显示',
        value: 'visible',
        group: '状态',
        type: 'boolean',
        description: '控制组件在运行时是否显示',
        defaultValue: true
    },
    {
        label: '预览显示',
        value: 'previewVisible',
        group: '状态',
        type: 'boolean',
        description: '控制组件在预览模式中是否显示',
        defaultValue: true
    },
    {
        label: '编辑锁定',
        value: 'locked',
        group: '状态',
        type: 'boolean',
        description: '控制组件在编辑器中是否锁定，锁定后不可拖拽和编辑',
        defaultValue: false
    }
]);

const PRIORITY_ORDER = ['url', 'position', 'rotation', 'scale'];
const COLLECTION_KEYWORDS = ['list', 'lists', 'items', 'rows', 'areas', 'lines', 'labels', 'paths', 'views', 'points'];

function normalizeGroup(field = {}) {
    if (field.group) return String(field.group);
    if (field.category) return String(field.category);
    return '配置';
}

function normalizeSchemaItem(field = {}) {
    const key = typeof field.key === 'string' ? field.key.trim() : '';
    if (!key || EXCLUDED_KEYS.has(key)) return null;

    return {
        label: field.label || key,
        value: key,
        group: normalizeGroup(field),
        type: field.type || 'unknown',
        description: field.description || ''
    };
}

function flattenDefaultConfig(config = {}, parentPath = '', depth = 0) {
    if (!config || typeof config !== 'object' || Array.isArray(config) || depth > 3) {
        return [];
    }

    const paths = [];
    Object.entries(config).forEach(([key, value]) => {
        if (!key || EXCLUDED_KEYS.has(key)) return;
        const nextPath = parentPath ? `${parentPath}.${key}` : key;

        if (Array.isArray(value)) {
            paths.push(nextPath);
            return;
        }

        if (value && typeof value === 'object') {
            if (Object.keys(value).length === 0) {
                paths.push(nextPath);
                return;
            }
            paths.push(...flattenDefaultConfig(value, nextPath, depth + 1));
            return;
        }

        paths.push(nextPath);
    });

    return paths;
}

function sortOptions(options = []) {
    const orderMap = new Map(PRIORITY_ORDER.map((key, index) => [key, index]));

    return [...options].sort((a, b) => {
        const aIndex = orderMap.has(a.value) ? orderMap.get(a.value) : 999;
        const bIndex = orderMap.has(b.value) ? orderMap.get(b.value) : 999;
        if (aIndex !== bIndex) return aIndex - bIndex;
        if (a.group !== b.group) return String(a.group).localeCompare(String(b.group), 'zh-Hans-CN');
        return String(a.label).localeCompare(String(b.label), 'zh-Hans-CN');
    });
}

export function getBindablePropertyOptionsByType(componentType = '') {
    if (!componentType) {
        return sortOptions([
            ...DEFAULT_PROPERTIES,
            ...ROOT_BINDABLE_PROPERTIES.map((item) => ({
                label: item.label,
                value: item.value,
                group: item.group
            }))
        ]);
    }

    const component = getComponent(componentType);
    if (!component?.metadata) {
        return [...DEFAULT_PROPERTIES];
    }

    const schemaOptions = (component.metadata.configSchema || [])
        .map((field) => normalizeSchemaItem(field))
        .filter(Boolean);

    const optionMap = new Map();
    schemaOptions.forEach((item) => {
        optionMap.set(item.value, item);
    });

    const flattenedDefaults = flattenDefaultConfig(component.metadata.defaultConfig || {});
    flattenedDefaults.forEach((key) => {
        if (!optionMap.has(key)) {
            optionMap.set(key, {
                label: key,
                value: key,
                group: '配置',
                type: 'unknown',
                description: ''
            });
        }
    });

    DEFAULT_PROPERTIES.forEach((item) => {
        if (!optionMap.has(item.value)) {
            optionMap.set(item.value, { ...item, type: 'vector3', description: '' });
        }
    });

    ROOT_BINDABLE_PROPERTIES.forEach((item) => {
        if (!optionMap.has(item.value)) {
            optionMap.set(item.value, { ...item });
        }
    });

    const options = Array.from(optionMap.values()).map((item) => ({
        label: item.label,
        value: item.value,
        group: item.group
    }));

    return sortOptions(options);
}

function getDescriptionByType(type = 'unknown') {
    switch (type) {
        case 'boolean':
            return '布尔值（true/false）';
        case 'number':
            return '数值类型';
        case 'color':
            return '颜色值（如 #RRGGBB）';
        case 'vector3':
            return '三维向量，格式: [x, y, z]';
        case 'json':
            return 'JSON 对象或数组';
        case 'asset':
            return '资源 URL 或资源路径';
        case 'select':
            return '枚举选项值';
        case 'text':
            return '文本字符串';
        default:
            return '该属性将接收数据源返回的值';
    }
}

function getNestedDefaultValue(config = {}, path = '') {
    if (!path) return undefined;
    const keys = String(path).split('.');
    let current = config;
    for (const key of keys) {
        if (current === null || current === undefined) return undefined;
        current = current[key];
    }
    return current;
}

export function isCollectionBindableProperty(componentType = '', propertyKey = '') {
    if (!componentType || !propertyKey) return false;

    const component = getComponent(componentType);
    const schema = component?.metadata?.configSchema || [];
    const matched = schema.find((field) => field?.key === propertyKey);

    if (matched?.type === 'json') {
        const defaultValueFromSchema = matched.default;
        if (Array.isArray(defaultValueFromSchema)) return true;
    }

    const defaultValue = getNestedDefaultValue(component?.metadata?.defaultConfig || {}, propertyKey);
    if (Array.isArray(defaultValue)) return true;

    const lowered = String(propertyKey).toLowerCase();
    return COLLECTION_KEYWORDS.some((word) => lowered.includes(word));
}

export function getPropertyBindingInfo(propertyKey = '', componentType = '') {
    if (!propertyKey) return '';

    const rootProperty = ROOT_BINDABLE_PROPERTIES.find((item) => item.value === propertyKey);
    if (rootProperty) {
        return rootProperty.description || getDescriptionByType(rootProperty.type);
    }

    const defaultProperty = DEFAULT_PROPERTIES.find((item) => item.value === propertyKey);
    if (defaultProperty) {
        return defaultProperty.description || getDescriptionByType(defaultProperty.type);
    }

    if (isCollectionBindableProperty(componentType, propertyKey)) {
        return '数组/列表属性：将数据源结果作为一个整体数据赋值（整体替换，不拆分子项）';
    }

    const component = getComponent(componentType);
    const schema = component?.metadata?.configSchema || [];
    const matched = schema.find((field) => field?.key === propertyKey);
    if (matched) {
        if (matched.description) return matched.description;
        return getDescriptionByType(matched.type);
    }

    return '该属性将接收数据源返回的值';
}

function formatDefaultValue(value) {
    if (value === undefined) return '无默认值';
    if (typeof value === 'string') return value || '""';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function getFormatHintByType(type = 'unknown', isCollection = false) {
    if (isCollection) {
        return '[]';
    }

    switch (type) {
        case 'boolean':
            return 'true / false';
        case 'number':
            return '0';
        case 'color':
            return '"#3B82F6"';
        case 'vector3':
            return '{ x: 0, y: 0, z: 0 } 或 [0, 0, 0]';
        case 'json':
            return '{} 或 []';
        case 'asset':
            return '"/assets/model.glb"';
        case 'select':
            return '枚举值（如 "on" / 1 / true）';
        case 'text':
            return '"text"';
        default:
            return '与属性类型一致的 JSON 值';
    }
}

function getAccessHint(type = 'unknown', isCollection = false) {
    if (isCollection) {
        return '示例：从返回结果中提取数组并整体赋值';
    }

    if (type === 'vector3') {
        return '示例：提取坐标对象或数组';
    }

    if (type === 'color') {
        return '示例：提取颜色字段，缺省给默认色';
    }

    if (type === 'number') {
        return '示例：提取数值并做 Number 转换';
    }

    if (type === 'boolean') {
        return '示例：提取布尔开关字段';
    }

    return '示例：优先取 result 字段，否则使用原始返回';
}

function getTransformExpression(type = 'unknown', isCollection = false) {
    if (isCollection) {
        return 'Array.isArray(data?.list) ? data.list : []';
    }

    if (type === 'vector3') {
        return 'data?.position || { x: 0, y: 0, z: 0 }';
    }

    if (type === 'color') {
        return 'data?.color || "#3B82F6"';
    }

    if (type === 'number') {
        return 'Number(data?.value ?? 0)';
    }

    if (type === 'boolean') {
        return 'Boolean(data?.enabled)';
    }

    return 'data?.result ?? data';
}

export function getPropertyBindingReference(componentType = '', propertyKey = '') {
    if (!componentType || !propertyKey) return null;

    const rootProperty = ROOT_BINDABLE_PROPERTIES.find((item) => item.value === propertyKey);
    if (rootProperty) {
        return {
            key: propertyKey,
            label: rootProperty.label,
            type: rootProperty.type,
            isCollection: false,
            formatHint: getFormatHintByType(rootProperty.type, false),
            defaultValue: rootProperty.defaultValue,
            defaultValueText: formatDefaultValue(rootProperty.defaultValue),
            description: rootProperty.description || getDescriptionByType(rootProperty.type),
            accessHint: getAccessHint(rootProperty.type, false),
            transformExpression: getTransformExpression(rootProperty.type, false)
        };
    }

    const defaultProperty = DEFAULT_PROPERTIES.find((item) => item.value === propertyKey);
    if (defaultProperty) {
        return {
            key: propertyKey,
            label: defaultProperty.label,
            type: defaultProperty.type,
            isCollection: false,
            formatHint: getFormatHintByType(defaultProperty.type, false),
            defaultValue: defaultProperty.defaultValue,
            defaultValueText: formatDefaultValue(defaultProperty.defaultValue),
            description: defaultProperty.description || getDescriptionByType(defaultProperty.type),
            accessHint: getAccessHint(defaultProperty.type, false),
            transformExpression: getTransformExpression(defaultProperty.type, false)
        };
    }

    const component = getComponent(componentType);
    const schema = component?.metadata?.configSchema || [];
    const matched = schema.find((field) => field?.key === propertyKey);
    const isCollection = isCollectionBindableProperty(componentType, propertyKey);

    const defaultValue = matched?.default !== undefined
        ? matched.default
        : getNestedDefaultValue(component?.metadata?.defaultConfig || {}, propertyKey);

    const type = matched?.type || (isCollection ? 'json' : 'unknown');

    return {
        key: propertyKey,
        label: matched?.label || propertyKey,
        type,
        isCollection,
        formatHint: getFormatHintByType(type, isCollection),
        defaultValue,
        defaultValueText: formatDefaultValue(defaultValue),
        description: getPropertyBindingInfo(propertyKey, componentType),
        accessHint: getAccessHint(type, isCollection),
        transformExpression: getTransformExpression(type, isCollection)
    };
}
