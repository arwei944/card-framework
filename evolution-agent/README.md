# CardFrame Evolution Agent 服务

> ⚠️ **实验性功能 · 请勿在生产或暴露网络中使用**
> 本服务当前**未实现鉴权**（`CORS *`、无 token），且"AI 进化"能力**尚未接入 LLM**——
> 实际只做两个基于正则的参数替换，并写入一个**已不存在的源码路径**。详见 `docs/evolution-refactoring-plan.md`。

---

## 它现在实际做什么

一个**本地开发用**的 Node HTTP 服务（默认 `:9100`），接收浏览器端 `EvolutionEngine` 发来的 `/api/evolve` 请求，尝试对工程源码做"优化"并提交到 git：

```
CardFrame (浏览器, src/evolution/)          Evolution Agent (Node, evolution-agent/src/)
────────────────────────────────          ──────────────────────────────────────
MetricsCollector ──► RuleEngine        HTTP :9100  (无鉴权, CORS *)
        │  code-evolve 动作                │
        └── XHR POST /api/evolve ─────► EvolutionOrchestrator
                                           1. 创建 git 快照 (RollbackManager)
                                           2. 改写源码文件 (_generateFallbackChanges)
                                           3. 跑 `npm test` (TestRunner)
                                           4. 通过 → git commit 到 evolution 分支
                                              失败 → 回滚快照
```

---

## 文件结构

```
evolution-agent/
├── src/
│   ├── index.js                 # 服务入口（HTTP + 可选 WebSocket）
│   ├── config.json              # 配置（端口、projectRoot、llmEndpoint 等）
│   ├── evolution-orchestrator.js# 编排：快照 → 改文件 → 测试 → 提交/回滚
│   ├── version-manager.js       # git 版本管理（evolution 分支、提交、meta）
│   ├── test-runner.js          # 跑 `npm test` 并解析 stdout
│   └── rollback-manager.js      # git stash + reset --hard 快照/回滚（保留 20 个）
└── package.json                # 依赖 ws / dotenv
```

---

## 快速开始（仅本机开发）

```bash
cd evolution-agent
npm install
npm start
# 监听 9100 端口
```

浏览器端需显式开启并指向本机：

```javascript
const frame = new CardFrame(container, {
  evolution: true,
  evolutionOptions: { agentEndpoint: 'http://127.0.0.1:9100' }
});
```

---

## 配置（`src/config.json`）

| 配置项 | 类型 | 当前是否生效 | 说明 |
|--------|------|--------------|------|
| `port` | number | ✅ | 监听端口（默认 9100） |
| `bind` | string | ✅ | 绑定地址（默认 `127.0.0.1`，**仅本机**） |
| `projectRoot` | string | ✅ | 相对 `src/` 的工程根（默认 `..`） |
| `branch` / `evolutionBranch` | string | ✅ | git 主分支 / 进化提交分支 |
| `tokenEnv` | string | ✅ | 从环境变量读取 Bearer 令牌（`CARD_EVOLUTION_TOKEN`） |
| `reviewTokenEnv` | string | ✅ | 合并闸门令牌环境变量（`CARD_EVOLUTION_REVIEW_TOKEN`） |
| `allowedOrigins` | array | ✅ | CORS 白名单；空数组 = 不跨域（不再 `*`） |
| `allowedWritePaths` | array | ✅ | **写文件白名单**（默认仅 `src/core/CardFrame.js`） |
| `llmEndpoint` | string | ⚠️ 仅配置 LLM 时生效 | Anthropic Messages 端点 |
| `llmApiKeyEnv` | string | ⚠️ 仅配置 LLM 时生效 | LLM Key 环境变量（`ANTHROPIC_API_KEY`） |
| `llmModel` | string | ⚠️ 仅配置 LLM 时生效 | 模型名 |
| `requireReview` | bool | ✅ | 合并到主分支需 review 令牌（默认 true） |
| `dryRun` | bool | ✅ | true = 应用变更跑测试后**回退、不提交** |
| `testTimeout` | number | ✅ | `npm test` 超时（ms） |
| `maxSnapshots` | number | ✅ | 保留快照数（默认 20） |
| `autoMergeThreshold` | number | ⚠️ 保留字段 | 历史阈值，当前以 `requireReview` 为准 |
| `npmCommand` | string | ✅ | 测试命令（默认 `npm`） |

### 鉴权
- 除 `/api/health` 外，所有写/读端点要求 `Authorization: Bearer <token>`（token 取自 `tokenEnv` 环境变量）。
- 未配置 token 时记录 WARNING 并仅依赖 `bind=127.0.0.1` 的本机隔离。
- 合并端点 `/api/merge` 额外要求 `x-review-token` 头。

---

## API

### `POST /api/evolve`
请求体：`{ action: { target, value }, metrics, useLlm? }`
流程：快照 → 生成结构化 patch（LLM tool-calling 或启发式）→ 应用 → `npm test`（JSON reporter 判定）→ 通过则提交到 `evolution` 分支（dryRun 则回退），失败则回滚。
返回含 `method`（`llm` / `heuristic` / `heuristic(fallback)` / `noop`）、`capabilities`、`commit` 或 `dryRun`。

### `POST /api/metrics`
浏览器端按 `agentSyncInterval` 周期上报指标（已由 `EvolutionEngine` 启用）。

### `GET /api/history` / `GET /api/snapshots` / `POST /api/rollback` / `POST /api/merge` / `GET /api/health`
进化日志、快照列表、按 sessionId 回滚、受 review 令牌保护的合并、健康检查。

### WebSocket
挂载 `WebSocketServer`；浏览器端按周期发送 `metrics-report`，服务端回显并可由 Agent 经 WS 向浏览器推送 `config-patch`（`EvolutionEngine` 已消费）。

---

## 已实现（按 `docs/evolution-refactoring-plan.md`）

- **E1 安全止血**：`bind` 默认本机、Bearer 鉴权、写路径白名单、`allowedOrigins` 收紧（不再 `*`）。
- **E2 正确性与诚实**：写入路径对齐真实源码（`src/core/CardFrame.js`）；变更改为**键值级结构化 patch**（唯一性校验，不再整行正则替换破坏其他构造参数）；`capabilities` 如实声明 LLM/启发式。
- **E3 LLM（可选）**：配置 `llmEndpoint`+`llmApiKeyEnv` 时经 **tool-calling** 生成 patch，失败/未配置自动降级启发式（**未做线上联调**，需自备 Key）。
- **E4 结构化变更**：`find` 精确字面量 + 唯一匹配校验；回退不依赖 git（`_revertChanges` 直接还原被改文件）。
- **E5 指标打通**：`agentSyncInterval` 已在 `EvolutionEngine` 启用，真实周期 `POST /api/metrics` + WS `metrics-report`。
- **E6 持久化**：浏览器端进化历史写入 `localStorage`；Agent 回传 `capabilities`。
- **E7 人工闸门**：`dryRun` 不提交；合并 `/api/merge` 受 review 令牌保护；CI 可 `dryRun` 干跑。

## 仍需注意
- LLM 联调依赖外部 Key，未在仓库内测试；默认走启发式。
- 写文件能力**必须**保持在 `allowedWritePaths` 白名单内（默认仅 `src/core/CardFrame.js`）。
- 仍属**实验性**，仅本机开发使用；生产/暴露网络前须完成鉴权与 review 闸门（已实现，但需正确配置 token）。

---

## 测试
```
cd evolution-agent
npm test        # node --test test（无需额外依赖，ws/dotenv 为可选）
```
覆盖：写路径白名单拒绝、结构化 patch 唯一性、启发式 key-value 生成、evolve 应用+测试门禁+dryRun 回退、测试失败回滚、`capabilities` 声明。
