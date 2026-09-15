import type { JSONContent } from '@tiptap/core'
import type { MsDocBlock } from '@file-viewer/doc'
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

/** 호증 표시 "갑 제2호증" */
export const evidenceText = (party: string, n: number) => `${party} 제${n}호증`
// 항·호·표 안 문단은 호증 번호를 세지 않음 (flatten의 walk가 이 노드들 안 문단을 번호 문단으로 보지 않는 것과 같은 범위)
export const EVIDENCE_SKIP = ['orderedList', 'bulletList', 'table']

export type RefForm = 'full' | 'short' | 'number'
/** 본문 참조 모양별 글자: full "갑 제2호증" / short "제2호증"(범위·나열의 뒤쪽) / number "2"("갑 제1, 2호증"의 번호) */
export const refText = (party: string, n: number, form: RefForm = 'full') =>
  form === 'short' ? `제${n}호증` : form === 'number' ? String(n) : evidenceText(party, n)

/** 에디터 JSON → 호증 문단 id별 당사자와 현재 번호 { id: { party: '갑', n: 2 } } (legal.css 카운터와 같은 규칙) */
export function evidenceNumbers(doc: JSONContent): Record<string, { party: string; n: number }> {
  const numbers: Record<string, { party: string; n: number }> = {}
  const counts: Record<string, number> = {}
  const walk = (nodes: JSONContent[] = []) => {
    for (const n of nodes) {
      if (EVIDENCE_SKIP.includes(n.type!)) continue
      if (n.type !== 'paragraph') {
        walk(n.content)
        continue
      }
      const party: string | undefined = n.attrs?.evidence
      if (!party) continue
      counts[party] = n.attrs?.evidenceStart ?? (counts[party] ?? 0) + 1
      if (n.attrs?.evidenceId) numbers[n.attrs.evidenceId] = { party, n: counts[party] }
    }
  }
  walk(doc.content)
  return numbers
}

/** 에디터 JSON → 호증 문단 id별 현재 표시 { id: '갑 제2호증' } */
export const evidenceLabels = (doc: JSONContent): Record<string, string> =>
  Object.fromEntries(Object.entries(evidenceNumbers(doc)).map(([id, e]) => [id, evidenceText(e.party, e.n)]))

/** 에디터 JSON → 번호(제N조·①·1.)가 텍스트로 박힌 블록 목록. docx/hwpx/HTML 내보내기 공용 */
function flatten(doc: JSONContent, values: Values): Block[] {
  const out: Block[] = []
  let article = 0
  const refNumbers = evidenceNumbers(doc) // 본문 호증 참조 → 가리키는 증거의 현재 번호 (증거가 없어졌으면 참조에 남은 마지막 글자)

  const runs = (nodes: JSONContent[] = []): Run[] =>
    nodes.map((n) => {
      if (n.type === 'hardBreak') return { text: '', br: true }
      if (n.type === 'variable') return { text: values[n.attrs!.name] || `[${n.attrs!.name}]` }
      if (n.type === 'evidenceRef') {
        const e = refNumbers[n.attrs!.id]
        return { text: e ? refText(e.party, e.n, n.attrs!.form) : (n.attrs!.label ?? '') }
      }
      const marks = new Set(n.marks?.map((m) => m.type))
      return { text: n.text ?? '', bold: marks.has('bold'), italics: marks.has('italic'), strike: marks.has('strike'), underline: marks.has('underline') }
    })
  const bold = (rs: Run[]) => rs.map((r) => ({ ...r, bold: true }))
  const evidence: Record<string, number> = {} // 호증 번호: 당사자(갑·을·병)별로 문서 전체에서 이어 셈 (legal.css와 같은 규칙)
  // 문단 글자. 호증 문단이면 "갑 제N호증 "을 앞에 박음
  const para = (n: JSONContent): Run[] => {
    const party: string | undefined = n.attrs?.evidence
    if (!party) return runs(n.content)
    evidence[party] = n.attrs?.evidenceStart ?? (evidence[party] ?? 0) + 1 // 시작 번호가 있으면 그 번호부터
    return [{ text: `${evidenceText(party, evidence[party])} ` }, ...runs(n.content)]
  }

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
        out.push({ kind: 'para', label: numLabel(num, counts[num]), depth: num, runs: para(n) })
      } else if (n.type === 'paragraph') out.push({ kind: 'para', label: '', depth: 0, runs: para(n) })
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

let rhwp: Promise<typeof import('@rhwp/core')> | undefined

/**
 * 에디터 JSON + 입력값 → .hwp(HWP 5.0) Blob. toHwpx 결과를 @rhwp/core(WASM, 약 10MB — 처음 저장할 때만 불러옴)로 변환
 * `wasm`: WASM 파일 주소나 바이트. 번들러가 WASM 경로를 못 찾을 때 넘김 (예: public에 복사한 '/rhwp_bg.wasm')
 * ponytail: 한글 프로그램에서 열리는지는 사람이 확인해야 함 — 여기선 hwp-convert로 다시 읽어 글자·구조만 검증함
 */
export async function toHwp(doc: JSONContent, values: Values, opts: { wasm?: string | URL | BufferSource } = {}): Promise<Blob> {
  const hwpx = new Uint8Array(await (await toHwpx(doc, values)).arrayBuffer())
  rhwp ??= import('@rhwp/core').then(async (m) => {
    await m.default(opts.wasm === undefined ? undefined : { module_or_path: opts.wasm })
    return m
  })
  const { HwpDocument } = await rhwp.catch((err) => {
    rhwp = undefined // 다음 저장 때 다시 시도
    throw err
  })
  const converted = new HwpDocument(hwpx)
  try {
    return new Blob([converted.exportHwp() as Uint8Array<ArrayBuffer>], { type: 'application/x-hwp' })
  } finally {
    converted.free()
  }
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
// 입증방법 아래 "갑 제N호증". 가지번호(제1호증의 1, 제2호증 1내지 5)·범위(제1호증 내지 제3호증, 제1호증, 제2호증)는 번호를 매기면 뜻이 바뀌어 제외
const EVIDENCE = /^\s*([갑을병])\s*제\s*(\d+)\s*호증(?!\s*(?:의|내지|[~～,\d]))\s*/
const EVIDENCE_SECTIONS = /^(입증방법|증명방법|증거방법)$/
// 본문 호증 참조 묶음: "갑 제1호증" / "갑 제1호증 내지 제3호증" / "갑 제1호증, 제2호증" (2·3번 그룹)
//   / "갑 제1, 2호증" / "갑 제1 내지 3호증" (4·5번 그룹, 번호만 나열 — 뒤에 "의 1" 가지번호가 붙으면 제외)
// 앞 글자가 한글이면 조사("차용증을 제1호증")라 제외
const REF_SEP = String.raw`\s*(?:,|내지|[~～])\s*`
export const EVIDENCE_REF_GROUP = new RegExp(
  String.raw`(?<![가-힣])([갑을병])\s*제\s*(?:(\d+)\s*호증((?:${REF_SEP}제\s*\d+\s*호증)*)|(\d+)((?:${REF_SEP}\d+)+)\s*호증(?!\s*의\s*\d))`,
  'g',
)

export type RefPiece = string | { party: string; n: number; form: RefForm }

/**
 * 참조 묶음 매치(EVIDENCE_REF_GROUP) → 글자·참조 조각. 예: "갑 제1, 2호증" → ["갑 제", {n:1,number}, ", ", {n:2,number}, "호증"]
 * 묶음 안 모든 번호가 exists를 만족할 때만 돌려줌 — 일부만 참조가 되면 번호가 바뀔 때 범위 뜻이 틀어짐
 */
export function evidenceRefPieces(m: RegExpMatchArray, exists: (party: string, n: number) => boolean): RefPiece[] | null {
  const party = m[1]
  const compact = m[4] !== undefined
  const pieces: RefPiece[] = compact ? [`${party} 제`, { party, n: Number(m[4]), form: 'number' }] : [{ party, n: Number(m[2]), form: 'full' }]
  for (const [, sep, n] of (compact ? m[5] : m[3]).matchAll(/(\s*(?:,|내지|[~～])\s*)(?:제\s*)?(\d+)(?:\s*호증)?/g))
    pieces.push(sep, { party, n: Number(n), form: compact ? 'number' : 'short' })
  if (compact) pieces.push('호증')
  return pieces.every((p) => typeof p === 'string' || (p.n >= 1 && exists(p.party, p.n))) ? pieces : null
}

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

const OPEN_BRACKETS = '(（[【〔'
const CLOSE_BRACKETS = ')）]】〕'

/**
 * "제N조"를 뗀 나머지에서 조 제목이 차지하는 글자 수.
 * - 괄호 제목 "(목적) 본문" → 괄호까지 (괄호 안 괄호도 짝을 셈)
 * - 괄호 없는 짧은 한 줄 "목적" → 전체
 * - 괄호 없이 문장 "갑은 …한다." → 0 (제목 없음, 전부 본문)
 */
export function articleTitleLength(text: string): number {
  const lead = text.length - text.trimStart().length
  const s = text.trimStart()
  if (OPEN_BRACKETS.includes(s[0] ?? '_')) {
    let depth = 0
    for (let i = 0; i < Math.min(s.length, 60); i++) {
      if (OPEN_BRACKETS.includes(s[i])) depth++
      else if (CLOSE_BRACKETS.includes(s[i]) && --depth === 0) return lead + i + 1
    }
    return 0 // 괄호가 닫히지 않거나 너무 길면 제목으로 보지 않음
  }
  return s.trim().length <= 20 && !/[.다]$/.test(s.trim()) ? text.length : 0
}

// 요소 앞쪽 n글자를 떼어 냄 (굵게 같은 감싼 태그는 양쪽에 복제되어 유지)
function takeLeadingText(el: Element, n: number): DocumentFragment {
  const range = el.ownerDocument.createRange()
  range.setStart(el, 0)
  range.setEnd(el, el.childNodes.length)
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let rest = n
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    if (rest <= t.data.length) {
      range.setEnd(t, rest)
      break
    }
    rest -= t.data.length
  }
  return range.extractContents()
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
 * - 입증방법 아래 "갑 제N호증" → 호증 문단(p[data-evidence]). 역시 자동 번호와 같을 때만. 본문의 같은 표기는 그 증거를 가리키는 참조(span[data-evidence-ref])로
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
  const evidence: Record<string, number> = {} // 당사자별 호증 번호 (flatten·legal.css와 같은 규칙: 문서 전체에서 이어 셈)
  const firstEvidence: Record<string, number> = {} // 당사자별 첫 호증 번호 (준비서면은 5부터일 수 있음)
  let inEvidence = false // 입증방법 소제목 아래인지
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
      inEvidence = EVIDENCE_SECTIONS.test(oneLine.replace(/\s/g, ''))
    } else if (el.tagName === 'P' && ARTICLE.test(text)) {
      inEvidence = false
      stripPrefix(el, ARTICLE)
      // "제1조(목적) 이 계약은…"처럼 제목과 본문이 한 문단이면 제목만 조(h2)로, 본문은 바로 다음 문단으로 (서식 유지)
      const h2 = doc.createElement('h2')
      h2.append(takeLeadingText(el, articleTitleLength(el.textContent ?? '')))
      stripPrefix(el, /^\s*/)
      el.replaceWith(h2)
      if (el.textContent!.trim()) h2.after(el)
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
      if (/^H[1-3]$/.test(el.tagName)) {
        // 이미 제목 태그로 온 소제목(워드 제목 스타일 등)에서도 번호를 1부터 다시 (flatten과 같은 규칙)
        counts.fill(0)
        runs.fill(0)
        inEvidence = EVIDENCE_SECTIONS.test(oneLine.replace(/\s/g, ''))
      }
      if (el.tagName !== 'P') continue
      const m = parseNumMarker(text)
      // 원문 번호가 자동으로 매길 번호와 딱 맞을 때만 변환 → 화면 번호가 원문과 항상 같음
      // (당사자란 "2. 이○○"처럼 중간부터 시작하거나 건너뛴 번호는 뜻이 바뀌니 글자로 둠)
      if (!m) {
        // 번호 표시 없는 문단
      } else if (runs[m.level] && m.n === runs[m.level] + 1) {
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
      // 번호 표시를 뗀 뒤 "갑 제N호증"으로 시작하면 호증 문단으로. 번호가 글자로 남은 문단은 "3. 갑…"이라 걸리지 않음
      // 그 당사자의 첫 호증은 번호가 1이 아니어도 시작 번호로 받음(준비서면의 "갑 제5호증"부터), 다음부터는 차례대로일 때만
      const ev = inEvidence ? el.textContent!.match(EVIDENCE) : null
      const evN = ev ? Number(ev[2]) : 0
      if (ev && evN >= 1 && (evidence[ev[1]] === undefined || evN === evidence[ev[1]] + 1)) {
        if (evidence[ev[1]] === undefined) {
          firstEvidence[ev[1]] = evN
          if (evN > 1) el.setAttribute('data-evidence-start', String(evN))
        }
        evidence[ev[1]] = evN
        stripPrefix(el, ev[0].length)
        el.setAttribute('data-evidence', ev[1])
        el.setAttribute('data-evidence-id', `ev-${ev[1]}-${evN}`)
      }
    }
  }

  // 본문의 "갑 제N호증" → 호증 참조(span[data-evidence-ref]). 자동 번호로 바꾼 증거가 있을 때만 → 증거 번호가 바뀌면 참조도 따라감
  // 범위·나열("갑 제1호증 내지 제3호증", "갑 제1, 2호증")은 번호마다 참조로, 묶음 안에 없는 증거가 있으면 전체를 글자로
  const refTexts: Text[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) refTexts.push(t)
  for (const t of refTexts) {
    const frag = doc.createDocumentFragment()
    let last = 0
    for (const m of t.data.matchAll(EVIDENCE_REF_GROUP)) {
      // 목록에 있는 번호만 (갑 제5호증부터인 준비서면에서 앞 서면의 "갑 제1호증"은 글자로)
      const pieces = evidenceRefPieces(m, (party, n) => n >= (firstEvidence[party] ?? Infinity) && n <= evidence[party])
      if (!pieces) continue
      frag.append(t.data.slice(last, m.index))
      for (const piece of pieces) {
        if (typeof piece === 'string') {
          frag.append(piece)
          continue
        }
        const span = doc.createElement('span')
        span.setAttribute('data-evidence-ref', `ev-${piece.party}-${piece.n}`)
        if (piece.form !== 'full') span.setAttribute('data-form', piece.form)
        span.textContent = refText(piece.party, piece.n, piece.form)
        frag.append(span)
      }
      last = m.index! + m[0].length
    }
    if (last) {
      frag.append(t.data.slice(last))
      t.replaceWith(frag)
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

/** .doc(Word 97–2003) → 에디터용 HTML. @file-viewer/doc로 읽고 글자·표만 옮김 */
export async function fromDoc(file: Blob): Promise<string> {
  const { parseMsDoc } = await import('@file-viewer/doc')
  const parsed = parseMsDoc(new Uint8Array(await file.arrayBuffer()))
  return normalizeLegalHtml(docBlocksToHtml(parsed.blocks))
}

// Word 제어문자 정리: 단락 기호(\r)·줄 바꿈(\v)은 호출하는 쪽에서 처리하고 나머지(셀 끝 표시 등)는 지움
const cleanDocText = (s: string) => s.replace(/[\x00-\x08\x0c\x0e-\x1f]/g, '')

/**
 * .doc 파싱 결과 → 단순 HTML. 한 문단 블록 안에 단락 기호(\r)로 여러 문단이 붙어 오는 경우가 있어 \r로 나누고, \v(줄 바꿈)는 <br>로
 * ponytail: 글자 서식(굵게 등)·그림은 옮기지 않음 — 필요하면 inlines의 글자 속성을 읽어 확장
 */
export function docBlocksToHtml(blocks: MsDocBlock[]): string {
  const paragraphs = (text: string) =>
    cleanDocText(text)
      .split('\r')
      .filter((t) => t.trim())
      .map((t) => `<p>${esc(t).replace(/\v/g, '<br>')}</p>`)
      .join('')
  return blocks
    .map((b) => {
      if (b.type === 'paragraph') return paragraphs(b.text)
      if (b.type !== 'table') return '' // 첨부 등은 옮기지 않음
      const cell = (c: (typeof b.rows)[number]['cells'][number]) =>
        `<td${(c.colspan ?? 1) > 1 ? ` colspan="${c.colspan}"` : ''}${(c.rowspan ?? 1) > 1 ? ` rowspan="${c.rowspan}"` : ''}>${c.paragraphs
          .map((p) => esc(cleanDocText(p.text).replace(/[\r\v]/g, '')))
          .filter(Boolean)
          .join('<br>')}</td>`
      return `<table>${b.rows.map((r) => `<tr>${r.cells.filter((c) => !c.hidden).map(cell).join('')}</tr>`).join('')}</table>`
    })
    .join('')
}

/** 확장자로 골라 여는 헬퍼: .docx / .doc / .hwp / .hwpx */
export function fromFile(file: File): Promise<string> {
  if (/\.docx$/i.test(file.name)) return fromDocx(file)
  if (/\.doc$/i.test(file.name)) return fromDoc(file)
  if (/\.hwpx?$/i.test(file.name)) return fromHwp(file)
  return Promise.reject(new Error('.docx, .doc, .hwp, .hwpx 파일만 열 수 있어요'))
}
