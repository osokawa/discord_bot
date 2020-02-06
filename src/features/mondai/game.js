const { Attachment } = require('discord.js')
const { execFile } = require('child_process')
const os = require('os')
const fs = require('fs').promises
const path = require('path')
const utils = require('../../utils.js')
const { generateImageMap } = require('./image-map.js')

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
	#incorrectImageLog = []

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
		if (options.hasOwnProperty('life')) {
			this.incorrectLimit = options.life
		}
		this.processing = false
	}

	get _isAudioMode() {
		const audioModes = ['audio', 'music', 'intro']
		return audioModes.includes(this.mode)
	}

	get _isMosaicMode() {
		return this.mode === 'mosaic'
	}

	_getTmpPath(filename) {
		return path.join(this.tmpDir, filename)
	}

	async _postMondai() {
		const episode = utils.randomPick(this.feature.config.episodes)
		const outputPath = this._getTmpPath(this._isAudioMode ? 'audio.mp3' : 'image.jpg')
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

		const attachment = new Attachment(outputPath)
		await this.#gc.sendToChannel(this.channelInstance.channel, 'mondai.sendMondaiImage', {}, { files: [attachment] })
	}

	async init() {
		this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mondai-'))
		this.processing = true
		await this._postMondai()
		this.processing = false
	}

	async _postResultMessage(msg, key, ans, title) {
		const options = {}
		if (this._isMosaicMode) {
			options.files = [new Attachment(this._getTmpPath('original.jpg'))]
		}

		await this.#gc.send(
			msg,
			'mondai.answer.' + key,
			{ title, time: ans.time, mosaic: this._isMosaicMode },
			options)
	}

	async _pushIncorrectImageLog() {
		if (!this._isAudioMode && this.options.repeat) {
			const filename = this._getTmpPath(`incorrect${this.incorrectCount}.jpg`)
			await fs.copyFile(this._getTmpPath('image.jpg'), filename)
			this.#incorrectImageLog.push({ filename, answer: this.answer })
		}
	}

	async _processAnswerMessage(msg) {
		const text = normalizeAnswerMessage(msg.content)
		const ans = this.answer
		const title = ans.title

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
			this._pushIncorrectImageLog()

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
					this._pushIncorrectImageLog()
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
		if (msg.author.bot || this.processing) {
			return true
		}

		this.processing = true
		const res = await this._processAnswerMessage(msg)
		this.processing = false
		return res
	}

	async finalize() {
		if (this.options.repeat) {
			await this.#gc.sendToChannel(this.channelInstance.channel, 'mondai.repeatResult', { correctCount: this.correctCount })
			if (!this._isAudioMode && 10 <= this.correctCount) {
				const buf = await generateImageMap(1920, 1080, this.#incorrectImageLog.map(x => x.filename))
				await this.#gc.sendToChannel(
					this.channelInstance.channel,
					'mondai.incorrectImageMap',
					{ answers: this.#incorrectImageLog.map(x => x.answer) },
					{ files: [new Attachment(buf, 'image.jpg')] })
			}
		}

		await fs.rmdir(this.tmpDir, { recursive: true })
	}
}
