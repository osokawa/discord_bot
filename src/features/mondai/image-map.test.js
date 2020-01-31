const { calcDivisionNumber } = require('./image-map.js')

describe('calcDivisionNumber', () => {
	test('1未満の引数を受け入れないこと', () => {
		expect(() => { calcDivisionNumber(0) }).toThrow()
	})

	test('3枚の時の分割数が2*2になること', () => {
		expect(calcDivisionNumber(3)).toStrictEqual({ x: 2, y: 2 })
	})

	test('4枚の時の分割数が2*2になること', () => {
		expect(calcDivisionNumber(4)).toStrictEqual({ x: 2, y: 2 })
	})

	test('5枚の時の分割数が3*2になること', () => {
		expect(calcDivisionNumber(5)).toStrictEqual({ x: 3, y: 2 })
	})
})
