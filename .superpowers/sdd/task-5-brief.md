# Task 5: 框架端测试文件

**Files:**
- Create: `tests/evolution-tests.js`
- Modify: `package.json`（test 脚本添加 evolution-tests.js）

## 步骤

### Step 1: 创建 evolution-tests.js

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

### Step 2: 修改 package.json 的 test 脚本

原：
```json
"test": "mocha tests/test.js && mocha tests/plugin-tests.js",
```
改为：
```json
"test": "mocha tests/test.js && mocha tests/plugin-tests.js && mocha tests/evolution-tests.js",
```

### Step 3: 运行测试
```bash
cd d:\work\solo work\card-framework; npm test
```
Expected: 413 + 103 + 45 = 561 passing, 0 failing

### Step 4: 提交
```bash
git add tests/evolution-tests.js package.json
git commit -m "test: add self-evolution system tests (45 test cases)"
```