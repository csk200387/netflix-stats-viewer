import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RECAP_EXPORTS, SHARE_CARD, buildRecap, recapFileName, recapYears, sharePngOptions, type Recap, type RecapShow } from '../lib/recap'
import { levelOf, fmtDate, type Entry } from '../lib/stats'

const num = (n: number) => n.toLocaleString('ko-KR')
const unit = (s: RecapShow) => (s.kind === 'series' ? '화' : '회')
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))
const CARDS = ['opening', 'favorites', 'habits', 'streak', 'summary'] as const
type CardId = (typeof CARDS)[number]
const CARD_TITLES: Record<CardId, string> = { opening: '한 해 요약', favorites: '가장 많이 본 작품', habits: '나의 시청 습관', streak: '가장 길었던 스트릭', summary: '종합 공유 카드' }

function Split({ recap }: { recap: Recap }) {
  const seriesShare = pct(recap.seriesViews, recap.total)
  return <>
    <div className="recap-split" role="img" aria-label={`시리즈 ${num(recap.seriesViews)}건, 영화 ${num(recap.movieViews)}건`}>
      <span className="recap-split-a" style={{ flexGrow: recap.seriesViews }} />
      <span className="recap-split-b" style={{ flexGrow: recap.movieViews }} />
    </div>
    <p className="recap-line recap-split-legend"><span>시리즈 {num(recap.seriesViews)}건 · {seriesShare}%</span><span>영화 {num(recap.movieViews)}건 · {100 - seriesShare}%</span></p>
  </>
}

function StreakCalendar({ recap }: { recap: Recap }) {
  const first = recap.streakWindow[0]?.date
  const last = recap.streakWindow.at(-1)?.date
  return <div className="recap-streak-block">
    <p className="recap-line recap-muted">{first && last ? `${fmtDate(first)} ~ ${fmtDate(last)}` : ''}</p>
    <div className="recap-streak-grid" role="img" aria-label={`최장 스트릭 주변 35일, ${recap.longestStreak.days}일 연속 시청`}>
      {recap.streakWindow.map((day) => <div className="recap-streak-cell-wrap" key={`${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`}>
        <span className="recap-month-marker">{day.monthMarker ?? ''}</span>
        <span className="recap-streak-cell" data-level={levelOf(day.count)} data-streak={day.inStreak || undefined} aria-hidden="true">{day.date.getDate()}</span>
      </div>)}
    </div>
    {recap.longestStreak.days > 35 && <p className="recap-window-note">대표 35일 구간을 표시했습니다</p>}
  </div>
}

function CardBody({ id, recap }: { id: CardId; recap: Recap }) {
  if (id === 'opening') return <div className="recap-body">
    <p className="recap-eyebrow">한 해 돌아보기</p><p className="recap-year">{recap.year}</p>
    <p className="recap-share-headline">총 <strong>{num(recap.total)}</strong>건을 봤어요</p>
    <dl className="recap-figures recap-figures-compact">
      <div><dt>시청한 날</dt><dd>{num(recap.activeDays)}일</dd></div><div><dt>본 작품</dt><dd>{num(recap.showCount)}개</dd></div>
      <div><dt>첫 시청일</dt><dd>{fmtDate(recap.first)}</dd></div><div><dt>마지막 시청일</dt><dd>{fmtDate(recap.last)}</dd></div>
    </dl><p className="recap-line recap-muted">시청한 날 기준 하루 평균 <strong>{recap.perActiveDay.toFixed(1)}편</strong></p>
  </div>
  if (id === 'favorites') return <div className="recap-body">
    <p className="recap-eyebrow">가장 많이 본 작품</p><ol className="recap-rank">{recap.topShows.map((show, index) => <li key={show.show}>
      <span className="recap-rank-no">{index + 1}</span><span className="recap-rank-name">{show.show}<small>{show.kind === 'series' ? '시리즈' : '영화'}</small></span><span className="recap-rank-count">{num(show.count)}{unit(show)}</span>
    </li>)}</ol><p className="recap-line recap-muted">1위가 전체 기록의 <strong>{recap.topShare}%</strong></p><p className="recap-line recap-muted">가장 최근 작품 · <strong>{recap.mostRecentShow.show}</strong></p>
  </div>
  if (id === 'habits') return <div className="recap-body"><p className="recap-eyebrow">나의 시청 습관</p><div className="recap-stack">
    <p className="recap-line">가장 뜨거웠던 달 <strong>{recap.busiestMonth.month}월</strong><span className="recap-muted"> · {num(recap.busiestMonth.count)}건</span></p>
    <p className="recap-line">즐겨 본 요일 <strong>{recap.favoriteWeekday.label}요일</strong><span className="recap-muted"> · {num(recap.favoriteWeekday.count)}건</span></p>
    <p className="recap-line">하루 최다 <strong>{num(recap.busiestDay.count)}편</strong><span className="recap-muted"> · {fmtDate(recap.busiestDay.date)}</span></p>
    <p className="recap-line">3편 이상 몰아본 날 <strong>{num(recap.bingeDays)}일</strong></p><p className="recap-line">월평균 <strong>{recap.monthlyAverage.toFixed(1)}건</strong></p>
  </div></div>
  if (id === 'streak') return <div className="recap-body recap-streak-body"><p className="recap-eyebrow">가장 길었던 스트릭</p>
    <p className="recap-big">{num(recap.longestStreak.days)}<small>일 연속</small></p><p className="recap-line recap-muted">{fmtDate(recap.longestStreak.from)} ~ {fmtDate(recap.longestStreak.to)}</p><StreakCalendar recap={recap} />
  </div>
  const top = recap.topShows[0]
  return <div className="recap-body recap-share"><p className="recap-eyebrow">{recap.year} · 한 해 돌아보기</p><p className="recap-share-headline">올해 <strong>{num(recap.total)}</strong>건을 봤어요</p>
    <dl className="recap-figures"><div><dt>시청한 날</dt><dd>{num(recap.activeDays)}일</dd></div><div><dt>본 작품</dt><dd>{num(recap.showCount)}개</dd></div><div><dt>최장 스트릭</dt><dd>{num(recap.longestStreak.days)}일</dd></div><div><dt>하루 평균</dt><dd>{recap.perActiveDay.toFixed(1)}편</dd></div></dl>
    <div className="recap-share-top"><span>가장 많이 본 작품</span><strong>{top?.show ?? '기록 없음'}</strong>{top && <em>{num(top.count)}{unit(top)}</em>}</div><Split recap={recap} /><p className="recap-foot">{recap.year} · 한 해 돌아보기</p>
  </div>
}

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function RecapModal({ entries, onClose }: { entries: Entry[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null), viewerRef = useRef<HTMLDivElement>(null), exportRefs = useRef<(HTMLDivElement | null)[]>([]), touchX = useRef<number | null>(null)
  const years = useMemo(() => recapYears(entries), [entries]); const [year, setYear] = useState(() => years[0]); const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false), [saveProgress, setSaveProgress] = useState<string | null>(null), [saveError, setSaveError] = useState<string | null>(null)
  const recap = useMemo(() => buildRecap(entries, year), [entries, year])
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (!dialog.open) dialog.showModal(); viewerRef.current?.focus(); return () => dialog.close() }, [])
  const go = useCallback((step: number) => setIndex((value) => Math.min(CARDS.length - 1, Math.max(0, value + step))), [])
  const downloadCards = useCallback(async (indexes: number[]) => {
    if (!recap || saving) return; setSaving(true); setSaveError(null)
    try { const { toBlob } = await import('html-to-image')
      for (let position = 0; position < indexes.length; position++) { const cardIndex = indexes[position], node = exportRefs.current[cardIndex]; if (!node) throw new Error('내보내기 카드 없음')
        setSaveProgress(indexes.length > 1 ? `${position + 1}/${indexes.length} 저장 중…` : '이미지 만드는 중…')
        const blob = await toBlob(node, sharePngOptions()); if (!blob) throw new Error('빈 이미지'); saveBlob(blob, recapFileName(recap.year, cardIndex)); if (indexes.length > 1) await new Promise((resolve) => setTimeout(resolve, 350)) }
      setSaveProgress(indexes.length > 1 ? '5개 이미지 저장 완료' : '이미지 저장 완료')
    } catch { setSaveError('이미지를 만들지 못했습니다. 다시 시도해 주세요.'); setSaveProgress(null) } finally { setSaving(false) }
  }, [recap, saving])
  if (!recap) return null
  const title = CARD_TITLES[CARDS[index]]
  return <dialog ref={dialogRef} className="recap-dialog" aria-label={`${recap.year}년 한 해 돌아보기`} onCancel={onClose} onKeyDown={(event) => { if ((event.target as HTMLElement).tagName === 'SELECT') return; if (event.key === 'ArrowRight') go(1); else if (event.key === 'ArrowLeft') go(-1) }}>
    <div className="recap-shell"><div className="recap-progress" aria-hidden="true">{CARDS.map((id, cardIndex) => <span key={id} className="recap-seg" data-on={cardIndex <= index} />)}</div>
      <div className="recap-bar"><label className="visually-hidden" htmlFor="recap-year">돌아볼 연도</label><select id="recap-year" value={recap.year} onChange={(event) => { setYear(Number(event.target.value)); setIndex(0); setSaveError(null); setSaveProgress(null) }}>{years.map((value) => <option key={value} value={value}>{value}년</option>)}</select>
        <p className="recap-count" aria-live="polite"><span aria-hidden="true">{index + 1} / {CARDS.length}</span><span className="visually-hidden">{CARDS.length}장 중 {index + 1}번째 카드 · {title}</span></p><button type="button" className="recap-close" onClick={onClose}><span aria-hidden="true">✕</span><span className="visually-hidden">한 해 돌아보기 닫기</span></button></div>
      <div className="recap-viewer" ref={viewerRef} tabIndex={-1} onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const start = touchX.current, end = event.changedTouches[0]?.clientX; touchX.current = null; if (start == null || end == null || Math.abs(end - start) < 40) return; go(end < start ? 1 : -1) }}>
        <div className="recap-track" style={{ transform: `translateX(-${index * 100}%)` }}>{CARDS.map((id, cardIndex) => <article key={id} className="recap-card" data-card={id} aria-label={`${cardIndex + 1}. ${CARD_TITLES[id]}`} aria-hidden={cardIndex !== index} inert={cardIndex !== index}><CardBody id={id} recap={recap} /></article>)}</div>
        <button type="button" className="recap-zone recap-zone-prev" onClick={() => go(-1)} disabled={index === 0}><span aria-hidden="true">‹</span><span className="visually-hidden">이전 카드</span></button><button type="button" className="recap-zone recap-zone-next" onClick={() => go(1)} disabled={index === CARDS.length - 1}><span aria-hidden="true">›</span><span className="visually-hidden">다음 카드</span></button>
      </div>
      <div className="recap-actions recap-actions-global"><div className="recap-action-buttons"><button type="button" className="btn" onClick={() => downloadCards([index])} disabled={saving}>이 장 저장</button><button type="button" className="btn btn-primary" onClick={() => downloadCards(CARDS.map((_, cardIndex) => cardIndex))} disabled={saving} aria-busy={saving}>{saving ? saveProgress ?? '저장 준비 중…' : '모든 장 저장'}</button></div>
        <p className="recap-warn">모든 장 저장 시 PNG 5개를 각각 내려받습니다. 브라우저가 여러 파일 다운로드 허용을 요청할 수 있습니다.</p>{saveProgress && !saving && !saveError && <p className="recap-success" role="status">{saveProgress}</p>}{saveError && <p className="recap-error" role="alert">{saveError}</p>}</div>
      <p className="recap-note">화면 위쪽 검색·기간·종류 필터와 상관없이, 불러온 전체 기록 중 {recap.year}년만 계산한 결과입니다.</p>
    </div>
    <div className="recap-export" aria-hidden="true">{CARDS.map((id, cardIndex) => <div key={id} ref={(node) => { exportRefs.current[cardIndex] = node }} className="recap-card" data-card={id} data-export={RECAP_EXPORTS[cardIndex]} style={{ width: SHARE_CARD.width, height: SHARE_CARD.height }}><CardBody id={id} recap={recap} /></div>)}</div>
  </dialog>
}
