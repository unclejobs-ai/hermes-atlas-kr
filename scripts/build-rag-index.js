#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotenv(path.join(os.homedir(), '.hermes', '.env'));
loadDotenv('.env');

const API_KEY = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.startsWith('sk-')
  ? process.env.OPENROUTER_API_KEY
  : '';
const EMBEDDING_MODEL = process.env.KR_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
const WITH_EMBEDDINGS = process.argv.includes('--embeddings') || process.env.BUILD_EMBEDDINGS === '1';

const repos = JSON.parse(fs.readFileSync('data/repos.ko.json', 'utf-8'));
const docsRaw = fs.existsSync('data/docs.raw.json')
  ? JSON.parse(fs.readFileSync('data/docs.raw.json', 'utf-8'))
  : { documents: [] };
const manifest = fs.existsSync('data/source-manifest.json')
  ? JSON.parse(fs.readFileSync('data/source-manifest.json', 'utf-8'))
  : {};
const chunks = [];

function addChunk(chunk) {
  chunks.push({ id: `${chunk.sourceType}:${chunks.length}`, embedding: null, ...chunk });
}

for (const repo of repos) {
  const title = `${repo.owner}/${repo.repo}`;
  addChunk({
    lang: 'ko',
    sourceType: 'repo-summary',
    source: 'data/repos.ko.json',
    repoId: repo.id,
    title,
    section: '한국어 요약',
    text: [
      `${title} (${repo.categoryKo})`,
      repo.oneLineKo,
      repo.summaryKo,
      repo.useCasesKo?.length ? `용도: ${repo.useCasesKo.join(', ')}` : '',
      repo.tagsKo?.length ? `태그: ${repo.tagsKo.join(', ')}` : '',
      repo.sourceDescription ? `원문 설명: ${repo.sourceDescription}` : '',
    ].filter(Boolean).join('\n'),
    sourceUrl: repo.url,
  });
  if (repo.useCasesKo?.length) {
    addChunk({
      lang: 'ko',
      sourceType: 'repo-use-cases',
      source: 'data/repos.ko.json',
      repoId: repo.id,
      title,
      section: '용도',
      text: `${title}의 주요 용도: ${repo.useCasesKo.join(', ')}`,
      sourceUrl: repo.url,
    });
  }
}

function docTitle(filePath) {
  return filePath
    .replace(/\.md$/i, '')
    .replace(/^research\//, 'Research: ')
    .replace(/^repos\//, 'Repo notes: ')
    .replace(/^drafts\//, 'Draft: ')
    .replace(/[-_]/g, ' ');
}

function compactMarkdown(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitText(text, maxChars = 1400) {
  const paragraphs = compactMarkdown(text).split(/(?<=[.!?。！？])\s+/);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    if ((current + ' ' + paragraph).length > maxChars && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = `${current} ${paragraph}`.trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length ? chunks : [compactMarkdown(text).slice(0, maxChars)];
}

for (const doc of docsRaw.documents || []) {
  const parts = splitText(doc.text).slice(0, 8);
  parts.forEach((text, index) => {
    addChunk({
      lang: 'en',
      sourceType: 'upstream-doc',
      source: doc.path,
      repoId: null,
      title: docTitle(doc.path),
      section: `원본 문서 ${index + 1}`,
      text: [
        `${doc.path} 원본 문서에서 가져온 RAG 근거입니다.`,
        text,
      ].join('\n'),
      sourceUrl: doc.sourceUrl,
    });
  });
}

async function embedBatch(texts) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/unclejobs-ai/hermes-atlas-kr',
      'X-Title': 'Hermes Atlas KR RAG Index Builder',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

if (WITH_EMBEDDINGS) {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY required for --embeddings');
  const batchSize = 20;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch.map((c) => c.text));
    embeddings.forEach((embedding, j) => { batch[j].embedding = embedding; });
    process.stdout.write(`embedded ${Math.min(i + batch.length, chunks.length)}/${chunks.length}\r`);
  }
  process.stdout.write('\n');
}

fs.writeFileSync('data/chunks.ko.json', JSON.stringify({
  generatedAt: manifest.syncedAt || '2026-05-02T00:00:00.000Z',
  embeddingModel: WITH_EMBEDDINGS ? EMBEDDING_MODEL : null,
  chunks,
}, null, 2) + '\n');
console.log(`Built ${chunks.length} Korean RAG chunks${WITH_EMBEDDINGS ? ' with embeddings' : ' without embeddings'}`);
