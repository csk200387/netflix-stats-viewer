import { Fragment, useMemo, useState } from 'react'
import { fmtDate, type Entry, type ShowSummary } from '../lib/stats'

type Dir = 'asc' | 'desc'

function SortHeader<K extends string>({
  col, label, sort, setSort, align, defaultDir = 'desc',
}: {
  col: K
  label: string
  sort: { col: K; dir: Dir }
  setSort: (s: { col: K; dir: Dir }) => void
  align?: 'right'
  defaultDir?: Dir
}) {
  const active = sort.col === col
  return (
    <th
      style={align === 'right' ? { textAlign: 'right' } : undefined}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        onClick={() => setSort({ col, dir: active ? (sort.dir === 'asc' ? 'desc' : 'asc') : defaultDir })}
      >
        {label}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

const KindTag = ({ kind }: { kind: 'series' | 'movie' }) => (
  <span className={`tag tag-${kind}`}>{kind === 'series' ? '시리즈' : '영화'}</span>
)

/** 같은 화를 다시 본 횟수. 총 시청 횟수에서 본 화 종류 수를 뺀 값. */
const rewatchesOf = (s: ShowSummary) => s.count - s.episodeCount

/** 작품별 집계 — 총 시청 횟수와 그중 재시청이 몇 번인지를 나눠 보여준다. */
export function ShowTable({ shows }: { shows: ShowSummary[] }) {
  const [sort, setSort] = useState<{ col: 'count' | 'show' | 'last' | 'days' | 'rewatch'; dir: Dir }>({ col: 'count', dir: 'desc' })
  const [limit, setLimit] = useState(20)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const sorted = useMemo(() => {
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...shows].sort((a, b) => {
      switch (sort.col) {
        case 'show': return sign * a.show.localeCompare(b.show, 'ko')
        case 'last': return sign * (a.last.getTime() - b.last.getTime())
        case 'days': return sign * (a.days - b.days)
        case 'rewatch': return sign * (rewatchesOf(a) - rewatchesOf(b)) || b.count - a.count
        default: return sign * (a.count - b.count) || a.show.localeCompare(b.show, 'ko')
      }
    })
  }, [shows, sort])

  const totalRewatches = useMemo(() => shows.reduce((n, s) => n + rewatchesOf(s), 0), [shows])

  const toggle = (show: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(show)) next.delete(show)
      else next.add(show)
      return next
    })

  return (
    <div className="card">
      <div className="section-head">
        <h2>작품별 시청 집계</h2>
        <span>
          {shows.length.toLocaleString('ko-KR')}개 작품 ·{' '}
          {totalRewatches > 0 ? `재시청 ${totalRewatches.toLocaleString('ko-KR')}회` : '재시청 기록 없음'}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">순위</span></th>
              <SortHeader col="show" label="작품" sort={sort} setSort={setSort} defaultDir="asc" />
              <th scope="col">종류</th>
              <SortHeader col="count" label="총 시청 횟수" sort={sort} setSort={setSort} align="right" />
              <SortHeader col="rewatch" label="재시청" sort={sort} setSort={setSort} align="right" />
              <SortHeader col="days" label="시청일" sort={sort} setSort={setSort} align="right" />
              <SortHeader col="last" label="마지막 시청" sort={sort} setSort={setSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((s, i) => {
              const rewatches = rewatchesOf(s)
              const canExpand = s.episodes.length > 1 || rewatches > 0
              const isOpen = expanded.has(s.show)
              return (
                <Fragment key={s.show}>
                  <tr>
                    <td className="rank">{i + 1}</td>
                    <td className="title">
                      {canExpand && (
                        <button
                          type="button"
                          className="row-toggle"
                          aria-expanded={isOpen}
                          aria-label={`${s.show} 화별 시청 횟수 ${isOpen ? '접기' : '펼치기'}`}
                          onClick={() => toggle(s.show)}
                        >
                          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                        </button>
                      )}
                      {s.show}
                      {s.kind === 'series' && <span className="ep"> · {s.episodeCount.toLocaleString('ko-KR')}화</span>}
                      {s.seasons > 1 && <span className="ep"> · 시즌 {s.seasons}개</span>}
                    </td>
                    <td><KindTag kind={s.kind} /></td>
                    <td className="num">{s.count.toLocaleString('ko-KR')}회</td>
                    <td className={rewatches > 0 ? 'num' : 'num ep'}>
                      {rewatches > 0 ? `${rewatches.toLocaleString('ko-KR')}회` : '—'}
                    </td>
                    <td className="num">{s.days}일</td>
                    <td className="num">{fmtDate(s.last)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="row-detail">
                      <td></td>
                      <td colSpan={6}>
                        <ul className="ep-breakdown">
                          {s.episodes.map((e) => (
                            <li key={e.label} className={e.count > 1 ? 'ep-repeat' : undefined}>
                              <span>{e.label}</span>
                              <span>{e.count}회</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {limit < sorted.length && (
        <div className="more">
          <button type="button" className="btn" onClick={() => setLimit((n) => n + 40)}>
            더 보기 ({(sorted.length - limit).toLocaleString('ko-KR')}개 남음)
          </button>
        </div>
      )}
    </div>
  )
}

/** 전체 시청 기록 상세. 기본은 최신순. */
export function HistoryTable({ entries }: { entries: Entry[] }) {
  const [sort, setSort] = useState<{ col: 'date' | 'title' | 'show'; dir: Dir }>({ col: 'date', dir: 'desc' })
  const [limit, setLimit] = useState(50)

  const sorted = useMemo(() => {
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...entries].sort((a, b) => {
      switch (sort.col) {
        case 'title': return sign * a.title.localeCompare(b.title, 'ko')
        case 'show': return sign * a.show.localeCompare(b.show, 'ko') || b.date.getTime() - a.date.getTime()
        default: return sign * (a.date.getTime() - b.date.getTime())
      }
    })
  }, [entries, sort])

  return (
    <div className="card">
      <div className="section-head">
        <h2>상세 시청 기록</h2>
        <span>{entries.length.toLocaleString('ko-KR')}건</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader col="date" label="시청일" sort={sort} setSort={setSort} />
              <SortHeader col="show" label="작품" sort={sort} setSort={setSort} defaultDir="asc" />
              <SortHeader col="title" label="에피소드 / 원본 제목" sort={sort} setSort={setSort} defaultDir="asc" />
              <th scope="col">종류</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((e, i) => (
              <tr key={`${e.title}|${e.rawDate}|${i}`}>
                <td className="num" style={{ textAlign: 'left' }}>{fmtDate(e.date)}</td>
                <td className="title">{e.show}</td>
                <td className="title ep">
                  {[e.season, e.episode].filter(Boolean).join(' · ') || '—'}
                </td>
                <td><KindTag kind={e.kind} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit < sorted.length && (
        <div className="more">
          <button type="button" className="btn" onClick={() => setLimit((n) => n + 200)}>
            더 보기 ({(sorted.length - limit).toLocaleString('ko-KR')}건 남음)
          </button>
        </div>
      )}
    </div>
  )
}
