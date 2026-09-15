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
  const raw = stampRaw(amount)
  // 제2조 ②: 1천원 미만이면 1천원, 1천원 이상이면 100원 미만 버림
  if (!opts.electronic) return raw < 1000e4 ? 1000 : Math.floor(raw / 1e6) * 100
  return raw < 1000e4 ? 900 : Math.floor((raw * 9) / 1e7) * 100
}

// 제2조 ① 금액을 1만분의 1원 단위 정수로 (부동소수점 오차 방지). [요율(만분율), 더할 금액]
function stampRaw(amount: number) {
  const [rate, add] = amount < 1e7 ? [50, 0] : amount < 1e8 ? [45, 5_000] : amount < 1e9 ? [40, 55_000] : [35, 555_000]
  return amount * rate + add * 1e4
}

/**
 * 지급명령 신청서 인지대. 「민사소송 등 인지법」 제7조제2항(제2조 금액의 10분의 1)·제4항(제2조제2항 준용)
 * 예: 청구금액 3,000,000원 → (3,000,000 × 0.005) × 0.1 = 1,500원
 * 출처: https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=568&ccfNo=3&cciNo=3&cnpClsNo=3 (확인 2026-09-15)
 * ponytail: 종이 신청 기준. 전자신청 10분의 9 감액과 끝자리 처리 순서는 공식 안내로 확인하지 못해 아직 넣지 않음
 */
export function calcPaymentOrderStampFee(amount: number): number {
  if (!(amount > 0)) return 0
  const raw = stampRaw(amount) // × 1/10 한 값이 1천원(1000e4) 미만 ⇔ raw < 1000e5
  return raw < 1000e5 ? 1000 : Math.floor(raw / 1e7) * 100
}

/**
 * 송달료 회분. 「송달료규칙의 시행에 따른 업무처리요령」(재판예규 재일 87-4) 별표 1
 * 출처: https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=568&ccfNo=2&cciNo=4&cnpClsNo=3 (확인 2026-09-15)
 * 독촉(지급명령) 6회분: 생활법령정보 지급명령 신청서 작성 (위 calcPaymentOrderStampFee 출처와 같음)
 */
export const SERVICE_ROUNDS = { 소액: 10, 단독: 15, 합의: 15, 항소: 12, 상고: 8, 조정: 5, 독촉: 6 } as const
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
  /** 전자소송이면 인지액 10분의 9. 첨부서류 통수는 채우지 않음(전자소송은 정해진 제출 통수가 없음) */
  electronic?: boolean
  /** 원고 + 피고 수 (기본 2) */
  parties?: number
  /** 상대방(피고) 수 — 첨부서류 통수에 씀. 기본은 parties − 1 (원고 1명), 최소 1 */
  opponents?: number
  unitFee?: number
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
const digits = (s = '') => Number(s.replace(/[^\d]/g, '')) || 0

/**
 * 비어 있는 비용·통수 변수를 계산값으로 채움. 직접 입력한 값은 덮어쓰지 않음.
 * - 소장: `소가`(또는 `소송목적의 값`) → 이름이 `인지액`·`송달료`로 시작하는 변수 (소가 3천만원 이하 소액 10회분, 넘으면 15회분)
 * - 지급명령: `청구금액` → `독촉절차 인지대`(소장의 10분의 1)·`독촉절차 송달료`(6회분)·`독촉절차비용`(두 금액 합계)
 * - 첨부서류: `입증방법 통수`(상대방 수 + 1)·`소장 부본 통수`·`답변서 부본 통수`(상대방 수) — 소가 없이도 채움
 */
export function withCourtFees(names: string[], values: Values, opts: CourtFeeOptions = {}): Values {
  const amountOf = (re: RegExp) => digits(values[names.find((n) => re.test(n)) ?? ''])
  const out = { ...values }
  let filled = false
  const fillText = (re: RegExp, text: string) => {
    for (const n of names)
      if (re.test(n) && !values[n]?.trim()) {
        out[n] = text
        filled = true
      }
  }
  const fill = (re: RegExp, value: number) => fillText(re, won(value))
  const parties = opts.parties ?? 2

  const amount = amountOf(/^(소가|소송목적의\s*값)/)
  if (amount) {
    fill(/^인지(액|대)/, calcStampFee(amount, opts))
    fill(/^송달료/, calcServiceFee({ parties, procedure: amount <= SMALL_CLAIM_LIMIT ? '소액' : '단독', unitFee: opts.unitFee }))
  }

  const claim = amountOf(/^청구금액/)
  if (claim && names.some((n) => /^독촉절차/.test(n))) {
    const STAMP = /^독촉절차\s*인지(액|대)/
    const SERVICE = /^독촉절차\s*송달료/
    const stamp = calcPaymentOrderStampFee(claim)
    const service = calcServiceFee({ parties, procedure: '독촉', unitFee: opts.unitFee })
    fill(STAMP, stamp)
    fill(SERVICE, service)
    // 합계는 직접 입력한 인지대·송달료가 있으면 그 값으로 더함
    fill(/^독촉절차\s*비용/, (amountOf(STAMP) || stamp) + (amountOf(SERVICE) || service))
  }

  /*
   * 첨부서류 통수. 「민사소송규칙」 제105조제2항: 서증은 상대방의 수에 1을 더한 수의 사본, 제48조제1항: 송달에 필요한 수의 부본
   * 출처: https://www.law.go.kr/법령/민사소송규칙 (확인 2026-09-16),
   *   대한법률구조공단 첨부서류 작성방법 https://support.klac.or.kr/front/contents/lawsuit/011.do ("위 입증방법 각 2통", 소장 부본은 피고 1명이면 1부·2명이면 2부)
   * 종이 제출 기준. 전자소송(electronic)이면 채우지 않음 — 소장에 적을 정해진 통수가 없음 (확인 2026-09-16):
   *   「민사소송 등에서의 전자문서 이용 등에 관한 업무처리지침」(재판예규 제1933호) 제23조제3항: 부본·사본 제출의무 규정에도 불구하고
   *   법 제11조제1항 각 호의 자(전자소송 동의를 한 등록사용자, 국가·지방자치단체 등)에게 송달할 부본·사본은 내지 않을 수 있음.
   *   그 밖의 상대방에게는 법원이 전자문서를 출력해 송달하고(법 제12조제1항), 출력할 분량이 50쪽 이상이거나
   *   상대방이 5인 이상이면 제출자에게 출력서면 제출을 명할 수 있음(규칙 제29조제2항, 지침 제23조제1항)
   *   지침: https://portal.scourt.go.kr/pgp/main.on?w2xPath=PGP1051M04&c=900&jisCntntsSrno=2025000019074&srchwd=*&originDvsCd=07&rnum=3&pgDvs=1
   */
  if (!opts.electronic) {
    const opponents = Math.max(1, opts.opponents ?? parties - 1)
    fillText(/^입증방법\s*통수/, `${opponents + 1}통`)
    fillText(/^(소장|답변서)\s*부본\s*통수/, `${opponents}통`) // 답변서 부본은 원고에게 송달 (민사소송법 제256조제3항)
  }
  return filled ? out : values
}
