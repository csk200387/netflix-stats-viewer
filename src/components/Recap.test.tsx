import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ViewRecord } from '../lib/parse'
import { classifyAll } from '../lib/stats'
import RecapModal from './Recap'

const rec = (title: string, iso: string): ViewRecord => ({ title, date: new Date(`${iso}T00:00:00`), rawDate: iso })
const render = (pairs: [string, string][]) =>
  renderToStaticMarkup(<RecapModal entries={classifyAll(pairs.map(([t, d]) => rec(t, d)))} onClose={() => {}} />)

/** 2025년 3건 + 2026년 5건, 연말·연초에 걸친 5일 연속 시청 */
const html = render([
  ['가작', '2025-06-01'],
  ['가작', '2025-12-30'],
  ['가작', '2025-12-31'],
  ['가작', '2026-01-01'],
  ['가작', '2026-01-02'],
  ['나작', '2026-03-01'],
  ['나작', '2026-03-02'],
  ['다작', '2026-05-05'],
])

describe('RecapModal 구조', () => {
  it('카드를 정확히 5장 그린다', () => {
    expect(html.match(/<article/g)).toHaveLength(5)
    for (const id of ['opening', 'favorites', 'habits', 'streak', 'summary']) {
      expect(html).toContain(`data-card="${id}"`)
    }
  })

  it('첫 카드만 활성이고 나머지는 스크린리더·포커스에서 빠진다', () => {
    expect(html).toContain('aria-label="1. 한 해 요약" aria-hidden="false"')
    expect(html.match(/aria-hidden="true" inert=""/g)).toHaveLength(4)
    expect(html).toContain('1 / 5')
  })

  it('다이얼로그 시맨틱과 이동 수단을 갖춘다', () => {
    expect(html).toContain('<dialog')
    expect(html).toContain('aria-label="2026년 한 해 돌아보기"')
    expect(html).toContain('이전 카드')
    expect(html).toContain('다음 카드')
    expect(html).toContain('한 해 돌아보기 닫기')
    expect(html.match(/class="recap-seg"/g)).toHaveLength(5)
  })
})

describe('RecapModal 연도', () => {
  it('전체 기록의 연도를 최신순으로 고를 수 있고 최신 연도가 기본값이다', () => {
    expect(html).toContain('<select id="recap-year"')
    expect(html.indexOf('2026년')).toBeLessThan(html.indexOf('2025년'))
    expect(html).toContain('<option value="2026" selected="">2026년</option>')
  })

  it('선택한 해의 기록만 세고, 필터와 무관함을 알린다', () => {
    // 전체 8건 중 2026년은 5건
    expect(html).toContain('>5</strong>건을 봤어요')
    expect(html).toContain('불러온 전체 기록 중 2026년만 계산한 결과입니다')
  })

  it('최장 연속 시청을 연도 경계에서 끊는다', () => {
    // 2025-12-30 ~ 2026-01-02 은 4일이지만 2026년 안에서는 2일
    expect(html).toContain('2<small>일 연속</small>')
    expect(render([['가작', '2025-12-31'], ['가작', '2026-01-01']])).toContain('1<small>일 연속</small>')
  })
})

describe('RecapModal 순위', () => {
  it('편수가 같으면 작품명 가나다순으로 매긴다', () => {
    const tie = render([
      ['나작', '2026-01-01'],
      ['나작', '2026-01-02'],
      ['가작', '2026-01-03'],
      ['가작', '2026-01-04'],
    ])
    const screen = tie.slice(0, tie.indexOf('class="recap-export"'))
    const ranks = [...screen.matchAll(/recap-rank-name">([^<]+)</g)].map((m) => m[1])
    expect(ranks).toEqual(['가작', '나작'])
  })

  it('작품이 셋보다 적어도 있는 만큼만 낸다', () => {
    const sparse = render([['가작', '2026-07-04']])
    const screen = sparse.slice(0, sparse.indexOf('class="recap-export"'))
    expect(screen.match(/recap-rank-name/g)).toHaveLength(1)
    expect(sparse).toContain('1<small>일 연속</small>')
  })
})

describe('RecapModal 공유 카드', () => {
  it('다섯 장 모두 내려받기용 사본을 화면 밖에 360×640 으로 따로 그린다', () => {
    expect(html).toContain('class="recap-export"')
    expect(html.match(/style="width:360px;height:640px"/g)).toHaveLength(5)
    // 사본에는 모달 조작 버튼이 들어가지 않는다
    const copy = html.slice(html.indexOf('class="recap-export"'))
    expect(copy).not.toContain('<button')
    expect(copy.match(/data-export=/g)).toHaveLength(5)
    for (const id of ['01-overview', '02-top-shows', '03-habits', '04-streak', '05-summary']) expect(copy).toContain(`data-export="${id}"`)
  })

  it('저장 버튼과 공유 주의 문구를 함께 둔다', () => {
    expect(html).toContain('이 장 저장')
    expect(html).toContain('모든 장 저장')
    expect(html).toContain('PNG 5개를 각각 내려받습니다')
  })

  it('35일 스트릭 격자와 새 문구를 표시하고 이전 문구는 제거한다', () => {
    const screen = html.slice(0, html.indexOf('class="recap-export"'))
    expect(screen.match(/recap-streak-cell"/g)).toHaveLength(35)
    expect(html).toContain('한 해 돌아보기')
    expect(html).not.toContain('연말 결산')
    expect(html).not.toContain('브라우저에서만 계산했어요')
  })

  it('외부 이미지·폰트를 전혀 쓰지 않는다', () => {
    expect(html).not.toMatch(/<img|<image|srcset|url\(|https?:\/\//)
  })
})
