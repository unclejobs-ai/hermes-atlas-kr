#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';

const readJson = (path, fallback = null) => {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
};

const writeJson = (path, data) => {
  fs.mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
};

const hashRepo = (repo) => crypto
  .createHash('sha256')
  .update(JSON.stringify({
    owner: repo.owner,
    repo: repo.repo,
    name: repo.name,
    description: repo.description,
    category: repo.category,
    official: repo.official,
    url: repo.url,
  }, Object.keys({ owner: 1, repo: 1, name: 1, description: 1, category: 1, official: 1, url: 1 }).sort()))
  .digest('hex');

const categoryMap = readJson('data/category-map.ko.json', {});
const rawRepos = readJson('data/repos.raw.json', []);
const overrides = readJson('data/overrides.ko.json', {});
const previous = readJson('data/repos.ko.json', []);
const previousById = new Map(previous.map((repo) => [repo.id, repo]));

const fallbackSentence = (repo, categoryKo) => {
  const id = `${repo.owner}/${repo.repo}`;
  const official = repo.official ? ' 공식' : '';
  return `${id}는 Hermes 생태계의 ${categoryKo} 영역에 속한${official} 프로젝트입니다.`;
};

const localized = rawRepos.map((repo) => {
  const id = `${repo.owner}/${repo.repo}`;
  const sourceHash = hashRepo(repo);
  const category = categoryMap[repo.category] || { ko: repo.category, descKo: '' };
  const old = previousById.get(id) || {};
  const isStale = old.sourceHash && old.sourceHash !== sourceHash && old.localizationStatus === 'human_reviewed';
  const base = {
    id,
    owner: repo.owner,
    repo: repo.repo,
    name: repo.name || repo.repo,
    url: repo.url,
    official: Boolean(repo.official),
    stars: Number(repo.stars || 0),
    category: repo.category,
    categoryKo: category.ko,
    categoryDescriptionKo: category.descKo,
    oneLineKo: old.oneLineKo || fallbackSentence(repo, category.ko),
    summaryKo: old.summaryKo || `${fallbackSentence(repo, category.ko)} 상세 설명은 원문 설명과 GitHub 링크를 함께 확인하세요.`,
    useCasesKo: old.useCasesKo || [],
    audienceKo: old.audienceKo || [],
    tagsKo: old.tagsKo || [category.ko],
    sourceDescription: repo.description || '',
    sourceHash,
    localizedAt: old.localizedAt || new Date().toISOString(),
    localizationStatus: isStale ? 'stale' : (old.localizationStatus || 'machine_review_needed'),
  };
  return { ...base, ...(overrides[id] || {}), id, sourceHash, sourceDescription: repo.description || '' };
});

writeJson('data/repos.ko.json', localized);
// Compatibility alias for the current static app and simple hosting.
writeJson('data/repos.json', localized);
console.log(`Localized ${localized.length} repos → data/repos.ko.json`);
