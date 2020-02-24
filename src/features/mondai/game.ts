import { execFile } from 'child_process'
import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as discordjs from 'discord.js'

import GlobalConfig from 'Src/global-config'
import * as utils from 'Src/utils'
import { FeatureMondai, Mondai, MondaiConfig } from 'Src/features/mondai'
import { generateImageMap } from 'Src/features/mondai/image-map'

export type GameOption = {
	repeat?: boolean
	life?: number
}

type GameMode = string

function generateMondaiImage(
	mode: string,
	inPath: string,
	outPath: string,
	opts: { [_: string]: string } = {}
): Promise<{ [_: string]: string }> {
	const optArgs: string[] = []
	for (const key of Object.keys(opts)) {
		optArgs.push(`-${key}`)
		optArgs.push(opts[key])
	}

	return new Promise((resolve, reject) => {
		// TODO: ReadonlyArray<string> に代入出来ない?
		const args: ReadonlyArray<string> = [
			...optArgs,
			mode,
			inPath,
			outPath,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		] as any
		execFile('./tools/mondai.rb', args, {}, (error: Error | null, stdout: string | Buffer) => {
			if (error) {
				reject(error)
			}
			try {
				resolve(JSON.parse(stdout as string))
			} catch (e) {
				reject(e)
			}
		})
	})
}

function normalizeAnswerMessage(message: string): string {
	const replaceTables: [RegExp, string][] = [[/\s+/g, ' ']]
	const replaced = replaceTables.reduce((a, i) => a.replace(i[0], i[1]), message)
	return replaced.normalize('NFKC')
}

type Answer = {
	title: string
	time: string
	pattern: string
}

export class Game {
	private readonly incorrectImageLog: { filename: string; answer: Answer }[] = []
	private answer: Answer | undefined
	private incorrectCount = 0
	private correctCount = 0
	private processing = false
	private tmpDir: string | undefined
	private readonly feature: FeatureMondai

	constructor(
		private readonly channelInstance: Mondai,
		private readonly gc: GlobalConfig,
		private readonly mode: GameMode,
		private readonly options: GameOption
	) {
		this.feature = channelInstance.feature
	}

	private get config(): MondaiConfig {
		return this.channelInstance.config
	}

	private get isRepeat(): boolean {
		return this.options.repeat === undefined ? false : this.options.repeat
	}

	private get incorrectLimit(): number {
		return this.options.life === undefined ? 3 : this.options.life
	}

	private get isAudioMode(): boolean {
		const audioModes = ['audio', 'music', 'intro']
		return audioModes.includes(this.mode)
	}

	private get isMosaicMode(): boolean {
		return this.mode === 'mosaic'
	}

	private getTmpPath(filename: string): string {
		if (this.tmpDir === undefined) {
			utils.unreachable()
		}
		return path.join(this.tmpDir, filename)
	}

	private async postMondai(): Promise<void> {
		if (this.tmpDir === undefined) {
			utils.unreachable()
		}

		const episode = utils.randomPick(this.config.episodes)
		const outputPath = this.getTmpPath(this.isAudioMode ? 'audio.mp3' : 'image.jpg')
		const mosaicOriginalPath = path.join(this.tmpDir, 'original.jpg')
		const options: { [_: string]: string } = {}
		if (this.isMosaicMode) {
			options.o = mosaicOriginalPath
		}
		if (episode.excludeRange) {
			options.r = episode.excludeRange
		}

		try {
			const generateResult = await generateMondaiImage(
				this.mode,
				episode.filename,
				outputPath,
				options
			)
			this.answer = {
				title: episode.title,
				pattern: episode.pattern,
				time: generateResult.time,
			}
		} catch (e) {
			// TODO: 特別なエラー型にラップする
			throw Error(e)
		}

		const attachment = new discordjs.Attachment(outputPath)
		await this.gc.sendToChannel(
			this.channelInstance.channel,
			'mondai.sendMondaiImage',
			{},
			{ files: [attachment] }
		)
	}

	async init(): Promise<void> {
		this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mondai-'))
		this.processing = true
		await this.postMondai()
		this.processing = false
	}

	async _postResultMessage(
		msg: discordjs.Message,
		key: string,
		ans: Answer,
		title: string
	): Promise<void> {
		const options: discordjs.MessageOptions = {}
		if (this.isMosaicMode) {
			options.files = [new discordjs.Attachment(this.getTmpPath('original.jpg'))]
		}

		await this.gc.send(
			msg,
			'mondai.answer.' + key,
			{ title, time: ans.time, mosaic: this.isMosaicMode },
			options
		)
	}

	private async pushIncorrectImageLog(): Promise<void> {
		if (this.answer === undefined) {
			utils.unreachable()
		}
		if (!this.isAudioMode && this.isRepeat) {
			const filename = this.getTmpPath(`incorrect${this.incorrectCount}.jpg`)
			await fs.copyFile(this.getTmpPath('image.jpg'), filename)
			this.incorrectImageLog.push({ filename, answer: this.answer })
		}
	}

	private async processAnswerMessage(msg: discordjs.Message): Promise<boolean> {
		const text = normalizeAnswerMessage(msg.content)
		const ans = this.answer
		if (ans === undefined) {
			utils.unreachable()
		}
		const title = ans.title

		// 正解
		const correctMatch = new RegExp(ans.pattern, 'i').exec(text)
		if (correctMatch && correctMatch[0] === text) {
			await this._postResultMessage(msg, 'correct', ans, title)

			if (this.isRepeat) {
				this.correctCount++
				await this.postMondai()
				return true
			}

			return false
		}

		// 降参
		if (new RegExp(this.config.options.surrenderPattern, 'i').exec(text)) {
			this.incorrectCount++
			this.pushIncorrectImageLog()

			if (this.isRepeat && this.incorrectCount == this.incorrectLimit) {
				await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
				return false
			}

			await this._postResultMessage(msg, 'surrender', ans, title)

			if (this.isRepeat) {
				await this.postMondai()
				return true
			}

			return false
		}

		// 不正解
		for (const episode of this.config.episodes) {
			const incorrectMatch = new RegExp(episode.pattern, 'i').exec(text)
			if (incorrectMatch && incorrectMatch[0] === text) {
				this.incorrectCount++

				if (this.incorrectCount == this.incorrectLimit) {
					this.pushIncorrectImageLog()
					await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
					return false
				}

				await this.gc.send(msg, 'mondai.answer.incorrect')

				return true
			}
		}

		return true
	}

	// true なら続行
	async onMessage(msg: discordjs.Message): Promise<boolean> {
		if (msg.author.bot || this.processing) {
			return true
		}

		this.processing = true
		const res = await this.processAnswerMessage(msg)
		this.processing = false
		return res
	}

	async finalize(): Promise<void> {
		if (this.isRepeat) {
			await this.gc.sendToChannel(this.channelInstance.channel, 'mondai.repeatResult', {
				correctCount: this.correctCount,
			})
			if (!this.isAudioMode && 10 <= this.correctCount) {
				const buf = await generateImageMap(
					1920,
					1080,
					this.incorrectImageLog.map(x => x.filename)
				)
				await this.gc.sendToChannel(
					this.channelInstance.channel,
					'mondai.incorrectImageMap',
					{ answers: this.incorrectImageLog.map(x => x.answer) },
					{ files: [new discordjs.Attachment(buf, 'image.jpg')] }
				)
			}
		}

		if (this.tmpDir !== undefined) {
			await fs.rmdir(this.tmpDir, { recursive: true })
		}
	}
}
