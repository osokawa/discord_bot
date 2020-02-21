import * as lodash from 'lodash'
import * as discordjs from 'discord.js'

export function unreachable(): never {
	throw Error('This must never happen!')
}

export function parseCommand(string: string): { commandName: string; args: string[] } | undefined {
	const found = /^!([a-zA-Z_-]+)(\s+?.+)?$/.exec(string)
	if (!found) {
		return
	}

	const commandName = found[1].toLowerCase()

	const left = found[2]
	const args = left ? left.split(/\s+/).filter(x => x !== '') : []

	return { commandName, args }
}

export function parseCommandArgs(
	argsToParse: string[],
	optionsWithValue: string[] = [],
	minimumArgs = 0):
	{ args: string[]; options: { [_: string]: string | boolean } } {

	const args = []
	const options: { [_: string]: string | boolean } = {}

	for (let i = 0; i < argsToParse.length; i++) {
		const arg = argsToParse[i]

		if (arg !== '--' && arg.startsWith('--')) {
			let optName = arg.slice(2)
			let optValue: string | boolean = true

			const equalIndex = arg.indexOf('=')
			if (equalIndex !== -1) {
				optName = arg.slice(2, equalIndex)
			}

			if (optName === '') {
				throw `オプション名を指定してください: ${arg}`
			}

			const isWithValue = optionsWithValue.includes(optName)

			if (isWithValue) {
				if (equalIndex !== -1) {
					optValue = arg.slice(equalIndex + 1)
				} else {
					if (i + 1 === argsToParse.length) {
						throw `引数には値が必要です: ${optName}`
					}
					i++
					optValue = argsToParse[i]
				}
			} else {
				if (equalIndex !== -1) {
					throw `引数は値を持てません: ${optName}`
				}
			}

			options[optName] = optValue
			continue
		}

		if (arg !== '-' && arg.startsWith('-')) {
			const opts = arg.slice(1).split('')
			if (opts.length === 1) {
				if (optionsWithValue.includes(opts[0])) {
					if (i + 1 === argsToParse.length) {
						throw `引数には値が必要です: ${opts[0]}`
					}
					i++
					options[opts[0]] = argsToParse[i]
					continue
				}
			}

			for (const opt of opts) {
				if (optionsWithValue.includes(opt)) {
					throw `引数には値が必要です: ${opt}`
				}
				options[opt] = true
			}

			continue
		}

		args.push(arg)
	}

	if (args.length < minimumArgs) {
		throw '引数の数が足りません'
	}

	return {args, options}
}

export function getOption(options: { [_: string]: string | boolean }, keys: string[]): string | boolean
export function getOption<T>(options: { [_: string]: string | boolean }, keys: string[], defaultValue: T): string | boolean | T
export function getOption<T>(options: { [_: string]: string | boolean }, keys: string[], defaultValue?: T): T | string | boolean {
	for (const key of keys) {
		if (key in options) {
			return options[key]
		}
	}

	if (defaultValue === undefined) {
		return false
	} else {
		return defaultValue
	}
}

export function delay(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve()
		}, ms)
	})
}

export function weightedRandom(weights: number[]): number {
	if (weights.length == 0) {
		throw new TypeError('invalid argument')
	}

	const list = weights.reduce((a, c) => [...a, a[a.length - 1] + c], [0])
	const random = Math.floor(Math.random() * list[list.length - 1])
	for (let i = 1; i < list.length; i++) {
		if (list[i - 1] <= random && random < list[i]) {
			return i - 1
		}
	}

	unreachable()
}

export function randomPick<T>(array: T | T[]): T {
	if (!Array.isArray(array)) {
		return array
	}

	const weights = array.map(x => lodash.get(x, 'weight', 100))
	return array[weightedRandom(weights)]
}

export async function subCommandProxy(
	table: { [_: string]: (args: string[], msg: discordjs.Message) => Promise<void> },
	[subcommand, ...args]: string[],
	msg: discordjs.Message): Promise<void> {
	const validSubCommands = Object.keys(table).join(' ')
	if (!subcommand) {
		msg.channel.send(`サブコマンドを指定して欲しいロボ: ${validSubCommands}`)
		return
	}

	const func = table[subcommand]
	if (func) {
		await func(args, msg)
	} else {
		msg.channel.send(`知らないサブコマンドロボねえ…: ${validSubCommands}`)
	}
}


export function replaceEmoji(text: string, emojis: discordjs.Collection<discordjs.Snowflake, discordjs.Emoji>): string {
	return text.replace(/:(\w+):/g, (match, emojiName) => {
		const foundEmoji = emojis.find(x => x.name === emojiName)
		return foundEmoji ? foundEmoji.toString() : match
	})
}

export function isValidUrl(url: string): boolean {
	const validUrlRegExp = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/
	return validUrlRegExp.exec(url) ? true : false
}

export async function forEachAsyncOf<T>(arr: Iterable<T>, doWithX: (x: T) => Promise<void>): Promise<void> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const errors: any[] = []

	await Promise.all(Array.from(arr, x => {
		return (async (): Promise<void> => {
			try {
				await doWithX(x)
			} catch (e) {
				errors.push(e)
			}
		})()
	}))

	if (errors.length !== 0) {
		throw errors
	}
}

export type LikeTextChannel = discordjs.TextChannel | discordjs.GroupDMChannel | discordjs.DMChannel
