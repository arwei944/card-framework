# CardFrame 架构总览（当前版本）

> **适用范围**：描述当前代码库真实架构（ES Module + esbuild + jsdom 测试）。版本以 `package.json` 为准（**v1.2.0**）。  
> 历史审计 / 旧 specs / Phase 4 计划见 [`archive/`](archive/README.md)。**以本文档与 `src/` 为准。**

---

## 1. 整体架构

CardFrame 是一个**框架无关、零运行时依赖**的卡片前端框架。源码为 ES Module 模块化结构：每个类/模块一个文件，依赖通过 `import` 声明，由 esbuild 打包为多格式产物。

```
src/
├── index.js                  # ES Module 入口：聚合模块、挂载 CardFrame、注册 customElements
├── core/
│   ├── CardFrame.js          # 编排者（CRUD / 插件 / 布局门面）
│   ├── cardframe/            # 从主类拆出的 mixin：batch / relationships / lifecycle
│   ├── EventBus.js
│   ├── Store.js              # Map + QueryIndex + 快照；公开 setPool / rekeyCard / destroy
│   ├── TypeRegistry.js       # 注册时默认拒绝不安全 renderTemplate
│   ├── DataIO.js
│   ├── StatsService.js
│   └── defaultCardTypes.js   # base + text/task/image/list/progress/link/note/code
├── security/                 # Security sanitizer、CircuitBreaker
├── render/                   # Renderer、LayoutEngine、VirtualScroller
├── validation/               # AutoFixer、RealTimeValidator
├── extras/                   # Theme、I18n、Relationship、BackendSync、Monitor
├── plugins/                  # PluginManager、PluginSandbox
├── perf/
├── evolution/                # 浏览器端指标/规则/进化（默认关闭）
├── guardrail/                # Agent 硬约束（R1–R4）
├── web-components/
└── utils/
```

**关键设计事实**
- **每实例独立**：`new CardFrame(container)` 在 `_initModules()` 中组装全部子系统；无全局 `CardFrame.store` 等单例（自 v1.1.0 起）。
- **零运行时依赖**：仅 `devDependencies`（esbuild / eslint / mocha / jsdom / c8）。
- **三格式产物**：IIFE / ESM / CJS（含 min + sourcemap）+ CSS + `.d.ts`。
- **公开 Store API**：对象池注入走 `setPool`，改 ID 走 `rekeyCard`，销毁走 `store.destroy()`——框架自身不穿透 `store._*`。
- **类型声明**：`types/card-framework.d.ts` 构建时拷贝到 `dist/`，需与源码人工同步。

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
| 测试 | jsdom 真实 DOM + Mocha（`npm test`，约 **235** cases） | ✅ 真实行为验证 |
| 静态检查 | ESLint `src scripts`，0 error / 0 warning | ✅ 干净 |
| 安全（XSS） | `Security` allowlist 净化 + 多轮稳定化 + URL/style 过滤 | ✅ 自述非 DOMPurify 替代 |
| 安全（权限） | `PluginSandbox` **运行时**按 `can(permission)` 裁剪 API 面 | ✅ 真实执行 |
| 容错 | `CircuitBreaker`（per-card + global 双层，half-open 单探针） | ✅ |
| 错误边界 | `Renderer.renderError` + `GlobalErrorHandler` | ✅ |
| 性能 | 对象池 / 虚拟滚动 / 布局缓存 / 查询索引 / rAF 批处理 | ✅ |
| 可观测 | `PerfPanel`、`getStats()`、`MetricsCollector` | ✅ |
| 插件清理 | `uninstall` → `sandbox.destroy()` 清理类型/主题/监听器/定时器 | ✅ |
| 硬约束 | `Guardrail` 运行时检测（R1-R4）+ `guardrail-check.js` 构建时扫描 | ✅ |

---

## 4. 自进化子系统（真实状态）

系统由两部分组成，**当前均处于实验性、未 production-ready 状态**：

**A. 浏览器端（`src/evolution/`）**
- `MetricsCollector` 每 5s 采集性能/交互/架构指标。
- `RuleEngine` 每 30s 评估，产出 `param-tune`（浏览器内直接调参）或 `code-evolve`（请求外部 Agent）。
- `EvolutionEngine` 维护进化历史（上限 1000 条），**已持久化到 `localStorage`**（key: `cardframe.evolution.history`，刷新不丢失；storage 不可用时降级为仅内存）。
- `agentSyncInterval`（默认 60s）已实现：`_startAgentSync()` 定时通过 XHR POST `/api/metrics` + WebSocket `metrics-report` 向 Agent 推送指标。
- WebSocket 连接用于接收 Agent 推送的 `evolution-result` 消息（非空转）。

**B. 独立 Node 服务（`evolution-agent/`）**
- HTTP :9100 + 可选 WebSocket（`ws` 为**可选依赖**，缺失时降级），默认绑定 `127.0.0.1`。
- **鉴权**：除 `/api/health` 外，写/变更路由要求已配置的 `Bearer` 令牌；**未配置 token 时返回 401**（可用 `ALLOW_INSECURE_AUTH=1` 仅供本机测试）。CORS 由 `allowedOrigins` 白名单控制（**不是 `*`**）。
- **写路径白名单**（`allowedWritePaths`，默认仅 `src/core/CardFrame.js`）：越界写入被拒。
- `POST /api/evolve`：快照 → 结构化 patch（可选 LLM，默认 **heuristic**）→ 测试门禁 → `dryRun` 默认 true 则回退不提交。
- **能力诚实**：`/api/health` 的 `capabilities.mode` 为 `heuristic` 或 `llm`；无 LLM Key 时明确 heuristic。
- 浏览器进化历史可持久化到 `localStorage`；合并需 review 令牌。

> 实验性、仅本机开发。详见 `evolution-agent/README.md`。历史规划见 `docs/archive/`。

---

## 5. 构建与发布

- `scripts/build.js`（esbuild）：输出 IIFE / ESM / CJS 三套（各自含 min + sourcemap），并拷贝 CSS 与 `.d.ts`。
- CI（`.github/workflows/ci.yml`）：ubuntu 上 Node **20 / 22** 跑 `lint` → `guardrail` → `build` → `test`。
- 发包：`files` 含 `dist/ src/ types/`，`main`→CJS，`module`→ESM，`browser`→IIFE，`types`→`.d.ts`。

---

## 6. 健康度与风险摘要

- **核心框架：良好（Good）**——模块化、DI、真实测试、lint 干净、安全与容错内建。
- **进化子系统：实验性**——本机 bind、token 必填（写路径）、默认 dryRun + heuristic；**非 production-ready**。
- 历史审查/评估文档已移至 [`docs/archive/`](archive/README.md)，结论不代表当前代码。
