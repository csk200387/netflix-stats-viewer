import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ViewRecord } from '../lib/parse'
import { calendarYears, classifyAll, computeStats } from '../lib/stats'
import { StreakCalendar } from './Charts'

const rec = (title: string, iso: string): ViewRecord => ({ title, date: new Date(`${iso}T00:00:00`), rawDate: iso })

/** 2025-12-30 ~ 2026-06-14, 1월 1일에 3편 몰아보기 */
const html = (() => {
  const isos = ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-01', '2026-01-01', '2026-01-05', '2026-06-14']
  const stats = computeStats(classifyAll(isos.map((iso, i) => rec(`작품 ${i}`, iso))))!
  return renderToStaticMarkup(<StreakCalendar years={calendarYears(stats.byDay)} busiestDay={stats.busiestDay} />)
})()

describe('StreakCalendar', () => {
  it('해마다 365칸을 그리고, 해 밖의 자리만 빈 칸으로 둔다', () => {
    // 격자 730칸(2년) + 범례 5칸
    expect(html.match(/class="cal-cell"/g)).toHaveLength(365 * 2 + 5)
    // 2025년 앞뒤 3칸씩, 2026년 앞 4칸·뒤 2칸
    expect(html.match(/cal-cell cal-pad/g)).toHaveLength(12)
  })

  it('칸마다 작품명 없이 날짜·편수만 툴팁으로 붙인다', () => {
    expect(html).toContain('title="2026. 1. 1. · 3편"')
    expect(html).toContain('title="2026. 1. 2. · 시청 없음"')
    expect(html).not.toContain('3편 — 작품')
  })

  it('편수에 따라 색 단계를 매긴다', () => {
    expect(html).toContain('data-level="3" title="2026. 1. 1.')
    expect(html).toContain('data-level="1" title="2026. 1. 5.')
  })

  it('월·요일 축과 범례를 함께 낸다', () => {
    expect(html.match(/>12월</g)).toHaveLength(2)
    expect(html).toContain('<span>월</span>')
    expect(html).toContain('색 단계: 시청 없음, 1편, 2편, 3~4편, 5편 이상')
  })

  it('머리말에 하루 최다 시청 편수를 보여 준다', () => {
    expect(html).toContain('하루 최다 3편 (2026. 1. 1.)')
  })
})
