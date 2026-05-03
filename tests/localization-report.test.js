import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('localization report summarizes review status and priority backlog', () => {
  execFileSync('node', ['scripts/build-localization-report.js'], { cwd: root, stdio: 'pipe' });
  const json = JSON.parse(read('data/localization-report.json'));
  assert.equal(json.total, 111);
  assert.ok(json.statusCounts.human_reviewed >= 15);
  assert.ok(json.statusCounts.editorial_seeded > 0);
  assert.equal(json.summaryCovered, json.total);
  assert.equal(json.summaryCoverageRatio, 1);
  assert.ok(Array.isArray(json.priorityBacklog));
  assert.ok(json.priorityBacklog.length > 0);
  assert.ok(json.priorityBacklog[0].id);

  const md = read('docs/localization-report.md');
  assert.match(md, /# Hermes Atlas KR 한국어화 현황/);
  assert.match(md, /사람 검수 완료/);
  assert.match(md, /우선 검수 후보/);
});

test('home page exposes localization status metric', () => {
  const html = read('index.html');
  const app = read('assets/app.js');
  assert.match(html, /id="reviewedRepos"/);
  assert.match(app, /reviewedRepos/);
  assert.match(html, /id="summaryCoverage"/);
  assert.match(app, /summaryCoverage/);
});
