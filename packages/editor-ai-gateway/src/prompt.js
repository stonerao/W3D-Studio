import { W3D_PROJECT_SKILL } from './skills/w3dProjectSkill.js';

const ACTION_PROTOCOL = `
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
- 操作已有组件时优先使用上下文中存在的组件 id；新增组件不需要 id。
- 需要先新增组件再调用该新组件方法时，必须给新增组件一个明确 name，并在后续 callComponentMethod 中用同一个 name 定位。
- 新增 ModelLoader 的默认 position 必须是 [0, 0, 0]。
- 没有明确要求执行时，actions 返回 []，只给建议。
- 删除组件、批量覆盖配置、重置场景、替换多个模型资源等高影响操作必须设置 requireConfirmation=true。
- 不要编造资源 URL。需要用户选择资源时，只说明需要选择，actions 返回 [] 或只新增空组件。
- JSON 必须可被 JSON.parse 解析。

${W3D_PROJECT_SKILL}
`;

const compactContext = (context = {}) => ({
    project: context.project || {},
    selectedComponent: context.selectedComponent || null,
    scene: context.scene || {},
    components: Array.isArray(context.components) ? context.components.slice(0, 120) : []
});

const DEVICE_EXPLOSION_KEYWORDS = ['设备爆炸', '设备爆炸图', '爆炸效果', '爆炸拆解', '拆解效果', '拆解动画'];
const MODEL_ALIAS_NAMES = new Set(['模型', '模型组件', '模型加载器', 'ModelLoader', 'modelloader']);

const normalizeText = (value) => String(value ?? '').trim();

const includesAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const getComponentName = (component) => normalizeText(component?.name);
const getComponentType = (component) => normalizeText(component?.type);

const findModelTargetName = (message) => {
    const text = normalizeText(message);
    const patterns = [
        /给组件\s+(.+?)\s+组件添加/,
        /给组件\s+(.+?)\s+添加/,
        /组件\s+(.+?)\s+添加/,
        /给\s+(.+?)\s+添加设备爆炸/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        const value = normalizeText(match?.[1]);
        if (value) return value;
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

        if (!MODEL_ALIAS_NAMES.has(targetName) && !MODEL_ALIAS_NAMES.has(lowerName)) {
            return { component: null, ambiguous: false, targetName };
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

const resolveDeviceExplosionIntent = ({ message, context = {} }) => {
    const text = normalizeText(message);
    if (!includesAny(text, DEVICE_EXPLOSION_KEYWORDS)) return null;
    if (!/模型|ModelLoader|modelloader/i.test(text)) return null;

    const { component: model, ambiguous, targetName } = resolveModelLoaderTarget(context, text);
    if (!model?.id) {
        return {
            message: ambiguous
                ? '场景中有多个模型加载器，请指定要添加设备爆炸效果的模型名称。'
                : `未找到${targetName ? `名为“${targetName}”的` : ''}模型加载器组件，请先选择或添加模型。`,
            actions: [],
            requireConfirmation: false,
            actionSummary: ''
        };
    }

    const components = Array.isArray(context.components) ? context.components : [];
    const existingEffect = components.find((component) => (
        getComponentType(component) === 'DeviceExplodedView'
        && normalizeText(component?.config?.selectedLoaderId) === normalizeText(model.id)
    ));

    if (existingEffect?.id) {
        return {
            message: `已找到“${getComponentName(model) || model.id}”的设备爆炸图，并执行爆炸动画。`,
            actions: [
                {
                    action: 'callComponentMethod',
                    params: {
                        id: existingEffect.id,
                        methodName: 'start',
                        args: []
                    }
                }
            ],
            requireConfirmation: false,
            actionSummary: '执行已有设备爆炸图的爆炸动画'
        };
    }

    const effectName = `${getComponentName(model) || '模型'}设备爆炸图`;
    return {
        message: `已为“${getComponentName(model) || model.id}”添加设备爆炸图，并执行爆炸动画。`,
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
                        animate: true
                    }
                }
            },
            {
                action: 'callComponentMethod',
                params: {
                    name: effectName,
                    methodName: 'start',
                    args: []
                }
            }
        ],
        requireConfirmation: false,
        actionSummary: '给模型绑定设备爆炸图并开始爆炸'
    };
};

export const resolveDeterministicW3DResponse = ({ message, context = {} }) => {
    return resolveDeviceExplosionIntent({ message, context });
};

export const buildChatMessages = ({ message, history = [], context = {} }) => {
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
        { role: 'system', content: ACTION_PROTOCOL },
        {
            role: 'user',
            content: `当前编辑器上下文 JSON：\n${JSON.stringify(compactContext(context))}`
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
