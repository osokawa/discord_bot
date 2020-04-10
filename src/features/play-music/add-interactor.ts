import lodash from 'lodash'
import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { Music } from 'Src/features/play-music/music'
import { Playlist } from 'Src/features/play-music/playlist'

interface ListDisplayable {
	toListString(): string
}

type SearchResultType =
	| { kind: 'musics'; value: Music[] }
	| { kind: 'artists'; value: string[] }
	| { kind: 'albums'; value: string[] }
	| { kind: 'undefined' }

function parseIndexes(strings: string[], min: number, max: number): number[] {
	let ret: number[] = []

	for (const str of strings) {
		const match = /(\d+)(?:-|\.\.)(\d+)/.exec(str)
		if (match) {
			const start = parseInt(match[1], 10)
			const end = parseInt(match[2], 10)

			if (!(start < end)) {
				throw new Error('invalid expression')
			}

			ret = [...ret, ...lodash.range(start, end + 1)]
			continue
		}

		const index = parseInt(str, 10)
		if (isNaN(index)) {
			throw new Error(`failed to parse ${str} as int`)
		}

		ret.push(index)
	}

	if (!ret.every(v => min <= v && v <= max)) {
		throw new Error('out of range')
	}

	return ret
}

export class AddInteractor {
	private gc: GlobalConfig
	private searchResult: SearchResultType = { kind: 'undefined' }

	constructor(
		private channel: utils.LikeTextChannel,
		private feature: FeaturePlayMusic,
		private playlist: Playlist,
		private done: () => void
	) {
		this.gc = this.feature.manager.gc
	}

	private setMusicResult(musics: Music[]): void {
		this.searchResult = { kind: 'musics', value: musics }
	}

	async welcome(): Promise<void> {
		await this.gc.sendToChannel(this.channel, 'playMusic.interactor.welcome')
	}

	async search(keyword: string): Promise<void> {
		this.setMusicResult(this.feature.database.search(keyword))
		await this.show(1)
	}

	async searchArtist(keyword: string): Promise<void> {
		this.searchResult = {
			kind: 'artists',
			value: this.feature.database.searchArtistName(keyword),
		}
		await this.show(1)
	}

	async searchAlbum(keyword: string): Promise<void> {
		this.searchResult = {
			kind: 'albums',
			value: this.feature.database.searchAlbumName(keyword),
		}
		await this.show(1)
	}

	async select(indexes: string[]): Promise<void> {
		const sr = this.searchResult

		const base = (names: string[], func: (name: string) => Music[]): void => {
			const res = lodash.flatten(
				parseIndexes(indexes, 0, names.length).map(i => func(names[i]))
			)
			this.setMusicResult(res)
			this.show(1)
		}

		if (sr.kind === 'artists') {
			base(sr.value, name => this.feature.database.fromArtist(name) ?? utils.unreachable())
		} else if (sr.kind === 'albums') {
			base(sr.value, name => this.feature.database.fromAlbum(name) ?? utils.unreachable())
		} else {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.selectInvalidState')
		}
	}

	async show(pageNumber: number): Promise<void> {
		if (this.searchResult.kind === 'undefined') {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.resultNotFound')
			return
		}

		const val: (Music | string)[] = this.searchResult.value
		const res = utils.pagination(val, pageNumber)

		if (res.kind === 'empty') {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.resultNotFound')
		} else if (res.kind === 'invalidPageId') {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.invalidPageId', {
				maxPage: res.maxPage,
			})
		} else if (res.kind === 'ok') {
			let text

			if (this.searchResult.kind === 'musics') {
				text = (res.value as Music[])
					.map(
						(v, i) =>
							`${res.firstIndex + i}: ${v.metadata.title} (from ${v.memberMusicList})`
					)
					.join('\n')
			} else if (
				this.searchResult.kind === 'albums' ||
				this.searchResult.kind === 'artists'
			) {
				text = (res.value as string[])
					.map((v, i) => `${res.firstIndex + i}: ${v}`)
					.join('\n')
			} else {
				utils.unreachable(this.searchResult)
			}

			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.list', {
				currentPage: pageNumber,
				maxPage: res.maxPage,
				results: text,
			})
		} else {
			utils.unreachable(res)
		}
	}

	async add(indexes: string[]): Promise<void> {
		const res = this.addToPlaylistByIndex(indexes)
		if (res === 'all') {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.addedMusic', {
				all: true,
				musics: [],
			})
		} else {
			await this.gc.sendToChannel(this.channel, 'playMusic.interactor.addedMusic', {
				all: false,
				musics: res,
			})
		}
	}

	private addToPlaylistByIndex(indexes: string[]): Music[] | 'all' {
		if (this.searchResult.kind !== 'musics') {
			return []
		}

		if (indexes.length === 0) {
			for (const music of this.searchResult.value) {
				this.playlist.addMusic(music)
			}

			return 'all'
		}

		const addedMusics: Music[] = []
		for (const i of parseIndexes(indexes, 0, this.searchResult.value.length)) {
			const music = this.searchResult.value[i]
			addedMusics.push(music)
			this.playlist.addMusic(music)
		}

		return addedMusics
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		const res = utils.parseShellLikeCommand(msg.content)
		if (res === undefined || res.length < 1) {
			await this.gc.send(msg, 'playMusic.interactor.invalidCommand')
			return
		}

		utils.subCommandProxy(
			{
				help: async () => {
					await this.gc.send(msg, 'playMusic.interactor.help')
				},
				search: async args => {
					if (args.length < 1) {
						await this.gc.send(msg, '検索キーワードを指定するロボ')
						return
					}

					await this.search(args[0])
				},
				searchArtist: async args => {
					if (args.length < 1) {
						await this.gc.send(msg, '検索キーワードを指定するロボ')
						return
					}

					await this.searchArtist(args[0])
				},
				searchAlbum: async args => {
					if (args.length < 1) {
						await this.gc.send(msg, '検索キーワードを指定するロボ')
						return
					}

					await this.searchAlbum(args[0])
				},
				show: async args => {
					await this.show(parseInt(args[0], 10) || 1)
				},
				select: async args => {
					await this.select(args)
				},
				add: async args => {
					await this.add(args)
				},
				play: async args => {
					const member = msg.member
					if (!member) {
						return
					}

					if (!member.voice.channel) {
						await this.gc.send(msg, 'playMusic.haveToJoinVoiceChannel')
						return
					}

					this.playlist.clear()

					await this.add(args)

					await this.feature.makeConnection(member.voice.channel)
					await this.feature.play()
				},
				quit: async () => {
					this.done()
					await this.gc.send(msg, 'playMusic.interactor.quit')
				},
			},
			res,
			msg
		)
	}
}
