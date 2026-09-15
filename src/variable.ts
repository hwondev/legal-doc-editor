import { Node, nodeInputRule, nodePasteRule } from '@tiptap/core'

export type Values = Record<string, string>

export interface VariableStorage {
  values: Values
  views: Set<() => void>
}

declare module '@tiptap/core' {
  interface Storage {
    variable: VariableStorage
  }
}

// {{이름}} 변수 칩. HTML에는 <span data-var="이름">으로 저장되고, 값은 화면에서만 채움.
export const Variable = Node.create<object, VariableStorage>({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-var'),
        renderHTML: (attrs) => ({ 'data-var': attrs.name }),
      },
    }
  },

  addStorage() {
    return { values: {}, views: new Set() }
  },

  parseHTML() {
    return [{ tag: 'span[data-var]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', HTMLAttributes, node.attrs.name]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      const update = () => {
        const v = this.storage.values[node.attrs.name]
        dom.textContent = v || node.attrs.name
        dom.className = v ? 'le-var' : 'le-var le-var--empty'
      }
      update()
      this.storage.views.add(update)
      return { dom, destroy: () => this.storage.views.delete(update) }
    }
  },

  // 캡처 그룹을 쓰면 tiptap이 그룹 부분만 바꿔서 {{ }}가 남음 → 전체 매치에서 이름을 잘라냄
  addInputRules() {
    return [nodeInputRule({ find: /\{\{[^{}<>"]+\}\}$/, type: this.type, getAttributes: (m) => ({ name: m[0].slice(2, -2).trim() }) })]
  },

  addPasteRules() {
    return [nodePasteRule({ find: /\{\{[^{}<>"]+\}\}/g, type: this.type, getAttributes: (m) => ({ name: m[0].slice(2, -2).trim() }) })]
  },
})

/** 원문 HTML의 {{이름}} 텍스트를 변수 노드로 바꿈 */
export const toChips = (html: string) =>
  html.replace(/\{\{([^{}<>"]+)\}\}/g, (_, n: string) => `<span data-var="${n.trim().replace(/&/g, '&amp;')}"></span>`)

/** 에디터 HTML + 입력값 → 완성 문서 HTML. 비어 있는 값은 [이름]으로 남김. .legal-doc 안에서 렌더하면 조항 번호가 붙음 */
export function fillTemplate(html: string, values: Values) {
  const doc = new DOMParser().parseFromString(toChips(html), 'text/html')
  doc.querySelectorAll('span[data-var]').forEach((el) => {
    const name = el.getAttribute('data-var')!
    el.replaceWith(values[name] || `[${name}]`)
  })
  return doc.body.innerHTML
}
