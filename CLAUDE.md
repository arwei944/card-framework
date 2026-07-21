# CardFrame Claude 指令

本项目使用 CardFrame 框架构建前端。所有 AI Agent 工作时必须遵守以下硬约束。

## 硬约束

1. **使用 `<cf-card>` 而非 `<div>`**：所有 UI 通过卡片组件渲染
2. **禁止原子 CSS**：`<card-frame>` 容器内不允许 Tailwind/Bootstrap/Bulma class
3. **禁止直接 DOM 操作**：用 `frame.createCard()` 而非 `appendChild` / `innerHTML`
4. **禁止访问 Store 私有字段**：用 `frame.getAllCards()` 而非 `frame.store._cards`

## 卡片类型

`text` / `task` / `image` / `list` / `progress` / `link` / `note` / `code`（+ abstract `base`）

## 代码模板

```html
<card-frame id="app">
  <cf-card type="text" data-title="标题" data-content="内容"></cf-card>
</card-frame>
<script type="module" src="./dist/card-framework.esm.js"></script>
```

```javascript
import CardFrame from './dist/card-framework.esm.js';
const frame = new CardFrame('#app');
frame.createCard('text', { title: '标题', content: '内容' });
```

## 验证

- 运行时 Guardrail 自动检测逃逸用法
- `npm run guardrail` 构建时检查
- `[CardFrame Guardrail]` 控制台警告必须立即修复

## 参考文档

- [AGENTS.md](AGENTS.md) — 完整指令
- [docs/api-reference.md](docs/api-reference.md) — API 手册
- [docs/agent-guide.md](docs/agent-guide.md) — Agent 指南
