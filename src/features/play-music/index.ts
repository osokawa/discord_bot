import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'

import { Core } from 'Src/features/play-music/core'
import { Music, YouTubeMusic } from 'Src/features/play-music/music'
import { MusicDatabase } from 'Src/features/play-music/music-database'

class PlayMusicCommand implements Command {
	private readonly gc: GlobalConfig

	constructor(private readonly cmdName: string, private readonly feature: FeaturePlayMusic) {
		this.gc = this.feature.manager.gc
	}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return '音楽再生'
	}

	async isValidState(msg: discordjs.Message): Promise<Core | undefined> {
		if (this.feature.core === undefined) {
			await this.gc.send(msg, 'playMusic.invalidState')
			return
		}

		if (msg.channel.id !== this.feature.core.boundTextChannel.id) {
			await this.gc.send(msg, 'playMusic.alreadyUsedInAnotherChannel')
			return
		}
		return this.feature.core
	}

	async edit(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		const core = await this.isValidState(msg)
		if (core === undefined) {
			return
		}

		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 0))
		} catch (e) {
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		if (1 < args.length) {
			await msg.reply('駄目なメッセージの引数の数')
			return
		}

		if (core.interactors.size !== 0) {
			await msg.reply('今まさにインタラクションモード')
			return
		}

		const i = core.createInteractor(msg)
		await i.welcome()
		if (args.length === 1) {
			await i.search(args[0])
		}
		return
	}

	private async addToPlaylist(
		core: Core,
		msg: discordjs.Message,
		keywords: string[],
		isYouTube: boolean
	): Promise<void> {
		for (const keyword of keywords) {
			let music: Music | undefined

			if (isYouTube) {
				music = new YouTubeMusic(keyword)
			} else {
				music = this.feature.database.search(keyword)[0]
			}

			if (music) {
				core.playlist.addMusic(music)
				await msg.reply(`${music.getTitle()} をプレイリストに追加するロボ!`)
			} else {
				await msg.reply('そんな曲は無いロボ')
			}
		}
	}

	async play(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let core = this.feature.core

		if (core !== undefined && core.boundTextChannel.id !== msg.channel.id) {
			await this.gc.send(msg, 'playMusic.alreadyUsedInAnotherChannel')
			return
		}

		let args, options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['youtube'], 0))
		} catch (e) {
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		const member = msg.member
		if (!member) {
			return
		}

		if (!member.voice.channel) {
			msg.reply('ボイスチャンネルに入ってから言うロボ')
			return
		}

		if (args.length === 0 && (core === undefined || core.playlist.isEmpty)) {
			msg.reply('今はプレイリストが空ロボ')
			return
		}

		if (core === undefined) {
			core = await this.feature.createCore(msg.channel)
		}

		if (args.length !== 0) {
			core.playlist.clear()
			await this.addToPlaylist(
				core,
				msg,
				args,
				utils.getOption(options, ['y', 'youtube']) as boolean
			)
		}

		await core.makeConnection(member.voice.channel)
		await core.play()
	}

	async add(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		const core = await this.isValidState(msg)
		if (core === undefined) {
			return
		}

		let args, options
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, ['youtube'], 1))
		} catch (e) {
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		await this.addToPlaylist(
			core,
			msg,
			args,
			utils.getOption(options, ['y', 'youtube']) as boolean
		)
	}

	async stop(msg: discordjs.Message): Promise<void> {
		const core = await this.isValidState(msg)
		if (core === undefined) {
			return
		}

		await this.feature.destoryCore()
	}

	async reload(msg: discordjs.Message): Promise<void> {
		const core = await this.isValidState(msg)
		if (core === undefined) {
			return
		}

		await this.feature.reload()
	}

	async next(msg: discordjs.Message): Promise<void> {
		const core = await this.isValidState(msg)
		if (core === undefined) {
			return
		}

		await core.next()
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		await utils.subCommandProxy(
			{
				play: (a, m) => this.play(a, m),
				add: (a, m) => this.add(a, m),
				stop: (_, m) => this.stop(m),
				reload: (_, m) => this.reload(m),
				edit: (a, m) => this.edit(a, m),
				next: (_, m) => this.next(m),
			},
			args,
			msg
		)
	}
}

export class FeaturePlayMusic extends CommonFeatureBase {
	core: Core | undefined
	database!: MusicDatabase

	constructor(public readonly cmdname: string) {
		super()
	}

	protected async initImpl(): Promise<void> {
		await this.reload()
		this.featureCommand.registerCommand(new PlayMusicCommand(this.cmdname, this))
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		await this.core?.onMessage(msg)
	}

	async reload(): Promise<void> {
		const database = new MusicDatabase('./config/playlists')
		await database.init()
		this.database = database
	}

	async createCore(channel: utils.LikeTextChannel): Promise<Core> {
		await this.destoryCore()
		this.core = new Core(this, channel)
		return this.core
	}

	async destoryCore(): Promise<void> {
		await this.core?.stop()
		this.core = undefined
	}

	async finalize(): Promise<void> {
		await this.core?.stop()
	}
}
