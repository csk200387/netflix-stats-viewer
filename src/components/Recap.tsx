import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SHARE_CARD,
  buildRecap,
  recapFileName,
  recapYears,
  sharePngOptions,
  type Recap,
  type RecapShow,
} from '../lib/recap'
import { fmtDate, type Entry } from '../lib/stats'

const num = (n: number) => n.toLocaleString('ko-KR')
const unit = (s: RecapShow) => (s.kind === 'series' ? '화' : '회')
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

const CARDS = ['opening', 'favorites', 'habits', 'momentum', 'share'] as const
type CardId = (typeof CARDS)[number]

const CARD_TITLES: Record<CardId, string> = {
  opening: '한 해 요약',
  favorites: '최애 작품',
  habits: '시청 습관',
  momentum: '몰입도',
  share: '공유 카드',
}

/** 5번째 카드의 내용. 화면 미리보기와 내려받는 PNG 가 같은 마크업을 쓴다. */
function ShareCard({ recap }: { recap: Recap }) {
  const top = recap.topShows[0]
  return (
    <div className="recap-body recap-share">
      <p className="recap-eyebrow">{recap.year} 연말 결산</p>
      <p className="recap-share-headline">
        올해 <strong>{num(recap.total)}</strong>건을 봤어요
      </p>
      <dl className="recap-figures">
        <div>
          <dt>시청한 날</dt>
          <dd>{num(recap.activeDays)}일</dd>
        </div>
        <div>
          <dt>최장 연속</dt>
          <dd>{num(recap.longestStreak.days)}일</dd>
        </div>
        <div>
          <dt>하루 평균</dt>
          <dd>{recap.perActiveDay.toFixed(1)}편</dd>
        </div>
        <div>
          <dt>본 작품</dt>
          <dd>{num(recap.showCount)}개</dd>
        </div>
      </dl>
      <div className="recap-share-top">
        <span>가장 많이 본 작품</span>
        <strong>{top ? top.show : '기록 없음'}</strong>
        {top && (
          <em>
            {num(top.count)}
            {unit(top)}
          </em>
        )}
      </div>
      <p className="recap-foot">넷플릭스 시청 통계 뷰어 · 브라우저에서만 계산했어요</p>
    </div>
  )
}

function CardBody({ id, recap }: { id: CardId; recap: Recap }) {
  if (id === 'opening') {
    return (
      <div className="recap-body">
        <p className="recap-eyebrow">연말 결산</p>
        <p className="recap-year">{recap.year}</p>
        <p className="recap-line">
          이 해에 총 <strong>{num(recap.total)}</strong>건을 봤어요
        </p>
        <p className="recap-line recap-muted">
          {num(recap.daysInYear)}일 중 <strong>{num(recap.activeDays)}일</strong>을 넷플릭스와 함께했습니다
        </p>
      </div>
    )
  }

  if (id === 'favorites') {
    return (
      <div className="recap-body">
        <p className="recap-eyebrow">가장 많이 본 작품</p>
        <ol className="recap-rank">
          {recap.topShows.map((s, i) => (
            <li key={s.show}>
              <span className="recap-rank-no">{i + 1}</span>
              <span className="recap-rank-name">{s.show}</span>
              <span className="recap-rank-count">
                {num(s.count)}
                {unit(s)}
              </span>
            </li>
          ))}
        </ol>
        <p className="recap-line recap-muted">
          {recap.showCount < 3
            ? `이 해엔 ${num(recap.showCount)}개 작품이 기록됐어요`
            : `모두 ${num(recap.showCount)}개 작품을 봤어요`}
        </p>
      </div>
    )
  }

  if (id === 'habits') {
    return (
      <div className="recap-body">
        <p className="recap-eyebrow">시청 습관</p>
        <div className="recap-stack">
          <p className="recap-line">
            가장 뜨거웠던 달은 <strong>{recap.busiestMonth.month}월</strong>
            <span className="recap-muted"> · {num(recap.busiestMonth.count)}건</span>
          </p>
          <p className="recap-line">
            즐겨 본 요일은 <strong>{recap.favoriteWeekday.label}요일</strong>
            <span className="recap-muted"> · {num(recap.favoriteWeekday.count)}건</span>
          </p>
          <p className="recap-line">
            하루 최다 <strong>{num(recap.busiestDay.count)}편</strong>
            <span className="recap-muted"> · {fmtDate(recap.busiestDay.date)}</span>
          </p>
        </div>
      </div>
    )
  }

  if (id === 'momentum') {
    const share = pct(recap.seriesViews, recap.total)
    return (
      <div className="recap-body">
        <p className="recap-eyebrow">몰입도</p>
        <p className="recap-big">
          {num(recap.longestStreak.days)}
          <small>일 연속</small>
        </p>
        <p className="recap-line recap-muted">
          {fmtDate(recap.longestStreak.from)} ~ {fmtDate(recap.longestStreak.to)}
        </p>
        <div
          className="recap-split"
          role="img"
          aria-label={`시리즈 ${num(recap.seriesViews)}건, 영화 ${num(recap.movieViews)}건`}
        >
          <span className="recap-split-a" style={{ flexGrow: recap.seriesViews }} />
          <span className="recap-split-b" style={{ flexGrow: recap.movieViews }} />
        </div>
        <p className="recap-line recap-split-legend">
          <span>
            시리즈 {num(recap.seriesViews)}건 · {share}%
          </span>
          <span>
            영화 {num(recap.movieViews)}건 · {100 - share}%
          </span>
        </p>
        <p className="recap-line recap-muted">
          시청한 날 평균 <strong>{recap.perActiveDay.toFixed(1)}편</strong>
        </p>
      </div>
    )
  }

  return <ShareCard recap={recap} />
}

export default function RecapModal({ entries, onClose }: { entries: Entry[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const years = useMemo(() => recapYears(entries), [entries])
  const [year, setYear] = useState(() => years[0])
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const recap = useMemo(() => buildRecap(entries, year), [entries, year])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    viewerRef.current?.focus()
    // close() 로 닫아야 브라우저가 포커스를 원래 자리로 돌려준다
    return () => dialog.close()
  }, [])

  const go = useCallback((step: number) => setIndex((i) => Math.min(CARDS.length - 1, Math.max(0, i + step))), [])

  const download = useCallback(async () => {
    const node = exportRef.current
    if (!node || !recap || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(node, sharePngOptions())
      if (!blob) throw new Error('빈 이미지')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = recapFileName(recap.year)
      a.click()
      // 사파리는 클릭 직후 회수하면 저장이 끊기는 일이 있어 한 박자 늦춘다
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setSaveError('이미지를 만들지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }, [recap, saving])

  if (!recap) return null

  const title = CARD_TITLES[CARDS[index]]

  return (
    <dialog
      ref={dialogRef}
      className="recap-dialog"
      aria-label={`${recap.year}년 연말 결산`}
      onCancel={onClose}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).tagName === 'SELECT') return
        if (e.key === 'ArrowRight') go(1)
        else if (e.key === 'ArrowLeft') go(-1)
      }}
    >
      <div className="recap-shell">
        <div className="recap-progress" aria-hidden="true">
          {CARDS.map((id, i) => (
            <span key={id} className="recap-seg" data-on={i <= index} />
          ))}
        </div>

        <div className="recap-bar">
          <label className="visually-hidden" htmlFor="recap-year">
            결산 연도
          </label>
          <select
            id="recap-year"
            value={recap.year}
            onChange={(e) => {
              setYear(Number(e.target.value))
              setIndex(0)
              setSaveError(null)
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <p className="recap-count" aria-live="polite">
            <span aria-hidden="true">
              {index + 1} / {CARDS.length}
            </span>
            <span className="visually-hidden">
              {CARDS.length}장 중 {index + 1}번째 카드 · {title}
            </span>
          </p>
          <button type="button" className="recap-close" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span className="visually-hidden">연말 결산 닫기</span>
          </button>
        </div>

        <div
          className="recap-viewer"
          ref={viewerRef}
          tabIndex={-1}
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            const start = touchX.current
            const end = e.changedTouches[0]?.clientX
            touchX.current = null
            if (start == null || end == null || Math.abs(end - start) < 40) return
            go(end < start ? 1 : -1)
          }}
        >
          <div className="recap-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {CARDS.map((id, i) => (
              <article
                key={id}
                className="recap-card"
                data-card={id}
                aria-label={`${i + 1}. ${CARD_TITLES[id]}`}
                aria-hidden={i !== index}
                inert={i !== index}
              >
                <CardBody id={id} recap={recap} />
                {id === 'share' && (
                  <div className="recap-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={download}
                      disabled={saving}
                      aria-busy={saving}
                    >
                      {saving ? '이미지 만드는 중…' : '1080×1920 이미지 저장'}
                    </button>
                    <p className="recap-warn">
                      이미지에 시청 취향이 담깁니다. 공유 전에 내용을 한 번 확인해 주세요.
                    </p>
                    {saveError && (
                      <p className="recap-error" role="alert">
                        {saveError}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

          <button
            type="button"
            className="recap-zone recap-zone-prev"
            onClick={() => go(-1)}
            disabled={index === 0}
          >
            <span aria-hidden="true">‹</span>
            <span className="visually-hidden">이전 카드</span>
          </button>
          <button
            type="button"
            className="recap-zone recap-zone-next"
            onClick={() => go(1)}
            disabled={index === CARDS.length - 1}
          >
            <span aria-hidden="true">›</span>
            <span className="visually-hidden">다음 카드</span>
          </button>
        </div>

        <p className="recap-note">
          화면 위쪽 검색·기간·종류 필터와 상관없이, 불러온 전체 기록 중 {recap.year}년만 계산한 결과입니다.
        </p>
      </div>

      {/* 내려받기 전용 사본 — 화면 밖에서 정확히 360×640 으로 그려 3배로 뜬다 */}
      <div className="recap-export" aria-hidden="true">
        <div
          ref={exportRef}
          className="recap-card"
          data-card="share"
          style={{ width: SHARE_CARD.width, height: SHARE_CARD.height }}
        >
          <ShareCard recap={recap} />
        </div>
      </div>
    </dialog>
  )
}
