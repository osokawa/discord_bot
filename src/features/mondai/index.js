const { Attachment } = require('discord.js')
const { execFile } = require('child_process')
const os = require('os')
const fs = require('fs').promises
const path = require('path')
const utils = require('../../utils.js')
const TOML = require('@iarna/toml')

function generateMondaiImage(mode, inPath, outPath, opts = {}) {
	const optArgs = []
	for (const key of Object.keys(opts)) {
		optArgs.push(`-${key}`)
		optArgs.push(opts[key])
	}

	return new Promise((resolve, reject) => {
		execFile('./tools/mondai.rb', [...optArgs, mode, inPath, outPath], (error, stdout, stderr) => {
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

class Mondai {
	constructor(feature) {
		this.feature = feature
		this.state = 'free'
		this.answer = null
	}

	async _processMondaiCommand(args, msg) {
		if (this.state !== 'free') {
			msg.channel.send('前回の問題にまだ正解していないみたい。わからないなら降参してね')
			return
		}

		const validModes =
			this.feature.config.options.type === 'music'
			? ['music', 'intro']
			: ['image', 'mosaic', 'audio']
		const audioModes = ['audio', 'music', 'intro']

		let mode = validModes[0]
		if (1 <= args.length) {
			if (validModes.includes(args[0])) {
				mode = args[0]
			} else {
				msg.channel.send('知らないモードだなあ…')
				return
			}
		}

		this.state = 'waitingAnswer'

		const episode = utils.randomPick(this.feature.config.episodes)

		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mondai-'))
		let outputPath
		if (audioModes.includes(mode)) {
			outputPath = path.join(tmpDir, 'audio.mp3')
		} else {
			outputPath = path.join(tmpDir, 'image.jpg')
		}

		const mosaicOriginalPath = path.join(tmpDir, 'original.jpg')
		const options = {}
		if (mode === 'mosaic') {
			options.o = mosaicOriginalPath
		}
		if (episode.excludeRange) {
			options.r = episode.excludeRange
		}

		const generateResult = await generateMondaiImage(mode, episode.filename, outputPath, options)
		this.answer = {
			title: episode.title,
			pattern: episode.pattern,
			time: generateResult.time,
			mode,
			tmpDir
		}

		const attachment = new Attachment(outputPath)
		msg.channel.send(`問題です`, attachment)
	}

	async _processAnswerMessage(msg) {
		const text = msg.content
		const ans = this.answer

		// 正解
		if (text.match(new RegExp(ans.pattern, 'i'))) {
			if (ans.mode === 'mosaic') {
				const attachment = new Attachment(path.join(ans.tmpDir, 'original.jpg'))
				msg.channel.send(`:ok_hand: 正解! **${ans.title}**です! ちなみに再生時間は${ans.time}だよ`
					+ "\nオリジナルの画像はこちら", attachment)
			} else {
				msg.channel.send(`:ok_hand: 正解! **${ans.title}**です! ちなみに再生時間は${ans.time}だよ`)
			}
			await fs.rmdir(ans.tmpDir, { recursive: true })
			this.state = 'free'
			return
		}

		// 降参
		if (text.match(new RegExp(this.feature.config.options.surrenderPattern, 'i'))) {
			msg.channel.send(`情けない子… 正解は**${ans.title}**で再生時間は${ans.time}だよ\n出直しておいで!`)
			await fs.rmdir(ans.tmpDir, { recursive: true })
			this.state = 'free'
			return
		}

		// 不正解
		for (const episode of this.feature.config.episodes) {
			if (text.match(new RegExp(episode.pattern, 'i'))) {
				msg.channel.send(':no_entry_sign: 不正解。もうちょっと頑張るか降参してね')
				return
			}
		}
	}

	async onMessage(msg) {
		if (msg.author.bot) {
			return
		}

		const command = utils.parseCommand(msg.content)
		if (command && command.commandName === this.feature.cmdname) {
			await this._processMondaiCommand(command.args, msg)
			return
		}

		if (this.state === 'waitingAnswer') {
			await this._processAnswerMessage(msg)
		}
	}
}

module.exports = class {
	constructor(cmdname, configPath) {
		this.cmdname = cmdname
		this.configPath = configPath
		this.config = null
	}

	async init() {
		const toml = await fs.readFile(this.configPath, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.config = parsed
	}

	async finalize() {
	}

	createChannelInstance(channel) {
		return new Mondai(this, channel)
	}
}
