module.exports = {
	'env': {
		'es6': true,
		'node': true
	},
	'extends': [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
		'plugin:jest/recommended',
		'plugin:jest/style'
	],
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly'
	},
	'parser': '@typescript-eslint/parser',
	'parserOptions': {
		'ecmaVersion': 2018,
		'sourceType': 'module',
		'project': './tsconfig.json'
	},
	'plugins': [
		'@typescript-eslint',
		'jest'
	],
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'never'
		],
		'@typescript-eslint/member-delimiter-style': ['error', {
			'multiline': {
				'delimiter': 'none'
			}
		}],
		'@typescript-eslint/require-await': 'warn'
	}
}
