import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    numbering: {
      /** 선택한 문단을 번호 문단으로 (1: 1. / 2: 가. / 3: (1) / 4: (가)), null이면 해제 */
      setNumbering: (level: number | null) => ReturnType
    }
  }
}

const MAX = 4

// 소장식 번호 문단(1. → 가. → (1) → (가)). 번호 글자는 저장하지 않고 legal.css 카운터가 그림
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
    }
  },

  addKeyboardShortcuts() {
    const current = () => this.editor.getAttributes('paragraph').num as number | null
    const shift = (d: number) => () => {
      const n = current()
      return !!n && this.editor.commands.setNumbering(Math.min(MAX, Math.max(1, n + d)))
    }
    return {
      Tab: shift(1),
      'Shift-Tab': shift(-1),
      // 번호 문단 맨 앞 Backspace, 빈 번호 문단에서 Enter → 번호만 해제 (목록과 같은 느낌)
      Backspace: () => {
        const { empty, $from } = this.editor.state.selection
        return !!current() && empty && $from.parentOffset === 0 && this.editor.commands.setNumbering(null)
      },
      Enter: () => !!current() && this.editor.state.selection.$from.parent.content.size === 0 && this.editor.commands.setNumbering(null),
    }
  },
})
