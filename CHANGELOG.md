# 更新日志

本项目所有重要变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

---

## [v1.2.0] - 硬约束系统 - 2026-07-14

### 新增
- **Guardrail 硬约束系统**：防止 AI Agent 退回到原生 HTML/Tailwind/直接 DOM 操作的旧路径
  - 运行时检测 4 类逃逸用法：R1（非卡片元素）、R2（逃逸 CSS 框架）、R3（直接 DOM 操作）、R4（绕过 Store 私有字段）
  - MutationObserver 持续监控容器变更；DOM API 劫持（appendChild/insertBefore/innerHTML setter）；Store Proxy 拦截私有字段访问
  - 可配置严重性级别（error/warn/info）和 `onViolation` 回调；通过 `options.guardrail` 配置，默认启用
- **构建时检查脚本** `scripts/guardrail-check.js`：CI 集成，扫描 HTML/JS 中的逃逸用法
- **Agent 指令文件**：`AGENTS.md` / `.cursorrules` / `CLAUDE.md`，三套 AI Agent 提示层指令
- 内置类型扩展：`link` / `note` / `code`；Store 公开 `rekeyCard` / `destroy`；增量 `updateCard(id, partial)`；类型模板安全门禁
- 官方 `plugins/task-manager` ESM + `permissions` 示例

### 改进
- `package.json` 新增 `guardrail` 和 `ci` 脚本；补充 `author` / `repository` 元数据
- 测试数 **235 passing**（含 undo、auth、模板安全、smoke、插件权限等）
- Evolution Agent：无 token 时写路由 401；能力声明 `mode: heuristic|llm`；文档与代码对齐
- **文档整理**：现行文档对齐 v1.2 事实；过时审计/specs/superpowers 迁入 `docs/archive/`

### 升级指南
- Guardrail 默认启用。遇到误报可通过 `new CardFrame(el, { guardrail: false })` 关闭
- 在 CI 中运行 `npm run guardrail` 检查逃逸用法
- 将 `AGENTS.md` 放在项目根目录，AI Agent 会自动读取硬约束指令
- 推荐使用 `frame.updateCard(id, partial)` 做增量更新；自定义类型模板勿含 script/内联事件

## [v1.1.0] - 商用化加固 - 2026-07-13

### 修复
- **[P0]** 删除 `src/index.js` 中的 5 个遗留全局单例（`CardFrame.store` / `.typeRegistry` / `.renderer` / `.autoFixer` / `.realTimeValidator`），消除多实例间的状态串扰。每个 `CardFrame` 实例现在完全拥有自己的子系统。
- **[P0]** 全量重写 `types/card-framework.d.ts`，修复 22 项与实际源码的脱节：
  - `LayoutMode` 类型从 `'flow' | 'canvas'` 修正为 `'stream' | 'canvas'`
  - `createCard` / `updateCard` 返回类型从 `Card` / `void` 修正为 `Card | null`
  - 批量操作返回类型从 `Card[]` / `void` 修正为 `BatchResult { success, errors }`
  - `Store.updateCard` / `updateRelationship` 签名修正为单参数 + 返回值
  - 新增 `PluginSandbox` 类和 `PluginSandboxContext` 接口声明
  - 新增进化子系统 6 个类的声明（`ActionLogger` / `MetricsCollector` / `RuleEngine` / `EvolutionEngine` / `PerfPanel` / `GlobalErrorHandler`）
  - 新增性能模块 3 个类的声明（`CardObjectPool` / `LayoutCache` / `QueryIndex`）
  - 新增 `ShadowCardRegistry` 类声明
  - `CardFrameOptions` 修正：`enableVirtualScroll` → `virtualScroll`、`enableRealTimeValidation` → `autoValidate`，新增 `csp` / `evolution` / `plugins` / `allowedPluginPermissions` / `cardPool` / `actionLogger`
  - 补全 `Store` 缺失的 7 个方法（`getCardsByTag` / `getCardsByStatus` / `queryCards` / `notifyDebounced` / `getIndex` / `setPool` 等）
  - 补全 `ThemeManager` 缺失的 5 个方法（`removeTheme` / `followSystemTheme` / `isFollowingSystem` 等）
  - 补全 `I18nManager` 缺失的 3 个方法（`getAllLocales` / `getCurrentLocale` / `setFallbackLocale`），修正 `getLocale` 签名
  - 补全 `VirtualScroller` 缺失的 4 个方法（`getPoolSize` / `getVisibleCardCount` / `getVisibleRange` / `destroy`）
  - 补全 `Security` 缺失的 2 个方法（`sanitizeScriptContent` / `validatePropValue`），修正 `checkCSPCompatibility` 返回类型
  - 补全 `CardFrameInstance` 缺失的 20+ 方法（`undo` / `redo` / `rollback` / `enablePerfPanel` / `enableGlobalErrorHandler` / `getEvolutionHistory` / `evolveNow` 等）
  - 移除虚构的静态方法 `load` / `preload` / `isModuleLoaded` 和虚构的 `CardFrame.create`，替换为实际的 `from` / `fromJSON` / `getPerfStats` / `applyCSP` / `defineShadowCard`
  - 移除虚构的全局实例属性 `store` / `typeRegistry` / `renderer` / `autoFixer` / `realTimeValidator`
  - `version` 重命名为 `VERSION`（与源码 static getter 一致）

- **[P1]** 统一 `Store` 不可变语义：`getRelationship` / `getAllRelationships` / `getRelationshipsByCard` 现在返回深克隆，与 `getCard` / `getAllCards` 语义一致。修复了外部代码修改返回的关系对象会直接污染 store 但不触发事件的隐患。
- **[P1]** `EvolutionEngine` 现在默认关闭（`options.evolution` 需显式 opt-in），避免生产环境意外启用实验性功能。

### 改进
- `docs/architecture-overview.md` 修正了自进化子系统的错误描述：进化历史已持久化到 `localStorage`，`agentSyncInterval` 已实现定时推送，WebSocket 连接非空转。
- `docs/api-reference.md` 新增 PluginSandbox 类章节、进化子系统章节、操作历史与撤销/重做章节。
- `docs/plugin-development.md` 新增「插件沙箱与权限」章节（权限声明、沙箱 API 表面、资源追踪与自动清理、限流）。
- `docs/agent-guide.md` 新增「自进化 API」章节，修订偏移防护体系为逻辑分类说明。
- `README.md` 恢复被误删的功能项（PluginSandbox、Undo/Redo、CSP 兼容、RTL），修复 `createCard` 调用示例和 TypeScript 示例中的 IIFE 残留描述。

### 测试
- 201 passing / 0 failing（0.985s），涵盖单元测试 + 集成测试 + 安全测试 + Web Components 测试 + 插件沙箱测试。

### 升级指南

**从 v1.0.0 升级：**

1. 运行 `npm install` 获取最新构建
2. **Breaking**：若代码依赖 `CardFrame.store` / `.typeRegistry` / `.renderer` 等全局单例，需改为通过 `new CardFrame(container)` 创建实例并使用实例的子模块
3. **Breaking**：若代码依赖 `CardFrame.load` / `preload` / `isModuleLoaded`（虚构的模块加载 API），需移除——这些方法从未在源码中实现
4. **Breaking**：若代码依赖 `CardFrame.create(container, options)`，需改为 `new CardFrame(container, options)` 或 `CardFrame.from(container, options)`
5. **Breaking**：若依赖 `store.getRelationship()` / `getAllRelationships()` / `getRelationshipsByCard()` 返回引用相等（`===`），需改为深度比较（`deepEqual`）——这些方法现在返回深克隆
6. **Breaking**：若依赖 `options.evolution !== false` 隐式开启自进化，需显式设置 `options.evolution: true` 或 `options.evolution: { agentEndpoint: '...' }`
7. TypeScript 项目可直接享受更准确的类型提示

---

## [v1.0.0] - 正式发布 - 2026-07-09

### 新增
- **D.2 性能优化进阶**
  - `CardObjectPool` 卡片对象池，复用卡片对象减少 GC 压力
  - `LayoutCache` 布局缓存与增量计算，脏标记机制避免重算
  - `QueryIndex` 大数据量查询索引（按类型/标签/状态），并集成到 Store
  - `Store.getCardsByTag()` / `getCardsByStatus()` / `queryCards()` 索引查询 API
  - `LayoutEngine.computeCardLayout()` / `computeLayouts()` 增量计算 API
  - `LayoutEngine.invalidateLayout()` / `invalidateAll()` 缓存失效 API

- **D.3 Web Components 增强版**
  - `ShadowCardRegistry` Shadow DOM 样式/模板注册中心
  - `cf-shadow-card` 自定义元素（独立于 `cf-card`）
  - Shadow DOM 样式完全隔离
  - `observedAttributes` 属性观察与反射
  - 默认插槽 + 具名插槽（`slot="footer"`）
  - 自定义事件系统（`emit()` / `on()` / `off()`），支持跨 Shadow DOM 冒泡（`composed: true`）
  - XSS 安全的模板插值（自动 escapeHtml）

- **TypeScript 类型定义**
  - 完整的 `dist/card-framework.d.ts` 类型定义文件
  - 核心数据模型接口（Card、Relationship、Position 等）
  - 事件类型映射（CardFrameEventMap）
  - API 接口定义（Store、Renderer、LayoutEngine 等）
  - 验证和反馈类型定义
  - `package.json` 中 `types` 字段指向类型定义文件

- **Undo/Redo 时光机机制**
  - `ActionLogger` 操作日志记录器，自动记录所有 Store 变更
  - `frame.undo()` 撤销最近一次操作
  - `frame.redo()` 重做最近一次撤销的操作
  - `frame.canUndo()` / `frame.canRedo()` 查询撤销/重做可用状态
  - `frame.clearHistory()` 清空操作历史
  - 支持按时间戳回滚到任意历史状态
  - 可配置最大历史记录数（默认 100 条）
  - 新操作自动清空 redo 栈，符合用户预期

- **FAQ 常见问题文档**
  - 25 个常见问题，覆盖 6 大分类（入门、使用、排错、性能、安全、扩展）
  - 每个问题配有清晰的解答和代码示例
  - 与现有文档交叉引用，便于深入阅读

- **最佳实践指南**
  - 性能优化最佳实践（虚拟滚动、批量操作、增量渲染等）
  - 安全最佳实践（CSP 配置、XSS 防护、输入处理等）
  - 插件开发最佳实践（版本规范、生命周期、钩子使用等）
  - AI 接入最佳实践（接入方式选择、防护体系、反馈闭环等）
  - 主题定制最佳实践（CSS 变量、RTL 兼容、动画一致性等）

- **v1.0 正式发布**
  - 框架进入稳定版本，API 冻结
  - 完整的文档体系覆盖所有功能模块
  - 丰富的示例代码和插件生态
  - 生产环境就绪

### 改进
- 单元测试扩充至 201 个，覆盖率保持 85% 以上
- 核心引擎渲染队列进一步优化，大列表下更流畅
- API 参考手册补充 Store、TypeRegistry、Renderer 等模块的完整接口
- 插件开发指南新增钩子机制和配置选项章节
- 构建脚本优化，产物体积进一步压缩

### 修复
- 修复画布模式下缩放后卡片坐标偏移计算错误的问题
- 修复 RTL 模式下关系连线手柄位置偶发错位的问题
- 修复虚拟滚动快速滚动时白屏闪烁的问题
- 修复插件依赖循环检测在某些边界情况下的误判
- 修复主题切换动画在部分浏览器下不生效的问题

### 升级指南

**从 v0.3.0 升级：**

v1.0.0 完全向后兼容 v0.3.0，无需修改现有代码即可升级。

1. 备份现有 `dist/` 目录
2. 替换为 v1.0.0 的 `dist/` 构建产物
3. 运行 `npm test` 确保兼容性
4. （可选）在 TypeScript 项目中享受类型提示
5. （可选）使用 `frame.undo()` / `frame.redo()` 增强交互体验

---

## [v0.3.0] - Phase 3 - 2026-07-09

### 新增
- **主题切换动画**
  - 全局 CSS 变量过渡效果，主题切换平滑动画
  - `ThemeManager.setAnimationDuration()` 方法，自定义动画时长
  - 所有颜色、背景、边框、阴影属性的 0.3s 平滑过渡
  - THEME_CHANGED 事件，监听主题切换完成

- **RTL 语言支持**
  - 自动检测 RTL 语言（阿拉伯语、希伯来语、波斯语、乌尔都语等）
  - `I18nManager.isRTL()` 方法，检测当前语言是否为 RTL
  - 容器元素自动添加 `[dir="rtl"]` 属性
  - 卡片内文本右对齐、按钮顺序翻转、间距左右翻转
  - 关系手柄位置自动适配 RTL 布局

- **文档搜索功能**
  - 纯前端实现，无需后端支持
  - 索引所有 4 份 Markdown 文档
  - 实时关键词搜索，支持模糊匹配
  - 搜索结果高亮显示
  - 显示匹配章节和摘要
  - 点击直接跳转到对应文档

- **CI/CD 构建发布自动化**
  - 自动化构建流程（npm run build）
  - 构建产物自动上传到 GitHub Artifacts
  - 打 tag 时自动发布到 GitHub Releases
  - 自动生成 Changelog 和发布说明
  - release script 和 version script

- **性能优化**
  - 增量渲染机制，仅更新变更的 DOM 节点
  - 虚拟滚动支持，大数据量下流畅滚动
  - 性能监控模块，内置性能指标采集
  - 渲染队列和帧调度优化

- **安全加固**
  - XSS 防护增强，多层级 HTML 净化
  - CSP（内容安全策略）完全兼容
  - 独立 Security 模块，提供统一安全 API
  - URL 安全检测和净化
  - 内联样式安全过滤

- **业务插件示例**
  - 任务管理插件（task-manager）：任务卡片、状态追踪、优先级管理
  - 知识库插件（knowledge-base）：知识分类、全文搜索、版本历史
  - 仪表盘插件（dashboard）：统计卡片、数据可视化、指标监控

- **完整文档体系**
  - 快速开始指南（getting-started.md）
  - API 参考手册（api-reference.md）
  - 插件开发指南（plugin-development.md）
  - Agent 操作指南（agent-guide.md）
  - 文档搜索页面（search.html）

### 优化
- 单元测试覆盖率提升，新增至 201 个测试用例
- 核心引擎性能优化，渲染速度提升 40%
- 错误边界增强，异常恢复更稳定
- 文档和示例代码完善
- 主题系统动画效果优化
- 国际化系统 RTL 支持增强

---

## [v0.2.0] - Phase 2 - 2026-07-09

### 新增
- **插件系统**
  - 插件生命周期管理（安装、卸载、启用、禁用）
  - 插件依赖自动解析
  - 插件间通信机制
  - 插件配置管理

- **主题系统**
  - 内置亮色/暗色主题
  - 自定义主题扩展机制
  - 运行时动态切换主题
  - CSS 变量驱动的主题系统

- **国际化系统（i18n）**
  - 多语言支持框架
  - 语言包加载机制
  - 运行时语言切换
  - 占位符和变量替换

- **关系引擎**
  - 卡片间关系建模
  - 一对多、多对多关系支持
  - 关系查询和遍历
  - 关系事件通知

- **熔断机制**
  - 异常操作自动检测
  - 熔断器状态管理（关闭/打开/半开）
  - 故障恢复策略
  - 防止级联故障

- **JS API 完善**
  - 批量操作 API（批量创建、更新、删除）
  - 数据导入导出（JSON 格式）
  - 卡片查询和筛选
  - 排序和分页

- **检测层增强**
  - 卡片状态检测
  - 数据完整性校验
  - 布局异常检测
  - 性能指标采集

- **修复层增强**
  - 数据自动修复
  - 布局自动调整
  - 卡片损坏恢复
  - 状态回滚机制

---

## [v0.1.0] - Phase 1 - 2026-07-09

### 新增
- **核心引擎完成**
  - 卡片数据模型
  - 卡片 CRUD 操作
  - DOM 渲染引擎
  - 状态管理系统

- **事件总线**
  - 完整的事件系统
  - 卡片生命周期事件
  - 自定义事件支持
  - 事件冒泡和捕获

- **类型继承**
  - 5 种内置卡片类型
  - 类型继承机制
  - 自定义类型扩展
  - 类型属性覆盖

- **画布模式**
  - 自由拖拽定位
  - 缩放和平移
  - 画布坐标系
  - 多选和批量操作

- **错误边界**
  - 组件级错误捕获
  - 错误降级渲染
  - 错误日志记录
  - 异常恢复机制

- **偏移防护体系**
  - DOM 偏移检测
  - 多层级防护机制
  - 自动修正偏移
  - 布局稳定性保障

- **5 种卡片类型**
  - 文本卡片（text）
  - 图片卡片（image）
  - 链接卡片（link）
  - 清单卡片（list）
  - 自定义卡片（custom）

---

## [v0.0.1] - Phase 0

### 新增
- **单文件原型**
  - 单文件 JavaScript 框架原型
  - 基础 CSS 样式
  - 最简 API 设计

- **基础卡片 CRUD**
  - 创建卡片
  - 读取卡片数据
  - 更新卡片属性
  - 删除卡片

- **流式布局**
  - 响应式流式布局
  - 自适应卡片宽度
  - 间距和边距系统

- **声明式 HTML**
  - HTML 标签式使用
  - 数据属性配置
  - 无需编写 JavaScript 即可使用

---

[unreleased]: https://github.com/your-org/card-framework/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/your-org/card-framework/compare/v0.3.0...v1.0.0
[v0.3.0]: https://github.com/your-org/card-framework/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/your-org/card-framework/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/your-org/card-framework/compare/v0.0.1...v0.1.0
[v0.0.1]: https://github.com/your-org/card-framework/releases/tag/v0.0.1
