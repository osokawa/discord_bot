const utils = require('../utils.js')

module.exports = class {
	#features = new Map()

	await registerFeature(id, feature) {
		this.#features.set(id, feature)
		await feature.init(this)
	}

	async _eachAsync(cb) {
		await Promise.all(this.#features.values().map(feature => {
			if (!instance.hasInitialized) {
				return
			}

			return async () => {
				try {
					await cb(instance)
				} catch (e) {
					console.error(e)
				}
			}
		}))
	}

	async command(msg, name, args) {
		this._eachAsync(x => x.onCommand(msg, name, args))
	}

	async message(msg) {
		this._eachAsync(x => x.onMessage(msg))
	}

	// discord.js の message イベントからのみ呼ばれることを想定
	async onMessage(msg) {
		if (msg.author.bot) {
			return
		}

		if (msg.startsWith('!')) {
			const { name, args } = utils.parseCommand(msg)
			await command(msg, name, args)
			return
		}

		await message(msg)
	}
}
