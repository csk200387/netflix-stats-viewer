import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FileDrop from './components/FileDrop'
import Filters, { EMPTY_FILTER, isFiltering, type FilterState } from './components/Filters'
import Kpis from './components/Kpis'
import { MonthlyChart, StreakCalendar, TimelineChart, WeekdayChart } from './components/Charts'
import RecapModal from './components/Recap'
import { HistoryTable, ShowTable } from './components/Tables'
import BreakEvenTeaser from './components/value/BreakEvenTeaser'
import ValueAnalyzer from './components/value/ValueAnalyzer'
import { num } from './lib/format'
import { CsvError, parseViewingHistory, type ParseResult } from './lib/parse'
import { recapYears } from './lib/recap'
import { calendarYears, classifyAll, computeStats } from './lib/stats'

type Loaded = { id: number; fileName: string; result: ParseResult }

const SAMPLE_URL = `${import.meta.env.BASE_URL}sample-viewing-history.csv`

function SectionIntro({ no, children }: { no: string; children: string }) {
  return (
    <div className="section-intro" aria-hidden="true">
      <span>{no}</span>
      <p>{children}</p>
    </div>
  )
}

function SkippedRows({ result }: { result: ParseResult }) {
  if (result.skipped.length === 0) return null
  return (
    <div className="alert alert-warn">
      <span aria-hidden="true">ℹ️</span>
      <div>
        <h3>{num(result.skipped.length)}개 행을 건너뛰었습니다</h3>
        <p>전체 {num(result.totalRows)}행 중 {num(result.records.length)}행을 읽었습니다.</p>
        <details>
          <summary>건너뛴 행 보기</summary>
          <ul>
            {result.skipped.slice(0, 20).map((s) => (
              <li key={s.line}>{s.line}번째 줄 — {s.reason} ({s.text.slice(0, 60)})</li>
            ))}
            {result.skipped.length > 20 && <li>… 외 {num(result.skipped.length - 20)}개</li>}
          </ul>
        </details>
      </div>
    </div>
  )
}

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const loadSequence = useRef(0)

  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER)
  const [recapOpen, setRecapOpen] = useState(false)

  useEffect(() => {
    if (loaded) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [loaded])

  const load = useCallback(async (fileName: string, read: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    try {
      const result = parseViewingHistory(await read())
      setLoaded({ id: ++loadSequence.current, fileName, result })
      setRecapOpen(false)
      setFilter(EMPTY_FILTER)
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
    const q = filter.query.trim().toLowerCase()
    const fromTime = filter.from ? new Date(`${filter.from}T00:00:00`).getTime() : -Infinity
    const toTime = filter.to ? new Date(`${filter.to}T23:59:59`).getTime() : Infinity
    return entries.filter((e) => {
      if (filter.kind !== 'all' && e.kind !== filter.kind) return false
      const t = e.date.getTime()
      if (t < fromTime || t > toTime) return false
      return q === '' || e.title.toLowerCase().includes(q) || e.show.toLowerCase().includes(q)
    })
  }, [entries, filter])

  const stats = useMemo(() => computeStats(filtered), [filtered])
  const years = useMemo(() => (stats ? calendarYears(stats.byDay) : []), [stats])
  // 한 해 돌아보기는 필터를 타지 않는다 — 불러온 전체 기록의 연도만 본다
  const allRecapYears = useMemo(() => recapYears(entries), [entries])
  const latestRecapYear = allRecapYears[0]
  const filterOn = isFiltering(filter)

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span className="brand-name">WATCHED</span>
        </div>
        {loaded && (
          <div className="header-actions">
            <button type="button" className="btn" onClick={() => setFilter(EMPTY_FILTER)} disabled={!filterOn}>
              필터 초기화
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setLoaded(null)
                setError(null)
                setFilter(EMPTY_FILTER)
              }}
            >
              다른 파일 불러오기
            </button>
          </div>
        )}
      </header>

      {loaded ? (
        <section className="hero hero-loaded" aria-labelledby="page-title">
          <div className="hero-kicker">
            <span>PERSONAL STREAMING ARCHIVE</span>
            <span>{loaded.fileName}</span>
          </div>
          <h1 id="page-title">
            당신의 시청 기록,<br /><em>한눈에.</em>
          </h1>
          <div className="hero-foot">
            <p>먼저 시청 습관을 살펴보고, 아래에서 넷플릭스로 본전을 뽑았는지 확인해 보세요.</p>
            <div className="hero-pills" aria-label="불러온 기록 요약">
              <span>{num(entries.length)} WATCHES</span>
              <span>{allRecapYears.length} YEARS</span>
              <a className="hero-jump" href="#value">본전 계산 바로가기 <span aria-hidden="true">↓</span></a>
            </div>
          </div>
        </section>
      ) : (
        <section className="hero hero-landing" aria-labelledby="page-title">
          <h1 id="page-title">
            넷플릭스,<br /><em>본전 뽑았나요?</em>
          </h1>
          <div className="hero-foot">
            <p>
              매달 나가는 구독료, 정말 그만큼 보고 있을까요? 시청 기록을 올리면 결제 주기마다 본전을 뽑았는지,
              어떤 날이 손해였는지 계산해 드립니다. 시청 통계는 덤이에요.
            </p>
            <a className="btn btn-primary btn-lg" href="#upload">지금 확인하기 <span aria-hidden="true">↓</span></a>
          </div>
        </section>
      )}

      {!loaded ? (
        <>
          <BreakEvenTeaser />
          <div id="upload" className="upload-anchor">
            <FileDrop onFile={onFile} onSample={onSample} busy={busy} error={error} />
          </div>
        </>
      ) : (
        <>
          <SkippedRows result={loaded.result} />

          <section className="section" aria-label="필터">
            <SectionIntro no="01">EXPLORE YOUR HISTORY</SectionIntro>
            <Filters value={filter} onChange={setFilter} bounds={bounds} total={entries.length} shown={filtered.length} />
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
              <section className="section" aria-label="요약 통계">
                <SectionIntro no="02">AT A GLANCE</SectionIntro>
                <Kpis stats={stats} />
              </section>

              <section className="section" aria-label="시간별 통계">
                <SectionIntro no="03">WATCH PATTERNS</SectionIntro>
                <div className="charts">
                  <MonthlyChart months={stats.byMonth} />
                  <WeekdayChart weekdays={stats.byWeekday} />
                </div>
              </section>

              <section className="section">
                <SectionIntro no="04">DAILY RHYTHM</SectionIntro>
                <StreakCalendar years={years} busiestDay={stats.busiestDay} />
              </section>

              <section className="section">
                <TimelineChart months={stats.byMonth} />
              </section>
            </>
          )}

          {/* 본전 계산은 필터와 무관하게 전체 기록을 쓰므로 필터 결과가 비어도 상태를 유지한 채 항상 렌더링한다 */}
          <section className="section value-section" id="value" aria-labelledby="value-title">
            <SectionIntro no="05">WAS IT WORTH IT?</SectionIntro>
            <ValueAnalyzer key={loaded.id} entries={entries} />
          </section>

          {stats && (
            <>
              <section className="section">
                <SectionIntro no="06">YOUR LIBRARY</SectionIntro>
                <ShowTable shows={stats.shows} />
              </section>

              <section className="section">
                <HistoryTable entries={filtered} />
              </section>

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
            </>
          )}

          {recapOpen && <RecapModal entries={entries} onClose={() => setRecapOpen(false)} />}
        </>
      )}

      <footer className="footer">
        <p>
          장르를 알기 위해 작품 제목만 TMDB로 보내 조회합니다. 파일과 시청 날짜는 보내지 않습니다. This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <p>
          시리즈·영화 구분은 제목 표기를 기준으로 한 추정값입니다. 같은 화를 다시 봐도 넷플릭스 기록은
          날짜만 갱신되므로, 시청 건수는 본 화의 수이며 재시청 횟수는 알 수 없습니다.
        </p>
        <p>Netflix와 무관한 비공식 도구입니다.</p>
      </footer>
    </div>
  )
}
