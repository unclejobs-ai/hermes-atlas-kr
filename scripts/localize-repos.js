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
const translationCache = readJson('data/translation-cache.json', {});
const previous = readJson('data/repos.ko.json', []);
const previousById = new Map(previous.map((repo) => [repo.id, repo]));

const categoryUseCases = {
  '코어·공식': ['Hermes Agent 기본 설치와 운영', '공식 기능 확인', '생태계 기준점 파악'],
  '워크스페이스·GUI': ['시각적인 작업 공간 구성', '에이전트 작업 흐름 모니터링', '비개발자 친화 UI 제공'],
  '스킬·레지스트리': ['반복 작업을 재사용 가능한 스킬로 정리', '도메인별 스킬 탐색', '팀 단위 작업 표준화'],
  '메모리·컨텍스트': ['장기 기억 저장', '세션 간 맥락 유지', '개인화된 에이전트 경험 구성'],
  '플러그인·확장': ['Hermes 기능 확장', '외부 도구 연결', '특정 작업 흐름 자동화'],
  '멀티 에이전트·오케스트레이션': ['여러 에이전트 역할 분담', '복잡한 작업 분해', '검토와 실행 병렬화'],
  '배포·인프라': ['서버 배포', '운영 자동화', '프로덕션 환경 구성'],
  '통합·브리지': ['메신저·외부 앱 연동', '기존 워크플로와 Hermes 연결', 'API 기반 자동화'],
  '개발자 도구': ['개발 생산성 향상', 'CLI·코드 작업 보조', '로컬 개발 환경 개선'],
  '도메인 앱': ['특정 업무 분야에 Hermes 적용', '실사용 예제 확인', '업무 자동화 시나리오 검토'],
  '가이드·문서': ['학습 자료 확인', '도입 전 구조 이해', '팀 온보딩'],
  '포크·파생': ['대안 구현 비교', '실험적 기능 확인', '원본과 다른 방향성 탐색'],
};

const categoryAudience = {
  '코어·공식': ['Hermes 신규 사용자', '에이전트 빌더', '자동화 파워유저'],
  '워크스페이스·GUI': ['제품 기획자', '비개발자 운영자', '에이전트 작업을 눈으로 보고 싶은 사용자'],
  '스킬·레지스트리': ['스킬 제작자', '팀 리드', '반복 업무가 많은 사용자'],
  '메모리·컨텍스트': ['개인 AI 비서 사용자', '장기 프로젝트 운영자', '맥락 유지가 중요한 팀'],
  '플러그인·확장': ['플러그인 개발자', '자동화 엔지니어', '고급 사용자'],
  '멀티 에이전트·오케스트레이션': ['개발 리드', 'AI 워크플로 설계자', '복잡한 작업을 병렬화하려는 팀'],
  '배포·인프라': ['DevOps 담당자', '서비스 운영자', '셀프호스팅 사용자'],
  '통합·브리지': ['메신저 자동화 사용자', 'API 통합 개발자', '운영 자동화 팀'],
  '개발자 도구': ['개발자', 'CLI 사용자', '로컬 자동화 사용자'],
  '도메인 앱': ['업무 자동화 실험자', '도메인 전문가', '프로토타입 제작자'],
  '가이드·문서': ['입문자', '교육자', '도입 검토자'],
  '포크·파생': ['오픈소스 탐색자', '대안 구현 검토자', '실험 기능 사용자'],
};

const tokenHints = [
  [/telegram|텔레그램/i, ['텔레그램 연동', '메신저 기반 실행']],
  [/memory|context|remember|컨텍스트/i, ['메모리', '컨텍스트 유지']],
  [/skill|agentskills/i, ['스킬', '재사용 가능한 작업 절차']],
  [/mcp/i, ['MCP', '외부 도구 연결']],
  [/docker|deploy|server|infra/i, ['배포', '인프라']],
  [/security|cyber/i, ['보안', '사이버보안']],
  [/voice|audio|speech/i, ['음성', '오디오']],
  [/gui|webui|workspace|dashboard/i, ['GUI', '워크스페이스']],
  [/multi-agent|orchestrat|team/i, ['멀티 에이전트', '오케스트레이션']],
  [/notion|discord|slack|github|api/i, ['외부 서비스 연동', 'API 자동화']],
];

function pickHints(repo) {
  const haystack = `${repo.name || ''} ${repo.repo || ''} ${repo.description || ''}`;
  return tokenHints.flatMap(([regex, hints]) => regex.test(haystack) ? hints : []).slice(0, 5);
}

function cleanDescription(description = '') {
  return String(description)
    .replace(/\s*[—-]\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

const fallbackSentence = (repo, categoryKo) => {
  const id = `${repo.owner}/${repo.repo}`;
  const official = repo.official ? '공식 ' : '';
  const source = cleanDescription(repo.description);
  if (!source) return `${id}는 Hermes 생태계의 ${categoryKo} 영역에서 참고할 수 있는 ${official}프로젝트입니다.`;
  return `${id}는 ${source} 성격의 ${official}프로젝트입니다.`;
};

function generatedLocalization(repo, categoryKo) {
  const id = `${repo.owner}/${repo.repo}`;
  const source = cleanDescription(repo.description);
  const hints = pickHints(repo);
  const uses = [...new Set([...(categoryUseCases[categoryKo] || ['Hermes 생태계 탐색', '도구 비교']), ...hints])].slice(0, 4);
  const audience = categoryAudience[categoryKo] || ['Hermes 사용자', 'AI 자동화 실험자'];
  const tags = [...new Set([categoryKo, ...hints, repo.repo.replace(/[-_]/g, ' ')])].slice(0, 6);
  const oneLineKo = source
    ? `${id}: ${source}을 한국어 Atlas 기준으로 분류한 프로젝트입니다.`
    : fallbackSentence(repo, categoryKo);
  const summaryKo = [
    `${id}는 ${categoryKo} 범주에서 볼 만한 프로젝트입니다.`,
    source ? `원문 설명 기준으로는 “${source}”에 초점이 있습니다.` : '원문 설명이 짧아 GitHub README와 함께 확인하는 편이 좋습니다.',
    `한국어 사용자는 ${uses.slice(0, 2).join('이나 ')}이 필요할 때 우선 살펴보면 됩니다.`,
    `repo 이름과 명령어, 원본 링크는 검색성과 재현성을 위해 그대로 유지했습니다.`,
  ].join(' ');
  return { oneLineKo, summaryKo, useCasesKo: uses, audienceKo: audience, tagsKo: tags };
}

const localized = rawRepos.map((repo) => {
  const id = `${repo.owner}/${repo.repo}`;
  const sourceHash = hashRepo(repo);
  const category = categoryMap[repo.category] || { ko: repo.category, descKo: '' };
  const old = previousById.get(id) || {};
  const cached = translationCache[`${id}:${sourceHash}`]?.result || null;
  const isStale = old.sourceHash && old.sourceHash !== sourceHash && old.localizationStatus === 'human_reviewed';
  const generatedAt = translationCache[`${id}:${sourceHash}`]?.generatedAt;
  const generated = generatedLocalization(repo, category.ko);
  const keepOld = old.localizationStatus === 'human_reviewed' || old.localizationStatus === 'editorial_reviewed';
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
    oneLineKo: cached?.oneLineKo || (keepOld && old.oneLineKo) || generated.oneLineKo,
    summaryKo: cached?.summaryKo || (keepOld && old.summaryKo) || generated.summaryKo,
    useCasesKo: cached?.useCasesKo || (keepOld && old.useCasesKo?.length ? old.useCasesKo : generated.useCasesKo),
    audienceKo: cached?.audienceKo || (keepOld && old.audienceKo?.length ? old.audienceKo : generated.audienceKo),
    tagsKo: cached?.tagsKo || (keepOld && old.tagsKo?.length ? old.tagsKo : generated.tagsKo),
    riskNoteKo: cached?.riskNoteKo || old.riskNoteKo || '',
    sourceDescription: repo.description || '',
    sourceHash,
    localizedAt: generatedAt || old.localizedAt || new Date().toISOString(),
    localizationStatus: isStale ? 'stale' : (cached ? 'machine_review_needed' : (keepOld ? old.localizationStatus : 'editorial_seeded')),
  };
  return { ...base, ...(overrides[id] || {}), id, sourceHash, sourceDescription: repo.description || '' };
});

writeJson('data/repos.ko.json', localized);
// Compatibility alias for the current static app and simple hosting.
writeJson('data/repos.json', localized);
console.log(`Localized ${localized.length} repos → data/repos.ko.json`);
