# Task 3: 框架端 — EvolutionEngine 类

**Files:**
- Modify: `src/card-framework.js`（在 RuleEngine 类后插入 EvolutionEngine）

**Interfaces:**
- Consumes: `MetricsCollector`, `RuleEngine`, `CardFrame`, `eventBus`
- Produces: `class EvolutionEngine` 挂到 `CardFrame.EvolutionEngine`

## 插入位置

RuleEngine 类在第 5677-5788 行，CardFrame 类在第 5789 行开始。
在第 5788 行 RuleEngine 的结束 `}` 后、第 5789 行 `class CardFrame {` 前插入。

## 插入代码

```javascript

  class EvolutionEngine {
    constructor(frame, options) {
      this.frame = frame;
      options = options || {};
      this.metricsCollector = new MetricsCollector(frame);
      this.ruleEngine = new RuleEngine();
      this.agentEndpoint = options.agentEndpoint || 'http://localhost:9100';
      this.wsConnection = null;
      this.evolutionHistory = [];
      this.config = {
        metricsInterval: 5000,
        ruleCheckInterval: 30000,
        agentSyncInterval: 60000,
        autoEvolve: true
      };
      for (var key in options) {
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
    }

    stop() {
      this.metricsCollector.stop();
      if (this._timers.ruleCheck) clearInterval(this._timers.ruleCheck);
      if (this._timers.agentSync) clearInterval(this._timers.agentSync);
      if (this.wsConnection) { this.wsConnection.close(); this.wsConnection = null; }
    }

    _startRuleCheck() {
      var self = this;
      this._timers.ruleCheck = setInterval(function() {
        var metrics = self.metricsCollector.getSnapshot();
        var actions = self.ruleEngine.evaluate(metrics);
        for (var i = 0; i < actions.length; i++) {
          self._executeAction(actions[i]);
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
      var action = ruleResult.action;
      var targets = {
        cardPool: this.frame.cardObjectPool,
        layoutCache: this.frame.layoutEngine.layoutCache,
        renderer: this.frame.renderer,
        virtualScroller: this.frame.virtualScroller
      };
      var obj = targets[action.target];
      if (obj && obj[action.param] !== undefined) {
        var oldValue = obj[action.param];
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
      var self = this;
      var metrics = this.metricsCollector.getSnapshot();
      var xhr = new XMLHttpRequest();
      xhr.open('POST', this.agentEndpoint + '/api/evolve');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var result = JSON.parse(xhr.responseText);
            if (result.success) {
              self._recordEvolution({
                type: 'code-evolve',
                sessionId: result.sessionId,
                commit: result.commit,
                ruleId: ruleResult.ruleId,
                timestamp: Date.now()
              });
              if (result.configPatch) {
                self._applyConfigPatch(result.configPatch);
              }
            }
          } catch (e) {
            eventBus.emit('evolution:request-error', { error: e.message });
          }
        }
      };
      xhr.onerror = function() {
        eventBus.emit('evolution:request-error', { error: 'Agent unreachable' });
      };
      xhr.send(JSON.stringify({
        action: ruleResult.action,
        metrics: metrics,
        frameVersion: CardFrame.version || '1.0.0'
      }));
    }

    _connectAgent() {
      var self = this;
      var wsUrl = this.agentEndpoint.replace('http', 'ws').replace('https', 'wss') + '/ws';
      try {
        this.wsConnection = new WebSocket(wsUrl);
        this.wsConnection.onmessage = function(event) {
          try {
            var msg = JSON.parse(event.data);
            if (msg.type === 'evolution-result') {
              self._handleEvolutionResult(msg.payload);
            }
          } catch (e) { /* ignore parse errors */ }
        };
        this.wsConnection.onclose = function() {
          self.wsConnection = null;
        };
      } catch (e) {
        this.wsConnection = null;
      }
    }

    _handleEvolutionResult(result) {
      if (result && result.configPatch) {
        this._applyConfigPatch(result.configPatch);
      }
    }

    _applyConfigPatch(patch) {
      var frame = this.frame;
      for (var key in patch) {
        if (patch.hasOwnProperty(key)) {
          var parts = key.split('.');
          var obj = frame;
          for (var i = 0; i < parts.length - 1; i++) {
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
      eventBus.emit('evolution:occurred', record);
    }
  }
```

## 步骤

- [ ] Step 1: 在第 5788-5789 行间插入 EvolutionEngine 类
- [ ] Step 2: 在文件末尾添加 `CardFrame.EvolutionEngine = EvolutionEngine;` 静态挂载
- [ ] Step 3: 运行 `cd d:\work\solo work\card-framework; npm test` 验证 516 passing, 0 failing
- [ ] Step 4: `git add src/card-framework.js && git commit -m "feat: add EvolutionEngine class coordinating self-evolution"`