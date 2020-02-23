import { Client } from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'
import features from '../config/features'

const client = new Client()
const featureManager = new FeatureManager()

let ready = false

client.on('ready', () => {
	;(async (): Promise<void> => {
		console.log(`Logged in as ${client.user.tag}!`)

		await featureManager.init()

		for (const [k, v] of features) {
			await featureManager.registerFeature(k, v)
		}

		ready = true
	})()
})

client.on('message', msg => {
	;(async (): Promise<void> => {
		if (!ready) {
			return
		}

		await featureManager.onMessage(msg)
	})()
})

process.on('SIGINT', () => {
	;(async (): Promise<void> => {
		client.destroy()
		await featureManager.finalize()
		console.log('discord bot was shut down.')
	})()
})

client.login(process.env.DISCORD_BOT_TOKEN)
