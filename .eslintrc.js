module.exports = {
	'env': {
		'commonjs': true,
		'es6': true,
		'node': true
	},
	'plugins': ['jest'],
	'extends': [
		'eslint:recommended',
		'plugin:jest/recommended',
		'plugin:jest/style'
	],
	'globals': {
		'Atomics': 'readonly',
		'SharedArrayBuffer': 'readonly'
	},
	'parserOptions': {
		'ecmaVersion': 2018
	},
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
		]
	}
}
