/* global process, console */
/**
 * Zero-dependency example backend for BackendSync.
 *
 * Run:  node examples/backend-sync-server.js
 * The CardFrame adapter talks to this over:
 *   GET  /api/cardframe        -> returns the current full snapshot
 *   POST /api/cardframe/sync   -> full-replace OR incremental delta
 *
 * Strategy: single in-memory collection, last-write-wins. For production
 * swap the Map for a database and add Bearer auth (see docs/backend-integration.md).
 *
 * @module examples/backend-sync-server
 */

import http from 'node:http';

const PORT = process.env.PORT || 3001;
const BASE = '/api/cardframe';

// collection -> { snapshot, version }
const collections = new Map();

function emptySnapshot() {
  return { version: '1.0.0', exportedAt: Date.now(), cards: [], relationships: [], layoutMode: 'free', metadata: {} };
}

function getCollection(name) {
  if (!collections.has(name)) collections.set(name, { snapshot: emptySnapshot(), version: 1 });
  return collections.get(name);
}

function applyFull(collection, payload) {
  const snapshot = {
    version: payload.version || '1.0.0',
    exportedAt: Date.now(),
    cards: Array.isArray(payload.cards) ? payload.cards : [],
    relationships: Array.isArray(payload.relationships) ? payload.relationships : [],
    layoutMode: payload.layoutMode || 'free',
    metadata: payload.metadata || {}
  };
  collection.snapshot = snapshot;
  collection.version += 1;
  return snapshot;
}

function upsert(list, items) {
  const byId = new Map(list.map((x) => [x.id, x]));
  (items || []).forEach((x) => byId.set(x.id, x));
  return Array.from(byId.values());
}

function applyDelta(collection, payload) {
  const snap = collection.snapshot;
  snap.cards = upsert(snap.cards, payload.cards.added.concat(payload.cards.updated));
  snap.cards = snap.cards.filter((c) => payload.cards.removed.indexOf(c.id) === -1);
  snap.relationships = upsert(snap.relationships, payload.relationships.added.concat(payload.relationships.updated));
  snap.relationships = snap.relationships.filter((r) => payload.relationships.removed.indexOf(r.id) === -1);
  snap.exportedAt = Date.now();
  collection.snapshot = snap;
  collection.version += 1;
  return snap;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (url === BASE) {
    if (req.method === 'GET') {
      return res.end(JSON.stringify(getCollection('default').snapshot));
    }
    return res.end(JSON.stringify({ error: 'method not allowed' }), () => res.statusCode = 405);
  }

  if (url === BASE + '/sync') {
    if (req.method !== 'POST') return res.end(JSON.stringify({ error: 'use POST' }), () => res.statusCode = 405);
    try {
      const payload = await readBody(req);
      const collection = getCollection('default');
      const snap = payload.incremental ? applyDelta(collection, payload) : applyFull(collection, payload);
      return res.end(JSON.stringify({ ok: true, version: collection.version, cardCount: snap.cards.length }));
    } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('BackendSync example server listening on http://localhost:' + PORT + BASE);
});
