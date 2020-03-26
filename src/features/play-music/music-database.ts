import { promises as fs } from 'fs'
import TOML from '@iarna/toml'
import lodash from 'lodash'
import * as path from 'path'
import Fuse from 'fuse.js'

import { Music } from 'Src/features/play-music/music'

export type MusicList = Music[]
export type MusicLists = Map<string, MusicList>

export type MusicListFormat = {
	readonly name: string
	readonly musics: Music[]
}

async function loadMusicLists(dir: string): Promise<MusicLists> {
	const files = await fs.readdir(dir)
	const musicLists: MusicLists = new Map()

	for (const file of files) {
		const toml = await fs.readFile(path.join(dir, file), 'utf-8')
		// TODO: バリデーション
		const parsed = (await TOML.parse.async(toml)) as MusicListFormat
		const musicListName = parsed.name
		musicLists.set(
			musicListName,
			parsed.musics.map((x): Music => ({ ...x, memberMusicList: musicListName }))
		)
	}

	return musicLists
}

function getAllMusics(musicLists: MusicLists): Music[] {
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

		res.get(key)!.push(i)
	}
	return res
}

export class MusicDatabase {
	private allMusics: Music[] = []
	private allMusicsFuse!: Fuse<Music, Fuse.FuseOptions<Music>>

	private musicLists: Map<string, Music[]> = new Map()
	private artists: Map<string, Music[]> = new Map()
	private albums: Map<string, Music[]> = new Map()

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

	search(keyword: string): Music[] {
		return this.allMusicsFuse.search(keyword) as Music[]
	}

	private searchName(names: Map<string, unknown>, keyword: string): string[] {
		const fuse = new Fuse(
			Array.from(names.keys()).map(x => ({
				name: x,
			})),
			{ keys: ['name'] }
		)

		return fuse.search(keyword).map(x => x.name)
	}

	fromMusicList(name: string): Music[] | undefined {
		return this.musicLists.get(name)
	}

	searchMusicListName(keyword: string): string[] {
		return this.searchName(this.musicLists, keyword)
	}

	fromArtist(name: string): Music[] | undefined {
		return this.artists.get(name)
	}

	searchArtistName(keyword: string): string[] {
		return this.searchName(this.artists, keyword)
	}

	fromAlbum(name: string): Music[] | undefined {
		return this.albums.get(name)
	}

	searchAlbumName(keyword: string): string[] {
		return this.searchName(this.albums, keyword)
	}
}
