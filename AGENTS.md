# CardFrame 项目 Agent 指令

> **本文件是所有 AI Agent 在本项目工作时的硬约束。开始任何前端构建任务前必须先读本文件。**

## 项目声明

本项目使用 **CardFrame** 框架构建前端，**不是** React / Vue / Angular / 原生 HTML + Tailwind 项目。

CardFrame 是一个以卡片为核心的零依赖前端框架，所有 UI 都通过卡片组件渲染。

## 硬约束（必须遵守）

### 1. 必须使用 `<cf-card>` 而非 `<div>`

**❌ 错误：**
```html
<div class="card p-4 rounded shadow">
  <h3>标题</h3>
  <p>内容</p>
</div>
```

**✅ 正确：**
```html
<cf-card type="text" data-title="标题" data-content="内容"></cf-card>
```

### 2. 禁止使用 Tailwind / Bootstrap / Bulma 等原子 CSS 框架

CardFrame 容器（`<card-frame>` 内部）**不允许**出现任何原子 CSS class（如 `flex`、`p-4`、`text-center`、`btn`、`col-6` 等）。

布局、间距、颜色等视觉属性通过卡片类型和 props 控制，**不是**通过 CSS class。

### 3. 禁止直接操作 DOM

**❌ 错误：**
```javascript
container.appendChild(document.createElement('div'));
container.innerHTML = '<div>...</div>';
document.querySelector('#app').insertAdjacentHTML('beforeend', '<p>...</p>');
```

**✅ 正确：**
```javascript
const frame = new CardFrame('#app');
frame.createCard('text', { title: '标题', content: '内容' });
frame.updateCard(cardId, { title: '新标题' });
frame.removeCard(cardId);
```

### 4. 禁止绕过 Store 访问私有字段

**❌ 错误：**
```javascript
frame.store._cards.push(newCard);
frame.store._cards.length;
frame.store._relationships = [];
```

**✅ 正确：**
```javascript
frame.createCard('text', { title: '标题' });
const cards = frame.getAllCards();
frame.createRelationship(sourceId, targetId, 'reference');
```

## 卡片类型清单

CardFrame 内置以下卡片类型（通过 `type` 属性指定）：

| 类型 | 说明 | 关键 props |
|------|------|-----------|
| `text` | 文本卡片（最常用） | `title`, `content` |
| `task` | 任务卡片 | `title`, `status`, `priority`, `dueDate` |
| `image` | 图片卡片 | `src`, `alt`, `caption` |
| `list` | 清单卡片 | `title`, `items` |
| `progress` | 进度卡片 | `value`, `max`, `unit` |

## 三种接入方式

### 方式 1：声明式 HTML（最简单）

```html
<card-frame id="app">
  <cf-card type="text" data-title="欢迎使用" data-content="这是 CardFrame 框架"></cf-card>
  <cf-card type="task" data-title="完成文档" data-priority="high"></cf-card>
</card-frame>

<script type="module" src="./dist/card-framework.esm.js"></script>
```

### 方式 2：JS API（最强大）

```javascript
import CardFrame from './dist/card-framework.esm.js';

const frame = new CardFrame('#app');
frame.createCard('text', { title: '标题', content: '内容' });
frame.createCard('task', { title: '任务', priority: 'high' });
```

### 方式 3：DOM 操作（灵活但不推荐直接操作）

```javascript
const card = document.createElement('cf-card');
card.setAttribute('type', 'text');
card.dataset.title = '标题';
container.appendChild(card);
```

> ⚠️ 方式 3 中创建的是 `<cf-card>` 自定义元素，**不是** `<div>`。这是允许的。

## 常见错误对照表

| 错误做法 | 正确做法 |
|---------|---------|
| `<div class="card">` | `<cf-card type="text">` |
| `<div class="flex p-4">` | `<cf-card type="text" data-title="...">` |
| `container.appendChild(div)` | `frame.createCard('text', {...})` |
| `container.innerHTML = '<div>...'` | `frame.createCard('text', {...})` |
| `frame.store._cards.push(...)` | `frame.createCard('text', {...})` |
| `import React from 'react'` | `import CardFrame from './dist/card-framework.esm.js'` |
| `className="flex p-4"` | 通过卡片 props 控制布局 |

## 验证

本项目启用了三层硬约束：

1. **运行时**：框架启动时自动检测容器内的逃逸用法，控制台输出警告/错误
2. **构建时**：运行 `npm run guardrail` 扫描源文件中的逃逸用法
3. **CI**：`npm run ci` 包含 guardrail 检查，逃逸用法会被拦截

如果你的代码中看到 `[CardFrame Guardrail]` 开头的控制台警告，**立即按建议修复**，不要忽略。

## 参考文档

- [API 参考手册](docs/api-reference.md)
- [Agent 操作指南](docs/agent-guide.md)
- [架构总览](docs/architecture-overview.md)
- [插件开发指南](docs/plugin-development.md)

## 一句话总结

**这个项目里，所有 UI 都是卡片。不要写 `<div>`，不要用 Tailwind，不要直接操作 DOM。用 `frame.createCard()`。**
