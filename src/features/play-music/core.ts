import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'

import { FeaturePlayMusic } from 'Src/features/play-music'
import { Playlist } from 'Src/features/play-music/playlist'
import { Music } from 'Src/features/play-music/music'
import { MusicDatabase } from 'Src/features/play-music/music-database'
import { AddInteractor } from 'Src/features/play-music/add-interactor'

export class Core {
	interactors: Set<AddInteractor> = new Set()
	private connection: discordjs.VoiceConnection | undefined
	private dispatcher: discordjs.StreamDispatcher | undefined
	private musicFinalizer: (() => void) | undefined
	database: MusicDatabase

	playlist: Playlist = new Playlist()
	currentPlayingTrack: number | undefined

	constructor(
		private feature: FeaturePlayMusic,
		private _boundTextChannel: utils.LikeTextChannel
	) {
		this.database = this.feature.database
	}

	get gc(): GlobalConfig {
		return this.feature.manager.gc
	}

	get boundTextChannel(): utils.LikeTextChannel {
		return this._boundTextChannel
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
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

	play(): Promise<Music> {
		if (this.connection === undefined) {
			throw '接続中のコネクションがない'
		}

		const music = this.playlist.currentMusic
		if (!music) {
			throw 'だめ'
		}

		this.destroyDispather()

		{
			const [dispatcher, finalizer] = music.createDispatcher(this.connection)
			this.dispatcher = dispatcher
			this.musicFinalizer = finalizer
		}

		this.dispatcher.on('finish', () => {
			this.next()
		})

		this.dispatcher.on('error', (error) => {
			console.error(error)
			this.destroyDispather()

			this.gc.sendToChannel(this.boundTextChannel, 'playMusic.errorHappen')
		})

		return Promise.resolve(music)
	}

	async next(): Promise<Music> {
		this.destroyDispather()
		if (this.connection === undefined) {
			throw '接続中のコネクションがない'
		}

		this.playlist.next()
		return await this.play()
	}

	async stop(): Promise<void> {
		await this.finalize()
	}

	destroyDispather(): void {
		this.dispatcher?.destroy()
		this.dispatcher = undefined

		if (this.musicFinalizer !== undefined) {
			this.musicFinalizer()
		}
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

	private async finalize(): Promise<void> {
		for (const i of this.interactors) {
			i.quit()
		}

		await this.closeConnection()
	}
}
