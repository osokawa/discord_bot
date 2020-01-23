const TOML = require('@iarna/toml')
const axios = require('axios')
const fs = require('fs').promises
const utils = require('../../utils.js')

function validateParsedConfig(config) {
	// TODO: バリデーション実施。ダメな時は throw する
}

module.exports = class {
	constructor(channelInstance) {
		this.channelInstance = channelInstance
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
				msg.channel.send(`id: ${id} のリロード中にエラーが発生したロボ…`)
				continue
			}
		}
		msg.channel.send('customReply のローカル設定をリロードしたロボ!')
	}

	async _processReloadCommand(args, msg) {
		if (args.length < 1) {
			msg.channel.send('ID を指定して欲しいだなも')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			msg.channel.send('そんな ID は存在しないんだなも!')
			return
		}

		try {
			await this._updateConfig(id, true)
		} catch (e) {
			console.error(e)
			msg.channel.send(`id: ${id} のリロード中にエラーが発生したロボ…`)
			return
		}

		msg.channel.send(`id: ${id} の customReply の設定をリロードしたロボ!`)
	}

	async writeSourcesJson() {
		await fs.writeFile(
			`./config/custom-reply/${this.channelInstance.channel.id}/sources.json`,
			JSON.stringify([...this.configSources]))
	}

	async addCommand(args, msg) {
		if (args.length < 2) {
			msg.channel.send('ID と URL をして欲しいだなも')
		}

		const [id, url] = args

		// TODO: ID と URL の妥当性チェック

		this.configSources.set(id, { source: url, format: 'toml' })
		await this._updateConfig(id, true)
		await this.writeSourcesJson()

		msg.channel.send(`id: ${id} の設定を追加したロボ! メンテナンス頑張ってロボ!`)
	}

	async listCommand(args, msg) {
		msg.channel.send("登録されているソース一覧ロボ\n"
			+ [...this.configSources].map(([k, v]) => `${k}: ${v.source}`).join("\n"))
	}

	async removeCommand(args, msg) {
		if (args.length < 1) {
			msg.channel.send('ID を指定して欲しいだなも')
			return
		}

		const id = args[0]

		if (!this.configSources.has(id)) {
			msg.channel.send('そんな ID は存在しないんだなも!')
			return
		}

		this.config.delete(id)
		this.configSources.delete(id)
		await this.writeSourcesJson()

		msg.channel.send(`id: ${id} のソースを削除したロボ。いままでお疲れさまロボ。`)
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
