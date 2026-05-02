#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const [k, inline] = arg.slice(2).split('=');
    args.set(k, inline ?? process.argv[i + 1]);
    if (inline === undefined) i++;
  }
}

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotenv(path.join(os.homedir(), '.hermes', '.env'));
loadDotenv('.env');

const API_KEY = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.startsWith('sk-')
  ? process.env.OPENROUTER_API_KEY
  : '';
const MODEL = args.get('model') || process.env.KR_SUMMARY_MODEL || 'google/gemini-2.5-flash';
const LIMIT = Number(args.get('limit') || 10);
const START = Number(args.get('start') || 0);
const FORCE = args.has('force');

if (!API_KEY) {
  console.error('OPENROUTER_API_KEY is required. Set env or ~/.hermes/.env.');
  process.exit(1);
}

const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : fallback;
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

const repos = readJson('data/repos.ko.json', []);
const cache = readJson('data/translation-cache.json', {});
const overrides = readJson('data/overrides.ko.json', {});

const selected = repos
  .filter((r) => !overrides[r.id])
  .sort((a, b) => (b.stars || 0) - (a.stars || 0))
  .slice(START, START + LIMIT);

function cacheKey(repo) {
  return `${repo.id}:${repo.sourceHash}`;
}

function promptFor(repo) {
  return `너는 한국어 기술 큐레이터다. Hermes Agent 생태계 프로젝트를 한국어 사용자가 빠르게 이해하도록 요약한다.

반드시 JSON만 출력한다. 마크다운 금지. 코드블록 금지.

원칙:
- 자연스러운 한국어로 쓴다.
- repo 이름, 제품명, CLI 명령어, 고유명사는 원문 유지.
- 주어진 원문 설명 이상의 기능을 지어내지 않는다.
- star 수를 품질 보증처럼 말하지 않는다.
- 과장된 마케팅 문구 금지.
- "워크플로s", "에이전트s" 같은 혼합 suffix 금지.
- 불확실하면 "원문 설명 기준"이라고 제한한다.

입력:
repo id: ${repo.id}
category: ${repo.categoryKo} (${repo.category})
official: ${repo.official}
stars: ${repo.stars}
source description: ${repo.sourceDescription}

출력 JSON schema:
{
  "oneLineKo": "한 문장, 40~90자",
  "summaryKo": "2~4문장. 한국어 사용자가 이 프로젝트를 왜 볼지 설명",
  "useCasesKo": ["짧은 용도", "짧은 용도"],
  "audienceKo": ["대상 사용자", "대상 사용자"],
  "tagsKo": ["태그", "태그"],
  "riskNoteKo": "선택. 과장 방지 또는 확인 필요 사항"
}`;
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validateResult(repo, result) {
  for (const key of ['oneLineKo', 'summaryKo', 'useCasesKo', 'audienceKo', 'tagsKo']) {
    if (result[key] === undefined) throw new Error(`${repo.id}: missing ${key}`);
  }
  for (const key of ['useCasesKo', 'audienceKo', 'tagsKo']) {
    if (!Array.isArray(result[key])) throw new Error(`${repo.id}: ${key} must be array`);
  }
  const text = [result.oneLineKo, result.summaryKo, ...result.useCasesKo, ...result.audienceKo, ...result.tagsKo].join('\n');
  for (const bad of ['워크플로s', '에이전트s', '도구s', '플러그인s', 'undefined', '[object Object]']) {
    if (text.includes(bad)) throw new Error(`${repo.id}: bad artifact ${bad}`);
  }
}

async function generate(repo) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/unclejobs-ai/hermes-atlas-kr',
      'X-Title': 'Hermes Atlas KR Summary Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: promptFor(repo) }],
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const result = parseJson(data.choices?.[0]?.message?.content || '');
  validateResult(repo, result);
  return { model: data.model || MODEL, generatedAt: new Date().toISOString(), result };
}

let changed = 0;
for (const repo of selected) {
  const key = cacheKey(repo);
  if (!FORCE && cache[key]) {
    console.log(`cache hit ${repo.id}`);
    continue;
  }
  console.log(`generating ${repo.id}`);
  cache[key] = await generate(repo);
  changed++;
  writeJson('data/translation-cache.json', cache);
}

console.log(`Done. generated=${changed}, selected=${selected.length}`);
