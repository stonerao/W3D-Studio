/**
 * English comment.
 */

let toastInstance = null;

export function useToast() {
    // English comment.
    const setToastInstance = (instance) => {
        toastInstance = instance;
    };

    // English comment.
    const success = (message, title = '成功') => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.success(message, title);
    };

    // English comment.
    const error = (message, title = '错误') => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.error(message, title);
    };

    // English comment.
    const warning = (message, title = '警告') => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.warning(message, title);
    };

    // English comment.
    const info = (message, title = '提示') => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.info(message, title);
    };

    // English comment.
    const show = (options) => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.addToast(options);
    };

    // English comment.
    const remove = (id) => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.removeToast(id);
    };

    // English comment.
    const clearAll = () => {
        if (!toastInstance) {
            console.warn('[useToast] Toast instance not initialized');
            return;
        }
        return toastInstance.clearAll();
    };

    return {
        setToastInstance,
        success,
        error,
        warning,
        info,
        show,
        remove,
        clearAll
    };
}

