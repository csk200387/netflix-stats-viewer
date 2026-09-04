import { useCallback, useMemo, useState } from 'react'
import FileDrop from './components/FileDrop'
import { MonthlyChart, StreakCalendar, TimelineChart, WeekdayChart } from './components/Charts'
import RecapModal from './components/Recap'
import { HistoryTable, ShowTable } from './components/Tables'
import { CsvError, parseViewingHistory, type ParseResult } from './lib/parse'
import { recapYears } from './lib/recap'
import { calendarYears, classifyAll, computeStats, fmtDate, fmtDateInput } from './lib/stats'

type Loaded = { fileName: string; result: ParseResult }
type KindFilter = 'all' | 'series' | 'movie'

const SAMPLE_URL = `${import.meta.env.BASE_URL}sample-viewing-history.csv`
const num = (n: number) => n.toLocaleString('ko-KR')

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [recapOpen, setRecapOpen] = useState(false)

  const load = useCallback(async (fileName: string, read: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    try {
      const result = parseViewingHistory(await read())
      setLoaded({ fileName, result })
      setRecapOpen(false)
      setQuery('')
      setFrom('')
      setTo('')
      setKind('all')
    } catch (e) {
      setLoaded(null)
      setError(
        e instanceof CsvError
          ? e.message
          : `파일을 읽지 못했습니다. ${e instanceof Error ? e.message : '알 수 없는 오류'}`,
      )
    } finally {
      setBusy(false)
    }
  }, [])

  const onFile = useCallback((file: File) => load(file.name, () => file.text()), [load])

  const onSample = useCallback(
    () =>
      load('샘플 데이터 (가상)', async () => {
        const res = await fetch(SAMPLE_URL)
        if (!res.ok) throw new Error(`샘플 파일을 찾을 수 없습니다 (${res.status})`)
        return res.text()
      }),
    [load],
  )

  const entries = useMemo(() => (loaded ? classifyAll(loaded.result.records) : []), [loaded])

  const bounds = useMemo(() => {
    if (entries.length === 0) return null
    const times = entries.map((e) => e.date.getTime())
    return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) }
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Infinity
    return entries.filter((e) => {
      if (kind !== 'all' && e.kind !== kind) return false
      const t = e.date.getTime()
      if (t < fromTime || t > toTime) return false
      return q === '' || e.title.toLowerCase().includes(q) || e.show.toLowerCase().includes(q)
    })
  }, [entries, query, from, to, kind])

  const stats = useMemo(() => computeStats(filtered), [filtered])
  const years = useMemo(() => (stats ? calendarYears(stats.byDay) : []), [stats])
  // 한 해 돌아보기는 필터를 타지 않는다 — 불러온 전체 기록의 연도만 본다
  const latestRecapYear = useMemo(() => recapYears(entries)[0], [entries])
  const filterOn = query.trim() !== '' || from !== '' || to !== '' || kind !== 'all'

  const reset = () => {
    setQuery('')
    setFrom('')
    setTo('')
    setKind('all')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span className="brand-name">WATCHED</span>
        </div>
        <p className="header-privacy"><span aria-hidden="true" />100% PRIVATE · IN YOUR BROWSER</p>
        {loaded && (
          <div className="header-actions">
            <button type="button" className="btn" onClick={reset} disabled={!filterOn}>
              필터 초기화
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setLoaded(null)
                setError(null)
                reset()
              }}
            >
              다른 파일 불러오기
            </button>
          </div>
        )}
      </header>

      <section className={`hero${loaded ? ' hero-loaded' : ''}`} aria-labelledby="page-title">
        <div className="hero-kicker">
          <span>PERSONAL STREAMING ARCHIVE</span>
          <span>{loaded ? loaded.fileName : 'NETFLIX VIEWING HISTORY'}</span>
        </div>
        <h1 id="page-title">
          {loaded ? '당신의 시청 기록,' : '보는 취향을'}
          <br />
          <em>{loaded ? '한눈에.' : '데이터로.'}</em>
        </h1>
        <div className="hero-foot">
          <p>
            {loaded
              ? '검색부터 스트릭, 한 해 돌아보기까지. 기록 속에 쌓인 취향을 다시 발견하세요.'
              : '넷플릭스 시청 기록을 올리면 작품, 날짜, 시청 습관을 한 편의 리포트처럼 보여드립니다.'}
          </p>
          {loaded && (
            <div className="hero-pills" aria-label="불러온 기록 요약">
              <span>{num(entries.length)} WATCHES</span>
              <span>{recapYears(entries).length} YEARS</span>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <div>
            <h3>파일을 분석할 수 없습니다</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loaded ? (
        <FileDrop onFile={onFile} onSample={onSample} busy={busy} />
      ) : (
        <>
          {loaded.result.skipped.length > 0 && (
            <div className="alert alert-warn">
              <span aria-hidden="true">ℹ️</span>
              <div>
                <h3>{num(loaded.result.skipped.length)}개 행을 건너뛰었습니다</h3>
                <p>
                  전체 {num(loaded.result.totalRows)}행 중 {num(loaded.result.records.length)}행을 읽었습니다.
                </p>
                <details>
                  <summary>건너뛴 행 보기</summary>
                  <ul>
                    {loaded.result.skipped.slice(0, 20).map((s) => (
                      <li key={s.line}>
                        {s.line}번째 줄 — {s.reason} ({s.text.slice(0, 60)})
                      </li>
                    ))}
                    {loaded.result.skipped.length > 20 && <li>… 외 {num(loaded.result.skipped.length - 20)}개</li>}
                  </ul>
                </details>
              </div>
            </div>
          )}

          <section className="section" aria-label="필터">
            <div className="section-intro" aria-hidden="true"><span>01</span><p>EXPLORE YOUR HISTORY</p></div>
            <div className="card">
              <div className="filters">
                <div className="field field-search">
                  <label htmlFor="q">작품·에피소드 검색</label>
                  <input
                    id="q"
                    type="search"
                    placeholder="예: 심야의 서울"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="from">시작일</label>
                  <input
                    id="from"
                    type="date"
                    value={from}
                    min={bounds ? fmtDateInput(bounds.min) : undefined}
                    max={to || (bounds ? fmtDateInput(bounds.max) : undefined)}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="to">종료일</label>
                  <input
                    id="to"
                    type="date"
                    value={to}
                    min={from || (bounds ? fmtDateInput(bounds.min) : undefined)}
                    max={bounds ? fmtDateInput(bounds.max) : undefined}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="kind">종류</label>
                  <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
                    <option value="all">전체</option>
                    <option value="series">시리즈</option>
                    <option value="movie">영화</option>
                  </select>
                </div>
              </div>
              <div className="filters-foot">
                <span>
                  전체 {num(entries.length)}건 중 <strong>{num(filtered.length)}건</strong> 표시 중
                </span>
                {filterOn && (
                  <button type="button" className="btn" onClick={reset}>
                    필터 초기화
                  </button>
                )}
              </div>
            </div>
          </section>

          {!stats ? (
            <section className="section">
              <div className="card empty">
                <p>조건에 맞는 시청 기록이 없습니다.</p>
                <p>검색어나 날짜 범위를 바꿔 보세요.</p>
              </div>
            </section>
          ) : (
            <>
              <section className="section" aria-label="한 해 돌아보기">
                <div className="card recap-cta">
                  <div className="recap-copy">
                    <p className="recap-cta-kicker">YOUR YEAR ON NETFLIX</p>
                    <h2>{latestRecapYear}년 한 해 돌아보기</h2>
                    <p>
                      한 해 시청 기록을 카드 5장으로 정리해 드립니다. 위쪽 검색·기간·종류 필터와 상관없이
                      불러온 전체 기록으로 계산하며, 연도는 돌아보기 화면에서 바꿀 수 있습니다.
                    </p>
                  </div>
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => setRecapOpen(true)}>
                    한 해 돌아보기 <span aria-hidden="true">→</span>
                  </button>
                  <div className="recap-cta-year" aria-hidden="true">{String(latestRecapYear).slice(2)}</div>
                </div>
              </section>

              {recapOpen && <RecapModal entries={entries} onClose={() => setRecapOpen(false)} />}

              <section className="section" aria-label="요약 통계">
                <div className="section-intro" aria-hidden="true"><span>02</span><p>AT A GLANCE</p></div>
                <div className="kpis">
                  <div className="kpi kpi-accent">
                    <div className="kpi-label">총 시청 항목</div>
                    <div className="kpi-value">{num(stats.total)}<small>건</small></div>
                    <div className="kpi-sub">
                      에피소드 {num(stats.episodeCount)}편 · 영화 {num(stats.total - stats.episodeCount)}편
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">시청한 날</div>
                    <div className="kpi-value">{num(stats.activeDays)}<small>일</small></div>
                    <div className="kpi-sub">시청한 날 평균 {stats.perActiveDay.toFixed(1)}편</div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">기간</div>
                    <div className="kpi-value">{num(stats.spanDays)}<small>일</small></div>
                    <div className="kpi-sub">{fmtDate(stats.first)} ~ {fmtDate(stats.last)}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">가장 많이 본 작품</div>
                    <div className="kpi-value" style={{ fontSize: 18 }}>{stats.topShow?.show ?? '—'}</div>
                    <div className="kpi-sub">
                      {stats.topShow ? `${num(stats.topShow.count)}${stats.topShow.kind === 'series' ? '화' : '회'} 시청` : ''}
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">작품 수 (추정)</div>
                    <div className="kpi-value">{num(stats.seriesCount + stats.movieCount)}<small>개</small></div>
                    <div className="kpi-sub">시리즈 {num(stats.seriesCount)} · 영화 {num(stats.movieCount)}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">최장 연속 시청</div>
                    <div className="kpi-value">{num(stats.longestStreak?.days ?? 0)}<small>일</small></div>
                    <div className="kpi-sub">
                      {stats.longestStreak
                        ? `${fmtDate(stats.longestStreak.from)} ~ ${fmtDate(stats.longestStreak.to)}`
                        : '기록 없음'}
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">현재 연속 시청</div>
                    <div className="kpi-value">{num(stats.currentStreak?.days ?? 0)}<small>일</small></div>
                    <div className="kpi-sub">
                      {stats.currentStreak
                        ? `${fmtDate(stats.currentStreak.from)}부터 진행 중`
                        : `마지막 시청 ${fmtDate(stats.last)}`}
                    </div>
                  </div>
                </div>
              </section>

              <section className="section" aria-label="시간별 통계">
                <div className="section-intro" aria-hidden="true"><span>03</span><p>WATCH PATTERNS</p></div>
                <div className="charts">
                  <MonthlyChart months={stats.byMonth} />
                  <WeekdayChart weekdays={stats.byWeekday} />
                </div>
              </section>

              <section className="section">
                <div className="section-intro" aria-hidden="true"><span>04</span><p>DAILY RHYTHM</p></div>
                <StreakCalendar years={years} busiestDay={stats.busiestDay} />
              </section>

              <section className="section">
                <TimelineChart months={stats.byMonth} />
              </section>

              <section className="section">
                <div className="section-intro" aria-hidden="true"><span>05</span><p>YOUR LIBRARY</p></div>
                <ShowTable shows={stats.shows} />
              </section>

              <section className="section">
                <HistoryTable entries={filtered} />
              </section>
            </>
          )}
        </>
      )}

      <footer className="footer">
        <p>
          모든 분석은 브라우저에서만 수행됩니다. 파일은 어디에도 업로드되지 않고, 새로고침하면 사라집니다.
        </p>
        <p>시리즈·영화 구분은 제목 표기를 기준으로 한 추정값입니다.</p>
      </footer>
    </div>
  )
}
