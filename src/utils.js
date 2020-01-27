exports.parseCommand = function (string) {
	const found = string.match(/^!([a-zA-Z_-]+)(\s+?.+)?$/)
	if (!found) {
		return null
	}

	const commandName = found[1].toLowerCase()

	const left = found[2]
	const args = left ? left.split(/\s+/).filter(x => x !== '') : []

	return { commandName, args }
}

exports.parseCommandArgs = function (argsToParse, optionsWithValue = [], minimumArgs = 0) {
	const args = []
	const options = {}

	for (let i = 0; i < argsToParse.length; i++) {
		const arg = argsToParse[i]

		if (arg !== '--' && arg.startsWith('--')) {
			let optName = arg.slice(2)
			let optValue = true

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
		throw '引数の数が足りない'
	}

	return {args, options}
}

exports.delay = function (ms) {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve()
		}, ms)
	})
}

exports.randomPick = function (array) {
	return array[Math.floor(Math.random() * array.length)]
}

exports.subCommandProxy = async function (table, [subcommand, ...args], msg) {
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


exports.replaceEmoji = function (text, emojis) {
	return text.replace(/:(\w+):/g, (match, emojiName) => {
		const foundEmoji = emojis.find(x => x.name === emojiName)
		return foundEmoji ? foundEmoji.toString() : match
	})
}

exports.isValidUrl = function (url) {
	const validUrlRegExp = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/
	return url.match(validUrlRegExp) ? true : false
}
