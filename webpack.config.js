const path = require('path')
const nodeExternals = require('webpack-node-externals')

module.exports = {
	mode: 'development',
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
				test: /\.ts$/,
				loader: 'ts-loader'
			}
		]
	},
	resolve: {
		extensions: ['.wasm', '.ts', '.mjs', '.js', '.json']
	}
}
