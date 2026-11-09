export const num = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
export const won = (value: number) => `${num(value)}원`
/**
 * 정수 퍼센트로 내린다. 근거 단가가 유형마다 1~2개라 소수점은 거짓 정밀도이고,
 * 반올림하면 99.96%가 ‘100%’로 보여 ‘미달’ 판정과 어긋난다.
 */
export const percent = (ratio: number) => `${Math.floor(ratio * 100 + 1e-9)}%`
