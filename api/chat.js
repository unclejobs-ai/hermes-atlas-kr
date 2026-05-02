import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrieve, answerFromContext } from '../lib/retrieval.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
let cachedChunks = null;

async function loadChunks() {
  if (cachedChunks) return cachedChunks;
  const raw = await fs.readFile(path.join(root, 'data/chunks.ko.json'), 'utf8');
  const parsed = JSON.parse(raw);
  cachedChunks = parsed.chunks || [];
  return cachedChunks;
}

async function answerWithOpenRouter(question, contexts) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-')) return null;
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
  const contextText = contexts.map((c, i) => `[${i + 1}] ${c.repoId || c.title}\n${c.text}\nURL: ${c.sourceUrl}`).join('\n\n');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hermes-atlas-kr.local',
      'X-Title': 'Hermes Atlas KR'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: '당신은 Hermes Atlas 한국어판 안내자입니다. 제공된 컨텍스트 안에서만 한국어로 답하세요. 모르면 모른다고 말하세요. repo 이름과 출처 URL을 보존하세요.'
        },
        {
          role: 'user',
          content: `질문: ${question}\n\n컨텍스트:\n${contextText}`
        }
      ]
    })
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json?.choices?.[0]?.message?.content?.trim() || null;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST만 지원합니다.' });
    return;
  }
  try {
    const chunks = await loadChunks();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const question = String(body.question || body.message || '').trim();
    if (!question) {
      sendJson(res, 400, { error: 'question이 필요합니다.' });
      return;
    }
    const contexts = retrieve(question, chunks, { limit: 6 });
    const llmAnswer = await answerWithOpenRouter(question, contexts).catch(() => null);
    const answer = llmAnswer || answerFromContext(question, contexts, { limit: 4 });
    sendJson(res, 200, {
      answer,
      mode: llmAnswer ? 'llm' : 'local',
      citations: contexts.slice(0, 6).map(c => ({
        id: c.id,
        repoId: c.repoId,
        title: c.title,
        sourceUrl: c.sourceUrl,
        score: c.score
      }))
    });
  } catch (error) {
    sendJson(res, 500, { error: 'Ask Atlas 처리 중 오류가 발생했습니다.', detail: error.message });
  }
}
