const { Attachment } = require('discord.js')
const utils = require('../../utils.js')
const fs = require('fs').promises
const { Images, isValidImageId } = require('./images.js')
const Config = require('./config.js')

function replaceEmoji(text, emojis) {
	return text.replace(/:(\w+):/g, (match, emojiName) => {
		const foundEmoji = emojis.find(x => x.name === emojiName)
		return foundEmoji ? foundEmoji.toString() : match
	})
}

class CustomReply {
	constructor(feature, channel) {
		this.feature = feature
		this.channel = channel
		this.initialized = false
		this.images = new Images(this)
		this.config = new Config(this)
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
							msg.channel.send(
								`どうにも無効な画像ID ${imageId} がレスポンスに含まれているようだロボ`
								+ '\nインジェクションを試みてないかロボ? 絶対にやめるロボよ…')
							console.log(`無効な画像ID ${imageId}`)
							break
						}
						const path = this.images.getImagePathById(imageId)
						try {
							await fs.access(path)
						} catch (_) {
							msg.channel.send(`どうも使用できない画像 ${imageId} がレスポンスに含まれているようだロボ`)
							break
						}
						const attachment = new Attachment(path)
						options = { ...options, file: attachment }
					}

					text = replaceEmoji(text, msg.guild.emojis)
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
	constructor(cmdname) {
		this.cmdname = cmdname
	}

	async init() {
	}

	async finalize() {
	}

	createChannelInstance(channel) {
		const client = new CustomReply(this, channel)
		client.init()
		return client
	}
}
