const utils = require('./utils.js')

describe('parseCommand', () => {
	describe('コマンド名', () => {
		test('小文字のみを含むコマンド名を認識すること', () => {
			const { commandName } = utils.parseCommand('!test')
			expect(commandName).toBe('test')
		})

		test('大文字のコマンド名が小文字に変換されること', () => {
			const { commandName } = utils.parseCommand('!TestTest')
			expect(commandName).toBe('testtest')
		})

		test('-や_を含むコマンド名を認識すること', () => {
			const { commandName } = utils.parseCommand('!t_e-s_t')
			expect(commandName).toBe('t_e-s_t')
		})

		test('$等の記号を含むコマンド名を認識しないこと', () => {
			const ret = utils.parseCommand('!te$st')
			expect(ret).toBeFalsy()
		})
	})

	describe('引数', () => {
		test('引数なしで空の配列を返すこと', () => {
			const { args } = utils.parseCommand('!test')
			expect(args).toEqual([])
		})

		test('1つの引数を認識すること', () => {
			const { args } = utils.parseCommand('!test hoge')
			expect(args).toEqual(['hoge'])
		})

		test('複数の引数を認識すること', () => {
			const { args } = utils.parseCommand('!test hoge fuga piyo')
			expect(args).toEqual(['hoge', 'fuga', 'piyo'])
		})

		test('複数の空白で区切っても空の引数が生まれないこと', () => {
			const { args } = utils.parseCommand('!test  hoge')
			expect(args).toEqual(['hoge'])
		})
	})
})
