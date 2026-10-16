import type { Entry } from './stats'

export const PLANS = [
  { id: 'ads', label: '광고형 스탠다드', price: 7000 },
  { id: 'standard', label: '스탠다드', price: 13500 },
  { id: 'premium', label: '프리미엄', price: 17000 },
  { id: 'custom', label: '직접 입력 / 제휴 요금', price: 7000 },
] as const
export type PlanId = typeof PLANS[number]['id']

/** 유사 작품의 공개 바로보기·대여 가격. 시장 평균이나 넷플릭스 판매가격이 아니다. */
export const CATEGORIES = [
  { id: 'series', label: '회차형 · 유형 미지정', price: 1650 },
  { id: 'drama', label: '국내 드라마', price: 1650 },
  { id: 'variety', label: '예능 · 리얼리티', price: 1650 },
  { id: 'foreign', label: '해외 드라마', price: 1000 },
  { id: 'anime', label: 'TV 애니메이션', price: 700 },
  { id: 'kids', label: '유아 · 교육 · 동요', price: 500 },
  { id: 'docSeries', label: '회차형 다큐멘터리', price: 1650 },
  { id: 'docShort', label: '단편 다큐멘터리', price: 1000 },
  { id: 'docFilm', label: '장편 다큐멘터리', price: 2500 },
  { id: 'movie', label: '영화', price: 1500 },
  { id: 'animeFilm', label: '애니메이션 장편', price: 1000 },
  { id: 'custom', label: '독점작 · 기타 / 직접 단가', price: 0 },
  { id: 'exclude', label: '미확인 · 계산 제외', price: 0 },
] as const
export type CategoryId = typeof CATEGORIES[number]['id']
export type Rates = Record<CategoryId, number>
export const DEFAULT_RATES = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.price])) as Rates

export const planPrice = (id: PlanId) => PLANS.find((p) => p.id === id)!.price
/** 광고 시간 반영은 광고형·직접 입력 요금제에서만 의미가 있다 */
export const adsAllowed = (id: PlanId) => id === 'ads' || id === 'custom'
export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!.label
/** 유형별 기본 단가를 가진 유형 (직접 단가·계산 제외 제외) */
export const PRICED_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'custom' && c.id !== 'exclude')
/** ‘앞으로 이 종류만 본다면?’ 예상에 쓰는 구체적인 유형 */
export const PROJECTION_CATEGORIES = PRICED_CATEGORIES.filter((c) => c.id !== 'series')
export type ShowValue = { category: CategoryId; price?: number; adCount?: number }
export type ValueSettings = {
  monthlyPrice: number
  extraFee: number
  otherPeople: number
  costMode: 'split' | 'personal'
  personalPrice: number
  billingDay: number
  from: string
  to: string
  rates: Rates
  shows: Record<string, ShowValue>
  /** 외부 조회(TMDB)로 추정한 작품별 유형. 사용자 지정(shows)이 우선한다 */
  guesses: Record<string, CategoryId>
  excludedCycles: string[]
  adsEnabled: boolean
  kidsProfile: boolean
  adCount: number
  adSeconds: number
  hourlyValue: number
  adFreeEntries: number
}

export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const parseDate = (key: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('분석 시작일과 종료일을 입력해 주세요.')
  const date = new Date(`${key}T00:00:00`)
  if (!Number.isFinite(date.getTime()) || dateKey(date) !== key) throw new Error('올바른 날짜를 입력해 주세요.')
  return date
}
const dayNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
const addDays = (date: Date, count: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count)
const boundary = (year: number, month: number, day: number) => {
  const first = new Date(year, month, 1)
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, new Date(year, month + 1, 0).getDate()))
}
export function cycleStart(date: Date, billingDay: number): Date {
  const current = boundary(date.getFullYear(), date.getMonth(), billingDay)
  return date < current ? boundary(date.getFullYear(), date.getMonth() - 1, billingDay) : current
}
export const nextCycle = (start: Date, billingDay: number) => boundary(start.getFullYear(), start.getMonth() + 1, billingDay)

export function initialValueSettings(entries: Entry[], today = new Date()): ValueSettings {
  const sorted = entries.map((e) => e.date).sort((a, b) => a.getTime() - b.getTime())
  const first = sorted[0] ?? today
  const last = sorted.at(-1) ?? today
  const monthEnd = new Date(last.getFullYear(), last.getMonth() + 1, 0)
  return {
    monthlyPrice: 7000, extraFee: 0, otherPeople: 0, costMode: 'split', personalPrice: 7000,
    billingDay: 1, from: dateKey(new Date(first.getFullYear(), first.getMonth(), 1)),
    to: dateKey(monthEnd < today ? monthEnd : today), rates: { ...DEFAULT_RATES }, shows: {}, guesses: {}, excludedCycles: [],
    adsEnabled: false, kidsProfile: false, adCount: 2, adSeconds: 15, hourlyValue: 10000,
    adFreeEntries: 0,
  }
}

export const showOverride = (settings: ValueSettings, name: string) => Object.hasOwn(settings.shows, name) ? settings.shows[name] : undefined

export function resolveShow(entry: Entry, settings: ValueSettings) {
  const override = showOverride(settings, entry.show)
  const guess = Object.hasOwn(settings.guesses, entry.show) ? settings.guesses[entry.show] : undefined
  const category = override?.category ?? guess ?? (entry.kind === 'series' ? 'series' : 'movie')
  return { category, price: override?.price ?? settings.rates[category], adCount: override?.adCount ?? settings.adCount,
    estimated: override === undefined, guessed: override === undefined && guess !== undefined, typeRate: override?.price === undefined, unpriced: category === 'custom' && override?.price === undefined }
}

export type ValuedWatch = { entry: Entry; category: CategoryId; price: number; adMinutes: number }
export type ValueDay = {
  key: string; date: Date; watches: ValuedWatch[]; gross: number; adMinutes: number; adCost: number
  net: number; cumulative: number
}
export type ValueCycle = {
  key: string; start: Date; end: Date; daysInCycle: number; included: boolean; partial: boolean
  cost: number; gross: number; adCost: number; net: number; firstReached: string | null
  reached: boolean; days: ValueDay[]
}
export type ValueReport = {
  cycles: ValueCycle[]; costPerCycle: number; totalCost: number; gross: number; adCost: number; net: number
  /** gross 중 작품별 단가 없이 유형별 추정 단가로 계산한 금액 */
  typeRateGross: number
  estimatedCount: number; excludedCount: number; duplicateCount: number; outsideCount: number
}
const EPSILON = 1e-7
const enough = (value: number, cost: number) => value + EPSILON >= cost

export function computeValue(entries: Entry[], settings: ValueSettings, today = new Date()): ValueReport {
  const from = parseDate(settings.from)
  const to = parseDate(settings.to)
  if (from > to) throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
  if (to > parseDate(dateKey(today))) throw new Error('미래 날짜는 아직 계산할 수 없습니다.')
  if (dayNumber(to) - dayNumber(from) > 366 * 30) throw new Error('분석 기간은 한 번에 30년 이내로 선택해 주세요.')
  const nonnegative = [settings.monthlyPrice, settings.extraFee, settings.personalPrice, settings.adCount,
    settings.adSeconds, settings.hourlyValue, ...Object.values(settings.rates)]
  for (const show of Object.values(settings.shows)) {
    if (show.price !== undefined) nonnegative.push(show.price)
    if (show.adCount !== undefined) nonnegative.push(show.adCount)
  }
  if (nonnegative.some((n) => !Number.isFinite(n) || n < 0)) throw new Error('요금·단가·광고 설정에는 0 이상의 숫자를 입력해 주세요.')
  if (!Number.isInteger(settings.billingDay) || settings.billingDay < 1 || settings.billingDay > 31) throw new Error('결제일은 1일부터 31일까지 입력해 주세요.')
  if (!Number.isInteger(settings.otherPeople) || settings.otherPeople < 0 || settings.otherPeople > 99) throw new Error('공유 인원은 본인 제외 0명부터 99명까지 입력해 주세요.')
  if (!Number.isInteger(settings.adFreeEntries) || settings.adFreeEntries < 0) throw new Error('초반 무광고 건수는 0 이상의 정수로 입력해 주세요.')
  const costPerCycle = settings.costMode === 'personal' ? settings.personalPrice : (settings.monthlyPrice + settings.extraFee) / (settings.otherPeople + 1)
  const cycles: ValueCycle[] = []
  const byCycle = new Map<string, ValueCycle>()
  for (let start = cycleStart(from, settings.billingDay); start <= to; start = nextCycle(start, settings.billingDay)) {
    const next = nextCycle(start, settings.billingDay)
    const end = addDays(next, -1)
    const included = !settings.excludedCycles.includes(dateKey(start))
    const cycle: ValueCycle = {
      key: dateKey(start), start, end, daysInCycle: dayNumber(next) - dayNumber(start), included,
      partial: start < from || end > to, cost: included ? costPerCycle : 0,
      gross: 0, adCost: 0, net: 0, firstReached: null, reached: false, days: [],
    }
    cycles.push(cycle)
    byCycle.set(cycle.key, cycle)
  }
  const watchesByDay = new Map<string, ValuedWatch[]>()
  let estimatedCount = 0, excludedCount = 0, duplicateCount = 0, outsideCount = 0, eligibleCount = 0, typeRateGross = 0
  const seen = new Set<string>()
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime())
  for (const entry of sorted) {
    const key = dateKey(entry.date)
    const cycle = byCycle.get(dateKey(cycleStart(entry.date, settings.billingDay)))
    if (key < settings.from || key > settings.to || !cycle?.included) { outsideCount++; continue }
    const identity = JSON.stringify([key, entry.title])
    if (seen.has(identity)) { duplicateCount++; continue }
    seen.add(identity)
    const value = resolveShow(entry, settings)
    if (value.category === 'exclude' || value.unpriced) { excludedCount++; continue }
    if (value.estimated) estimatedCount++
    if (value.typeRate) typeRateGross += value.price
    const adMinutes = settings.adsEnabled && !settings.kidsProfile && eligibleCount >= settings.adFreeEntries
      ? value.adCount * settings.adSeconds / 60 : 0
    eligibleCount++
    const watches = watchesByDay.get(key) ?? []
    watches.push({ entry, category: value.category, price: value.price, adMinutes })
    watchesByDay.set(key, watches)
  }
  for (const cycle of cycles) {
    let cumulative = 0
    const start = cycle.start > from ? cycle.start : from
    const end = cycle.end < to ? cycle.end : to
    for (let date = start; date <= end; date = addDays(date, 1)) {
      const key = dateKey(date)
      const watches = cycle.included ? watchesByDay.get(key) ?? [] : []
      const gross = watches.reduce((sum, w) => sum + w.price, 0)
      const adMinutes = cycle.included && settings.adsEnabled && !settings.kidsProfile
        ? watches.reduce((sum, w) => sum + w.adMinutes, 0) : 0
      const adCost = adMinutes * settings.hourlyValue / 60
      const net = gross - adCost
      cumulative += net
      if (cycle.firstReached === null && cycle.included && cycle.cost > 0 && enough(cumulative, cycle.cost)) cycle.firstReached = key
      cycle.days.push({ key, date, watches, gross, adMinutes, adCost, net, cumulative })
      cycle.gross += gross
      cycle.adCost += adCost
    }
    cycle.net = cycle.gross - cycle.adCost
    cycle.reached = cycle.included && cycle.cost > 0 && enough(cycle.net, cycle.cost)
  }
  const sum = (key: 'cost' | 'gross' | 'adCost' | 'net') => cycles.reduce((total, cycle) => total + cycle[key], 0)
  return { cycles, costPerCycle, totalCost: sum('cost'), gross: sum('gross'), adCost: sum('adCost'), net: sum('net'),
    typeRateGross, estimatedCount, excludedCount, duplicateCount, outsideCount }
}

/* ── 화면용 파생값 ─────────────────────────────────────────────── */

/** 같은 작품의 모든 회차를 묶어 시청 건수가 많은 순으로 정렬한다 */
export function showsByWatchCount(entries: Entry[]): { entry: Entry; count: number }[] {
  const rows = new Map<string, { entry: Entry; count: number }>()
  for (const entry of entries) {
    const row = rows.get(entry.show)
    if (row) row.count++
    else rows.set(entry.show, { entry, count: 1 })
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.entry.show.localeCompare(b.entry.show, 'ko'))
}

/** 요금제를 바꾸면 월 결제액을 그 요금제 가격으로, 광고 없는 요금제면 광고 비용 반영을 끈다 */
export const applyPlan = (settings: ValueSettings, plan: PlanId): ValueSettings => ({
  ...settings,
  monthlyPrice: plan === 'custom' ? settings.monthlyPrice : planPrice(plan),
  adsEnabled: adsAllowed(plan) ? settings.adsEnabled : false,
})

/** 앞으로 한 편 더 볼 때 기본값으로 가정하는 광고 시간 비용 */
export const adCostPerWatch = (settings: ValueSettings, adCount = settings.adCount) =>
  settings.adsEnabled && !settings.kidsProfile ? adCount * settings.adSeconds / 3600 * settings.hourlyValue : 0

/** 한 달 요금을 한 유형의 단가로만 채우려면 몇 편이 필요한가 (단가 0원이면 null) */
export const watchesForPrice = (price: number, rate: number) => (rate > 0 ? Math.ceil(Math.max(0, price) / rate) : null)

/**
 * 선택한 결제 주기의 남은 부담액을 한 유형만 봐서 채우려면 몇 편이 더 필요한가.
 * 유형별 기본 단가와 기본 광고 가정을 쓰며, 한 편의 순가치가 0 이하이면 도달 불가(null)다.
 */
export function watchesToBreakEven(cycle: ValueCycle, settings: ValueSettings, category: CategoryId) {
  const remaining = Math.max(0, cycle.cost - cycle.net)
  const perWatch = settings.rates[category] - adCostPerWatch(settings)
  return { remaining, perWatch, count: neededWatches(remaining, perWatch) }
}

/** 남은 금액을 한 편당 순가치로 채우려면 몇 편이 필요한가 (순가치 0 이하면 null) */
const neededWatches = (remaining: number, perWatch: number) =>
  remaining <= EPSILON ? 0 : perWatch > 0 ? Math.ceil((remaining - EPSILON) / perWatch) : null

export type ShowContribution = {
  show: string; kind: Entry['kind']; count: number; net: number; last: number
  /** 앞으로 한 편 더 볼 때의 순가치 (작품 단가 − 기본 광고 가정) */
  perWatch: number
}
/** 결제 주기 안에서 작품별로 몇 편을 봐서 얼마를 채웠는지. 환산액이 큰 순 */
export function cycleShows(cycle: ValueCycle, settings: ValueSettings): ShowContribution[] {
  const rows = new Map<string, ShowContribution>()
  for (const day of cycle.days) {
    for (const w of day.watches) {
      let row = rows.get(w.entry.show)
      if (!row) {
        const value = resolveShow(w.entry, settings)
        row = { show: w.entry.show, kind: w.entry.kind, count: 0, net: 0, last: 0,
          perWatch: value.price - adCostPerWatch(settings, value.adCount) }
        rows.set(w.entry.show, row)
      }
      row.count++
      row.net += w.price - w.adMinutes * settings.hourlyValue / 60
      row.last = day.date.getTime()
    }
  }
  return [...rows.values()].sort((a, b) => b.net - a.net || b.count - a.count)
}

/**
 * 못 채운 금액을 그 달에 보던 시리즈를 이어 봐서 채운다면 몇 화가 더 필요한가.
 * 많이·최근에 본 시리즈 순이며, 남은 회차가 실제로 있는지는 알 수 없다.
 */
export function catchUpSeries(shows: ShowContribution[], remaining: number, limit = 3) {
  return shows
    .filter((s) => s.kind === 'series' && s.perWatch > 0)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map((s) => ({ ...s, needed: neededWatches(remaining, s.perWatch)! }))
}

export type CycleStatus = 'excluded' | 'free' | 'reached' | 'pending' | 'short'
export function cycleStatus(cycle: ValueCycle): CycleStatus {
  if (!cycle.included) return 'excluded'
  if (cycle.cost === 0) return 'free'
  if (cycle.reached) return 'reached'
  return cycle.partial ? 'pending' : 'short'
}

export type ValueSummary = {
  verdict: 'earned' | 'short' | 'free'
  /** 낸 돈 대비 환산액 비율. 낸 돈이 0원이면 null */
  ratio: number | null
  balance: number
  activeCycles: number
  chargedCycles: number
  reachedCycles: number
  /** 환산액 중 유형별 추정 단가로 계산한 비율. 환산액이 0원이면 null */
  typeRateShare: number | null
}
export function summarizeValue(report: ValueReport): ValueSummary {
  const active = report.cycles.filter((c) => c.included)
  const charged = active.filter((c) => c.cost > 0)
  return {
    verdict: report.totalCost === 0 ? 'free' : enough(report.net, report.totalCost) ? 'earned' : 'short',
    ratio: report.totalCost > 0 ? report.net / report.totalCost : null,
    balance: report.net - report.totalCost,
    activeCycles: active.length,
    chargedCycles: charged.length,
    reachedCycles: charged.filter((c) => c.reached).length,
    typeRateShare: report.gross > 0 ? report.typeRateGross / report.gross : null,
  }
}
