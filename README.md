# legal-doc-editor

[![npm](https://img.shields.io/npm/v/legal-doc-editor)](https://www.npmjs.com/package/legal-doc-editor) [![CI](https://github.com/hwondev/legal-doc-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/hwondev/legal-doc-editor/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/legal-doc-editor)](./LICENSE)

계약서·합의서 같은 **법률문서를 만드는 React 에디터**입니다.

- **조·항·호 자동 번호**: 조를 넣거나 옮기면 제1조, ①, 1. 번호가 알아서 다시 매겨져요
- **`{{변수}}` 채우기**: 본문에 `{{갑}}`을 입력하면 입력칸이 생기고, 값을 넣으면 문서에 반영돼요
- **한글(.hwp·.hwpx)·Word(.docx) 열기·저장**: 일반 문단으로 쓴 계약서도 "제N조", "①", "1." 패턴을 인식해서 조·항·호 구조로 바꿔요
  - 저장은 `.docx`와 `.hwpx`예요. `.hwpx`는 한글 2014 이상에서 열리고, 한글에서 `.hwp`로 다시 저장할 수 있어요
  - 파일 변환 라이브러리는 필요할 때만 불러와서 에디터 본체 번들은 가벼워요
- **판례·법령 인용 링크**: 본문의 `민법 제750조`, `대법원 2016. 4. 28. 선고 2015다12345 판결`, `2024가단157033` 같은 인용을 알아보고 [국가법령정보센터](https://www.law.go.kr) 링크를 붙여요 (API 키가 필요 없어요)
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
| `table` | 표 | 표 |
| `ol > li` | 항 | ①, ② |
| `ol ol > li` | 호 | 1., 2. |
| `span[data-var]` 또는 `{{이름}}` | 변수 | 입력값 |

### 판례·법령 인용

본문에 적힌 인용을 알아보고 밑줄을 그어요. 마우스를 올리면 주소가 보이고, Ctrl(⌘)+클릭하면 국가법령정보센터에서 열려요 (읽기 전용일 때는 그냥 클릭).

| 형식 | 예 | 링크 |
| --- | --- | --- |
| 판결·결정 | `대법원 2016. 4. 28. 선고 2015다12345 판결`, `대법원 2020. 1. 9.자 2019마123 결정` | 판례 검색 |
| 사건번호 | `2015다12345`, `2018노1234`, `2024가단157033` | 판례 검색 |
| 법령 조문 | `민법 제750조`, `형법 제347조 제1항`, `특정경제범죄 가중처벌 등에 관한 법률 제3조` | 해당 조문 |

**문서 데이터는 바뀌지 않아요.** 화면에만 덧입히는 표시라서 `onChange` HTML, `toPlainHtml`, `.docx`·`.hwpx` 저장 결과는 인용이 없을 때와 똑같아요. 인쇄할 때도 밑줄이 빠져요.

날짜(`2026. 9. 2.`), 전화번호, 계좌번호는 인용으로 보지 않아요. 다만 인용 인식은 글자 모양만 보는 것이라 놓치거나 잘못 잡을 수 있고, 링크가 가리키는 조문이 실제로 맞는지는 직접 확인해 주세요.

### 인지액·송달료 자동 계산

`<LegalEditor autoFees />`로 켜면, 입력값 `소가`(또는 `소송목적의 값`)를 넣었을 때 이름이 `인지액`·`송달료`로 시작하는 변수(예: `{{인지액 산정 필요}}`)를 계산해서 채워요. 직접 입력한 값이 있으면 그 값을 써요.

| 항목 | 기준 | 근거 |
| --- | --- | --- |
| 인지액 | 1천만원 미만 × 0.5% / 1억원 미만 × 0.45% + 5천원 / 10억원 미만 × 0.4% + 5만5천원 / 그 이상 × 0.35% + 55만5천원. 100원 미만 버림, 최저 1천원 | 「민사소송 등 인지법」 제2조 |
| 전자소송 인지액 | 위 계산식 × 0.9 후 100원 미만 버림, 최저 900원 — `autoFees={{ electronic: true }}` | 인지법 제16조, [전자소송포털](https://ecfs.scourt.go.kr/psp/link.on?m=PSP007P01) |
| 송달료 | 당사자 수 × 회분 × 1회 송달료. 소가 3천만원 이하(소액) 10회분, 넘으면 15회분. 당사자 수 기본 2 — `autoFees={{ parties: 3 }}` | 「송달료규칙의 시행에 따른 업무처리요령」 별표 1, 「소액사건심판규칙」 제1조의2 |
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
| `<LegalEditor content values onChange onValuesChange editable autoFees />` | 에디터 컴포넌트 |
| `calcStampFee(소가, { electronic })` | 소장 인지액(원) |
| `calcServiceFee({ parties, procedure, unitFee })` | 송달료(원). `procedure`: 소액·단독·합의·항소·상고·조정 |
| `withCourtFees(names, values, options)` | 비어 있는 `인지액…`·`송달료…` 변수를 계산값으로 채운 입력값 |
| `toKoreanAmount(n)` | `37200000` → `삼천칠백이십만` |
| `formatAmount(n, '소장' \| '계약서')` | `금 37,200,000원` / `금 삼천칠백이십만 원정(₩37,200,000)` |
| `parseAmount(text)` | 글에서 숫자만 뽑기 (`금 37,200,000원` → `37200000`) |
| `fillTemplate(html, values)` | 변수를 채운 완성본 HTML. `.legal-doc` 안에서 렌더하면 번호가 붙어요 |
| `toDocx(editor.getJSON(), values)` | `.docx` Blob 생성 |
| `toHwpx(editor.getJSON(), values)` | `.hwpx` Blob 생성 |
| `toPlainHtml(editor.getJSON(), values)` | 번호가 텍스트로 들어간 독립 HTML |
| `fromFile(file)` | `.docx` / `.hwp` / `.hwpx`를 에디터용 HTML로 변환 (`fromDocx`, `fromHwp`도 있음) |
| `normalizeLegalHtml(html)` | "제N조 / ① / 1." 문단을 조·항·호 구조로 변환 |
| `Variable` | 다른 Tiptap 에디터에 넣어 쓸 수 있는 변수 확장 |
| `Numbering` | 번호 문단 확장 (`setNumbering(1~4 \| null)`, Tab·Shift+Tab 단계 변경, 맨 앞 Backspace 해제) |
| `findCitations(text)` | 글에서 판례·법령 인용 찾기 → `{ type: 'case' \| 'law', text, from, to, url }[]` |
| `CitationLink` | 인용에 밑줄·링크를 덧입히는 확장 (`LegalEditor`에는 이미 들어 있음) |

## 로드맵

- [x] HWP / HWPX 열기, HWPX 저장
- [ ] `.hwp` 바이너리로 바로 저장 ([rhwp](https://github.com/edwardkim/rhwp) 검토)
- [ ] 옛 Word `.doc` 열기
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
