import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import { Feature } from 'Src/features/feature'
import * as utils from 'Src/utils'

export default class {
	private _features: Map<string, Feature> = new Map()
	private _gc: GlobalConfig

	constructor() {
		this._gc = new GlobalConfig(['./config/config-default.toml', './config/config.toml'])
	}

	get gc(): GlobalConfig {
		return this._gc
	}

	async init(): Promise<void> {
		await this._gc.init()
	}

	async finalize(): Promise<void> {
		await this._eachAsync(x => x.finalize())
	}

	async registerFeature(id: string, feature: Feature): Promise<void> {
		this._features.set(id, feature)
		await feature.init(this)
	}

	private async _eachAsync(cb: (x: Feature) => Promise<void>): Promise<void> {
		return await utils.forEachAsyncOf(this._features.values(), async feature => {
			if (!feature.hasInitialized) {
				return
			}
			await cb(feature)
		})
	}

	async command(msg: discordjs.Message, name: string, args: string[]): Promise<void> {
		await this._eachAsync(x => x.onCommand(msg, name, args))
	}

	async message(msg: discordjs.Message): Promise<void> {
		await this._eachAsync(x => x.onMessage(msg))
	}

	// discord.js の message イベントからのみ呼ばれることを想定
	async onMessage(msg: discordjs.Message): Promise<void> {
		if (msg.author.bot) {
			return
		}

		const command = utils.parseCommand(msg.content)

		try {
			if (command) {
				const { commandName, args } = command
				await this.command(msg, commandName, args)
			} else {
				await this.message(msg)
			}
		} catch (e) {
			console.error(e)
			await msg.channel.send('bot の処理中にエラーが発生しました')
		}
	}
}
