const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
	target: 'node',
	externals: [nodeExternals()],
	entry: './src/index.ts',
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist')
	},
	module: {
		rules: [
			{
				enforce: 'pre',
				test: /\.(ts|js)$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
			},
			{
				test: /\.ts$/,
				loader: 'ts-loader'
			}
		]
	},
	resolve: {
		extensions: ['.wasm', '.ts', '.mjs', '.js', '.json']
	}
}
