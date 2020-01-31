const axios = require('axios')
const fs = require('fs').promises
const utils = require('../../utils.js')
const { Attachment } = require('discord.js')

function isValidImageId(id) {
	const validImageIdRegExp = /^[a-zA-Z0-9-_]{2,32}\.(png|jpg|jpeg|gif)$/
	return id.match(validImageIdRegExp) ? true : false
}
exports.isValidImageId = isValidImageId

exports.Images = class {
	#gc
	#images

	constructor(channelInstance, gc) {
		this.channelInstance = channelInstance
		this.#gc = gc
		this.state = 'free'
		this.imageName = null
	}

	async init() {
		this.#images = await fs.readdir(`./config/custom-reply/${this.channelInstance.channel.id}/images/`)
		this.#images.sort()
	}

	get images() {
		return this.#images
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

	async listCommand(rawArgs, msg) {
		let args, options
		try {
			({ args, options } = utils.parseCommandArgs(rawArgs, ['s', 'search']))
		} catch (e) {
			await this.#gc.send(msg, 'customReply.images.listInvalidCommand', { e })
			return
		}

		const search = utils.getOption(options, ['s', 'search'])
		const images = search
			? this.#images.filter(x => x.match(new RegExp(search)))
			: this.#images

		if (images.length === 0) {
			await this.#gc.send(msg, 'customReply.images.listImageNotFound')
			return
		}

		const pageNumber = parseInt(args[0], 10) || 1

		// 1ページあたり何枚の画像を表示させるか
		const imagesPerPage = 20
		const maxPage = Math.ceil(images.length / imagesPerPage)

		if (pageNumber < 1 || maxPage < pageNumber) {
			await this.#gc.send(msg, 'customReply.images.invalidPageId', { maxPage })
			return
		}

		const pagedImages = images.slice(imagesPerPage * (pageNumber - 1), imagesPerPage * pageNumber)

		await this.#gc.send(
			msg,
			'customReply.images.list',
			{ currentPage: pageNumber, maxPage, images: pagedImages.join('\n') })
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

		const index = this.#images.indexOf(args[0])
		if (index === -1) {
			await this.#gc.send(msg, 'customReply.images.imageIdThatDoesNotExist')
			return
		}

		this.#images.splice(index)
		await fs.unlink(this.getImagePathById(args[0]))

		await this.#gc.send(msg, 'customReply.images.removingComplete')
	}

	async previewCommand(args, msg) {
		if (args < 1) {
			await this.#gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(args[0])) {
			await this.#gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!this.#images.includes(args[0])) {
			await this.#gc.send(msg, 'customReply.images.imageIdThatDoesNotExist')
			return
		}

		await this.#gc.send(
			msg,
			'customReply.images.sendPreview',
			{},
			{ files: [new Attachment(this.getImagePathById(args[0]))] })
	}

	async reloadLocalCommand(args, msg) {
		await this.init()
		await this.#gc.send(msg, 'customReply.images.localReloadingComplete')
	}

	async command(args, msg) {
		await utils.subCommandProxy({
			upload: (a, m) => this.uploadCommand(a, m),
			list: (a, m) => this.listCommand(a, m),
			remove: (a, m) => this.removeCommand(a, m),
			preview: (a, m) => this.previewCommand(a, m),
			reloadLocal: (a, m) => this.reloadLocalCommand(a, m),
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
			if (!this.#images.includes(this.imageName)) {
				this.#images.push(this.imageName)
				this.#images.sort()
			}
			await this.#gc.send(msg, 'customReply.images.uploadingComplete')

			this.state = 'free'
		}
	}
}
