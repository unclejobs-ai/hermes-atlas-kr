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
  '코어·공식': ['Hermes Agent의 기본 구조 파악', '공식 기능 확인', '생태계의 기준점 확인'],
  '워크스페이스·화면형 도구': ['작업 흐름을 화면에서 확인', '채팅·터미널·메모리 관리', '비개발자도 쓰기 쉬운 화면형 도구 검토'],
  '스킬·레지스트리': ['반복 작업을 스킬로 정리', '도메인별 스킬 탐색', '팀 작업 방식 표준화'],
  '메모리·컨텍스트': ['장기 기억 저장', '세션 사이의 맥락 유지', '개인화된 에이전트 구성'],
  '플러그인·확장': ['Hermes 기능 확장', '외부 도구 연결', '특정 작업 흐름 자동화'],
  '멀티 에이전트·오케스트레이션': ['여러 에이전트 역할 분담', '복잡한 작업 분해', '검토와 실행 병렬화'],
  '배포·인프라': ['서버 배포', '운영 자동화', '프로덕션 환경 구성'],
  '통합·브리지': ['메신저와 외부 앱 연동', '기존 업무 흐름에 Hermes 연결', '서비스 연동 자동화'],
  '개발자 도구': ['개발 생산성 향상', '명령줄·코드 작업 보조', '로컬 개발 환경 개선'],
  '도메인 앱': ['특정 업무 분야에 Hermes 적용', '실사용 예제 확인', '업무 자동화 시나리오 검토'],
  '가이드·문서': ['학습 자료 확인', '도입 전 구조 이해', '팀 온보딩'],
  '포크·파생': ['대안 구현 비교', '실험적 기능 확인', '원본과 다른 방향성 탐색'],
};

const categoryPurpose = {
  '코어·공식': 'Hermes Agent의 핵심 기능이나 공식 실험을 확인하는 프로젝트입니다.',
  '워크스페이스·화면형 도구': 'Hermes 작업을 웹이나 데스크톱 화면에서 다루기 위한 인터페이스 프로젝트입니다.',
  '스킬·레지스트리': '반복 작업을 스킬로 묶고 다시 쓰기 쉽게 정리하는 프로젝트입니다.',
  '메모리·컨텍스트': '에이전트가 이전 작업과 사용자 맥락을 이어갈 수 있게 돕는 메모리 프로젝트입니다.',
  '플러그인·확장': 'Hermes에 새로운 기능이나 외부 도구를 붙이는 확장 프로젝트입니다.',
  '멀티 에이전트·오케스트레이션': '여러 에이전트가 역할을 나눠 일하도록 돕는 오케스트레이션 프로젝트입니다.',
  '배포·인프라': 'Hermes를 로컬, 서버, 클라우드 환경에 안정적으로 올리기 위한 배포 프로젝트입니다.',
  '통합·브리지': 'Hermes를 메신저, 업무 도구, 외부 서비스와 연결하는 브리지 프로젝트입니다.',
  '개발자 도구': '개발자가 Hermes와 주변 AI 도구를 더 편하게 쓰도록 돕는 보조 도구입니다.',
  '도메인 앱': '특정 업무나 실험 분야에 Hermes를 적용한 예시 프로젝트입니다.',
  '가이드·문서': 'Hermes를 배우고 비교하고 도입할 때 참고할 수 있는 자료입니다.',
  '포크·파생': '원본 Hermes 흐름을 다른 방식으로 실험한 파생 프로젝트입니다.',
};

const categoryAudience = {
  '코어·공식': ['Hermes 신규 사용자', '에이전트 빌더', '자동화 파워유저'],
  '워크스페이스·화면형 도구': ['제품 기획자', '비개발자 운영자', '에이전트 작업을 눈으로 보고 싶은 사용자'],
  '스킬·레지스트리': ['스킬 제작자', '팀 리드', '반복 업무가 많은 사용자'],
  '메모리·컨텍스트': ['개인 AI 비서 사용자', '장기 프로젝트 운영자', '맥락 유지가 중요한 팀'],
  '플러그인·확장': ['플러그인 개발자', '자동화 엔지니어', '고급 사용자'],
  '멀티 에이전트·오케스트레이션': ['개발 리드', 'AI 작업 흐름 설계자', '복잡한 작업을 병렬화하려는 팀'],
  '배포·인프라': ['운영 자동화 담당자', '서비스 운영자', '셀프호스팅 사용자'],
  '통합·브리지': ['메신저 자동화 사용자', '서비스 연동 개발자', '운영 자동화 팀'],
  '개발자 도구': ['개발자', '명령줄 사용자', '로컬 자동화 사용자'],
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
  [/gui|webui|workspace|dashboard/i, ['화면형 인터페이스', '워크스페이스']],
  [/multi-agent|orchestrat|team/i, ['멀티 에이전트', '오케스트레이션']],
  [/notion|discord|slack|github|api/i, ['외부 서비스 연동', '서비스 연동 자동화']],
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

function sourcePurposeKo(repo, categoryKo) {
  const id = `${repo.owner}/${repo.repo}`;
  const source = cleanDescription(repo.description);
  const lower = source.toLowerCase();
  const rules = [
    [/evolutionary self|self.*improvement/, 'DSPy와 GEPA로 스킬, 프롬프트, 코드를 반복 개선하는 자기개선 실험입니다.'],
    [/paperclip/, 'Paperclip 회사 시스템 안에서 Hermes를 관리형 동료처럼 실행하는 어댑터입니다.'],
    [/autonomous novel|100k\+ word|manuscripts/, '긴 소설 원고를 자동으로 기획하고 작성하는 창작 파이프라인입니다.'],
    [/native web workspace|chat, terminal, memory browser/, '채팅, 터미널, 메모리 브라우저, 스킬 관리를 한 화면에 묶은 웹 작업 공간입니다.'],
    [/desktop companion/, 'Hermes 설치, 설정, 채팅을 데스크톱 앱에서 처리하게 해주는 보조 앱입니다.'],
    [/process monitoring|configuration dashboard/, 'Hermes 프로세스 상태와 설정을 확인하는 대시보드입니다.'],
    [/self.*hosted ai workspace|runtime controls/, '채팅, 스킬, 확장, 메모리, 런타임 제어를 제공하는 셀프호스팅 AI 작업 공간입니다.'],
    [/audits and rewrites|ai writing patterns/, 'AI 문체가 드러나는 표현을 찾아 더 자연스럽게 고쳐 쓰는 스킬입니다.'],
    [/cross.*platform skills library/, 'Claude Code와 agentskills.io 호환 에이전트에서 함께 쓰는 스킬 모음입니다.'],
    [/type.*safe.*pydantic/, 'Pydantic AI에서 agentskills.io 스킬을 타입 안전하게 쓰도록 돕는 프로젝트입니다.'],
    [/oracle network|smart contract/, '오라클 네트워크와 스마트컨트랙트 상호작용을 다루는 스킬 모음입니다.'],
    [/literate programming/, '코드와 문서를 함께 엮어 에이전트가 맥락을 잃지 않게 돕는 문서 결합형 프로그래밍 스킬입니다.'],
    [/self-memory|replacement models/, '작업 기억을 남기고 후속 모델이 이어받을 수 있게 돕는 메모리 플러그인입니다.'],
    [/registry of reusable ai skills|skills registry/, '재사용 가능한 AI 스킬을 찾아보고 등록하는 레지스트리입니다.'],
    [/flux|image generation/, 'FLUX 이미지 생성을 위한 프롬프트 가이드와 외부 서비스 연동 스킬입니다.'],
    [/auto-generates reusable skills|meta-skill/, '반복되는 작업 흐름을 감지해 재사용 가능한 스킬로 바꾸는 메타 스킬입니다.'],
    [/long-running ai agents|plan-approve-execute/, '긴 작업을 맡는 에이전트를 구조화된 기억과 승인 흐름으로 관리하는 하네스입니다.'],
    [/multi-step task|checkpoints|recovery/, '복잡한 여러 단계 작업을 체크포인트와 복구 흐름으로 실행하도록 돕는 스킬입니다.'],
    [/mcp client|progressive mcp|mcp/, 'MCP 서버와 도구를 에이전트가 필요한 만큼 단계적으로 불러오게 하는 클라이언트 패턴입니다.'],
    [/converts repos|developer discourse/, '저장소, 문서, 개발자 대화를 agentskills.io 형식의 스킬로 바꾸는 도구입니다.'],
    [/memory provider|memory layer|long-term memory|remember|context/, '에이전트가 장기 기억과 작업 맥락을 유지하도록 돕는 메모리 프로젝트입니다.'],
    [/telegram/, 'Hermes를 텔레그램 환경에서 쓰기 쉽게 연결하는 통합 프로젝트입니다.'],
    [/docker|deployment|self-hosted|server|cloudflare/, 'Hermes를 서버나 셀프호스팅 환경에 배포하기 위한 인프라 프로젝트입니다.'],
    [/web search|browser/, '웹 검색이나 브라우저 조작을 Hermes 작업 흐름에 붙이는 확장 프로젝트입니다.'],
    [/security|cyber/, '보안 점검과 사이버보안 작업을 에이전트 스킬로 다루는 프로젝트입니다.'],
    [/weather/, '날씨 데이터를 Hermes에서 조회하거나 자동화에 활용하는 플러그인입니다.'],
    [/notion|discord|slack|github|nextcloud|api/, '외부 서비스와 Hermes를 이어 기존 업무 흐름에 붙이는 통합 프로젝트입니다.'],
    [/monitoring|otel|observability/, 'Hermes 실행 상태를 관찰하고 운영 지표를 확인하기 위한 모니터링 프로젝트입니다.'],
  ];
  for (const [pattern, sentence] of rules) {
    if (pattern.test(lower)) return sentence;
  }
  const hints = pickHints(repo);
  if (!source) return `${id}는 ${categoryKo} 영역에서 참고할 수 있는 프로젝트입니다.`;
  if (categoryPurpose[categoryKo]) return categoryPurpose[categoryKo];
  if (hints.length) return `${hints.slice(0, 2).join('·')} 관련 기능으로 Hermes 활용 범위를 넓히는 프로젝트입니다.`;
  return `${id}는 ${categoryKo} 영역에서 원문 README와 함께 살펴볼 만한 프로젝트입니다.`;
}

const fallbackSentence = (repo, categoryKo) => sourcePurposeKo(repo, categoryKo);

function useCaseWhen(value = '') {
  const overrides = {
    'Hermes Agent의 기본 구조 파악': 'Hermes Agent의 기본 구조를 파악할 때',
    '공식 기능 확인': '공식 기능을 확인할 때',
    '생태계의 기준점 확인': '생태계의 기준점을 확인할 때',
    '작업 흐름을 화면에서 확인': '작업 흐름을 화면에서 확인할 때',
    '채팅·터미널·메모리 관리': '채팅, 터미널, 메모리 관리를 한 화면에서 처리할 때',
    '비개발자도 쓰기 쉬운 화면형 도구 검토': '비개발자도 쓰기 쉬운 화면형 도구를 검토할 때',
    '반복 작업을 스킬로 정리': '반복 작업을 스킬로 정리할 때',
    '도메인별 스킬 탐색': '도메인별 스킬을 탐색할 때',
    '팀 작업 방식 표준화': '팀 작업 방식을 표준화할 때',
  };
  if (overrides[value]) return overrides[value];
  if (/관리$/.test(value)) return `${value}가 필요할 때`;
  if (/확인$/.test(value)) return `${value}할 때`;
  if (/정리$/.test(value)) return `${value}할 때`;
  if (/탐색$/.test(value)) return `${value}할 때`;
  if (/구성$/.test(value)) return `${value}할 때`;
  if (/연동$/.test(value)) return `${value}할 때`;
  if (/자동화$/.test(value)) return `${value}가 필요할 때`;
  if (/개선$/.test(value)) return `${value}할 때`;
  if (/향상$/.test(value)) return `${value}이 필요할 때`;
  return `${value}이 필요할 때`;
}

function generatedLocalization(repo, categoryKo) {
  const hints = pickHints(repo);
  const uses = [...new Set([...(categoryUseCases[categoryKo] || ['Hermes 생태계 탐색', '도구 비교']), ...hints])].slice(0, 4);
  const audience = categoryAudience[categoryKo] || ['Hermes 사용자', 'AI 자동화 실험자'];
  const tags = [...new Set([categoryKo, ...hints, ...uses])].slice(0, 6);
  const purpose = sourcePurposeKo(repo, categoryKo);
  const oneLineKo = purpose;
  const [primaryUse, secondaryUse] = uses;
  const summaryKo = [
    purpose,
    `${categoryKo} 분류에서 ${useCaseWhen(primaryUse)} 먼저 살펴보면 좋습니다.`,
    secondaryUse ? `${useCaseWhen(secondaryUse)}도 함께 참고할 만합니다.` : '',
    '저장소 이름, 명령어, 원문 링크는 정확한 확인을 위해 그대로 유지했습니다.',
  ].filter(Boolean).join(' ');
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
