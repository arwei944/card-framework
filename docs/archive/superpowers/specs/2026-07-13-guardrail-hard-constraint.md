> **ARCHIVED / 非当前**：本文档为历史材料，结论与行号可能已失效。现行事实见 `docs/architecture-overview.md` 与 `src/`。索引：`docs/archive/README.md`。
# CardFrame Guardrail 硬约束系统设计

> **状态**：Implemented (2026-07-14)
> **日期**：2026-07-13
> **目标**：防止 AI Agent 在使用 CardFrame 构建前端时回退到原生 HTML/Tailwind/直接 DOM 操作的旧路径
> **验证**：218 tests passing, lint 0 errors, guardrail check clean

---

## 1. 问题陈述

### 1.1 现象

AI Agent 在使用 CardFrame 构建前端时，会下意识地：
1. 生成 `<div class="...">` 而非 `<cf-card>`
2. 使用 Tailwind / Bootstrap 等原子 CSS 框架
3. 用 `appendChild` / `innerHTML` 直接操作 DOM
4. 绕过 Store 直接修改私有字段

### 1.2 根因

| 根因 | 说明 |
|------|------|
| 训练数据偏好 | Agent 训练数据中 Tailwind/React/纯 HTML 样本远多于 CardFrame |
| 项目无指令文件 | 没有 AGENTS.md / .cursorrules / CLAUDE.md，Agent 启动时不知道项目用 CardFrame |
| 框架不强制 | 即使生成 `<div>` 而非 `<cf-card>`，框架也不报错，无反馈循环 |

### 1.3 目标

提供三层硬约束，确保 Agent 从第一次接触项目起就走在正确路径上：
- **提示层**：Agent 启动时读取指令文件，知道项目约束
- **构建时**：CI 拦截逃逸用法，阻止错误代码合并
- **运行时**：框架检测逃逸用法并报警 + 修复建议

---

## 2. 架构

```
┌─ 提示层 ──────────────────────────────────────┐
│  AGENTS.md          → 通用 Agent 指令          │
│  .cursorrules       → Cursor 专用              │
│  CLAUDE.md          → Claude 专用              │
└───────────────────────────────────────────────┘
┌─ 构建时 ──────────────────────────────────────┐
│  scripts/guardrail-check.js                   │
│  → 扫描 *.html 中的逃逸元素和 class           │
│  → 扫描 *.js 中的直接 DOM 操作和私有字段访问  │
│  → npm run guardrail                          │
│  → 集成到 CI                                  │
└───────────────────────────────────────────────┘
┌─ 运行时 ──────────────────────────────────────┐
│  src/guardrail/Guardrail.js                   │
│  → 初始化时扫描容器内逃逸元素                 │
│  → MutationObserver 持续监控                  │
│  → 劫持容器的 appendChild/innerHTML           │
│  → 检测到时 console.warn/error + 修复建议     │
│  → 通过 options.guardrail 配置启用             │
└───────────────────────────────────────────────┘
```

### 2.1 设计原则

1. **职责清晰**：Guardrail 只管"是否走对路"，不污染 RealTimeValidator（数据校验）和 Security（XSS）
2. **零依赖**：构建时脚本和运行时模块都不需要外部工具
3. **默认开启可关闭**：`options.guardrail !== false` 时启用
4. **不影响容器外**：只检测 `<card-frame>` 容器内部，页面其他部分自由

---

## 3. 检测规则

### 3.1 四类逃逸用法

| 编号 | 类型 | 检测目标 | 示例 | 严重性 |
|------|------|----------|------|--------|
| R1 | 非卡片元素 | 容器内的非 `<cf-card>` / `<cf-*>` / 白名单元素 | `<div class="card">` | warn |
| R2 | 逃逸 CSS 框架 | 容器内元素带有 Tailwind / Bootstrap / 其他原子 CSS class | `<div class="flex p-4">` | info |
| R3 | 直接 DOM 操作 | JS 用 `appendChild` / `innerHTML` / `insertAdjacentHTML` 操作容器 | `container.appendChild(el)` | error |
| R4 | 绕过 Store | JS 直接读改 `frame.store._cards` 等私有字段 | `frame.store._cards.push(...)` | error |

### 3.2 白名单（容器内允许的元素）

- `<cf-card>` / `<cf-shadow-card>`（卡片元素）
- `<card-frame>`（嵌套框架）
- `<template>`（框架内部使用）
- 纯文本节点（卡片内容）
- 注释节点

### 3.3 逃逸 CSS 框架识别

通过 class 前缀识别：

| 框架 | class 前缀模式 |
|------|----------------|
| Tailwind | `flex` `grid` `p-` `m-` `text-` `bg-` `w-` `h-` `rounded` `shadow` `border` `gap-` `justify-` `items-` |
| Bootstrap | `col-` `row` `container` `btn` `card` `alert` `badge` `d-` `text-` `bg-` |
| Bulma | `column` `is-` `has-` |

### 3.4 严重性分级

| 级别 | 含义 | 行为 |
|------|------|------|
| `error` | 严重逃逸（R3/R4） | `console.error` + FeedbackSystem 记录 |
| `warn` | 一般逃逸（R1） | `console.warn` + 修复建议 |
| `info` | 轻度可疑（R2） | `console.info`（不刷屏，聚合输出） |

### 3.5 不检测的场景

- 容器**外**的元素（页面 header/nav/footer 自由使用任何技术）
- 卡片**内部**的内容（卡片 props 的 HTML 内容由 Security 管 XSS）
- 测试代码（通过 `data-test` 属性或 `process.env.NODE_ENV === 'test'` 跳过）

---

## 4. 运行时 API

### 4.1 配置

```javascript
new CardFrame('#app', {
  guardrail: {
    enabled: true,           // 默认 true，设为 false 完全关闭
    level: 'warn',           // 'error' | 'warn' | 'info'，默认 'warn'
    onViolation: null,       // 自定义回调 (violation) => void
    excludedFrameworks: [],  // 允许的 CSS 框架名，如 ['tailwind'] 则不检测 Tailwind
    testMode: false          // true 时只记录不输出 console
  }
});
```

### 4.2 Guardrail 类

```javascript
// src/guardrail/Guardrail.js
export class Guardrail {
  constructor(frame, options = {}) { ... }
  
  // 初始扫描容器内现有元素
  scan() { ... }
  
  // 启动 MutationObserver 持续监控
  observe() { ... }
  
  // 停止监控
  disconnect() { ... }
  
  // 劫持容器的 DOM 操作方法
  _hijackDOMAPI() { ... }
  
  // 检测单个节点
  _checkNode(node) { ... }
  
  // 检测 CSS class
  _checkCSSClasses(element) { ... }
  
  // 输出违规信息
  _report(violation) { ... }
  
  // 获取违规统计
  getStats() { ... }
}
```

### 4.3 违规对象格式

```javascript
{
  rule: 'R1',                    // 规则编号
  severity: 'warn',              // 严重性
  message: '容器内发现非卡片元素', // 描述
  element: '<div class="card">', // 元素描述
  suggestion: '改用 <cf-card type="text">', // 修复建议
  timestamp: 1234567890
}
```

### 4.4 集成到 CardFrame

在 `CardFrame` 构造函数中初始化：

```javascript
// src/core/CardFrame.js
constructor(container, options = {}) {
  // ... 现有初始化 ...
  
  // Guardrail（默认开启）
  if (options.guardrail !== false) {
    this.guardrail = new Guardrail(this, options.guardrail);
    this.guardrail.scan();
    this.guardrail.observe();
  }
}
```

### 4.5 静态访问

```javascript
CardFrame.Guardrail = Guardrail;  // 静态属性
```

---

## 5. 构建时检查脚本

### 5.1 脚本

`scripts/guardrail-check.js`：

```javascript
// 扫描范围：
// - 所有 *.html 文件中的 <card-frame> 容器内部
// - 所有 *.js 文件中对容器的 DOM 操作

// 检测项：
// - R1: 容器内的 <div> / <span> / <section> 等非卡片元素
// - R2: 容器内元素的 Tailwind/Bootstrap class
// - R3: JS 中的 container.appendChild/innerHTML/insertAdjacentHTML
// - R4: JS 中的 frame.store._* 私有字段访问

// 输出：
// - 发现违规时退出码 1，打印详细报告
// - 无违规时退出码 0
```

### 5.2 npm 脚本

```json
{
  "scripts": {
    "guardrail": "node scripts/guardrail-check.js",
    "ci": "npm run lint && npm run guardrail && npm test && npm run build"
  }
}
```

### 5.3 CI 集成

更新 `.github/workflows/ci.yml`，在 test 前加 guardrail 检查。

---

## 6. 提示层指令文件

### 6.1 AGENTS.md（项目根目录）

通用 Agent 指令文件，适用于所有 AI Agent。内容包括：
- 项目使用 CardFrame 框架的声明
- 必须使用 `<cf-card>` 而非 `<div>`
- 禁止使用 Tailwind/Bootstrap 等原子 CSS
- 禁止直接 DOM 操作，必须用 `frame.createCard()` 等 API
- 卡片类型清单和示例
- 常见错误对照表

### 6.2 .cursorrules（项目根目录）

Cursor 专用，内容与 AGENTS.md 一致但格式适配 Cursor。

### 6.3 CLAUDE.md（项目根目录）

Claude 专用，内容与 AGENTS.md 一致。

---

## 7. 测试

### 7.1 运行时测试

- R1 检测：容器内插入 `<div>` 应触发 warn
- R2 检测：容器内元素带 Tailwind class 应触发 info
- R3 检测：`container.appendChild()` 应触发 error
- R4 检测：访问 `frame.store._cards` 应触发 error
- 白名单：`<cf-card>` / `<template>` / 注释不触发
- 关闭：`options.guardrail: false` 时不检测
- 自定义回调：`onViolation` 被正确调用
- testMode：不输出 console 但仍记录

### 7.2 构建时测试

- 扫描含逃逸用法的 HTML 文件应报错
- 扫描含直接 DOM 操作的 JS 文件应报错
- 扫描干净文件应通过

---

## 8. 文档更新

- `docs/api-reference.md`：新增 Guardrail 章节
- `docs/agent-guide.md`：新增"硬约束"章节
- `docs/architecture-overview.md`：新增 Guardrail 到子系统列表
- `README.md`：特性列表新增"硬约束"
- `types/card-framework.d.ts`：新增 Guardrail 类型
- `CHANGELOG.md`：新增 v1.2.0 条目

---

## 9. 实现顺序

1. 运行时模块 `src/guardrail/Guardrail.js`
2. 集成到 `src/core/CardFrame.js`
3. 导出 `src/index.js`
4. 更新 `types/card-framework.d.ts`
5. 构建时脚本 `scripts/guardrail-check.js`
6. 提示层文件 `AGENTS.md` / `.cursorrules` / `CLAUDE.md`
7. 测试 `tests/guardrail-tests.js`
8. 文档更新
9. CI 集成
10. 验证（test/lint/benchmark）
