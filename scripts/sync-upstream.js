#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';
import './sync-upstream-docs.js';

const SOURCES = {
  repos: 'https://raw.githubusercontent.com/ksimback/hermes-ecosystem/main/data/repos.json',
  lists: 'https://raw.githubusercontent.com/ksimback/hermes-ecosystem/main/data/lists.json',
};

const writeJson = (path, data) => {
  fs.mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
};

const readJson = (path, fallback = null) => {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
};

const hash = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

async function fetchJson(name, url) {
  const res = await fetch(url, { headers: { 'user-agent': 'hermes-atlas-kr-sync' } });
  if (!res.ok) throw new Error(`${name} fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

const repos = await fetchJson('repos', SOURCES.repos);
const lists = await fetchJson('lists', SOURCES.lists);
const previousManifest = readJson('data/source-manifest.json', {});
const nextHashes = {
  repos: hash(repos),
  lists: hash(lists),
};
const unchanged = previousManifest.hashes?.repos === nextHashes.repos
  && previousManifest.hashes?.lists === nextHashes.lists;

writeJson('data/repos.raw.json', repos);
writeJson('data/lists.raw.json', lists);
writeJson('data/source-manifest.json', {
  syncedAt: unchanged && previousManifest.syncedAt ? previousManifest.syncedAt : new Date().toISOString(),
  upstream: 'https://github.com/ksimback/hermes-ecosystem',
  sources: SOURCES,
  hashes: nextHashes,
  counts: {
    repos: repos.length,
    lists: lists.length,
  },
});

console.log(`Synced ${repos.length} repos and ${lists.length} lists from upstream`);
