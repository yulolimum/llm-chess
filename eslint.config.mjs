import jseslint from '@eslint/js'
import pluginPrettier from 'eslint-plugin-prettier/recommended'
import pluginImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // global settings
  {
    ignores: ['.context/**'],
  },

  // global base
  jseslint.configs.recommended,
  tseslint.configs.recommended,

  // global plugins
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: {
      'simple-import-sort': pluginImportSort,
    },
    rules: {
      // js
      'object-shorthand': 'error',
      'no-unused-vars': 'off',
      // ts
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
        },
      ],
      // imports
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [['^.*\\u0000$'], ['^@?\\w'], ['^\\.']],
        },
      ],
    },
  },

  pluginPrettier,
)
