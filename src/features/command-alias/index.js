const { Command, Feature } = require('../feature.js')

module.exports = class extends Feature {
	async initImpl() {
		this.registerCommand(this)
	}

	async onCommand(msg, name, args) {
		if (name === 'riu') {
			this.manager.command(msg, 'reply', ['images', 'upload', ...args])
		}
	}
}
