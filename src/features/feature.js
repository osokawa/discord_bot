const utils = require('../utils.js')

class Channel {
	createChannelInstance(channel) {
		throw new Error('Not Implemented')
	}
}

class Guild {
	createGuildInstance(guild) {
		throw new Error('Not Implemented')
	}
}

class Command {
	async onCommand(msg, name, args) {
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

	_dispatchBase(arr, instancesMap, id, createInstance) {
		if (arr.length === 0) {
			return []
		}

		arr.forEach((elm, idx) => {
			if (!instancesMap.has(id)) {
				instancesMap.set(id, new Map())
			}

			const mapOfId = instancesMap.get(id)
			if (!mapOfId.get(idx)) {
				mapOfId.set(idx, createInstance(elm))
			}
		})

		return Array.from(instancesMap.get(id).values())
	}

	async dispatchToChannels(channel, doWithInstance) {
		const channelInstances = this._dispatchBase(
			this.#channels,
			this.#channelInstances,
			channel.id,
			x => x.createChannelInstance(channel))

		await utils.forEachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToGuilds(guild, doWithInstance) {
		if (!guild) {
			return
		}

		const channelInstances = this._dispatchBase(
			this.#guilds,
			this.#guildInstances,
			guild.id,
			x => x.createGuildInstance(guild))

		await utils.forEachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToCommands(doWithInstance) {
		await utils.forEachAsyncOf(this.#commands, doWithInstance)
	}

	async onCommand(msg, name, args) {
		await this.dispatchToCommands(x => x.onCommand(msg, name, args))
	}

	async onMessage(msg) {
		await this.dispatchToChannels(msg.channel, x => x.onMessage(msg))
		await this.dispatchToGuilds(msg.guild, x => x.onMessage(msg))
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
		await this.initImpl()
		this.hasInitialized = true
	}

	async finalize() {
	}
}

module.exports = { Channel, Guild, Command, Feature }
