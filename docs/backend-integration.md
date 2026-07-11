# 业务数据后端对接（BackendSync）

> 状态：已落地（v1.0）。零运行时依赖，纯 HTTP + 全局 `fetch`，可注入实现用于测试。

CardFrame 本身只负责内存中的卡片数据。要与你的业务数据后端（数据库 / REST 服务）打通，
使用 `src/extras/BackendSync.js` 这个**可选**适配器——它把 CardFrame 既有的
`exportData` / `importData` 表示直接搬到你指定的 HTTP 端点，不引入任何业务约定。

---

## 1. 三类对接面回顾

| 对接面 | 谁负责 | 传输内容 |
|--------|--------|----------|
| **A. 业务数据后端** | `BackendSync`（本文） | 卡片/关系数据 CRUD 同步 |
| B. 自进化 / LLM 后端 | `evolution-agent`（已接通） | 指标上报 + 结构补丁 |
| C. 插件调业务后端 | `PluginSandbox`（默认禁用 `fetch`） | 插件内受限出站请求 |

本文只讲 **A**。

---

## 2. 快速开始

```js
import { CardFrame, BackendSync } from 'card-framework';

const frame = new CardFrame('#container', { evolution: false });

const sync = new BackendSync(frame, {
  endpoint: '/api/cardframe',   // 你的后端基址
  mode: 'incremental',          // 'full' | 'incremental'
  authToken: () => localStorage.getItem('token'), // 或静态字符串
  debounceMs: 400,
  pullOnStart: true,            // 启动时先拉取云端快照
  onError: (err, ctx) => console.warn('sync error', ctx, err)
});

sync.start();   // 开始监听变更并周期性上报
```

引入后即可通过 `window.CardFrame.BackendSync` 访问。

---

## 3. 契约（前后端约定）

适配器按以下 HTTP 形状通信（可自由替换语义等价的实现）：

### GET `{endpoint}`
返回一份**完整快照**，结构与 `frame.exportData()` 一致：
```json
{ "version": "1.0.0", "cards": [...], "relationships": [...], "layoutMode": "free", "metadata": {} }
```
`BackendSync` 收到后执行 `frame.importData(data, { mode: 'replace', clearBeforeImport: true })`。

### POST `{endpoint}/sync`
- **全量模式**（`mode: 'full'`）：body 即上面的完整快照，后端直接整体替换。
- **增量模式**（`mode: 'incremental'`）：body 为结构化 delta：
```json
{
  "incremental": true,
  "cards": {
    "added":   [ /* 完整卡片对象 */ ],
    "updated": [ /* 完整卡片对象 */ ],
    "removed": [ "card-id-1", "card-id-2" ]
  },
  "relationships": { "added": [], "updated": [], "removed": [] }
}
```
后端对 `added`/`updated` 按 `id` upsert，对 `removed` 按 `id` 删除即可（last-write-wins）。

鉴权：若传了 `authToken`，每次请求附带 `Authorization: Bearer <token>`。CORS 由你的后端自行配置。

---

## 4. 增量模式的判定逻辑

适配器在浏览器端维护一份"已上报镜像"（仅比较 `type/props/status/position/style`，
**排除 `createdAt`/`updatedAt` 时间戳**），每次 flush 时与当前 store 比对，只发送真正变化的卡片：

- 镜像里没有的 id → `added`
- 镜像里有但内容变了 → `updated`
- 当前 store 里没有、镜像里有的 id → `removed`

推送成功后镜像更新为当前状态，保证下一次 delta 相对已提交状态计算。

---

## 5. 配置项

| 选项 | 默认 | 说明 |
|------|------|------|
| `endpoint` | `'/api/cardframe'` | 后端基址 |
| `mode` | `'full'` | `'full'` 全量 / `'incremental'` 增量 |
| `debounceMs` | `400` | 变更合并后的上报节流 |
| `pullOnStart` | `true` | 启动时先 GET 拉取云端 |
| `autoPush` | `true` | 是否监听 store 变更自动上报 |
| `authToken` | `null` | 字符串或 `() => string`（Bearer） |
| `headers` | `{}` | 额外请求头 |
| `onError` | `null` | `(err, { phase }) => {}` |
| `onConflict` | `null` | pull 前回调，可用于自定义冲突策略 |
| `fetchImpl` | 全局 `fetch` | 注入用，便于测试 |

方法：`start()` / `stop()` / `pushNow()`（立即上报，返回 Promise）/ `pull()` / `destroy()`。

---

## 6. 冲突与一致性

当前策略是**简单 last-write-wins**。多端并发写同一张卡片时后到者覆盖先到者。
若需更强一致性，可：

- 在后端用 `updatedAt` / 版本号 / ETag 做乐观锁，冲突时返回 `409`，适配器在 `onError` 中触发 `pull()` 重新合并；
- 或在 `onConflict` 钩子里自定义合并逻辑（例如字段级合并）。

适配器本身不持久化、不缓冲离线队列——离线期间本地变更不会自动重放，恢复网络后下次变更触发上报。如需离线队列，请在 `onError` 中自行实现重试/持久化。

---

## 7. 零依赖示例服务

`examples/backend-sync-server.mjs` 是一个**零依赖** Node `http` 示例：内存存储、last-write-wins、
支持全量与增量两种 `POST` 形状，并开启了 CORS。生产环境请换成真实数据库并加上 Bearer 鉴权：

```bash
node examples/backend-sync-server.mjs   # 监听 http://localhost:3001/api/cardframe
```

前端指向它：
```js
new BackendSync(frame, { endpoint: 'http://localhost:3001/api/cardframe', mode: 'incremental' });
```

---

## 8. 测试

`tests/integration/backend-sync.test.js`（mocha）覆盖：构造校验、全量推送、增量 add/update/remove、
Bearer 头、pull 导入、请求失败回调。运行 `npm test` 一并执行（共 196 用例）。
