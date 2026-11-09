import { fmtDate } from '../../lib/stats'
import { num, percent, won } from '../../lib/format'
import {
  parseDate, type CategoryId, type ValueBasis as Basis, type ValueReport, type ValueSettings, type ValueSummary,
} from '../../lib/value'

type TagKind = 'record' | 'setting' | 'assumption' | 'estimate'
const TAG_TEXT: Record<TagKind, string> = { record: '기록', setting: '설정', assumption: '가정', estimate: '추정' }
const Tag = ({ kind }: { kind: TagKind }) => <span className="basis-tag" data-kind={kind}>{TAG_TEXT[kind]}</span>

/** ‘회차형 · 유형 미지정’ 대신 들어갈 수 있는 회차형 유형 */
const SERIES_TYPES: CategoryId[] = ['drama', 'variety', 'foreign', 'anime', 'kids', 'docSeries']

/**
 * 결론이 뒤집히는 단가 배수를 문장으로 만든다.
 * 잘라낸 숫자로도 문장이 참이도록 ‘같아요’ 쪽은 내리고 ‘바뀌어요’ 쪽은 올린다.
 */
export function rateFlipText(flip: number, earned: boolean): string {
  if (earned) {
    if (flip <= 0) return '유형별 단가가 0원이어도 결론은 같아요.'
    const drop = Math.floor((1 - flip) * 100 + 1e-9)
    return drop < 1
      ? '유형별 단가가 1%만 낮아져도 ‘손해’로 바뀌어요.'
      : `유형별 단가가 모두 ${drop}% 낮아져도 결론은 같고, 그보다 더 낮으면 ‘손해’로 바뀌어요.`
  }
  if (flip >= 2) return `유형별 단가가 모두 지금의 ${Math.ceil(flip * 10 - 1e-9) / 10}배는 돼야 ‘뽑았어요’로 바뀌어요.`
  return `유형별 단가가 모두 ${Math.max(1, Math.ceil((flip - 1) * 100 - 1e-9))}% 높아지면 ‘뽑았어요’로 바뀌어요.`
}

const flipNote = (scenario: boolean, now: boolean) =>
  scenario === now ? '결론은 같아요' : scenario ? '결론이 ‘뽑았어요’로 바뀌어요' : '결론이 ‘손해’로 바뀌어요'
const pct = (ratio: number | null) => (ratio === null ? '—' : percent(ratio))
/** 날짜가 ‘2025. 1.’ / ‘1.’처럼 줄 중간에서 끊기지 않게 공백을 줄바꿈 없는 공백으로 */
const day = (key: string) => fmtDate(parseDate(key)).replaceAll(' ', ' ')

type Props = {
  report: ValueReport
  summary: ValueSummary
  basis: Basis
  settings: ValueSettings
  /** TMDB 장르 조회가 아직 끝나지 않았는지 */
  lookupPending: boolean
  onExcludeCycles: (keys: string[]) => void
  onIncludeAll: () => void
}

/** 전체 답이 어떤 기록·설정·가정으로 계산됐고, 어느 가정이 바뀌면 답이 뒤집히는지 */
export default function ValueBasis({ report, summary, basis, settings, lookupPending, onExcludeCycles, onIncludeAll }: Props) {
  const earned = summary.verdict === 'earned'
  const loaded = report.countedCount + report.excludedCount + report.duplicateCount + report.outsideCount
  const skipped = [
    report.outsideCount > 0 && `분석 기간·구독 제외 주기 밖 ${num(report.outsideCount)}건`,
    report.excludedCount > 0 && `계산 제외로 둔 작품 ${num(report.excludedCount)}건`,
    report.duplicateCount > 0 && `같은 날 같은 제목 중복 ${num(report.duplicateCount)}건`,
  ].filter(Boolean)
  const { user, tmdb, default: fallback } = basis.sources
  const excludedCycles = report.cycles.filter((c) => !c.included).length
  const people = settings.otherPeople + 1
  const costDetail = settings.costMode === 'personal'
    ? '직접 입력'
    : people > 1 || settings.extraFee > 0
      ? `${won(settings.monthlyPrice)}${settings.extraFee > 0 ? ` + 추가 ${won(settings.extraFee)}` : ''} ÷ ${num(people)}명`
      : ''

  const decided = [user.count > 0 && `직접 지정 ${num(user.count)}건`, tmdb.count > 0 && `TMDB 검색 ${num(tmdb.count)}건`].filter(Boolean).join(' · ')
  const tmdbCaveat = tmdb.count > 0 ? ' TMDB로 정한 유형도 검색 첫 결과라 이름이 비슷한 다른 작품과 섞였을 수 있어요.' : ''
  const seriesTop = basis.fallbackSeries > 0 && SERIES_TYPES.every((id) => settings.rates.series >= settings.rates[id])
  let genre: string
  if (lookupPending) {
    genre = 'TMDB에서 장르를 확인하는 중이에요. 끝나면 아래 숫자가 달라질 수 있어요.'
  } else if (!basis.withoutDefault) {
    genre = (decided ? `계산한 기록의 유형을 모두 정했어요(${decided}).` : '계산한 기록이 없어요.') + tmdbCaveat
  } else {
    const share = report.gross > 0 ? `환산액의 ${percent(fallback.gross / report.gross)}(${num(fallback.count)}건 · ${won(fallback.gross)})` : `${num(fallback.count)}건`
    const lostCycles = summary.reachedCycles - basis.withoutDefault.reachedCycles
    genre = `${share}는 장르를 확인하지 못해 기본 단가(회차형 ${won(settings.rates.series)} · 영화 ${won(settings.rates.movie)})로 셌어요.`
      + (seriesTop ? ' 회차형 기본값은 회차형 유형 단가 중 가장 높아서, 애니·해외 드라마처럼 단가가 낮은 작품이 섞였다면 환산액이 크게 잡혀요.' : '')
      + ` 장르를 확인한 기록만 세면 내 부담 대비 ${pct(basis.withoutDefault.ratio)}로, ${flipNote(basis.withoutDefault.earned, earned)}.`
      + (lostCycles > 0 ? ` 본전을 채운 결제 주기는 ${num(summary.reachedCycles)}개에서 ${num(basis.withoutDefault.reachedCycles)}개로 줄어요.` : '')
      + tmdbCaveat
  }

  return (
    <div className="card value-block" id="value-basis">
      <header className="value-block-head">
        <span className="value-step">BASIS</span>
        <h3>이 답은 무엇에 기대고 있을까?</h3>
        <p className="basis-legend">
          <span><Tag kind="record" />CSV에 적힌 사실</span>
          <span><Tag kind="setting" />직접 고른 값</span>
          <span><Tag kind="assumption" />바꿀 수 있는 기본값</span>
          <span><Tag kind="estimate" />기록에 가정을 곱한 값</span>
        </p>
      </header>

      <dl className="basis-receipt">
        <div>
          <dt><Tag kind="record" />계산한 시청 기록</dt>
          <dd>{num(report.countedCount)}건</dd>
          <small>불러온 {num(loaded)}건{skipped.length > 0 ? ` 중 ${skipped.join(' · ')} 제외` : ' 전부'}</small>
        </div>
        <div>
          <dt><Tag kind="estimate" />비슷한 작품 대여료로 환산</dt>
          <dd>{won(report.net)}</dd>
          <small>{report.adCost > 0 ? `단가 합 ${won(report.gross)} − 광고 시간 ${won(report.adCost)}` : '기록마다 유형별 단가를 곱해 더한 값'}</small>
        </div>
        <div>
          <dt><Tag kind="setting" />내 부담</dt>
          <dd>{won(report.totalCost)}</dd>
          <small>월 {won(report.costPerCycle)}{costDetail && `(${costDetail})`} × {num(summary.chargedCycles)}개 결제 주기</small>
        </div>
      </dl>
      <p className="basis-result">
        {summary.ratio === null
          ? '내 부담이 0원이라 비교할 금액이 없어요.'
          : `환산액은 내 부담의 ${percent(summary.ratio)}예요. 실제로 아낀 돈이 아니라, 같은 기록을 비슷한 작품의 대여료로 셌을 때와 비교한 값이에요.`}
      </p>

      {summary.ratio !== null && (
        <div className="value-sub">
          <h4>이 답이 바뀌는 조건</h4>
          <ul className="basis-list">
            <li>
              <Tag kind="assumption" /><b>콘텐츠 단가</b>
              {basis.rateFlip === null ? '유형별 단가로 센 기록이 없어 단가 가정과 무관해요.' : rateFlipText(basis.rateFlip, earned)}
              {' '}유형별 단가는 다른 서비스의 대여·바로보기 사례에서 고른 값이에요. 사례가 유형마다 1~2개뿐이고 같은 유형 안에서도 가격이 달랐어요(예: 영화 1,500원·2,500원).
              <a className="basis-action" href="#value-content">유형별 단가 보기</a>
            </li>
            <li>
              <Tag kind="estimate" /><b>장르</b>
              {genre}
              {basis.withoutDefault && !lookupPending && <a className="basis-action" href="#value-content">작품별 유형 확인</a>}
            </li>
            {basis.idle.keys.length > 0 && (
              <li>
                <Tag kind="assumption" /><b>구독한 달</b>
                시청 기록이 한 건도 없는 {num(basis.idle.keys.length)}개 주기({won(basis.idle.cost)})도 구독한 것으로 셌어요.
                {basis.idle.ratio === null
                  ? ' 기록이 있는 주기가 하나도 없어요.'
                  : ` 그때 구독하지 않았다면 내 부담 대비 ${percent(basis.idle.ratio)}로, ${flipNote(basis.idle.earned, earned)}.`}
                <button type="button" className="btn basis-action-btn" onClick={() => onExcludeCycles(basis.idle.keys)}>
                  이 {num(basis.idle.keys.length)}개 주기 빼고 보기
                </button>
              </li>
            )}
            {excludedCycles > 0 && (
              <li>
                <Tag kind="setting" /><b>구독 제외</b>
                구독하지 않았다고 표시한 {num(excludedCycles)}개 주기는 부담액과 시청 기록을 모두 뺐어요.
                <button type="button" className="btn basis-action-btn" onClick={onIncludeAll}>모두 다시 포함</button>
              </li>
            )}
            <li>
              <Tag kind="assumption" /><b>요금</b>
              내 부담 월 {won(report.costPerCycle)}을 분석 기간 {day(settings.from)} ~ {day(settings.to)}의{' '}
              {num(summary.chargedCycles)}개 결제 주기에 똑같이 적용했어요. 그동안 요금이나 분담 인원이 달랐다면 결과도 달라져요.
              {basis.partialCycles > 0 && ` 일부 날짜만 분석 기간에 든 ${num(basis.partialCycles)}개 주기도 부담액은 전액이에요.`}
              <a className="basis-action" href="#value-settings">요금·기간 바꾸기</a>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
