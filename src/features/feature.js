class Command {
	async onCommand(msg, name, args) {
		throw new Error('Not Implemented')
	}
}

class Guild {
	createGuildInstance(guild) {
		throw new Error('Not Implemented')
	}
}

class Channel {
	createChannelInstance(guild) {
		throw new Error('Not Implemented')
	}
}

class Feature {
	#commands = []
	#guilds = []
	#channels = []

	#guildInstances = new Map()
	#channelInstances = new Map()

	#hasInitialized = false

	registerCommand(command) {
		this.#commands.push(command)
	}

	get commands() {
		return this.#commands
	}

	registerGuild(guild) {
		this.#guilds.push(guild)
	}

	get guilds() {
		return this.#guilds
	}

	registerChannel(channel) {
		this.#channels.push(channel)
	}

	get channels() {
		return this.#channels
	}

	async _dispatchBase(arr, map, id, createInstance) {
		arr.forEach((elm, idx) => {
			if (!map.has(id)) {
				map.set(id, new Map())
			}

			const mapOfId = map.get(id)
			if (!mapOfId.get(idx)) {
				mapOfId.set(idx, createInstance(elm))
			}
		})

		return map.values().map(x => x.values()).flat()
	}

	async dispatchToCommands(doWithInstance) {
		await Promise.all(this.#commands.map(instance => {
			return async () => {
				try {
					await doWithInstance(instance)
				} catch (e) {
					console.error(e)
				}
			}
		}))
	}

	async dispatchToChannels(channel, doWithInstance) {
		const channelInstances = this._dispatchBase(
			this.#channels,
			this.#channelInstances,
			x => x.createInstance(channel))

		await Promise.all(channelInstances.map(instance => {
			return async () => {
				try {
					await doWithInstance(instance)
				} catch (e) {
					console.error(e)
					channel.send('bot の処理中にエラーが発生しました。')
				}
			}
		}))
	}

	async onCommand(msg, name, args) {
		await this.dispatchToCommands(x => x.onCommand(msg, name, args))
	}

	async onMessage(msg) {
		await this.dispatchToChannels(x => x.onMessage(msg))
		await _processGuild()
	}

	hasInitialized() {
		return this.#hasInitialized
	}

	// init はこっちをオーバーライドして
	async initImpl() {
	}

	// オーバライドしないで
	async init(manager) {
		this.manager = manager
		await initImpl()
		this.hasInitialized = true
	}

	async finalize() {
	}
}

module.exports = { Command, Feature }
