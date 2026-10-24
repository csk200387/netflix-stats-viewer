import { useCallback, useRef, useState } from 'react'

type Props = {
  onFile: (file: File) => void
  onSample: () => void
  busy: boolean
  /** 파일을 읽거나 분석하다 난 오류. 드롭존 바로 위에 보여 준다 */
  error: string | null
}

const isCsv = (f: File) => /\.(csv|txt)$/i.test(f.name) || f.type === 'text/csv'

export default function FileDrop({ onFile, onSample, busy, error }: Props) {
  const [over, setOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const take = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      if (!isCsv(file)) {
        setLocalError(`CSV 파일만 불러올 수 있습니다. (선택한 파일: ${file.name})`)
        return
      }
      setLocalError(null)
      onFile(file)
    },
    [onFile],
  )

  return (
    <>
      <div className="guide-primary">
        <h2>시청 기록 CSV, 이렇게 내려받으세요</h2>
        <ol className="guide-steps">
          <li><span aria-hidden="true">1</span>넷플릭스 웹에서 분석할 <strong>프로필</strong>로 전환</li>
          <li><span aria-hidden="true">2</span><code>계정</code> → <code>프로필</code> → <code>시청 기록</code> 열기</li>
          <li><span aria-hidden="true">3</span>기록 아래 <code>더 보기</code>를 누른 뒤 <code>모두 다운로드</code> 클릭</li>
          <li><span aria-hidden="true">4</span>받은 <code>NetflixViewingHistory.csv</code>를 아래에 올리기</li>
        </ol>
        <a
          className="download-link"
          href="https://www.netflix.com/viewingactivity"
          target="_blank"
          rel="noreferrer"
        >
          넷플릭스 시청 기록 페이지 열기 ↗
        </a>
        <p className="guide-hint">로그인이 필요하며, 선택한 프로필의 기록만 내려받아집니다.</p>
      </div>

      {localError ? (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <p>{localError}</p>
        </div>
      ) : error && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <div>
            <h3>파일을 분석할 수 없습니다</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 키보드·스크린리더는 안쪽 '파일 선택' 버튼으로 들어온다. 영역 클릭은 마우스용 지름길 */}
      <div
        className={`drop${over ? ' over' : ''}`}
        onClick={() => {
          if (!busy) inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files)
        }}
      >
        <div className="drop-icon" aria-hidden="true"><span>CSV</span></div>
        <h2>{busy ? '분석하는 중…' : <>NetflixViewingHistory.csv&nbsp;를 여기에 놓아주세요</>}</h2>
        <p>넷플릭스에서 내려받은 시청 기록 CSV를 끌어다 놓거나, 아래 버튼으로 직접 선택할 수 있습니다.</p>
        <div className="drop-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
          >
            파일 선택
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              setLocalError(null)
              onSample()
            }}
          >
            샘플 데이터로 둘러보기
          </button>
        </div>
        <p className="drop-note">
          파일은 업로드하지 않고 브라우저에서 읽습니다. 장르를 알기 위해 작품 제목만 TMDB로 보내 조회합니다. 파일과 시청 날짜는 보내지 않습니다.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="visually-hidden"
          onChange={(e) => {
            take(e.target.files)
            e.target.value = '' // 같은 파일을 다시 골라도 동작하도록
          }}
        />
      </div>

      <div className="guide">
        <div className="guide-card">
          <h3>필요한 형식</h3>
          <p>
            <code>Title</code>, <code>Date</code> 두 열이면 충분합니다. <code>제목/날짜</code> 한글 헤더,
            <code>9/3/26</code>·<code>2026-09-03</code>·<code>2026. 9. 3.</code> 등 여러 날짜 표기를 자동으로 인식합니다.
          </p>
        </div>
        <div className="guide-card">
          <h3>외부로 보내는 것</h3>
          <p>
            본전 계산에서 애니·드라마 등 장르를 구분하려고 작품 제목만 TMDB(영화·TV 정보 사이트)에서 검색합니다. 시청 날짜와
            파일은 보내지 않으며, 새로고침하면 불러온 데이터는 사라집니다.
          </p>
        </div>
      </div>
    </>
  )
}
