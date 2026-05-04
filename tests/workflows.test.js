import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('nightly sync workflow refreshes upstream data and opens review PR', () => {
  const yml = read('.github/workflows/nightly-sync.yml');
  assert.match(yml, /cron: '0 18 \* \* \*'/);
  assert.match(yml, /npm run sync/);
  assert.match(yml, /npm run localize/);
  assert.match(yml, /npm run rag/);
  assert.match(yml, /npm run pages/);
  assert.match(yml, /npm run report/);
  assert.match(yml, /npm run check/);
  assert.match(yml, /peter-evans\/create-pull-request@v7/);
  assert.match(yml, /data\/repos.raw.json/);
});

test('README documents production URL and operating pipeline', () => {
  const readme = read('README.md');
  assert.match(readme, /https:\/\/hermes-atlas-kr\.vercel\.app/);
  assert.match(readme, /한국어 질문 기능/);
  assert.match(readme, /npm run sync/);
  assert.match(readme, /npm run build/);
});
