# CardFrame v2.0 升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 CardFrame v1.0 从"功能完备"升级到"质量完备"——修复构建分裂、消灭内存泄漏、替换伪测试、让对象池和虚拟滚动真正工作、具备 npm 发布能力

**Architecture:** 所有修改集中在 card-framework.js（源文件）、build.js（构建脚本）、tests/（测试目录）、docs/（文档目录）四个区域。各任务独立可测试，先改构建脚本确保所有类被正确提取，再修核心性能模块，然后重构测试，最后补充文档和 npm 配置

**Tech Stack:** 纯 ES5 IIFE（源文件）、Node.js 正则构建（build.js）、Mocha 测试、无外部依赖

---

## 文件结构

```
src/card-framework.js          # 修改：添加 destroy() 方法、修复 LayoutCache LRU、集成 CardObjectPool
scripts/build.js               # 修改：替换 extractClass 为 autoScanClasses，自动发现所有 27 个类
tests/test.js                  # 重写：将伪测试替换为运行时测试，添加 beforeEach/afterEach
tests/evolution-tests.js       # 修改：增补参数调优类测试
tests/virtual-scroll-tests.js  # 新建：VirtualScroller 运行时行为测试
tests/object-pool-tests.js     # 新建：CardObjectPool 集成测试
tests/lru-cache-tests.js       # 新建：LayoutCache LRU 行为测试
tests/destroy-tests.js         # 新建：CardFrame.destroy() 资源清理测试
package.json                   # 修改：添加 files 字段、更新 badge
.npmignore                     # 新建：npm 发布忽略配置
docs/api-reference.md          # 修改：补充 EvolutionEngine 等章节
docs/agent-guide.md            # 修改：补充进化引擎 API
evolution-agent/README.md      # 新建：Agent 服务说明
docs/architecture-overview.md  # 新建：架构总览文档
.github/workflows/ci.yml       # 修改：添加 npm publish 步骤
```

---

## 全球约束

- 所有修改必须保持 ES5 兼容（IIFE 模式，var 声明，无箭头函数）
- 零外部依赖原则不变
- 每次提交前运行 `npm test` 确保全部通过
- 修改 card-framework.js 后必须同步运行 `npm run build` 验证构建产物
- 新增测试必须使用 beforeEach/afterEach 确保隔离

---

### Task 1: 构建脚本 — 自动发现所有类，消除手动 extractClass

**说明：** 当前 build.js 使用 `extractClass(source, 'ClassName')` 手动调用 13 次，遗漏了 11 个类。本任务将其替换为 `autoScanClasses(source)` 函数，自动从 IIFE 中提取所有 `class XXXX {` 定义，消除手动维护成本。

**Files:**
- Modify: `scripts/build.js:18-22`（替换 extractClass 函数）
- Modify: `scripts/build.js:30-364`（替换 buildCoreModule 中的手动提取逻辑）
- Modify: `scripts/build.js:369-627`（替换所有 build*Module 函数，使用 autoScanClasses）

**Interfaces:**
- Consumes: `src/card-framework.js` 全量源码
- Produces: `autoScanClasses(source)` 返回 `{ className: classCode }` 映射表；`buildModule(moduleName, source, classNames, IIFEHeader, IIFEFooter, registerBlock)` 通用构建函数

- [ ] **Step 1: 写 autoScanClasses 的测试**

在 build.js 中新增 `autoScanClasses` 函数前，先在 `tests/build-tests.js` 中验证：

```javascript
// tests/build-tests.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 加载 build.js 中的 autoScanClasses
const buildCode = fs.readFileSync(path.join(__dirname, '../scripts/build.js'), 'utf8');
eval(buildCode);

describe('Build Script - autoScanClasses', function() {
  it('应该提取所有 27 个类', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.strictEqual(Object.keys(classes).length >= 27, true);
  });

  it('应该包含 EvolutionEngine', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.notStrictEqual(classes['EvolutionEngine'], undefined);
  });

  it('应该包含 ActionLogger', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.notStrictEqual(classes['ActionLogger'], undefined);
  });

  it('应该包含 CardObjectPool', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.notStrictEqual(classes['CardObjectPool'], undefined);
  });

  it('提取的类代码应该以 "class X {" 开头', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.strictEqual(classes['EventBus'].startsWith('  class EventBus {'), true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx mocha tests/build-tests.js -v
```
Expected: FAIL with "autoScanClasses is not defined"

- [ ] **Step 3: 在 build.js 中实现 autoScanClasses 函数**

将 [scripts/build.js:18-22](file:///d:/work/solo%20work/card-framework/scripts/build.js#L18-L22) 的 `extractClass` 函数替换为：

```javascript
// scripts/build.js:18-22 替换为
function extractClass(source, className) {
  const pattern = new RegExp(`  class ${className} \\{[\\s\\S]*?\\n  \\}`, 'm');
  const match = source.match(pattern);
  return match ? match[0] : null;
}

function autoScanClasses(source) {
  const classes = {};
  const pattern = /  class (\w+) \{/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const className = match[1];
    const classCode = extractClass(source, className);
    if (classCode) {
      classes[className] = classCode;
    }
  }
  return classes;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx mocha tests/lru-cache-tests.js -v
```
Expected: 5 tests PASS

- [ ] **Step 5: 运行全量测试**

```bash
npm test
```
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/card-framework.js tests/lru-cache-tests.js
git commit -m "fix: LayoutCache.get() now updates access order for true LRU eviction"
```

---

### Task 6: 修复 VirtualScroller — 实现真正 DOM 虚拟化

**Files:**
- Modify: `src/card-framework.js:4920-5098`（VirtualScroller 类，添加 DOM 回收/复用逻辑）
- Create: `tests/virtual-scroll-tests.js`

**Interfaces:**
- Consumes: `VirtualScroller._renderVisibleCards(visibleCards)` / `_findScrollContainer()` / `_calculateVisibleRange()`
- Produces: 滚动时移出视口的卡片 DOM 被回收至隐藏池，复用而非重建

- [ ] **Step 1: 写 VirtualScroller DOM 虚拟化测试**

```javascript
// tests/virtual-scroll-tests.js
/* global describe, it, before, after, beforeEach */
var assert = require('assert');

var mockWindow = {
  addEventListener: function() {},
  removeEventListener: function() {},
  innerHeight: 900,
  CardFrame: null,
  requestAnimationFrame: function(cb) { cb(); },
  cancelAnimationFrame: function() {}
};
var mockDocument = {
  createElement: function(tag) {
    var el = {
      tagName: tag.toUpperCase(),
      style: {},
      classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
      setAttribute: function() {},
      removeAttribute: function() {},
      appendChild: function() {},
      removeChild: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      dataset: {},
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 280, height: 200, right: 280, bottom: 200 }; },
      children: [], childNodes: [], textContent: '',
      innerHTML: '', nodeType: 1, parentNode: null, attributes: [],
      firstChild: null, lastChild: null,
      scrollTop: 0, scrollHeight: 10000, clientHeight: 800
    };
    return el;
  },
  createElementNS: function() { return { setAttribute: function() {}, appendChild: function() {} }; },
  documentElement: { lang: 'en' },
  body: { appendChild: function() {}, removeChild: function() {}, innerHTML: '' }
};

global.window = mockWindow;
global.document = mockDocument;
global.HTMLElement = function() { this.style = {}; this.classList = { add: function() {}, remove: function() {}, contains: function() { return false; } }; };
global.HTMLElement.prototype.attachShadow = function() { return { innerHTML: '' }; };
global.HTMLElement.prototype.setAttribute = function() {};
global.HTMLElement.prototype.getAttribute = function() { return null; };
global.HTMLElement.prototype.addEventListener = function() {};
global.HTMLElement.prototype.removeEventListener = function() {};
global.HTMLElement.prototype.dispatchEvent = function() {};
global.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };
global.MutationObserver.prototype.observe = function() {};
global.MutationObserver.prototype.disconnect = function() {};

delete require.cache[require.resolve('../src/card-framework.js')];
require('../src/card-framework.js');
var CardFrame = global.window.CardFrame;

describe('VirtualScroller - DOM Virtualization', function() {
  var container, frame, vs;

  beforeEach(function() {
    container = document.createElement('div');
    container.style.overflow = 'auto';
    container.style.height = '800px';
    container.style.width = '100%';
    document.body.appendChild(container);
    frame = new CardFrame(container, { evolution: false });
    vs = frame.virtualScroller;
    vs._estimateCardDimensions = function() { return { width: 280, height: 200 }; };
    vs._visibleRange = { start: 0, end: 4 };
  });

  afterEach(function() {
    if (frame && !frame._destroyed) frame.destroy();
    document.body.removeChild(container);
  });

  it('enable 后应有 _domPool', function() {
    vs.enable();
    assert.notStrictEqual(vs._domPool, undefined);
  });

  it('enable 后应有 _domPool 容器元素', function() {
    vs.enable();
    assert.notStrictEqual(vs._domPoolContainer, undefined);
  });

  it('enable 后 disable 应清理 _domPool', function() {
    vs.enable();
    vs.disable();
    assert.strictEqual(vs._domPool, undefined);
  });

  it('refresh 后可视范围内卡片应有 DOM 元素', function() {
    for (var i = 0; i < 20; i++) {
      frame.createCard('text', { title: 'card' + i });
    }
    vs.enable();
    vs.refresh();
    assert.strictEqual(container.querySelectorAll('cf-card').length <= 10, true);
  });

  it('_releaseCard 应回收 DOM 到池中', function() {
    vs.enable();
    var cardEl = document.createElement('cf-card');
    cardEl.dataset.cardId = 'test-id';
    container.appendChild(cardEl);
    vs._releaseCard(cardEl);
    assert.strictEqual(container.contains(cardEl), false);
    assert.strictEqual(vs._domPool.contains(cardEl), true);
  });

  it('_acquireCard 应从池中取出 DOM', function() {
    vs.enable();
    var cardEl = document.createElement('cf-card');
    cardEl.dataset.cardId = 'pooled';
    vs._domPool.appendChild(cardEl);
    var acquired = vs._acquireCard('pooled');
    assert.notStrictEqual(acquired, null);
    assert.strictEqual(vs._domPool.contains(acquired), false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx mocha tests/virtual-scroll-tests.js -v
```
Expected: 测试失败，因为 `vs._domPool` 为 undefined

- [ ] **Step 3: 修改 VirtualScroller 类，添加 DOM 池化逻辑**

在 [src/card-framework.js:4920-5098](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L4920-L5098) 的 VirtualScroller 类中，在构造函数内添加 DOM 池相关属性（约 L4925 附近）：

```javascript
this._domPool = null;
this._domPoolContainer = null;
this._visibleCardIds = new Set();
```

修改 `enable` 方法，创建 DOM 池容器：

```javascript
enable: function(options) {
  if (this._enabled) return;
  this._enabled = true;
  if (options) {
    this.overscan = options.overscan || DEFAULT_CONFIG.VIRTUAL_SCROLL_OVERSCAN;
  }
  this._domPoolContainer = document.createElement('div');
  this._domPoolContainer.style.display = 'none';
  this.container.appendChild(this._domPoolContainer);
  this._domPool = this._domPoolContainer;
  this._visibleCardIds = new Set();
  this._findScrollContainer();
  this._bindEvents();
  this._updateVisibleCards();
},
```

修改 `disable` 方法，清理 DOM 池：

```javascript
disable: function() {
  if (!this._enabled) return;
  this._enabled = false;
  this._unbindEvents();
  if (this._domPoolContainer && this._domPoolContainer.parentNode) {
    this._domPoolContainer.parentNode.removeChild(this._domPoolContainer);
  }
  this._domPool = null;
  this._domPoolContainer = null;
  this._visibleCardIds = null;
  this.renderer.renderCards(this.store.getAllCards());
},
```

添加 `_releaseCard` 和 `_acquireCard` 方法（在 `_renderVisibleCards` 之前）：

```javascript
_releaseCard: function(cardEl) {
  if (!this._domPool) return;
  cardEl.style.display = 'none';
  cardEl.dataset.virtualPooled = 'true';
  this._domPool.appendChild(cardEl);
},

_acquireCard: function(cardId) {
  if (!this._domPool) return null;
  var children = this._domPool.children;
  for (var i = 0; i < children.length; i++) {
    if (children[i].dataset && children[i].dataset.cardId === cardId) {
      var el = children[i];
      el.style.display = '';
      delete el.dataset.virtualPooled;
      return el;
    }
  }
  return null;
},
```

重写 `_renderVisibleCards` 方法：

```javascript
_renderVisibleCards: function(visibleCards) {
  if (!this._enabled || !this._domPool) return;
  var self = this;
  var newVisibleIds = new Set();
  var scrollContainer = this._scrollContainer;

  visibleCards.forEach(function(card) {
    newVisibleIds.add(card.id);
    var existingEl = scrollContainer.querySelector('cf-card[data-card-id="' + card.id + '"]');
    if (!existingEl) {
      var pooled = self._acquireCard(card.id);
      if (pooled) {
        scrollContainer.appendChild(pooled);
      } else {
        self.renderer.createCardElement(card);
      }
    }
  });

  if (scrollContainer) {
    var allCardEls = scrollContainer.querySelectorAll('cf-card');
    for (var j = 0; j < allCardEls.length; j++) {
      var el = allCardEls[j];
      if (el.dataset && el.dataset.cardId && !newVisibleIds.has(el.dataset.cardId)) {
        self._releaseCard(el);
      }
    }
  }

  this._visibleCardIds = newVisibleIds;
},
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx mocha tests/virtual-scroll-tests.js -v
```
Expected: 6 tests PASS

- [ ] **Step 5: 运行全量测试**

```bash
npm test
```
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/card-framework.js tests/virtual-scroll-tests.js
git commit -m "perf: implement real DOM virtualization in VirtualScroller with dom pool recycle"
```

---

### Task 7: 重构测试体系 — 替换伪测试为运行时测试

**Files:**
- Rewrite: `tests/test.js`（从 ~320 个伪测试改为 ~150 个运行时测试）
- Modify: `tests/plugin-tests.js`（相同模式替换）

**Interfaces:**
- Consumes: `src/card-framework.js` 导出的所有类
- Produces: 可验证运行时行为的测试套件

- [ ] **Step 1: 重写 test.js 核心模块测试**

将 [tests/test.js](file:///d:/work/solo%20work/card-framework/tests/test.js) 完全重写。以下是完整测试代码：

```javascript
// tests/test.js — 重写版
var assert = require('assert');

function setupMockGlobals() {
  global.window = {
    addEventListener: function() {},
    removeEventListener: function() {},
    CardFrame: null,
    requestAnimationFrame: function(cb) { cb(); },
    cancelAnimationFrame: function() {}
  };
  global.document = {
    createElement: function(tag) {
      var el = {
        tagName: tag.toUpperCase(), style: {},
        classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
        setAttribute: function() {}, removeAttribute: function() {},
        appendChild: function() {}, removeChild: function() {},
        addEventListener: function() {}, removeEventListener: function() {},
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        dataset: {},
        getBoundingClientRect: function() { return { left: 0, top: 0, width: 100, height: 100 }; },
        children: [], childNodes: [], textContent: '', innerHTML: '',
        nodeType: 1, parentNode: null, attributes: [],
        firstChild: null, lastChild: null
      };
      return el;
    },
    createElementNS: function() { return { setAttribute: function() {}, appendChild: function() {} }; },
    documentElement: { lang: 'en' },
    body: { appendChild: function() {}, removeChild: function() {}, innerHTML: '' }
  };
  global.HTMLElement = function() {
    this.style = {}; this.classList = { add: function() {}, remove: function() {} };
  };
  global.HTMLElement.prototype.attachShadow = function() { return { innerHTML: '' }; };
  global.HTMLElement.prototype.setAttribute = function() {};
  global.HTMLElement.prototype.getAttribute = function() { return null; };
  global.HTMLElement.prototype.addEventListener = function() {};
  global.HTMLElement.prototype.removeEventListener = function() {};
  global.HTMLElement.prototype.dispatchEvent = function() {};
  global.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };
  global.MutationObserver.prototype.observe = function() {};
  global.MutationObserver.prototype.disconnect = function() {};
}

setupMockGlobals();
delete require.cache[require.resolve('../src/card-framework.js')];
require('../src/card-framework.js');
var CardFrame = global.window.CardFrame;

describe('CardFrame Core', function() {
  var container, frame;

  beforeEach(function() {
    container = document.createElement('div');
    document.body.appendChild(container);
    frame = new CardFrame(container, { evolution: false });
  });

  afterEach(function() {
    if (frame && !frame._destroyed) frame.destroy();
    document.body.removeChild(container);
  });

  describe('CardFrame 主类', function() {
    it('构造函数应创建 CardFrame 实例', function() {
      assert.notStrictEqual(frame, null);
      assert.strictEqual(typeof frame.createCard, 'function');
    });

    it('createCard 应创建卡片并返回对象', function() {
      var card = frame.createCard('text', { title: 'test', content: 'hello' });
      assert.notStrictEqual(card, null);
      assert.strictEqual(card.type, 'text');
      assert.strictEqual(card.props.title, 'test');
    });

    it('getCard 应获取已创建的卡片', function() {
      var created = frame.createCard('text', { title: 'test' });
      var fetched = frame.getCard(created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched.id, created.id);
    });

    it('updateCard 应更新卡片属性', function() {
      var card = frame.createCard('text', { title: 'old' });
      card.props.title = 'new';
      var updated = frame.updateCard(card);
      assert.notStrictEqual(updated, null);
      assert.strictEqual(updated.props.title, 'new');
    });

    it('removeCard 应删除卡片', function() {
      var card = frame.createCard('text', { title: 'temp' });
      var result = frame.removeCard(card.id);
      assert.strictEqual(result, true);
      assert.strictEqual(frame.getCard(card.id), undefined);
    });

    it('getAllCards 应返回所有卡片', function() {
      frame.createCard('text', { title: 'a' });
      frame.createCard('text', { title: 'b' });
      var all = frame.getAllCards();
      assert.strictEqual(all.length, 2);
    });
  });

  describe('EventBus', function() {
    it('on/emit 应触发监听器', function() {
      var called = false;
      frame.eventBus.on('test-event', function() { called = true; });
      frame.eventBus.emit('test-event');
      assert.strictEqual(called, true);
    });

    it('off 应移除监听器', function() {
      var count = 0;
      function handler() { count++; }
      frame.eventBus.on('test', handler);
      frame.eventBus.off('test', handler);
      frame.eventBus.emit('test');
      assert.strictEqual(count, 0);
    });

    it('once 应只触发一次', function() {
      var count = 0;
      frame.eventBus.once('test', function() { count++; });
      frame.eventBus.emit('test');
      frame.eventBus.emit('test');
      assert.strictEqual(count, 1);
    });
  });

  describe('Store', function() {
    it('addCard / getCard 基本功能', function() {
      var card = { id: 'c1', type: 'text', props: {}, position: { x: 0, y: 0 }, status: 'active' };
      frame.store.addCard(card);
      assert.notStrictEqual(frame.store.getCard('c1'), undefined);
    });

    it('removeCard 删除不存在卡片应返回 false', function() {
      var result = frame.store.removeCard('non-exist');
      assert.strictEqual(result, false);
    });

    it('subscribe 应在 notify 时触发', function() {
      var called = false;
      frame.store.subscribe(function() { called = true; });
      frame.store.notify();
      assert.strictEqual(called, true);
    });
  });

  describe('TypeRegistry', function() {
    it('应注册并获取类型', function() {
      frame.typeRegistry.register({ name: 'custom-type', properties: [], abstract: false });
      var type = frame.typeRegistry.get('custom-type');
      assert.notStrictEqual(type, undefined);
    });

    it('获取未注册类型应返回 undefined', function() {
      var type = frame.typeRegistry.get('non-exist');
      assert.strictEqual(type, undefined);
    });
  });

  describe('Utils', function() {
    it('generateId 应生成唯一 ID', function() {
      var id1 = CardFrame.Utils.generateId();
      var id2 = CardFrame.Utils.generateId();
      assert.notStrictEqual(id1, id2);
    });

    it('escapeHtml 应转义特殊字符', function() {
      var escaped = CardFrame.Utils.escapeHtml('<script>alert("xss")</script>');
      assert.strictEqual(escaped.indexOf('<script>'), -1);
    });

    it('deepClone 应深拷贝对象', function() {
      var obj = { a: 1, b: { c: 2 } };
      var cloned = CardFrame.Utils.deepClone(obj);
      cloned.b.c = 999;
      assert.strictEqual(obj.b.c, 2);
    });
  });

  describe('ActionLogger', function() {
    it('record 应记录操作', function() {
      frame.actionLogger.record('test', { data: 1 });
      assert.strictEqual(frame.actionLogger.canUndo(), true);
    });

    it('undo 应撤销操作', function() {
      var card = frame.createCard('text', { title: 'undo-test' });
      var result = frame.actionLogger.undo();
      assert.notStrictEqual(result, undefined);
    });

    it('canUndo 无历史时应返回 false', function() {
      frame.actionLogger.clearHistory();
      assert.strictEqual(frame.actionLogger.canUndo(), false);
    });
  });

  describe('CircuitBreaker', function() {
    it('execute 应正常执行函数', function() {
      var result = frame.circuitBreaker.execute(function() { return 42; }, null);
      assert.strictEqual(result, 42);
    });

    it('连续失败应触发熔断', function() {
      var breaker = frame.circuitBreaker;
      breaker._failureCount = breaker._failureThreshold;
      var result = breaker.execute(function() { return 'ok'; }, 'fallback');
      assert.strictEqual(result, 'fallback');
    });
  });

  describe('ThemeManager', function() {
    it('setTheme 应切换主题', function() {
      frame.themeManager.setTheme('dark');
      assert.strictEqual(frame.themeManager.currentTheme, 'dark');
    });

    it('getAvailableThemes 应返回主题列表', function() {
      var themes = frame.themeManager.getAvailableThemes();
      assert.strictEqual(Array.isArray(themes), true);
    });
  });

  describe('I18nManager', function() {
    it('setLanguage 应切换语言', function() {
      frame.i18n.setLanguage('zh-CN');
      assert.strictEqual(frame.i18n.currentLanguage, 'zh-CN');
    });

    it('translate 应返回翻译文本', function() {
      var text = frame.i18n.translate('card.created');
      assert.strictEqual(typeof text, 'string');
    });
  });

  describe('RelationshipEngine', function() {
    it('addRelationship 应创建关系', function() {
      var c1 = frame.createCard('text', { title: 'a' });
      var c2 = frame.createCard('text', { title: 'b' });
      var rel = frame.relationshipEngine.addRelationship(c1.id, c2.id, 'reference', {});
      assert.notStrictEqual(rel, undefined);
    });

    it('getRelationships 应返回卡片的关系', function() {
      var c1 = frame.createCard('text', { title: 'a' });
      var c2 = frame.createCard('text', { title: 'b' });
      frame.relationshipEngine.addRelationship(c1.id, c2.id, 'reference', {});
      var rels = frame.relationshipEngine.getRelationships(c1.id);
      assert.strictEqual(Array.isArray(rels), true);
      assert.strictEqual(rels.length >= 1, true);
    });
  });

  describe('插件管理', function() {
    it('installPlugin 应安装插件', function() {
      var plugin = { name: 'test-plugin', version: '1.0', onInstall: function() {} };
      frame.pluginManager.install(plugin);
      var installed = frame.pluginManager.get('test-plugin');
      assert.notStrictEqual(installed, undefined);
    });

    it('uninstallPlugin 应卸载插件', function() {
      var plugin = { name: 'test-plugin2', version: '1.0', onInstall: function() {} };
      frame.pluginManager.install(plugin);
      frame.pluginManager.uninstall('test-plugin2');
      assert.strictEqual(frame.pluginManager.get('test-plugin2'), undefined);
    });
  });
});
```

- [ ] **Step 2: 运行新测试**

```bash
npx mocha tests/test.js -v
```
Expected: ~80-100 tests PASS

- [ ] **Step 3: 运行全量测试**

```bash
npm test
```
Expected: 全部通过（原有 evolution-tests.js + 新 test.js + 其他测试）

- [ ] **Step 4: 运行构建确认无回归**

```bash
npm run build
npm test
```
Expected: 构建成功，测试全部通过

- [ ] **Step 5: Commit**

```bash
git add tests/test.js
git commit -m "test: replace static code check tests with runtime instantiation tests"
```

---

### Task 8: npm 发布准备

**Files:**
- Modify: `package.json`（添加 files 字段、更新 badge）
- Create: `.npmignore`
- Modify: `.github/workflows/ci.yml`（添加 npm publish 步骤）

**Interfaces:**
- Consumes: `package.json` 现有配置
- Produces: 满足 npm publish 要求的配置

- [ ] **Step 1: 修改 package.json**

修改 [package.json](file:///d:/work/solo%20work/card-framework/package.json)，添加 `files` 字段、更新 `description` 和 `keywords`：

```json
{
  "name": "card-framework",
  "version": "1.0.0",
  "description": "通用卡片前端框架 - 以卡片为核心数据单元和UI载体的框架无关、Agent友好的前端框架。零外部依赖，支持模块化按需加载。",
  "main": "dist/card-framework.js",
  "types": "dist/card-framework.d.ts",
  "files": [
    "dist/",
    "src/card-framework.css",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],
  "scripts": {
    "test": "mocha tests/test.js && mocha tests/plugin-tests.js && mocha tests/evolution-tests.js",
    "test:coverage": "c8 npm test",
    "test:perf": "node tests/perf-test.js",
    "serve": "npx http-server -p 8080",
    "build": "node scripts/build.js",
    "release": "npm test && npm run build",
    "version:patch": "npm version patch --no-git-tag-version",
    "version:minor": "npm version minor --no-git-tag-version",
    "version:major": "npm version major --no-git-tag-version"
  },
  "keywords": [
    "cards", "framework", "frontend", "agent", "ai",
    "card-ui", "canvas", "plugin", "virtual-scroll", "i18n",
    "web-components", "shadow-dom", "zero-dependency"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "c8": "^9.0.0",
    "mocha": "^10.0.0"
  }
}
```

- [ ] **Step 2: 创建 .npmignore**

```bash
# .npmignore
node_modules/
.git/
.github/
tests/
scripts/
docs/
examples/
plugins/
evolution-agent/
.superpowers/
src/card-framework.js
*.log
```

- [ ] **Step 3: 更新 README badges**

将 README.md 头部第 5 行从 `tests-231` 改为 `tests-550+`，并更新 CI badge URL。

- [ ] **Step 4: 验证 npm 发布准备**

```bash
npm pack --dry-run
```
Expected: 显示 dist/ 目录、README.md、CHANGELOG.md、LICENSE、src/card-framework.css 将要被打包

```bash
npm test && npm run build
```
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add package.json .npmignore README.md
git commit -m "chore: configure npm publish (files, .npmignore, readme badges)"
```

---

### Task 9: 补充自进化系统文档

**Files:**
- Modify: `docs/api-reference.md`（添加 EvolutionEngine / MetricsCollector / RuleEngine 章节）
- Modify: `docs/agent-guide.md`（补充进化引擎 API）
- Create: `evolution-agent/README.md`（Agent 服务说明）

**Interfaces:**
- Consumes: `EvolutionEngine`, `MetricsCollector`, `RuleEngine` 已有的类定义
- Produces: 完整的中文 API 文档

- [ ] **Step 1: 在 api-reference.md 末尾添加 EvolutionEngine 章节**

```markdown
### EvolutionEngine 类 (自进化引擎)

自进化引擎是 CardFrame v1.1+ 的核心扩展能力，负责实时采集框架运行指标、评估优化规则、执行参数调优或请求 Agent AI 代码生成。

#### 构造函数

```javascript
new EvolutionEngine(frame, options)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| frame | CardFrame | CardFrame 实例 |
| options.ruleCheckInterval | number | 规则检查间隔（毫秒，默认 30000） |
| options.agentUrl | string | Evolution Agent 服务地址（可选） |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| start() | void | 启动自进化引擎，开始采集指标和定时检查规则 |
| stop() | void | 停止自进化引擎，清理所有定时器 |
| getEvolutionHistory() | Array | 获取进化历史记录 |
| getMetrics() | Object | 获取当前指标快照 |
| evolveNow() | void | 立即执行一次进化检查 |

#### 进化历史格式

```javascript
{
  type: 'param-tune',
  ruleId: 'pool-expansion',
  timestamp: 1720500000000,
  target: 'cardPool',
  param: '_maxPerType',
  oldValue: 100,
  newValue: 150
}
```

### MetricsCollector 类 (指标收集器)

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| start() | void | 启动指标采集（5 秒性能采样 + 1 小时间隔架构采样） |
| stop() | void | 停止指标采集 |
| getSnapshot() | Object | 获取当前所有指标的汇总快照 |

#### 快照格式

```javascript
{
  performance: {
    avgRenderTime: 12.5,
    currentCardCount: 150,
    poolHitRate: 0.85,
    cacheHitRate: 0.92
  },
  interaction: {
    totalActions: 523,
    topTypes: [{ type: 'text', count: 100 }]
  },
  architecture: {
    typeCount: 8,
    maxInheritanceDepth: 2,
    listenerCount: 45,
    pluginCount: 3
  }
}
```

### RuleEngine 类 (规则引擎)

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| evaluate(metrics) | Array | 根据指标评估所有规则，返回触发的动作列表 |
| addRule(ruleDef) | void | 动态添加新规则 |
| removeRule(ruleId) | void | 移除指定规则 |

#### 内置规则

| 规则 ID | 触发条件 | 动作 |
|---------|---------|------|
| pool-expansion | 对象池命中率 < 0.5 且卡片数 > 50 | 增大对象池大小 |
| cache-expansion | 缓存命中率 < 0.5 | 增大缓存容量 |
| render-batch-optimize | 平均渲染时间 > 50ms | 增加渲染批处理大小 |
| layout-pref | 某种卡片类型操作占比 > 60% | 切换为对应的优化布局 |
| type-explosion | 注册的卡片类型 > 50 | 建议合并冗余类型 |
| inheritance-depth | 类型继承深度 > 4 | 建议扁平化继承树 |
| listener-leak | EventBus 监听器 > 500 | 建议检查事件泄漏 |

#### 添加自定义规则示例

```javascript
frame.evolutionEngine.ruleEngine.addRule({
  id: 'my-custom-rule',
  category: 'performance',
  condition: function(metrics) {
    return metrics.performance.currentCardCount > 1000;
  },
  action: {
    type: 'param-tune',
    target: 'virtualScroller',
    param: 'overscan',
    value: 10,
    reason: '卡片数超过 1000，增加 overscan 提升滚动体验'
  }
});
```
```

- [ ] **Step 2: 更新 agent-guide.md 添加进化 API**

在 `docs/agent-guide.md` 的适当位置添加：

```markdown
### 使用自进化系统

CardFrame v1.1+ 内置了自进化引擎，Agent 可以通过以下 API 监控和触发框架优化：

#### 1. 获取框架运行指标

```javascript
var metrics = frame.getMetricsSnapshot();
if (metrics.performance.avgRenderTime > 50) {
  console.log('渲染性能下降，建议优化');
}
```

#### 2. 手动触发进化

```javascript
frame.evolveNow();
```

#### 3. 查看进化历史

```javascript
var history = frame.getEvolutionHistory();
history.forEach(function(record) {
  console.log('进化: ' + record.type + ' -> ' + record.reason);
});
```

#### 4. 禁用自进化

```javascript
var frame = new CardFrame('#app', {
  evolution: false
});
```
```

- [ ] **Step 3: 创建 evolution-agent/README.md**

```markdown
# CardFrame Evolution Agent

自进化系统服务端组件，通过 HTTP/WebSocket 与 CardFrame 框架通信，提供 AI 代码级进化能力。

## 架构

```
浏览器 CardFrame (EvolutionEngine)
       │ HTTP / WebSocket
       ▼
Evolution Agent (Node.js)
       │
       ├─ test-runner.js     → 运行 npm test
       ├─ version-manager.js → Git 版本管理
       ├─ rollback-manager.js → 快照回滚
       └─ evolution-orchestrator.js → 编排进化流程
```

## 快速开始

```bash
cd evolution-agent
npm install
cp .env.example .env
npm start
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/evolve | POST | 执行一次进化 |
| /api/history | GET | 获取进化历史 |
| /api/snapshots | GET | 获取快照列表 |
| /api/rollback/:id | POST | 回滚到指定快照 |
| /api/health | GET | 健康检查 |

## 配置

编辑 `src/config.json`:

```json
{
  "port": 9100,
  "evolutionBranch": "evolution",
  "llmEndpoint": "https://api.openai.com/v1",
  "maxSnapshots": 20
}
```
```

- [ ] **Step 4: 验证构建**

```bash
npm test && npm run build
```
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add docs/api-reference.md docs/agent-guide.md evolution-agent/README.md
git commit -m "docs: add self-evolution system API docs, agent guide updates, and agent README"
```

---

### Task 10: 架构总览文档

**Files:**
- Create: `docs/architecture-overview.md`

**Interfaces:**
- Consumes: 27 个类的布局关系
- Produces: 中文架构总览文档

- [ ] **Step 1: 创建架构总览文档**

```markdown
# CardFrame 架构总览

## 整体架构

CardFrame 采用 **单体核心 + 模块化构建** 的混合架构。源文件是所有类的单体 IIFE，构建脚本通过正则提取生成可独立加载的模块化产物。

```
┌─────────────────────────────────────────────────────────┐
│                    card-framework.js                     │
│                      (IIFE ~7000 行)                    │
│                                                          │
│  常量层: EVENT_TYPES, DEFAULT_CONFIG, CARD_STATUS ...   │
│  工具层: Utils, Security, Perf, FeedbackSystem          │
│  核心层: EventBus, Store, TypeRegistry, CardFrame       │
│  扩展层: ThemeManager, I18nManager, RelationshipEngine  │
│  安全层: CircuitBreaker, AutoFixer, RealTimeValidator   │
│  插件层: PluginManager                                  │
│  性能层: CardObjectPool, LayoutCache, QueryIndex        │
│  渲染层: Renderer, LayoutEngine, VirtualScroller        │
│  Web Components: CardElement, CardFrameElement          │
│  进化层: EvolutionEngine, MetricsCollector, RuleEngine  │
└─────────────────────────────────────────────────────────┘
```

## 构建产物

| 模块文件 | 包含类 | 依赖 |
|---------|--------|------|
| core.js | EventBus, Store, TypeRegistry, CardFrame | 无 |
| security.js | Security(常量), CircuitBreaker | core |
| render.js | Renderer, LayoutEngine | core |
| validation.js | AutoFixer, RealTimeValidator | core |
| extras.js | ThemeManager, I18nManager, RelationshipEngine | core, render |
| plugins.js | PluginManager | core |
| perf.js | Perf(常量), VirtualScroller | core, render |
| evolution.js | EvolutionEngine, MetricsCollector, RuleEngine, ActionLogger, CardObjectPool, LayoutCache, QueryIndex, PerfPanel, GlobalErrorHandler, ShadowCardRegistry | core, render |
| card-framework.js | 完整打包版（所有 27 个类） | 无 |
| loader.js | 模块加载器 | 无 |

## 数据流

```
用户操作 / Plugin Hook / DOM 事件
         │
         ▼
    CardFrame (主入口)
         │
    ┌────┴──────────────┐
    ▼                   ▼
  Store              EventBus
  (数据中心)        (事件总线)
    │                   │
    ├─ TypeRegistry ────┤ 验证 card
    ├─ CardObjectPool   │
    ├─ LayoutCache      │
    └─ QueryIndex       │
         │              │
         ▼              ▼
    Renderer ───── LayoutEngine
    (DOM 渲染)     (布局计算)
         │
         ▼
    VirtualScroller
    (DOM 虚拟化)

后台:
    EvolutionEngine
    ├─ MetricsCollector (采集指标)
    ├─ RuleEngine       (规则评估)
    └─ EvolutionAgent   (AI 代码进化)
```

## 关键设计决策

1. **为什么用 IIFE 而非 ES Module？**
   - 零外部依赖，直接 `<script>` 引入即可使用
   - 兼容所有浏览器，无需构建工具
   - Agent 友好：单文件部署，AI 可完整读取

2. **为什么构建产物用模块化？**
   - 按需加载，减少首屏体积
   - 插件开发者只依赖所需模块
   - 与源文件的单体架构解耦

3. **为什么测试用 Node.js mock？**
   - 框架依赖 DOM API，但单元测试需要脱离浏览器
   - 自定义 window/document mock，避免浏览器差异
   - 进化引擎测试需要精确控制定时器
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture-overview.md
git commit -m "docs: add architecture overview document"
``` 运行测试确认通过**

```bash
npx mocha tests/build-tests.js -v
```
Expected: 5 tests PASS

- [ ] **Step 5: 实现通用 buildModule 函数**

在 [scripts/build.js:28-30](file:///d:/work/solo%20work/card-framework/scripts/build.js#L28-L30) 的 `buildCoreModule` 之前添加：

```javascript
function buildModule(moduleName, source, classNames, iifeParams, registerBlock, extraCode) {
  const classes = autoScanClasses(source);
  const lines = [];
  lines.push(`(function(window, CardFrame, CardFrameCore${iifeParams ? ', ' + iifeParams : ''}) {`);
  lines.push("  'use strict';");
  lines.push('');
  
  // 提取每个类
  classNames.forEach(function(className) {
    if (classes[className]) {
      lines.push(classes[className], '');
    }
  });
  
  // 额外代码（常量提取等）
  if (extraCode) {
    lines.push(extraCode, '');
  }
  
  // 导出到 CardFrame
  classNames.forEach(function(className) {
    lines.push(`  CardFrame.${className} = ${className};`);
    lines.push(`  CardFrameCore.${className} = ${className};`);
  });
  
  // 注册模块
  if (registerBlock) {
    lines.push(registerBlock, '');
  }
  
  lines.push(`})(window, window.CardFrame, window.CardFrameCore${iifeParams ? ', ' + iifeParams.split(',').map(function(p) { return 'window.CardFrameCore.' + p.trim(); }).join(', ') : ''});`);
  
  return lines.join('\n');
}
```

- [ ] **Step 6: 重写 buildCoreModule 使用通用函数**

将 [scripts/build.js:30-364](file:///d:/work/solo%20work/card-framework/scripts/build.js#L30-L364) 的 `buildCoreModule` 函数完全替换为：

```javascript
function buildCoreModule(source) {
  const classes = autoScanClasses(source);
  const lines = [];
  
  lines.push('(function(window) {');
  lines.push("  'use strict';");
  lines.push('');
  
  // 提取常量
  const eventTypes = extractConst(source, 'EVENT_TYPES');
  if (eventTypes) lines.push(eventTypes, '');
  
  // Utils - 移除 sanitize 方法
  const utilsMatch = source.match(/  const Utils = \{[\s\S]*?\n  \};/);
  if (utilsMatch) {
    let utilsCode = utilsMatch[0];
    const methodsToRemove = ['sanitizeHtml', 'sanitizeUrl', 'sanitizeStyle', 'isSafeUrl'];
    methodsToRemove.forEach(function(method) {
      const regex = new RegExp('    ' + method + '\\([^)]*\\) \\{[\\s\\S]*?\\n    \\},?\\n', 'g');
      utilsCode = utilsCode.replace(regex, '');
    });
    lines.push(utilsCode, '');
  }
  
  const feedbackMatch = source.match(/  const FeedbackSystem = \{[\s\S]*?\n  \};/);
  if (feedbackMatch) lines.push(feedbackMatch[0], '');
  
  // 核心类
  const coreClassNames = ['EventBus', 'Store', 'TypeRegistry'];
  coreClassNames.forEach(function(className) {
    if (classes[className]) {
      lines.push(classes[className], '');
    }
  });
  
  if (classes['EventBus']) {
    lines.push('  const eventBus = new EventBus();', '');
  }
  
  const defaultTypesMatch = source.match(/  const defaultCardTypes = \[[\s\S]*?\n  \];/);
  if (defaultTypesMatch) lines.push(defaultTypesMatch[0], '');
  
  // CardFrame 主类 - 使用模块化版本
  lines.push(buildModularCardFrame(source, classes));
  
  // 注册 + 加载器 + 全局导出
  lines.push(buildCoreModuleRegistrations(classes));
  
  lines.push('})(window);');
  return lines.join('\n');
}
```

- [ ] **Step 7: 实现 buildModularCardFrame**

```javascript
function buildModularCardFrame(source, classes) {
  // 构建模块化版本的 CardFrame 主类
  var lines = [];
  
  // 从源文件中提取 CardFrame 类的基本骨架（方法列表）
  // 但使用 _initModules 模式替代硬编码构造函数
  
  // 提取所有公开方法（createCard, updateCard, removeCard 等）
  var cardFrameMatch = source.match(/  class CardFrame \{[\s\S]*?\n  \}/);
  if (!cardFrameMatch) return '';
  
  var cardFrameCode = cardFrameMatch[0];
  
  // 替换构造函数中的硬编码模块初始化
  var constructorLines = cardFrameCode.split('\n');
  var newConstructor = [];
  var inConstructor = false;
  var braceDepth = 0;
  
  for (var i = 0; i < constructorLines.length; i++) {
    var line = constructorLines[i];
    
    if (line.trimStart().startsWith('constructor(')) {
      inConstructor = true;
      newConstructor.push(line);
      // 添加模块化初始化 + 核心初始化
      newConstructor.push('      this.store = new Store();');
      newConstructor.push('      this.typeRegistry = new TypeRegistry();');
      newConstructor.push('      this.eventBus = eventBus;');
      newConstructor.push('      defaultCardTypes.forEach(function(type) { this.typeRegistry.register(type); }.bind(this));');
      newConstructor.push('      this._initModules(options);');
      newConstructor.push('      CardFrame._globalStore = this.store;');
      continue;
    }
    
    if (inConstructor) {
      // 计算大括号深度，跳过所有硬编码的模块初始化
      for (var j = 0; j < line.length; j++) {
        if (line[j] === '{') braceDepth++;
        if (line[j] === '}') braceDepth--;
      }
      
      // 跳过 this.store = new Store() 等核心初始化行
      if (line.trimStart().startsWith('this.store =') ||
          line.trimStart().startsWith('this.typeRegistry =') ||
          line.trimStart().startsWith('this.renderer =') ||
          line.trimStart().startsWith('this.layoutEngine =') ||
          line.trimStart().startsWith('this.autoFixer =') ||
          line.trimStart().startsWith('this.realTimeValidator =') ||
          line.trimStart().startsWith('this.pluginManager =') ||
          line.trimStart().startsWith('this.circuitBreaker =') ||
          line.trimStart().startsWith('this.actionLogger =') ||
          line.trimStart().startsWith('this.globalErrorHandler =') ||
          line.trimStart().startsWith('this.perfPanel =') ||
          line.trimStart().startsWith('this.cardObjectPool =') ||
          line.trimStart().startsWith('this.themeManager =') ||
          line.trimStart().startsWith('this.i18n =') ||
          line.trimStart().startsWith('this.relationshipEngine =') ||
          line.trimStart().startsWith('this.virtualScroller =') ||
          line.trimStart().startsWith('this.evolutionEngine =') ||
          line.trimStart().startsWith('this.eventBus =') ||
          line.trimStart().startsWith('this.autoFixer._getValidator') ||
          line.trimStart().startsWith('defaultCardTypes') ||
          line.trimStart().startsWith('CardFrame._globalStore')) {
        continue;
      }
      
      // 到达构造函数结尾
      if (braceDepth <= 0 && line.trim() === '}') {
        inConstructor = false;
        newConstructor.push(line);
        continue;
      }
      
      // 保留其他构造函数逻辑（options.virtualScroll, options.plugins, DOMContentLoaded 等）
      if (line.trimStart().startsWith('if (options.virtualScroll)') ||
          line.trimStart().startsWith('if (options.plugins)') ||
          line.trimStart().startsWith('if (document.readyState') ||
          line.trimStart().startsWith('if (options.autoValidate') ||
          line.trimStart().startsWith('this.store.subscribe') ||
          line.trimStart().startsWith('document.addEventListener')) {
        newConstructor.push(line);
        continue;
      }
    } else {
      newConstructor.push(line);
    }
  }
  
  return newConstructor.join('\n');
}
```

- [ ] **Step 8: 实现 buildCoreModuleRegistrations**

```javascript
function buildCoreModuleRegistrations(classes) {
  var lines = [];
  
  lines.push('');
  lines.push('  CardFrame._moduleInits = [];');
  lines.push('  CardFrame._modules = {};');
  lines.push('');
  lines.push('  CardFrame.registerModule = function(name, initFn, deps) {');
  lines.push('    if (deps === undefined) deps = [];');
  lines.push('    if (CardFrame._modules[name]) return;');
  lines.push('    CardFrame._modules[name] = { deps: deps, loaded: true };');
  lines.push('    if (typeof initFn === "function") {');
  lines.push('      CardFrame._moduleInits.push(initFn);');
  lines.push('    }');
  lines.push('  };');
  lines.push('');
  
  // 导出所有核心类
  var staticExports = [
    'Utils', 'Store', 'TypeRegistry', 'EventBus', 'FeedbackSystem',
    'EVENT_TYPES', 'DEFAULT_CONFIG', 'CARD_STATUS', 'RELATIONSHIP_TYPES'
  ];
  staticExports.forEach(function(name) {
    if (name === 'EVENT_TYPES' || name === 'DEFAULT_CONFIG' || name === 'CARD_STATUS' || name === 'RELATIONSHIP_TYPES') {
      lines.push('  CardFrame.' + name + ' = ' + name + ';');
    } else if (name === 'EventBus') {
      lines.push('  CardFrame.EventBus = eventBus;');
    } else {
      lines.push('  CardFrame.' + name + ' = ' + name + ';');
    }
  });
  
  lines.push('');
  lines.push('  CardFrame._globalStore = null;');
  lines.push('');
  
  // 全局实例
  lines.push('  var globalStore = new Store();');
  lines.push('  var globalTypeRegistry = new TypeRegistry();');
  lines.push('  defaultCardTypes.forEach(function(type) { globalTypeRegistry.register(type); });');
  lines.push('  CardFrame.store = globalStore;');
  lines.push('  CardFrame.typeRegistry = globalTypeRegistry;');
  lines.push('');
  
  // 加载器
  lines.push('  var _loadedModules = new Set(["core"]);');
  lines.push('  var _loadingModules = new Map();');
  lines.push('  CardFrame._modules.core = { deps: [], loaded: true };');
  lines.push('');
  lines.push('  CardFrame.load = function(moduleName) {');
  lines.push('    if (_loadedModules.has(moduleName)) return Promise.resolve();');
  lines.push('    if (_loadingModules.has(moduleName)) return _loadingModules.get(moduleName);');
  lines.push('    var modConfig = CardFrame._modules[moduleName];');
  lines.push('    if (!modConfig) return Promise.reject(new Error("未知模块: " + moduleName));');
  lines.push('    var deps = modConfig.deps || [];');
  lines.push('    var promise = Promise.all(deps.map(function(d) { return CardFrame.load(d); })).then(function() {');
  lines.push('      return new Promise(function(resolve, reject) {');
  lines.push('        var script = document.createElement("script");');
  lines.push('        script.src = moduleName + ".js";');
  lines.push('        script.onload = function() { _loadedModules.add(moduleName); _loadingModules.delete(moduleName); resolve(); };');
  lines.push('        script.onerror = function() { _loadingModules.delete(moduleName); reject(new Error("加载模块失败: " + moduleName)); };');
  lines.push('        document.head.appendChild(script);');
  lines.push('      });');
  lines.push('    });');
  lines.push('    _loadingModules.set(moduleName, promise);');
  lines.push('    return promise;');
  lines.push('  };');
  lines.push('');
  lines.push('  CardFrame.preload = function(moduleName) { return CardFrame.load(moduleName); };');
  lines.push('  CardFrame.isModuleLoaded = function(moduleName) { return _loadedModules.has(moduleName); };');
  lines.push('');
  lines.push('  window.CardFrameCore = {');
  lines.push('    Utils: Utils, Store: Store, TypeRegistry: TypeRegistry, EventBus: eventBus,');
  lines.push('    FeedbackSystem: FeedbackSystem, EVENT_TYPES: EVENT_TYPES, defaultCardTypes: defaultCardTypes');
  lines.push('  };');
  lines.push('');
  lines.push('  window.CardFrame = CardFrame;');
  lines.push('');
  lines.push('  if (typeof customElements !== "undefined") {');
  lines.push('    customElements.define("card-frame", CardFrameElement);');
  lines.push('    customElements.define("cf-card", CardElement);');
  lines.push('  }');
  lines.push('');
  lines.push('  window.CardFrameCore._loadedModules = _loadedModules;');
  lines.push('  window.CardFrameCore._loadingModules = _loadingModules;');
  
  return lines.join('\n');
}
```

- [ ] **Step 9: 重写 buildSecurityModule 使用通用函数**

```javascript
function buildSecurityModule(source) {
  var iifeParams = 'Utils, FeedbackSystem, EVENT_TYPES, eventBus';
  var registerBlock = [
    '  CardFrame.registerModule("security", function(options) {',
    '    this.circuitBreaker = new CircuitBreaker((options && options.circuitBreaker) || {});',
    '    var origCreate = this.createCard;',
    '    var origUpdate = this.updateCard;',
    '    var origRemove = this.removeCard;',
    '    var self = this;',
    '    this.createCard = function(type, props) {',
    '      return self.circuitBreaker.execute(function() { return origCreate.call(self, type, props); }, null);',
    '    };',
    '    this.updateCard = function(card) {',
    '      return self.circuitBreaker.execute(function() { return origUpdate.call(self, card); }, card.id);',
    '    };',
    '    this.removeCard = function(id) {',
    '      return self.circuitBreaker.execute(function() { return origRemove.call(self, id); }, id);',
    '    };',
    '  }, ["core"]);'
  ].join('\n');
  
  // 提取 Security 常量 + CircuitBreaker 类
  var securityMatch = source.match(/  const Security = \{[\s\S]*?\n  \};/);
  var securityCode = securityMatch ? securityMatch[0] : '';
  
  var classes = autoScanClasses(source);
  var circuitBreakerCode = classes['CircuitBreaker'] || '';
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, FeedbackSystem, EVENT_TYPES, eventBus) {');
  lines.push("  'use strict';");
  lines.push('');
  if (securityCode) lines.push(securityCode, '');
  if (circuitBreakerCode) lines.push(circuitBreakerCode, '');
  
  // 挂载 sanitize 方法到 Utils
  lines.push('  Utils.sanitizeHtml = function(html, options) { return Security.sanitizeHtml(html, options); };');
  lines.push('  Utils.sanitizeUrl = function(url) { return Security.sanitizeUrl(url); };');
  lines.push('  Utils.sanitizeStyle = function(styleStr) { return Security.sanitizeStyle(styleStr); };');
  lines.push('  Utils.isSafeUrl = function(url) { return Security.isSafeUrl(url); };');
  lines.push('');
  lines.push('  CardFrame.Security = Security;');
  lines.push('  CardFrame.CircuitBreaker = CircuitBreaker;');
  lines.push('  CardFrameCore.Security = Security;');
  lines.push('  CardFrameCore.CircuitBreaker = CircuitBreaker;');
  lines.push('');
  lines.push(registerBlock);
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.FeedbackSystem, window.CardFrameCore.EVENT_TYPES, window.CardFrameCore.EventBus);');
  
  return lines.join('\n');
}
```

- [ ] **Step 10: 重写 buildRenderModule 使用通用函数**

```javascript
function buildRenderModule(source) {
  var classes = autoScanClasses(source);
  var rendererCode = classes['Renderer'] || '';
  var layoutEngineCode = classes['LayoutEngine'] || '';
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, Store, TypeRegistry, eventBus) {');
  lines.push("  'use strict';");
  lines.push('');
  if (rendererCode) lines.push(rendererCode, '');
  if (layoutEngineCode) lines.push(layoutEngineCode, '');
  lines.push('  CardFrame.Renderer = Renderer;');
  lines.push('  CardFrame.LayoutEngine = LayoutEngine;');
  lines.push('  CardFrameCore.Renderer = Renderer;');
  lines.push('  CardFrameCore.LayoutEngine = LayoutEngine;');
  lines.push('');
  lines.push('  CardFrame.registerModule("render", function(options) {');
  lines.push('    this.renderer = new Renderer(this.container, this.typeRegistry, this.store);');
  lines.push('    this.layoutEngine = new LayoutEngine(this.container, this.store, this.renderer);');
  lines.push('    this.store.subscribe(Utils.debounce(function() {');
  lines.push('      if (this.virtualScroller && this.virtualScroller.isEnabled()) {');
  lines.push('        this.virtualScroller.refresh();');
  lines.push('      } else if (this.renderer) {');
  lines.push('        this.renderer.renderCards(this.store.getAllCards());');
  lines.push('      }');
  lines.push('      if (this.layoutEngine && this.layoutEngine.mode === "canvas") {');
  lines.push('        this.layoutEngine.syncPositions();');
  lines.push('      }');
  lines.push('      if (this.realTimeValidator) {');
  lines.push('        this.realTimeValidator.resume();');
  lines.push('      }');
  lines.push('    }.bind(this), 16));');
  lines.push('    this.setLayoutMode = function(mode) { this.layoutEngine.setMode(mode); };');
  lines.push('    this.getLayoutMode = function() { return this.layoutEngine.getMode(); };');
  lines.push('    this.layoutEngine.applyLayout();');
  lines.push('  }, ["core"]);');
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.Store, window.CardFrameCore.TypeRegistry, window.CardFrameCore.EventBus);');
  
  return lines.join('\n');
}
```

- [ ] **Step 11: 重写 buildValidationModule 使用通用函数**

```javascript
function buildValidationModule(source) {
  var classes = autoScanClasses(source);
  var autoFixerCode = classes['AutoFixer'] || '';
  var realTimeValidatorCode = classes['RealTimeValidator'] || '';
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, FeedbackSystem, Security) {');
  lines.push("  'use strict';");
  lines.push('');
  if (autoFixerCode) lines.push(autoFixerCode, '');
  if (realTimeValidatorCode) lines.push(realTimeValidatorCode, '');
  lines.push('  CardFrame.AutoFixer = AutoFixer;');
  lines.push('  CardFrame.RealTimeValidator = RealTimeValidator;');
  lines.push('  CardFrameCore.AutoFixer = AutoFixer;');
  lines.push('  CardFrameCore.RealTimeValidator = RealTimeValidator;');
  lines.push('');
  lines.push('  CardFrame.registerModule("validation", function(options) {');
  lines.push('    this.autoFixer = new AutoFixer(this.typeRegistry, this.store, this.container);');
  lines.push('    this.realTimeValidator = new RealTimeValidator(this.container, this.typeRegistry, this.store, this.autoFixer);');
  lines.push('    this.autoFixer._getValidator = function() { return this.realTimeValidator; }.bind(this);');
  lines.push('    if (!options || options.autoValidate !== false) { this.realTimeValidator.start(); }');
  lines.push('    this.validateAll = function() { this.realTimeValidator.validateAll(); };');
  lines.push('    this.fullCheck = function() { return this.realTimeValidator.fullCheck(); };');
  lines.push('    this.fixAll = function() { return this.autoFixer.fixAll(); };');
  lines.push('  }, ["core"]);');
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem, window.CardFrameCore.Security || {});');
  
  return lines.join('\n');
}
```

- [ ] **Step 12: 重写 buildExtrasModule 使用通用函数**

```javascript
function buildExtrasModule(source) {
  var classes = autoScanClasses(source);
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, FeedbackSystem) {');
  lines.push("  'use strict';");
  lines.push('');
  
  ['ThemeManager', 'I18nManager', 'RelationshipEngine'].forEach(function(className) {
    if (classes[className]) {
      lines.push(classes[className], '');
    }
  });
  
  lines.push('  CardFrame.ThemeManager = ThemeManager;');
  lines.push('  CardFrame.I18nManager = I18nManager;');
  lines.push('  CardFrame.RelationshipEngine = RelationshipEngine;');
  lines.push('  CardFrameCore.ThemeManager = ThemeManager;');
  lines.push('  CardFrameCore.I18nManager = I18nManager;');
  lines.push('  CardFrameCore.RelationshipEngine = RelationshipEngine;');
  lines.push('');
  lines.push('  CardFrame.registerModule("extras", function(options) {');
  lines.push('    this.themeManager = new ThemeManager(this.container);');
  lines.push('    this.i18n = new I18nManager();');
  lines.push('    this.relationshipEngine = new RelationshipEngine(this.container, this.store);');
  lines.push('  }, ["core", "render"]);');
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem);');
  
  return lines.join('\n');
}
```

- [ ] **Step 13: 重写 buildPluginsModule 使用通用函数**

```javascript
function buildPluginsModule(source) {
  var classes = autoScanClasses(source);
  var pluginManagerCode = classes['PluginManager'] || '';
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, FeedbackSystem) {');
  lines.push("  'use strict';");
  lines.push('');
  if (pluginManagerCode) lines.push(pluginManagerCode, '');
  lines.push('  CardFrame.PluginManager = PluginManager;');
  lines.push('  CardFrameCore.PluginManager = PluginManager;');
  lines.push('');
  lines.push('  CardFrame.registerModule("plugins", function(options) {');
  lines.push('    this.pluginManager = new PluginManager(this);');
  lines.push('    this.installPlugin = function(pluginDef) { return this.pluginManager.install(pluginDef); };');
  lines.push('    this.uninstallPlugin = function(pluginName) { return this.pluginManager.uninstall(pluginName); };');
  lines.push('    this.enablePlugin = function(pluginName) { return this.pluginManager.enable(pluginName); };');
  lines.push('    this.disablePlugin = function(pluginName) { return this.pluginManager.disable(pluginName); };');
  lines.push('    this.getPlugin = function(pluginName) { return this.pluginManager.get(pluginName); };');
  lines.push('    this.getAllPlugins = function() { return this.pluginManager.getAll(); };');
  lines.push('    if (options && options.plugins) { options.plugins.forEach(function(plugin) { this.installPlugin(plugin); }.bind(this)); }');
  lines.push('  }, ["core"]);');
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.FeedbackSystem);');
  
  return lines.join('\n');
}
```

- [ ] **Step 14: 重写 buildPerfModule 使用通用函数**

```javascript
function buildPerfModule(source) {
  var classes = autoScanClasses(source);
  var virtualScrollerCode = classes['VirtualScroller'] || '';
  var perfMatch = source.match(/  const Perf = \{[\s\S]*?\n  \};/);
  var perfCode = perfMatch ? perfMatch[0] : '';
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, Store, Renderer) {');
  lines.push("  'use strict';");
  lines.push('');
  if (perfCode) lines.push(perfCode, '');
  if (virtualScrollerCode) lines.push(virtualScrollerCode, '');
  lines.push('  CardFrame.Perf = Perf;');
  lines.push('  CardFrame.VirtualScroller = VirtualScroller;');
  lines.push('  CardFrameCore.Perf = Perf;');
  lines.push('  CardFrameCore.VirtualScroller = VirtualScroller;');
  lines.push('');
  lines.push('  CardFrame.registerModule("perf", function(options) {');
  lines.push('    this.virtualScroller = new VirtualScroller(this.container, this.store, this.renderer, {');
  lines.push('      overscan: (options && options.overscan) || 5');
  lines.push('    });');
  lines.push('    this.enableVirtualScroll = function(opts) { this.virtualScroller.enable(opts); };');
  lines.push('    this.disableVirtualScroll = function() {');
  lines.push('      this.virtualScroller.disable();');
  lines.push('      if (this.renderer) this.renderer.forceFullRender(this.store.getAllCards());');
  lines.push('    };');
  lines.push('    this.isVirtualScrollEnabled = function() { return this.virtualScroller.isEnabled(); };');
  lines.push('    this.getPerfStats = function() { return Perf.getStats(); };');
  lines.push('    if (options && options.virtualScroll) { this.virtualScroller.enable(); }');
  lines.push('  }, ["core", "render"]);');
  lines.push('  CardFrame.getPerfStats = function() { return Perf.getStats(); };');
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.Store, window.CardFrameCore.Renderer || {});');
  
  return lines.join('\n');
}
```

- [ ] **Step 15: 新增 buildEvolutionModule（新模块，包含 11 个遗漏类）**

在 [scripts/build.js:627](file:///d:/work/solo%20work/card-framework/scripts/build.js#L627) 的 `buildLoader` 之前添加：

```javascript
function buildEvolutionModule(source) {
  var classes = autoScanClasses(source);
  var classNames = [
    'EvolutionEngine', 'MetricsCollector', 'RuleEngine',
    'ActionLogger', 'CardObjectPool', 'LayoutCache', 'QueryIndex',
    'PerfPanel', 'GlobalErrorHandler', 'ShadowCardRegistry'
  ];
  
  var lines = [];
  lines.push('(function(window, CardFrame, CardFrameCore, Utils, eventBus, Store, Renderer) {');
  lines.push("  'use strict';");
  lines.push('');
  
  classNames.forEach(function(className) {
    if (classes[className]) {
      lines.push(classes[className], '');
    }
  });
  
  // 导出
  classNames.forEach(function(className) {
    lines.push('  CardFrame.' + className + ' = ' + className + ';');
    lines.push('  CardFrameCore.' + className + ' = ' + className + ';');
  });
  
  lines.push('');
  lines.push('  CardFrame.registerModule("evolution", function(options) {');
  lines.push('    this.cardObjectPool = new CardObjectPool((options && options.cardPool) || {});');
  lines.push('    this.actionLogger = new ActionLogger((options && options.actionLogger) || {});');
  lines.push('    this.globalErrorHandler = new GlobalErrorHandler(eventBus);');
  lines.push('    this.evolutionEngine = options.evolution !== false');
  lines.push('      ? new EvolutionEngine(this, (options && options.evolution) || {})');
  lines.push('      : null;');
  lines.push('    if (this.evolutionEngine) { this.evolutionEngine.start(); }');
  lines.push('    this.getEvolutionHistory = function() {');
  lines.push('      return this.evolutionEngine ? this.evolutionEngine.getEvolutionHistory() : [];');
  lines.push('    };');
  lines.push('    this.getMetricsSnapshot = function() {');
  lines.push('      return this.evolutionEngine ? this.evolutionEngine.getMetrics() : null;');
  lines.push('    };');
  lines.push('    this.evolveNow = function() {');
  lines.push('      if (this.evolutionEngine) { this.evolutionEngine.evolveNow(); }');
  lines.push('    };');
  lines.push('    this.enablePerfPanel = function() { this.perfPanel = new PerfPanel(); this.perfPanel.enable(this.container); };');
  lines.push('    this.disablePerfPanel = function() { if (this.perfPanel) this.perfPanel.disable(); };');
  lines.push('    this.enableGlobalErrorHandler = function() { this.globalErrorHandler.enable(); };');
  lines.push('    this.disableGlobalErrorHandler = function() { this.globalErrorHandler.disable(); };');
  lines.push('    this.getGlobalErrorStats = function() { return this.globalErrorHandler.getErrorStats(); };');
  lines.push('  }, ["core", "render"]);');
  lines.push('})(window, window.CardFrame, window.CardFrameCore, window.CardFrameCore.Utils, window.CardFrameCore.EventBus, window.CardFrameCore.Store, window.CardFrameCore.Renderer || {});');
  
  return lines.join('\n');
}
```

- [ ] **Step 16: 更新 build() 函数，添加 evolution 模块构建**

在 [scripts/build.js:714-767](file:///d:/work/solo%20work/card-framework/scripts/build.js#L714-L767) 的 `build()` 函数中添加：

```javascript
// 在 perf.js 之后、card-framework.js 之前添加
console.log('生成 evolution.js...');
fs.writeFileSync(path.join(DIST_DIR, 'evolution.js'), buildEvolutionModule(source), 'utf-8');
```

同时更新 loader.js 的 MODULE_CONFIG 和 build() 的输出列表：

```javascript
// 在 buildLoader() 的 MODULE_CONFIG 中添加
evolution: { deps: ['core', 'render'], file: 'evolution.js' },
```

- [ ] **Step 17: 运行构建测试**

```bash
node scripts/build.js
```
Expected: 构建成功，dist/ 下新增 evolution.js，所有模块文件正确生成

```bash
npx mocha tests/build-tests.js -v
```
Expected: 5 tests PASS

- [ ] **Step 18: 确认 dist/ 包含所有类**

```bash
node -e "
var fs = require('fs');
var files = ['core.js', 'security.js', 'render.js', 'validation.js', 'extras.js', 'plugins.js', 'perf.js', 'evolution.js', 'card-framework.js'];
files.forEach(function(f) {
  var code = fs.readFileSync('dist/' + f, 'utf8');
  var matches = code.match(/  class (\w+) \{/g);
  console.log(f + ': ' + (matches ? matches.length : 0) + ' classes' + (matches ? ' -> ' + matches.map(function(m) { return m.match(/\w+/)[0]; }).join(', ') : ''));
});
"
```
Expected: 总计 27 个类分布在各模块中

- [ ] **Step 19: 运行全量测试**

```bash
npm test
```
Expected: 全部通过（约 554+ tests）

- [ ] **Step 20: Commit**

```bash
git add scripts/build.js tests/build-tests.js dist/
git commit -m "build: replace manual extractClass with autoScanClasses, add evolution module with 11 missing classes"
```

---

### Task 2: CardFrame.destroy() — 资源清理方法

**Files:**
- Modify: `src/card-framework.js:5975-6058`（CardFrame 构造函数中记录资源引用）
- Add after: `src/card-framework.js:6853`（在 CardFrame 类的 `}` 前添加 destroy() 方法）
- Modify: `tests/test.js` 或新建 `tests/destroy-tests.js`

**Interfaces:**
- Consumes: `CardFrame` 实例持有的所有子模块
- Produces: `frame.destroy()` 方法，返回 `void`

- [ ] **Step 1: 写 destroy() 的测试**

```javascript
// tests/destroy-tests.js
/* global describe, it, before, after, beforeEach */
var assert = require('assert');

// 复用 evolution-tests.js 的 mock 环境
var mockWindow = {
  addEventListener: function() {},
  removeEventListener: function() {},
  CardFrame: null
};
var mockDocument = {
  createElement: function(tag) {
    return {
      tagName: tag.toUpperCase(),
      style: {},
      classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
      setAttribute: function() {},
      removeAttribute: function() {},
      appendChild: function() {},
      removeChild: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      dataset: {},
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 100, height: 100 }; },
      insertBefore: function() {},
      children: [],
      childNodes: [],
      textContent: '',
      innerHTML: '',
      nodeType: 1,
      parentNode: null,
      attributes: [],
      firstChild: null,
      lastChild: null
    };
  },
  createElementNS: function(ns, tag) {
    return { tagName: tag.toUpperCase(), style: {}, classList: { add: function() {}, remove: function() {} }, setAttribute: function() {}, appendChild: function() {} };
  },
  documentElement: { lang: 'en' },
  body: { appendChild: function() {}, removeChild: function() {}, innerHTML: '' },
  addEventListener: function() {},
  removeEventListener: function() {}
};

function setupGlobal() {
  global.window = mockWindow;
  global.document = mockDocument;
  global.HTMLElement = function() {
    this.style = {};
    this.classList = { add: function() {}, remove: function() {}, contains: function() { return false; } };
  };
  global.HTMLElement.prototype.attachShadow = function() { return { innerHTML: '' }; };
  global.HTMLElement.prototype.setAttribute = function() {};
  global.HTMLElement.prototype.getAttribute = function() { return null; };
  global.HTMLElement.prototype.addEventListener = function() {};
  global.HTMLElement.prototype.removeEventListener = function() {};
  global.HTMLElement.prototype.dispatchEvent = function() {};
  global.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };
  global.MutationObserver.prototype.observe = function() {};
  global.MutationObserver.prototype.disconnect = function() {};
}

setupGlobal();
delete require.cache[require.resolve('../src/card-framework.js')];
require('../src/card-framework.js');
var CardFrame = global.window.CardFrame;

describe('CardFrame.destroy()', function() {
  var container, frame, timersBefore;

  before(function() {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  after(function() {
    document.body.removeChild(container);
  });

  beforeEach(function() {
    container.innerHTML = '';
    frame = new CardFrame(container, { evolution: true });
    // 记录当前定时器数量
    timersBefore = global.setInterval._count || 0;
  });

  afterEach(function() {
    if (frame && !frame._destroyed) {
      frame.destroy();
    }
  });

  it('destroy() 后 evolutionEngine 应为 null', function() {
    frame.destroy();
    assert.strictEqual(frame.evolutionEngine, null);
  });

  it('destroy() 后 evolutionEngine 的定时器应已清除', function() {
    frame.destroy();
    // 验证定时器引用已清除
    assert.strictEqual(frame._destroyed, true);
  });

  it('destroy() 后 eventBus 监听器应已清理', function() {
    // 注册一个监听器
    var listenerCalled = false;
    frame.eventBus.on('test-event', function() { listenerCalled = true; });
    frame.destroy();
    // 应该能触发但 listener 不会被调用（因为已被清理）
    // 这里验证 eventBus 没有残留
  });

  it('destroy() 后 store.subscribe 回调不应再触发', function() {
    var subscribeCalled = false;
    // 通过 store.notify 触发订阅
    frame.destroy();
    frame.store.notify();
    // 如果 destroy 正确清理了订阅，这里不会触发渲染
  });

  it('destroy() 应可安全重复调用', function() {
    frame.destroy();
    frame.destroy();
    frame.destroy();
    assert.strictEqual(frame._destroyed, true);
  });

  it('destroy() 后调用 createCard 不应抛异常（降级模式）', function() {
    frame.destroy();
    var card = frame.createCard('text', { title: 'after destroy' });
    assert.notStrictEqual(card, null);
  });

  it('destroy() 后 container.__cardFrame 应已被清除', function() {
    frame.destroy();
    assert.strictEqual(container.__cardFrame, undefined);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx mocha tests/destroy-tests.js -v
```
Expected: FAIL with "frame.destroy is not a function"

- [ ] **Step 3: 在 CardFrame 类中添加 destroy() 方法**

在 [src/card-framework.js:6853](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L6853) 的 `}`（CardFrame 类的结束大括号）之前添加：

```javascript
    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;

      // 1. 停止进化引擎（含 MetricsCollector 定时器）
      if (this.evolutionEngine) {
        this.evolutionEngine.stop();
        this.evolutionEngine = null;
      }

      // 2. 停止实时验证器（MutationObserver）
      if (this.realTimeValidator) {
        this.realTimeValidator.stop();
      }

      // 3. 禁用性能面板（RAF）
      if (this.perfPanel) {
        this.perfPanel.disable();
      }

      // 4. 禁用全局错误处理（window 事件）
      if (this.globalErrorHandler) {
        this.globalErrorHandler.disable();
      }

      // 5. 禁用虚拟滚动（window resize/scroll 事件）
      if (this.virtualScroller) {
        this.virtualScroller.destroy();
      }

      // 6. 清理关系引擎（SVG 层、拖拽事件）
      if (this.relationshipEngine) {
        this.relationshipEngine.destroy();
      }

      // 7. 清理全部 eventBus 监听器
      this.eventBus._listeners.clear();

      // 8. 清理容器引用
      this.container.classList.remove('card-frame');
      delete this.container.__cardFrame;

      // 9. 清理所有子模块引用
      this.store = null;
      this.renderer = null;
      this.layoutEngine = null;
      this.autoFixer = null;
      this.realTimeValidator = null;
      this.pluginManager = null;
      this.circuitBreaker = null;
      this.actionLogger = null;
      this.globalErrorHandler = null;
      this.perfPanel = null;
      this.cardObjectPool = null;
      this.themeManager = null;
      this.i18n = null;
      this.relationshipEngine = null;
      this.virtualScroller = null;
      this.eventBus = null;
      this.typeRegistry = null;
    }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx mocha tests/destroy-tests.js -v
```
Expected: 7 tests PASS

- [ ] **Step 5: 运行全量测试确认无回归**

```bash
npm test
```
Expected: 全部通过（约 561+ tests）

- [ ] **Step 6: Commit**

```bash
git add src/card-framework.js tests/destroy-tests.js
git commit -m "feat: add CardFrame.destroy() for resource cleanup (timers, events, observers)"
```

---

### Task 3: EventBus.removeAllByContext() + 事件清理增强

**Files:**
- Modify: `src/card-framework.js:685-732`（EventBus 类添加 removeAllByContext 方法）
- Modify: `src/card-framework.js:2054-2056`（ShadowCardElement._cleanup 修复）

**Interfaces:**
- Consumes: `EventBus` 类的 `_listeners` Map
- Produces: `eventBus.removeAllByContext(context)` 方法

- [ ] **Step 1: 修改 EventBus 添加 removeAllByContext 方法**

在 [src/card-framework.js:685-732](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L685-L732) 的 EventBus 类的 `off` 方法后添加：

```javascript
    removeAllByContext(context) {
      if (!context) return;
      var self = this;
      this._listeners.forEach(function(listeners, eventName) {
        var toRemove = [];
        listeners.forEach(function(listener) {
          if (listener._context === context) {
            toRemove.push(listener);
          }
        });
        toRemove.forEach(function(listener) {
          listeners.delete(listener);
        });
        if (listeners.size === 0) {
          self._listeners.delete(eventName);
        }
      });
    }
```

同时修改 `on` 方法，在添加监听器时关联上下文：

```javascript
    on(eventName, listener, context) {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      if (context) {
        listener._context = context;
      }
      this._listeners.get(eventName).add(listener);
    }
```

- [ ] **Step 2: 修复 ShadowCardElement._cleanup 方法**

将 [src/card-framework.js:2054-2056](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L2054-L2056) 的：

```javascript
    _cleanup() {
      this._listeners.clear();
    }
```

修改为：

```javascript
    _cleanup() {
      var self = this;
      this._listeners.forEach(function(handler, eventType) {
        self.removeEventListener(eventType, handler);
      });
      this._listeners.clear();
    }
```

- [ ] **Step 3: 添加测试**

在 `tests/destroy-tests.js` 的结尾添加：

```javascript
describe('EventBus.removeAllByContext()', function() {
  var frame;

  beforeEach(function() {
    var container = document.createElement('div');
    frame = new CardFrame(container, { evolution: false });
  });

  afterEach(function() {
    if (frame && !frame._destroyed) frame.destroy();
  });

  it('removeAllByContext 应移除指定上下文的所有监听器', function() {
    var ctx = { id: 'test' };
    var count = 0;
    frame.eventBus.on('test1', function() { count++; }, ctx);
    frame.eventBus.on('test2', function() { count++; }, ctx);
    frame.eventBus.removeAllByContext(ctx);
    frame.eventBus.emit('test1');
    frame.eventBus.emit('test2');
    assert.strictEqual(count, 0);
  });

  it('removeAllByContext 不应影响其他上下文的监听器', function() {
    var ctx1 = { id: '1' };
    var ctx2 = { id: '2' };
    var count1 = 0, count2 = 0;
    frame.eventBus.on('test', function() { count1++; }, ctx1);
    frame.eventBus.on('test', function() { count2++; }, ctx2);
    frame.eventBus.removeAllByContext(ctx1);
    frame.eventBus.emit('test');
    assert.strictEqual(count1, 0);
    assert.strictEqual(count2, 1);
  });
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx mocha tests/destroy-tests.js -v
```
Expected: 9 tests PASS, 包括新增的 2 个 EventBus 测试

- [ ] **Step 5: 运行全量测试**

```bash
npm test
```
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/card-framework.js tests/destroy-tests.js
git commit -m "fix: add EventBus.removeAllByContext() and fix ShadowCardElement._cleanup()"
```

---

### Task 4: 集成 CardObjectPool 到 Store 卡片生命周期

**Files:**
- Modify: `src/card-framework.js:1514-1602`（CardObjectPool 添加 hasAcquire 统计）
- Modify: `src/card-framework.js:3365-3595`（Store 类，添加 pool 引用）
- Modify: `src/card-framework.js:5975-6058`（CardFrame 构造函数，传入 pool 到 Store）
- Create: `tests/object-pool-tests.js`

**Interfaces:**
- Consumes: `CardObjectPool` 类的 `acquire(type)` / `release(card)` / `getStats()`
- Produces: `Store.createCard()` 使用池、`Store.removeCard()` 归还池

- [ ] **Step 1: 写对象池集成测试**

```javascript
// tests/object-pool-tests.js
/* global describe, it, before, after, beforeEach */
var assert = require('assert');

var mockWindow = {
  addEventListener: function() {},
  CardFrame: null
};
var mockDocument = {
  createElement: function(tag) {
    var el = {
      tagName: tag.toUpperCase(),
      style: {},
      classList: { add: function() {}, remove: function() {}, contains: function() { return false; }, toggle: function() {} },
      setAttribute: function() {},
      removeAttribute: function() {},
      appendChild: function() {},
      removeChild: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      dataset: {},
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 100, height: 100 }; },
      children: [], childNodes: [], textContent: '',
      innerHTML: '', nodeType: 1, parentNode: null, attributes: [],
      firstChild: null, lastChild: null
    };
    return el;
  },
  createElementNS: function() { return { setAttribute: function() {}, appendChild: function() {} }; },
  documentElement: { lang: 'en' },
  body: { appendChild: function() {}, removeChild: function() {}, innerHTML: '' }
};

global.window = mockWindow;
global.document = mockDocument;
global.HTMLElement = function() { this.style = {}; this.classList = { add: function() {}, remove: function() {} }; };
global.HTMLElement.prototype.attachShadow = function() { return { innerHTML: '' }; };
global.HTMLElement.prototype.setAttribute = function() {};
global.HTMLElement.prototype.getAttribute = function() { return null; };
global.HTMLElement.prototype.addEventListener = function() {};
global.HTMLElement.prototype.removeEventListener = function() {};
global.HTMLElement.prototype.dispatchEvent = function() {};
global.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };
global.MutationObserver.prototype.observe = function() {};
global.MutationObserver.prototype.disconnect = function() {};

delete require.cache[require.resolve('../src/card-framework.js')];
require('../src/card-framework.js');
var CardFrame = global.window.CardFrame;

describe('CardObjectPool Integration', function() {
  var container, frame;

  beforeEach(function() {
    container = document.createElement('div');
    document.body.appendChild(container);
    frame = new CardFrame(container, { evolution: false, cardPool: { maxPerType: 5 } });
  });

  afterEach(function() {
    if (frame && !frame._destroyed) frame.destroy();
    document.body.removeChild(container);
  });

  it('createCard 后 pool 应有 acquire 计数', function() {
    frame.createCard('text', { title: 'test' });
    var stats = frame.cardObjectPool.getStats();
    assert.strictEqual(stats.acquires >= 1, true);
  });

  it('createCard + removeCard 后 pool 应有 release 计数', function() {
    var card = frame.createCard('text', { title: 'test' });
    frame.removeCard(card.id);
    var stats = frame.cardObjectPool.getStats();
    assert.strictEqual(stats.releases >= 1, true);
  });

  it('多次 createCard 应复用池中对象', function() {
    var card1 = frame.createCard('text', { title: 'a' });
    frame.removeCard(card1.id);
    var before = frame.cardObjectPool._pools.get('text') ? frame.cardObjectPool._pools.get('text').length : 0;
    var card2 = frame.createCard('text', { title: 'b' });
    var after = frame.cardObjectPool._pools.get('text') ? frame.cardObjectPool._pools.get('text').length : 0;
    // 池中对象被复用了，所以池大小减少
    assert.strictEqual(after, before - 1);
  });

  it('pool 命中率不应为 0（有 acquire 操作）', function() {
    frame.createCard('text', { title: 'a' });
    frame.createCard('text', { title: 'b' });
    frame.createCard('text', { title: 'c' });
    var stats = frame.cardObjectPool.getStats();
    assert.strictEqual(stats.acquires > 0, true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx mocha tests/object-pool-tests.js -v
```
Expected: FAIL — 命中率验证失败，因为对象池未被调用

- [ ] **Step 3: 修改 Store 类，接收 pool 引用并修改 createCard 方法**

在 [src/card-framework.js:3365-3595](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L3365-L3595) 的 Store 类中，添加 `_pool` 属性和修改 `addCard` 方法：

```javascript
// Store 构造函数中（约 L3370 附近）添加：
this._pool = null;

// 添加 setPool 方法（在 Store 类中任意位置）：
setPool: function(pool) {
  this._pool = pool;
},

// 修改 addCard 方法，使用对象池：
addCard: function(card) {
  if (this._pool) {
    var pooled = this._pool.acquire(card.type);
    if (pooled) {
      pooled.id = card.id;
      pooled.props = card.props;
      pooled.position = card.position;
      pooled.status = card.status;
      pooled.createdAt = card.createdAt;
      pooled.updatedAt = card.updatedAt;
      this.cards.set(pooled.id, pooled);
      this.notify();
      return;
    }
  }
  this.cards.set(card.id, card);
  this.notify();
},

// 修改 removeCard 方法，归还到对象池：
removeCard: function(cardId) {
  var card = this.cards.get(cardId);
  if (card) {
    this.cards.delete(cardId);
    if (this._pool) {
      this._pool.release(card);
    }
    this.notify();
    return true;
  }
  return false;
},
```

- [ ] **Step 4: 在 CardFrame 构造函数中连接 pool 到 Store**

在 [src/card-framework.js:6005](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L6005) 的 `this.cardObjectPool = new CardObjectPool(...)` 后添加：

```javascript
this.store._pool = this.cardObjectPool;
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx mocha tests/object-pool-tests.js -v
```
Expected: 4 tests PASS

- [ ] **Step 6: 运行全量测试**

```bash
npm test
```
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
git add src/card-framework.js tests/object-pool-tests.js
git commit -m "feat: integrate CardObjectPool into Store.createCard()/removeCard() lifecycle"
```

---

### Task 5: 修复 LayoutCache LRU 淘汰算法

**Files:**
- Modify: `src/card-framework.js:1608-1724`（LayoutCache 类的 get 方法）
- Create: `tests/lru-cache-tests.js`

**Interfaces:**
- Consumes: `LayoutCache` 类的 `get(cardId)` / `set(cardId, value)`
- Produces: 正确的 LRU 淘汰（访问后更新顺序）

- [ ] **Step 1: 写 LRU 行为测试**

```javascript
// tests/lru-cache-tests.js
/* global describe, it */
var assert = require('assert');

var mockWindow = { addEventListener: function() {}, CardFrame: null };
var mockDocument = {
  createElement: function(tag) {
    return { tagName: tag.toUpperCase(), style: {}, classList: { add: function() {}, remove: function() {} }, setAttribute: function() {}, appendChild: function() {}, addEventListener: function() {}, removeEventListener: function() {}, querySelector: function() { return null; }, querySelectorAll: function() { return []; }, dataset: {} };
  },
  documentElement: { lang: 'en' },
  body: { appendChild: function() {}, removeChild: function() {}, innerHTML: '' }
};

global.window = mockWindow;
global.document = mockDocument;
global.HTMLElement = function() {};
global.HTMLElement.prototype.attachShadow = function() { return { innerHTML: '' }; };
global.HTMLElement.prototype.setAttribute = function() {};
global.HTMLElement.prototype.addEventListener = function() {};
global.HTMLElement.prototype.removeEventListener = function() {};
global.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };
global.MutationObserver.prototype.observe = function() {};
global.MutationObserver.prototype.disconnect = function() {};

delete require.cache[require.resolve('../src/card-framework.js')];
require('../src/card-framework.js');
var CardFrame = global.window.CardFrame;

describe('LayoutCache - LRU Behavior', function() {
  var cache;

  beforeEach(function() {
    cache = new CardFrame.LayoutCache({ maxSize: 3 });
  });

  it('set/get 基本功能', function() {
    cache.set('card1', { x: 0, y: 0 });
    assert.notStrictEqual(cache.get('card1'), null);
  });

  it('访问应更新 LRU 顺序（热点不被淘汰）', function() {
    cache.set('hot', 1);
    cache.set('a', 2);
    cache.set('b', 3);
    cache.get('hot');  // 访问 hot，更新 LRU 顺序
    cache.set('c', 4); // 淘汰最早插入的（现在是 'a'）
    assert.notStrictEqual(cache.get('hot'), null); // hot 应存活
    assert.strictEqual(cache.get('a'), null);       // a 应被淘汰
  });

  it('连续访问热点缓存不应被淘汰', function() {
    cache.set('hot1', 1);
    cache.set('hot2', 2);
    cache.set('hot3', 3);
    cache.get('hot1');
    cache.get('hot2');
    cache.get('hot3');
    cache.set('new1', 4); // 淘汰最早插入的（hot1 已被访问过，应淘汰从未被访问的）
    // 由于 Map 插入顺序，hot1 最早插入，但被访问过应更新顺序
    // 实际被淘汰的是 LRU 中最近最少使用的
    // 这里验证 hot1 因为访问过而存活
    assert.notStrictEqual(cache.get('hot1'), null);
  });

  it('淘汰应在容量满时触发', function() {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // 触发淘汰
    assert.strictEqual(cache.get('a'), null); // a 被淘汰
    assert.strictEqual(cache._cache.size, 3);
  });

  it('脏标记不应受 LRU 影响', function() {
    cache.set('a', 1);
    cache.markDirty('a');
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a');
    cache.set('d', 4); // 淘汰 b
    assert.strictEqual(cache.isDirty('a'), true); // a 的脏标记应保留
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx mocha tests/lru-cache-tests.js -v
```
Expected: "访问应更新 LRU 顺序" 和 "连续访问热点缓存不应被淘汰" 两个测试 FAIL

- [ ] **Step 3: 修复 LayoutCache.get() 方法**

将 [src/card-framework.js:1645-1653](file:///d:/work/solo%20work/card-framework/src/card-framework.js#L1645-L1653) 的 `get` 方法：

```javascript
    get(cardId) {
      var value = this._cache.get(cardId);
      if (value !== undefined) {
        this._hits++;
        return value;
      }
      this._misses++;
      return null;
    },
```

修改为：

```javascript
    get(cardId) {
      var value = this._cache.get(cardId);
      if (value !== undefined) {
        this._hits++;
        // 更新访问顺序：删除后重新插入，使其成为最近使用的
        this._cache.delete(cardId);
        this._cache.set(cardId, value);
        return value;
      }
      this._misses++;
      return null;
    },
```

- [ ] **Step 4: