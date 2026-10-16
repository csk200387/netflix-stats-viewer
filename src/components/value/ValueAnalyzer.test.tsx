import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { classifyAll } from '../../lib/stats'
import { computeValue, initialValueSettings } from '../../lib/value'
import CycleVerdict from './CycleVerdict'
import ValueAnalyzer from './ValueAnalyzer'

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
})
