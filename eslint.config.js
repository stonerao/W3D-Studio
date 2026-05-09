import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/demo/**'
        ]
    },
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',

                // English comment.
                fetch: 'readonly',
                URLSearchParams: 'readonly',
                URL: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                Blob: 'readonly',
                Image: 'readonly',
                TextDecoder: 'readonly',
                performance: 'readonly',
                indexedDB: 'readonly',
                AbortController: 'readonly',

                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly'
            }
        },
        rules: {
            // English comment.
            'indent': 'off',
            'quotes': 'off',
            'semi': 'off',
            'comma-dangle': 'off',
            'arrow-spacing': 'off',
            'no-multiple-empty-lines': 'off',
            'eol-last': 'off',

            // English comment.
            'no-console': 'warn',
            'no-debugger': 'warn',
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],

            // ES6
            'prefer-const': 'error',
            'prefer-arrow-callback': 'warn',
            'no-var': 'error',

            // English comment.
            // English comment.
        }
    },
    {
        files: [
            'packages/editor-w3d/**/*.js',
            'packages/core/**/*.js',
            'packages/components/**/*.js'
        ],
        rules: {
            // English comment.
            'no-console': 'off'
        }
    },
    {
        files: ['packages/components/src/**/*.js'],
        rules: {
            // English comment.
            'no-empty': 'off',
            'no-case-declarations': 'off'
        }
    },
    {
        files: ['packages/**/*.js']
    }
];
