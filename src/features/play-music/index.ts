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

class AddInteractor {
	private gc: GlobalConfig
	private musics: Music[] = []

	constructor(
		private channel: utils.LikeTextChannel,
		private feature: FeaturePlayMusic,
		private playlist: Playlist,
		private done: () => void
	) {
		this.gc = this.feature.manager.gc
	}

	async welcome(): Promise<void> {
		await this.gc.sendToChannel(this.channel, 'playMusic.interactor.welcome')
	}

	async search(keyword: string): Promise<void> {
		this.musics = this.feature.allMusicsFuse.search(keyword) as Music[]
		await this.show(1)
	}

	async fromPlaylist(name: string): Promise<void> {
		const musicList = this.feature.musicLists.get(name)
		if (musicList === undefined) {
			await this.gc.sendToChannel(
				this.channel,
				'そんなプレイリストは存在しないロボ! 完全一致だから気をつけるロボよ'
			)
			return
		}

		this.musics = musicList
		await this.gc.sendToChannel(this.channel, 'プレイリストの曲を追加したロボ')
	}

	async show(pageNumber: number): Promise<void> {
		// TODO: DRY
		if (this.musics.length === 0) {
			await this.gc.sendToChannel(this.channel, 'customReply.images.listImageNotFound')
			return
		}

		// 1ページあたり何枚の画像を表示させるか
		const imagesPerPage = 20
		const maxPage = Math.ceil(this.musics.length / imagesPerPage)

		if (pageNumber < 1 || maxPage < pageNumber) {
			await this.gc.sendToChannel(this.channel, 'customReply.images.invalidPageId', {
				maxPage,
			})
			return
		}

		const pagedImages = this.musics.slice(
			imagesPerPage * (pageNumber - 1),
			imagesPerPage * pageNumber
		)

		await this.gc.sendToChannel(this.channel, 'customReply.images.list', {
			currentPage: pageNumber,
			maxPage,
			images: pagedImages
				.map(
					(v, i) =>
						`${i + imagesPerPage * (pageNumber - 1)}: ${v.metadata.title} (from ${
							v.memberMusicList
						})`
				)
				.join('\n'),
		})

		return
	}

	private addToPlaylistByIndex(indexes: number[]): Music[] | 'all' {
		if (indexes.length === 0) {
			for (const music of this.musics) {
				this.playlist.addMusic(music)
			}

			return 'all'
		}

		const addedMusics: Music[] = []
		for (const i of indexes) {
			if (!isNaN(i) && 0 <= i && i <= this.musics.length) {
				const music = this.musics[i]
				addedMusics.push(music)
				this.playlist.addMusic(music)
			}
		}

		return addedMusics
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		const res = utils.parseShellLikeCommand(msg.content)
		if (res === undefined || res.length < 1) {
			await this.gc.send(msg, 'playMusic.interactor.invalidCommand')
			return
		}

		const commandName = res[0]
		const args = res.splice(1)

		if (commandName === 'help') {
			await this.gc.send(msg, 'playMusic.interactor.help')
			return
		}

		if (commandName === 'search') {
			if (args.length < 1) {
				await this.gc.send(msg, '検索キーワードを指定するロボ')
				return
			}

			console.log(args)
			await this.search(args[0])
			return
		}

		if (commandName === 'playlist') {
			if (args.length < 1) {
				await this.gc.send(msg, 'プレイリスト名を指定するロボ')
				return
			}

			await this.fromPlaylist(args[0])
			return
		}

		if (commandName === 'show') {
			await this.show(parseInt(args[0], 10) || 1)
			return
		}

		if (commandName === 'add') {
			const res = this.addToPlaylistByIndex(args.map(x => parseInt(x, 10)))
			if (res === 'all') {
				await this.gc.send(msg, '全ての曲を追加したロボ')
			} else {
				await this.gc.send(msg, 'playMusic.interactor.addedMusic', { musics: res })
			}
			return
		}

		if (commandName === 'play') {
			const member = msg.member
			if (!member) {
				return
			}

			if (!member.voice.channel) {
				msg.reply('ボイスチャンネルに入ってから言うロボ')
				return
			}

			this.playlist.clear()

			const res = this.addToPlaylistByIndex(args.map(x => parseInt(x, 10)))

			await this.feature.makeConnection(member.voice.channel)
			await this.feature.play()

			if (res === 'all') {
				await this.gc.send(msg, '全ての曲を追加したロボ')
			} else {
				await this.gc.send(msg, 'playMusic.interactor.addedMusic', { musics: res })
			}
			return
		}

		if (commandName === 'quit') {
			this.done()
			await this.gc.send(msg, 'playMusic.interactor.quit')
			return
		}

		await this.gc.send(msg, 'playMusic.interactor.invalidCommand')
	}
}

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
			const res = this.feature.allMusicsFuse.search(arg) as Music[]
			if (0 < res.length) {
				const music = res[0]
				this.feature.playlist.addMusic(music)
				msg.reply(`${music.metadata.title} を再生するロボ!`)
			} else {
				msg.reply('そんな曲は無いロボ')
			}
		}

		await this.feature.makeConnection(member.voice.channel)
		await this.feature.play()
	}

	async edit(rawArgs: string[], msg: discordjs.Message): Promise<void> {
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

		if (this.feature.interactors.size !== 0) {
			await msg.reply('今まさにインタラクションモード')
			return
		}

		const i = this.feature.createInteractor(msg)
		await i.welcome()
		if (args.length === 1) {
			await i.search(args[0])
		}
		return
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
				edit: (a, m) => this.edit(a, m),
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
		const musicListName = parsed.name as string
		musicLists.set(
			musicListName,
			(parsed.musics as MusicList).map(
				(x): Music => ({ ...x, memberMusicList: musicListName })
			)
		)
	}

	return musicLists
}

function getAllMusics(musicLists: MusicLists): Music[] {
	return lodash.flatten(Array.from(musicLists.values()))
}

export class FeaturePlayMusic extends CommonFeatureBase {
	interactors: Set<AddInteractor> = new Set()
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
		for (const i of this.interactors) {
			await i.onMessage(msg)
		}
	}

	createInteractor(msg: discordjs.Message): AddInteractor {
		const i = new AddInteractor(msg.channel, this, this.playlist, () => {
			this.interactors.delete(i)
		})
		this.interactors.add(i)

		return i
	}

	async reload(): Promise<void> {
		this.musicLists = await loadPlaylists('./config/playlists')
		this.allMusicsFuse = new Fuse(getAllMusics(this.musicLists), {
			keys: [
				{ name: 'metadata.title', weight: 0.6 },
				{ name: 'metadata.album', weight: 0.3 },
				{ name: 'metadata.artist', weight: 0.1 },
			],
		})
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
