// Vercel 함수 GET /api/cases?q=검색어 — 국가법령정보 공동활용 API(판례 목록 조회)를 LegalEditor `searchCases` 모양으로 바꿔 돌려줌
// 인증값(OC)은 Vercel 환경변수 LAW_GO_KR_OC에서만 읽고 응답에 넣지 않음. 변환 규칙은 examples/law-go-kr-proxy/server.mjs와 같음
// API 가이드: https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide
//   요청 변수 OC·target=prec·type=JSON·query·display(최대 100), 항목 사건명·사건번호·선고일자·법원명·판결유형
// ponytail: 가이드에 JSON 최상위 구조가 없어 PrecSearch.prec로 가정 — 다르면 502와 받은 키 목록을 돌려줌.
//   호출 수 제한은 없음(같은 검색어는 CDN 캐시로 줄임) — 남용되면 Vercel 방화벽 규칙이나 요청 제한을 붙일 것

const json = (status, body, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  })

export async function GET(request) {
  const OC = process.env.LAW_GO_KR_OC
  if (!OC) return json(503, { error: '판례 검색이 아직 설정되지 않았어요' })

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!q || q.length > 100) return json(400, { error: '검색어를 1~100자로 넣어 주세요' })

  const api = new URL('https://www.law.go.kr/DRF/lawSearch.do')
  api.search = new URLSearchParams({ OC, target: 'prec', type: 'JSON', query: q, display: '20' }).toString()

  try {
    const data = await (await fetch(api)).json()
    const root = data?.PrecSearch
    if (!root) return json(502, { error: '예상과 다른 응답 구조', keys: Object.keys(data ?? {}) })
    const list = [root.prec ?? []].flat() // 결과가 1건이면 배열이 아니라 객체로 올 수 있음
    return json(
      200,
      list.map((p) => ({
        court: p.법원명,
        date: p.선고일자,
        caseNo: p.사건번호,
        title: p.사건명,
        kind: p.판결유형,
        // 판례상세링크에는 인증값이 들어 있어 쓰지 않고, 공개 판례 검색 주소로 연결
        url: `https://www.law.go.kr/LSW/precSc.do?query=${encodeURIComponent(p.사건번호)}`,
      })),
      'public, s-maxage=3600',
    )
  } catch {
    return json(502, { error: '국가법령정보 API 호출 실패' }) // 인증값이 들어간 주소는 돌려주지 않음
  }
}
