/* global process, console */
/**
 * Zero-dependency example backend for BackendSync — now with production
 * hardening: JWT / static-token auth and ETag optimistic concurrency.
 *
 * Run (dev, anon):        node examples/backend-sync-server.mjs
 * Run (auth, JWT):        SYNC_JWT_SECRET=xxx node examples/backend-sync-server.mjs
 * Mint a demo JWT:        SYNC_JWT_SECRET=xxx node examples/backend-sync-server.mjs --issue
 * Run (static token):     SYNC_API_TOKEN=abc node examples/backend-sync-server.mjs
 *
 * Contract:
 *   GET  {endpoint}        -> 200 + snapshot, ETag: "vN"  (auth required if configured)
 *   POST {endpoint}/sync   -> 200 + {ok, version, etag}   (If-Match mismatch -> 409 + snapshot)
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const PORT = process.env.PORT || 3001;
const BASE = '/api/cardframe';
const JWT_SECRET = process.env.SYNC_JWT_SECRET || '';
const STATIC_TOKEN = process.env.SYNC_API_TOKEN || '';
const AUTH_REQUIRED = !!(JWT_SECRET || STATIC_TOKEN);

// ── JWT (HS256) — zero-dep via node:crypto ─────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
function verifyJwt(token) {
  if (!JWT_SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}
function mintToken(payload, ttlSeconds = 3600) {
  if (!JWT_SECRET) throw new Error('SYNC_JWT_SECRET not set');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(Object.assign({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }, payload)));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

if (process.argv.includes('--issue')) {
  try {
    const token = mintToken({ sub: 'demo', scope: 'cardframe:sync' });
    console.log(token);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
}

// ── in-memory collection ────────────────────────────────────────
const collections = new Map();
function emptySnapshot() {
  return { version: '1.0.0', exportedAt: Date.now(), cards: [], relationships: [], layoutMode: 'free', metadata: {} };
}
function getCollection(name) {
  if (!collections.has(name)) collections.set(name, { snapshot: emptySnapshot(), version: 0 });
  return collections.get(name);
}
function etagOf(collection) { return 'v' + collection.version; }

function applyFull(collection, payload) {
  collection.snapshot = {
    version: payload.version || '1.0.0',
    exportedAt: Date.now(),
    cards: Array.isArray(payload.cards) ? payload.cards : [],
    relationships: Array.isArray(payload.relationships) ? payload.relationships : [],
    layoutMode: payload.layoutMode || 'free',
    metadata: payload.metadata || {}
  };
  collection.version += 1;
  return collection.snapshot;
}
function upsert(list, items) {
  const byId = new Map(list.map((x) => [x.id, x]));
  (items || []).forEach((x) => byId.set(x.id, x));
  return Array.from(byId.values());
}
function applyDelta(collection, payload) {
  const snap = collection.snapshot;
  snap.cards = upsert(snap.cards, (payload.cards.added || []).concat(payload.cards.updated || []));
  snap.cards = snap.cards.filter((c) => (payload.cards.removed || []).indexOf(c.id) === -1);
  snap.relationships = upsert(snap.relationships, (payload.relationships.added || []).concat(payload.relationships.updated || []));
  snap.relationships = snap.relationships.filter((r) => (payload.relationships.removed || []).indexOf(r.id) === -1);
  snap.exportedAt = Date.now();
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

function authorized(req) {
  if (!AUTH_REQUIRED) return true;
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    if (STATIC_TOKEN && token === STATIC_TOKEN) return true;
    if (verifyJwt(token)) return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (!authorized(req)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  if (url === BASE) {
    if (req.method === 'GET') {
      const col = getCollection('default');
      res.setHeader('ETag', etagOf(col));
      return res.end(JSON.stringify(col.snapshot));
    }
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'method not allowed' }));
  }

  if (url === BASE + '/sync') {
    if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'use POST' })); }
    try {
      const payload = await readBody(req);
      const col = getCollection('default');
      const ifMatch = req.headers['if-match'];
      if (AUTH_REQUIRED && ifMatch && ifMatch !== etagOf(col)) {
        res.statusCode = 409;
        res.setHeader('ETag', etagOf(col));
        return res.end(JSON.stringify({ conflict: true, currentVersion: col.version, snapshot: col.snapshot }));
      }
      const snap = payload.incremental ? applyDelta(col, payload) : applyFull(col, payload);
      res.setHeader('ETag', etagOf(col));
      return res.end(JSON.stringify({ ok: true, version: col.version, etag: etagOf(col), cardCount: snap.cards.length }));
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
  if (AUTH_REQUIRED) console.log('[auth] ' + (JWT_SECRET ? 'JWT (HS256) enforced' : 'static token enforced'));
  else console.log('[auth] WARNING: anonymous access — set SYNC_JWT_SECRET or SYNC_API_TOKEN for production');
});
