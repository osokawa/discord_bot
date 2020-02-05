class Command {
	onCommand(msg, name, args) {
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

	async dispatchToChannels(channel, doWithInstance) {
		const channelInstances = this._dispatchBase(
			this.#channels,
			this.#channelInstances,
			x => x.createInstance(channel))

		await Promise.all(channelInstances.map(instance => {
			return async x => {
				try {
					await doWithInstance(x)
				} catch (e) {
					console.error(e)
					channel.send('bot の処理中にエラーが発生しました。')
				}
			}
		}))
	}

	async _processGuild() {}

	async _processCommand() {}

	async onMessage(msg) {
		await dispatchToChannels(async x => x.onMessage(msg))
		await _processGuild()
	}
}

module.exports = { Command, Feature }
