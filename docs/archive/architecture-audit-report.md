> **ARCHIVED / 非当前**：本文档为历史材料，结论与行号可能已失效。现行事实见 `docs/architecture-overview.md` 与 `src/`。索引：`docs/archive/README.md`。

> ⛔ **DEPRECATED · 历史快照（重构前）**
> 本文件描述的是 **Phase 4 模块化重构之前** 的 CardFrame 状态（单体 IIFE + 正则构建 + mock 测试 + 权限无校验）。
> **当前代码已不再符合本报告的任何核心结论。** 真实架构见 `docs/architecture-overview.md`；逐维度审查见最新架构审查报告。
> 本文件仅作历史记录保留，不应作为当前实现的依据。
# CardFrame 架构评估报告

> **评估日期**：2026-07-11
> **评估范围**：源码（~7000 行）、文档、测试套件、构建系统、npm 包
> **评估标准**：企业级前端框架的严格标准

---

## 执行摘要

CardFrame 是一个声称"零依赖、Agent 友好、以卡片为核心"的前端框架。经过对源码、文档、测试、构建系统的全面审查，**框架声称的 32 项功能中，完全符合声明的 12 项（37.5%），部分实现但存在缺陷的 7 项（21.9%），声称存在但实际无效或形同虚设的 13 项（40.6%）**。

核心问题在于：**源码层是单体文件，模块层是正则切割的假象**，导致所有扩展机制（插件、Web Components、自进化）都叠加在一个不可维护的单体之上。

**综合评分：3.1/10**

---

## 一、维度评分总览

| 维度 | 评分 | 等级 |
|------|------|------|
| 架构设计 | 2.5/10 | 🔴 不合格 |
| 代码质量 | 3.5/10 | 🔴 不合格 |
| 测试体系 | 2.0/10 | 🔴 严重缺陷 |
| 文档质量 | 4.5/10 | 🟠 中等偏下 |
| 构建系统 | 1.0/10 | 🔴 致命缺陷 |
| 安全实现 | 4.0/10 | 🟠 中等偏下 |
| 性能表现 | 3.5/10 | 🟠 有潜力但未达标 |
| 可扩展性 | 2.5/10 | 🔴 不合格 |
| 兼容性 | 6.0/10 | 🟡 及格 |
| 维护性 | 1.5/10 | 🔴 致命缺陷 |
| 可发布性 | 5.0/10 | 🟡 勉强及格 |

---

## 二、架构设计（2.5/10 🔴）

### 2.1 单体架构的根本矛盾

**问题**：整个框架是 200KB 的 IIFE 单文件，27 个类的声明全部嵌套在同一个 `(function(window, document, globalThis) { ... })(...)` 闭包中。这意味着：

- 任何类的修改都影响全局作用域，无法做增量加载
- 循环依赖通过"声明顺序"解决——类 A 在类 B 之前定义才能引用 B，添加新类时必须手动调整文件中的顺序
- 无法做 tree-shaking——即使只用 `EventBus`，也必须加载全部 27 个类

**代码证据**：

```javascript
// card-framework.js 约第 1-2 行
const CardFrame = (function(window, document, globalThis) {
  'use strict';

  const Utils = { ... };
  const EventBus = class { ... };
  const Store = class { ... };
  // ... 27 个类全部在此作用域内

  return CardFrame;
})(window, document, globalThis);
```

### 2.2 伪模块化

构建产物 `dist/*.js` 的模块边界由正则提取生成，而非源码设计：

- `core.js` = `src/card-framework.js` 中正则匹配出 `EventBus, Store, TypeRegistry, CardFrame` 四个类的文本
- `render.js` = 同样方式匹配出 `Renderer, LayoutEngine` 等
- **后果**：源码中任何一个类的缩进变化（多一个空格）都会导致提取失败

**代码证据**（`scripts/build.js` 第 19 行）：

```javascript
// 硬编码 2 空格缩进的正则
const pattern = new RegExp(`  class ${className} \\{[\\s\\S]*?\\n  \\}`, 'm');
```

### 2.3 模块间依赖无法表达

由于源码是单体，模块间依赖通过 `build.js` 的 `iifeParams` 参数手工声明：

```javascript
// build.js 中 render.js 的依赖声明
buildModule('render', [
  'Renderer', 'LayoutEngine', 'VirtualScroller'
], [
  'EventBus', 'Store', 'TypeRegistry', 'Utils', 'Security'
], 'CardFrame');
```

添加新依赖需要同时修改构建脚本和源码顺序，容易遗漏。

---

## 三、代码质量（3.5/10 🔴）

### 3.1 代码组织

| 问题 | 说明 | 严重程度 |
|------|------|---------|
| 单文件长度 | 7000+ 行，27 个类全部在一个文件中 | 🔴 致命 |
| 无 JSDoc | 核心类（CardFrame、Store、TypeRegistry）无方法注释 | 🟠 严重 |
| 魔法数字 | 多处硬编码阈值：`100`（最大重试）、`50`（池限制）、`2000`（超时） | 🟠 中等 |
| 错误吞没 | `EventBus.emit` 的监听器异常被 catch 后仅 `console.error`，调用者不透明 | 🟠 严重 |
| 命名不一致 | `this._events`（EventBus）vs `this.handlers`（PluginManager）vs `this._subscriptions`（Store） | 🟡 轻微 |

### 3.2 关键类代码审查

#### EventBus（第 36-112 行）

- ✅ 实现了 `on` / `off` / `emit` / `once` / `removeAllByContext`
- ❌ `emit` 中监听器异常被静默吞没，无重试或告警
- ❌ `once` 实现依赖 `_onceHandlers` 内部 Map，`removeAllByContext` 未清理该 Map

#### Store（第 133-302 行）

- ✅ `addCard` / `getCard` / `removeCard` 基本功能完整
- ❌ `updateCard` 只接受完整 card 对象，不支持增量更新（与 `.d.ts` 声明不符）
- ❌ `notify` 触发所有订阅者，无防抖机制——大量卡片更新时可能触发数百次
- ❌ `getRelationship(relId)` 使用 `find()`，O(n) 复杂度，无索引

#### TypeRegistry（第 304-430 行）

- ✅ `register` / `get` / `validate` 基本功能完整
- ❌ `validate` 只检查 `type` 是否存在于 `_types` Map，不校验 props 结构
- ❌ `getCardTypes()` 返回所有类型名称数组，无排序或过滤

#### CardFrame（第 432-750 行）

- ✅ `createCard` / `updateCard` / `removeCard` / `getAllCards` 完整
- ❌ 构造函数初始化 15+ 个子模块，耦合度极高
- ❌ `destroy` 只清理部分资源，未清理所有 EventListener 和定时器
- ❌ `importData` / `exportData` 无版本兼容性处理

### 3.3 安全相关代码

**Security 常量（第 1579-1620 行）**：

- ✅ `escapeHtml` 正确转义 `<>&'"`
- ✅ `sanitizeHtml` 通过 DOM 树遍历剥离危险标签
- ❌ `sanitizeUrl` 使用 `new URL(str, window.location.origin)` 解析，在 mock 环境中直接抛异常
- ❌ `sanitizeScriptContent` 通过正则 `/<script[\s\S]*?<\/script>/gi` 移除脚本，无法处理 `<script` 跨行被 split 的情况

---

## 四、测试体系（2.0/10 🔴）

### 4.1 测试覆盖分析

| 文件 | 测试数 | 实际覆盖 |
|------|--------|---------|
| `tests/test.js` | 84 | 仅验证方法存在性和基本返回类型，无业务逻辑验证 |
| `tests/evolution-tests.js` | 52 | 仅验证 EvolutionEngine / MetricsCollector / RuleEngine 方法存在 |
| `tests/plugin-tests.js` | 48 | 仅验证 PluginManager install/uninstall 基本流程 |
| `tests/build-tests.js` | 15 | 验证构建产物存在 |
| `tests/destroy-tests.js` | 12 | 验证 destroy 基本流程 |
| `tests/virtual-scroll-tests.js` | 7 | 验证 VirtualScroller 基本属性 |
| **合计** | **218** | **无一项测试验证 DOM 行为正确性** |

### 4.2 致命缺陷

1. **DOM mock 完全不可用**：`querySelector` 永远返回 `null`，`getBoundingClientRect` 永远返回 `{left:0, top:0}`——Renderer 测试变成了"方法存在性检查"
2. **安全性无法验证**：Mock 的 `innerHTML` 是空字符串，`Security.sanitizeHtml` 永远不会真正执行 DOM 树遍历
3. **测试自认不测试**：`it('renderCard 应不抛异常（mock 环境中忽略渲染错误）')`——测试名称承认 mock 环境中忽略渲染错误
4. **三套独立 mock**：`test.js`、`evolution-tests.js`、`plugin-tests.js` 各自维护 mock，行为不一致

### 4.3 测试质量评估

| 标准 | 状态 |
|------|------|
| 单元测试覆盖核心逻辑 | ❌ 仅覆盖"方法存在" |
| 集成测试验证组件交互 | ❌ 无 |
| E2E 测试验证 DOM 行为 | ❌ 无（mock 环境不支持） |
| 性能基准测试 | ⚠️ 有 `tests/perf-test.js`，但 mock 环境测性能无意义 |
| 错误路径测试 | ❌ 无 |
| 边界条件测试 | ❌ 无 |

---

## 五、文档质量（4.5/10 🟠）

### 5.1 文档覆盖

| 文档 | 状态 | 质量 |
|------|------|------|
| README.md | ✅ 存在 | 🟡 中等——有安装说明但无架构描述 |
| docs/getting-started.md | ✅ 存在 | 🟠 偏简略 |
| docs/api-reference.md | ✅ 存在 | 🟠 中等——缺少 EvolutionEngine 完整文档（最近补充） |
| docs/architecture-overview.md | ✅ 存在 | 🟡 中等——架构图和数据流图清晰 |
| docs/plugin-development.md | ✅ 存在 | 🟠 偏简略 |
| docs/agent-guide.md | ✅ 存在 | 🟠 偏简略——缺少进化 API 详细文档 |
| docs/superpowers/ | ✅ 存在 | 🟡 中等——开发日志和计划文档 |

### 5.2 文档缺陷

- `.d.ts` 与实际源码 API 多处不匹配（`LayoutMode` 类型声明错误、`Store.updateCard` 重载不存在）
- 插件开发文档未说明 PluginManager 的实际限制（无沙箱、卸载不清理）
- 自进化文档（API）最近才补充到 api-reference.md，但 agent-guide.md 中缺少对应章节

---

## 六、构建系统（1.0/10 🔴）

### 6.1 正则提取的脆弱性

`scripts/build.js` 是整个框架中最危险的组件：

| 问题 | 代码证据 |
|------|---------|
| 2 空格缩进硬编码 | `new RegExp('  class ' + className + '\\{')` |
| Utils 方法移除正則不精确 | `method\([^)]*\) \{[\s\S]*?\n    \},` |
| 无增量构建 | 每次全量正则扫描 |
| 手动维护的白名单 | `buildModule('core', ['EventBus', 'Store', ...])` |
| IIFE 参数与实参硬编码耦合 | `buildModule` 的 `iifeParams` 是手写字符串 |

### 6.2 构建产物

| 产物 | 大小 | 质量 |
|------|------|------|
| `dist/card-framework.js` | ~200KB | 原封不动拷贝的源码，未做压缩或处理 |
| `dist/core.js` | ~30KB | 正则提取，可能因缩进变化而断裂 |
| `dist/render.js` | ~40KB | 同上 |
| `dist/loader.js` | ~3KB | 模块加载器 |
| `dist/card-framework.css` | ~10KB | 全量 CSS，未做模块化 |
| `dist/card-framework.d.ts` | ~30KB | 手写，与源码脱节 |

### 6.3 包发布

| 项目 | 状态 |
|------|------|
| package.json | ✅ 结构完整 |
| .npmignore | ✅ 存在（最近添加） |
| LICENSE | ✅ MIT（最近添加） |
| main 字段 | ✅ `dist/card-framework.js` |
| types 字段 | ✅ `dist/card-framework.d.ts` |
| 文件大小 | ⚠️ ~200KB 的 IIFE，无压缩版 |

---

## 七、安全实现（4.0/10 🟠）

### 7.1 已实现的安全特性

| 特性 | 实现质量 |
|------|---------|
| XSS 防护（sanitizeHtml） | ✅ 正确——通过 DOM 树遍历剥离危险标签 |
| URL 过滤（sanitizeUrl） | ⚠️ 有 bug——`new URL()` 在 mock 环境抛异常 |
| HTML 转义（escapeHtml） | ✅ 正确 |
| 熔断器 | ✅ 实现完整——全局+局部双层熔断 |
| 全局错误处理 | ⚠️ 捕获异常但仅 console.error |

### 7.2 未实现的安全特性

| 声称/预期特性 | 状态 |
|--------------|------|
| 插件权限校验 | ❌ permissions 声明无实际校验 |
| 插件沙箱 | ❌ 所有插件共享 EventBus，一个插件异常可中断其他 |
| CSP 支持 | ❌ 未考虑 |
| 输入验证（props schema） | ❌ validate 只检查 type 存在，不校验 props 结构 |

---

## 八、性能表现（3.5/10 🟠）

### 8.1 已实现的优化

| 特性 | 实现质量 |
|------|---------|
| DOM 虚拟化（VirtualScroller） | ✅ 实现了池化复用 |
| 对象池（CardObjectPool） | ✅ 按类型限制容量，支持 acquire/release |
| 布局缓存（LayoutCache） | ✅ LRU + 脏标记 + 热保留 |
| 查询索引（QueryIndex） | ✅ 按类型/标签索引 |

### 8.2 未优化的部分

| 问题 | 影响 |
|------|------|
| Store.notify() 无防抖 | 大量卡片更新时触发数百次 |
| getRelationship() O(n) 查找 | 关系数多时性能退化 |
| 全量版 200KB IIFE | 首屏加载体积大 |
| CSS 全量加载 | 即使只用了 3 种卡片类型，全部 CSS 都被加载 |

### 8.3 构建产物体积

| 产物 | 体积 | 是否必要 |
|------|------|---------|
| 全量版 | ~200KB | 是 |
| 9 个模块文件总和 | ~200KB+ | 有重复代码 |
| 压缩版 | ❌ 不存在 | 应该有 |

---

## 九、可扩展性（2.5/10 🔴）

### 9.1 插件系统

| 声称特性 | 实际情况 |
|---------|---------|
| 插件 hooks | ✅ 实现了 8 个 hook 点 |
| 插件上下文 | ⚠️ 只暴露 store/typeRegistry/eventBus/i18n/themeManager，缺少 circuitBreaker/perf |
| 权限校验 | ❌ permissions 声明无实际校验 |
| 卸载清理 | ❌ uninstall 不清理类型/主题/监听器 |
| 沙箱机制 | ❌ 无 |
| 优先级控制 | ❌ hooks 执行顺序完全依赖安装顺序 |
| 实际使用 | ❌ 项目内插件绕过 PluginManager，直接 require 后手动注册 |

### 9.2 Web Components

| 声称特性 | 实际情况 |
|---------|---------|
| `<card-frame>` 元素 | ✅ 注册成功 |
| `<cf-card>` 元素 | ✅ 注册成功 |
| Shadow DOM | ✅ 封装了内部样式 |
| `::part()` 暴露 | ✅ 支持外部定制 |
| 多版本共存 | ❌ customElements.define() 不可撤销 |
| 竞态条件 | ❌ cf-card 先于 card-frame 插入 DOM 时永远等待 |
| Shadow DOM 穿透 | ❌ 通过 closest(".card-frame") 定位，无法穿透 Shadow Root |

### 9.3 自进化系统

| 声称特性 | 实际情况 |
|---------|---------|
| 指标采集 | ✅ 每 5 秒采集性能+交互指标 |
| 规则引擎 | ✅ 6 条内置规则 |
| AI 代码进化 | ⚠️ 依赖外部 Agent 服务，无持久化 |
| 进化历史 | ❌ 仅存在内存，刷新后丢失 |
| 回滚机制 | ⚠️ Agent 侧有实现，但不可靠（文件覆盖） |

---

## 十、兼容性（6.0/10 🟡）

| 方面 | 状态 |
|------|------|
| 浏览器兼容性 | ✅ 现代浏览器（Chrome/Firefox/Safari/Edge） |
| Node.js 兼容性 | ✅ 测试用 Node.js mock 运行 |
| 零外部依赖 | ✅ 真正零依赖 |
| 多实例共存 | ❌ Web Components 全局单例 |
| 多版本共存 | ❌ 全局命名空间污染 |
| ES Module 兼容 | ⚠️ 构建产物是 IIFE，非 ES Module |
| TypeScript 兼容 | ⚠️ 有 .d.ts 但与实际源码脱节 |

---

## 十一、维护性（1.5/10 🔴）

### 11.1 代码可维护性

| 标准 | 状态 |
|------|------|
| 源码按功能模块化 | ❌ 单文件 7000+ 行 |
| 模块间有明确边界 | ❌ 无 ES Module 边界 |
| 可独立测试 | ❌ Mock 环境使测试形同虚设 |
| 可独立部署 | ⚠️ 构建产物可以，但源码不行 |
| 重构安全 | ❌ 任何类修改都可能破坏构建 |
| 增量开发 | ❌ 添加新类需同时修改源码和构建脚本 |

### 11.2 文档可维护性

| 标准 | 状态 |
|------|------|
| API 文档与实际代码同步 | ❌ .d.ts 与源码多处不匹配 |
| 架构文档完整 | 🟡 最近补充了 architecture-overview.md |
| 变更日志 | ❌ 无 CHANGELOG.md |

---

## 十二、可发布性（5.0/10 🟡）

| 标准 | 状态 |
|------|------|
| package.json 完整 | ✅ |
| README 完整 | 🟡 中等 |
| LICENSE | ✅ MIT |
| .npmignore | ✅ 存在 |
| npm pack 成功 | ✅ 打包 17 个文件 |
| 测试全通过 | ✅ 218 个测试通过 |
| 构建产物可用 | ⚠️ 有，但正则构建脆弱 |
| TypeScript 支持 | ⚠️ 有 .d.ts 但与实际脱节 |
| 压缩版 | ❌ 不存在 |
| Source Map | ❌ 不存在 |

---

## 十三、声称功能 vs 实际实现对照表

| 声称功能 | 声称质量 | 实际质量 | 差距 |
|---------|---------|---------|------|
| 零外部依赖 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 21 种卡片类型 | 🟢 声称 | 🟡 部分类型无渲染逻辑 | ⚠️ 中等差距 |
| 多语言（zh-CN/en-US） | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 多主题（light/dark/high-contrast） | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| DOM 虚拟化 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| Canvas 自由布局 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 卡片拖拽 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 插件系统 | 🟢 声称 | 🔴 无沙箱、卸载不清理、权限无校验 | ❌ 严重差距 |
| 插件 hooks | 🟢 声称 | 🟡 优先级不可控 | ⚠️ 中等差距 |
| 自进化系统 | 🟢 声称 | 🔴 无持久化、依赖外部服务 | ❌ 严重差距 |
| 进化历史 | 🟢 声称 | 🔴 仅内存，刷新丢失 | ❌ 严重差距 |
| 多版本共存 | 🟢 声称 | 🔴 Web Components 全局单例 | ❌ 严重差距 |
| TypeScript 类型安全 | 🟢 声称 | 🔴 .d.ts 与源码多处不匹配 | ❌ 严重差距 |
| 安全性（XSS 防护） | 🟢 声称 | 🟡 有实现但测试无法验证 | ⚠️ 中等差距 |
| 性能面板 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 对象池 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 布局缓存 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 查询索引 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| Web Components | 🟢 声称 | 🟡 有竞态问题、无法穿透 Shadow DOM | ⚠️ 中等差距 |
| 模块加载器 | 🟢 声称 | 🟢 实现 | ✅ 无差距 |
| 数据导入导出 | 🟢 声称 | 🟡 无版本兼容性 | ⚠️ 中等差距 |
| 权限校验 | 🟢 声称 | 🔴 声明无实际校验 | ❌ 严重差距 |
| 插件沙箱 | 🟢 声称 | 🔴 不存在 | ❌ 严重差距 |
| 插件卸载清理 | 🟢 声称 | 🔴 uninstall 不清理 | ❌ 严重差距 |
| hooks 优先级 | 🟢 声称 | 🔴 完全依赖安装顺序 | ❌ 严重差距 |
| 增量更新 | 🟢 声称 | 🔴 updateCard 只接受完整对象 | ❌ 严重差距 |
| 输入验证（props schema） | 🟢 声称 | 🔴 validate 不校验 props 结构 | ❌ 严重差距 |
| 性能防抖 | 🟢 声称 | 🔴 notify 无防抖 | ❌ 严重差距 |
| O(1) 关系查询 | 🟢 声称 | 🔴 getRelationship O(n) 查找 | ❌ 严重差距 |
| 版本兼容性 | 🟢 声称 | 🔴 importData/exportData 无版本处理 | ❌ 严重差距 |
| 压缩版构建 | 🟢 声称 | 🔴 不存在 | ❌ 严重差距 |
| Source Map | 🟢 声称 | 🔴 不存在 | ❌ 严重差距 |

**总计**：32 项声称功能中，完全符合 12 项（37.5%），部分实现 7 项（21.9%），声称但实际无效或严重缺陷 13 项（40.6%）。

---

## 十四、结论

CardFrame 在**零外部依赖**和**单文件可部署**方面有真实优势，DOM 虚拟化、对象池、布局缓存等性能优化也有实际代码支撑。但框架的**核心架构缺陷**使得其无法达到企业级前端框架的标准：

1. **源码层无模块边界**——这是所有问题的根源
2. **构建系统基于脆弱正则**——随时可能因格式变化而断裂
3. **测试体系形同虚设**——218 个测试中无一验证 DOM 行为正确性
4. **所有扩展机制叠加在单体之上**——插件、Web Components、自进化都无法真正独立
5. **声称的功能与实际实现差距巨大**——40.6% 的功能声称存在但实际无效或形同虚设

### 建议

按照渐进迁移方案（TypeScript + ES Module + esbuild）分 8 个 Phase 实施重构，每个 Phase 都可独立验证和回滚。优先修复构建系统和测试体系，确保源码层有真实的模块边界。
