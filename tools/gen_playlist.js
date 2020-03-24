const TOML = require('@iarna/toml')
const fs = require('fs')
const path = require('path')
const mm = require('music-metadata')

function getTitle(filepath) {
	const filename = path.basename(filepath, path.extname(filepath))

	const match = /^\d\d\. ?(.+)$/.exec(filename)
	if (match) {
		return match[1]
	}

	return filename
}

async function main() {
	const stdinBuffer = fs.readFileSync(0, 'utf-8')

	const musics = []

	for (const line of stdinBuffer.split('\n')) {
		if (line === '') { break }

		const metadata = {
			title: getTitle(line)
		}

		const music = {
			path: line,
			metadata
		}

		console.error(`parsing metadata...: ${line}`)
		try {
			const { common } = await mm.parseFile(line, { skipCovers: true })

			if (common.title) {
				metadata.title = common.title
			}

			metadata.album = common.album
			metadata.artist = common.artist
			metadata.track = common.track
			metadata.disk = common.disk
		} catch (e) {
			console.error(`failed to parse metadata: ${line}`)
		}

		musics.push(music)
	}

	console.log(TOML.stringify({musics}))
}

main()
