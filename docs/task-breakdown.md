# CardFrame 重构任务清单与验收标准

> **基于文档**：`docs/refactoring-plan.md`（8 Phase 重构方案）、`docs/CONSTRAINTS.md`（硬约束）、`docs/code-logic-quality-assessment.md`（12 个确认 Bug）
> **制定日期**：2026-07-11
> **任务总数**：97 个最小任务单元
> **预估总工时**：18-21 人天

---

## 阅读指南

### 任务编号规则

```
T{Phase}.{Sequence} — 任务编号
例：T1.03 = Phase 1 的第 3 个任务
```

### 任务字段说明

| 字段 | 含义 |
|------|------|
| **依赖** | 必须先完成的前置任务编号 |
| **约束** | 关联的 `CONSTRAINTS.md` 约束编号 |
| **工时** | 预估工时（人小时） |
| **验收标准** | 可检查的完成条件，全部满足才算完成 |

### 任务状态

`未开始` → `进行中` → `已完成` / `已阻塞`

---

## Phase 1：源码拆分 — 建立模块边界

> **Phase 目标**：将 7091 行单体 IIFE 拆分为 27+ 个 ES Module 文件
> **Phase 验收**：`node -e "import('./src/index.js')"` 成功加载，所有示例正常运行
> **Phase 工时**：3-4 人天

---

### T1.01 创建目录结构与常量提取

- **依赖**：无
- **约束**：3.1, 3.5
- **工时**：1h

**描述**：
创建 `src/` 下的目录结构（`core/`、`utils/`、`security/`、`render/`、`validation/`、`extras/`、`plugins/`、`perf/`、`evolution/`、`web-components/`、`styles/`）。将源文件中的 `EVENT_TYPES`、`DEFAULT_CONFIG`、`CARD_STATUS`、`RELATIONSHIP_TYPES`、`PERF_CONSTANTS` 提取到 `src/utils/constants.js`。

**验收标准**：
- [ ] `src/utils/constants.js` 存在，导出 `EVENT_TYPES`、`DEFAULT_CONFIG`、`CARD_STATUS`、`RELATIONSHIP_TYPES`、`PERF_CONSTANTS`
- [ ] 常量值与原始源码完全一致（逐字段比对）
- [ ] 文件不超过 200 行
- [ ] 所有目录已创建

---

### T1.02 提取 Utils 模块

- **依赖**：T1.01
- **约束**：3.1, 3.3, 3.4, 11.1
- **工时**：1h

**描述**：
将源码 L63-182 的 `Utils` 对象提取到 `src/utils/Utils.js`。`Utils` 是无状态工具模块，导出为 `export const Utils`。添加 `import { deepClone } from './Utils.js'` 等所需引用。

**验收标准**：
- [ ] `src/utils/Utils.js` 导出 `Utils` 对象，包含所有原始方法
- [ ] `Utils.deepClone` 保留当前实现（Phase 4 中修复）
- [ ] 无对其他模块的隐式引用
- [ ] 文件不超过 200 行

---

### T1.03 提取 Security 模块

- **依赖**：T1.01, T1.02
- **约束**：3.1, 3.3, 6.1
- **工时**：1h

**描述**：
将源码 L184-580 的 `Security` 对象提取到 `src/security/Security.js`。`Security` 是无状态安全工具模块，导出为 `export const Security`。

**验收标准**：
- [ ] `src/security/Security.js` 导出 `Security` 对象
- [ ] 包含 `escapeHtml`、`escapeAttr`、`sanitizeHtml`、`sanitizeUrl`、`sanitizeStyle`、`sanitizeScriptContent`、`checkTemplateSecurity`、`validatePropValue` 等全部方法
- [ ] 消除 `Security.escapeAttr` 与 `Utils.escapeAttr` 的重复（统一引用 `Utils.escapeAttr`）
- [ ] 无对其他模块的隐式引用

---

### T1.04 提取 Perf 常量与 FeedbackSystem

- **依赖**：T1.01
- **约束**：3.1, 3.5
- **工时**：0.5h

**描述**：
将源码 L581-683 的 `Perf` 常量和 `FeedbackSystem` 提取到 `src/perf/Perf.js` 和 `src/utils/FeedbackSystem.js`。

**验收标准**：
- [ ] `src/perf/Perf.js` 导出性能常量
- [ ] `src/utils/FeedbackSystem.js` 导出 `FeedbackSystem` 对象
- [ ] 两个文件各自不超过 100 行

---

### T1.05 提取 EventBus

- **依赖**：T1.01
- **约束**：3.1, 3.3, 3.4
- **工时**：1h

**描述**：
将源码 L685-759 的 `EventBus` 类提取到 `src/core/EventBus.js`。移除 L1012 的 `const eventBus = new EventBus()` 模块级单例（约束 3.4）。

**验收标准**：
- [ ] `src/core/EventBus.js` 导出 `export class EventBus`
- [ ] 不包含模块级 `new EventBus()` 实例
- [ ] `on`/`off`/`emit`/`once`/`removeAllByContext` 方法完整
- [ ] 无对其他类的引用（EventBus 是叶子模块）

---

### T1.06 提取 ActionLogger

- **依赖**：T1.05
- **约束**：3.1, 3.3
- **工时**：1h

**描述**：
将源码 L761-1011 的 `ActionLogger` 类提取到 `src/evolution/ActionLogger.js`。

**验收标准**：
- [ ] `src/evolution/ActionLogger.js` 导出 `export class ActionLogger`
- [ ] `log`/`undo`/`redo`/`getHistory`/`clear` 方法完整
- [ ] `import` 声明所有依赖（如 EventBus）

---

### T1.07 提取 CircuitBreaker

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1014-1166 的 `CircuitBreaker` 类提取到 `src/security/CircuitBreaker.js`。

**验收标准**：
- [ ] `src/security/CircuitBreaker.js` 导出 `export class CircuitBreaker`
- [ ] `canExecute`/`recordSuccess`/`recordFailure`/`reset` 方法完整
- [ ] 无对其他类的引用（CircuitBreaker 是叶子模块）

---

### T1.08 提取 ThemeManager

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1167-1351 的 `ThemeManager` 类提取到 `src/extras/ThemeManager.js`。

**验收标准**：
- [ ] 导出 `export class ThemeManager`
- [ ] `setTheme`/`getTheme`/`registerTheme`/`removeTheme`/`followSystemTheme` 方法完整
- [ ] 无对其他类的引用

---

### T1.09 提取 PerfPanel

- **依赖**：T1.01, T1.04
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1352-1462 的 `PerfPanel` 类提取到 `src/evolution/PerfPanel.js`。

**验收标准**：
- [ ] 导出 `export class PerfPanel`
- [ ] `enable`/`disable`/`update`/`_createPanel` 方法完整
- [ ] `import` 声明 Perf 常量

---

### T1.10 提取 GlobalErrorHandler

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1463-1535 的 `GlobalErrorHandler` 类提取到 `src/evolution/GlobalErrorHandler.js`。

**验收标准**：
- [ ] 导出 `export class GlobalErrorHandler`
- [ ] `install`/`uninstall`/`handleError` 方法完整

---

### T1.11 提取 CardObjectPool

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1536-1632 的 `CardObjectPool` 类提取到 `src/perf/CardObjectPool.js`。

**验收标准**：
- [ ] 导出 `export class CardObjectPool`
- [ ] `acquire`/`release`/`clear` 方法完整
- [ ] 无对其他类的引用

---

### T1.12 提取 LayoutCache

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1633-1757 的 `LayoutCache` 类提取到 `src/perf/LayoutCache.js`。

**验收标准**：
- [ ] 导出 `export class LayoutCache`
- [ ] `get`/`set`/`markDirty`/`markAllDirty`/`clear` 方法完整
- [ ] 无对其他类的引用

---

### T1.13 提取 QueryIndex

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L1758-1903 的 `QueryIndex` 类提取到 `src/perf/QueryIndex.js`。

**验收标准**：
- [ ] 导出 `export class QueryIndex`
- [ ] `add`/`remove`/`update`/`query`/`clear`/`_intersect` 方法完整
- [ ] 无对其他类的引用

---

### T1.14 提取 ShadowCardRegistry 与 ShadowCardElement

- **依赖**：T1.01, T1.03
- **约束**：3.1, 3.3
- **工时**：1h

**描述**：
将源码 L1904-2094 的 `ShadowCardRegistry` 提取到 `src/evolution/ShadowCardRegistry.js`，L2095-2391 的 `ShadowCardElement` 提取到 `src/web-components/ShadowCardElement.js`。`ShadowCardElement._escapeHtml` 和 `_escapeAttr` 改为引用 `Utils.escapeHtml`。

**验收标准**：
- [ ] 两个文件各自导出类
- [ ] `ShadowCardElement` 不再包含独立的 `_escapeHtml`/`_escapeAttr` 实现，改为 `import { Utils } from '../utils/Utils.js'`
- [ ] `ShadowCardRegistry` 无对其他类的引用

---

### T1.15 提取 I18nManager

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L2095-2391 的 `I18nManager` 类提取到 `src/extras/I18nManager.js`。

**验收标准**：
- [ ] 导出 `export class I18nManager`
- [ ] `setLocale`/`getLocale`/`t`/`registerLocale`/`isRTL` 方法完整
- [ ] 无对其他类的引用

---

### T1.16 提取 RelationshipEngine

- **依赖**：T1.01, T1.02, T1.03
- **约束**：3.1, 3.3
- **工时**：1h

**描述**：
将源码 L2392-3017 的 `RelationshipEngine` 类提取到 `src/extras/RelationshipEngine.js`。

**验收标准**：
- [ ] 导出 `export class RelationshipEngine`
- [ ] `addRelationship`/`removeRelationship`/`getRelationships`/`_renderLines`/`_updateLines`/`_showRelationshipTooltip` 方法完整
- [ ] `import` 声明 Utils、Security 依赖
- [ ] 文件不超过 500 行（如超过，拆分 `_renderLines`/`_updateLines` 到 `RelationshipRenderer.js`）

---

### T1.17 提取 PluginManager

- **依赖**：T1.01, T1.05
- **约束**：3.1, 3.3
- **工时**：1h

**描述**：
将源码 L3018-3396 的 `PluginManager` 类提取到 `src/plugins/PluginManager.js`。

**验收标准**：
- [ ] 导出 `export class PluginManager`
- [ ] `install`/`uninstall`/`enable`/`disable`/`_executeHook` 方法完整
- [ ] `import` 声明 EventBus、EVENT_TYPES 依赖
- [ ] 保留 `_registerPluginActions` 空方法（Phase 5 中修复）

---

### T1.18 提取 Store

- **依赖**：T1.01, T1.05, T1.13
- **约束**：3.1, 3.3, 5.3
- **工时**：1h

**描述**：
将源码 L3397-3651 的 `Store` 类提取到 `src/core/Store.js`。保留当前浅拷贝实现（Phase 4 中修复）。

**验收标准**：
- [ ] 导出 `export class Store`
- [ ] `addCard`/`getCard`/`removeCard`/`updateCard`/`getAllCards`/`query`/`notify`/`addRelationship`/`getRelationship`/`toJSON`/`fromJSON` 方法完整
- [ ] `import` 声明 EventBus、QueryIndex、EVENT_TYPES 依赖
- [ ] 无对 CardFrame 或 Renderer 的引用

---

### T1.19 提取 TypeRegistry

- **依赖**：T1.01, T1.02
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L3652-3805 的 `TypeRegistry` 类提取到 `src/core/TypeRegistry.js`。

**验收标准**：
- [ ] 导出 `export class TypeRegistry`
- [ ] `register`/`get`/`validate`/`getCardTypes`/`resolveInheritance`/`unregister` 方法完整
- [ ] `import` 声明 Utils 依赖

---

### T1.20 提取 AutoFixer

- **依赖**：T1.01, T1.19
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L3806-4026 的 `AutoFixer` 类提取到 `src/validation/AutoFixer.js`。

**验收标准**：
- [ ] 导出 `export class AutoFixer`
- [ ] `fixCard`/`fixDomStoreSync`/`fixAll` 方法完整
- [ ] `import` 声明 TypeRegistry 依赖

---

### T1.21 提取 RealTimeValidator

- **依赖**：T1.01, T1.02, T1.19, T1.20
- **约束**：3.1, 3.3, 8.1
- **工时**：0.5h

**描述**：
将源码 L4027-4371 的 `RealTimeValidator` 类提取到 `src/validation/RealTimeValidator.js`。保留当前 debounce 实现（Phase 4 中修复）。

**验收标准**：
- [ ] 导出 `export class RealTimeValidator`
- [ ] `start`/`stop`/`pause`/`resume`/`validateAll`/`handleMutations`/`_checkSecurityIssues` 方法完整
- [ ] `import` 声明 Utils、TypeRegistry、AutoFixer 依赖

---

### T1.22 提取 Renderer

- **依赖**：T1.01, T1.03, T1.05, T1.18, T1.19
- **约束**：3.1, 3.3, 3.2
- **工时**：1.5h

**描述**：
将源码 L4372-4717 的 `Renderer` 类提取到 `src/render/Renderer.js`。如果超过 500 行，将 `renderCard`/`_updateElementContent` 等渲染辅助方法拆分到 `src/render/RendererHelpers.js`。消除 `renderCard` 与 `updateCardElement` 的重复代码。

**验收标准**：
- [ ] 导出 `export class Renderer`
- [ ] `renderCard`/`renderCards`/`forceFullRender`/`renderError`/`cleanupCardElement` 方法完整
- [ ] `renderCard` 与 `updateCardElement` 中的重复逻辑已抽取为共享方法
- [ ] 文件不超过 500 行
- [ ] `import` 声明 Security、EventBus、Store、TypeRegistry 依赖

---

### T1.23 提取 LayoutEngine

- **依赖**：T1.01, T1.12
- **约束**：3.1, 3.3
- **工时**：1h

**描述**：
将源码 L4718-4975 的 `LayoutEngine` 类提取到 `src/render/LayoutEngine.js`。

**验收标准**：
- [ ] 导出 `export class LayoutEngine`
- [ ] `setLayout`/`setZoom`/`syncPositions`/`destroy` 方法完整
- [ ] `import` 声明 LayoutCache 依赖

---

### T1.24 提取 VirtualScroller

- **依赖**：T1.01
- **约束**：3.1, 3.3
- **工时**：0.5h

**描述**：
将源码 L4976-5212 的 `VirtualScroller` 类提取到 `src/render/VirtualScroller.js`。

**验收标准**：
- [ ] 导出 `export class VirtualScroller`
- [ ] `enable`/`disable`/`scrollTo`/`_onScroll`/`_recycle` 方法完整
- [ ] 无对其他类的引用

---

### T1.25 提取 defaultCardTypes

- **依赖**：T1.01, T1.19
- **约束**：3.1, 2.3
- **工时**：0.5h

**描述**：
将源码 L5213-5388 的 `defaultCardTypes` 数组提取到 `src/core/defaultCardTypes.js`。

**验收标准**：
- [ ] 导出 `export const defaultCardTypes`
- [ ] 21 种卡片类型定义完整，每个类型的 `renderTemplate`/`props`/`actions` 保留原样
- [ ] 文件不超过 200 行

---

### T1.26 提取 CardElement 与 CardFrameElement

- **依赖**：T1.01, T1.02, T1.03
- **约束**：3.1, 3.3
- **工时**：1h

**描述**：
将源码 L5389-5652 的 `CardElement` 和 `CardFrameElement` 分别提取到 `src/web-components/CardElement.js` 和 `src/web-components/CardFrameElement.js`。消除 `extractCardFromElement` 与 `_initFromDOM` 的重复逻辑。

**验收标准**：
- [ ] 两个文件各自导出类
- [ ] `CardElement` 的 `connectedCallback`/`attributeChangedCallback`/`render`/`extractCardFromElement` 方法完整
- [ ] `CardFrameElement` 的 `connectedCallback`/`_initFromDOM` 方法完整
- [ ] DOM 提取逻辑已抽取为共享函数

---

### T1.27 提取 MetricsCollector、RuleEngine、EvolutionEngine

- **依赖**：T1.01, T1.05
- **约束**：3.1, 3.3, 11.1
- **工时**：1.5h

**描述**：
将源码 L5653-6087 的三个类分别提取到 `src/evolution/MetricsCollector.js`、`src/evolution/RuleEngine.js`、`src/evolution/EvolutionEngine.js`。将 ES5 风格（`var`、`function`）统一改为 ES6+。

**验收标准**：
- [ ] 三个文件各自导出类
- [ ] 无 `var` 关键字，全部改为 `const`/`let`
- [ ] 无 `function` 表达式（除类方法外），改为箭头函数
- [ ] `import` 声明 EventBus 依赖

---

### T1.28 提取 CardFrame 主类

- **依赖**：T1.01 ~ T1.27 全部完成
- **约束**：3.1, 3.3, 3.4, 2.1, 2.2
- **工时**：2h

**描述**：
将源码 L6088-7063 的 `CardFrame` 类提取到 `src/core/CardFrame.js`。将构造函数拆分为 `_initModules()`、`_initDefaultTypes()`、`_initFromDOM()` 等子方法。移除对模块级全局实例的引用。

**验收标准**：
- [ ] 导出 `export class CardFrame`
- [ ] `createCard`/`updateCard`/`removeCard`/`getCard`/`getAllCards`/`importData`/`exportData`/`destroy`/`on`/`off`/`emit` 方法完整
- [ ] 构造函数体不超过 30 行，初始化逻辑拆分到子方法
- [ ] 所有依赖通过 `import` 声明
- [ ] 无模块级全局实例引用
- [ ] `CardFrame.VERSION` 静态属性保留
- [ ] 文件不超过 500 行

---

### T1.29 移除模块级全局实例

- **依赖**：T1.28
- **约束**：3.4
- **工时**：0.5h

**描述**：
移除源码 L7064-7082 的 7 个模块级全局实例：`globalStore`、`globalTypeRegistry`、`globalRenderer`、`globalAutoFixer`、`globalValidator`、`_globalShadowCardRegistry`。这些实例的创建逻辑移入 `CardFrame` 构造函数。`CardFrame._globalStore` 静态引用改为实例属性。

**验收标准**：
- [ ] 源码中无 `const globalStore = new Store()` 等模块级实例
- [ ] `CardFrame._globalStore` 改为 `this._store`（实例属性）
- [ ] `defaultCardTypes` 中引用 `CardFrame._globalStore` 的地方改为通过参数传入 store
- [ ] 模块加载时不创建任何实例（除无状态常量/工具对象外）

---

### T1.30 创建 index.js 入口并验证

- **依赖**：T1.01 ~ T1.29 全部完成
- **约束**：3.1, 3.3, 2.2
- **工时**：1h

**描述**：
创建 `src/index.js`，聚合导出所有公开类和常量。验证 `node -e "import('./src/index.js')"` 可成功加载。将 `src/card-framework.css` 移动到 `src/styles/card-framework.css`。保留旧文件 `src/card-framework.js` 暂不删除（Phase 2 完成后删除）。

**验收标准**：
- [ ] `src/index.js` 导出：`CardFrame`、`EventBus`、`Store`、`TypeRegistry`、`Utils`、`Security`、`CircuitBreaker`、`ActionLogger`、`ThemeManager`、`I18nManager`、`PluginManager`、`Renderer`、`LayoutEngine`、`VirtualScroller`、`AutoFixer`、`RealTimeValidator`、`RelationshipEngine`、`MetricsCollector`、`RuleEngine`、`EvolutionEngine`、`PerfPanel`、`GlobalErrorHandler`、`CardObjectPool`、`LayoutCache`、`QueryIndex`、`ShadowCardRegistry`、`EVENT_TYPES`、`DEFAULT_CONFIG`、`CARD_STATUS`
- [ ] `node -e "import('./src/index.js').then(m => console.log(Object.keys(m).length))"` 输出 ≥ 25
- [ ] `src/index.js` 不超过 200 行
- [ ] 旧文件 `src/card-framework.js` 仍存在（向后兼容）

---

### Phase 1 整体验收

- [ ] `src/` 下有 27+ 个 `.js` 文件，每个文件不超过 500 行
- [ ] 无 `var` 关键字（约束 11.1）
- [ ] 无模块级 `new` 实例化（约束 3.4）
- [ ] 类间依赖全部通过 `import` 声明（约束 3.3）
- [ ] `node -e "import('./src/index.js')"` 成功
- [ ] 旧 `src/card-framework.js` 仍可正常使用（构建产物不变）

---

## Phase 2：构建系统重写 — esbuild 替代正则提取

> **Phase 目标**：用 esbuild 替换 `scripts/build.js` 中的正则提取逻辑
> **Phase 验收**：`npm run build` 生成 12+ 个文件，构建不受缩进影响
> **Phase 工时**：2 人天

---

### T2.01 安装 esbuild 并创建新构建脚本骨架

- **依赖**：Phase 1 完成
- **约束**：4.1, 1.2
- **工时**：1h

**描述**：
`npm install --save-dev esbuild`。创建新的 `scripts/build.js` 骨架，替换旧的基于正则的构建脚本。将旧脚本备份为 `scripts/build.legacy.js`。

**验收标准**：
- [ ] `package.json` 的 `devDependencies` 包含 `esbuild`
- [ ] `scripts/build.js` 引入 esbuild，`require('esbuild')`
- [ ] `scripts/build.legacy.js` 保留旧脚本备份
- [ ] `npm run build` 不报错（即使产物不完整）

---

### T2.02 实现全量 IIFE 构建

- **依赖**：T2.01
- **约束**：4.1, 4.3, 2.2
- **工时**：1h

**描述**：
配置 esbuild 以 `src/index.js` 为入口，输出 IIFE 格式到 `dist/card-framework.js`。全局名设为 `CardFrame`，确保 `window.CardFrame` 可用。

**验收标准**：
- [ ] `npm run build` 生成 `dist/card-framework.js`
- [ ] `dist/card-framework.js` 挂载 `window.CardFrame`
- [ ] 在浏览器中 `<script src="dist/card-framework.js"></script>` 后 `window.CardFrame` 可用
- [ ] 不含任何 `require()` 或 `import` 语句

---

### T2.03 实现 ESM 和 CJS 构建

- **依赖**：T2.02
- **约束**：4.3
- **工时**：0.5h

**描述**：
配置 esbuild 输出 ESM 格式（`dist/card-framework.esm.js`）和 CJS 格式（`dist/card-framework.cjs.js`）。

**验收标准**：
- [ ] `dist/card-framework.esm.js` 包含 `export` 语句
- [ ] `dist/card-framework.cjs.js` 包含 `module.exports`
- [ ] `node -e "require('./dist/card-framework.cjs.js')"` 不报错
- [ ] `node --input-type=module -e "import('./dist/card-framework.esm.js').then(m => console.log(typeof m.default))"` 不报错

---

### T2.04 实现压缩版和 Source Map

- **依赖**：T2.03
- **约束**：4.4
- **工时**：0.5h

**描述**：
配置 esbuild `minify: true` 和 `sourcemap: true`，输出 `dist/card-framework.min.js` 和 `dist/card-framework.min.js.map`。

**验收标准**：
- [ ] `dist/card-framework.min.js` 体积 ≤ 80KB
- [ ] `dist/card-framework.min.js.map` 存在且有效
- [ ] 压缩版功能与未压缩版一致（用同一测试验证）

---

### T2.05 实现分模块构建

- **依赖**：T2.02
- **约束**：4.1
- **工时**：1.5h

**描述**：
为 8 个子模块（`core`、`security`、`render`、`validation`、`extras`、`plugins`、`perf`、`evolution`）创建独立入口文件，esbuild 分别构建为 IIFE 格式的 `dist/{module}.js`。保留 `dist/loader.js` 模块加载器。

**验收标准**：
- [ ] 生成 `dist/core.js`、`dist/security.js`、`dist/render.js`、`dist/validation.js`、`dist/extras.js`、`dist/plugins.js`、`dist/perf.js`、`dist/evolution.js`
- [ ] 每个模块文件可独立加载（IIFE 格式）
- [ ] `dist/loader.js` 存在且可按需加载模块

---

### T2.06 复制 CSS 并更新 package.json

- **依赖**：T2.04
- **约束**：4.3, 4.5
- **工时**：0.5h

**描述**：
构建脚本中添加 CSS 复制步骤（`src/styles/card-framework.css` → `dist/card-framework.css`）。更新 `package.json` 的 `main`、`module`、`types`、`exports`、`scripts` 字段。

**验收标准**：
- [ ] `dist/card-framework.css` 存在且内容正确
- [ ] `package.json` 的 `main` = `dist/card-framework.js`
- [ ] `package.json` 的 `module` = `dist/card-framework.esm.js`
- [ ] `package.json` 的 `exports` 字段包含 `.`、`./core`、`./security`、`./render`、`./styles.css`
- [ ] `package.json` 的 `dependencies` 为空或不存在

---

### T2.07 缩进无关性验证

- **依赖**：T2.06
- **约束**：4.2
- **工时**：0.5h

**描述**：
将任意一个源文件的缩进从 2 空格改为 4 空格，运行 `npm run build`，验证构建结果不受影响。

**验收标准**：
- [ ] 修改缩进后 `npm run build` 成功
- [ ] 构建产物功能正常（`window.CardFrame` 可用）
- [ ] 恢复原缩进后构建产物字节级一致

---

### T2.08 构建可重复性验证

- **依赖**：T2.07
- **约束**：4.5
- **工时**：0.5h

**描述**：
连续运行两次 `npm run build`，比对构建产物的哈希值。

**验收标准**：
- [ ] 两次构建的 `dist/card-framework.js` SHA-256 哈希值一致
- [ ] 两次构建的 `dist/card-framework.min.js` SHA-256 哈希值一致
- [ ] `package-lock.json` 已提交

---

### T2.09 清理旧文件

- **依赖**：T2.08
- **约束**：16.4
- **工时**：0.5h

**描述**：
删除 `src/card-framework.js`（单体 IIFE 源码）。删除 `scripts/build.legacy.js`。更新 `.gitignore` 添加 `dist/`。如果 `dist/` 已被 Git 跟踪，从 Git 中移除（`git rm -r --cached dist/`）。

**验收标准**：
- [ ] `src/card-framework.js` 不存在
- [ ] `scripts/build.legacy.js` 不存在
- [ ] `.gitignore` 包含 `dist/`
- [ ] `npm run build` 仍正常工作

---

### Phase 2 整体验收

- [ ] `npm run build` 生成 ≥12 个文件
- [ ] `dist/card-framework.min.js` ≤ 80KB
- [ ] 构建时间 < 1 秒
- [ ] 缩进变化不影响构建（T2.07 验证）
- [ ] `dependencies` 为空
- [ ] 旧源码 `src/card-framework.js` 已删除

---

## Phase 3：测试体系重建 — jsdom 替代手写 mock

> **Phase 目标**：将 218 个"方法存在性检查"替换为验证真实运行时行为的测试套件
> **Phase 验收**：≥500 个测试，覆盖率 ≥70%，安全测试 100% 通过
> **Phase 工时**：4-5 人天

---

### T3.01 创建 jsdom 测试环境

- **依赖**：Phase 2 完成
- **约束**：7.1
- **工时**：1h

**描述**：
创建 `tests/setup.js`，使用 jsdom 提供真实 DOM API。配置 `global.window`、`global.document`、`global.HTMLElement`、`global.customElements`、`global.MutationObserver`、`global.requestAnimationFrame`。更新 `.mocharc.json` 指向 setup 文件。

**验收标准**：
- [ ] `tests/setup.js` 存在且正确配置 jsdom
- [ ] `document.querySelector('body')` 返回真实 DOM 元素（非 null）
- [ ] `document.createElement('div').innerHTML = '<span>test</span>'` 后 `querySelector('span').textContent === 'test'`
- [ ] `.mocharc.json` 配置 `--require tests/setup.js`

---

### T3.02 创建测试辅助工具

- **依赖**：T3.01
- **约束**：7.3
- **工时**：0.5h

**描述**：
创建 `tests/helpers.js`，提供 `createFrame()`（创建独立 CardFrame 实例）、`destroyFrame()`（销毁实例）、`createMockCard()`（创建测试用卡片）、`waitForRAF()`（等待 requestAnimationFrame）等辅助函数。

**验收标准**：
- [ ] `tests/helpers.js` 导出上述函数
- [ ] `createFrame()` 返回的实例有独立 DOM 容器
- [ ] `destroyFrame()` 调用后实例的 EventBus 无监听器、定时器已清理

---

### T3.03 编写 EventBus 单元测试

- **依赖**：T3.01, T3.02
- **约束**：7.2, 7.3, 7.4
- **工时**：1h

**描述**：
编写 `tests/unit/event-bus.test.js`，覆盖：`on`/`off`/`emit` 基本流程、`once` 自动移除、`removeAllByContext` 批量清理、emit 异常隔离、多监听器执行顺序。

**验收标准**：
- [ ] ≥15 个测试用例
- [ ] 测试验证事件触发后的回调执行效果（非方法存在性）
- [ ] 测试验证 emit 中单个监听器异常不影响其他监听器
- [ ] 测试验证 once 回调只执行一次
- [ ] 测试包含 null/undefined 事件名等错误路径

---

### T3.04 编写 Store 单元测试

- **依赖**：T3.01, T3.02
- **约束**：7.2, 7.4
- **工时**：1.5h

**描述**：
编写 `tests/unit/store.test.js`，覆盖：addCard/getCard/removeCard/updateCard、getAllCards 返回深拷贝、query 按类型/标签查询、notify 触发订阅者、addRelationship/getRelationship、toJSON/fromJSON 序列化。

**验收标准**：
- [ ] ≥25 个测试用例
- [ ] 测试验证 `getCard()` 返回的对象与 Store 内部对象不是同一引用
- [ ] 测试验证修改 `getCard()` 返回值不影响 Store 内部数据
- [ ] 测试验证 `removeCard` 后 `getCard` 返回 null
- [ ] 测试包含无 id 卡片、重复 id 等边界条件

---

### T3.05 编写 TypeRegistry 单元测试

- **依赖**：T3.01, T3.02
- **约束**：7.2, 7.4
- **工时**：1h

**描述**：
编写 `tests/unit/type-registry.test.js`，覆盖：register/get/validate、类型继承、unregister、getCardTypes 排序。

**验收标准**：
- [ ] ≥15 个测试用例
- [ ] 测试验证 validate 对未知类型返回 `{ valid: false }`
- [ ] 测试验证类型继承的 props 合并
- [ ] 测试包含未注册类型 validate、重复注册等错误路径

---

### T3.06 编写 Security 单元测试

- **依赖**：T3.01, T3.02
- **约束**：7.2, 7.5
- **工时**：2h

**描述**：
编写 `tests/unit/security.test.js`，覆盖所有安全方法，包括 XSS 攻击向量测试。

**验收标准**：
- [ ] ≥30 个测试用例
- [ ] 测试验证 `sanitizeHtml` 剥离 `<script>` 标签
- [ ] 测试验证 `sanitizeHtml` 剥离 `<img onerror>` 事件
- [ ] 测试验证 `sanitizeUrl` 对 `javascript:alert(1)` 返回空字符串
- [ ] 测试验证 `sanitizeUrl` 对 `null`/`undefined`/`''` 返回空字符串不抛异常
- [ ] 测试验证 `sanitizeStyle` 移除 `expression()` 和 `@import`
- [ ] 测试验证 `escapeHtml` 正确转义 `<>&"'`
- [ ] 测试验证 `sanitizeScriptContent` 处理跨行 `<script>` 标签

---

### T3.07 编写 Renderer 集成测试

- **依赖**：T3.04, T3.05
- **约束**：7.2
- **工时**：2h

**描述**：
编写 `tests/integration/renderer.test.js`，验证渲染行为：createCard 后 DOM 出现元素、updateCard 后 DOM 内容更新、removeCard 后 DOM 元素移除、forceFullRender 清空并重建、renderError 显示错误卡片。

**验收标准**：
- [ ] ≥20 个测试用例
- [ ] 测试验证 `createCard('text', {title: 'Hello'})` 后容器内有 `.cf-card` 元素
- [ ] 测试验证 `updateCard` 后 DOM 文本内容变更
- [ ] 测试验证 `removeCard` 后容器内无对应元素
- [ ] 测试验证 `forceFullRender` 后旧元素的事件监听器被移除
- [ ] 测试验证渲染异常时显示错误占位卡片

---

### T3.08 编写 CardFrame 集成测试

- **依赖**：T3.07
- **约束**：7.2, 7.3
- **工时**：2h

**描述**：
编写 `tests/integration/card-frame.test.js`，验证完整用户操作流程：创建→更新→删除→undo→redo、importData→exportData 往返、destroy 后资源清理。

**验收标准**：
- [ ] ≥20 个测试用例
- [ ] 测试验证 create→update→delete 完整流程
- [ ] 测试验证 undo 恢复到之前状态
- [ ] 测试验证 `exportData()` → `importData()` 往返数据一致
- [ ] 测试验证 `destroy()` 后 EventBus 无监听器、无定时器、DOM 容器已清空
- [ ] 测试验证多个 CardFrame 实例互不干扰

---

### T3.09 编写 PluginManager 集成测试

- **依赖**：T3.08
- **约束**：7.2, 7.4
- **工时**：1h

**描述**：
编写 `tests/integration/plugin-manager.test.js`，验证插件安装/卸载/启用/禁用、hook 执行、异常隔离。

**验收标准**：
- [ ] ≥15 个测试用例
- [ ] 测试验证 install 后插件 hook 被调用
- [ ] 测试验证 uninstall 后插件 hook 不再被调用
- [ ] 测试验证一个插件 hook 异常不影响其他插件
- [ ] 测试验证 enable/disable 切换

---

### T3.10 编写 VirtualScroller 单元测试

- **依赖**：T3.01, T3.02
- **约束**：7.2
- **工时**：1h

**描述**：
编写 `tests/unit/virtual-scroller.test.js`，验证虚拟滚动行为：只渲染可见区域、滚动时回收/创建 DOM、DOM 池化复用。

**验收标准**：
- [ ] ≥10 个测试用例
- [ ] 测试验证 1000 张卡片时 DOM 中只有可见区域数量的元素
- [ ] 测试验证滚动后 DOM 元素被回收复用
- [ ] 测试验证 disable 后所有卡片都渲染

---

### T3.11 编写性能基准测试

- **依赖**：T3.08
- **约束**：7.2
- **工时**：1h

**描述**：
编写 `tests/perf/benchmark.test.js`，验证关键性能指标：渲染 1000 张卡片耗时、对象池命中率、布局缓存命中率、防抖效果。

**验收标准**：
- [ ] ≥10 个测试用例
- [ ] 测试验证渲染 1000 张卡片在 2 秒内完成
- [ ] 测试验证对象池 acquire/release 后池中有回收对象
- [ ] 测试验证 LayoutCache 第二次 get 命中缓存
- [ ] 测试验证 Store.notify 防抖后 16ms 内多次调用只触发一次

---

### T3.12 编写 Web Components 测试

- **依赖**：T3.08
- **约束**：7.2, 10.1, 10.2
- **工时**：1h

**描述**：
编写 `tests/integration/web-components.test.js`，验证 `<card-frame>` 和 `<cf-card>` 自定义元素行为。

**验收标准**：
- [ ] ≥10 个测试用例
- [ ] 测试验证 `<card-frame>` 在 DOM 中创建容器
- [ ] 测试验证 `<cf-card>` 能从 DOM 属性提取卡片数据
- [ ] 测试验证 `cf-card` 先于 `card-frame` 插入时不永久等待（约束 10.1）

---

### T3.13 迁移并删除旧测试

- **依赖**：T3.03 ~ T3.12 全部完成
- **约束**：7.1
- **工时**：0.5h

**描述**：
删除旧的 `tests/test.js`、`tests/evolution-tests.js`、`tests/plugin-tests.js`、`tests/build-tests.js`、`tests/destroy-tests.js`、`tests/virtual-scroll-tests.js` 中已替代的测试。保留 `tests/perf-test.js`（迁移到新测试结构）。更新 `package.json` 的 `test` 脚本。

**验收标准**：
- [ ] 旧测试文件已删除
- [ ] `npm test` 运行新测试套件
- [ ] 新测试总数 ≥ 200（Phase 3 初始目标，后续 Phase 4-7 继续补充至 500+）
- [ ] 测试执行时间 < 10 秒
- [ ] 无测试引用旧的手写 mock DOM

---

### T3.14 配置测试覆盖率

- **依赖**：T3.13
- **约束**：7.2
- **工时**：0.5h

**描述**：
配置 c8 覆盖率工具，设置覆盖率阈值。更新 `package.json` 的 `test:coverage` 脚本。

**验收标准**：
- [ ] `npm run test:coverage` 输出覆盖率报告
- [ ] 覆盖率 ≥ 50%（Phase 3 初始目标，后续 Phase 提升至 70%+）
- [ ] 覆盖率报告包含 `src/` 下所有文件
- [ ] `.nycrc` 或 c8 配置文件存在

---

### Phase 3 整体验收

- [ ] 所有测试通过 `npm test`
- [ ] 测试总数 ≥ 200
- [ ] 覆盖率 ≥ 50%
- [ ] 安全测试 ≥ 30 个且全部通过
- [ ] 无手写 mock DOM
- [ ] 测试执行时间 < 10 秒
- [ ] 每个测试验证行为而非方法存在性

---

## Phase 4：核心类修复 — Store / TypeRegistry / EventBus / CardFrame

> **Phase 目标**：修复评估报告指出的核心类缺陷和 4 个 P0 Bug
> **Phase 验收**：4 个 P0 Bug 修复，核心类有对应测试
> **Phase 工时**：3-4 人天
> **可并行**：Phase 5/6/7 可同时进行

---

### T4.01 修复 P0-Bug1: handleMutations debounce 失效

- **依赖**：Phase 3 完成
- **约束**：8.1, 15.1
- **工时**：0.5h

**描述**：
在 `RealTimeValidator` 构造函数中创建 `this._debouncedValidate = Utils.debounce(() => this.validateAll(), 100)`，`handleMutations` 改为调用 `this._debouncedValidate()`。

**验收标准**：
- [ ] `handleMutations` 不再在方法体内调用 `Utils.debounce()`
- [ ] `this._debouncedValidate` 在构造函数中创建一次
- [ ] 测试验证高频 MutationObserver 回调只触发一次 `validateAll`（100ms 窗口内）

---

### T4.02 修复 P0-Bug2: importData 绕过 Store API

- **依赖**：Phase 3 完成
- **约束**：5.3, 15.1, 15.3
- **工时**：1h

**描述**：
修改 `CardFrame.importData()`，将 `this.store.cards.set(cardData.id, cardData)` 改为 `this.store.addCard(cardData)`。同步修复 `Store.fromJSON()` 中的相同问题。

**验收标准**：
- [ ] `importData` 中无 `this.store.cards.set()` 调用
- [ ] `Store.fromJSON` 中无 `store.cards.set()` 调用
- [ ] 测试验证 `importData` 后 `store.query({type: 'text'})` 能查到导入的卡片
- [ ] 测试验证 `importData` 后 `QueryIndex` 中有对应索引
- [ ] 测试验证 `importData` 触发 `CARD_ADDED` 事件

---

### T4.03 修复 P0-Bug3: Store 浅拷贝导致引用共享

- **依赖**：Phase 3 完成
- **约束**：5.1, 5.2, 5.4, 15.1
- **工时**：2h

**描述**：
1. 增强 `Utils.deepClone()` 支持 `Map`、`Set`、`RegExp`、循环引用。
2. `Store.addCard()` 改为 `const newCard = Utils.deepClone({ ...card, updatedAt: Date.now() })`。
3. `Store.updateCard()` 改为深拷贝。
4. `Store.getCard()` / `getAllCards()` / `query()` 返回深拷贝。

**验收标准**：
- [ ] `Utils.deepClone()` 正确处理 Map、Set、Date、RegExp、循环引用
- [ ] `Utils.deepClone()` 对循环引用不栈溢出
- [ ] `Store.getCard()` 返回的对象修改后不影响 Store 内部数据
- [ ] `Store.addCard()` 存储的卡片的 `props` 与传入参数不是同一引用
- [ ] `Store.updateCard()` 存储的卡片的 `props` 与传入参数不是同一引用
- [ ] 测试覆盖上述每个场景

---

### T4.04 修复 P0-Bug4: ShadowCardElement._cleanup 参数错误

- **依赖**：Phase 3 完成
- **约束**：15.1
- **工时**：0.5h

**描述**：
修正 `ShadowCardElement._cleanup` 中 `forEach` 回调参数顺序。`Map.forEach(callback)` 回调签名是 `(value, key)`，修正 `removeEventListener` 的参数。

**验收标准**：
- [ ] `removeEventListener` 接收正确的 `(eventType, handler)` 参数
- [ ] 测试验证 `_cleanup` 后事件监听器被正确移除
- [ ] 测试验证 `_cleanup` 后调用已移除的事件不触发回调

---

### T4.05 Store.updateCard 支持增量更新

- **依赖**：T4.03
- **约束**：2.4
- **工时**：1h

**描述**：
`Store.updateCard` 支持两种签名：`updateCard(card)` 完整更新（向后兼容）、`updateCard(id, partialProps)` 增量更新。增量更新时 `Object.assign` 到现有 card 的 props，深拷贝后存储。

**验收标准**：
- [ ] `updateCard(card)` 签名行为不变（向后兼容）
- [ ] `updateCard(id, {title: 'new'})` 只更新指定字段
- [ ] 增量更新后 `updatedAt` 更新
- [ ] 增量更新触发 `notify`
- [ ] 测试覆盖两种签名

---

### T4.06 Store.notify 防抖

- **依赖**：T4.03
- **约束**：8.2
- **工时**：1h

**描述**：
新增 `Store.notifyDebounced()` 方法，默认 16ms 防抖。`updateCard`/`addCard`/`removeCard` 改为调用 `notifyDebounced()`。保留 `notify()` 同步通知方法（可通过参数禁用防抖）。

**验收标准**：
- [ ] `notifyDebounced()` 在 16ms 内多次调用只触发一次 `notify()`
- [ ] `notify(true)` 立即同步通知（禁用防抖）
- [ ] 测试验证 100 次 `updateCard` 在 16ms 内只触发一次通知
- [ ] 测试验证 `notify(true)` 立即触发

---

### T4.07 Store 关系查询 O(1) 索引

- **依赖**：T4.03
- **约束**：8.3
- **工时**：1h

**描述**：
新增 `Store._relIndex: Map<cardId, Set<relId>>`。`addRelationship` 时更新索引，`removeRelationship`/`removeCard` 时清理索引。新增 `getRelationshipsByCard(cardId)` 方法通过索引查询。

**验收标准**：
- [ ] `getRelationshipsByCard(cardId)` 返回该卡片参与的所有关系
- [ ] `removeCard` 时关联的关系索引被清理
- [ ] 测试验证 1000 条关系时 `getRelationshipsByCard` 性能为 O(1)（与关系总数无关）
- [ ] `getRelationship(relId)` 通过 `Map.get()` 实现 O(1)

---

### T4.08 TypeRegistry.validate 支持 props schema 校验

- **依赖**：Phase 3 完成
- **约束**：6.1
- **工时**：1h

**描述**：
增强 `TypeRegistry.validate()`，除了检查 type 存在，还校验 props 结构：必填字段检查、类型检查、allowedValues 检查。返回 `{ valid, errors }` 结构。提取 `hasValue` 辅助函数消除重复条件。

**验收标准**：
- [ ] validate 对缺少必填字段的卡片返回 `{ valid: false, errors: [...] }`
- [ ] validate 对类型不匹配的字段返回错误
- [ ] validate 对 allowedValues 之外的值返回错误
- [ ] errors 数组包含 `field` 和 `message` 字段
- [ ] 测试覆盖正向（合法）和反向（各种非法）场景
- [ ] `hasValue` 辅助函数已提取，条件不再重复 4 次

---

### T4.09 EventBus 修复 once 清理和异常传播

- **依赖**：Phase 3 完成
- **约束**：12.1
- **工时**：1h

**描述**：
1. `removeAllByContext` 同时清理 `_onceHandlers` Map。
2. `emit` 中监听器异常除 `console.error` 外，还通过 `FRAMEWORK_ERROR` 事件传播。

**验收标准**：
- [ ] `removeAllByContext(ctx)` 后，`once` 注册的回调不再被触发
- [ ] 监听器异常触发 `FRAMEWORK_ERROR` 事件
- [ ] 一个监听器异常不影响后续监听器执行
- [ ] 测试覆盖上述场景

---

### T4.10 CardFrame.constructor 拆分

- **依赖**：T1.28（如未在 Phase 1 中完成）
- **约束**：3.2
- **工时**：1h

**描述**：
将 `CardFrame` 构造函数拆分为 `_initModules()`、`_initDefaultTypes()`、`_initFromDOM()`、`_initPlugins()`、`_initValidator()` 等子方法。构造函数体不超过 30 行。

**验收标准**：
- [ ] 构造函数体不超过 30 行
- [ ] 每个子方法职责单一
- [ ] 初始化顺序与原逻辑一致
- [ ] 所有测试通过

---

### T4.11 CardFrame.destroy 完整清理

- **依赖**：T4.10
- **约束**：8.5
- **工时**：1.5h

**描述**：
完善 `CardFrame.destroy()` 清理流程：EventBus 全部移除监听器、所有 setTimeout/setInterval 清理、MutationObserver/ResizeObserver disconnect、requestAnimationFrame cancel、对象池/缓存/索引清空、DOM 引用置 null、`CardFrame._globalStore` 静态引用清理。

**验收标准**：
- [ ] destroy 后 EventBus `listenerCount` 为 0
- [ ] destroy 后无活跃定时器（通过 `setTimeout` mock 验证）
- [ ] destroy 后 MutationObserver 已 disconnect
- [ ] destroy 后 DOM 容器内容为空
- [ ] destroy 后 `CardFrame._globalStore` 不引用该实例的 store
- [ ] 测试覆盖上述每个场景

---

### T4.12 CardFrame.importData/exportData 版本兼容

- **依赖**：T4.02
- **约束**：2.1
- **工时**：1h

**描述**：
`importData` 添加版本检查：`data.version` 与 `CardFrame.VERSION` 比较，major version 不兼容时调用 `_migrateData()`。`exportData` 输出包含 `version` 字段。

**验收标准**：
- [ ] `exportData()` 输出包含 `version: CardFrame.VERSION`
- [ ] `importData` 对不同 major version 的数据尝试迁移
- [ ] `importData` 对不兼容且无迁移函数的数据抛出明确错误
- [ ] 同版本数据 `export→import` 往返一致
- [ ] 测试覆盖版本兼容和不兼容场景

---

### T4.13 修复 P1-Bug5: renderError delete 按钮无效

- **依赖**：Phase 3 完成
- **约束**：15.2
- **工时**：0.5h

**描述**：
`Renderer.renderError` 中 `card.store` 改为通过闭包捕获的 `this.store` 引用。

**验收标准**：
- [ ] 错误卡片的删除按钮点击后调用 `store.removeCard(card.id)`
- [ ] 测试验证删除按钮可正常删除卡片

---

### T4.14 修复 P1-Bug6: list addItem action 调用签名错误

- **依赖**：Phase 3 完成
- **约束**：15.2
- **工时**：0.5h

**描述**：
`defaultCardTypes` 中 `list` 类型的 `addItem` action，将 `store.updateCard(card.id, { items })` 改为 `store.updateCard({ ...card, props: { ...card.props, items } })` 或使用新的增量更新签名 `store.updateCard(card.id, { items })`（取决于 T4.05 是否完成）。

**验收标准**：
- [ ] list 卡片的 addItem action 正确更新 items
- [ ] 测试验证添加 item 后卡片 props.items 包含新项

---

### T4.15 修复 P1-Bug7: batchCreateCards 修改 id 不更新 Map

- **依赖**：Phase 3 完成
- **约束**：15.2
- **工时**：0.5h

**描述**：
`CardFrame.batchCreateCards` 中，如果 `cardData.id` 存在，先设置 id 再调用 `createCard`，或在 `createCard` 后调用 `store.updateCard` 更新 id。

**验收标准**：
- [ ] `batchCreateCards` 后 `getCard(customId)` 返回正确卡片
- [ ] 测试验证自定义 id 的批量创建

---

### T4.16 pause/resume 异常安全

- **依赖**：Phase 3 完成
- **约束**：12.3
- **工时**：0.5h

**描述**：
所有使用 `validator.pause()` / `validator.resume()` 的地方改为 `try/finally` 模式。

**验收标准**：
- [ ] 所有 pause/resume 对使用 try/finally
- [ ] 测试验证渲染异常后 validator 未永久暂停
- [ ] 搜索源码无未保护的 `pause()` 调用

---

### T4.17 Phase 4 测试补充

- **依赖**：T4.01 ~ T4.16
- **约束**：7.2, 7.4
- **工时**：2h

**描述**：
为 Phase 4 中的每个修复编写对应测试，确保修复行为可验证。补充错误路径测试。

**验收标准**：
- [ ] 每个 P0/P1 Bug 修复有对应回归测试
- [ ] Store 增量更新有正向和反向测试
- [ ] destroy 清理有完整的资源泄漏测试
- [ ] Phase 4 新增测试 ≥ 50 个
- [ ] 覆盖率提升至 60%+

---

### Phase 4 整体验收

- [ ] 4 个 P0 Bug 全部修复且有回归测试
- [ ] 6 个 P1 Bug 中与核心类相关的全部修复
- [ ] Store 支持增量更新、防抖、O(1) 关系查询
- [ ] TypeRegistry 支持 props schema 校验
- [ ] EventBus once 清理、异常传播
- [ ] CardFrame.destroy 完整清理
- [ ] 覆盖率 ≥ 60%

---

## Phase 5：插件系统加固 — 权限校验 / 沙箱 / 卸载清理

> **Phase 目标**：修复插件系统的 4 个严重缺陷
> **Phase 验收**：插件有沙箱、权限校验、卸载清理、hooks 优先级
> **Phase 工时**：2-3 人天
> **可并行**：Phase 4/6/7 可同时进行

---

### T5.01 创建 PluginSandbox 类

- **依赖**：Phase 3 完成
- **约束**：6.6, 9.3
- **工时**：2h

**描述**：
创建 `src/plugins/PluginSandbox.js`。沙箱为每个插件创建独立 EventBus 代理、追踪定时器和事件监听器、提供受限的 API 上下文。

**验收标准**：
- [ ] `PluginSandbox` 类存在且导出
- [ ] `createPluginContext()` 返回受限 API 对象（store 代理、eventBus 代理、typeRegistry 代理）
- [ ] 沙箱追踪 `setInterval`/`setTimeout` 调用
- [ ] 沙箱追踪 `addEventListener` 调用
- [ ] `destroy()` 清理所有追踪的资源
- [ ] 不暴露 `circuitBreaker`/`perf` 等内部模块

---

### T5.02 实现插件权限校验

- **依赖**：T5.01
- **约束**：6.5, 9.1
- **工时**：1h

**描述**：
`PluginManager.install()` 中添加权限校验逻辑。`CardFrame` 构造函数接受 `options.allowedPluginPermissions` 白名单。

**验收标准**：
- [ ] 未声明 permissions 的插件默认安装成功
- [ ] 声明了未授权权限的插件安装抛出异常
- [ ] `options.allowedPluginPermissions` 未设置时不校验（向后兼容）
- [ ] 测试覆盖授权通过和拒绝场景

---

### T5.03 实现插件卸载完整清理

- **依赖**：T5.01
- **约束**：9.1
- **工时**：1.5h

**描述**：
`PluginManager.install()` 中追踪插件注册的资源（类型、主题、事件监听器、定时器）。`uninstall()` 时按顺序清理：调用 onUninstall → 清理类型 → 清理主题 → 销毁沙箱 → 从列表移除。

**验收标准**：
- [ ] install 时记录插件注册的类型名称
- [ ] install 时记录插件注册的主题名称
- [ ] uninstall 后 `typeRegistry.get(pluginRegisteredType)` 返回 undefined
- [ ] uninstall 后 `themeManager.getTheme(pluginRegisteredTheme)` 返回 undefined
- [ ] uninstall 后插件的定时器已清除
- [ ] uninstall 后插件的事件监听器已移除
- [ ] uninstall 触发 `PLUGIN_UNINSTALLED` 事件
- [ ] 测试覆盖上述每个场景

---

### T5.04 实现 hooks 优先级

- **依赖**：T5.03
- **约束**：9.2
- **工时**：1h

**描述**：
`_executeHook` 按 `priority` 降序排序后执行。插件 hook 声明支持 `{ name, priority, handler }` 格式。不声明 priority 的默认为 0。

**验收标准**：
- [ ] 高优先级 hook 先执行
- [ ] 同优先级 hook 按安装顺序执行
- [ ] 不声明 priority 的 hook 默认为 0
- [ ] 测试验证执行顺序

---

### T5.05 修复 _registerPluginActions 空方法

- **依赖**：Phase 3 完成
- **约束**：9.4
- **工时**：0.5h

**描述**：
实现 `_registerPluginActions` 方法，将插件声明的 actions 注册到框架 action 系统。或者如果 action 系统未实现，移除 `install` 中的调用点。

**验收标准**：
- [ ] `_registerPluginActions` 方法体不为空，或调用点已移除
- [ ] 如实现：插件声明的 actions 可通过 `frame.executeAction(name, ...)` 调用
- [ ] 如移除：`install` 中无 `_registerPluginActions` 调用

---

### T5.06 插件异常隔离

- **依赖**：T5.04
- **约束**：6.6, 9.3, 12.1
- **工时**：1h

**描述**：
`_executeHook` 中每个插件的 hook 执行包裹 try/catch。异常 `console.error` 并通过 `FRAMEWORK_ERROR` 事件传播，不中断后续插件。

**验收标准**：
- [ ] 一个插件 hook 抛异常后，后续插件的 hook 仍执行
- [ ] 异常通过 `FRAMEWORK_ERROR` 事件传播
- [ ] 异常信息包含插件名和 hook 名
- [ ] 测试覆盖异常隔离场景

---

### T5.07 Phase 5 测试补充

- **依赖**：T5.01 ~ T5.06
- **约束**：7.2, 7.4
- **工时**：1.5h

**描述**：
为 Phase 5 中的每个改动编写测试。包括：沙箱资源清理测试、权限拒绝测试、卸载清理完整性测试、优先级顺序测试、异常隔离测试。

**验收标准**：
- [ ] Phase 5 新增测试 ≥ 30 个
- [ ] 沙箱 destroy 后无定时器泄漏
- [ ] 卸载后注册的资源全部清理
- [ ] 覆盖率提升至 65%+

---

### Phase 5 整体验收

- [ ] 插件有独立沙箱（独立 EventBus 代理、资源追踪）
- [ ] 权限校验生效
- [ ] 卸载后注册的类型/主题/监听器/定时器全部清理
- [ ] hooks 按优先级执行
- [ ] 插件异常不中断其他插件
- [ ] `_registerPluginActions` 已实现或移除

---

## Phase 6：安全增强 — sanitizeUrl / sanitizeScriptContent / CSP

> **Phase 目标**：修复安全实现缺陷，达到企业级安全标准
> **Phase 验收**：安全测试 100% 通过，XSS 攻击向量全部拦截
> **Phase 工时**：1-2 人天
> **可并行**：Phase 4/5/7 可同时进行

---

### T6.01 修复 sanitizeUrl

- **依赖**：Phase 3 完成
- **约束**：6.3, 6.4
- **工时**：1h

**描述**：
重写 `Security.sanitizeUrl()`：使用 try/catch 包裹 `new URL()`，对无效 URL 返回空字符串。协议白名单：`http:`、`https:`、`mailto:`、`tel:`、`data:`（仅图片格式）。`data:` 协议检查 dangerous patterns。

**验收标准**：
- [ ] `sanitizeUrl(null)` 返回 `''`
- [ ] `sanitizeUrl(undefined)` 返回 `''`
- [ ] `sanitizeUrl('')` 返回 `''`
- [ ] `sanitizeUrl('javascript:alert(1)')` 返回 `''`
- [ ] `sanitizeUrl('vbscript:alert(1)')` 返回 `''`
- [ ] `sanitizeUrl('data:text/html,<script>alert(1)</script>')` 返回 `''`
- [ ] `sanitizeUrl('https://example.com')` 返回原始 URL
- [ ] `sanitizeUrl('mailto:test@example.com')` 返回原始 URL
- [ ] `sanitizeUrl('not a url')` 不抛异常，返回 `''` 或安全 URL
- [ ] 测试覆盖上述每个场景

---

### T6.02 增强 sanitizeScriptContent

- **依赖**：Phase 3 完成
- **约束**：6.1
- **工时**：0.5h

**描述**：
增强 `Security.sanitizeScriptContent()`：处理跨行 `<script>` 标签、未闭合 `<script>` 标签、内联事件处理器（`onclick=` 等）、`javascript:` 协议。

**验收标准**：
- [ ] 能移除跨行 `<script>...\n...</script>` 标签
- [ ] 能移除未闭合的 `<script>` 标签
- [ ] 能移除 `onclick="..."`、`onerror='...'`、`onload=xxx` 等内联事件
- [ ] 能移除 `javascript:` 协议
- [ ] 测试覆盖上述每个攻击向量

---

### T6.03 修复 tooltip XSS (P1-Bug9)

- **依赖**：Phase 3 完成
- **约束**：6.2, 15.2
- **工时**：0.5h

**描述**：
`RelationshipEngine._showRelationshipTooltip` 中使用 `Security.escapeHtml()` 转义 `rel.type`、`rel.sourceId`、卡片标题，或改用 `textContent`。

**验收标准**：
- [ ] tooltip 中不使用 `innerHTML` 插入未转义内容
- [ ] 测试验证卡片标题包含 `<script>` 时 tooltip 不执行脚本
- [ ] 测试验证 `rel.type` 包含 `<img onerror>` 时 tooltip 不执行事件

---

### T6.04 sanitizeStyle 正则 lastIndex 修复

- **依赖**：Phase 3 完成
- **约束**：6.1
- **工时**：0.5h

**描述**：
修复 `Security.sanitizeStyle()` 中正则 `test()` 修改 `lastIndex` 导致 `replace()` 从错误位置开始的问题。每次 test 前重置 `lastIndex`，或使用不共享 `lastIndex` 的方式。

**验收标准**：
- [ ] `sanitizeStyle('color: red; expression(alert(1))')` 正确移除 `expression()`
- [ ] `sanitizeStyle('background: url(javascript:alert(1))')` 正确移除 `javascript:`
- [ ] 连续调用 sanitizeStyle 结果一致（无 lastIndex 残留）
- [ ] 测试覆盖上述场景

---

### T6.05 isSafeUrl 相对路径修复

- **依赖**：T6.01
- **约束**：6.4
- **工时**：0.5h

**描述**：
修复 `Security.isSafeUrl()` 中 `//evil.com` 以 `/` 开头被误判为安全的问题。协议相对 URL 应进一步检查。

**验收标准**：
- [ ] `//evil.com` 不被自动判为安全
- [ ] `/path/to/resource` 仍被正确判为安全
- [ ] `./relative` 和 `../relative` 仍被正确判为安全
- [ ] 测试覆盖上述场景

---

### T6.06 CSP 支持

- **依赖**：Phase 3 完成
- **约束**：6.7
- **工时**：0.5h

**描述**：
`CardFrame` 构造函数接受 `options.csp` 参数。如果页面已有 CSP meta 标签则不覆盖，否则添加。移除或修正 `checkCSPCompatibility` 中的反直觉逻辑（P2-Bug12）。

**验收标准**：
- [ ] `new CardFrame(el, {csp: "default-src 'self'"})` 添加 CSP meta 标签
- [ ] 页面已有 CSP meta 时不覆盖
- [ ] `checkCSPCompatibility` 变量命名修正或方法移除
- [ ] 框架源码中无 `eval()`/`new Function()`（约束 6.7）
- [ ] 测试覆盖 CSP 添加和已存在场景

---

### T6.07 Phase 6 安全测试补充

- **依赖**：T6.01 ~ T6.06
- **约束**：7.5
- **工时**：1h

**描述**：
补充安全测试，覆盖所有已知攻击向量。

**验收标准**：
- [ ] 新增安全测试 ≥ 20 个
- [ ] 以下攻击向量全部有测试且通过：
  - `<script>` 标签注入
  - `<img onerror>` 事件注入
  - `<svg onload>` 事件注入
  - `javascript:` URL 协议
  - `vbscript:` URL 协议
  - `data:text/html` URL
  - `data:application/javascript` URL
  - 内联事件处理器（`onclick=`、`onerror=`）
  - CSS `expression()`
  - CSS `@import`
  - CSS `url(javascript:...)`
  - CSS `-moz-binding`
  - 跨行 `<script>` 标签
  - `null` 字符绕过
  - 大小写混淆（`JaVaScRiPt:`）
- [ ] 安全测试 100% 通过

---

### Phase 6 整体验收

- [ ] `sanitizeUrl` 不抛异常，正确过滤危险协议
- [ ] `sanitizeScriptContent` 处理跨行 script 和内联事件
- [ ] tooltip XSS 已修复
- [ ] `sanitizeStyle` 正则 lastIndex 问题已修复
- [ ] `isSafeUrl` 相对路径修复
- [ ] CSP 支持可用
- [ ] 框架源码无 `eval`/`new Function`
- [ ] 安全测试 ≥ 50 个且 100% 通过

---

## Phase 7：Web Components 修复 — 竞态条件 / Shadow DOM 穿透

> **Phase 目标**：修复 Web Components 的 3 个缺陷
> **Phase 验收**：竞态修复、Shadow DOM 穿透、多版本共存
> **Phase 工时**：1-2 人天
> **可并行**：Phase 4/5/6 可同时进行

---

### T7.01 修复 cf-card 竞态条件

- **依赖**：Phase 3 完成
- **约束**：10.1
- **工时**：1h

**描述**：
`CardElement.connectedCallback` 中，如果 `card-frame` 未找到，使用 MutationObserver 等待 `card-frame` 出现。5 秒超时后放弃并 console.warn。

**验收标准**：
- [ ] `cf-card` 先于 `card-frame` 插入 DOM 时能正确初始化
- [ ] `card-frame` 插入后 `cf-card` 完成初始化
- [ ] 5 秒超时后 MutationObserver 已 disconnect
- [ ] `disconnectedCallback` 中清理 MutationObserver
- [ ] 测试覆盖竞态场景

---

### T7.02 实现 Shadow DOM 穿透

- **依赖**：T7.01
- **约束**：10.2
- **工时**：1h

**描述**：
`CardElement._getFrame()` 先尝试 `closest()`，失败后遍历 Shadow DOM 祖先链（`getRootNode()` → `host` → `closest()`）。

**验收标准**：
- [ ] 普通 DOM 中的 `cf-card` 能找到 `card-frame`
- [ ] Shadow DOM 内的 `cf-card` 能找到宿主 `card-frame`
- [ ] 嵌套 Shadow DOM 中的 `cf-card` 能找到宿主 `card-frame`
- [ ] 未找到时返回 null，不抛异常
- [ ] 测试覆盖普通 DOM 和 Shadow DOM 场景

---

### T7.03 实现多版本共存

- **依赖**：T7.01
- **约束**：10.3
- **工时**：1h

**描述**：
`registerCustomElements(frameInstance, namespace)` 函数，tag 名支持命名空间后缀（如 `cf-card-v2`）。`CardFrame` 构造函数接受 `options.namespace` 参数。

**验收标准**：
- [ ] 同一页面可加载两个 CardFrame 版本，各自独立工作
- [ ] 不同版本的 `card-frame` / `cf-card` tag 名不冲突
- [ ] 默认 namespace 为空时 tag 名与原来一致（`card-frame` / `cf-card`）
- [ ] 测试覆盖多版本共存场景

---

### T7.04 修复 attributeChangedCallback 异常安全

- **依赖**：Phase 3 完成
- **约束**：10.4
- **工时**：0.5h

**描述**：
`CardElement.attributeChangedCallback` 中 `_isUpdating` 标志改为 `try/finally` 保护。

**验收标准**：
- [ ] `render()` 抛异常后 `_isUpdating` 被重置为 false
- [ ] 异常后的属性变更不会被错误跳过
- [ ] 测试覆盖异常场景

---

### T7.05 修复 P2-Bug11: CardElement 突变 Store

- **依赖**：T4.03（深拷贝修复）
- **约束**：5.1, 15.2
- **工时**：0.5h

**描述**：
`CardElement.attributeChangedCallback` 中 `card.props[propName] = newValue` 直接修改了 Store 返回的对象。改为创建新 card 对象后调用 `store.updateCard`。

**验收标准**：
- [ ] `attributeChangedCallback` 不直接修改 Store 返回的对象
- [ ] 属性变更通过 `store.updateCard` 走正常更新流程
- [ ] 测试验证属性变更触发 undo 记录

---

### T7.06 修复 forceFullRender 监听器泄漏 (P1-Bug8)

- **依赖**：Phase 3 完成
- **约束**：8.6
- **工时**：0.5h

**描述**：
`Renderer.forceFullRender()` 在 `innerHTML = ''` 前先对每个卡片元素调用 `cleanupCardElement()` 移除事件监听器。

**验收标准**：
- [ ] `forceFullRender` 前所有卡片元素的事件监听器被移除
- [ ] 测试验证 `forceFullRender` 后无事件监听器残留
- [ ] 测试验证 `forceFullRender` 后重新渲染的卡片事件正常

---

### T7.07 CircuitBreaker half-open 并发限制 (P1-Bug10)

- **依赖**：Phase 3 完成
- **约束**：15.2
- **工时**：0.5h

**描述**：
`CircuitBreaker` half-open 状态下只允许 1 个试探请求通过，其余拒绝。添加 `_halfOpenInProgress` 标志。

**验收标准**：
- [ ] half-open 状态下第一个 `canExecute()` 返回 true
- [ ] 试探请求完成前后续 `canExecute()` 返回 false
- [ ] 试探成功后状态变为 closed，所有请求通过
- [ ] 试探失败后状态变为 open，所有请求拒绝
- [ ] 测试覆盖 half-open 竞态场景

---

### T7.08 Phase 7 测试补充

- **依赖**：T7.01 ~ T7.07
- **约束**：7.2
- **工时**：1h

**描述**：
为 Phase 7 中的每个修复编写测试。

**验收标准**：
- [ ] Phase 7 新增测试 ≥ 20 个
- [ ] 竞态条件有时序测试
- [ ] Shadow DOM 穿透有 jsdom 测试
- [ ] 多版本共存有集成测试
- [ ] 覆盖率提升至 70%+

---

### Phase 7 整体验收

- [ ] `cf-card` 先于 `card-frame` 插入时能初始化
- [ ] Shadow DOM 内的 `cf-card` 能找到 `card-frame`
- [ ] 多版本共存正常工作
- [ ] `attributeChangedCallback` 异常安全
- [ ] `CardElement` 不突变 Store
- [ ] `forceFullRender` 不泄漏监听器
- [ ] `CircuitBreaker` half-open 并发限制

---

## Phase 8：发布工程 — 类型生成 / 压缩 / Source Map / CI/CD

> **Phase 目标**：达到企业级 npm 包发布标准
> **Phase 验收**：`npm pack` 通过，CI 在 Node.js 18/20/22 上全通过
> **Phase 工时**：2-3 人天

---

### T8.01 添加 JSDoc 类型注释

- **依赖**：Phase 4/5/6/7 完成
- **约束**：11.6, 13.1
- **工时**：3h

**描述**：
为所有公开类和公开方法添加 JSDoc 注释（`@class`、`@param`、`@returns`、`@throws`）。私有方法（`_` 前缀）添加一行说明注释。

**验收标准**：
- [ ] 所有 `export class` 有 `@class` 和 `@description` JSDoc
- [ ] 所有公开方法有 `@param`、`@returns` JSDoc
- [ ] 私有方法有一行说明注释
- [ ] `CardProps`、`Card`、`CardType` 等有 `@typedef` 定义

---

### T8.02 配置 TypeScript 自动生成 .d.ts

- **依赖**：T8.01
- **约束**：13.1, 13.2
- **工时**：1h

**描述**：
`npm install --save-dev typescript`。创建 `tsconfig.json` 配置 `declaration: true`、`allowJs: true`、`emitDeclarationOnly: true`。构建脚本中添加 `tsc` 步骤生成 `dist/card-framework.d.ts`。

**验收标准**：
- [ ] `npx tsc` 生成 `dist/card-framework.d.ts`
- [ ] `.d.ts` 包含所有公开类和方法的类型声明
- [ ] `.d.ts` 中公开 API 无 `any` 类型
- [ ] `.d.ts` 中的方法签名与运行时行为一致
- [ ] 构建脚本中自动运行 `tsc`

---

### T8.03 统一 ES6+ 代码风格

- **依赖**：Phase 4/5/6/7 完成
- **约束**：11.1
- **工时**：1.5h

**描述**：
全局搜索并修复所有 ES5 风格代码：`var` → `const`/`let`、`function` 表达式 → 箭头函数、`for(i=0;...)` → `for...of`/`forEach`。

**验收标准**：
- [ ] 源码中无 `var` 关键字
- [ ] 无 `function` 表达式（类方法除外）
- [ ] 无 `for (var i = 0` 循环
- [ ] 所有测试通过

---

### T8.04 统一事件名常量

- **依赖**：Phase 4/5/6/7 完成
- **约束**：11.2
- **工时**：1h

**描述**：
搜索所有 `eventBus.emit('裸字符串')` 和 `eventBus.on('裸字符串')`，替换为 `EVENT_TYPES` 常量。约 15 个裸字符串事件名需要添加到 `EVENT_TYPES`。

**验收标准**：
- [ ] `EVENT_TYPES` 中包含所有框架内部事件名
- [ ] 源码中无框架内部事件的裸字符串（搜索 `emit('` 和 `on('`）
- [ ] 插件自定义事件不受影响（不在 `EVENT_TYPES` 中）
- [ ] 所有测试通过

---

### T8.05 消除魔法数字

- **依赖**：Phase 4/5/6/7 完成
- **约束**：11.3, 11.4
- **工时**：1h

**描述**：
搜索源码中的魔法数字（超时时间、池容量、重试次数、缩放限制等），替换为 `DEFAULT_CONFIG` 或 `PERF_CONSTANTS` 中的常量引用。修复 `LayoutEngine.setZoom` 中与 `DEFAULT_CONFIG.ZOOM` 不一致的硬编码值。移除 `DEFAULT_CONFIG` 中未被引用的死配置。

**验收标准**：
- [ ] `LayoutEngine.setZoom` 使用 `DEFAULT_CONFIG.ZOOM.MIN`/`MAX` 而非硬编码
- [ ] `DEFAULT_CONFIG` 中所有配置项都被代码引用
- [ ] `Security._safeProtocols` 被实际使用
- [ ] 无明显的魔法数字（100、50、2000、5000 等）

---

### T8.06 统一命名一致性

- **依赖**：Phase 4/5/6/7 完成
- **约束**：11.5
- **工时**：1h

**描述**：
统一命名：事件处理器统一用 `handler`、内部 Map 字段统一用 `_` 前缀、私有方法统一用 `_` 前缀。

**验收标准**：
- [ ] 事件处理器参数统一为 `handler`（不混用 `callback`、`listener`、`fn`）
- [ ] 内部 Map 字段统一 `_` 前缀（如 `_events`、`_cards`、`_types`）
- [ ] 私有方法统一 `_` 前缀
- [ ] 所有测试通过

---

### T8.07 消除重复代码

- **依赖**：Phase 4/5/6/7 完成
- **约束**：11.5
- **工时**：1.5h

**描述**：
1. `escapeHtml`/`escapeAttr` 统一为一份实现（保留 `Utils.escapeHtml`/`Utils.escapeAttr`，其他引用它）。
2. `renderCard`/`updateCardElement` 的重复逻辑提取为 `_applyCardStyles`、`_attachImageErrorHandler`。
3. `_renderLines`/`_updateLines` 的重复逻辑提取为 `_getRelationshipCoords`。
4. `extractCardFromElement`/`_initFromDOM` 的重复逻辑提取为共享函数。

**验收标准**：
- [ ] `escapeHtml` 只有一份实现
- [ ] `escapeAttr` 只有一份实现
- [ ] `renderCard`/`updateCardElement` 无逐行复制代码
- [ ] `_renderLines`/`_updateLines` 无逐行复制代码
- [ ] 所有测试通过

---

### T8.08 创建 CHANGELOG.md

- **依赖**：T8.07
- **约束**：14.1
- **工时**：0.5h

**描述**：
创建 `CHANGELOG.md`，记录 v2.0.0 的所有变更。格式遵循 Keep a Changelog。

**验收标准**：
- [ ] `CHANGELOG.md` 存在
- [ ] 包含 `## [2.0.0]` 版本条目
- [ ] 分类列出 Added/Changed/Fixed/Removed
- [ ] 列出所有 12 个 Bug 修复

---

### T8.09 更新 README.md

- **依赖**：T8.08
- **约束**：14.3
- **工时**：0.5h

**描述**：
更新 README.md：修正声称的功能列表（标注"计划中"或"实验性"的功能）、更新安装说明（支持 npm/ESM/IIFE 三种方式）、更新版本号。

**验收标准**：
- [ ] README 中无声称但实际未实现的功能
- [ ] 安装说明包含 npm、ESM、IIFE 三种方式
- [ ] 版本号更新为 2.0.0
- [ ] 特性列表与实际实现一致

---

### T8.10 更新 API 文档

- **依赖**：T8.02
- **约束**：14.2
- **工时**：1h

**描述**：
更新 `docs/api-reference.md`，确保 API 文档与源码实际行为一致。特别是 `Store.updateCard` 的新签名、插件系统的新 API（沙箱/权限/优先级）。

**验收标准**：
- [ ] `docs/api-reference.md` 中所有 API 签名与源码一致
- [ ] `Store.updateCard` 文档包含两种签名
- [ ] 插件系统文档包含权限、沙箱、优先级说明
- [ ] 无已不存在的 API 出现在文档中

---

### T8.11 配置 CI/CD

- **依赖**：T8.09
- **约束**：16.3
- **工时**：1h

**描述**：
创建 `.github/workflows/ci.yml`，配置 CI 流水线：Node.js 18/20/22 矩阵测试、构建、覆盖率、npm 发布。

**验收标准**：
- [ ] CI 配置文件存在
- [ ] CI 在 push 和 PR 时触发
- [ ] CI 运行 `npm ci` → `npm run build` → `npm test` → `npm run test:coverage`
- [ ] CI 在 Node.js 18/20/22 上全部通过
- [ ] tag `v*` 时触发 npm 发布

---

### T8.12 npm pack 验证

- **依赖**：T8.10
- **约束**：16.3
- **工时**：0.5h

**描述**：
运行 `npm pack --dry-run` 验证打包文件列表。确保只包含必要文件（`dist/`、`README.md`、`CHANGELOG.md`、`LICENSE`）。

**验收标准**：
- [ ] `npm pack --dry-run` 不包含 `src/`、`tests/`、`scripts/`、`node_modules/`
- [ ] 包含 `dist/`、`README.md`、`CHANGELOG.md`、`LICENSE`
- [ ] `dist/card-framework.min.js` ≤ 80KB
- [ ] `dist/card-framework.d.ts` 与源码 API 100% 一致

---

### T8.13 最终全量验证

- **依赖**：T8.01 ~ T8.12
- **约束**：全部
- **工时**：1h

**描述**：
运行全量测试 + 构建 + 示例验证。逐个打开 `examples/` 下的 15 个示例，验证功能正常。

**验收标准**：
- [ ] `npm test` 全部通过（≥500 个测试）
- [ ] `npm run build` 成功
- [ ] 覆盖率 ≥ 70%
- [ ] `dist/card-framework.min.js` ≤ 80KB
- [ ] 15 个示例全部正常工作
- [ ] 8 个插件全部正常加载
- [ ] `CONSTRAINTS.md` 中所有 MUST/MUST NOT 约束均满足

---

### Phase 8 整体验收

- [ ] `.d.ts` 自动生成且与源码一致
- [ ] `dist/card-framework.min.js` ≤ 80KB
- [ ] CI 在 Node.js 18/20/22 上全部通过
- [ ] `npm pack` 只包含必要文件
- [ ] CHANGELOG.md 记录所有变更
- [ ] README.md 功能声称与实际一致
- [ ] 代码风格统一（ES6+、无魔法数字、命名一致）
- [ ] 覆盖率 ≥ 70%
- [ ] 15 个示例 + 8 个插件全部正常

---

## 附录 A：任务依赖关系图

```
Phase 1 (T1.01 → T1.30)
    │
    ├── Phase 2 (T2.01 → T2.09)
    │       │
    │       └── Phase 8 (T8.01 → T8.13)
    │
    └── Phase 3 (T3.01 → T3.14)
            │
            ├── Phase 4 (T4.01 → T4.17)  ─┐
            ├── Phase 5 (T5.01 → T5.07)  ├── 可并行
            ├── Phase 6 (T6.01 → T6.07)  ├── 可并行
            └── Phase 7 (T7.01 → T7.08)  ─┘
                    │
                    └── Phase 8 (T8.01 → T8.13)
```

---

## 附录 B：Bug 修复任务映射

| Bug # | 级别 | 描述 | 修复任务 | Phase |
|-------|------|------|---------|-------|
| 1 | P0 | handleMutations debounce 失效 | T4.01 | 4 |
| 2 | P0 | importData 绕过 Store API | T4.02 | 4 |
| 3 | P0 | Store.updateCard 浅拷贝 | T4.03 | 4 |
| 4 | P0 | ShadowCardElement._cleanup 参数错误 | T4.04 | 4 |
| 5 | P1 | renderError delete 按钮无效 | T4.13 | 4 |
| 6 | P1 | list addItem 调用签名错误 | T4.14 | 4 |
| 7 | P1 | batchCreateCards 修改 id 不更新 Map | T4.15 | 4 |
| 8 | P1 | forceFullRender 泄漏监听器 | T7.06 | 7 |
| 9 | P1 | tooltip XSS | T6.03 | 6 |
| 10 | P1 | CircuitBreaker half-open 无并发限制 | T7.07 | 7 |
| 11 | P2 | CardElement 突变 Store | T7.05 | 7 |
| 12 | P2 | checkCSPCompatibility 逻辑反直觉 | T6.06 | 6 |

---

## 附录 C：工时汇总

| Phase | 任务数 | 工时（人小时） | 工时（人天） |
|-------|--------|--------------|------------|
| Phase 1 | 30 | 24-28 | 3-4 |
| Phase 2 | 9 | 7 | 1 |
| Phase 3 | 14 | 15-17 | 2 |
| Phase 4 | 17 | 16-18 | 2-2.5 |
| Phase 5 | 7 | 8-9 | 1-1.5 |
| Phase 6 | 7 | 5 | 0.5-1 |
| Phase 7 | 8 | 6 | 1 |
| Phase 8 | 13 | 14 | 2 |
| **合计** | **97** | **~95** | **~13-14** |

> **注**：工时为净开发时间，不含评审、沟通、调试环境等 overhead。实际周期建议按 18-21 人天规划。
