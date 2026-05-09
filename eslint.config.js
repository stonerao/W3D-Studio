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

                // Browser / Web APIs (用于 editor-w3d 与 core 在浏览器环境运行)
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
            // 代码风格（交给 Prettier；避免与既有代码风格不一致导致海量报错）
            'indent': 'off',
            'quotes': 'off',
            'semi': 'off',
            'comma-dangle': 'off',
            'arrow-spacing': 'off',
            'no-multiple-empty-lines': 'off',
            'eol-last': 'off',

            // 最佳实践
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

            // 其他
            // (保持为空，避免重复引入格式规则)
        }
    },
    {
        files: [
            'packages/editor-w3d/**/*.js',
            'packages/core/**/*.js',
            'packages/components/**/*.js'
        ],
        rules: {
            // 这些包大量使用 console 进行开发期输出；不强制改代码时，避免产生大量警告
            'no-console': 'off'
        }
    },
    {
        files: ['packages/components/src/**/*.js'],
        rules: {
            // components 里存在较多历史 switch-case 写法与空块；不作为 lint 阻断项
            'no-empty': 'off',
            'no-case-declarations': 'off'
        }
    },
    {
        files: ['packages/**/*.js']
    }
];
