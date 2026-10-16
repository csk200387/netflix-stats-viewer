import { useMemo, useState } from 'react'
import type { Entry } from '../../lib/stats'
import { num, won } from '../../lib/format'
import {
  CATEGORIES, PRICED_CATEGORIES, resolveShow, showOverride, showsByWatchCount,
  type CategoryId, type ShowValue, type ValueSettings,
} from '../../lib/value'
import NumberField from '../ui/NumberField'

const PAGE = 10

/** 유형별 기본값을 고른 공개 대여·바로보기 사례 (docs/ott-content-unit-prices.md, 2026-10-15 확인) */
const RATE_SOURCES: Partial<Record<CategoryId, { label: string; url: string }>> = {
  drama: { label: 'JTBC 「모범형사2」 2회', url: 'https://tv.jtbc.co.kr/replay/pr10011490/pm10065325/ep20172131/view' },
  variety: { label: 'JTBC 「싱어게인4」 2회', url: 'https://tv.jtbc.co.kr/replay/pr10011781/pm10071046/ep20273907/view' },
  foreign: { label: '씨네폭스 「고독한 미식가 시즌9」', url: 'https://cinefox.com/vod/view?product_seq=134702' },
  anime: { label: '씨네폭스 「샹피뇽의 마녀」', url: 'https://cinefox.com/vod/view?product_seq=133269' },
  kids: { label: '씨네폭스 「캐치의 호기심 스쿨」', url: 'https://cinefox.com/vod/view?product_seq=130784' },
  docSeries: { label: 'JTBC 「다큐 플러스」 259회', url: 'https://mtv.jtbc.co.kr/replay/pr10010750/pm10047655/ep20200919/view' },
  docShort: { label: '퍼플레이 「명: 우린 같지만 달라」', url: 'https://www.purplay.co.kr/streaming/movie/217/intro?from=streaming' },
  docFilm: { label: '퍼플레이 「비건들의 수다」', url: 'https://www.purplay.co.kr/streaming/movie/1438/intro' },
  movie: { label: '씨네폭스 「마크맨」', url: 'https://cinefox.com/vod/view?product_seq=116844' },
  animeFilm: { label: '씨네폭스 「썸머 워즈」', url: 'https://cinefox.com/vod/view?product_seq=11642' },
}

type Props = {
  entries: Entry[]
  settings: ValueSettings
  onRate: (category: CategoryId, price: number) => void
  onShow: (name: string, patch: Partial<ShowValue>, fallback: CategoryId) => void
  onResetShow: (name: string) => void
}

export default function ContentRates({ entries, settings, onRate, onShow, onResetShow }: Props) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const rows = useMemo(() => showsByWatchCount(entries), [entries])
  const q = query.trim().toLowerCase()
  const visible = q ? rows.filter((r) => r.entry.show.toLowerCase().includes(q)) : rows
  const customized = rows.filter((r) => showOverride(settings, r.entry.show)).length

  return (
    <div className="card value-block" id="value-content">
      <header className="value-block-head">
        <span className="value-step">STEP 2</span>
        <h3>콘텐츠마다 다른 단가</h3>
        <p>드라마 한 회와 애니 한 화의 가치는 다르니까</p>
      </header>
      <p className="value-help">
        장르는 CSV만으로 알 수 없습니다. 시리즈는 ‘유형 미지정’ {won(settings.rates.series)}, 영화는 {won(settings.rates.movie)}으로
        우선 추정합니다. 많이 본 작품부터 유형을 확인해 주세요. 독점작·기타는 단가를 직접 입력하거나 ‘미확인 · 계산 제외’를 고르세요.
      </p>

      <details className="value-details">
        <summary>
          가격 미확인 작품의 추정 대여료 · 근거
          <span>{PRICED_CATEGORIES.length}개 유형</span>
        </summary>
        <div className="value-rate-grid">
          {PRICED_CATEGORIES.map((c) => {
            const source = RATE_SOURCES[c.id]
            return (
              <div key={c.id} className="value-rate">
                <NumberField id={`value-rate-${c.id}`} label={c.label} suffix="원/편" value={settings.rates[c.id]} onChange={(v) => onRate(c.id, v)} />
                {source ? (
                  <a href={source.url} target="_blank" rel="noreferrer">{source.label} {won(c.price)} ↗</a>
                ) : (
                  <small>장르를 모르는 시리즈 · 국내 드라마 사례 적용</small>
                )}
              </div>
            )
          })}
        </div>
        <p className="value-help">
          실제 대여료를 확인하지 못한 작품에 적용하는 계산용 가정값입니다. 시장 평균·최저가·실제 지출액을 의미하지 않습니다. 유형마다
          2026-10-15에 확인한 다른 서비스의 공개 대여·바로보기 사례 중 낮은 값을 골랐고, 사례가 1~2개뿐이라 유형 사이의 높낮이에는 큰
          의미가 없습니다. 같은 작품의 실제 대여료를 알면 아래 작품별 단가에 입력하고, 공식 무료로 볼 수 있다면 0원으로 바꾸세요.
        </p>
      </details>

      <div className="value-library-tools">
        <div className="field">
          <label htmlFor="value-show-query">단가를 바꿀 작품 검색</label>
          <input
            id="value-show-query"
            type="search"
            placeholder="작품명 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
          />
        </div>
        <span>
          {num(rows.length)}개 작품 · 직접 지정 {num(customized)}개 · 같은 작품의 모든 회차에 적용
        </span>
      </div>

      <div className="table-wrap">
        <table className="value-show-table">
          <thead>
            <tr>
              <th scope="col">작품</th>
              <th scope="col">콘텐츠 유형</th>
              <th scope="col">한 화·편 단가</th>
              {settings.adsEnabled && <th scope="col">한 편당 광고 수</th>}
              <th scope="col"><span className="visually-hidden">설정</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map(({ entry, count }, i) => {
              const value = resolveShow(entry, settings)
              const override = showOverride(settings, entry.show)
              return (
                <tr key={entry.show}>
                  <td className="title">
                    {entry.show}
                    <small className="value-row-note">{num(count)}건 · {value.estimated ? '기본 추정' : '사용자 지정'}</small>
                  </td>
                  <td>
                    <label className="visually-hidden" htmlFor={`value-category-${i}`}>{entry.show} 콘텐츠 유형</label>
                    <select
                      id={`value-category-${i}`}
                      value={value.category}
                      onChange={(e) => onShow(entry.show, { category: e.target.value as CategoryId, price: undefined }, value.category)}
                    >
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="visually-hidden" htmlFor={`value-unit-${i}`}>{entry.show} 단가</label>
                    <input
                      id={`value-unit-${i}`}
                      type="number"
                      min={0}
                      step={1}
                      placeholder={value.unpriced ? '단가 입력' : undefined}
                      disabled={value.category === 'exclude'}
                      value={value.unpriced ? '' : value.price}
                      onChange={(e) => onShow(entry.show, { price: e.target.value === '' ? undefined : Number(e.target.value) }, value.category)}
                    />
                    <small className="value-row-note">
                      {value.unpriced ? '단가 입력 전까지 제외' : override?.price !== undefined ? '직접 단가' : '유형별 기본값'}
                    </small>
                  </td>
                  {settings.adsEnabled && (
                    <td>
                      <label className="visually-hidden" htmlFor={`value-show-ads-${i}`}>{entry.show} 광고 수</label>
                      <input
                        id={`value-show-ads-${i}`}
                        type="number"
                        min={0}
                        step={1}
                        value={value.adCount}
                        disabled={settings.kidsProfile || value.category === 'exclude'}
                        onChange={(e) => onShow(entry.show, { adCount: Number(e.target.value) }, value.category)}
                      />
                    </td>
                  )}
                  <td>
                    <button type="button" className="btn" disabled={!override} aria-label={`${entry.show} 단가 설정 초기화`} onClick={() => onResetShow(entry.show)}>
                      초기화
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <p className="value-help">검색에 맞는 작품이 없습니다.</p>}
      {visible.length > limit && (
        <div className="more">
          <button type="button" className="btn" onClick={() => setLimit((n) => n + PAGE * 2)}>
            작품 더 보기 ({num(visible.length - limit)}개 남음)
          </button>
        </div>
      )}
    </div>
  )
}
