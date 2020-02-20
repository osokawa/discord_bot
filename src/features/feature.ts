import * as utils from '../utils'
import * as discordjs from 'discord.js'
import FeatureManager from './feature-manager'

export class Channel {
	createChannelInstance(channel: discordjs.Channel) {
		throw new Error('Not Implemented')
	}
}

export class Guild {
	createGuildInstance(guild: discordjs.Guild) {
		throw new Error('Not Implemented')
	}
}

export class Command {
	async onCommand(msg: discordjs.Message, name: string, args: string[]) {
		throw new Error('Not Implemented')
	}
}

export class Feature {
	private _commands: Command[] = []
	private _guilds: Guild[] = []
	private _channels: Channel[] = []

	private _guildInstances: Map<string, any> = new Map()
	private _channelInstances: Map<string, any> = new Map()

	private _hasInitialized: boolean = false
	private _manager: FeatureManager | undefined

	registerCommand(command: Command) {
		this._commands.push(command)
	}

	get commands() {
		return this._commands
	}

	registerGuild(guild: Guild) {
		this._guilds.push(guild)
	}

	get guilds() {
		return this._guilds
	}

	registerChannel(channel: Channel) {
		this._channels.push(channel)
	}

	get channels() {
		return this._channels
	}

	protected get manager() {
		if (this._manager === undefined) {
			throw '#init() を先に呼んで'
		}

		return this._manager
	}

	protected get gc() {
		return this.manager.gc
	}

	private _dispatchBase<ArrayType, IdType, InstanceType>(
		arr: ArrayType[],
		instancesMap: Map<IdType, Map<number, InstanceType>>,
		id: IdType,
		createInstance: (x: ArrayType) => InstanceType): InstanceType[] {

		if (arr.length === 0) {
			return []
		}

		arr.forEach((elm, idx) => {
			if (!instancesMap.has(id)) {
				instancesMap.set(id, new Map())
			}

			const mapOfId = instancesMap.get(id)!
			if (!mapOfId.has(idx)) {
				mapOfId.set(idx, createInstance(elm))
			}
		})

		return Array.from(instancesMap.get(id)!.values())
	}

	async dispatchToChannels(channel: discordjs.Channel, doWithInstance: (i: any) => Promise<void>) {
		const channelInstances = this._dispatchBase(
			this._channels,
			this._channelInstances,
			channel.id,
			x => x.createChannelInstance(channel))

		await utils.forEachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToGuilds(guild: discordjs.Guild, doWithInstance: (i: any) => Promise<void>) {
		if (!guild) {
			return
		}

		const channelInstances = this._dispatchBase(
			this._guilds,
			this._guildInstances,
			guild.id,
			x => x.createGuildInstance(guild))

		await utils.forEachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToCommands(doWithInstance: (i: any) => Promise<void>) {
		await utils.forEachAsyncOf(this._commands, doWithInstance)
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]) {
		await this.dispatchToCommands(x => x.onCommand(msg, name, args))
	}

	async onMessage(msg: discordjs.Message) {
		await this.dispatchToChannels(msg.channel, x => x.onMessage(msg))
		await this.dispatchToGuilds(msg.guild, x => x.onMessage(msg))
	}

	hasInitialized() {
		return this._hasInitialized
	}

	// init はこっちをオーバーライドして
	async initImpl() {
	}

	// オーバライドしないで
	async init(manager: FeatureManager) {
		this._manager = manager
		await this.initImpl()
		this._hasInitialized = true
	}

	async finalize() {
	}
}
