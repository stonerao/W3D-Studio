import { getW3DProjectSkill } from './skills/w3dProjectSkill.js';

const normalizeLocale = (locale = 'zh') => {
    const value = String(locale || '').toLowerCase();
    return value.startsWith('en') ? 'en' : 'zh';
};

const ACTION_PROTOCOL_ZH = `
你是 W3D Studio 三维编辑器的 AI 助手。你只能返回 JSON，不要返回 Markdown。
返回格式：
{
  "message": "给用户看的简短中文说明",
  "actions": [
    { "action": "addComponent", "params": { "type": "ModelLoader", "name": "模型", "config": { "position": [0, 0, 0] } } }
  ],
  "requireConfirmation": false,
  "actionSummary": "将执行的操作摘要"
}

可用 action：
- addComponent: { type, name?, config? }
- updateComponentConfig: { id, config }
- callComponentMethod: { id?, name?, type?, prefer?, methodName, args? }。优先用 id；新增组件后的连续调用可用刚才指定的 name；用 type 时多实例需设置 prefer="latest" 或先确认目标。
- removeComponent: { id }
- selectComponent: { id }
- deselectComponent: {}
- toggleComponentVisibility: { id, visible? }
- updateCameraPosition: { position?, lookAt? }
- updateBackground: { type, color?, gradientTop?, gradientBottom?, imageUrl?, hdrUrl? }
- toggleGrid: { enabled }
- updateRenderer: { shadowEnabled?, antialias? }
- createVariable: { name, value, type?, description? }
- updateVariable: { name, value }
- saveProject: {}

规则：
- 操作已有组件时优先使用上下文中存在的真实组件 id；新增组件不需要 id。
- 需要先新增组件再调用该新组件方法时，必须给新增组件一个明确 name，并在后续 callComponentMethod 中用同一个 name 定位。
- 新增 ModelLoader 的默认 position 必须是 [0, 0, 0]。
- 没有明确要求执行时，actions 返回 []，只给建议。
- 删除组件、批量覆盖配置、重置场景、替换多个模型资源等高影响操作必须设置 requireConfirmation=true。
- 不要编造资源 URL。需要用户选择资源时，只说明需要选择，actions 返回 [] 或只新增空组件。
- JSON 必须可被 JSON.parse 解析。
${getW3DProjectSkill('zh')}
`;

const ACTION_PROTOCOL_EN = `
You are the AI assistant for the W3D Studio 3D editor. Return JSON only. Do not return Markdown.
Response format:
{
  "message": "Short English message shown to the user",
  "actions": [
    { "action": "addComponent", "params": { "type": "ModelLoader", "name": "Model", "config": { "position": [0, 0, 0] } } }
  ],
  "requireConfirmation": false,
  "actionSummary": "Summary of the operations to execute"
}

Available actions:
- addComponent: { type, name?, config? }
- updateComponentConfig: { id, config }
- callComponentMethod: { id?, name?, type?, prefer?, methodName, args? }. Prefer id. For a component added earlier in the same response, call it by the exact name you assigned. If using type with multiple instances, set prefer="latest" or ask the user to clarify.
- removeComponent: { id }
- selectComponent: { id }
- deselectComponent: {}
- toggleComponentVisibility: { id, visible? }
- updateCameraPosition: { position?, lookAt? }
- updateBackground: { type, color?, gradientTop?, gradientBottom?, imageUrl?, hdrUrl? }
- toggleGrid: { enabled }
- updateRenderer: { shadowEnabled?, antialias? }
- createVariable: { name, value, type?, description? }
- updateVariable: { name, value }
- saveProject: {}

Rules:
- For existing components, prefer real component ids from context. Newly added components do not need ids.
- If you need to add a component and then call a method on it, assign a clear name in addComponent and use that same name in the later callComponentMethod.
- The default position for a new ModelLoader must be [0, 0, 0].
- If the user did not explicitly ask you to execute an edit, return "actions": [] and provide advice only.
- High-impact operations such as deleting components, batch config overwrite, scene reset, or replacing multiple model assets must set requireConfirmation=true.
- Do not invent asset URLs. If the user needs to choose an asset, say so and return [] or add only an empty component.
- The JSON must be parseable by JSON.parse.
${getW3DProjectSkill('en')}
`;

const getActionProtocol = (locale = 'zh') => (
    normalizeLocale(locale) === 'en' ? ACTION_PROTOCOL_EN : ACTION_PROTOCOL_ZH
);

const compactContext = (context = {}) => ({
    project: context.project || {},
    locale: context.locale || null,
    selectedComponent: context.selectedComponent || null,
    scene: context.scene || {},
    components: Array.isArray(context.components) ? context.components.slice(0, 120) : []
});

const DEVICE_EXPLOSION_KEYWORDS = [
    '设备爆炸',
    '设备爆炸图',
    '爆炸效果',
    '爆炸拆解',
    '拆解效果',
    '拆解动画',
    'device explosion',
    'device exploded view',
    'exploded view',
    'explosion effect',
    'explode',
    'disassemble',
    'teardown'
];

const MODEL_ANIMATION_KEYWORDS = [
    '动画',
    '开启动画',
    '启用动画',
    '加载动画',
    '自动播放',
    '播放速度',
    '倍速',
    '暂停',
    '继续',
    '恢复',
    '停止',
    'animation',
    'animations',
    'autoplay',
    'auto play',
    'playback',
    'speed',
    'pause',
    'resume',
    'continue',
    'stop'
];

const MODEL_ALIAS_NAMES = new Set([
    '模型',
    '模型组件',
    '模型加载器',
    'model',
    'model component',
    'model loader',
    'ModelLoader',
    'modelloader'
]);

const normalizeText = (value) => String(value ?? '').trim();

const includesAny = (text, keywords) => {
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(String(keyword).toLowerCase()));
};

const getComponentName = (component) => normalizeText(component?.name);
const getComponentType = (component) => normalizeText(component?.type);

const normalizeLookupText = (value = '') => String(value || '')
    .toLowerCase()
    .replace(/["'`“”‘’]/g, '')
    .replace(/\b(the|a|an|component|components)\b/g, ' ')
    .replace(/组件/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const MODEL_ALIAS_LOOKUP_NAMES = new Set(
    [...MODEL_ALIAS_NAMES, 'model loader component', '模型加载器组件']
        .map(normalizeLookupText)
        .filter(Boolean)
);

const isModelLoaderAliasName = (value = '') => MODEL_ALIAS_LOOKUP_NAMES.has(normalizeLookupText(value));

const formatComponentChoices = (components = [], { type = 'ModelLoader', isEnglish = false, limit = 12 } = {}) => {
    const list = Array.isArray(components) ? components : [];
    const filtered = type ? list.filter((component) => getComponentType(component) === type) : list;
    const source = filtered.length > 0 ? filtered : list;
    if (source.length === 0) {
        return isEnglish ? 'No components are currently available.' : '当前场景没有可选组件。';
    }

    const lines = source.slice(0, limit).map((component, index) => {
        const name = getComponentName(component) || '(unnamed)';
        const componentType = getComponentType(component) || 'Unknown';
        const id = normalizeText(component?.id) || 'unknown-id';
        return `${index + 1}. ${name} (${componentType}, id: ${id})`;
    });

    if (source.length > limit) {
        lines.push(isEnglish ? `...and ${source.length - limit} more` : `...还有 ${source.length - limit} 个组件`);
    }

    return lines.join('\n');
};

const buildMissingModelLoaderMessage = ({ context = {}, targetName = '', ambiguous = false, isEnglish = false, purpose = '' } = {}) => {
    const choices = formatComponentChoices(context.components, { type: 'ModelLoader', isEnglish });
    if (isEnglish) {
        const base = ambiguous
            ? `Multiple model loaders may match${purpose ? ` for ${purpose}` : ''}. Specify one by name.`
            : `Could not find ${targetName ? `the model loader named "${targetName}"` : 'a model loader'}. Select one from the current component list.`;
        return `${base}\nAvailable components:\n${choices}`;
    }

    const base = ambiguous
        ? `可能匹配到多个模型加载器${purpose ? `用于${purpose}` : ''}，请按名称指定一个。`
        : `未找到${targetName ? `名为“${targetName}”的` : ''}模型加载器组件，请从当前组件列表中选择。`;
    return `${base}\n当前可选组件：\n${choices}`;
};

const findModelTargetName = (message) => {
    const text = normalizeText(message);
    const patterns = [
        /给组件\s+(.+?)\s+组件添加/,
        /给组件\s+(.+?)\s+添加/,
        /组件\s+(.+?)\s+添加/,
        /给\s+(.+?)\s+添加设备爆炸/,
        /add\s+(?:a\s+)?(?:device\s+)?(?:explosion|exploded\s+view|explosion\s+effect).*?\bto\s+(?:the\s+)?(?:component\s+)?(.+?)$/i,
        /add\s+.*?\bto\s+(?:the\s+)?(.+?)\s+component/i,
        /(?:component|model)\s+["']?([^"']+?)["']?\s+(?:add|with|to\s+add)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        const value = normalizeText(match?.[1]);
        if (value) return value.replace(/[。.!?，,]+$/g, '').trim();
    }

    return '';
};

const resolveModelLoaderTarget = (context = {}, message = '') => {
    const components = Array.isArray(context.components) ? context.components : [];
    const models = components.filter((component) => getComponentType(component) === 'ModelLoader');
    const targetName = findModelTargetName(message);

    if (targetName) {
        const exact = models.find((component) => getComponentName(component) === targetName);
        if (exact) return { component: exact, ambiguous: false };

        const lowerName = targetName.toLowerCase();
        const caseInsensitive = models.find((component) => getComponentName(component).toLowerCase() === lowerName);
        if (caseInsensitive) return { component: caseInsensitive, ambiguous: false };

        const normalizedTarget = normalizeLookupText(targetName);
        if (normalizedTarget) {
            const normalizedMatches = models.filter((component) => (
                normalizeLookupText(getComponentName(component)) === normalizedTarget
                || normalizeLookupText(getComponentType(component)) === normalizedTarget
            ));
            if (normalizedMatches.length === 1) return { component: normalizedMatches[0], ambiguous: false };
            if (normalizedMatches.length > 1) return { component: null, ambiguous: true, targetName, candidates: normalizedMatches };

            const fuzzyMatches = models.filter((component) => {
                const candidateName = normalizeLookupText(getComponentName(component));
                return candidateName && (
                    candidateName.includes(normalizedTarget)
                    || normalizedTarget.includes(candidateName)
                );
            });
            if (fuzzyMatches.length === 1) return { component: fuzzyMatches[0], ambiguous: false };
            if (fuzzyMatches.length > 1) return { component: null, ambiguous: true, targetName, candidates: fuzzyMatches };
        }

        if (!isModelLoaderAliasName(targetName)) {
            return { component: null, ambiguous: false, targetName, candidates: models };
        }
    }

    if (getComponentType(context.selectedComponent) === 'ModelLoader') {
        return { component: context.selectedComponent, ambiguous: false };
    }

    if (models.length === 1) {
        return { component: models[0], ambiguous: false };
    }

    return { component: null, ambiguous: models.length > 1, targetName };
};

const parseNumberFromPatterns = (text = '', patterns = [], { integer = false, min = -Infinity, max = Infinity } = {}) => {
    for (const pattern of patterns) {
        const match = String(text || '').match(pattern);
        const value = Number(match?.[1]);
        if (!Number.isFinite(value)) continue;

        const rounded = integer ? Math.round(value) : value;
        return Math.min(max, Math.max(min, rounded));
    }

    return null;
};

const setNumericConfigPatch = (patch, key, value) => {
    if (value !== null && value !== undefined) {
        patch[key] = value;
    }
};

const parseDeviceExplosionConfigPatch = (message = '') => {
    const text = normalizeText(message);
    const patch = {};

    setNumericConfigPatch(patch, 'distanceFactor', parseNumberFromPatterns(text, [
        /(?:distance\s*(?:coefficient|factor)|explosion\s*distance\s*(?:coefficient|factor)|距离系数|爆炸距离系数)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*(-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))/i
    ], { min: 0, max: 10 }));

    setNumericConfigPatch(patch, 'baseOffset', parseNumberFromPatterns(text, [
        /(?:base\s*offset|initial\s*offset|基础偏移|基础偏移量|初始偏移)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*(-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))/i
    ], { min: 0, max: 100 }));

    setNumericConfigPatch(patch, 'distanceExponent', parseNumberFromPatterns(text, [
        /(?:distance\s*exponent|distance\s*power|距离指数|距离幂次)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*(-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))/i
    ], { min: 0.1, max: 4 }));

    setNumericConfigPatch(patch, 'maxOffset', parseNumberFromPatterns(text, [
        /(?:max(?:imum)?\s*offset|最大偏移|最大偏移量)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*(-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))/i
    ], { min: 0, max: 500 }));

    setNumericConfigPatch(patch, 'explodeLevel', parseNumberFromPatterns(text, [
        /(?:(?:explosion|explode)\s*level|hierarchy\s*level|爆炸层级|爆炸级别|层级)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*([0-9]+(?:\.[0-9]+)?)/i
    ], { integer: true, min: 1, max: 12 }));

    setNumericConfigPatch(patch, 'time', parseNumberFromPatterns(text, [
        /(?:animation\s*)?(?:duration|time|动画时长|持续时间|播放时长)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*([0-9]+(?:\.[0-9]+)?)/i
    ], { min: 0, max: 30 }));

    setNumericConfigPatch(patch, 'delayStep', parseNumberFromPatterns(text, [
        /(?:delay\s*step|step\s*delay|延迟步长|延迟间隔)\s*(?:to|as|is|=|:|：|为|是|成|到|设为|设置为|调整为|改为)?\s*([0-9]+(?:\.[0-9]+)?)/i
    ], { min: 0, max: 5 }));

    if (/(?:selection\s*mode|选择模式).*(?:by\s*hierarchy|by\s*level|hierarchy|level|按层级|层级)|按层级/i.test(text)) {
        patch.selectionMode = 'level';
    } else if (/(?:selection\s*mode|选择模式).*(?:leaf\s*nodes?|leaf|叶子节点)|叶子节点/i.test(text)) {
        patch.selectionMode = 'leaf';
    } else if (/(?:selection\s*mode|选择模式).*(?:custom|自定义)|自定义选择/i.test(text)) {
        patch.selectionMode = 'custom';
    }

    if (/(?:center\s*mode|origin\s*mode|center\s*point|中心点模式|中心模式).*(?:scene\s*origin|场景原点)|场景原点/i.test(text)) {
        patch.originMode = 'sceneOrigin';
    } else if (/(?:center\s*mode|origin\s*mode|center\s*point|中心点模式|中心模式).*(?:model\s*center|模型中心)|模型中心/i.test(text)) {
        patch.originMode = 'modelCenter';
    } else if (/(?:center\s*mode|origin\s*mode|center\s*point|中心点模式|中心模式).*(?:custom|custom\s*point|自定义点)|自定义中心点/i.test(text)) {
        patch.originMode = 'custom';
    }

    return patch;
};

const hasDeviceExplosionStartIntent = (text = '', hasConfigPatch = false) => {
    if (/执行|开始|启动|运行|播放|触发|爆炸|execute|start|run|play|trigger|explod(?:e|ed|ing|es)?|explosion/i.test(text)) {
        return true;
    }

    return !hasConfigPatch;
};

const resolveDeviceExplosionEffect = (context = {}, model = null) => {
    const components = Array.isArray(context.components) ? context.components : [];
    const selected = context.selectedComponent;

    if (getComponentType(selected) === 'DeviceExplodedView') {
        const selectedLoaderId = normalizeText(selected?.config?.selectedLoaderId);
        if (!model?.id || !selectedLoaderId || selectedLoaderId === normalizeText(model.id)) {
            return selected;
        }
    }

    const effects = components.filter((component) => getComponentType(component) === 'DeviceExplodedView');
    if (model?.id) {
        const modelId = normalizeText(model.id);
        const matched = effects.find((component) => normalizeText(component?.config?.selectedLoaderId) === modelId);
        if (matched) return matched;
    }

    if (!model?.id && effects.length === 1) {
        return effects[0];
    }

    return null;
};

const formatDeviceExplosionConfigDetails = (config = {}, isEnglish = false) => {
    const labels = isEnglish
        ? {
            distanceFactor: 'distance factor',
            baseOffset: 'base offset',
            distanceExponent: 'distance exponent',
            maxOffset: 'max offset',
            explodeLevel: 'explosion level',
            time: 'duration',
            delayStep: 'delay step',
            selectionMode: 'selection mode',
            originMode: 'center mode'
        }
        : {
            distanceFactor: '距离系数',
            baseOffset: '基础偏移',
            distanceExponent: '距离指数',
            maxOffset: '最大偏移',
            explodeLevel: '爆炸层级',
            time: '动画时长',
            delayStep: '延迟步长',
            selectionMode: '选择模式',
            originMode: '中心点模式'
        };

    return Object.entries(config)
        .map(([key, value]) => `${labels[key] || key}=${value}`)
        .join(isEnglish ? ', ' : '、');
};

const resolveDeviceExplosionIntent = ({ message, context = {}, locale = 'zh' }) => {
    const text = normalizeText(message);
    const isEnglish = normalizeLocale(locale) === 'en';
    const configPatch = parseDeviceExplosionConfigPatch(text);
    const hasConfigPatch = Object.keys(configPatch).length > 0;
    const components = Array.isArray(context.components) ? context.components : [];
    const hasDeviceExplosionContext = (
        getComponentType(context.selectedComponent) === 'DeviceExplodedView'
        || components.some((component) => getComponentType(component) === 'DeviceExplodedView')
    );

    if (!includesAny(text, DEVICE_EXPLOSION_KEYWORDS) && !(hasConfigPatch && hasDeviceExplosionContext)) {
        return null;
    }

    const { component: model, ambiguous, targetName } = resolveModelLoaderTarget(context, text);
    const existingEffect = resolveDeviceExplosionEffect(context, model);

    if (!model?.id && !existingEffect?.id) {
        return {
            message: buildMissingModelLoaderMessage({
                context,
                targetName,
                ambiguous,
                isEnglish,
                purpose: isEnglish ? 'device exploded view' : '设备爆炸图'
            }),
            actions: [],
            requireConfirmation: false,
            actionSummary: ''
        };
    }

    const modelName = getComponentName(model) || model?.id || getComponentName(existingEffect) || (isEnglish ? 'device exploded view' : '设备爆炸图');
    const shouldStart = hasDeviceExplosionStartIntent(text, hasConfigPatch);
    const configDetails = formatDeviceExplosionConfigDetails(configPatch, isEnglish);

    if (existingEffect?.id) {
        const actions = [];

        if (hasConfigPatch) {
            actions.push({
                action: 'updateComponentConfig',
                params: {
                    id: existingEffect.id,
                    config: configPatch
                }
            });
        }

        if (shouldStart || !hasConfigPatch) {
            actions.push({
                action: 'callComponentMethod',
                params: {
                    id: existingEffect.id,
                    methodName: 'start',
                    args: []
                }
            });
        }

        return {
            message: isEnglish
                ? `Updated the existing device exploded view for "${modelName}"${configDetails ? ` (${configDetails})` : ''}${shouldStart ? ' and started the explosion animation' : ''}.`
                : `已更新“${modelName}”的设备爆炸图${configDetails ? `（${configDetails}）` : ''}${shouldStart ? '，并执行爆炸动画' : ''}。`,
            actions,
            requireConfirmation: false,
            actionSummary: isEnglish
                ? `${hasConfigPatch ? 'Update device exploded view config' : 'Use existing device exploded view'}${shouldStart ? ' and start the animation' : ''}`
                : `${hasConfigPatch ? '更新设备爆炸图配置' : '使用已有设备爆炸图'}${shouldStart ? '并开始爆炸' : ''}`
        };
    }

    const effectName = isEnglish
        ? `${modelName} device exploded view`
        : `${modelName}设备爆炸图`;

    return {
        message: isEnglish
            ? `Added a device exploded view for "${modelName}"${configDetails ? ` (${configDetails})` : ''}${shouldStart ? ' and started the explosion animation' : ''}.`
            : `已为“${modelName}”添加设备爆炸图${configDetails ? `（${configDetails}）` : ''}${shouldStart ? '，并执行爆炸动画' : ''}。`,
        actions: [
            {
                action: 'addComponent',
                params: {
                    type: 'DeviceExplodedView',
                    name: effectName,
                    config: {
                        selectedLoaderId: model.id,
                        selectionMode: 'level',
                        explodeLevel: 1,
                        animate: true,
                        ...configPatch
                    }
                }
            },
            ...(shouldStart ? [{
                action: 'callComponentMethod',
                params: {
                    name: effectName,
                    methodName: 'start',
                    args: []
                }
            }] : [])
        ],
        requireConfirmation: false,
        actionSummary: isEnglish
            ? `Bind a device exploded view to the model${shouldStart ? ' and start the explosion animation' : ''}`
            : `给模型绑定设备爆炸图${shouldStart ? '并开始爆炸' : ''}`
    };
};

const parseAnimationSpeed = (text = '') => {
    const patterns = [
        /(?:播放速度|动画速度|速度|倍速)\s*(?:为|是|=|:|：)?\s*([0-9]+(?:\.[0-9]+)?)/i,
        /([0-9]+(?:\.[0-9]+)?)\s*(?:倍速|倍)/i,
        /(?:playback\s*speed|animation\s*speed|speed)\s*(?:is|to|=|:)?\s*([0-9]+(?:\.[0-9]+)?)/i,
        /([0-9]+(?:\.[0-9]+)?)\s*x\s*(?:speed)?/i
    ];

    for (const pattern of patterns) {
        const match = String(text).match(pattern);
        const value = Number(match?.[1]);
        if (Number.isFinite(value) && value > 0) return value;
    }

    return null;
};

const parseAnimationIndex = (text = '') => {
    const raw = String(text || '');
    if (/第\s*一\s*(?:个|段|条)?\s*动画|第一个动画|第一段动画|first\s+animation/i.test(raw)) {
        return 0;
    }

    const numbered = raw.match(/第\s*([0-9]+)\s*(?:个|段|条)?\s*动画|animation\s*#?\s*([0-9]+)/i);
    if (numbered) {
        const value = Number(numbered[1] || numbered[2]);
        if (Number.isFinite(value) && value > 0) return value - 1;
    }

    return 0;
};

const resolveModelAnimationIntent = ({ message, context = {}, locale = 'zh' }) => {
    const text = normalizeText(message);
    const isEnglish = normalizeLocale(locale) === 'en';

    if (!includesAny(text, MODEL_ANIMATION_KEYWORDS)) return null;

    const wantsEnable = /开启动画|启用动画|加载动画|开启模型动画|启用模型动画|enable\s+(?:model\s+)?animations?|turn\s+on\s+(?:model\s+)?animations?|load\s+(?:model\s+)?animations?/i.test(text);
    const wantsAutoPlay = /自动播放|自动播放动画|自动播放第一个动画|autoplay|auto\s*play|auto-play/i.test(text);
    const wantsPlay = /播放第一个动画|执行第一个动画|运行第一个动画|播放动画|执行动画|运行动画|play\s+(?:the\s+)?(?:first\s+)?animation|run\s+(?:the\s+)?(?:first\s+)?animation|start\s+(?:the\s+)?(?:first\s+)?animation/i.test(text);
    const wantsPause = /暂停(?:模型)?动画|pause\s+(?:model\s+)?animation/i.test(text);
    const wantsResume = /(?:继续|恢复)(?:播放)?(?:模型)?动画|resume\s+(?:model\s+)?animation|continue\s+(?:model\s+)?animation/i.test(text);
    const wantsStop = /停止(?:模型)?动画|stop\s+(?:model\s+)?animation/i.test(text);
    const speed = parseAnimationSpeed(text);

    if (!wantsEnable && !wantsAutoPlay && !wantsPlay && !wantsPause && !wantsResume && !wantsStop && speed === null) {
        return null;
    }

    const { component: model, ambiguous, targetName } = resolveModelLoaderTarget(context, text);
    if (!model?.id) {
        return {
            message: buildMissingModelLoaderMessage({
                context,
                targetName,
                ambiguous,
                isEnglish,
                purpose: isEnglish ? 'model animation control' : '模型动画控制'
            }),
            actions: [],
            requireConfirmation: false,
            actionSummary: ''
        };
    }

    const actions = [];
    const config = {};

    if (wantsEnable || wantsAutoPlay || wantsPlay) {
        config.animations = true;
    }
    if (wantsAutoPlay) {
        config.autoPlayAnimation = true;
    }

    if (Object.keys(config).length > 0) {
        actions.push({
            action: 'updateComponentConfig',
            params: {
                id: model.id,
                config
            }
        });
    }

    if (speed !== null) {
        actions.push({
            action: 'callComponentMethod',
            params: {
                id: model.id,
                methodName: 'setAnimationSpeed',
                args: [speed]
            }
        });
    }

    if (wantsPlay) {
        actions.push({
            action: 'callComponentMethod',
            params: {
                id: model.id,
                methodName: 'playAnimation',
                args: [parseAnimationIndex(text), { loop: true }]
            }
        });
    }

    if (wantsPause) {
        actions.push({
            action: 'callComponentMethod',
            params: { id: model.id, methodName: 'pauseAnimation', args: [] }
        });
    }

    if (wantsResume) {
        actions.push({
            action: 'callComponentMethod',
            params: { id: model.id, methodName: 'resumeAnimation', args: [] }
        });
    }

    if (wantsStop) {
        actions.push({
            action: 'callComponentMethod',
            params: { id: model.id, methodName: 'stopAnimation', args: [] }
        });
    }

    const modelName = getComponentName(model) || model.id;
    const details = [];
    if (wantsEnable) details.push(isEnglish ? 'enabled animations' : '开启动画');
    if (wantsAutoPlay) details.push(isEnglish ? 'enabled autoplay' : '开启自动播放');
    if (speed !== null) details.push(isEnglish ? `set speed to ${speed}x` : `设置速度为 ${speed} 倍`);
    if (wantsPlay) details.push(isEnglish ? `played animation ${parseAnimationIndex(text) + 1}` : `播放第 ${parseAnimationIndex(text) + 1} 个动画`);
    if (wantsPause) details.push(isEnglish ? 'paused animation' : '暂停动画');
    if (wantsResume) details.push(isEnglish ? 'resumed animation' : '继续动画');
    if (wantsStop) details.push(isEnglish ? 'stopped animation' : '停止动画');

    return {
        message: isEnglish
            ? `Updated "${modelName}": ${details.join(', ')}.`
            : `已更新“${modelName}”：${details.join('、')}。`,
        actions,
        requireConfirmation: false,
        actionSummary: isEnglish
            ? `Control ModelLoader animation: ${details.join(', ')}`
            : `控制模型动画：${details.join('、')}`
    };
};

export const resolveDeterministicW3DResponse = ({ message, context = {}, locale = 'zh' }) => {
    return (
        resolveDeviceExplosionIntent({ message, context, locale })
        || resolveModelAnimationIntent({ message, context, locale })
    );
};

export const buildChatMessages = ({ message, history = [], context = {}, locale = 'zh' }) => {
    const normalizedLocale = normalizeLocale(locale || context.locale);
    const safeHistory = Array.isArray(history)
        ? history
            .filter((item) => ['user', 'assistant'].includes(item?.role) && item?.content)
            .slice(-12)
            .map((item) => ({
                role: item.role,
                content: String(item.content).slice(0, 4000)
            }))
        : [];

    return [
        { role: 'system', content: getActionProtocol(normalizedLocale) },
        {
            role: 'user',
            content: `${normalizedLocale === 'en' ? 'Current editor context JSON' : '当前编辑器上下文 JSON'}:\n${JSON.stringify(compactContext({ ...context, locale: normalizedLocale }))}`
        },
        ...safeHistory,
        { role: 'user', content: String(message || '') }
    ];
};

export const parseAssistantJson = (content = '') => {
    const text = String(content || '').trim();
    if (!text) {
        return { message: 'AI 没有返回内容', actions: [] };
    }

    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        return { message: text, actions: [] };
    }
};
