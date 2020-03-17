import { Music } from 'Src/features/play-music/music'

export class Playlist {
	private _musics: Music[] = []
	private playingTrack: number | undefined

	get isEmpty(): boolean {
		return this.playingTrack === undefined
	}

	get currentMusic(): Music | undefined {
		if (this.playingTrack === undefined) {
			return
		}

		return this.musics[this.playingTrack]
	}

	get musics(): ReadonlyArray<Music> {
		return this._musics
	}

	addMusic(music: Music): void {
		this._musics.push(music)

		if (this.playingTrack === undefined) {
			this.playingTrack = 0
		}
	}

	clear(): void {
		this._musics = []
		this.playingTrack = undefined
	}

	next(): void {
		if (this.playingTrack === undefined) {
			throw '駄目なタイミング'
		}

		this.playingTrack += 1
		if (this.musics.length <= this.playingTrack) {
			this.playingTrack = 0
		}
	}

	prev(): void {
		if (this.playingTrack === undefined) {
			throw '駄目なタイミング'
		}

		this.playingTrack -= 1
		if (this.playingTrack < 0) {
			this.playingTrack = this.musics.length - 1
		}
	}
}
