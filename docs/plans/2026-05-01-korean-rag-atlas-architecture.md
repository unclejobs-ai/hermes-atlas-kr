# Hermes Atlas KR RAG/Localization Architecture Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 원본 Hermes Atlas의 생태계 지도와 RAG 챗봇 구조를 한국어 사용자용 제품으로 재구축한다.

**Architecture:** 원본 `hermes-ecosystem`을 upstream data source로 두고, 한국어판은 별도 앱/별도 데이터 파이프라인을 가진다. GitHub repo metadata, README, research 문서를 수집한 뒤 한국어 요약/번역 레이어를 만들고, 한국어 검색용 BM25 + embedding RAG + repo metadata 주입으로 챗봇을 제공한다.

**Tech Stack:** Static HTML/CSS/JS, Vercel Serverless Functions, Node.js scripts, OpenRouter LLM/Embeddings, GitHub API, JSON data artifacts, optional Redis cache.

---

## 0. Current Baseline

### Existing upstream: `ksimback/hermes-ecosystem`

원본은 대략 이렇게 동작한다.

```txt
source docs
  research/*.md
  repos/*.md
  ECOSYSTEM.md
  drafts/*.md
      ↓ scripts/build-chunks.js
chunking by section / paragraph
      ↓ OpenRouter embeddings
      data/chunks.json
      ↓ api/chat.js
BM25 + cosine hybrid retrieval
      ↓ MMR rerank
retrieved context + repo metadata + core facts
      ↓ OpenRouter chat completion streaming
Ask the Atlas chatbot
```

핵심 파일:

```txt
scripts/build-chunks.js      # markdown → chunks + embeddings → data/chunks.json
api/chat.js                  # RAG retrieval + LLM streaming answer
data/repos.json              # repo catalog source of truth
scripts/build-pages.js       # repo/list static page generation
research/*.md                # RAG knowledge base
data/lists.json              # curated list config
```

### Current Korean-first prototype: `hermes-atlas-kr`

현재 새 구현체는 여기까지 되어 있다.

```txt
/Users/parkeungje/project/hermes-atlas-kr
├── index.html               # Korean-first single-page catalog
├── assets/app.js            # search/filter/sort/detail panel
├── assets/styles.css        # standalone visual system
├── data/repos.json          # upstream repos + categoryKo + descriptionKo scaffold
├── scripts/check.py         # smoke check
└── package.json
```

현재 한계:

- UI는 한국어지만, 프로젝트별 깊은 설명은 아직 원문 중심이다.
- README 전문, research 문서, 챗봇 지식베이스는 아직 한국어화되지 않았다.
- RAG API가 없다.
- 상세 페이지 생성기가 없다.
- upstream sync/translation workflow가 없다.

---

## 1. Product Definition

### Problem

Hermes Agent 생태계는 빠르게 커지고 있지만 대부분 영어 자료다. 한국어 사용자는 다음에서 막힌다.

- 어떤 프로젝트가 뭔지 한눈에 안 들어온다.
- README 전문을 읽기 전 카테고리/용도/추천 순서를 알고 싶다.
- “텔레그램에서 쓰려면?”, “메모리 제공자는 뭐가 좋아?”, “배포는 어떻게?” 같은 질문에 한국어로 답해주는 탐색 도구가 없다.

### Goal

한국어 사용자가 Hermes Agent 생태계를 다음 흐름으로 탐색하게 한다.

```txt
한글 랜딩
  → 목적별 카테고리
  → 프로젝트 카드
  → 한국어 요약 상세
  → 원문/README 링크
  → 한국어 Ask Atlas 챗봇
```

### Non-goals

초기 버전에서 하지 않는다.

- 원본 Hermes Atlas의 모든 디자인/페이지를 1:1 복제
- 모든 README를 사람이 검수한 완벽 번역으로 시작
- 사용자 계정/로그인/개인화
- 별도 DB 서버 운영
- 실시간 크롤링 기반 검색

---

## 2. Target Architecture

## 2.1 High-level

```txt
                ┌─────────────────────────────┐
                │ upstream hermes-ecosystem    │
                │ repos.json / research / docs │
                └──────────────┬──────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ scripts/sync-upstream.js                                      │
│ - fetch upstream data                                         │
│ - normalize repo catalog                                      │
│ - detect changed repos/docs                                   │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ scripts/localize-data.js                                      │
│ - category ko mapping                                         │
│ - repo one-line ko summary                                    │
│ - repo detail ko summary                                      │
│ - tags / use cases / audience                                 │
│ - cache by source hash                                        │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ data/*.json                                                   │
│ - repos.raw.json                                              │
│ - repos.ko.json                                               │
│ - sources.manifest.json                                       │
│ - translation-cache.json                                      │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│ scripts/build-pages.js        │   │ scripts/build-rag-index.js │
│ - index data                  │   │ - ko docs/chunks           │
│ - project pages               │   │ - BM25 index               │
│ - list pages                  │   │ - embeddings               │
└──────────────┬───────────────┘   └──────────────┬─────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│ static site                   │   │ api/chat.js                │
│ - Korean catalog              │   │ - Korean RAG               │
│ - detail pages                │   │ - repo metadata injection  │
│ - client search/filter        │   │ - streaming answer         │
└──────────────────────────────┘   └────────────────────────────┘
```

## 2.2 Data Source-of-Truth

Canonical source는 세 층으로 분리한다.

```txt
1. upstream raw source
   data/repos.raw.json
   research/raw/*.md
   repos/raw/*.md

2. generated Korean derived data
   data/repos.ko.json
   research-ko/*.md
   data/chunks.ko.json

3. manually curated Korean override
   data/overrides.ko.json
   research-ko/manual/*.md
```

원칙:

- upstream 원문은 절대 직접 수정하지 않는다.
- 한국어 요약/번역은 derived data로 저장한다.
- 사람이 고친 한국어 문장은 `overrides.ko.json`이 source-of-truth다.
- 자동 번역 결과는 언제든 재생성 가능해야 한다.

---

## 3. Data Model

## 3.1 `data/repos.raw.json`

upstream `data/repos.json` 원본 복사본.

```json
{
  "owner": "NousResearch",
  "repo": "hermes-agent",
  "name": "hermes-agent",
  "description": "The self-improving AI agent...",
  "stars": 83290,
  "url": "https://github.com/NousResearch/hermes-agent",
  "official": true,
  "category": "Core & Official"
}
```

## 3.2 `data/repos.ko.json`

한국어 앱이 직접 소비하는 canonical catalog.

```json
{
  "id": "NousResearch/hermes-agent",
  "owner": "NousResearch",
  "repo": "hermes-agent",
  "name": "hermes-agent",
  "url": "https://github.com/NousResearch/hermes-agent",
  "official": true,
  "stars": 83290,
  "category": "Core & Official",
  "categoryKo": "코어·공식",
  "oneLineKo": "Hermes Agent의 본체입니다. 메모리, 스킬, 도구 실행, 멀티 플랫폼 게이트웨이를 포함합니다.",
  "summaryKo": "Nous Research가 만든 자기개선형 AI 에이전트입니다. 터미널, 파일, 브라우저, 코드 실행 같은 도구를 직접 사용하고, 작업 경험을 스킬로 저장해 다음 세션에서 재사용합니다.",
  "useCasesKo": ["터미널 기반 개발 자동화", "텔레그램/디스코드 AI 봇", "장기 메모리 기반 작업 자동화"],
  "audienceKo": ["개발자", "자동화 파워유저", "AI 에이전트 빌더"],
  "tagsKo": ["에이전트", "메모리", "스킬", "멀티 플랫폼"],
  "sourceDescription": "The self-improving AI agent...",
  "sourceHash": "sha256...",
  "localizedAt": "2026-05-01T00:00:00Z",
  "localizationStatus": "machine_review_needed"
}
```

`localizationStatus` enum:

```txt
machine_draft          # 자동 생성 초안
machine_review_needed  # UI에 노출 가능하지만 사람 검수 전
human_reviewed         # 사람이 고친 요약
stale                  # upstream 변경으로 재검토 필요
failed                 # 생성 실패
```

## 3.3 `data/overrides.ko.json`

사람이 고친 최종 문장만 저장한다.

```json
{
  "NousResearch/hermes-agent": {
    "oneLineKo": "Hermes Agent의 공식 본체입니다.",
    "summaryKo": "...",
    "tagsKo": ["에이전트", "메모리", "스킬"]
  }
}
```

---

## 4. Korean RAG Design

## 4.1 RAG sources

한국어 RAG는 세 종류를 같이 넣는다.

```txt
A. 한국어 구조화 catalog
   data/repos.ko.json

B. 한국어 문서/가이드
   research-ko/*.md
   guides-ko/*.md

C. 원문 fallback context
   research/raw/*.md
   repos/raw/*.md
```

질문 답변 시 우선순위:

```txt
1. human_reviewed Korean content
2. machine Korean content
3. upstream English source
```

## 4.2 Chunk schema

`data/chunks.ko.json`

```json
{
  "id": "repo:NousResearch/hermes-agent:summary",
  "lang": "ko",
  "sourceType": "repo-summary",
  "source": "data/repos.ko.json",
  "repoId": "NousResearch/hermes-agent",
  "title": "hermes-agent",
  "section": "한국어 요약",
  "text": "Hermes Agent는 Nous Research가 만든 자기개선형 AI 에이전트입니다...",
  "sourceUrl": "https://github.com/NousResearch/hermes-agent",
  "embedding": [0.01, 0.02]
}
```

## 4.3 Retrieval

원본과 같은 하이브리드 방식 유지.

```txt
query
  ↓ query rewrite (한국어/영어 혼용 처리)
  ↓ embedding
  ↓ cosine top N
  ↓ Korean BM25 top N
  ↓ score = 0.65 cosine + 0.35 BM25
  ↓ MMR diversity rerank
  ↓ top 8 chunks
  ↓ repo metadata block injection if ranking/recommendation query
  ↓ answer in Korean
```

BM25 tokenization은 한국어를 고려해 바꿔야 한다.

초기 버전:

- 영어/숫자: `/[a-z0-9_-]+/`
- 한국어: 2글자 이상 연속 한글 n-gram-ish split
- repo name은 별도 exact token으로 추가

간단 구현:

```js
function tokenize(text) {
  const lower = text.toLowerCase();
  const latin = lower.match(/[a-z0-9_-]{2,}/g) || [];
  const korean = lower.match(/[가-힣]{2,}/g) || [];
  const koreanBigrams = [];
  for (const word of korean) {
    for (let i = 0; i < word.length - 1; i++) koreanBigrams.push(word.slice(i, i + 2));
  }
  return [...latin, ...korean, ...koreanBigrams].filter(t => !STOPWORDS.has(t));
}
```

## 4.4 Chat API Contract

Endpoint:

```txt
POST /api/chat
```

Request:

```json
{
  "message": "텔레그램에서 Hermes 쓰려면 뭐 보면 돼?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response:

- Streaming text
- 마지막에 optional metadata trailer

```txt
답변 본문...
‎__META__{"model":"google/gemini-...","sources":[...]}__META__‎
```

## 4.5 Korean System Prompt

```txt
너는 Hermes Atlas 한국어판의 안내자다.
기본 답변은 자연스러운 한국어로 한다.
제품명, repo 이름, CLI 명령어, 코드, 설정 키는 원문 그대로 둔다.

답변 규칙:
- 먼저 결론부터 말한다.
- 추천 질문이면 repo metadata의 star, category, official 여부를 반영한다.
- 설치/설정 질문이면 단계와 명령어를 준다.
- 출처가 있는 내용은 [Source: ...] 형식으로 표시한다.
- 한국어 자료가 부족하면 영어 원문 fallback을 요약하되, "원문 기준"이라고 표시한다.
- 모르면 모른다고 말하되, 대체로 확인할 링크를 제공한다.
```

---

## 5. Localization Pipeline

## 5.1 Source sync

Create: `scripts/sync-upstream.js`

Responsibilities:

- fetch upstream `data/repos.json`
- fetch upstream `data/lists.json`
- optionally fetch `research/*.md`, `repos/*.md`, `ECOSYSTEM.md`
- write raw copies
- compute source hashes

Output:

```txt
data/repos.raw.json
upstream/research/*.md
upstream/repos/*.md
upstream/ECOSYSTEM.md
data/source-manifest.json
```

## 5.2 Repo localization

Create: `scripts/localize-repos.js`

Inputs:

```txt
data/repos.raw.json
data/overrides.ko.json
```

Output:

```txt
data/repos.ko.json
```

LLM prompt should produce strict JSON:

```json
{
  "oneLineKo": "...",
  "summaryKo": "...",
  "useCasesKo": ["..."],
  "audienceKo": ["..."],
  "tagsKo": ["..."],
  "riskNoteKo": "선택 사항"
}
```

Rules:

- 자연스러운 한국어.
- “레포”, “프로젝트”, “도구”를 문맥에 맞게 사용.
- hype 금지.
- star 수로 품질 보장처럼 말하지 않기.
- upstream description 이상의 기능을 지어내지 않기.
- 확실하지 않으면 “원문 설명 기준”으로 표현.

## 5.3 Research translation

Create: `scripts/localize-research.js`

Mode:

```txt
raw markdown
  → preserve headings/code/URLs
  → translate prose into Korean
  → write research-ko/*.md
```

Rules:

- code blocks untouched
- CLI commands untouched
- env var/config key untouched
- source URL kept at top
- heading translated, but add original in comment if needed

Example:

```md
<!-- source: upstream/research/02-installation.md -->
# Hermes 설치

원문 기준으로 정리한 한국어 번역입니다.

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```
```

---

## 6. Static Site Design

## 6.1 Pages

Initial production scope:

```txt
/                         # Korean landing/catalog
/projects/:owner/:repo    # Korean project detail page
/lists/:slug              # Korean curated list
/about                    # About this Korean edition
/api/chat                 # RAG chatbot
```

Current SPA can remain for MVP, but production should generate static project pages for SEO/shareability.

## 6.2 Detail page content

Each project page should show:

```txt
- repo name
- categoryKo
- official badge
- stars/forks/update if available
- oneLineKo
- summaryKo
- useCasesKo
- audienceKo
- tagsKo
- sourceDescription
- GitHub link
- upstream Hermes Atlas project link if exists
- related projects in same category
```

## 6.3 Search UX

Client search should use `data/repos.ko.json`.

Search fields:

```txt
owner/repo
name
oneLineKo
summaryKo
tagsKo
categoryKo
sourceDescription
```

Ranking:

1. exact repo match
2. tag/category match
3. Korean summary match
4. source description match
5. stars desc tie-breaker

---

## 7. Implementation Tasks

### Task 1: Freeze the current prototype as baseline

**Objective:** 현재 `hermes-atlas-kr`를 깨지 않는 기준점으로 고정한다.

**Files:**
- Existing: `index.html`
- Existing: `assets/app.js`
- Existing: `assets/styles.css`
- Existing: `data/repos.json`

**Steps:**

1. Run:
   ```bash
   cd /Users/parkeungje/project/hermes-atlas-kr
   npm run check
   ```
2. Expected:
   ```txt
   OK: 100 repos, Korean-first static app files present
   ```
3. Browser check:
   ```bash
   npm run serve
   ```
   open `http://127.0.0.1:4181`.
4. Verify search `telegram` returns 3 projects and detail panel follows first result.
5. Commit if dirty.

---

### Task 2: Split raw and Korean repo data

**Objective:** `data/repos.json`를 raw source와 Korean app data로 분리한다.

**Files:**
- Create: `data/repos.raw.json`
- Create: `data/repos.ko.json`
- Modify: `assets/app.js`
- Modify: `scripts/check.py`

**Steps:**

1. Copy current upstream-ish records to `data/repos.raw.json`.
2. Move Korean fields to `data/repos.ko.json`.
3. Update app fetch:
   ```js
   state.repos = await fetch('./data/repos.ko.json').then(r => r.json());
   ```
4. Keep `data/repos.json` temporarily as compatibility alias or remove after check update.
5. Run:
   ```bash
   npm run check
   ```
6. Browser verify.
7. Commit:
   ```bash
   git add data assets scripts
   git commit -m "refactor: split raw and Korean repo data"
   ```

---

### Task 3: Add upstream sync script

**Objective:** 원본 Hermes Atlas에서 최신 catalog를 가져오는 스크립트를 만든다.

**Files:**
- Create: `scripts/sync-upstream.js`
- Create: `data/source-manifest.json`
- Modify: `package.json`

**Implementation outline:**

```js
import fs from 'fs';
import crypto from 'crypto';

const SOURCES = {
  repos: 'https://raw.githubusercontent.com/ksimback/hermes-ecosystem/main/data/repos.json',
  lists: 'https://raw.githubusercontent.com/ksimback/hermes-ecosystem/main/data/lists.json',
};

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const repos = await fetchJson(SOURCES.repos);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/repos.raw.json', JSON.stringify(repos, null, 2));
fs.writeFileSync('data/source-manifest.json', JSON.stringify({
  syncedAt: new Date().toISOString(),
  sources: SOURCES,
  hashes: { repos: hash(repos) },
}, null, 2));
```

**Verification:**

```bash
node scripts/sync-upstream.js
node -e "console.log(require('./data/repos.raw.json').length)"
```

Expected: 80+ repos.

---

### Task 4: Add deterministic Korean scaffold localizer

**Objective:** LLM 없이도 항상 `repos.ko.json`를 만들 수 있는 deterministic fallback을 만든다.

**Files:**
- Create: `scripts/localize-repos.js`
- Create: `data/category-map.ko.json`
- Modify: `package.json`

**Behavior:**

- Read `data/repos.raw.json`.
- Apply categoryKo.
- Generate neutral Korean oneLine scaffold.
- Preserve sourceDescription.
- Apply `data/overrides.ko.json` if present.

**Verification:**

```bash
node scripts/localize-repos.js
npm run check
```

---

### Task 5: Add LLM Korean repo summary generation

**Objective:** 각 프로젝트의 oneLineKo/summaryKo/useCasesKo/tagsKo를 LLM으로 생성한다.

**Files:**
- Create: `scripts/generate-repo-summaries.js`
- Create: `data/translation-cache.json`
- Modify: `package.json`

**Rules:**

- Use `OPENROUTER_API_KEY`.
- Batch small, retry with backoff.
- Strict JSON parse.
- Cache by `owner/repo + sourceHash`.
- Do not overwrite human overrides.

**Command:**

```bash
OPENROUTER_API_KEY=... node scripts/generate-repo-summaries.js --limit 10
```

**Acceptance:**

- 10 repos get natural Korean summaries.
- No mixed English/Korean suffix artifacts like `워크플로s`.
- JSON validates.

---

### Task 6: Build Korean RAG chunks

**Objective:** Korean repo summaries + research-ko docs를 RAG chunks로 만든다.

**Files:**
- Create: `scripts/build-rag-index.js`
- Create: `data/chunks.ko.json`
- Modify: `package.json`

**Inputs:**

```txt
data/repos.ko.json
research-ko/*.md
```

**Chunk types:**

```txt
repo-summary
repo-use-cases
guide-section
research-section
```

**Verification:**

```bash
OPENROUTER_API_KEY=... node scripts/build-rag-index.js
node -e "const c=require('./data/chunks.ko.json'); console.log(c.length, c[0])"
```

---

### Task 7: Implement Korean RAG API

**Objective:** `/api/chat.js`를 추가해 한국어 Ask Atlas를 제공한다.

**Files:**
- Create: `api/chat.js`
- Create: `lib/retrieval.js`
- Create: `lib/openrouter.js`
- Modify: `package.json`

**Core functions:**

```js
loadChunks()
tokenizeKoEn(text)
bm25Score(query, index)
cosineSimilarity(a, b)
mmrSelect(candidates, k)
buildRepoMetadataBlock(query)
streamAnswer(messages, res)
```

**Acceptance:**

질문:

```txt
텔레그램에서 Hermes 쓰려면 어떤 프로젝트 보면 돼?
```

답변은 다음을 포함해야 한다.

- 관련 프로젝트 2~4개
- 왜 보는지
- GitHub 링크 또는 repo name
- 한국어 설명
- 출처

---

### Task 8: Add chat UI

**Objective:** 현재 catalog 앱에 한국어 Ask Atlas 패널을 붙인다.

**Files:**
- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `assets/styles.css`

**UI:**

```txt
오른쪽 아래 버튼: Atlas에게 질문
패널:
  - title: Hermes Atlas 한국어 Q&A
  - input placeholder: "예: 메모리 제공자는 뭐가 좋아?"
  - clear / close
  - streaming answer
```

**Safety:**

- Render assistant text safely.
- Escape HTML before minimal markdown formatting.
- Timeout 90s.
- Friendly Korean error messages.

---

### Task 9: Generate project detail pages

**Objective:** SEO/share 가능한 `/projects/{owner}/{repo}` 정적 페이지를 만든다.

**Files:**
- Create: `scripts/build-pages.js`
- Create: `projects/**.html`
- Modify: `package.json`

**Page sections:**

```txt
- Korean title/summary
- category/use cases/tags
- original description
- GitHub link
- related projects
- source attribution
```

**Verification:**

```bash
node scripts/build-pages.js
python3 -m http.server 4181
open /projects/NousResearch/hermes-agent.html
```

---

### Task 10: Add Vercel deployment config

**Objective:** 정적 앱 + serverless RAG를 Vercel에 배포 가능하게 만든다.

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

**Config:**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "cleanUrls": true,
  "functions": {
    "api/*.js": { "maxDuration": 60 }
  }
}
```

**Required env:**

```txt
OPENROUTER_API_KEY
GITHUB_TOKEN optional
```

---

## 8. Build Scripts Summary

Final `package.json` scripts should look like:

```json
{
  "scripts": {
    "serve": "python3 -m http.server 4181",
    "check": "node --check assets/app.js && node --check api/chat.js && python3 scripts/check.py",
    "sync": "node scripts/sync-upstream.js",
    "localize": "node scripts/localize-repos.js",
    "summaries": "node scripts/generate-repo-summaries.js",
    "rag": "node scripts/build-rag-index.js",
    "pages": "node scripts/build-pages.js",
    "build": "npm run localize && npm run pages"
  }
}
```

---

## 9. Quality Gates

### Data quality

- No malformed JSON.
- All repos have `id`, `categoryKo`, `oneLineKo`, `summaryKo`, `sourceDescription`.
- No obvious mixed suffix artifacts: `s`, `ing`, `워크플로s`, `에이전트s`.
- Human overrides win over machine generation.

### RAG quality

Test questions:

```txt
Hermes Agent가 뭐야?
텔레그램으로 쓰려면 뭐가 필요해?
메모리 제공자는 뭐가 좋아?
배포 옵션 추천해줘.
Claude Code랑 Hermes 차이가 뭐야?
스킬 레지스트리는 어디를 보면 돼?
```

Each answer should:

- answer in Korean
- cite sources
- mention repo names exactly
- include commands when setup-related
- avoid fabricated claims

### UI quality

- Search/filter/sort works.
- Detail panel tracks filtered results.
- Mobile layout readable.
- Console has no JS errors.
- Korean line breaks are natural enough.

---

## 10. Rollout Plan

### Phase 1: Catalog MVP

Status: mostly done.

- Korean-first UI
- 100 repo catalog
- search/filter/sort
- detail panel

### Phase 2: Clean Korean data

- split raw/ko data
- deterministic localizer
- LLM summary generator
- first 100 project Korean summaries

### Phase 3: RAG MVP

- build `chunks.ko.json`
- add `/api/chat.js`
- add chat UI
- test 6 canonical questions

### Phase 4: Static pages + SEO

- project pages
- list pages
- sitemap
- OG metadata Korean

### Phase 5: Upstream sync automation

- GitHub Action daily/weekly sync
- changed source detection
- stale localization report
- PR generated when upstream changes

---

## 11. Risks and Decisions

### Risk: automatic translation sounds bad

Mitigation:

- Keep raw source visible.
- Use neutral scaffold if no reviewed Korean exists.
- Store human overrides.
- Add quality scanner for mixed-language artifacts.

### Risk: RAG answers outdated facts

Mitigation:

- source manifest with timestamps
- cite sources
- scheduled rebuild
- separate CORE FACTS file maintained manually

### Risk: embedding cost

Mitigation:

- cache by sourceHash
- only re-embed changed chunks
- start with repo summaries before full README translation

### Risk: Korean retrieval quality

Mitigation:

- Korean bigram tokenization for BM25
- bilingual query rewrite
- repo metadata injection for recommendation queries
- exact repo/name/tag boosting

---

## 12. Immediate Next Step

Do not jump straight into full README translation.

Next implementation should be:

```txt
Task 2 → Task 3 → Task 4
```

즉:

1. raw/ko 데이터 분리
2. upstream sync script
3. deterministic localizer

그 다음에 LLM summary generation과 RAG를 붙인다.

이 순서가 맞는 이유:

- 데이터 source-of-truth가 먼저 정리돼야 한다.
- 그래야 번역 캐시/override/staleness를 안정적으로 설계할 수 있다.
- RAG는 “좋은 한국어 데이터”가 생긴 뒤 붙여야 답변 품질이 나온다.
