// 국가법령정보 공동활용 API의 판례 검색 결과를 legal-doc-editor `searchCases` 모양으로 바꿔 주는 작은 서버
// 의존성 없음 (Node 18+). 인증값(OC)은 환경변수로만 받고 브라우저에 보내지 않는다.
//
//   LAW_GO_KR_OC=발급받은인증값 node examples/law-go-kr-proxy/server.mjs
//   → http://localhost:8787/cases?q=대여금
//
// API 가이드(판례 목록 조회): https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide
import { createServer } from 'node:http'

const OC = process.env.LAW_GO_KR_OC
const PORT = Number(process.env.PORT ?? 8787)
// 개발용 기본값. 실제 서비스에서는 에디터가 뜨는 주소만 넣으세요 (예: https://my-app.example)
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? '*'

if (!OC) {
  console.error('LAW_GO_KR_OC 환경변수에 국가법령정보 공동활용 API 인증값(OC)을 넣어 주세요')
  process.exit(1)
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': ALLOW_ORIGIN })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost')
  const q = searchParams.get('q')?.trim()
  if (pathname !== '/cases' || !q) return send(res, 400, { error: 'GET /cases?q=검색어' })

  const api = new URL('https://www.law.go.kr/DRF/lawSearch.do')
  api.search = new URLSearchParams({ OC, target: 'prec', type: 'JSON', query: q, display: '20' })

  try {
    const data = await (await fetch(api)).json()
    // ponytail: 가이드에 JSON 최상위 구조가 없어 PrecSearch.prec로 가정 — 다르면 받은 키를 알려 줌 (키를 받아 확인 후 고칠 것)
    const root = data?.PrecSearch
    if (!root) return send(res, 502, { error: '예상과 다른 응답 구조', keys: Object.keys(data ?? {}) })
    const list = [root.prec ?? []].flat() // 결과가 1건이면 배열이 아니라 객체로 올 수 있음
    send(
      res,
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
    )
  } catch (err) {
    console.error('국가법령정보 API 호출 실패:', err.message)
    send(res, 502, { error: '국가법령정보 API 호출 실패' }) // 인증값이 들어간 주소는 돌려주지 않음
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/cases?q=대여금`))
