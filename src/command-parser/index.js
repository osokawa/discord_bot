module.exports = class {
	constructor(options) {
		this.options = options
	}

	_validation(arg, validators) {
		if (!validators) {
			return []
		}

		const errors = []

		for (const validator of validators) {
			try {
				const result = validator(arg)
				if (!result) {
					errors.push({ name, reason: 'バリデーションに失敗しました' })
				}
			} catch (e) {
				errors.push({ name, reason: e })
			}
		}

		return errors
	}

	_parseSingleArg(arg, option) {
		if (!arg) {
			throw ["引数が足りない"]
		}

		const res = this._validation(arg, argOption.validators)
		if (res.length !== 0) {
			throw res
		}

		return option.map ? option.map(arg) : arg
	}

	_parseLastArg(args, option) {
		if (option.last !== 'optional' && args.length < 1) {
			throw ["引数が足りない"]
		}

		args.map()
	}

	parse(args) {
		const success = { args: {} }
		let errors = []

		for (let i = 0; i < this.options.args.length; i++) {
			const argOption = this.options.args[i]
			const name = argOption.name

			try {
				if (argOption.last) {
					success.args[name] = this._parseLastArg(args.slice(i), argOption)
				} else {
					success.args[name] = this._parseSingleArg(args[i], argOption)
				}
			} catch (e) {
				errors = errors.concat(e)
			}
		}

		if (error.length === 0) {
			return { type: 'success', data: success }
		} else {
			return { type: 'error', data: errors }
		}
	}
}

new CommandParser({
	args: [
		{ name: 'command', validators: [x => x === '!req'] },
		{ name: 'subcommand', validators: [x => ['config', 'images'].includes(x)] },
		{ name: 'leftargs', last: 'optional' }
	],
})
