import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.js';

function callHandler(body, method = 'POST') {
  return new Promise((resolve) => {
    const req = { method, body };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      end(payload = '') { resolve({ statusCode: this.statusCode, headers: this.headers, body: payload }); }
    };
    handler(req, res);
  });
}

test('chat API answers Korean questions from local RAG when no LLM key is available', async () => {
  const original = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  const res = await callHandler({ question: '사이버보안 스킬은 뭐가 있어?' });
  process.env.OPENROUTER_API_KEY = original;
  assert.equal(res.statusCode, 200);
  const json = JSON.parse(res.body);
  assert.equal(json.mode, 'local');
  assert.match(json.answer, /mukul975\/Anthropic-Cybersecurity-Skills/);
  assert.ok(json.citations.some(c => c.repoId === 'mukul975/Anthropic-Cybersecurity-Skills'));
});

test('chat API rejects empty question', async () => {
  const res = await callHandler({ question: '   ' });
  assert.equal(res.statusCode, 400);
});
