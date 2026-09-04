/** 한 해 돌아보기 모델. 화면 필터와 무관하게 "불러온 전체 기록"의 한 해만 잘라 계산한다. */

import { computeStats, type Entry, type Kind, type Streak } from './stats'

/** 기록이 있는 연도. 최신 연도가 앞에 온다. */
export function recapYears(entries: Entry[]): number[] {
  return [...new Set(entries.map((e) => e.date.getFullYear()))].sort((a, b) => b - a)
}

export type RecapShow = { show: string; count: number; kind: Kind }
export type RecapCalendarDay = { date: Date; count: number; inStreak: boolean; monthMarker: string | null }

export type Recap = {
  year: number
  /** 윤년이면 366 */
  daysInYear: number
  total: number
  activeDays: number
  perActiveDay: number
  /** 많이 본 순, 최대 5개. 기록이 적으면 그만큼만 담긴다. */
  topShows: RecapShow[]
  showCount: number
  first: Date
  last: Date
  mostRecentShow: RecapShow
  topShare: number
  busiestMonth: { month: number; count: number }
  favoriteWeekday: { label: string; count: number }
  busiestDay: { date: Date; count: number }
  bingeDays: number
  monthlyAverage: number
  /** 선택한 해 안에서만 이어진 최장 구간 */
  longestStreak: Streak
  /** 최장 스트릭 주변을 월 경계와 무관하게 펼친 35일(7×5) */
  streakWindow: RecapCalendarDay[]
  seriesViews: number
  movieViews: number
}

/**
 * 한 해치 결산을 만든다. 해당 연도에 기록이 없으면 null.
 * 동점은 모두 결정적으로 끊는다 — 작품은 이름순, 달·요일은 앞선 쪽, 날짜는 이른 쪽.
 */
export function buildRecap(entries: Entry[], year: number): Recap | null {
  const yearEntries = entries.filter((e) => e.date.getFullYear() === year)
  const stats = computeStats(yearEntries)
  if (!stats || !stats.busiestDay || !stats.longestStreak) return null

  // byMonth·byWeekday 는 오름차순이라 strict 비교면 동점 시 앞선 달·요일이 남는다
  const month = stats.byMonth.reduce((best, m) => (m.count > best.count ? m : best))
  const weekday = stats.byWeekday.reduce((best, d) => (d.count > best.count ? d : best))

  const topShows = stats.shows.slice(0, 5).map(({ show, count, kind }) => ({ show, count, kind }))
  const recentEntry = [...yearEntries].sort((a, b) => b.date.getTime() - a.date.getTime() || a.show.localeCompare(b.show, 'ko'))[0]

  return {
    year,
    daysInYear: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000,
    total: stats.total,
    activeDays: stats.activeDays,
    perActiveDay: stats.perActiveDay,
    topShows,
    showCount: stats.shows.length,
    first: stats.first,
    last: stats.last,
    mostRecentShow: { show: recentEntry.show, count: stats.shows.find((s) => s.show === recentEntry.show)?.count ?? 1, kind: recentEntry.kind },
    topShare: Math.round(((topShows[0]?.count ?? 0) / stats.total) * 100),
    busiestMonth: { month: Number(month.key.slice(-2)), count: month.count },
    favoriteWeekday: weekday,
    busiestDay: stats.busiestDay,
    bingeDays: stats.byDay.filter((d) => d.count >= 3).length,
    monthlyAverage: stats.total / 12,
    longestStreak: stats.longestStreak,
    streakWindow: buildStreakWindow(stats.byDay, stats.longestStreak, year),
    seriesViews: stats.episodeCount,
    movieViews: stats.total - stats.episodeCount,
  }
}


/** 공유 카드는 360×640 DOM 을 3배로 떠서 정확히 1080×1920 PNG 로 만든다. */
export const SHARE_CARD = { width: 360, height: 640, pixelRatio: 3 } as const

export const RECAP_EXPORTS = [
  '01-overview',
  '02-top-shows',
  '03-habits',
  '04-streak',
  '05-summary',
] as const

export const recapFileName = (year: number, index = 0) =>
  `${year}-year-in-review-${RECAP_EXPORTS[Math.min(RECAP_EXPORTS.length - 1, Math.max(0, index))]}.png`

/** html-to-image 옵션. 외부 폰트·이미지를 끌어오지 않도록 폰트 임베드를 끈다. */
export const sharePngOptions = (backgroundColor = '#08080b') => ({
  ...SHARE_CARD,
  backgroundColor,
  skipFonts: true,
  cacheBust: false,
})

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (date: Date, amount: number) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + amount)
  return next
}

/** 최장 스트릭을 포함하는 결정적인 35일 창. 가능한 한 선택 연도 안에 둔다. */
export function buildStreakWindow(byDay: { date: Date; count: number }[], streak: Streak, year: number): RecapCalendarDay[] {
  const first = new Date(year, 0, 1)
  const lastStart = addDays(new Date(year, 11, 31), -34)
  const padBefore = Math.floor((35 - Math.min(streak.days, 35)) / 2)
  let start = addDays(streak.from, -padBefore)
  if (start < first) start = first
  if (start > lastStart) start = lastStart

  const counts = new Map(byDay.map((d) => [dayKey(d.date), d.count]))
  return Array.from({ length: 35 }, (_, index) => {
    const date = addDays(start, index)
    const inStreak = date >= streak.from && date <= streak.to
    return {
      date,
      count: counts.get(dayKey(date)) ?? 0,
      inStreak,
      monthMarker: index === 0 || date.getDate() === 1 ? `${date.getMonth() + 1}월` : null,
    }
  })
}
