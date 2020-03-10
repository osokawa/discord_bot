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

type Music = {
	readonly title: string
	readonly path: string
}
type Playlist = Music[]
type Playlists = Map<string, Playlist>

class PlayMusicCommand implements Command {
	constructor(private readonly cmdName: string, private readonly feature: FeaturePlayMusic) {}

	name(): string {
		return this.cmdName
	}

	description(): string {
		return '音楽再生'
	}

	async play(rawArgs: string[], msg: discordjs.Message): Promise<void> {
		let args
		try {
			;({ args } = utils.parseCommandArgs(rawArgs, [], 1))
		} catch (e) {
			await this.feature.manager.gc.send(msg, 'playMusic.invalidCommand', { e })
			return
		}

		const member = msg.member
		if (member) {
			// Only try to join the sender's voice channel if they are in one themselves
			if (member.voice.channel) {
				this.feature.currentPlaylist = []
				this.feature.currentPlayingTrack = 0

				for (const arg of args) {
					const res = this.feature.allMusicsFuse.search(arg)[0] as Music | undefined
					if (res) {
						this.feature.currentPlaylist.push(res)
						msg.reply(`${res.title} を再生するロボ!`)
					} else {
						msg.reply('そんな曲は無いロボ')
					}
				}

				await this.feature.makeConnection(member.voice.channel)
				await this.feature.play()
			} else {
				msg.reply('ボイスチャンネルに入ってから言うロボ')
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
				stop: () => this.feature.closeConnection(),
				reload: (a, m) => this.reload(a, m),
			},
			args,
			msg
		)
	}
}

async function loadPlaylists(dir: string): Promise<Playlists> {
	const files = await fs.readdir(dir)
	const playlists: Playlists = new Map()

	for (const file of files) {
		const toml = await fs.readFile(path.join(dir, file), 'utf-8')
		const parsed = await TOML.parse.async(toml)
		playlists.set(parsed.name as string, parsed.musics as Playlist)
	}

	return playlists
}

function getAllMusics(playlists: Playlists): Music[] {
	return lodash.flatten(Array.from(playlists.values()))
}

export class FeaturePlayMusic extends CommonFeatureBase {
	private connection: discordjs.VoiceConnection | undefined
	private dispatcher: discordjs.StreamDispatcher | undefined
	playlists: Playlists = new Map()
	allMusicsFuse!: Fuse<Music, Fuse.FuseOptions<Music>>

	currentPlaylist: Playlist | undefined
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
		this.playlists = await loadPlaylists('./config/playlists')
		this.allMusicsFuse = new Fuse(getAllMusics(this.playlists), { keys: ['title'] })
	}

	async play(): Promise<void> {
		if (this.connection === undefined) {
			throw '接続中のコネクションがない'
		}

		if (this.currentPlaylist === undefined || this.currentPlayingTrack === undefined) {
			throw 'だめ'
		}

		if (this.currentPlaylist.length <= this.currentPlayingTrack) {
			throw 'だめ'
		}

		this.destroyDispather()
		this.dispatcher = this.connection.play(this.currentPlaylist[this.currentPlayingTrack].path)
		this.dispatcher.on('finish', () => {
			console.log('on finish')
			this.destroyDispather()
			if (this.connection === undefined) {
				return
			}

			if (this.currentPlaylist === undefined || this.currentPlayingTrack === undefined) {
				return
			}

			this.currentPlayingTrack += 1
			if (this.currentPlaylist.length <= this.currentPlayingTrack) {
				this.currentPlayingTrack = 0
			}
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
