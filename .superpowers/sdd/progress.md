# 进度状态（2026-07-11 更新）

> 本文件之前声称 "Task 1–12 全部完成并已 push"，与 git 实际状态不符，已重写。
> 当前主线工作 = `docs/task-breakdown.md` 的 8 Phase 模块化重构。

## 已完成的重构任务

### Phase 1 — 源码拆分（模块化 ES Module）✅
- `src/` 下 37 个 ES Module 文件，按 `core / utils / security / render / validation / extras / plugins / perf / evolution / web-components` 分层。
- `src/index.js` 聚合导出 37 个公开类与常量，`import()` 实测成功。
- 单体 `src/card-framework.js` 已删除（T2.09）。
- `CardFrame.destroy()` / `EventBus.removeAllByContext()` / `ShadowCardElement._cleanup()` 均已在模块化代码中实现（SDD Task 2 实质完成）。

### Phase 2 — esbuild 构建系统 ✅
- `scripts/build.js` 用 esbuild 从 `src/index.js` 产出：IIFE(`dist/card-framework.js` 挂载 `window.CardFrame`)、ESM、CJS、min + sourcemap、CSS，并生成 `.d.ts`。
- 三种格式（CJS / ESM / IIFE）均实测可加载。
- `package.json` 的 main/module/browser/types/exports 已指向 dist。
- 旧正则构建 `scripts/build.legacy.js` 已删除。

### Phase 3 — jsdom 测试体系 ✅
- `tests/setup.js`（jsdom） + `.mocharc.json` 配置。
- `tests/helpers.js` 加载构建产物提供 `createFrame` 等辅助。
- 测试套件：**112 passing**（unit 65 + integration 41 + Phase4 回归 6）。
- `npm test` 通过 `pretest` 先构建 dist 再跑测试；`npm run test:coverage` 产出覆盖率（当前 ~45% 语句覆盖）。
- 旧的单体 mock 测试（`test.js`/`plugin-tests.js`/`evolution-tests.js`/`destroy-tests.js`/`build-tests.js`/`lru-cache-tests.js`/`object-pool-tests.js`/`virtual-scroll-tests.js`/`perf-test.js`/`e2e-runner.js`）已删除，由 jsdom 模块测试替代。

### Phase 4 — 核心 P0 Bug 修复 ✅（4/4）
- **T4.01** RealTimeValidator.handleMutations 的 debounce 改为构造函数中创建一次（`this._debouncedValidate`）。
- **T4.02** CardFrame.importData 改为走 `store.addCard/updateCard/addRelationship/updateRelationship`，不再直接操作内部 Map。
- **T4.03** Store 使用 `Utils.deepClone`（已增强 Map/Set/RegExp/循环引用支持）在 addCard/updateCard/getCard/getAllCards/query 做深拷贝，消除引用共享。
- **T4.04** ShadowCardElement._cleanup 的 Map.forEach 参数顺序（value, key）在模块化代码中已正确。
- 每个 P0 均新增回归测试（`tests/integration/phase4.test.js`）。

### Phase 4 — 性能 / P1 Bug 修复 ✅（T4.05–T4.09, T4.12）
- **T4.05/T4.06** Store 新增 `notifyDebounced()`（16ms 合帧，多次调用合并为一次 notify）。
- **T4.07** Store 新增 O(1) 关系索引 `_relIndex`（Map<cardId, Set<relId>>），`getRelationshipsByCard` / `removeCard` 级联删除均改为 O(1)/O(k)；`addRelationship / updateRelationship / removeRelationship / fromJSON` 全部维护索引。
- **T4.08** TypeRegistry.validate 已实现完整 props schema 校验（既有代码已完成）。
- **T4.09** EventBus `once()` 通过 `off()` 清理 wrapper，`removeAllByContext` 同步清理 once 追踪，`emit` 异常传播至 `FRAMEWORK_ERROR`（含递归防护）——既有代码已完成。
- **T4.12** 修复 renderError 删除按钮：由不存在的 `card.store` 改为 `this.store.removeCard(card.id)`；list 卡片 `addItem` action 正确接收 `this.store`。
- 新增回归测试（`tests/unit/store.test.js`）：关系索引一致性（remove/removeCard/fromJSON）+ notifyDebounced 合并。

### Phase 5 — 插件系统加固 ✅（T5.01–T5.07）
- **T5.01** 新增 `src/plugins/PluginSandbox.js`：每插件独立沙箱，追踪 setTimeout/setInterval/addEventListener/eventBus 订阅/注册的类型与主题；`createContext()` 返回按权限门控的受限 API（不暴露 circuitBreaker/perf）；`destroy()` 清理全部资源。
- **T5.02** 权限校验：`CardFrame` `options.allowedPluginPermissions` 白名单；插件声明未授权权限时 install 抛异常；未设置白名单则不校验（向后兼容）；支持 `*`。
- **T5.03** 卸载完整清理：install 时经沙箱追踪注册的类型/主题；uninstall 顺序为 onUninstall → 注销 hooks → 注销 actions → 沙箱 destroy（清类型/主题/定时器/监听器）→ 删权限 → 移除 → 触发 `PLUGIN_UNINSTALLED`。TypeRegistry 新增 `unregister()`。
- **T5.04** hooks 优先级：`registerHook(name, handler, {priority, pluginName})`，`triggerHook` 按 priority 降序、同级按安装顺序（seq）执行，默认 priority=0。
- **T5.05** 实现 `_registerPluginActions` + `PluginManager.executeAction()` + `CardFrame.executeAction()`；action 注册去重、卸载清理、限流与异常上报。
- **T5.06** 异常隔离：单个 hook 抛错不中断后续 hook，错误经 `FRAMEWORK_ERROR` 传播且携带 pluginName/hookName。
- **T5.07** 新增 `tests/integration/plugin-phase5.test.js` 共 24 个测试（沙箱资源清理 / 权限拒绝 / 卸载清理 / 优先级 / action / 异常隔离）。
- `PluginSandbox` 已从 `src/index.js` 导出。

### Phase 6 — 安全增强 ✅（T6.01–T6.07）
- **T6.01** 重写 `sanitizeUrl`/协议白名单（http/https/ftp/ftps/mailto/tel），剥离 null 字节与控制字符防绕过；`data:` 仅允许白名单图片 MIME 且拒绝含 script/`<>` 的内容；无效 URL try/catch 返回 `''`。
- **T6.02** 新增 `sanitizeScriptContent`：移除跨行 / 未闭合 `<script>`、内联事件处理器（on*=）、`javascript:`/`vbscript:` 协议。
- **T6.03** 修复 tooltip XSS：`RelationshipEngine._showRelationshipTooltip` 用 `Security.escapeHtml` 转义 rel.type/卡片标题/ID（新增 `Security.escapeHtml` 委托）。
- **T6.04** 修复 `sanitizeStyle` 共享 `/g` 正则的 `lastIndex` 残留：每次 replace 前后重置 lastIndex，连续调用结果一致。
- **T6.05** 修复 `isSafeUrl`：协议相对 URL `//evil.com` 不再被误判为安全；`/`、`./`、`../`、`#` 仍安全。
- **T6.06** CSP 支持：`options.csp` 经 `CardFrame.applyCSP()` 注入 CSP meta（已存在则不覆盖）；移除 `checkCSPCompatibility` 反直觉的 `new Function` 探测（框架源码彻底无 eval/new Function），返回 `notes`。
- **T6.07** 新增 `tests/integration/security-phase6.test.js` 共 33 个测试（协议白名单/大小写混淆/null 字节/data: 判定/跨行 script/内联事件/lastIndex 一致性/模板攻击向量/CSP/tooltip XSS）。

## 尚未完成（后续 Phase）

- Phase 4 其余（T4.10/T4.11/T4.13–T4.17）：剩余 P1/P2 Bug 收尾。
- Phase 7 — 其他收尾。

## 验证命令
```
npm run build     # esbuild → dist/（9 产物）
npm test          # 169 passing
npm run test:coverage
```

## 说明
- 工作区改动**未提交**（按规则未自动 commit）。状态已就绪，可随时提交。
- `evolution-agent/` 的 `evolution-orchestrator.js` 原指向已删除的 `src/card-framework.js`，已改为指向 `src/core/CardFrame.js`（其基于正则的 fallback 变更逻辑对模块化代码为 best-effort，属后续 Agent 侧工作）。
