import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { Music } from 'Src/features/play-music/music'
import { Playlist } from 'Src/features/play-music/playlist'

interface SearchResultCommon<Name extends string, T> {
	type: Name
	value: T[]
}

type SearchResultType =
	| { type: 'musics'; value: Music[] }
	| { type: 'artists'; value: string[] }
	| { type: 'albums'; value: string[] }
	| undefined

export class AddInteractor {
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
