import css from '@eslint/css';
import js from '@eslint/js';
import markdown from '@eslint/markdown';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default defineConfig([
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    extends: ['css/recommended'],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        Log: 'readonly',
        Module: 'readonly',
      },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,

      'prettier/prettier': 'warn',
    },
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
  },
]);
