import { useCallback, useRef, useState } from 'react'

type Props = {
  onFile: (file: File) => void
  onSample: () => void
  busy: boolean
}

const isCsv = (f: File) => /\.(csv|txt)$/i.test(f.name) || f.type === 'text/csv'

export default function FileDrop({ onFile, onSample, busy }: Props) {
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
      {localError && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">⚠️</span>
          <p>{localError}</p>
        </div>
      )}

      <div
        className={`drop${over ? ' over' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="CSV 파일 불러오기"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files)
        }}
      >
        <p className="drop-kicker">DROP YOUR WATCH HISTORY</p>
        <div className="drop-icon" aria-hidden="true"><span>CSV</span></div>
        <h2>{busy ? '분석하는 중…' : 'NetflixViewingHistory.csv 를 여기에 놓아주세요'}</h2>
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
          <strong>🔒 파일은 브라우저 밖으로 나가지 않습니다.</strong> 업로드도, 서버 전송도, 저장도 하지 않습니다.
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
        <div className="guide-card guide-card-download">
          <h3>시청 기록 CSV 내려받는 법</h3>
          <ol>
            <li>넷플릭스 웹에서 분석할 <strong>프로필</strong>로 전환</li>
            <li><code>계정</code> → <code>프로필</code> → <code>시청 기록</code> 열기</li>
            <li>기록 아래의 <code>더 보기</code>를 누른 뒤 <code>모두 다운로드</code> 클릭</li>
            <li>받은 <code>NetflixViewingHistory.csv</code>를 위에 올리기</li>
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
        <div className="guide-card">
          <h3>필요한 형식</h3>
          <p>
            <code>Title</code>, <code>Date</code> 두 열이면 충분합니다. <code>제목/날짜</code> 한글 헤더,
            <code>9/3/26</code>·<code>2026-09-03</code>·<code>2026. 9. 3.</code> 등 여러 날짜 표기를 자동으로 인식합니다.
          </p>
        </div>
        <div className="guide-card">
          <h3>개인정보</h3>
          <p>
            모든 계산은 이 페이지의 자바스크립트 안에서만 이루어집니다. 네트워크 요청이 없고, 새로고침하면 데이터는
            흔적 없이 사라집니다.
          </p>
        </div>
      </div>
    </>
  )
}
