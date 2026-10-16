import type { Kind } from './stats'
import type { CategoryId } from './value'

/** TMDB 읽기 전용 액세스 토큰. 빌드 시 주입되며 번들에 그대로 포함된다 */
export const TMDB_TOKEN: string | undefined = import.meta.env.VITE_TMDB_TOKEN || undefined

const ANIMATION = 16
const DOCUMENTARY = 99
const KIDS = 10762
const REALITY = 10764
const TALK = 10767

export type TmdbTv = { genre_ids: number[]; origin_country: string[]; original_language: string }

/** TMDB 시리즈 검색 결과의 장르·국가를 본전 계산용 콘텐츠 유형으로 옮긴다 */
export function categoryFromTmdb(tv: TmdbTv): CategoryId {
  const genres = new Set(tv.genre_ids)
  const japanese = tv.origin_country.includes('JP') || tv.original_language === 'ja'
  if (genres.has(ANIMATION) && japanese) return 'anime'
  if (genres.has(KIDS)) return 'kids'
  if (genres.has(ANIMATION)) return 'anime'
  if (genres.has(DOCUMENTARY)) return 'docSeries'
  if (genres.has(REALITY) || genres.has(TALK)) return 'variety'
  return tv.origin_country.includes('KR') || tv.original_language === 'ko' ? 'drama' : 'foreign'
}

export type TmdbMovie = { genre_ids: number[] }

/** 영화 검색 결과: 애니메이션 장편·장편 다큐·일반 영화 */
export function categoryFromTmdbMovie(movie: TmdbMovie): CategoryId {
  if (movie.genre_ids.includes(ANIMATION)) return 'animeFilm'
  if (movie.genre_ids.includes(DOCUMENTARY)) return 'docFilm'
  return 'movie'
}

type MultiResult = (TmdbTv & { media_type: 'tv' }) | (TmdbMovie & { media_type: 'movie' }) | { media_type: 'person' }

/**
 * 작품 제목만 TMDB에서 검색해 첫 결과로 유형을 추정한다. 시청 날짜·회차는 보내지 않는다.
 * 시리즈는 시리즈로 검색한다. 한 편짜리 제목은 영화·시리즈를 함께 검색하고, 못 찾으면
 * ‘작품명: 부제’의 작품명만 시리즈로 다시 검색한다 (시즌 표기 없이 한두 화만 본 애니 등).
 * 찾지 못한 제목은 결과에서 빠지고, 인증·네트워크 오류는 그대로 던진다.
 */
export async function lookupTitles(
  items: { show: string; kind: Kind }[], token: string, onProgress?: (done: number) => void, signal?: AbortSignal,
): Promise<Record<string, CategoryId>> {
  const search = async <T>(type: 'tv' | 'multi', query: string): Promise<T[]> => {
    const url = `https://api.themoviedb.org/3/search/${type}?language=ko-KR&query=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
    if (!res.ok) throw new Error(`TMDB 응답 ${res.status}`)
    return ((await res.json()) as { results?: T[] }).results ?? []
  }
  const classify = async ({ show, kind }: { show: string; kind: Kind }): Promise<CategoryId | undefined> => {
    if (kind === 'series') {
      const [tv] = await search<TmdbTv>('tv', show)
      return tv && categoryFromTmdb(tv)
    }
    const hit = (await search<MultiResult>('multi', show)).find((r) => r.media_type !== 'person')
    if (hit) return hit.media_type === 'tv' ? categoryFromTmdb(hit) : categoryFromTmdbMovie(hit as TmdbMovie)
    const prefix = show.split(/\s*:\s*/)[0]
    if (prefix === show) return undefined
    const [tv] = await search<TmdbTv>('tv', prefix)
    return tv && categoryFromTmdb(tv)
  }

  const found: Record<string, CategoryId> = {}
  const queue = [...items]
  let done = 0
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      const category = await classify(item)
      if (category) found[item.show] = category
      onProgress?.(++done)
    }
  }
  // ponytail: 동시 4개 고정. TMDB 한도(초당 약 50회)에 걸리면 재시도 추가
  await Promise.all(Array.from({ length: 4 }, worker))
  return found
}
