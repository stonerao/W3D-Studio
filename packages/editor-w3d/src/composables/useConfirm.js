/**
 * 确认对话框系统
 * 用于替代原生的 confirm() 和 alert() 方法
 */

import { ref, reactive } from 'vue';

// 全局状态
const visible = ref(false);
const dialogState = reactive({
    title: '确认',
    message: '',
    type: 'confirm', // 'confirm' | 'alert'
    confirmText: '确定',
    cancelText: '取消',
    variant: 'default' // 'default' | 'danger' | 'warning'
});

let resolvePromise = null;

export function useConfirm() {
    /**
     * 显示确认对话框
     * @param {string} message - 提示消息
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 用户选择结果
     */
    const confirm = (message, options = {}) => {
        return new Promise((resolve) => {
            dialogState.title = options.title || '确认';
            dialogState.message = message;
            dialogState.type = 'confirm';
            dialogState.confirmText = options.confirmText || '确定';
            dialogState.cancelText = options.cancelText || '取消';
            dialogState.variant = options.variant || 'default';

            resolvePromise = resolve;
            visible.value = true;
        });
    };

    /**
     * 显示警告/提示对话框（只有确定按钮）
     * @param {string} message - 提示消息
     * @param {Object} options - 配置选项
     * @returns {Promise<void>}
     */
    const alert = (message, options = {}) => {
        return new Promise((resolve) => {
            dialogState.title = options.title || '提示';
            dialogState.message = message;
            dialogState.type = 'alert';
            dialogState.confirmText = options.confirmText || '确定';
            dialogState.variant = options.variant || 'default';

            resolvePromise = resolve;
            visible.value = true;
        });
    };

    /**
     * 显示危险操作确认对话框
     * @param {string} message - 提示消息
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>}
     */
    const danger = (message, options = {}) => {
        return confirm(message, {
            title: options.title || '危险操作',
            confirmText: options.confirmText || '删除',
            cancelText: options.cancelText || '取消',
            variant: 'danger',
            ...options
        });
    };

    /**
     * 处理确认
     */
    const handleConfirm = () => {
        visible.value = false;
        if (resolvePromise) {
            resolvePromise(true);
            resolvePromise = null;
        }
    };

    /**
     * 处理取消
     */
    const handleCancel = () => {
        visible.value = false;
        if (resolvePromise) {
            resolvePromise(false);
            resolvePromise = null;
        }
    };

    return {
        // 状态
        visible,
        dialogState,
        // 方法
        confirm,
        alert,
        danger,
        handleConfirm,
        handleCancel
    };
}
