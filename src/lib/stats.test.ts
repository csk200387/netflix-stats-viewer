import { describe, expect, it } from 'vitest'
import type { ViewRecord } from './parse'
import { classifyAll, computeStats } from './stats'

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
