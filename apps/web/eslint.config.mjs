import { defineConfig } from 'eslint/config';
import nextPlugin from '@next/eslint-plugin-next';
import base from '../../packages/config/eslint/base.config.mjs';

export default defineConfig([
  ...base,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'next-env.d.ts'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'warn',
    },
  },
]);
