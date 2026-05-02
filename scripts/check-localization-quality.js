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
