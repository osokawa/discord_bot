const { Command, Feature } = require('../feature.js')

class SimpleReply {
	constructor(feature) {
		this.feature = feature
	}

	async onMessage(msg) {
		if (msg.content === 'ping') {
			msg.reply('Pong!')
		}

		if (msg.content.indexOf('チノちゃんかわいい') !== -1) {
			const attachment = new Attachment('./assets/chino.png')
			msg.reply('わかる', { file: attachment })
		}
	}
}

module.exports = class extends Feature {
	constructor() {
		this.registerCommand(this)
	}

	async onCommand(msg, name, args) {
		if (name === 'riu') {
			this.manager.command(msg, 'reply', ['images', 'upload', ...args])
		}
	}

	createChannelInstance(channel) {
		return new SimpleReply(this, channel)
	}
}
