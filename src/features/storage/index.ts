import * as discordjs from 'discord.js'

import { FeatureInterface, FeatureBase, FeatureEventResult } from 'Src/features/feature'
import * as utils from 'Src/utils'

export class StorageType {
	private storage: Map<string, any> = new Map()

	has(key: string): boolean {
		return this.storage.has(key)
	}

	set(key: string, value: any) {
		this.storage.set(key, value)
	}

	get<T>(key: string, defaultConstructor?: () => T): T {
		if (defaultConstructor !== undefined && !this.storage.has(key)) {
			this.storage.set(key, defaultConstructor())
		}

		return this.storage.get(key)
	}
}

export class StorageDriver {
	private _channels: Map<string, StorageType> = new Map()
	private _guilds: Map<string, StorageType> = new Map()

	private getBase(id: string, map: Map<string, StorageType>): StorageType {
		if (!map.has(id)) {
			map.set(id, new StorageType())
		}

		return map.get(id) ?? utils.unreachable()
	}

	channel(msg: discordjs.Message): StorageType {
		return this.getBase(msg.channel.id, this._channels)
	}

	guild(msg: discordjs.Message): StorageType {
		return this.getBase(msg.guild.id, this._guilds)
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
