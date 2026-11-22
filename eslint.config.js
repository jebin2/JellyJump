// ESLint: the rules the code of conduct asks for that a linter can check.
// Run by `npm run quality` (so by npm test and CI). The layer rule and the
// ratchets live in scripts/architecture-check.mjs.
import globals from 'globals';

export default [
    {
        ignores: ['assets/js/lib/**', 'dist/**', 'desktop/**', 'node_modules/**', 'public/**'],
    },
    {
        files: ['assets/js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.worker },
        },
        rules: {
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-empty': ['error', { allowEmptyCatch: false }],
            'no-alert': 'error',
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
            'no-undef': 'error',
            'no-var': 'error',
            'prefer-const': ['error', { destructuring: 'all' }],
            // Values go into HTML through the html`` template (shared/utils/html.js).
            'no-restricted-syntax': ['error', {
                selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/] > TemplateLiteral.right[expressions.length>0]",
                message: 'Put values into HTML with the html`` template (shared/utils/html.js), which escapes them.',
            }, {
                selector: "CallExpression[callee.property.name='insertAdjacentHTML'] > TemplateLiteral[expressions.length>0]",
                message: 'Put values into HTML with the html`` template (shared/utils/html.js), which escapes them.',
            }],
        },
    },
];
