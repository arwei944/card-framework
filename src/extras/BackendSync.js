/**
 * BackendSync — opt-in adapter that mirrors a CardFrame instance to a
 * business-data backend over HTTP. Zero runtime dependencies: uses the
 * global fetch (browser) and is fully injectable for tests.
 *
 * Modes:
 *   - 'full'          : push the whole dataset (exportData shape), replace on pull
 *   - 'incremental'  : push only added/updated/removed deltas (last-write-wins)
 *
 * The adapter owns NO business logic — it only transports CardFrame's
 * existing import/export representation to/from `endpoint`.
 * @module extras/BackendSync
 */

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
    this._fetchImpl = options.fetchImpl ||
      (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);

    this._unsubscribe = null;
    this._timer = null;
    this._mirror = { cards: new Map(), rels: new Map() };
    this._started = false;
    this._lastPush = null;
  }

  _headers() {
    const h = Object.assign({ 'Content-Type': 'application/json' }, this.extraHeaders);
    const token = typeof this.authToken === 'function' ? this.authToken() : this.authToken;
    if (token) h['Authorization'] = 'Bearer ' + token;
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
      if (!res.ok) {
        return res.text().then((t) => {
          throw new Error('BackendSync HTTP ' + res.status + ': ' + t.slice(0, 200));
        });
      }
      const ct = res.headers && res.headers.get ? res.headers.get('content-type') : '';
      if (ct && ct.indexOf('application/json') !== -1) return res.json();
      return res.text();
    });
  }

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
    return this._request('POST', '/sync', payload).then(() => {
      this._mirror = this._snapshotMirror();
      this._lastPush = Date.now();
      return true;
    }).catch((err) => {
      if (this.onError) this.onError(err, { phase: 'push' });
      return false;
    });
  }

  _scheduleFlush() {
    if (this._timer) return;
    const self = this;
    this._timer = setTimeout(() => self._flush(), this.debounceMs);
  }

  pull() {
    return this._request('GET', '').then((data) => {
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
    this.frame = null;
    this._mirror = { cards: new Map(), rels: new Map() };
  }
}
