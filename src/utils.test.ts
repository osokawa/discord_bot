import * as utils from 'Src/utils'

describe('parseShellLikeCommand', () => {
	test('一般例A', () => {
		const res = utils.parseShellLikeCommand(
			'command --longoption=value --longoption value -o arg "double quote" \'single quote\''
		)
		expect(res).toEqual([
			'command',
			'--longoption=value',
			'--longoption',
			'value',
			'-o',
			'arg',
			'double quote',
			'single quote',
		])
	})

	test('一般例B', () => {
		const res = utils.parseShellLikeCommand("!music play 'title with space'")
		expect(res).toEqual(['!music', 'play', 'title with space'])
	})

	test('一般例C', () => {
		const res = utils.parseShellLikeCommand('!music play "title with \'"')
		expect(res).toEqual(['!music', 'play', "title with '"])
	})

	test('分割点の前後にスペースがつかないこと', () => {
		const res = utils.parseShellLikeCommand('a b')
		expect(res).toEqual(['a', 'b'])
	})

	describe('ダブルクォート', () => {
		test('普通の文字で動くこと', () => {
			const res = utils.parseShellLikeCommand('"abc"')
			expect(res).toEqual(['abc'])
		})

		test('終了しない時エラーになること', () => {
			const res = utils.parseShellLikeCommand('"abc')
			expect(res).toBeUndefined()
		})

		test('スペースで引数が区切られないこと', () => {
			const res = utils.parseShellLikeCommand('"a b  c"')
			expect(res).toEqual(['a b  c'])
		})

		test('終了後引数が区切られないこと', () => {
			const res = utils.parseShellLikeCommand('"ab"c')
			expect(res).toEqual(['abc'])
		})

		test('バックスラッシュ記法が使えること', () => {
			const res = utils.parseShellLikeCommand('"petit\'s"')
			expect(res).toEqual(["petit's"])
		})
	})

	describe('シングルクォート', () => {
		test('普通の文字で動くこと', () => {
			const res = utils.parseShellLikeCommand("'abc'")
			expect(res).toEqual(['abc'])
		})

		test('終了しない時エラーになること', () => {
			const res = utils.parseShellLikeCommand("'abc")
			expect(res).toBeUndefined()
		})

		test('スペースで引数が区切られないこと', () => {
			const res = utils.parseShellLikeCommand("'a b  c'")
			expect(res).toEqual(['a b  c'])
		})

		test('終了後引数が区切られないこと', () => {
			const res = utils.parseShellLikeCommand("'ab'c")
			expect(res).toEqual(['abc'])
		})

		test('バックスラッシュ記法が無視されること', () => {
			const res = utils.parseShellLikeCommand("'a\\b'")
			expect(res).toEqual(['a\\b'])
		})
	})
})

describe('parseCommand', () => {
	describe('コマンド名', () => {
		test('小文字のみを含むコマンド名を認識すること', () => {
			const res = utils.parseCommand('!test')
			expect(res).toHaveProperty('commandName', 'test')
		})

		test('大文字のコマンド名が小文字に変換されること', () => {
			const res = utils.parseCommand('!TestTest')
			expect(res).toHaveProperty('commandName', 'testtest')
		})

		test('-や_を含むコマンド名を認識すること', () => {
			const res = utils.parseCommand('!t_e-s_t')
			expect(res).toHaveProperty('commandName', 't_e-s_t')
		})

		test('$等の記号を含むコマンド名を認識しないこと', () => {
			const ret = utils.parseCommand('!te$st')
			expect(ret).toBeUndefined()
		})
	})

	describe('引数', () => {
		test('引数なしで空の配列を返すこと', () => {
			const res = utils.parseCommand('!test')
			expect(res).toHaveProperty('args', [])
		})

		test('1つの引数を認識すること', () => {
			const res = utils.parseCommand('!test hoge')
			expect(res).toHaveProperty('args', ['hoge'])
		})

		test('複数の引数を認識すること', () => {
			const res = utils.parseCommand('!test hoge fuga piyo')
			expect(res).toHaveProperty('args', ['hoge', 'fuga', 'piyo'])
		})

		test('複数の空白で区切っても空の引数が生まれないこと', () => {
			const res = utils.parseCommand('!test  hoge')
			expect(res).toHaveProperty('args', ['hoge'])
		})
	})
})
