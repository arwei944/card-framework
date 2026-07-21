> **ARCHIVED / 非当前**：本文档为历史材料，结论与行号可能已失效。现行事实见 `docs/architecture-overview.md` 与 `src/`。索引：`docs/archive/README.md`。
# 自进化（Evolution）子系统重构方案

> 适用范围：仓库内 `src/evolution/*`（浏览器端）与 `evolution-agent/*`（Node 服务）。
> 编写依据：对当前代码的逐文件核实（见《架构审查报告》"进化代理"风险项）。
> 目标：将当前**实验性、无鉴权、无 LLM、路径脱节**的子系统，改造为**安全、诚实、可回滚、可审计**的进化管线。

---

## 0. 现状问题清单（证据）

| # | 问题 | 证据 | 严重度 |
|---|------|------|--------|
| P1 | Agent **无鉴权**，`Access-Control-Allow-Origin: *` | `evolution-agent/src/index.js:31-33` | 🔴 H |
| P2 | "AI 进化"**未接入 LLM**；`config.json` 有 `llmEndpoint` 但 `orchestrator` 从不调用 | `evolution-agent/src/evolution-orchestrator.js:70-105` | 🔴 H |
| P3 | 写入路径脱节：读取 `src/core/CardFrame.js`，但变更条目写向**不存在的 `src/card-framework.js`** | `evolution-orchestrator.js:72` vs `:86,:99` | 🔴 H |
| P4 | 所谓"进化"仅为**两个正则参数替换**，且 `cardObjectPool` 整行被替换会丢失其他构造参数 | `evolution-orchestrator.js:78-104` | 🟠 M |
| P5 | 浏览器**定时推送指标未实现**：`config.agentSyncInterval=60000` 已声明但代码中从未启用 | `src/evolution/EvolutionEngine.js:22` 声明 vs `:33-37` 未用 | 🟠 M |
| P6 | WebSocket 形同空转：服务端仅回声 `metrics-received`，浏览器端从不发 `metrics-report` | `index.js:101-109`，`EvolutionEngine.js:132` 仅收 `evolution-result` | 🟠 M |
| P7 | 浏览器进化历史仅内存（上限 1000，刷新即丢） | `EvolutionEngine.js:18,:183-188` | 🟡 L |
| P8 | 无人工闸门：`autoMergeThreshold` 配置存在但无代码引用，测试过即自动提交 | `config.json:9`，`version-manager.js` 无 merge 控制 | 🟠 M |
| P9 | 测试门禁脆弱：解析 `npm test` stdout 文本（`X passing`/`Y failing`），源码未变时恒"通过"→ 提交空操作 | `evolution-agent/src/test-runner.js:23-34` | 🟠 M |

---

## 1. 目标架构（目标态）

```
浏览器 (src/evolution/)
  MetricsCollector ──(每 N 秒, 真实)──► POST /api/metrics ──► Agent
  RuleEngine ── param-tune（浏览器内调参，保留）
            └─ code-evolve ── POST /api/evolve ──► Agent
                                              │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                           ① 鉴权网关              ② LLM（tool-calling）
                          token / 白名单            read_file / run_tests / apply_patch
                                    │                       │
                                    ▼                       ▼
                            ③ 结构化变更（AST patch，      ④ 沙箱 git worktree
                               非正则，路径可配置）      → 跑测试（JSON 判定）
                                    │                       │ 通过
                                    ▼                       ▼
                           ⑤ 应用 + 提交到 evolution 分支 + ⑥ 人工 Review/合并闸门
                                    │
                                    ▼
                           浏览器经 WS 收 configPatch → 应用 + 持久化历史（localStorage）
```

**设计原则**
1. **安全优先**：默认仅本机；远程必须经鉴权 + 代理；写操作限白名单路径。
2. **能力诚实**：要么真接 LLM，要么显式标注为"启发式 fallback"，不在文档/代码谎称 AI。
3. **结构化而非正则**：变更以 AST/声明式 patch 表达，路径来自配置，不复用"读新路径、写旧路径"的错位。
4. **测试门禁 + 人工闸门 + 可回滚**：每步可验证、可审计、可一键回退。

---

## 2. 分阶段实施

### Phase E1 — 安全止血（0.5 天，最高杠杆）
- `evolution-agent/src/index.js`：`config.bind` 默认 `127.0.0.1`；`config.token` 来自环境变量/`.env`（已依赖 `dotenv`）。
- 中间件：除 `/api/health` 外，校验请求头 `Authorization: Bearer <token>`；失败返回 401。
- `Access-Control-Allow-Origin` 由 `config.allowedOrigins` 控制，默认收紧（非 `*`）。
- 新增 `config.allowedWritePaths`（白名单，如 `["src/core/CardFrame.js"]`），`_applyChanges` 越界拒绝。
- 验收：无 token 请求被拒；非白名单路径写入被拒。

### Phase E2 — 正确性与诚实（1 天）
- 修正 P3：变更 `path` 统一为 `src/core/CardFrame.js`；读取与写入路径一致，来源改为 `config` 可配置。
- 替换 P4 的正则整行替换：改为**键值级 patch**（`{ file, find, replace }` 或 AST 节点定位），不破坏 `CardObjectPool` 其他构造参数。
- 全仓消除"AI 决策"的虚假表述（代码注释、`config` 字段说明、旧 README 已重写，复核 `src/evolution/*` 注释）。
- 引入 `capabilities` 标志：`{ llm: boolean, heuristicFallback: boolean }`，前端据此展示真实能力。
- 验收：对真实文件做参数调优，测试真能感知变化；文档与代码零"AI"夸大。

### Phase E3 — 真实 LLM 接入（2–3 天）
- 实现 `LlmClient`（消费现有 `config.llmEndpoint`，anthropic 风格）：
  - **tool-calling** 而非自由文本：暴露工具 `read_file(path)`、`run_tests()`、`apply_patch(patch)`。
  - 系统提示约束 LLM 仅可对**白名单文件**提变更，且必须返回结构化 JSON patch。
  - 严禁 LLM 触发任意 shell / 任意文件写；所有副作用走受控工具。
- 失败降级：LLM 不可用时回退到 E2 的启发式（若启用），并明确标注。
- 验收：给定"渲染慢"指标，LLM 产出可经测试门禁的 patch；越权请求被工具层拒绝。

### Phase E4 — 结构化变更应用（2 天）
- 弃用正则 `_generateFallbackChanges`；改为 **AST patch 引擎**：
  - 用 esbuild/acorn（已在 `node_modules` 传递依赖中）解析目标文件为 AST。
  - patch 描述定位（如 `CardFrame._initModules` 中 `new CardObjectPool(...)` 的 `maxPerType` 实参），改写后写回。
  - 不改写源码格式风格，最小化 diff，便于 review。
- 在 **git worktree / 临时分支**中应用变更后再测，避免污染工作区。
- 验收：同语义变更产出可读、最小、可 review 的 diff。

### Phase E5 — 指标真正打通（1 天）
- 实现 P5：在 `EvolutionEngine.start()` 启用 `agentSyncInterval` 定时器，周期 `POST /api/metrics`（而非仅在 `code-evolve` 时）。
- 真实 WS 通道：浏览器发 `metrics-report`，Agent 经 WS 推 `evolution-result` / `config-patch`；`EvolutionEngine._handleEvolutionResult` 已能消费。
- 验收：`/api/metrics` 真实收到周期指标；WS 双向消息可观测。

### Phase E6 — 持久化与可观测（1 天）
- P7：`EvolutionEngine` 历史序列化到 `localStorage`（带容量上限），重建时恢复。
- Agent 端：结构化 `evolution-meta` 已存在，补充"变更 diff / 指标前后对比 / 测试结果"字段，提供查询 API。
- 验收：刷新后浏览器仍可见进化历史；Agent 历史 API 返回完整上下文。

### Phase E7 — 人工闸门与发布（1 天）
- 接线 P8：`autoMergeThreshold` 生效——达标仅代表"可提议合并"，**不自动合并**；Agent 提交到 `evolution` 分支并创建 PR/待审，由人合并（复用 `version-manager.mergeToMain`，但改为受 `requireReview` 控制）。
- CI：在 PR 中**干跑（dry-run）** Agent（不写仓库），仅报告将产生的 patch，供评审。
- 编写运行手册（runbook）：启用步骤、鉴权配置、回滚命令、紧急关停。
- 验收：自动提交不再无审阅入库；dry-run 模式下零副作用。

---

## 3. 关键决策说明

- **为何用 git worktree 而非直写工作区**：隔离实验，避免污染开发者未提交改动；失败即丢弃 worktree。
- **为何 LLM 用 tool-calling 而非自由文本**：把"能做什么"收敛到受控工具，天然防御提示注入与任意代码执行；指标仅用于"触发"，决策受白名单约束。
- **测试门禁如何稳健**：弃用 stdout 文本解析（P9），改为 `npm test -- --reporter json` 或读取 `c8` 覆盖率 JSON，以结构化结果判定通过/失败。
- **安全模型**：本机零配置可用；远程须经反向代理 + Bearer 令牌；写路径白名单是最后一道防线。

---

## 4. 风险与对冲

| 风险 | 对冲 |
|------|------|
| LLM 产出破坏代码 | 测试门禁 + 小步变更 + worktree 自动回滚（已有 `RollbackManager`） |
| 提示注入（指标可伪造） | 指标仅触发、不决策；LLM 工具层强制白名单 |
| LLM 成本失控 | 节流（最小触发间隔）、预算上限、仅本机、dry-run 默认 |
| 历史膨胀 | 浏览器 localStorage 上限 + Agent 快照 `maxSnapshots` 已 20，按需下调 |

---

## 5. 验收标准（DoD）

- [ ] Agent 默认 `127.0.0.1` + Bearer 鉴权；越权/越路径请求被拒。
- [ ] 写入路径与源码真实结构一致；变更以结构化 patch 表达，不再依赖正则与旧路径。
- [ ] LLM 经 tool-calling 接入（或显式标注为启发式 fallback），文档零夸大。
- [ ] `agentSyncInterval` 生效，指标真实周期上报；WS 双向可用。
- [ ] 进化历史浏览器端可持久化、Agent 端可查询。
- [ ] 测试门禁基于结构化结果；自动提交需人工审阅闸门。
- [ ] 全部 190 单测仍通过；新增 evolutionary 路径有测试（含鉴权拒绝、越界拒绝、测试失败回滚）。

---

## 6. 与文档体系的关系

- 本方案落地后，更新 `docs/architecture-overview.md` 第 4 节与 `evolution-agent/README.md` 的"已知缺陷/配置生效"表。
- 旧 `docs/specs/2026-07-09-architecture-self-evolution-design.md` 与 `docs/superpowers/plans/*` 已标记📜历史，其中"AI 进化"设想以本方案为准重新对齐。
- 文档清理（见审查交付 #1）已完成：过时审计报告已标 DEPRECATED，规划/评估文档已标历史，新增 `docs/README.md` 导航与时效说明。

---

## 7. 实施状态（已执行，2026-07-12）

| 阶段 | 状态 | 落地要点 |
|------|------|---------|
| E1 安全止血 | ✅ 已落地 | `bind` 默认本机、Bearer 鉴权、`allowedWritePaths` 白名单、`allowedOrigins` 收紧（不再 `*`） |
| E2 正确性+诚实 | ✅ 已落地 | 写入路径对齐 `src/core/CardFrame.js`；键值级结构化 patch（唯一性校验）；`capabilities` 如实声明 |
| E3 真实 LLM | 🟡 已实现为可选 | `llmEndpoint`+`llmApiKeyEnv` 时经 tool-calling 生成 patch，失败/未配置自动降级启发式；**未做线上联调**（需自备 Key） |
| E4 结构化变更 | ✅ 已落地 | `find` 精确字面量 + 唯一匹配；`_revertChanges` 不依赖 git 直接还原被改文件 |
| E5 指标打通 | ✅ 已落地 | `agentSyncInterval` 已在 `EvolutionEngine` 启用；周期 `POST /api/metrics` + WS `metrics-report` |
| E6 持久化 | ✅ 已落地 | 浏览器历史入 `localStorage`；Agent 回传 `capabilities` |
| E7 人工闸门 | ✅ 已落地 | `dryRun` 不提交；`/api/merge` 受 review 令牌保护；CI 可 dry-run |

**验证**：主测试 190 passing、lint 0 错误；新增 `evolution-agent/test/orchestrator.test.js`（node:test，7 passing）覆盖鉴权路径拒绝、结构化 patch 唯一性、启发式 key-value 生成、evolve 应用+测试门禁+dryRun 回退、测试失败回滚、`capabilities`。

**遗留**：LLM 仅结构就绪、未联调；写能力须保持在白名单内；仍实验性、仅本机。
