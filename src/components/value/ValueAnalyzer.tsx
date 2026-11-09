import { useEffect, useMemo, useState } from 'react'
import type { Entry } from '../../lib/stats'
import { num, percent, won } from '../../lib/format'
import { TMDB_TOKEN, lookupTitles } from '../../lib/tmdb'
import {
  adsAllowed, applyPlan, computeValue, initialValueSettings, showOverride, summarizeValue, valueBasis,
  type CategoryId, type PlanId, type ShowValue, type ValueReport, type ValueSettings, type ValueSummary,
} from '../../lib/value'
import ContentRates from './ContentRates'
import CostSettings, { QuickCost } from './CostSettings'
import CycleBoard from './CycleBoard'
import CycleVerdict from './CycleVerdict'
import ValueBasis from './ValueBasis'

const ANSWER: Record<ValueSummary['verdict'], string> = {
  earned: '네, 뽑았어요',
  short: '아직은 손해예요',
  free: '내 부담이 없어요',
}

type AnswerProps = { report: ValueReport | null; summary: ValueSummary | null; error: string | null; asked: boolean }

function Answer({ report, summary, error, asked }: AnswerProps) {
  if (!asked) {
    return (
      <div className="value-answer" aria-live="polite">
        <span>지금까지의 답</span>
        <strong>요금제를<br />골라 주세요</strong>
        <p><small>고르는 즉시 기록 전체로 계산해요.</small></p>
      </div>
    )
  }
  if (!summary || !report) {
    return (
      <div className="value-answer is-error" aria-live="polite">
        <span>지금까지의 답</span>
        <strong>설정 확인</strong>
        <p>{error}</p>
      </div>
    )
  }
  const fill = summary.ratio === null ? 0 : Math.max(0, Math.min(100, summary.ratio * 100))
  return (
    <div className={`value-answer is-${summary.verdict}`} aria-live="polite">
      <span>지금까지의 답</span>
      <strong>{ANSWER[summary.verdict]}</strong>
      {summary.ratio !== null && (
        <>
          <p>
            내 부담의 {percent(summary.ratio)} <small>· 환산액 {won(report.net)} / 내 부담 {won(report.totalCost)}</small>
          </p>
          <div className="value-answer-bar" aria-hidden="true"><i style={{ width: `${fill}%` }} /></div>
        </>
      )}
      <small>본전 달성 {summary.reachedCycles} / {summary.chargedCycles} 결제 주기</small>
      <small className="value-answer-basis">
        비슷한 작품을 따로 빌려 봤다면 들었을 돈(추정)과 내 부담(설정)의 비교예요. 실제로 아낀 돈은 아니에요.{' '}
        <a href="#value-basis">이 답이 바뀌는 조건</a>
      </small>
    </div>
  )
}

type Lookup = { total: number; done: number; found: number | null; error: string | null }

/** 작품 제목을 TMDB에서 조회한 진행 상황 */
function LookupStatus({ lookup }: { lookup: Lookup }) {
  const text = lookup.error
    ? `TMDB 장르 조회에 실패해 기본 유형으로 계산했어요 (${lookup.error})`
    : lookup.found === null
      ? `TMDB에서 작품 장르 확인 중… ${num(lookup.done)} / ${num(lookup.total)}`
      : `TMDB에서 작품 ${num(lookup.total)}개 중 ${num(lookup.found)}개의 장르를 찾아 단가에 반영했어요`
  return <p className="value-lookup" aria-live="polite">{text}</p>
}

/** 본전 계산기. 불러온 전체 기록으로 계산하며 통계 화면의 검색·기간 필터와 독립적이다. */
export default function ValueAnalyzer({ entries }: { entries: Entry[] }) {
  const [settings, setSettings] = useState(() => initialValueSettings(entries))
  const [plan, setPlan] = useState<PlanId | null>(null)
  const [cycleKey, setCycleKey] = useState('')

  const [lookup, setLookup] = useState<Lookup | null>(null)

  useEffect(() => {
    const titles = [...new Map(entries.map((e) => [e.show, { show: e.show, kind: e.kind }])).values()]
    if (!TMDB_TOKEN || titles.length === 0) return
    const controller = new AbortController()
    setLookup({ total: titles.length, done: 0, found: null, error: null })
    lookupTitles(titles, TMDB_TOKEN, (done) => setLookup((old) => old && { ...old, done }), controller.signal)
      .then((guesses) => {
        setSettings((old) => ({ ...old, guesses }))
        setLookup({ total: titles.length, done: titles.length, found: Object.keys(guesses).length, error: null })
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setLookup((old) => old && { ...old, error: e instanceof Error ? e.message : '네트워크 오류' })
      })
    return () => controller.abort()
  }, [entries])

  const update = <K extends keyof ValueSettings>(key: K, value: ValueSettings[K]) =>
    setSettings((old) => ({ ...old, [key]: value }))

  const { report, error } = useMemo(() => {
    try {
      return { report: computeValue(entries, settings), error: null }
    } catch (e) {
      return { report: null, error: e instanceof Error ? e.message : '설정을 확인해 주세요.' }
    }
  }, [entries, settings])
  const summary = useMemo(() => (report ? summarizeValue(report) : null), [report])
  const basis = useMemo(() => (report ? valueBasis(report) : null), [report])

  const cycles = report?.cycles ?? []
  const cycle = cycles.find((c) => c.key === cycleKey) ?? cycles.filter((c) => c.included).at(-1) ?? cycles.at(-1)

  const toggleCycle = (key: string) =>
    setSettings((old) => ({
      ...old,
      excludedCycles: old.excludedCycles.includes(key) ? old.excludedCycles.filter((k) => k !== key) : [...old.excludedCycles, key],
    }))
  const excludeCycles = (keys: string[]) =>
    setSettings((old) => ({ ...old, excludedCycles: [...new Set([...old.excludedCycles, ...keys])] }))
  const updateShow = (name: string, patch: Partial<ShowValue>, fallback: CategoryId) =>
    setSettings((old) => ({
      ...old,
      shows: { ...old.shows, [name]: { ...(showOverride(old, name) ?? { category: fallback }), ...patch } },
    }))
  const resetShow = (name: string) =>
    setSettings((old) => {
      const shows = { ...old.shows }
      delete shows[name]
      return { ...old, shows }
    })

  return (
    <div className="value">
      <div className="card value-intro">
        <div className="value-intro-copy">
          <p className="value-kicker">YOUR NETFLIX, YOUR MONEY</p>
          <h2 id="value-title">당신은 넷플릭스로<br /><em>본전을 뽑으셨나요?</em></h2>
          <p className="value-description">
            요금제와 나눠 내는 인원만 고르면, 지금까지 본 작품을 따로 빌려 봤을 때의 값과 비교해 드려요.
          </p>
          <QuickCost
            settings={settings}
            plan={plan}
            onPlan={(next) => {
              setPlan(next)
              setSettings((old) => applyPlan(old, next))
            }}
            update={update}
            costPerCycle={report?.costPerCycle ?? null}
          />
          {lookup && <LookupStatus lookup={lookup} />}
        </div>
        <Answer report={report} summary={summary} error={error} asked={plan !== null} />
      </div>

      {plan && error && <div className="alert alert-error" role="alert">{error}</div>}

      {plan && report && summary && basis && cycle && (
        <>
          <ValueBasis
            report={report}
            summary={summary}
            basis={basis}
            settings={settings}
            lookupPending={lookup !== null && lookup.found === null && lookup.error === null}
            onExcludeCycles={excludeCycles}
            onIncludeAll={() => update('excludedCycles', [])}
          />
          <CycleBoard cycles={cycles} selectedKey={cycle.key} onSelect={setCycleKey} />
          <CycleVerdict report={report} cycle={cycle} settings={settings} onSelectCycle={setCycleKey} onToggleCycle={toggleCycle} />
        </>
      )}

      {plan && (
        <>
          <header className="value-adjust-head" id="value-settings">
            <p className="value-kicker">ADJUST</p>
            <h3>결과가 내 상황과 다르다면</h3>
            <p>
              불러온 전체 기록으로 계산하며 위쪽 검색·기간·종류 필터와는 독립적이에요. 아래 값을 바꾸면 위 결과가 바로 다시 계산돼요.
            </p>
          </header>

          <CostSettings settings={settings} adsPossible={adsAllowed(plan)} update={update} />

          <ContentRates
            entries={entries}
            settings={settings}
            onRate={(category, price) => setSettings((old) => ({ ...old, rates: { ...old.rates, [category]: price } }))}
            onShow={updateShow}
            onResetShow={resetShow}
          />
        </>
      )}

      {plan && report && (
        <p className="value-footnote">
          CSV에는 시청시간·완주 여부·광고 정보가 없어 기록 한 건을 한 편으로 셉니다. 같은 화를 다시 보면 넷플릭스 기록에는 마지막으로 본
          날짜만 남으므로, 예전 결제 주기에 본 회차가 최근 주기로 옮겨 계산될 수 있고 재시청은 따로 셀 수 없습니다. 같은 작품을 실제로
          단건 구매하는 것을 대신한 경우가 아니라면 환산액은 절약액이 아닙니다.
        </p>
      )}
    </div>
  )
}
