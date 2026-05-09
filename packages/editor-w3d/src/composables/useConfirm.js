/**
 * English comment.
 */

import { ref, reactive } from 'vue';
import { t } from '../i18n';

// English comment.
const visible = ref(false);
const dialogState = reactive({
    title: t('common.confirm'),
    message: '',
    type: 'confirm', // 'confirm' | 'alert'
    confirmText: t('common.confirm'),
    cancelText: t('common.cancel'),
    variant: 'default' // 'default' | 'danger' | 'warning'
});

let resolvePromise = null;

export function useConfirm() {
    /**
     * English comment.
     */
    const confirm = (message, options = {}) => {
        return new Promise((resolve) => {
            dialogState.title = options.title || t('common.confirm');
            dialogState.message = message;
            dialogState.type = 'confirm';
            dialogState.confirmText = options.confirmText || t('common.confirm');
            dialogState.cancelText = options.cancelText || t('common.cancel');
            dialogState.variant = options.variant || 'default';

            resolvePromise = resolve;
            visible.value = true;
        });
    };

    /**
     * English comment.
     */
    const alert = (message, options = {}) => {
        return new Promise((resolve) => {
            dialogState.title = options.title || t('common.prompt');
            dialogState.message = message;
            dialogState.type = 'alert';
            dialogState.confirmText = options.confirmText || t('common.confirm');
            dialogState.variant = options.variant || 'default';

            resolvePromise = resolve;
            visible.value = true;
        });
    };

    /**
     * English comment.
     */
    const danger = (message, options = {}) => {
        return confirm(message, {
            title: options.title || t('common.dangerOperation'),
            confirmText: options.confirmText || t('common.delete'),
            cancelText: options.cancelText || t('common.cancel'),
            variant: 'danger',
            ...options
        });
    };

    /**
     * English comment.
     */
    const handleConfirm = () => {
        visible.value = false;
        if (resolvePromise) {
            resolvePromise(true);
            resolvePromise = null;
        }
    };

    /**
     * English comment.
     */
    const handleCancel = () => {
        visible.value = false;
        if (resolvePromise) {
            resolvePromise(false);
            resolvePromise = null;
        }
    };

    return {
        // English comment.
        visible,
        dialogState,
        // English comment.
        confirm,
        alert,
        danger,
        handleConfirm,
        handleCancel
    };
}
