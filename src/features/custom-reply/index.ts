import { promises as fs } from 'fs'
import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { Command } from 'Src/features/command'
import { StorageType } from 'Src/features/storage'
import GlobalConfig from 'Src/global-config'

import * as utils from 'Src/utils'
import { Images, isValidImageId } from 'Src/features/custom-reply/images'
import Config from 'Src/features/custom-reply/config'

type Response = {
	action: string
	text: string
	pattern: string
	image: string
	reply?: boolean
}

export class CustomReply {
	private initialized = false
	private readonly images: Images
	private readonly config: Config
	private gc: GlobalConfig

	constructor(readonly feature: FeatureCustomReply, public readonly channel: discordjs.Channel) {
		this.gc = feature.manager.gc
		this.images = new Images(this, this.gc)
		this.config = new Config(this, this.gc)
	}

	async init(): Promise<void> {
		await this.config.init()
		await this.images.init()
		this.initialized = true
	}

	private async processPickedResponse(msg: discordjs.Message, response: Response): Promise<void> {
		if (response.action === 'do-nothing') {
			return
		}

		let text = response.text || ''
		const options: discordjs.MessageOptions = {}

		if (response.action === 'gacha') {
			let list = this.images.images
			if (response.pattern) {
				list = list.filter(x => new RegExp(response.pattern).exec(x))
			}

			if (list.length === 0) {
				await this.gc.send(msg, 'customReply.gachaImageNotFound')
				return
			}
			options.files = [
				new discordjs.Attachment(this.images.getImagePathById(utils.randomPick(list))),
			]
		} else {
			const imageId = response.image
			if (imageId) {
				if (!isValidImageId(imageId)) {
					await this.gc.send(msg, 'customReply.invalidImageIdInResponse', { imageId })
					console.log(`無効な画像ID ${imageId}`)
					return
				}
				const path = this.images.getImagePathById(imageId)
				try {
					await fs.access(path)
				} catch (_) {
					await this.gc.send(msg, 'customReply.imageIdThatDoesNotExist', { imageId })
					return
				}
				const attachment = new discordjs.Attachment(path)
				options.files = [attachment]
			}
		}

		text = utils.replaceEmoji(text, msg.guild.emojis)
		if (response.reply !== undefined && !response.reply) {
			msg.channel.send(text, options)
		} else {
			msg.reply(text, options)
		}
	}

	async _processCustomResponse(msg: discordjs.Message): Promise<void> {
		for (const [, v] of this.config.config) {
			for (const content of v.contents) {
				if (new RegExp(content.target).exec(msg.content)) {
					const response = utils.randomPick(content.responses)
					await this.processPickedResponse(msg, response)
				}
			}
		}
	}

	async onCommand(msg: discordjs.Message, args: string[]): Promise<void> {
		await utils.subCommandProxy(
			{
				config: (a, m) => this.config.command(a, m),
				images: (a, m) => this.images.command(a, m),
			},
			args,
			msg
		)
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		if (msg.author.bot) {
			return
		}

		while (!this.initialized) {
			// TODO: もっとマシな方法で待ちたい
			await utils.delay(100)
		}

		await this.images.processImageUpload(msg)
		await this._processCustomResponse(msg)
	}
}

class CustomReplyCommand implements Command {
	constructor(private readonly feature: FeatureCustomReply, private readonly cmdname: string) {}

	name(): string {
		return this.cmdname
	}

	description(): string {
		return 'custom-reply'
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		await this.feature.storageDriver
			.channel(msg)
			.get<CustomReply>('customReply')
			.onCommand(msg, args)
	}
}

export class FeatureCustomReply extends CommonFeatureBase {
	constructor(private readonly cmdname: string) {
		super()
	}

	async initImpl(): Promise<void> {
		this.storageDriver.setChannelStorageConstructor(ch => {
			const client = new CustomReply(this, ch)
			client.init()
			return new StorageType(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				new Map<string, any>([['customReply', client]])
			)
		})
		this.featureCommand.registerCommand(new CustomReplyCommand(this, this.cmdname))
		return Promise.resolve()
	}

	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		await this.storageDriver
			.channel(msg)
			.get<CustomReply>('customReply')
			.onMessage(msg)
	}
}
