const TOML = require('@iarna/toml')
const fs = require('fs')
const path = require('path')

function getTitle(filepath) {
	const filename = path.basename(filepath, path.extname(filepath))

	const match = /^\d\d\. ?(.+)$/.exec(filename)
	if (match) {
		return match[1]
	}

	return filename
}

const stdinBuffer = fs.readFileSync(0, 'utf-8');

const musics = []

for (const line of stdinBuffer.split('\n')) {
	if (line === '') { break }
	musics.push({
		path: line,
		title: getTitle(line)
	})
}

console.log(TOML.stringify({musics}))
