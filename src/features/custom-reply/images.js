const axios = require('axios')
const fs = require('fs').promises
const utils = require('../../utils.js')

function isValidImageId(id) {
	const validImageIdRegExp = /^[a-zA-Z0-9-_]{2,32}\.(png|jpg|jpeg|gif)$/
	return id.match(validImageIdRegExp) ? true : false
}
exports.isValidImageId = isValidImageId

exports.Images = class {
	#gc

	constructor(channelInstance, gc) {
		this.channelInstance = channelInstance
		this.#gc = gc
		this.state = 'free'
		this.imageName = null
	}

	getImagePathById(id) {
		return `./config/custom-reply/${this.channelInstance.channel.id}/images/${id}`
	}

	async uploadCommand(args, msg) {
		if (this.state === 'waitingImage') {
			await this.#gc.send(msg, 'customReply.images.uploadingImageCancel')
			this.state = 'free'
		}

		if (args < 1) {
			await this.#gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(args[0])) {
			await this.#gc.send(msg, 'customReply.images.haveToSpecifyValidIdAndSorry')
			return
		}

		this.imageName = args[0]
		this.state = 'waitingImage'
		await this.#gc.send(msg, 'customReply.images.readyToUpload')
	}

	async listCommand(args, msg) {
		const list = await fs.readdir(`./config/custom-reply/${this.channelInstance.channel.id}/images/`)
		await this.#gc.send(msg, 'customReply.images.list', { images: list.join('\n') })
	}

	async removeCommand(args, msg) {
		if (args < 1) {
			await this.#gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(args[0])) {
			await this.#gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		try {
			await fs.unlink(this.getImagePathById(args[0]))
		} catch (_) {
			await this.#gc.send(msg, 'customReply.images.removingFailed')
			return
		}

		await this.#gc.send(msg, 'customReply.images.removingComplete')
	}

	async command(args, msg) {
		await utils.subCommandProxy({
			upload: (a, m) => this.uploadCommand(a, m),
			list: (a, m) => this.listCommand(a, m),
			remove: (a, m) => this.removeCommand(a, m),
		}, args, msg)
	}

	async processImageUpload(msg) {
		if (this.state === 'waitingImage') {
			if (msg.attachments.size !== 1) {
				return
			}

			const res = await axios({
				method: 'get',
				url: msg.attachments.first().url,
				responseType: 'arraybuffer'
			})
			await fs.writeFile(this.getImagePathById(this.imageName), Buffer.from(res.data))
			await this.#gc.send(msg, 'customReply.images.uploadingComplete')

			this.state = 'free'
		}
	}
}
