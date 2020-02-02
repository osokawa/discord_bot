const fs = require('fs').promises
const utils = require('../../utils.js')
const TOML = require('@iarna/toml')
const Game = require('./game.js')

class Mondai {
	#gc

	constructor(feature, channel, gc) {
		this.feature = feature
		this.channel = channel
		this.#gc = gc
		this.game = null
	}

	async _processMondaiCommand(rawArgs, msg) {
		let args, options
		try {
			({ args, options } = utils.parseCommandArgs(rawArgs, ['life', 'l']))
		} catch (e) {
			await this.#gc.send(msg, 'mondai.invalidCommand', { e })
			return
		}

		if (this.game !== null) {
			if (args.length === 1 && args[0] === 'stop') {
				await this.game.finalize()
				this.game = null
				return
			}

			await this.#gc.send(msg, 'mondai.lastCommandIsStillInProgress', { cmdname: this.feature.cmdname })
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
				await this.#gc.send(msg, 'mondai.invalidCommandMode')
				return
			}
		}

		try {
			const opts = {
				repeat: utils.getOption(options, ['repeat', 'r'])
			}

			const life = utils.getOption(options, ['life', 'l'], null)
			if (life) {
				opts.repeat = true
				opts.life = parseInt(life, 10)
			}

			this.game = new Game(this, this.#gc, mode, opts)
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
				await this.game.finalize()
				this.game = null
			}
		}
	}
}

module.exports = class {
	#gc

	constructor(cmdname, configPath) {
		this.cmdname = cmdname
		this.configPath = configPath
		this.config = null
	}

	async init(gc) {
		this.#gc = gc

		const toml = await fs.readFile(this.configPath, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.config = parsed
	}

	async finalize() {
	}

	createChannelInstance(channel) {
		return new Mondai(this, channel, this.#gc)
	}
}
