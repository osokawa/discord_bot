import { promises as fs } from 'fs'
import * as utils from './utils'
import TOML from '@iarna/toml'
import * as lodash from 'lodash'
import * as discordjs from 'discord.js'

export default class {
	private config: any = {}
	private templateCache = new Map()

	constructor(private paths: string[]) {
	}

	async init() {
		for (const path of this.paths) {
			const toml = await fs.readFile(path, 'utf-8')
			const parsed = await TOML.parse.async(toml)
			this.config = lodash.merge(this.config, parsed)
		}
	}

	async send(msg: discordjs.Message, key: string, args = {}, options = {}) {
		return await this.sendToChannel(msg.channel, key, args, options)
	}

	async sendToChannel(channel: discordjs.TextChannel | discordjs.GroupDMChannel | discordjs.DMChannel, key: string, args = {}, options = {}) {
		let template = lodash.get(this.config.message, key)
		if (template === undefined) {
			template = key
		}

		template = utils.randomPick(template)
		if (lodash.isString(template)) {
			template = { text: template }
		}

		if (!this.templateCache.has(template.text)) {
			this.templateCache.set(template.text, lodash.template(template.text))
		}
		const compiledTemplate = this.templateCache.get(template.text)
		let text = compiledTemplate(args)
		if ('guild' in channel) {
			text = utils.replaceEmoji(text, channel.guild.emojis)
		}
		return await channel.send(text, options)
	}
}
