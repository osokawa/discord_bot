import { Client } from 'discord.js'
const client = new Client()

import FeatureManager from './features/feature-manager'
import features from '../config/features'

const featureManager = new FeatureManager()

let ready = false

client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`)

	await featureManager.init()

	for (const [k, v] of features) {
		await featureManager.registerFeature(k, v)
	}

	ready = true
})

client.on('message', async (msg) => {
	if (!ready) {
		return
	}

	featureManager.onMessage(msg)
})

process.on('SIGINT', async () => {
	client.destroy()
	await featureManager.finalize()
	console.log('discord bot was shut down.')
})

client.login(process.env.DISCORD_BOT_TOKEN)
