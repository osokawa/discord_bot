const axios = require('axios')
const fs = require('fs').promises
const utils = require('../../utils.js')

function isValidImageId(id) {
	const validImageIdRegExp = /^[a-zA-Z0-9-_]{2,32}\.(png|jpg|jpeg|gif)$/
	return id.match(validImageIdRegExp) ? true : false
}
exports.isValidImageId = isValidImageId

exports.Images = class {
	constructor(channelInstance) {
		this.channelInstance = channelInstance
		this.state = 'free'
		this.imageName = null
	}

	getImagePathById(id) {
		return `./config/custom-reply/${this.channelInstance.channel.id}/images/${id}`
	}

	async uploadCommand(args, msg) {
		if (this.state === 'waitingImage') {
			msg.channel.send('画像のアップロードをキャンセルしたロボ')
			this.state = 'free'
		}

		if (args < 1) {
			msg.channel.send('idを指定して欲しいロボ')
			return
		}

		if (!isValidImageId(args[0])) {
			msg.channel.send('マトモなidを指定して欲しいロボ。申し訳ないロボ…\nあと拡張子は必須ロボよ')
			return
		}

		this.imageName = args[0]
		this.state = 'waitingImage'
		msg.channel.send('画像を送信するロボ')
	}

	async listCommand(args, msg) {
		const list = await fs.readdir(`./config/custom-reply/${this.channelInstance.channel.id}/images/`)
		msg.channel.send('これがファイルリストロボよー\n' + list.join('\n'))
	}

	async removeCommand(args, msg) {
		if (args < 1) {
			msg.channel.send('idを指定して欲しいロボ')
			return
		}

		if (!isValidImageId(args[0])) {
			msg.channel.send('マトモなidを指定するロボ')
			return
		}

		try {
			await fs.unlink(this.getImagePathById(args[0]))
		} catch (_) {
			msg.channel.send('画像の削除に失敗したロボ。そもそも存在しないidを指定していないかロボ?')
			return
		}

		msg.channel.send('画像を削除したロボ!')
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
			msg.channel.send('画像のアップロードが完了したロボよー')

			this.state = 'free'
		}
	}
}
