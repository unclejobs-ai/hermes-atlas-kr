import test from 'node:test';
import assert from 'node:assert/strict';
import { retrieve, answerFromContext } from '../lib/retrieval.js';

const chunks = [
  {
    id: 'security',
    repoId: 'mukul975/Anthropic-Cybersecurity-Skills',
    title: 'mukul975/Anthropic-Cybersecurity-Skills',
    text: 'AI 에이전트가 보안 분석을 수행하도록 돕는 대규모 사이버보안 스킬 레지스트리입니다. MITRE ATT&CK, NIST, 위협 헌팅, 인시던트 대응에 씁니다.',
    sourceUrl: 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills'
  },
  {
    id: 'memory',
    repoId: 'mem0ai/mem0',
    title: 'mem0ai/mem0',
    text: 'AI 에이전트를 위한 범용 메모리 계층입니다. 장기 사용자 메모리와 개인화에 씁니다.',
    sourceUrl: 'https://github.com/mem0ai/mem0'
  },
  {
    id: 'telegram',
    repoId: 'clawvader-tech/hermes-telegram-miniapp',
    title: 'clawvader-tech/hermes-telegram-miniapp',
    text: 'Telegram Mini App으로 Hermes를 모바일에서 쓰는 웹 UI 프로젝트입니다.',
    sourceUrl: 'https://github.com/clawvader-tech/hermes-telegram-miniapp'
  }
];

test('retrieve ranks Korean semantic keyword matches first', () => {
  const results = retrieve('사이버보안 스킬 찾아줘', chunks, { limit: 2 });
  assert.equal(results[0].repoId, 'mukul975/Anthropic-Cybersecurity-Skills');
  assert.ok(results[0].score > 0);
});

test('retrieve supports English repo/integration terms mixed with Korean', () => {
  const results = retrieve('telegram 연동 프로젝트', chunks, { limit: 2 });
  assert.equal(results[0].repoId, 'clawvader-tech/hermes-telegram-miniapp');
});

test('retrieve returns one best result per repo by default', () => {
  const duplicated = [
    ...chunks,
    { ...chunks[1], id: 'memory-2', text: 'mem0ai/mem0 provider memory 메모리 추가 chunk' }
  ];
  const results = retrieve('메모리 provider', duplicated, { limit: 5 });
  assert.equal(results.filter(r => r.repoId === 'mem0ai/mem0').length, 1);
});

test('answerFromContext returns Korean answer with citations and repo names', () => {
  const results = retrieve('메모리 provider 뭐가 좋아?', chunks, { limit: 2 });
  const answer = answerFromContext('메모리 provider 뭐가 좋아?', results);
  assert.match(answer, /mem0ai\/mem0/);
  assert.match(answer, /출처/);
  assert.match(answer, /https:\/\/github.com\/mem0ai\/mem0/);
});
