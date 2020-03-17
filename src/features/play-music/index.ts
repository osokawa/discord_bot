import { promises as fs } from 'fs'
import TOML from '@iarna/toml'
import lodash from 'lodash'
import * as discordjs from 'discord.js'
import * as path from 'path'
import Fuse from 'fuse.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { StorageType } from 'Src/features/storage'
import GlobalConfig from 'Src/global-config'

import * as utils from 'Src/utils'

import { Music } from 'Src/features/play-music/music'
import { Playlist } from 'Src/features/play-music/playlist'

type MusicList = Music[]
type MusicLists = Map<string, MusicList>

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

	async play(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 0))
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

		if (args.length === 0) {
			if (this.feature.playlist.isEmpty) {
				msg.reply('今はプレイリストが空ロボ')
				return
			}

			await this.feature.makeConnection(member.voice.channel)
			await this.feature.play()
			return
		}

		this.feature.playlist.clear()

		for (const arg of args) {
			const res = this.feature.allMusicsFuse.search(arg)[0] as Music | undefined
			if (res) {
				this.feature.playlist.addMusic(res)
				msg.reply(`${res.title} を再生するロボ!`)
			} else {
				msg.reply('そんな曲は無いロボ')
			}
		}

		await this.feature.makeConnection(member.voice.channel)
		await this.feature.play()
	}

	async add(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 1))
		} catch (e) {
			await this.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		for (const arg of args) {
			const res = this.feature.allMusicsFuse.search(arg)[0] as Music | undefined
			if (res) {
				this.feature.playlist.addMusic(res)
				msg.reply(`${res.title} をプレイリストに追加するロボ!`)
			} else {
				msg.reply('そんな曲は無いロボ')
			}
		}
	}

	async reload(args: string[], msg: discordjs.Message): Promise<void> {
		await this.feature.reload()
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		await utils.subCommandProxy(
			{
				play: (a, m) => this.play(a, m),
				add: (a, m) => this.add(a, m),
				stop: () => this.feature.closeConnection(),
				reload: (a, m) => this.reload(a, m),
			},
			args,
			msg
		)
	}
}

async function loadPlaylists(dir: string): Promise<MusicLists> {
	const files = await fs.readdir(dir)
	const musicLists: MusicLists = new Map()

	for (const file of files) {
		const toml = await fs.readFile(path.join(dir, file), 'utf-8')
		const parsed = await TOML.parse.async(toml)
		musicLists.set(parsed.name as string, parsed.musics as MusicList)
	}

	return musicLists
}

function getAllMusics(musicLists: MusicLists): Music[] {
	return lodash.flatten(Array.from(musicLists.values()))
}

export class FeaturePlayMusic extends CommonFeatureBase {
	private connection: discordjs.VoiceConnection | undefined
	private dispatcher: discordjs.StreamDispatcher | undefined
	musicLists: MusicLists = new Map()
	allMusicsFuse!: Fuse<Music, Fuse.FuseOptions<Music>>

	playlist: Playlist = new Playlist()
	currentPlayingTrack: number | undefined

	constructor(public readonly cmdname: string) {
		super()
	}

	protected async initImpl(): Promise<void> {
		await this.reload()
		this.featureCommand.registerCommand(new PlayMusicCommand(this.cmdname, this))
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		// なんか
	}

	async reload(): Promise<void> {
		this.musicLists = await loadPlaylists('./config/playlists')
		this.allMusicsFuse = new Fuse(getAllMusics(this.musicLists), { keys: ['title'] })
	}

	async play(): Promise<void> {
		if (this.connection === undefined) {
			throw '接続中のコネクションがない'
		}

		const music = this.playlist.currentMusic
		if (!music) {
			throw 'だめ'
		}

		this.destroyDispather()
		this.dispatcher = this.connection.play(music.path)
		this.dispatcher.on('finish', () => {
			console.log('on finish')
			this.destroyDispather()
			if (this.connection === undefined) {
				return
			}

			if (this.playlist.isEmpty) {
				return
			}

			this.playlist.next()
			this.play()
		})
	}

	destroyDispather(): void {
		this.dispatcher?.destroy()
		this.dispatcher = undefined
	}

	async closeConnection(): Promise<void> {
		this.destroyDispather()
		if (this.connection !== undefined) {
			this.connection.disconnect()
			this.connection = undefined
			// 入れないと次のコネクションの作成がタイムアウトする
			// 1秒で十分かどうかは知らない
			await utils.delay(1000)
		}
	}

	async makeConnection(channel: discordjs.VoiceChannel): Promise<void> {
		if (this.connection !== undefined && channel.id === this.connection.channel.id) {
			this.destroyDispather()
		} else {
			await this.closeConnection()
		}
		this.connection = await channel.join()
	}

	async finalize(): Promise<void> {
		await this.closeConnection()
	}
}
