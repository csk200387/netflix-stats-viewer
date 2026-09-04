import { LEVEL_LABELS, WEEKDAYS, fmtDate, type CalendarCell, type CalendarYear, type Stats } from '../lib/stats'

const shortMonth = (key: string) => {
  const [y, m] = key.split('-')
  return `${y.slice(2)}.${Number(m)}`
}

/** 월별 시청 건수 막대. 기록이 없는 달도 자리를 지켜 흐름이 보이게 한다. */
export function MonthlyChart({ months }: { months: Stats['byMonth'] }) {
  const max = Math.max(...months.map((m) => m.count), 1)
  return (
    <div className="card">
      <div className="section-head">
        <h2>월별 시청 건수</h2>
        <span>최다 {max.toLocaleString('ko-KR')}건</span>
      </div>
      <div className="chart-scroll">
        <div className={`bars${months.length > 10 ? ' bars-dense' : ''}`} style={{ minWidth: `${months.length * 34}px` }}>
          {months.map((m) => (
            <div
              key={m.key}
              className={`bar-col${m.count === 0 ? ' empty' : ''}`}
              title={`${m.label} · ${m.count}건`}
            >
              <span className="bar-value">{m.count || ''}</span>
              <div className="bar" style={{ height: `${(m.count / max) * 100}%` }} />
              <span className="bar-tick">{shortMonth(m.key)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WeekdayChart({ weekdays }: { weekdays: Stats['byWeekday'] }) {
  const max = Math.max(...weekdays.map((d) => d.count), 1)
  const total = weekdays.reduce((a, d) => a + d.count, 0)
  const top = weekdays.reduce((a, d) => (d.count > a.count ? d : a))
  return (
    <div className="card">
      <div className="section-head">
        <h2>요일별 시청 습관</h2>
        <span>{top.count > 0 ? `${top.label}요일에 가장 많이` : '기록 없음'}</span>
      </div>
      <div className="hbars">
        {weekdays.map((d) => (
          <div className="hbar" key={d.label}>
            <span>{d.label}</span>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
            <span className="hbar-num">
              {d.count}
              <span className="visually-hidden">건 ({total ? Math.round((d.count / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 누적 시청량 곡선 — 몰아본 시기가 가파른 구간으로 드러난다. */
export function TimelineChart({ months }: { months: Stats['byMonth'] }) {
  const W = 640
  const H = 170
  const PAD = 6
  let running = 0
  const points = months.map((m, i) => {
    running += m.count
    const x = months.length === 1 ? W / 2 : PAD + (i / (months.length - 1)) * (W - PAD * 2)
    return { x, y: running, label: m.label }
  })
  const totalValue = running || 1
  const toY = (v: number) => H - PAD - (v / totalValue) * (H - PAD * 2)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${H} L${points[0].x.toFixed(1)},${H} Z`

  return (
    <div className="card">
      <div className="section-head">
        <h2>시간에 따른 누적 시청량</h2>
        <span>총 {running.toLocaleString('ko-KR')}건</span>
      </div>
      <svg
        className="timeline"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${months[0].label}부터 ${months[months.length - 1].label}까지 누적 ${running}건`}
      >
        <defs>
          <linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e50914" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#e50914" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={toY(totalValue * f)} y2={toY(totalValue * f)} stroke="#2a2a33" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="url(#tl-fill)" />
        <path d={line} fill="none" stroke="#e50914" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="timeline-axis">
        <span>{months[0].label}</span>
        <span>{months[months.length - 1].label}</span>
      </div>
    </div>
  )
}


/** 요일 축은 월·수·금만 적어 격자가 빽빽해지지 않게 한다. */
const WEEKDAY_TICKS = [1, 3, 5]

const cellTitle = (cell: CalendarCell) => {
  const when = fmtDate(cell.date)
  if (cell.count === 0) return `${when} · 시청 없음`
  return `${when} · ${cell.count}편`
}

/** 일별 시청 잔디. 색이 짙을수록 그날 본 편수가 많다. */
export function StreakCalendar({ years, busiestDay }: { years: CalendarYear[]; busiestDay: Stats['busiestDay'] }) {
  const summary = busiestDay
    ? `하루 최다 ${busiestDay.count.toLocaleString('ko-KR')}편 (${fmtDate(busiestDay.date)})`
    : '기록 없음'

  return (
    <div className="card">
      <div className="section-head">
        <h2>일별 시청 잔디</h2>
        <span className="cal-detail">{summary}</span>
      </div>

      <div>
        {years.map((y) => (
          <section className="cal-year" key={y.year} aria-label={`${y.year}년 일별 시청 기록`}>
            <div className="cal-year-head">
              <h3>{y.year}</h3>
              <span>
                {y.total.toLocaleString('ko-KR')}건 · {y.activeDays.toLocaleString('ko-KR')}일 시청
              </span>
            </div>
            <div className="chart-scroll">
              <div className="cal-body">
                <div className="cal-weekdays" aria-hidden="true">
                  {WEEKDAYS.map((w, i) => (
                    <span key={w}>{WEEKDAY_TICKS.includes(i) ? w : ''}</span>
                  ))}
                </div>
                <div>
                  <div
                    className="cal-months"
                    style={{ gridTemplateColumns: `repeat(${y.weeks.length}, var(--cal-cell))` }}
                    aria-hidden="true"
                  >
                    {y.months.map((m) => (
                      <span key={m.label} style={{ gridColumn: m.week + 1 }}>
                        {m.label}
                      </span>
                    ))}
                  </div>
                  <div className="cal-grid">
                    {y.weeks.map((week, wi) =>
                      week.map((cell, di) =>
                        cell ? (
                          <div key={cell.key} className="cal-cell" data-level={cell.level} title={cellTitle(cell)} />
                        ) : (
                          <div key={`pad-${wi}-${di}`} className="cal-cell cal-pad" />
                        ),
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="cal-legend">
        <span>적음</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <i key={level} className="cal-cell" data-level={level} />
        ))}
        <span>많음</span>
        <span className="visually-hidden">색 단계: 시청 없음, {LEVEL_LABELS.join(', ')}</span>
      </div>
    </div>
  )
}
