import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

test('typography uses Korean-readable font stack, rhythm and measure controls', () => {
  const css = read('assets/styles.css');
  assert.match(css, /Pretendard/);
  assert.match(css, /Noto Sans KR/);
  assert.match(css, /font-kerning:\s*normal/);
  assert.match(css, /line-height:\s*1\.7/);
  assert.match(css, /text-wrap:\s*pretty/);
  assert.match(css, /max-width:\s*68ch/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('filter controls avoid horizontal page overflow and keep category chips scrollable', () => {
  const css = read('assets/styles.css');
  assert.match(css, /body\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.controls\{[^}]*grid-template-columns:\s*minmax/);
  assert.match(css, /\.controls\{[^}]*min-width:\s*0/);
  assert.match(css, /\.categoryStrip\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.chip\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /white-space:\s*nowrap/);
});

test('generated Korean summaries avoid translationese and mixed Korean-English boilerplate', () => {
  execFileSync('npm', ['run', 'localize'], { stdio: 'pipe' });
  const repos = readJson('data/repos.ko.json');
  const badPhrases = [
    '한국어 Atlas 기준',
    '범주에서 볼 만한',
    '원문 설명 기준',
    'repo 이름',
    '정리이나',
    '성격의 프로젝트',
    '을 한국어',
    'Self —',
    'Type —',
    'Cross —',
    '확인가',
    '관리이',
    '탐색가',
    'GUI과',
    '배포과',
    '메모리과',
    '텔레그램과',
    'MCP과',
    '도구과',
    '을 중심으로',
  ];
  const offenders = [];
  for (const repo of repos) {
    if (repo.localizationStatus === 'human_reviewed') continue;
    const text = [repo.oneLineKo, repo.summaryKo, ...(repo.useCasesKo || []), ...(repo.tagsKo || [])].join('\n');
    for (const phrase of badPhrases) {
      if (text.includes(phrase)) offenders.push(`${repo.id}: ${phrase}`);
    }
  }
  assert.deepEqual(offenders.slice(0, 10), []);
});

test('Korean UI copy speaks naturally and avoids implementation labels', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /완전 한글판 기준/);
  assert.doesNotMatch(html, /RAG MVP/);
  assert.doesNotMatch(html, />\s*Ask Atlas\s*</);
  assert.doesNotMatch(html, /영어 README/);
  assert.match(html, /한국어로 먼저 이해하고, 필요할 때 원문으로 넘어가세요/);
  assert.match(html, /요약 완성도/);
});

test('all Korean-facing localization fields avoid leftover English translationese', () => {
  execFileSync('npm', ['run', 'localize'], { stdio: 'pipe' });
  const repos = readJson('data/repos.ko.json');
  const badPhrases = [
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
    'Ask Atlas',
    'PROJECT DETAIL',
    'CURATED LIST',
  ];
  const offenders = [];
  for (const repo of repos) {
    const text = [repo.oneLineKo, repo.summaryKo, ...(repo.useCasesKo || []), ...(repo.audienceKo || []), ...(repo.tagsKo || [])].join('\n');
    for (const phrase of badPhrases) {
      if (text.includes(phrase)) offenders.push(`${repo.id}: ${phrase}`);
    }
  }
  assert.deepEqual(offenders.slice(0, 20), []);
});

test('generated public pages are Korean-first and keep raw English source behind links', () => {
  execFileSync('npm', ['run', 'pages'], { stdio: 'pipe' });
  const project = read('projects/NousResearch/hermes-agent/index.html');
  const list = read('lists/best-memory-providers/index.html');
  const raw = readJson('data/repos.ko.json').find(repo => repo.id === 'NousResearch/hermes-agent').sourceDescription;
  assert.doesNotMatch(project, /PROJECT DETAIL|CURATED LIST|>\s*sitemap\s*<|Ask Atlas/);
  assert.doesNotMatch(list, /PROJECT DETAIL|CURATED LIST|>\s*sitemap\s*<|Ask Atlas/);
  assert.doesNotMatch(project, /<h2>원본 설명<\/h2>/);
  assert.ok(!raw || !project.includes(raw));
  assert.match(project, /원문 저장소 보기/);
  assert.match(project, /아틀라스에게 물어보기/);
});
