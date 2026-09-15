# legal-doc-editor

[![npm](https://img.shields.io/npm/v/legal-doc-editor)](https://www.npmjs.com/package/legal-doc-editor) [![CI](https://github.com/hwondev/legal-doc-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/hwondev/legal-doc-editor/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/legal-doc-editor)](./LICENSE)

계약서·합의서 같은 **법률문서를 만드는 React 에디터**입니다.

- **조·항·호 자동 번호**: 조를 넣거나 옮기면 제1조, ①, 1. 번호가 알아서 다시 매겨져요
- **입증방법 호증 번호**: `갑 제1호증`, `갑 제2호증`… 증거를 중간에 넣거나 빼도 호증 번호가 알아서 다시 매겨져요
- **`{{변수}}` 채우기**: 본문에 `{{갑}}`을 입력하면 입력칸이 생기고, 값을 넣으면 문서에 반영돼요
- **한글(.hwp·.hwpx)·Word(.docx·.doc) 열기·저장**: 일반 문단으로 쓴 계약서도 "제N조", "①", "1." 패턴을 인식해서 조·항·호 구조로 바꿔요. "제1조(목적) 이 계약은…"처럼 한 줄에 붙은 조는 제목과 본문으로 나눠요
  - 저장은 `.docx`, `.hwpx`, `.hwp`(HWP 5.0)예요. `.hwpx`는 한글 2014 이상에서 열려요
  - 옛 Word `.doc`(97–2003)는 열기만 돼요. 글자와 표만 옮기고 굵게 같은 글자 서식과 그림은 옮기지 않아요
  - 파일 변환 라이브러리는 필요할 때만 불러와서 에디터 본체 번들은 가벼워요
- **판례·법령 인용 링크**: 본문의 `민법 제750조`, `대법원 2016. 4. 28. 선고 2015다12345 판결`, `2024가단157033` 같은 인용을 알아보고 [국가법령정보센터](https://www.law.go.kr) 링크를 붙여요 (API 키가 필요 없어요)
- **조항 라이브러리**: 비밀유지·계약해지·관할법원 같은 자주 쓰는 조항을 골라 커서 위치에 넣어요. 조 번호는 알아서 다시 매겨져요
- **문서 템플릿**: 소장(대여금)·소장(채무부존재확인)·고소장(사기)·내용증명·지급명령 신청서를 `{{변수}}` 빈칸이 들어간 상태로 바로 시작해요
- **금액 표기**: 선택한 숫자를 `금 37,200,000원`이나 `금 삼천칠백이십만 원정(₩37,200,000)`으로 바꿔요
- **인쇄·PDF**: 비어 있는 변수는 손으로 쓰는 밑줄 칸으로 인쇄돼요

에디터 엔진은 [Tiptap](https://tiptap.dev)(ProseMirror)을, 파일 변환은 [docx](https://github.com/dolanmiu/docx)·[mammoth](https://github.com/mwilliamson/mammoth.js)·[hwp-convert](https://www.npmjs.com/package/hwp-convert)를 씁니다.

## 설치

```bash
npm i legal-doc-editor
```

## 사용

```tsx
import { LegalEditor } from 'legal-doc-editor'
import 'legal-doc-editor/style.css'

const template = `
<h1>비밀유지계약서</h1>
<p>{{갑}}과 {{을}}은 다음과 같이 계약을 체결한다.</p>
<h2>(목적)</h2>
<ol><li><p>첫째 항</p></li><li><p>둘째 항</p></li></ol>
`

export default function Page() {
  return <LegalEditor content={template} onChange={(html) => save(html)} />
}
```

### 문서 구조

| 요소 | 의미 | 표시 |
| --- | --- | --- |
| `h1` | 문서 제목 | 가운데 정렬 |
| `h2` | 조 | 제N조 |
| `h3` | 소제목 (청구취지·고소이유 등) | 가운데 정렬 |
| `p[data-num="1"~"4"]` | 번호 문단 (소장식) | 1. → 가. → (1) → (가), 제목·조·소제목마다 1부터 |
| `p[data-evidence="갑"\|"을"\|"병"]` | 호증 문단 (입증방법) | 갑 제1호증 → 갑 제2호증, 당사자별로 문서 전체에서 이어 셈. 번호 문단과 함께 쓰면 `1. 갑 제1호증` |
| `table` | 표 | 표 |
| `ol > li` | 항 | ①, ② |
| `ol ol > li` | 호 | 1., 2. |
| `span[data-var]` 또는 `{{이름}}` | 변수 | 입력값 |

툴바 **호증** 버튼은 누를 때마다 갑 → 을 → 해제로 바뀌고, 호증 문단 끝에서 Enter를 누르면 다음 호증이 이어져요. 파일을 열 때는 입증방법·증명방법·증거방법 소제목 아래의 `갑 제N호증`이 차례대로일 때만 호증 문단으로 바꿔요. `갑 제1호증의 1` 같은 가지번호, `내지`로 묶은 줄, 본문 속 `(갑 제1호증)` 참조는 글자로 두니 번호가 바뀌면 직접 고쳐 주세요.

### 판례·법령 인용

본문에 적힌 인용을 알아보고 밑줄을 그어요. 마우스를 올리면 주소가 보이고, Ctrl(⌘)+클릭하면 국가법령정보센터에서 열려요 (읽기 전용일 때는 그냥 클릭).

| 형식 | 예 | 링크 |
| --- | --- | --- |
| 판결·결정 | `대법원 2016. 4. 28. 선고 2015다12345 판결`, `대법원 2020. 1. 9.자 2019마123 결정` | 판례 검색 |
| 사건번호 | `2015다12345`, `2018노1234`, `2024가단157033` | 판례 검색 |
| 법령 조문 | `민법 제750조`, `형법 제347조 제1항`, `특정경제범죄 가중처벌 등에 관한 법률 제3조` | 해당 조문 |

**문서 데이터는 바뀌지 않아요.** 화면에만 덧입히는 표시라서 `onChange` HTML, `toPlainHtml`, `.docx`·`.hwpx` 저장 결과는 인용이 없을 때와 똑같아요. 인쇄할 때도 밑줄이 빠져요.

날짜(`2026. 9. 2.`), 전화번호, 계좌번호는 인용으로 보지 않아요. 다만 인용 인식은 글자 모양만 보는 것이라 놓치거나 잘못 잡을 수 있고, 링크가 가리키는 조문이 실제로 맞는지는 직접 확인해 주세요.

### .hwp 저장

툴바의 **한글(.hwp) 저장**은 `.hwpx`를 만든 뒤 [@rhwp/core](https://github.com/edwardkim/rhwp)(Rust→WASM, MIT)로 HWP 5.0 파일로 바꿔요.

- WASM이 약 10MB라 **처음 `.hwp`로 저장할 때만** 불러와요. 에디터 본체 번들에는 들어가지 않아요.
- Vite를 쓰면 사전 번들링이 WASM 경로를 잃지 않도록 제외해 주세요.

  ```ts
  // vite.config.ts
  export default defineConfig({ optimizeDeps: { exclude: ['@rhwp/core'] } })
  ```

- 그래도 WASM을 못 찾으면 `node_modules/@rhwp/core/rhwp_bg.wasm`을 정적 폴더에 복사하고 주소를 넘겨요: `<LegalEditor hwpWasmUrl="/rhwp_bg.wasm" />`
- 만든 파일은 다시 읽었을 때 제목·조항·번호·표·글자가 그대로인지 검사하지만, **한글 프로그램에서 열리는지는 직접 확인**해 주세요.

### 조항 라이브러리

`clauses`를 넘기면 오른쪽 패널에 조항 목록이 생겨요. 분류 칩(전체·일반·기간·의무·책임·종료·분쟁)으로 좁히거나 검색칸에서 제목·분류로 찾고, 누르면 커서 위치에 조항이 들어가요. `전체`에서는 분류별로 묶어 보여줘요. 조항 안의 `{{변수}}`는 입력칸에 바로 나타나고 뒤쪽 조 번호는 알아서 밀려요.

```tsx
import { LegalEditor, clauses } from 'legal-doc-editor'

<LegalEditor clauses={clauses} />
// 내 조항 더하기
<LegalEditor clauses={[...clauses, { id: 'my-sla', title: '서비스 수준', category: '의무', html: '<h2>(서비스 수준)</h2><p>…</p>' }]} />
```

기본 조항: 목적, 계약기간(자동 연장), 비밀유지, 손해배상, 계약의 해제·해지, 불가항력, 권리·의무의 양도 금지, 통지, 분쟁 해결(관할법원), 완전합의 및 계약의 변경, 계약의 해석. 일반적인 경우를 위한 예시 문장이니 계약에 맞게 고쳐 쓰세요.

### 판례 검색

`searchCases`에 검색 함수를 넘기면 오른쪽 패널에 **판례 검색** 칸이 생겨요. 결과를 누르면 커서 위치에 `대법원 2016. 4. 28. 선고 2015다12345 판결` 같은 인용 문구가 들어가고, 인용 링크도 자동으로 붙어요.

```tsx
<LegalEditor searchCases={async (q) => (await fetch(`/api/cases?q=${encodeURIComponent(q)}`)).json()} />
```

라이브러리는 검색을 직접 부르지 않아요. 국가법령정보 공동활용 API는 발급받은 인증값이 필요해서 서버를 거쳐야 하거든요. 연결 예제는 [`examples/law-go-kr-proxy`](./examples/law-go-kr-proxy)에 있어요.

### 인지액·송달료 자동 계산

`<LegalEditor autoFees />`로 켜면, 입력값 `소가`(또는 `소송목적의 값`)를 넣었을 때 이름이 `인지액`·`송달료`로 시작하는 변수(예: `{{인지액 산정 필요}}`)를 계산해서 채워요. 직접 입력한 값이 있으면 그 값을 써요.
지급명령 신청서(`payment-order` 템플릿)는 `청구금액`을 넣으면 `{{독촉절차 인지대}}`·`{{독촉절차 송달료}}`·`{{독촉절차비용}}`(두 금액 합계)을 채워요.

| 항목 | 기준 | 근거 |
| --- | --- | --- |
| 인지액 | 1천만원 미만 × 0.5% / 1억원 미만 × 0.45% + 5천원 / 10억원 미만 × 0.4% + 5만5천원 / 그 이상 × 0.35% + 55만5천원. 100원 미만 버림, 최저 1천원 | 「민사소송 등 인지법」 제2조 |
| 전자소송 인지액 | 위 계산식 × 0.9 후 100원 미만 버림, 최저 900원 — `autoFees={{ electronic: true }}` | 인지법 제16조, [전자소송포털](https://ecfs.scourt.go.kr/psp/link.on?m=PSP007P01) |
| 송달료 | 당사자 수 × 회분 × 1회 송달료. 소가 3천만원 이하(소액) 10회분, 넘으면 15회분. 당사자 수 기본 2 — `autoFees={{ parties: 3 }}` | 「송달료규칙의 시행에 따른 업무처리요령」 별표 1, 「소액사건심판규칙」 제1조의2 |
| 지급명령 인지대 | 소장 인지액 계산식 × 1/10 후 같은 끝자리 처리 (예: 청구금액 300만원 → 1,500원). **전자신청 감액은 아직 반영하지 않음** | 인지법 제7조제2항·제4항 |
| 지급명령 송달료 | 당사자 수 × 6회분 × 1회 송달료 | 업무처리요령 별표 1 |
| 1회 송달료 | 5,500원 (2025. 6. 1.부터). 바뀌면 `autoFees={{ unitFee: 5600 }}`처럼 덮어쓰기 | 법원 공지 |

> 계산 결과는 **참고용**이에요. 제1심 소장 기준이고 항소·상고·반소는 계산하지 않아요. 실제 납부액은 법원 안내를 확인하세요.

### 금액 표기

본문에서 금액을 선택하고 툴바의 **금액**·**금액(한글)** 버튼을 누르면 선택한 글의 숫자만 뽑아 바꿔요.

| 서식 | 예 |
| --- | --- |
| 소장식 | `금 37,200,000원` |
| 계약서식 | `금 삼천칠백이십만 원정(₩37,200,000)` |

한글 금액은 만 단위로 끊고, 고쳐 쓰기 어렵도록 **"일"을 빼지 않고** 적어요 (`10,000` → 일만, `11` → 일십일, `410,000,000` → 사억일천만).

## API

| 이름 | 설명 |
| --- | --- |
| `<LegalEditor content values onChange onValuesChange editable autoFees searchCases clauses hwpWasmUrl />` | 에디터 컴포넌트 |
| `clauses` | 기본 조항 목록 `{ id, title, category, html }[]` |
| `groupClauses(clauses, { category, query })` | 조항을 분류별로 묶음 `[분류, 조항[]][]` (분류 선택·검색 적용) |
| `formatCaseCitation(result)` | 판례 검색 결과 → `대법원 2016. 4. 28. 선고 2015다12345 판결` |
| `calcStampFee(소가, { electronic })` | 소장 인지액(원) |
| `calcPaymentOrderStampFee(청구금액)` | 지급명령 신청서 인지대(원) — 종이 신청 기준 |
| `calcServiceFee({ parties, procedure, unitFee })` | 송달료(원). `procedure`: 소액·단독·합의·항소·상고·조정·독촉 |
| `withCourtFees(names, values, options)` | 비어 있는 `인지액…`·`송달료…` 변수를 계산값으로 채운 입력값 |
| `templates` | 기본 문서 템플릿 `{ id, title, description, html }[]` — `<LegalEditor content={templates[0].html} />` |
| `toKoreanAmount(n)` | `37200000` → `삼천칠백이십만` |
| `formatAmount(n, '소장' \| '계약서')` | `금 37,200,000원` / `금 삼천칠백이십만 원정(₩37,200,000)` |
| `parseAmount(text)` | 글에서 숫자만 뽑기 (`금 37,200,000원` → `37200000`) |
| `fillTemplate(html, values)` | 변수를 채운 완성본 HTML. `.legal-doc` 안에서 렌더하면 번호가 붙어요 |
| `toDocx(editor.getJSON(), values)` | `.docx` Blob 생성 |
| `toHwpx(editor.getJSON(), values)` | `.hwpx` Blob 생성 |
| `toHwp(editor.getJSON(), values, { wasm })` | `.hwp`(HWP 5.0) Blob 생성. `wasm`은 WASM 주소나 바이트(선택) |
| `toPlainHtml(editor.getJSON(), values)` | 번호가 텍스트로 들어간 독립 HTML |
| `fromFile(file)` | `.docx` / `.doc` / `.hwp` / `.hwpx`를 에디터용 HTML로 변환 (`fromDocx`, `fromDoc`, `fromHwp`도 있음) |
| `normalizeLegalHtml(html)` | "제N조 / ① / 1. / 갑 제N호증" 문단을 조·항·호·호증 구조로 변환 |
| `Variable` | 다른 Tiptap 에디터에 넣어 쓸 수 있는 변수 확장 |
| `Numbering` | 번호·호증 문단 확장 (`setNumbering(1~4 \| null)`, `setEvidence('갑' \| '을' \| '병' \| null)`, Tab·Shift+Tab 단계 변경, 맨 앞 Backspace 해제) |
| `findCitations(text)` | 글에서 판례·법령 인용 찾기 → `{ type: 'case' \| 'law', text, from, to, url }[]` |
| `CitationLink` | 인용에 밑줄·링크를 덧입히는 확장 (`LegalEditor`에는 이미 들어 있음) |

## 로드맵

- [x] HWP / HWPX 열기, HWPX 저장
- [x] `.hwp` 바이너리로 바로 저장 ([rhwp](https://github.com/edwardkim/rhwp))
- [x] 옛 Word `.doc` 열기 ([@file-viewer/doc](https://www.npmjs.com/package/@file-viewer/doc))
- [ ] 표
- [ ] 조항 라이브러리(자주 쓰는 조항 끼워 넣기)

## 개발

```bash
npm i
npm run dev    # 데모: http://localhost:5173
npm run build  # dist/
```

## 기여

[기여 안내](./CONTRIBUTING.md) · [변경 기록](./CHANGELOG.md) · [보안 정책](./SECURITY.md)

## 라이선스

MIT
