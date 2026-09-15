# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### Added

- 판례·법령 인용 자동 인식과 국가법령정보센터 링크 — `findCitations(text)`, `CitationLink` 확장.
  본문의 `대법원 2016. 4. 28. 선고 2015다12345 판결`, `2024가단157033`, `민법 제750조` 같은 표기에
  밑줄과 링크를 덧입힘 (화면 표시만 바뀌고 문서 데이터·내보내기 결과는 그대로)
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

[Unreleased]: https://github.com/hwondev/legal-doc-editor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hwondev/legal-doc-editor/releases/tag/v0.1.0
