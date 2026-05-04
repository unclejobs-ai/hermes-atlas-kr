const KOREAN_SYNONYMS = new Map([
  ['사이버보안', ['보안', 'security', 'cybersecurity', '위협', '침해', '취약점', 'soc']],
  ['보안', ['사이버보안', 'security', 'cybersecurity', '위협', '침해', '취약점', 'soc']],
  ['메모리', ['memory', '기억', 'context', '컨텍스트', 'personalization', '개인화']],
  ['기억', ['메모리', 'memory', 'context', '컨텍스트']],
  ['텔레그램', ['telegram', 'miniapp', 'mini', 'app']],
  ['telegram', ['텔레그램', 'miniapp', 'mini', 'app']],
  ['슬랙', ['slack']],
  ['스킬', ['skill', 'skills', '레지스트리', 'registry']],
  ['레지스트리', ['registry', 'skill', 'skills', '스킬']],
  ['연동', ['integration', 'integrations', 'bridge', 'bridges', '통합', '브리지']],
  ['배포', ['deployment', 'infra', 'docker', 'nix', 'self-hosted', '셀프호스팅']],
  ['초보', ['guide', 'docs', 'awesome', 'learn', '가이드', '문서', '입문']]
]);

const STOPWORDS = new Set(['프로젝트', '찾아줘', '뭐가', '좋아', '있어', '추천', '알려줘', '어떤', '관련', '사용', '도구']);

export function tokenize(input = '') {
  const text = String(input).toLowerCase().normalize('NFKC');
  const words = text.match(/[a-z0-9][a-z0-9._/-]*|[가-힣]{2,}/g) || [];
  const grams = [];
  for (const word of words) {
    if (STOPWORDS.has(word)) continue;
    grams.push(word);
    if (/^[가-힣]+$/.test(word) && word.length > 2) {
      for (let i = 0; i < word.length - 1; i++) {
        const gram = word.slice(i, i + 2);
        if (!['프로', '로젝', '젝트'].includes(gram)) grams.push(gram);
      }
    }
  }
  return [...new Set(grams.filter(Boolean))];
}

function expandQueryTokens(query) {
  const base = tokenize(query);
  const expanded = new Set(base);
  for (const token of base) {
    for (const syn of KOREAN_SYNONYMS.get(token) || []) {
      for (const t of tokenize(syn)) expanded.add(t);
    }
  }
  return [...expanded];
}

function chunkText(chunk) {
  return [chunk.title, chunk.repoId, chunk.section, chunk.text].filter(Boolean).join('\n');
}

function termFrequency(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) || 0) + 1);
  return map;
}

function buildIndex(chunks) {
  const docs = chunks.map((chunk) => {
    const tokens = tokenize(chunkText(chunk));
    return { chunk, tokens, tf: termFrequency(tokens), length: tokens.length || 1 };
  });
  const df = new Map();
  for (const doc of docs) {
    for (const token of new Set(doc.tokens)) df.set(token, (df.get(token) || 0) + 1);
  }
  const avgdl = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgdl, total: docs.length };
}

function bm25Score(queryTokens, doc, index) {
  const k1 = 1.4;
  const b = 0.72;
  let score = 0;
  for (const token of queryTokens) {
    const tf = doc.tf.get(token) || 0;
    if (!tf) continue;
    const df = index.df.get(token) || 0;
    const idf = Math.log(1 + (index.total - df + 0.5) / (df + 0.5));
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc.length / index.avgdl)));
  }
  return score;
}

function lexicalBoost(query, chunk, queryTokens = null) {
  const q = String(query).toLowerCase();
  const repo = String(chunk.repoId || chunk.title || '').toLowerCase();
  let boost = 0;
  if (repo && q.includes(repo)) boost += 3;
  for (const part of repo.split(/[\/_-]/).filter(Boolean)) {
    if (part.length >= 4 && q.includes(part)) boost += 8;
  }
  for (const token of queryTokens || tokenize(query)) {
    if (token.length >= 4 && repo.includes(token)) boost += 6;
  }
  if (chunk.sourceType === 'repo-summary') boost += 0.1;
  return boost;
}

export function retrieve(query, chunks, options = {}) {
  const limit = options.limit || 6;
  const minScore = options.minScore ?? 0.05;
  const queryTokens = expandQueryTokens(query);
  if (!queryTokens.length) return [];
  const index = buildIndex(chunks || []);
  const ranked = index.docs
    .map((doc) => {
      const bm25 = bm25Score(queryTokens, doc, index);
      const score = bm25 + lexicalBoost(query, doc.chunk, queryTokens);
      return { ...doc.chunk, score: Number(score.toFixed(6)), matchedTokens: queryTokens.filter(t => doc.tf.has(t)).slice(0, 12) };
    })
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score || String(a.repoId).localeCompare(String(b.repoId)));
  if (options.dedupeRepos === false) return ranked.slice(0, limit);
  const seen = new Set();
  const deduped = [];
  for (const result of ranked) {
    const key = result.repoId || result.title || result.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export function answerFromContext(question, results, options = {}) {
  const top = (results || []).slice(0, options.limit || 4);
  if (!top.length) {
    return '아직 Atlas 안에서 근거를 찾지 못했습니다. 질문을 더 구체적으로 바꾸거나 프로젝트명, 카테고리, 통합 이름을 함께 넣어 주세요.';
  }
  const intro = `질문하신 “${question}”에 대해 Atlas에서 관련도가 높은 프로젝트는 아래입니다.`;
  const body = top.map((item, idx) => {
    const text = String(item.text || '').replace(/\s+/g, ' ').trim();
    const short = text.length > 220 ? `${text.slice(0, 220)}…` : text;
    return `${idx + 1}. ${item.repoId || item.title}\n   ${short}`;
  }).join('\n');
  const citations = top.map((item, idx) => `${idx + 1}. ${item.sourceUrl || ''}`).filter(Boolean).join('\n');
  return `${intro}\n\n${body}\n\n출처\n${citations}`;
}

export default { tokenize, retrieve, answerFromContext };
