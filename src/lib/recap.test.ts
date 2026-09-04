import { describe, expect, it } from 'vitest'
import type { ViewRecord } from './parse'
import { classifyAll, computeStats } from './stats'
import { SHARE_CARD, buildRecap, recapFileName, recapYears, sharePngOptions } from './recap'

const rec = (title: string, iso: string): ViewRecord => ({ title, date: new Date(`${iso}T00:00:00`), rawDate: iso })
const entriesOf = (...pairs: [string, string][]) => classifyAll(pairs.map(([t, d]) => rec(t, d)))

describe('recapYears', () => {
  it('기록이 있는 연도만 최신순으로 모은다', () => {
    const e = entriesOf(['가', '2024-05-01'], ['나', '2026-01-01'], ['다', '2024-12-31'])
    expect(recapYears(e)).toEqual([2026, 2024])
  })

  it('기록이 없으면 빈 배열', () => {
    expect(recapYears([])).toEqual([])
  })
})

describe('buildRecap 연도 자르기', () => {
  const e = entriesOf(
    ['가작', '2025-06-01'],
    ['가작', '2025-06-02'],
    ['나작', '2026-03-01'],
    ['나작', '2026-03-02'],
    ['나작', '2026-03-03'],
  )

  it('선택한 해의 기록만 센다', () => {
    expect(buildRecap(e, 2026)?.total).toBe(3)
    expect(buildRecap(e, 2025)?.total).toBe(2)
    expect(computeStats(e)?.total).toBe(5)
  })

  it('기록이 없는 해는 null', () => {
    expect(buildRecap(e, 2020)).toBeNull()
  })
})

describe('연말 결산 최장 연속 시청', () => {
  const e = entriesOf(
    ['가작', '2025-12-29'],
    ['가작', '2025-12-30'],
    ['가작', '2025-12-31'],
    ['가작', '2026-01-01'],
    ['가작', '2026-01-02'],
  )

  it('해를 넘긴 연속 구간은 연도 경계에서 끊는다', () => {
    expect(computeStats(e)?.longestStreak?.days).toBe(5)
    const y2025 = buildRecap(e, 2025)!
    const y2026 = buildRecap(e, 2026)!
    expect(y2025.longestStreak.days).toBe(3)
    expect(y2025.longestStreak.to.getMonth()).toBe(11)
    expect(y2026.longestStreak.days).toBe(2)
    expect(y2026.longestStreak.from.getDate()).toBe(1)
  })

  it('윤년 2월 29일도 연속으로 잇고 366일로 센다', () => {
    const leap = entriesOf(['가작', '2024-02-28'], ['가작', '2024-02-29'], ['가작', '2024-03-01'])
    const r = buildRecap(leap, 2024)!
    expect(r.daysInYear).toBe(366)
    expect(r.longestStreak.days).toBe(3)
    expect(buildRecap(entriesOf(['가작', '2025-03-01']), 2025)?.daysInYear).toBe(365)
  })
})

describe('동점 처리', () => {
  it('같은 편수면 작품명 가나다순이 앞선다', () => {
    const r = buildRecap(
      entriesOf(['나작', '2026-01-01'], ['나작', '2026-01-02'], ['가작', '2026-01-03'], ['가작', '2026-01-04']),
      2026,
    )!
    expect(r.topShows.map((s) => s.show)).toEqual(['가작', '나작'])
  })

  it('같은 건수면 앞선 요일·앞선 달을 고른다', () => {
    // 2026-01-05 월요일, 2026-01-06 화요일
    const r = buildRecap(entriesOf(['가작', '2026-01-05'], ['나작', '2026-01-06'], ['다작', '2026-02-05']), 2026)!
    expect(r.favoriteWeekday.label).toBe('월')
    expect(r.busiestMonth.month).toBe(1)
    expect(r.busiestMonth.count).toBe(2)
  })
})

describe('희소한 기록', () => {
  it('한 건짜리 해도 무너지지 않는다', () => {
    const r = buildRecap(entriesOf(['가작', '2026-07-04']), 2026)!
    expect(r.total).toBe(1)
    expect(r.activeDays).toBe(1)
    expect(r.perActiveDay).toBe(1)
    expect(r.topShows).toHaveLength(1)
    expect(r.longestStreak.days).toBe(1)
    expect(r.busiestDay.count).toBe(1)
    expect(r.movieViews).toBe(1)
    expect(r.seriesViews).toBe(0)
  })

  it('시리즈·영화 편수를 나눠 센다', () => {
    const r = buildRecap(
      entriesOf(
        ['심야의 서울: 시즌 1: 1화', '2026-01-01'],
        ['심야의 서울: 시즌 1: 2화', '2026-01-02'],
        ['어떤 영화', '2026-01-03'],
      ),
      2026,
    )!
    expect(r.seriesViews).toBe(2)
    expect(r.movieViews).toBe(1)
    expect(r.topShows[0]).toEqual({ show: '심야의 서울', count: 2, kind: 'series' })
  })
})

describe('공유 이미지 설정', () => {
  it('360×640 카드를 3배로 떠서 1080×1920을 만든다', () => {
    expect(SHARE_CARD.width * SHARE_CARD.pixelRatio).toBe(1080)
    expect(SHARE_CARD.height * SHARE_CARD.pixelRatio).toBe(1920)
    expect(SHARE_CARD.width / SHARE_CARD.height).toBeCloseTo(9 / 16)
  })

  it('옵션은 크기·배율을 그대로 넘기고 폰트 임베드를 끈다', () => {
    const o = sharePngOptions('#000000')
    expect(o).toMatchObject({ width: 360, height: 640, pixelRatio: 3, skipFonts: true, backgroundColor: '#000000' })
  })

  it('파일 이름에 연도를 넣는다', () => {
    expect(recapFileName(2026)).toBe('netflix-recap-2026.png')
  })
})
