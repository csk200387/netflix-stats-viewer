/** 넷플릭스 시청 기록 CSV 파서. 브라우저 안에서만 동작하며 외부로 아무것도 보내지 않는다. */

export type ViewRecord = {
  title: string
  date: Date
  /** 원본 날짜 문자열 (표시·디버깅용) */
  rawDate: string
}

export type SkippedRow = {
  line: number
  reason: string
  text: string
}

export type ParseResult = {
  records: ViewRecord[]
  skipped: SkippedRow[]
  /** 헤더를 제외한 전체 데이터 행 수 */
  totalRows: number
}

export class CsvError extends Error {}

/** RFC 4180 기반 CSV 분해. 따옴표 안의 구분자·줄바꿈·이스케이프("")를 그대로 처리한다. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // BOM 제거
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    // 빈 줄은 버린다
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"' && field === '') inQuotes = true
    else if (ch === delimiter) endField()
    else if (ch === '\r') {
      if (src[i + 1] === '\n') i++
      endRow()
    } else if (ch === '\n') endRow()
    else field += ch
  }
  if (field !== '' || row.length > 0) endRow()
  return rows
}

/** 첫 줄에서 가장 많이 등장하는 후보를 구분자로 고른다. (엑셀 재저장본은 ; 를 쓰기도 함) */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/, 1)[0] ?? ''
  const outside = line.replace(/"[^"]*"/g, '') // 따옴표 안쪽은 세지 않는다
  let best = ','
  let bestCount = -1
  for (const d of [',', ';', '\t']) {
    const n = outside.split(d).length - 1
    if (n > bestCount) {
      best = d
      bestCount = n
    }
  }
  return bestCount > 0 ? best : ','
}

const TITLE_HEADERS = ['title', '제목', '작품', '콘텐츠', 'name']
const DATE_HEADERS = ['date', '날짜', '시청일', '시청 날짜', 'watched', 'viewing date']

const norm = (s: string) => s.trim().replace(/^\uFEFF/, '').toLowerCase()

/** 헤더 행에서 Title/Date 열 위치를 찾는다. 헤더가 없으면 null. */
export function findColumns(header: string[]): { title: number; date: number } | null {
  const cells = header.map(norm)
  const title = cells.findIndex((c) => TITLE_HEADERS.some((h) => c === h || c.includes(h)))
  const date = cells.findIndex((c) => DATE_HEADERS.some((h) => c === h || c.includes(h)))
  if (title === -1 || date === -1 || title === date) return null
  return { title, date }
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** 두 자리 연도 해석: 69 이하는 2000년대, 70 이상은 1900년대 (POSIX 관례) */
function expandYear(y: number, digits: number): number {
  if (digits >= 4) return y
  return y < 70 ? 2000 + y : 1900 + y
}

function makeDate(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, m - 1, d)
  // 2월 30일 같은 값은 굴러넘어가므로 되돌려 확인한다
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

/**
 * 날짜 문자열 하나를 해석한다.
 * 지원: 2026-09-03 / 2026. 9. 3. / 2026년 9월 3일 / 9/3/26 / 03.09.2026 / 3 Sep 2026
 * `dayFirst`가 true면 숫자 3개 형식을 D/M/Y로 읽는다.
 */
export function parseDate(input: string, dayFirst = false): Date | null {
  const s = input.trim().replace(/^"|"$/g, '')
  if (!s) return null

  // 연도가 앞에 오는 형식 (ISO, 한국식)
  let m = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]?\s*(\d{1,2})\s*[.일]?$/.exec(s)
  if (m) return makeDate(+m[1], +m[2], +m[3])

  // 영문 월 이름: 3 Sep 2026 / Sep 3, 2026
  m = /^(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{2,4})$/i.exec(s)
  if (m && MONTH_NAMES[m[2].slice(0, 3).toLowerCase()]) {
    return makeDate(expandYear(+m[3], m[3].length), MONTH_NAMES[m[2].slice(0, 3).toLowerCase()], +m[1])
  }
  m = /^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/i.exec(s)
  if (m && MONTH_NAMES[m[1].slice(0, 3).toLowerCase()]) {
    return makeDate(expandYear(+m[3], m[3].length), MONTH_NAMES[m[1].slice(0, 3).toLowerCase()], +m[2])
  }

  // 숫자 3개: 9/3/26, 03.09.2026, 9-3-2026
  m = /^(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{2,4})$/.exec(s)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    const year = expandYear(+m[3], m[3].length)
    // 값 자체로 판별 가능하면 힌트보다 우선한다
    if (a > 12) return makeDate(year, b, a)
    if (b > 12) return makeDate(year, a, b)
    return dayFirst ? makeDate(year, b, a) : makeDate(year, a, b)
  }
  return null
}

/** 열 전체를 훑어 D/M/Y 표기인지 판단한다. 첫 자리에 12 초과 값이 있으면 일(day)이 앞. */
export function detectDayFirst(values: string[]): boolean {
  let dayFirstHits = 0
  let monthFirstHits = 0
  for (const v of values) {
    const m = /^(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{2,4})$/.exec(v.trim())
    if (!m) continue
    if (+m[1] > 12) dayFirstHits++
    else if (+m[2] > 12) monthFirstHits++
  }
  return dayFirstHits > monthFirstHits
}

/**
 * NetflixViewingHistory.csv 전문을 해석한다.
 * 헤더가 없거나 열 이름이 달라도 2열(제목, 날짜) 구조면 읽어낸다.
 */
export function parseViewingHistory(text: string): ParseResult {
  if (!text.trim()) throw new CsvError('파일이 비어 있습니다.')

  const rows = parseCsv(text, detectDelimiter(text))
  if (rows.length === 0) throw new CsvError('읽을 수 있는 행이 없습니다.')

  let cols = findColumns(rows[0])
  let dataRows = rows
  if (cols) {
    dataRows = rows.slice(1)
  } else if (rows[0].length >= 2 && parseDate(rows[0][1]) !== null) {
    // 헤더 없이 바로 데이터가 시작하는 파일
    cols = { title: 0, date: 1 }
  } else {
    throw new CsvError(
      'Title / Date 열을 찾지 못했습니다. 넷플릭스에서 내려받은 NetflixViewingHistory.csv 인지 확인해 주세요.',
    )
  }

  const dayFirst = detectDayFirst(dataRows.map((r) => r[cols.date] ?? ''))
  const records: ViewRecord[] = []
  const skipped: SkippedRow[] = []
  const headerOffset = dataRows === rows ? 1 : 2

  dataRows.forEach((row, i) => {
    const line = i + headerOffset
    const title = (row[cols.title] ?? '').trim()
    const rawDate = (row[cols.date] ?? '').trim()
    if (!title && !rawDate) return
    if (!title) {
      skipped.push({ line, reason: '제목 없음', text: row.join(', ') })
      return
    }
    const date = parseDate(rawDate, dayFirst)
    if (!date) {
      skipped.push({ line, reason: `날짜 해석 실패: ${rawDate || '(빈 값)'}`, text: title })
      return
    }
    records.push({ title, date, rawDate })
  })

  if (records.length === 0) {
    throw new CsvError('해석할 수 있는 시청 기록이 한 건도 없습니다. 파일 형식을 확인해 주세요.')
  }

  records.sort((a, b) => b.date.getTime() - a.date.getTime())
  return { records, skipped, totalRows: dataRows.length }
}
