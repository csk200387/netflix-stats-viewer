import { describe, expect, it } from 'vitest'
import { percent } from './format'
import { classifyAll } from './stats'
import {
  DEFAULT_RATES, catchUpSeries, computeValue, cycleShows, cycleStart, dateKey, initialValueSettings, nextCycle, parseDate,
  summarizeValue, valueBasis, type CategoryId, type ShowValue, type ValueSettings,
} from './value'

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
    expect(valueBasis(report).sources).toMatchObject({ user: { count: 3 }, tmdb: { count: 0 }, default: { count: 0 } })
  })

  it('유형 미지정을 추정으로 집계하고 미확인을 실제 0원 가격과 구분한다', () => {
    const entries = entriesOf(['시리즈: 시즌 1: 1화', '2026-01-01'], ['미확인', '2026-01-01'], ['무료', '2026-01-01'], ['독점작', '2026-01-01'])
    const report = computeValue(entries, settingsOf({ shows: { 미확인: { category: 'exclude' }, 무료: { category: 'custom', price: 0 }, 독점작: { category: 'custom' } } }), today)
    expect(report.gross).toBe(1650)
    expect(valueBasis(report).sources).toMatchObject({ user: { count: 1, gross: 0 }, default: { count: 1, gross: 1650 } })
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

describe('본전 · 결론이 기대는 가정', () => {
  // 1월: TMDB가 찾은 드라마 2화(1,650×2) + 장르 미확인 시리즈 2화(기본 1,650×2) + 직접 단가 영화 1편(2,000). 2월: 기록 없음
  const entries = entriesOf(
    ['드라마: 시즌 1: 1화', '2026-01-03'], ['드라마: 시즌 1: 2화', '2026-01-04'],
    ['모르는 쇼: 시즌 1: 1화', '2026-01-10'], ['모르는 쇼: 시즌 1: 2화', '2026-01-11'],
    ['영화', '2026-01-20'],
  )
  const settings = settingsOf({ to: '2026-02-28', guesses: { 드라마: 'drama' }, shows: { 영화: { category: 'movie', price: 2000 } } })
  const report = computeValue(entries, settings, today)
  const basis = valueBasis(report)

  it('손으로 계산한 기대값과 같다', () => {
    // 환산 8,600 ÷ 부담 7,000×2 = 61.4% → 손해, 본전 달성은 1월 하나
    expect([report.gross, report.totalCost, summarizeValue(report).verdict, summarizeValue(report).reachedCycles]).toEqual([8600, 14000, 'short', 1])
    expect(basis.sources).toEqual({
      user: { count: 1, gross: 2000, net: 2000 },
      tmdb: { count: 2, gross: 3300, net: 3300 },
      default: { count: 2, gross: 3300, net: 3300 },
    })
    // 유형별 단가로 센 6,600원에 k를 곱해 6,600k + 2,000 = 14,000 → k = 12,000 / 6,600
    expect(basis.rateFlip).toBeCloseTo(12000 / 6600, 12)
    // 기본값 3,300원을 빼면 5,300 ÷ 14,000, 1월도 5,300 < 7,000 이라 달성 0개
    expect(basis.withoutDefault).toEqual({ ratio: 5300 / 14000, earned: false, reachedCycles: 0 })
    expect(basis.fallbackSeries).toBe(2)
    // 기록 없는 2월(7,000원)을 빼면 8,600 ÷ 7,000 → 뽑았어요로 바뀐다
    expect(basis.idle).toEqual({ keys: ['2026-02-01'], cost: 7000, ratio: 8600 / 7000, earned: true })
    expect(basis.partialCycles).toBe(0)
  })

  it('진행 중인(부분 집계) 주기는 기록이 없어도 ‘기록 없는 주기’로 보지 않는다', () => {
    const partial = valueBasis(computeValue(entries, { ...settings, to: '2026-02-10' }, today))
    expect(partial.idle.keys).toEqual([])
    expect(partial.partialCycles).toBe(1)
  })

  it('부담이 0원이거나 유형별 단가를 쓰지 않으면 단가 배수를 만들지 않는다', () => {
    expect(valueBasis(computeValue(entries, { ...settings, monthlyPrice: 0 }, today))).toMatchObject({ rateFlip: null, idle: { ratio: null, earned: false } })
    const allCustom = { ...settings, guesses: {}, shows: { 드라마: { category: 'custom', price: 900 }, '모르는 쇼': { category: 'exclude' }, 영화: { category: 'movie', price: 2000 } } } satisfies ValueSettings
    expect(valueBasis(computeValue(entries, allCustom, today)).rateFlip).toBeNull()
  })

  // 결정적 의사난수(mulberry32)로 만든 무작위 기록·설정에서, 닫힌 식으로 구한 값을 엔진으로 다시 계산해 맞춰 본다
  const rng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const cases = Array.from({ length: 200 }, (_, n) => {
    const r = rng(n + 1)
    const pick = <T,>(items: readonly T[]) => items[Math.floor(r() * items.length)]
    const pairs = Array.from({ length: 1 + Math.floor(r() * 25) }, (): [string, string] => {
      const show = pick(['가', '나', '다', '라', '마'])
      const title = show === '다' || show === '라' ? show : `${show}: 시즌 1: ${1 + Math.floor(r() * 30)}화`
      return [title, dateKey(new Date(2026, 0, 1 + Math.floor(r() * 90)))]
    })
    const guesses: Record<string, CategoryId> = r() < 0.5 ? { 가: 'anime', 다: 'docFilm' } : { 나: 'drama' }
    const shows: Record<string, ShowValue> = {}
    if (r() < 0.4) shows.라 = { category: 'movie', price: Math.floor(r() * 3000) }
    if (r() < 0.3) shows.마 = { category: pick(['kids', 'exclude', 'custom'] as const) }
    const settings = settingsOf({
      to: '2026-03-31', monthlyPrice: pick([0, 1000, 5500, 7000, 13500, 17000, 40000]), otherPeople: Math.floor(r() * 3),
      guesses, shows, adsEnabled: r() < 0.5, adFreeEntries: pick([0, 0, 2]),
      excludedCycles: ['2026-01-01', '2026-02-01', '2026-03-01'].filter(() => r() < 0.2),
    })
    return { entries: entriesOf(...pairs), settings }
  })
  const scaled = (s: ValueSettings, k: number): ValueSettings =>
    ({ ...s, rates: Object.fromEntries(Object.entries(DEFAULT_RATES).map(([id, p]) => [id, p * k])) as ValueSettings['rates'] })

  it('기록 건수는 계산·제외·중복·기간 밖으로 빠짐없이 나뉘고 근거별 합이 전체와 같다', () => {
    for (const { entries, settings } of cases) {
      const report = computeValue(entries, settings, today)
      const { sources } = valueBasis(report)
      const all = Object.values(sources)
      expect(report.countedCount + report.excludedCount + report.duplicateCount + report.outsideCount).toBe(entries.length)
      expect(all.reduce((sum, s) => sum + s.count, 0)).toBe(report.countedCount)
      expect(report.cycles.reduce((sum, c) => sum + c.recorded, 0)).toBe(report.countedCount + report.excludedCount)
      expect(all.reduce((sum, s) => sum + s.gross, 0)).toBeCloseTo(report.gross, 6)
      expect(all.reduce((sum, s) => sum + s.net, 0)).toBeCloseTo(report.net, 6)
    }
  })

  it('유형별 단가에 배수를 곱하면 바로 그 배수를 경계로 결론이 뒤집힌다', () => {
    let checked = 0
    for (const { entries, settings } of cases) {
      const flip = valueBasis(computeValue(entries, settings, today)).rateFlip
      if (flip === null) continue
      const verdictAt = (k: number) => summarizeValue(computeValue(entries, scaled(settings, k), today)).verdict
      expect(verdictAt(1)).toBe(flip <= 1 + 1e-9 ? 'earned' : 'short')
      if (flip > 0) {
        expect(verdictAt(flip * (1 - 1e-6))).toBe('short')
        expect(verdictAt(flip * (1 + 1e-6))).toBe('earned')
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('‘기록 없는 주기 빼기’와 ‘장르 확인한 기록만’ 결과가 실제로 그렇게 설정해 다시 계산한 값과 같다', () => {
    for (const { entries, settings } of cases) {
      const report = computeValue(entries, settings, today)
      const basis = valueBasis(report)
      if (basis.idle.keys.length > 0 && basis.idle.ratio !== null) {
        const redone = summarizeValue(computeValue(entries, { ...settings, excludedCycles: [...settings.excludedCycles, ...basis.idle.keys] }, today))
        expect(redone.ratio).toBeCloseTo(basis.idle.ratio, 9)
        expect(redone.verdict === 'earned').toBe(basis.idle.earned)
      }
      // 초반 무광고 건수는 계산에 든 기록 순서로 세므로, 기록을 빼면 다른 기록의 광고 여부가 달라진다. 그 경우는 비교하지 않는다
      if (basis.withoutDefault && basis.withoutDefault.ratio !== null && !(settings.adsEnabled && settings.adFreeEntries > 0)) {
        const unknown = [...new Set(report.cycles.flatMap((c) => c.days.flatMap((d) => d.watches)).filter((w) => w.source === 'default').map((w) => w.entry.show))]
        const shows = { ...settings.shows, ...Object.fromEntries(unknown.map((name) => [name, { category: 'exclude' as const }])) }
        const redone = summarizeValue(computeValue(entries, { ...settings, shows }, today))
        expect(redone.ratio).toBeCloseTo(basis.withoutDefault.ratio, 9)
        expect(redone.verdict === 'earned').toBe(basis.withoutDefault.earned)
        expect(redone.reachedCycles).toBe(basis.withoutDefault.reachedCycles)
      }
    }
  })
})

describe('본전 · 퍼센트 표시', () => {
  it('정수로 내려서 100% 미만인데 100%로 보이는 일이 없다', () => {
    expect([0.9996, 1, 2.4599, 0.29, 0.07].map(percent)).toEqual(['99%', '100%', '245%', '29%', '7%'])
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
