import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { classifyAll } from '../../lib/stats'
import ValueAnalyzer from './ValueAnalyzer'

describe('ValueAnalyzer', () => {
  const entries = classifyAll([
    { title: '작품: 시즌 1: 1화', date: new Date(2026, 0, 1), rawDate: '2026-01-01' },
    { title: '영화', date: new Date(2026, 0, 4), rawDate: '2026-01-04' },
  ])
  const html = renderToStaticMarkup(<ValueAnalyzer entries={entries} />)

  it('요금·공유·콘텐츠 설정을 표시한다', () => {
    expect(html).toContain('당신은 넷플릭스로')
    expect(html).toContain('본전을 뽑으셨나요?')
    expect(html).toContain('함께 분담하는 가족·친구 (본인 제외)')
    expect(html).toContain('회차형 · 유형 미지정')
    expect(html).toContain('CSV에는 실제 광고 정보가 없습니다')
    expect(html).toContain('환산액의 100.0%는 유형별 추정 단가')
    expect(html).toContain('가격 미확인 작품의 추정 대여료')
  })

  it('결제 주기를 달 단위로 모아 본전 여부를 보여주고 유형을 자동 확정하지 않는다', () => {
    expect(html).toContain('본전 뽑은 달, 못 뽑은 달')
    expect(html).toContain('못 뽑은 달 1')
    expect(html.match(/class="cycle-card /g)).toHaveLength(1)
    expect(html).toContain('2026년 1월')
    expect(html).toContain('기본 추정')
    expect(html).toContain('현재 요금을 선택 기간 전체에 동일하게 적용')
  })
})
