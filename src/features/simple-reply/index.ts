import * as discordjs from 'discord.js'
import { Feature, ChannelInstance } from '../feature'

class SimpleReply extends ChannelInstance {
	constructor(private feature: FeatureSimpleReply) {
		super(feature)
	}

	async onMessage(msg: discordjs.Message): Promise<void> {
		if (msg.content === 'ping') {
			msg.reply('Pong!')
		}

		if (msg.content.includes('チノちゃんかわいい')) {
			const attachment = new discordjs.Attachment('./assets/chino.png')
			await msg.reply('わかる', { files: [attachment] })
		}
	}
}

export class FeatureSimpleReply extends Feature {
	async initImpl(): Promise<void> {
		this.registerChannel(this)
	}

	createChannelInstance(): ChannelInstance {
		return new SimpleReply(this)
	}
}
