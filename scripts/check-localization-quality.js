#!/usr/bin/env node
import fs from 'fs';

const repos = JSON.parse(fs.readFileSync('data/repos.ko.json', 'utf-8'));
const errors = [];
const warnings = [];
const banned = [
  'undefined',
  'null',
  '[object Object]',
  '워크플로s',
  '에이전트s',
  '도구s',
  '플러그인s',
  '설정ing',
  '한국어 Atlas 기준',
  '범주에서 볼 만한',
  '원문 설명 기준',
  'repo 이름',
  '정리이나',
  '성격의 프로젝트',
  '을 한국어',
  '확인가',
  '관리이',
  '탐색가',
  'GUI과',
  '배포과',
  '메모리과',
  '텔레그램과',
  'MCP과',
  '도구과',
  'provider',
  'wrapper',
  'stateful agent',
  'Web UI',
  'awesome list',
  'curated',
  'function calling',
  'tool-calling',
  '일반-purpose',
  'dispatch',
  'workflow',
  'spend',
  'retain',
  'recall',
  'reflect',
  'literate programming',
  '상태ful',
];

for (const repo of repos) {
  const id = repo.id || `${repo.owner}/${repo.repo}`;
  for (const key of ['id', 'owner', 'repo', 'url', 'category', 'categoryKo', 'oneLineKo', 'summaryKo', 'sourceDescription', 'sourceHash', 'localizationStatus']) {
    if (repo[key] === undefined || repo[key] === '') errors.push(`${id}: missing ${key}`);
  }
  const text = [repo.oneLineKo, repo.summaryKo, ...(repo.tagsKo || []), ...(repo.useCasesKo || [])].join('\n');
  for (const pattern of banned) {
    if (text.includes(pattern)) errors.push(`${id}: banned localization artifact ${pattern}`);
  }
  if ((repo.summaryKo || '').length < 40) warnings.push(`${id}: summaryKo is short`);
  if (!Array.isArray(repo.tagsKo) || repo.tagsKo.length === 0) warnings.push(`${id}: tagsKo empty`);
}

if (warnings.length) {
  console.warn(`WARN: ${warnings.length} localization warnings`);
  for (const w of warnings.slice(0, 20)) console.warn('WARN:', w);
}
if (errors.length) {
  for (const e of errors) console.error('FAIL:', e);
  process.exit(1);
}
console.log(`OK: localization quality check passed for ${repos.length} repos`);
