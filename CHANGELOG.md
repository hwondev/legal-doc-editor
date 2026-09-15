# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### Added

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
