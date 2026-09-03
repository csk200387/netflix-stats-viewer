import type { ViewRecord } from './parse'

export type Kind = 'series' | 'movie'

export type Entry = ViewRecord & {
  /** 작품명 (시리즈면 시즌·에피소드를 뗀 이름) */
  show: string
  /** 시즌 표기 ("시즌 1", "리미티드 시리즈" 등). 없으면 null */
  season: string | null
  /** 에피소드명. 영화면 null */
  episode: string | null
  kind: Kind
}

/** 시즌/파트 표기 — 이 조각이 나오면 앞은 작품명, 뒤는 에피소드로 본다. */
const SEASON_RE =
  /^(?:시즌|시리즈|파트|챕터|권|부)\s*\d+$|^\d+\s*(?:기|부|권|시즌|시리즈)$|^(?:리미티드 시리즈|미니시리즈|컬렉션|특별판)$|^(?:season|series|part|chapter|book|vol(?:ume)?\.?)\s*\d+$|^limited series$/i

/** 마지막 조각이 에피소드 번호인 경우 ("12화", "제3화", "Episode 4") */
const EPISODE_RE = /^(?:제\s*)?\d+\s*(?:화|회)$|^(?:ep(?:isode)?|에피소드)\.?\s*\d+$/i

/**
 * 시리즈 판별 임계값. 시즌·화수 표기가 없는 작품은 "작품명: 부제" 꼴이
 * 서로 다른 부제로 이만큼 이상 모였을 때만 시리즈로 본다.
 * ponytail: 단순 빈도 휴리스틱. 시리즈 1편만 본 경우엔 영화로 잡히며,
 * 정확도가 더 필요하면 외부 메타데이터 조회로 올려야 한다.
 */
const SERIES_MIN_EPISODES = 3

const splitSegments = (title: string) => title.split(/\s*:\s*/)

/** 제목 목록 전체를 보고 작품명·종류를 추정한다. (빈도 판단 때문에 배치 처리) */
export function classifyAll(records: ViewRecord[]): Entry[] {
  // 1차: 표기로 바로 판별되는 것과 애매한 것을 나눈다
  const subtitlesByPrefix = new Map<string, Set<string>>()
  for (const r of records) {
    const seg = splitSegments(r.title)
    if (seg.length < 2) continue
    const set = subtitlesByPrefix.get(seg[0]) ?? new Set<string>()
    set.add(seg.slice(1).join(': '))
    subtitlesByPrefix.set(seg[0], set)
  }

  return records.map((r) => {
    const seg = splitSegments(r.title)
    const seasonIdx = seg.findIndex((s, i) => i > 0 && SEASON_RE.test(s))
    if (seasonIdx > 0) {
      return {
        ...r,
        show: seg.slice(0, seasonIdx).join(': '),
        season: seg[seasonIdx],
        episode: seg.slice(seasonIdx + 1).join(': ') || null,
        kind: 'series' as const,
      }
    }
    if (seg.length >= 2 && EPISODE_RE.test(seg[seg.length - 1])) {
      return {
        ...r,
        show: seg.slice(0, -1).join(': '),
        season: null,
        episode: seg[seg.length - 1],
        kind: 'series' as const,
      }
    }
    if (seg.length >= 2 && (subtitlesByPrefix.get(seg[0])?.size ?? 0) >= SERIES_MIN_EPISODES) {
      return {
        ...r,
        show: seg[0],
        season: null,
        episode: seg.slice(1).join(': '),
        kind: 'series' as const,
      }
    }
    return { ...r, show: r.title, season: null, episode: null, kind: 'movie' as const }
  })
}

export type ShowSummary = {
  show: string
  kind: Kind
  count: number
  seasons: number
  first: Date
  last: Date
  days: number
}

export type Stats = {
  total: number
  activeDays: number
  first: Date
  last: Date
  /** 첫 시청일부터 마지막 시청일까지의 일수 */
  spanDays: number
  perActiveDay: number
  seriesCount: number
  movieCount: number
  episodeCount: number
  topShow: ShowSummary | null
  busiestDay: { date: Date; count: number } | null
  longestStreak: { days: number; from: Date; to: Date } | null
  byMonth: { key: string; label: string; count: number }[]
  byWeekday: { label: string; count: number }[]
  shows: ShowSummary[]
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const DAY_MS = 86_400_000

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function computeStats(entries: Entry[]): Stats | null {
  if (entries.length === 0) return null

  const times = entries.map((e) => e.date.getTime())
  const first = new Date(Math.min(...times))
  const last = new Date(Math.max(...times))

  const perDay = new Map<string, number>()
  const byWeekday = new Array(7).fill(0) as number[]
  const showMap = new Map<string, { kind: Kind; count: number; seasons: Set<string>; days: Set<string>; first: number; last: number }>()

  for (const e of entries) {
    const dk = dayKey(e.date)
    perDay.set(dk, (perDay.get(dk) ?? 0) + 1)
    byWeekday[e.date.getDay()]++

    const s = showMap.get(e.show) ?? {
      kind: e.kind,
      count: 0,
      seasons: new Set<string>(),
      days: new Set<string>(),
      first: e.date.getTime(),
      last: e.date.getTime(),
    }
    s.count++
    s.days.add(dk)
    if (e.season) s.seasons.add(e.season)
    if (e.kind === 'series') s.kind = 'series'
    s.first = Math.min(s.first, e.date.getTime())
    s.last = Math.max(s.last, e.date.getTime())
    showMap.set(e.show, s)
  }

  const shows: ShowSummary[] = [...showMap.entries()]
    .map(([show, s]) => ({
      show,
      kind: s.kind,
      count: s.count,
      seasons: s.seasons.size,
      first: new Date(s.first),
      last: new Date(s.last),
      days: s.days.size,
    }))
    .sort((a, b) => b.count - a.count || a.show.localeCompare(b.show, 'ko'))

  // 월별: 기록이 없는 달도 0으로 채워 흐름이 끊기지 않게 한다
  const byMonth: Stats['byMonth'] = []
  const monthCounts = new Map<string, number>()
  for (const e of entries) {
    const k = monthKey(e.date)
    monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1)
  }
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d.setMonth(d.getMonth() + 1)) {
    const k = monthKey(d)
    byMonth.push({ key: k, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`, count: monthCounts.get(k) ?? 0 })
  }

  let busiestDay: Stats['busiestDay'] = null
  for (const [k, count] of perDay) {
    if (!busiestDay || count > busiestDay.count) {
      const [y, m, dd] = k.split('-').map(Number)
      busiestDay = { date: new Date(y, m - 1, dd), count }
    }
  }

  // 연속 시청 최장 구간
  const sortedDays = [...perDay.keys()].sort().map((k) => {
    const [y, m, dd] = k.split('-').map(Number)
    return new Date(y, m - 1, dd).getTime()
  })
  let longestStreak: Stats['longestStreak'] = null
  let runStart = 0
  for (let i = 1; i <= sortedDays.length; i++) {
    const broken = i === sortedDays.length || sortedDays[i] - sortedDays[i - 1] > DAY_MS * 1.5
    if (!broken) continue
    const days = i - runStart
    if (!longestStreak || days > longestStreak.days) {
      longestStreak = { days, from: new Date(sortedDays[runStart]), to: new Date(sortedDays[i - 1]) }
    }
    runStart = i
  }

  return {
    total: entries.length,
    activeDays: perDay.size,
    first,
    last,
    spanDays: Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1,
    perActiveDay: entries.length / perDay.size,
    seriesCount: shows.filter((s) => s.kind === 'series').length,
    movieCount: shows.filter((s) => s.kind === 'movie').length,
    episodeCount: entries.filter((e) => e.kind === 'series').length,
    topShow: shows[0] ?? null,
    busiestDay,
    longestStreak,
    byMonth,
    byWeekday: WEEKDAYS.map((label, i) => ({ label, count: byWeekday[i] })),
    shows,
  }
}

export const fmtDate = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
export const fmtDateInput = (d: Date) => dayKey(d)
