/**
 * Orchestrates metrics collection, rule evaluation, and code evolution for the card framework.
 * @module evolution/EvolutionEngine
 */
import { MetricsCollector } from './MetricsCollector.js';
import { RuleEngine } from './RuleEngine.js';
import { VERSION } from '../utils/constants.js';

export class EvolutionEngine {
  constructor(frame, options, eventBus) {
    this.frame = frame;
    this._eventBus = eventBus;
    options = options || {};
    this.metricsCollector = new MetricsCollector(frame, eventBus);
    this.ruleEngine = new RuleEngine(eventBus);
    this.agentEndpoint = options.agentEndpoint || 'http://localhost:9100';
    this.wsConnection = null;
    this.evolutionHistory = this._loadHistory();
    this.capabilities = { llm: false, heuristic: true };
    this.config = {
      metricsInterval: 5000,
      ruleCheckInterval: 30000,
      agentSyncInterval: 60000,
      autoEvolve: true
    };
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        this.config[key] = options[key];
      }
    }
    this._timers = {};
  }

  start() {
    this.metricsCollector.start();
    this._startRuleCheck();
    this._connectAgent();
    this._startAgentSync();
  }

  stop() {
    this.metricsCollector.stop();
    if (this._timers.ruleCheck) { clearInterval(this._timers.ruleCheck); this._timers.ruleCheck = undefined; }
    if (this._timers.agentSync) { clearInterval(this._timers.agentSync); this._timers.agentSync = undefined; }
    if (this.wsConnection) { this.wsConnection.close(); this.wsConnection = null; }
  }

  _startAgentSync() {
    var interval = this.config.agentSyncInterval;
    if (!interval || typeof interval !== 'number') return;
    var self = this;
    this._timers.agentSync = setInterval(function() {
      var metrics = self.metricsCollector.getSnapshot();
      self._sendMetrics(metrics);
    }, interval);
  }

  _sendMetrics(metrics) {
    try {
      if (typeof XMLHttpRequest !== 'undefined') {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.agentEndpoint + '/api/metrics');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ metrics: metrics }));
      }
      if (this.wsConnection && this.wsConnection.readyState === 1) {
        this.wsConnection.send(JSON.stringify({ type: 'metrics-report', data: metrics }));
      }
    } catch (e) { /* agent unreachable — ignore */ }
  }

  _startRuleCheck() {
    this._timers.ruleCheck = setInterval(() => {
      const metrics = this.metricsCollector.getSnapshot();
      const actions = this.ruleEngine.evaluate(metrics);
      for (let i = 0; i < actions.length; i++) {
        this._executeAction(actions[i]);
      }
    }, this.config.ruleCheckInterval);
  }

  _executeAction(ruleResult) {
    switch (ruleResult.action.type) {
      case 'param-tune':
        this._applyParamTune(ruleResult);
        break;
      case 'code-evolve':
        this._requestCodeEvolution(ruleResult);
        break;
    }
  }

  _applyParamTune(ruleResult) {
    const action = ruleResult.action;
    const targets = {
      cardPool: this.frame.cardObjectPool,
      layoutCache: this.frame.layoutEngine._layoutCache,
      renderer: this.frame.renderer,
      virtualScroller: this.frame.virtualScroller
    };
    const obj = targets[action.target];
    if (obj && obj[action.param] !== undefined) {
      const oldValue = obj[action.param];
      obj[action.param] = action.value;
      this._recordEvolution({
        type: 'param-tune',
        target: action.target,
        param: action.param,
        oldValue: oldValue,
        newValue: action.value,
        reason: action.reason,
        ruleId: ruleResult.ruleId,
        timestamp: Date.now()
      });
    }
  }

  _requestCodeEvolution(ruleResult) {
    const metrics = this.metricsCollector.getSnapshot();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', this.agentEndpoint + '/api/evolve');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
           const result = JSON.parse(xhr.responseText);
           if (result.success) {
             if (result.capabilities) { this.capabilities = result.capabilities; }
             this._recordEvolution({
               type: 'code-evolve',
               sessionId: result.sessionId,
               commit: result.commit,
               method: result.method,
               ruleId: ruleResult.ruleId,
               timestamp: Date.now()
             });
            if (result.configPatch) {
              this._applyConfigPatch(result.configPatch);
            }
          }
        } catch (e) {
          this._eventBus.emit('evolution:request-error', { error: e.message });
        }
      }
    };
    xhr.onerror = () => {
      this._eventBus.emit('evolution:request-error', { error: 'Agent unreachable' });
    };
    xhr.send(JSON.stringify({
      action: ruleResult.action,
      metrics: metrics,
      frameVersion: VERSION
    }));
  }

  _connectAgent() {
    const wsUrl = this.agentEndpoint.replace('http', 'ws').replace('https', 'wss') + '/ws';
    try {
      this.wsConnection = new WebSocket(wsUrl);
      this.wsConnection.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'evolution-result') {
            this._handleEvolutionResult(msg.payload);
          }
        } catch { /* ignore parse errors */ }
      };
      this.wsConnection.onclose = () => {
        this.wsConnection = null;
      };
    } catch {
      this.wsConnection = null;
    }
  }

  _handleEvolutionResult(result) {
    if (result && result.configPatch) {
      this._applyConfigPatch(result.configPatch);
    }
  }

  _applyConfigPatch(patch) {
    const frame = this.frame;
    for (const key in patch) {
      if (patch.hasOwnProperty(key)) {
        const parts = key.split('.');
        let obj = frame;
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]]) {
            obj = obj[parts[i]];
          } else {
            obj = null;
            break;
          }
        }
        if (obj && parts[parts.length - 1] in obj) {
          obj[parts[parts.length - 1]] = patch[key];
        }
      }
    }
  }

  getEvolutionHistory() {
    return this.evolutionHistory.slice();
  }

  getMetrics() {
    return this.metricsCollector.getSnapshot();
  }

  _recordEvolution(record) {
    this.evolutionHistory.push(record);
    if (this.evolutionHistory.length > 1000) {
      this.evolutionHistory.shift();
    }
    this._saveHistory();
    this._eventBus.emit('evolution:occurred', record);
  }

  _historyKey() { return 'cardframe.evolution.history'; }

  _loadHistory() {
    try {
      if (typeof globalThis === 'undefined' || !globalThis.localStorage) return [];
      var raw = globalThis.localStorage.getItem(this._historyKey());
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(-1000) : [];
    } catch (_e) { return []; }
  }

  _saveHistory() {
    try {
      if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
      globalThis.localStorage.setItem(this._historyKey(), JSON.stringify(this.evolutionHistory.slice(-1000)));
    } catch (_e) { /* storage unavailable — keep in-memory only */ }
  }
}
