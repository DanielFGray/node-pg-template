/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    node: true,
    browser: true,
    commonjs: true,
    es6: true,
  },

  ignorePatterns: ['./dist/*', './node_modules/'],
  // Base config
  overrides: [
    // base
    {
      files: ['**/*.{js,ts,jsx,tsx,cjs,mjs}'],
      extends: ['eslint:recommended'],
    },

    // React
    {
      files: ['**/*.{jsx,tsx}'],
      plugins: ['react', 'jsx-a11y'],
      extends: [
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
      ],
      settings: {
        react: {
          version: 'detect',
        },
        linkComponents: [
          { name: 'Link', linkAttribute: 'to' },
          { name: 'NavLink', linkAttribute: 'to' },
        ],
      },
    },

    // TypeScript
    {
      files: ['**/*.{ts,tsx}'],
      plugins: ['@typescript-eslint'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended', 'plugin:import/typescript'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },

    // Cypress
    {
      files: ['./cypress/**/*.{js,ts}'],
      plugins: ['cypress'],
      extends: ['plugin:cypress/recommended'],
    },
  ],

  rules: {
    'no-unexpected-multiline': 'error',
    'no-unused-vars': 'warn',
    'valid-jsdoc': 'warn',
    'no-console': 'warn',
  },
}
