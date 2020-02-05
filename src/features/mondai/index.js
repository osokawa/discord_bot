const fs = require('fs').promises
const utils = require('../../utils.js')
const TOML = require('@iarna/toml')
const Game = require('./game.js')
const { Feature } = require('../feature.js')

class Mondai {
	#gc

	constructor(feature, channel, gc) {
		this.feature = feature
		this.channel = channel
		this.#gc = gc
		this.game = null
	}

	async _finalizeGame() {
		// 2回以上 Game.finalize() が呼ばれないようにする
		const instance = this.game
		this.game = null
		await instance.finalize()
	}

	async onCommand(msg, name, rawArgs) {
		if (name !== this.feature.cmdname) {
			return
		}

		let args, options
		try {
			({ args, options } = utils.parseCommandArgs(rawArgs, ['life', 'l']))
		} catch (e) {
			await this.#gc.send(msg, 'mondai.invalidCommand', { e })
			return
		}

		if (this.game !== null) {
			if (args.length === 1 && args[0] === 'stop') {
				await this._finalizeGame()
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
		if (this.game !== null) {
			let res
			try {
				res = await this.game.onMessage(msg)
			} catch (e) {
				this.game = null
				throw e
			}

			if (!res) {
				await this._finalizeGame()
			}
		}
	}
}

module.exports = class extends Feature {
	#gc

	constructor(cmdname, configPath) {
		super()
		this.cmdname = cmdname
		this.configPath = configPath
		this.config = null
	}

	async initImpl() {
		this.registerChannel(this)
		this.registerCommand(this)

		this.#gc = this.manager.gc

		const toml = await fs.readFile(this.configPath, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.config = parsed
	}

	async onCommand(msg, name, args) {
		await this.dispatchToChannels(msg.channel, x => x.onCommand(msg, name, args))
	}

	createChannelInstance(channel) {
		return new Mondai(this, channel, this.#gc)
	}
}
