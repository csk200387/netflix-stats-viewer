import { useState } from 'react'
import { fmtDate } from '../../lib/stats'
import { num, percent, won } from '../../lib/format'
import {
  PROJECTION_CATEGORIES, catchUpSeries, cycleShows, cycleStatus, parseDate, watchesToBreakEven,
  type CategoryId, type ShowContribution, type CycleStatus, type ValueCycle, type ValueReport, type ValueSettings,
} from '../../lib/value'
import Choice from '../ui/Choice'

const HEADLINE: Record<CycleStatus, string> = {
  excluded: '이 주기는 구독하지 않았어요',
  free: '추가 부담이 없는 주기예요',
  reached: '이 주기는 본전을 뽑으셨어요!',
  pending: '집계 범위에서는 아직 본전 전이에요',
  short: '이 주기는 본전에 미달했어요',
}
const SHORT_LABEL: Record<CycleStatus, string> = {
  excluded: '제외', free: '부담 없음', reached: '달성', pending: '미달', short: '미달',
}

const TOP_SHOWS = 5
const unit = (s: ShowContribution) => `${num(s.count)}${s.kind === 'series' ? '화' : '편'}`

type Props = {
  report: ValueReport
  cycle: ValueCycle
  settings: ValueSettings
  onSelectCycle: (key: string) => void
  onToggleCycle: (key: string) => void
}

export default function CycleVerdict({ report, cycle, settings, onSelectCycle, onToggleCycle }: Props) {
  const [nextCategory, setNextCategory] = useState<CategoryId>('anime')
  const status = cycleStatus(cycle)
  const charged = cycle.included && cycle.cost > 0
  const ratio = cycle.cost > 0 ? cycle.net / cycle.cost : 0
  const projection = watchesToBreakEven(cycle, settings, nextCategory)
  const ads = settings.adsEnabled && !settings.kidsProfile
  const newestFirst = [...report.cycles].reverse()
  const shows = cycleShows(cycle, settings)
  const rest = shows.slice(TOP_SHOWS)
  const picks = charged && !cycle.reached ? catchUpSeries(shows, projection.remaining) : []
  const crossing = cycle.days.find((d) => d.key === cycle.firstReached)?.watches.at(-1)?.entry.show

  return (
    <div className="card value-block" id="value-cycle-result">
      <header className="value-block-head value-block-head-row">
        <div>
          <span className="value-step">RESULT 2</span>
          <h3>이 달은 어떻게 뽑았을까?</h3>
        </div>
        <div className="field">
          <label className="visually-hidden" htmlFor="value-cycle">결제 주기 선택</label>
          <select id="value-cycle" value={cycle.key} onChange={(e) => onSelectCycle(e.target.value)}>
            {newestFirst.map((c) => (
              <option value={c.key} key={c.key}>
                {fmtDate(c.start)} ~ {fmtDate(c.end)}{!c.included ? ' · 구독 제외' : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className={`value-verdict is-${status}`}>
        <p>{HEADLINE[status]}</p>
        <strong>
          {cycle.firstReached
            ? `${fmtDate(parseDate(cycle.firstReached))}에 본전 달성`
            : charged ? `${won(projection.remaining)} 더 필요해요` : '—'}
        </strong>
        <span>
          환산액 {won(cycle.net)} / 내 부담 {won(cycle.cost)}{cycle.cost > 0 ? ` · ${percent(ratio)}` : ''}
          {crossing && ` · 「${crossing}」 보다가 넘었어요`}
        </span>
        <progress
          className="value-progress"
          max={100}
          value={Math.max(0, Math.min(100, ratio * 100))}
          aria-label="선택 결제 주기의 본전 달성률"
        />
      </div>
      {cycle.partial && (
        <p className="value-help">부분 집계: 이 결제 주기의 일부 날짜만 분석 범위에 있습니다. 부담액은 전액 반영합니다. CSV에 빠진 시청 기록은 알 수 없습니다.</p>
      )}
      {cycle.firstReached && !cycle.reached && (
        <p className="value-help">최초 도달 뒤 광고 시간 비용이 추가되어 현재 환산액은 다시 미달입니다.</p>
      )}

      {shows.length > 0 && (
        <div className="value-sub">
          <h4>{cycle.reached ? '이 작품들로 뽑았어요' : '이 달에 본 작품'}</h4>
          <ul className="value-shows">
            {shows.slice(0, TOP_SHOWS).map((s) => (
              <li key={s.show}>
                <span>{s.show}</span>
                <small>{unit(s)}</small>
                <strong>{won(s.net)}</strong>
                {cycle.cost > 0 && <i aria-hidden="true"><b style={{ width: `${Math.max(0, Math.min(100, (s.net / cycle.cost) * 100))}%` }} /></i>}
              </li>
            ))}
          </ul>
          {rest.length > 0 && (
            <p className="value-help">외 {num(rest.length)}개 작품 {won(rest.reduce((sum, s) => sum + s.net, 0))}</p>
          )}
        </div>
      )}

      {charged && !cycle.reached && (
        <div className="value-sub">
          <h4>{status === 'pending' ? '남은 기간에 이만큼 더 보면 뽑아요' : '이만큼 더 봤다면 뽑았어요'}</h4>
          {picks.length > 0 ? (
            <>
              <ul className="value-shows value-picks">
                {picks.map((p) => (
                  <li key={p.show}>
                    <span>「{p.show}」</span>
                    <small>화당 {won(p.perWatch)}</small>
                    <strong>{num(p.needed)}화 더</strong>
                  </li>
                ))}
              </ul>
              <p className="value-help">
                이 달에 많이 본 시리즈를 이어 봤다면 필요한 회차예요. 하나만 봐도 채워지는 양이며, 남은 회차가 실제로 있는지는 알 수 없어요.
              </p>
            </>
          ) : (
            <div className="value-next-watch">
              <Choice
                id="value-next-type"
                label="앞으로 이 종류만 본다면?"
                value={nextCategory}
                options={PROJECTION_CATEGORIES.map((c) => ({ value: c.id, label: c.label, hint: `${won(settings.rates[c.id])}/편` }))}
                onChange={setNextCategory}
              />
              <div>
                <strong>
                  {projection.count === null
                    ? '현재 단가·광고 비용으로는 도달 불가'
                    : projection.count === 0 ? '이미 본전에 도달했어요' : `추가 ${num(projection.count)}편`}
                </strong>
                <p className="value-help">
                  선택 주기의 남은 {won(projection.remaining)}을 채우는 예상량입니다. 유형별 기본 단가를 쓰며,{' '}
                  {ads ? `앞으로 매 편 광고 ${settings.adCount}개 × ${settings.adSeconds}초를` : '광고 시간 비용 없이'} 가정합니다.
                  작품별 수정값·초반 무광고 구간은 이 예상에 적용하지 않습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <details className="value-details">
        <summary>
          결제 주기별 내역 · 구독하지 않은 주기 제외
          <span>{num(report.cycles.length)}개 주기</span>
        </summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">구독 여부</th>
                <th scope="col">결제 기간</th>
                <th scope="col">내 부담액</th>
                <th scope="col">차감 후 환산액</th>
                <th scope="col">최초 도달일</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((c) => (
                <tr key={c.key} className={c.key === cycle.key ? 'is-current' : undefined}>
                  <td>
                    <label className="value-check">
                      <input type="checkbox" checked={c.included} onChange={() => onToggleCycle(c.key)} aria-label={`${fmtDate(c.start)} 결제 주기 구독 여부`} />
                      포함
                    </label>
                  </td>
                  <td>{fmtDate(c.start)} ~ {fmtDate(c.end)}</td>
                  <td>{won(c.cost)}</td>
                  <td>{won(c.net)}</td>
                  <td>{c.firstReached ? fmtDate(parseDate(c.firstReached)) : '—'}</td>
                  <td>{SHORT_LABEL[cycleStatus(c)]}{c.partial && ' · 부분 집계'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
