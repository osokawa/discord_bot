import * as utils from 'Src/utils'

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
