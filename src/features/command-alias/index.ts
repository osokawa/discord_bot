import { Feature } from '../feature'
import * as discordjs from 'discord.js'

export default class extends Feature {
	constructor(private from: string, private toName: string, private toArgs: string[]) {
		super()
	}

	async initImpl() {
		this.registerCommand(this)
	}

	async onCommand(msg: discordjs.Message, name: string, args: string[]) {
		if (name === this.from) {
			await this.manager.command(msg, this.toName, [...this.toArgs, ...args])
		}
	}
}
