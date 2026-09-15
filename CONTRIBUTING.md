# 기여 안내

이슈와 PR 모두 환영합니다.

## 개발

```bash
npm i
npm run dev     # 데모
npm run check   # 번호·변환 확인
npm run build
```

## 테스트 문서와 개인정보

실제 소장·고소장·계약서에는 이름, 주민등록번호, 주소, 연락처가 들어 있습니다.

- 실제 문서 파일을 이슈·PR·저장소에 올리지 마세요.
- 재현이 필요하면 이름과 번호를 가짜로 바꾼 문서나, 문단 구조만 남긴 예시를 써 주세요.

## PR

- 바뀐 동작은 `scripts/check.ts`에 확인을 한 줄이라도 추가해 주세요.
- `CHANGELOG.md`의 `[Unreleased]`에 변경 내용을 적어 주세요.

## 배포 (메인테이너)

1. `CHANGELOG.md`의 `[Unreleased]` 내용을 새 버전 제목(`## [0.2.0] - YYYY-MM-DD`) 아래로 옮기고 커밋
2. `npm version minor` (또는 `patch`·`major`) — 버전 수정 커밋과 `v0.2.0` 태그를 만듦
3. `git push --follow-tags` — `release.yml`이 npm 배포와 GitHub Release를 만듦
