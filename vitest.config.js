import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'packages/vfd/src')
        }
    },
    test: {
        // English comment.
        environment: 'jsdom',

        // English comment.
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.spec.js',
                '**/*.test.js',
                '**/*.spec.ts',
                '**/*.test.ts',
                '**/scripts/**'
            ]
        },

        // English comment.
        globals: true,

        // English comment.
        include: ['packages/**/*.{test,spec}.{js,ts}'],

        // English comment.
        testTimeout: 10000,

        // English comment.
        threads: true,

        // English comment.
        watch: false
    }
});

