var path = require('path');
var fs = require('fs');
var VersionManager = require('./version-manager');
var TestRunner = require('./test-runner');
var RollbackManager = require('./rollback-manager');

function EvolutionOrchestrator(config) {
  this.config = config || {};
  this.versionManager = new VersionManager(config);
  this.testRunner = new TestRunner(config);
  this.rollbackManager = new RollbackManager(config);
  this._projectRoot = path.resolve(__dirname, '..', this.config.projectRoot || '..');
  this._latestMetrics = null;
  this._llmAvailable = !!(this.config.llmEndpoint && this.config.llmApiKeyEnv &&
    process.env[this.config.llmApiKeyEnv]);
}

EvolutionOrchestrator.prototype.recordMetrics = function(metrics) {
  this._latestMetrics = metrics || {};
};

EvolutionOrchestrator.prototype.getCapabilities = function() {
  return {
    llm: this._llmAvailable,
    heuristic: true,
    mode: this._llmAvailable ? 'llm' : 'heuristic',
    dryRun: !!this.config.dryRun,
    requireReview: this.config.requireReview !== false,
    allowedWritePaths: this.config.allowedWritePaths || [],
    bind: this.config.bind || '127.0.0.1',
    authRequired: true
  };
};

EvolutionOrchestrator.prototype._resolveWritePath = function(relPath) {
  var normalized = path.normalize(relPath).replace(/\\/g, '/');
  if (normalized.indexOf('..') !== -1 || path.isAbsolute(normalized)) return null;
  var allowed = this.config.allowedWritePaths || [];
  if (allowed.indexOf(normalized) === -1) return null;
  return path.resolve(this._projectRoot, normalized);
};

EvolutionOrchestrator.prototype._applyStructuredChanges = function(changes) {
  var errors = [];
  var applied = [];
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var abs = this._resolveWritePath(change.file);
    if (!abs) {
      errors.push({ file: change.file, error: 'write path not allowed' });
      continue;
    }
    if (!fs.existsSync(abs)) {
      errors.push({ file: change.file, error: 'file does not exist' });
      continue;
    }
    var content = fs.readFileSync(abs, 'utf-8');
    var find = change.find;
    var occurrences = content.split(find).length - 1;
    if (occurrences === 0) {
      errors.push({ file: change.file, error: 'find string not found' });
      continue;
    }
    if (occurrences > 1) {
      errors.push({ file: change.file, error: 'find string ambiguous (' + occurrences + ' matches)' });
      continue;
    }
    var original = content;
    fs.writeFileSync(abs, content.replace(find, change.replace), 'utf-8');
    applied.push({ file: change.file, find: find, replace: change.replace, original: original });
  }
  return { errors: errors, applied: applied };
};

EvolutionOrchestrator.prototype._revertChanges = function(applied) {
  for (var i = 0; i < (applied || []).length; i++) {
    var entry = applied[i];
    var abs = this._resolveWritePath(entry.file);
    if (!abs) continue;
    try { fs.writeFileSync(abs, entry.original, 'utf-8'); } catch (e) { /* ignore */ }
  }
};

EvolutionOrchestrator.prototype._heuristicPatches = function(action) {
  var cardFramePath = 'src/core/CardFrame.js';
  if (this._resolveWritePath(cardFramePath) === null) return [];
  var abs = this._resolveWritePath(cardFramePath);
  var content = fs.readFileSync(abs, 'utf-8');
  var patches = [];

  if (action && action.target === 'cardPool') {
    var find = 'new CardObjectPool(options.cardPool || {})';
    if (content.indexOf(find) !== -1) {
      patches.push({
        file: cardFramePath,
        find: find,
        replace: 'new CardObjectPool(Object.assign({ maxPerType: ' + action.value + ' }, options.cardPool || {}))'
      });
    }
  }
  return patches;
};

EvolutionOrchestrator.prototype._callLlm = function(metrics, action) {
  if (!this._llmAvailable) return null;
  var endpoint = this.config.llmEndpoint;
  var apiKey = process.env[this.config.llmApiKeyEnv];
  var model = this.config.llmModel || 'claude-sonnet-4-6';
  var system = [
    'You optimize a zero-dependency card UI framework.',
    'You may ONLY propose edits to files in the allowlist.',
    'Use the apply_patch tool. Each patch: {file, find, replace} where find is an EXACT literal substring in the file (must occur exactly once) and replace is the new literal text.',
    'Never invent file paths. If unsure, return no patches.',
    'Current allowlist: ' + JSON.stringify(this.config.allowedWritePaths || [])
  ].join(' ');

  var tools = [{
    name: 'apply_patch',
    description: 'Propose one exact-substring replacement in an allowlisted source file.',
    input_schema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' }
      },
      required: ['file', 'find', 'replace']
    }
  }];

  var body = {
    model: model,
    max_tokens: 1024,
    system: system,
    messages: [{ role: 'user', content: JSON.stringify({ action: action, metrics: metrics }) }],
    tools: tools
  };

  try {
    var res = syncFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    var data = JSON.parse(res.data);
    var patches = [];
    (data.content || []).forEach(function(block) {
      if (block.type === 'tool_use' && block.name === 'apply_patch' && block.input) {
        patches.push({
          file: block.input.file,
          find: block.input.find,
          replace: block.input.replace
        });
      }
    });
    return patches;
  } catch (e) {
    return null;
  }
};

function syncFetch(url, opts) {
  var xhr;
  if (typeof XMLHttpRequest !== 'undefined') {
    xhr = new XMLHttpRequest();
    xhr.open(opts.method || 'GET', url, false);
    if (opts.headers) Object.keys(opts.headers).forEach(function(k) { xhr.setRequestHeader(k, opts.headers[k]); });
    xhr.send(opts.body || null);
    return { ok: xhr.status >= 200 && xhr.status < 300, data: xhr.responseText };
  }
  var done = false, result = null;
  fetch(url, opts).then(function(r) {
    return r.text().then(function(t) { result = { ok: r.ok, data: t }; });
  }).catch(function(e) { result = { ok: false, data: String(e) }; }).finally(function() { done = true; });
  var guard = 0;
  while (!done && guard < 1000) { guard++; }
  return result;
}

EvolutionOrchestrator.prototype.evolve = function(request) {
  var self = this;
  request = request || {};
  var sessionId = 'evo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var snapshot = this.rollbackManager.createSnapshot(sessionId);

  var method = (this._llmAvailable && request.useLlm !== false) ? 'llm' : 'heuristic';
  var changes = method === 'llm' ? this._callLlm(this._latestMetrics || request.metrics || {}, request.action) : null;

  if (!changes || changes.length === 0) {
    if (method === 'llm') { changes = this._heuristicPatches(request.action); method = 'heuristic(fallback)'; }
    else { changes = this._heuristicPatches(request.action); }
  }

  if (!changes || changes.length === 0) {
    return Promise.resolve({
      success: true, noop: true, sessionId: sessionId, method: method,
      message: 'no applicable change generated', capabilities: this.getCapabilities()
    });
  }

  var applyResult = this._applyStructuredChanges(changes);
  if (applyResult.errors.length > 0) {
    this._revertChanges(applyResult.applied);
    this.rollbackManager.rollback(snapshot);
    return Promise.resolve({
      success: false, sessionId: sessionId, method: method,
      error: 'patch application failed', details: applyResult.errors,
      capabilities: this.getCapabilities()
    });
  }

  return this.testRunner.run().then(function(testResult) {
    if (testResult.passed) {
      if (self.config.dryRun) {
        self._revertChanges(applyResult.applied);
        self.rollbackManager.rollback(snapshot);
        return {
          success: true, dryRun: true, sessionId: sessionId, method: method,
          changes: changes, capabilities: self.getCapabilities()
        };
      }
      var commit = self.versionManager.commit({
        message: 'evolution: ' + (request.action && request.action.reason || 'auto-optimization'),
        sessionId: sessionId,
        changes: changes,
        metrics: self._latestMetrics || request.metrics || {}
      });
      return { success: true, commit: commit, sessionId: sessionId, method: method, changes: changes, capabilities: self.getCapabilities() };
    }
    self._revertChanges(applyResult.applied);
    self.rollbackManager.rollback(snapshot);
    return {
      success: false, sessionId: sessionId, method: method,
      error: 'Tests failed after evolution', testResult: testResult,
      capabilities: self.getCapabilities()
    };
  });
};

module.exports = EvolutionOrchestrator;
