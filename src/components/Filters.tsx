import { fmtDateInput } from '../lib/stats'
import { num } from '../lib/format'
import Choice from './ui/Choice'

export type KindFilter = 'all' | 'series' | 'movie'
export type FilterState = { query: string; from: string; to: string; kind: KindFilter }
export const EMPTY_FILTER: FilterState = { query: '', from: '', to: '', kind: 'all' }
export const isFiltering = (f: FilterState) => f.query.trim() !== '' || f.from !== '' || f.to !== '' || f.kind !== 'all'

type Props = {
  value: FilterState
  onChange: (next: FilterState) => void
  bounds: { min: Date; max: Date } | null
  total: number
  shown: number
}

export default function Filters({ value, onChange, bounds, total, shown }: Props) {
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) => onChange({ ...value, [key]: v })
  const min = bounds ? fmtDateInput(bounds.min) : undefined
  const max = bounds ? fmtDateInput(bounds.max) : undefined

  return (
    <div className="card">
      <div className="filters">
        <div className="field field-search">
          <label htmlFor="q">작품·에피소드 검색</label>
          <input id="q" type="search" placeholder="예: 심야의 서울" value={value.query} onChange={(e) => set('query', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="from">시작일</label>
          <input id="from" type="date" value={value.from} min={min} max={value.to || max} onChange={(e) => set('from', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="to">종료일</label>
          <input id="to" type="date" value={value.to} min={value.from || min} max={max} onChange={(e) => set('to', e.target.value)} />
        </div>
        <Choice
          id="kind"
          label="종류"
          value={value.kind}
          options={[
            { value: 'all', label: '전체' },
            { value: 'series', label: '시리즈' },
            { value: 'movie', label: '영화' },
          ]}
          onChange={(v) => set('kind', v)}
        />
      </div>
      <div className="filters-foot">
        <span>
          전체 {num(total)}건 중 <strong>{num(shown)}건</strong> 표시 중
        </span>
        {isFiltering(value) && (
          <button type="button" className="btn" onClick={() => onChange(EMPTY_FILTER)}>
            필터 초기화
          </button>
        )}
      </div>
    </div>
  )
}
