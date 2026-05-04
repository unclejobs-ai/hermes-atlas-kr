# Hermes Atlas 한국어판

Hermes Agent 생태계를 한국어로 탐색하기 위한 별도 구현체입니다.

원본 Hermes Atlas를 그대로 번역한 fork가 아니라, 한국어 사용자를 위한 별도 정적 앱으로 구현했습니다.

- 운영 주소: https://hermes-atlas-kr.vercel.app
- 저장소: https://github.com/unclejobs-ai/hermes-atlas-kr
- 원본 데이터: https://github.com/ksimback/hermes-ecosystem

## 현재 범위

- 한국어 UI
- 한국어 카테고리 체계
- 검색/필터/정렬
- 홈 상세 패널 + 프로젝트 상세 페이지 링크
- 한국어 질문 기능
- `/api/chat` Vercel 서버리스 라우트
- 111개 프로젝트 검색 노출용 상세 페이지
- 6개 추천 리스트 페이지
- `sitemap.xml`, `robots.txt`, 표준 URL/공유 메타데이터
- 111개 프로젝트 한국어 요약 커버리지
- 원본 문서 검색 근거 포함
- 커스텀 OG 이미지
- 커스텀 도메인 연결 문서

## 원문을 보존하는 부분

- 저장소 이름, 소유자, 명령어, 라이선스, URL은 정확한 확인을 위해 원문을 유지합니다.
- 긴 원문 문서는 한국어 검색 근거로 쓰되, 전문 번역본처럼 노출하지 않습니다.
- 사람 손 검수 요약은 계속 늘리되, 모든 프로젝트는 한국어 요약을 갖고 있습니다.

## 실행

```bash
npm run serve
```

브라우저:

```txt
http://localhost:4181
```

## 검증

```bash
npm run check
```

## 빌드

```bash
npm run build
```

`build`는 아래 순서로 실행됩니다.

```bash
npm run localize
npm run rag
npm run pages
npm run report
```

## 데이터 갱신

```bash
npm run sync
npm run localize
npm run rag
npm run pages
npm run report
npm run check
```

- `data/repos.raw.json`: 원본 데이터
- `data/repos.ko.json`: 앱이 읽는 한국어 데이터
- `data/overrides.ko.json`: 사람 검수 한국어 요약 기준 데이터
- `data/chunks.ko.json`: 한국어 질문 검색 인덱스
- `data/docs.raw.json`: 원본 문서 검색 근거
- `assets/og/atlas-card.svg`: 공유용 OG 이미지
- `projects/**/index.html`, `lists/**/index.html`: SEO 정적 페이지

## 운영

- `CI`: 푸시와 PR마다 `npm run check`
- `Nightly upstream sync`: 매일 UTC 18:00 원본 데이터를 동기화하고 변경사항이 있으면 PR 생성
- Vercel 빌드 명령: `npm run build`
- Vercel 출력 경로: `.`
- 커스텀 도메인 연결 절차: `docs/custom-domain.md`

## 환경 변수

필수 환경 변수는 없습니다.

질문 기능은 외부 LLM API 없이 로컬 한국어 검색 인덱스만 사용합니다.
