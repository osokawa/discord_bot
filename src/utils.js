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
