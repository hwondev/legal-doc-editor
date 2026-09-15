import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface Citation {
  type: 'case' | 'law'
  /** 본문에 적힌 그대로 */
  text: string
  /** 넘긴 문자열 안에서의 위치 */
  from: number
  to: number
  /** 국가법령정보센터 주소 */
  url: string
}

// 사건번호: 연도 + 사건부호(한글 1~3자) + 번호. 앞뒤에 숫자가 붙으면 제외해서
// 날짜(2026. 9. 2.)·전화번호·계좌번호(3333-17-4044109)와 섞이지 않게 함
// ponytail: 사건부호를 목록으로 두지 않아 "1234만5678"류 금액, "2024년3월"류 붙여 쓴 날짜만 단위 글자로 막아 둠
const CASE_NO = String.raw`(?<!\d)\d{4}(?![만억천년월일원])[가-힣]{1,3}\d{1,6}(?!\d)`
const COURT = String.raw`(?:[가-힣]{0,6}법원(?:\s*[가-힣]{2,6}지원)?|헌법재판소)`
const DATE = String.raw`\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.`
// 대법원 2016. 4. 28. 선고 2015다12345 판결 / 대법원 2020. 1. 9.자 2019마123 결정
const FULL_CASE = String.raw`${COURT}\s*${DATE}\s*(?:선고|자)\s*(?<caseNo>${CASE_NO})(?:\s*[,·]\s*${CASE_NO})*\s*(?:전원합의체\s*)?(?:판결|결정|명령)`
// 법령명: "민법"처럼 한 낱말이거나 "특정경제범죄 가중처벌 등에 관한 법률"처럼 "…에 관한 …법" 앞에 낱말이 붙은 형태
// ponytail: 휴리스틱. 조사로 끝나는 낱말에서 멈추지만 앞 문장의 낱말이 딸려 올 수 있음
const LAW_NAME = String.raw`(?:[가-힣]+(?<![은는이가을를와과로며고여하한된])\s+){0,4}[가-힣]+에\s*관한\s*[가-힣]*법률?|[가-힣]+법률?`
const LAW = String.raw`(?<lawName>${LAW_NAME})\s*제\s*(?<jo>\d+)\s*조(?:\s*의\s*(?<ui>\d+))?(?:\s*제\s*\d+\s*(?:항|호))*`
// 왼쪽부터 가장 먼저 맞는 것을 쓰므로 판결·결정 전체가 그 안의 사건번호보다 앞서 잡힘
const CITATION = new RegExp(String.raw`${FULL_CASE}|${LAW}|(?<bare>${CASE_NO})`, 'g')

// "…법"으로 끝나지만 법령 이름이 아닌 흔한 낱말 ("불법행위의 방법 제3조" 같은 오인 방지)
const NOT_LAW = /^[방불합위적탈편문어용수요기비사입공]법$/

// 법령명은 공식 명칭 그대로(띄어쓰기 포함) 넣어도 조문이 열림 — law.go.kr에서 확인 (2026-09-15)
const url = (...path: string[]) => `https://www.law.go.kr/${path.map(encodeURIComponent).join('/')}`

/** 본문 글에서 판례·법령 인용을 찾음. 문서를 바꾸지 않고 위치만 알려줌 */
export function findCitations(text: string): Citation[] {
  const out: Citation[] = []
  for (const m of text.matchAll(CITATION)) {
    const g = m.groups!
    const caseNo = g.caseNo ?? g.bare
    if (!caseNo && NOT_LAW.test(g.lawName!)) continue
    const from = m.index ?? 0
    out.push({
      type: caseNo ? 'case' : 'law',
      text: m[0],
      from,
      to: from + m[0].length,
      url: caseNo
        ? `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent(caseNo)}`
        : url('법령', g.lawName!.replace(/\s+/g, ' '), `제${g.jo}조${g.ui ? `의${g.ui}` : ''}`),
    })
  }
  return out
}

/** 판례 검색 결과 한 건 — LegalEditor의 `searchCases`가 돌려주는 모양 */
export interface CaseResult {
  /** 법원명: 대법원, 서울고등법원 … */
  court: string
  /** 선고일자: "20160428", "2016-04-28", "2016.04.28" 모두 받음 */
  date: string
  /** 사건번호: 2015다12345 */
  caseNo: string
  /** 사건명 */
  title: string
  /** 판결·결정·명령 (없으면 판결) */
  kind?: string
  summary?: string
  /** 원문 보기 주소 */
  url: string
}

/** 검색 결과 → 본문 인용 문구: "대법원 2016. 4. 28. 선고 2015다12345 판결", 결정은 "대법원 2020. 1. 9.자 2019마123 결정" */
export function formatCaseCitation({ court, date, caseNo, kind = '' }: CaseResult): string {
  const m = date.match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/)
  const day = m ? `${m[1]}. ${+m[2]}. ${+m[3]}.` : date
  const k = /결정/.test(kind) ? '결정' : /명령/.test(kind) ? '명령' : '판결'
  return k === '판결' ? `${court} ${day} 선고 ${caseNo} 판결` : `${court} ${day}자 ${caseNo} ${k}`
}

const key = new PluginKey<DecorationSet>('citation')

// 텍스트 노드 하나씩 보므로 인용 중간에 굵게 같은 서식이 끼면 그 인용은 넘어감
const decorate = (doc: PMNode) => {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText) return
    for (const c of findCitations(node.text!))
      decos.push(
        Decoration.inline(pos + c.from, pos + c.to, {
          nodeName: 'a',
          class: 'le-cite',
          href: c.url,
          title: c.url, // 마우스를 올리면 링크가 보이게
          target: '_blank',
          rel: 'noopener noreferrer',
        }),
      )
  })
  return DecorationSet.create(doc, decos)
}

/** 판례·법령 인용에 밑줄과 국가법령정보센터 링크를 덧입힘. 문서 데이터(HTML·JSON)는 그대로 */
export const CitationLink = Extension.create({
  name: 'citationLink',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => decorate(doc),
          apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old),
        },
        props: {
          decorations: (state) => key.getState(state),
          // 편집 중에는 커서 옮기는 게 먼저라 Ctrl(⌘)+클릭으로 열고, 읽기 전용이면 그냥 클릭
          handleClick: (view, _pos, event) => {
            const a = (event.target as HTMLElement).closest?.('a.le-cite')
            if (!a || (view.editable && !event.ctrlKey && !event.metaKey)) return false
            window.open(a.getAttribute('href')!, '_blank', 'noopener,noreferrer')
            return true
          },
        },
      }),
    ]
  },
})
