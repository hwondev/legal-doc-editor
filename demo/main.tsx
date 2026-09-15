import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LegalEditor, clauses, templates } from '../src'

const nda = `
<h1>비밀유지계약서</h1>
<p>{{갑}}(이하 "갑"이라 한다)과 {{을}}(이하 "을"이라 한다)은 다음과 같이 비밀유지계약을 체결한다.</p>
<h2>(목적)</h2>
<p>이 계약은 {{사업명}}과 관련하여 갑이 을에게 제공하는 비밀정보를 보호하는 것을 목적으로 한다.</p>
<h2>(비밀정보의 범위)</h2>
<ol>
  <li><p>"비밀정보"란 갑이 을에게 서면, 구두, 전자적 방법으로 제공하는 기술상·경영상의 정보를 말한다.</p></li>
  <li><p>다음 각 호의 정보는 비밀정보에서 제외한다.</p>
    <ol>
      <li><p>제공받은 시점에 이미 공개된 정보</p></li>
      <li><p>을이 제3자로부터 적법하게 취득한 정보</p></li>
    </ol>
  </li>
</ol>
<h2>(계약기간)</h2>
<p>이 계약의 유효기간은 {{계약일}}부터 {{기간}}으로 한다.</p>
<p>&nbsp;</p>
<p style="text-align:center">{{계약일}}</p>
<p>갑: {{갑}} (인)</p>
<p>을: {{을}} (인)</p>
<p>&nbsp;</p>
<p>※ 인용 표기 예시 — 민법 제750조, 대법원 2016. 4. 28. 선고 2015다12345 판결 (밑줄에 Ctrl·⌘+클릭하면 국가법령정보센터가 열려요)</p>
`

const options = [{ id: 'nda', title: '비밀유지계약서 (예시)', html: nda }, ...templates]

// 데모용 가짜 검색 결과 — 실제 판례가 아님(2099년 사건번호). 실제 연결은 examples/law-go-kr-proxy 참고
const demoSearchCases = async (q: string) => {
  const search = `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent(q)}`
  return [
    { court: '대법원', date: '20990115', caseNo: '2099다1', title: `(예시) ${q} — 대법원 판결`, kind: '판결', url: search },
    { court: '서울고등법원', date: '2099-02-20', caseNo: '2099나2', title: `(예시) ${q} — 항소심 판결`, kind: '판결', url: search },
    { court: '대법원', date: '2099.03.05', caseNo: '2099마3', title: `(예시) ${q} — 대법원 결정`, kind: '결정', url: search },
  ]
}

function Demo() {
  const [id, setId] = useState(options[0].id)
  const current = options.find((o) => o.id === id)!
  return (
    <>
      <label style={{ display: 'block', padding: '12px 16px 0', background: '#eef0f3', font: '14px system-ui, sans-serif' }}>
        템플릿{' '}
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </label>
      {/* 템플릿을 바꾸면 에디터를 새로 만듦 (content는 처음 한 번만 읽음) */}
      <LegalEditor key={id} content={current.html} values={id === 'nda' ? { 갑: '주식회사 가나다' } : {}} autoFees searchCases={demoSearchCases} clauses={clauses} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Demo />)
