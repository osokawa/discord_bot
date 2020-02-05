const { Feature } = require('../feature.js')

module.exports = class extends Feature {
	#from
	#toName
	#toArgs

	constructor(from, toName, toArgs) {
		super()
		this.#from = from
		this.#toName = toName
		this.#toArgs = toArgs
	}

	async initImpl() {
		this.registerCommand(this)
	}

	async onCommand(msg, name, args) {
		if (name === this.#from) {
			await this.manager.command(msg, this.#toName, [...this.#toArgs, ...args])
		}
	}
}
