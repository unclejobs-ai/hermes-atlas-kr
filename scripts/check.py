#!/usr/bin/env python3
from pathlib import Path
import json, sys
root=Path(__file__).resolve().parents[1]
required=['index.html','assets/app.js','assets/styles.css','data/repos.json']
missing=[p for p in required if not (root/p).exists()]
if missing:
    print('FAIL missing', missing); sys.exit(1)
html=(root/'index.html').read_text(encoding='utf-8')
for token in ['lang="ko"','Hermes Atlas 한국어판','검색','카테고리','프로젝트']:
    assert token in html, token
repos=json.loads((root/'data/repos.json').read_text(encoding='utf-8'))
assert len(repos) >= 80, len(repos)
print(f'OK: {len(repos)} repos, Korean-first static app files present')
