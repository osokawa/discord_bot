import * as discordjs from 'discord.js'
import { execFile } from 'child_process'
import * as os from 'os'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as utils from '../../utils'
import GlobalConfig from '../../global-config'
import { FeatureMondai, Mondai } from '.'
import { generateImageMap } from './image-map'

type GameOption = {
	repeat: boolean
	life: number
}

type GameMode = string

function generateMondaiImage(mode: string, inPath: string, outPath: string, opts: { [_: string]: string } = {}): Promise<{ [_: string]: string }> {
	const optArgs: string[] = []
	for (const key of Object.keys(opts)) {
		optArgs.push(`-${key}`)
		optArgs.push(opts[key])
	}

	return new Promise((resolve, reject) => {
		const args: ReadonlyArray<string> = [...optArgs, mode, inPath, outPath] as any
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
	const replaceTables: [RegExp, string][] = [
		[/\s+/g, ' '],
	]
	const replaced = replaceTables.reduce((a, i) => a.replace(i[0], i[1]), message)
	return replaced.normalize('NFKC')
}

type Answer = {
	title: string
	time: string
	pattern: string
}

export default class Game {
	private _incorrectImageLog: { filename: string; answer: Answer }[] = []
	private answer: Answer | undefined
	private incorrectCount = 0
	private correctCount = 0
	private processing = false
	private tmpDir: string | undefined
	private feature: FeatureMondai

	constructor(private channelInstance: Mondai, private _gc: GlobalConfig, private mode: GameMode, private options: GameOption) {
		this.feature = channelInstance.feature
	}

	private get incorrectLimit(): number {
		return this.options.life
	}

	private get _isAudioMode(): boolean {
		const audioModes = ['audio', 'music', 'intro']
		return audioModes.includes(this.mode)
	}

	private get _isMosaicMode(): boolean {
		return this.mode === 'mosaic'
	}

	private _getTmpPath(filename: string): string {
		if (this.tmpDir === undefined) {
			throw 'なんかおかしい'
		}
		return path.join(this.tmpDir, filename)
	}

	async _postMondai(): Promise<void> {
		if (this.tmpDir === undefined) {
			throw 'なんかおかしい'
		}

		const episode = utils.randomPick(this.feature.config.episodes)
		const outputPath = this._getTmpPath(this._isAudioMode ? 'audio.mp3' : 'image.jpg')
		const mosaicOriginalPath = path.join(this.tmpDir, 'original.jpg')
		const options: { [_: string]: string } = {}
		if (this._isMosaicMode) {
			options.o = mosaicOriginalPath
		}
		if (episode.excludeRange) {
			options.r = episode.excludeRange
		}

		try {
			const generateResult = await generateMondaiImage(this.mode, episode.filename, outputPath, options)
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
		await this._gc.sendToChannel(this.channelInstance.channel, 'mondai.sendMondaiImage', {}, { files: [attachment] })
	}

	async init(): Promise<void> {
		this.tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mondai-'))
		this.processing = true
		await this._postMondai()
		this.processing = false
	}

	async _postResultMessage(msg: discordjs.Message, key: string, ans: Answer, title: string): Promise<void> {
		const options: { [_: string]: any } = {}
		if (this._isMosaicMode) {
			options.files = [new discordjs.Attachment(this._getTmpPath('original.jpg'))]
		}

		await this._gc.send(
			msg,
			'mondai.answer.' + key,
			{ title, time: ans.time, mosaic: this._isMosaicMode },
			options)
	}

	async _pushIncorrectImageLog(): Promise<void> {
		if (this.answer === undefined) {
			throw 'なんかおかしい'
		}
		if (!this._isAudioMode && this.options.repeat) {
			const filename = this._getTmpPath(`incorrect${this.incorrectCount}.jpg`)
			await fs.copyFile(this._getTmpPath('image.jpg'), filename)
			this._incorrectImageLog.push({ filename, answer: this.answer })
		}
	}

	async _processAnswerMessage(msg: discordjs.Message): Promise<boolean> {
		const text = normalizeAnswerMessage(msg.content)
		const ans = this.answer
		if (ans === undefined) {
			throw 'なんかおかしい'
		}
		const title = ans.title

		// 正解
		const correctMatch = new RegExp(ans.pattern, 'i').exec(text)
		if (correctMatch && correctMatch[0] === text) {
			await this._postResultMessage(msg, 'correct', ans, title)

			if (this.options.repeat) {
				this.correctCount++
				await this._postMondai()
				return true
			}

			return false
		}

		// 降参
		if (new RegExp(this.feature.config.options.surrenderPattern, 'i').exec(text)) {
			this.incorrectCount++
			this._pushIncorrectImageLog()

			if (this.options.repeat && this.incorrectCount == this.incorrectLimit) {
				await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
				return false
			}

			await this._postResultMessage(msg, 'surrender', ans, title)

			if (this.options.repeat) {
				await this._postMondai()
				return true
			}

			return false
		}

		// 不正解
		for (const episode of this.feature.config.episodes) {
			const incorrectMatch = new RegExp(episode.pattern, 'i').exec(text)
			if (incorrectMatch && incorrectMatch[0] === text) {
				this.incorrectCount++

				if (this.incorrectCount == this.incorrectLimit) {
					this._pushIncorrectImageLog()
					await this._postResultMessage(msg, 'reachedIncorrectLimit', ans, title)
					return false
				}

				await this._gc.send(msg, 'mondai.answer.incorrect')

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
		const res = await this._processAnswerMessage(msg)
		this.processing = false
		return res
	}

	async finalize(): Promise<void> {
		if (this.options.repeat) {
			await this._gc.sendToChannel(this.channelInstance.channel, 'mondai.repeatResult', { correctCount: this.correctCount })
			if (!this._isAudioMode && 10 <= this.correctCount) {
				const buf = await generateImageMap(1920, 1080, this._incorrectImageLog.map(x => x.filename))
				await this._gc.sendToChannel(
					this.channelInstance.channel,
					'mondai.incorrectImageMap',
					{ answers: this._incorrectImageLog.map(x => x.answer) },
					{ files: [new discordjs.Attachment(buf, 'image.jpg')] })
			}
		}

		if (this.tmpDir !== undefined) {
			await fs.rmdir(this.tmpDir, { recursive: true })
		}
	}
}
