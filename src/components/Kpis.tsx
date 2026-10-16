import { fmtDate, type Stats } from '../lib/stats'
import { num } from '../lib/format'

/** 요약 통계 벤토 그리드 */
export default function Kpis({ stats }: { stats: Stats }) {
  return (
    <div className="kpis">
      <div className="kpi kpi-accent">
        <div className="kpi-label">총 시청 항목</div>
        <div className="kpi-value">{num(stats.total)}<small>건</small></div>
        <div className="kpi-sub">에피소드 {num(stats.episodeCount)}편 · 영화 {num(stats.total - stats.episodeCount)}편</div>
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
        <div className="kpi-value kpi-value-text">{stats.topShow?.show ?? '—'}</div>
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
          {stats.longestStreak ? `${fmtDate(stats.longestStreak.from)} ~ ${fmtDate(stats.longestStreak.to)}` : '기록 없음'}
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-label">현재 연속 시청</div>
        <div className="kpi-value">{num(stats.currentStreak?.days ?? 0)}<small>일</small></div>
        <div className="kpi-sub">
          {stats.currentStreak ? `${fmtDate(stats.currentStreak.from)}부터 진행 중` : `마지막 시청 ${fmtDate(stats.last)}`}
        </div>
      </div>
    </div>
  )
}
