type FieldNames<T> = {
	[P in keyof T]: T[P] extends Function ? never : P
}[keyof T]
type Fields<T> = { [P in FieldNames<T>]: T[P] }

export class MusicMetadata {
	readonly title: string
	readonly album?: string
	readonly artist?: string
	readonly track: { no: number | null; of: number | null }
	readonly disk: { no: number | null; of: number | null }

	constructor(obj: MusicMetadataObject) {
		this.title = obj.title
		this.album = obj.album
		this.artist = obj.artist
		this.track = obj.track
		this.disk = obj.disk
	}
}

export type MusicMetadataObject = Fields<MusicMetadata>

export class Music {
	readonly title: string
	readonly path: string
	readonly metadata: MusicMetadata
	readonly memberMusicList?: string

	constructor(obj: MusicObject) {
		this.title = obj.title
		this.path = obj.path
		this.metadata = new MusicMetadata(obj.metadata)
		this.memberMusicList = obj.memberMusicList
	}
}

export type MusicObject = Fields<Music> & { readonly metadata: MusicMetadataObject }
