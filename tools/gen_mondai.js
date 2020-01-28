const TOML = require('@iarna/toml')
const fs = require('fs')
const path = require('path')

function escapeRegExp(message) {
	const replaceTables = [
		['\\', '\\\\'],
		['*', '\\*'],
		['+', '\\+'],
		['?', '\\?'],
		['{', '\\{'],
		['}', '\\}'],
		['(', '\\('],
		[')', '\\)'],
		['[', '\\['],
		[']', '\\]'],
		['^', '\\^'],
		['$', '\\$'],
		['-', '\\-'],
		['|', '\\|'],
	]
	return replaceTables.reduce((a, i) => a.replace(i[0], i[1]), message)
}

function normalizeAnswerMessage(message) {
	const replaceTables = [
		[/\s+/g, ' '],
	]
	const replaced = replaceTables.reduce((a, i) => a.replace(i[0], i[1]), message)
	return replaced.normalize('NFKC')
}

const stdinBuffer = fs.readFileSync(0, 'utf-8');

const episodes = []

for (const line of stdinBuffer.split('\n')) {
	title = path.basename(line, path.extname(line))
	if (line === '') { break }
	episodes.push({
		filename: line,
		title,
		pattern: escapeRegExp(normalizeAnswerMessage(title))
	})
}

console.log(TOML.stringify({episodes}))
