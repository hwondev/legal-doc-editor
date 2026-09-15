// 번호 매기기·이스케이프·hwpx 생성·인용 인식 확인 (DOM 없이 도는 부분만). 실행: npm run check
import assert from 'node:assert/strict'
import { toHwpx, toPlainHtml } from '../src/io.ts'
import { findCitations } from '../src/citation.ts'

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

// 위치와 링크 주소
const [law] = findCitations('위반하여 민법 제750조에 따라')
assert.deepEqual([law.from, law.to], [5, 13])
assert.equal(law.url, `https://www.law.go.kr/${['법령', '민법', '제750조'].map(encodeURIComponent).join('/')}`)
const [prec] = findCitations('대법원 2016. 4. 28. 선고 2015다12345 판결')
assert.equal(prec.url, `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent('2015다12345')}`)

// 인용은 화면에만 덧입히므로 내보내기 결과는 그대로여야 함
assert.equal(toPlainHtml({ type: 'doc', content: [p(t('민법 제750조'))] }, {}), '<p>민법 제750조</p>')

console.log('ok')
