import { onMounted, onUnmounted } from 'vue';

/**
 * English comment.
 */
export function useKeyboard() {
    // English comment.
    const shortcuts = new Map();

    /**
     * English comment.
     */
    const register = (key, handler, options = {}) => {
        const normalizedKey = normalizeKey(key);
        shortcuts.set(normalizedKey, {
            handler,
            description: options.description || '',
            preventDefault: options.preventDefault !== false // English comment.
        });
        console.log(`[Keyboard] Registered shortcut: ${normalizedKey}`);
    };

    /**
     * English comment.
     */
    const unregister = (key) => {
        const normalizedKey = normalizeKey(key);
        shortcuts.delete(normalizedKey);
        console.log(`[Keyboard] Unregistered shortcut: ${normalizedKey}`);
    };

    /**
     * English comment.
     */
    const unregisterAll = () => {
        shortcuts.clear();
        console.log('[Keyboard] All shortcuts unregistered');
    };

    /**
     * English comment.
     */
    const normalizeKey = (key) => {
        return key
            .toLowerCase()
            .split('+')
            .map((k) => k.trim())
            .sort()
            .join('+');
    };

    /**
     * English comment.
     */
    const getKeyFromEvent = (event) => {
        const keys = [];

        if (event.ctrlKey || event.metaKey) keys.push('ctrl');
        if (event.shiftKey) keys.push('shift');
        if (event.altKey) keys.push('alt');

        // English comment.
        const mainKey = event.key.toLowerCase();
        if (mainKey !== 'control' && mainKey !== 'shift' && mainKey !== 'alt' && mainKey !== 'meta') {
            keys.push(mainKey);
        }

        return keys.sort().join('+');
    };

    /**
     * English comment.
     */
    const handleKeyDown = (event) => {
        // English comment.
        const target = event.target;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // English comment.
            const key = getKeyFromEvent(event);
            if (key !== 'ctrl+s') {
                return;
            }
        }

        const key = getKeyFromEvent(event);
        const shortcut = shortcuts.get(key);

        if (shortcut) {
            if (shortcut.preventDefault) {
                event.preventDefault();
            }
            shortcut.handler(event);
        }
    };

    /**
     * English comment.
     */
    const start = () => {
        window.addEventListener('keydown', handleKeyDown);
        console.log('[Keyboard] Keyboard shortcuts started');
    };

    /**
     * English comment.
     */
    const stop = () => {
        window.removeEventListener('keydown', handleKeyDown);
        console.log('[Keyboard] Keyboard shortcuts stopped');
    };

    /**
     * English comment.
     */
    const getShortcuts = () => {
        return Array.from(shortcuts.entries()).map(([key, value]) => ({
            key,
            description: value.description
        }));
    };

    // English comment.
    onMounted(() => {
        start();
    });

    onUnmounted(() => {
        stop();
    });

    return {
        register,
        unregister,
        unregisterAll,
        start,
        stop,
        getShortcuts
    };
}

/**
 * English comment.
 */
export const SHORTCUTS = {
    UNDO: 'ctrl+z',
    REDO: 'ctrl+y',
    SAVE: 'ctrl+s',
    DELETE: 'delete',
    COPY: 'ctrl+c',
    PASTE: 'ctrl+v',
    SELECT_ALL: 'ctrl+a',
    DESELECT: 'escape'
};

