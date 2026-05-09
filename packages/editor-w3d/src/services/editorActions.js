/**
 * English comment.
 */

import { useComponentStore } from '../stores/useComponentStore';
import { useSceneStore } from '../stores/useSceneStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useVariableStore } from '../stores/useVariableStore';
import { useDataSourceStore } from '../stores/useDataSourceStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { syncGridHelper } from '../utils/sceneHelpers';

const isPlainObject = (value) => (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
);

const deepMergeConfig = (target = {}, source = {}) => {
    const result = { ...(isPlainObject(target) ? target : {}) };
    Object.keys(source || {}).forEach((key) => {
        const nextValue = source[key];
        if (isPlainObject(nextValue)) {
            result[key] = deepMergeConfig(result[key], nextValue);
        } else {
            result[key] = nextValue;
        }
    });
    return result;
};

const FORBIDDEN_COMPONENT_METHODS = new Set([
    'constructor',
    'onMounted',
    'onUnmounted',
    'updateConfig',
    'dispose'
]);

/**
 * English comment.
 */

/**
 * English comment.
 */
class EditorActionsService {
    constructor() {
        this.initialized = false;
        this.stores = {};
    }

    /**
     * English comment.
     */
    init() {
        if (this.initialized) return;

        this.stores = {
            component: useComponentStore(),
            scene: useSceneStore(),
            project: useProjectStore(),
            variable: useVariableStore(),
            dataSource: useDataSourceStore(),
            editor: useEditorStore(),
            history: useHistoryStore()
        };

        this.initialized = true;
    }

    /**
     * English comment.
     */
    ensureInit() {
        if (!this.initialized) {
            this.init();
        }
    }

    // English comment.

    /**
     * English comment.
     */
    async addComponent({ type, name, config = {} }) {
        this.ensureInit();

        try {
            const scene = this.stores.scene.sceneInstance;
            if (!scene) {
                return { success: false, message: '场景未初始化' };
            }

            // English comment.
            const componentName = name || `${type}_${Date.now()}`;

            // English comment.
            const instance = await scene.add(type, {
                name: componentName,
                ...config
            });

            // English comment.
            const component = this.stores.component.addComponent({
                type,
                name: componentName,
                config,
                instance
            });

            // English comment.
            if (instance && component.id) {
                if (!instance.config) instance.config = {};
                instance.config.id = component.id;
            }

            return {
                success: true,
                message: `成功添加组件: ${componentName}`,
                data: { id: component.id, name: componentName, type }
            };
        } catch (error) {
            return { success: false, message: `添加组件失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    async removeComponent({ id }) {
        this.ensureInit();

        try {
            const component = this.stores.component.components.find(c => c.id === id);
            if (!component) {
                return { success: false, message: '组件不存在' };
            }

            const scene = this.stores.scene.sceneInstance;
            if (scene && component.name) {
                scene.remove(component.name);
            }

            this.stores.component.removeComponent(id);

            return {
                success: true,
                message: `成功删除组件: ${component.name}`,
                data: { id, name: component.name }
            };
        } catch (error) {
            return { success: false, message: `删除组件失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    async updateComponentConfig({ id, config }) {
        this.ensureInit();

        try {
            const component = this.stores.component.components.find(c => c.id === id);
            if (!component) {
                return { success: false, message: '组件不存在' };
            }

            // English comment.
            if (component.instance && typeof component.instance.updateConfig === 'function') {
                await component.instance.updateConfig(config);
            }

            // English comment.
            this.stores.component.updateComponent(id, {
                config: deepMergeConfig(component.config || {}, config || {})
            });

            return {
                success: true,
                message: `成功更新组件配置: ${component.name}`,
                data: { id, config }
            };
        } catch (error) {
            return { success: false, message: `更新组件配置失败: ${error.message}` };
        }
    }

    /**
     * Call a method exposed by a component instance.
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.methodName
     * @param {Array} [params.args]
     * @returns {ActionResult}
     */
    async callComponentMethod({ id, methodName, args = [] }) {
        this.ensureInit();

        try {
            const component = this.stores.component.components.find(c => c.id === id);
            if (!component) {
                return { success: false, message: '组件不存在' };
            }

            const method = String(methodName || '').trim();
            if (!method || method.startsWith('_') || FORBIDDEN_COMPONENT_METHODS.has(method)) {
                return { success: false, message: `不允许调用组件方法: ${method || '(empty)'}` };
            }

            if (!component.instance || typeof component.instance[method] !== 'function') {
                return { success: false, message: `组件不支持方法: ${method}` };
            }

            const methodArgs = Array.isArray(args) ? args : [args];
            const data = await component.instance[method](...methodArgs);

            return {
                success: true,
                message: `成功调用组件方法: ${component.name}.${method}`,
                data
            };
        } catch (error) {
            return { success: false, message: `调用组件方法失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    selectComponent({ id }) {
        this.ensureInit();

        const component = this.stores.component.components.find(c => c.id === id);
        if (!component) {
            return { success: false, message: '组件不存在' };
        }

        this.stores.component.selectComponent(id);
        return {
            success: true,
            message: `已选中组件: ${component.name}`,
            data: { id, name: component.name, type: component.type }
        };
    }

    /**
     * English comment.
     */
    deselectComponent() {
        this.ensureInit();
        this.stores.component.deselectComponent();
        return { success: true, message: '已取消选中' };
    }

    /**
     * English comment.
     */
    toggleComponentVisibility({ id, visible }) {
        this.ensureInit();

        const component = this.stores.component.components.find(c => c.id === id);
        if (!component) {
            return { success: false, message: '组件不存在' };
        }

        if (visible !== undefined) {
            this.stores.component.updateComponent(id, { visible });
        } else {
            this.stores.component.toggleComponentVisibility(id);
        }

        const newVisible = this.stores.component.components.find(c => c.id === id)?.visible;
        return {
            success: true,
            message: `组件 ${component.name} ${newVisible ? '已显示' : '已隐藏'}`,
            data: { id, visible: newVisible }
        };
    }

    /**
     * English comment.
     */
    findComponentByName({ name }) {
        this.ensureInit();

        const component = this.stores.component.getComponentByName(name);
        if (!component) {
            return { success: false, message: `未找到名为 "${name}" 的组件` };
        }

        return {
            success: true,
            message: `找到组件: ${name}`,
            data: {
                id: component.id,
                name: component.name,
                type: component.type,
                config: component.config
            }
        };
    }

    /**
     * English comment.
     */
    findComponentsByType({ type }) {
        this.ensureInit();

        const components = this.stores.component.getComponentsByType(type);
        return {
            success: true,
            message: `找到 ${components.length} 个 ${type} 类型的组件`,
            data: components.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type
            }))
        };
    }

    /**
     * English comment.
     */
    listComponents() {
        this.ensureInit();

        const components = this.stores.component.components.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            visible: c.visible,
            previewVisible: c.previewVisible !== false,
            locked: c.locked
        }));

        return {
            success: true,
            message: `场景中共有 ${components.length} 个组件`,
            data: components
        };
    }

    // English comment.

    /**
     * English comment.
     */
    updateCameraPosition({ position, lookAt }) {
        this.ensureInit();

        try {
            const config = {};
            if (position) config.position = position;
            if (lookAt) config.lookAt = lookAt;

            this.stores.scene.updateCameraConfig(config);

            return {
                success: true,
                message: '相机位置已更新',
                data: config
            };
        } catch (error) {
            return { success: false, message: `更新相机失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    updateBackground({ type, color, gradientTop, gradientBottom, imageUrl, hdrUrl }) {
        this.ensureInit();

        try {
            const config = { type };
            if (color) config.color = color;
            if (gradientTop) config.gradientTop = gradientTop;
            if (gradientBottom) config.gradientBottom = gradientBottom;
            if (imageUrl) config.imageUrl = imageUrl;
            if (hdrUrl) config.hdrUrl = hdrUrl;

            this.stores.scene.updateBackgroundConfig(config);

            return {
                success: true,
                message: `场景背景已更新为: ${type}`,
                data: config
            };
        } catch (error) {
            return { success: false, message: `更新背景失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    async toggleGrid({ enabled }) {
        this.ensureInit();

        try {
            this.stores.scene.updateHelpersConfig({
                grid: { ...this.stores.scene.sceneConfig.helpers.grid, enabled }
            });

            if (this.stores.scene.sceneInstance) {
                await syncGridHelper(
                    this.stores.scene.sceneInstance,
                    this.stores.scene.sceneConfig.helpers.grid,
                    { isPreview: false }
                );
            }

            return {
                success: true,
                message: enabled ? '网格已显示' : '网格已隐藏',
                data: { enabled }
            };
        } catch (error) {
            return { success: false, message: `切换网格失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    updateRenderer({ shadowEnabled, antialias }) {
        this.ensureInit();

        try {
            const config = {};
            if (shadowEnabled !== undefined) config.shadowEnabled = shadowEnabled;
            if (antialias !== undefined) config.antialias = antialias;

            this.stores.scene.updateRendererConfig(config);

            return {
                success: true,
                message: '渲染器配置已更新',
                data: config
            };
        } catch (error) {
            return { success: false, message: `更新渲染器失败: ${error.message}` };
        }
    }

    // English comment.

    /**
     * English comment.
     */
    createVariable({ name, value, type = 'string', description = '' }) {
        this.ensureInit();

        try {
            if (this.stores.variable.getVariable?.(name)) {
                return { success: false, message: `变量 "${name}" 已存在` };
            }

            this.stores.variable.addVariable?.({
                name,
                value,
                type,
                description
            });

            return {
                success: true,
                message: `成功创建变量: ${name}`,
                data: { name, value, type }
            };
        } catch (error) {
            return { success: false, message: `创建变量失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    updateVariable({ name, value }) {
        this.ensureInit();

        try {
            this.stores.variable.setVariable?.(name, value);
            return {
                success: true,
                message: `变量 ${name} 已更新`,
                data: { name, value }
            };
        } catch (error) {
            return { success: false, message: `更新变量失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    getVariable({ name }) {
        this.ensureInit();

        const value = this.stores.variable.getVariable?.(name);
        if (value === undefined) {
            return { success: false, message: `变量 "${name}" 不存在` };
        }

        return {
            success: true,
            message: `变量 ${name} 的值`,
            data: { name, value }
        };
    }

    /**
     * English comment.
     */
    listVariables() {
        this.ensureInit();

        const variables = this.stores.variable.variables || [];
        return {
            success: true,
            message: `共有 ${variables.length} 个变量`,
            data: variables.map(v => ({
                name: v.name,
                value: v.value,
                type: v.type
            }))
        };
    }

    // English comment.

    /**
     * English comment.
     */
    setEditorMode({ mode }) {
        this.ensureInit();

        if (!['edit', 'preview'].includes(mode)) {
            return { success: false, message: '无效的编辑器模式' };
        }

        this.stores.editor.setMode(mode);
        return {
            success: true,
            message: `已切换到${mode === 'edit' ? '编辑' : '预览'}模式`,
            data: { mode }
        };
    }

    /**
     * English comment.
     */
    togglePanel({ panel, visible }) {
        this.ensureInit();

        if (panel === 'left') {
            if (visible !== undefined) {
                this.stores.editor.showLeftPanel = visible;
            } else {
                this.stores.editor.toggleLeftPanel();
            }
        } else if (panel === 'right') {
            if (visible !== undefined) {
                this.stores.editor.showRightPanel = visible;
            } else {
                this.stores.editor.toggleRightPanel();
            }
        } else {
            return { success: false, message: '无效的面板名称' };
        }

        return {
            success: true,
            message: `${panel === 'left' ? '左' : '右'}面板已${visible ?? !this.stores.editor[`show${panel === 'left' ? 'Left' : 'Right'}Panel`] ? '显示' : '隐藏'}`,
            data: { panel }
        };
    }

    // English comment.

    /**
     * English comment.
     */
    undo() {
        this.ensureInit();

        if (!this.stores.history.canUndo) {
            return { success: false, message: '没有可撤销的操作' };
        }

        this.stores.history.undo?.();
        return { success: true, message: '已撤销' };
    }

    /**
     * English comment.
     */
    redo() {
        this.ensureInit();

        if (!this.stores.history.canRedo) {
            return { success: false, message: '没有可重做的操作' };
        }

        this.stores.history.redo?.();
        return { success: true, message: '已重做' };
    }

    // English comment.

    /**
     * English comment.
     */
    async saveProject() {
        this.ensureInit();

        try {
            await this.stores.project.save?.();
            return { success: true, message: '项目已保存' };
        } catch (error) {
            return { success: false, message: `保存项目失败: ${error.message}` };
        }
    }

    /**
     * English comment.
     */
    getProjectInfo() {
        this.ensureInit();

        const project = this.stores.project.currentProject;
        if (!project) {
            return { success: false, message: '未打开项目' };
        }

        return {
            success: true,
            message: '当前项目信息',
            data: {
                id: project.id,
                name: project.name,
                description: project.description,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt
            }
        };
    }

    // English comment.

    /**
     * English comment.
     */
    async executeMultiple(operations) {
        this.ensureInit();

        const results = [];
        let successCount = 0;
        let failCount = 0;

        for (const op of operations) {
            const handler = this[op.action];
            if (typeof handler === 'function') {
                const result = await handler.call(this, op.params || {});
                results.push({ action: op.action, ...result });
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                results.push({
                    action: op.action,
                    success: false,
                    message: `未知操作: ${op.action}`
                });
                failCount++;
            }
        }

        return {
            success: failCount === 0,
            message: `执行了 ${operations.length} 个操作，成功 ${successCount}，失败 ${failCount}`,
            data: results
        };
    }

    // English comment.

    /**
     * English comment.
     */
    getAvailableActions() {
        return {
            // English comment.
            addComponent: {
                description: '添加组件到场景',
                params: {
                    type: '组件类型 (必填)',
                    name: '组件名称 (可选)',
                    config: '组件配置 (可选)'
                }
            },
            removeComponent: {
                description: '删除组件',
                params: { id: '组件 ID (必填)' }
            },
            updateComponentConfig: {
                description: '更新组件配置',
                params: { id: '组件 ID (必填)', config: '新配置 (必填)' }
            },
            callComponentMethod: {
                description: '调用组件实例方法',
                params: { id: '组件 ID (必填)', methodName: '方法名 (必填)', args: '参数数组 (可选)' }
            },
            selectComponent: {
                description: '选中组件',
                params: { id: '组件 ID (必填)' }
            },
            deselectComponent: {
                description: '取消选中',
                params: {}
            },
            toggleComponentVisibility: {
                description: '切换组件可见性',
                params: { id: '组件 ID (必填)', visible: '是否可见 (可选)' }
            },
            findComponentByName: {
                description: '根据名称查找组件',
                params: { name: '组件名称 (必填)' }
            },
            findComponentsByType: {
                description: '根据类型查找组件',
                params: { type: '组件类型 (必填)' }
            },
            listComponents: {
                description: '列出所有组件',
                params: {}
            },

            // English comment.
            updateCameraPosition: {
                description: '更新相机位置',
                params: { position: '[x, y, z] (可选)', lookAt: '[x, y, z] (可选)' }
            },
            updateBackground: {
                description: '更新场景背景',
                params: {
                    type: 'color/gradient/image/hdr (必填)',
                    color: '纯色 (可选)',
                    gradientTop: '渐变顶色 (可选)',
                    gradientBottom: '渐变底色 (可选)',
                    imageUrl: '图片 URL (可选)',
                    hdrUrl: 'HDR URL (可选)'
                }
            },
            toggleGrid: {
                description: '切换网格显示',
                params: { enabled: '是否启用 (必填)' }
            },
            updateRenderer: {
                description: '更新渲染器配置',
                params: { shadowEnabled: '是否启用阴影 (可选)', antialias: '是否启用抗锯齿 (可选)' }
            },

            // English comment.
            createVariable: {
                description: '创建变量',
                params: { name: '变量名 (必填)', value: '值 (必填)', type: '类型 (可选)', description: '描述 (可选)' }
            },
            updateVariable: {
                description: '更新变量',
                params: { name: '变量名 (必填)', value: '新值 (必填)' }
            },
            getVariable: {
                description: '获取变量值',
                params: { name: '变量名 (必填)' }
            },
            listVariables: {
                description: '列出所有变量',
                params: {}
            },

            // English comment.
            setEditorMode: {
                description: '切换编辑模式',
                params: { mode: 'edit/preview (必填)' }
            },
            togglePanel: {
                description: '切换面板显示',
                params: { panel: 'left/right (必填)', visible: '是否显示 (可选)' }
            },

            // English comment.
            undo: {
                description: '撤销操作',
                params: {}
            },
            redo: {
                description: '重做操作',
                params: {}
            },

            // English comment.
            saveProject: {
                description: '保存项目',
                params: {}
            },
            getProjectInfo: {
                description: '获取项目信息',
                params: {}
            },

            // English comment.
            executeMultiple: {
                description: '执行多个操作',
                params: { operations: '[{action, params}] 操作列表 (必填)' }
            }
        };
    }
}

// English comment.
export const editorActions = new EditorActionsService();

// English comment.
export { EditorActionsService };
