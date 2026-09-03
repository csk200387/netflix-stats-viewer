import { describe, expect, it } from 'vitest'
import { CsvError, detectDayFirst, detectDelimiter, findColumns, parseCsv, parseDate, parseViewingHistory } from './parse'

describe('parseCsv', () => {
  it('따옴표 안의 쉼표와 이스케이프를 보존한다', () => {
    expect(parseCsv('a,"b,c","d""e"')).toEqual([['a', 'b,c', 'd"e']])
  })

  it('따옴표 안의 줄바꿈을 한 필드로 유지한다', () => {
    expect(parseCsv('"두\n줄",x')).toEqual([['두\n줄', 'x']])
  })

  it('CRLF와 BOM, 빈 줄을 처리한다', () => {
    expect(parseCsv('﻿Title,Date\r\n"영화","1/2/26"\r\n\r\n')).toEqual([
      ['Title', 'Date'],
      ['영화', '1/2/26'],
    ])
  })

  it('구분자를 추정한다', () => {
    expect(detectDelimiter('Title;Date')).toBe(';')
    expect(detectDelimiter('Title,Date')).toBe(',')
    expect(detectDelimiter('"제목, 부제",Date')).toBe(',')
  })
})

describe('findColumns', () => {
  it('영문/한글 헤더를 모두 찾고 순서가 바뀌어도 인식한다', () => {
    expect(findColumns(['Title', 'Date'])).toEqual({ title: 0, date: 1 })
    expect(findColumns(['날짜', '제목'])).toEqual({ title: 1, date: 0 })
    expect(findColumns(['Profile Name', 'Start Time'])).toBeNull()
  })
})

describe('parseDate', () => {
  it('넷플릭스 기본 M/D/YY를 읽는다', () => {
    const d = parseDate('9/3/26')!
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 3])
  })

  it('한국식·ISO 표기를 읽는다', () => {
    for (const s of ['2026-09-03', '2026. 9. 3.', '2026년 9월 3일', '2026.09.03']) {
      const d = parseDate(s)!
      expect([d.getFullYear(), d.getMonth() + 1, d.getDate()], s).toEqual([2026, 9, 3])
    }
  })

  it('영문 월 이름을 읽는다', () => {
    expect(parseDate('3 Sep 2026')?.getMonth()).toBe(8)
    expect(parseDate('Sep 3, 2026')?.getDate()).toBe(3)
  })

  it('dayFirst 힌트로 모호한 값의 순서를 바꾼다', () => {
    expect(parseDate('3/9/26')?.getMonth()).toBe(2)
    expect(parseDate('3/9/26', true)?.getMonth()).toBe(8)
  })

  it('12를 넘는 값은 힌트보다 우선해 일(day)로 본다', () => {
    const d = parseDate('25/12/2026')!
    expect([d.getMonth() + 1, d.getDate()]).toEqual([12, 25])
  })

  it('두 자리 연도를 2000년대로 확장한다', () => {
    expect(parseDate('1/1/69')?.getFullYear()).toBe(2069)
    expect(parseDate('1/1/70')?.getFullYear()).toBe(1970)
  })

  it('존재하지 않는 날짜와 쓰레기 값을 거절한다', () => {
    expect(parseDate('2/30/26')).toBeNull()
    expect(parseDate('13/13/26')).toBeNull()
    expect(parseDate('나중에')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('detectDayFirst', () => {
  it('첫 자리에 12 초과 값이 많으면 D/M/Y로 본다', () => {
    expect(detectDayFirst(['25/12/2026', '3/9/26'])).toBe(true)
    expect(detectDayFirst(['9/3/26', '12/25/2026'])).toBe(false)
  })
})

describe('parseViewingHistory', () => {
  const csv = 'Title,Date\n"쇼: 시즌 1: 1화","9/3/26"\n"영화","8/1/26"\n'

  it('정상 파일을 최신순으로 반환한다', () => {
    const r = parseViewingHistory(csv)
    expect(r.records.map((x) => x.title)).toEqual(['쇼: 시즌 1: 1화', '영화'])
    expect(r.totalRows).toBe(2)
    expect(r.skipped).toHaveLength(0)
  })

  it('헤더가 없어도 2열 구조면 읽는다', () => {
    expect(parseViewingHistory('"영화","8/1/26"\n').records).toHaveLength(1)
  })

  it('깨진 행만 건너뛰고 줄 번호를 남긴다', () => {
    const r = parseViewingHistory('Title,Date\n"좋음","9/3/26"\n"나쁨","언젠가"\n')
    expect(r.records).toHaveLength(1)
    expect(r.skipped).toEqual([{ line: 3, reason: '날짜 해석 실패: 언젠가', text: '나쁨' }])
  })

  it('빈 파일과 형식이 다른 파일은 오류를 던진다', () => {
    expect(() => parseViewingHistory('   ')).toThrow(CsvError)
    expect(() => parseViewingHistory('foo,bar\n1,2\n')).toThrow(CsvError)
    expect(() => parseViewingHistory('Title,Date\n"쇼","언젠가"\n')).toThrow(CsvError)
  })
})
