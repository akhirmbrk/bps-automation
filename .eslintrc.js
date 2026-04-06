module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  overrides: [
    {
      files: ['background.js', 'content/*.js'],
      env: { browser: true, webextensions: true }
    },
    {
      files: ['src/**/*.js'],
      env: { browser: true, es2021: true, webextensions: true }
    }
  ],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'curly': ['error', 'all'],
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-proto': 'error',
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 0 }],
    'semi': ['error', 'always'],
    'indent': ['warn', 2, { SwitchCase: 1 }],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'comma-dangle': ['warn', 'never'],
    'object-curly-spacing': ['warn', 'always'],
    'array-bracket-spacing': ['warn', 'never']
  }
};