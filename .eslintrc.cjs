module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  plugins: [
    'jsx-a11y',
    'react',
    'react-hooks',
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    // 'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  env: {
    node: true,
    browser: true,
  },
  settings: {
    react: {
      pragma: 'React',
      version: 'detect',
    },
  },
  parserOptions: {
    project: 'tsconfig.json',
  },
  rules: {
    '@typescript-eslint/require-await': 'warn',
    'arrow-parens': ['error', 'as-needed'],
    'indent': ['error', 2, { flatTernaryExpressions: true }],
    'no-nested-ternary': 'off',
    'no-unexpected-multiline': 'error',
    'no-unused-vars': 'off',
    'no-unused-vars': 'off',
    'object-curly-newline': 'off',
    'quote-props': ['error', 'consistent-as-needed'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
    'valid-jsdoc': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
}
