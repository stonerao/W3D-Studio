/**
 * EditorActions - 编辑器操作服务
 * 提供统一的编辑器操作接口，供 AI 调用执行
 *
 * 所有操作方法都返回 { success: boolean, message: string, data?: any }
 */

import { useComponentStore } from '../stores/useComponentStore';
import { useSceneStore } from '../stores/useSceneStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useVariableStore } from '../stores/useVariableStore';
import { useDataSourceStore } from '../stores/useDataSourceStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { syncGridHelper } from '../utils/sceneHelpers';

/**
 * 操作结果类型
 * @typedef {Object} ActionResult
 * @property {boolean} success - 操作是否成功
 * @property {string} message - 操作结果描述
 * @property {any} [data] - 返回的数据
 */

/**
 * 编辑器操作服务
 * 封装所有可被 AI 调用的编辑器操作
 */
class EditorActionsService {
    constructor() {
        this.initialized = false;
        this.stores = {};
    }

    /**
     * 初始化服务（延迟初始化 stores）
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
     * 确保已初始化
     */
    ensureInit() {
        if (!this.initialized) {
            this.init();
        }
    }

    // ==================== 组件操作 ====================

    /**
     * 添加组件到场景
     * @param {Object} params
     * @param {string} params.type - 组件类型
     * @param {string} [params.name] - 组件名称
     * @param {Object} [params.config] - 组件配置
     * @returns {ActionResult}
     */
    async addComponent({ type, name, config = {} }) {
        this.ensureInit();

        try {
            const scene = this.stores.scene.sceneInstance;
            if (!scene) {
                return { success: false, message: '场景未初始化' };
            }

            // 生成组件名称
            const componentName = name || `${type}_${Date.now()}`;

            // 添加到场景
            const instance = await scene.add(type, {
                name: componentName,
                ...config
            });

            // 添加到组件存储
            const component = this.stores.component.addComponent({
                type,
                name: componentName,
                config,
                instance
            });

            // 将 store id 传播到场景实例的 config 中
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
     * 删除组件
     * @param {Object} params
     * @param {string} params.id - 组件 ID
     * @returns {ActionResult}
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
     * 更新组件配置
     * @param {Object} params
     * @param {string} params.id - 组件 ID
     * @param {Object} params.config - 新配置
     * @returns {ActionResult}
     */
    async updateComponentConfig({ id, config }) {
        this.ensureInit();

        try {
            const component = this.stores.component.components.find(c => c.id === id);
            if (!component) {
                return { success: false, message: '组件不存在' };
            }

            // 更新组件实例配置
            if (component.instance && typeof component.instance.updateConfig === 'function') {
                component.instance.updateConfig(config);
            }

            // 更新存储中的配置
            this.stores.component.updateComponent(id, {
                config: { ...component.config, ...config }
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
     * 选中组件
     * @param {Object} params
     * @param {string} params.id - 组件 ID
     * @returns {ActionResult}
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
     * 取消选中
     * @returns {ActionResult}
     */
    deselectComponent() {
        this.ensureInit();
        this.stores.component.deselectComponent();
        return { success: true, message: '已取消选中' };
    }

    /**
     * 切换组件可见性
     * @param {Object} params
     * @param {string} params.id - 组件 ID
     * @param {boolean} [params.visible] - 可见性（不传则切换）
     * @returns {ActionResult}
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
     * 根据名称查找组件
     * @param {Object} params
     * @param {string} params.name - 组件名称
     * @returns {ActionResult}
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
     * 根据类型查找组件
     * @param {Object} params
     * @param {string} params.type - 组件类型
     * @returns {ActionResult}
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
     * 获取所有组件列表
     * @returns {ActionResult}
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

    // ==================== 场景操作 ====================

    /**
     * 更新相机位置
     * @param {Object} params
     * @param {number[]} params.position - [x, y, z]
     * @param {number[]} [params.lookAt] - [x, y, z]
     * @returns {ActionResult}
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
     * 更新场景背景
     * @param {Object} params
     * @param {string} params.type - 'color' | 'gradient' | 'image' | 'hdr'
     * @param {string} [params.color] - 纯色背景色
     * @param {string} [params.gradientTop] - 渐变顶部色
     * @param {string} [params.gradientBottom] - 渐变底部色
     * @param {string} [params.imageUrl] - 图片 URL
     * @param {string} [params.hdrUrl] - HDR 文件 URL
     * @returns {ActionResult}
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
     * 切换网格显示
     * @param {Object} params
     * @param {boolean} params.enabled - 是否启用
     * @returns {ActionResult}
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
     * 更新渲染器配置
     * @param {Object} params
     * @param {boolean} [params.shadowEnabled] - 是否启用阴影
     * @param {boolean} [params.antialias] - 是否启用抗锯齿
     * @returns {ActionResult}
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

    // ==================== 变量操作 ====================

    /**
     * 创建变量
     * @param {Object} params
     * @param {string} params.name - 变量名
     * @param {any} params.value - 变量值
     * @param {string} [params.type] - 变量类型
     * @param {string} [params.description] - 描述
     * @returns {ActionResult}
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
     * 更新变量
     * @param {Object} params
     * @param {string} params.name - 变量名
     * @param {any} params.value - 新值
     * @returns {ActionResult}
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
     * 获取变量值
     * @param {Object} params
     * @param {string} params.name - 变量名
     * @returns {ActionResult}
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
     * 列出所有变量
     * @returns {ActionResult}
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

    // ==================== 编辑器状态 ====================

    /**
     * 切换编辑模式
     * @param {Object} params
     * @param {string} params.mode - 'edit' | 'preview'
     * @returns {ActionResult}
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
     * 切换面板显示
     * @param {Object} params
     * @param {string} params.panel - 'left' | 'right'
     * @param {boolean} [params.visible] - 是否显示
     * @returns {ActionResult}
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

    // ==================== 历史记录 ====================

    /**
     * 撤销操作
     * @returns {ActionResult}
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
     * 重做操作
     * @returns {ActionResult}
     */
    redo() {
        this.ensureInit();

        if (!this.stores.history.canRedo) {
            return { success: false, message: '没有可重做的操作' };
        }

        this.stores.history.redo?.();
        return { success: true, message: '已重做' };
    }

    // ==================== 项目操作 ====================

    /**
     * 保存项目
     * @returns {ActionResult}
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
     * 获取项目信息
     * @returns {ActionResult}
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

    // ==================== 批量操作 ====================

    /**
     * 执行多个操作
     * @param {Array<{action: string, params: Object}>} operations - 操作列表
     * @returns {ActionResult}
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

    // ==================== 获取可用操作列表 ====================

    /**
     * 获取所有可用操作的描述
     * @returns {Object}
     */
    getAvailableActions() {
        return {
            // 组件操作
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

            // 场景操作
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

            // 变量操作
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

            // 编辑器状态
            setEditorMode: {
                description: '切换编辑模式',
                params: { mode: 'edit/preview (必填)' }
            },
            togglePanel: {
                description: '切换面板显示',
                params: { panel: 'left/right (必填)', visible: '是否显示 (可选)' }
            },

            // 历史记录
            undo: {
                description: '撤销操作',
                params: {}
            },
            redo: {
                description: '重做操作',
                params: {}
            },

            // 项目操作
            saveProject: {
                description: '保存项目',
                params: {}
            },
            getProjectInfo: {
                description: '获取项目信息',
                params: {}
            },

            // 批量操作
            executeMultiple: {
                description: '执行多个操作',
                params: { operations: '[{action, params}] 操作列表 (必填)' }
            }
        };
    }
}

// 导出单例
export const editorActions = new EditorActionsService();

// 导出类（用于测试）
export { EditorActionsService };
