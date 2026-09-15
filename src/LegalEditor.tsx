import { Fragment, useEffect, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { Variable, toChips, type Values } from './variable'
import { Numbering } from './numbering'
import { EvidenceRef } from './evidence'
import { CitationLink, formatCaseCitation, type CaseResult } from './citation'
import { groupClauses, type Clause } from './clauses'
import type { Template } from './templates'
import { withCourtFees, type CourtFeeOptions } from './fees'
import { formatAmount, parseAmount } from './amount'
import { fromFile, toDocx, toHwp, toHwpx } from './io'
import './legal.css'

export interface LegalEditorProps {
  /** 템플릿 HTML. {{변수}} 텍스트는 변수로 바뀜 */
  content?: string
  /** 초기 입력값 */
  values?: Values
  onChange?: (html: string) => void
  onValuesChange?: (values: Values) => void
  editable?: boolean
  /** 입력값에 `소가`(소장)나 `청구금액`(지급명령)이 있으면 인지액·송달료 변수를 계산해 채움. 첨부서류 `입증방법 통수`·`소장 부본 통수`는 상대방 수로 채움 (직접 입력한 값이 우선, 참고용) */
  autoFees?: boolean | CourtFeeOptions
  /** 판례 검색 함수. 넘기면 오른쪽에 판례 검색 칸이 생기고, 결과를 누르면 인용 문구가 커서 위치에 들어감 */
  searchCases?: (query: string) => Promise<CaseResult[]>
  /** 조항 목록. 넘기면 오른쪽에 조항 라이브러리가 생기고, 누르면 커서 위치에 조항이 들어감 (기본 제공 목록: `clauses`) */
  clauses?: Clause[]
  /** 템플릿 목록. 넘기면 오른쪽에 템플릿 목록(검색·분류)이 생기고, 누르면 문서를 그 템플릿으로 바꿈 (기본 제공 목록: `templates`) */
  templates?: Template[]
  /** .hwp 저장에 쓰는 @rhwp/core WASM 주소. 번들러가 WASM 경로를 못 찾을 때만 지정 (예: '/rhwp_bg.wasm') */
  hwpWasmUrl?: string
}

function varNames(editor: Editor) {
  const names = new Set<string>()
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'variable') names.add(n.attrs.name)
  })
  return [...names]
}

// ponytail: 페이지 전체 print를 CSS로 .legal-doc만 보이게 함. 서버 PDF/DOCX 필요하면 fillTemplate 결과로 별도 변환
function printDoc() {
  const root = document.documentElement
  root.classList.add('le-printing')
  window.addEventListener('afterprint', () => root.classList.remove('le-printing'), { once: true })
  window.print()
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// 패널 목록 (템플릿·조항 라이브러리): 검색칸(분류·제목), 분류 칩(개수), 분류별 묶음. 누르면 onPick
function Library<T extends { id: string; title: string; category: string }>({
  title,
  items,
  placeholder,
  empty,
  disabled,
  itemTitle,
  onPick,
}: {
  title: string
  items: T[]
  placeholder: string
  empty: string
  disabled: boolean
  itemTitle: (item: T) => string
  onPick: (item: T) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('') // '' = 전체
  const groups = groupClauses(items, { category, query })
  return (
    <details className="le-clauses" open>
      <summary>{title}</summary>
      <input value={query} placeholder={placeholder} aria-label={`${title} 찾기`} onChange={(e) => setQuery(e.target.value)} />
      <div className="le-clause-cats" role="group" aria-label={`${title} 분류`}>
        {['', ...new Set(items.map((item) => item.category))].map((cat) => (
          <button key={cat || '전체'} type="button" aria-pressed={category === cat} onClick={() => setCategory(cat)}>
            {cat || '전체'} <span>{cat ? items.filter((item) => item.category === cat).length : items.length}</span>
          </button>
        ))}
      </div>
      <ul className="le-clause-list">
        {groups.map(([cat, list]) => (
          <Fragment key={cat}>
            {!category && <li className="le-clause-group">{cat}</li>}
            {list.map((item) => (
              <li key={item.id}>
                <button type="button" disabled={disabled} title={itemTitle(item)} onClick={() => onPick(item)}>
                  {item.title}
                </button>
              </li>
            ))}
          </Fragment>
        ))}
      </ul>
      {groups.length === 0 && <p className="le-hint">{empty}</p>}
    </details>
  )
}

export function LegalEditor({ content = '', values: initial = {}, onChange, onValuesChange, editable = true, autoFees, searchCases, clauses, templates, hwpWasmUrl }: LegalEditorProps) {
  const [values, setValues] = useState(initial)
  const [names, setNames] = useState<string[]>([])
  const [caseQuery, setCaseQuery] = useState('')
  const [cases, setCases] = useState<CaseResult[] | null>(null)
  const [caseStatus, setCaseStatus] = useState('')
  // 화면·저장에 쓰는 값 = 입력값 + (autoFees면) 비어 있는 인지액·송달료 계산값
  const shown = autoFees ? withCourtFees(names, values, autoFees === true ? {} : autoFees) : values

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), TableKit, Variable, Numbering, EvidenceRef, CitationLink],
    content: toChips(content),
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'legal-doc' } },
    onCreate: ({ editor }) => setNames(varNames(editor)),
    onUpdate: ({ editor }) => {
      setNames(varNames(editor))
      onChange?.(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.storage.variable.values = shown
    editor.storage.variable.views.forEach((update) => update())
  }, [editor, shown])

  const setValue = (name: string, v: string) => {
    const next = { ...values, [name]: v }
    setValues(next)
    onValuesChange?.(next)
  }

  const insertVar = () => {
    const name = window.prompt('변수 이름 (예: 갑, 계약일)')?.replace(/[{}<>"]/g, '').trim()
    if (name) editor?.chain().focus().insertContent({ type: 'variable', attrs: { name } }).run()
  }

  const openFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    try {
      editor.commands.setContent(toChips(await fromFile(file)), { emitUpdate: true })
    } catch (err) {
      window.alert(`파일을 열 수 없어요: ${(err as Error).message}`)
    }
  }

  // 템플릿으로 시작: 작성한 내용이 있으면 먼저 물어봄. 바꾼 뒤에도 되돌리기(Ctrl·⌘+Z)로 돌아올 수 있음. 입력값은 그대로 둠(같은 이름 변수에 이어서 쓰임)
  const startTemplate = (template: Template) => {
    if (!editor) return
    if (!editor.isEmpty && !window.confirm(`지금 문서를 「${template.title}」 템플릿으로 바꿀까요? 되돌리기(Ctrl·⌘+Z)로 돌아올 수 있어요.`)) return
    editor.chain().focus().setContent(toChips(template.html), { emitUpdate: true }).run()
  }

  const save = async (to: typeof toDocx, ext: string) => {
    const title = editor!.state.doc.firstChild?.textContent.trim() || '문서'
    try {
      download(await to(editor!.getJSON(), shown), `${title}.${ext}`)
    } catch (err) {
      window.alert(`저장하지 못했어요: ${(err as Error).message}`)
    }
  }

  // ponytail: 늦게 도착한 이전 검색 결과가 덮어쓸 수 있음 — 필요해지면 요청 번호로 막기
  const runCaseSearch = async () => {
    const q = caseQuery.trim()
    if (!searchCases || !q) return
    setCaseStatus('검색 중…')
    try {
      const found = await searchCases(q)
      // 목록이 아닌 값이 오면 패널만 안내를 띄움 — 그대로 그리면 에디터 전체가 무너짐 (연결 설정이 잘못된 경우)
      if (!Array.isArray(found)) throw new Error('검색 결과 형식이 올바르지 않아요')
      setCases(found)
      setCaseStatus('')
    } catch (err) {
      setCases(null)
      setCaseStatus(`검색하지 못했어요: ${(err as Error).message}`)
    }
  }

  const cmd = () => editor!.chain().focus()
  const toggleNum = (level: number) => cmd().setNumbering(editor!.getAttributes('paragraph').num === level ? null : level).run()
  const toggleEvidence = () => {
    const party = editor!.getAttributes('paragraph').evidence
    cmd().setEvidence(party === '갑' ? '을' : party ? null : '갑').run()
  }
  // 준비서면처럼 앞 서면에 낸 증거 다음 번호(갑 제5호증)부터 시작할 때
  const startEvidence = () => {
    const { evidence, evidenceStart } = editor!.getAttributes('paragraph')
    if (!evidence) return window.alert('호증 문단에서 눌러 주세요')
    const v = window.prompt('이 호증의 번호 (비우면 앞 호증에 이어서)', evidenceStart ? String(evidenceStart) : '')
    if (v === null) return
    const n = Number.parseInt(v, 10)
    cmd().setEvidenceStart(n >= 1 ? n : null).run()
  }
  // 선택한 글에서 숫자만 뽑아 금액 서식으로 바꿈 ("37200000", "3,720만" → 숫자 부분)
  const amount = (style: '소장' | '계약서') => {
    const { from, to } = editor!.state.selection
    const n = parseAmount(editor!.state.doc.textBetween(from, to))
    if (n) cmd().insertContentAt({ from, to }, formatAmount(n, style)).run()
  }

  return (
    <div className="le-root">
      <div className="le-main">
        {editable && editor && (
          <div className="le-toolbar">
            <button type="button" onClick={() => cmd().toggleHeading({ level: 1 }).run()}>제목</button>
            <button type="button" onClick={() => cmd().toggleHeading({ level: 3 }).run()}>소제목</button>
            <button type="button" onClick={() => cmd().toggleHeading({ level: 2 }).run()}>조</button>
            {['1.', '가.', '(1)', '(가)'].map((label, i) => (
              <button key={label} type="button" title="번호 문단 — Tab·Shift+Tab 단계 변경, 맨 앞 Backspace 해제" onClick={() => toggleNum(i + 1)}>
                {label}
              </button>
            ))}
            <button type="button" title="입증방법 갑 제N호증 자동 번호 — 누를 때마다 갑 → 을 → 해제, Enter로 다음 호증" onClick={toggleEvidence}>
              호증
            </button>
            <button type="button" title="이 호증의 번호를 정해요 — 준비서면에서 갑 제5호증부터 시작할 때" onClick={startEvidence}>
              호증 시작
            </button>
            <button type="button" onClick={() => cmd().toggleOrderedList().run()}>항</button>
            <button type="button" onClick={() => cmd().sinkListItem('listItem').run()}>호 →</button>
            <button type="button" onClick={() => cmd().liftListItem('listItem').run()}>← 내어쓰기</button>
            <button type="button" onClick={() => cmd().toggleBold().run()}><b>B</b></button>
            <button type="button" onClick={insertVar}>{'{{ }}'} 변수</button>
            <button type="button" onClick={() => cmd().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()}>표</button>
            <button type="button" title="선택한 금액 → 금 37,200,000원" onClick={() => amount('소장')}>금액</button>
            <button type="button" title="선택한 금액 → 금 삼천칠백이십만 원정(₩37,200,000)" onClick={() => amount('계약서')}>금액(한글)</button>
            <span className="le-spacer" />
            <label className="le-btn">
              열기
              <input type="file" accept=".docx,.doc,.hwp,.hwpx" hidden onChange={openFile} />
            </label>
            <button type="button" onClick={() => save(toDocx, 'docx')}>Word 저장</button>
            <button type="button" onClick={() => save(toHwpx, 'hwpx')}>한글(.hwpx) 저장</button>
            <button type="button" title="HWP 5.0 — 처음 저장할 때 변환기(약 10MB)를 불러와요" onClick={() => save((d, v) => toHwp(d, v, { wasm: hwpWasmUrl }), 'hwp')}>
              한글(.hwp) 저장
            </button>
            <button type="button" onClick={printDoc}>인쇄 · PDF</button>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      <aside className="le-panel">
        {/* 섹션마다 접고 펼 수 있음. open은 처음 값만 주고 이후엔 사용자가 바꾼 상태를 React가 건드리지 않음 */}
        <details open>
          <summary>입력값</summary>
          {names.length === 0 && <p className="le-hint">본문에 {'{{당사자}}'}처럼 입력하면 변수가 생겨요.</p>}
          {names.map((n) => (
            <label key={n}>
              {n}
              <input value={values[n] ?? ''} placeholder={values[n] ? undefined : shown[n]} onChange={(e) => setValue(n, e.target.value)} />
            </label>
          ))}
        </details>
        {templates && (
          <Library
            title="템플릿"
            items={templates}
            placeholder="템플릿 찾기 (예: 답변서)"
            empty="맞는 템플릿이 없어요."
            disabled={!editable}
            itemTitle={(t) => t.description}
            onPick={startTemplate}
          />
        )}
        {clauses && (
          <Library
            title="조항 라이브러리"
            items={clauses}
            placeholder="조항 찾기 (예: 해지)"
            empty="맞는 조항이 없어요."
            disabled={!editable}
            itemTitle={() => '커서 위치에 조항 넣기'}
            // 조항 HTML의 줄바꿈·들여쓰기가 빈 항목(빈 "1." 호)으로 들어가지 않게 공백을 버림
            onPick={(c) => editor?.chain().focus().insertContent(toChips(c.html), { parseOptions: { preserveWhitespace: false } }).run()}
          />
        )}
        {searchCases && (
          <details className="le-cases" open>
            <summary>판례 검색</summary>
            {/* 에디터가 다른 앱의 form 안에 들어갈 수 있어 form 대신 Enter로 검색 */}
            <div className="le-cases-bar">
              <input
                value={caseQuery}
                placeholder="사건명·사건번호·키워드"
                onChange={(e) => setCaseQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    runCaseSearch()
                  }
                }}
              />
              <button type="button" onClick={runCaseSearch}>검색</button>
            </div>
            {caseStatus && <p className="le-hint">{caseStatus}</p>}
            {!caseStatus && cases?.length === 0 && <p className="le-hint">결과가 없어요.</p>}
            <ul className="le-case-list">
              {cases?.map((c) => (
                <li key={`${c.caseNo}-${c.date}`}>
                  <button type="button" disabled={!editable} title="커서 위치에 인용 넣기" onClick={() => editor?.chain().focus().insertContent(formatCaseCitation(c)).run()}>
                    <strong>{c.title}</strong>
                    <span>{formatCaseCitation(c)}</span>
                    {c.summary && <small>{c.summary}</small>}
                  </button>
                  <a href={c.url} target="_blank" rel="noopener noreferrer">원문</a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </aside>
    </div>
  )
}
