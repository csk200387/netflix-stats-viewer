import { useState } from 'react'
import { num, won } from '../../lib/format'
import { DEFAULT_RATES, PLANS, categoryLabel, planPrice, watchesForPrice, type CategoryId, type PlanId } from '../../lib/value'
import Choice from '../ui/Choice'

type TeaserPlan = Exclude<PlanId, 'custom'>
const TEASER_PLANS = PLANS.filter((p): p is Extract<typeof PLANS[number], { id: TeaserPlan }> => p.id !== 'custom')
const TEASER_ITEMS: { id: CategoryId; unit: string }[] = [
  { id: 'drama', unit: '화' },
  { id: 'movie', unit: '편' },
  { id: 'foreign', unit: '화' },
  { id: 'anime', unit: '화' },
]
const PARTY = ['1', '2', '3', '4'] as const

/** 랜딩 화면의 미끼: 요금제·분담 인원만 고르면 한 달에 몇 편을 봐야 본전인지 바로 보여준다 */
export default function BreakEvenTeaser() {
  const [plan, setPlan] = useState<TeaserPlan>('standard')
  const [party, setParty] = useState<typeof PARTY[number]>('1')
  const price = planPrice(plan) / Number(party)

  return (
    <section className="teaser" aria-labelledby="teaser-title">
      <div className="teaser-head">
        <h2 id="teaser-title">
          한 달 <em>{won(price)}</em>,<br />이만큼은 봐야 본전이에요
        </h2>
      </div>
      <div className="teaser-controls">
        <Choice
          id="teaser-plan"
          label="요금제"
          value={plan}
          options={TEASER_PLANS.map((p) => ({ value: p.id, label: p.label, hint: won(p.price) }))}
          onChange={setPlan}
        />
        <Choice
          id="teaser-party"
          label="몇 명이서 나눠 내나요?"
          value={party}
          options={PARTY.map((n) => ({ value: n, label: n === '1' ? '혼자' : `${n}명` }))}
          onChange={setParty}
        />
      </div>
      <ul className="teaser-grid">
        {TEASER_ITEMS.map(({ id, unit }) => {
          const count = watchesForPrice(price, DEFAULT_RATES[id])
          return (
            <li key={id}>
              <span>{categoryLabel(id)}</span>
              <strong>{count === null ? '—' : num(count)}<small>{unit}</small></strong>
              <small>{won(DEFAULT_RATES[id])}/{unit} 기준</small>
            </li>
          )
        })}
      </ul>
      <div className="teaser-foot">
        <p>유사 작품의 대여·바로보기 가격으로 환산한 추정치입니다. 실제로 본전을 뽑았는지는 내 시청 기록으로 확인해 보세요.</p>
        <a className="btn btn-primary btn-lg" href="#upload">내 기록으로 확인하기 <span aria-hidden="true">↓</span></a>
      </div>
    </section>
  )
}
