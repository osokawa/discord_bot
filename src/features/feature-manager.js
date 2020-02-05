const utils = require('../utils.js')
const GlobalConfig = require('../global-config.js')

module.exports = class {
	#features = new Map()
	#gc = null

	constructor() {
		this.#gc = new GlobalConfig(['./config/config-default.toml', './config/config.toml'])
	}

	get gc() {
		return this.#gc
	}

	async init() {
		await this.#gc.init()
	}

	async finalize() {
		await this._eachAsync(x => x.finalize())
	}

	async registerFeature(id, feature) {
		this.#features.set(id, feature)
		await feature.init(this)
	}

	async _eachAsync(cb) {
		return await utils.forEachAsyncOf(this.#features.values(), async feature => {
			if (!feature.hasInitialized) {
				return
			}
			await cb(feature)
		})
	}

	async command(msg, name, args) {
		await this._eachAsync(x => x.onCommand(msg, name, args))
	}

	async message(msg) {
		await this._eachAsync(x => x.onMessage(msg))
	}

	// discord.js の message イベントからのみ呼ばれることを想定
	async onMessage(msg) {
		if (msg.author.bot) {
			return
		}

		try {
			if (msg.content.startsWith('!')) {
				const { commandName, args } = utils.parseCommand(msg.content)
				await this.command(msg, commandName, args)
				return
			}

			await this.message(msg)
		} catch (e) {
			console.error(e)
			await msg.channel.send('bot の処理中にエラーが発生しました')
		}
	}
}
