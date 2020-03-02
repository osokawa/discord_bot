import * as discordjs from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'
import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'

export abstract class ChannelInstance {
	protected readonly gc: GlobalConfig
	constructor(feature: Feature) {
		this.gc = feature.gc
	}

	abstract onMessage(msg: discordjs.Message): Promise<void>
}

export interface Channel {
	createChannelInstance(channel: utils.LikeTextChannel): ChannelInstance
}

export abstract class GuildInstance {
	protected readonly gc: GlobalConfig
	constructor(feature: Feature) {
		this.gc = feature.gc
	}

	abstract onMessage(msg: discordjs.Message): Promise<void>
}

export interface Guild {
	createGuildInstance(guild: discordjs.Guild): GuildInstance
}

export interface Command {
	name(): string
	description(): string
	command(msg: discordjs.Message, args: string[]): Promise<void>
}

export interface FeatureEventResult {
	preventNext?: boolean
	continuation?: () => Promise<void>
	context?: FeatureEventContext
}

export type FeatureEventContext = { [key: string]: any }

export interface FeatureInterface {
	preInit(manager: FeatureManager): void
	init(manager: FeatureManager): Promise<void>
	finalize(): Promise<void>
	readonly priority: number

	onMessage(msg: discordjs.Message, context: FeatureEventContext): FeatureEventResult

	hasInitialized(): boolean
}

export class FeatureBase implements FeatureInterface {
	private _hasInitialized = false
	protected _manager: FeatureManager | undefined

	preInit(manager: FeatureManager): void {
		// 必要ならオーバーライドしてね
	}

	protected get manager(): FeatureManager {
		return this._manager ?? utils.unreachable()
	}

	// init はこっちをオーバーライドして
	protected initImpl(): Promise<void> {
		return Promise.resolve()
	}

	async init(manager: FeatureManager): Promise<void> {
		this._manager = manager
		await this.initImpl()
		this._hasInitialized = true
	}

	finalize(): Promise<void> {
		return Promise.resolve()
	}
	priority = 0

	onMessage(msg: discordjs.Message, context: FeatureEventContext): FeatureEventResult {
		return {}
	}

	hasInitialized(): boolean {
		return this._hasInitialized
	}
}

export abstract class Feature {
	private readonly _commands: Command[] = []
	private readonly _guilds: Guild[] = []
	private readonly _channels: Channel[] = []

	private readonly _guildInstances: Map<string, Map<number, GuildInstance>> = new Map()
	private readonly _channelInstances: Map<string, Map<number, ChannelInstance>> = new Map()

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

	private dispatchBase<ArrayType, IdType, InstanceType>(
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

			const mapOfId = instancesMap.get(id) ?? utils.unreachable()
			if (!mapOfId.has(idx)) {
				mapOfId.set(idx, createInstance(elm))
			}
		})

		const tmp = instancesMap.get(id) ?? utils.unreachable()
		return Array.from(tmp.values())
	}

	async dispatchToChannels(
		channel: utils.LikeTextChannel,
		doWithInstance: (i: ChannelInstance) => Promise<void>
	): Promise<void> {
		const channelInstances = this.dispatchBase(
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

		const channelInstances = this.dispatchBase(
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
		const cmd = this._commands.find(x => x.name() === name)
		if (cmd === undefined) {
			return
		}
		await cmd.command(msg, args)
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		await this.dispatchToChannels(msg.channel, x => x.onMessage(msg))
		await this.dispatchToGuilds(msg.guild, x => x.onMessage(msg))
	}

	get hasInitialized(): boolean {
		return this._hasInitialized
	}

	// init はこっちをオーバーライドして
	protected abstract initImpl(): Promise<void>

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
