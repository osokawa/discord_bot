import { promises as fs } from 'fs'
import * as utils from './utils'
import TOML from '@iarna/toml'
import * as lodash from 'lodash'
import * as discordjs from 'discord.js'

type Message = string | (string | { text: string; weight?: number })[]

type Messages = {
	[_: string]: Message | Messages
}

type Config = {
	message: { [_: string]: Messages }
}

export default class {
	private config: Config | undefined
	private templateCache: Map<string, lodash.TemplateExecutor> = new Map()

	constructor(private paths: string[]) {
	}

	async init(): Promise<void> {
		for (const path of this.paths) {
			const toml = await fs.readFile(path, 'utf-8')
			const parsed = await TOML.parse.async(toml)
			this.config = lodash.merge(this.config, parsed)
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async send(msg: discordjs.Message, key: string, args: any = {}, options: discordjs.MessageOptions = {}): Promise<discordjs.Message | discordjs.Message[]> {
		return await this.sendToChannel(msg.channel, key, args, options)
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async sendToChannel(channel: utils.LikeTextChannel, key: string, args: any = {}, options: discordjs.MessageOptions = {}): Promise<discordjs.Message | discordjs.Message[]> {
		let templateText = key
		if (this.config !== undefined) {
			const value: Message | Messages | undefined = lodash.get(this.config.message, key)
			if (typeof value === 'string') {
				templateText = value
			} else if (value instanceof Array) {
				const picked = utils.randomPick(value)
				if (picked instanceof Object) {
					templateText = picked.text
				}
			}
		}

		if (!this.templateCache.has(templateText)) {
			this.templateCache.set(templateText, lodash.template(templateText))
		}
		const compiledTemplate = this.templateCache.get(templateText)
		if (compiledTemplate === undefined) { utils.unreachable() }
		let text = compiledTemplate(args)
		if ('guild' in channel) {
			text = utils.replaceEmoji(text, channel.guild.emojis)
		}
		return await channel.send(text, options)
	}
}
