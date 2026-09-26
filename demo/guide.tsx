import { useEffect, useState } from 'react'
import { formatAmount, parseAmount, SMALL_CLAIM_LIMIT, templates, toChips, withCourtFees, type Values } from '../src'
import { saveDoc, type Doc } from './store'

// 질문에 답하며 쓰기 — 템플릿의 빈칸을 쉬운 질문으로 채움. 답은 문서 입력값에 그대로 저장되어 편집 화면에서 이어 씀

type Field = {
  name: string
  label: string
  type?: 'text' | 'tel' | 'amount' | 'date'
  placeholder?: string
  help?: string
  /** 같은 답을 함께 넣을 빈칸 (청구금액 → 소가) */
  also?: string[]
  /** 날짜의 다음 날을 넣을 빈칸 (변제기 → 변제기 다음 날) */
  dayAfter?: string
}
type Step = { title: string; intro?: string; fields: Field[] }

/*
 * 관할 안내 근거 (law.go.kr 확인 2026-09-27)
 *   민사소송법 제2조: 소는 피고의 보통재판적이 있는 곳의 법원이 관할 / 제3조: 사람의 보통재판적은 주소
 *   민사소송법 제8조: 재산권에 관한 소는 의무이행지의 법원에도 / 민법 제467조제2항: 특정물 인도 외 채무는 채권자의 현주소에서 변제
 * 소가에 이자를 넣지 않음: 찾기쉬운 생활법령정보 「소송비용의 산정방법」 "청구금액(이자는 불산입)" (확인 2026-09-15)
 */
export const guides: Record<string, Step[]> = {
  'complaint-loan': [
    {
      title: '누구와의 분쟁인가요',
      intro: '돈을 빌려준 사람(나)이 원고, 돈을 빌려 간 사람이 피고예요.',
      fields: [
        { name: '원고 이름', label: '내 이름' },
        { name: '원고 주소', label: '내 주소', placeholder: '예: 서울특별시 마포구 ○○로 12' },
        { name: '원고 연락처', label: '내 연락처', type: 'tel' },
        { name: '피고 이름', label: '돈을 빌려 간 사람 이름' },
        { name: '피고 주소', label: '그 사람 주소', help: '법원이 소장 부본을 이 주소로 보내요.' },
        { name: '피고 연락처', label: '그 사람 연락처', type: 'tel' },
        { name: '당사자 관계', label: '두 사람은 어떤 사이인가요?', placeholder: '예: 친구, 직장 동료', help: '소장에는 "원고와 피고는 ○○ 사이입니다"로 들어가요.' },
      ],
    },
    {
      title: '빌려준 돈',
      fields: [
        {
          name: '청구금액',
          label: '돌려받지 못한 돈은 얼마인가요?',
          type: 'amount',
          also: ['소가'],
          help: '원금만 적어요. 이 금액이 소가(소송목적의 값)가 되고, 이자는 소가에 넣지 않아요.',
        },
        { name: '대여일', label: '언제 빌려주었나요?', type: 'date' },
        { name: '변제기', label: '언제까지 갚기로 했나요?', type: 'date', dayAfter: '변제기 다음 날', help: '늦게 갚은 만큼의 돈(지연손해금)은 이날 다음 날부터 계산해요.' },
      ],
    },
    {
      title: '어디에 내나요',
      fields: [
        {
          name: '관할 법원',
          label: '소장을 낼 법원',
          placeholder: '예: 서울중앙지방법원',
          help: '피고 주소지를 맡는 법원에 낼 수 있어요(민사소송법 제2조·제3조). 갚을 곳을 따로 정하지 않았다면 돈을 받을 사람, 곧 원고 주소지를 맡는 법원에도 낼 수 있어요(민사소송법 제8조, 민법 제467조 제2항).',
        },
        { name: '작성일', label: '작성일', type: 'date' },
      ],
    },
  ],
}

const toKoreanDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}. ${m}. ${d}.`
}
const fromKoreanDate = (s = '') => {
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''
}
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  return `${t.getUTCFullYear()}. ${t.getUTCMonth() + 1}. ${t.getUTCDate()}.`
}
const today = () => {
  const t = new Date()
  return `${t.getFullYear()}. ${t.getMonth() + 1}. ${t.getDate()}.`
}

// 미리보기: 빈칸을 값(글자로만 넣음)이나 [이름]으로 바꾸고, 지금 묻는 칸은 <mark>로
function preview(html: string, shown: Values, asking: Set<string>) {
  const doc = new DOMParser().parseFromString(toChips(html), 'text/html')
  doc.querySelectorAll('span[data-var]').forEach((el) => {
    const name = el.getAttribute('data-var')!
    const out = doc.createElement(asking.has(name) ? 'mark' : 'span')
    out.textContent = shown[name] || `[${name}]`
    if (!shown[name]) out.className = 'guide-blank'
    el.replaceWith(out)
  })
  return doc.body.innerHTML
}

export const Brand = () => (
  <a href="#" className="app-brand">
    <span className="app-seal" aria-hidden="true">
      너
    </span>
    너홀로프로
  </a>
)

export function Guide({ doc }: { doc: Doc }) {
  const steps = guides[doc.templateId!]
  const html = templates.find((t) => t.id === doc.templateId)!.html
  const names = [...new Set([...html.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1].trim()))]
  const [values, setValues] = useState(doc.values)
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(true)
  const shown = withCourtFees(names, values)

  const set = (patch: Values) => {
    setValues((prev) => {
      const next = { ...prev, ...patch }
      setSaved(saveDoc({ ...doc, values: next, updatedAt: Date.now() }))
      return next
    })
  }
  // 작성일은 오늘로 미리 채움
  useEffect(() => {
    if (!values['작성일']) set({ 작성일: today() })
  }, [])

  const reviewing = step === steps.length
  const asking = new Set(reviewing ? [] : steps[step].fields.flatMap((f) => [f.name, ...(f.also ?? []), ...(f.dayAfter ? [f.dayAfter] : [])]))
  const done = (i: number) => steps[i].fields.every((f) => values[f.name]?.trim())
  const blanks = names.filter((n) => !shown[n]?.trim())
  const claim = parseAmount(values['소가'] ?? '')

  const input = (f: Field) => {
    if (f.type === 'amount') {
      const n = parseAmount(values[f.name] ?? '')
      return (
        <>
          <div className="guide-amount">
            <input
              id={`g-${f.name}`}
              inputMode="numeric"
              value={n ? n.toLocaleString('ko-KR') : ''}
              placeholder="0"
              onChange={(e) => {
                const v = parseAmount(e.target.value)
                const text = v ? formatAmount(v) : ''
                set(Object.fromEntries([f.name, ...(f.also ?? [])].map((name) => [name, text])))
              }}
            />
            <span>원</span>
          </div>
          {n > 0 && (
            <p className="guide-help">
              소장에는 <b>{formatAmount(n)}</b>으로 들어가요 ({formatAmount(n, '계약서').replace(/\(.*\)$/, '')})
            </p>
          )}
        </>
      )
    }
    if (f.type === 'date')
      return (
        <input
          id={`g-${f.name}`}
          type="date"
          value={fromKoreanDate(values[f.name])}
          onChange={(e) => {
            const iso = e.target.value
            set({ [f.name]: iso ? toKoreanDate(iso) : '', ...(f.dayAfter && { [f.dayAfter]: iso ? nextDay(iso) : '' }) })
          }}
        />
      )
    return <input id={`g-${f.name}`} type={f.type ?? 'text'} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => set({ [f.name]: e.target.value })} />
  }

  return (
    <div className="guide">
      <header className="app-bar">
        <Brand />
        <span className="app-doc-title">{doc.title} · 질문에 답하며 쓰기</span>
        <span className={`app-status${saved ? '' : ' failed'}`} role="status">
          {saved ? '답할 때마다 이 브라우저에 저장돼요' : '이 브라우저에 저장하지 못했어요 — 편집 화면에서 내보내기로 받아 두세요'}
        </span>
        <a href={`#/d/${doc.id}`} className="app-back">
          편집 화면으로
        </a>
      </header>
      <div className="guide-body">
        <ol className="guide-steps" aria-label="단계">
          {[...steps.map((s) => s.title), '검토하기'].map((title, i) => (
            <li key={title} className={i === step ? 'current' : i < steps.length && done(i) ? 'done' : ''}>
              <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                <b>{i < steps.length && done(i) && i !== step ? '✓' : i + 1}</b>
                <span>{title}</span>
              </button>
            </li>
          ))}
        </ol>

        <section className="guide-form">
          <p className="guide-eyebrow">
            {step + 1} / {steps.length + 1} · {reviewing ? '검토하기' : steps[step].title}
          </p>
          {!reviewing ? (
            <>
              <h1>{steps[step].title}</h1>
              {steps[step].intro && <p className="guide-intro">{steps[step].intro}</p>}
              {steps[step].fields.map((f) => (
                <div className="guide-field" key={f.name}>
                  <label className="guide-label" htmlFor={`g-${f.name}`}>
                    {f.label}
                  </label>
                  {input(f)}
                  {f.help && f.type !== 'amount' && <p className="guide-help">{f.help}</p>}
                  {f.help && f.type === 'amount' && !parseAmount(values[f.name] ?? '') && <p className="guide-help">{f.help}</p>}
                </div>
              ))}
              <div className="guide-nav">
                {step > 0 ? (
                  <button type="button" className="guide-back" onClick={() => setStep(step - 1)}>
                    ← {steps[step - 1].title}
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="guide-next" onClick={() => setStep(step + 1)}>
                  다음: {step + 1 < steps.length ? steps[step + 1].title : '검토하기'} →
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>검토하고 편집 화면으로</h1>
              <div className="guide-review">
                {steps.map((s, i) => (
                  <section key={s.title}>
                    <h2>
                      {s.title}
                      <button type="button" onClick={() => setStep(i)}>
                        고치기
                      </button>
                    </h2>
                    <dl>
                      {s.fields.map((f) => (
                        <div key={f.name} className="guide-row">
                          <dt>{f.label}</dt>
                          <dd className={values[f.name]?.trim() ? '' : 'missing'}>{values[f.name]?.trim() || '비어 있음'}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
              <dl className="guide-calc" aria-label="자동 계산">
                <div className="guide-row">
                  <dt>인지액</dt>
                  <dd>{shown['인지액'] || '청구금액을 넣으면 계산돼요'}</dd>
                </div>
                <div className="guide-row">
                  <dt>송달료</dt>
                  <dd>{shown['송달료'] || '청구금액을 넣으면 계산돼요'}</dd>
                </div>
                {claim > 0 && (
                  <div className="guide-row">
                    <dt>사건 종류</dt>
                    <dd>{claim <= SMALL_CLAIM_LIMIT ? '소액사건 (소가 3천만 원 이하)' : '단독사건'}</dd>
                  </div>
                )}
              </dl>
              <p className="guide-help">자동 계산은 참고용이에요. 입증방법은 갑 제1호증 차용증, 갑 제2호증 계좌이체 내역으로 들어가 있고 편집 화면에서 바꿀 수 있어요.</p>
              {blanks.length === 0 ? (
                <p className="guide-ok">빈칸을 모두 채웠어요. 편집 화면에서 문장을 확인하고 내보내기로 내려받으세요.</p>
              ) : (
                <p className="guide-warn">
                  빈칸 {blanks.length}개가 남았어요: {blanks.join(', ')}
                </p>
              )}
              <a className="guide-primary" href={`#/d/${doc.id}`}>
                편집 화면에서 확인하고 내보내기 →
              </a>
            </>
          )}
        </section>

        <aside className="guide-preview" aria-label="소장 미리보기">
          <div className="guide-preview-head">
            <span>소장 미리보기</span>
            <span>{reviewing ? '전체' : '지금 묻는 칸이 표시돼요'}</span>
          </div>
          <div className="legal-doc" dangerouslySetInnerHTML={{ __html: preview(html, shown, asking) }} />
        </aside>
      </div>
    </div>
  )
}
