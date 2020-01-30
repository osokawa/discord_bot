const { Attachment } = require('discord.js')
const { execFile } = require('child_process')
const os = require('os')
const fs = require('fs').promises
const path = require('path')
const utils = require('../../utils.js')

function generateMondaiImage(mode, inPath, outPath, opts = {}) {
	const optArgs = []
	for (const key of Object.keys(opts)) {
		optArgs.push(`-${key}`)
		optArgs.push(opts[key])
	}

	return new Promise((resolve, reject) => {
		execFile('./tools/mondai.rb', [...optArgs, mode, inPath, outPath], (error, stdout) => {
			if (error) {
				reject(error)
			}
			try {
				resolve(JSON.parse(stdout))
			} catch (e) {
				reject(e)
			}
		})
	})
}

function normalizeAnswerMessage(message) {
	const replaceTables = [
		[/\s+/g, ' '],
	]
	const replaced = replaceTables.reduce((a, i) => a.replace(i[0], i[1]), message)
	return replaced.normalize('NFKC')
}

module.exports = class {
	#gc

	constructor(channelInstance, gc, mode, options) {
		this.channelInstance = channelInstance
		this.#gc = gc
		this.feature = channelInstance.feature

		this.mode = mode
		this.options = options
		this.answer = null
		this.incorrectCount = 0
		this.correctCount = 0
		this.incorrectLimit = 3
		this.ready = false
	}

	get _isAudioMode() {
		const audioModes = ['audio', 'music', 'intro']
		return audioModes.includes(this.mode)
	}

	get _isMosaicMode() {
		return this.mode === 'mosaic'
	}

	async _postMondai() {
		this.ready = false

		const episode = utils.randomPick(this.feature.config.episodes)
		this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mondai-'))

		let outputPath

		if (this._isAudioMode) {
			outputPath = path.join(this.tmpDir, 'audio.mp3')
		} else {
			outputPath = path.join(this.tmpDir, 'image.jpg')
		}

		const mosaicOriginalPath = path.join(this.tmpDir, 'original.jpg')
		const options = {}
		if (this._isMosaicMode) {
			options.o = mosaicOriginalPath
		}
		if (episode.excludeRange) {
			options.r = episode.excludeRange
		}

		try {
			const generateResult = await generateMondaiImage(this.mode, episode.filename, outputPath, options)
			this.answer = {
				title: episode.title,
				pattern: episode.pattern,
				time: generateResult.time,
			}
		} catch (e) {
			// TODO: 特別なエラー型にラップする
			throw e
		}

		this.ready = true
		const attachment = new Attachment(outputPath)
		await this.#gc.sendToChannel(this.channelInstance.channel, 'mondai.sendMondaiImage', {}, { files: [attachment] })
	}

	async init() {
		await this._postMondai()
	}

	async _postResultMessage(msg, key, ans, title) {
		const options = {}
		if (this._isMosaicMode) {
			options.files = [new Attachment(path.join(this.tmpDir, 'original.jpg'))]
		}

		await this.#gc.send(
			msg,
			'mondai.answer.' + key,
			{ title, time: ans.time, mosaic: this._isMosaicMode },
			options)
	}

	async _processAnswerMessage(msg) {
		const text = normalizeAnswerMessage(msg.content)
		const ans = this.answer
		const title = utils.replaceEmoji(ans.title, msg.guild.emojis)

		// 正解
		const correctMatch = text.match(new RegExp(ans.pattern, 'i'))
		if (correctMatch && correctMatch[0] === text) {
			await this._postResultMessage(msg, 'correct', ans, title)

			if (this.options.repeat) {
				this.correctCount++
				await this._postMondai()
				return true
			}

			return false
		}

		// 降参
		if (text.match(new RegExp(this.feature.config.options.surrenderPattern, 'i'))) {
			this.incorrectCount++
			if (this.options.repeat && this.incorrectCount == this.incorrectLimit) {
				await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
				return false
			}

			await this._postResultMessage(msg, 'surrender', ans, title)

			if (this.options.repeat) {
				await this._postMondai()
				return true
			}

			return false
		}

		// 不正解
		for (const episode of this.feature.config.episodes) {
			const incorrectMatch = text.match(new RegExp(episode.pattern, 'i'))
			if (incorrectMatch && incorrectMatch[0] === text) {
				this.incorrectCount++
				if (this.incorrectCount == this.incorrectLimit) {
					await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
					return false
				}

				await this.#gc.send(msg, 'mondai.answer.incorrect')
				return true
			}
		}

		return true
	}

	// true なら続行
	async onMessage(msg) {
		if (msg.author.bot || !this.ready) {
			return true
		}

		return await this._processAnswerMessage(msg)
	}

	async finalize() {
		if (this.options.repeat) {
			await this.#gc.sendToChannel(this.channelInstance.channel, 'mondai.repeatResult', { correctCount: this.correctCount })
		}

		await fs.rmdir(this.tmpDir, { recursive: true })
	}
}
