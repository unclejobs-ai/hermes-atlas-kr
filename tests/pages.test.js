import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('build-pages generates Korean project detail pages with canonical source links', () => {
  execFileSync('node', ['scripts/build-pages.js'], { cwd: root, stdio: 'pipe' });
  const html = read('projects/NousResearch/hermes-agent/index.html');
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /Hermes Agent의 공식 본체/);
  assert.match(html, /https:\/\/github.com\/NousResearch\/hermes-agent/);
  assert.match(html, /Ask Atlas/);
});

test('home links to generated list pages and project detail pages', () => {
  const index = read('index.html');
  const app = read('assets/app.js');
  assert.match(index, /href="\/lists\/best-memory-providers"/);
  assert.match(index, /추천 리스트/);
  assert.match(app, /projectPath\(/);
  assert.match(app, /상세 페이지/);
});

test('build-pages generates Korean list pages, sitemap and robots', () => {
  execFileSync('node', ['scripts/build-pages.js'], { cwd: root, stdio: 'pipe' });
  const list = read('lists/best-memory-providers/index.html');
  assert.match(list, /메모리/);
  assert.match(list, /mem0ai\/mem0/);
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /https:\/\/hermes-atlas-kr\.vercel\.app\/projects\/NousResearch\/hermes-agent/);
  assert.match(sitemap, /https:\/\/hermes-atlas-kr\.vercel\.app\/lists\/best-memory-providers/);
  const robots = read('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/hermes-atlas-kr\.vercel\.app\/sitemap.xml/);
});
