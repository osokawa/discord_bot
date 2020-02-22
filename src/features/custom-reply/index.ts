import * as discordjs from 'discord.js'
import * as utils from '../../utils'
import { promises as fs } from 'fs'
import { Images, isValidImageId } from './images'
import Config from './config'
import { Feature, ChannelInstance } from '../feature'

type Response = {
	action: string
	text: string
	pattern: string
	image: string
	reply?: boolean
}

export class CustomReply extends ChannelInstance {
	private initialized = false
	private images: Images
	private config: Config

	constructor(
		private feature: FeatureCustomReply,
		public channel: discordjs.Channel
	) {
		super(feature)
		this.images = new Images(this, this.gc)
		this.config = new Config(this, this.gc)
	}

	async init(): Promise<void> {
		await this.config.init()
		await this.images.init()
		this.initialized = true
	}

	async _processPickedResponse(
		msg: discordjs.Message,
		response: Response
	): Promise<void> {
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
				new discordjs.Attachment(
					this.images.getImagePathById(utils.randomPick(list))
				),
			]
		} else {
			const imageId = response.image
			if (imageId) {
				if (!isValidImageId(imageId)) {
					await this.gc.send(
						msg,
						'customReply.invalidImageIdInResponse',
						{ imageId }
					)
					console.log(`無効な画像ID ${imageId}`)
					return
				}
				const path = this.images.getImagePathById(imageId)
				try {
					await fs.access(path)
				} catch (_) {
					await this.gc.send(
						msg,
						'customReply.imageIdThatDoesNotExist',
						{ imageId }
					)
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
					await this._processPickedResponse(msg, response)
				}
			}
		}
	}

	async onCommand(
		msg: discordjs.Message,
		name: string,
		args: string[]
	): Promise<void> {
		if (name !== this.feature.cmdname) {
			return
		}

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

export class FeatureCustomReply extends Feature {
	constructor(public cmdname: string) {
		super()
	}

	async initImpl(): Promise<void> {
		this.registerChannel(this)
		this.registerCommand(this)
		return Promise.resolve()
	}

	async onCommand(
		msg: discordjs.Message,
		name: string,
		args: string[]
	): Promise<void> {
		await this.dispatchToChannels(msg.channel, x =>
			(x as CustomReply).onCommand(msg, name, args)
		)
	}

	createChannelInstance(channel: discordjs.Channel): ChannelInstance {
		const client = new CustomReply(this, channel)
		client.init()
		return client
	}
}
