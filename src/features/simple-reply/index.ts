import * as discordjs from 'discord.js'
import { Feature } from '../feature'

class SimpleReply {
	constructor(private feature: FeatureSimpleReply) {
	}

	async onMessage(msg: discordjs.Message) {
		if (msg.content === 'ping') {
			msg.reply('Pong!')
		}

		if (msg.content.indexOf('チノちゃんかわいい') !== -1) {
			const attachment = new discordjs.Attachment('./assets/chino.png')
			msg.reply('わかる', { files: [attachment] })
		}
	}
}

export class FeatureSimpleReply extends Feature {
	async initImpl() {
		this.registerChannel(this)
	}

	createChannelInstance(channel: discordjs.Channel) {
		return new SimpleReply(this)
	}
}
