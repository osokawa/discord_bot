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
	constructor(channelInstance, mode, options) {
		this.channelInstance = channelInstance
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
		this.channelInstance.channel.send('問題ロボ。頑張るロボ!', attachment)
	}

	async init() {
		await this._postMondai()
	}

	async _postIncorrectLimitMessage(msg, ans, title) {
		if (this._isMosaicMode) {
			const attachment = new Attachment(path.join(this.tmpDir, 'original.jpg'))
			msg.channel.send(`:no_entry_sign: 間違えすぎロボよ… 正解は**${title}**で再生時間は${ans.time}ロボ\nでもモザイクだからしょうがないロボね`
				+ '\nオリジナルの画像はこれだロボ', attachment)
		} else {
			msg.channel.send(`:no_entry_sign: 間違えすぎロボよ…正解は**${title}**で再生時間は${ans.time}ロボ\n出直してくるロボ!`)
		}
	}

	async _processAnswerMessage(msg) {
		const text = normalizeAnswerMessage(msg.content)
		const ans = this.answer
		const title = utils.replaceEmoji(ans.title, msg.guild.emojis)

		// 正解
		const correctMatch = text.match(new RegExp(ans.pattern, 'i'))
		if (correctMatch && correctMatch[0] === text) {
			if (this._isMosaicMode) {
				const attachment = new Attachment(path.join(this.tmpDir, 'original.jpg'))
				msg.channel.send(`:ok_hand: 正解ロボ! **${title}** ちなみに再生時間は${ans.time}だロボよ`
					+ '\nオリジナルの画像はこれロボ。よく頑張ったロボ!', attachment)
			} else {
				msg.channel.send(`:ok_hand: 正解ロボ! **${title}** ちなみに再生時間は${ans.time}だロボよ`)
			}

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
				await this._postIncorrectLimitMessage(msg, ans, title)
				return false
			}

			if (this._isMosaicMode) {
				const attachment = new Attachment(path.join(this.tmpDir, 'original.jpg'))
				msg.channel.send(`情けない子…ロボ! 正解は**${title}**で再生時間は${ans.time}ロボよ\nモザイクは難しいロボね`
					+ '\nオリジナルの画像はこれだロボ', attachment)
			} else {
				msg.channel.send(`情けない子…ロボ! 正解は**${title}**で再生時間は${ans.time}ロボ\n出直すロボ!`)
			}

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
					await this._postIncorrectLimitMessage(msg, ans, title)
					return false
				}

				msg.channel.send(':no_entry_sign: 不正解。もうちょっと頑張るか降参するロボ')
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
			let comment = ''
			if (this.correctCount === 0) {
				comment = '0回とかありえないロボ… どうして始めたロボ?'
			} else if (this.correctCount < 5) {
				comment = 'もうちょっと頑張るロボ…'
			} else if (this.correctCount < 10) {
				comment = 'なかなかやるロボね'
			} else if (this.correctCount < 20) {
				comment = 'かなりすごいロボね!'
			} else if (this.correctCount < 50) {
				comment = '超スゴイロボ!!'
			} else {
				comment = '本当に人間ロボ? ロボットじゃないかロボ?!'
			}
			this.channelInstance.channel.send(`お疲れさまロボ。合計正解数は${this.correctCount}回ロボよ!\n${comment}`)
		}

		await fs.rmdir(this.tmpDir, { recursive: true })
	}
}
