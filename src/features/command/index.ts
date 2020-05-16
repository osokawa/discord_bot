import * as discordjs from 'discord.js'

import { FeatureBase, FeatureEventResult } from 'Src/features/feature'
import * as utils from 'Src/utils'

export interface Command {
	name(): string
	description(): string
	command(msg: discordjs.Message, args: string[]): Promise<void>
}

export class FeatureCommand extends FeatureBase {
	private readonly commands: Command[] = []
	readonly priority = 10000

	registerCommand(command: Command): void {
		this.commands.push(command)
	}

	async command(msg: discordjs.Message, name: string, args: string[]): Promise<void> {
		const cmd = this.commands.find((x) => x.name() === name)
		if (cmd === undefined) {
			return
		}

		await cmd.command(msg, args)
	}

	onMessage(msg: discordjs.Message): FeatureEventResult {
		if (msg.author.bot) {
			return {}
		}

		const command = utils.parseCommand(msg.content)
		if (command) {
			const { commandName, args } = command
			return {
				preventNext: true,
				continuation: async (): Promise<void> => {
					await this.command(msg, commandName, args)
				},
			}
		}

		return {}
	}
}
