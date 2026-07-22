// CommonJS flat config. Only real-bug rules are enabled — `index.js` and
// `pipeline.js` have never been linted, so stylistic rules would produce
// hundreds of unrelated warnings and drown out anything that matters.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Turn off stylistic/opinionated rules from "recommended" that don't
      // indicate a real bug — keep only correctness rules. `caughtErrors:
      // 'none'` because catch-and-fall-back-without-using-the-error is an
      // established, intentional pattern throughout this codebase.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
