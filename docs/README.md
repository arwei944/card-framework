# CardFrame 文档导航与时效说明

> 本文档用于**防止误读过时文档**。CardFrame 在 2026-07 经历了 Phase 4–7 重构：
> 从"单体 IIFE + 正则构建 + mock 测试"转为"**ES Module 源码 + esbuild + jsdom 真实测试**"。
> 重构前后架构差异巨大，请先读 [架构总览（当前）](architecture-overview.md)。

---

## ✅ 当前权威文档（以这些为准）

| 文档 | 内容 |
|------|------|
| [architecture-overview.md](architecture-overview.md) | **当前**真实架构、数据流、横切关注点、进化子系统真实状态 |
| [security.md](security.md) | XSS 防护、CSP、危险属性清单 |
| [api-reference.md](api-reference.md) | API 参考（注意：与源码仍可能存在 `.d.ts` 脱节，见下） |
| [plugin-development.md](plugin-development.md) | 插件开发（沙箱/权限/hook） |
| [agent-guide.md](agent-guide.md) | Agent 操作指南 |
| [best-practices.md](best-practices.md) | 性能/安全/插件/AI/主题最佳实践 |
| [faq.md](faq.md) | 常见问题 |
| [getting-started.md](getting-started.md) | 快速开始 |
| **[evolution-refactoring-plan.md](evolution-refactoring-plan.md)** | **自进化子系统重构方案（最新规划）** |
| [backend-integration.md](backend-integration.md) | **业务数据后端对接：BackendSync 适配器用法 + 示例服务** |
| `../evolution-agent/README.md` | 进化 Agent 真实状态（实验性、无鉴权、无 LLM） |

## 📜 历史记录（仅作过程留痕，结论已不适用）

| 文档 | 性质 | 横幅 |
|------|------|------|
| architecture-audit-report.md | 重构前架构评估（结论已失效） | ⛔ DEPRECATED |
| code-logic-quality-assessment.md | 重构前代码质量评估 | 📜 历史 |
| refactoring-plan.md | Phase 4 重构计划（目标已实现） | 📜 历史 |
| task-breakdown.md | Phase 4 任务拆解（已完成） | 📜 历史 |
| specs/2026-07-09-architecture-self-evolution-design.md | 旧自进化设计 | 📜 历史 |
| specs/2026-07-10-cardframe-v2-test-spec.md | 旧测试规格（含 mock 方案，已弃用） | 📜 历史 |
| superpowers/plans/2026-07-09-architecture-self-evolution.md | 旧实施计划 | 📜 历史 |
| superpowers/plans/2026-07-10-cardframe-v2-upgrade.md | 旧升级计划 | 📜 历史 |

## ⚠️ 已知文档债务

1. **`.d.ts` 与源码脱节风险**：`types/card-framework.d.ts` 由人工维护，可能与实际签名不符（如 `Store.updateCard` 仅接受完整对象、无增量重载）。改 API 时务必同步更新。
2. **旧文档残留旧架构论断**：凡含"单体 / IIFE / 正则构建 / mock 测试 / 权限无校验"字样的文档均为历史快照，请勿据以判断当前代码。
3. **进化子系统文档曾严重失实**：旧 `evolution-agent/README.md` 声称的 AI 决策、API Key 验证、60s WebSocket 指标推送，**代码中均不存在**；已据实重写。
