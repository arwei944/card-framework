
> 📜 **历史规划/评估记录（Phase 4 之前）**
> 本文件是重构时期的规划/评估报告，描述的目标已在当前 ES Module + esbuild + jsdom 代码中实现。
> 其中的代码行号、旧架构论断（单体/正则/mock）**已不适用**。当前事实以 `docs/architecture-overview.md` 与源码为准。
# CardFrame 代码重构方案

> **基于文档**：`docs/architecture-audit-report.md`（综合评分 3.1/10）
> **制定日期**：2026-07-11
> **目标**：从"功能堆砌"升级到"工程级前端框架"，综合评分目标 8.0+/10
> **核心策略**：单体 IIFE 拆分为 ES Module 模块化源码 + esbuild 构建 + jsdom 真实测试

---

## 一、问题根因分析

评估报告揭示的所有问题可归结为**一条根因链**：

```
源码层无模块边界（7091 行单体 IIFE）
    ├─→ 构建系统只能用正则"假切割"（脆弱、缩进敏感）
    ├─→ 测试无法隔离单个类（必须加载全量 IIFE + 三套 mock）
    ├─→ 插件/Web Components/自进化都叠加在单体上（无法真正独立）
    ├─→ .d.ts 手写、与源码脱节（类型安全形同虚设）
    └─→ 任何类的修改都可能破坏构建（重构风险极高）
```

**重构的第一原则：先建立真实的模块边界，其他所有问题才能被逐个解决。**

---

## 二、技术选型

| 决策项 | 当前方案 | 重构方案 | 理由 |
|--------|---------|---------|------|
| 源码组织 | 单体 IIFE 7091 行 | ES Module，每类一文件 | 真实模块边界，支持 tree-shaking |
| 构建工具 | 正则提取 `build.js` | esbuild | 基于AST解析，稳定可靠 |
| 输出格式 | 仅 IIFE | IIFE + ESM + UMD 三格式 | 兼容 `<script>` / npm / bundler |
| 类型声明 | 手写 .d.ts | 从 TypeScript 源码生成 | 消除类型与实现脱节 |
| 测试环境 | 手写 mock DOM | jsdom（已在 devDependencies） | 真实 DOM API 行为 |
| 压缩 | 无 | esbuild minify + sourcemap | 减小体积，便于调试 |
| 包管理 | npm | npm + pnpm（开发时） | 更快的安装和确定性依赖 |

**渐进原则**：不引入运行时依赖（esbuild/jsdom 仅用于开发和构建），保持框架本身零运行时依赖。

---

## 三、重构路线图（8 个 Phase）

每个 Phase 可独立验证和回滚，Phase 之间有依赖但不存在跨 Phase 的破坏性变更。

### Phase 1：源码拆分 — 建立模块边界

**目标**：将 7091 行单体 IIFE 拆分为 27+ 个 ES Module 文件

**目标目录结构**：

```
src/
  index.js                    # 主入口，聚合所有模块
  core/
    EventBus.js               # 事件总线
    Store.js                  # 数据存储
    TypeRegistry.js           # 类型注册表
    CardFrame.js              # 框架主类
  utils/
    Utils.js                  # 工具方法
    constants.js              # EVENT_TYPES, DEFAULT_CONFIG, CARD_STATUS 等
    FeedbackSystem.js         # 反馈系统
  security/
    Security.js               # 安全常量与方法
    CircuitBreaker.js         # 熔断器
  render/
    Renderer.js               # DOM 渲染器
    LayoutEngine.js           # 布局引擎
    VirtualScroller.js        # 虚拟滚动
  validation/
    AutoFixer.js              # 自动修复
    RealTimeValidator.js      # 实时校验
  extras/
    ThemeManager.js           # 主题管理
    I18nManager.js            # 国际化
    RelationshipEngine.js     # 关系引擎
  plugins/
    PluginManager.js          # 插件管理器
  perf/
    Perf.js                   # 性能常量
    CardObjectPool.js         # 对象池
    LayoutCache.js            # 布局缓存
    QueryIndex.js             # 查询索引
  evolution/
    EvolutionEngine.js        # 进化引擎
    MetricsCollector.js       # 指标采集
    RuleEngine.js             # 规则引擎
    ActionLogger.js           # 操作日志
    PerfPanel.js              # 性能面板
    GlobalErrorHandler.js     # 全局错误处理
    ShadowCardRegistry.js     # 影子卡片注册表
  web-components/
    CardElement.js            # <cf-card> 元素
    CardFrameElement.js       # <card-frame> 元素
  styles/
    card-framework.css        # 样式文件
```

**拆分规则**：

1. 每个类导出为 `export class ClassName { ... }`
2. 类间依赖通过 `import` 声明，消除"声明顺序"耦合
3. 常量提取到 `utils/constants.js`，统一导出
4. `src/index.js` 聚合导出：`export { CardFrame, EventBus, Store, ... }`
5. 保留向后兼容：构建产物仍输出 `window.CardFrame` 全局对象

**验证标准**：
- `node -e "import('./src/index.js')"` 可成功加载
- 每个文件不超过 500 行
- 类间依赖通过 import 声明，无隐式引用

---

### Phase 2：构建系统重写 — esbuild 替代正则提取

**目标**：用 esbuild 替换 `scripts/build.js` 中的正则提取逻辑

**新构建脚本**（`scripts/build.js` 重写）：

```
输入：src/index.js（ES Module 入口）
  │
  ├── esbuild bundle (format: iife)  → dist/card-framework.js
  ├── esbuild bundle (format: esm)   → dist/card-framework.esm.js
  ├── esbuild bundle (format: cjs)   → dist/card-framework.cjs.js
  ├── esbuild minify (format: iife)  → dist/card-framework.min.js
  ├── esbuild minify + sourcemap     → dist/card-framework.min.js.map
  ├── 按入口分模块构建：
  │   ├── core → dist/core.js (IIFE)
  │   ├── security → dist/security.js
  │   ├── render → dist/render.js
  │   ├── ... (8 个模块文件)
  │   └── loader → dist/loader.js
  └── 复制 CSS → dist/card-framework.css
```

**关键改动**：

| 项目 | 旧方案 | 新方案 |
|------|--------|--------|
| 类提取 | 正则 `class XXX { ... }` | esbuild entry points |
| 依赖声明 | 手写 `iifeParams` | import/export 自动解析 |
| 缩进依赖 | 硬编码 2 空格 | 无（AST 解析） |
| 压缩 | 无 | esbuild minify |
| Source Map | 无 | esbuild sourcemap |
| 输出格式 | 仅 IIFE | IIFE + ESM + CJS |
| Tree-shaking | 不支持 | esbuild 自动 |

**package.json 变更**：

```json
{
  "main": "dist/card-framework.js",
  "module": "dist/card-framework.esm.js",
  "types": "dist/card-framework.d.ts",
  "scripts": {
    "build": "node scripts/build.js",
    "build:dev": "node scripts/build.js --watch",
    "build:analyze": "node scripts/build.js --analyze"
  },
  "devDependencies": {
    "esbuild": "^0.21.0",
    "jsdom": "^29.1.1",
    "mocha": "^10.0.0",
    "c8": "^9.0.0",
    "typescript": "^5.4.0"
  }
}
```

**验证标准**：
- `npm run build` 生成 12 个文件（3 格式 + min + map + 8 模块 + CSS + loader）
- `dist/card-framework.min.js` 体积 ≤ 80KB（当前 200KB 未压缩）
- 构建时间 < 1 秒
- 修改任何文件的缩进不影响构建结果

---

### Phase 3：测试体系重建 — jsdom 替代手写 mock

**目标**：将 218 个"方法存在性检查"替换为验证真实运行时行为的测试套件

**测试分层**：

| 层级 | 工具 | 测试数目标 | 覆盖范围 |
|------|------|-----------|---------|
| 单元测试 | Mocha + jsdom | ~300 | 每个类的公开方法 |
| 集成测试 | Mocha + jsdom | ~100 | 类间交互（Store→Renderer→VirtualScroller） |
| 安全测试 | Mocha + jsdom | ~50 | XSS 防护、URL 过滤、HTML 转义 |
| 性能基准 | Mocha + jsdom | ~30 | 渲染耗时、对象池命中率、缓存命中率 |
| E2E 测试 | Mocha + jsdom | ~20 | 完整用户操作流程 |

**关键改动**：

1. **统一 mock 环境**：所有测试共享一个 `tests/setup.js`，使用 jsdom 提供真实 DOM API

```javascript
// tests/setup.js
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
```

2. **beforeEach/afterEach 隔离**：每个测试创建独立的 CardFrame 实例，测试后调用 `destroy()` 清理

3. **DOM 行为验证**：不再只检查"方法存在"，而是验证：
   - `createCard()` 后 DOM 中确实出现了对应元素
   - `removeCard()` 后 DOM 中元素确实被移除
   - `updateCard()` 后 DOM 内容确实更新
   - `sanitizeHtml()` 后确实剥离了 `<script>` 标签

4. **错误路径测试**：验证异常场景下的行为（无效输入、并发操作、资源耗尽）

5. **边界条件测试**：空数据、超大数据（10000+ 卡片）、循环引用等

**验证标准**：
- 测试覆盖率达到 70%+（当前无法测量真实覆盖）
- 至少 50 个测试验证 DOM 行为正确性
- 安全相关测试 100% 通过
- 测试执行时间 < 10 秒

---

### Phase 4：核心类修复 — Store / TypeRegistry / EventBus / CardFrame

**目标**：修复评估报告指出的核心类缺陷

#### 4.1 Store 修复

| 问题 | 修复方案 |
|------|---------|
| `updateCard` 只接受完整对象 | 支持 `updateCard(id, partialProps)` 增量更新 |
| `notify` 无防抖 | 添加 `notifyDebounced(ms)` 方法，默认 16ms |
| `getRelationship` O(n) | 新增 `_relationshipIndex: Map<cardId, Set<relId>>`，O(1) 查找 |
| `updateRelationship` 不存在 | 新增方法，与 `updateCard` 对称 |

```javascript
// Store 修复后的关键方法
class Store {
  constructor() {
    // ...
    this._relIndex = new Map(); // cardId → Set<relId>
    this._notifyTimer = null;
    this._notifyDebounceMs = 16;
  }

  updateCard(idOrCard, partialProps) {
    // 增量更新支持
    if (typeof idOrCard === 'string') {
      const card = this.cards.get(idOrCard);
      if (!card) return null;
      Object.assign(card.props, partialProps);
      card.updatedAt = Date.now();
      this.notifyDebounced();
      return card;
    }
    // 完整更新（向后兼容）
    // ...
  }

  notifyDebounced() {
    if (this._notifyTimer) clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => this.notify(), this._notifyDebounceMs);
  }

  addRelationship(rel) {
    // ... 添加到 _relIndex
    this._indexRelationship(rel);
    // ...
  }

  getRelationship(relId) {
    return this.relationships.get(relId); // O(1) via Map
  }

  getRelationshipsByCard(cardId) {
    const relIds = this._relIndex.get(cardId);
    if (!relIds) return [];
    return Array.from(relIds).map(id => this.relationships.get(id)).filter(Boolean);
  }
}
```

#### 4.2 TypeRegistry 修复

| 问题 | 修复方案 |
|------|---------|
| `validate` 只检查 type 存在 | 添加 props schema 校验（必填字段、类型检查） |
| `getCardTypes()` 无排序 | 按 name 排序返回 |

```javascript
class TypeRegistry {
  validate(card) {
    const errors = [];
    const type = this._types.get(card.type);
    if (!type) {
      errors.push({ field: 'type', message: `未知类型: ${card.type}` });
      return { valid: false, errors };
    }
    // 校验 props schema
    if (type.properties && type.properties.length > 0) {
      for (const prop of type.properties) {
        if (prop.required && (card.props[prop.name] === undefined || card.props[prop.name] === null)) {
          errors.push({ field: `props.${prop.name}`, message: `缺少必填属性: ${prop.name}` });
        }
        if (prop.type && card.props[prop.name] !== undefined) {
          const actualType = Array.isArray(card.props[prop.name]) ? 'array' : typeof card.props[prop.name];
          if (actualType !== prop.type) {
            errors.push({ field: `props.${prop.name}`, message: `属性类型不匹配: 期望 ${prop.type}, 实际 ${actualType}` });
          }
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
```

#### 4.3 EventBus 修复

| 问题 | 修复方案 |
|------|---------|
| `emit` 异常被静默吞没 | 添加 `emitSafe` 选项，异常通过 `FRAMEWORK_ERROR` 事件传播 |
| `once` 的 `_onceHandlers` 未被 `removeAllByContext` 清理 | 统一清理 `_onceHandlers` |

#### 4.4 CardFrame 修复

| 问题 | 修复方案 |
|------|---------|
| 构造函数初始化 15+ 子模块 | 使用 `_initModules()` 模式（已在 core.js 构建产物中实现，源码同步） |
| `destroy` 不完整 | 完整清理所有 EventListener、定时器、DOM 引用 |
| `importData`/`exportData` 无版本兼容 | 添加版本检查和迁移函数 |

```javascript
class CardFrame {
  importData(data, options = {}) {
    if (typeof data === 'string') data = JSON.parse(data);
    // 版本兼容性检查
    const dataVersion = data.version || '1.0';
    const currentVersion = CardFrame.VERSION;
    if (this._isVersionIncompatible(dataVersion, currentVersion)) {
      data = this._migrateData(data, dataVersion, currentVersion);
    }
    // ... 后续导入逻辑
  }

  _isVersionIncompatible(from, to) {
    const fromParts = from.split('.').map(Number);
    const toParts = to.split('.').map(Number);
    return fromParts[0] !== toParts[0]; // major version 不兼容
  }

  _migrateData(data, fromVersion, toVersion) {
    // 迁移函数注册表
    const migrations = CardFrame._migrations || {};
    let current = data;
    let version = fromVersion;
    while (version !== toVersion && migrations[version]) {
      current = migrations[version](current);
      version = migrations[version].nextVersion;
    }
    return current;
  }
}
```

**验证标准**：
- Store 增量更新、防抖、O(1) 关系查询各有独立测试
- TypeRegistry props schema 校验有正向和反向测试
- EventBus 异常传播有验证测试
- CardFrame.destroy() 后无内存泄漏（定时器/监听器全部清理）
- importData/exportData 版本兼容性有测试

---

### Phase 5：插件系统加固 — 权限校验 / 沙箱 / 卸载清理

**目标**：修复插件系统的 4 个严重缺陷

#### 5.1 权限校验

```javascript
class PluginManager {
  install(pluginDef) {
    // 声明权限检查
    const declaredPermissions = pluginDef.permissions || [];
    const allowedPermissions = this._frame._options.allowedPluginPermissions;
    if (allowedPermissions) {
      for (const perm of declaredPermissions) {
        if (!allowedPermissions.includes(perm)) {
          throw new Error(`插件 ${pluginDef.name} 请求了未授权的权限: ${perm}`);
        }
      }
    }
    // ... 安装逻辑
  }

  // hook 执行时检查权限
  _executeHook(hookName, context) {
    for (const plugin of this._activePlugins) {
      if (!this._hasPermission(plugin, hookName)) continue;
      // ... 执行 hook
    }
  }
}
```

#### 5.2 插件沙箱

```javascript
class PluginSandbox {
  constructor(frame, pluginDef) {
    this.frame = frame;
    this.pluginDef = pluginDef;
    this._eventBus = new EventBus(); // 插件独立的事件总线
    this._timers = []; // 追踪插件创建的定时器
    this._listeners = []; // 追踪插件注册的监听器
  }

  // 代理 API，拦截危险操作
  createPluginContext() {
    return {
      store: this._createProxyStore(),
      eventBus: this._eventBus,
      typeRegistry: this._createProxyTypeRegistry(),
      i18n: this.frame.i18n,
      themeManager: this.frame.themeManager,
      // 不暴露 circuitBreaker / perf 等内部模块
    };
  }

  // 追踪定时器，卸载时清理
  setInterval(fn, ms) {
    const id = setInterval(fn, ms);
    this._timers.push(id);
    return id;
  }

  destroy() {
    this._timers.forEach(clearInterval);
    this._listeners.forEach(({ target, event, handler }) => target.removeEventListener(event, handler));
    this._eventBus.removeAllListeners();
  }
}
```

#### 5.3 卸载清理

```javascript
class PluginManager {
  uninstall(pluginName) {
    const plugin = this._plugins.get(pluginName);
    if (!plugin) return false;

    // 1. 调用插件的 onUninstall 生命周期
    if (typeof plugin.instance.onUninstall === 'function') {
      plugin.instance.onUninstall();
    }

    // 2. 清理插件注册的类型
    if (plugin.registeredTypes) {
      plugin.registeredTypes.forEach(typeName => {
        this.frame.typeRegistry.unregister(typeName);
      });
    }

    // 3. 清理插件注册的主题
    if (plugin.registeredThemes) {
      plugin.registeredThemes.forEach(themeName => {
        this.frame.themeManager.removeTheme(themeName);
      });
    }

    // 4. 清理插件注册的事件监听器
    if (plugin.sandbox) {
      plugin.sandbox.destroy();
    }

    // 5. 从活跃列表中移除
    this._plugins.delete(pluginName);
    this.frame.eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, { name: pluginName });
    return true;
  }
}
```

#### 5.4 hooks 优先级

```javascript
class PluginManager {
  _executeHook(hookName, context) {
    // 按 priority 排序后执行
    const hooks = this._getHooksForEvent(hookName)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const hook of hooks) {
      hook.handler(context);
    }
  }
}

// 插件声明优先级
pluginDef.hooks = [
  { name: 'beforeCreateCard', priority: 10, handler: fn },
  { name: 'afterRenderCard', priority: 5, handler: fn }
];
```

**验证标准**：
- 权限校验：未授权权限的插件安装被拒绝
- 沙箱：一个插件的异常不影响其他插件
- 卸载清理：卸载后插件注册的类型/主题/监听器/定时器全部清除
- 优先级：高优先级 hook 先执行

---

### Phase 6：安全增强 — sanitizeUrl / sanitizeScriptContent / CSP

**目标**：修复安全实现缺陷，达到企业级安全标准

#### 6.1 sanitizeUrl 修复

```javascript
const Security = {
  _safeProtocols: ['http:', 'https:', 'mailto:', 'tel:', 'data:'],
  _dangerousDataPatterns: [/^data:text\/html/i, /^data:application\/javascript/i],

  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      // 使用 try-catch 处理无效 URL
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const parsed = new URL(url, base);
      // 检查协议是否安全
      if (!this._safeProtocols.includes(parsed.protocol)) {
        return '';
      }
      // 检查 data: 协议是否包含危险内容
      if (parsed.protocol === 'data:') {
        for (const pattern of this._dangerousDataPatterns) {
          if (pattern.test(url)) return '';
        }
      }
      return parsed.href;
    } catch (e) {
      // URL 解析失败，返回空字符串而非抛异常
      return '';
    }
  }
};
```

#### 6.2 sanitizeScriptContent 增强

```javascript
const Security = {
  sanitizeScriptContent(html) {
    if (!html) return '';
    // 多轮正则，处理被 split 截断的情况
    let result = html;
    // 移除完整的 <script> 标签
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // 移除未闭合的 <script> 标签
    result = result.replace(/<script\b[^>]*>[\s\S]*$/gi, '');
    // 移除事件处理器
    result = result.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    result = result.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
    result = result.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
    // 移除 javascript: 协议
    result = result.replace(/javascript:/gi, '');
    return result;
  }
};
```

#### 6.3 输入验证（props schema）

已在 Phase 4 的 TypeRegistry 修复中实现。

#### 6.4 CSP 支持

```javascript
class CardFrame {
  constructor(container, options = {}) {
    // ...
    if (options.csp) {
      this._applyCSP(options.csp);
    }
  }

  _applyCSP(policy) {
    // 如果页面已有 CSP meta 标签，不覆盖
    const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existing) return;
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = policy;
    document.head.appendChild(meta);
  }
}
```

**验证标准**：
- `sanitizeUrl` 不再抛异常，正确过滤危险协议
- `sanitizeScriptContent` 能处理跨行 script 标签和事件处理器
- 安全测试 100% 通过（XSS 攻击向量全部被拦截）

---

### Phase 7：Web Components 修复 — 竞态条件 / Shadow DOM 穿透

**目标**：修复 Web Components 的 3 个缺陷

#### 7.1 竞态条件修复

```javascript
class CardElement extends HTMLElement {
  connectedCallback() {
    this._tryInit();
  }

  _tryInit() {
    const frame = this._getFrame();
    if (frame) {
      this._initCard(frame);
    } else {
      // 使用 MutationObserver 等待 card-frame 元素出现
      if (!this._observer) {
        this._observer = new MutationObserver(() => {
          const frame = this._getFrame();
          if (frame) {
            this._observer.disconnect();
            this._observer = null;
            this._initCard(frame);
          }
        });
        this._observer.observe(document.body, { childList: true, subtree: true });
        // 超时清理（5 秒后放弃）
        setTimeout(() => {
          if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
          }
        }, 5000);
      }
    }
  }

  disconnectedCallback() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }
}
```

#### 7.2 Shadow DOM 穿透

```javascript
class CardElement extends HTMLElement {
  _getFrame() {
    // 先尝试 closest（普通 DOM）
    let frameEl = this.closest('.card-frame, card-frame');
    // 如果失败，遍历 Shadow DOM 祖先
    if (!frameEl) {
      let root = this.getRootNode();
      while (root) {
        if (root.nodeType === 11 && root.host) { // ShadowRoot
          frameEl = root.host.closest('.card-frame, card-frame');
          if (frameEl) break;
          root = root.host.getRootNode();
        } else {
          break;
        }
      }
    }
    return frameEl ? (frameEl.__cardFrame || null) : null;
  }
}
```

#### 7.3 多版本共存（命名空间隔离）

```javascript
// 使用唯一 tag 名注册，而非全局 tag
function registerCustomElements(frameInstance, namespace) {
  const tagSuffix = namespace ? `-${namespace}` : '';
  const cardFrameTag = `card-frame${tagSuffix}`;
  const cardTag = `cf-card${tagSuffix}`;

  if (!customElements.get(cardFrameTag)) {
    customElements.define(cardFrameTag, class extends CardFrameElement { });
    customElements.define(cardTag, class extends CardElement { });
  }
}
```

**验证标准**：
- `cf-card` 先于 `card-frame` 插入 DOM 时能正确初始化
- Shadow DOM 内的 `cf-card` 能找到宿主 `card-frame`
- 多版本共存时各自独立工作

---

### Phase 8：发布工程 — 类型生成 / 压缩 / Source Map / CI/CD

**目标**：达到企业级 npm 包发布标准

#### 8.1 TypeScript 类型声明

**策略**：为关键类添加 JSDoc 类型注释，使用 `tsc` 从 JSDoc 生成 .d.ts

```javascript
/**
 * @typedef {Object} CardProps
 * @property {string} [title] - 卡片标题
 * @property {string} [content] - 卡片内容
 */

/**
 * 创建一张卡片
 * @param {string} type - 卡片类型
 * @param {CardProps} props - 卡片属性
 * @returns {Card} 创建的卡片对象
 * @throws {Error} 类型不存在或 props 校验失败
 */
createCard(type, props) { ... }
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist/types"
  },
  "include": ["src/**/*"]
}
```

#### 8.2 构建产物清单

| 文件 | 格式 | 用途 | 体积目标 |
|------|------|------|---------|
| `dist/card-framework.js` | IIFE | `<script>` 直接引入 | ~200KB |
| `dist/card-framework.min.js` | IIFE minified | 生产环境 | ≤80KB |
| `dist/card-framework.min.js.map` | Source Map | 调试 | - |
| `dist/card-framework.esm.js` | ES Module | npm/bundler | ~200KB |
| `dist/card-framework.cjs.js` | CommonJS | Node.js require | ~200KB |
| `dist/card-framework.d.ts` | TypeScript | 类型提示 | ~30KB |
| `dist/core.js` ~ `dist/evolution.js` | IIFE | 按需加载模块 | 各 10-40KB |
| `dist/loader.js` | IIFE | 模块加载器 | ~3KB |
| `dist/card-framework.css` | CSS | 样式 | ~10KB |

#### 8.3 package.json 最终版

```json
{
  "name": "card-framework",
  "version": "2.0.0",
  "description": "通用卡片前端框架 - 以卡片为核心数据单元和UI载体的框架无关、Agent友好的前端框架。零外部依赖，支持模块化按需加载。",
  "main": "dist/card-framework.js",
  "module": "dist/card-framework.esm.js",
  "types": "dist/card-framework.d.ts",
  "exports": {
    ".": {
      "import": "./dist/card-framework.esm.js",
      "require": "./dist/card-framework.cjs.js",
      "default": "./dist/card-framework.js"
    },
    "./core": "./dist/core.js",
    "./security": "./dist/security.js",
    "./render": "./dist/render.js",
    "./plugins": "./dist/plugins.js",
    "./styles.css": "./dist/card-framework.css"
  },
  "files": [
    "dist/",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],
  "sideEffects": [
    "*.css"
  ]
}
```

#### 8.4 CI/CD 流水线

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:coverage

  publish:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**验证标准**：
- `npm pack --dry-run` 只包含必要文件
- `dist/card-framework.min.js` ≤ 80KB
- `.d.ts` 文件与源码 API 100% 一致
- CI 在 Node.js 18/20/22 上全部通过

---

## 四、Phase 优先级与依赖关系

```
Phase 1: 源码拆分 ←──── 所有后续 Phase 的基础
    │
    ├── Phase 2: 构建系统重写（依赖 Phase 1 的 ES Module 结构）
    │       │
    │       └── Phase 8: 发布工程（依赖 Phase 2 的 esbuild 构建）
    │
    ├── Phase 3: 测试体系重建（依赖 Phase 1 的模块隔离）
    │       │
    │       └── Phase 4-7 的验证都依赖 Phase 3 的测试能力
    │
    ├── Phase 4: 核心类修复（可在 Phase 3 完成后并行）
    ├── Phase 5: 插件系统加固（可在 Phase 3 完成后并行）
    ├── Phase 6: 安全增强（可在 Phase 3 完成后并行）
    └── Phase 7: Web Components 修复（可在 Phase 3 完成后并行）
```

**推荐执行顺序**：
1. Phase 1 → Phase 2 → Phase 3（串行，建立基础）
2. Phase 4 + Phase 5 + Phase 6 + Phase 7（并行，修复各子系统）
3. Phase 8（串行，最后完成发布工程）

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 拆分后向后兼容性破坏 | 现有用户代码失效 | 构建产物保持 `window.CardFrame` 全局对象 |
| ES Module 不支持旧浏览器 | IE 等浏览器无法使用 | IIFE 格式作为 fallback，ESM 格式面向现代浏览器 |
| esbuild 引入构建依赖 | 不再是"零依赖" | esbuild 仅 devDependency，运行时仍零依赖 |
| 拆分过程中引入 bug | 功能回归 | 每个 Phase 完成后运行全量测试，渐进迁移 |
| 测试重写工作量较大 | 开发周期延长 | 优先重写核心模块测试，边缘模块可后续补充 |

---

## 六、预期收益

| 维度 | 当前评分 | 目标评分 | 关键改善 |
|------|---------|---------|---------|
| 架构设计 | 2.5 | 8.5 | 真实 ES Module 边界 |
| 代码质量 | 3.5 | 8.0 | JSDoc + 统一命名 + 错误处理 |
| 测试体系 | 2.0 | 8.5 | jsdom 真实测试 + 70%+ 覆盖率 |
| 文档质量 | 4.5 | 8.0 | 自动生成 .d.ts + 完整 API 文档 |
| 构建系统 | 1.0 | 9.0 | esbuild 稳定构建 |
| 安全实现 | 4.0 | 8.5 | sanitizeUrl 修复 + 插件沙箱 + CSP |
| 性能表现 | 3.5 | 8.0 | 防抖 + O(1) 查找 + 压缩构建 |
| 可扩展性 | 2.5 | 8.0 | 插件沙箱 + 权限 + 清理 + 优先级 |
| 兼容性 | 6.0 | 8.5 | ESM + CJS + IIFE 三格式 |
| 维护性 | 1.5 | 8.5 | 模块化 + 可独立测试 + 可安全重构 |
| 可发布性 | 5.0 | 9.0 | 压缩 + sourcemap + CI/CD |
| **综合** | **3.1** | **~8.4** | |
