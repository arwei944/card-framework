# Task 2: 框架端 — RuleEngine 类

**Files:**
- Modify: `src/card-framework.js`（在 MetricsCollector 类后插入 RuleEngine）

**Interfaces:**
- Consumes: `eventBus`
- Produces: `class RuleEngine` 挂到 `CardFrame.RuleEngine`

## 步骤

### Step 1: 插入代码

在 MetricsCollector 类的结尾 `}` 后、`class CardFrame {` 之前插入 RuleEngine 类。当前 MetricsCollector 在约第 5677 行结束，CardFrame 在第 5679 行开始。

插入代码：

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

### Step 2: 运行测试
```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 516 passing, 0 failing

### Step 3: 提交
```bash
cd d:\work\solo work\card-framework
git add src/card-framework.js
git commit -m "feat: add RuleEngine class with 7 built-in evolution rules"
```