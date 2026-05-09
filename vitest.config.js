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
        // 测试环境
        environment: 'jsdom',

        // 覆盖率
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

        // 全局变量
        globals: true,

        // 测试文件匹配
        include: ['packages/**/*.{test,spec}.{js,ts}'],

        // 超时时间
        testTimeout: 10000,

        // 并发
        threads: true,

        // 监听模式
        watch: false
    }
});

