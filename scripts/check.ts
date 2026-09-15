// 번호 매기기·이스케이프·hwpx 생성·인용 인식 확인 (DOM 없이 도는 부분만). 실행: npm run check
import assert from 'node:assert/strict'
import { toHwpx, toPlainHtml } from '../src/io.ts'
import { findCitations } from '../src/citation.ts'
import { calcServiceFee, calcStampFee, SERVICE_UNIT_FEE, withCourtFees } from '../src/fees.ts'

const t = (text: string) => ({ type: 'text', text })
const p = (...content: object[]) => ({ type: 'paragraph', content })
const li = (...content: object[]) => ({ type: 'listItem', content })
const ol = (...content: object[]) => ({ type: 'orderedList', content })
const num = (level: number, text: string) => ({ type: 'paragraph', attrs: { num: level }, content: [t(text)] })
const article = (title: string) => ({ type: 'heading', attrs: { level: 2 }, content: [t(title)] })

const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [t('계약서')] },
    p({ type: 'variable', attrs: { name: '갑' } }, t('과 '), { type: 'variable', attrs: { name: '을' } }),
    article('(목적)'),
    article('(범위)'),
    ol(li(p(t('첫째 항'))), li(p(t('둘째 항')), ol(li(p(t('첫째 호'))), li(p(t('둘째 호')))))),
    { type: 'heading', attrs: { level: 3 }, content: [t('청 구 취 지')] },
    num(1, '첫 번호'),
    p(t('본문')),
    num(2, '가 항목'),
    num(2, '나 항목'),
    num(3, '괄호'),
    num(1, '둘째 번호'),
    num(2, '다시 가'),
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2, rowspan: 1 }, content: [p(t('합계')), p(t('2줄'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('A'))] }, { type: 'tableCell', content: [p(t('B'))] }] },
      ],
    },
    { type: 'heading', attrs: { level: 3 }, content: [t('입 증 방 법')] },
    num(1, '새 섹션'),
    // 사이에 일반 문단이 끼어 ②부터 다시 시작하는 항 목록
    { type: 'orderedList', attrs: { start: 2 }, content: [li(p(t('이어진 항')), ol(li(p(t('호'))))), li(p(t('다음 항')))] },
  ],
}

const html = toPlainHtml(doc, { 갑: '<갑&>' })
assert.match(html, /<h1>계약서<\/h1>/)
assert.match(html, /&#60;갑&#38;&#62;과 \[을\]/) // 값은 이스케이프, 빈 값은 [이름]
assert.match(html, /<b>제2조<\/b> <b>\(범위\)<\/b>/)
assert.match(html, /② 둘째 항/)
assert.match(html, /2\. 둘째 호/)
assert.match(html, /<h3><b>청 구 취 지<\/b><\/h3>/)
// 번호 문단: 본문이 끼어도 이어서 세고, 상위 번호가 바뀌면 하위는 1부터, 소제목에서 전부 1부터
assert.match(
  html,
  /<p>1\. 첫 번호<\/p>\n<p>본문<\/p>\n<p style="margin-left:2em">가\. 가 항목<\/p>\n<p style="margin-left:2em">나\. 나 항목<\/p>\n<p style="margin-left:4em">\(1\) 괄호<\/p>\n<p>2\. 둘째 번호<\/p>\n<p style="margin-left:2em">가\. 다시 가<\/p>/,
)
assert.match(html, /<h3><b>입 증 방 법<\/b><\/h3>\n<p>1\. 새 섹션<\/p>/)
assert.match(html, /<p>② 이어진 항<\/p>\n<p style="margin-left:2em">1\. 호<\/p>\n<p>③ 다음 항<\/p>/)
assert.match(html, /<table><tr><td colspan="2">합계<br>2줄<\/td><\/tr><tr><td>A<\/td><td>B<\/td><\/tr><\/table>/)

const hwpx = new Uint8Array(await (await toHwpx(doc, {})).arrayBuffer())
assert.deepEqual([...hwpx.slice(0, 2)], [0x50, 0x4b]) // zip

// 판례·법령 인용 인식
const cites = (s: string) => findCitations(s).map((c) => `${c.type}:${c.text}`)

assert.deepEqual(cites('위 사건은 대법원 2016. 4. 28. 선고 2015다12345 판결 참조'), ['case:대법원 2016. 4. 28. 선고 2015다12345 판결'])
assert.deepEqual(cites('서울고등법원 2019. 1. 10. 선고 2018나1234 판결'), ['case:서울고등법원 2019. 1. 10. 선고 2018나1234 판결'])
assert.deepEqual(cites('대법원 2020. 1. 9.자 2019마123 결정'), ['case:대법원 2020. 1. 9.자 2019마123 결정'])
assert.deepEqual(cites('이 사건(2015다12345)과 2018노1234, 2024가단157033'), ['case:2015다12345', 'case:2018노1234', 'case:2024가단157033'])
assert.deepEqual(cites('불법행위에 따른 민법 제750조의 손해배상'), ['law:민법 제750조'])
assert.deepEqual(cites('형법 제347조 제1항'), ['law:형법 제347조 제1항'])
assert.deepEqual(cites('민사소송법 제194조'), ['law:민사소송법 제194조'])
assert.deepEqual(cites('특정경제범죄 가중처벌 등에 관한 법률 제3조'), ['law:특정경제범죄 가중처벌 등에 관한 법률 제3조'])
assert.deepEqual(cites('피고인을 특정경제범죄 가중처벌 등에 관한 법률 제3조로 기소하였다'), ['law:특정경제범죄 가중처벌 등에 관한 법률 제3조'])
assert.deepEqual(cites('민법 제839조의2'), ['law:민법 제839조의2'])

// 인식하면 안 되는 것: 날짜, 전화번호, 계좌번호, 금액
assert.deepEqual(cites('2026. 9. 2. 계약을 체결하였다'), [])
assert.deepEqual(cites('연락처 010-1234-5678 (사무실 02-530-1234)'), [])
assert.deepEqual(cites('계좌번호 3333-17-4044109'), [])
assert.deepEqual(cites('합의금 1234만5000원을 지급한다'), [])
assert.deepEqual(cites('2024년3월5일 계약을 체결하였다'), [])
assert.deepEqual(cites('불법행위의 방법 제3조에 따라'), [])

// 위치와 링크 주소
const [law] = findCitations('위반하여 민법 제750조에 따라')
assert.deepEqual([law.from, law.to], [5, 13])
assert.equal(law.url, `https://www.law.go.kr/${['법령', '민법', '제750조'].map(encodeURIComponent).join('/')}`)
const [prec] = findCitations('대법원 2016. 4. 28. 선고 2015다12345 판결')
assert.equal(prec.url, `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent('2015다12345')}`)

// 인용은 화면에만 덧입히므로 내보내기 결과는 그대로여야 함
assert.equal(toPlainHtml({ type: 'doc', content: [p(t('민법 제750조'))] }, {}), '<p>민법 제750조</p>')

// 인지액: 구간 경계, 최저 1천원, 100원 미만 버림, 전자소송 10분의 9
assert.equal(calcStampFee(100_000), 1_000) // 500원 → 최저 1천원
assert.equal(calcStampFee(9_999_999), 49_900) // 49,999.995원 → 100원 미만 버림
assert.equal(calcStampFee(10_000_000), 50_000)
assert.equal(calcStampFee(37_200_000), 172_400)
assert.equal(calcStampFee(99_999_999), 454_900)
assert.equal(calcStampFee(100_000_000), 455_000)
assert.equal(calcStampFee(999_999_999), 4_054_900)
assert.equal(calcStampFee(1_000_000_000), 4_055_000)
assert.equal(calcStampFee(37_200_000, { electronic: true }), 155_100) // 172,400 × 9/10 = 155,160
// 전자소송포털 예시와, 0.9를 곱한 뒤 끝자리를 버려야 하는 경우(14,799 × 0.9 = 13,319.1 → 13,300)
assert.equal(calcStampFee(50_000_000, { electronic: true }), 207_000)
assert.equal(calcStampFee(100_000_000, { electronic: true }), 409_500)
assert.equal(calcStampFee(2_959_800, { electronic: true }), 13_300)
assert.equal(calcStampFee(100_000, { electronic: true }), 900)
assert.equal(calcStampFee(0), 0)

// 송달료: 당사자 수 × 회분 × 1회 송달료
assert.equal(calcServiceFee({ parties: 2, procedure: '소액', unitFee: 5_500 }), 110_000)
assert.equal(calcServiceFee({ parties: 3, procedure: '단독' }), 3 * 15 * SERVICE_UNIT_FEE)

// 자동 채움: 이름이 인지액·송달료로 시작하는 빈 변수만, 3천만원 이하는 소액 10회분
const fees = withCourtFees(['소가', '인지액 산정 필요', '송달료', '원고'], { 소가: '37,200,000원', 원고: 'A' }, { unitFee: 5_500 })
assert.equal(fees['인지액 산정 필요'], '172,400원')
assert.equal(fees['송달료'], '165,000원') // 3천만원 초과 → 2명 × 15회분 × 5,500원
assert.equal(fees['원고'], 'A')
assert.equal(withCourtFees(['소가', '송달료'], { 소가: '30,000,000' }, { unitFee: 5_500 })['송달료'], '110,000원')
assert.equal(withCourtFees(['소가', '인지액'], { 소가: '20,000,000', 인지액: '직접 입력' })['인지액'], '직접 입력')
assert.deepEqual(withCourtFees(['인지액'], {}), {}) // 소가가 없으면 그대로

console.log('ok')
