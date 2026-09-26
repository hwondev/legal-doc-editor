import type { Values } from '../src'

// 사이트의 문서 보관함 — 이 브라우저의 localStorage에만 둠 (서버로 보내지 않음)
export interface Doc {
  id: string
  title: string
  html: string
  values: Values
  updatedAt: number
}

const KEY = 'legal-doc-editor:docs'

// 읽기·쓰기는 메모리(cache)에서 하고 저장은 그다음에 시도 → 저장이 막힌 브라우저(사생활 보호 모드·용량 초과)에서도 이 탭에서는 계속 쓸 수 있음
// ponytail: 문서 전체를 한 칸에 JSON으로 저장하고, 두 탭에서 같은 문서를 고치면 나중 저장이 이김 — 문서가 많아져 느려지면 IndexedDB로
let cache: Doc[] | null = null

const all = (): Doc[] => {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache
}

const persist = (): boolean => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
    return true
  } catch {
    return false
  }
}

// 다른 탭에서 바꾸면 다음에 읽을 때 새로 불러옴
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => e.key === KEY && (cache = null))

export const listDocs = () => [...all()].sort((a, b) => b.updatedAt - a.updatedAt)
export const getDoc = (id: string) => all().find((d) => d.id === id)

/** 저장하고 성공 여부를 돌려줌 (실패해도 이 탭의 메모리에는 남음) */
export function saveDoc(doc: Doc): boolean {
  cache = [doc, ...all().filter((d) => d.id !== doc.id)]
  return persist()
}

export function removeDoc(id: string): boolean {
  cache = all().filter((d) => d.id !== id)
  return persist()
}

export const newDoc = (title: string, html: string): Doc => ({ id: crypto.randomUUID().slice(0, 8), title, html, values: {}, updatedAt: Date.now() })
