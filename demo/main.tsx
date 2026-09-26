import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LegalEditor, clauses, fromFile, groupClauses, templates } from '../src'
import { getDoc, listDocs, newDoc, removeDoc, saveDoc, type Doc } from './store'
import { Brand, Guide, guides } from './guide'
import './app.css'

// 데모용 가짜 검색 결과 — 실제 판례가 아님(2099년 사건번호). 실제 연결은 examples/law-go-kr-proxy 참고
const demoSearchCases = async (q: string) => {
  const search = `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent(q)}`
  return [
    { court: '대법원', date: '20990115', caseNo: '2099다1', title: `(예시) ${q} — 대법원 판결`, kind: '판결', url: search },
    { court: '서울고등법원', date: '2099-02-20', caseNo: '2099나2', title: `(예시) ${q} — 항소심 판결`, kind: '판결', url: search },
    { court: '대법원', date: '2099.03.05', caseNo: '2099마3', title: `(예시) ${q} — 대법원 결정`, kind: '결정', url: search },
  ]
}

// 호스팅한 사이트(프로덕션 빌드)에서는 Vercel 함수 api/cases로 실제 판례를 검색, 로컬 개발(npm run dev)에서는 위 예시 결과
const searchCases = import.meta.env.PROD
  ? async (q: string) => {
      const res = await fetch(`/api/cases?q=${encodeURIComponent(q)}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `서버 응답 ${res.status}`)
      // 함수가 없거나 엉뚱한 응답이 와도 목록이 깨지지 않게 (예: 배포 설정이 빠져 index.html이 돌아온 경우)
      if (!Array.isArray(body)) throw new Error('판례 검색 응답을 읽지 못했어요')
      return body
    }
  : demoSearchCases

const openDoc = (doc: Doc) => {
  saveDoc(doc) // 저장이 막혀도 이 탭의 메모리에는 남아서 열 수 있음
  location.hash = `#/d/${doc.id}`
}

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000
  const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })
  if (s < 60) return '방금'
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour')
  return new Date(t).toLocaleDateString('ko-KR')
}

const startGuide = (doc: Doc) => {
  saveDoc(doc)
  location.hash = `#/guide/${doc.id}`
}

function Home() {
  const [docs, setDocs] = useState(listDocs)

  const openFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      openDoc(newDoc(file.name.replace(/\.[^.]+$/, ''), await fromFile(file)))
    } catch (err) {
      window.alert(`파일을 열 수 없어요: ${(err as Error).message}`)
    }
  }

  const remove = (doc: Doc) => {
    if (!window.confirm(`「${doc.title}」을(를) 지울까요? 이 브라우저에서 지우면 되살릴 수 없어요.`)) return
    removeDoc(doc.id)
    setDocs(listDocs())
  }

  return (
    <>
      <header className="app-bar">
        <Brand />
        <span className="app-note">작성한 문서는 이 브라우저에만 저장돼요</span>
      </header>
      <main className="home">
        <section className="home-hero">
          <h1>무엇을 쓰시나요?</h1>
          <p>서류를 고르면 빈칸이 들어간 초안에서 시작해요. 법률 자문이 아니니 제출 전에 내용을 꼭 확인하세요.</p>
        </section>
        <div className="home-grid">
          <div className="home-templates">
            {groupClauses(templates).map(([category, items]) => (
              <section key={category} aria-label={category}>
                <h2>{category}</h2>
                <div className="cards">
                  {items.map((t) =>
                    guides[t.id] ? (
                      // 질문 흐름이 있는 서류: 질문에 답하며 쓰기가 먼저, 익숙하면 바로 편집
                      <div key={t.id} className="card has-guide">
                        <b>{t.title}</b>
                        <span>{t.description}</span>
                        <div className="card-actions">
                          <button type="button" className="card-primary" onClick={() => startGuide(newDoc(t.title, t.html, t.id))}>
                            질문에 답하며 쓰기
                          </button>
                          <button type="button" className="card-link" onClick={() => openDoc(newDoc(t.title, t.html, t.id))}>
                            바로 편집
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button key={t.id} type="button" className="card" onClick={() => openDoc(newDoc(t.title, t.html, t.id))}>
                        <b>{t.title}</b>
                        <span>{t.description}</span>
                      </button>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
          <aside className="home-side">
            {docs.length > 0 && (
              <section className="recent" aria-label="이어 쓰기">
                <h2>이어 쓰기</h2>
                <ul>
                  {docs.map((d) => (
                    <li key={d.id}>
                      <a href={`#/d/${d.id}`}>
                        <b>{d.title}</b>
                        <span>{ago(d.updatedAt)}</span>
                      </a>
                      <button type="button" aria-label={`${d.title} 지우기`} onClick={() => remove(d)}>
                        지우기
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="다른 방법으로 시작">
              <h2>다른 방법으로 시작</h2>
              <label className="side-btn">
                파일 열기<small>.hwp · .hwpx · .docx · .doc</small>
                <input type="file" accept=".docx,.doc,.hwp,.hwpx" hidden onChange={openFile} />
              </label>
              <button type="button" className="side-btn" onClick={() => openDoc(newDoc('새 문서', ''))}>
                빈 문서<small>처음부터 직접 쓰기</small>
              </button>
            </section>
          </aside>
        </div>
      </main>
    </>
  )
}

type Status = { state: 'saved' | 'pending' | 'failed'; at: number } | null

// 입력을 멈추고 잠시 뒤 저장. 창을 닫거나 처음으로 돌아갈 때는 남은 것을 바로 저장
function EditorPage({ doc }: { doc: Doc }) {
  const latest = useRef(doc)
  const timer = useRef<number | undefined>(undefined)
  const [status, setStatus] = useState<Status>(null)

  const flush = () => {
    if (timer.current === undefined) return
    clearTimeout(timer.current)
    timer.current = undefined
    latest.current = { ...latest.current, updatedAt: Date.now() }
    setStatus({ state: saveDoc(latest.current) ? 'saved' : 'failed', at: latest.current.updatedAt })
  }
  const schedule = (patch: Partial<Doc>) => {
    latest.current = { ...latest.current, ...patch }
    setStatus((s) => (s?.state === 'failed' ? s : { state: 'pending', at: Date.now() }))
    clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 400)
  }

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  const time = status && new Date(status.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="app-editor">
      <header className="app-bar">
        <Brand />
        <span className="app-doc-title">{doc.title}</span>
        <span className={`app-status${status?.state === 'failed' ? ' failed' : ''}`} role="status">
          {status?.state === 'failed'
            ? '이 브라우저에 저장하지 못했어요 — 내보내기로 파일을 받아 두세요'
            : status?.state === 'pending'
              ? '저장 중…'
              : status
                ? `저장됨 ${time} · 이 브라우저에만`
                : '고치면 이 브라우저에 자동 저장돼요'}
        </span>
        <a href="#" className="app-back">
          처음으로
        </a>
      </header>
      <LegalEditor
        content={doc.html}
        values={doc.values}
        onChange={(html) => schedule({ html })}
        onValuesChange={(values) => schedule({ values })}
        autoFees
        searchCases={searchCases}
        clauses={clauses}
      />
    </div>
  )
}

function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onHash = () => setHash(location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // 효과 함수는 정리 함수만 돌려줘야 해서 중괄호로 감쌈 (scrollTo가 값을 돌려주는 환경에서 화면 전체가 사라짐)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [hash])
  const [, view, id] = hash.match(/^#\/(d|guide)\/(.+)$/) ?? []
  const doc = id ? getDoc(id) : undefined
  if (!doc) return <Home />
  if (view === 'guide' && doc.templateId && guides[doc.templateId]) return <Guide key={doc.id} doc={doc} />
  return <EditorPage key={doc.id} doc={doc} />
}

createRoot(document.getElementById('root')!).render(<App />)
