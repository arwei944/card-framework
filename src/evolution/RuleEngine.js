/**
 * Evaluates metrics against rules to determine evolution actions.
 * @module evolution/RuleEngine
 */

export class RuleEngine {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this.rules = [
      {
        id: 'pool-expansion',
        category: 'performance',
        condition: (m) => {
          return m.performance.poolHitRate < 0.5 && m.performance.currentCardCount > 50;
        },
        action: { type: 'param-tune', target: 'cardPool', param: '_maxPerType', value: 200,
                  reason: '对象池命中率低于50%，扩容到200' }
      },
      {
        id: 'cache-expansion',
        category: 'performance',
        condition: (m) => {
          return m.performance.cacheHitRate < 0.5;
        },
        action: { type: 'param-tune', target: 'layoutCache', param: '_maxSize', value: 10000,
                  reason: '布局缓存命中率低于50%，扩容到10000' }
      },
      {
        id: 'render-batch-optimize',
        category: 'performance',
        condition: (m) => {
          return m.performance.avgRenderTime > 50;
        },
        action: { type: 'param-tune', target: 'renderer', param: '_batchThreshold', value: 10,
                  reason: '平均渲染耗时>50ms，提高批处理阈值到10' }
      },
      {
        id: 'layout-pref',
        category: 'interaction',
        condition: (m) => {
          return m.interaction.topTypes.length > 0 && m.performance.currentCardCount > 20;
        },
        action: { type: 'code-evolve', category: 'interaction',
                  reason: '卡片数量增多，评估布局策略优化' }
      },
      {
        id: 'type-explosion',
        category: 'architecture',
        condition: (m) => {
          return m.architecture.typeCount > 50;
        },
        action: { type: 'code-evolve', category: 'architecture',
                  reason: '卡片类型超过50种，评估类型系统重构' }
      },
      {
        id: 'inheritance-depth',
        category: 'architecture',
        condition: (m) => {
          return m.architecture.maxInheritanceDepth > 4;
        },
        action: { type: 'code-evolve', category: 'architecture',
                  reason: '继承深度超过4层，评估扁平化' }
      },
      {
        id: 'listener-leak',
        category: 'architecture',
        condition: (m) => {
          return m.architecture.listenerCount > 500;
        },
        action: { type: 'code-evolve', category: 'architecture',
                  reason: '事件监听器超过500个，可能存在泄漏' }
      }
    ];
    this._cooldown = {};
  }

  evaluate(metrics) {
    const actions = [];
    const now = Date.now();
    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      if (this._inCooldown(rule.id, now)) continue;
      try {
        if (rule.condition(metrics)) {
          actions.push({ action: rule.action, ruleId: rule.id });
          this._setCooldown(rule.id, now);
        }
      } catch (e) {
        this._eventBus.emit('evolution:rule-error', { ruleId: rule.id, error: e.message });
      }
    }
    return actions;
  }

  _inCooldown(ruleId, now) {
    const last = this._cooldown[ruleId] || 0;
    return now - last < 300000;
  }

  _setCooldown(ruleId, now) {
    this._cooldown[ruleId] = now;
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  removeRule(ruleId) {
    const filtered = [];
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].id !== ruleId) {
        filtered.push(this.rules[i]);
      }
    }
    this.rules = filtered;
  }
}
