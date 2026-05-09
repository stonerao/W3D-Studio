/*
 * @Date: 2025-11-07 13:42:04
 * @LastEditors: stonerao 674656681@qq.com
 * @LastEditTime: 2025-12-30 00:22:54
 * @FilePath: \sdk\packages\editor\vite.config.js
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    // English comment.
    plugins: [vue()],

    // English comment.
    server: {
        port: 5174,
        host: '0.0.0.0',
        open: false,
        cors: true,
        strictPort: false,
        proxy: {
            '/api/ai': {
                target: process.env.VITE_AI_GATEWAY_URL || 'http://localhost:8787',
                changeOrigin: true
            }
        },
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp'
        },
        // English comment.
        fs: {
            allow: ['..', '../..']
        }
    },

    // English comment.
    preview: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp'
        }
    },

    publicDir: path.resolve(__dirname, 'public'),

    // English comment.
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three';
            if (id.includes('node_modules') && (id.includes('/vue/') || id.includes('vue-router') || id.includes('/pinia/'))) return 'vue';
                    if (id.includes('/packages/core/') || id.includes('/packages/components/') || id.includes('/packages/utils/')) return 'w3d';
                    if (id.includes('/src/components/layout/')) return 'editor-layout';
                    if (id.includes('/src/components/panels/')) return 'editor-panels';
                    if (id.includes('/src/views/Preview.vue') || id.includes('/src/composables/usePreviewScene.js')) return 'preview';
                    return undefined;
                }
            }
        },
        minify: 'terser',
        chunkSizeWarningLimit: 1000
    },

    // English comment.
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@w3d/core': path.resolve(__dirname, '../core/src'),
            '@w3d/components': path.resolve(__dirname, '../components/src'),
            '@w3d/utils': path.resolve(__dirname, '../utils/src')
        }
    },

    // English comment.
    optimizeDeps: {
        include: ['three', 'vue', 'vue-router', 'pinia'],
        exclude: [
            '@w3d/core',
            '@w3d/components',
            '@w3d/utils',
            'troika-three-text',
            'troika-three-utils'
        ]
    }
});

