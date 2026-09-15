import type { Values } from './variable'

// 계산 결과는 참고용 — 실제 납부액은 법원 안내를 따른다

/**
 * 소장 인지액. 「민사소송 등 인지법」 제2조(소장)·제16조(전자소송 10분의 9)
 * 출처: https://www.law.go.kr/법령/민사소송 등 인지법 (시행 2025. 3. 1., 확인 2026-09-15)
 * 전자소송 끝자리 처리: 대법원 전자소송포털 '인지액 계산방법' https://ecfs.scourt.go.kr/psp/link.on?m=PSP007P01 (확인 2026-09-15)
 *   (소가 × 요율 + 정액) × 0.9를 먼저 구한 뒤 100원 미만 버림, 1천원 미만이면 900원 — 예: 5천만원 → 207,000원
 */
export function calcStampFee(amount: number, opts: { electronic?: boolean } = {}): number {
  if (!(amount > 0)) return 0
  // 제2조 ①: [요율(만분율), 더할 금액]. 부동소수점 오차가 없게 1만분의 1원 단위 정수로 계산
  const [rate, add] = amount < 1e7 ? [50, 0] : amount < 1e8 ? [45, 5_000] : amount < 1e9 ? [40, 55_000] : [35, 555_000]
  const raw = amount * rate + add * 1e4
  // 제2조 ②: 1천원 미만이면 1천원, 1천원 이상이면 100원 미만 버림
  if (!opts.electronic) return raw < 1000e4 ? 1000 : Math.floor(raw / 1e6) * 100
  return raw < 1000e4 ? 900 : Math.floor((raw * 9) / 1e7) * 100
}

/**
 * 송달료 회분. 「송달료규칙의 시행에 따른 업무처리요령」(재판예규 재일 87-4) 별표 1
 * 출처: https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=568&ccfNo=2&cciNo=4&cnpClsNo=3 (확인 2026-09-15)
 */
export const SERVICE_ROUNDS = { 소액: 10, 단독: 15, 합의: 15, 항소: 12, 상고: 8, 조정: 5 } as const
export type Procedure = keyof typeof SERVICE_ROUNDS

/**
 * 1회 송달료(원). 2025. 6. 1.부터 5,500원 — 별표 1 사건 전체 (확인 2026-09-15)
 * 출처: 법원 공지 https://www.scourt.go.kr/portal/dcboard/DcNewsViewAction.work?seqnum=17688&gubun=41&cbub_code=000420
 * ponytail: 찾기쉬운 생활법령정보는 5,640원으로 적고 있어 공식 공지와 다름 — 새 공지가 나오면 이 값만 바꾸거나 `unitFee`로 덮어씀
 */
export const SERVICE_UNIT_FEE = 5500

export function calcServiceFee({ parties, procedure, unitFee = SERVICE_UNIT_FEE }: { parties: number; procedure: Procedure; unitFee?: number }) {
  return parties * SERVICE_ROUNDS[procedure] * unitFee
}

/** 소액사건: 소가 3천만원 이하 (소액사건심판규칙 제1조의2) */
export const SMALL_CLAIM_LIMIT = 30_000_000

export interface CourtFeeOptions {
  /** 전자소송이면 인지액 10분의 9 */
  electronic?: boolean
  /** 원고 + 피고 수 (기본 2) */
  parties?: number
  unitFee?: number
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const digits = (s = '') => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * 입력값에 `소가`(또는 `소송목적의 값`)가 있으면 이름이 `인지액`·`송달료`로 시작하는 변수를 계산값으로 채움.
 * 직접 입력한 값은 덮어쓰지 않음. 제1심 소장 기준(소가 3천만원 이하 소액 10회분, 넘으면 15회분)
 */
export function withCourtFees(names: string[], values: Values, opts: CourtFeeOptions = {}): Values {
  const amountName = names.find((n) => /^(소가|소송목적의\s*값)/.test(n))
  const amount = amountName ? digits(values[amountName]) : 0
  if (!amount) return values
  const stamp = won(calcStampFee(amount, opts))
  const service = won(calcServiceFee({ parties: opts.parties ?? 2, procedure: amount <= SMALL_CLAIM_LIMIT ? '소액' : '단독', unitFee: opts.unitFee }))
  const out = { ...values }
  for (const n of names) {
    if (values[n]?.trim()) continue
    if (/^인지(액|대)/.test(n)) out[n] = stamp
    else if (/^송달료/.test(n)) out[n] = service
  }
  return out
}
