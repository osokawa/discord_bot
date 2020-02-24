import * as discordjs from 'discord.js'

import { Feature, Command } from 'Src/features/feature'
import FeatureManager from 'Src/features/feature-manager'

class CommandAliasCommand implements Command {
	constructor(
		private readonly manager: FeatureManager,
		private readonly from: string,
		private readonly toName: string,
		private readonly toArgs: string[]
	) {}

	name(): string {
		return this.from
	}

	description(): string {
		return `${this.toName} ${this.toArgs.join(' ')} へのエイリアス`
	}

	async command(msg: discordjs.Message, args: string[]): Promise<void> {
		await this.manager.command(msg, this.toName, [...this.toArgs, ...args])
	}
}

export default class extends Feature {
	constructor(
		private readonly from: string,
		private readonly toName: string,
		private readonly toArgs: string[]
	) {
		super()
	}

	async initImpl(): Promise<void> {
		this.registerCommand(
			new CommandAliasCommand(this.manager, this.from, this.toName, this.toArgs)
		)
		return Promise.resolve()
	}
}
