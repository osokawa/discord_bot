import * as discordjs from 'discord.js'

import { FeatureBase, FeatureEventContext, FeatureEventResult } from 'Src/features/feature'
import { FeatureCommand } from 'Src/features/command'
import { StorageDriver, FeatureStorage } from 'Src/features/storage'

export default class extends FeatureBase {
	protected featureCommand!: FeatureCommand
	protected featureStorage!: FeatureStorage
	public storageDriver!: StorageDriver

	protected preInitImpl(): void {
		this.featureCommand = this.manager.registerFeature('command', () => new FeatureCommand())
		this.featureStorage = this.manager.registerFeature('storage', () => new FeatureStorage())
		this.storageDriver = this.featureStorage.getStorageDriver(this)
	}

	onMessage(msg: discordjs.Message, context: FeatureEventContext): FeatureEventResult {
		return {
			continuation: async (): Promise<void> => {
				await this.onMessageImpl(msg, context)
			},
		}
	}

	// TODO: disable-next-line を使わずに警告を消す方法は無いか?
	protected async onMessageImpl(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		msg: discordjs.Message,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		context: FeatureEventContext
	): Promise<void> {
		return Promise.resolve()
	}
}
