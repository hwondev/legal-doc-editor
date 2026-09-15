// 번호 매기기·이스케이프·hwpx 생성·인용 인식 확인 (DOM 없이 도는 부분만). 실행: npm run check
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hwpToText } from 'hwp-convert'
import { parseMsDoc } from '@file-viewer/doc'
import { articleTitleLength, docBlocksToHtml, EVIDENCE_REF_GROUP, evidenceLabels, evidenceRefPieces, toHwp, toHwpx, toPlainHtml } from '../src/io.ts'
import { findCitations, formatCaseCitation } from '../src/citation.ts'
import { calcPaymentOrderStampFee, calcServiceFee, calcStampFee, SERVICE_UNIT_FEE, withCourtFees } from '../src/fees.ts'
import { formatAmount, parseAmount, toKoreanAmount } from '../src/amount.ts'
import { templates } from '../src/templates.ts'
import { clauses, groupClauses } from '../src/clauses.ts'

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

// 호증 문단: 당사자별로 문서 전체에서 이어 세고(소제목에서 1로 돌아가지 않음), 번호 문단 표시 뒤에 붙음
const ev = (party: string, text: string, level: number | null = null) => ({ type: 'paragraph', attrs: { num: level, evidence: party }, content: [t(text)] })
const evHtml = toPlainHtml(
  {
    type: 'doc',
    content: [
      ev('갑', '차용증', 1),
      p(t('참고')),
      ev('갑', '계좌이체 내역', 1),
      ev('을', '영수증'),
      { type: 'heading', attrs: { level: 3 }, content: [t('첨 부 서 류')] },
      ev('갑', '추가 증거', 1),
    ],
  },
  {},
)
assert.equal(
  evHtml,
  '<p>1. 갑 제1호증 차용증</p>\n<p>참고</p>\n<p>2. 갑 제2호증 계좌이체 내역</p>\n<p>을 제1호증 영수증</p>\n<h3><b>첨 부 서 류</b></h3>\n<p>1. 갑 제3호증 추가 증거</p>',
)

// 본문 호증 참조: 목록보다 앞에 있어도 가리키는 증거의 현재 번호로, 증거가 없어졌으면 참조에 남은 마지막 글자로
const ref = (id: string, label: string) => ({ type: 'evidenceRef', attrs: { id, label } })
const evid = (id: string, text: string) => ({ type: 'paragraph', attrs: { num: 1, evidence: '갑', evidenceId: id }, content: [t(text)] })
const refDoc = {
  type: 'doc',
  content: [
    p(t('빌려주었습니다('), ref('b', '갑 제9호증'), t(').')),
    p(ref('gone', '갑 제3호증'), t('의 기재')),
    evid('a', '차용증'),
    ol(li({ type: 'paragraph', attrs: { evidence: '갑', evidenceId: 'x' }, content: [t('항 안 문단은 세지 않음')] })),
    evid('b', '이체 내역'),
  ],
}
assert.deepEqual(evidenceLabels(refDoc), { a: '갑 제1호증', b: '갑 제2호증' })
assert.match(toPlainHtml(refDoc, {}), /^<p>빌려주었습니다\(갑 제2호증\)\.<\/p>\n<p>갑 제3호증의 기재<\/p>\n<p>1\. 갑 제1호증 차용증<\/p>/)

// 호증 시작 번호: 그 문단을 정한 번호로, 다음 호증은 이어서. 다른 당사자는 따로 1부터. 참조도 같은 번호
const startDoc = {
  type: 'doc',
  content: [
    p(ref('s5', ''), t(' 내지 '), { type: 'evidenceRef', attrs: { id: 's6', label: '', form: 'short' } }),
    { type: 'paragraph', attrs: { num: 1, evidence: '갑', evidenceId: 's5', evidenceStart: 5 }, content: [t('준비서면 첫 증거')] },
    { type: 'paragraph', attrs: { num: 1, evidence: '갑', evidenceId: 's6' }, content: [t('다음 증거')] },
    { type: 'paragraph', attrs: { evidence: '을', evidenceId: 'e1' }, content: [t('을은 따로')] },
  ],
}
assert.equal(
  toPlainHtml(startDoc, {}),
  '<p>갑 제5호증 내지 제6호증</p>\n<p>1. 갑 제5호증 준비서면 첫 증거</p>\n<p>2. 갑 제6호증 다음 증거</p>\n<p>을 제1호증 을은 따로</p>',
)
assert.deepEqual(evidenceLabels(startDoc), { s5: '갑 제5호증', s6: '갑 제6호증', e1: '을 제1호증' })

// 범위·나열 참조: 모양별 글자(전체·뒤쪽·번호만)가 각자 가리키는 증거의 현재 번호로
const formRef = (id: string, form: string) => ({ type: 'evidenceRef', attrs: { id, label: '', form } })
const formDoc = {
  type: 'doc',
  content: [
    p(formRef('a', 'full'), t(' 내지 '), formRef('b', 'short'), t(', 갑 제'), formRef('a', 'number'), t(', '), formRef('b', 'number'), t('호증')),
    evid('new', '새로 넣은 증거'),
    evid('a', '차용증'),
    evid('b', '이체 내역'),
  ],
}
assert.match(toPlainHtml(formDoc, {}), /^<p>갑 제2호증 내지 제3호증, 갑 제2, 3호증<\/p>/)

// 본문 참조 묶음 → 글자·참조 조각. 묶음 안 모든 번호의 증거가 있을 때만
const pieces = (s: string, max = 5) =>
  [...s.matchAll(EVIDENCE_REF_GROUP)].map((m) => {
    const ps = evidenceRefPieces(m, (_party, n) => n <= max)
    return ps && ps.map((x) => (typeof x === 'string' ? x : `<${x.form}:${x.party}${x.n}>`)).join('')
  })
assert.deepEqual(pieces('(갑 제3호증의 1)'), ['<full:갑3>']) // 가지번호는 참조 뒤 글자로
assert.deepEqual(pieces('갑 제1호증 내지 제3호증의 각 기재'), ['<full:갑1> 내지 <short:갑3>'])
assert.deepEqual(pieces('갑 제1호증 ~ 제2호증'), ['<full:갑1> ~ <short:갑2>'])
assert.deepEqual(pieces('갑 제1호증, 제2호증, 제4호증'), ['<full:갑1>, <short:갑2>, <short:갑4>'])
assert.deepEqual(pieces('을 제1, 2호증의 각 기재'), ['을 제<number:을1>, <number:을2>호증'])
assert.deepEqual(pieces('갑 제1 내지 3호증'), ['갑 제<number:갑1> 내지 <number:갑3>호증'])
assert.deepEqual(pieces('갑 제1호증, 갑 제2호증'), ['<full:갑1>', '<full:갑2>']) // 당사자를 다시 쓰면 각각
assert.deepEqual(pieces('갑 제1호증 내지 제9호증'), [null]) // 없는 증거가 섞이면 묶음 전체를 글자로
assert.deepEqual(pieces('갑 제1, 2호증의 1'), []) // 번호 나열 뒤 가지번호
assert.deepEqual(pieces('차용증을 제1호증으로'), []) // 조사

const hwpx = new Uint8Array(await (await toHwpx(doc, {})).arrayBuffer())
assert.deepEqual([...hwpx.slice(0, 2)], [0x50, 0x4b]) // zip

// .hwp 저장: HWP 5.0(CFB) 파일이 나오고, 다시 읽으면 번호·표·변수값까지 글자가 그대로
const wasm = readFileSync('node_modules/@rhwp/core/rhwp_bg.wasm')
const hwpBytes = new Uint8Array(await (await toHwp(doc, { 갑: '<갑&>' }, { wasm })).arrayBuffer())
assert.deepEqual([...hwpBytes.slice(0, 4)], [0xd0, 0xcf, 0x11, 0xe0]) // CFB(OLE) 서명
const noSpace = (s: string) => s.replace(/\s/g, '')
const expectedText = noSpace(toPlainHtml(doc, { 갑: '<갑&>' }).replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)))
assert.equal(noSpace(await hwpToText(hwpBytes)), expectedText)

// .doc 열기: 한 문단 블록 안의 단락 기호(\r)로 문단을 나누고, 표는 표로 (fixtures/sample.doc: 개인정보 없는 샘플)
const docHtml = docBlocksToHtml(parseMsDoc(new Uint8Array(readFileSync('scripts/fixtures/sample.doc'))).blocks)
assert.match(docHtml, /^<p>물품공급계약서 \(샘플\)<\/p><p>주식회사 예시상사/)
assert.match(docHtml, /<p>제1조\(목적\) 이 계약은 갑이 을에게/)
assert.match(docHtml, /<p>① 어느 당사자가 계약을 위반하면/)
assert.match(docHtml, /<p>1\. 파산·회생절차 개시 신청이 있는 경우<\/p><p>2\. 강제집행을 받은 경우<\/p>/)
assert.match(docHtml, /<table><tr><td>구분<\/td><td>금액<\/td><\/tr><tr><td>계약금<\/td><td>3,720,000원<\/td><\/tr><\/table>/)
assert.match(docHtml, /<p>납품 장소: \[ 납품 장소 \]<\/p><p>2026\. 9\. 15\.<\/p>$/)

// 불러오기: "제N조"를 뗀 나머지에서 조 제목 길이 (나머지는 본문 문단으로 감)
assert.equal(articleTitleLength('(목적) 이 계약은 목적으로 한다.'), '(목적)'.length)
assert.equal(articleTitleLength(' (목적)'), ' (목적)'.length)
assert.equal(articleTitleLength('(손해배상(지연)) 본문'), '(손해배상(지연))'.length)
assert.equal(articleTitleLength('【목적】 본문'), '【목적】'.length)
assert.equal(articleTitleLength('(목적 이 괄호는 닫히지 않는다'), 0)
assert.equal(articleTitleLength('목적'), '목적'.length) // 괄호 없는 짧은 제목은 전체
assert.equal(articleTitleLength('갑은 을에게 물품을 공급한다.'), 0) // 문장은 제목 없음

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

// 지급명령: 인지대는 소장의 1/10(같은 끝자리 처리), 송달료는 당사자 수 × 6회분
assert.equal(calcPaymentOrderStampFee(3_000_000), 1_500) // 생활법령정보 예시: (3,000,000 × 0.005) × 0.1
assert.equal(calcPaymentOrderStampFee(1_000_000), 1_000) // 500원 → 최저 1천원
assert.equal(calcPaymentOrderStampFee(37_200_000), 17_200) // 17,240원 → 100원 미만 버림
assert.equal(calcPaymentOrderStampFee(0), 0)
assert.equal(calcServiceFee({ parties: 2, procedure: '독촉', unitFee: 5_500 }), 66_000)
const orderNames = ['청구금액', '독촉절차 인지대', '독촉절차 송달료', '독촉절차비용']
const order = withCourtFees(orderNames, { 청구금액: '3,000,000원' }, { unitFee: 5_500 })
assert.deepEqual([order['독촉절차 인지대'], order['독촉절차 송달료'], order['독촉절차비용']], ['1,500원', '66,000원', '67,500원'])
const typed = withCourtFees(orderNames, { 청구금액: '3,000,000원', '독촉절차 인지대': '2,000원' }, { unitFee: 5_500 })
assert.deepEqual([typed['독촉절차 인지대'], typed['독촉절차비용']], ['2,000원', '68,000원']) // 직접 입력한 값을 합계에 사용
assert.deepEqual(withCourtFees(['청구금액', '인지액'], { 청구금액: '3,000,000' }), { 청구금액: '3,000,000' }) // 소장에는 영향 없음

// 금액 한글 표기: "일"을 빼지 않음(일만·일십), 빈 자리·빈 묶음은 건너뜀
assert.equal(toKoreanAmount(37_200_000), '삼천칠백이십만')
assert.equal(toKoreanAmount(410_000_000), '사억일천만')
assert.equal(toKoreanAmount(10_000), '일만')
assert.equal(toKoreanAmount(100_000_000), '일억')
assert.equal(toKoreanAmount(1_000_000_000_000), '일조')
assert.equal(toKoreanAmount(100_010_001), '일억일만일')
assert.equal(toKoreanAmount(11), '일십일')
assert.equal(toKoreanAmount(0), '영')
assert.throws(() => toKoreanAmount(1.5))
assert.equal(formatAmount(37_200_000), '금 37,200,000원')
assert.equal(formatAmount(37_200_000, '계약서'), '금 삼천칠백이십만 원정(₩37,200,000)')
assert.equal(parseAmount('금 37,200,000원'), 37_200_000)
assert.equal(parseAmount('금액 미정'), 0)

// 문서 템플릿: 제목·변수가 있고, 실제 주민등록번호·전화번호 형식이 들어가지 않음
assert.deepEqual(
  templates.map((t) => t.id),
  ['complaint-loan', 'complaint-debt-nonexistence', 'debt-nonexistence-certificate', 'criminal-complaint-fraud', 'certified-letter', 'payment-order'],
)
for (const t of templates) {
  assert.match(t.html, /<h1>[^<]+<\/h1>/, t.id)
  assert.match(t.html, /\{\{[^{}]+\}\}/, t.id)
  assert.doesNotMatch(t.html, /\d{6}-\d{7}|01[016789]-\d{3,4}-\d{4}/, t.id)
  // 본문 호증 참조는 문서 안에 있는 호증 문단 id를 가리켜야 함
  for (const [, id] of t.html.matchAll(/data-evidence-ref="([^"]+)"/g)) assert.ok(t.html.includes(`data-evidence-id="${id}"`), `${t.id}: ${id}`)
}
// 지급명령은 인지액이 소장의 10분의 1이라, 소장 기준 autoFees가 채우는 이름(인지액…·송달료…)을 쓰지 않음
assert.doesNotMatch(templates.find((t) => t.id === 'payment-order')!.html, /\{\{(인지액|인지대|송달료)/)
// 지급명령 템플릿의 변수 이름이 자동 채움 규칙과 맞아야 함
for (const name of ['청구금액', '독촉절차 인지대', '독촉절차 송달료', '독촉절차비용']) {
  assert.ok(templates.find((t) => t.id === 'payment-order')!.html.includes(`{{${name}}}`), name)
}

// 판례 검색 결과 → 인용 문구. 넣은 문구가 다시 인용으로 인식돼야 링크가 붙음
const found = { court: '대법원', date: '20160428', caseNo: '2015다12345', title: '예시', url: 'https://www.law.go.kr' }
assert.equal(formatCaseCitation(found), '대법원 2016. 4. 28. 선고 2015다12345 판결')
assert.equal(formatCaseCitation({ ...found, date: '2016-04-28', kind: '판결' }), '대법원 2016. 4. 28. 선고 2015다12345 판결')
const decision = { ...found, date: '2020.01.09', caseNo: '2019마123', kind: '결정' }
assert.equal(formatCaseCitation(decision), '대법원 2020. 1. 9.자 2019마123 결정')
assert.deepEqual(cites(formatCaseCitation(found)), ['case:대법원 2016. 4. 28. 선고 2015다12345 판결'])
assert.deepEqual(cites(formatCaseCitation(decision)), ['case:대법원 2020. 1. 9.자 2019마123 결정'])

// 조항 라이브러리: id 중복 없음, 조 하나로 시작, 조 번호 숫자(자동 번호와 겹침)·개인정보 형식 없음
assert.equal(new Set(clauses.map((c) => c.id)).size, clauses.length)
for (const c of clauses) {
  assert.match(c.html, /^<h2>\([^<]+\)<\/h2>/, c.id)
  assert.equal(c.html.match(/<h2>/g)!.length, 1, c.id)
  assert.doesNotMatch(c.html, /제\s*\d+\s*조/, c.id)
  assert.doesNotMatch(c.html, /\d{6}-\d{7}|01[016789]-\d{3,4}-\d{4}/, c.id)
}

// 조항 분류별 보기: 분류는 처음 나온 순, 분류 선택·검색·조합, 빈 묶음은 빠짐
const ids = (groups: ReturnType<typeof groupClauses>) => groups.map(([cat, items]) => [cat, items.map((c) => c.id)])
assert.deepEqual(groupClauses(clauses).map(([cat]) => cat), [...new Set(clauses.map((c) => c.category))])
assert.equal(groupClauses(clauses).flatMap(([, items]) => items).length, clauses.length)
assert.deepEqual(ids(groupClauses(clauses, { category: '책임' })), [['책임', ['damages', 'force-majeure']]])
assert.deepEqual(ids(groupClauses(clauses, { query: '해지' })), [['종료', ['termination']]])
assert.deepEqual(groupClauses(clauses, { category: '분쟁', query: '해지' }), [])

console.log('ok')
