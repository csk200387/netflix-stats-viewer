import { useState } from 'react'
import { fmtDate } from '../../lib/stats'
import { won } from '../../lib/format'
import { PLANS, dateKey, parseDate, type PlanId, type ValueSettings } from '../../lib/value'
import Choice from '../ui/Choice'
import NumberField from '../ui/NumberField'

type Update = <K extends keyof ValueSettings>(key: K, value: ValueSettings[K]) => void

type QuickProps = {
  settings: ValueSettings
  plan: PlanId | null
  onPlan: (plan: PlanId) => void
  update: Update
  costPerCycle: number | null
}
type Props = { settings: ValueSettings; adsPossible: boolean; update: Update }

const SHARE_PRESETS = ['0', '1', '2', '3', '4'] as const
const SHARE_MORE = 'more'

/** 함께 분담하는 인원(본인 제외). 0~4명은 버튼, 그 이상은 직접 입력 */
function ShareField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [more, setMore] = useState(value > 4)
  const selected = more || value > 4 ? SHARE_MORE : String(value)
  return (
    <div className="share-field">
      <Choice
        id="value-people"
        label="② 몇 명이 나눠 내세요? (본인 제외)"
        value={selected}
        options={[...SHARE_PRESETS.map((n) => ({ value: n, label: `${n}명` })), { value: SHARE_MORE, label: '5명+' }]}
        onChange={(next) => {
          if (next === SHARE_MORE) {
            setMore(true)
            if (value < 5) onChange(5)
          } else {
            setMore(false)
            onChange(Number(next))
          }
        }}
      />
      {selected === SHARE_MORE && (
        <NumberField id="value-people-count" label="분담 인원 직접 입력 (본인 제외)" value={value} min={5} max={99} suffix="명" onChange={onChange} />
      )}
    </div>
  )
}

/** 맨 먼저 묻는 두 가지: 요금제와 분담 인원. 고르면 바로 아래 결과가 계산된다 */
export function QuickCost({ settings, plan, onPlan, update, costPerCycle }: QuickProps) {
  const people = settings.otherPeople + 1
  return (
    <div className="value-quick">
      <Choice
        id="value-plan"
        label="① 어떤 요금제를 쓰세요?"
        value={plan}
        options={PLANS.map((p) => ({ value: p.id, label: p.label, hint: p.id === 'custom' ? '할인·제휴·과거 요금' : `월 ${won(p.price)}` }))}
        onChange={onPlan}
      />
      {plan === 'custom' && (
        <NumberField id="value-price" label="실제 월 결제액" suffix="원" value={settings.monthlyPrice} onChange={(v) => update('monthlyPrice', v)} />
      )}
      <ShareField value={settings.otherPeople} onChange={(v) => update('otherPeople', v)} />
      {plan && (
        <div className="value-cost-line" aria-live="polite">
          <span>내 부담</span>
          <strong>{costPerCycle === null ? '설정 확인' : `월 ${won(costPerCycle)}`}</strong>
          <small>
            {settings.costMode === 'personal'
              ? '직접 입력한 내 부담액'
              : people === 1 && !settings.extraFee
                ? '혼자 내는 요금'
                : `(${won(settings.monthlyPrice)}${settings.extraFee ? ` + 추가 ${won(settings.extraFee)}` : ''}) ÷ ${people}명`}
          </small>
        </div>
      )}
    </div>
  )
}

export default function CostSettings({ settings, adsPossible, update }: Props) {
  const people = settings.otherPeople + 1
  const periodSummary = (() => {
    try {
      return `${fmtDate(parseDate(settings.from))} ~ ${fmtDate(parseDate(settings.to))}`
    } catch {
      return '기간 확인 필요'
    }
  })()

  return (
    <div className="card value-block">
      <header className="value-block-head">
        <span className="value-step">ADJUST 1</span>
        <h3>요금을 나누는 방식이 다르다면</h3>
        <p>현재 요금을 선택 기간 전체에 동일하게 적용</p>
      </header>

      <Choice
        id="value-cost-mode"
        label="내 부담액 계산"
        value={settings.costMode}
        options={[
          { value: 'split', label: `${people}명이 똑같이 나눔` },
          { value: 'personal', label: '내 부담액 직접 입력' },
        ]}
        onChange={(v) => update('costMode', v)}
      />
      {settings.costMode === 'personal' && (
        <NumberField id="value-personal" label="내가 내는 금액 (결제 주기당)" suffix="원" value={settings.personalPrice} onChange={(v) => update('personalPrice', v)} />
      )}
      <p className="value-help">
        이 CSV 프로필 한 사람의 시청량을 개인 부담액과 비교합니다. 분담 인원은 비용을 나누는 사람 수이며 동시 시청 인원과 다릅니다.
      </p>

      <details className="value-details">
        <summary>
          결제일·분석 기간·추가 비용
          <span>매월 {settings.billingDay}일 · {periodSummary} · 추가 {won(settings.extraFee)}</span>
        </summary>
        <div className="value-fields">
          <NumberField id="value-billing" label="매월 결제일" suffix="일" value={settings.billingDay} min={1} max={31} onChange={(v) => update('billingDay', v)} />
          <div className="field">
            <label htmlFor="value-from">분석 시작일</label>
            <input id="value-from" type="date" value={settings.from} max={settings.to} onChange={(e) => update('from', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="value-to">분석 종료일</label>
            <input id="value-to" type="date" value={settings.to} min={settings.from} max={dateKey(new Date())} onChange={(e) => update('to', e.target.value)} />
          </div>
          <NumberField id="value-extra" label="추가회원 등 별도 비용" suffix="원" value={settings.extraFee} onChange={(v) => update('extraFee', v)} />
        </div>
        <p className="value-help">
          선택 기간에 걸친 결제 주기마다 한 달 요금을 전액 반영하며, 기록이 없는 달도 포함합니다. 29~31일 결제는 해당 일이 없는 달의
          말일로 계산합니다. 구독하지 않은 주기는 위 RESULT 2의 ‘결제 주기별 내역’에서 제외할 수 있습니다. 추가 비용이 이미 월 결제액에
          포함됐다면 0원으로 두세요.
        </p>
        <p className="value-help">
          요금제 기본값은 2026-10-15 조사한{' '}
          <a href="https://qr.netflix.com/kr/browse/genre/67879" target="_blank" rel="noreferrer">넷플릭스 한국 공개 요금</a>입니다.
          과거 요금이나 실제 청구액이 다르면 직접 수정해 주세요.
        </p>
      </details>

      <details className="value-details">
        <summary>
          광고 시청시간도 비용에 반영하기
          <span>{settings.adsEnabled ? `켜짐 · 한 편당 ${settings.adCount}개 × ${settings.adSeconds}초` : '꺼짐'}</span>
        </summary>
        <label className="value-check">
          <input type="checkbox" checked={settings.adsEnabled} disabled={!adsPossible} onChange={(e) => update('adsEnabled', e.target.checked)} />
          광고 시간을 내 시간 가치로 환산해 차감
        </label>
        {!adsPossible && <p className="value-help">광고형 또는 직접 입력 요금제에서 설정할 수 있습니다.</p>}
        {settings.adsEnabled && (
          <>
            <div className="value-fields">
              <NumberField id="value-ad-count" label="한 편당 광고 영상 수 (가정)" suffix="개" value={settings.adCount} onChange={(v) => update('adCount', v)} />
              <NumberField id="value-ad-seconds" label="광고 영상 하나의 길이" suffix="초" value={settings.adSeconds} onChange={(v) => update('adSeconds', v)} />
              <NumberField id="value-time-price" label="내 광고 시청시간의 가치" suffix="원/시간" value={settings.hourlyValue} onChange={(v) => update('hourlyValue', v)} />
              <NumberField id="value-free-entries" label="분석 기간 초반 무광고 시청" suffix="건" value={settings.adFreeEntries} onChange={(v) => update('adFreeEntries', v)} />
            </div>
            <label className="value-check">
              <input type="checkbox" checked={settings.kidsProfile} onChange={(e) => update('kidsProfile', e.target.checked)} />
              키즈 프로필 기록이에요 (광고 시간 0분)
            </label>
          </>
        )}
        <p className="value-help">
          CSV에는 실제 광고 정보가 없습니다. 초반 무광고 건수는 계산에 포함된 시청 기록을 날짜순으로 세며 매달 초기화하지 않습니다.
          작품별 광고 수는 ADJUST 2에서 따로 수정할 수 있습니다. 광고주의 CPM은 내 절약액에 더하지 않습니다.
        </p>
      </details>
    </div>
  )
}
