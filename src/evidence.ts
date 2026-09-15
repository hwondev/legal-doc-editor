import { InputRule, Node, mergeAttributes } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EVIDENCE_SKIP, evidenceText } from './io'

const newId = () => Math.random().toString(36).slice(2, 10)

// 문서 순서대로 호증 문단을 돌며 현재 표시("갑 제2호증")를 넘김 (io.ts evidenceLabels·flatten과 같은 규칙)
function eachEvidence(doc: PMNode, fn: (node: PMNode, pos: number, text: string) => void) {
  const counts: Record<string, number> = {}
  doc.descendants((node, pos) => {
    if (EVIDENCE_SKIP.includes(node.type.name)) return false
    if (node.type.name !== 'paragraph') return true
    const party: string | null = node.attrs.evidence
    if (party) fn(node, pos, evidenceText(party, (counts[party] = (counts[party] ?? 0) + 1)))
    return false
  })
}

// 본문 호증 참조. 호증 문단의 id를 가리키고, 증거 번호가 바뀌면 글자(label)가 따라 바뀜.
// HTML에는 <span data-evidence-ref="id">갑 제2호증</span>으로 저장되어 에디터 밖에서도 글자가 보임
export const EvidenceRef = Node.create({
  name: 'evidenceRef',
  group: 'inline',
  inline: true,
  atom: true,

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          // Enter로 나눈 새 문단은 새 id를 받음 (복사해 겹친 id도 플러그인이 새로 줌)
          evidenceId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-evidence-id'),
            renderHTML: (attrs) => (attrs.evidenceId ? { 'data-evidence-id': attrs.evidenceId } : {}),
          },
        },
      },
    ]
  },

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-evidence-ref'), renderHTML: (attrs) => ({ 'data-evidence-ref': attrs.id }) },
      label: { default: '', parseHTML: (el) => el.textContent ?? '', renderHTML: () => ({}) },
      missing: {
        default: false,
        parseHTML: (el) => el.hasAttribute('data-missing'),
        renderHTML: (attrs) => (attrs.missing ? { 'data-missing': '', title: '참조한 증거가 문서에 없어요' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-evidence-ref]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'le-ref' }, HTMLAttributes), node.attrs.label]
  },

  renderText({ node }) {
    return node.attrs.label
  },

  // 본문에 "갑 제2호증"을 입력하면 그 증거가 있을 때 참조로 바꿈 (바로 Backspace로 글자로 되돌림). 호증 문단 안에서는 그대로
  // 앞 글자가 한글이면("차용증을 제1호증") 조사로 보고 건너뜀
  addInputRules() {
    return [
      new InputRule({
        find: /(?<![가-힣])([갑을병])\s*제\s*(\d+)\s*호증$/,
        handler: ({ state, range, match }) => {
          if (state.doc.resolve(range.from).parent.attrs.evidence) return null
          const want = evidenceText(match[1], Number(match[2]))
          let target: { node: PMNode; pos: number } | undefined
          eachEvidence(state.doc, (node, pos, text) => {
            if (!target && text === want) target = { node, pos }
          })
          if (!target) return null
          const { tr } = state
          let id: string | null = target.node.attrs.evidenceId
          if (!id) tr.setNodeAttribute(target.pos, 'evidenceId', (id = newId()))
          tr.replaceWith(range.from, range.to, this.type.create({ id, label: want }))
        },
      }),
    ]
  },

  // 문서가 바뀔 때마다 호증 문단 id를 채우고(없거나 복사로 겹치면 새로), 참조 글자를 현재 번호로 맞춤. 가리키던 증거가 없으면 missing
  // ponytail: 바뀔 때마다 문서 전체를 훑음 — 아주 긴 문서에서 느려지면 바뀐 범위만 보도록
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('evidenceRef'),
        appendTransaction: (trs, _old, state) => {
          if (!trs.some((t) => t.docChanged)) return null
          const { tr } = state
          const labels = new Map<string, string>()
          eachEvidence(state.doc, (node, pos, text) => {
            let id: string | null = node.attrs.evidenceId
            if (!id || labels.has(id)) tr.setNodeAttribute(pos, 'evidenceId', (id = newId()))
            labels.set(id, text)
          })
          state.doc.descendants((node, pos) => {
            if (node.type !== this.type) return
            const text = labels.get(node.attrs.id)
            if (node.attrs.missing !== !text || (text && text !== node.attrs.label))
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: text ?? node.attrs.label, missing: !text })
          })
          return tr.steps.length ? tr : null
        },
      }),
    ]
  },
})
