/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.git/**', 'public/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-console': 'warn',
      'no-debugger': 'warn',
    },
  },
]
