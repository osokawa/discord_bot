import * as discordjs from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'
import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'

export abstract class ChannelInstance {
	protected gc: GlobalConfig
	constructor(feature: Feature) {
		this.gc = feature.gc
	}

	abstract onMessage(msg: discordjs.Message): Promise<void>
}

export interface Channel {
	createChannelInstance(channel: utils.LikeTextChannel): ChannelInstance
}

export abstract class GuildInstance {
	protected gc: GlobalConfig
	constructor(feature: Feature) {
		this.gc = feature.gc
	}

	abstract onMessage(msg: discordjs.Message): Promise<void>
}

export interface Guild {
	createGuildInstance(guild: discordjs.Guild): GuildInstance
}

export interface Command {
	onCommand(msg: discordjs.Message, name: string, args: string[]): Promise<void>
}

export abstract class Feature {
	private _commands: Command[] = []
	private _guilds: Guild[] = []
	private _channels: Channel[] = []

	private _guildInstances: Map<string, Map<number, GuildInstance>> = new Map()
	private _channelInstances: Map<string, Map<number, ChannelInstance>> = new Map()

	private _hasInitialized = false
	private _manager: FeatureManager | undefined

	registerCommand(command: Command): void {
		this._commands.push(command)
	}

	get commands(): Command[] {
		return this._commands
	}

	registerGuild(guild: Guild): void {
		this._guilds.push(guild)
	}

	get guilds(): Guild[] {
		return this._guilds
	}

	registerChannel(channel: Channel): void {
		this._channels.push(channel)
	}

	get channels(): Channel[] {
		return this._channels
	}

	get manager(): FeatureManager {
		if (this._manager === undefined) {
			throw '#init() を先に呼んで'
		}

		return this._manager
	}

	get gc(): GlobalConfig {
		return this.manager.gc
	}

	private _dispatchBase<ArrayType, IdType, InstanceType>(
		arr: ArrayType[],
		instancesMap: Map<IdType, Map<number, InstanceType>>,
		id: IdType,
		createInstance: (x: ArrayType) => InstanceType
	): InstanceType[] {
		if (arr.length === 0) {
			return []
		}

		arr.forEach((elm, idx) => {
			if (!instancesMap.has(id)) {
				instancesMap.set(id, new Map())
			}

			const mapOfId = instancesMap.get(id)
			if (mapOfId === undefined) {
				utils.unreachable()
			}
			if (!mapOfId.has(idx)) {
				mapOfId.set(idx, createInstance(elm))
			}
		})

		const tmp = instancesMap.get(id)
		if (tmp === undefined) {
			utils.unreachable()
		}
		return Array.from(tmp.values())
	}

	async dispatchToChannels(
		channel: utils.LikeTextChannel,
		doWithInstance: (i: ChannelInstance) => Promise<void>
	): Promise<void> {
		const channelInstances = this._dispatchBase(
			this._channels,
			this._channelInstances,
			channel.id,
			x => x.createChannelInstance(channel)
		)

		await utils.forEachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToGuilds(
		guild: discordjs.Guild,
		doWithInstance: (i: GuildInstance) => Promise<void>
	): Promise<void> {
		if (!guild) {
			return
		}

		const channelInstances = this._dispatchBase(
			this._guilds,
			this._guildInstances,
			guild.id,
			x => x.createGuildInstance(guild)
		)

		await utils.forEachAsyncOf(channelInstances, doWithInstance)
	}

	async dispatchToCommands(doWithInstance: (i: Command) => Promise<void>): Promise<void> {
		await utils.forEachAsyncOf(this._commands, doWithInstance)
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]): Promise<void> {
		await this.dispatchToCommands(x => x.onCommand(msg, name, args))
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		await this.dispatchToChannels(msg.channel, x => x.onMessage(msg))
		await this.dispatchToGuilds(msg.guild, x => x.onMessage(msg))
	}

	get hasInitialized(): boolean {
		return this._hasInitialized
	}

	// init はこっちをオーバーライドして
	abstract initImpl(): Promise<void>

	// オーバライドしないで
	async init(manager: FeatureManager): Promise<void> {
		this._manager = manager
		await this.initImpl()
		this._hasInitialized = true
	}

	async finalize(): Promise<void> {
		// オーバーライドしていいよ
	}
}
