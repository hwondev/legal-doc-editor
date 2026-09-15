import { createRoot } from 'react-dom/client'
import { LegalEditor } from '../src'

const template = `
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
`

createRoot(document.getElementById('root')!).render(
  <LegalEditor content={template} values={{ 갑: '주식회사 가나다' }} onValuesChange={(v) => console.log(v)} />,
)
