import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export const VARIABLE_TYPES = {
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    STRING: 'string',
    ARRAY: 'array',
    OBJECT: 'object',
    VECTOR2: 'vector2',
    VECTOR3: 'vector3'
};

const DEFAULT_GROUP = '默认';
const DEFAULT_SCOPE = 'project';
const VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const VARIABLE_TYPE_DEFAULTS = {
    [VARIABLE_TYPES.NUMBER]: 0,
    [VARIABLE_TYPES.BOOLEAN]: false,
    [VARIABLE_TYPES.STRING]: '',
    [VARIABLE_TYPES.ARRAY]: [],
    [VARIABLE_TYPES.OBJECT]: {},
    [VARIABLE_TYPES.VECTOR2]: [0, 0],
    [VARIABLE_TYPES.VECTOR3]: [0, 0, 0]
};

export const VARIABLE_TYPE_CONFIG = {
    [VARIABLE_TYPES.NUMBER]: {
        label: '数值',
        icon: 'N',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.NUMBER],
        description: '整数或浮点数'
    },
    [VARIABLE_TYPES.BOOLEAN]: {
        label: '布尔',
        icon: 'B',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.BOOLEAN],
        description: 'true 或 false'
    },
    [VARIABLE_TYPES.STRING]: {
        label: '文本',
        icon: 'T',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.STRING],
        description: '文本内容'
    },
    [VARIABLE_TYPES.ARRAY]: {
        label: '数组',
        icon: '[]',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.ARRAY],
        description: '元素列表，如 [1, 2, 3]'
    },
    [VARIABLE_TYPES.OBJECT]: {
        label: '对象',
        icon: '{}',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.OBJECT],
        description: 'JSON 键值对'
    },
    [VARIABLE_TYPES.VECTOR2]: {
        label: '二维向量',
        icon: 'V2',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.VECTOR2],
        description: '[x, y] 格式'
    },
    [VARIABLE_TYPES.VECTOR3]: {
        label: '三维向量',
        icon: 'V3',
        defaultValue: VARIABLE_TYPE_DEFAULTS[VARIABLE_TYPES.VECTOR3],
        description: '[x, y, z] 格式'
    }
};

function cloneJson(value) {
    if (value === undefined || value === null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function generateVariableId() {
    return `var_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isValidType(type) {
    return Object.prototype.hasOwnProperty.call(VARIABLE_TYPE_DEFAULTS, type);
}

function getDefaultValueByType(type) {
    return cloneJson(VARIABLE_TYPE_DEFAULTS[isValidType(type) ? type : VARIABLE_TYPES.STRING]);
}

function validateVariableName(name) {
    const normalized = String(name || '').trim();
    if (!normalized) {
        return { valid: false, message: '变量名不能为空' };
    }
    if (!VARIABLE_NAME_PATTERN.test(normalized)) {
        return { valid: false, message: '变量名只能包含字母、数字和下划线，且不能以数字开头' };
    }
    if (normalized.length > 50) {
        return { valid: false, message: '变量名长度不能超过 50 个字符' };
    }
    return { valid: true, message: '' };
}

function normalizeVariable(input = {}, fallback = {}) {
    const ref = input.ref || {};
    const name = String(ref.name || input.name || '').trim();
    const validation = validateVariableName(name);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    const type = isValidType(input.type) ? input.type : VARIABLE_TYPES.STRING;
    const defaultValue = input.defaultValue !== undefined
        ? cloneJson(input.defaultValue)
        : getDefaultValueByType(type);
    const now = Date.now();

    return {
        id: input.id || generateVariableId(),
        name,
        type,
        value: input.value !== undefined ? cloneJson(input.value) : cloneJson(defaultValue),
        defaultValue,
        description: input.description || '',
        group: input.group || DEFAULT_GROUP,
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || now,
        scope: ref.scope || input.scope || fallback.scope || DEFAULT_SCOPE,
        ownerId: ref.ownerId || input.ownerId || fallback.ownerId
    };
}

export const useVariableStore = defineStore('variable', () => {
    const variables = ref([]);
    const version = ref(0);

    const touch = () => {
        version.value += 1;
    };

    const variablesByGroup = computed(() => {
        const groups = {};
        for (const variable of variables.value) {
            const groupName = variable.group || DEFAULT_GROUP;
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(variable);
        }
        return groups;
    });

    const groupNames = computed(() => {
        const names = new Set();
        for (const variable of variables.value) {
            names.add(variable.group || DEFAULT_GROUP);
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    });

    const variableMap = computed(() => {
        const map = {};
        for (const variable of variables.value) {
            map[variable.name] = variable;
        }
        return map;
    });

    const isNameExists = (name, excludeId = null) => {
        const normalized = String(name || '').trim();
        return variables.value.some((variable) => variable.name === normalized && variable.id !== excludeId);
    };

    const validateName = (name) => validateVariableName(name);

    const getDefaultValue = (type) => getDefaultValueByType(type);

    const getVariableByName = (name) => {
        const normalized = String(name || '').trim();
        return variables.value.find((variable) => variable.name === normalized) || null;
    };

    const getVariableById = (id) => {
        return variables.value.find((variable) => variable.id === id) || null;
    };

    const addVariable = (variableData) => {
        const variable = normalizeVariable(variableData);

        if (isNameExists(variable.name)) {
            throw new Error(`变量名 "${variable.name}" 已存在`);
        }

        variables.value.push(variable);
        touch();
        return cloneJson(variable);
    };

    const updateVariable = (id, updates = {}) => {
        const index = variables.value.findIndex((variable) => variable.id === id);
        if (index === -1) {
            throw new Error(`变量不存在: ${id}`);
        }

        const current = variables.value[index];
        const nextType = updates.type !== undefined ? updates.type : current.type;
        if (!isValidType(nextType)) {
            throw new Error(`无效的变量类型: ${nextType}`);
        }

        const nextName = updates.name !== undefined ? String(updates.name || '').trim() : current.name;
        const nameValidation = validateName(nextName);
        if (!nameValidation.valid) {
            throw new Error(nameValidation.message);
        }
        if (nextName !== current.name && isNameExists(nextName, id)) {
            throw new Error(`变量名 "${nextName}" 已存在`);
        }

        const typeChanged = nextType !== current.type;
        const typeDefaultValue = getDefaultValue(nextType);
        const next = normalizeVariable({
            ...current,
            ...updates,
            name: nextName,
            type: nextType,
            value: updates.value !== undefined
                ? updates.value
                : (typeChanged ? typeDefaultValue : current.value),
            defaultValue: updates.defaultValue !== undefined
                ? updates.defaultValue
                : (typeChanged ? typeDefaultValue : current.defaultValue),
            updatedAt: Date.now()
        });

        variables.value.splice(index, 1, next);
        touch();
        return cloneJson(next);
    };

    const setVariableValue = (id, value) => {
        const variable = getVariableById(id);
        if (!variable) {
            throw new Error(`变量不存在: ${id}`);
        }

        variable.value = cloneJson(value);
        variable.updatedAt = Date.now();
        touch();
        return cloneJson(variable);
    };

    const setVariableValueByName = (name, value) => {
        const variable = getVariableByName(name);
        if (!variable) {
            throw new Error(`变量不存在: ${name}`);
        }
        return setVariableValue(variable.id, value);
    };

    const removeVariable = (id) => {
        const index = variables.value.findIndex((variable) => variable.id === id);
        if (index === -1) {
            return null;
        }

        const [removed] = variables.value.splice(index, 1);
        touch();
        return cloneJson(removed);
    };

    const getValue = (name) => {
        return cloneJson(getVariableByName(name)?.value);
    };

    const resetToDefault = (id) => {
        const variable = getVariableById(id);
        if (!variable) {
            throw new Error(`变量不存在: ${id}`);
        }
        return setVariableValue(id, cloneJson(variable.defaultValue));
    };

    const resetAllToDefault = () => {
        for (const variable of variables.value) {
            variable.value = cloneJson(variable.defaultValue);
            variable.updatedAt = Date.now();
        }
        touch();
    };

    const clearVariables = () => {
        variables.value = [];
        touch();
    };

    const serialize = () => {
        return variables.value.map((variable) => cloneJson(variable));
    };

    const deserialize = (data) => {
        const source = Array.isArray(data)
            ? data
            : (Array.isArray(data?.variables) ? data.variables : []);
        const nextVariables = [];
        const seenNames = new Set();

        for (const item of source) {
            try {
                const normalized = normalizeVariable(item);
                if (seenNames.has(normalized.name)) {
                    const index = nextVariables.findIndex((variable) => variable.name === normalized.name);
                    nextVariables.splice(index, 1, normalized);
                } else {
                    seenNames.add(normalized.name);
                    nextVariables.push(normalized);
                }
            } catch (error) {
                console.warn('[VariableStore] 跳过无效变量:', error);
            }
        }

        variables.value = nextVariables;
        touch();
    };

    const exportToJson = () => {
        return JSON.stringify(serialize(), null, 2);
    };

    const importFromJson = (jsonString, merge = false) => {
        try {
            const parsed = JSON.parse(jsonString);
            const data = Array.isArray(parsed)
                ? parsed
                : (Array.isArray(parsed?.variables) ? parsed.variables : null);

            if (!Array.isArray(data)) {
                throw new Error('无效的变量数据格式');
            }

            if (merge) {
                let count = 0;
                for (const item of data) {
                    const normalized = normalizeVariable(item);
                    if (!isNameExists(normalized.name)) {
                        variables.value.push(normalized);
                        count += 1;
                    }
                }
                if (count > 0) touch();
                return { success: true, count };
            }

            deserialize(data);
            return { success: true, count: variables.value.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const replaceVariableTokens = (expression, replacer) => {
        return String(expression)
            .replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, replacer)
            .replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, replacer);
    };

    const parseExpression = (expression) => {
        if (typeof expression !== 'string') return expression;
        return replaceVariableTokens(expression, (match, varName) => {
            const value = getValue(varName);
            if (value === undefined) {
                console.warn(`变量 "${varName}" 未定义`);
                return match;
            }
            return typeof value === 'string' ? value : String(value);
        });
    };

    const evaluateExpression = (expression) => {
        if (typeof expression !== 'string') return expression;
        const parsed = parseExpression(expression);
        if (!parsed.includes('${') && !parsed.includes('{{')) {
            try {
                // English comment.
                // eslint-disable-next-line no-new-func
                return new Function(`return (${parsed})`)();
            } catch {
                return parsed;
            }
        }
        return parsed;
    };

    const runtime = {
        list(scope = DEFAULT_SCOPE) {
            return serialize().filter((variable) => !scope || variable.scope === scope);
        },
        get(ref = {}) {
            return cloneJson(getVariableByName(ref.name));
        },
        getValue(ref = {}) {
            return getValue(ref.name);
        },
        snapshot() {
            return {
                schemaVersion: 1,
                version: version.value,
                variables: serialize()
            };
        },
        restore(snapshot) {
            deserialize(snapshot);
        },
        subscribe() {
            return () => {};
        }
    };

    return {
        variables,
        variablesByGroup,
        groupNames,
        variableMap,
        runtime,
        addVariable,
        updateVariable,
        setVariableValue,
        setVariableValueByName,
        removeVariable,
        getVariableByName,
        getVariableById,
        getValue,
        resetToDefault,
        resetAllToDefault,
        clearVariables,
        isNameExists,
        validateName,
        getDefaultValue,
        serialize,
        deserialize,
        exportToJson,
        importFromJson,
        parseExpression,
        evaluateExpression
    };
});
