const fs = require('fs').promises
const utils = require('./utils.js')
const TOML = require('@iarna/toml')
const lodash = require('lodash')

module.exports = class {
	#path
	#config
	#templateCache = new Map()

	constructor(path) {
		this.#path = path
	}

	async init() {
		const toml = await fs.readFile(this.#path, 'utf-8')
		const parsed = await TOML.parse.async(toml)
		this.#config = parsed
	}

	async send(msg, key, args = {}, options = {}) {
		return await this.sendToChannel(msg.channel, key, args, options)
	}

	async sendToChannel(channel, key, args = {}, options = {}) {
		let template = lodash.get(this.#config.message, key)
		if (template === undefined) {
			template = key
		}

		template = utils.randomPick(template)
		if (lodash.isString(template)) {
			template = { text: template }
		}

		if (!this.#templateCache.has(template.text)) {
			this.#templateCache.set(template.text, lodash.template(template.text))
		}
		const compiledTemplate = this.#templateCache.get(template.text)

		return await channel.send(compiledTemplate(args), options)
	}
}
