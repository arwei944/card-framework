# CardFrame 架构总览（当前版本）

> **适用范围**：本文档描述当前代码库的真实架构（ES Module 源码 + esbuild 构建 + jsdom 测试）。
> 若你在找"单体 IIFE + 正则构建"时期的架构说明，那是 **Phase 4 重构之前** 的历史状态，见 `docs/architecture-audit-report.md`（已标记 DEPRECATED）及各 `docs/specs`、`docs/superpowers/plans` 下的历史规划记录。**以本文档与源码为准。**

---

## 1. 整体架构

CardFrame 是一个**框架无关、零运行时依赖**的卡片前端框架。当前源码已是**真正的 ES Module 模块化结构**：每个类/模块一个文件，依赖通过 `import` 显式声明，由 esbuild 打包为多格式产物。

```
src/
├── index.js                  # ES Module 入口：聚合全部模块、挂载到 CardFrame、注册 customElements
├── core/                    # 核心域
│   ├── CardFrame.js         #   编排者：构造时通过构造函数注入组装所有子系统
│   ├── EventBus.js         #   发布/订阅事件总线（每实例独立）
│   ├── Store.js            #   内存数据中心（Map + QueryIndex 索引 + 快照缓存）
│   ├── TypeRegistry.js     #   卡片类型注册/继承/校验
│   ├── DataIO.js           #   导入/导出 + 版本迁移
│   ├── StatsService.js     #   运行时统计
│   └── defaultCardTypes.js
├── security/               # Security（allowlist 净化 + mXSS 多轮稳定化 + URL/style 过滤）、CircuitBreaker
├── render/                 # Renderer（rAF 增量渲染）、LayoutEngine、VirtualScroller
├── validation/             # AutoFixer、RealTimeValidator
├── extras/                 # ThemeManager、I18nManager、RelationshipEngine
├── plugins/                # PluginManager（生命周期/hook/权限）、PluginSandbox（运行时权限裁剪 + 资源追踪）
├── perf/                   # Perf、CardObjectPool、LayoutCache、QueryIndex
├── evolution/              # 浏览器端进化：MetricsCollector、RuleEngine、EvolutionEngine、ActionLogger…
├── web-components/         # <card-frame>、<cf-card>、ShadowCardElement
└── utils/                 # Utils、FeedbackSystem、constants、escape
```

**关键设计事实（基于代码）**
- **每实例独立**：`new CardFrame(container)` 在 `_initModules()` 中 `new` 出自己的 `EventBus` 及全部子系统；模块间通过构造函数参数注入，无模块级单例耦合。
- **零运行时依赖**：`package.json` 运行时依赖为空，仅 devDependencies（esbuild/eslint/mocha/jsdom/c8）。
- **三格式产物**：IIFE（`<script>` 直引 + `window.CardFrame`）、ESM（bundler/`<script type=module>`）、CJS（Node require），各自含 minified + sourcemap。
- **类型声明**：`types/card-framework.d.ts` 由构建拷贝到 `dist/`；与源码的同步由人工维护（见风险清单，存在脱节风险）。

> ⚠️ **已知遗留**：`src/index.js` 仍创建了 5 个**全局静态单例**（`CardFrame.store` / `.typeRegistry` / `.renderer` / `.autoFixer` / `.realTimeValidator` / `.shadowCardRegistry`）并在全仓库无任何引用——属 Phase 4 计划删除但未清理的死代码，会残留全局可变状态，建议移除。

---

## 2. 数据流

```
API 调用 / 插件 Hook / DOM 事件 / 定时器
        │
        ▼
   CardFrame（编排者）
        │
        ├─► Store（内存 Map + QueryIndex 索引 + 快照缓存）
        │       ├─ TypeRegistry（类型校验）
        │       ├─ CardObjectPool（对象池化复用）
        │       └─ QueryIndex（按 type/tag/status 查询）
        │              │  notify() 通知订阅者（16ms 防抖）
        ▼              ▼
   Renderer（rAF 批处理，仅更新变更节点）
        ├─ LayoutEngine（flow / canvas 布局）
        └─ VirtualScroller（大数据量虚拟滚动）
        │
        ▼
      DOM

后台（可选）：
   MetricsCollector（5s 采集） ─► RuleEngine（30s 评估）
                                      ├─ param-tune  → 浏览器内直接调参（pool/cache/renderer）
                                      └─ code-evolve → POST /api/evolve 到 Evolution Agent（见第 4 节）
```

**不可变语义**：`Store.getAllCards()` 返回深冻结快照；`Store.getCard()` 返回深克隆。两者语义不完全一致，调用方对"返回对象能否直接修改"的预期需明确（技术债，已在审查中标注）。

---

## 3. 横切关注点落地情况

| 关注点 | 实现 | 状态 |
|--------|------|------|
| 测试 | jsdom 真实 DOM + Mocha，**190 passing** | ✅ 真实行为验证 |
| 静态检查 | ESLint，`src scripts`，0 error / 3 warning | ✅ 干净 |
| 安全（XSS） | `Security` allowlist 净化 + 多轮稳定化 + URL/style 过滤 | ✅ 自述非 DOMPurify 替代 |
| 安全（权限） | `PluginSandbox` **运行时**按 `can(permission)` 裁剪 API 面 | ✅ 真实执行 |
| 容错 | `CircuitBreaker`（per-card + global 双层，half-open 单探针） | ✅ |
| 错误边界 | `Renderer.renderError` + `GlobalErrorHandler` | ✅ |
| 性能 | 对象池 / 虚拟滚动 / 布局缓存 / 查询索引 / rAF 批处理 | ✅ |
| 可观测 | `PerfPanel`、`getStats()`、`MetricsCollector` | ✅ |
| 插件清理 | `uninstall` → `sandbox.destroy()` 清理类型/主题/监听器/定时器 | ✅ |

---

## 4. 自进化子系统（真实状态）

系统由两部分组成，**当前均处于实验性、未 production-ready 状态**：

**A. 浏览器端（`src/evolution/`）**
- `MetricsCollector` 每 5s 采集性能/交互/架构指标。
- `RuleEngine` 每 30s 评估，产出 `param-tune`（浏览器内直接调参）或 `code-evolve`（请求外部 Agent）。
- `EvolutionEngine` 维护**内存**进化历史（上限 1000 条，刷新即丢），并通过 XHR POST 到 Agent、通过 WebSocket 连接 Agent（但当前 WS 仅空转回声，无实际指标推送）。
- **注意**：`config.agentSyncInterval = 60000` 已声明但代码中从未使用——即"定时向 Agent 推送指标"并未实现。

**B. 独立 Node 服务（`evolution-agent/`）—— 已按 `docs/evolution-refactoring-plan.md` 重构**
- HTTP :9100 + 可选 WebSocket（`ws` 为**可选依赖**，缺失时降级），默认绑定 `127.0.0.1`。
- **鉴权**：除 `/api/health` 外要求 `Bearer` 令牌（取自 `tokenEnv` 环境变量）；CORS 由 `allowedOrigins` 白名单控制（**不再 `*`**）。
- **写路径白名单**（`allowedWritePaths`，默认仅 `src/core/CardFrame.js`）：越界/越权写入被拒。
- `POST /api/evolve`：快照 → 生成**结构化 patch**（LLM tool-calling 或启发式）→ 应用（唯一性校验）→ 跑 `npm test`（JSON reporter 结构化判定）→ 通过则提交 `evolution` 分支（dryRun 则回退），失败则回滚（git + 直接还原被改文件，不依赖 git）。
- **能力诚实**：`capabilities` 如实声明 LLM/启发式/dryRun/白名单；默认无 LLM Key 时走启发式 key-value 参数调优。
- 指标打通：浏览器端 `agentSyncInterval` 已启用，周期 `POST /api/metrics` + WS `metrics-report`；浏览器进化历史持久化到 `localStorage`。
- 合并受 review 令牌保护（`/api/merge`）；`dryRun` 不提交。

> 该子系统仍属**实验性、仅本机开发使用**；生产/暴露网络前须正确配置 token 与 review 令牌。详细实施状态见 `docs/evolution-refactoring-plan.md`。

---

## 5. 构建与发布

- `scripts/build.js`（esbuild）：输出 IIFE / ESM / CJS 三套（各自含 min + sourcemap），并拷贝 CSS 与 `.d.ts`。
- CI（`.github/workflows/ci.yml`）：ubuntu 上对 Node 16/18/20 跑 `test` / `lint`+`coverage` / `build`，tag 触发 GitHub Release 上传 `dist/`。
- 发包：`files` 含 `dist/ src/ types/`，`main`→CJS，`module`→ESM，`browser`→IIFE，`types`→`.d.ts`。

---

## 6. 健康度与风险摘要

- **核心框架：良好（Good）**——模块化、DI、真实测试、lint 干净、安全与容错内建。
- **进化子系统：需改进 / 高风险**——无鉴权、无 LLM、路径脱节、历史不可持久。
- 完整逐维度审查与风险清单见架构审查报告（仓库内 `docs/architecture-audit-report.md` 为**重构前**历史快照，结论已不适用当前代码）。
