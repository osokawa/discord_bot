import * as discordjs from 'discord.js'

import { FeatureInterface, FeatureBase } from 'Src/features/feature'
import * as utils from 'Src/utils'

export class StorageType {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private storage: Map<string, any>

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(defaultValue: Map<string, any> = new Map()) {
		this.storage = defaultValue
	}

	has(key: string): boolean {
		return this.storage.has(key)
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	set(key: string, value: any): void {
		this.storage.set(key, value)
	}

	get<T>(key: string, defaultConstructor?: () => T): T {
		if (defaultConstructor !== undefined && !this.storage.has(key)) {
			this.storage.set(key, defaultConstructor())
		}

		return this.storage.get(key)
	}
}

type ChannelStorageConstructorType = (channel: utils.LikeTextChannel) => StorageType
type GuildStorageConstructorType = (guild: discordjs.Guild) => StorageType

export class StorageDriver {
	private _channels: Map<string, StorageType> = new Map()
	private _guilds: Map<string, StorageType> = new Map()

	private channelStorageConstructor: ChannelStorageConstructorType = () => new StorageType()
	private guildStorageConstructor: GuildStorageConstructorType = () => new StorageType()

	private getBase(
		id: string,
		map: Map<string, StorageType>,
		storageConstructor: () => StorageType
	): StorageType {
		if (!map.has(id)) {
			map.set(id, storageConstructor())
		}

		return map.get(id) ?? utils.unreachable()
	}

	channel(msg: discordjs.Message): StorageType {
		return this.getBase(msg.channel.id, this._channels, () =>
			this.channelStorageConstructor(msg.channel)
		)
	}

	setChannelStorageConstructor(storageConstructor: ChannelStorageConstructorType): void {
		this.channelStorageConstructor = storageConstructor
	}

	guild(msg: discordjs.Message): StorageType {
		return this.getBase(msg.guild.id, this._guilds, () =>
			this.guildStorageConstructor(msg.guild)
		)
	}

	setGuildStorageConstructor(storageConstructor: GuildStorageConstructorType): void {
		this.guildStorageConstructor = storageConstructor
	}
}

export class FeatureStorage extends FeatureBase {
	private storageDrivers: Map<FeatureInterface, StorageDriver> = new Map()

	getStorageDriver(feature: FeatureInterface): StorageDriver {
		if (!this.storageDrivers.has(feature)) {
			this.storageDrivers.set(feature, new StorageDriver())
		}

		return this.storageDrivers.get(feature) ?? utils.unreachable()
	}
}
