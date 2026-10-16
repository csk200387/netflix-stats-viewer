import { useState } from 'react'
import { fmtDate } from '../../lib/stats'
import { num, percent, won } from '../../lib/format'
import { cycleStatus, type ValueCycle } from '../../lib/value'
import Choice from '../ui/Choice'

type Filter = 'all' | 'reached' | 'short'

const STATUS_TEXT = { reached: '뽑았어요', pending: '집계 중', short: '못 뽑았어요' } as const

type Props = {
  cycles: ValueCycle[]
  selectedKey: string
  onSelect: (key: string) => void
}

/** 부담액이 있는 결제 주기를 달 단위 카드로 모아 본전 달성 여부별로 걸러 본다 */
export default function CycleBoard({ cycles, selectedKey, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const charged = cycles.filter((c) => c.included && c.cost > 0).reverse()
  const reachedCount = charged.filter((c) => c.reached).length
  const shown = filter === 'all' ? charged : charged.filter((c) => c.reached === (filter === 'reached'))

  return (
    <div className="card value-block">
      <header className="value-block-head">
        <span className="value-step">RESULT 1</span>
        <h3>본전 뽑은 달, 못 뽑은 달</h3>
        <p>달을 누르면 아래에서 그 달의 자세한 결과를 볼 수 있어요. 구독 제외·부담 0원인 주기는 빼고 모았습니다.</p>
      </header>

      <Choice
        id="value-board-filter"
        label="모아 보기"
        hideLabel
        value={filter}
        options={[
          { value: 'all', label: `전체 ${num(charged.length)}` },
          { value: 'reached', label: `뽑은 달 ${num(reachedCount)}` },
          { value: 'short', label: `못 뽑은 달 ${num(charged.length - reachedCount)}` },
        ]}
        onChange={setFilter}
      />

      {shown.length === 0 ? (
        <p className="value-help">해당하는 달이 없어요.</p>
      ) : (
        <ul className="cycle-board">
          {shown.map((c) => {
            const status = cycleStatus(c) as keyof typeof STATUS_TEXT
            const ratio = c.net / c.cost
            return (
              <li key={c.key}>
                <button
                  type="button"
                  className={`cycle-card is-${status}`}
                  aria-pressed={c.key === selectedKey}
                  onClick={() => {
                    onSelect(c.key)
                    document.getElementById('value-cycle-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span>
                    {c.start.getFullYear()}년 {c.start.getMonth() + 1}월
                    {c.start.getDate() !== 1 && <small>{fmtDate(c.start)} ~ {fmtDate(c.end)}</small>}
                  </span>
                  <strong>{STATUS_TEXT[status]}</strong>
                  <i aria-hidden="true"><b style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} /></i>
                  <small>{won(c.net)} / {won(c.cost)} · {percent(ratio)}</small>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
