import { describe, expect, it } from 'vitest'
import { classifyAll } from './stats'
import { catchUpSeries, computeValue, cycleShows, cycleStart, dateKey, initialValueSettings, nextCycle, parseDate, type ValueSettings } from './value'

const today = new Date(2026, 9, 15)
const entriesOf = (...pairs: [string, string][]) => classifyAll(pairs.map(([title, date]) => ({ title, date: parseDate(date), rawDate: date })))
const settingsOf = (patch: Partial<ValueSettings> = {}): ValueSettings => ({
  ...initialValueSettings([], today), from: '2026-01-01', to: '2026-01-31', ...patch,
})

describe('본전 · 비용과 결제 주기', () => {
  it('본인 포함 분담 인원으로 추가회원 비용까지 나누고 수동 개인 부담액을 우선한다', () => {
    const settings = settingsOf({ monthlyPrice: 17000, extraFee: 5000, otherPeople: 3 })
    expect(computeValue([], settings, today).costPerCycle).toBe(5500)
    expect(computeValue([], { ...settings, costMode: 'personal', personalPrice: 4000 }, today).totalCost).toBe(4000)
  })

  it('시청하지 않은 달도 과금하며 제외한 주기는 비용과 시청 모두 제외한다', () => {
    const entries = entriesOf(['영화', '2026-01-01'], ['다른 영화', '2026-03-01'])
    const settings = settingsOf({ to: '2026-03-31' })
    const report = computeValue(entries, settings, today)
    expect(report.cycles).toHaveLength(3)
    expect(report.cycles[1].net).toBe(0)
    expect(report.totalCost).toBe(21000)
    const excluded = computeValue(entries, { ...settings, excludedCycles: ['2026-01-01', '2026-02-01'] }, today)
    expect(excluded.totalCost).toBe(7000)
    expect(excluded.gross).toBe(1500)
    expect(excluded.outsideCount).toBe(1)
  })

  it('31일 결제를 평년·윤년 말일로 보정한 후 원래 결제일을 복원한다', () => {
    const january = parseDate('2024-01-31')
    expect(dateKey(nextCycle(january, 31))).toBe('2024-02-29')
    expect(dateKey(nextCycle(parseDate('2024-02-29'), 31))).toBe('2024-03-31')
    expect(dateKey(cycleStart(parseDate('2026-02-27'), 31))).toBe('2026-01-31')
    expect(dateKey(cycleStart(parseDate('2026-02-28'), 31))).toBe('2026-02-28')
  })

  it('기간이 결제 주기 중간이어도 전액을 반영하고 하루 비용의 분모는 전체 주기 일수다', () => {
    const report = computeValue([], settingsOf({ from: '2026-02-10', to: '2026-02-12', billingDay: 15 }), today)
    const cycle = report.cycles[0]
    expect(dateKey(cycle.start)).toBe('2026-01-15')
    expect(dateKey(cycle.end)).toBe('2026-02-14')
    expect(cycle.partial).toBe(true)
    expect(cycle.days).toHaveLength(3)
    expect(cycle.daysInCycle).toBe(31)
    expect(cycle.cost).toBe(7000)
  })

  it('연도를 넘기는 결제 주기를 유지하고 다음 주기에 누적값을 초기화한다', () => {
    const entries = entriesOf(['영화1', '2025-12-31'], ['영화2', '2026-01-15'])
    const report = computeValue(entries, settingsOf({ from: '2025-12-15', to: '2026-02-14', billingDay: 15 }), today)
    expect(report.cycles.map((item) => item.key)).toEqual(['2025-12-15', '2026-01-15'])
    expect(report.cycles[1].days[0].cumulative).toBe(1500)
  })

  it('0원 부담을 달성 주기로 꾸미지 않고 달성일을 비워 둔다', () => {
    const report = computeValue(entriesOf(['영화', '2026-01-01']), settingsOf({ monthlyPrice: 0 }), today)
    expect(report.totalCost).toBe(0)
    expect(report.cycles[0].reached).toBe(false)
    expect(report.cycles[0].firstReached).toBeNull()
  })
})

describe('본전 · 콘텐츠와 날짜별 결과', () => {
  it('객체 속성과 같은 제목도 일반 작품처럼 계산한다', () => {
    const entries = entriesOf(['constructor', '2026-01-01'], ['__proto__', '2026-01-01'])
    expect(computeValue(entries, settingsOf(), today).gross).toBe(3000)
    const settings = settingsOf({ shows: { ['__proto__']: { category: 'movie', price: 500 } } })
    expect(computeValue(entries, settings, today).gross).toBe(2000)
  })
  it('유형별 가격·작품별 수동 단가를 합산하고 같은 날짜 중복행만 제거한다', () => {
    const entries = entriesOf(['애니: 시즌 1: 1화', '2026-01-01'], ['애니: 시즌 1: 1화', '2026-01-01'],
      ['애니: 시즌 1: 1화', '2026-01-02'], ['영화', '2026-01-02'])
    const report = computeValue(entries, settingsOf({ shows: { 애니: { category: 'anime' }, 영화: { category: 'movie', price: 2500 } } }), today)
    expect(report.gross).toBe(3900)
    expect(report.duplicateCount).toBe(1)
    expect(report.typeRateGross).toBe(1400)
    expect(report.estimatedCount).toBe(0)
  })

  it('유형 미지정을 추정으로 집계하고 미확인을 실제 0원 가격과 구분한다', () => {
    const entries = entriesOf(['시리즈: 시즌 1: 1화', '2026-01-01'], ['미확인', '2026-01-01'], ['무료', '2026-01-01'], ['독점작', '2026-01-01'])
    const report = computeValue(entries, settingsOf({ shows: { 미확인: { category: 'exclude' }, 무료: { category: 'custom', price: 0 }, 독점작: { category: 'custom' } } }), today)
    expect(report.gross).toBe(1650)
    expect(report.estimatedCount).toBe(1)
    expect(report.excludedCount).toBe(2)
    expect(report.cycles[0].days[0].watches).toHaveLength(2)
  })

  it('누적 환산액이 부담액을 처음 넘은 날을 최초 도달일로 기록하며 시청 없는 날도 채운다', () => {
    const entries = entriesOf(['가', '2026-01-01'], ['나', '2026-01-04'], ['다', '2026-01-05'])
    const cycle = computeValue(entries, settingsOf({ monthlyPrice: 3000 }), today).cycles[0]
    expect(cycle.firstReached).toBe('2026-01-04')
    expect(cycle.days).toHaveLength(31)
    expect(cycle.reached).toBe(true)
  })

  it('그 달 작품별 기여를 모으고 못 채운 금액을 보던 시리즈로 채울 회차를 계산한다', () => {
    const entries = entriesOf(['드라마: 시즌 1: 1화', '2026-01-01'], ['드라마: 시즌 1: 2화', '2026-01-02'], ['영화', '2026-01-03'])
    const settings = settingsOf({ shows: { 드라마: { category: 'drama' } } })
    const cycle = computeValue(entries, settings, today).cycles[0]
    const shows = cycleShows(cycle, settings)
    expect(shows.map((s) => [s.show, s.count, s.net])).toEqual([['드라마', 2, 3300], ['영화', 1, 1500]])
    expect(catchUpSeries(shows, cycle.cost - cycle.net)).toMatchObject([{ show: '드라마', needed: 2 }])
  })

  it('TMDB 추정 유형을 기본값보다 먼저, 사용자 지정보다 나중에 적용한다', () => {
    const entries = entriesOf(['애니: 시즌 1: 1화', '2026-01-01'])
    expect(computeValue(entries, settingsOf({ guesses: { 애니: 'anime' } }), today).gross).toBe(700)
    expect(computeValue(entries, settingsOf({ guesses: { 애니: 'anime' }, shows: { 애니: { category: 'drama' } } }), today).gross).toBe(1650)
  })

  it('분석 범위 밖의 시청량은 본전에 기여하지 않는다', () => {
    const report = computeValue(entriesOf(['이전', '2025-12-31'], ['범위 안', '2026-01-01'], ['이후', '2026-02-01']), settingsOf(), today)
    expect(report.outsideCount).toBe(2)
    expect(report.gross).toBe(1500)
  })
})

describe('본전 · 광고 시간', () => {
  it('초반 무광고 건수를 결제 주기를 넘어 누적 적용하고 작품별 광고 수를 반영한다', () => {
    const entries = entriesOf(['애니: 시즌 1: 1화', '2026-01-01'], ['애니: 시즌 1: 2화', '2026-02-01'], ['영화', '2026-02-02'])
    const report = computeValue(entries, settingsOf({ to: '2026-02-28', adsEnabled: true, adFreeEntries: 1,
      shows: { 애니: { category: 'anime', adCount: 4 }, 영화: { category: 'movie', adCount: 0 } } }), today)
    expect(report.cycles[0].adCost).toBe(0)
    expect(report.cycles[1].adCost).toBeCloseTo(10000 / 60)
    expect(report.net).toBeCloseTo(2900 - 10000 / 60)
  })

  it('광고 시간 비용을 추정하고 키즈 프로필에서는 0으로 만든다', () => {
    const entries = entriesOf(['영화', '2026-01-01'])
    const settings = settingsOf({ adsEnabled: true })
    expect(computeValue(entries, settings, today).adCost).toBeCloseTo(10000 / 120)
    expect(computeValue(entries, { ...settings, kidsProfile: true }, today).adCost).toBe(0)
    expect(computeValue(entries, { ...settings, adsEnabled: false }, today).adCost).toBe(0)
  })

  it('이전에 도달했더라도 광고 시간 비용으로 다시 미달할 수 있음을 보존한다', () => {
    const cycle = computeValue(entriesOf(['가', '2026-01-01'], ['나', '2026-01-02']), settingsOf({ monthlyPrice: 1000,
      adsEnabled: true, shows: { 가: { category: 'movie', adCount: 0 }, 나: { category: 'movie', adCount: 60 } } }), today).cycles[0]
    expect(cycle.firstReached).toBe('2026-01-01')
    expect(cycle.net).toBeCloseTo(500)
    expect(cycle.reached).toBe(false)
  })

  it('드라마 2회·애니 3화·영화 1편의 혼합 시청 예제를 검증한다', () => {
    const entries = entriesOf(['드라마: 시즌 1: 1화', '2026-01-01'], ['드라마: 시즌 1: 2화', '2026-01-02'],
      ['애니: 시즌 1: 1화', '2026-01-03'], ['애니: 시즌 1: 2화', '2026-01-04'], ['애니: 시즌 1: 3화', '2026-01-05'], ['영화', '2026-01-06'])
    const report = computeValue(entries, settingsOf({ adsEnabled: true, shows: {
      드라마: { category: 'drama' }, 애니: { category: 'anime' }, 영화: { category: 'movie', price: 2500 },
    } }), today)
    expect(report.gross).toBe(7900)
    expect(report.adCost).toBeCloseTo(500)
    expect(report.net).toBeCloseTo(7400)
    expect(report.cycles[0].firstReached).toBe('2026-01-06')
  })
})

describe('본전 · 입력 검증', () => {
  it('미래 날짜·역순 기간·잘못된 날짜를 거절한다', () => {
    expect(() => computeValue([], settingsOf({ to: '2027-01-01' }), today)).toThrow('미래')
    expect(() => computeValue([], settingsOf({ from: '2026-02-01' }), today)).toThrow('종료일')
    expect(() => parseDate('2026-02-30')).toThrow('올바른 날짜')
  })

  it('음수 단가·유효하지 않은 공유 인원과 결제일을 거절한다', () => {
    expect(() => computeValue([], settingsOf({ monthlyPrice: -1 }), today)).toThrow('0 이상')
    expect(() => computeValue([], settingsOf({ otherPeople: 1.5 }), today)).toThrow('공유 인원')
    expect(() => computeValue([], settingsOf({ billingDay: 0 }), today)).toThrow('결제일')
  })
})
