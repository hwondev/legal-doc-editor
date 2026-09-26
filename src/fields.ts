/**
 * withCourtFees(fees.ts)가 채울 수 있는 변수 이름인지 (인지액·송달료·독촉절차·첨부 통수) — 입력값 화면의 "자동 계산" 묶음에 씀
 * 두 규칙이 어긋나지 않는지는 scripts/check.ts가 검사함
 */
export const isAutoFilledName = (name: string) => /^(인지(액|대)|송달료|독촉절차|입증방법\s*통수|(소장|답변서|준비서면)\s*부본\s*통수)/.test(name)

/** 입력값 묶음 순서 */
export const FIELD_GROUPS = ['당사자', '금액', '날짜', '그 밖의 내용', '자동 계산'] as const
export type FieldGroup = (typeof FIELD_GROUPS)[number]

// ponytail: 이름으로 가르는 규칙이라 템플릿에 새 이름을 쓰면 "그 밖의 내용"으로 갈 수 있음 — 필요하면 여기 낱말을 더함
const PARTY_FIRST = /^(원고|피고|채권자|채무자|고소인|피고소인|고발인|피고발인|발신인|수신인|갑|을)(\s|$)/

/** 변수 이름 → 묶음. auto면 autoFees가 채우는 이름을 "자동 계산"으로 */
export function fieldGroup(name: string, auto = false): FieldGroup {
  if (auto && isAutoFilledName(name)) return '자동 계산'
  if (PARTY_FIRST.test(name)) return '당사자' // "채권자 생년월일"도 날짜가 아니라 당사자
  if (/(일|날|일시|일자|기한|기간)$|날짜|변제기/.test(name)) return '날짜'
  if (/소가|소송목적의\s*값|금액|원금|이자|비용|계좌|은행|예금주/.test(name)) return '금액'
  if (/당사자|관계/.test(name)) return '당사자'
  return '그 밖의 내용'
}

/** 이름 목록을 묶음 순서대로 [묶음, 이름[]][] (빈 묶음은 뺌, 묶음 안 순서는 문서에 나온 순) */
export function groupFields(names: string[], { auto = false } = {}): [FieldGroup, string[]][] {
  const groups = new Map<FieldGroup, string[]>(FIELD_GROUPS.map((g) => [g, []]))
  for (const n of names) groups.get(fieldGroup(n, auto))!.push(n)
  return [...groups].filter(([, list]) => list.length > 0)
}
