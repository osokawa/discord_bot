const TOML = require('@iarna/toml')
const axios = require('axios')
const fs = require('fs').promises
const utils = require('../../utils.js')

function validateParsedConfig() {
	// TODO: バリデーション実施。ダメな時は throw する
}

function isValidId(id) {
	const validIdRegExp = /^[a-zA-Z1-9-_]{2,32}$/
	return id.match(validIdRegExp) ? true : false
}

module.exports = class {
	#gc

	constructor(channelInstance, gc) {
		this.channelInstance = channelInstance
		this.#gc = gc
		this.config = new Map()
		this.configSources = new Map()
	}

	async _updateConfig(id, viaInternet = false) {
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

	async init() {
		await fs.mkdir(`./config/custom-reply/${this.channelInstance.channel.id}/images`, { recursive: true })

		let json
		try {
			json = await fs.readFile(`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`, 'utf-8')
		} catch (_) {
			return
		}

		const parsed = JSON.parse(json)
		for (const [k, v] of parsed) {
			this.configSources.set(k, v)
		}

		for (const id of this.configSources.keys()) {
			try {
				this._updateConfig(id)
			} catch (e) {
				console.error(e)
				continue
			}
		}
	}

	async _processReloadLocalCommand(args, msg) {
		for (const id of this.configSources.keys()) {
			try {
				this._updateConfig(id)
			} catch (e) {
				console.error(e)
				await this.#gc.send(msg, 'customReply.config.errorOnReloading', { id })
				continue
			}
		}
		await this.#gc.send(msg, 'customReply.config.localReloadingComplete')
	}

	async _processReloadCommand(args, msg) {
		if (args.length < 1) {
			await this.#gc.send(msg, 'customReply.config.haveToSpecifyId')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			await this.#gc.send(msg, 'customReply.config.idThatDoesNotExist')
			return
		}

		try {
			await this._updateConfig(id, true)
		} catch (e) {
			console.error(e)
			await this.#gc.send(msg, 'customReply.config.errorOnReloading', { id })
			return
		}

		await this.#gc.send(msg, 'customReply.config.reloadingComplete', { id })
	}

	async writeSourcesJson() {
		await fs.writeFile(
			`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`,
			JSON.stringify([...this.configSources]))
	}

	async addCommand(args, msg) {
		if (args.length < 2) {
			await this.#gc.send(msg, 'customReply.config.haveToSpecifyIdAndUrl')
			return
		}

		const [id, url] = args

		if (!isValidId(id)) {
			await this.#gc.send(msg, 'customReply.config.haveToSpecifyValidId')
			return
		}

		if (!utils.isValidUrl(url)) {
			await this.#gc.send(msg, 'customReply.config.haveToSpecifyValidUrl')
			return
		}

		this.configSources.set(id, { source: url, format: 'toml' })
		await this._updateConfig(id, true)
		await this.writeSourcesJson()

		await this.#gc.send(msg, 'customReply.config.addingComplete', { id })
	}

	async listCommand(args, msg) {
		await this.#gc.send(msg, 'customReply.config.list', {
			sources: [...this.configSources].map(([k, v]) => `${k}: ${v.source}`).join('\n')
		})
	}

	async removeCommand(args, msg) {
		if (args.length < 1) {
			await this.#gc.send(msg, 'customReply.config.haveToSpecifyId')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			await this.#gc.send(msg, 'customReply.config.idThatDoesNotExist')
			return
		}

		this.config.delete(id)
		this.configSources.delete(id)
		await this.writeSourcesJson()

		await this.#gc.send(msg, 'customReply.config.removingComplete', { id })
	}

	async command(args, msg) {
		await utils.subCommandProxy({
			reload: (a, m) => this._processReloadCommand(a, m),
			reloadlocal: (a, m) => this._processReloadLocalCommand(a, m),
			add: (a, m) => this.addCommand(a, m),
			list: (a, m) => this.listCommand(a, m),
			remove: (a, m) => this.removeCommand(a, m)
		}, args, msg)
	}
}
