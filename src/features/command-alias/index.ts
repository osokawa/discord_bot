import { Feature } from '../feature'
import * as discordjs from 'discord.js'

export default class extends Feature {
	constructor(
		private from: string,
		private toName: string,
		private toArgs: string[]
	) {
		super()
	}

	async initImpl(): Promise<void> {
		this.registerCommand(this)
		return Promise.resolve()
	}

	async onCommand(
		msg: discordjs.Message,
		name: string,
		args: string[]
	): Promise<void> {
		if (name === this.from) {
			await this.manager.command(msg, this.toName, [
				...this.toArgs,
				...args,
			])
		}
	}
}
