import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import { FeatureInterface, FeatureEventContext, FeatureEventResult } from 'Src/features/feature'
import * as utils from 'Src/utils'

type State =
	| 'constructed'
	| 'preInitializing'
	| 'preInitialized'
	| 'initialized'
	| 'finalized'
	| 'error'

export default class {
	private readonly features: Map<string, FeatureInterface> = new Map()
	private readonly _gc: GlobalConfig
	private sorteadFeatures: FeatureInterface[] = []
	private _state: State = 'constructed'

	get state(): State {
		return this._state
	}

	constructor() {
		this._gc = new GlobalConfig(['./config/config-default.toml', './config/config.toml'])
	}

	get gc(): GlobalConfig {
		return this._gc
	}

	async init(): Promise<void> {
		if (this.state !== 'constructed') {
			throw Error('init() の呼び出しがおかしい')
		}

		this._state = 'preInitializing'

		try {
			try {
				for (const feature of this.features.values()) {
					feature.preInit(this)
				}
			} catch (e) {
				throw Error(`failed to pre initialize: ${e}`)
			}

			this._state = 'preInitialized'

			this.sorteadFeatures = Array.from(this.features.values()).sort(
				(a, b) => b.priority - a.priority
			)

			try {
				for (const feature of this.sorteadFeatures) {
					await feature.init(this)
				}
			} catch (e) {
				throw Error(`failed to initialize: ${e}`)
			}

			await this._gc.init()
		} catch (e) {
			this._state = 'error'
			throw e
		}

		this._state = 'initialized'
	}

	async finalize(): Promise<void> {
		if (this.state !== 'initialized') {
			throw Error('駄目なタイミング')
		}

		// 初期化と逆順に処理
		for (let i = this.sorteadFeatures.length; 0 <= --i; ) {
			await this.sorteadFeatures[i].finalize()
		}
		this._state = 'finalized'
	}

	registerFeature<T extends FeatureInterface>(id: string, feature: T): T {
		if (this.state !== 'constructed' && this.state !== 'preInitializing') {
			throw Error('タイミング駄目')
		}

		const gotFeature = this.features.get(id)
		if (gotFeature) {
			return gotFeature as T
		}

		this.features.set(id, feature)
		if (this.state === 'preInitializing') {
			feature.preInit(this)
		}

		return feature
	}

	getFeature<T extends FeatureInterface>(id: string): T {
		return this.features.get(id) as T
	}

	async message(msg: discordjs.Message): Promise<void> {
		if (this.state !== 'initialized') {
			throw Error('なんかタイミングがおかしい')
		}

		let context: FeatureEventContext = {}
		const continuations = []

		for (const feature of this.sorteadFeatures) {
			const res = feature.onMessage(msg, context)
			context = res.context ?? context

			if ('continuation' in res) {
				continuations.push(res.continuation)
			}

			if (res.preventNext) {
				break
			}
		}

		await Promise.all(continuations)
	}

	// discord.js の message イベントからのみ呼ばれることを想定
	async onMessage(msg: discordjs.Message): Promise<void> {
		if (this.state !== 'initialized') {
			throw Error('なんかタイミングがおかしい')
		}

		// とりあえず入れとく
		if (msg.author.bot) {
			return
		}

		try {
			await this.message(msg)
		} catch (e) {
			console.error(e)
			await msg.channel.send('bot の処理中にエラーが発生しました')
		}
	}
}
