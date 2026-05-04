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
    const answer = answerFromContext(question, contexts, { limit: 4 });
    sendJson(res, 200, {
      answer,
      mode: 'local',
      citations: contexts.slice(0, 6).map(c => ({
        id: c.id,
        repoId: c.repoId,
        title: c.title,
        sourceUrl: c.sourceUrl,
        score: c.score
      }))
    });
  } catch (error) {
    sendJson(res, 500, { error: '질문 처리 중 오류가 발생했습니다.', detail: error.message });
  }
}
