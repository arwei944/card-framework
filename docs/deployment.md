# 部署、可观测性与生产就绪

> 本文档对应"生产化五项缺口"的落地说明。核心框架（`CardFrame`/`Store`/`Renderer` 等）
> 已达到生产可用；以下补齐**鉴权、一致性、可观测性、CI、SSR/SEO** 与**自进化 Agent 的边界**。

---

## 1. 自进化 Agent：仅限开发/预发，禁止生产自动改写

`evolution-agent` 能**改写源码**。生产环境必须关闭自动改写：

- `evolution-agent/src/config.json` 默认 `dryRun: true` + `requireReview: true`。
- `NODE_ENV=production` 启动时，`index.js` 强制覆盖为 `dryRun+requireReview`，即使配置被改也**不会**自动改源码，并打印 `PRODUCTION` 横幅。
- 推荐拓扑：在独立 dev/staging 机器跑 agent 做演进 → 经 `/api/merge`（需 `x-review-token`）人工审后合入 → 再发布到生产。
- 生产构建**不要**包含 `evolution-agent` 服务进程。

---

## 2. 业务后端鉴权（BackendSync）

`BackendSync` 客户端已支持 `authToken`（字符串或 `() => string`）。示例服务
`examples/backend-sync-server.mjs` 现支持真实鉴权：

```bash
# JWT (HS256, 零依赖，用 node:crypto 校验)
SYNC_JWT_SECRET=xxx node examples/backend-sync-server.mjs
# 生成演示 token
SYNC_JWT_SECRET=xxx node examples/backend-sync-server.mjs --issue
# 或静态 token
SYNC_API_TOKEN=abc node examples/backend-sync-server.mjs
```

鉴权策略（示例服务）：
- 设了 `SYNC_JWT_SECRET` → 校验 Bearer JWT（HS256，含 `exp`）。
- 否则设了 `SYNC_API_TOKEN` → 校验该静态 token。
- 两者都没设 → 允许匿名并**打印警告**（仅用于本地调试，勿用于生产）。

前端接线（从你的登录态取 JWT）：
```js
const sync = new BackendSync(frame, {
  endpoint: '/api/cardframe',
  authToken: () => sessionStorage.getItem('access_token'),
  concurrency: 'etag'
});
```

---

## 3. 一致性：离线队列 + ETag 乐观锁

`BackendSync` 现已具备：

- **离线队列**：推送因网络失败时不丢弃，缓冲到内存（并持久化到 `localStorage`，key `cf-sync-<endpoint>`）；浏览器 `online` 事件或下次 `start()` 时自动重放。
- **ETag 乐观锁**（`concurrency: 'etag'`）：客户端带 `If-Match`；服务端版本不符返回 `409` + 当前快照。客户端默认**重新 pull**（last-write-wins），或你用 `onConflict(snapshot)` 自定义字段级合并。

```js
new BackendSync(frame, {
  endpoint: '/api/cardframe',
  mode: 'incremental',
  concurrency: 'etag',           // 开启乐观锁
  offlineQueue: true,            // 默认开启
  onConflict: (serverSnapshot) => {
    // 自定义合并：例如把 server 快照与本地快照做字段级 diff 后再 importData
  }
});
```

> 注意：默认仍是 last-write-wins 的简化模型。真正的多端实时协同（CRDT/OT）需额外服务，不在本适配器范围。

---

## 4. 可观测性：Monitor（错误上报，opt-in）

新增 `src/extras/Monitor.js`（零依赖），采集 `window.onerror`、`unhandledrejection`
与 CardFrame 的 `frameworkError` 事件，批量上报：

```js
import { Monitor } from 'card-framework';

Monitor.init({
  endpoint: 'https://your-collector.example.com/api/errors',
  token: () => sessionStorage.getItem('access_token'),
  batchSize: 10,
  flushMs: 5000,
  frame                          // 可选：挂到某个 CardFrame 实例以采集 frameworkError
});
// 主动上报
Monitor.report(new Error('something broke'));
```

- 不上报本地非错误；`destroy()` 时冲刷剩余批次并解绑。
- 上报端点是你自己的收集服务（Sentry/自研均可），本仓库不内置。

---

## 5. CI

`.github/workflows/ci.yml`：Node 20/22 矩阵，执行 `npm ci` → `npm run lint` →
`npm run build` → `npm test`。`prepublish`/发布前请确保 CI 全绿。

---

## 6. SSR / SEO

CardFrame 是**纯客户端渲染（CSR）**的 DOM/Canvas 框架，**无法在服务端渲染卡片内容**
（浏览器 API 强依赖）。生产 SEO 的务实方案：

- **元信息**：在 HTML `<head>` 提供静态 `title` / `description` / Open Graph，描述产品而非卡片内容。
- **预渲染**：对落地页用静态 HTML 或预渲染服务（如 Puppeteer 生成快照）喂爬虫；卡片画布区对 SEO 通常无价值。
- **可访问性**：为关键卡片提供 `<noscript>` 提示与结构化数据（JSON-LD）由你的后端输出，而非前端框架。

不要期待"给 CardFrame 加 SSR"——架构上不经济。需要爬虫可见的内容，请由业务后端直接输出 HTML/JSON-LD。

---

## 7. 生产就绪清单（已落地 ✅）

| 项 | 状态 |
|----|------|
| 自进化 Agent 生产锁（dryRun+requireReview 强制） | ✅ |
| 后端鉴权（JWT/静态 token 示例） | ✅ |
| 一致性（离线队列 + ETag 乐观锁） | ✅ |
| 错误上报（Monitor） | ✅ |
| CI（lint+build+test） | ✅ |
| 类型声明对齐（`types/card-framework.d.ts` 含 BackendSync/Monitor/import-export） | ✅ |
| SSR/SEO 文档与务实方案 | ✅（文档，非框架特性） |

**尚未覆盖（需额外服务/决策）**：多端实时协同（CRDT/OT）、字段级冲突合并默认策略、
真实持久化后端（示例服务是内存存储）、细粒度授权（RBAC/ABAC）。
