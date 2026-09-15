export interface Clause {
  id: string
  title: string
  category: string
  /** 조 하나: h2(조 제목) + 본문(p) 또는 항(ol) · 호(중첩 ol). 조 번호는 자동으로 매겨지므로 적지 않는다 */
  html: string
}

/** 분류별로 묶음 (분류 순서는 목록에 처음 나온 순). category를 주면 그 분류만, query는 분류·제목에서 찾음. 빈 묶음은 뺌. 조항·템플릿 모두 쓸 수 있음 */
export function groupClauses<T extends { category: string; title: string }>(
  list: T[],
  { category = '', query = '' }: { category?: string; query?: string } = {},
): [string, T[]][] {
  const q = query.trim()
  const groups = new Map<string, T[]>()
  for (const c of list) {
    if (category && c.category !== category) continue
    if (q && !`${c.category} ${c.title}`.includes(q)) continue
    groups.set(c.category, [...(groups.get(c.category) ?? []), c])
  }
  return [...groups]
}

/*
 * 계약서에 자주 쓰는 일반 조항. 문장은 새로 썼고, 사건마다 달라지는 값은 {{변수}}로 둔다.
 * 확인하지 않은 법률 수치(이율·기간 등)는 넣지 않는다.
 */
export const clauses: Clause[] = [
  {
    id: 'purpose',
    title: '목적',
    category: '일반',
    html: `<h2>(목적)</h2>
<p>이 계약은 {{갑}}과 {{을}} 사이의 {{계약 대상}}에 관한 권리와 의무를 정하는 것을 목적으로 한다.</p>`,
  },
  {
    id: 'term',
    title: '계약기간',
    category: '기간',
    html: `<h2>(계약기간)</h2>
<ol>
  <li><p>이 계약의 기간은 {{시작일}}부터 {{종료일}}까지로 한다.</p></li>
  <li><p>기간 만료 {{통지 기한}} 전까지 어느 당사자도 서면으로 종료 의사를 알리지 않으면, 이 계약은 같은 조건으로 {{연장 기간}} 연장된 것으로 본다.</p></li>
</ol>`,
  },
  {
    id: 'confidentiality',
    title: '비밀유지',
    category: '의무',
    html: `<h2>(비밀유지)</h2>
<ol>
  <li><p>각 당사자는 이 계약과 관련하여 알게 된 상대방의 기술상·경영상 정보를 상대방의 사전 서면 동의 없이 제3자에게 공개하거나 이 계약의 목적 외에 사용하지 아니한다.</p></li>
  <li><p>제1항의 의무는 이 계약이 끝난 뒤에도 {{비밀유지 기간}} 동안 유지된다.</p></li>
</ol>`,
  },
  {
    id: 'damages',
    title: '손해배상',
    category: '책임',
    html: `<h2>(손해배상)</h2>
<p>어느 당사자가 이 계약을 위반하여 상대방에게 손해를 입힌 경우 그 손해를 배상하여야 한다.</p>`,
  },
  {
    id: 'termination',
    title: '계약의 해제·해지',
    category: '종료',
    html: `<h2>(계약의 해제·해지)</h2>
<ol>
  <li><p>어느 당사자가 이 계약을 위반한 경우 상대방은 {{시정 기간}} 이상의 기간을 정하여 서면으로 시정을 요구하고, 그 기간 안에 시정되지 않으면 이 계약을 해제 또는 해지할 수 있다.</p></li>
  <li><p>다음 각 호의 어느 하나에 해당하면 상대방은 최고 없이 이 계약을 해제 또는 해지할 수 있다.</p>
    <ol>
      <li><p>어음·수표가 부도 처리되거나 파산·회생절차 개시 신청이 있는 경우</p></li>
      <li><p>강제집행, 가압류 또는 가처분을 받아 이 계약을 이행하기 어려운 경우</p></li>
    </ol>
  </li>
  <li><p>제1항 및 제2항에 따른 해제 또는 해지는 손해배상 청구에 영향을 미치지 아니한다.</p></li>
</ol>`,
  },
  {
    id: 'force-majeure',
    title: '불가항력',
    category: '책임',
    html: `<h2>(불가항력)</h2>
<p>천재지변, 전쟁, 감염병 확산, 정부의 조치 등 당사자가 통제할 수 없는 사유로 이 계약을 이행하지 못한 경우 그 당사자는 이행 지체나 불이행에 대한 책임을 지지 아니한다. 다만, 그 사유가 생긴 사실을 지체 없이 상대방에게 알려야 한다.</p>`,
  },
  {
    id: 'no-assignment',
    title: '권리·의무의 양도 금지',
    category: '일반',
    html: `<h2>(권리·의무의 양도 금지)</h2>
<p>어느 당사자도 상대방의 사전 서면 동의 없이 이 계약상의 권리나 의무의 전부 또는 일부를 제3자에게 양도하거나 담보로 제공할 수 없다.</p>`,
  },
  {
    id: 'notice',
    title: '통지',
    category: '일반',
    html: `<h2>(통지)</h2>
<ol>
  <li><p>이 계약에 따른 통지는 서면으로 하며, 각 당사자가 이 계약서에 적은 주소나 {{통지 받을 이메일}}로 보내어 상대방에게 도달한 때에 효력이 생긴다.</p></li>
  <li><p>주소나 연락처가 바뀐 당사자는 지체 없이 상대방에게 알려야 한다.</p></li>
</ol>`,
  },
  {
    id: 'dispute',
    title: '분쟁 해결 (관할법원)',
    category: '분쟁',
    html: `<h2>(분쟁 해결)</h2>
<ol>
  <li><p>이 계약과 관련하여 분쟁이 생기면 당사자는 먼저 성실히 협의하여 해결한다.</p></li>
  <li><p>협의로 해결되지 않은 분쟁에 관한 소송은 {{관할 법원}}을 제1심 관할법원으로 한다.</p></li>
</ol>`,
  },
  {
    id: 'entire-agreement',
    title: '완전합의 및 계약의 변경',
    category: '일반',
    html: `<h2>(완전합의 및 계약의 변경)</h2>
<ol>
  <li><p>이 계약은 계약 대상에 관한 당사자 사이의 완전한 합의이며, 이 계약 전에 있었던 구두 또는 서면의 합의보다 우선한다.</p></li>
  <li><p>이 계약의 변경은 당사자가 서명 또는 날인한 서면으로만 할 수 있다.</p></li>
</ol>`,
  },
  {
    id: 'interpretation',
    title: '계약의 해석',
    category: '일반',
    html: `<h2>(계약의 해석)</h2>
<p>이 계약에서 정하지 않은 사항이나 해석에 다툼이 있는 사항은 당사자가 서로 협의하여 정하고, 협의가 되지 않으면 관계 법령과 일반 거래 관행에 따른다.</p>`,
  },
]
