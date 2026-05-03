#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';

const OWNER = 'ksimback';
const REPO = 'hermes-ecosystem';
const BRANCH = 'main';
const TREE_URL = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const DOC_PATTERNS = [
  /^README\.md$/,
  /^ECOSYSTEM\.md$/,
  /^CONTRIBUTING\.md$/,
  /^research\/.+\.md$/,
  /^repos\/.+\.md$/,
  /^drafts\/.+\.md$/,
];

function writeJson(path, data) {
  fs.mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function readJson(path, fallback = null) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'hermes-atlas-kr-doc-sync' } });
  if (!res.ok) throw new Error(`${url} fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function isDocPath(filePath) {
  return DOC_PATTERNS.some((pattern) => pattern.test(filePath));
}

const tree = JSON.parse(await fetchText(TREE_URL));
const files = tree.tree
  .filter((entry) => entry.type === 'blob' && isDocPath(entry.path))
  .sort((a, b) => a.path.localeCompare(b.path));

const documents = [];
for (const file of files) {
  const sourceUrl = `${RAW_BASE}/${file.path}`;
  const text = await fetchText(sourceUrl);
  const trimmed = text.trim();
  if (!trimmed) continue;
  documents.push({
    path: file.path,
    sourceUrl,
    hash: hash(trimmed),
    bytes: Buffer.byteLength(trimmed),
    text: trimmed,
  });
}

const previousDocs = readJson('data/docs.raw.json', {});
const docsHash = hash(JSON.stringify(documents.map((doc) => ({ path: doc.path, hash: doc.hash }))));
const unchanged = previousDocs.hash === docsHash;
writeJson('data/docs.raw.json', {
  syncedAt: unchanged && previousDocs.syncedAt ? previousDocs.syncedAt : new Date().toISOString(),
  upstream: `https://github.com/${OWNER}/${REPO}`,
  branch: BRANCH,
  count: documents.length,
  hash: docsHash,
  documents,
});

console.log(`Synced ${documents.length} upstream markdown documents → data/docs.raw.json`);
