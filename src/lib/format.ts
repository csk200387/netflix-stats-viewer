export const num = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
export const won = (value: number) => `${num(value)}원`
/** 부호를 붙인 금액. 이득은 +, 손해는 − */
export const signedWon = (value: number) => `${value >= 0 ? '+' : '−'}${won(Math.abs(value))}`
export const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`
