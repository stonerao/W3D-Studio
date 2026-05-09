import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.js'),
            name: 'W3D',
            formats: ['es', 'umd'],
            fileName: (format) => `w3d-core.${format}.js`
        },
        rollupOptions: {
            // English comment.
            external: ['three', /^three\//, '@w3d/utils'],
            output: {
                // English comment.
                globals: {
                    three: 'THREE',
                    '@w3d/utils': 'W3DUtils',
                    'three/examples/jsm/controls/OrbitControls.js': 'THREE.OrbitControls',
                    'three/examples/jsm/loaders/GLTFLoader.js': 'THREE.GLTFLoader',
                    'three/examples/jsm/loaders/DRACOLoader.js': 'THREE.DRACOLoader'
                },
                // English comment.
                exports: 'named',
                // English comment.
                manualChunks: undefined
            }
        },
        // English comment.
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        },
        // sourcemap
        sourcemap: true,
        // English comment.
        target: 'es2015',
        // English comment.
        emptyOutDir: true
    },
    // English comment.
    server: {
        port: 3000,
        open: true
    },
    // English comment.
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@w3d/utils': path.resolve(__dirname, '../utils/src')
        }
    }
});
