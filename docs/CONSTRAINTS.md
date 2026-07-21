# CardFrame 项目硬约束

> **文档性质**：不可违反的强制性规则。任何代码变更、重构、新增功能都必须遵守本文件。
> **适用范围**：所有源码、测试、构建脚本、插件、示例、文档。
> **最后更新**：2026-07-11

---

## 0. 元规则

1. **本文件优先级最高**。当本文件与其他文档（README、API 文档、重构方案）冲突时，以本文件为准。
2. **违反硬约束的 PR 不得合并**。CI 必须包含约束检查。
3. **新增约束必须经过评审**。任何对本文件的修改需在 PR 中说明理由和影响范围。
4. **约束分三级**：
   - `MUST` — 不可违反，违反即 Bug
   - `MUST NOT` — 不可做，做了即 Bug
   - `SHOULD` — 强烈建议，违反需在代码注释中说明原因

---

## 1. 零运行时依赖

### 约束 1.1 `MUST` 框架运行时零外部依赖

`dist/` 中的任何产物不得引入 npm 运行时依赖。`package.json` 的 `dependencies` 字段必须为 `{}` 或不存在。

**理由**：零依赖是框架的核心卖点，用户选择 CardFrame 就是为了避免依赖地狱。

### 约束 1.2 `MUST NOT` 构建工具不污染运行时

esbuild、jsdom、mocha、c8、typescript 等工具只能出现在 `devDependencies`。构建产物中不得包含任何 `require()` 或 `import` 对 devDependencies 的引用。

### 约束 1.3 `MUST` 构建产物自带所有运行代码

`dist/card-framework.js`（IIFE 格式）必须能通过单个 `<script>` 标签独立工作，不需要额外加载任何外部资源（CSS 除外）。

---

## 2. API 兼容性

### 约束 2.1 `MUST` 公开 API 向后兼容

以下 API 在 major version 内不得破坏性变更：

```
CardFrame                    // 主类
CardFrame.VERSION            // 版本号
CardFrame.registerType()     // 注册卡片类型
CardFrame.registerPlugin()   // 注册插件
new CardFrame(container, options)  // 构造函数
frame.createCard()           // 创建卡片
frame.updateCard()           // 更新卡片
frame.removeCard()           // 删除卡片
frame.getCard()              // 获取卡片
frame.getAllCards()          // 获取所有卡片
frame.importData()           // 导入数据
frame.exportData()           // 导出数据
frame.destroy()              // 销毁实例
frame.on() / frame.off() / frame.emit()  // 事件
frame.store                  // Store 实例
frame.typeRegistry           // TypeRegistry 实例
frame.eventBus               // EventBus 实例
frame.pluginManager          // PluginManager 实例
```

**变更规则**：可以新增参数（可选参数），不得删除参数或改变参数顺序，不得改变返回值结构。

### 约束 2.2 `MUST` 全局对象 `window.CardFrame` 保持可用

IIFE 构建产物必须将框架挂载到 `window.CardFrame`。即使新增 ESM 格式，IIFE 格式的全局挂载不得移除。

### 约束 2.3 `MUST` 卡片类型定义结构兼容

内置可用类型（`text` / `task` / `image` / `list` / `progress` / `link` / `note` / `code`，及 abstract `base`）与用户自定义类型的 `registerType` 定义结构不得破坏性变更。类型数量以 `src/core/defaultCardTypes.js` 为准，不得在文档中夸大为虚构数量。

### 约束 2.4 `MUST` updateCard 支持增量更新

`frame.updateCard` 必须同时支持：

- `updateCard(card)` — 完整卡片对象
- `updateCard(id, partial)` — 增量：props 字段和/或顶层 `status` / `position` / `style` / `tags`

---

## 3. 源码结构

### 约束 3.1 `MUST` 源码按 ES Module 组织

每个类/模块一个独立文件，使用 `export class` / `export const` 导出，`import` 声明依赖。不得恢复单体 IIFE 源码结构。

### 约束 3.2 `MUST NOT` 单文件超过 500 行

任何 `.js` 源文件不得超过 500 行。超过的必须拆分。`src/index.js`（聚合导出）除外，但也不得超过 200 行。

### 约束 3.3 `MUST` 类间依赖通过 import 声明

类 A 依赖类 B 时，必须在文件顶部 `import B from './B.js'`。不得通过全局变量、模块级单例、monkey-patch 等方式建立隐式依赖。

### 约束 3.4 `MUST NOT` 模块级全局实例

不得在模块加载时创建实例对象（如 `const globalStore = new Store()`）。所有实例必须由 `CardFrame` 构造函数或显式工厂方法创建。

**例外**：无状态的工具函数模块（如 `Utils`、`Security` 常量）可以导出对象/常量。

### 约束 3.5 `MUST` 常量集中管理

`EVENT_TYPES`、`DEFAULT_CONFIG`、`CARD_STATUS`、`PERF_CONSTANTS` 等框架级常量必须集中到 `src/utils/constants.js`，统一导出。不得在业务代码中硬编码这些值。

---

## 4. 构建系统

### 约束 4.1 `MUST` 使用 esbuild 构建

`scripts/build.js` 必须基于 esbuild 进行打包，不得使用正则表达式提取类/方法。

### 约束 4.2 `MUST NOT` 构建依赖缩进或格式

构建结果不得受源码缩进、空行、注释格式的影响。任何文件的缩进从 2 空格改为 4 空格不得导致构建失败。

### 约束 4.3 `MUST` 输出三种格式

每次 `npm run build` 必须生成：
- IIFE 格式（`dist/card-framework.js`）— `<script>` 直接引入
- ESM 格式（`dist/card-framework.esm.js`）— bundler / npm
- CJS 格式（`dist/card-framework.cjs.js`）— Node.js require

### 约束 4.4 `MUST` 输出压缩版和 Source Map

每次构建必须生成 `dist/card-framework.min.js` 和 `dist/card-framework.min.js.map`。压缩版体积目标 ≤ 80KB。

### 约束 4.5 `MUST` 构建可重复

相同源码 + 相同 esbuild 版本 → 相同构建产物（字节级）。`package-lock.json` 必须提交。

---

## 5. 状态管理与数据完整性

### 约束 5.1 `MUST` Store 对外返回深拷贝

`Store.getCard()`、`Store.getAllCards()`、`Store.query()` 等读取方法必须返回数据的深拷贝，不得返回 Map 中的原始对象引用。

**理由**：评估报告确认的 P0 Bug — 外部修改 `card.props.title` 直接改了 Store 数据，绕过事件系统和 undo/redo。

### 约束 5.2 `MUST` Store 写入时深拷贝

`Store.addCard()`、`Store.updateCard()` 必须对传入的 card 对象做深拷贝后再存储。`props`、`position` 等嵌套对象不得与外部共享引用。

### 约束 5.3 `MUST NOT` 直接操作 Store 内部 Map

`Store.cards`（内部 Map）不得被外部代码直接 `.set()` / `.delete()`。`CardFrame.importData()`、`Store.fromJSON()` 等方法必须通过 `addCard()` / `updateCard()` API 写入数据。

**理由**：评估报告确认的 P0 Bug — `importData` 直接 `cards.set()` 绕过了 QueryIndex，导致导入的卡片无法通过索引查询。

### 约束 5.4 `MUST` deepClone 支持完整类型

`Utils.deepClone()` 必须正确处理：`Date`、`RegExp`、`Map`、`Set`、`Array`、普通对象、`null`、循环引用。不得使用 `{...obj}` 或 `Object.assign()` 作为深拷贝实现。

### 约束 5.5 `MUST` undo/redo 记录独立快照

`ActionLogger` 记录 `previousState` 和 `newState` 时，必须是独立快照（深拷贝），不得引用 Store 中的当前对象。

---

## 6. 安全

### 约束 6.1 `MUST` 所有用户输入经过净化

以下数据源必须经过 `Security.sanitizeHtml()` 或 `Security.escapeHtml()` 处理后才能插入 DOM：
- 卡片 `props` 中的 `title`、`content`、`description` 等文本字段
- 卡片类型的 `renderTemplate` 渲染输出
- 插件返回的 HTML 内容

### 约束 6.2 `MUST NOT` 使用 innerHTML 插入未净化内容

```javascript
// 禁止
element.innerHTML = `<div>${userContent}</div>`;

// 正确
element.innerHTML = `<div>${Security.escapeHtml(userContent)}</div>`;
// 或
element.textContent = userContent;
```

### 约束 6.3 `MUST` sanitizeUrl 不抛异常

`Security.sanitizeUrl()` 必须对任何输入（`null`、`undefined`、空字符串、无效 URL）返回字符串（空字符串或安全 URL），不得抛出异常。

### 约束 6.4 `MUST` URL 协议白名单

只有以下 URL 协议被允许：`http:`、`https:`、`mailto:`、`tel:`、`data:`（仅图片格式）。`javascript:`、`vbscript:`、`file:` 等协议必须被拒绝。

### 约束 6.5 `MUST` 插件权限校验

`PluginManager.install()` 必须校验插件声明的 `permissions` 是否在允许列表内。未授权权限的插件安装必须抛出异常并拒绝。

### 约束 6.6 `MUST` 插件沙箱隔离

每个插件必须运行在独立沙箱中：
- 插件获得独立的 `EventBus` 实例（或代理）
- 插件创建的定时器、事件监听器被追踪，卸载时清理
- 一个插件的异常不得中断其他插件的 hook 执行

### 约束 6.7 `MUST NOT` 使用 eval / new Function

框架源码中不得使用 `eval()`、`new Function()`、`setTimeout(string)`、`setInterval(string)`。

---

## 7. 测试

### 约束 7.1 `MUST` 使用 jsdom 提供真实 DOM 环境

所有测试必须通过 `tests/setup.js` 中的 jsdom 环境运行。不得手写 mock DOM（如自定义 `querySelector` 返回 `null` 的假 document）。

### 约束 7.2 `MUST` 测试验证行为而非方法存在性

每个测试必须验证代码执行后的可观察效果（DOM 变化、返回值、事件触发、状态变更），不得只验证 `typeof frame.createCard === 'function'`。

### 约束 7.3 `MUST` 测试隔离

每个测试必须在 `beforeEach` 中创建独立实例，`afterEach` 中调用 `destroy()` 清理。测试之间不得共享状态。

### 约束 7.4 `MUST` 覆盖错误路径

每个公开方法至少有一个测试验证异常输入的行为（`null`、`undefined`、错误类型、空数组、超大数据）。

### 约束 7.5 `MUST` 安全测试覆盖

以下攻击向量必须有对应测试：
- `<script>` 标签注入
- `<img onerror>` 事件注入
- `javascript:` URL 协议
- 内联事件处理器（`onclick=`）
- CSS `expression()` / `@import`
- `data:text/html` URL

### 约束 7.6 `MUST NOT` 测试中 console.error 静默吞错

测试中捕获的 `console.error` 调用必须被断言，不得用 `try {} catch {}` 静默忽略。

---

## 8. 性能

### 约束 8.1 `MUST` debounce 正确实现

任何使用 `Utils.debounce()` 的地方必须在构造时创建 debounce 函数并赋值给实例属性，不得在每次调用时创建新 debounce 函数。

**理由**：评估报告确认的 P0 Bug — `RealTimeValidator.handleMutations` 每次创建新 debounce 函数，debounce 从未生效。

### 约束 8.2 `MUST` Store.notify 支持防抖

`Store.notify()` 必须支持防抖模式，默认 16ms 内多次调用合并为一次通知。可通过参数禁用防抖（同步通知）。

### 约束 8.3 `MUST` 关系查询 O(1)

`Store.getRelationship(relId)` 和 `Store.getRelationshipsByCard(cardId)` 必须通过索引实现 O(1) 或 O(k) 查找，不得使用 `forEach` + `find()` 线性扫描。

### 约束 8.4 `SHOULD` DOM 查询缓存

Renderer、RelationshipEngine 等频繁查询 DOM 的模块应维护 `cardId → HTMLElement` 的 Map 缓存，避免重复 `querySelector`。

### 约束 8.5 `MUST` destroy 完整清理资源

`CardFrame.destroy()` 必须清理：
- 所有事件监听器（EventBus、DOM EventListener）
- 所有定时器（setTimeout、setInterval）
- 所有 MutationObserver / ResizeObserver
- 所有 requestAnimationFrame
- 对象池、布局缓存、查询索引的内部数据
- `CardFrame._globalStore` 静态引用

### 约束 8.6 `MUST NOT` forceFullRender 泄漏监听器

`Renderer.forceFullRender()` 在清空 DOM 前必须先对每个卡片元素调用 `removeEventListener`，不得只 `innerHTML = ''` 然后清空跟踪 Map。

---

## 9. 插件系统

### 约束 9.1 `MUST` 插件卸载完整清理

`PluginManager.uninstall()` 必须清理插件注册的所有资源：
- 插件注册的卡片类型（`typeRegistry.unregister`）
- 插件注册的主题（`themeManager.removeTheme`）
- 插件注册的事件监听器
- 插件创建的定时器
- 插件沙箱资源

### 约束 9.2 `MUST` hooks 支持优先级

插件 hook 声明必须支持 `priority` 字段，执行时按 priority 降序执行。不声明 priority 的默认为 0。

### 约束 9.3 `MUST NOT` 插件异常中断其他插件

一个插件的 hook 执行抛异常时，必须被 catch 并记录，不得中断后续插件的 hook 执行。

### 约束 9.4 `MUST` _registerPluginActions 实现或移除

如果 `PluginManager._registerPluginActions` 被调用，方法体不得为空。要么实现 actions 注册逻辑，要么移除调用点。

---

## 10. Web Components

### 约束 10.1 `MUST` cf-card 先于 card-frame 插入时能初始化

`<cf-card>` 元素先于 `<card-frame>` 插入 DOM 时，必须通过 MutationObserver 等待 `card-frame` 出现后完成初始化，不得永久等待。

### 约束 10.2 `MUST` Shadow DOM 穿透

`CardElement._getFrame()` 必须能穿透 Shadow Root 边界定位宿主 `card-frame` 元素，不得只依赖 `closest()`。

### 约束 10.3 `MUST` 多版本共存

必须支持同一页面加载多个版本的 CardFrame。`customElements.define()` 的 tag 名应支持命名空间后缀（如 `cf-card-v2`），不得强制全局唯一注册。

### 约束 10.4 `MUST` attributeChangedCallback 异常安全

`_isUpdating` 标志必须使用 `try/finally` 保护，确保 `render()` 抛异常时标志被重置。

---

## 11. 代码风格

### 约束 11.1 `MUST` 统一使用 ES6+ 语法

- 使用 `const` / `let`，禁止 `var`
- 使用箭头函数，禁止 `function` 表达式（除类方法外）
- 使用 `class` 语法，禁止构造函数 + prototype
- 使用模板字符串，禁止字符串拼接
- 使用 `for...of` / `forEach` / `map`，禁止 `for (var i = 0; i < ...; i++)`

### 约束 11.2 `MUST` 事件名使用 EVENT_TYPES 常量

所有 `eventBus.emit()` / `eventBus.on()` 的事件名必须使用 `EVENT_TYPES` 常量，不得使用裸字符串。

**例外**：插件自定义事件不在 `EVENT_TYPES` 中定义，但框架内部事件必须使用常量。

### 约束 11.3 `MUST NOT` 硬编码魔法数字

性能阈值、超时时间、池容量、重试次数等数值必须定义在 `DEFAULT_CONFIG` 或 `PERF_CONSTANTS` 中，并在代码中引用常量名。

**已知违规**：`LayoutEngine.setZoom` 中 `minZoom = 0.2` / `maxZoom = 3` 与 `DEFAULT_CONFIG.ZOOM.MIN = 0.25` / `MAX = 4` 不一致。

### 约束 11.4 `MUST` 配置定义必须被使用

`DEFAULT_CONFIG` 中定义的所有配置项必须被代码引用。如果某配置项不再使用，应从定义中移除，不得保留死代码。

### 约束 11.5 `MUST` 命名一致

同一个概念在框架内使用统一命名：
- 事件处理器：统一使用 `handler`（不得混用 `callback`、`listener`、`fn`）
- 内部 Map 字段：统一使用下划线前缀 `_events`、`_cards`、`_types`（不得混用 `handlers`、`subscriptions`）
- 私有方法：统一使用下划线前缀 `_methodName`

### 约束 11.6 `MUST` 每个类有 JSDoc 注释

每个类的声明必须有 `@class`、`@description` JSDoc。每个公开方法必须有 `@param`、`@returns`、`@throws`（如适用）JSDoc。私有方法（`_` 前缀）至少有一行说明注释。

---

## 12. 错误处理

### 约束 12.1 `MUST` 关键路径 try/catch

以下操作必须有 try/catch 保护：
- `EventBus.emit` — 单个监听器异常不得影响其他监听器
- `PluginManager.install/uninstall` — 异常时回滚已完成的步骤
- `Renderer.renderCard` — 异常时渲染错误占位卡片
- `ActionLogger.undo/redo` — 异常时恢复到操作前状态
- `CardFrame.importData/exportData` — 异常时返回错误信息，不部分写入

### 约束 12.2 `MUST NOT` 静默吞错

`catch` 块中不得只有空语句体。至少必须 `console.warn` 或通过 `FRAMEWORK_ERROR` 事件传播。

```javascript
// 禁止
try { element.removeEventListener(event, handler); } catch (e) {}

// 正确
try { element.removeEventListener(event, handler); } catch (e) {
  console.warn('[CardFrame] Failed to remove event listener:', e);
}
```

### 约束 12.3 `MUST` pause/resume 异常安全

任何使用 `pause()` / `resume()` 模式的地方必须使用 `try/finally`：

```javascript
this.validator.pause();
try {
  this.renderer.renderCards(cards);
} finally {
  this.validator.resume();
}
```

---

## 13. 类型声明

### 约束 13.1 `MUST` .d.ts 与源码同步

`dist/card-framework.d.ts` 必须从源码 JSDoc 自动生成（通过 `tsc --declaration --allowJs`），不得手写维护。

### 约束 13.2 `MUST` 公开 API 有类型声明

所有公开类、方法、事件、配置必须有对应的 TypeScript 类型声明。`.d.ts` 中不得有 `any` 类型用于公开 API。

### 约束 13.3 `MUST` 类型声明与实际行为一致

`.d.ts` 中声明的方法签名必须与运行时行为一致。如果 `updateCard` 声明支持 `updateCard(id, partialProps)`，运行时必须真的支持。

---

## 14. 文档

### 约束 14.1 `MUST` CHANGELOG.md 记录所有变更

每次版本发布必须在 `CHANGELOG.md` 中记录变更内容，格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

### 约束 14.2 `MUST` API 文档与源码同步

`docs/api-reference.md` 中描述的 API 必须与源码实际行为一致。API 变更时必须同步更新文档。

### 约束 14.3 `MUST NOT` 声称未实现的功能

README.md、docs/ 中不得声称框架具有实际未实现或形同虚设的功能。已知差距必须在文档中标注为"计划中"或"实验性"。

---

## 15. 已知 Bug 修复约束

### 约束 15.1 `MUST` P0 Bug 优先修复

以下 4 个 P0 Bug 必须在任何新功能开发之前修复：

| # | Bug | 位置 | 修复方式 |
|---|-----|------|---------|
| 1 | `handleMutations` debounce 失效 | RealTimeValidator | 构造函数创建 `this._debouncedValidate` |
| 2 | `importData` 绕过 Store API | CardFrame | 改用 `store.addCard()` |
| 3 | `Store.updateCard` 浅拷贝 | Store | 深拷贝 props/position |
| 4 | `_cleanup` 参数顺序错误 | ShadowCardElement | 修正 forEach 回调签名 |

### 约束 15.2 `MUST` P1 Bug 在 Phase 4-7 中修复

6 个 P1 Bug 必须在对应 Phase 中修复，不得遗留到最终发布。

### 约束 15.3 `MUST NOT` 引入已知 Bug 的新变体

修复 Bug 时不得引入同类 Bug。例如修复 `importData` 绕过索引时，`fromJSON` 也必须同步修复。

---

## 16. Git 与发布

### 约束 16.1 `MUST` 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

- `type`：`feat` / `fix` / `refactor` / `test` / `docs` / `build` / `chore` / `perf`
- `scope`：影响的模块名（如 `store`、`renderer`、`plugin`、`build`）
- `subject`：简明描述

### 约束 16.2 `MUST` 版本号遵循 SemVer

- `PATCH`：Bug 修复，不改变 API
- `MINOR`：新功能，向后兼容
- `MAJOR`：破坏性变更

### 约束 16.3 `MUST` 发布前全量测试通过

`npm test` 和 `npm run build` 必须全部通过后才能发布。CI 必须在 Node.js 18/20/22 上全部通过。

### 约束 16.4 `MUST NOT` 提交 dist/ 目录

`dist/` 目录是构建产物，不得提交到 Git。`.gitignore` 必须包含 `dist/`。

**例外**：如果项目当前已提交 `dist/`，在 Phase 2（构建系统重写）完成后将其从 Git 中移除。

---

## 附录：约束溯源

| 约束编号 | 溯源 | 评估报告维度 |
|---------|------|------------|
| 1.x | 零依赖是框架核心卖点 | 兼容性 6.0 |
| 2.x | 15 个示例 + 8 个插件依赖现有 API | 可扩展性 2.5 |
| 3.x | 单体 IIFE 7091 行是所有问题根因 | 架构设计 2.5 / 维护性 1.5 |
| 4.x | 正则提取构建是最危险组件 | 构建系统 1.0 |
| 5.x | 浅拷贝导致引用共享是系统性问题 | 状态管理 4.5 |
| 6.x | 安全实现有局部 Bug | 安全实现 4.0 |
| 7.x | 218 个测试无一验证 DOM 行为 | 测试体系 2.0 |
| 8.x | debounce 失效 + 无防抖 + O(n) 查找 | 性能表现 3.5 |
| 9.x | 插件无沙箱/无清理/无权限校验 | 可扩展性 2.5 |
| 10.x | 竞态条件 + Shadow DOM 穿透失败 | 可扩展性 2.5 |
| 11.x | ES5/ES6 混用 + 魔法数字 + 配置不使用 | 代码质量 3.5 |
| 12.x | pause/resume 异常泄漏 + 静默吞错 | 错误处理 7.5 |
| 13.x | .d.ts 与源码多处不匹配 | 文档质量 4.5 |
| 14.x | 40.6% 声称功能实际无效 | 文档质量 4.5 |
| 15.x | 12 个确认 Bug（4 P0 + 6 P1 + 2 P2） | 逻辑正确性 5.5 |
| 16.x | 发布工程缺失 | 可发布性 5.0 |
