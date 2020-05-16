import discordjs from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'
import features from '../config/features'

const client = new discordjs.Client()
const featureManager = new FeatureManager()

let ready = false

client.on('ready', () => {
	;(async (): Promise<void> => {
		console.log(`Logged in as ${client.user!.tag}!`)

		try {
			for (const [k, v] of features) {
				featureManager.registerFeature(k, () => v)
			}

			await featureManager.init()
		} catch (e) {
			process.exit(1)
		}

		ready = true
	})()
})

client.on('message', (msg) => {
	;(async (): Promise<void> => {
		if (!ready) {
			return
		}

		if (!msg.partial) {
			await featureManager.onMessage(msg)
		}
	})()
})

process.on('SIGINT', () => {
	;(async (): Promise<void> => {
		client.destroy()
		await featureManager.finalize()
		console.log('discord bot was shut down.')
		process.exit(0)
	})()
})

client.login(process.env.DISCORD_BOT_TOKEN)
