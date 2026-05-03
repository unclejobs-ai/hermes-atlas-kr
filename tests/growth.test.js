import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('all repos have Korean summary coverage without OpenRouter dependency', () => {
  execFileSync('npm', ['run', 'localize'], { stdio: 'pipe' });
  const repos = readJson('data/repos.ko.json');
  assert.equal(repos.length, 111);
  assert.equal(repos.filter((repo) => (repo.summaryKo || '').length >= 45).length, repos.length);
  assert.equal(repos.filter((repo) => Array.isArray(repo.useCasesKo) && repo.useCasesKo.length >= 2).length, repos.length);
});

test('RAG index includes upstream README and research document chunks', () => {
  execFileSync('npm', ['run', 'rag'], { stdio: 'pipe' });
  const docs = readJson('data/docs.raw.json');
  const index = readJson('data/chunks.ko.json');
  assert.ok(docs.documents.length >= 30);
  assert.ok(index.chunks.length > 160);
  assert.ok(index.chunks.some((chunk) => chunk.sourceType === 'upstream-doc' && /README|ECOSYSTEM|research/.test(chunk.source)));
  assert.ok(index.chunks.some((chunk) => /Telegram|텔레그램|memory|메모리/i.test(chunk.text)));
});

test('home and generated pages expose OG image metadata', () => {
  execFileSync('npm', ['run', 'pages'], { stdio: 'pipe' });
  assert.ok(fs.existsSync('assets/og/atlas-card.svg'));
  assert.match(read('index.html'), /property="og:image"/);
  assert.match(read('projects/NousResearch/hermes-agent/index.html'), /property="og:image"/);
  assert.match(read('projects/NousResearch/hermes-agent/index.html'), /assets\/og\/atlas-card.svg/);
});

test('custom domain handoff is documented without hard-coding an unknown domain', () => {
  const doc = read('docs/custom-domain.md');
  assert.match(doc, /vercel domains add/);
  assert.match(doc, /HEREMES_ATLAS_KR_DOMAIN|CUSTOM_DOMAIN|도메인/);
  assert.doesNotMatch(doc, /OPENROUTER_API_KEY=.*sk-/);
});
