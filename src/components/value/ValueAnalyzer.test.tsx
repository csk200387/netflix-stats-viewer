import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { classifyAll } from '../../lib/stats'
import { computeValue, initialValueSettings, summarizeValue, valueBasis, type ValueSettings } from '../../lib/value'
import CycleVerdict from './CycleVerdict'
import ValueAnalyzer from './ValueAnalyzer'
import ValueBasis, { rateFlipText } from './ValueBasis'

const today = new Date(2026, 9, 15)
const entries = classifyAll([
  { title: '작품: 시즌 1: 1화', date: new Date(2026, 0, 1), rawDate: '2026-01-01' },
  { title: '작품: 시즌 1: 2화', date: new Date(2026, 0, 2), rawDate: '2026-01-02' },
  { title: '영화', date: new Date(2026, 0, 4), rawDate: '2026-01-04' },
])

describe('ValueAnalyzer', () => {
  it('요금제와 분담 인원을 먼저 묻고 고르기 전에는 결과를 계산해 보여주지 않는다', () => {
    const html = renderToStaticMarkup(<ValueAnalyzer entries={entries} />)
    expect(html).toContain('본전을 뽑으셨나요?')
    expect(html).toContain('① 어떤 요금제를 쓰세요?')
    expect(html).toContain('② 몇 명이 나눠 내세요? (본인 제외)')
    expect(html).toContain('골라 주세요')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1) // 분담 0명만 선택됨
    expect(html).not.toContain('본전 뽑은 달, 못 뽑은 달')
    expect(html).not.toContain('결과가 내 상황과 다르다면')
  })
})

describe('CycleVerdict', () => {
  const render = (monthlyPrice: number) => {
    const settings = { ...initialValueSettings(entries, today), monthlyPrice, to: '2026-01-31' }
    const report = computeValue(entries, settings, today)
    return renderToStaticMarkup(
      <CycleVerdict report={report} cycle={report.cycles[0]} settings={settings} onSelectCycle={() => {}} onToggleCycle={() => {}} />,
    )
  }

  it('뽑은 달은 어떤 작품을 몇 편 봐서 채웠는지 보여준다', () => {
    const html = render(3000)
    expect(html).toContain('이 작품들로 뽑았어요')
    expect(html).toContain('2화')
    expect(html).toContain('「작품」 보다가 넘었어요')
  })

  it('못 뽑은 달은 그 달에 보던 시리즈를 몇 화 더 봤어야 했는지 알려준다', () => {
    const html = render(7000) // 1,650×2 + 1,500 = 4,800 → 2,200 부족 → 회차형 2화
    expect(html).toContain('2,200원 더 필요해요')
    expect(html).toContain('이만큼 더 봤다면 뽑았어요')
    expect(html).toContain('「작품」')
    expect(html).toContain('2화 더')
  })

  it('본전을 넘은 날 여러 작품을 봤으면 시각을 모르므로 어느 작품에서 넘었는지 말하지 않는다', () => {
    const sameDay = classifyAll([
      { title: '작품: 시즌 1: 1화', date: new Date(2026, 0, 1), rawDate: '' },
      { title: '영화', date: new Date(2026, 0, 1), rawDate: '' },
    ])
    const settings = { ...initialValueSettings(sameDay, today), monthlyPrice: 3000, to: '2026-01-31' }
    const report = computeValue(sameDay, settings, today) // 1,650 + 1,500 = 3,150 ≥ 3,000 (1월 1일)
    const html = renderToStaticMarkup(
      <CycleVerdict report={report} cycle={report.cycles[0]} settings={settings} onSelectCycle={() => {}} onToggleCycle={() => {}} />,
    )
    expect(html).toContain('2026. 1. 1.에 본전 달성')
    expect(html).not.toContain('보다가 넘었어요')
    expect(html).toContain('이 주기 환산액 중 3,150원(100%)은 장르를 확인하지 못해 기본 단가로 셌어요')
  })
})

describe('ValueBasis', () => {
  // 1월: TMDB 드라마 2화 + 장르 미확인 시리즈 2화 + 직접 단가 영화 1편 = 8,600원. 2월: 기록 없음. 부담 7,000원 × 2
  const basisEntries = classifyAll([
    ['드라마: 시즌 1: 1화', 3], ['드라마: 시즌 1: 2화', 4], ['모르는 쇼: 시즌 1: 1화', 10], ['모르는 쇼: 시즌 1: 2화', 11], ['영화', 20],
  ].map(([title, day]) => ({ title: String(title), date: new Date(2026, 0, Number(day)), rawDate: '' })))
  const settings: ValueSettings = {
    ...initialValueSettings(basisEntries, today), from: '2026-01-01', to: '2026-02-28',
    guesses: { 드라마: 'drama' }, shows: { 영화: { category: 'movie', price: 2000 } },
  }
  const html = (patch: Partial<ValueSettings> = {}, lookupPending = false) => {
    const s = { ...settings, ...patch }
    const report = computeValue(basisEntries, s, today)
    return renderToStaticMarkup(
      <ValueBasis report={report} summary={summarizeValue(report)} basis={valueBasis(report)} settings={s}
        lookupPending={lookupPending} onExcludeCycles={() => {}} onIncludeAll={() => {}} />,
    )
  }

  it('기록·설정·가정·추정을 구분해 계산 근거를 보여 준다', () => {
    const out = html()
    for (const tag of ['>기록<', '>설정<', '>가정<', '>추정<']) expect(out).toContain(tag)
    expect(out).toContain('불러온 5건 전부')
    expect(out).toContain('8,600원')
    expect(out).toContain('월 7,000원 × 2개 결제 주기')
    expect(out).toContain('환산액은 내 부담의 61%예요. 실제로 아낀 돈이 아니라')
  })

  it('단가·장르·구독한 달 가정이 바뀌면 답이 어떻게 되는지 손으로 계산한 값으로 알려 준다', () => {
    const out = html()
    expect(out).toContain('유형별 단가가 모두 82% 높아지면 ‘뽑았어요’로 바뀌어요') // 12,000 / 6,600 = 1.818…
    expect(out).toContain('환산액의 38%(2건 · 3,300원)는 장르를 확인하지 못해') // 3,300 / 8,600 = 38.4%
    expect(out).toContain('회차형 기본값은 회차형 유형 단가 중 가장 높아서')
    expect(out).toContain('장르를 확인한 기록만 세면 내 부담 대비 37%로, 결론은 같아요') // 5,300 / 14,000
    expect(out).toContain('본전을 채운 결제 주기는 1개에서 0개로 줄어요')
    expect(out).toContain('시청 기록이 한 건도 없는 1개 주기(7,000원)도 구독한 것으로 셌어요')
    expect(out).toContain('내 부담 대비 122%로, 결론이 ‘뽑았어요’로 바뀌어요') // 8,600 / 7,000
    expect(out).toContain('이 1개 주기 빼고 보기')
  })

  it('조회 중에는 장르 결과를 단정하지 않고, 구독 제외한 주기는 되돌릴 수 있게 한다', () => {
    expect(html({}, true)).toContain('TMDB에서 장르를 확인하는 중이에요')
    const out = html({ excludedCycles: ['2026-02-01'] })
    expect(out).toContain('구독하지 않았다고 표시한 1개 주기는')
    expect(out).toContain('모두 다시 포함')
    expect(out).not.toContain('시청 기록이 한 건도 없는')
  })

  it('잘라낸 숫자로도 문장이 참이 되게 쓴다', () => {
    expect(rateFlipText(0.4044, true)).toContain('59% 낮아져도 결론은 같고')
    expect(rateFlipText(0.77, true)).toContain('23% 낮아져도') // 1 − 0.77 = 0.22999…
    expect(rateFlipText(0.996, true)).toBe('유형별 단가가 1%만 낮아져도 ‘손해’로 바뀌어요.')
    expect(rateFlipText(-0.5, true)).toBe('유형별 단가가 0원이어도 결론은 같아요.')
    expect(rateFlipText(1.0001, false)).toContain('1% 높아지면')
    expect(rateFlipText(2.34, false)).toContain('지금의 2.4배는 돼야')
  })
})
