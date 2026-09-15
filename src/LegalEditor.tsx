import { useEffect, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { Variable, toChips, type Values } from './variable'
import { Numbering } from './numbering'
import { CitationLink } from './citation'
import { withCourtFees, type CourtFeeOptions } from './fees'
import { formatAmount, parseAmount } from './amount'
import { fromFile, toDocx, toHwpx } from './io'
import './legal.css'

export interface LegalEditorProps {
  /** 템플릿 HTML. {{변수}} 텍스트는 변수로 바뀜 */
  content?: string
  /** 초기 입력값 */
  values?: Values
  onChange?: (html: string) => void
  onValuesChange?: (values: Values) => void
  editable?: boolean
  /** 입력값에 `소가`가 있으면 `인지액…`·`송달료…` 변수를 계산해 채움 (직접 입력한 값이 우선, 참고용) */
  autoFees?: boolean | CourtFeeOptions
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

export function LegalEditor({ content = '', values: initial = {}, onChange, onValuesChange, editable = true, autoFees }: LegalEditorProps) {
  const [values, setValues] = useState(initial)
  const [names, setNames] = useState<string[]>([])
  // 화면·저장에 쓰는 값 = 입력값 + (autoFees면) 비어 있는 인지액·송달료 계산값
  const shown = autoFees ? withCourtFees(names, values, autoFees === true ? {} : autoFees) : values

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), TableKit, Variable, Numbering, CitationLink],
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

  const save = async (to: typeof toDocx, ext: string) => {
    const title = editor!.state.doc.firstChild?.textContent.trim() || '문서'
    download(await to(editor!.getJSON(), shown), `${title}.${ext}`)
  }

  const cmd = () => editor!.chain().focus()
  const toggleNum = (level: number) => cmd().setNumbering(editor!.getAttributes('paragraph').num === level ? null : level).run()
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
              <input type="file" accept=".docx,.hwp,.hwpx" hidden onChange={openFile} />
            </label>
            <button type="button" onClick={() => save(toDocx, 'docx')}>Word 저장</button>
            <button type="button" onClick={() => save(toHwpx, 'hwpx')}>한글 저장</button>
            <button type="button" onClick={printDoc}>인쇄 · PDF</button>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
      <aside className="le-panel">
        <h3>입력값</h3>
        {names.length === 0 && <p className="le-hint">본문에 {'{{당사자}}'}처럼 입력하면 변수가 생겨요.</p>}
        {names.map((n) => (
          <label key={n}>
            {n}
            <input value={values[n] ?? ''} placeholder={values[n] ? undefined : shown[n]} onChange={(e) => setValue(n, e.target.value)} />
          </label>
        ))}
      </aside>
    </div>
  )
}
