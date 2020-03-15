import * as discordjs from 'discord.js'

import CommonFeatureBase from 'Src/features/common-feature-base'
import { FeatureCommand, Command } from 'Src/features/command'

class CommandAliasCommand implements Command {
	constructor(
		private readonly featureCommand: FeatureCommand,
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
		await this.featureCommand.command(msg, this.toName, [...this.toArgs, ...args])
	}
}

export default class extends CommonFeatureBase {
	constructor(
		private readonly from: string,
		private readonly toName: string,
		private readonly toArgs: string[]
	) {
		super()
	}

	protected initImpl(): Promise<void> {
		this.featureCommand.registerCommand(
			new CommandAliasCommand(this.featureCommand, this.from, this.toName, this.toArgs)
		)

		return Promise.resolve()
	}
}
