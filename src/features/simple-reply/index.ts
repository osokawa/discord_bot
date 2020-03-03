import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'

export class FeatureSimpleReply extends CommonFeatureBase {
	async onMessageImpl(msg: discordjs.Message): Promise<void> {
		if (msg.content === 'ping') {
			msg.reply('Pong!')
		}

		if (msg.content.includes('チノちゃんかわいい')) {
			const attachment = new discordjs.Attachment('./assets/chino.png')
			await msg.reply('わかる', { files: [attachment] })
		}
	}
}
