/**
 * Monitor — opt-in, zero-dependency error-reporting extra.
 *
 * Captures `window.onerror` / `unhandledrejection` and CardFrame
 * `frameworkError` events, batches them, and POSTs to a configurable
 * endpoint. Fully injectable (fetchImpl) so it runs headless in tests.
 * @module extras/Monitor
 */

export const Monitor = {
  _endpoint: null,
  _token: null,
  _fetchImpl: null,
  _onError: null,
  _batch: [],
  _timer: null,
  _batchSize: 10,
  _flushMs: 5000,
  _frame: null,
  _winHandlers: null,
  _frameHandler: null,
  _inited: false,

  init(options = {}) {
    if (this._inited) this.destroy();
    this._endpoint = options.endpoint || null;
    this._token = typeof options.token === 'function' ? options.token : (options.token || null);
    this._fetchImpl = options.fetchImpl ||
      (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this._onError = typeof options.onError === 'function' ? options.onError : null;
    this._batchSize = typeof options.batchSize === 'number' ? options.batchSize : 10;
    this._flushMs = typeof options.flushMs === 'number' ? options.flushMs : 5000;
    this._frame = options.frame || null;

    if (typeof window !== 'undefined') {
      const onErr = (msg, src, line, col, err) => {
        this._capture('window.error', String(err && err.message || msg), { src, line, col, stack: err && err.stack });
      };
      const onRej = (ev) => {
        const r = ev && ev.reason;
        this._capture('unhandledrejection', String(r && r.message || r), { stack: r && r.stack });
      };
      window.addEventListener('error', onErr);
      window.addEventListener('unhandledrejection', onRej);
      this._winHandlers = { onErr, onRej };
    }
    if (this._frame && typeof this._frame.on === 'function') {
      this._frameHandler = (data) => {
        this._capture('frameworkError', data && data.message, { type: data && data.type, context: data && data.context, stack: data && data.error && data.error.stack });
      };
      this._frame.on('frameworkError', this._frameHandler);
    }
    this._inited = true;
    return this;
  },

  _capture(type, message, context) {
    this._batch.push({ type, message, context: context || null, timestamp: Date.now() });
    if (this._batch.length >= this._batchSize) { this.flush(); return; }
    if (!this._timer) {
      const self = this;
      this._timer = setTimeout(() => self.flush(), this._flushMs);
    }
  },

  report(error) {
    if (error instanceof Error) {
      this._capture('report', error.message, { stack: error.stack });
    } else {
      this._capture(error && error.type || 'report', error && error.message || String(error), error && error.context);
    }
  },

  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (!this._endpoint || this._batch.length === 0 || !this._fetchImpl) return;
    const payload = { events: this._batch.slice() };
    this._batch = [];
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof this._token === 'function' ? this._token() : this._token;
    if (token) headers['Authorization'] = 'Bearer ' + token;
    Promise.resolve(this._fetchImpl(this._endpoint, { method: 'POST', headers, body: JSON.stringify(payload) }))
      .catch((err) => { if (this._onError) this._onError(err); });
  },

  destroy() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._winHandlers && typeof window !== 'undefined') {
      window.removeEventListener('error', this._winHandlers.onErr);
      window.removeEventListener('unhandledrejection', this._winHandlers.onRej);
      this._winHandlers = null;
    }
    if (this._frame && this._frameHandler) {
      if (typeof this._frame.off === 'function') this._frame.off('frameworkError', this._frameHandler);
      this._frameHandler = null;
    }
    this.flush();
    this._frame = null;
    this._inited = false;
  }
};
