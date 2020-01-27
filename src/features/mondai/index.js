const fs = require('fs').promises
const utils = require('../../utils.js')
const TOML = require('@iarna/toml')
const Game = require('./game.js')

class Mondai {
	constructor(feature, channel) {
		this.feature = feature
		this.channel = channel
		this.game = null
	}

	async _processMondaiCommand(rawArgs, msg) {
		if (this.game !== null) {
			msg.channel.send('前回の問題がまだ進行中みたいロボ')
			return
		}

		let args, options
		try {
			({ args, options } = utils.parseCommandArgs(rawArgs))
		} catch (e) {
			msg.channel.send(`変なコマンドを指定していないかロボ?: ${e}`)
			return
		}

		const validModes = this.feature.config.options.type === 'music'
			? ['music', 'intro']
			: ['image', 'mosaic', 'audio']

		let mode = validModes[0]
		if (1 <= args.length) {
			if (validModes.includes(args[0])) {
				mode = args[0]
			} else {
				msg.channel.send('知らないモードロボねぇ…')
				return
			}
		}

		try {
			this.game = new Game(this, mode, options)
			await this.game.init(msg)
		} catch (e) {
			this.game = null
			throw e
		}
	}

	async onMessage(msg) {
		if (!msg.author.bot) {
			const command = utils.parseCommand(msg.content)
			if (command && command.commandName === this.feature.cmdname) {
				await this._processMondaiCommand(command.args, msg)
				return
			}
		}

		if (this.game !== null) {
			let res
			try {
				res = await this.game.onMessage(msg)
			} catch (e) {
				this.game = null
				throw e
			}

			if (!res) {
				this.game = null
			}
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
