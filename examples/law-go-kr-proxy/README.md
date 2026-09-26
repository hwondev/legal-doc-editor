# 판례 검색 연결 예제 (국가법령정보 공동활용 API)

`LegalEditor`의 `searchCases`에 실제 판례 검색을 연결하는 작은 서버예요. 의존성이 없고 Node 18 이상에서 돌아가요.

## 왜 서버를 거치나요?

- 국가법령정보 공동활용 API는 **발급받은 인증값(OC)** 이 필요해요. 브라우저에서 바로 부르면 인증값이 그대로 드러나요.
- 브라우저에서 다른 사이트 API를 부르면 CORS에 막힐 수 있어요.

## 사용법

1. [국가법령정보 공동활용](https://open.law.go.kr)에서 OPEN API 사용을 신청해 인증값(OC)을 받으세요.
2. 서버를 켜세요. 인증값은 **환경변수로만** 넘기고 파일에 적어 커밋하지 마세요.

   ```bash
   LAW_GO_KR_OC=발급받은인증값 node examples/law-go-kr-proxy/server.mjs
   ```

3. 에디터에 연결하세요.

   ```tsx
   <LegalEditor
     searchCases={async (q) => {
       const res = await fetch(`http://localhost:8787/cases?q=${encodeURIComponent(q)}`)
       if (!res.ok) throw new Error((await res.json()).error)
       return res.json()
     }}
   />
   ```

| 환경변수 | 설명 | 기본값 |
| --- | --- | --- |
| `LAW_GO_KR_OC` | 인증값 (필수) | — |
| `PORT` | 서버 포트 | `8787` |
| `ALLOW_ORIGIN` | 허용할 에디터 주소 (CORS). 실제 서비스에서는 꼭 지정 | `*` |

## 참고

- 요청 형식: [판례 목록 조회 가이드](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=precListGuide) — `lawSearch.do?target=prec&type=JSON&query=…`
- 응답의 최상위 구조는 `PrecSearch.prec`예요(가이드에는 없어 운영 응답으로 확인, 2026-09-27). 구조가 바뀌면 서버가 `예상과 다른 응답 구조`와 받은 키 목록을 돌려줘요.
- 한 건을 인용에 맞게 정리하는 규칙은 [`api/_prec.js`](../../api/_prec.js)에 있고 사이트의 Vercel 함수와 같이 써요.
  - 대법원 외 출처(국세법령정보시스템·근로복지공단산재판례)는 법원명·판결유형이 비어 있고 사건번호가 `서울동부지방법원-2025-나-20644`처럼 법원과 붙어 와서, 법원명과 번호(`2025나20644`)를 나눠요.
  - `판결 : 환송`처럼 설명이 붙은 판결유형은 앞부분만 써요. 판결유형이 없으면 판결로 넣되 결과에 확인하라는 안내를 붙여요.
- 결과의 `url`은 인증값이 들어간 `판례상세링크` 대신 공개 판례 검색 주소로 만들어요.
