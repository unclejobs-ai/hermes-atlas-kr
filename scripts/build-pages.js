#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SITE = process.env.SITE_URL || 'https://hermes-atlas-kr.vercel.app';
const root = process.cwd();
const lockDir = path.join(root, '.build-pages.lock');
const lockOwnerFile = path.join(lockDir, 'owner');
const lockOwner = `${process.pid}:${Date.now()}`;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readLockOwner() {
  try {
    return fs.readFileSync(lockOwnerFile, 'utf8').trim();
  } catch {
    return '';
  }
}

function ownerIsAlive(owner) {
  const pid = Number(String(owner).split(':')[0]);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function releaseBuildLock() {
  if (readLockOwner() === lockOwner) fs.rmSync(lockDir, { recursive: true, force: true });
}

function acquireBuildLock() {
  const started = Date.now();
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(lockOwnerFile, lockOwner);
      process.once('exit', releaseBuildLock);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = readLockOwner();
      if (owner && !ownerIsAlive(owner)) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - started > 30000) throw new Error(`Timed out waiting for build-pages lock held by ${owner || 'unknown owner'}`);
      sleep(50);
    }
  }
}

function readJson(rel, fallback) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function rmDir(rel) {
  const dir = path.join(root, rel);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}
function abs(urlPath) {
  return `${SITE}${urlPath}`;
}
function projectPath(repo) {
  return `/projects/${repo.owner}/${repo.repo}`;
}
function repoTitle(repo) {
  return `${repo.owner}/${repo.repo}`;
}
function pageShell({ title, description, canonical, body }) {
  const fullTitle = `${title} — Hermes Atlas 한국어판`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(fullTitle)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(fullTitle)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(abs('/assets/og/atlas-card.svg'))}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/"><span class="brand-mark">H</span><span><b>Hermes Atlas</b><em>한국어판</em></span></a>
    <nav aria-label="주요 메뉴"><a href="/#catalog">지도</a><a href="/#ask">질문하기</a><a href="/#about">소개</a><a href="https://github.com/ksimback/hermes-ecosystem" target="_blank" rel="noreferrer">원본</a></nav>
  </header>
  <main class="pageMain">${body}</main>
  <footer><span>Hermes Atlas 한국어판</span><span><a href="/sitemap.xml">사이트맵</a></span></footer>
</body>
</html>
`;
}
function listItems(repos) {
  return repos.map(repo => `<article class="pageCard"><a href="${esc(projectPath(repo))}"><h3>${esc(repoTitle(repo))}</h3></a><p>${esc(repo.oneLineKo || repo.summaryKo || repo.descriptionKo || repo.description || '')}</p><div class="detailMeta"><span class="pill">${esc(repo.categoryKo || repo.category)}</span><span class="pill">★ ${esc(repo.stars || 0)}</span></div></article>`).join('\n');
}

const repos = readJson('data/repos.ko.json', []);
const lists = readJson('data/lists.raw.json', []);
const manifest = readJson('data/source-manifest.json', {});
if (!repos.length) throw new Error('data/repos.ko.json is empty');

acquireBuildLock();
rmDir('projects');
rmDir('lists');
const urls = ['/'];

for (const repo of repos) {
  const urlPath = projectPath(repo);
  urls.push(urlPath);
  const description = repo.summaryKo || repo.oneLineKo || repo.descriptionKo || repo.description || `${repoTitle(repo)} 한국어 설명`;
  const oneLine = repo.oneLineKo || repo.descriptionKo || '';
  const body = `<section class="pageHero">
    <p class="eyebrow">프로젝트 상세</p>
    <h1>${esc(repoTitle(repo))}</h1>
    <p class="lede">${esc(description)}</p>
    <div class="detailMeta"><span class="pill">${esc(repo.categoryKo || repo.category)}</span><span class="pill">★ ${esc(repo.stars || 0)}</span>${repo.official ? '<span class="pill">공식</span>' : ''}</div>
    <div class="hero-actions"><a class="primary" href="${esc(repo.url)}" target="_blank" rel="noreferrer">원문 저장소 보기</a><a class="secondary" href="/#ask">아틀라스에게 물어보기</a></div>
  </section>
  <section class="pageSection"><h2>한 줄 요약</h2><p>${esc(oneLine || description)}</p></section>
  <section class="pageSection"><h2>어디에 쓰나</h2>${Array.isArray(repo.useCasesKo) && repo.useCasesKo.length ? `<ul>${repo.useCasesKo.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>상세 사용처는 원문 문서와 한국어 요약을 함께 확인하세요.</p>'}</section>
  <section class="pageSection"><h2>맞는 사람</h2><p>${esc(Array.isArray(repo.audienceKo) && repo.audienceKo.length ? repo.audienceKo.join(' · ') : 'Hermes 생태계 탐색자')}</p></section>
  <section class="pageSection"><h2>출처</h2><p>원문 설명과 구현 세부사항은 원문 저장소에서 확인할 수 있습니다.</p><p><a href="${esc(repo.url)}" target="_blank" rel="noreferrer">${esc(repoTitle(repo))} 원문 저장소</a></p></section>`;
  write(`projects/${repo.owner}/${repo.repo}/index.html`, pageShell({ title: repoTitle(repo), description, canonical: abs(urlPath), body }));
}

const categoryKo = new Map(repos.map(r => [r.category, r.categoryKo || r.category]));
const listTitleKo = {
  'best-memory-providers': 'Hermes Agent 메모리 제공자 추천',
  'top-skills': 'Hermes Agent 인기 스킬',
  'deployment-options': 'Hermes Agent 배포 옵션',
  'multi-agent-frameworks': 'Hermes 멀티 에이전트 프레임워크',
  'developer-tools': 'Hermes 개발자 도구',
  'workspaces-and-guis': 'Hermes 워크스페이스와 화면형 도구'
};
for (const list of lists) {
  const urlPath = `/lists/${list.slug}`;
  urls.push(urlPath);
  const filtered = repos
    .filter(repo => !list.filter?.category || repo.category === list.filter.category)
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));
  const title = listTitleKo[list.slug] || list.title;
  const category = list.filter?.category ? categoryKo.get(list.filter.category) : '';
  const description = `${title}: ${category ? `${category} 분류의 ` : ''}Hermes 생태계 프로젝트를 한국어 요약과 함께 정리했습니다.`;
  const body = `<section class="pageHero"><p class="eyebrow">추천 묶음</p><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p></section><section class="pageGrid">${listItems(filtered)}</section>`;
  write(`lists/${list.slug}/index.html`, pageShell({ title, description, canonical: abs(urlPath), body }));
}

const lastmod = manifest.syncedAt || '2026-05-02T00:00:00.000Z';
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(abs(u))}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Allow: /
Sitemap: ${SITE}/sitemap.xml
`);
releaseBuildLock();
console.log(`Generated ${repos.length} project pages, ${lists.length} list pages, sitemap.xml, robots.txt`);
