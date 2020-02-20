import * as discordjs from 'discord.js'
import * as utils from '../../utils'
import { promises as fs } from 'fs'
import { Images, isValidImageId } from './images'
import Config from './config'
import { Feature } from '../feature'
import GlobalConfig from '../../global-config'

type Response = {
	action: string
	text: string
	pattern: string
	image: string
	reply?: boolean
}

export class CustomReply {
	private initialized = false
	private images: Images
	private config: Config

	constructor(private feature: FeatureCustomReply, public channel: discordjs.Channel, private readonly gc: GlobalConfig) {
		this.images = new Images(this, gc)
		this.config = new Config(this, gc)
	}

	async init() {
		await this.config.init()
		await this.images.init()
		this.initialized = true
	}

	async _processPickedResponse(msg: discordjs.Message, response: Response) {
		if (response.action === 'do-nothing') {
			return
		}

		let text = response.text || ''
		let options: discordjs.MessageOptions = {}

		if (response.action === 'gacha') {
			let list = this.images.images
			if (response.pattern) {
				list = list.filter(x => x.match(new RegExp(response.pattern)))
			}

			if (list.length === 0) {
				await this.gc.send(msg, 'customReply.gachaImageNotFound')
				return
			}
			options.files = [new discordjs.Attachment(this.images.getImagePathById(utils.randomPick(list)))]
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

	async _processCustomResponse(msg: discordjs.Message) {
		for (const [, v] of this.config.config) {
			for (const content of v.contents) {
				if (msg.content.match(new RegExp(content.target))) {
					const response = utils.randomPick(content.responses)
					await this._processPickedResponse(msg, response)
				}
			}
		}
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]) {
		if (name !== this.feature.cmdname) {
			return
		}

		await utils.subCommandProxy({
			config: (a, m) => this.config.command(a, m),
			images: (a, m) => this.images.command(a, m),
		}, args, msg)
	}

	async onMessage(msg: discordjs.Message) {
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

	async initImpl() {
		this.registerChannel(this)
		this.registerCommand(this)
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]) {
		await this.dispatchToChannels(msg.channel, (x: CustomReply) => x.onCommand(msg, name, args))
	}

	createChannelInstance(channel: discordjs.Channel) {
		const client = new CustomReply(this, channel, this.gc)
		client.init()
		return client
	}
}
