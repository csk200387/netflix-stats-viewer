export type ChoiceOption<T extends string> = {
  value: T
  label: string
  /** 버튼 아래 작은 글씨 (드롭다운에서는 ` · ` 뒤에 붙는다) */
  hint?: string
  disabled?: boolean
}

/** 선택지가 이 개수 이하이면 버튼으로 보여준다 */
export const MAX_CHOICE_BUTTONS = 6

type Props<T extends string> = {
  id: string
  label: string
  /** null이면 아직 아무것도 고르지 않은 상태 (버튼 묶음 전용) */
  value: T | null
  options: readonly ChoiceOption<T>[]
  onChange: (value: T) => void
  maxButtons?: number
  hideLabel?: boolean
  className?: string
}

/**
 * 선택지가 적으면 한 번에 누를 수 있는 버튼 묶음으로, 많으면 드롭다운으로 보여준다.
 * 버튼 묶음은 aria-pressed 토글 버튼 그룹으로 접근성을 유지한다.
 */
export default function Choice<T extends string>({
  id, label, value, options, onChange, maxButtons = MAX_CHOICE_BUTTONS, hideLabel = false, className = '',
}: Props<T>) {
  const labelClass = hideLabel ? 'visually-hidden' : ''

  if (options.length > maxButtons) {
    return (
      <div className={`field ${className}`}>
        <label htmlFor={id} className={labelClass}>{label}</label>
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.hint ? `${o.label} · ${o.hint}` : o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={`field ${className}`}>
      <span id={`${id}-label`} className={`field-label ${labelClass}`}>{label}</span>
      <div className="choice" role="group" aria-labelledby={`${id}-label`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
          >
            <span>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}
