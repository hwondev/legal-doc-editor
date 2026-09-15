import { InputRule, Node, mergeAttributes } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { EVIDENCE_REF_GROUP, EVIDENCE_SKIP, evidenceRefPieces, refText, type RefPiece } from './io'

const newId = () => Math.random().toString(36).slice(2, 10)

// 문서 순서대로 호증 문단을 돌며 당사자와 현재 번호를 넘김 (io.ts evidenceNumbers·flatten과 같은 규칙)
function eachEvidence(doc: PMNode, fn: (node: PMNode, pos: number, party: string, n: number) => void) {
  const counts: Record<string, number> = {}
  doc.descendants((node, pos) => {
    if (EVIDENCE_SKIP.includes(node.type.name)) return false
    if (node.type.name !== 'paragraph') return true
    const party: string | null = node.attrs.evidence
    if (party) fn(node, pos, party, (counts[party] = (counts[party] ?? 0) + 1))
    return false
  })
}

function findEvidence(doc: PMNode, party: string, n: number) {
  let found: { node: PMNode; pos: number } | undefined
  eachEvidence(doc, (node, pos, p, k) => {
    if (!found && p === party && k === n) found = { node, pos }
  })
  return found
}

// 본문 호증 참조. 호증 문단의 id를 가리키고, 증거 번호가 바뀌면 글자(label)가 따라 바뀜.
// 모양(form): full "갑 제2호증" / short "제3호증"(범위·나열의 뒤쪽) / number "2"("갑 제1, 2호증"의 번호)
// HTML에는 <span data-evidence-ref="id" data-form="short">제3호증</span>으로 저장되어 에디터 밖에서도 글자가 보임
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
      form: {
        default: 'full',
        parseHTML: (el) => (['short', 'number'].includes(el.getAttribute('data-form')!) ? el.getAttribute('data-form') : 'full'),
        renderHTML: (attrs) => (attrs.form !== 'full' ? { 'data-form': attrs.form } : {}),
      },
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

  // 본문에 "갑 제2호증"·"갑 제1, 2호증"을 입력하면 그 증거가 모두 있을 때 참조로 바꿈 (바로 Backspace로 글자로 되돌림). 호증 문단 안에서는 그대로
  // tiptap은 참조 같은 노드를 가로지르는 입력 규칙 매치를 건너뜀 → 참조 뒤에 이어 친 " 내지 제3호증"은 둘째 규칙이 뒤쪽 글자만 보고 처리
  addInputRules() {
    const type = this.type
    const inEvidence = (state: EditorState, pos: number) => !!state.doc.resolve(pos).parent.attrs.evidence
    // 조각(글자·참조)을 from~to 자리에 넣음. 가리키는 증거에 id가 없으면 줌 (tr.doc을 보므로 같은 증거를 두 번 가리켜도 id 하나)
    const insert = (state: EditorState, from: number, to: number, pieces: RefPiece[]) => {
      const { tr } = state
      const nodes = pieces.map((piece) => {
        if (typeof piece === 'string') return state.schema.text(piece)
        const target = findEvidence(tr.doc, piece.party, piece.n)!
        let id: string | null = target.node.attrs.evidenceId
        if (!id) tr.setNodeAttribute(target.pos, 'evidenceId', (id = newId()))
        return type.create({ id, label: refText(piece.party, piece.n, piece.form), form: piece.form })
      })
      tr.replaceWith(from, to, nodes)
    }
    return [
      new InputRule({
        find: new RegExp(`${EVIDENCE_REF_GROUP.source}$`),
        handler: ({ state, range, match }) => {
          if (inEvidence(state, range.from)) return null
          const pieces = evidenceRefPieces(match, (party, n) => !!findEvidence(state.doc, party, n))
          if (!pieces) return null
          insert(state, range.from, range.to, pieces)
        },
      }),
      new InputRule({
        find: /(\s*(?:,|내지|[~～])\s*)제\s*(\d+)\s*호증$/,
        handler: ({ state, range, match }) => {
          const before = state.doc.resolve(range.from).nodeBefore
          if (before?.type !== type || inEvidence(state, range.from)) return null
          let party: string | undefined
          eachEvidence(state.doc, (node, _pos, p) => {
            if (node.attrs.evidenceId === before.attrs.id) party = p
          })
          const n = Number(match[2])
          if (!party || !findEvidence(state.doc, party, n)) return null
          insert(state, range.from + match[1].length, range.to, [{ party, n, form: 'short' }])
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
          const numbers = new Map<string, { party: string; n: number }>()
          eachEvidence(state.doc, (node, pos, party, n) => {
            let id: string | null = node.attrs.evidenceId
            if (!id || numbers.has(id)) tr.setNodeAttribute(pos, 'evidenceId', (id = newId()))
            numbers.set(id, { party, n })
          })
          state.doc.descendants((node, pos) => {
            if (node.type !== this.type) return
            const e = numbers.get(node.attrs.id)
            const text = e && refText(e.party, e.n, node.attrs.form)
            if (node.attrs.missing !== !text || (text && text !== node.attrs.label))
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: text ?? node.attrs.label, missing: !text })
          })
          return tr.steps.length ? tr : null
        },
      }),
    ]
  },
})
