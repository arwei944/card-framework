
> 📜 **历史规划/评估记录（Phase 4 之前）**
> 本文件是重构时期的规划/评估报告，描述的目标已在当前 ES Module + esbuild + jsdom 代码中实现。
> 其中的代码行号、旧架构论断（单体/正则/mock）**已不适用**。当前事实以 `docs/architecture-overview.md` 与源码为准。
# CardFrame 架构自进化系统设计文档

> **版本**: 1.0.0  
> **日期**: 2026-07-09  
> **状态**: 设计中

## 1. 概述

### 1.1 目标

为 CardFrame 框架新增全栈自进化能力，使框架能够在性能、交互、架构三个层面自动感知、决策、进化，并通过 Git 版本管理持久化进化结果。

### 1.2 核心特性

- **全栈覆盖**: 性能调优 + 交互自适应 + 架构代码级进化
- **全自动触发**: 基于指标阈值和定时器，无需人工介入
- **混合驱动**: 规则引擎处理参数调优，AI 引擎处理代码生成
- **Git 版本管理**: 每次进化自动创建 Git 提交，完整版本历史
- **全套保护**: 自动测试 + 自动回滚 + 快照保留 + 手动回滚 API

### 1.3 架构分层

```
┌──────────────────────────────────────────────────────────┐
│              浏览器端 (card-framework.js)                  │
│                                                           │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ Metrics      │  │ Evolution     │  │ RuleEngine    │  │
│  │ Collector    │──│ Engine        │──│ (参数调优)     │  │
│  │ (指标收集)    │  │ (协调中心)     │  │ 即时生效       │  │
│  └──────────────┘  └──────┬───────┘  └───────────────┘  │
│                           │                              │
│                     HTTP/WS│ 上报指标 / 接收进化指令       │
│                           ▼                              │
├──────────────────────────────────────────────────────────┤
│              Node.js 端 (evolution-agent/)               │
│                                                           │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ AI Code      │  │ Version       │  │ Test Runner   │  │
│  │ Generator    │  │ Manager       │  │ (npm test)    │  │
│  │ (LLM生成)    │  │ (Git操作)     │  │               │  │
│  └──────────────┘  └───────────────┘  └───────────────┘  │
│                          │                               │
│                   ┌──────▼───────┐                       │
│                   │ Rollback     │                       │
│                   │ Manager      │                       │
│                   │ (快照+回滚)   │                       │
│                   └──────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

### 1.4 分工原则

| 层面 | 框架端 (浏览器) | Agent 端 (Node.js) |
|------|----------------|-------------------|
| 性能 | 指标收集 + 参数调优（即时生效） | 性能瓶颈分析 + 优化代码生成 |
| 交互 | 行为记录 + 策略调整 | 交互模式分析 + 新交互规则生成 |
| 架构 | 类型统计 + 插件监控 | 代码重构 + 新模块生成 + Git 提交 |

---

## 2. 框架端设计

### 2.1 EvolutionEngine 类

作为 CardFrame 的第 25 个核心类，嵌入 `src/card-framework.js`。

```javascript
class EvolutionEngine {
  constructor(frame, options = {}) {
    this.frame = frame;
    this.metricsCollector = new MetricsCollector(frame);
    this.ruleEngine = new RuleEngine(frame);
    this.agentEndpoint = options.agentEndpoint || 'http://localhost:9100';
    this.wsConnection = null;
    this.evolutionHistory = [];
    this.config = {
      metricsInterval: 5000,      // 指标采样间隔
      ruleCheckInterval: 30000,   // 规则检查间隔
      agentSyncInterval: 60000,   // Agent 同步间隔
      autoEvolve: true,           // 是否自动进化
      ...options
    };
    this._timers = {};
  }

  // 启动自进化
  start() {
    this.metricsCollector.start();
    this._startRuleCheck();
    this._connectAgent();
  }

  // 停止自进化
  stop() {
    this.metricsCollector.stop();
    clearInterval(this._timers.ruleCheck);
    if (this.wsConnection) this.wsConnection.close();
  }

  // 规则检查循环
  _startRuleCheck() {
    this._timers.ruleCheck = setInterval(() => {
      const metrics = this.metricsCollector.getSnapshot();
      const actions = this.ruleEngine.evaluate(metrics);
      actions.forEach(action => this._executeAction(action));
    }, this.config.ruleCheckInterval);
  }

  // 执行进化动作
  _executeAction(action) {
    switch (action.type) {
      case 'param-tune':
        this._applyParamTune(action);
        break;
      case 'code-evolve':
        this._requestCodeEvolution(action);
        break;
    }
  }

  // 参数调优（即时生效，不需要 Agent）
  _applyParamTune(action) {
    const { target, param, value, reason } = action;
    const targets = {
      cardPool: this.frame.cardObjectPool,
      layoutCache: this.frame.layoutEngine.layoutCache,
      renderer: this.frame.renderer,
      virtualScroller: this.frame.virtualScroller
    };
    const obj = targets[target];
    if (obj && obj[param] !== undefined) {
      const oldValue = obj[param];
      obj[param] = value;
      this._recordEvolution({
        type: 'param-tune', target, param,
        oldValue, newValue: value, reason, timestamp: Date.now()
      });
    }
  }

  // 请求 Agent 执行代码级进化
  async _requestCodeEvolution(action) {
    const metrics = this.metricsCollector.getSnapshot();
    const response = await fetch(`${this.agentEndpoint}/api/evolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, metrics, frameVersion: CardFrame.version })
    });
    const result = await response.json();
    if (result.success) {
      this._recordEvolution({
        type: 'code-evolve', ...result, timestamp: Date.now()
      });
    }
  }

  // 连接 Agent WebSocket
  _connectAgent() {
    const wsUrl = this.agentEndpoint.replace('http', 'ws') + '/ws';
    this.wsConnection = new WebSocket(wsUrl);
    this.wsConnection.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'evolution-result') {
        this._handleEvolutionResult(msg.payload);
      }
    };
  }

  // 处理 Agent 返回的进化结果
  _handleEvolutionResult(result) {
    // Agent 完成代码修改并推送新配置
    if (result.configPatch) {
      this._applyConfigPatch(result.configPatch);
    }
  }

  // 获取进化历史
  getEvolutionHistory() {
    return [...this.evolutionHistory];
  }

  // 获取当前指标快照
  getMetrics() {
    return this.metricsCollector.getSnapshot();
  }

  // 记录进化
  _recordEvolution(record) {
    this.evolutionHistory.push(record);
    if (this.evolutionHistory.length > 1000) {
      this.evolutionHistory.shift();
    }
    eventBus.emit('evolution:occurred', record);
  }
}
```

### 2.2 MetricsCollector 类

```javascript
class MetricsCollector {
  constructor(frame) {
    this.frame = frame;
    this.samples = {
      performance: [],  // 性能采样
      interaction: [],  // 交互采样
      architecture: []  // 架构采样
    };
    this._timers = {};
    this._eventHandlers = {};
    this._maxSamples = 288; // 24小时 × 12 (5分钟粒度)
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

  // 收集性能指标
  _collectPerformance() {
    const sample = {
      timestamp: Date.now(),
      renderTime: this.frame.renderer._lastRenderTime || 0,
      cardCount: this.frame.store.cards.size,
      poolStats: this.frame.cardObjectPool?.getStats() || {},
      cacheStats: this.frame.layoutEngine?.layoutCache?.getStats() || {},
      memoryMB: performance.memory?.usedJSHeapSize
        ? Math.round(performance.memory.usedJSHeapSize / 1048576)
        : 0
    };
    this._pushSample('performance', sample);
  }

  // 收集交互指标
  _attachInteractionListeners() {
    this._eventHandlers.cardAdded = (card) => {
      this._recordInteraction('card-add', card.type);
    };
    this._eventHandlers.cardUpdated = (card) => {
      this._recordInteraction('card-update', card.type);
    };
    eventBus.on(EVENT_TYPES.CARD_ADDED, this._eventHandlers.cardAdded);
    eventBus.on(EVENT_TYPES.CARD_UPDATED, this._eventHandlers.cardUpdated);
  }

  // 收集架构指标
  _collectArchitecture() {
    const types = this.frame.typeRegistry._types;
    let maxDepth = 0;
    types.forEach(t => {
      if (t.extends) {
        let depth = 0;
        let current = t;
        while (current.extends) {
          depth++;
          current = types.get(current.extends);
          if (!current) break;
        }
        maxDepth = Math.max(maxDepth, depth);
      }
    });
    const sample = {
      timestamp: Date.now(),
      typeCount: types.size,
      maxInheritanceDepth: maxDepth,
      pluginCount: this.frame.pluginManager._plugins?.size || 0,
      listenerCount: this.frame.renderer._trackedListeners?.size || 0
    };
    this._pushSample('architecture', sample);
  }

  // 获取聚合快照
  getSnapshot() {
    const perf = this.samples.performance;
    const last5 = perf.slice(-12); // 最近1分钟
    return {
      performance: {
        avgRenderTime: this._avg(last5, 'renderTime'),
        currentCardCount: perf.length ? perf[perf.length - 1].cardCount : 0,
        poolHitRate: this._last(last5, 'poolStats')?.hitRate || 0,
        cacheHitRate: this._last(last5, 'cacheStats')?.hitRate || 0,
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
    return arr.reduce((s, x) => s + (x[key] || 0), 0) / arr.length;
  }

  _last(arr, key) {
    return arr.length ? arr[arr.length - 1][key] : null;
  }

  _recordInteraction(action, type) {
    const sample = { timestamp: Date.now(), action, type };
    this._pushSample('interaction', sample);
  }

  _aggregateInteractions() {
    const recent = this.samples.interaction.filter(
      s => Date.now() - s.timestamp < 300000 // 最近5分钟
    );
    const byType = {};
    recent.forEach(s => {
      byType[s.type] = (byType[s.type] || 0) + 1;
    });
    return {
      totalActions: recent.length,
      topTypes: Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }))
    };
  }

  _detachInteractionListeners() {
    eventBus.off(EVENT_TYPES.CARD_ADDED, this._eventHandlers.cardAdded);
    eventBus.off(EVENT_TYPES.CARD_UPDATED, this._eventHandlers.cardUpdated);
  }
}
```

### 2.3 RuleEngine 类

```javascript
class RuleEngine {
  constructor(frame) {
    this.frame = frame;
    this.rules = [
      // === 性能规则 ===
      {
        id: 'pool-expansion',
        category: 'performance',
        condition: (m) => m.performance.poolHitRate < 0.5 && m.performance.currentCardCount > 50,
        action: { type: 'param-tune', target: 'cardPool', param: '_maxPerType', value: 200,
                  reason: '对象池命中率低于50%，扩容到200' }
      },
      {
        id: 'cache-expansion',
        category: 'performance',
        condition: (m) => m.performance.cacheHitRate < 0.5,
        action: { type: 'param-tune', target: 'layoutCache', param: '_maxSize', value: 10000,
                  reason: '布局缓存命中率低于50%，扩容到10000' }
      },
      {
        id: 'render-batch-optimize',
        category: 'performance',
        condition: (m) => m.performance.avgRenderTime > 50,
        action: { type: 'param-tune', target: 'renderer', param: '_batchThreshold', value: 10,
                  reason: '平均渲染耗时>50ms，提高批处理阈值到10' }
      },
      // === 交互规则 ===
      {
        id: 'layout-pref',
        category: 'interaction',
        condition: (m) => {
          // stream 模式使用率>80%且卡片数>20时，建议切换 canvas
          return m.interaction.topTypes.length > 0 && m.performance.currentCardCount > 20;
        },
        action: { type: 'code-evolve', category: 'interaction',
                  reason: '卡片数量增多，评估布局策略优化' }
      },
      // === 架构规则 ===
      {
        id: 'type-explosion',
        category: 'architecture',
        condition: (m) => m.architecture.typeCount > 50,
        action: { type: 'code-evolve', category: 'architecture',
                  reason: '卡片类型超过50种，评估类型系统重构' }
      },
      {
        id: 'inheritance-depth',
        category: 'architecture',
        condition: (m) => m.architecture.maxInheritanceDepth > 4,
        action: { type: 'code-evolve', category: 'architecture',
                  reason: '继承深度超过4层，评估扁平化' }
      },
      {
        id: 'listener-leak',
        category: 'architecture',
        condition: (m) => m.architecture.listenerCount > 500,
        action: { type: 'code-evolve', category: 'architecture',
                  reason: '事件监听器超过500个，可能存在泄漏' }
      }
    ];
    this._cooldown = {}; // 规则冷却，避免频繁触发
  }

  evaluate(metrics) {
    const actions = [];
    const now = Date.now();
    for (const rule of this.rules) {
      if (this._inCooldown(rule.id, now)) continue;
      try {
        if (rule.condition(metrics)) {
          actions.push({ ...rule.action, ruleId: rule.id });
          this._setCooldown(rule.id, now);
        }
      } catch (e) {
        eventBus.emit('evolution:rule-error', { ruleId: rule.id, error: e.message });
      }
    }
    return actions;
  }

  _inCooldown(ruleId, now) {
    const last = this._cooldown[ruleId] || 0;
    return now - last < 300000; // 5分钟冷却
  }

  _setCooldown(ruleId, now) {
    this._cooldown[ruleId] = now;
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  removeRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
}
```

### 2.4 CardFrame 集成

在 CardFrame 构造函数中添加 EvolutionEngine：

```javascript
// 在构造函数中（紧接 VirtualScroller 之后）
this.evolutionEngine = options.evolution !== false
  ? new EvolutionEngine(this, options.evolution || {})
  : null;
if (this.evolutionEngine) {
  this.evolutionEngine.start();
}

// 公开 API
CardFrame.prototype.getEvolutionHistory = function() {
  return this.evolutionEngine?.getEvolutionHistory() || [];
};
CardFrame.prototype.getMetrics = function() {
  return this.evolutionEngine?.getMetrics() || null;
};
CardFrame.prototype.evolveNow = function() {
  if (this.evolutionEngine) {
    const metrics = this.evolutionEngine.metricsCollector.getSnapshot();
    const actions = this.evolutionEngine.ruleEngine.evaluate(metrics);
    actions.forEach(a => this.evolutionEngine._executeAction(a));
  }
};
```

---

## 3. Agent 端设计

### 3.1 目录结构

```
card-framework/
  evolution-agent/
    package.json
    src/
      index.js                 # 入口：HTTP + WebSocket 服务器
      ai-code-generator.js     # AI 代码生成引擎
      version-manager.js        # Git 版本管理
      test-runner.js            # 测试执行器
      rollback-manager.js       # 回滚管理器
      evolution-orchestrator.js # 进化编排器（协调上述模块）
    prompts/
      optimize-performance.md   # 性能优化提示词模板
      refactor-architecture.md  # 架构重构提示词模板
      new-feature.md            # 新功能生成提示词模板
    snapshots/                  # 版本快照存储
    config.json                 # Agent 配置
```

### 3.2 EvolutionOrchestrator（进化编排器）

```javascript
class EvolutionOrchestrator {
  constructor(config) {
    this.config = config;
    this.aiGenerator = new AICodeGenerator(config);
    this.versionManager = new VersionManager(config);
    this.testRunner = new TestRunner(config);
    this.rollbackManager = new RollbackManager(config);
  }

  // 执行进化流程
  async evolve(request) {
    const { action, metrics } = request;
    const sessionId = this._generateSessionId();

    // 1. 创建进化前快照
    const snapshot = await this.rollbackManager.createSnapshot(sessionId);

    // 2. 分析指标，生成进化方案
    const plan = await this.aiGenerator.analyzeAndPlan(action, metrics);

    // 3. 生成代码变更
    const changes = await this.aiGenerator.generateCode(plan);

    // 4. 应用变更到文件系统
    await this._applyChanges(changes);

    // 5. 运行测试
    const testResult = await this.testRunner.run();

    if (testResult.passed) {
      // 6a. 测试通过 → Git 提交
      const commit = await this.versionManager.commit({
        message: `evolution: ${plan.description}`,
        sessionId,
        changes,
        metrics
      });
      return { success: true, commit, sessionId };
    } else {
      // 6b. 测试失败 → 自动回滚
      await this.rollbackManager.rollback(snapshot);
      return { success: false, error: 'Tests failed', testResult, sessionId };
    }
  }

  _generateSessionId() {
    return `evo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async _applyChanges(changes) {
    const fs = require('fs').promises;
    const path = require('path');
    for (const change of changes) {
      const fullPath = path.join(this.config.projectRoot, change.path);
      if (change.type === 'modify') {
        await fs.writeFile(fullPath, change.content, 'utf-8');
      } else if (change.type === 'create') {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, change.content, 'utf-8');
      } else if (change.type === 'delete') {
        await fs.unlink(fullPath);
      }
    }
  }
}
```

### 3.3 AICodeGenerator（AI 代码生成引擎）

```javascript
class AICodeGenerator {
  constructor(config) {
    this.config = config;
    this.llmEndpoint = config.llmEndpoint || 'https://api.anthropic.com/v1/messages';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  }

  // 分析指标，生成进化计划
  async analyzeAndPlan(action, metrics) {
    const prompt = this._buildPrompt(action, metrics);
    const response = await this._callLLM(prompt);
    return this._parsePlan(response);
  }

  // 生成代码变更
  async generateCode(plan) {
    const changes = [];
    for (const step of plan.steps) {
      const prompt = this._buildCodegenPrompt(step, plan.context);
      const response = await this._callLLM(prompt);
      const parsed = this._parseCodeResponse(response);
      changes.push(...parsed);
    }
    return changes;
  }

  // 构建 LLM 提示词
  _buildPrompt(action, metrics) {
    return `You are a code evolution agent for CardFrame, a card-based UI framework.
    
## Current Metrics
${JSON.stringify(metrics, null, 2)}

## Evolution Trigger
${action.reason}

## Framework Source Structure
- src/card-framework.js (6450 lines, 24 classes)
- Key classes: Store, Renderer, LayoutEngine, PluginManager, RelationshipEngine
- Extension modules: CardObjectPool, LayoutCache, QueryIndex, ShadowCard

## Task
Analyze the metrics and trigger reason. Create an evolution plan with:
1. What files to modify and why
2. Specific code changes needed
3. Expected impact on metrics

Respond in JSON format:
{
  "description": "short description",
  "steps": [
    {
      "target": "file path",
      "rationale": "why this change",
      "instruction": "what to change"
    }
  ],
  "context": "relevant context for code generation"
}`;
  }

  // 调用 LLM API
  async _callLLM(prompt) {
    const response = await fetch(this.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return data.content[0].text;
  }

  _parsePlan(response) {
    // 提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM response is not valid JSON');
    return JSON.parse(jsonMatch[0]);
  }

  _buildCodegenPrompt(step, context) {
    return `You are generating code changes for CardFrame.

## Context
${context}

## Step
Target file: ${step.target}
Rationale: ${step.rationale}
Instruction: ${step.instruction}

## Requirements
- Preserve all existing functionality
- Follow existing code style (IIFE pattern, no ES modules)
- Maintain backward compatibility
- No console.log in production code

Respond in JSON format:
{
  "changes": [
    {
      "type": "modify|create|delete",
      "path": "relative file path",
      "content": "full file content for modify/create"
    }
  ]
}`;
  }

  _parseCodeResponse(response) {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM response is not valid JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.changes || [];
  }
}
```

### 3.4 VersionManager（Git 版本管理）

```javascript
const { execSync, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class VersionManager {
  constructor(config) {
    this.projectRoot = config.projectRoot;
    this.branch = config.branch || 'main';
    this.evolutionBranch = config.evolutionBranch || 'evolution';
  }

  // 确保 evolution 分支存在
  async ensureEvolutionBranch() {
    const branches = execSync('git branch --list', { cwd: this.projectRoot }).toString();
    if (!branches.includes(this.evolutionBranch)) {
      execSync(`git checkout -b ${this.evolutionBranch}`, { cwd: this.projectRoot });
    } else {
      execSync(`git checkout ${this.evolutionBranch}`, { cwd: this.projectRoot });
    }
  }

  // 提交进化变更
  async commit(evolutionData) {
    const { message, sessionId, changes, metrics } = evolutionData;

    // 切换到 evolution 分支
    await this.ensureEvolutionBranch();

    // 暂存变更文件
    for (const change of changes) {
      execSync(`git add "${change.path}"`, { cwd: this.projectRoot });
    }

    // 记录进化元数据
    const metaFile = path.join(this.projectRoot, '.evolution-meta', `${sessionId}.json`);
    await fs.mkdir(path.dirname(metaFile), { recursive: true });
    await fs.writeFile(metaFile, JSON.stringify({
      sessionId, message, metrics, changes: changes.map(c => c.path),
      timestamp: Date.now()
    }, null, 2));
    execSync(`git add ".evolution-meta/${sessionId}.json"`, { cwd: this.projectRoot });

    // 提交
    const commitMessage = `${message}

Evolution-Session: ${sessionId}
Metrics: ${JSON.stringify(metrics)}
Changes: ${changes.length} file(s)`;
    execSync('git commit -m "$(cat <<\'EOF\')\n' + commitMessage + '\nEOF)"',
      { cwd: this.projectRoot });

    // 获取 commit hash
    const hash = execSync('git rev-parse HEAD', { cwd: this.projectRoot }).toString().trim();

    // 合并回主分支（仅当测试通过时由调用方决定）
    return { hash, branch: this.evolutionBranch, sessionId };
  }

  // 获取进化历史
  getEvolutionLog() {
    const log = execSync(
      `git log ${this.evolutionBranch} --oneline --grep="evolution:"`,
      { cwd: this.projectRoot }
    ).toString();
    return log.trim().split('\n').filter(Boolean);
  }

  // 推送到远程
  async push() {
    execSync(`git push origin ${this.evolutionBranch}`, { cwd: this.projectRoot });
  }

  // 合并到主分支
  async mergeToMain() {
    execSync(`git checkout ${this.branch}`, { cwd: this.projectRoot });
    execSync(`git merge ${this.evolutionBranch} --no-ff`, { cwd: this.projectRoot });
    execSync(`git push origin ${this.branch}`, { cwd: this.projectRoot });
  }
}
```

### 3.5 TestRunner（测试执行器）

```javascript
const { exec } = require('child_process');

class TestRunner {
  constructor(config) {
    this.projectRoot = config.projectRoot;
    this.timeout = config.testTimeout || 120000; // 2分钟
  }

  async run() {
    return new Promise((resolve) => {
      const child = exec('npm test', {
        cwd: this.projectRoot,
        timeout: this.timeout
      }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            passed: false,
            error: error.message,
            stdout: stdout.slice(-2000),
            stderr: stderr.slice(-2000)
          });
        } else {
          const passing = this._extractPassing(stdout);
          const failing = this._extractFailing(stdout);
          resolve({
            passed: failing === 0,
            passing,
            failing,
            stdout: stdout.slice(-2000)
          });
        }
      });
    });
  }

  _extractPassing(stdout) {
    const match = stdout.match(/(\d+) passing/);
    return match ? parseInt(match[1]) : 0;
  }

  _extractFailing(stdout) {
    const match = stdout.match(/(\d+) failing/);
    return match ? parseInt(match[1]) : 0;
  }
}
```

### 3.6 RollbackManager（回滚管理器）

```javascript
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class RollbackManager {
  constructor(config) {
    this.projectRoot = config.projectRoot;
    this.snapshotDir = path.join(config.projectRoot, 'evolution-agent', 'snapshots');
    this.maxSnapshots = config.maxSnapshots || 20;
  }

  // 创建快照
  async createSnapshot(sessionId) {
    const snapshotPath = path.join(this.snapshotDir, `${sessionId}.tar`);
    // 使用 git stash 创建工作区快照
    const headHash = execSync('git rev-parse HEAD', { cwd: this.projectRoot }).toString().trim();
    const stashRef = execSync('git stash create', { cwd: this.projectRoot }).toString().trim();

    const snapshot = {
      sessionId,
      headHash,
      stashRef,
      timestamp: Date.now(),
      changedFiles: this._getChangedFiles()
    };

    // 保存快照元数据
    const metaPath = path.join(this.snapshotDir, `${sessionId}.json`);
    await fs.mkdir(this.snapshotDir, { recursive: true });
    await fs.writeFile(metaPath, JSON.stringify(snapshot, null, 2));

    // 清理旧快照
    await this._cleanupOldSnapshots();

    return snapshot;
  }

  // 回滚到快照
  async rollback(snapshot) {
    // 恢复文件状态
    if (snapshot.stashRef) {
      execSync(`git stash apply ${snapshot.stashRef}`, { cwd: this.projectRoot });
    } else {
      execSync(`git checkout -- .`, { cwd: this.projectRoot });
    }
    // 重置到快照时的 HEAD
    execSync(`git reset --hard ${snapshot.headHash}`, { cwd: this.projectRoot });
    return { success: true, sessionId: snapshot.sessionId };
  }

  // 列出所有快照
  async listSnapshots() {
    const files = await fs.readdir(this.snapshotDir);
    const snapshots = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(this.snapshotDir, file), 'utf-8');
        snapshots.push(JSON.parse(content));
      }
    }
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  // 手动回滚 API
  async rollbackTo(sessionId) {
    const metaPath = path.join(this.snapshotDir, `${sessionId}.json`);
    const content = await fs.readFile(metaPath, 'utf-8');
    const snapshot = JSON.parse(content);
    return this.rollback(snapshot);
  }

  _getChangedFiles() {
    try {
      return execSync('git diff --name-only HEAD', { cwd: this.projectRoot })
        .toString().trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async _cleanupOldSnapshots() {
    const files = await fs.readdir(this.snapshotDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length <= this.maxSnapshots) return;

    // 按时间排序，删除最旧的
    const sorted = [];
    for (const f of jsonFiles) {
      const stat = await fs.stat(path.join(this.snapshotDir, f));
      sorted.push({ name: f, mtime: stat.mtime });
    }
    sorted.sort((a, b) => a.mtime - b.mtime);

    const toDelete = sorted.slice(0, sorted.length - this.maxSnapshots);
    for (const f of toDelete) {
      await fs.unlink(path.join(this.snapshotDir, f.name));
    }
  }
}
```

### 3.7 HTTP/WebSocket 服务器

```javascript
const http = require('http');
const { WebSocketServer } = require('ws');

class EvolutionAgentServer {
  constructor(config) {
    this.config = config;
    this.orchestrator = new EvolutionOrchestrator(config);
    this.server = null;
    this.wss = null;
    this.connections = new Set();
  }

  start() {
    // HTTP 服务器
    this.server = http.createServer((req, res) => {
      this._handleRequest(req, res);
    });

    // WebSocket 服务器
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => {
      this.connections.add(ws);
      ws.on('message', (data) => this._handleWSMessage(ws, data));
      ws.on('close', () => this.connections.delete(ws));
    });

    this.server.listen(this.config.port || 9100);
  }

  async _handleRequest(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'POST' && req.url === '/api/evolve') {
      const body = await this._readBody(req);
      const result = await this.orchestrator.evolve(JSON.parse(body));
      res.end(JSON.stringify(result));
    } else if (req.method === 'GET' && req.url === '/api/history') {
      const history = this.orchestrator.versionManager.getEvolutionLog();
      res.end(JSON.stringify({ history }));
    } else if (req.method === 'GET' && req.url === '/api/snapshots') {
      const snapshots = await this.orchestrator.rollbackManager.listSnapshots();
      res.end(JSON.stringify({ snapshots }));
    } else if (req.method === 'POST' && req.url === '/api/rollback') {
      const body = await this._readBody(req);
      const { sessionId } = JSON.parse(body);
      const result = await this.orchestrator.rollbackManager.rollbackTo(sessionId);
      res.end(JSON.stringify(result));
    } else if (req.method === 'GET' && req.url === '/api/health') {
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  _handleWSMessage(ws, data) {
    const msg = JSON.parse(data);
    if (msg.type === 'metrics-report') {
      // 接收框架端上报的指标
      this._broadcast({ type: 'metrics-received', timestamp: Date.now() });
    }
  }

  _broadcast(message) {
    const data = JSON.stringify(message);
    this.connections.forEach(ws => {
      if (ws.readyState === 1) ws.send(data);
    });
  }

  _readBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => resolve(body));
    });
  }
}
```

---

## 4. 进化流程

### 4.1 参数调优流程（框架端独立完成）

```
指标收集 → 规则评估 → 命中阈值？ → 调整参数 → 记录进化 → 即时生效
                          ↓ 否
                     等待下次检查
```

示例：对象池命中率连续 3 次低于 50% → 自动扩容 `_maxPerType` 从 100 到 200。

### 4.2 代码级进化流程（框架端 + Agent 端）

```
框架端                          Agent 端
  │                               │
  ├── 指标超阈值 ──────────────────→│
  │                               ├── 1. 创建快照
  │                               ├── 2. AI 分析指标 + 生成计划
  │                               ├── 3. AI 生成代码变更
  │                               ├── 4. 写入文件
  │                               ├── 5. 运行 npm test
  │                               │    ├── 通过 → Git 提交
  │                               │    └── 失败 → 自动回滚
  ←── 返回进化结果 ────────────────┤
  │                               │
  ├── 应用配置补丁                  │
  └── 记录进化历史                  │
```

### 4.3 自动版本管理流程

```
每次进化成功:
  1. 切换到 evolution 分支
  2. git add 变更文件 + 元数据
  3. git commit (包含指标快照和变更说明)
  4. 保留在 evolution 分支（不自动合并到 main）

定期合并 (每 N 次成功进化):
  1. git checkout main
  2. git merge evolution --no-ff
  3. git push origin main
  4. git push origin evolution
```

---

## 5. 安全与回滚

### 5.1 全套保护机制

| 保护层 | 机制 | 说明 |
|--------|------|------|
| 第一层 | 规则冷却 | 同一规则 5 分钟内不重复触发 |
| 第二层 | 快照创建 | 每次代码级进化前创建 Git 快照 |
| 第三层 | 自动测试 | 进化后自动运行 516 个测试用例 |
| 第四层 | 自动回滚 | 测试失败立即回滚到快照 |
| 第五层 | 快照保留 | 保留最近 20 个快照 |
| 第六层 | 手动回滚 | REST API: `POST /api/rollback { sessionId }` |
| 第七层 | 分支隔离 | 进化在 `evolution` 分支进行，不直接污染 `main` |

### 5.2 回滚 API

```http
# 列出所有快照
GET /api/snapshots

# 回滚到指定快照
POST /api/rollback
Content-Type: application/json
{ "sessionId": "evo-1720569600000-ab12cd" }
```

---

## 6. 通信协议

### 6.1 框架端 → Agent 端

**HTTP POST /api/evolve**
```json
{
  "action": {
    "type": "code-evolve",
    "category": "performance",
    "reason": "平均渲染耗时>50ms",
    "ruleId": "render-batch-optimize"
  },
  "metrics": {
    "performance": { "avgRenderTime": 65, "poolHitRate": 0.73 },
    "interaction": { "totalActions": 42 },
    "architecture": { "typeCount": 24 }
  },
  "frameVersion": "1.0.0"
}
```

**HTTP POST /api/evolve Response**
```json
{
  "success": true,
  "commit": { "hash": "abc123", "branch": "evolution" },
  "sessionId": "evo-1720569600000-ab12cd",
  "configPatch": { "renderer._batchThreshold": 10 }
}
```

### 6.2 WebSocket 双向通信

框架端 → Agent: 指标上报
```json
{ "type": "metrics-report", "data": { /* 指标快照 */ } }
```

Agent → 框架端: 进化结果推送
```json
{ "type": "evolution-result", "payload": { "configPatch": { /* 配置补丁 */ } } }
```

---

## 7. 文件结构

```
card-framework/
  src/
    card-framework.js          # 新增 EvolutionEngine, MetricsCollector, RuleEngine 三个类
  evolution-agent/
    package.json
    src/
      index.js                 # 服务器入口
      evolution-orchestrator.js
      ai-code-generator.js
      version-manager.js
      test-runner.js
      rollback-manager.js
      server.js
    prompts/
      optimize-performance.md
      refactor-architecture.md
      new-feature.md
    snapshots/
    config.json
  tests/
    evolution-tests.js         # 自进化系统测试
  docs/
    specs/
      2026-07-09-architecture-self-evolution-design.md  # 本文档
```

---

## 8. 测试策略

### 8.1 框架端测试

| 测试项 | 验证点 |
|--------|--------|
| MetricsCollector 初始化 | start/stop 正确启停定时器 |
| 性能指标收集 | 渲染耗时、池命中率、缓存命中率正确采集 |
| 交互指标收集 | 卡片操作事件正确记录 |
| 架构指标收集 | 类型数量、继承深度正确统计 |
| RuleEngine 规则评估 | 各规则在阈值上下正确触发/不触发 |
| 规则冷却 | 5 分钟内不重复触发 |
| 参数调优执行 | 对象池、缓存、渲染器参数正确修改 |
| EvolutionEngine 生命周期 | start/stop 正确管理所有子模块 |

### 8.2 Agent 端测试

| 测试项 | 验证点 |
|--------|--------|
| HTTP 服务器 | /api/evolve, /api/history, /api/snapshots, /api/rollback 正确响应 |
| VersionManager | Git 分支创建、提交、历史查询正确 |
| TestRunner | npm test 执行结果正确解析 |
| RollbackManager | 快照创建、回滚、列表、清理正确 |
| 进化编排流程 | 快照→生成→应用→测试→提交/回滚 完整流程 |
| 测试失败回滚 | 测试失败时正确回滚到快照状态 |

---

## 9. 配置

### 9.1 框架端配置

```javascript
const frame = new CardFrame(container, {
  evolution: {
    enabled: true,
    agentEndpoint: 'http://localhost:9100',
    metricsInterval: 5000,
    ruleCheckInterval: 30000,
    autoEvolve: true
  }
});
```

### 9.2 Agent 端配置

```json
{
  "port": 9100,
  "projectRoot": "../",
  "branch": "main",
  "evolutionBranch": "evolution",
  "llmEndpoint": "https://api.anthropic.com/v1/messages",
  "testTimeout": 120000,
  "maxSnapshots": 20,
  "autoMergeThreshold": 10
}
```

---

## 10. 实现优先级

1. **Phase 1**: 框架端 - EvolutionEngine + MetricsCollector + RuleEngine（参数调优能力）
2. **Phase 2**: Agent 端 - HTTP 服务器 + VersionManager + TestRunner + RollbackManager（版本管理能力）
3. **Phase 3**: Agent 端 - AICodeGenerator + EvolutionOrchestrator（代码级进化能力）
4. **Phase 4**: 测试覆盖 + 文档
