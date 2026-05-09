const VISUAL_TRANSFORM_VERSION = 1;

const VALUE_TYPES = new Set(['auto', 'string', 'number', 'boolean', 'json', 'vector3']);
const SORT_DIRECTIONS = new Set(['none', 'asc', 'desc']);
const ARRAY_CANDIDATE_KEYS = ['data', 'list', 'rows', 'items', 'records', 'result', 'source'];
const PATH_OPTION_CANDIDATE_KEYS = ['data', 'result', 'list', 'rows', 'items', 'records', 'source'];

const DEFAULT_VISUAL_TRANSFORM_CONFIG = Object.freeze({
    version: VISUAL_TRANSFORM_VERSION,
    enabled: false,
    templateId: '',
    templateName: '',
    componentType: '',
    inputPath: '',
    arrayPath: '',
    filters: [],
    sort: { field: '', direction: 'none' },
    limit: { enabled: false, count: 0 },
    mappings: []
});

const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isBlankValue = (value) => value === null || value === undefined || value === '';

const normalizePath = (path = '') => {
    return String(path || '').trim();
};

const parsePath = (path = '') => {
    const normalized = normalizePath(path)
        .replace(/\[(\d+)\]/g, '.$1')
        .replace(/\[['"]([^'"]+)['"]\]/g, '.$1');

    if (!normalized) return [];
    return normalized.split('.').map((part) => part.trim()).filter(Boolean);
};

export const getValueByPath = (value, path = '', fallbackValue = undefined) => {
    const parts = parsePath(path);
    if (parts.length === 0) return value;

    let current = value;
    for (const part of parts) {
        if (current === null || current === undefined) return fallbackValue;
        current = current[part];
    }

    return current === undefined ? fallbackValue : current;
};

const setValueByPath = (target, path = '', value) => {
    const parts = parsePath(path);
    if (!parts.length) return target;

    let current = target;
    parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        if (isLast) {
            current[part] = value;
            return;
        }

        if (!isPlainObject(current[part]) && !Array.isArray(current[part])) {
            current[part] = /^\d+$/.test(parts[index + 1] || '') ? [] : {};
        }
        current = current[part];
    });

    return target;
};

const normalizeDirection = (direction = 'none') => {
    const normalized = String(direction || 'none').toLowerCase();
    return SORT_DIRECTIONS.has(normalized) ? normalized : 'none';
};

const normalizeType = (type = 'auto') => {
    const normalized = String(type || 'auto').toLowerCase();
    return VALUE_TYPES.has(normalized) ? normalized : 'auto';
};

const normalizeOperator = (operator = 'equals') => {
    const normalized = String(operator || 'equals').trim();
    const aliases = {
        '=': 'equals',
        '==': 'equals',
        eq: 'equals',
        '!=': 'notEquals',
        '<>': 'notEquals',
        ne: 'notEquals',
        '>': 'greaterThan',
        gt: 'greaterThan',
        '>=': 'greaterOrEqual',
        gte: 'greaterOrEqual',
        '<': 'lessThan',
        lt: 'lessThan',
        '<=': 'lessOrEqual',
        lte: 'lessOrEqual',
        includes: 'contains',
        notIncludes: 'notContains',
        isEmpty: 'empty',
        isNotEmpty: 'notEmpty'
    };
    return aliases[normalized] || normalized;
};

const normalizeFilter = (filter = {}) => ({
    enabled: filter?.enabled !== false,
    field: normalizePath(filter?.field),
    operator: normalizeOperator(filter?.operator || filter?.op),
    value: filter?.value ?? ''
});

const normalizeMapping = (mapping = {}) => ({
    target: normalizePath(mapping?.target),
    source: normalizePath(mapping?.source),
    fallback: mapping?.fallback ?? '',
    type: normalizeType(mapping?.type)
});

export const normalizeVisualTransformConfig = (config = {}) => {
    const source = isPlainObject(config) ? config : {};
    const sort = isPlainObject(source.sort) ? source.sort : {};
    const limit = isPlainObject(source.limit) ? source.limit : {};

    return {
        version: VISUAL_TRANSFORM_VERSION,
        enabled: source.enabled === true,
        templateId: normalizePath(source.templateId),
        templateName: normalizePath(source.templateName),
        componentType: normalizePath(source.componentType),
        inputPath: normalizePath(source.inputPath),
        arrayPath: normalizePath(source.arrayPath),
        filters: Array.isArray(source.filters)
            ? source.filters.map((item) => normalizeFilter(item)).filter((item) => item.field)
            : [],
        sort: {
            field: normalizePath(sort.field),
            direction: normalizeDirection(sort.direction)
        },
        limit: {
            enabled: limit.enabled === true,
            count: Math.max(0, Number(limit.count || 0))
        },
        mappings: Array.isArray(source.mappings)
            ? source.mappings.map((item) => normalizeMapping(item)).filter((item) => item.target)
            : []
    };
};

export const isVisualTransformEnabled = (source = {}) => {
    return source?.visualTransformConfig?.enabled === true;
};

const parseMaybeJson = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (!['{', '['].includes(trimmed[0])) return value;

    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
};

const toNumber = (value, fallback = 0) => {
    if (isBlankValue(value)) return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off', 'disabled', ''].includes(normalized)) return false;
    }
    return Boolean(value);
};

const toVector3 = (value) => {
    if (Array.isArray(value)) {
        return {
            x: toNumber(value[0]),
            y: toNumber(value[1]),
            z: toNumber(value[2])
        };
    }

    if (isPlainObject(value)) {
        return {
            x: toNumber(value.x ?? value.lng ?? value.lon ?? value.longitude),
            y: toNumber(value.y ?? value.lat ?? value.latitude),
            z: toNumber(value.z ?? value.alt ?? value.height)
        };
    }

    if (typeof value === 'string') {
        const parts = value.split(',').map((item) => item.trim());
        if (parts.length >= 2) return toVector3(parts);
    }

    return { x: 0, y: 0, z: 0 };
};

export const coerceValue = (value, type = 'auto') => {
    const normalizedType = normalizeType(type);

    if (normalizedType === 'string') return isBlankValue(value) ? '' : String(value);
    if (normalizedType === 'number') return toNumber(value);
    if (normalizedType === 'boolean') return toBoolean(value);
    if (normalizedType === 'json') return parseMaybeJson(value);
    if (normalizedType === 'vector3') return toVector3(parseMaybeJson(value));
    return parseMaybeJson(value);
};

const findCandidateArray = (value) => {
    if (!isPlainObject(value)) return null;
    for (const key of ARRAY_CANDIDATE_KEYS) {
        if (Array.isArray(value[key])) {
            return value[key];
        }
    }
    return null;
};

const normalizeRowsWithDimensions = (rows, dimensions = []) => {
    if (!Array.isArray(rows)) return [];
    const dimensionList = Array.isArray(dimensions)
        ? dimensions.map((item) => String(item || '').trim()).filter(Boolean)
        : [];

    if (!dimensionList.length) return [...rows];

    return rows.map((row) => {
        if (!Array.isArray(row)) return row;
        return dimensionList.reduce((result, field, index) => {
            result[field] = row[index];
            return result;
        }, {});
    });
};

const prepareVisualInput = (rawData, config) => {
    let data = rawData;
    if (config.inputPath) {
        data = getValueByPath(data, config.inputPath);
    }

    if (config.arrayPath) {
        const arrayValue = getValueByPath(data, config.arrayPath);
        return {
            data: Array.isArray(arrayValue) ? normalizeRowsWithDimensions(arrayValue, data?.dimensions) : [],
            isArray: true
        };
    }

    if (Array.isArray(data)) {
        return {
            data: normalizeRowsWithDimensions(data),
            isArray: true
        };
    }

    const candidate = findCandidateArray(data);
    if (candidate) {
        return {
            data: normalizeRowsWithDimensions(candidate, data?.dimensions),
            isArray: true
        };
    }

    return {
        data,
        isArray: false
    };
};

const normalizeComparableValue = (value, reference) => {
    if (typeof reference === 'number') return toNumber(value, NaN);
    if (typeof reference === 'boolean') return toBoolean(value);
    return value;
};

const toComparableNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const compareScalar = (left, right) => {
    const leftNumber = toComparableNumber(left);
    const rightNumber = toComparableNumber(right);
    if (leftNumber !== null && rightNumber !== null) {
        return leftNumber - rightNumber;
    }
    return String(left ?? '').localeCompare(String(right ?? ''), 'zh-Hans-CN');
};

const matchFilter = (row, filter) => {
    const left = getValueByPath(row, filter.field);
    const right = normalizeComparableValue(filter.value, left);

    switch (filter.operator) {
        case 'notEquals':
            return left !== right;
        case 'contains':
            return String(left ?? '').includes(String(right ?? ''));
        case 'notContains':
            return !String(left ?? '').includes(String(right ?? ''));
        case 'greaterThan':
            return compareScalar(left, right) > 0;
        case 'greaterOrEqual':
            return compareScalar(left, right) >= 0;
        case 'lessThan':
            return compareScalar(left, right) < 0;
        case 'lessOrEqual':
            return compareScalar(left, right) <= 0;
        case 'empty':
            return isBlankValue(left);
        case 'notEmpty':
            return !isBlankValue(left);
        case 'in': {
            const values = Array.isArray(right)
                ? right
                : String(right ?? '').split(',').map((item) => item.trim());
            return values.includes(left) || values.includes(String(left ?? ''));
        }
        case 'notIn': {
            const values = Array.isArray(right)
                ? right
                : String(right ?? '').split(',').map((item) => item.trim());
            return !values.includes(left) && !values.includes(String(left ?? ''));
        }
        case 'equals':
        default:
            return left === right;
    }
};

const applyFilters = (rows, filters) => {
    const activeFilters = filters.filter((filter) => filter.enabled !== false && filter.field);
    if (!activeFilters.length) return rows;
    return rows.filter((row) => activeFilters.every((filter) => matchFilter(row, filter)));
};

const applySort = (rows, sort) => {
    if (!sort?.field || sort.direction === 'none') return rows;
    const directionFactor = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((left, right) => {
        return compareScalar(getValueByPath(left, sort.field), getValueByPath(right, sort.field)) * directionFactor;
    });
};

const applyLimit = (rows, limit) => {
    if (!limit?.enabled || !Number.isFinite(limit.count) || limit.count <= 0) return rows;
    return rows.slice(0, limit.count);
};

const resolveMappingValue = (row, mapping) => {
    const rawValue = mapping.source ? getValueByPath(row, mapping.source) : row;
    const value = isBlankValue(rawValue) && mapping.fallback !== ''
        ? mapping.fallback
        : rawValue;
    return coerceValue(value, mapping.type);
};

const applyMappingsToRecord = (row, mappings) => {
    return mappings.reduce((result, mapping) => {
        setValueByPath(result, mapping.target, resolveMappingValue(row, mapping));
        return result;
    }, {});
};

const applyMappings = (data, mappings) => {
    if (!mappings.length) return data;
    if (Array.isArray(data)) {
        return data.map((row) => applyMappingsToRecord(row, mappings));
    }
    return applyMappingsToRecord(data, mappings);
};

export const applyVisualDataTransform = (rawData, config = {}, context = {}) => {
    const normalized = normalizeVisualTransformConfig(config);
    const prepared = prepareVisualInput(rawData, normalized);

    if (!prepared.isArray) {
        return applyMappings(prepared.data, normalized.mappings);
    }

    let rows = prepared.data;
    rows = applyFilters(rows, normalized.filters);
    rows = applySort(rows, normalized.sort);
    rows = applyLimit(rows, normalized.limit);

    const result = applyMappings(rows, normalized.mappings);
    context?.onVisualTransform?.({ config: normalized, inputSize: prepared.data.length, outputSize: Array.isArray(result) ? result.length : 1 });
    return result;
};

export const applyLegacyDataTransform = (source = {}, rawData, context = {}) => {
    let data = rawData;
    if (source?.dataPath) {
        data = getValueByPath(data, source.dataPath);
    }

    if (!source?.transformFn) {
        return data;
    }

    try {
        // eslint-disable-next-line no-new-func
        const transformFn = new Function('data', `${source.transformFn}; return transform(data);`);
        return transformFn(data);
    } catch (error) {
        context?.onTransformError?.(error, { source, data });
        if (context?.returnErrorObject) {
            return {
                __transformError: error?.message || String(error),
                raw: data
            };
        }
        if (context?.throwOnTransformError) {
            throw error;
        }
        return data;
    }
};

export const applyDataSourceTransform = (source = {}, rawData, context = {}) => {
    const visualConfig = normalizeVisualTransformConfig(source?.visualTransformConfig);
    if (visualConfig.enabled) {
        return applyVisualDataTransform(rawData, visualConfig, { ...context, source });
    }
    return applyLegacyDataTransform(source, rawData, context);
};

const getValueType = (value) => {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
};

const collectSampleValues = (values = [], limit = 12) => {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
        if (isBlankValue(value)) return;
        const key = typeof value === 'object'
            ? (() => {
                try {
                    return JSON.stringify(value);
                } catch {
                    return String(value);
                }
            })()
            : String(value);
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
            label: key.length > 40 ? `${key.slice(0, 37)}...` : key,
            value
        });
    });
    return result.slice(0, limit);
};

export const inferFieldOptions = (value, options = {}) => {
    const maxDepth = Math.max(1, Number(options.maxDepth || 3));
    const root = Array.isArray(value) ? value[0] : value;
    const fields = [];
    const visited = new Set();

    const visit = (current, prefix = '', depth = 0) => {
        if (depth > maxDepth || current === null || current === undefined) return;
        if (!isPlainObject(current) && !Array.isArray(current)) return;

        const entries = Array.isArray(current)
            ? current.slice(0, 1).map((item, index) => [String(index), item])
            : Object.entries(current);

        entries.forEach(([key, item]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (!visited.has(path)) {
                visited.add(path);
                fields.push({
                    label: path,
                    value: path,
                    type: getValueType(item)
                });
            }

            if ((isPlainObject(item) || Array.isArray(item)) && depth < maxDepth) {
                visit(item, path, depth + 1);
            }
        });
    };

    visit(root, '', 0);
    return fields;
};

export const inferValueType = (value) => {
    const parsed = parseMaybeJson(value);
    if (isBlankValue(parsed)) return 'auto';
    if (typeof parsed === 'number') return 'number';
    if (typeof parsed === 'boolean') return 'boolean';
    if (Array.isArray(parsed) || isPlainObject(parsed)) {
        if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 3) return 'vector3';
        if (
            isPlainObject(parsed)
            && ['x', 'lng', 'lon', 'longitude'].some((key) => key in parsed)
            && ['y', 'lat', 'latitude'].some((key) => key in parsed)
        ) {
            return 'vector3';
        }
        return 'json';
    }
    if (typeof parsed === 'string' && parsed.trim() !== '' && Number.isFinite(Number(parsed))) return 'number';
    return 'string';
};

export const getRowsInfo = (value) => {
    const parsed = parseMaybeJson(value);
    if (Array.isArray(parsed)) {
        const rows = normalizeRowsWithDimensions(parsed);
        return {
            type: 'array',
            isArray: true,
            rows,
            rowCount: rows.length,
            selected: parsed
        };
    }

    if (isPlainObject(parsed)) {
        if (Array.isArray(parsed.source)) {
            const rows = normalizeRowsWithDimensions(parsed.source, parsed.dimensions);
            return {
                type: 'dataset',
                isArray: true,
                rows,
                rowCount: rows.length,
                dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions : [],
                selected: parsed.source
            };
        }

        const candidateKey = ARRAY_CANDIDATE_KEYS.find((key) => Array.isArray(parsed[key]));
        if (candidateKey) {
            const rows = normalizeRowsWithDimensions(parsed[candidateKey], parsed.dimensions);
            return {
                type: 'object-array',
                isArray: true,
                candidateKey,
                rows,
                rowCount: rows.length,
                selected: parsed[candidateKey]
            };
        }

        return {
            type: 'object',
            isArray: false,
            rows: [parsed],
            rowCount: 1,
            selected: parsed
        };
    }

    return {
        type: getValueType(parsed),
        isArray: false,
        rows: [],
        rowCount: 0,
        selected: parsed
    };
};

export const collectFieldOptions = (rows = [], options = {}) => {
    const maxRows = Math.max(1, Number(options.maxRows || 30));
    const maxDepth = Math.max(1, Number(options.maxDepth || 3));
    const fieldMap = new Map();
    const sourceRows = Array.isArray(rows) ? rows.slice(0, maxRows) : [];

    const addField = (path, value) => {
        if (!path) return;
        if (!fieldMap.has(path)) {
            fieldMap.set(path, {
                label: path,
                value: path,
                type: getValueType(value),
                valueType: inferValueType(value),
                samples: []
            });
        }
        const entry = fieldMap.get(path);
        if (entry.samples.length < 30) {
            entry.samples.push(value);
        }
    };

    const visit = (current, prefix = '', depth = 0) => {
        if (depth > maxDepth || current === null || current === undefined) return;
        if (Array.isArray(current)) {
            addField(prefix, current);
            const first = current[0];
            if ((isPlainObject(first) || Array.isArray(first)) && depth < maxDepth) {
                visit(first, prefix ? `${prefix}.0` : '0', depth + 1);
            }
            return;
        }
        if (!isPlainObject(current)) {
            addField(prefix, current);
            return;
        }

        Object.entries(current).forEach(([key, item]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            addField(path, item);
            if ((isPlainObject(item) || Array.isArray(item)) && depth < maxDepth) {
                visit(item, path, depth + 1);
            }
        });
    };

    sourceRows.forEach((row) => visit(row));
    return [...fieldMap.values()].map((field) => ({
        ...field,
        sampleValues: collectSampleValues(field.samples)
    }));
};

const formatPathOptionLabel = (path, value) => {
    const info = getRowsInfo(value);
    const name = path || '完整返回';
    if (info.rowCount > 0) return `${name}（${info.rowCount} 条）`;
    if (Array.isArray(value)) return `${name}（数组）`;
    if (isPlainObject(value)) return `${name}（对象）`;
    return `${name}（${getValueType(value)}）`;
};

export const buildDataPathOptions = (value, options = {}) => {
    const maxDepth = Math.max(1, Number(options.maxDepth || 4));
    const root = parseMaybeJson(value);
    const result = new Map();

    const addOption = (path, current) => {
        const normalizedPath = normalizePath(path);
        if (result.has(normalizedPath)) return;
        result.set(normalizedPath, {
            label: formatPathOptionLabel(normalizedPath, current),
            value: normalizedPath,
            type: getValueType(current),
            rowCount: getRowsInfo(current).rowCount
        });
    };

    addOption('', root);

    const visit = (current, prefix = '', depth = 0) => {
        if (depth >= maxDepth || !isPlainObject(current)) return;

        const entries = Object.entries(current).sort(([left], [right]) => {
            const leftIndex = PATH_OPTION_CANDIDATE_KEYS.indexOf(left);
            const rightIndex = PATH_OPTION_CANDIDATE_KEYS.indexOf(right);
            if (leftIndex !== -1 || rightIndex !== -1) {
                return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
            }
            return left.localeCompare(right);
        });

        entries.forEach(([key, item]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (Array.isArray(item) || isPlainObject(item)) {
                addOption(path, item);
            }
            if (isPlainObject(item)) {
                visit(item, path, depth + 1);
            }
        });
    };

    visit(root);
    return [...result.values()];
};

export const createVisualTransformPreview = (rawData, config = {}) => {
    const normalizedConfig = normalizeVisualTransformConfig(config);
    let selectedData = rawData;
    if (normalizedConfig.inputPath) {
        selectedData = getValueByPath(rawData, normalizedConfig.inputPath);
    }
    if (normalizedConfig.arrayPath) {
        selectedData = getValueByPath(selectedData, normalizedConfig.arrayPath);
    }

    const rowsInfo = getRowsInfo(selectedData);
    const fieldOptions = collectFieldOptions(rowsInfo.rows);
    let transformedData = null;
    let error = '';

    try {
        transformedData = applyVisualDataTransform(rawData, normalizedConfig);
    } catch (transformError) {
        error = transformError?.message || String(transformError);
        transformedData = null;
    }

    return {
        config: normalizedConfig,
        selectedData,
        rowsInfo,
        fieldOptions,
        transformedData,
        transformedRowsInfo: getRowsInfo(transformedData),
        dataPathOptions: buildDataPathOptions(rawData),
        error
    };
};

export { DEFAULT_VISUAL_TRANSFORM_CONFIG, VISUAL_TRANSFORM_VERSION };
