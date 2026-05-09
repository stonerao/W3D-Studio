const DEFAULT_COMPONENT_METHOD_DEFINITIONS = Object.freeze([
    Object.freeze({
        name: 'show',
        title: '显示',
        description: '显示组件',
        params: Object.freeze([])
    }),
    Object.freeze({
        name: 'hide',
        title: '隐藏',
        description: '隐藏组件',
        params: Object.freeze([])
    }),
    Object.freeze({
        name: 'toggle',
        title: '显示/隐藏',
        description: '切换组件显示状态',
        params: Object.freeze([])
    }),
    Object.freeze({
        name: 'requestData',
        title: '请求数据',
        description: '触发当前组件绑定的数据源请求',
        params: Object.freeze([
            Object.freeze({
                name: 'sourceId',
                title: '数据源ID',
                description: '可选，仅触发指定数据源；留空触发全部数据源',
                type: 'string',
                required: false
            })
        ])
    })
]);

const METHOD_META_MAP = Object.freeze({
    show: Object.freeze({ title: '显示', description: '显示组件' }),
    hide: Object.freeze({ title: '隐藏', description: '隐藏组件' }),
    toggle: Object.freeze({ title: '显示/隐藏', description: '切换组件显示状态' }),
    requestdata: Object.freeze({ title: '请求数据', description: '触发当前组件绑定的数据源请求' }),
    start: Object.freeze({ title: '开始', description: '开始执行组件逻辑' }),
    stop: Object.freeze({ title: '停止', description: '停止执行组件逻辑' }),
    pause: Object.freeze({ title: '暂停', description: '暂停当前执行状态' }),
    resume: Object.freeze({ title: '恢复', description: '恢复当前执行状态' }),
    activate: Object.freeze({ title: '激活', description: '启用组件功能模式' }),
    deactivate: Object.freeze({ title: '停用', description: '关闭组件功能模式' }),
    setenabled: Object.freeze({ title: '设置启用状态', description: '设置组件启用状态' }),
    updatedata: Object.freeze({ title: '更新数据', description: '更新组件数据参数' }),
    updateconfig: Object.freeze({ title: '更新配置', description: '更新组件配置参数' }),
    reset: Object.freeze({ title: '重置', description: '重置组件状态' })
});

const RESERVED_METHOD_NAMES = new Set([
    'constructor',
    'onCreate',
    'onBeforeMount',
    'onMounted',
    'onUpdate',
    'onBeforeDispose',
    'onDispose',
    'onConfigUpdate',
    'update',
    'dispose',
    'on',
    'off',
    'emit',
    'getInteractiveObjects',
    'raycast'
]);

const STOP_PROTOTYPE_CLASS_NAMES = new Set([
    'Object3D',
    'Group',
    'EventDispatcher',
    'Object'
]);

const normalizeMethodName = (value) => String(value || '').trim();

const normalizeMethodParamDefinition = (rawParam, index = 0) => {
    if (!rawParam || typeof rawParam !== 'object') {
        return null;
    }

    const name = normalizeMethodName(rawParam.name || rawParam.key || rawParam.field || `arg${index + 1}`);
    if (!name) return null;

    return {
        name,
        title: normalizeMethodName(rawParam.title || rawParam.label || name) || name,
        description: normalizeMethodName(rawParam.description || rawParam.desc || ''),
        type: normalizeMethodName(rawParam.type || 'string') || 'string',
        required: rawParam.required === true,
        defaultValue: rawParam.defaultValue
    };
};

const normalizeMethodParams = (params = []) => {
    if (!Array.isArray(params) || !params.length) return [];
    return params
        .map((param, index) => normalizeMethodParamDefinition(param, index))
        .filter(Boolean);
};

const resolveMethodMetaByName = (name = '') => {
    const key = normalizeMethodName(name).toLowerCase();
    if (!key) return { title: '', description: '' };

    const preset = METHOD_META_MAP[key];
    if (preset) {
        return {
            title: preset.title || '',
            description: preset.description || ''
        };
    }

    return {
        title: name,
        description: ''
    };
};

const normalizeMethodDefinition = (rawMethod) => {
    if (typeof rawMethod === 'string') {
        const name = normalizeMethodName(rawMethod);
        if (!name) return null;
        const preset = resolveMethodMetaByName(name);
        return {
            name,
            title: preset.title || name,
            description: preset.description || '',
            params: []
        };
    }

    if (!rawMethod || typeof rawMethod !== 'object') {
        return null;
    }

    const name = normalizeMethodName(rawMethod.name || rawMethod.value || rawMethod.method);
    if (!name) return null;

    const normalizedTitle = normalizeMethodName(rawMethod.title || rawMethod.label || '');
    const normalizedDescription = normalizeMethodName(rawMethod.description || rawMethod.desc || '');
    const preset = resolveMethodMetaByName(name);
    const title = normalizedTitle && normalizedTitle !== name
        ? normalizedTitle
        : (preset.title || name);

    return {
        name,
        title,
        description: normalizedDescription || preset.description || '',
        params: normalizeMethodParams(rawMethod.params)
    };
};

const dedupeMethodDefinitions = (methods = []) => {
    const map = new Map();
    methods.forEach((method) => {
        const normalized = normalizeMethodDefinition(method);
        if (!normalized) return;
        const key = normalized.name.toLowerCase();
        if (!map.has(key)) {
            map.set(key, normalized);
        }
    });
    return Array.from(map.values());
};

const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
};

const shouldSkipExtractedMethod = (name = '') => {
    if (!name) return true;
    if (name.startsWith('_')) return true;
    if (RESERVED_METHOD_NAMES.has(name)) return true;
    if (name.startsWith('on') && name.length > 2 && /[A-Z]/.test(name[2])) return true;
    return false;
};

const extractComponentMethodDefinitions = (ComponentClass) => {
    if (!ComponentClass || !ComponentClass.prototype) return [];

    const methods = [];
    let proto = ComponentClass.prototype;

    while (proto && proto !== Object.prototype) {
        const className = proto.constructor?.name || '';
        if (STOP_PROTOTYPE_CLASS_NAMES.has(className)) {
            break;
        }

        Object.getOwnPropertyNames(proto).forEach((key) => {
            if (shouldSkipExtractedMethod(key)) return;

            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            if (!descriptor || typeof descriptor.value !== 'function') return;

            methods.push({
                name: key
            });
        });

        proto = Object.getPrototypeOf(proto);
    }

    return dedupeMethodDefinitions(methods);
};

const normalizeComponentMethodDefinitions = (methods = [], options = {}) => {
    const includeDefaults = options.includeDefaults !== false;
    const normalized = dedupeMethodDefinitions(toArray(methods));

    if (!includeDefaults) {
        return normalized;
    }

    const existingNames = new Set(normalized.map((method) => method.name.toLowerCase()));
    const defaults = DEFAULT_COMPONENT_METHOD_DEFINITIONS.filter(
        (method) => !existingNames.has(method.name.toLowerCase())
    );

    return [...normalized, ...defaults];
};

export {
    DEFAULT_COMPONENT_METHOD_DEFINITIONS,
    normalizeComponentMethodDefinitions,
    extractComponentMethodDefinitions
};
