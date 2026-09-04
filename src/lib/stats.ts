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

export type Streak = { days: number; from: Date; to: Date }

/** 지역 시간대 달력 하루 단위 집계. */
export type DayCount = { key: string; date: Date; count: number; titles: string[] }

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
  longestStreak: Streak | null
  /** 오늘 또는 어제까지 이어지는 연속 구간. 끊겼으면 null. */
  currentStreak: Streak | null
  /** 기록이 있는 날만, 날짜 오름차순. */
  byDay: DayCount[]
  byMonth: { key: string; label: string; count: number }[]
  byWeekday: { label: string; count: number }[]
  shows: ShowSummary[]
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const DAY_MS = 86_400_000

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const parseDayKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 지역 달력 기준 다음 날. 서머타임으로 하루가 23·25시간이어도 어긋나지 않는다. */
const nextDayKey = (key: string) => {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + 1)
  return dayKey(d)
}

/** 오름차순 날짜 키를 연속 구간으로 끊는다. */
export function streakRuns(keys: string[]): Streak[] {
  const runs: Streak[] = []
  let start = 0
  for (let i = 1; i <= keys.length; i++) {
    if (i < keys.length && keys[i] === nextDayKey(keys[i - 1])) continue
    runs.push({ days: i - start, from: parseDayKey(keys[start]), to: parseDayKey(keys[i - 1]) })
    start = i
  }
  return runs
}

export function computeStats(entries: Entry[], today = new Date()): Stats | null {
  if (entries.length === 0) return null

  const times = entries.map((e) => e.date.getTime())
  const first = new Date(Math.min(...times))
  const last = new Date(Math.max(...times))

  const perDay = new Map<string, DayCount>()
  const byWeekday = new Array(7).fill(0) as number[]
  const showMap = new Map<string, { kind: Kind; count: number; seasons: Set<string>; days: Set<string>; first: number; last: number }>()

  for (const e of entries) {
    const dk = dayKey(e.date)
    const day = perDay.get(dk) ?? { key: dk, date: parseDayKey(dk), count: 0, titles: [] }
    day.count++
    day.titles.push(e.title)
    perDay.set(dk, day)
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
  const lastMonth = monthKey(last)
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); monthKey(d) <= lastMonth; d.setMonth(d.getMonth() + 1)) {
    const k = monthKey(d)
    byMonth.push({ key: k, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`, count: monthCounts.get(k) ?? 0 })
  }

  const byDay = [...perDay.values()].sort((a, b) => a.key.localeCompare(b.key))
  const busiestDay = byDay.reduce<Stats['busiestDay']>(
    (best, d) => (!best || d.count > best.count ? { date: d.date, count: d.count } : best),
    null,
  )

  const runs = streakRuns(byDay.map((d) => d.key))
  const longestStreak = runs.reduce<Streak | null>((best, r) => (!best || r.days > best.days ? r : best), null)
  // 오늘 기록이 아직 없을 수 있으므로 어제까지 이어진 구간도 진행 중으로 본다
  const latest = runs[runs.length - 1]
  const todayKey = dayKey(today)
  const currentStreak =
    latest && (dayKey(latest.to) === todayKey || nextDayKey(dayKey(latest.to)) === todayKey) ? latest : null

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
    currentStreak,
    byDay,
    byMonth,
    byWeekday: WEEKDAYS.map((label, i) => ({ label, count: byWeekday[i] })),
    shows,
  }
}

/**
 * 하루 시청 편수 → 색 강도 1~4단계로 나누는 경계값.
 * 분위수가 아니라 고정 구간이라, 필터를 바꿔도 눈금의 의미가 흔들리지 않는다.
 * ponytail: 하루 20편씩 보는 사용자는 4단계에 몰린다. 그때 가서 분위수로 올리면 된다.
 */
export const LEVEL_STEPS = [1, 2, 3, 5]

/** 범례 문구. LEVEL_STEPS에서 만들어 두 곳이 어긋나지 않게 한다. */
export const LEVEL_LABELS = LEVEL_STEPS.map((step, i) => {
  const next = LEVEL_STEPS[i + 1]
  if (next === undefined) return `${step}편 이상`
  return next - step === 1 ? `${step}편` : `${step}~${next - 1}편`
})

export const levelOf = (count: number) => LEVEL_STEPS.filter((step) => count >= step).length

/** 달력 한 칸. 해당 연도 밖의 자리는 null로 비워 격자만 유지한다. */
export type CalendarCell = DayCount & { level: number }
export type CalendarYear = {
  year: number
  /** 주 단위 열. 각 열은 일요일부터 토요일까지 7칸. */
  weeks: (CalendarCell | null)[][]
  /** 월 이름과 그 달이 시작하는 열 번호 */
  months: { label: string; week: number }[]
  total: number
  activeDays: number
}

/**
 * 일별 집계를 연도별 달력 격자로 편다.
 * 첫 기록의 해부터 마지막 기록의 해까지 빠짐없이 만들고, 각 해는 1월 1일이 든 주의
 * 일요일에서 시작해 12월 31일이 든 주의 토요일에서 끝난다.
 */
export function calendarYears(byDay: DayCount[]): CalendarYear[] {
  if (byDay.length === 0) return []
  const found = new Map(byDay.map((d) => [d.key, d]))
  const firstYear = byDay[0].date.getFullYear()
  const lastYear = byDay[byDay.length - 1].date.getFullYear()
  const years: CalendarYear[] = []

  for (let year = firstYear; year <= lastYear; year++) {
    const lead = new Date(year, 0, 1).getDay() // 1월 1일 앞의 빈 칸 수
    const tail = 6 - new Date(year, 11, 31).getDay() // 12월 31일 뒤의 빈 칸 수
    // 날짜 객체끼리 시각을 비교하면 서머타임이 자정에 시작하는 지역에서 한 주가 통째로 빠진다.
    // 칸 수는 UTC로 세고, 각 칸의 날짜는 생성자의 달력 보정에 맡긴다.
    const cellCount = lead + (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS + tail

    const weeks: CalendarYear['weeks'] = []
    const months: CalendarYear['months'] = []
    let week: (CalendarCell | null)[] = []
    let total = 0
    let activeDays = 0

    for (let i = 0; i < cellCount; i++) {
      const day = new Date(year, 0, 1 - lead + i)
      if (day.getFullYear() !== year) {
        week.push(null)
      } else {
        const key = dayKey(day)
        const hit = found.get(key)
        const count = hit?.count ?? 0
        week.push({ key, date: day, count, titles: hit?.titles ?? [], level: levelOf(count) })
        total += count
        if (count > 0) activeDays++
        if (day.getDate() === 1) months.push({ label: `${day.getMonth() + 1}월`, week: weeks.length })
      }
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }

    years.push({ year, weeks, months, total, activeDays })
  }
  return years
}

export const fmtDate = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
export const fmtDateInput = (d: Date) => dayKey(d)
