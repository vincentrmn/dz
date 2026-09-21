// Lint du cockpit : règles recommandées d'ESLint, sans style. Le serveur est du
// CommonJS Node, le front du navigateur, les scripts n8n des modules ES.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'data/**', '.verif/**'] },
  js.configs.recommended,
  {
    // Code existant, éprouvé en prod : on ne le retouche pas pour des nuances de
    // style. Les erreurs attrapées sans être lues et les catch vides sont voulus
    // (nœuds n8n et navigateur tolérants), les échappements superflus inoffensifs.
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['server.js', 'auth.js', 'tests/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
];
