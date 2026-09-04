import { describe, expect, it } from 'vitest'
import type { ViewRecord } from './parse'
import { LEVEL_LABELS, calendarYears, classifyAll, computeStats, levelOf, streakRuns } from './stats'

const rec = (title: string, iso: string): ViewRecord => ({
  title,
  date: new Date(`${iso}T00:00:00`),
  rawDate: iso,
})

const kindOf = (titles: string[]) => {
  const entries = classifyAll(titles.map((t) => rec(t, '2026-01-01')))
  return Object.fromEntries(entries.map((e) => [e.title, `${e.kind}|${e.show}|${e.episode ?? '-'}`]))
}

describe('classifyAll', () => {
  it('시즌 표기가 있으면 시리즈로 보고 작품명을 떼어낸다', () => {
    const r = classifyAll([rec('심야의 서울: 시즌 2: 귀갓길', '2026-01-01')])[0]
    expect([r.kind, r.show, r.season, r.episode]).toEqual(['series', '심야의 서울', '시즌 2', '귀갓길'])
  })

  it('리미티드 시리즈와 영문 시즌 표기도 인식한다', () => {
    expect(kindOf(['코드네임 나비: 리미티드 시리즈: 1화'])['코드네임 나비: 리미티드 시리즈: 1화'])
      .toBe('series|코드네임 나비|1화')
    expect(kindOf(['Dark: Season 1: Secrets'])['Dark: Season 1: Secrets']).toBe('series|Dark|Secrets')
  })

  it('화수 표기만 있어도 시리즈로 본다', () => {
    expect(kindOf(['라면 마스터: 8화'])['라면 마스터: 8화']).toBe('series|라면 마스터|8화')
    expect(kindOf(['Show: Episode 3'])['Show: Episode 3']).toBe('series|Show|Episode 3')
  })

  it('부제만 있는 제목은 같은 작품이 여러 편 모일 때만 시리즈로 본다', () => {
    const many = kindOf(['은하 정비공: 첫 만남', '은하 정비공: 문화제', '은하 정비공: 마왕'])
    expect(many['은하 정비공: 첫 만남']).toBe('series|은하 정비공|첫 만남')

    const few = kindOf(['극장판 구름 위의 우체국: 겨울 편지', '극장판 구름 위의 우체국: 여름 소포'])
    expect(few['극장판 구름 위의 우체국: 겨울 편지']).toBe('movie|극장판 구름 위의 우체국: 겨울 편지|-')
  })

  it('콜론이 없는 제목은 영화로 본다', () => {
    expect(kindOf(['물의 기억'])['물의 기억']).toBe('movie|물의 기억|-')
  })
})

describe('computeStats', () => {
  const entries = classifyAll([
    rec('쇼: 시즌 1: 1화', '2026-01-01'), // 목
    rec('쇼: 시즌 1: 2화', '2026-01-01'),
    rec('쇼: 시즌 2: 3화', '2026-01-02'),
    rec('물의 기억', '2026-03-05'),
  ])

  it('기본 집계를 낸다', () => {
    const s = computeStats(entries)!
    expect(s.total).toBe(4)
    expect(s.activeDays).toBe(3)
    expect(s.spanDays).toBe(64)
    expect(s.seriesCount).toBe(1)
    expect(s.movieCount).toBe(1)
    expect(s.episodeCount).toBe(3)
    expect(s.topShow).toMatchObject({ show: '쇼', count: 3, seasons: 2, days: 2 })
    expect(s.busiestDay).toMatchObject({ count: 2 })
  })

  it('빈 달을 0으로 채운 월별 흐름을 만든다', () => {
    const s = computeStats(entries)!
    expect(s.byMonth.map((m) => m.count)).toEqual([3, 0, 1])
    expect(s.byMonth[0].label).toBe('2026년 1월')
  })

  it('요일 분포와 최장 연속 시청일을 낸다', () => {
    const s = computeStats(entries)!
    expect(s.byWeekday.find((d) => d.label === '목')?.count).toBe(3) // 1/1, 3/5
    expect(s.byWeekday.find((d) => d.label === '금')?.count).toBe(1)
    expect(s.longestStreak?.days).toBe(2)
  })

  it('기록이 없으면 null', () => {
    expect(computeStats([])).toBeNull()
  })
})

/** 날짜 목록으로 통계를 낸다. 같은 날짜를 여러 번 주면 그날 편수가 늘어난다. */
const statsOf = (isos: string[], today?: Date) =>
  computeStats(
    classifyAll(isos.map((iso, i) => rec(`작품 ${i}`, iso))),
    today,
  )!

const daysOf = (isos: string[]) => statsOf(isos).byDay
const at = (iso: string) => new Date(`${iso}T12:00:00`)

describe('streakRuns', () => {
  it('이어진 날은 한 구간으로, 끊긴 날은 다른 구간으로 나눈다', () => {
    const runs = streakRuns(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05'])
    expect(runs.map((r) => r.days)).toEqual([3, 1])
    expect(runs[0].from.getDate()).toBe(1)
    expect(runs[0].to.getDate()).toBe(3)
  })

  it('해를 넘겨도 하루 차이면 끊기지 않는다', () => {
    const runs = streakRuns(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
    expect(runs).toHaveLength(1)
    expect(runs[0].days).toBe(4)
    expect(runs[0].from.getFullYear()).toBe(2025)
    expect(runs[0].to.getFullYear()).toBe(2026)
  })

  it('달을 넘겨도, 윤년 2월 29일도 이어서 센다', () => {
    expect(streakRuns(['2026-01-31', '2026-02-01'])[0].days).toBe(2)
    expect(streakRuns(['2024-02-28', '2024-02-29', '2024-03-01'])[0].days).toBe(3)
  })

  it('평년 2월은 28일 다음이 3월 1일이라 이어진다', () => {
    expect(streakRuns(['2026-02-28', '2026-03-01'])[0].days).toBe(2)
    // 윤년에 29일을 건너뛰면 끊긴 것으로 본다
    expect(streakRuns(['2024-02-28', '2024-03-01']).map((r) => r.days)).toEqual([1, 1])
  })

  it('12월 31일에서 끝나고 다음 해 첫 기록이 1월 2일이면 끊긴다', () => {
    expect(streakRuns(['2025-12-31', '2026-01-02']).map((r) => r.days)).toEqual([1, 1])
  })

  it('서머타임으로 하루가 23·25시간이 되는 날도 이어서 센다', () => {
    // 미국 기준 3/8 봄 시작(23시간), 11/1 가을 종료(25시간)
    expect(streakRuns(['2026-03-07', '2026-03-08', '2026-03-09'])[0].days).toBe(3)
    expect(streakRuns(['2026-10-31', '2026-11-01', '2026-11-02'])[0].days).toBe(3)
    // 유럽·호주 전환일도 마찬가지
    expect(streakRuns(['2026-03-28', '2026-03-29', '2026-03-30'])[0].days).toBe(3)
    expect(streakRuns(['2026-04-04', '2026-04-05', '2026-04-06'])[0].days).toBe(3)
  })

  it('빈 목록은 구간이 없다', () => {
    expect(streakRuns([])).toEqual([])
  })
})

describe('연속 시청 요약', () => {
  it('같은 날 여러 편을 봐도 연속일은 하루로 센다', () => {
    const s = statsOf(['2026-05-01', '2026-05-01', '2026-05-01', '2026-05-02'])
    expect(s.longestStreak?.days).toBe(2)
    expect(s.byDay.map((d) => d.count)).toEqual([3, 1])
  })

  it('가장 긴 구간을 고르고 시작·끝 날짜를 함께 준다', () => {
    const s = statsOf(['2026-01-01', '2026-01-10', '2026-01-11', '2026-01-12'])
    expect(s.longestStreak?.days).toBe(3)
    expect(s.longestStreak?.from.getDate()).toBe(10)
    expect(s.longestStreak?.to.getDate()).toBe(12)
  })

  it('오늘까지 이어지면 현재 연속 시청으로 잡는다', () => {
    const s = statsOf(['2026-03-05', '2026-03-06', '2026-03-07'], at('2026-03-07'))
    expect(s.currentStreak?.days).toBe(3)
    expect(s.currentStreak?.to.getDate()).toBe(7)
  })

  it('오늘 기록이 아직 없어도 어제까지면 진행 중으로 본다', () => {
    expect(statsOf(['2026-03-06', '2026-03-07'], at('2026-03-08')).currentStreak?.days).toBe(2)
  })

  it('이틀 이상 비면 현재 연속 시청은 없다', () => {
    expect(statsOf(['2026-03-06', '2026-03-07'], at('2026-03-09')).currentStreak).toBeNull()
  })

  it('해가 바뀌어도 어제는 어제다', () => {
    const s = statsOf(['2025-12-30', '2025-12-31'], at('2026-01-01'))
    expect(s.currentStreak?.days).toBe(2)
  })

  it('현재 구간이 최장 구간과 다를 수 있다', () => {
    const s = statsOf(['2026-01-01', '2026-01-02', '2026-01-03', '2026-03-07'], at('2026-03-07'))
    expect(s.longestStreak?.days).toBe(3)
    expect(s.currentStreak?.days).toBe(1)
  })
})

describe('byDay 집계', () => {
  it('날짜 오름차순으로, 그날 본 제목을 함께 담는다', () => {
    const s = computeStats(classifyAll([rec('나중 작품', '2026-02-02'), rec('먼저 작품', '2026-02-01')]))!
    expect(s.byDay.map((d) => d.key)).toEqual(['2026-02-01', '2026-02-02'])
    expect(s.byDay[0].titles).toEqual(['먼저 작품'])
    expect(s.byDay[0].date.getDate()).toBe(1)
  })

  it('activeDays와 길이가 같다', () => {
    const s = statsOf(['2026-02-01', '2026-02-01', '2026-02-03'])
    expect(s.byDay).toHaveLength(s.activeDays)
  })
})

describe('levelOf', () => {
  it('편수에 따라 0~4단계로 나눈다', () => {
    expect([0, 1, 2, 3, 4, 5, 40].map(levelOf)).toEqual([0, 1, 2, 3, 3, 4, 4])
  })

  it('범례 문구가 단계 경계와 맞는다', () => {
    expect(LEVEL_LABELS).toEqual(['1편', '2편', '3~4편', '5편 이상'])
  })
})

describe('calendarYears', () => {
  it('기록이 없으면 빈 배열', () => {
    expect(calendarYears([])).toEqual([])
  })

  it('해마다 하나씩, 기록이 없는 중간 해도 빠뜨리지 않는다', () => {
    const years = calendarYears(daysOf(['2024-06-01', '2026-06-01']))
    expect(years.map((y) => y.year)).toEqual([2024, 2025, 2026])
    expect(years[1].total).toBe(0)
    expect(years[1].activeDays).toBe(0)
  })

  it('해를 넘긴 기록은 각자의 해에 들어간다', () => {
    const years = calendarYears(daysOf(['2025-12-31', '2026-01-01']))
    expect(years.map((y) => y.year)).toEqual([2025, 2026])
    expect(years[0].total).toBe(1)
    expect(years[1].total).toBe(1)
    // 2025년 격자의 12월 31일 칸에만 기록이 있다
    const cells2025 = years[0].weeks.flat().filter((c) => c && c.count > 0)
    expect(cells2025.map((c) => c!.key)).toEqual(['2025-12-31'])
  })

  it('모든 주는 7칸이고, 해 밖의 자리는 null이다', () => {
    const [y2024] = calendarYears(daysOf(['2024-06-01']))
    expect(y2024.weeks.every((w) => w.length === 7)).toBe(true)
    // 2024-01-01은 월요일 → 첫 주의 일요일 자리는 전 해라서 비어 있다
    expect(y2024.weeks[0][0]).toBeNull()
    expect(y2024.weeks[0][1]?.key).toBe('2024-01-01')
  })

  it('윤년은 366칸, 평년은 365칸을 채운다', () => {
    const filled = (iso: string) => calendarYears(daysOf([iso]))[0].weeks.flat().filter(Boolean).length
    expect(filled('2024-06-01')).toBe(366)
    expect(filled('2026-06-01')).toBe(365)
  })

  it('1월 1일이 일요일이면 앞 여백이 없다', () => {
    const [y2023] = calendarYears(daysOf(['2023-06-01']))
    expect(y2023.weeks[0][0]?.key).toBe('2023-01-01')
  })

  it('12월 31일이 토요일이면 뒤 여백이 없다', () => {
    const [y2022] = calendarYears(daysOf(['2022-06-01']))
    const lastWeek = y2022.weeks[y2022.weeks.length - 1]
    expect(lastWeek[6]?.key).toBe('2022-12-31')
  })

  it('달 이름은 12개, 1월은 첫 열에서 시작한다', () => {
    const [y] = calendarYears(daysOf(['2026-06-01']))
    expect(y.months).toHaveLength(12)
    expect(y.months[0]).toEqual({ label: '1월', week: 0 })
    expect(y.months[11].label).toBe('12월')
    expect(y.months.map((m) => m.week)).toEqual([...y.months.map((m) => m.week)].sort((a, b) => a - b))
  })

  it('편수를 제 날짜 칸에 넣고 강도까지 매긴다', () => {
    const [y] = calendarYears(daysOf(['2026-06-01', '2026-06-01', '2026-06-01', '2026-06-02']))
    const cells = y.weeks.flat().filter((c) => c && c.count > 0)
    expect(cells.map((c) => [c!.key, c!.count, c!.level])).toEqual([
      ['2026-06-01', 3, 3],
      ['2026-06-02', 1, 1],
    ])
    expect(y.total).toBe(4)
    expect(y.activeDays).toBe(2)
  })
})

/**
 * 칠레는 9월 첫 주 자정에 시계를 돌려 그날 00:00이 존재하지 않는다.
 * 달력을 날짜 객체의 시각으로 비교하면 여기서 마지막 주가 통째로 사라진다.
 */
declare const process: { env: Record<string, string | undefined> }

describe('서머타임이 자정에 시작하는 지역', () => {
  const withTZ = <T>(tz: string, fn: () => T): T => {
    const prev = process.env.TZ
    process.env.TZ = tz
    try {
      return fn()
    } finally {
      process.env.TZ = prev
    }
  }

  it('마지막 주를 잃지 않는다', () => {
    withTZ('America/Santiago', () => {
      const [y] = calendarYears(daysOf(['2022-06-01']))
      expect(y.weeks.flat().filter(Boolean)).toHaveLength(365)
      expect(y.weeks[y.weeks.length - 1][6]?.key).toBe('2022-12-31')
    })
  })

  it('연말 기록을 잃지 않는다', () => {
    withTZ('America/Santiago', () => {
      const years = calendarYears(daysOf(['2025-12-31', '2026-01-01']))
      expect(years.map((y) => y.total)).toEqual([1, 1])
    })
  })

  it('월별 흐름의 마지막 달도 남는다', () => {
    withTZ('America/Santiago', () => {
      expect(statsOf(['2026-07-15', '2026-09-01']).byMonth.at(-1)?.label).toBe('2026년 9월')
    })
  })
})
