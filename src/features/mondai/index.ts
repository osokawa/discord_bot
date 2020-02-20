import { promises as fs } from 'fs'
import * as utils from '../../utils'
import TOML from '@iarna/toml'
import Game from './game'

import { Feature } from '../feature'

import * as discordjs from 'discord.js'

import GlobalConfig from '../../global-config'

export class Mondai {
	private game: Game | undefined

	constructor(private feature: FeatureMondai, private channel: discordjs.Channel, private _gc: GlobalConfig) {
	}

	private async _finalizeGame() {
		// 2回以上 Game.finalize() が呼ばれないようにする
		if (this.game === undefined) {
			return
		}

		const instance = this.game
		this.game = undefined
		await instance.finalize()
	}

	private async onCommand(msg: discordjs.Message, name: string, rawArgs: string[]) {
		if (name !== this.feature.cmdname) {
			return
		}

		let args, options
		try {
			({ args, options } = utils.parseCommandArgs(rawArgs, ['life', 'l']))
		} catch (e) {
			await this._gc.send(msg, 'mondai.invalidCommand', { e })
			return
		}

		if (this.game !== undefined) {
			if (args.length === 1 && args[0] === 'stop') {
				await this._finalizeGame()
				return
			}

			await this._gc.send(msg, 'mondai.lastCommandIsStillInProgress', { cmdname: this.feature.cmdname })
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
				await this._gc.send(msg, 'mondai.invalidCommandMode')
				return
			}
		}

		try {
			const opts: { repeat?: any, life?: any } = {
				repeat: utils.getOption(options, ['repeat', 'r'])
			}

			const life = utils.getOption(options, ['life', 'l'], null)
			if (life) {
				opts.repeat = true
				opts.life = parseInt(life as string, 10)
			}

			this.game = new Game(this, this._gc, mode, opts as any)
			await this.game.init()
		} catch (e) {
			this.game = undefined
			throw e
		}
	}

	async onMessage(msg: discordjs.Message) {
		if (this.game !== undefined) {
			let res
			try {
				res = await this.game.onMessage(msg)
			} catch (e) {
				this.game = undefined
				throw e
			}

			if (!res) {
				await this._finalizeGame()
			}
		}
	}
}

export class FeatureMondai extends Feature {
	config: any | undefined

	constructor(public cmdname: string, private configPath: string) {
		super()
	}

	async initImpl() {
		this.registerChannel(this)
		this.registerCommand(this)

		const toml = await fs.readFile(this.configPath, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.config = parsed
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]) {
		await this.dispatchToChannels(msg.channel, x => x.onCommand(msg, name, args))
	}

	createChannelInstance(channel: discordjs.Channel) {
		return new Mondai(this, channel, this.gc)
	}
}
