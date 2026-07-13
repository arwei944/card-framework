const js = require('@eslint/js');

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  queueMicrotask: 'readonly',
  performance: 'readonly',
  globalThis: 'readonly',
  HTMLElement: 'readonly',
  Element: 'readonly',
  customElements: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  getComputedStyle: 'readonly',
  URL: 'readonly',
  Node: 'readonly',
  CSS: 'readonly',
  confirm: 'readonly',
  alert: 'readonly',
  prompt: 'readonly',
  WeakSet: 'readonly',
  WeakMap: 'readonly',
  XMLHttpRequest: 'readonly',
  WebSocket: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  fetch: 'readonly',
};

const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
};

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-cond-assign': ['error', 'except-parens'],
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-fallthrough': 'off',
    },
  },
  {
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },
];
