import { promises as fs } from 'fs'
import TOML from '@iarna/toml'
import lodash from 'lodash'
import * as path from 'path'
import Fuse from 'fuse.js'

import * as utils from 'Src/utils'

import { Music, MusicFile, MusicObject, Artist, Album } from 'Src/features/play-music/music'

type MusicList = MusicFile[]
type MusicLists = Map<string, MusicList>

export type MusicListFormat = {
	readonly name: string
	readonly musics: MusicObject[]
}

async function loadMusicLists(dir: string): Promise<MusicLists> {
	const files = await fs.readdir(dir)
	const musicLists: MusicLists = new Map()

	for (const file of files) {
		const toml = await fs.readFile(path.join(dir, file), 'utf-8')
		// TODO: バリデーション
		const parsed = ((await TOML.parse.async(toml)) as unknown) as MusicListFormat
		const musicListName = parsed.name
		musicLists.set(
			musicListName,
			parsed.musics.map(x => new MusicFile({ ...x, memberMusicList: musicListName }))
		)
	}

	return musicLists
}

function getAllMusics(musicLists: MusicLists): MusicFile[] {
	return lodash.flatten(Array.from(musicLists.values()))
}

function createMap<K, V>(array: V[], keyFunc: (val: V) => K | undefined): Map<K, V[]> {
	const res = new Map<K, V[]>()
	for (const i of array) {
		const key = keyFunc(i)
		if (key === undefined) {
			continue
		}

		if (!res.has(key)) {
			res.set(key, [])
		}

		;(res.get(key) ?? utils.unreachable()).push(i)
	}
	return res
}

export class MusicDatabase {
	private allMusics: MusicFile[] = []
	private allMusicsFuse!: Fuse<MusicFile, Fuse.FuseOptions<Music>>

	private musicLists: Map<string, MusicFile[]> = new Map()
	private artists: Map<string, MusicFile[]> = new Map()
	private albums: Map<string, MusicFile[]> = new Map()

	constructor(public readonly musicListsDir: string) {}

	async init(): Promise<void> {
		this.musicLists = await loadMusicLists(this.musicListsDir)
		this.allMusics = getAllMusics(this.musicLists)
		this.artists = createMap(this.allMusics, v => v.metadata.artist)
		this.albums = createMap(this.allMusics, v => v.metadata.album)

		this.allMusicsFuse = new Fuse(this.allMusics, {
			keys: [
				{ name: 'metadata.title', weight: 0.6 },
				{ name: 'metadata.album', weight: 0.3 },
				{ name: 'metadata.artist', weight: 0.1 },
			],
		})
	}

	search(keyword: string): MusicFile[] {
		return this.allMusicsFuse.search(keyword) as MusicFile[]
	}

	private searchName<T, M>(
		names: Map<string, M>,
		keyword: string,
		map: (name: string, musics: M) => T
	): T[] {
		const fuse = new Fuse(
			Array.from(names.keys(), name => ({ name })),
			{ keys: ['name'] }
		)

		return fuse.search(keyword).map(x => map(x.name, names.get(x.name) ?? utils.unreachable()))
	}

	searchArtistName(keyword: string): Artist[] {
		return this.searchName(this.artists, keyword, (x, m) => new Artist(x, m))
	}

	searchAlbumName(keyword: string): Album[] {
		return this.searchName(this.albums, keyword, (x, m) => new Album(x, m))
	}
}
