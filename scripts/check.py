#!/usr/bin/env python3
from pathlib import Path
import json, sys

root = Path(__file__).resolve().parents[1]
required = [
    'index.html',
    'assets/app.js',
    'assets/styles.css',
    'data/repos.raw.json',
    'data/repos.ko.json',
    'data/category-map.ko.json',
    'data/overrides.ko.json',
    'data/chunks.ko.json',
    'data/docs.raw.json',
    'assets/og/atlas-card.svg',
    'docs/custom-domain.md',
    'lib/retrieval.js',
    'api/chat.js',
    'scripts/build-pages.js',
    'sitemap.xml',
    'robots.txt',
    'data/localization-report.json',
    'docs/localization-report.md',
]
missing = [p for p in required if not (root / p).exists()]
if missing:
    print('FAIL missing', missing)
    sys.exit(1)

html = (root / 'index.html').read_text(encoding='utf-8')
for token in ['lang="ko"', 'Hermes Atlas 한국어판', '검색', '카테고리', '프로젝트', 'Ask Atlas', 'og:image', 'summaryCoverage']:
    assert token in html, token

repos = json.loads((root / 'data/repos.ko.json').read_text(encoding='utf-8'))
raw = json.loads((root / 'data/repos.raw.json').read_text(encoding='utf-8'))
assert len(repos) >= 80, len(repos)
assert len(raw) >= 80, len(raw)
assert len(repos) == len(raw), (len(repos), len(raw))
summary_covered = sum(1 for repo in repos if len(repo.get('summaryKo') or '') >= 45 and len(repo.get('useCasesKo') or []) >= 2)
assert summary_covered == len(repos), (summary_covered, len(repos))
docs = json.loads((root / 'data/docs.raw.json').read_text(encoding='utf-8'))
assert len(docs.get('documents', [])) >= 30, len(docs.get('documents', []))
chunks = json.loads((root / 'data/chunks.ko.json').read_text(encoding='utf-8')).get('chunks', [])
assert any(c.get('sourceType') == 'upstream-doc' for c in chunks), 'upstream-doc chunks missing'
required_repo_keys = {'id', 'owner', 'repo', 'url', 'category', 'categoryKo', 'oneLineKo', 'summaryKo', 'sourceDescription', 'sourceHash', 'localizationStatus'}
for repo in repos:
    missing_keys = required_repo_keys - set(repo)
    if missing_keys:
        print('FAIL repo missing keys', repo.get('id'), sorted(missing_keys))
        sys.exit(1)
print(f'OK: {len(repos)} repos, Korean-first data model present')
