// 번호 매기기·이스케이프·hwpx 생성 확인 (DOM 없이 도는 부분만). 실행: npm run check
import assert from 'node:assert/strict'
import { toHwpx, toPlainHtml } from '../src/io.ts'

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

console.log('ok')
