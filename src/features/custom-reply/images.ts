import axios from 'axios'
import { promises as fs } from 'fs'
import * as utils from '../../utils'
import * as discordjs from 'discord.js'
import GlobalConfig from '../../global-config'
import { CustomReply } from '.'

export function isValidImageId(id: string): boolean {
	const validImageIdRegExp = /^[a-zA-Z0-9-_]{2,32}\.(png|jpg|jpeg|gif)$/
	return validImageIdRegExp.exec(id) ? true : false
}

export class Images {
	private _images: string[] = []
	private state = 'free'
	private imageName: string | undefined

	constructor(
		private channelInstance: CustomReply,
		private gc: GlobalConfig
	) {}

	async init(): Promise<void> {
		this._images = await fs.readdir(
			`./config/custom-reply/${this.channelInstance.channel.id}/images/`
		)
		this._images.sort()
	}

	get images(): string[] {
		return this._images
	}

	getImagePathById(id: string): string {
		return `./config/custom-reply/${this.channelInstance.channel.id}/images/${id}`
	}

	async uploadCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (this.state === 'waitingImage') {
			await this.gc.send(msg, 'customReply.images.uploadingImageCancel')
			this.state = 'free'
		}

		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(args[0])) {
			await this.gc.send(
				msg,
				'customReply.images.haveToSpecifyValidIdAndSorry'
			)
			return
		}

		this.imageName = args[0]
		this.state = 'waitingImage'
		await this.gc.send(msg, 'customReply.images.readyToUpload')
	}

	async listCommand(
		rawArgs: string[],
		msg: discordjs.Message
	): Promise<void> {
		let args, options: { [_: string]: string | boolean }
		try {
			;({ args, options } = utils.parseCommandArgs(rawArgs, [
				's',
				'search',
			]))
		} catch (e) {
			await this.gc.send(msg, 'customReply.images.listInvalidCommand', {
				e,
			})
			return
		}

		const search = utils.getOption(options, ['s', 'search'])
		const images = search
			? this._images.filter(x => new RegExp(search as string).exec(x))
			: this._images

		if (images.length === 0) {
			await this.gc.send(msg, 'customReply.images.listImageNotFound')
			return
		}

		const pageNumber = parseInt(args[0], 10) || 1

		// 1ページあたり何枚の画像を表示させるか
		const imagesPerPage = 20
		const maxPage = Math.ceil(images.length / imagesPerPage)

		if (pageNumber < 1 || maxPage < pageNumber) {
			await this.gc.send(msg, 'customReply.images.invalidPageId', {
				maxPage,
			})
			return
		}

		const pagedImages = images.slice(
			imagesPerPage * (pageNumber - 1),
			imagesPerPage * pageNumber
		)

		await this.gc.send(msg, 'customReply.images.list', {
			currentPage: pageNumber,
			maxPage,
			images: pagedImages.join('\n'),
		})
	}

	async removeCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(args[0])) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		const index = this._images.indexOf(args[0])
		if (index === -1) {
			await this.gc.send(
				msg,
				'customReply.images.imageIdThatDoesNotExist'
			)
			return
		}

		this._images.splice(index)
		await fs.unlink(this.getImagePathById(args[0]))

		await this.gc.send(msg, 'customReply.images.removingComplete')
	}

	async previewCommand(
		args: string[],
		msg: discordjs.Message
	): Promise<void> {
		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!isValidImageId(args[0])) {
			await this.gc.send(msg, 'customReply.images.haveToSpecifyId')
			return
		}

		if (!this._images.includes(args[0])) {
			await this.gc.send(
				msg,
				'customReply.images.imageIdThatDoesNotExist'
			)
			return
		}

		await this.gc.send(
			msg,
			'customReply.images.sendPreview',
			{},
			{
				files: [
					new discordjs.Attachment(this.getImagePathById(args[0])),
				],
			}
		)
	}

	async reloadLocalCommand(
		args: string[],
		msg: discordjs.Message
	): Promise<void> {
		await this.init()
		await this.gc.send(msg, 'customReply.images.localReloadingComplete')
	}

	async command(args: string[], msg: discordjs.Message): Promise<void> {
		await utils.subCommandProxy(
			{
				upload: (a, m) => this.uploadCommand(a, m),
				list: (a, m) => this.listCommand(a, m),
				remove: (a, m) => this.removeCommand(a, m),
				preview: (a, m) => this.previewCommand(a, m),
				reloadLocal: (a, m) => this.reloadLocalCommand(a, m),
			},
			args,
			msg
		)
	}

	async processImageUpload(msg: discordjs.Message): Promise<void> {
		if (this.state === 'waitingImage') {
			if (msg.attachments.size !== 1) {
				return
			}

			const res = await axios({
				method: 'get',
				url: msg.attachments.first().url,
				responseType: 'arraybuffer',
			})

			if (this.imageName === undefined) {
				throw 'なんかおかしい'
			}

			await fs.writeFile(
				this.getImagePathById(this.imageName),
				Buffer.from(res.data)
			)
			if (!this._images.includes(this.imageName)) {
				this._images.push(this.imageName)
				this._images.sort()
			}
			await this.gc.send(msg, 'customReply.images.uploadingComplete')

			this.state = 'free'
		}
	}
}
