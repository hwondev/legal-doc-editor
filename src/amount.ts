// 금액 표기. 법률문서·수표 관례대로 "일"을 빼지 않고 적음(일만, 일십일) — 고쳐 쓰기 어렵게 하려는 관례

const DIGITS = '영일이삼사오육칠팔구'
const PLACES = ['천', '백', '십', ''] // 한 묶음(4자리) 안의 자리
const GROUPS = ['', '만', '억', '조', '경'] // 4자리마다

/** 37200000 → "삼천칠백이십만", 410000000 → "사억일천만", 0 → "영" */
export function toKoreanAmount(n: number): string {
  if (!Number.isSafeInteger(n)) throw new RangeError(`금액은 정수여야 해요: ${n}`)
  if (n === 0) return '영'
  if (n < 0) return `마이너스 ${toKoreanAmount(-n)}`
  let out = ''
  const s = String(n).padStart(Math.ceil(String(n).length / 4) * 4, '0')
  for (let g = 0; g < s.length / 4; g++) {
    const chunk = s.slice(g * 4, g * 4 + 4)
    if (chunk === '0000') continue
    for (let i = 0; i < 4; i++) if (chunk[i] !== '0') out += DIGITS[+chunk[i]] + PLACES[i]
    out += GROUPS[s.length / 4 - 1 - g]
  }
  return out
}

/** "금 37,200,000원" · "37200000" → 37200000 (숫자가 없으면 0) */
export const parseAmount = (text: string) => Number(text.replace(/[^\d]/g, '')) || 0

/**
 * 소장식: 금 37,200,000원
 * 계약서식: 금 삼천칠백이십만 원정(₩37,200,000)
 */
export function formatAmount(n: number, style: '소장' | '계약서' = '소장'): string {
  const num = n.toLocaleString('ko-KR')
  return style === '소장' ? `금 ${num}원` : `금 ${toKoreanAmount(n)} 원정(₩${num})`
}
