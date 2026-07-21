# 归档文档（非当前）

本目录存放**历史审计、重构计划与过程规格**。  
**不要**用这里的行号、测试数、架构结论判断当前代码。

## 现行权威来源

| 文档 | 用途 |
|------|------|
| [`../architecture-overview.md`](../architecture-overview.md) | 当前架构 |
| [`../api-reference.md`](../api-reference.md) | 当前 API |
| [`../README.md`](../README.md) | 文档导航 |
| 仓库根 [`package.json`](../../package.json) | 版本与脚本 |
| `src/` | 源码事实 |

当前版本：**v1.2.0**（以 `package.json` 为准）。

## 归档清单

### 重构前评估 / 计划

| 文件 | 说明 |
|------|------|
| `architecture-audit-report.md` | Phase 4 前架构审计（DEPRECATED） |
| `code-logic-quality-assessment.md` | 单体时期代码质量评估 |
| `refactoring-plan.md` | Phase 4 重构计划（目标已实现） |
| `task-breakdown.md` | Phase 4 任务板（历史） |
| `evolution-refactoring-plan.md` | 自进化改造规划（部分已落地，以 evolution-agent 代码为准） |

### 过程规格（specs）

| 文件 | 说明 |
|------|------|
| `specs/2026-07-09-architecture-self-evolution-design.md` | 旧自进化设计 |
| `specs/2026-07-10-cardframe-v2-test-spec.md` | 旧测试规格（含 mock 方案，已弃用） |

### Superpowers 过程产物

| 文件 | 说明 |
|------|------|
| `superpowers/plans/2026-07-09-architecture-self-evolution.md` | 旧实施计划 |
| `superpowers/plans/2026-07-10-cardframe-v2-upgrade.md` | 旧升级计划 |
| `superpowers/specs/2026-07-13-guardrail-hard-constraint.md` | Guardrail 规格过程稿；现行行为以 `src/guardrail/` 与 `AGENTS.md` 为准 |

---

每份归档文首若仍有「历史记录」横幅，请以其为准。新增历史材料时请放入本目录并更新本表。
