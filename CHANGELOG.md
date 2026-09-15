# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

## [0.12.0] - 2026-09-16

### Added

- 본문 호증 참조 자동 갱신 — 호증 문단에 고정 id(`data-evidence-id`), 본문의 `갑 제N호증`은 그 증거를 가리키는 참조(`span[data-evidence-ref]`, `EvidenceRef` 확장)로 바뀌어 증거를 넣고 빼거나 옮겨도 번호가 따라감. 가리키던 증거를 지우면 빨간 밑줄.
  본문에 `갑 제2호증`을 입력하면 참조로 바뀌고(Backspace로 되돌림), 불러오기는 자동 번호로 바꾼 증거가 있을 때만 참조로 바꿈(범위 표기는 글자로). 내보내기는 현재 번호 글자로. `evidenceLabels` export, 소장(대여금) 템플릿 청구원인에 참조 적용

### Changed

- 호증 문단 맨 앞에서 Enter를 누르면 문단을 나누지 않고 위에 빈 호증 문단을 넣음 (본문 참조가 엉뚱한 증거로 옮겨가지 않게)

## [0.11.0] - 2026-09-16

### Added

- 채무부존재 확인서 템플릿 `debt-nonexistence-certificate` — 빚을 갚았거나 합의한 뒤 채권자가 채무가 없음을 확인해 주는 문서. 당사자(이름·생년월일·주소), 원래 계약과 채무, 채무가 없어진 경위, 부존재 확인, 이후 청구하지 않음, 채권자·채무자 서명

## [0.10.0] - 2026-09-16

### Added

- 소장(채무부존재확인) 템플릿 `complaint-debt-nonexistence` — 청구취지(채무 부존재 확인·소송비용), 청구원인(당사자 관계·피고가 주장하는 채무·채무가 존재하지 않는 이유·확인을 구하는 이유), 입증방법(호증 자동 번호), 첨부서류.
  소가는 「민사소송 등 인지규칙」 제12조제1호(확인의 소는 권리의 종류에 따른 가액)에 따라 직접 적고, 인지액·송달료는 `autoFees`로 채움

## [0.9.0] - 2026-09-15

### Added

- 입증방법 호증 번호 자동 매기기 — `p[data-evidence="갑"|"을"|"병"]` 문단에 `갑 제1호증`, `갑 제2호증`…을 자동으로 매김(당사자별로 문서 전체에서 이어 셈, 번호 문단과 함께 쓰면 `1. 갑 제1호증`). 툴바 **호증** 버튼(갑 → 을 → 해제), Enter로 다음 호증, `setEvidence` 명령.
  불러오기는 입증방법·증명방법·증거방법 소제목 아래에서 번호가 차례대로일 때만 바꾸고, 가지번호(`제1호증의 1`)·`내지` 범위·본문 속 참조는 글자로 둠. 소장(대여금) 템플릿에 적용

### Fixed

- 불러온 HTML에 이미 `h1`~`h3` 태그로 된 소제목(워드 제목 스타일 등)이 있으면 그 뒤 `1.` 번호 문단이 1부터 다시 시작하지 않아 글자로 남던 문제

## [0.8.0] - 2026-09-15

### Added

- 조항 라이브러리 분류별 보기 — 분류 칩(개수 표시)으로 좁히기, `전체`에서는 분류 제목 아래로 묶어 표시, 검색과 함께 적용. `groupClauses` export

## [0.7.0] - 2026-09-15

### Changed

- 불러오기에서 `제1조(목적) 이 계약은…`처럼 제목과 본문이 한 문단에 붙은 조를 조 제목(`(목적)`)과 본문 문단으로 나눔. 괄호 안 괄호·굵게 서식 유지, 괄호 없는 짧은 한 줄은 전체를 제목으로, 문장만 있으면 제목 없이 본문으로

## [0.6.0] - 2026-09-15

### Added

- 옛 Word `.doc`(97–2003) 열기 — `fromDoc`, `fromFile`과 열기 버튼이 `.doc`를 받음. [@file-viewer/doc](https://www.npmjs.com/package/@file-viewer/doc)으로 읽어 글자·표를 옮긴 뒤 기존 구조 정리(제N조·①·1.·빈칸 변수)를 거침. 글자 서식·그림은 옮기지 않음

## [0.5.0] - 2026-09-15

### Added

- `.hwp`(HWP 5.0) 바로 저장 — `toHwp`와 툴바 **한글(.hwp) 저장** 버튼, `hwpWasmUrl` 옵션. `.hwpx`를 [@rhwp/core](https://github.com/edwardkim/rhwp)(WASM)로 변환하며, WASM은 처음 저장할 때만 불러옴
- 저장에 실패하면 알림을 띄움

## [0.4.0] - 2026-09-15

### Added

- 조항 라이브러리 — `clauses` 기본 조항 11개와 `LegalEditor`의 `clauses` 옵션. 검색해서 누르면 커서 위치에 조항이 들어가고 조 번호가 다시 매겨짐

## [0.3.0] - 2026-09-15

### Added

- 지급명령 인지대·송달료 자동 계산 — `calcPaymentOrderStampFee`(소장 인지액의 1/10, 종이 신청 기준), 송달료 독촉 6회분.
  `autoFees`가 지급명령 템플릿의 `{{독촉절차 인지대}}`·`{{독촉절차 송달료}}`·`{{독촉절차비용}}`을 채움
- 판례 검색 패널 — `LegalEditor`의 `searchCases` 옵션과 `formatCaseCitation`. 결과를 누르면 인용 문구가 커서 위치에 들어감.
  국가법령정보 공동활용 API 연결 예제 서버(`examples/law-go-kr-proxy`)

## [0.2.0] - 2026-09-15

### Added

- 판례·법령 인용 자동 인식과 국가법령정보센터 링크 — `findCitations(text)`, `CitationLink` 확장.
  본문의 `대법원 2016. 4. 28. 선고 2015다12345 판결`, `2024가단157033`, `민법 제750조` 같은 표기에
  밑줄과 링크를 덧입힘 (화면 표시만 바뀌고 문서 데이터·내보내기 결과는 그대로)
- 문서 템플릿 `templates` — 소장(대여금)·고소장(사기)·내용증명·지급명령 신청서. 사람·주소·금액은 모두 `{{변수}}`,
  데모에서 드롭다운으로 고를 수 있음
- 금액 표기 — `toKoreanAmount`, `formatAmount`, `parseAmount`와 툴바 **금액**·**금액(한글)** 버튼
  (`금 37,200,000원` / `금 삼천칠백이십만 원정(₩37,200,000)`, "일"을 빼지 않는 표기)
- 인지액·송달료 계산 — `calcStampFee`, `calcServiceFee`, `withCourtFees`와 `LegalEditor`의 `autoFees` 옵션.
  소가를 넣으면 `{{인지액 산정 필요}}`·`{{송달료}}` 같은 빈칸을 채움 (참고용, 직접 입력한 값 우선)
- GitHub Actions CI(타입 검사·체크·빌드)와 태그 push 시 npm 자동 배포
- 기여 안내, 보안 정책, 버그 제보 템플릿

## [0.1.0] - 2026-09-15

첫 공개 버전입니다.

### Added

- `LegalEditor` React 컴포넌트 (Tiptap 기반)
- 조·항·호 자동 번호(제N조, ①, 1.)와 소장식 번호 문단(1. → 가. → (1) → (가))
- 소제목(청구취지·고소이유 등), 표, `{{변수}}` 입력칸
- 열기 `.hwp`·`.hwpx`·`.docx`, 저장 `.hwpx`·`.docx`, 인쇄·PDF
- 문단으로만 된 문서를 불러올 때 구조로 정리 — 원문 번호와 자동 번호가 같을 때만 변환해서 글자가 바뀌지 않음
- API: `fillTemplate`, `toPlainHtml`, `toDocx`, `toHwpx`, `fromFile`, `normalizeLegalHtml`, `Variable`, `Numbering`

[Unreleased]: https://github.com/hwondev/legal-doc-editor/compare/v0.12.0...HEAD
[0.12.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/hwondev/legal-doc-editor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hwondev/legal-doc-editor/releases/tag/v0.1.0
