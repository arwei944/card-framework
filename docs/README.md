# CardFrame 文档导航

> **当前事实源**：[`architecture-overview.md`](architecture-overview.md) · 源码 `src/` · 根目录 `package.json`（**v1.2.0**）  
> 历史材料一律见 [`archive/`](archive/README.md)，**结论不代表当前代码**。

---

## 快速入口

| 你想… | 去读 |
|--------|------|
| 5 分钟上手 | [getting-started.md](getting-started.md) |
| 查 API | [api-reference.md](api-reference.md) |
| 理解架构 | [architecture-overview.md](architecture-overview.md) |
| 写插件 | [plugin-development.md](plugin-development.md)（官方 ESM 示例：`plugins/task-manager`） |
| 给 AI Agent 用 | [agent-guide.md](agent-guide.md) · 根目录 [AGENTS.md](../AGENTS.md) |
| 安全 / 部署 | [security.md](security.md) · [deployment.md](deployment.md) |
| 后端同步 | [backend-integration.md](backend-integration.md) |
| 项目硬约束 | [CONSTRAINTS.md](CONSTRAINTS.md) |
| Evolution Agent | [../evolution-agent/README.md](../evolution-agent/README.md) |

---

## 现行文档索引

### 入门与参考

| 文档 | 内容 |
|------|------|
| [getting-started.md](getting-started.md) | 引入方式、声明式 HTML、JS API |
| [api-reference.md](api-reference.md) | 完整 API（含增量 `updateCard`、Guardrail、Store 公开方法） |
| [faq.md](faq.md) | 常见问题 |
| [best-practices.md](best-practices.md) | 性能 / 安全 / 插件实践 |

### 架构与约束

| 文档 | 内容 |
|------|------|
| [architecture-overview.md](architecture-overview.md) | 模块结构、数据流、横切能力、进化子系统真实状态 |
| [CONSTRAINTS.md](CONSTRAINTS.md) | MUST / MUST NOT 硬约束 |
| [coverage-baseline.md](coverage-baseline.md) | c8 覆盖率基线与 sanitizer 说明 |

### 扩展与运维

| 文档 | 内容 |
|------|------|
| [plugin-development.md](plugin-development.md) | 插件生命周期、沙箱权限、示例 |
| [agent-guide.md](agent-guide.md) | Agent 操作与偏移防护 |
| [security.md](security.md) | XSS / CSP / 危险属性 |
| [backend-integration.md](backend-integration.md) | BackendSync |
| [deployment.md](deployment.md) | 生产部署注意项 |

### 外部（仓库内）

| 文档 | 内容 |
|------|------|
| [../README.md](../README.md) | 项目主页与特性摘要 |
| [../CHANGELOG.md](../CHANGELOG.md) | 版本变更 |
| [../evolution-agent/README.md](../evolution-agent/README.md) | 本机进化 Agent（token、dryRun、heuristic） |
| [../AGENTS.md](../AGENTS.md) / [../Claude.md](../Claude.md) | Agent 硬约束指令 |

---

## 归档（非当前）

见 **[archive/README.md](archive/README.md)**：

- 旧架构审计 / 代码质量评估 / Phase 4 计划
- 旧 specs 与 superpowers 过程稿

---

## 文档纪律

1. **版本与测试数**以 `package.json` 与 `npm test` 为准；改完代码请同步 README badge 与「测试状态」表。
2. **内置卡片类型**以 `src/core/defaultCardTypes.js` 为准（当前：abstract `base` + `text` / `task` / `image` / `list` / `progress` / `link` / `note` / `code`）。
3. **API 变更**须同步 `types/card-framework.d.ts` 与 [api-reference.md](api-reference.md)。
4. Evolution Agent **不得**再描述为「无鉴权 / CORS *」；写路由需 Bearer token，bind 默认 `127.0.0.1`。
5. 过时评估与过程计划**只进 archive**，不留在 `docs/` 顶层冒充现行文档。
