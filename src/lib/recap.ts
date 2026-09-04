/** 연말 결산 모델. 화면 필터와 무관하게 "불러온 전체 기록"의 한 해만 잘라 계산한다. */

import { computeStats, type Entry, type Kind, type Streak } from './stats'

/** 기록이 있는 연도. 최신 연도가 앞에 온다. */
export function recapYears(entries: Entry[]): number[] {
  return [...new Set(entries.map((e) => e.date.getFullYear()))].sort((a, b) => b - a)
}

export type RecapShow = { show: string; count: number; kind: Kind }

export type Recap = {
  year: number
  /** 윤년이면 366 */
  daysInYear: number
  total: number
  activeDays: number
  perActiveDay: number
  /** 많이 본 순, 최대 3개. 기록이 적으면 그만큼만 담긴다. */
  topShows: RecapShow[]
  showCount: number
  busiestMonth: { month: number; count: number }
  favoriteWeekday: { label: string; count: number }
  busiestDay: { date: Date; count: number }
  /** 선택한 해 안에서만 이어진 최장 구간 */
  longestStreak: Streak
  seriesViews: number
  movieViews: number
}

/**
 * 한 해치 결산을 만든다. 해당 연도에 기록이 없으면 null.
 * 동점은 모두 결정적으로 끊는다 — 작품은 이름순, 달·요일은 앞선 쪽, 날짜는 이른 쪽.
 */
export function buildRecap(entries: Entry[], year: number): Recap | null {
  const stats = computeStats(entries.filter((e) => e.date.getFullYear() === year))
  if (!stats || !stats.busiestDay || !stats.longestStreak) return null

  // byMonth·byWeekday 는 오름차순이라 strict 비교면 동점 시 앞선 달·요일이 남는다
  const month = stats.byMonth.reduce((best, m) => (m.count > best.count ? m : best))
  const weekday = stats.byWeekday.reduce((best, d) => (d.count > best.count ? d : best))

  return {
    year,
    daysInYear: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000,
    total: stats.total,
    activeDays: stats.activeDays,
    perActiveDay: stats.perActiveDay,
    topShows: stats.shows.slice(0, 3).map(({ show, count, kind }) => ({ show, count, kind })),
    showCount: stats.shows.length,
    busiestMonth: { month: Number(month.key.slice(-2)), count: month.count },
    favoriteWeekday: weekday,
    busiestDay: stats.busiestDay,
    longestStreak: stats.longestStreak,
    seriesViews: stats.episodeCount,
    movieViews: stats.total - stats.episodeCount,
  }
}


/** 공유 카드는 360×640 DOM 을 3배로 떠서 정확히 1080×1920 PNG 로 만든다. */
export const SHARE_CARD = { width: 360, height: 640, pixelRatio: 3 } as const

export const recapFileName = (year: number) => `netflix-recap-${year}.png`

/** html-to-image 옵션. 외부 폰트·이미지를 끌어오지 않도록 폰트 임베드를 끈다. */
export const sharePngOptions = (backgroundColor = '#08080b') => ({
  ...SHARE_CARD,
  backgroundColor,
  skipFonts: true,
  cacheBust: false,
})
