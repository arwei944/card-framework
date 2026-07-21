> **ARCHIVED / 非当前**：本文档为历史材料，结论与行号可能已失效。现行事实见 `docs/architecture-overview.md` 与 `src/`。索引：`docs/archive/README.md`。

> 📜 **历史规划/评估记录（Phase 4 之前）**
> 本文件是重构时期的规划/评估报告，描述的目标已在当前 ES Module + esbuild + jsdom 代码中实现。
> 其中的代码行号、旧架构论断（单体/正则/mock）**已不适用**。当前事实以 `docs/architecture-overview.md` 与源码为准。
# 架构自进化系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CardFrame 框架实现全栈自进化系统，使框架在性能、交互、架构三个层面自动感知和进化

**Architecture:** 浏览器端（EvolutionEngine + MetricsCollector + RuleEngine 嵌入 card-framework.js）处理实时参数调优；Node.js Agent（evolution-agent/ 目录 5 个模块）通过 HTTP/WS 与框架通信，处理 AI 代码生成和 Git 版本管理

**Tech Stack:** 浏览器端 ES5 IIFE（保持 card-framework.js 风格），Agent 端 Node.js + http 模块 + ws 库

## Global Constraints

- 框架端代码遵循 IIFE 模式，无 ES module，不使用 class 外的 ES6+ 语法
- 不引入任何新 npm 依赖到 card-framework（Agent 端可以引入 ws）
- 不破坏现有 516 个测试用例
- 不引入 console.log 到生产代码
- 所有新增代码保持现有 CRLF 行尾风格
- Agent 端使用 CommonJS（require/module.exports）

---

## 文件结构

### 框架端（修改）

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/card-framework.js` | 修改 | 在第 5538 行后插入 EvolutionEngine、MetricsCollector、RuleEngine 三个类；在 CardFrame 构造函数中添加集成代码；在 CardFrame 原型上添加公开 API；在 CardFrame 静态属性中暴露新类 |

### Agent 端（新建）

| 文件 | 说明 |
|------|------|
| `evolution-agent/package.json` | 依赖：ws、dotenv |
| `evolution-agent/src/index.js` | HTTP + WebSocket 服务器入口 |
| `evolution-agent/src/evolution-orchestrator.js` | 进化编排器 |
| `evolution-agent/src/version-manager.js` | Git 版本管理 |
| `evolution-agent/src/test-runner.js` | 测试执行器 |
| `evolution-agent/src/rollback-manager.js` | 回滚管理器 |
| `evolution-agent/src/config.json` | Agent 配置 |

### 测试文件（新建）

| 文件 | 说明 |
|------|------|
| `tests/evolution-tests.js` | 框架端自进化系统单元测试（145 个新测试） |

---

### Task 1: 框架端 — MetricsCollector 类

**Files:**
- Modify: `src/card-framework.js:5538`（在 VirtualScroller 类结束和 CardFrame 类开始之间插入）

**Interfaces:**
- Consumes: `frame.store`, `frame.renderer`, `frame.cardObjectPool`, `frame.layoutEngine`, `frame.typeRegistry`, `frame.pluginManager`, `frame.eventBus`, `EVENT_TYPES`
- Produces: `class MetricsCollector` 挂到 `CardFrame.MetricsCollector`

- [ ] **Step 1: 在 card-framework.js 第 5538 行后插入 MetricsCollector 类定义**

插入位置：第 5538 行 `}`（VirtualScroller 结束）之后、第 5540 行 `class CardFrame {` 之前。

插入代码：

```javascript

  class MetricsCollector {
    constructor(frame) {
      this.frame = frame;
      this.samples = {
        performance: [],
        interaction: [],
        architecture: []
      };
      this._timers = {};
      this._eventHandlers = {};
      this._maxSamples = 288;
    }

    start() {
      this._timers.perf = setInterval(() => this._collectPerformance(), 5000);
      this._timers.arch = setInterval(() => this._collectArchitecture(), 3600000);
      this._attachInteractionListeners();
    }

    stop() {
      Object.values(this._timers).forEach(clearInterval);
      this._detachInteractionListeners();
    }

    _collectPerformance() {
      var sample = {
        timestamp: Date.now(),
        renderTime: this.frame.renderer._lastRenderTime || 0,
        cardCount: this.frame.store.cards.size,
        poolStats: this.frame.cardObjectPool ? this.frame.cardObjectPool.getStats() : {},
        cacheStats: this.frame.layoutEngine && this.frame.layoutEngine.layoutCache ? this.frame.layoutEngine.layoutCache.getStats() : {},
        memoryMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0
      };
      this._pushSample('performance', sample);
    }

    _attachInteractionListeners() {
      var self = this;
      this._eventHandlers.cardAdded = function(card) { self._recordInteraction('card-add', card.type); };
      this._eventHandlers.cardUpdated = function(card) { self._recordInteraction('card-update', card.type); };
      eventBus.on(EVENT_TYPES.CARD_ADDED, this._eventHandlers.cardAdded);
      eventBus.on(EVENT_TYPES.CARD_UPDATED, this._eventHandlers.cardUpdated);
    }

    _collectArchitecture() {
      var types = this.frame.typeRegistry._types;
      var maxDepth = 0;
      types.forEach(function(t) {
        if (t.extends) {
          var depth = 0;
          var current = t;
          while (current.extends) {
            depth++;
            current = types.get(current.extends);
            if (!current) break;
          }
          maxDepth = Math.max(maxDepth, depth);
        }
      });
      var sample = {
        timestamp: Date.now(),
        typeCount: types.size,
        maxInheritanceDepth: maxDepth,
        pluginCount: this.frame.pluginManager._plugins ? this.frame.pluginManager._plugins.size : 0,
        listenerCount: this.frame.renderer._trackedListeners ? this.frame.renderer._trackedListeners.size : 0
      };
      this._pushSample('architecture', sample);
    }

    getSnapshot() {
      var perf = this.samples.performance;
      var last5 = perf.slice(-12);
      return {
        performance: {
          avgRenderTime: this._avg(last5, 'renderTime'),
          currentCardCount: perf.length ? perf[perf.length - 1].cardCount : 0,
          poolHitRate: this._last(last5, 'poolStats') ? (this._last(last5, 'poolStats').hitRate || 0) : 0,
          cacheHitRate: this._last(last5, 'cacheStats') ? (this._last(last5, 'cacheStats').hitRate || 0) : 0,
          memoryMB: this._last(last5, 'memoryMB') || 0
        },
        interaction: this._aggregateInteractions(),
        architecture: this.samples.architecture.slice(-1)[0] || {}
      };
    }

    _pushSample(category, sample) {
      this.samples[category].push(sample);
      if (this.samples[category].length > this._maxSamples) {
        this.samples[category].shift();
      }
    }

    _avg(arr, key) {
      if (!arr.length) return 0;
      var sum = 0;
      for (var i = 0; i < arr.length; i++) { sum += (arr[i][key] || 0); }
      return sum / arr.length;
    }

    _last(arr, key) {
      if (!arr.length) return null;
      return arr[arr.length - 1][key];
    }

    _recordInteraction(action, type) {
      var sample = { timestamp: Date.now(), action: action, type: type };
      this._pushSample('interaction', sample);
    }

    _aggregateInteractions() {
      var now = Date.now();
      var recent = [];
      for (var i = 0; i < this.samples.interaction.length; i++) {
        if (now - this.samples.interaction[i].timestamp < 300000) {
          recent.push(this.samples.interaction[i]);
        }
      }
      var byType = {};
      for (var j = 0; j < recent.length; j++) {
        var t = recent[j].type;
        byType[t] = (byType[t] || 0) + 1;
      }
      var topTypes = Object.keys(byType).map(function(type) {
        return { type: type, count: byType[type] };
      }).sort(function(a, b) { return b.count - a.count; }).slice(0, 5);
      return {
        totalActions: recent.length,
        topTypes: topTypes
      };
    }

    _detachInteractionListeners() {
      eventBus.off(EVENT_TYPES.CARD_ADDED, this._eventHandlers.cardAdded);
      eventBus.off(EVENT_TYPES.CARD_UPDATED, this._eventHandlers.cardUpdated);
    }
  }
```

- [ ] **Step 2: 运行测试验证不破坏现有代码**

```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 413 passing (核心) + 103 passing (插件) = 516 passing, 0 failing

- [ ] **Step 3: 提交**

```bash
cd d:\work\solo work\card-framework
git add src/card-framework.js
git commit -m "feat: add MetricsCollector class for self-evolution metrics"
```

---

### Task 2: 框架端 — RuleEngine 类

**Files:**
- Modify: `src/card-framework.js`（在 MetricsCollector 之后插入 RuleEngine）

**Interfaces:**
- Consumes: `eventBus`
- Produces: `class RuleEngine` 挂到 `CardFrame.RuleEngine`

- [ ] **Step 1: 在 MetricsCollector 类后插入 RuleEngine 类定义**

在刚插入的 MetricsCollector 类的 `}` 后、`class CardFrame {` 前插入：

```javascript

  class RuleEngine {
    constructor() {
      this.rules = [
        {
          id: 'pool-expansion',
          category: 'performance',
          condition: function(m) {
            return m.performance.poolHitRate < 0.5 && m.performance.currentCardCount > 50;
          },
          action: { type: 'param-tune', target: 'cardPool', param: '_maxPerType', value: 200,
                    reason: '对象池命中率低于50%，扩容到200' }
        },
        {
          id: 'cache-expansion',
          category: 'performance',
          condition: function(m) {
            return m.performance.cacheHitRate < 0.5;
          },
          action: { type: 'param-tune', target: 'layoutCache', param: '_maxSize', value: 10000,
                    reason: '布局缓存命中率低于50%，扩容到10000' }
        },
        {
          id: 'render-batch-optimize',
          category: 'performance',
          condition: function(m) {
            return m.performance.avgRenderTime > 50;
          },
          action: { type: 'param-tune', target: 'renderer', param: '_batchThreshold', value: 10,
                    reason: '平均渲染耗时>50ms，提高批处理阈值到10' }
        },
        {
          id: 'layout-pref',
          category: 'interaction',
          condition: function(m) {
            return m.interaction.topTypes.length > 0 && m.performance.currentCardCount > 20;
          },
          action: { type: 'code-evolve', category: 'interaction',
                    reason: '卡片数量增多，评估布局策略优化' }
        },
        {
          id: 'type-explosion',
          category: 'architecture',
          condition: function(m) {
            return m.architecture.typeCount > 50;
          },
          action: { type: 'code-evolve', category: 'architecture',
                    reason: '卡片类型超过50种，评估类型系统重构' }
        },
        {
          id: 'inheritance-depth',
          category: 'architecture',
          condition: function(m) {
            return m.architecture.maxInheritanceDepth > 4;
          },
          action: { type: 'code-evolve', category: 'architecture',
                    reason: '继承深度超过4层，评估扁平化' }
        },
        {
          id: 'listener-leak',
          category: 'architecture',
          condition: function(m) {
            return m.architecture.listenerCount > 500;
          },
          action: { type: 'code-evolve', category: 'architecture',
                    reason: '事件监听器超过500个，可能存在泄漏' }
        }
      ];
      this._cooldown = {};
    }

    evaluate(metrics) {
      var actions = [];
      var now = Date.now();
      for (var i = 0; i < this.rules.length; i++) {
        var rule = this.rules[i];
        if (this._inCooldown(rule.id, now)) continue;
        try {
          if (rule.condition(metrics)) {
            actions.push({ action: rule.action, ruleId: rule.id });
            this._setCooldown(rule.id, now);
          }
        } catch (e) {
          eventBus.emit('evolution:rule-error', { ruleId: rule.id, error: e.message });
        }
      }
      return actions;
    }

    _inCooldown(ruleId, now) {
      var last = this._cooldown[ruleId] || 0;
      return now - last < 300000;
    }

    _setCooldown(ruleId, now) {
      this._cooldown[ruleId] = now;
    }

    addRule(rule) {
      this.rules.push(rule);
    }

    removeRule(ruleId) {
      var filtered = [];
      for (var i = 0; i < this.rules.length; i++) {
        if (this.rules[i].id !== ruleId) {
          filtered.push(this.rules[i]);
        }
      }
      this.rules = filtered;
    }
  }
```

- [ ] **Step 2: 运行测试验证不破坏现有代码**

```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 516 passing, 0 failing

- [ ] **Step 3: 提交**

```bash
cd d:\work\solo work\card-framework
git add src/card-framework.js
git commit -m "feat: add RuleEngine class with 7 built-in evolution rules"
```

---

### Task 3: 框架端 — EvolutionEngine 类

**Files:**
- Modify: `src/card-framework.js`（在 RuleEngine 之后插入 EvolutionEngine）

**Interfaces:**
- Consumes: `MetricsCollector`, `RuleEngine`, `CardFrame`, `eventBus`
- Produces: `class EvolutionEngine` 挂到 `CardFrame.EvolutionEngine`

- [ ] **Step 1: 在 RuleEngine 类后插入 EvolutionEngine 类定义**

在刚插入的 RuleEngine 类的 `}` 后、`class CardFrame {` 前插入：

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

- [ ] **Step 2: 运行测试验证不破坏现有代码**

```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 516 passing, 0 failing

- [ ] **Step 3: 提交**

```bash
cd d:\work\solo work\card-framework
git add src/card-framework.js
git commit -m "feat: add EvolutionEngine class coordinating self-evolution"
```

---

### Task 4: 框架端 — CardFrame 构造函数集成

**Files:**
- Modify: `src/card-framework.js:5574-5576`（在构造函数中插入 EvolutionEngine 初始化），`:5610`（在构造函数结束前插入自动验证）
- Modify: `src/card-framework.js:6395-6422`（添加静态属性暴露）

**Interfaces:**
- Consumes: `options.evolution`, `EvolutionEngine` 类
- Produces: `frame.evolutionEngine`, `CardFrame.prototype.getEvolutionHistory`, `CardFrame.prototype.getMetrics`, `CardFrame.prototype.evolveNow`

- [ ] **Step 1: 在 CardFrame 构造函数中初始化 EvolutionEngine**

在第 5576 行 `this.virtualScroller = ...` 之后插入：

```javascript

      this.evolutionEngine = options.evolution !== false
        ? new EvolutionEngine(this, options.evolution || {})
        : null;
      if (this.evolutionEngine) {
        this.evolutionEngine.start();
      }
```

- [ ] **Step 2: 在 CardFrame 原型上添加公开 API**

在 `CardFrame` 类的 `}` 结束之前（即第 6392 行附近），在 `static from` 方法之后、类的 `}` 之前插入：

```javascript

    getEvolutionHistory() {
      return this.evolutionEngine ? this.evolutionEngine.getEvolutionHistory() : [];
    }

    getMetricsSnapshot() {
      return this.evolutionEngine ? this.evolutionEngine.getMetrics() : null;
    }

    evolveNow() {
      if (this.evolutionEngine) {
        var metrics = this.evolutionEngine.metricsCollector.getSnapshot();
        var actions = this.evolutionEngine.ruleEngine.evaluate(metrics);
        for (var i = 0; i < actions.length; i++) {
          this.evolutionEngine._executeAction(actions[i]);
        }
      }
    }
```

- [ ] **Step 3: 在 CardFrame 静态属性中添加新类**

在第 6421 行附近，在 `CardFrame.ShadowCardRegistry = ShadowCardRegistry;` 之后添加：

```javascript

  CardFrame.EvolutionEngine = EvolutionEngine;
  CardFrame.MetricsCollector = MetricsCollector;
  CardFrame.RuleEngine = RuleEngine;
```

- [ ] **Step 4: 运行测试验证不破坏现有代码**

```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 516 passing, 0 failing

- [ ] **Step 5: 提交**

```bash
cd d:\work\solo work\card-framework
git add src/card-framework.js
git commit -m "feat: integrate EvolutionEngine into CardFrame constructor and public API"
```

---

### Task 5: 框架端测试文件

**Files:**
- Create: `tests/evolution-tests.js`

- [ ] **Step 1: 创建 evolution-tests.js**

```javascript
/* global describe, it, before, after, beforeEach */
/* global assert */
/* global CardFrame */

describe('CardFrame Self-Evolution - EvolutionEngine', function() {
  var container, frame;

  before(function() {
    container = document.createElement('div');
    container.id = 'evolution-test-container';
    document.body.appendChild(container);
  });

  after(function() {
    if (frame) { frame.evolutionEngine && frame.evolutionEngine.stop(); }
    document.body.removeChild(container);
  });

  beforeEach(function() {
    if (frame) { frame.evolutionEngine && frame.evolutionEngine.stop(); }
    container.innerHTML = '';
    frame = new CardFrame(container, { evolution: { ruleCheckInterval: 10000 } });
  });

  it('evolutionEngine 应该存在', function() {
    assert.notStrictEqual(frame.evolutionEngine, undefined);
    assert.notStrictEqual(frame.evolutionEngine, null);
  });

  it('evolutionEngine 应该有 metricsCollector', function() {
    assert.notStrictEqual(frame.evolutionEngine.metricsCollector, undefined);
  });

  it('evolutionEngine 应该有 ruleEngine', function() {
    assert.notStrictEqual(frame.evolutionEngine.ruleEngine, undefined);
  });

  it('evolutionEngine start() 应该启动定时器', function() {
    frame.evolutionEngine.stop();
    assert.strictEqual(frame.evolutionEngine._timers.ruleCheck, undefined);
    frame.evolutionEngine.start();
    assert.notStrictEqual(frame.evolutionEngine._timers.ruleCheck, undefined);
    frame.evolutionEngine.stop();
  });

  it('evolutionEngine stop() 应该清除定时器', function() {
    frame.evolutionEngine.start();
    assert.notStrictEqual(frame.evolutionEngine._timers.ruleCheck, undefined);
    frame.evolutionEngine.stop();
    assert.strictEqual(frame.evolutionEngine._timers.ruleCheck, undefined);
  });

  it('getEvolutionHistory() 应该返回数组', function() {
    var history = frame.getEvolutionHistory();
    assert.strictEqual(Array.isArray(history), true);
  });

  it('getMetricsSnapshot() 应该返回指标对象', function() {
    var metrics = frame.getMetricsSnapshot();
    assert.notStrictEqual(metrics, null);
    assert.notStrictEqual(metrics.performance, undefined);
    assert.notStrictEqual(metrics.interaction, undefined);
    assert.notStrictEqual(metrics.architecture, undefined);
  });

  it('evolveNow() 应该不抛异常', function() {
    frame.evolveNow();
  });

  it('CardFrame.EvolutionEngine 应该是类', function() {
    assert.strictEqual(typeof CardFrame.EvolutionEngine, 'function');
  });

  it('CardFrame.MetricsCollector 应该是类', function() {
    assert.strictEqual(typeof CardFrame.MetricsCollector, 'function');
  });

  it('CardFrame.RuleEngine 应该是类', function() {
    assert.strictEqual(typeof CardFrame.RuleEngine, 'function');
  });

  it('关闭 evolution (options.evolution=false) 时 evolutionEngine 应为 null', function() {
    var f = new CardFrame(document.createElement('div'), { evolution: false });
    assert.strictEqual(f.evolutionEngine, null);
  });
});

describe('CardFrame Self-Evolution - MetricsCollector', function() {
  var container, frame;

  before(function() {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  after(function() {
    if (frame) { frame.evolutionEngine && frame.evolutionEngine.stop(); }
    document.body.removeChild(container);
  });

  beforeEach(function() {
    if (frame) { frame.evolutionEngine && frame.evolutionEngine.stop(); }
    container.innerHTML = '';
    frame = new CardFrame(container, { evolution: true });
  });

  it('metricsCollector.start() 应该启动性能采集', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    mc.stop();
    assert.strictEqual(mc._timers.perf, undefined);
    mc.start();
    assert.notStrictEqual(mc._timers.perf, undefined);
    mc.stop();
  });

  it('metricsCollector.stop() 应该停止所有定时器', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    mc.start();
    assert.notStrictEqual(mc._timers.perf, undefined);
    mc.stop();
    assert.strictEqual(mc._timers.perf, undefined);
  });

  it('getSnapshot() 应该返回 performance 指标', function() {
    var snap = frame.evolutionEngine.metricsCollector.getSnapshot();
    assert.notStrictEqual(snap.performance.avgRenderTime, undefined);
    assert.notStrictEqual(snap.performance.currentCardCount, undefined);
  });

  it('getSnapshot() 应该返回 interaction 指标', function() {
    var snap = frame.evolutionEngine.metricsCollector.getSnapshot();
    assert.notStrictEqual(snap.interaction.totalActions, undefined);
    assert.strictEqual(Array.isArray(snap.interaction.topTypes), true);
  });

  it('getSnapshot() 应该返回 architecture 指标', function() {
    var snap = frame.evolutionEngine.metricsCollector.getSnapshot();
    assert.notStrictEqual(snap.architecture.typeCount, undefined);
  });

  it('_recordInteraction 应该增加 interaction 采样', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    var before = mc.samples.interaction.length;
    mc._recordInteraction('test', 'test-type');
    assert.strictEqual(mc.samples.interaction.length, before + 1);
  });

  it('_pushSample 不应该超过 _maxSamples', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    mc._maxSamples = 5;
    for (var i = 0; i < 10; i++) {
      mc._pushSample('performance', { index: i });
    }
    assert.strictEqual(mc.samples.performance.length, 5);
    assert.strictEqual(mc.samples.performance[0].index, 5);
  });

  it('_avg 应计算平均值', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    var arr = [{ v: 10 }, { v: 20 }, { v: 30 }];
    assert.strictEqual(mc._avg(arr, 'v'), 20);
  });

  it('_avg 空数组应返回 0', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    assert.strictEqual(mc._avg([], 'v'), 0);
  });

  it('_last 应返回最后一个元素', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    var arr = [{ v: 1 }, { v: 2 }];
    assert.strictEqual(mc._last(arr, 'v'), 2);
  });

  it('_last 空数组应返回 null', function() {
    var mc = frame.evolutionEngine.metricsCollector;
    assert.strictEqual(mc._last([], 'v'), null);
  });
});

describe('CardFrame Self-Evolution - RuleEngine', function() {
  var engine;

  beforeEach(function() {
    engine = new CardFrame.RuleEngine();
  });

  it('evaluate() 应该返回数组', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    assert.strictEqual(Array.isArray(result), true);
  });

  it('池命中率低时应触发 pool-expansion 规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.3, currentCardCount: 60, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'pool-expansion') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('缓存命中率低时应触发 cache-expansion 规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.3, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'cache-expansion') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('渲染耗时高时应触发 render-batch-optimize 规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 60 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'render-batch-optimize') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('类型超过50时应触发 type-explosion 规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 60, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'type-explosion') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('继承深度超过4应触发 inheritance-depth 规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 5, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'inheritance-depth') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('监听器超过500应触发 listener-leak 规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 600, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'listener-leak') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('正常指标不应触发任何规则', function() {
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    assert.strictEqual(result.length, 0);
  });

  it('addRule 应添加新规则', function() {
    engine.addRule({
      id: 'test-rule',
      category: 'test',
      condition: function(m) { return true; },
      action: { type: 'param-tune', target: 'test', param: 'x', value: 1, reason: 'test' }
    });
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'test-rule') { found = true; break; }
    }
    assert.strictEqual(found, true);
  });

  it('removeRule 应移除规则', function() {
    engine.removeRule('layout-pref');
    var result = engine.evaluate({
      performance: { poolHitRate: 0.8, currentCardCount: 30, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [{ type: 'test', count: 1 }] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'layout-pref') { found = true; break; }
    }
    assert.strictEqual(found, false);
  });

  it('同一条规则5分钟内不应重复触发', function() {
    engine._inCooldown = function(ruleId, now) { return true; };
    var result = engine.evaluate({
      performance: { poolHitRate: 0.3, currentCardCount: 60, cacheHitRate: 0.8, avgRenderTime: 20 },
      interaction: { totalActions: 5, topTypes: [] },
      architecture: { typeCount: 10, maxInheritanceDepth: 2, listenerCount: 50, pluginCount: 3 }
    });
    var found = false;
    for (var i = 0; i < result.length; i++) {
      if (result[i].ruleId === 'pool-expansion') { found = true; break; }
    }
    assert.strictEqual(found, false);
  });

  it('_inCooldown 冷却期内应返回 true', function() {
    var now = Date.now();
    engine._setCooldown('test-rule', now);
    assert.strictEqual(engine._inCooldown('test-rule', now + 1000), true);
  });

  it('_inCooldown 超过冷却期应返回 false', function() {
    var now = Date.now();
    engine._setCooldown('test-rule', now - 300001);
    assert.strictEqual(engine._inCooldown('test-rule', now), false);
  });
});

describe('CardFrame Self-Evolution - Param Tune', function() {
  var container, frame;

  before(function() {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  after(function() {
    if (frame) { frame.evolutionEngine && frame.evolutionEngine.stop(); }
    document.body.removeChild(container);
  });

  beforeEach(function() {
    if (frame) { frame.evolutionEngine && frame.evolutionEngine.stop(); }
    container.innerHTML = '';
    frame = new CardFrame(container, { evolution: { ruleCheckInterval: 100000 } });
  });

  it('_applyParamTune 应修改对象池 _maxPerType', function() {
    var engine = frame.evolutionEngine;
    var oldValue = frame.cardObjectPool._maxPerType;
    engine._applyParamTune({
      action: { type: 'param-tune', target: 'cardPool', param: '_maxPerType', value: 999, reason: 'test' },
      ruleId: 'test'
    });
    assert.strictEqual(frame.cardObjectPool._maxPerType, 999);
    frame.cardObjectPool._maxPerType = oldValue;
  });

  it('_applyParamTune 应修改布局缓存 _maxSize', function() {
    var engine = frame.evolutionEngine;
    var oldValue = frame.layoutEngine.layoutCache._maxSize;
    engine._applyParamTune({
      action: { type: 'param-tune', target: 'layoutCache', param: '_maxSize', value: 88888, reason: 'test' },
      ruleId: 'test'
    });
    assert.strictEqual(frame.layoutEngine.layoutCache._maxSize, 88888);
    frame.layoutEngine.layoutCache._maxSize = oldValue;
  });

  it('_applyParamTune 应记录进化历史', function() {
    var engine = frame.evolutionEngine;
    var before = engine.evolutionHistory.length;
    engine._applyParamTune({
      action: { type: 'param-tune', target: 'cardPool', param: '_maxPerType', value: 777, reason: 'test' },
      ruleId: 'test-param'
    });
    assert.strictEqual(engine.evolutionHistory.length, before + 1);
    var record = engine.evolutionHistory[before];
    assert.strictEqual(record.type, 'param-tune');
    assert.strictEqual(record.target, 'cardPool');
    assert.strictEqual(record.param, '_maxPerType');
    assert.strictEqual(record.newValue, 777);
  });
});
```

- [ ] **Step 2: 在 test.js 中添加 evolution-tests.js 的引用**

读取 `tests/test.js`，在现有引用列表末尾添加 `'../tests/evolution-tests.js'`。

- [ ] **Step 3: 运行测试验证新测试通过**

```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 413 + 103 + 45 = 561 passing, 0 failing

- [ ] **Step 4: 提交**

```bash
cd d:\work\solo work\card-framework
git add tests/evolution-tests.js tests/test.js
git commit -m "test: add self-evolution system tests (45 test cases)"
```

---

### Task 6: Agent 端 — 目录结构与 package.json

**Files:**
- Create: `evolution-agent/package.json`
- Create: `evolution-agent/src/config.json`

- [ ] **Step 1: 创建 evolution-agent 目录和 package.json**

```bash
mkdir d:\work\solo work\card-framework\evolution-agent\src
```

```json
{
  "name": "cardframe-evolution-agent",
  "version": "1.0.0",
  "description": "CardFrame self-evolution agent - AI code generation, Git version management, test & rollback",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "dotenv": "^16.3.1"
  }
}
```

- [ ] **Step 2: 创建 config.json**

```json
{
  "port": 9100,
  "projectRoot": "..",
  "branch": "main",
  "evolutionBranch": "evolution",
  "llmEndpoint": "https://api.anthropic.com/v1/messages",
  "testTimeout": 120000,
  "maxSnapshots": 20,
  "autoMergeThreshold": 10,
  "npmCommand": "npm"
}
```

- [ ] **Step 3: 提交**

```bash
cd d:\work\solo work\card-framework
git add evolution-agent/
git commit -m "feat: initialize evolution-agent directory structure"
```

---

### Task 7: Agent 端 — TestRunner 模块

**Files:**
- Create: `evolution-agent/src/test-runner.js`

- [ ] **Step 1: 创建 test-runner.js**

```javascript
var exec = require('child_process').exec;
var path = require('path');

function TestRunner(config) {
  this.projectRoot = config.projectRoot || '..';
  this.timeout = config.testTimeout || 120000;
}

TestRunner.prototype.run = function(extraArgs) {
  var self = this;
  var cwd = path.resolve(__dirname, this.projectRoot);
  var cmd = 'npm test' + (extraArgs ? ' ' + extraArgs : '');
  return new Promise(function(resolve) {
    exec(cmd, { cwd: cwd, timeout: self.timeout }, function(error, stdout, stderr) {
      if (error && !stdout.match(/(\d+) failing/)) {
        resolve({
          passed: false,
          error: error.message,
          stdout: stdout.slice(-2000),
          stderr: stderr.slice(-2000)
        });
      } else {
        var passing = 0;
        var failing = 0;
        var pMatch = stdout.match(/(\d+) passing/);
        var fMatch = stdout.match(/(\d+) failing/);
        if (pMatch) passing = parseInt(pMatch[1]);
        if (fMatch) failing = parseInt(fMatch[1]);
        resolve({
          passed: failing === 0,
          passing: passing,
          failing: failing,
          stdout: stdout.slice(-2000)
        });
      }
    });
  });
};

module.exports = TestRunner;
```

- [ ] **Step 2: 提交**

```bash
cd d:\work\solo work\card-framework
git add evolution-agent/src/test-runner.js
git commit -m "feat: add TestRunner module for evolution-agent"
```

---

### Task 8: Agent 端 — VersionManager 模块

**Files:**
- Create: `evolution-agent/src/version-manager.js`

- [ ] **Step 1: 创建 version-manager.js**

```javascript
var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

function VersionManager(config) {
  this.projectRoot = config.projectRoot || '..';
  this.branch = config.branch || 'main';
  this.evolutionBranch = config.evolutionBranch || 'evolution';
  this._cwd = path.resolve(__dirname, this.projectRoot);
}

VersionManager.prototype._git = function(args) {
  return execSync('git ' + args, { cwd: this._cwd, encoding: 'utf-8' }).trim();
};

VersionManager.prototype.ensureEvolutionBranch = function() {
  var branches = this._git('branch --list');
  if (branches.indexOf(this.evolutionBranch) === -1) {
    this._git('checkout -b ' + this.evolutionBranch);
  } else {
    this._git('checkout ' + this.evolutionBranch);
  }
};

VersionManager.prototype.commit = function(evolutionData) {
  var self = this;
  var message = evolutionData.message || 'evolution: automated change';
  var sessionId = evolutionData.sessionId;
  var changes = evolutionData.changes || [];
  var metrics = evolutionData.metrics || {};

  this.ensureEvolutionBranch();

  for (var i = 0; i < changes.length; i++) {
    try {
      this._git('add "' + changes[i].path + '"');
    } catch (e) { /* skip unstaged changes */ }
  }

  var metaDir = path.resolve(this._cwd, '.evolution-meta');
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }
  var metaFile = path.join(metaDir, sessionId + '.json');
  fs.writeFileSync(metaFile, JSON.stringify({
    sessionId: sessionId,
    message: message,
    metrics: metrics,
    changes: changes.map(function(c) { return c.path; }),
    timestamp: Date.now()
  }, null, 2));
  this._git('add ".evolution-meta/' + sessionId + '.json"');

  var commitMsg = message + '\n\nEvolution-Session: ' + sessionId
    + '\nMetrics: ' + JSON.stringify(metrics)
    + '\nChanges: ' + changes.length + ' file(s)';
  this._git('commit -m "' + commitMsg.replace(/"/g, '\\"') + '"');

  var hash = this._git('rev-parse HEAD');
  return { hash: hash, branch: this.evolutionBranch, sessionId: sessionId };
};

VersionManager.prototype.getEvolutionLog = function() {
  try {
    var log = this._git('log ' + this.evolutionBranch + ' --oneline --grep="evolution:"');
    return log.split('\n').filter(function(l) { return l.length > 0; });
  } catch (e) {
    return [];
  }
};

VersionManager.prototype.push = function() {
  this._git('push origin ' + this.evolutionBranch);
};

VersionManager.prototype.mergeToMain = function() {
  this._git('checkout ' + this.branch);
  this._git('merge ' + this.evolutionBranch + ' --no-ff');
  this._git('push origin ' + this.branch);
};

module.exports = VersionManager;
```

- [ ] **Step 2: 提交**

```bash
cd d:\work\solo work\card-framework
git add evolution-agent/src/version-manager.js
git commit -m "feat: add VersionManager module for Git operations"
```

---

### Task 9: Agent 端 — RollbackManager 模块

**Files:**
- Create: `evolution-agent/src/rollback-manager.js`

- [ ] **Step 1: 创建 rollback-manager.js**

```javascript
var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

function RollbackManager(config) {
  this.projectRoot = config.projectRoot || '..';
  this.maxSnapshots = config.maxSnapshots || 20;
  this._cwd = path.resolve(__dirname, this.projectRoot);
  this.snapshotDir = path.resolve(__dirname, 'snapshots');
}

RollbackManager.prototype._git = function(args) {
  return execSync('git ' + args, { cwd: this._cwd, encoding: 'utf-8' }).trim();
};

RollbackManager.prototype.createSnapshot = function(sessionId) {
  var headHash;
  var stashRef;
  try {
    headHash = this._git('rev-parse HEAD');
  } catch (e) {
    headHash = 'no-commits';
  }
  try {
    stashRef = this._git('stash create');
  } catch (e) {
    stashRef = '';
  }

  var snapshot = {
    sessionId: sessionId,
    headHash: headHash,
    stashRef: stashRef,
    timestamp: Date.now(),
    changedFiles: this._getChangedFiles()
  };

  if (!fs.existsSync(this.snapshotDir)) {
    fs.mkdirSync(this.snapshotDir, { recursive: true });
  }
  var metaPath = path.join(this.snapshotDir, sessionId + '.json');
  fs.writeFileSync(metaPath, JSON.stringify(snapshot, null, 2));

  this._cleanupOldSnapshots();
  return snapshot;
};

RollbackManager.prototype.rollback = function(snapshot) {
  if (snapshot.stashRef) {
    try {
      this._git('stash apply ' + snapshot.stashRef);
    } catch (e) { /* ignore stash apply failure */ }
  } else {
    this._git('checkout -- .');
  }
  try {
    this._git('reset --hard ' + snapshot.headHash);
  } catch (e) {
    this._git('checkout --orphan temp-branch');
    this._git('commit -m "rollback to snapshot ' + snapshot.sessionId + '"');
  }
  return { success: true, sessionId: snapshot.sessionId };
};

RollbackManager.prototype.listSnapshots = function() {
  if (!fs.existsSync(this.snapshotDir)) return [];
  var files = fs.readdirSync(this.snapshotDir);
  var snapshots = [];
  for (var i = 0; i < files.length; i++) {
    if (files[i].endsWith('.json')) {
      var content = fs.readFileSync(path.join(this.snapshotDir, files[i]), 'utf-8');
      snapshots.push(JSON.parse(content));
    }
  }
  snapshots.sort(function(a, b) { return b.timestamp - a.timestamp; });
  return snapshots;
};

RollbackManager.prototype.rollbackTo = function(sessionId) {
  var metaPath = path.join(this.snapshotDir, sessionId + '.json');
  if (!fs.existsSync(metaPath)) {
    return { success: false, error: 'Snapshot not found: ' + sessionId };
  }
  var content = fs.readFileSync(metaPath, 'utf-8');
  var snapshot = JSON.parse(content);
  return this.rollback(snapshot);
};

RollbackManager.prototype._getChangedFiles = function() {
  try {
    var result = this._git('diff --name-only HEAD');
    return result ? result.split('\n').filter(function(l) { return l.length > 0; }) : [];
  } catch (e) {
    return [];
  }
};

RollbackManager.prototype._cleanupOldSnapshots = function() {
  if (!fs.existsSync(this.snapshotDir)) return;
  var files = fs.readdirSync(this.snapshotDir);
  var jsonFiles = files.filter(function(f) { return f.endsWith('.json'); });
  if (jsonFiles.length <= this.maxSnapshots) return;

  var sorted = jsonFiles.map(function(f) {
    var stat = fs.statSync(path.join(this.snapshotDir, f));
    return { name: f, mtime: stat.mtime };
  }, this);
  sorted.sort(function(a, b) { return a.mtime - b.mtime; });

  var toDelete = sorted.slice(0, sorted.length - this.maxSnapshots);
  for (var i = 0; i < toDelete.length; i++) {
    try {
      fs.unlinkSync(path.join(this.snapshotDir, toDelete[i].name));
    } catch (e) { /* skip */ }
  }
};

module.exports = RollbackManager;
```

- [ ] **Step 2: 提交**

```bash
cd d:\work\solo work\card-framework
git add evolution-agent/src/rollback-manager.js
git commit -m "feat: add RollbackManager module for snapshot and rollback"
```

---

### Task 10: Agent 端 — EvolutionOrchestrator 模块

**Files:**
- Create: `evolution-agent/src/evolution-orchestrator.js`

- [ ] **Step 1: 创建 evolution-orchestrator.js**

```javascript
var path = require('path');
var fs = require('fs');
var VersionManager = require('./version-manager');
var TestRunner = require('./test-runner');
var RollbackManager = require('./rollback-manager');

function EvolutionOrchestrator(config) {
  this.config = config;
  this.versionManager = new VersionManager(config);
  this.testRunner = new TestRunner(config);
  this.rollbackManager = new RollbackManager(config);
  this._projectRoot = path.resolve(__dirname, config.projectRoot || '..');
}

EvolutionOrchestrator.prototype._generateSessionId = function() {
  return 'evo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
};

EvolutionOrchestrator.prototype._applyChanges = function(changes) {
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var fullPath = path.resolve(this._projectRoot, change.path);
    if (change.type === 'modify' || change.type === 'create') {
      var dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, change.content, 'utf-8');
    } else if (change.type === 'delete') {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) { /* skip if not exists */ }
    }
  }
};

EvolutionOrchestrator.prototype.evolve = function(request) {
  var self = this;
  var action = request.action || {};
  var metrics = request.metrics || {};
  var sessionId = this._generateSessionId();

  var snapshot = this.rollbackManager.createSnapshot(sessionId);

  // Without AI: use config-based evolution fallback
  var changes = this._generateFallbackChanges(action, metrics);

  this._applyChanges(changes);

  return this.testRunner.run().then(function(testResult) {
    if (testResult.passed) {
      var commit = self.versionManager.commit({
        message: 'evolution: ' + (action.reason || 'auto-optimization'),
        sessionId: sessionId,
        changes: changes,
        metrics: metrics
      });
      return { success: true, commit: commit, sessionId: sessionId, changes: changes };
    } else {
      self.rollbackManager.rollback(snapshot);
      return {
        success: false,
        error: 'Tests failed after evolution',
        testResult: testResult,
        sessionId: sessionId
      };
    }
  });
};

EvolutionOrchestrator.prototype._generateFallbackChanges = function(action, metrics) {
  // Configuration-only fallback when AI is not available
  var projectRoot = this._projectRoot;
  var srcPath = path.join(projectRoot, 'src', 'card-framework.js');
  if (!fs.existsSync(srcPath)) return [];

  var content = fs.readFileSync(srcPath, 'utf-8');
  var changes = [];

  if (action.target === 'cardPool' && action.param) {
    content = content.replace(
      new RegExp('(this\\.cardObjectPool = new CardObjectPool\\([^)]*\\))'),
      'this.cardObjectPool = new CardObjectPool({ maxPerType: ' + action.value + ' })'
    );
    changes.push({
      type: 'modify',
      path: 'src/card-framework.js',
      content: content,
      rationale: 'Evolve card pool ' + action.param + ' to ' + action.value
    });
  }

  if (action.target === 'layoutCache' && action.param) {
    content = content.replace(
      new RegExp('(_maxSize: )\\d+'),
      '$1' + action.value
    );
    changes.push({
      type: 'modify',
      path: 'src/card-framework.js',
      content: content,
      rationale: 'Evolve layout cache ' + action.param + ' to ' + action.value
    });
  }

  return changes;
};

module.exports = EvolutionOrchestrator;
```

- [ ] **Step 2: 提交**

```bash
cd d:\work\solo work\card-framework
git add evolution-agent/src/evolution-orchestrator.js
git commit -m "feat: add EvolutionOrchestrator module coordinating evolution flow"
```

---

### Task 11: Agent 端 — HTTP/WebSocket 服务器

**Files:**
- Create: `evolution-agent/src/index.js`

- [ ] **Step 1: 创建 index.js 服务器入口**

```javascript
var http = require('http');
var path = require('path');
var fs = require('fs');
var EvolutionOrchestrator = require('./evolution-orchestrator');

try {
  var configPath = path.resolve(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    var config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    var config = {};
  }
} catch (e) {
  var config = {};
}

config.projectRoot = config.projectRoot || '..';
config.port = config.port || 9100;

var orchestrator = new EvolutionOrchestrator(config);

// Optional WebSocket support
var wss = null;
try {
  var WebSocketServer = require('ws').Server;
} catch (e) {
  // ws module not available, WebSocket disabled
}

var server = http.createServer(function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  var url = req.url;
  var method = req.method;

  if (method === 'POST' && url === '/api/evolve') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var request = JSON.parse(body);
        orchestrator.evolve(request).then(function(result) {
          res.end(JSON.stringify(result));
        }).catch(function(err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON: ' + e.message }));
      }
    });
  } else if (method === 'GET' && url === '/api/history') {
    try {
      var history = orchestrator.versionManager.getEvolutionLog();
      res.end(JSON.stringify({ history: history }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (method === 'GET' && url === '/api/snapshots') {
    try {
      var snapshots = orchestrator.rollbackManager.listSnapshots();
      res.end(JSON.stringify({ snapshots: snapshots }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (method === 'POST' && url === '/api/rollback') {
    var rbBody = '';
    req.on('data', function(chunk) { rbBody += chunk; });
    req.on('end', function() {
      try {
        var rbReq = JSON.parse(rbBody);
        var result = orchestrator.rollbackManager.rollbackTo(rbReq.sessionId);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
  } else if (method === 'GET' && url === '/api/health') {
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// WebSocket setup
if (WebSocketServer) {
  wss = new WebSocketServer({ server: server });
  wss.on('connection', function(ws) {
    ws.on('message', function(data) {
      try {
        var msg = JSON.parse(data);
        if (msg.type === 'metrics-report') {
          ws.send(JSON.stringify({ type: 'metrics-received', timestamp: Date.now() }));
        }
      } catch (e) { /* ignore */ }
    });
  });
}

server.listen(config.port, function() {
  console.log('Evolution Agent server running on port ' + config.port);
  console.log('WebSocket: ' + (wss ? 'enabled' : 'disabled (npm install ws to enable)'));
});
```

- [ ] **Step 2: 运行 Agent 启动测试**

```bash
cd d:\work\solo work\card-framework\evolution-agent
npm install
node src/index.js &
curl http://localhost:9100/api/health
```
Expected: `{"status":"ok","timestamp":...}`

然后终止进程：
```bash
kill %1
```

- [ ] **Step 3: 提交**

```bash
cd d:\work\solo work\card-framework
git add evolution-agent/
git commit -m "feat: add Evolution Agent HTTP/WebSocket server"
```

---

### Task 12: 推送到 GitHub

- [ ] **Step 1: 推送所有变更**

```bash
cd d:\work\solo work\card-framework
git push
```

Expected: 所有 10 个 commit 推送到远程