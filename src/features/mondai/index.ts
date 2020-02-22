import { promises as fs } from 'fs'
import * as utils from '../../utils'
import TOML from '@iarna/toml'
import { Game, GameOption } from './game'

import { Feature, ChannelInstance } from '../feature'

import * as discordjs from 'discord.js'

export type MondaiConfig = {
	options: {
		type: 'video' | 'music'
		surrenderPattern: string
	}
	episodes: {
		filename: string
		title: string
		pattern: string
		excludeRange?: string
	}[]
}

export class Mondai extends ChannelInstance {
	private game: Game | undefined

	constructor(
		public feature: FeatureMondai,
		public channel: utils.LikeTextChannel,
		public config: MondaiConfig
	) {
		super(feature)
	}

	private async _finalizeGame(): Promise<void> {
		// 2回以上 Game.finalize() が呼ばれないようにする
		if (this.game === undefined) {
			return
		}

		const instance = this.game
		this.game = undefined
		await instance.finalize()
	}

	public async onCommand(msg: discordjs.Message, name: string, rawArgs: string[]): Promise<void> {
		if (name !== this.feature.cmdname) {
			return
		}

		let args, options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['life', 'l']))
		} catch (e) {
			await this.gc.send(msg, 'mondai.invalidCommand', { e })
			return
		}

		if (this.game !== undefined) {
			if (args.length === 1 && args[0] === 'stop') {
				await this._finalizeGame()
				return
			}

			await this.gc.send(msg, 'mondai.lastCommandIsStillInProgress', {
				cmdname: this.feature.cmdname,
			})
			return
		}

		const validModes =
			this.config.options.type === 'music' ? ['music', 'intro'] : ['image', 'mosaic', 'audio']

		let mode = validModes[0]
		if (1 <= args.length) {
			if (validModes.includes(args[0])) {
				mode = args[0]
			} else {
				await this.gc.send(msg, 'mondai.invalidCommandMode')
				return
			}
		}

		try {
			const opts: GameOption = {
				repeat: utils.getOption(options, ['repeat', 'r']) as boolean,
			}

			const life = utils.getOption(options, ['life', 'l'], null)
			if (life !== null) {
				opts.repeat = true
				opts.life = parseInt(life as string, 10)
			}

			this.game = new Game(this, this.gc, mode, opts)
			await this.game.init()
		} catch (e) {
			this.game = undefined
			throw e
		}
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
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
	private config: MondaiConfig | undefined

	constructor(public cmdname: string, private configPath: string) {
		super()
	}

	async initImpl(): Promise<void> {
		this.registerChannel(this)
		this.registerCommand(this)

		const toml = await fs.readFile(this.configPath, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.config = parsed as MondaiConfig
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]): Promise<void> {
		await this.dispatchToChannels(msg.channel, x => (x as Mondai).onCommand(msg, name, args))
	}

	createChannelInstance(channel: utils.LikeTextChannel): ChannelInstance {
		if (this.config === undefined) {
			throw 'なんかおかしい'
		}

		return new Mondai(this, channel, this.config)
	}
}
