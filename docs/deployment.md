# Hermes Atlas KR 배포 메모

## GitHub

원격 저장소:

https://github.com/unclejobs-ai/hermes-atlas-kr

기본 브랜치: `main`

## Vercel

권장 설정:

- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `.`
- Install Command: 비워도 됨. 의존성 없음.
- Root Directory: repository root

필수 환경 변수는 없습니다.

선택 환경 변수:

- `OPENROUTER_API_KEY`: `/api/chat`이 retrieved context를 기반으로 LLM 한국어 답변을 생성할 때 사용합니다.
- `OPENROUTER_MODEL`: 생략 시 `openai/gpt-4o-mini`를 사용합니다.

환경 변수 값은 repo에 커밋하지 않습니다.

## 동작 모드

- 로컬 정적 서버: `/api/chat`이 없으면 브라우저 내부 RAG fallback으로 답변합니다.
- Vercel 배포: `/api/chat` serverless function이 먼저 동작합니다.
- `OPENROUTER_API_KEY`가 없거나 유효하지 않으면 API도 local RAG 답변으로 fallback합니다.

## 배포 전 검증

```bash
npm run check
npm run build
```

## 데이터 갱신

수동 갱신:

```bash
npm run sync
npm run localize
npm run rag
npm run pages
npm run check
```

자동 갱신:

- `.github/workflows/nightly-sync.yml`
- 매일 UTC 18:00 실행
- upstream 변경사항이 있으면 `chore/nightly-upstream-sync` 브랜치와 PR 생성
- 사람 검수 대상:
  - `data/repos.raw.json`
  - `data/repos.ko.json`
  - `data/chunks.ko.json`
  - `projects/**/index.html`
  - `lists/**/index.html`
  - `sitemap.xml`

`data/overrides.ko.json`은 사람 검수 한국어 요약의 source of truth입니다.
