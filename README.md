# legal-doc-editor

[![npm](https://img.shields.io/npm/v/legal-doc-editor)](https://www.npmjs.com/package/legal-doc-editor) [![CI](https://github.com/hwondev/legal-doc-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/hwondev/legal-doc-editor/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/legal-doc-editor)](./LICENSE)

계약서·합의서 같은 **법률문서를 만드는 React 에디터**입니다.

- **조·항·호 자동 번호**: 조를 넣거나 옮기면 제1조, ①, 1. 번호가 알아서 다시 매겨져요
- **`{{변수}}` 채우기**: 본문에 `{{갑}}`을 입력하면 입력칸이 생기고, 값을 넣으면 문서에 반영돼요
- **한글(.hwp·.hwpx)·Word(.docx) 열기·저장**: 일반 문단으로 쓴 계약서도 "제N조", "①", "1." 패턴을 인식해서 조·항·호 구조로 바꿔요
  - 저장은 `.docx`와 `.hwpx`예요. `.hwpx`는 한글 2014 이상에서 열리고, 한글에서 `.hwp`로 다시 저장할 수 있어요
  - 파일 변환 라이브러리는 필요할 때만 불러와서 에디터 본체 번들은 가벼워요
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

## API

| 이름 | 설명 |
| --- | --- |
| `<LegalEditor content values onChange onValuesChange editable />` | 에디터 컴포넌트 |
| `fillTemplate(html, values)` | 변수를 채운 완성본 HTML. `.legal-doc` 안에서 렌더하면 번호가 붙어요 |
| `toDocx(editor.getJSON(), values)` | `.docx` Blob 생성 |
| `toHwpx(editor.getJSON(), values)` | `.hwpx` Blob 생성 |
| `toPlainHtml(editor.getJSON(), values)` | 번호가 텍스트로 들어간 독립 HTML |
| `fromFile(file)` | `.docx` / `.hwp` / `.hwpx`를 에디터용 HTML로 변환 (`fromDocx`, `fromHwp`도 있음) |
| `normalizeLegalHtml(html)` | "제N조 / ① / 1." 문단을 조·항·호 구조로 변환 |
| `Variable` | 다른 Tiptap 에디터에 넣어 쓸 수 있는 변수 확장 |
| `Numbering` | 번호 문단 확장 (`setNumbering(1~4 \| null)`, Tab·Shift+Tab 단계 변경, 맨 앞 Backspace 해제) |

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
