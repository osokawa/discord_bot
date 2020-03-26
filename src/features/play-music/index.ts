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
import { MusicDatabase } from 'Src/features/play-music/music-database'

type MusicList = Music[]
type MusicLists = Map<string, MusicList>

interface SearchResultCommon<Name extends string, T> {
	type: Name
	value: T[]
}

type SearchResultType =
	| { type: 'musics'; value: Music[] }
	| { type: 'artists'; value: string[] }
	| { type: 'albums'; value: string[] }
	| undefined

class AddInteractor {
	private gc: GlobalConfig
	private searchResult: SearchResultType

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
		this.searchResult = { type: 'musics', value: this.feature.database.search(keyword) }
		await this.show(1)
	}

	async searchArtist(keyword: string): Promise<void> {
		this.searchResult = {
			type: 'artists',
			value: this.feature.database.searchArtistName(keyword),
		}
		await this.show(1)
	}

	async fromPlaylist(name: string): Promise<void> {
		const musicList = this.feature.database.fromMusicList(name)
		if (musicList === undefined) {
			await this.gc.sendToChannel(
				this.channel,
				'そんなプレイリストは存在しないロボ! 完全一致だから気をつけるロボよ'
			)
			return
		}

		this.searchResult = { type: 'musics', value: musicList }
		await this.gc.sendToChannel(this.channel, 'プレイリストの曲を検索結果に追加したロボ')
	}

	async fromArtist(name: string): Promise<void> {
		const musics = this.feature.database.fromArtist(name)
		if (musics === undefined) {
			await this.gc.sendToChannel(
				this.channel,
				'そんなアーティストは存在しないロボ! 完全一致だから気をつけるロボよ'
			)
			return
		}

		this.searchResult = { type: 'musics', value: musics }
		await this.gc.sendToChannel(this.channel, 'アーティストの曲を検索結果に追加したロボ')
	}

	async fromAlbum(name: string): Promise<void> {
		const musics = this.feature.database.fromAlbum(name)
		if (musics === undefined) {
			await this.gc.sendToChannel(
				this.channel,
				'そんなアルバムは存在しないロボ! 完全一致だから気をつけるロボよ'
			)
			return
		}

		this.searchResult = { type: 'musics', value: musics }
		await this.gc.sendToChannel(this.channel, 'アルバムの曲を検索結果に追加したロボ')
	}

	async show(pageNumber: number): Promise<void> {
		// TODO: DRY
		if (this.searchResult === undefined || this.searchResult.value.length === 0) {
			await this.gc.sendToChannel(this.channel, 'customReply.images.listImageNotFound')
			return
		}

		const value = this.searchResult.value

		// 1ページあたり何枚の画像を表示させるか
		const imagesPerPage = 20
		const maxPage = Math.ceil(value.length / imagesPerPage)

		if (pageNumber < 1 || maxPage < pageNumber) {
			await this.gc.sendToChannel(this.channel, 'customReply.images.invalidPageId', {
				maxPage,
			})
			return
		}

		const pagedImages = value.slice(
			imagesPerPage * (pageNumber - 1),
			imagesPerPage * pageNumber
		)

		let text = ''

		if (this.searchResult.type === 'musics') {
			text = (pagedImages as Music[])
				.map(
					(v, i) =>
						`${i + imagesPerPage * (pageNumber - 1)}: ${v.metadata.title} (from ${
							v.memberMusicList
						})`
				)
				.join('\n')
		}

		if (this.searchResult.type === 'albums' || this.searchResult.type === 'artists') {
			text = (pagedImages as string[])
				.map((v, i) => `${i + imagesPerPage * (pageNumber - 1)}: ${v}`)
				.join('\n')
		}

		await this.gc.sendToChannel(this.channel, 'customReply.images.list', {
			currentPage: pageNumber,
			maxPage,
			images: text,
		})

		return
	}

	private addToPlaylistByIndex(indexes: number[]): Music[] | 'all' {
		if (this.searchResult === undefined || this.searchResult.type !== 'musics') {
			return []
		}

		if (indexes.length === 0) {
			for (const music of this.searchResult.value) {
				this.playlist.addMusic(music)
			}

			return 'all'
		}

		const addedMusics: Music[] = []
		for (const i of indexes) {
			if (!isNaN(i) && 0 <= i && i <= this.searchResult.value.length) {
				const music = this.searchResult.value[i]
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

		if (commandName === 'searchArtist') {
			if (args.length < 1) {
				await this.gc.send(msg, '検索キーワードを指定するロボ')
				return
			}

			console.log(args)
			await this.searchArtist(args[0])
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

		if (commandName === 'artist') {
			if (args.length < 1) {
				await this.gc.send(msg, 'アーティスト名を指定するロボ')
				return
			}

			await this.fromArtist(args[0])
			return
		}

		if (commandName === 'album') {
			if (args.length < 1) {
				await this.gc.send(msg, 'アルバム名を指定するロボ')
				return
			}

			await this.fromAlbum(args[0])
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
			const res = this.feature.database.search(arg)
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
			const res = this.feature.database.search(arg)[0]
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
	database!: MusicDatabase

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
		const database = new MusicDatabase('./config/playlists')
		await database.init()
		this.database = database
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
