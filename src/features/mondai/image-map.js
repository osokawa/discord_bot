const Jimp = require('jimp')

function calcDivisionNumber(total) {
	if (total < 1) {
		throw new Error('だめ')
	}
	let x = 1, y = 1

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

async function generateImageMap(width, height, files) {
	const { x, y } = calcDivisionNumber(files.length)

	const mainImage = await new Promise((resolve, reject) => {
		new Jimp(width, height, '#FFFFFF', (err, image) => {
			if (err) { reject(err) }
			resolve(image)
		})
	})

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

module.exports = { calcDivisionNumber, generateImageMap }
