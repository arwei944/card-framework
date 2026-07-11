/**
 * BackendSync — opt-in adapter that mirrors a CardFrame instance to a
 * business-data backend over HTTP. Zero runtime dependencies: uses the
 * global fetch (browser) and is fully injectable for tests.
 *
 * Modes:
 *   - 'full'          : push the whole dataset (exportData shape), replace on pull
 *   - 'incremental'  : push only added/updated/removed deltas (last-write-wins)
 *
 * Production hardening (this revision):
 *   - Offline queue: failed pushes are buffered (persisted to localStorage)
 *     and replayed on the `online` event / next start.
 *   - Optimistic concurrency: with `concurrency: 'etag'` the client sends
 *     `If-Match` and the server answers 409 on version skew; the client then
 *     re-pulls (or calls onConflict) instead of blindly overwriting.
 *
 * The adapter owns NO business logic — it only transports CardFrame's
 * existing import/export representation to/from `endpoint`.
 * @module extras/BackendSync
 */

class SyncError extends Error {
  constructor(message, status, body, etag) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
    this.body = body;
    this.etag = etag;
  }
}

export class BackendSync {
  constructor(frame, options = {}) {
    if (!frame || typeof frame.exportData !== 'function') {
      throw new Error('BackendSync 需要有效的 CardFrame 实例');
    }
    this.frame = frame;
    this.endpoint = (options.endpoint || '/api/cardframe').replace(/\/+$/, '');
    this.mode = options.mode === 'incremental' ? 'incremental' : 'full';
    this.debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 400;
    this.pullOnStart = options.pullOnStart !== false;
    this.autoPush = options.autoPush !== false;
    this.authToken = options.authToken || null;
    this.extraHeaders = options.headers || {};
    this.onError = typeof options.onError === 'function' ? options.onError : null;
    this.onConflict = typeof options.onConflict === 'function' ? options.onConflict : null;
    this.concurrency = options.concurrency === 'etag' ? 'etag' : 'none';
    this.offlineQueue = options.offlineQueue !== false;
    this._fetchImpl = options.fetchImpl ||
      (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);

    this._unsubscribe = null;
    this._timer = null;
    this._mirror = { cards: new Map(), rels: new Map() };
    this._started = false;
    this._lastPush = null;
    this._serverVersion = null;        // ETag from server (concurrency='etag')
    this._lastEtag = null;             // ETag of the most recent response
    this._queue = this._emptyQueue();  // pending offline payload
    this._queueDirty = false;

    const ls = (typeof globalThis !== 'undefined' && globalThis.localStorage) ? globalThis.localStorage : null;
    this._ls = ls;
    this._lsKey = 'cf-sync-' + this.endpoint;
    if (this.offlineQueue && this._ls) this._loadPersisted();

    if (typeof window !== 'undefined' && window.addEventListener) {
      this._onOnline = () => this._replay();
      window.addEventListener('online', this._onOnline);
    }
  }

  // ── request helpers ──────────────────────────────────────────
  _headers(extra) {
    const h = Object.assign({ 'Content-Type': 'application/json' }, this.extraHeaders, extra || {});
    const token = typeof this.authToken === 'function' ? this.authToken() : this.authToken;
    if (token) h['Authorization'] = 'Bearer ' + token;
    if (this.concurrency === 'etag' && this._serverVersion) h['If-Match'] = this._serverVersion;
    return h;
  }

  _request(method, path, body) {
    if (!this._fetchImpl) {
      const err = new Error('BackendSync: 环境中无 fetch 实现');
      if (this.onError) this.onError(err, { phase: 'request', method });
      return Promise.reject(err);
    }
    const url = this.endpoint + path;
    const init = { method, headers: this._headers() };
    if (body !== undefined) init.body = JSON.stringify(body);
    return Promise.resolve(this._fetchImpl(url, init)).then((res) => {
      const etag = res.headers && res.headers.get ? res.headers.get('etag') : null;
      if (res.ok) {
        this._lastEtag = etag;
        const ct = res.headers && res.headers.get ? res.headers.get('content-type') : '';
        if (ct && ct.indexOf('application/json') !== -1) return res.json().then((j) => ({ data: j, etag }));
        return res.text().then((t) => ({ data: t, etag }));
      }
      return res.text().then((t) => {
        let parsed = null;
        try { parsed = JSON.parse(t); } catch { /* keep text */ }
        const msg = 'BackendSync HTTP ' + res.status + ': ' + t.slice(0, 200);
        throw new SyncError(msg, res.status, parsed, etag);
      });
    });
  }

  // ── canonical snapshots for delta detection ───────────────────
  _canonicalCard(card) {
    return JSON.stringify({
      t: card.type, p: card.props, s: card.status,
      pos: card.position, st: card.style
    });
  }

  _canonicalRel(rel) {
    return JSON.stringify({ s: rel.sourceId, t: rel.targetId, ty: rel.type, d: rel.data });
  }

  _snapshotMirror() {
    const cards = new Map();
    this.frame.getAllCards().forEach((c) => cards.set(c.id, this._canonicalCard(c)));
    const rels = new Map();
    this.frame.getAllRelationships().forEach((r) => rels.set(r.id, this._canonicalRel(r)));
    return { cards, rels };
  }

  _buildDelta() {
    const current = this._snapshotMirror();
    const addedC = [];
    const updatedC = [];
    const removedC = [];
    current.cards.forEach((canon, id) => {
      if (!this._mirror.cards.has(id)) addedC.push(this.frame.getCard(id));
      else if (this._mirror.cards.get(id) !== canon) updatedC.push(this.frame.getCard(id));
    });
    this._mirror.cards.forEach((_, id) => {
      if (!current.cards.has(id)) removedC.push(id);
    });
    const addedR = [];
    const updatedR = [];
    const removedR = [];
    current.rels.forEach((canon, id) => {
      if (!this._mirror.rels.has(id)) addedR.push(this.frame.getRelationship(id));
      else if (this._mirror.rels.get(id) !== canon) updatedR.push(this.frame.getRelationship(id));
    });
    this._mirror.rels.forEach((_, id) => {
      if (!current.rels.has(id)) removedR.push(id);
    });
    return {
      incremental: true,
      cards: { added: addedC, updated: updatedC, removed: removedC },
      relationships: { added: addedR, updated: updatedR, removed: removedR }
    };
  }

  _fullPayload() {
    return this.frame.exportData();
  }

  // ── offline queue (merge into a single pending payload) ───────
  _emptyQueue() {
    if (this.mode === 'full') return { cards: [], relationships: [] };
    return {
      incremental: true,
      cards: { added: new Map(), updated: new Map(), removed: new Set() },
      relationships: { added: new Map(), updated: new Map(), removed: new Set() }
    };
  }

  _serializeQueue() {
    if (this.mode === 'full') return this._queue; // full snapshot is the pending payload
    const q = this._queue;
    const toArr = (m) => Array.from(m.values());
    return {
      incremental: true,
      cards: { added: toArr(q.cards.added), updated: toArr(q.cards.updated), removed: Array.from(q.cards.removed) },
      relationships: { added: toArr(q.relationships.added), updated: toArr(q.relationships.updated), removed: Array.from(q.relationships.removed) }
    };
  }

  _queueIsEmpty() {
    const q = this._queue;
    if (!q) return true;
    if (this.mode === 'full') {
      return (!q.cards || q.cards.length === 0) && (!q.relationships || q.relationships.length === 0);
    }
    return q.cards.added.size === 0 && q.cards.updated.size === 0 && q.cards.removed.size === 0 &&
      q.relationships.added.size === 0 && q.relationships.updated.size === 0 && q.relationships.removed.size === 0;
  }

  _enqueue(payload) {
    if (!this.offlineQueue) return;
    if (this.mode === 'full') {
      this._queue = payload; // full mode: latest snapshot supersedes
    } else {
      const q = this._queue;
      const merge = (bucket, list, removed) => {
        (list || []).forEach((item) => {
          if (typeof item === 'string') { removed.add(item); bucket.added.delete(item); bucket.updated.delete(item); }
          else { bucket.added.set(item.id, item); bucket.updated.set(item.id, item); removed.delete(item.id); }
        });
        (removed || []).forEach((id) => { q.cards.added.delete(id); q.cards.updated.delete(id); q.cards.removed.add(id); });
      };
      merge(q.cards, payload.cards.added, payload.cards.removed);
      merge(q.cards, payload.cards.updated, []);
      merge(q.relationships, payload.relationships.added, payload.relationships.removed);
      merge(q.relationships, payload.relationships.updated, []);
    }
    this._queueDirty = true;
    this._persist();
  }

  _clearQueue() {
    this._queue = this._emptyQueue();
    this._queueDirty = true;
    this._persist();
  }

  _persist() {
    if (!this._ls) return;
    try {
      const data = { serverVersion: this._serverVersion, queue: this.offlineQueue ? this._serializeQueue() : null };
      this._ls.setItem(this._lsKey, JSON.stringify(data));
      this._queueDirty = false;
    } catch { /* storage full / unavailable */ }
  }

  _loadPersisted() {
    try {
      const raw = this._ls.getItem(this._lsKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      this._serverVersion = data.serverVersion || null;
      if (data.queue && this.mode === 'full') {
        this._queue = data.queue;
      } else if (data.queue && this.mode === 'incremental') {
        const q = this._emptyQueue();
        const fill = (bucket, arr) => (arr || []).forEach((i) => bucket.set(i.id, i));
        fill(q.cards.added, data.queue.cards.added);
        fill(q.cards.updated, data.queue.cards.updated);
        (data.queue.cards.removed || []).forEach((id) => q.cards.removed.add(id));
        fill(q.relationships.added, data.queue.relationships.added);
        fill(q.relationships.updated, data.queue.relationships.updated);
        (data.queue.relationships.removed || []).forEach((id) => q.relationships.removed.add(id));
        this._queue = q;
      }
    } catch { /* ignore corrupt cache */ }
  }

  // ── flush / replay ────────────────────────────────────────────
  _flush() {
    this._timer = null;
    if (!this._started) return Promise.resolve(false);
    const payload = this.mode === 'incremental' ? this._buildDelta() : this._fullPayload();
    if (this.mode === 'incremental') {
      const empty = !payload.cards.added.length && !payload.cards.updated.length &&
        !payload.cards.removed.length && !payload.relationships.added.length &&
        !payload.relationships.updated.length && !payload.relationships.removed.length;
      if (empty) return Promise.resolve(false);
    }
    return this._send(payload);
  }

  _send(payload) {
    return this._request('POST', '/sync', payload).then((res) => {
      if (res.etag) this._serverVersion = res.etag;
      this._mirror = this._snapshotMirror();
      this._lastPush = Date.now();
      // a previously queued payload is now reconciled
      if (!this._queueIsEmpty()) this._clearQueue();
      return true;
    }).catch((err) => {
      if (err instanceof SyncError && err.status === 409) {
        const snapshot = err.body && err.body.snapshot;
        if (this.onConflict) this.onConflict(snapshot);
        else if (snapshot) this._applySnapshot(snapshot);
        this._clearQueue();
        return false;
      }
      // network / server error → buffer for later replay
      this._enqueue(payload);
      if (this.onError) this.onError(err, { phase: 'push', offline: !this._queueIsEmpty() });
      return false;
    });
  }

  _replay() {
    if (!this._started || this._queueIsEmpty()) return Promise.resolve(false);
    return this._send(this._serializeQueue());
  }

  _scheduleFlush() {
    if (this._timer) return;
    const self = this;
    this._timer = setTimeout(() => self._flush(), this.debounceMs);
  }

  _applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    this.frame.importData(snapshot, { mode: 'replace', clearBeforeImport: true });
    this._mirror = this._snapshotMirror();
  }

  // ── public API ────────────────────────────────────────────────
  pull() {
    return this._request('GET', '').then((res) => {
      if (res.etag) this._serverVersion = res.etag;
      const data = res.data;
      if (!data || typeof data !== 'object') return null;
      if (this.onConflict) this.onConflict(data);
      const result = this.frame.importData(data, { mode: 'replace', clearBeforeImport: true });
      this._mirror = this._snapshotMirror();
      return result;
    }).catch((err) => {
      if (this.onError) this.onError(err, { phase: 'pull' });
      throw err;
    });
  }

  pushNow() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    return Promise.resolve(this._flush());
  }

  start() {
    if (this._started) return this;
    this._started = true;
    const self = this;
    const begin = () => {
      if (self.autoPush && self.frame.store) {
        self._unsubscribe = self.frame.store.subscribe(() => self._scheduleFlush());
        self._mirror = self._snapshotMirror();
      }
      self._replay();
    };
    if (this.pullOnStart) {
      this.pull().then(begin).catch(() => begin());
    } else {
      begin();
    }
    return this;
  }

  stop() {
    this._started = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    return this;
  }

  destroy() {
    this.stop();
    if (this._onOnline && typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('online', this._onOnline);
    }
    this.frame = null;
    this._mirror = { cards: new Map(), rels: new Map() };
  }
}
