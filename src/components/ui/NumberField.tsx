type Props = {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}

export default function NumberField({ id, label, value, onChange, min = 0, max, step = 1, suffix }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={suffix ? 'input-suffix' : undefined}>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </div>
    </div>
  )
}
