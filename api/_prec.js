// 국가법령정보 공동활용 API 판례 목록 한 건 → LegalEditor `searchCases` 결과 모양
// Vercel 함수(api/cases.js)와 예제 서버(examples/law-go-kr-proxy)가 함께 씀. 밑줄로 시작해 Vercel이 따로 함수로 만들지 않음
//
// 운영 응답에서 확인한 모양 (2026-09-27):
//   - 대법원 외 출처(국세법령정보시스템·근로복지공단산재판례)는 법원명·판결유형이 비어 있음
//   - 사건번호가 "서울동부지방법원-2025-나-20644", "서울고등법원2026나200524"처럼 법원과 붙어 오기도 함
//   - 판결유형이 "판결 : 환송"처럼 뒤에 설명이 붙어 옴

// 법원(또는 지원) + 연도 + 사건부호 + 번호. 사이는 하이픈·공백이 있거나 없음
const JOINED = /^(?<court>[가-힣]+(?:\s[가-힣]+)?(?:법원|지원))[-\s]*(?<year>\d{4})[-\s]*(?<code>[가-힣]{1,3})[-\s]*(?<num>\d+)$/

export function precToCase(p) {
  const raw = String(p.사건번호 ?? '').trim()
  const m = raw.match(JOINED)
  const caseNo = m ? `${m.groups.year}${m.groups.code}${m.groups.num}` : raw.replace(/[\s-]/g, '')
  const court = String(p.법원명 ?? '').trim() || m?.groups.court || ''
  const kind = String(p.판결유형 ?? '').split(':')[0].trim() // "판결 : 환송" → 판결
  // 판결·결정은 사건부호로 가릴 수 있지만 공식 표를 확인하지 못해 추측하지 않고, 넣기 전에 알려 줌
  const notes = []
  if (p.데이터출처명 && p.데이터출처명 !== '대법원') notes.push(`출처: ${p.데이터출처명}`)
  if (!kind) notes.push('판결·결정 구분이 없어 판결로 넣어요 — 넣은 뒤 확인하세요')
  if (!court) notes.push('법원명이 없어요')
  return {
    court,
    date: String(p.선고일자 ?? ''),
    caseNo,
    title: String(p.사건명 ?? ''),
    ...(kind && { kind }),
    ...(notes.length && { summary: notes.join(' · ') }),
    // 판례상세링크에는 인증값이 들어 있어 쓰지 않고, 공개 판례 검색 주소로 연결
    url: `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent(caseNo)}`,
  }
}
