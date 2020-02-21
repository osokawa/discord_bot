import Jimp from 'jimp'

export function calcDivisionNumber(total: number): { x: number; y: number } {
	if (total < 1) {
		throw new Error('だめ')
	}
	let x = 1, y = 1

	// eslint-disable-next-line no-constant-condition
	while (true) {
		if (total <= x * y) {
			return { x, y }
		}
		x++

		if (total <= x * y) {
			return { x, y }
		}
		y++
	}
}

export async function generateImageMap(width: number, height: number, files: string[]): Promise<Buffer> {
	const { x, y } = calcDivisionNumber(files.length)

	const promise: Promise<Jimp> = new Promise((resolve, reject) => {
		new Jimp(width, height, '#FFFFFF', (err, image) => {
			if (err) { reject(err) }
			resolve(image)
		})
	})

	const mainImage = await promise

	const singleX = width / x
	const singleY = height / y

	let nowX = 0, nowY = 0

	for (let i = 0; i < files.length; i++) {
		const image = await Jimp.read(files[i])
		image.contain(singleX, singleY)
		mainImage.blit(image, nowX * singleX, nowY * singleY)

		nowX++
		if (nowX === x) {
			nowX = 0
			nowY++
		}
	}

	return await mainImage.getBufferAsync(Jimp.MIME_JPEG)
}
