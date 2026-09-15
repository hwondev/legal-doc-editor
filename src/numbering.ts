import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    numbering: {
      /** 선택한 문단을 번호 문단으로 (1: 1. / 2: 가. / 3: (1) / 4: (가)), null이면 해제 */
      setNumbering: (level: number | null) => ReturnType
      /** 선택한 문단을 호증 문단으로 ('갑' → 갑 제N호증), null이면 해제. 번호 문단과 함께 쓸 수 있음 */
      setEvidence: (party: string | null) => ReturnType
      /** 선택한 호증 문단의 번호를 n으로 정함(다음 호증은 n+1부터), null이면 앞 호증에 이어서 */
      setEvidenceStart: (n: number | null) => ReturnType
    }
  }
}

const MAX = 4
const PARTIES = ['갑', '을', '병']

// 소장식 번호 문단(1. → 가. → (1) → (가))과 입증방법 호증(갑 제N호증). 번호 글자는 저장하지 않고 legal.css 카운터가 그림
// → 문단을 넣고 빼면 번호가 알아서 다시 매겨짐
export const Numbering = Extension.create({
  name: 'numbering',
  priority: 1000, // 단축키를 StarterKit(Enter·Backspace·Tab)보다 먼저 봄. 번호 문단이 아니면 그대로 넘김

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          num: {
            default: null,
            parseHTML: (el) => {
              const n = Number(el.getAttribute('data-num'))
              return n >= 1 && n <= MAX ? n : null
            },
            renderHTML: (attrs) => (attrs.num ? { 'data-num': attrs.num } : {}),
          },
          evidence: {
            default: null,
            parseHTML: (el) => (PARTIES.includes(el.getAttribute('data-evidence')!) ? el.getAttribute('data-evidence') : null),
            renderHTML: (attrs) => (attrs.evidence ? { 'data-evidence': attrs.evidence } : {}),
          },
          // 준비서면처럼 갑 제5호증부터 시작. CSS가 style의 --le-ev-start로 카운터를 정함 (Enter로 나눈 새 문단엔 안 옮겨감)
          evidenceStart: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => {
              const n = Number(el.getAttribute('data-evidence-start'))
              return Number.isInteger(n) && n >= 1 ? n : null
            },
            renderHTML: (attrs) =>
              attrs.evidenceStart ? { 'data-evidence-start': attrs.evidenceStart, style: `--le-ev-start: ${attrs.evidenceStart}` } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setNumbering:
        (level) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { num: level }),
      setEvidence:
        (party) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { evidence: party && PARTIES.includes(party) ? party : null }),
      setEvidenceStart:
        (n) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { evidenceStart: n && n >= 1 ? Math.floor(n) : null }),
    }
  },

  addKeyboardShortcuts() {
    const attrs = () => this.editor.getAttributes('paragraph')
    const shift = (d: number) => () => {
      const n = attrs().num as number | null
      return !!n && this.editor.commands.setNumbering(Math.min(MAX, Math.max(1, n + d)))
    }
    return {
      Tab: shift(1),
      'Shift-Tab': shift(-1),
      // 맨 앞 Backspace → 커서에 가까운 표시부터 하나씩 해제(호증 → 번호), 빈 문단에서 Enter → 둘 다 해제 (목록과 같은 느낌)
      // 내용이 있는 문단에서 Enter는 속성이 새 문단으로 이어져 다음 번호(갑 제2호증)가 됨
      Backspace: () => {
        const { empty, $from } = this.editor.state.selection
        if (!empty || $from.parentOffset !== 0) return false
        const { num, evidence } = attrs()
        return evidence ? this.editor.commands.setEvidence(null) : !!num && this.editor.commands.setNumbering(null)
      },
      Enter: () => {
        const { num, evidence, evidenceStart } = attrs()
        const { empty, $from } = this.editor.state.selection
        if (!(num || evidence) || !empty) return false
        if ($from.parent.content.size === 0) return this.editor.commands.updateAttributes('paragraph', { num: null, evidence: null })
        // 호증 문단 맨 앞에서 Enter → 위에 빈 호증 문단을 넣음. 그냥 나누면 id가 빈 윗문단에 남아 본문 참조가 엉뚱한 증거를 가리킴
        if (evidence && $from.parentOffset === 0) {
          const pos = $from.before()
          // 시작 번호(갑 제5호증)는 새로 맨 위가 된 문단으로 옮김 — 안 옮기면 새 문단이 1이 되고 원래 문단은 5로 남음
          return this.editor
            .chain()
            .insertContentAt(pos, { type: 'paragraph', attrs: { num, evidence, evidenceStart } })
            .command(({ tr }) => {
              if (evidenceStart) tr.setNodeAttribute(pos + 2, 'evidenceStart', null)
              return true
            })
            .setTextSelection(pos + 1)
            .run()
        }
        return false
      },
    }
  },
})
