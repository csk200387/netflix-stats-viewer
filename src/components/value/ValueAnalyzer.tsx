import { useMemo, useState } from 'react'
import type { Entry } from '../../lib/stats'
import { percent, signedWon, won } from '../../lib/format'
import {
  applyPlan, computeValue, initialValueSettings, showOverride, summarizeValue,
  type CategoryId, type PlanId, type ShowValue, type ValueReport, type ValueSettings, type ValueSummary,
} from '../../lib/value'
import ContentRates from './ContentRates'
import CostSettings from './CostSettings'
import CycleBoard from './CycleBoard'
import CycleVerdict from './CycleVerdict'

const ANSWER: Record<ValueSummary['verdict'], string> = {
  earned: '네, 뽑았어요',
  short: '아직은 손해예요',
  free: '낸 돈이 없어요',
}

function Answer({ summary, error }: { summary: ValueSummary | null; error: string | null }) {
  if (!summary) {
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
            {signedWon(summary.balance)} <small>· 낸 돈 대비 {percent(summary.ratio)}</small>
          </p>
          <div className="value-answer-bar" aria-hidden="true"><i style={{ width: `${fill}%` }} /></div>
        </>
      )}
      <small>본전 달성 {summary.reachedCycles} / {summary.chargedCycles} 결제 주기</small>
      <small className="value-answer-basis">
        비슷한 콘텐츠를 따로 빌려 봤다면 든 돈으로 환산한 추정치
        {summary.typeRateShare !== null && ` · 환산액의 ${percent(summary.typeRateShare)}는 유형별 추정 단가`}
      </small>
    </div>
  )
}

function Metrics({ report, summary }: { report: ValueReport; summary: ValueSummary }) {
  return (
    <div className="value-summary" aria-live="polite">
      <div className="value-metric">
        <span>기간 전체 내 부담액</span>
        <strong>{won(report.totalCost)}</strong>
        <small>{summary.activeCycles}개 결제 주기 · 주기별 전액</small>
      </div>
      <div className="value-metric">
        <span>광고 비용 차감 후 환산액</span>
        <strong>{won(report.net)}</strong>
        <small>단건 환산 {won(report.gross)} − 광고 시간 {won(report.adCost)}</small>
      </div>
      <div className="value-metric">
        <span>본전을 채운 결제 주기</span>
        <strong>{summary.reachedCycles}<small> / {summary.chargedCycles}회</small></strong>
        <small>부분 집계 기간도 포함 · 부담액 0원 제외</small>
      </div>
    </div>
  )
}

/** 본전 계산기. 불러온 전체 기록으로 계산하며 통계 화면의 검색·기간 필터와 독립적이다. */
export default function ValueAnalyzer({ entries }: { entries: Entry[] }) {
  const [settings, setSettings] = useState(() => initialValueSettings(entries))
  const [plan, setPlan] = useState<PlanId>('ads')
  const [cycleKey, setCycleKey] = useState('')

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

  const cycles = report?.cycles ?? []
  const cycle = cycles.find((c) => c.key === cycleKey) ?? cycles.filter((c) => c.included).at(-1) ?? cycles.at(-1)

  const toggleCycle = (key: string) =>
    setSettings((old) => ({
      ...old,
      excludedCycles: old.excludedCycles.includes(key) ? old.excludedCycles.filter((k) => k !== key) : [...old.excludedCycles, key],
    }))
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
            드라마 한 회와 애니 한 화의 가치는 다르니까. 콘텐츠별 비교 단가와 내가 낸 구독료로 시청의 가치를 계산해 보세요.
          </p>
          <p className="value-intro-note">
            <span>단건 구매 대비 환산 추정</span>
            불러온 전체 기록으로 계산하며 위쪽 검색·기간·종류 필터와는 독립적입니다.
          </p>
        </div>
        <Answer summary={summary} error={error} />
      </div>

      <CostSettings
        settings={settings}
        plan={plan}
        onPlan={(next) => {
          setPlan(next)
          setSettings((old) => applyPlan(old, next))
        }}
        update={update}
        costPerCycle={report?.costPerCycle ?? null}
      />

      <ContentRates
        entries={entries}
        settings={settings}
        onRate={(category, price) => setSettings((old) => ({ ...old, rates: { ...old.rates, [category]: price } }))}
        onShow={updateShow}
        onResetShow={resetShow}
      />

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {report && summary && cycle && (
        <>
          <Metrics report={report} summary={summary} />
          <CycleVerdict report={report} cycle={cycle} settings={settings} onSelectCycle={setCycleKey} onToggleCycle={toggleCycle} />
          <CycleBoard cycles={cycles} selectedKey={cycle.key} onSelect={setCycleKey} />
          <p className="value-footnote">
            기본 유형 추정 {report.estimatedCount}건 · 미확인으로 제외 {report.excludedCount}건 · 같은 날짜·제목의 중복행 제외{' '}
            {report.duplicateCount}건 · 선택 기간·구독 제외 주기 밖 {report.outsideCount}건. 시청시간·완주 여부는 확인할 수 없으며 기록
            한 건을 한 편으로 가정합니다. 재시청은 날짜가 다르면 별도 건으로 계산합니다. 동일 작품 구매를 대체하지 않는 값은 실제
            절약액이 아닌 환산 추정치입니다.
          </p>
        </>
      )}
    </div>
  )
}
