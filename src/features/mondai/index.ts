import { promises as fs } from 'fs'
import TOML from '@iarna/toml'
import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { StorageType } from 'Src/features/storage'
import GlobalConfig from 'Src/global-config'

import * as utils from 'Src/utils'
import { Game, GameOption } from 'Src/features/mondai/game'

export type MondaiConfig = {
	readonly options: {
		readonly type: 'video' | 'music'
		readonly surrenderPattern: string
	}
	readonly episodes: {
		readonly filename: string
		readonly title: string
		readonly pattern: string
		readonly excludeRange?: string
	}[]
}

export class Mondai {
	private game: Game | undefined
	private gc: GlobalConfig

	constructor(
		public readonly feature: FeatureMondai,
		public readonly channel: utils.LikeTextChannel,
		public readonly config: MondaiConfig
	) {
		this.gc = feature.manager.gc
	}

	private async finalizeGame(): Promise<void> {
		// 2回以上 Game.finalize() が呼ばれないようにする
		if (this.game === undefined) {
			return
		}

		const instance = this.game
		this.game = undefined
		await instance.finalize()
	}

	async onCommand(msg: discordjs.Message, rawArgs: string[]): Promise<void> {
		let args, options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['life', 'l']))
		} catch (e) {
			await this.gc.send(msg, 'mondai.invalidCommand', { e })
			return
		}

		if (this.game !== undefined) {
			if (args.length === 1 && args[0] === 'stop') {
				await this.finalizeGame()
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
				await this.finalizeGame()
			}
		}
	}
}

class FeatureMondaiCommand implements Command {
	constructor(private readonly feature: FeatureMondai, private readonly cmdname: string) {}

	name(): string {
		return this.cmdname
	}

	description(): string {
		return 'mondai'
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		await this.feature.storageDriver.channel(msg).get<Mondai>('mondai').onCommand(msg, args)
	}
}

export class FeatureMondai extends CommonFeatureBase {
	private config!: MondaiConfig

	constructor(public readonly cmdname: string, private readonly configPath: string) {
		super()
	}

	protected async initImpl(): Promise<void> {
		this.storageDriver.setChannelStorageConstructor(
			(ch) =>
				new StorageType(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					new Map<string, any>([['mondai', new Mondai(this, ch, this.config)]])
				)
		)
		this.featureCommand.registerCommand(new FeatureMondaiCommand(this, this.cmdname))

		const toml = await fs.readFile(this.configPath, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.config = parsed as MondaiConfig
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		await this.storageDriver.channel(msg).get<Mondai>('mondai').onMessage(msg)
	}
}
