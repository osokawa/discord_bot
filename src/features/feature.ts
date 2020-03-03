import * as discordjs from 'discord.js'

import FeatureManager from 'Src/features/feature-manager'

export interface FeatureEventResult {
	preventNext?: boolean
	continuation?: () => Promise<void>
	context?: FeatureEventContext
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FeatureEventContext = { [key: string]: any }

export interface FeatureInterface {
	preInit(manager: FeatureManager): void
	init(manager: FeatureManager): Promise<void>
	finalize(): Promise<void>
	readonly priority: number

	onMessage(msg: discordjs.Message, context: FeatureEventContext): FeatureEventResult

	hasInitialized(): boolean
}

export class FeatureBase implements FeatureInterface {
	private _hasInitialized = false
	private _manager!: FeatureManager
	priority = 0

	public get manager(): FeatureManager {
		return this._manager
	}

	preInit(manager: FeatureManager): void {
		this._manager = manager
		this.preInitImpl()
	}

	// preInit はこっちをオーバーライドして
	protected preInitImpl(): void {
		// オーバーライドしてね
	}

	// init はこっちをオーバーライドして
	protected initImpl(): Promise<void> {
		return Promise.resolve()
	}

	async init(): Promise<void> {
		await this.initImpl()
		this._hasInitialized = true
	}

	finalize(): Promise<void> {
		return Promise.resolve()
	}

	// TODO: disable-next-line を使わずに警告を消す方法は無いか?
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	onMessage(msg: discordjs.Message, context: FeatureEventContext): FeatureEventResult {
		return {}
	}

	hasInitialized(): boolean {
		return this._hasInitialized
	}
}
