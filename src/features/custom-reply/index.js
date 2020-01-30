const { Attachment } = require('discord.js')
const utils = require('../../utils.js')
const fs = require('fs').promises
const { Images, isValidImageId } = require('./images.js')
const Config = require('./config.js')

class CustomReply {
	#gc

	constructor(feature, channel, gc) {
		this.feature = feature
		this.channel = channel
		this.#gc = gc
		this.initialized = false
		this.images = new Images(this, gc)
		this.config = new Config(this, gc)
	}

	async init() {
		await this.config.init()
		this.initialized = true
	}

	async _processCustomResponse(msg) {
		for (const [, v] of this.config.config) {
			for (const content of v.contents) {
				if (msg.content.match(new RegExp(content.target))) {
					const response = utils.randomPick(content.responses)
					let text = response.text || ''
					let options = {}

					const imageId = response.image
					if (imageId) {
						if (!isValidImageId(imageId)) {
							await this.#gc.send(msg, 'customReply.invalidImageIdInResponse', { imageId })
							console.log(`無効な画像ID ${imageId}`)
							break
						}
						const path = this.images.getImagePathById(imageId)
						try {
							await fs.access(path)
						} catch (_) {
							await this.#gc.send(msg, 'customReply.imageIdThatDoesNotExist', { imageId })
							break
						}
						const attachment = new Attachment(path)
						options = { ...options, file: attachment }
					}

					text = utils.replaceEmoji(text, msg.guild.emojis)
					if (response.reply !== undefined && !response.reply) {
						msg.channel.send(text, options)
					} else {
						msg.reply(text, options)
					}
					break
				}
			}
		}
	}

	async _command(args, msg) {
		await utils.subCommandProxy({
			config: (a, m) => this.config.command(a, m),
			images: (a, m) => this.images.command(a, m),
		}, args, msg)
	}

	async onMessage(msg) {
		if (msg.author.bot) {
			return
		}

		while (!this.initialized) {
			// TODO: もっとマシな方法で待ちたい
			await utils.delay(100)
		}

		const command = utils.parseCommand(msg.content)
		if (command && command.commandName === this.feature.cmdname) {
			await this._command(command.args, msg)
		}

		await this.images.processImageUpload(msg)
		await this._processCustomResponse(msg)
	}
}

module.exports = class {
	#gc

	constructor(cmdname) {
		this.cmdname = cmdname
	}

	async init(gc) {
		this.#gc = gc
	}

	async finalize() {
	}

	createChannelInstance(channel) {
		const client = new CustomReply(this, channel, this.#gc)
		client.init()
		return client
	}
}
