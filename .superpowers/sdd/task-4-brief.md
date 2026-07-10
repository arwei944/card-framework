# Task 4: 框架端 — CardFrame 构造函数集成

**Files:**
- Modify: `src/card-framework.js`

**Context:** Task 1-3 已插入 MetricsCollector(5540), RuleEngine(5677), EvolutionEngine(5789) 类。
CardFrame 类在第 5789-6827 行，静态导出在第 6829 行起。

## 修改点

### A. 构造函数中初始化 EvolutionEngine（第 6011 行后）

在第 6011 行 `this.eventBus = eventBus;` 之后插入：

```javascript

      this.evolutionEngine = options.evolution !== false
        ? new EvolutionEngine(this, options.evolution || {})
        : null;
      if (this.evolutionEngine) {
        this.evolutionEngine.start();
      }
```

### B. 在 CardFrame 类体末尾添加公开 API 方法（第 6826 行，static from 方法之后、类的 `}` 之前）

在第 6826 行 `return new CardFrame(container); }` 之后、第 6827 行 `}` 之前插入：

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

## 步骤

1. 读取当前文件确认精确位置
2. 修改点 A：在第 6011 行后插入 evolutionEngine 初始化
3. 修改点 B：在第 6826-6827 行间插入公开 API 方法
4. `npm test` 验证 516 passing, 0 failing
5. `git add src/card-framework.js && git commit -m "feat: integrate EvolutionEngine into CardFrame constructor and public API"`