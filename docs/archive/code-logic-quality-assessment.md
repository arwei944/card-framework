> **ARCHIVED / 非当前**：本文档为历史材料，结论与行号可能已失效。现行事实见 `docs/architecture-overview.md` 与 `src/`。索引：`docs/archive/README.md`。

> 📜 **历史规划/评估记录（Phase 4 之前）**
> 本文件是重构时期的规划/评估报告，描述的目标已在当前 ES Module + esbuild + jsdom 代码中实现。
> 其中的代码行号、旧架构论断（单体/正则/mock）**已不适用**。当前事实以 `docs/architecture-overview.md` 与源码为准。
# CardFrame 代码逻辑质量深度评估报告

> 评估对象：`src/card-framework.js`（7091 行，27 个类/模块）
> 评估方法：逐函数通读，多维度打分
> 评估日期：2026-07-11

---

## 总览

| 维度 | 评分（/10） | 等级 | 概述 |
|------|:-----------:|:----:|------|
| 1. 函数复杂度 | 7.0 | B+ | 大部分函数控制良好，少数函数过长 |
| 2. 边界处理 | 5.5 | C+ | 有系统性缺陷：浅拷贝、类型检查松散 |
| 3. 错误处理 | 7.5 | A- | 关键路径覆盖好，细节有遗漏 |
| 4. 状态管理 | 4.5 | C | 浅拷贝导致引用共享，importData 绕过 Store API |
| 5. 并发安全 | 5.0 | C | debounce 失效、half-open 竞态、pause/resume 异常泄漏 |
| 6. 内存管理 | 6.0 | C+ | 有池化/缓存机制，但 forceFullRender 泄漏事件监听器 |
| 7. 算法效率 | 6.5 | B- | 有索引加速，但大量 querySelector 造成 O(n²) |
| 8. 代码复用 | 5.0 | C | 4 处显著重复，escapeHtml 有 3 份副本 |
| 9. 命名一致性 | 5.5 | C+ | ES5/ES6 风格混用，配置常量定义了不用 |
| 10. 逻辑正确性 | 5.5 | C+ | 确认 12 个真实 Bug |
| 11. 安全实现 | 7.0 | B+ | sanitizeHtml 逻辑完整，但 tooltip 有 XSS 风险 |
| 12. 可测试性 | 3.0 | D | 全局单例耦合，无法隔离测试 |

**综合逻辑质量评分：5.7 / 10**

---

## 维度 1：函数复杂度 — 7.0/10

### 优点
- 绝大多数函数在 30 行以内，职责单一
- `Utils` 方法简洁，`CardObjectPool`/`LayoutCache`/`QueryIndex` 方法清晰
- 条件分支大多在 2-3 层以内

### 问题

**P1 - `TypeRegistry.validate` 嵌套过深（L3707-3775）**

```javascript
typeDef.propsSchema.forEach(prop => {
  const value = card.props[prop.name];
  if (prop.required && (value === undefined || ...)) {
    // ...
  } else if (value !== undefined && ... && prop.type && !Utils.validateType(value, prop.type)) {
    // ...
  } else if (value !== undefined && ... && prop.allowedValues && !prop.allowedValues.includes(value)) {
    // ...
  } else if (value !== undefined && ... && prop.validator && !prop.validator(value)) {
    // ...
  }
  // 条件重复：value !== undefined && value !== null && value !== '' 出现 4 次
});
```

每个 `else if` 重复 `value !== undefined && value !== null && value !== ''`，应提取为 `hasValue` 辅助函数。圈复杂度 ≈ 12。

**P2 - `CardFrame.constructor` 过长（L6088-6175，87 行）**

构造函数做了 15+ 件事：容器解析、17 个子模块实例化、对象池注入、默认类型注册、debounce 订阅、虚拟滚动启用、插件加载、DOM 初始化、验证器启动、全局存储赋值。应拆分为 `_initModules()`、`_initDefaultTypes()`、`_initFromDOM()` 等。

**P3 - `Security.sanitizeHtml` 复杂度高（L218-302，84 行）**

逻辑正确但嵌套 4 层（for → for → if → if），圈复杂度 ≈ 15。建议抽取 `_sanitizeAttributes(el, allowedAttrs)` 和 `_removeUnsafeElements(root, allowedSet)` 两个子函数。

---

## 维度 2：边界处理 — 5.5/10

### 优点
- `Security.sanitizeHtml/Url/Style` 对 null/undefined 有前置检查
- `generateId`、`escapeHtml`、`escapeAttr` 处理了 null 输入

### 问题

**P1 - `Store.addCard` 不检查 card.id 是否存在（L3413-3442）**

```javascript
addCard(card) {
  const newCard = { ...card, updatedAt: Date.now() };
  // ...
  this.cards.set(newCard.id, newCard);  // 如果 card 没有 id，key 为 undefined
}
```

如果传入的 card 没有 `id`，会以 `undefined` 为 key 存入 Map，后续操作全部失效。应在入口处生成 id。

**P1 - `Utils.deepClone` 不处理 Map/Set/RegExp/循环引用（L139-153）**

```javascript
deepClone(obj) {
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => this.deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) { /* ... */ }
    return cloned;
  }
}
```

- `Map` → 丢失（`typeof Map === 'object'` 但 `for...in` 不遍历 Map entries）
- `Set` → 同上
- 循环引用 → 栈溢出
- `null` → 正确返回 `null`（第一行处理了）

**P2 - `Utils.validateType` 对 'object' 类型判断过于宽松（L155-166）**

```javascript
case 'object': return typeof value === 'object';
```

`typeof null === 'object'`，`typeof [] === 'object'`，`typeof new Date() === 'object'` — 都返回 true。对于类型校验来说太松了。

**P2 - `Utils.validateType` 对 'array' 类型接受字符串（L161）**

```javascript
case 'array': return Array.isArray(value) || typeof value === 'string';
```

字符串不是数组，这种"宽容"会导致后续 `Array.isArray` 检查失败时走错分支。

**P2 - `Utils.parseValue` 对 'array' 类型的 fallback 不处理空字符串（L168-181）**

```javascript
case 'array':
  try { return JSON.parse(value); } catch { return String(value).split(',').map(s => s.trim()); }
```

`parseValue('', 'array')` → `['']`（一个空字符串元素的数组），而不是 `[]`。

**P3 - `LayoutEngine.setZoom` 硬编码边界（L4962-4967）**

```javascript
setZoom(zoom, centerX, centerY) {
  const minZoom = 0.2;   // DEFAULT_CONFIG.ZOOM.MIN = 0.25
  const maxZoom = 3;     // DEFAULT_CONFIG.ZOOM.MAX = 4
```

与 `DEFAULT_CONFIG.ZOOM` 定义不一致。

---

## 维度 3：错误处理 — 7.5/10

### 优点
- EventBus.emit 包裹 try/catch，防止单个监听器崩溃影响其他（L734-754）
- PluginManager 的 install/uninstall/enable/disable 全部有 try/catch（L3201-3213 等）
- ActionLogger 的 _performUndo/_performRedo 有 try/catch（L917-960）
- Renderer.renderCard 有 try/catch 并返回错误卡片（L4412-4497）
- Store.notify 包裹每个 listener（L3617-3631）

### 问题

**P1 - `Renderer.renderError` 中的 delete 处理器无效（L4700-4704）**

```javascript
const deleteHandler = () => {
  if (confirm('确定删除这张卡片吗？')) {
    card.store && card.store.removeCard(card.id);  // card 对象没有 store 属性
  }
};
```

`card` 来自 Store，其结构为 `{id, type, props, position, status, ...}` — 没有 `store` 属性。`card.store` 永远是 `undefined`，删除操作永远不会执行。

**P2 - `RealTimeValidator.handleMutations` 的 debounce 完全失效（L4101-4106）**

```javascript
handleMutations(mutations) {
  const debounced = Utils.debounce(() => {
    this.validateAll();
  }, 100);
  debounced();  // 每次调用都创建新的 debounce 函数
}
```

`Utils.debounce` 每次调用返回一个新函数，新函数有自己的 `timeout` 变量。所以每次 MutationObserver 触发都创建一个独立的 100ms 定时器 — debounce 从未真正生效。高频 DOM 变动会触发大量 `validateAll()` 调用。

正确做法：在构造函数中创建一次 `this._debouncedValidate = Utils.debounce(...)`，然后在 `handleMutations` 中调用 `this._debouncedValidate()`。

**P2 - `RealTimeValidator.pause/resume` 无异常保护（L4359-4365）**

```javascript
pause() { this._isSyncing = true; }
resume() { this._isSyncing = false; }
```

在 CardFrame 构造函数中（L6142-6154），`pause()` 在渲染前调用，`resume()` 在渲染后调用。如果渲染过程抛出异常，`resume()` 不会执行，验证器永久暂停。

**P3 - `cleanupCardElement` 静默吞掉错误（L4400-4410）**

```javascript
listeners.forEach(({ element, event, handler }) => {
  try { element.removeEventListener(event, handler); } catch (e) {}  // 完全静默
});
```

如果 element 已被移除或 handler 无效，问题被隐藏。应至少 console.warn。

---

## 维度 4：状态管理 — 4.5/10

### 严重问题

**P0 - `Store.updateCard` 浅拷贝导致引用共享（L3444-3451）**

```javascript
updateCard(card) {
  if (!this.cards.has(card.id)) return null;
  const updatedCard = { ...card, updatedAt: Date.now() };
  this.cards.set(updatedCard.id, updatedCard);
  // ...
}
```

`{...card}` 是浅拷贝 — `props` 和 `position` 仍然指向原始对象的引用。外部代码修改 `card.props.title` 会直接修改 Store 中的数据，绕过 notify 和事件系统。

**实际影响路径**：
```javascript
const card = frame.getCard('card_xxx');
card.props.title = '新标题';  // 直接修改了 Store 中的对象！
// Store 不知道发生了变化，不会触发 re-render
frame.updateCard(card);  // 此时 previousState === card（同一引用），undo 无法恢复
```

**P0 - `importData` 绕过 Store API 直接操作 Map（L6793-6812）**

```javascript
if (data.cards) {
  data.cards.forEach(cardData => {
    if (mode === 'merge' && this.store.getCard(cardData.id)) {
      this.store.updateCard(cardData);
    } else {
      this.store.cards.set(cardData.id, cardData);  // 直接操作 Map
    }
    importedCards++;
  });
}
```

直接 `cards.set()` 绕过了：
- `QueryIndex.add()` — 导入的卡片不会出现在索引查询结果中
- `eventBus.emit(CARD_ADDED)` — 不会触发卡片添加事件
- 对象池逻辑
- 唯一做了的是最后的 `this.store.notify()` — 但 listener 收到通知时，查询索引里没有这些卡片

**P1 - `Store.fromJSON` 同样绕过索引（L3640-3649）**

```javascript
static fromJSON(data) {
  const store = new Store();
  if (data.cards) {
    data.cards.forEach(card => store.cards.set(card.id, card));  // 直接 set
  }
  // QueryIndex 是空的
}
```

**P1 - `ActionLogger._performUndo` 的 previousState 问题**

`CardFrame.updateCard` 记录 `previousState: { ...previousState.props }`（L6251），但 `previousState` 是 `this.store.getCard(card.id)` 的返回值 — 它是 Map 中的对象引用。`{...previousState.props}` 只浅拷贝了 props，如果 props 里有嵌套对象（如 `tags: [...]`），undo 时恢复的是同一个数组引用。

**P2 - `batchCreateCards` 创建后修改但不更新 Store（L6334-6356）**

```javascript
const card = this.createCard(cardData.type, cardData.props || {});
if (cardData.id) card.id = cardData.id;       // 修改了返回的对象，但 Store 里的没变
if (cardData.position) card.position = cardData.position;
// Store 里的 card 还是原来的 id 和 position
```

`createCard` 返回的对象就是 Store 里的对象引用（`addCard` 返回 `newCard`），所以修改 `card.id` 不会更新 Map 的 key — Map 里存的 key 还是旧 id，但 value 的 id 已经改了。这会导致 `getCard(newId)` 返回 undefined。

---

## 维度 5：并发安全 — 5.0/10

**P1 - debounce 失效（见维度 3）**

`handleMutations` 每次创建新 debounce 函数，高频 DOM 变动导致大量并发验证。

**P1 - `CircuitBreaker` half-open 状态无并发限制（L1088-1112）**

```javascript
canExecute(cardId = null) {
  if (this._safeMode) {
    if (Date.now() - this._lastGlobalOpen > this.resetTimeoutMs) {
      this._globalState = 'half-open';
      this._safeMode = false;
      return true;  // 允许执行
    }
    return false;
  }
  // ...
}
```

half-open 状态下，`canExecute` 返回 true 但不限制并发试探请求数。如果 100 个请求同时到来，全部通过 — 如果第一个失败，其余 99 个仍会执行。应限制 half-open 只允许 1 个试探请求。

**P2 - `Renderer.renderCards` 的 RAF 竞态（L4582-4602）**

```javascript
renderCards(cards) {
  if (this._batchRendering) {
    this._pendingCards = cards;
    return;
  }
  this._batchRendering = true;
  this._pendingCards = cards;
  if (this._rafId) cancelAnimationFrame(this._rafId);
  this._rafId = requestAnimationFrame(() => {
    this._rafId = null;
    const currentCards = this._pendingCards || cards;
    // ...
  });
}
```

如果在 RAF 回调执行前，`renderCards` 被再次调用，`_batchRendering` 为 true，直接设置 `_pendingCards` 并返回 — 这是正确的。但如果 RAF 回调正在执行时，新的 `renderCards` 调用到来，`_batchRendering` 已经被设为 false（在回调末尾），新的渲染会与正在进行的渲染竞争 DOM 操作。

**P2 - `CardElement.attributeChangedCallback` 的 _isUpdating 标志（L5439-5507）**

```javascript
attributeChangedCallback(name, oldValue, newValue) {
  if (oldValue === newValue || this._isUpdating) return;
  // ...
  this._isUpdating = true;
  this.render();       // render 内部 setAttribute 会触发 attributeChangedCallback
  this._isUpdating = false;
}
```

`render()` 中调用 `setAttribute`（L5562）会同步触发 `attributeChangedCallback`，此时 `_isUpdating` 为 true，所以会被跳过 — 逻辑正确。但如果 `render()` 抛出异常，`_isUpdating` 不会被重置为 false，后续所有属性变更都被忽略。

---

## 维度 6：内存管理 — 6.0/10

### 优点
- `CardObjectPool` 实现了对象池化
- `LayoutCache` 实现了 LRU 缓存
- `EventBus.removeAllByContext` 支持按上下文批量清理
- `destroy()` 方法有完整的清理流程（L6972-7029）

### 问题

**P1 - `Renderer.forceFullRender` 泄漏事件监听器（L4710-4715）**

```javascript
forceFullRender(cards) {
  this._lastCardIds = [];
  this.container.innerHTML = '';        // 移除了所有 DOM 元素
  this._eventListeners.clear();         // 清空了跟踪 Map
  this.renderCards(cards);
}
```

`innerHTML = ''` 移除了 DOM 元素，`_eventListeners.clear()` 清空了跟踪 Map — 但没有调用 `element.removeEventListener()`！DOM 元素被移除时，如果事件监听器没有被显式移除，某些浏览器（特别是旧版）可能不会立即回收。更重要的是，如果这些 DOM 元素被其他地方引用（比如 VirtualScroller 的 `_domPool`），监听器仍然活跃。

**P1 - `CardObjectPool.release` 重置不完整（L1569-1589）**

```javascript
release(card) {
  // ...
  card.id = null;
  card.props = {};
  card._relations = [];
  // 不重置：position, status, createdAt, updatedAt, style, type
  list.push(card);
}
```

`position`、`status`、`createdAt` 等字段不重置 — 当池化对象被 `acquire` 复用时（L3423-3429），这些字段会被覆盖，但如果 `addCard` 的某些路径没有覆盖所有字段，旧的脏数据会残留。

**P2 - `PerfPanel._createPanel` 每次创建新 `<style>` 标签（L1397-1407）**

```javascript
_createPanel() {
  // ...
  const style = document.createElement('style');
  style.textContent = `...`;
  document.head.appendChild(style);
  // ...
}
```

如果 `enable()` 被多次调用（虽然有 `_enabled` 保护），style 标签会重复添加。`disable()` 时也没有移除 style 标签。

**P2 - `RelationshipEngine._createHandle` 的事件监听器未跟踪（L2774-2792）**

```javascript
cardEl.addEventListener('mouseenter', () => { /* ... */ });
cardEl.addEventListener('mouseleave', () => { /* ... */ });
```

这些匿名函数没有被存储，`_removeHandles` 只移除 handle 元素本身，card 元素上的 `mouseenter`/`mouseleave` 监听器不会被移除（虽然 card 元素移除时会自动回收，但如果 card 只是被隐藏而不是移除，就会泄漏）。

**P3 - 模块级全局实例浪费（L7064-7077）**

```javascript
const globalStore = new Store();
const globalTypeRegistry = new TypeRegistry();
const globalRenderer = new Renderer(document.body, globalTypeRegistry, globalStore);
const globalAutoFixer = new AutoFixer(globalTypeRegistry, globalStore);
const globalValidator = new RealTimeValidator(document.body, globalTypeRegistry, globalStore, globalAutoFixer);
```

在 IIFE 加载时就创建了 5 个全局实例，即使用户从未实例化 CardFrame。`globalRenderer` 挂载到 `document.body`，`globalValidator` 会观察 `document.body` 的所有 DOM 变动。

---

## 维度 7：算法效率 — 6.5/10

### 优点
- `QueryIndex` 为类型/标签/状态建立了倒排索引，查询从 O(n) 降到 O(1)
- `LayoutCache` LRU 缓存避免重复布局计算
- `VirtualScroller` 只渲染可见区域卡片
- `Renderer._doRenderCards` 用 Set diff 做增量渲染
- `QueryIndex._intersect` 选择较小集合遍历

### 问题

**P1 - 大量 `querySelector` 造成 O(n×m) 复杂度**

| 位置 | 操作 | 复杂度 |
|------|------|--------|
| `RelationshipEngine._renderLines` (L2533-2534) | 每条关系 2 次 querySelector | O(r × n) |
| `LayoutEngine.syncPositions` (L4837) | 每张卡片 1 次 querySelector | O(n × n) |
| `Renderer._doRenderCards` (L4617, L4627) | 删除/更新各 1 次 querySelector | O(n × n) |
| `AutoFixer.fixDomStoreSync` (L3894) | 每个 mismatch 1 次 querySelector | O(m × n) |

对于 1000 张卡片 + 500 条关系，`_renderLines` 要做 1000 次 querySelector 调用。应建立 `cardId → element` 的 Map 缓存。

**P1 - `RealTimeValidator._checkSecurityIssues` 全量扫描（L4156-4217）**

```javascript
const allElements = this.container.querySelectorAll('*');
allElements.forEach(el => {
  for (const attr of el.attributes) { /* ... */ }
  // ...
});
```

遍历容器内**所有** DOM 元素的所有属性 — 对于 1000 张卡片的页面，可能有 10000+ 元素，每个有 5-10 个属性。这是 O(n×a) 操作，每 30 秒执行一次。

**P2 - `Store.removeCard` 线性扫描关系（L3470-3476）**

```javascript
this.relationships.forEach((rel, relId) => {
  if (rel.sourceId === id || rel.targetId === id) {
    relIdsToDelete.push(relId);
  }
});
```

删除卡片时遍历所有关系找引用 — O(r)。应建立 `cardId → Set<relId>` 的反向索引。

**P2 - `LayoutCache.markAllDirty` 复制所有 key（L1661-1665）**

```javascript
markAllDirty() {
  const ids = Array.from(this._cache.keys());  // 复制 5000 个 key
  ids.forEach(id => this._dirty.add(id));
}
```

可以直接 `this._cache.forEach((_, id) => this._dirty.add(id))`，避免创建中间数组。

**P3 - `Renderer._updateElementContent` 用 innerHTML 字符串比较（L4573-4580）**

```javascript
_updateElementContent(oldEl, newEl) {
  if (oldEl.innerHTML !== newEl.innerHTML) {
    oldEl.innerHTML = newEl.innerHTML;
  }
}
```

`innerHTML` 序列化是 O(n) 操作，对于大卡片开销显著。且 `oldEl.innerHTML = newEl.innerHTML` 会销毁并重建所有子节点，即使只有文本变化。

---

## 维度 8：代码复用 — 5.0/10

**P1 - `escapeHtml`/`escapeAttr` 有 3 份独立实现**

| 位置 | 实现 |
|------|------|
| `Utils.escapeHtml` (L70-80) | 用 `document.createElement('div').textContent` |
| `Utils.escapeAttr` (L82-96) | 正则替换 |
| `Security.escapeAttr` (L387-401) | 与 Utils.escapeAttr 完全相同的正则替换 |
| `ShadowCardElement._escapeHtml` (L2021-2031) | 又一份正则替换实现 |
| `ShadowCardElement._escapeAttr` (L2033-2035) | 只替换 `"` — 不完整 |

5 个 escape 函数，3 种实现方式，且 `ShadowCardElement._escapeAttr` 不完整（没有处理 `&`、`<`、`>` 等）。

**P1 - `renderCard` 和 `updateCardElement` 大量重复（L4412-4571）**

两个方法共享以下逻辑（逐行复制）：
- 图片错误处理（L4469-4486 vs L4530-4547）— 完全相同
- style 安全过滤（L4439-4448 vs L4553-4562）— 完全相同
- position 设置（L4450-4454 vs L4564-4568）— 完全相同
- class 设置（L4431-4433 vs L4515-4519）— 相似

应抽取 `_applyCardStyles(cardEl, card, typeDef)` 和 `_attachImageErrorHandler(card)`。

**P1 - `CardElement.extractCardFromElement` 与 `CardFrameElement._initFromDOM` 重复（L5519-5544 vs L5604-5643）**

两个方法都在做 "从 DOM 元素提取 card 对象" 的操作，逻辑 ~80% 相同，但各自独立实现。

**P2 - `_renderLines` 和 `_updateLines` 重复（L2518-2606）**

两个方法都做 "获取关系 → 获取卡片 DOM → getBoundingClientRect → 计算坐标" — ~30 行重复。应抽取 `_getRelationshipCoords(rel)` 返回 `{x1, y1, x2, y2}` 或 null。

---

## 维度 9：命名一致性 — 5.5/10

**P1 - ES5 与 ES6 风格混用**

| 类/模块 | 风格 | 示例 |
|---------|------|------|
| EventBus, Store, Renderer 等 | ES6+ | `const`, arrow function, `class` |
| `EventBus.removeAllByContext` (L715-732) | ES5 | `var self = this`, `function()` |
| MetricsCollector (L5653-5789) | ES5 | `var`, `function`, `for` 循环 |
| RuleEngine (L5791-5901) | ES5 | `var`, `function` |
| EvolutionEngine (L5903-6086) | ES5 | `var`, `function` |

同一个文件中，前 5600 行用 ES6+，后 1200 行（进化引擎部分）切换到 ES5 — 明显是不同时期/不同人写的。

**P1 - 配置定义了但不使用**

| 配置 | 定义值 | 实际使用值 | 位置 |
|------|--------|-----------|------|
| `DEFAULT_CONFIG.ZOOM.MIN` | 0.25 | 0.2 | LayoutEngine.setZoom L4963 |
| `DEFAULT_CONFIG.ZOOM.MAX` | 4 | 3 | LayoutEngine.setZoom L4964 |
| `Security._safeProtocols` | 含 `'#', '/', './', '../'` | 未使用 | isSafeUrl 用自己的硬编码列表 |
| `DEFAULT_CONFIG.ZOOM.STEP` | 0.1 | 未使用 | LayoutEngine 用 `0.9`/`1.1` 乘数 |

**P2 - `_registerPluginActions` 是空方法（L3393-3394）**

```javascript
_registerPluginActions(pluginName, actions) {
}
```

PluginManager 在 `install` 中调用 `this._registerPluginActions(pluginDef.name, pluginDef.actions)`（L3238），但方法体为空 — 插件定义的 `actions` 被静默忽略。

**P2 - 事件名混用 EVENT_TYPES 常量和裸字符串**

```javascript
// 使用常量
eventBus.emit(EVENT_TYPES.CARD_ADDED, { ... });
// 使用裸字符串
eventBus.emit('relationshipClick', { ... });         // L2637
eventBus.emit('cardDoubleClick', { ... });           // L4490
eventBus.emit('fullCheckFailed', results);           // L4146
eventBus.emit('relationshipCreatedByDrag', { ... }); // L2902
eventBus.emit('evolution:occurred', record);         // L6084
```

约 15 个事件名用裸字符串而非 `EVENT_TYPES` 常量。

---

## 维度 10：逻辑正确性 — 5.5/10

### 确认的 Bug 列表

**BUG-1: `handleMutations` debounce 失效（L4101-4106）** ⚠️ 高
- 每次调用创建新 debounce 函数，validateAll 被高频调用
- 修复：构造函数中 `this._debouncedValidate = Utils.debounce(() => this.validateAll(), 100)`

**BUG-2: `ShadowCardElement._cleanup` 参数顺序错误（L2082-2088）** ⚠️ 高
```javascript
this._listeners.forEach(function(handler, eventType) {
  self.removeEventListener(eventType, handler);  // 参数反了
});
```
`Map.forEach` 回调签名是 `(value, key)` — `handler` 是 value（`{name, wrapped}` 对象），`eventType` 是 key（原始 handler 函数）。`removeEventListener` 接收 `(eventType, handler)` — 传入的 `eventType` 实际是 `{name, wrapped}` 对象，`handler` 实际是原始函数。事件不会被正确移除。

**BUG-3: `renderError` 中 delete 按钮无效（L4700-4704）** ⚠️ 中
- `card.store` 永远是 undefined，删除操作不执行

**BUG-4: `list` 类型的 addItem action 调用签名错误（L5353）** ⚠️ 中
```javascript
store.updateCard(card.id, { items });  // updateCard 接收的是 card 对象，不是 (id, props)
```
`Store.updateCard` 签名是 `updateCard(card)` — 传入 `(card.id, {items})` 会尝试 `this.cards.has(card.id)` → `undefined`（第一个参数是字符串 id），返回 null。

**BUG-5: `importData` 绕过索引（L6793-6812）** ⚠️ 高
- 直接 `this.store.cards.set()` 跳过 QueryIndex，导入的卡片无法通过 `getCardsByType` 等索引查询到

**BUG-6: `Store.fromJSON` 绕过索引（L3640-3649）** ⚠️ 中
- 同 BUG-5

**BUG-7: `batchCreateCards` 修改 id 但不更新 Map key（L6340-6344）** ⚠️ 中
- `createCard` 返回的对象就是 Map 中的 value 引用，修改 `card.id` 不改变 Map key
- 后续 `getCard(newId)` 返回 undefined

**BUG-8: `CircuitBreaker` half-open 无并发限制（L1088-1112）** ⚠️ 中
- half-open 状态下不限制试探请求数

**BUG-9: `CardElement.render` 可能触发递归 attributeChangedCallback（L5546-5565）** ⚠️ 低
- `setAttribute` 会同步触发 `attributeChangedCallback`，虽然有 `_isUpdating` 保护
- 但如果 `render()` 抛出异常，`_isUpdating` 不会被重置

**BUG-10: `CardElement.attributeChangedCallback` 中 `card.props[propName] = newValue`（L5501）** ⚠️ 中
- 直接修改了 Store 中的 card 对象的 props（因为 getCard 返回引用），然后又调用 `frame.store.updateCard(card)` — updateCard 做的是 `{...card}` 浅拷贝，此时 previousState 也是同一个引用，undo 无法正确恢复

**BUG-11: `_showRelationshipTooltip` 使用 innerHTML 插入未转义内容（L2964-2969）** ⚠️ 中
```javascript
tooltip.innerHTML = `
  <div><strong>关系类型:</strong> ${rel.type}</div>
  <div><strong>源:</strong> ${sourceCard?.props?.title || rel.sourceId}</div>
`;
```
如果 card title 包含 HTML（如 `<script>` 或 `<img onerror>`），会造成 XSS。虽然 title 在写入时可能被 escape，但 `rel.type` 和 `rel.sourceId` 没有经过 sanitize。

**BUG-12: `checkCSPCompatibility` 的 eval 检测逻辑反直觉（L406-413）** ⚠️ 低
- 变量名 `hasEval` 在 eval 被阻断时为 true — 语义反直觉
- 且框架本身不使用 eval/new Function，这个检查没有实际意义

---

## 维度 11：安全实现 — 7.0/10

### 优点
- `sanitizeHtml` 实现完整：白名单标签+属性过滤、危险属性移除、style 安全过滤、URL 协议检查
- `sanitizeStyle` 覆盖了 expression()、javascript: url()、@import、-moz-binding 等
- `checkTemplateSecurity` 检测内联事件、javascript: URL、script/iframe 标签
- `validatePropValue` 根据 prop schema 自动进行安全清理
- `Security.sanitizeStyleObject` 处理 style 对象的每个属性

### 问题

**P1 - `sanitizeStyle` 的正则替换可被绕过（L342-360）**

```javascript
for (const pattern of this._dangerousStylePatterns) {
  if (pattern.test(str)) {
    str = str.replace(pattern, '');
  }
}
```

`pattern.test()` 会更新 `lastIndex`（因为使用了 `g` flag），然后 `replace` 也会使用 `g` flag。但 `test()` 调用后 `lastIndex` 被修改，可能导致 `replace` 从错误的位置开始。应在每次 test 前重置 `lastIndex`，或使用不共享 `lastIndex` 的方式。

攻击向量：`expression\0(alert(1))` — null 字符可能绕过正则但被浏览器解析。

**P1 - `sanitizeHtml` 的 DOM 解析安全风险（L226-227）**

```javascript
const tempDiv = document.createElement('div');
tempDiv.innerHTML = str;  // 在这里，img onerror 等已经触发
```

设置 `innerHTML` 时，浏览器会解析 HTML 并创建 DOM 芃。虽然 `img` 的 `onerror` 需要图片加载失败才触发，但某些攻击向量（如 `<svg onload>`）可能在 innerHTML 设置时立即执行。更安全的方式是使用 DOMParser 或先对 `<script>`/`<svg>` 等进行预过滤。

**P2 - `_showRelationshipTooltip` XSS（见 BUG-11）**

**P2 - `checkTemplateSecurity` 用 `toLowerCase()` 后做正则匹配（L506-509）**

```javascript
const lowerTemplate = template.toLowerCase();
const inlineEventPattern = /\bon[a-z]+\s*=/gi;
const inlineEventMatches = lowerTemplate.match(inlineEventPattern);
```

`toLowerCase()` 会改变非 ASCII 字符，但正则只匹配 `[a-z]` — 这对英文事件名（onclick 等）是正确的。但如果模板中有 `<img src=x onerror=` 被 toLowerCase 后检测到，是 OK 的。不过 `javascript:` 协议如果用大小写混淆（`JaVaScRiPt:`）会被 `toLowerCase` 正确处理。整体逻辑正确。

**P3 - `isSafeUrl` 对相对路径检查不完整（L317-340）**

```javascript
if (str.startsWith('#') || str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) {
  return true;
}
```

`/` 开头的 URL 是绝对路径 — 安全。但 `//evil.com` 也以 `/` 开头，会被认为是安全的 — 这实际上是协议相对 URL，会继承当前页面的协议。虽然不算直接 XSS，但可能导致开放重定向。

---

## 维度 12：可测试性 — 3.0/10

**P0 - 全局单例耦合**

```javascript
const eventBus = new EventBus();  // L1012 - 模块级单例
```

`eventBus` 是模块级单例，所有类直接引用它。测试时无法替换为 mock EventBus。

`CardFrame.constructor` 中（L6125）：`this.eventBus = eventBus;` — 直接引用全局单例，不是构造函数参数。

**P0 - `CardFrame._globalStore` 全局静态引用（L6174, L7062）**

```javascript
CardFrame._globalStore = this.store;  // 每次创建 CardFrame 都覆盖
```

default card types 的 `complete` action（L5288）直接引用 `CardFrame._globalStore` — 如果有多个 CardFrame 实例，只有最后一个的 store 被引用。

**P1 - 模块级全局实例（L7064-7077）**

5 个全局实例在模块加载时创建，测试时无法避免。`globalValidator` 会观察 `document.body` — 测试中创建的 DOM 变动会触发它。

**P1 - 类之间直接引用而非依赖注入**

- `AutoFixer._getValidator` 通过 monkey-patch 注入（L6137）
- `ActionLogger._performUndo` 直接调用 `store.removeCard/addCard` — 无接口抽象
- `Renderer.renderCard` 直接调用 `eventBus.emit` — 不是通过注入的依赖

**P2 - 无依赖注入构造函数**

`CardFrame.constructor` 在内部 `new` 所有依赖（L6107-6131），无法替换为 mock。应改为：

```javascript
constructor(container, options = {}) {
  this.store = options.store || new Store();
  this.typeRegistry = options.typeRegistry || new TypeRegistry();
  // ...
}
```

---

## 各类质量评级汇总

| 类/模块 | 逻辑质量 | 关键问题 |
|---------|:--------:|---------|
| Utils | 6.5/10 | deepClone 不完整、validateType 松散 |
| Security | 7.5/10 | sanitizeHtml 逻辑完整，sanitizeStyle 正则 lastIndex 风险 |
| EventBus | 7.0/10 | once 不支持 context、off 不清理 _context |
| ActionLogger | 7.5/10 | undo/redo 逻辑正确，previousState 浅拷贝问题 |
| CircuitBreaker | 7.0/10 | half-open 无并发限制 |
| ThemeManager | 8.0/10 | 逻辑清晰，followSystemTheme 正确处理兼容性 |
| PerfPanel | 6.5/10 | style 标签重复、disable 不清理 style |
| GlobalErrorHandler | 8.0/10 | 逻辑正确，错误聚合有效 |
| CardObjectPool | 7.0/10 | release 重置不完整 |
| LayoutCache | 8.0/10 | LRU 实现正确，markAllDirty 可优化 |
| QueryIndex | 8.5/10 | 最佳实现之一，索引维护正确 |
| ShadowCardRegistry | 7.0/10 | 简单清晰 |
| ShadowCardElement | 5.0/10 | _cleanup 参数错误（BUG-2）、_escapeAttr 不完整 |
| I18nManager | 8.5/10 | 逻辑完整，RTL 检测、fallback、参数替换都正确 |
| RelationshipEngine | 6.0/10 | tooltip XSS、querySelector O(n²)、_renderLines/_updateLines 重复 |
| PluginManager | 6.5/10 | _registerPluginActions 空方法、sandbox 接口设计好但未集成 |
| Store | 5.0/10 | 浅拷贝问题、fromJSON/importData 绕过索引 |
| TypeRegistry | 6.5/10 | validate 嵌套深、resolveInheritance 逻辑正确 |
| AutoFixer | 7.0/10 | fixCard 直接修改 card 对象（突变） |
| RealTimeValidator | 5.5/10 | debounce 失效、pause/resume 无保护 |
| Renderer | 5.5/10 | forceFullRender 泄漏监听器、renderCard/updateCardElement 重复 |
| LayoutEngine | 6.5/10 | setZoom 硬编码、syncPositions O(n²) |
| VirtualScroller | 7.5/10 | 实现正确，DOM 池化好 |
| CardElement | 5.0/10 | attributeChanged 突变 Store、render 递归风险 |
| CardFrameElement | 6.0/10 | 与 CardElement._initFromDOM 重复 |
| MetricsCollector | 6.0/10 | ES5 风格、引用了不存在的属性名 |
| RuleEngine | 7.0/10 | 规则引擎逻辑正确，cooldown 机制好 |
| EvolutionEngine | 6.0/10 | XHR + WebSocket 混用、_applyConfigPatch 不安全 |
| CardFrame | 5.5/10 | constructor 过长、全局引用、12 个 Bug 中 6 个在此暴露 |

---

## Bug 修复优先级

### 立即修复（P0）
1. `handleMutations` debounce 失效 → 改为构造函数创建
2. `importData` 绕过 Store API → 改用 `store.addCard()`
3. `Store.updateCard` 浅拷贝 → 深拷贝 props/position
4. `ShadowCardElement._cleanup` 参数错误 → 修正 forEach 回调

### 尽快修复（P1）
5. `renderError` delete 按钮无效 → 传入 store 引用
6. `list` addItem action 调用签名错误 → 修正为 `store.updateCard(card)`
7. `batchCreateCards` 修改 id 不更新 Map → 先设置 id 再 createCard
8. `forceFullRender` 泄漏监听器 → 先 cleanup 再 clear
9. `_showRelationshipTooltip` XSS → 使用 textContent 或 escapeHtml
10. `CircuitBreaker` half-open 并发 → 添加试探请求计数

### 计划修复（P2）
11. `CardElement.attributeChangedCallback` 突变 Store → 使用不可变更新
12. `checkCSPCompatibility` 命名/逻辑 → 修正或移除

---

## 结论

代码的**逻辑设计思路是成熟的** — 熔断器、对象池、布局缓存、查询索引、虚拟滚动、自动修复、操作日志等模式的选择和定位都是正确的。问题主要出在**实现细节**：

1. **12 个确认 Bug** 中，4 个是高优先级（debounce 失效、importData 绕过索引、浅拷贝引用共享、_cleanup 参数错误），但每个都是几行代码的修复
2. **浅拷贝是系统性问题** — Store 的 add/update/import 都存在，根因是缺少不可变更新规范
3. **代码复用差** — escapeHtml 3 份副本、renderCard/updateCardElement 大量重复
4. **可测试性极低** — 全局单例 + 内部 new + monkey-patch 注入，几乎无法隔离测试

**逻辑设计质量：7.5/10** — 架构模式选择正确，功能覆盖全面
**实现细节质量：5.0/10** — 有 12 个 Bug，浅拷贝系统性问题，代码重复严重
**综合：5.7/10** — 需要修复但不影响"重构优于重写"的结论，因为 Bug 都是局部修复，不需要重新设计
