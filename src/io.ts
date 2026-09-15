import type { JSONContent } from '@tiptap/core'
import type { Values } from './variable'

// docx·mammoth·hwp-convert는 무거워서 쓸 때만 불러옴 (에디터 본체 번들엔 안 들어감)

type Run = { text: string; bold?: boolean; italics?: boolean; strike?: boolean; underline?: boolean; br?: boolean }
type Cell = { runs: Run[]; colspan: number; rowspan: number }
type Block =
  | { kind: 'title' | 'section' | 'article' | 'para'; label: string; depth: number; runs: Run[] }
  | { kind: 'table'; rows: Cell[][] }

const circled = (i: number) => (i < 20 ? String.fromCharCode(0x2460 + i) : `${i + 1}.`)

const HANGUL = '가나다라마바사아자차카타파하'
// CSS counter-style hangul(alphabetic)과 같은 규칙: 14 → 하, 15 → 가가
const hangulNum = (n: number) => {
  let s = ''
  for (; n > 0; n = Math.floor(n / 14)) s = HANGUL[--n % 14] + s
  return s
}
/** 번호 문단 단계별 표시: 1. → 가. → (1) → (가) (legal.css의 p[data-num]::before와 같게) */
const numLabel = (level: number, n: number) => [`${n}.`, `${hangulNum(n)}.`, `(${n})`, `(${hangulNum(n)})`][level - 1]

/** 에디터 JSON → 번호(제N조·①·1.)가 텍스트로 박힌 블록 목록. docx/hwpx/HTML 내보내기 공용 */
function flatten(doc: JSONContent, values: Values): Block[] {
  const out: Block[] = []
  let article = 0

  const runs = (nodes: JSONContent[] = []): Run[] =>
    nodes.map((n) => {
      if (n.type === 'hardBreak') return { text: '', br: true }
      if (n.type === 'variable') return { text: values[n.attrs!.name] || `[${n.attrs!.name}]` }
      const marks = new Set(n.marks?.map((m) => m.type))
      return { text: n.text ?? '', bold: marks.has('bold'), italics: marks.has('italic'), strike: marks.has('strike'), underline: marks.has('underline') }
    })
  const bold = (rs: Run[]) => rs.map((r) => ({ ...r, bold: true }))

  const list = (node: JSONContent, depth: number) =>
    node.content?.forEach((li, i) =>
      li.content?.forEach((child, j) => {
        if (child.type === 'orderedList' || child.type === 'bulletList') return list(child, depth + 1)
        const n = i + (node.attrs?.start ?? 1) // ②부터 시작한 목록(start=2)도 원문 번호대로
        const label = j > 0 ? '' : node.type === 'bulletList' ? '•' : depth === 0 ? circled(n - 1) : `${n}.`
        out.push({ kind: 'para', label, depth: depth + 1, runs: runs(child.content) })
      }),
    )

  const counts = [0, 0, 0, 0, 0] // 번호 문단 단계별 현재 번호
  const walk = (nodes: JSONContent[] = []) => {
    for (const n of nodes) {
      const level = n.type === 'heading' ? n.attrs?.level : 0
      const num: number | undefined = n.type === 'paragraph' ? n.attrs?.num : undefined
      if (level) counts.fill(0) // 제목·조·소제목에서 번호 다시 1부터 (legal.css와 같은 규칙)
      if (level === 1) out.push({ kind: 'title', label: '', depth: 0, runs: runs(n.content) })
      else if (level === 2) out.push({ kind: 'article', label: `제${++article}조`, depth: 0, runs: bold(runs(n.content)) })
      else if (level === 3) out.push({ kind: 'section', label: '', depth: 0, runs: bold(runs(n.content)) })
      else if (n.type === 'orderedList' || n.type === 'bulletList') list(n, 0)
      else if (num) {
        counts[num]++
        counts.fill(0, num + 1)
        out.push({ kind: 'para', label: numLabel(num, counts[num]), depth: num, runs: runs(n.content) })
      } else if (n.type === 'paragraph') out.push({ kind: 'para', label: '', depth: 0, runs: runs(n.content) })
      else if (n.type === 'table')
        out.push({
          kind: 'table',
          rows: (n.content ?? []).map((row) =>
            (row.content ?? []).map((cell) => ({
              // 셀 안 문단은 줄바꿈으로 이어 붙임
              runs: (cell.content ?? []).flatMap((p, i) => [...(i ? [{ text: '', br: true }] : []), ...runs(p.content)]),
              colspan: cell.attrs?.colspan ?? 1,
              rowspan: cell.attrs?.rowspan ?? 1,
            })),
          ),
        })
      else walk(n.content) // blockquote 등은 안쪽 문단만
    }
  }
  walk(doc.content)
  return out
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

const renderRuns = (rs: Run[]) =>
  rs
    .map((r) => {
      if (r.br) return '<br>'
      let s = esc(r.text)
      if (r.bold) s = `<b>${s}</b>`
      if (r.italics) s = `<i>${s}</i>`
      if (r.underline) s = `<u>${s}</u>`
      if (r.strike) s = `<s>${s}</s>`
      return s
    })
    .join('')

/** 번호가 텍스트로 박힌 독립 HTML — CSS 없이도 조·항·호가 보여서 메일·다른 변환기에 넘기기 좋음 */
export function toPlainHtml(doc: JSONContent, values: Values) {
  return flatten(doc, values)
    .map((b) => {
      if (b.kind === 'table') {
        const td = (c: Cell) =>
          `<td${c.colspan > 1 ? ` colspan="${c.colspan}"` : ''}${c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : ''}>${renderRuns(c.runs)}</td>`
        return `<table>${b.rows.map((r) => `<tr>${r.map(td).join('')}</tr>`).join('')}</table>`
      }
      const label = !b.label ? '' : b.kind === 'article' ? `<b>${b.label}</b> ` : `${b.label} `
      const body = label + renderRuns(b.runs)
      if (b.kind === 'title') return `<h1>${body}</h1>`
      if (b.kind === 'section') return `<h3>${body}</h3>`
      const indent = b.label ? b.depth - 1 : b.depth // 번호는 한 단계 바깥(내어쓰기 자리)에 둠
      return indent > 0 ? `<p style="margin-left:${indent * 2}em">${body}</p>` : `<p>${body}</p>`
    })
    .join('\n')
}

function titleOf(doc: JSONContent, values: Values) {
  for (const b of flatten(doc, values)) if (b.kind === 'title') return b.runs.map((r) => r.text).join('').trim() || '문서'
  return '문서'
}

/** 에디터 JSON(editor.getJSON()) + 입력값 → .docx Blob */
export async function toDocx(doc: JSONContent, values: Values): Promise<Blob> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx')
  const run = (r: Run) =>
    new TextRun({ text: r.text, break: r.br ? 1 : undefined, bold: r.bold, italics: r.italics, strike: r.strike, underline: r.underline ? {} : undefined })

  const children = flatten(doc, values).map((b) => {
    if (b.kind === 'table')
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: b.rows.map(
          (r) =>
            new TableRow({
              children: r.map((c) => new TableCell({ columnSpan: c.colspan, rowSpan: c.rowspan, children: [new Paragraph({ children: c.runs.map(run) })] })),
            }),
        ),
      })
    return new Paragraph({
      heading: b.kind === 'title' ? HeadingLevel.HEADING_1 : undefined,
      alignment: b.kind === 'section' ? AlignmentType.CENTER : undefined,
      spacing: b.kind === 'article' || b.kind === 'section' ? { before: 240 } : undefined,
      indent: b.depth ? { left: 400 * b.depth, hanging: b.label ? 400 : 0 } : undefined,
      children: [...(b.label ? [new TextRun({ text: `${b.label} `, bold: b.kind === 'article' })] : []), ...b.runs.map(run)],
    })
  })

  return Packer.toBlob(
    new Document({
      title: titleOf(doc, values),
      styles: {
        default: { document: { run: { font: '바탕', size: 22 } } },
        // 제목은 Word "제목 1" 스타일로 → 다시 열 때 h1로 복원됨
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            run: { bold: true, size: 32, color: '000000' },
            paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 400 } },
          },
        ],
      },
      sections: [{ children }],
    }),
  )
}

/** 에디터 JSON + 입력값 → .hwpx Blob (한글 2014 이상에서 열림) */
export async function toHwpx(doc: JSONContent, values: Values): Promise<Blob> {
  const { htmlToHwpx } = await import('hwp-convert')
  const bytes = await htmlToHwpx(toPlainHtml(doc, values), { title: titleOf(doc, values) })
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/hwp+zip' })
}

const ARTICLE = /^\s*제\s*\d+\s*조(?:의\s*\d+)?\s*/
const CLAUSE = /^\s*[①-⑳]\s*/
const ITEM = /^\s*(\d+)\.\s*/
const SECTION_NAMES = /^(청구취지|청구원인|신청취지|신청이유|고소취지|고소이유|고발취지|고발이유|입증방법|증명방법|증거방법|증거서류|첨부서류|당사자관계|사건개요|고소인|피고소인|범죄사실|증거자료|관련사건의수사및재판여부|기타)$/
// "청 구 취 지"처럼 4글자 이상을 띄워 쓴 짧은 줄, 또는 소장·고소장의 정해진 소제목
// (3글자는 "이 춘 효" 같은 서명란 이름과 겹쳐서 제외)
const isSection = (t: string) => t.length <= 20 && (/^[가-힣](\s+[가-힣]){3,7}$/.test(t) || SECTION_NAMES.test(t.replace(/\s/g, '')))
// [ 관할 법원 ] 같은 빈칸 표시 → {{관할 법원}} 변수. 숫자·=가 든 대괄호([= 계산식] 등)는 그대로 둠
// ponytail: 휴리스틱. 본문에 [짧은 한글] 표기를 쓰는 문서면 오인할 수 있음
const PLACEHOLDER = /\[\s*([^[\]{}<>"\d=]{1,20}?)\s*\]/g

const NUM_MARKERS: [RegExp, (s: string) => number][] = [
  [/^\s*(\d{1,2})\.(?!\d)\s*/, Number], // 1.  (2026. 같은 연도는 제외)
  [/^\s*([가나다라마바사아자차카타파하])\.\s*/, (s) => HANGUL.indexOf(s) + 1], // 가.
  [/^\s*\((\d{1,2})\)\s*/, Number], // (1)
  [/^\s*\(([가나다라마바사아자차카타파하])\)\s*/, (s) => HANGUL.indexOf(s) + 1], // (가)
]

function parseNumMarker(text: string) {
  for (const [i, [re, toN]] of NUM_MARKERS.entries()) {
    const m = text.match(re)
    if (m) return { level: i + 1, n: toN(m[1]), length: m[0].length }
  }
  return null
}

function stripPrefix(el: Element, re: RegExp | number) {
  let n = typeof re === 'number' ? re : el.textContent!.match(re)![0].length
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode() as Text | null; t && n > 0; t = walker.nextNode() as Text | null) {
    const cut = Math.min(n, t.data.length)
    t.data = t.data.slice(cut)
    n -= cut
  }
}

/**
 * 문단으로만 된 법률문서 HTML(한글·워드에서 온 것)을 에디터 구조로 정리.
 * - 빈 줄 문단 제거, 짧은 첫 줄 → 제목(h1), "청 구 취 지" 같은 소제목 → h3, [빈칸] → {{변수}}
 * - "제N조…" → 조(h2), 연속된 "①…" → 항(ol), 항 바로 뒤 "1. …" → 호(중첩 ol)
 * - 소장식 "1. / 가. / (1) / (가)" → 번호 문단(p[data-num]). 원문 번호가 자동 번호와 같을 때만 바꿈
 * ponytail: 원문 조 번호는 버리고 자동 번호로 다시 매김 (제3조의2 같은 가지번호는 순번으로 바뀜).
 *           "1)·가)" 형식은 아직 글자로 둠
 */
export function normalizeLegalHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const el of [...doc.body.children]) if (el.tagName === 'P' && !el.textContent!.trim() && !el.querySelector('img')) el.remove()

  const texts = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let t = texts.nextNode() as Text | null; t; t = texts.nextNode() as Text | null) {
    const block = t.parentElement?.closest('p,li,td,th,h1,h2,h3')?.textContent?.trim()
    // 한 줄 전체가 [ ... ]면 빈칸이 아니라 머리말([참고사항] 등)이라 그대로 둠
    t.data = t.data.replace(PLACEHOLDER, (m, name: string) => (m.trim() === block ? m : `{{${name.trim()}}}`))
  }

  // ponytail: 휴리스틱. 제목 없는 문서의 짧은 첫 줄도 제목이 될 수 있음
  const first = doc.body.firstElementChild
  const firstText = first?.textContent!.trim() ?? ''
  if (!doc.querySelector('h1') && first?.tagName === 'P' && firstText.length <= 30 && !/[.다]$/.test(firstText) && !ARTICLE.test(firstText)) {
    const h1 = doc.createElement('h1')
    h1.textContent = firstText
    first.replaceWith(h1)
  }

  let ol: HTMLOListElement | null = null
  const counts = [0, 0, 0, 0, 0] // 번호 문단 단계별 현재 번호 (flatten·legal.css와 같은 규칙)
  const runs = [0, 0, 0, 0, 0] // 단계별로 글자로 둔 채 이어지는 번호 (1.부터 다시 시작한 하위 목록)
  for (const el of [...doc.body.children]) {
    const text = el.textContent ?? ''
    // 한글 문서는 "○○경찰서      귀중"처럼 공백으로 줄을 맞춤 → 에디터처럼 한 칸으로 줄여서 판정 (다시 열어도 결과가 같게)
    const oneLine = text.replace(/\s+/g, ' ').trim()
    if (el.tagName === 'P' && isSection(oneLine)) {
      const h3 = doc.createElement('h3')
      h3.textContent = oneLine
      el.replaceWith(h3)
      ol = null
      counts.fill(0)
      runs.fill(0)
    } else if (el.tagName === 'P' && ARTICLE.test(text)) {
      const h2 = doc.createElement('h2')
      h2.innerHTML = el.innerHTML
      stripPrefix(h2, ARTICLE)
      el.replaceWith(h2)
      ol = null
      counts.fill(0)
      runs.fill(0)
    } else if (el.tagName === 'P' && CLAUSE.test(text)) {
      const n = text.trim().charCodeAt(0) - 0x245f // ① → 1
      // 사이에 다른 문단이 끼어 끊긴 목록은 원문 번호에서 다시 시작(② → start=2) — 번호가 ①로 되돌아가지 않게
      if (!ol || ol.children.length + Number(ol.getAttribute('start') ?? 1) !== n) {
        el.before((ol = doc.createElement('ol')))
        if (n > 1) ol.setAttribute('start', String(n))
      }
      stripPrefix(el, CLAUSE)
      const li = doc.createElement('li')
      li.append(el)
      ol.append(li)
    } else if (
      el.tagName === 'P' &&
      ol &&
      ITEM.test(text) &&
      Number(text.match(ITEM)![1]) === (ol.lastElementChild!.querySelector(':scope > ol')?.children.length ?? 0) + 1
    ) {
      const clause = ol.lastElementChild!
      const sub = clause.querySelector(':scope > ol') ?? clause.appendChild(doc.createElement('ol'))
      stripPrefix(el, ITEM)
      const li = doc.createElement('li')
      li.append(el)
      sub.append(li)
    } else {
      ol = null
      const m = el.tagName === 'P' ? parseNumMarker(text) : null
      if (!m) continue
      // 원문 번호가 자동으로 매길 번호와 딱 맞을 때만 변환 → 화면 번호가 원문과 항상 같음
      // (당사자란 "2. 이○○"처럼 중간부터 시작하거나 건너뛴 번호는 뜻이 바뀌니 글자로 둠)
      if (runs[m.level] && m.n === runs[m.level] + 1) {
        runs[m.level]++ // "가." 아래에서 1.부터 다시 쓴 하위 목록이 이어지는 중 → 계속 글자로 (3.이 1단계로 오인되지 않게)
      } else if (m.n === counts[m.level] + 1) {
        counts[m.level]++
        counts.fill(0, m.level + 1)
        runs.fill(0)
        stripPrefix(el, m.length)
        el.setAttribute('data-num', String(m.level))
      } else {
        runs[m.level] = m.n === 1 ? 1 : 0
      }
    }
  }
  return doc.body.innerHTML
}

/** .docx → 에디터용 HTML (서식은 문단·굵게·목록·표 수준으로 단순화됨) */
export async function fromDocx(file: Blob): Promise<string> {
  const { default: mammoth } = await import('mammoth')
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  return normalizeLegalHtml(value)
}

/** .hwp / .hwpx → 에디터용 HTML. .hwp는 hwpx로 바꾼 뒤 읽음 (암호화·배포용·HWP 3.0은 에러) */
export async function fromHwp(file: Blob): Promise<string> {
  const { detectFormat, hwpToHwpx, HwpxReader } = await import('hwp-convert')
  let bytes = new Uint8Array(await file.arrayBuffer())
  if (detectFormat(bytes) === 'hwp') bytes = new Uint8Array(await hwpToHwpx(bytes))
  const reader = new HwpxReader()
  await reader.loadFromArrayBuffer(bytes.buffer)
  return normalizeLegalHtml(await reader.extractHtml())
}

/** 확장자로 골라 여는 헬퍼: .docx / .hwp / .hwpx */
export function fromFile(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) return fromDocx(file)
  if (/\.hwpx?$/i.test(file.name)) return fromHwp(file)
  return Promise.reject(new Error('.docx, .hwp, .hwpx 파일만 열 수 있어요'))
}
