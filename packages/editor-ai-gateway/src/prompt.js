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
- callComponentMethod: { id, methodName, args? }
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
- 只能操作上下文中存在的组件 id；新增组件不需要 id。
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
