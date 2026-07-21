> **ARCHIVED / 非当前**：本文档为历史材料，结论与行号可能已失效。现行事实见 `docs/architecture-overview.md` 与 `src/`。索引：`docs/archive/README.md`。

> 📜 **历史规划/评估记录（Phase 4 之前）**
> 本文件是重构时期的规划/评估报告，描述的目标已在当前 ES Module + esbuild + jsdom 代码中实现。
> 其中的代码行号、旧架构论断（单体/正则/mock）**已不适用**。当前事实以 `docs/architecture-overview.md` 与源码为准。
# CardFrame v2.0 测试规范

> **目标：** 为 v2.0 所有升级模块制定完整的测试规范，确保每项修改都有对应的测试覆盖
>
> **原则：**
> 1. 所有新增测试必须是运行时行为测试，禁止静态字符串匹配
> 2. 每个测试文件必须有 `beforeEach`/`afterEach` 确保隔离
> 3. 每个 describe 块结束后必须清理所有副作用（定时器、事件、DOM）
> 4. 测试文件命名遵守 `tests/<module>-tests.js` 模式

---

## 1. 测试基础设施

### 1.1 通用 Mock 环境（所有测试文件复用）

```javascript
// tests/_mock.js — 共享 Mock 环境
var mockWindow = {
  addEventListener: function() {},
  removeEventListener: function() {},
  CardFrame: null,
  requestAnimationFrame: function(cb) { if (cb) cb(); },
  cancelAnimationFrame: function() {},
  innerHeight: 900,
  innerWidth: 1440
};

var mockDocument = {
  createElement: function(tag) {
    var el = {
      tagName: tag.toUpperCase(), style: {},
      classList: {
        add: function() {}, remove: function() {},
        contains: function() { return false; }, toggle: function() {}
      },
      setAttribute: function() {}, removeAttribute: function() {},
      appendChild: function() {}, removeChild: function() {},
      addEventListener: function() {}, removeEventListener: function() {},
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      getBoundingClientRect: function() { return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }; },
      dataset: {},
      children: [], childNodes: [], textContent: '', innerHTML: '',
      nodeType: 1, parentNode: null, attributes: [],
      firstChild: null, lastChild: null,
      scrollTop: 0, scrollHeight: 0, clientHeight: 800, clientWidth: 800
    };
    return el;
  },
  createElementNS: function(ns, tag) {
    return { tagName: tag.toUpperCase(), style: {},
      classList: { add: function() {}, remove: function() {} },
      setAttribute: function() {}, appendChild: function() {}
    };
  },
  documentElement: { lang: 'en' },
  body: {
    appendChild: function() {}, removeChild: function() {},
    innerHTML: '', querySelector: function() { return null; },
    querySelectorAll: function() { return []; }
  },
  addEventListener: function() {}, removeEventListener: function() {},
  readyState: 'complete'
};

var mockHTMLElement = function() {
  this.style = {};
  this.classList = { add: function() {}, remove: function() {}, contains: function() { return false; } };
  this.dataset = {};
};
mockHTMLElement.prototype.attachShadow = function() { return { innerHTML: '' }; };
mockHTMLElement.prototype.setAttribute = function() {};
mockHTMLElement.prototype.getAttribute = function() { return null; };
mockHTMLElement.prototype.addEventListener = function() {};
mockHTMLElement.prototype.removeEventListener = function() {};
mockHTMLElement.prototype.dispatchEvent = function() {};
mockHTMLElement.prototype.querySelector = function() { return null; };
mockHTMLElement.prototype.querySelectorAll = function() { return []; };
mockHTMLElement.prototype.appendChild = function() {};
mockHTMLElement.prototype.removeChild = function() {};
mockHTMLElement.prototype.closest = function() { return null; };

var mockMutationObserver = function() {
  this.observe = function() {}; this.disconnect = function() {};
};
mockMutationObserver.prototype.observe = function() {};
mockMutationObserver.prototype.disconnect = function() {};

function setupMockEnv() {
  global.window = mockWindow;
  global.document = mockDocument;
  global.HTMLElement = mockHTMLElement;
  global.MutationObserver = mockMutationObserver;
}

function loadCardFrame() {
  delete require.cache[require.resolve('../src/card-framework.js')];
  require('../src/card-framework.js');
  return global.window.CardFrame;
}

module.exports = { setupMockEnv, loadCardFrame, mockWindow, mockDocument };
```

---

## 2. 测试文件清单

| 测试文件 | 覆盖模块 | 期望用例数 | 类型 |
|---------|---------|-----------|------|
| `tests/test.js`（重写） | CardFrame 主类、EventBus、Store、TypeRegistry、Utils | ~80 | 运行时 |
| `tests/build-tests.js`（新建） | autoScanClasses、buildModule | ~10 | 构建时 |
| `tests/destroy-tests.js`（新建） | CardFrame.destroy()、EventBus.removeAllByContext() | ~12 | 运行时 |
| `tests/object-pool-tests.js`（新建） | CardObjectPool 集成到 Store | ~6 | 运行时 |
| `tests/lru-cache-tests.js`（新建） | LayoutCache LRU 行为 | ~6 | 运行时 |
| `tests/virtual-scroll-tests.js`（新建） | VirtualScroller DOM 虚拟化 | ~8 | 运行时 |
| `tests/plugin-tests.js`（重构） | PluginManager 运行时行为 | ~40 | 运行时 |
| `tests/evolution-tests.js`（增补） | EvolutionEngine 参数调优 | +5 | 运行时 |

**总计：** ~167 个测试用例（新增约 80，替换约 300 个伪测试）

---

## 3. 各模块测试规范

### 3.1 构建脚本测试（tests/build-tests.js）

#### 测试范围

| 测试项 | 验证内容 | 优先级 |
|--------|---------|--------|
| autoScanClasses 提取 27 个类 | `Object.keys(classes).length >= 27` | P0 |
| autoScanClasses 包含遗漏类 | 检查 EvolutionEngine、ActionLogger、CardObjectPool、LayoutCache、QueryIndex、PerfPanel、ShadowCardRegistry | P0 |
| 提取的类代码格式 | 以 `  class XXXX {` 开头，以 `  }` 结尾 | P0 |
| extractClass 向后兼容 | 原有手动调用的类名仍然能被提取 | P0 |
| buildCoreModule 含 registerModule | 检查产物包含 `CardFrame._moduleInits = []` | P0 |
| buildEvolutionModule 含遗漏类 | 检查产物包含 `CardFrame.EvolutionEngine` | P0 |
| 模块间无依赖泄漏 | 单独加载 core.js 不应包含 security 相关代码 | P1 |
| 构建产物语法正确 | `node -e "eval(fs.readFileSync(...))"` 不抛异常 | P0 |

#### 边界条件

- 源文件中不存在任何 class 时，autoScanClasses 返回空对象
- 类名包含在注释中时不应被误提取（正则 `  class XXXX \{` 要求行首空格 + 空格 + class + 空格）

---

### 3.2 CardFrame.destroy() 测试（tests/destroy-tests.js）

#### 测试范围

| 测试项 | 验证内容 | 优先级 |
|--------|---------|--------|
| 基础功能 | destroy() 后 `frame._destroyed === true` | P0 |
| EvolutionEngine 清理 | destroy() 后 `frame.evolutionEngine === null` | P0 |
| 子模块引用清理 | destroy() 后 all 子模块 === null | P0 |
| container 引用清理 | destroy() 后 `container.__cardFrame === undefined` | P0 |
| 多次调用安全 | 连续调用 3 次 destroy() 不抛异常 | P0 |
| 降级模式 | destroy() 后调用 createCard 应正常返回 card（不抛异常） | P1 |
| EventBus 监听器清理 | destroy() 后注册的监听器不应再被触发 | P0 |
| store.subscribe 回调清理 | destroy() 后 store.notify() 不应触发渲染回调 | P1 |
| EventBus.removeAllByContext | 移除指定上下文的全部监听器 | P0 |
| EventBus.removeAllByContext 隔离性 | 不影响其他上下文的监听器 | P0 |

#### 边界条件

- 从未调用 start() 的 EvolutionEngine 实例被 destroy()
- destroy() 时某些子模块为 null（部分初始化失败场景）
- destroy() 后立即再次 new CardFrame(同一 container)

---

### 3.3 CardObjectPool 集成测试（tests/object-pool-tests.js）

#### 测试范围

| 测试项 | 验证内容 | 优先级 |
|--------|---------|--------|
| createCard 触发 acquire | `pool.getStats().acquires >= 1` | P0 |
| removeCard 触发 release | `pool.getStats().releases >= 1` | P0 |
| 对象复用 | 删除后创建同类型卡片，池中对象数减少 | P0 |
| acquire 计数 > 0 | 池确实被使用了 | P0 |
| release 后池大小不超过 maxPerType | 连续创建删除同类型，池大小有限 | P1 |
| getStats 返回完整数据 | 包含 acquires, releases, hits, misses, hitRate | P1 |

#### 边界条件

- release 一个从未 acquire 的对象
- 池满时 acquire，应正常创建新对象
- 多个不同类型卡片各自的池独立

---

### 3.4 LayoutCache LRU 测试（tests/lru-cache-tests.js）

#### 测试范围

| 测试项 | 验证内容 | 优先级 |
|--------|---------|--------|
| 基本 set/get | `get('key')` 返回 set 的值 | P0 |
| 访问更新 LRU 顺序 | 访问热点后插入新项，热点存活、最早插入的淘汰 | **P0** |
| 连续访问热点不淘汰 | 所有项都被访问过后，淘汰的是从未访问的 | P0 |
| 淘汰触发 | 容量满时插入触发淘汰 | P0 |
| 脏标记不受 LRU 影响 | 被标记为脏的缓存即使被访问过，脏标记仍保留 | P0 |
| 批量脏标记 | markDirtyBatch 标记多个卡片 | P1 |
| 缓存未命中返回 null | get 不存在项返回 null | P0 |

#### 边界条件

- 容量为 1 时持续 set/get
- 同一条目重复 set（覆盖旧值）
- get 后 markDirty，再次 get 应检查脏标记

---

### 3.5 VirtualScroller DOM 虚拟化测试（tests/virtual-scroll-tests.js）

#### 测试范围

| 测试项 | 验证内容 | 优先级 |
|--------|---------|--------|
| enable 创建 DOM 池 | `vs._domPool` 不为 null | P0 |
| enable 创建 DOM 池容器 | `vs._domPoolContainer` 不为 null | P0 |
| disable 清理 DOM 池 | disable 后 `vs._domPool === null` | P0 |
| 可视范围 DOM 限制 | 20 张卡片启用虚拟滚动后 DOM 元素 <= 10 | P0 |
| _releaseCard 回收 DOM | DOM 从 scrollContainer 移到 _domPool | P0 |
| _acquireCard 复用 DOM | 从池中取出后不再在 _domPool 中 | P0 |
| refresh 后池更新 | 新增卡片后 refresh 应更新可视范围 | P1 |
| 连续滚动不泄漏 DOM | 多次模拟滚动后 DOM 总数不增长 | P1 |

#### 边界条件

- enable 时容器无 overflow（_findScrollContainer 回退到 container）
- 所有卡片都在可视范围内（不需要回收）
- 所有卡片都在可视范围外（全部回收）
- enable 时 0 张卡片

---

### 3.6 核心模块运行时测试（tests/test.js 重写）

#### 覆盖模块

| 模块 | 至少测试项数 | 关键验证 |
|------|------------|---------|
| CardFrame 主类 | 6 | createCard、getCard、updateCard、removeCard、getAllCards、from |
| EventBus | 4 | on/emit、off、once、错误容错 |
| Store | 4 | addCard/getCard、removeCard、subscribe/notify、updateCard |
| TypeRegistry | 3 | register、get、validate |
| Utils | 4 | generateId、escapeHtml、deepClone、debounce |
| ActionLogger | 4 | record、undo、redo、canUndo |
| CircuitBreaker | 3 | execute、熔断触发、熔断重置 |
| ThemeManager | 3 | setTheme、getAvailableThemes、registerTheme |
| I18nManager | 3 | setLanguage、translate、getAvailableLanguages |
| RelationshipEngine | 3 | addRelationship、removeRelationship、getRelationships |
| PluginManager | 4 | install、uninstall、enable、disable |
| Security（静态） | 2 | sanitizeHtml 存在、sanitizeUrl 存在 |
| FeedbackSystem | 2 | log/warn/error 级别、格式化输出 |

#### 隔离要求

```javascript
describe('CardFrame 主类', function() {
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

  it('createCard 应创建卡片', function() {
    // ...
  });
});
```

---

### 3.7 插件测试重构（tests/plugin-tests.js）

移除所有 `pluginCode.includes()` 静态检查，改为：

```javascript
describe('Plugin - Shared Types', function() {
  it('应导出声明的卡片类型', function() {
    var plugin = require('../plugins/shared/types.js');
    assert.strictEqual(Array.isArray(plugin.types), true);
    assert.strictEqual(plugin.types.length > 0, true);
  });

  it('每个类型应有 name 属性', function() {
    var plugin = require('../plugins/shared/types.js');
    plugin.types.forEach(function(type) {
      assert.strictEqual(typeof type.name, 'string');
    });
  });
});
```

---

### 3.8 进化引擎增补测试（tests/evolution-tests.js）

在现有 34 个测试基础上增加：

| 测试项 | 验证内容 | 优先级 |
|--------|---------|--------|
| 参数调优修改对象池 | `_applyParamTune` 修改 `_maxPerType` | P0（已有） |
| 参数调优修改布局缓存 | `_applyParamTune` 修改 `_maxSize` | P0（已有） |
| 参数调优记录历史 | 进化历史数组长度 +1 | P0（已有） |
| Code Evolution 请求 | XHR 被调用（mock） | P1 |
| WebSocket 连接 | 初始化时连接 Agent | P1 |
| 关闭 evolution 后 evolvenow | evolutionEngine 为 null 时不抛异常 | P1 |
| MetricsCollector 架构采样 | _collectArchitecture 正确采集类型数 | P1 |

---

## 4. 测试验收标准

### 4.1 覆盖率目标

| 指标 | 当前 | 目标 |
|------|------|------|
| 总用例数 | 537+ | 600+（替换伪测试后净增~80） |
| 运行时测试占比 | ~15% | ~50% |
| 测试隔离率 | 25%（1/4 文件隔离） | 100%（所有文件隔离） |
| 框架类覆盖率 | 19/27 有测试 | 27/27 全部覆盖 |
| 构建产物测试 | 无 | 新增 build-tests.js |

### 4.2 自动化验证

每次提交前运行：

```bash
npm test                    # 全部测试通过
npm run build && npm test   # 构建产物后测试仍通过
```

### 4.3 CI 要求

```yaml
# .github/workflows/ci.yml 测试阶段
jobs:
  test:
    steps:
      - run: npm install
      - run: npm test
      - run: npm run build
      - run: npm test  # 构建后再次运行，确保产物不破坏测试
```

---

## 5. 测试文件依赖关系

```
                    tests/
                      │
           ┌──────────┼──────────┐
           │          │          │
      test.js    evolution-   plugin-
      (core)     tests.js     tests.js
        │        (evolution)  (plugins)
        │          │
        ├──── destroy-tests.js ────┤
        │                          │
   object-pool-  lru-cache-  virtual-scroll-
   tests.js      tests.js    tests.js

   注：每个文件独立加载 card-framework.js，无跨文件共享状态
```

---

## 6. 常见陷阱与规避

| 陷阱 | 后果 | 规避方案 |
|------|------|---------|
| 共享 frame 实例 | 测试间干涉、非幂等 | 每个 it 前创建新 frame，it 后 destroy |
| frameworkCode.includes | 方法改名但字符串残留，测试虚假通过 | 只使用运行时实例化测试 |
| 不清理定时器 | setInterval 泄漏导致后续测试异常 | afterEach 中 stop EvolutionEngine + clearInterval |
| 不清理 DOM | document.body.appendChild 累计导致 OOM | afterEach 中 removeChild |
| 测试顺序依赖 | 某测试依赖前面测试的副作用 | 每个 it 独立 setup/teardown |
| eval(frameworkCode) | 语法错误导致诡异报错 | 使用 require（正确处理缓存清除） |

---

## 7. 测试运行命令

```bash
# 运行全部测试
npm test

# 运行单个测试文件
npx mocha tests/destroy-tests.js -v
npx mocha tests/lru-cache-tests.js -v
npx mocha tests/object-pool-tests.js -v
npx mocha tests/virtual-scroll-tests.js -v
npx mocha tests/build-tests.js -v
npx mocha tests/evolution-tests.js -v

# 运行带覆盖率
npx c8 npm test

# 构建后重新测试
npm run build && npm test
```