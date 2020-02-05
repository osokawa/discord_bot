const { Feature } = require('../feature.js')

module.exports = class extends Feature {
	async initImpl() {
		this.registerCommand(this)
	}

	async onCommand(msg, name, args) {
		if (name === 'riu') {
			this.manager.command(msg, 'reply', ['images', 'upload', ...args])
		}

		if (name === 'rls') {
			this.manager.command(msg, 'res', ['images', 'list', ...args])
		}
	}
}
