#!/usr/bin/env node
import fs from 'fs';

const repos = JSON.parse(fs.readFileSync('data/repos.ko.json', 'utf8'));
const manifest = fs.existsSync('data/source-manifest.json')
  ? JSON.parse(fs.readFileSync('data/source-manifest.json', 'utf8'))
  : {};

const statusCounts = repos.reduce((acc, repo) => {
  const status = repo.localizationStatus || 'unknown';
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

const priorityBacklog = repos
  .filter(repo => repo.localizationStatus !== 'human_reviewed')
  .sort((a, b) => (b.stars || 0) - (a.stars || 0))
  .slice(0, 30)
  .map(repo => ({
    id: repo.id,
    categoryKo: repo.categoryKo,
    stars: repo.stars || 0,
    url: repo.url,
    reason: '스타 수가 높고 아직 사람 검수 한국어 요약이 없습니다.'
  }));

const report = {
  generatedAt: manifest.syncedAt || '2026-05-02T00:00:00.000Z',
  upstreamSyncedAt: manifest.syncedAt || null,
  total: repos.length,
  statusCounts,
  reviewedRatio: Number(((statusCounts.human_reviewed || 0) / Math.max(1, repos.length)).toFixed(4)),
  priorityBacklog,
};

fs.writeFileSync('data/localization-report.json', JSON.stringify(report, null, 2) + '\n');

const reviewed = statusCounts.human_reviewed || 0;
const needReview = repos.length - reviewed;
const md = `# Hermes Atlas KR 한국어화 현황

- 기준 시각: ${report.generatedAt}
- 전체 프로젝트: ${repos.length}
- 사람 검수 완료: ${reviewed}
- 추가 검수 필요: ${needReview}
- 검수율: ${(report.reviewedRatio * 100).toFixed(1)}%

## 상태별 개수

${Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

## 우선 검수 후보

| 우선순위 | 프로젝트 | 카테고리 | Stars | 링크 |
|---:|---|---|---:|---|
${priorityBacklog.slice(0, 20).map((repo, index) => `| ${index + 1} | ${repo.id} | ${repo.categoryKo || ''} | ${repo.stars} | ${repo.url} |`).join('\n')}

## 운영 메모

- 자연스러운 한국어 요약은 \`data/overrides.ko.json\`에 추가합니다.
- \`npm run localize && npm run rag && npm run pages && npm run check\`로 재생성/검증합니다.
- nightly sync PR에서는 이 리포트와 generated page diff를 함께 확인합니다.
`;
fs.writeFileSync('docs/localization-report.md', md);
console.log(`Localization report: ${reviewed}/${repos.length} reviewed, ${priorityBacklog.length} backlog items`);
