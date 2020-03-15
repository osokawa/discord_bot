import { promises as fs } from 'fs'
import axios from 'axios'
import TOML from '@iarna/toml'
import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'
import { CustomReply } from 'src/features/custom-reply'

function validateParsedConfig(config: any): boolean {
	// TODO: バリデーション実施。ダメな時は throw する
	return true
}

function isValidId(id: string): boolean {
	const validIdRegExp = /^[a-zA-Z1-9-_]{2,32}$/
	return validIdRegExp.test(id)
}

export default class {
	public readonly config = new Map()
	private readonly configSources = new Map()

	constructor(private readonly channelInstance: CustomReply, private readonly gc: GlobalConfig) {}

	private async updateConfig(id: string, viaInternet = false): Promise<void> {
		const configFilePath = `./config/custom-reply/${this.channelInstance.channel.id}/${id}.dat`

		if (viaInternet) {
			const req = await axios(`${this.configSources.get(id).source}?${Math.random()}`)
			const toml = req.data
			const parsed = await TOML.parse.async(toml)
			validateParsedConfig(parsed)
			await fs.writeFile(configFilePath, toml)
			this.config.set(id, parsed)
		} else {
			const toml = await fs.readFile(configFilePath, 'utf-8')
			const parsed = await TOML.parse.async(toml)
			validateParsedConfig(parsed)
			this.config.set(id, parsed)
		}
	}

	async init(): Promise<void> {
		await fs.mkdir(`./config/custom-reply/${this.channelInstance.channel.id}/images`, {
			recursive: true,
		})

		let json
		try {
			json = await fs.readFile(
				`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`,
				'utf-8'
			)
		} catch (_) {
			return
		}

		const parsed = JSON.parse(json)
		for (const [k, v] of parsed) {
			this.configSources.set(k, v)
		}

		for (const id of this.configSources.keys()) {
			try {
				this.updateConfig(id)
			} catch (e) {
				console.error(e)
				continue
			}
		}
	}

	private async reloadLocalCommand(args: string[], msg: discordjs.Message): Promise<void> {
		for (const id of this.configSources.keys()) {
			try {
				this.updateConfig(id)
			} catch (e) {
				console.error(e)
				await this.gc.send(msg, 'customReply.config.errorOnReloading', {
					id,
				})
				continue
			}
		}
		await this.gc.send(msg, 'customReply.config.localReloadingComplete')
	}

	private async reloadCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyId')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			await this.gc.send(msg, 'customReply.config.idThatDoesNotExist')
			return
		}

		try {
			await this.updateConfig(id, true)
		} catch (e) {
			console.error(e)
			await this.gc.send(msg, 'customReply.config.errorOnReloading', {
				id,
			})
			return
		}

		await this.gc.send(msg, 'customReply.config.reloadingComplete', { id })
	}

	async writeSourcesJson(): Promise<void> {
		await fs.writeFile(
			`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`,
			JSON.stringify([...this.configSources])
		)
	}

	private async addCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 2) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyIdAndUrl')
			return
		}

		const [id, url] = args

		if (!isValidId(id)) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyValidId')
			return
		}

		if (!utils.isValidUrl(url)) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyValidUrl')
			return
		}

		this.configSources.set(id, { source: url, format: 'toml' })
		await this.updateConfig(id, true)
		await this.writeSourcesJson()

		await this.gc.send(msg, 'customReply.config.addingComplete', { id })
	}

	private async listCommand(args: string[], msg: discordjs.Message): Promise<void> {
		await this.gc.send(msg, 'customReply.config.list', {
			sources: [...this.configSources].map(([k, v]) => `${k}: ${v.source}`).join('\n'),
		})
	}

	private async removeCommand(args: string[], msg: discordjs.Message): Promise<void> {
		if (args.length < 1) {
			await this.gc.send(msg, 'customReply.config.haveToSpecifyId')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			await this.gc.send(msg, 'customReply.config.idThatDoesNotExist')
			return
		}

		this.config.delete(id)
		this.configSources.delete(id)
		await this.writeSourcesJson()

		await this.gc.send(msg, 'customReply.config.removingComplete', { id })
	}

	async command(args: string[], msg: discordjs.Message): Promise<void> {
		await utils.subCommandProxy(
			{
				reload: (a, m) => this.reloadCommand(a, m),
				reloadlocal: (a, m) => this.reloadLocalCommand(a, m),
				add: (a, m) => this.addCommand(a, m),
				list: (a, m) => this.listCommand(a, m),
				remove: (a, m) => this.removeCommand(a, m),
			},
			args,
			msg
		)
	}
}
