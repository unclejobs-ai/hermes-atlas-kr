# Hermes Atlas KR

Hermes Agent 생태계를 한국어로 탐색하기 위한 별도 구현체입니다.

원본 Hermes Atlas를 그대로 번역한 fork가 아니라, 한국어 사용자를 위한 별도 정적 앱으로 구현했습니다.

- Production: https://hermes-atlas-kr.vercel.app
- GitHub: https://github.com/unclejobs-ai/hermes-atlas-kr
- 원본 데이터: https://github.com/ksimback/hermes-ecosystem

## 현재 범위

- 한국어 UI
- 한국어 카테고리 체계
- 검색/필터/정렬
- 홈 상세 패널 + 프로젝트 상세 페이지 링크
- Ask Atlas 한국어 RAG MVP
- `/api/chat` Vercel serverless API
- 111개 프로젝트 SEO 상세 페이지
- 6개 curated list 페이지
- `sitemap.xml`, `robots.txt`, canonical/OG meta
- upstream sync/localize/RAG/page generation 파이프라인
- GitHub Actions CI + nightly upstream sync PR

## 아직 완전 한글판이 아닌 부분

- 각 GitHub 프로젝트 README 전문 한국어화
- 모든 프로젝트 설명의 사람 손 검수 번역
- OpenRouter embedding 기반 hybrid retrieval
- 커스텀 도메인

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

- `data/repos.raw.json`: upstream 원본
- `data/repos.ko.json`: 앱이 읽는 한국어 데이터
- `data/overrides.ko.json`: 사람 검수 한국어 요약 source of truth
- `data/chunks.ko.json`: Ask Atlas RAG index
- `projects/**/index.html`, `lists/**/index.html`: SEO 정적 페이지

## 운영

- `CI`: push/PR마다 `npm run check`
- `Nightly upstream sync`: 매일 UTC 18:00 upstream 데이터를 동기화하고 변경사항이 있으면 PR 생성
- Vercel build command: `npm run build`
- Vercel output directory: `.`

## 환경 변수

필수 환경 변수는 없습니다.

선택:

- `OPENROUTER_API_KEY`: `/api/chat`에서 retrieved context 기반 LLM 답변 생성
- `OPENROUTER_MODEL`: 생략 시 `openai/gpt-4o-mini`

값은 커밋하지 않습니다.
