import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';

/**
 * English comment.
 */
export const useHistoryStore = defineStore('history', () => {
    // English comment.

    // English comment.
    const undoStack = shallowRef([]);

    // English comment.
    const redoStack = shallowRef([]);

    // English comment.
    const maxHistorySize = ref(50);

    // English comment.
    const isExecuting = ref(false);

    // English comment.

    // English comment.
    const canUndo = computed(() => undoStack.value.length > 0);

    // English comment.
    const canRedo = computed(() => redoStack.value.length > 0);

    // English comment.
    const historyCount = computed(() => undoStack.value.length);

    // English comment.

    /**
     * English comment.
     */
    const executeCommand = async (command) => {
        if (isExecuting.value) return;

        try {
            isExecuting.value = true;

            // English comment.
            await command.execute();

            // English comment.
            undoStack.value = [...undoStack.value, command];

            // English comment.
            if (undoStack.value.length > maxHistorySize.value) {
                undoStack.value = undoStack.value.slice(1);
            }

            // English comment.
            redoStack.value = [];

        } catch (error) {
            console.error('[History] Failed to execute command:', error);
            throw error;
        } finally {
            isExecuting.value = false;
        }
    };

    /**
     * English comment.
     */
    const undo = async () => {
        if (!canUndo.value || isExecuting.value) return;

        try {
            isExecuting.value = true;

            // English comment.
            const command = undoStack.value[undoStack.value.length - 1];
            undoStack.value = undoStack.value.slice(0, -1);

            // English comment.
            await command.undo();

            // English comment.
            redoStack.value = [...redoStack.value, command];

        } catch (error) {
            console.error('[History] Failed to undo:', error);
            throw error;
        } finally {
            isExecuting.value = false;
        }
    };

    /**
     * English comment.
     */
    const redo = async () => {
        if (!canRedo.value || isExecuting.value) return;

        try {
            isExecuting.value = true;

            // English comment.
            const command = redoStack.value[redoStack.value.length - 1];
            redoStack.value = redoStack.value.slice(0, -1);

            // English comment.
            await command.execute();

            // English comment.
            undoStack.value = [...undoStack.value, command];

        } catch (error) {
            console.error('[History] Failed to redo:', error);
            throw error;
        } finally {
            isExecuting.value = false;
        }
    };

    /**
     * English comment.
     */
    const clear = () => {
        undoStack.value = [];
        redoStack.value = [];
    };

    /**
     * English comment.
     */
    const getHistory = () => {
        return {
            undo: undoStack.value.map((cmd) => cmd.name),
            redo: redoStack.value.map((cmd) => cmd.name)
        };
    };

    // English comment.

    return {
        // English comment.
        undoStack,
        redoStack,
        maxHistorySize,
        isExecuting,

        // English comment.
        canUndo,
        canRedo,
        historyCount,

        // English comment.
        executeCommand,
        undo,
        redo,
        clear,
        getHistory
    };
});

