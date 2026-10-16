import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoryFromTmdb, categoryFromTmdbMovie, lookupTitles } from './tmdb'

const tv = (genre_ids: number[], origin_country: string[], original_language = 'en') => ({ genre_ids, origin_country, original_language })

describe('TMDB 장르 추정', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('일본 애니는 키즈 장르가 붙어도 애니로, 그 밖은 장르·국가로 나눈다', () => {
    expect(categoryFromTmdb(tv([16, 10762], ['JP'], 'ja'))).toBe('anime')
    expect(categoryFromTmdb(tv([16, 10762], ['KR'], 'ko'))).toBe('kids')
    expect(categoryFromTmdb(tv([10764], ['KR'], 'ko'))).toBe('variety')
    expect(categoryFromTmdb(tv([18], ['KR'], 'ko'))).toBe('drama')
    expect(categoryFromTmdb(tv([18], ['US']))).toBe('foreign')
  })

  it('시리즈는 시리즈로, 한 편짜리는 함께 검색한 뒤 못 찾으면 ‘작품명: 부제’의 작품명으로 다시 찾는다', async () => {
    const fetch = vi.fn(async (url: string) => {
      const { pathname, searchParams } = new URL(url)
      const q = searchParams.get('query')
      const results =
        pathname.endsWith('/tv') && (q === '주술회전' || q === '장송의 프리렌') ? [tv([16], ['JP'], 'ja')]
        : pathname.endsWith('/multi') && q === '스즈메의 문단속' ? [{ media_type: 'person' }, { media_type: 'movie', genre_ids: [16] }]
        : []
      return { ok: true, json: async () => ({ results }) }
    })
    vi.stubGlobal('fetch', fetch)
    const found = await lookupTitles([
      { show: '주술회전', kind: 'series' },
      { show: '장송의 프리렌: 모험의 끝', kind: 'movie' },
      { show: '스즈메의 문단속', kind: 'movie' },
      { show: '없는 영화', kind: 'movie' },
    ], 't')
    expect(found).toEqual({ 주술회전: 'anime', '장송의 프리렌: 모험의 끝': 'anime', '스즈메의 문단속': 'animeFilm' })
    expect(fetch.mock.calls[0][0]).toBe('https://api.themoviedb.org/3/search/tv?language=ko-KR&query=%EC%A3%BC%EC%88%A0%ED%9A%8C%EC%A0%84')
    expect(fetch).toHaveBeenCalledTimes(5) // 시리즈 1 + 부제 2 + 영화 1 + 없는 영화 1
  })

  it('영화 장르를 애니메이션 장편·장편 다큐·영화로 나눈다', () => {
    expect(categoryFromTmdbMovie({ genre_ids: [16, 18] })).toBe('animeFilm')
    expect(categoryFromTmdbMovie({ genre_ids: [99] })).toBe('docFilm')
    expect(categoryFromTmdbMovie({ genre_ids: [35] })).toBe('movie')
  })
})
