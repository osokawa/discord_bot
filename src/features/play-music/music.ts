export type MusicMetadata = {
	readonly title: string
	readonly album?: string
	readonly artist?: string
	readonly track: { no: number | null; of: number | null }
	readonly disk: { no: number | null; of: number | null }
}

export type Music = {
	readonly title: string
	readonly path: string
	readonly metadata: MusicMetadata
	readonly memberMusicList?: string
}
