# CardFrame 快速开始指南

## 目录

- [CardFrame 简介](#cardframe-简介)
- [特性列表](#特性列表)
- [快速开始（5分钟上手）](#快速开始5分钟上手)
  - [引入文件](#引入文件)
  - [创建第一个卡片](#创建第一个卡片)
  - [使用声明式 HTML](#使用声明式-html)
  - [使用 JS API](#使用-js-api)
- [核心概念介绍](#核心概念介绍)
  - [卡片（Card）](#卡片card)
  - [类型（Type）](#类型type)
  - [关系（Relationship）](#关系relationship)
  - [布局（Layout）](#布局layout)
- [下一步指引](#下一步指引)

---

## CardFrame 简介

CardFrame 是一个以卡片为核心的通用前端框架，提供了一套完整的卡片管理、渲染、布局和扩展机制。它不仅支持传统的 JS API 调用，还提供了声明式 HTML 语法，特别适合 AI Agent 进行自动化操作。

CardFrame 的设计理念是**简单、灵活、可扩展**，让开发者可以快速构建各种基于卡片的应用，如看板、任务管理、知识图谱、思维导图等。

---

## 特性列表

### 🎯 核心功能

- **多种卡片类型**：内置 `text` / `task` / `image` / `list` / `progress` / `link` / `note` / `code`（另有 abstract `base`），可用 `registerType` 扩展
- **类型继承体系**：支持类型继承，可基于现有类型扩展新类型
- **声明式 HTML**：使用 `<cf-card>` 标签直接在 HTML 中定义卡片
- **完整 JS API**：提供 CRUD、批量操作、事件监听等完整 API

### 🎨 视觉与交互

- **双布局模式**：流式布局（stream）和画布模式（canvas）
- **主题系统**：内置亮色/暗色主题，支持跟随系统
- **国际化**：内置中英文支持，可扩展多语言
- **关系可视化**：SVG 连线展示卡片间关系

### 🔌 扩展能力

- **插件系统**：完整的插件生命周期管理，支持注册类型、动作、钩子
- **虚拟滚动**：大数据量下的高性能渲染
- **熔断机制**：三级熔断保护，防止错误扩散

### 🛡️ 安全与稳定

- **安全防护**：XSS 防护、URL 安全检查、样式安全清理
- **实时验证**：MutationObserver 监听 DOM 变化，定时全量检查
- **自动修复**：属性缺失自动填充、DOM/Store 自动同步、关系自动修复
- **反馈系统**：分级日志输出，提供修复建议

### 🤖 AI 友好

- **自动归位**：卡片被误移出容器时自动归位
- **偏移防护体系**：预防-检测-修复-反馈四层防护
- **三种接入方式**：声明式 HTML、DOM 操作、JS API

---

## 快速开始（5分钟上手）

### 引入文件

在 HTML 文件中引入 CardFrame 的 CSS 和 JS 文件：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CardFrame 示例</title>
  <link rel="stylesheet" href="dist/card-framework.css">
</head>
<body>
  <div id="cardContainer"></div>
  <script src="dist/card-framework.js"></script>
</body>
</html>
```

### 创建第一个卡片

使用 `CardFrame.from()` 或 `new CardFrame()` 初始化：

```html
<div id="cardContainer"></div>

<script>
  const frame = CardFrame.from('#cardContainer');

  const card = frame.createCard('text', {
    title: '我的第一张卡片',
    content: 'Hello, CardFrame!'
  });

  // 增量更新 + 撤销
  frame.updateCard(card.id, { content: '已更新' });
  frame.undo();

  console.log('创建的卡片:', card);
</script>
```

### 使用声明式 HTML

CardFrame 支持使用 `<cf-card>` 自定义元素直接在 HTML 中声明卡片，无需编写 JavaScript：

```html
<div id="cardContainer">
  <!-- 文本卡 -->
  <cf-card type="text" title="欢迎使用 CardFrame">
    <p>这是一张使用声明式 HTML 创建的文本卡片。</p>
    <p>你可以直接在这里写 HTML 内容！</p>
  </cf-card>

  <!-- 任务卡 -->
  <cf-card type="task" title="完成项目报告" priority="high"></cf-card>

  <!-- 图片卡 -->
  <cf-card 
    type="image" 
    title="示例图片" 
    src="https://picsum.photos/400/200"
    alt="示例图片"
    caption="这是一张示例图片">
  </cf-card>

  <!-- 进度卡 -->
  <cf-card type="progress" title="学习进度" value="65" max="100" unit="%"></cf-card>
</div>

<script>
  // CardFrame 会自动解析容器内的 <cf-card> 元素
  const frame = CardFrame.from('#cardContainer');
</script>
```

**支持的卡片类型：**

| 类型 | 说明 | 主要属性 |
|------|------|----------|
| `text` | 文本卡 | `title`, `content` |
| `task` | 任务卡 | `title`, `priority`, `dueDate` |
| `image` | 图片卡 | `title`, `src`, `alt`, `caption` |
| `list` | 列表卡 | `title`, `items` |
| `progress` | 进度卡 | `title`, `value`, `max`, `unit` |
| `link` | 链接卡 | `title`, `url`, `description` |
| `note` | 笔记卡 | `title`, `content`, `color` |
| `code` | 代码卡 | `title`, `language`, `code` |

### 使用 JS API

通过 JavaScript API 可以进行更灵活的卡片操作：

```javascript
const frame = CardFrame.from('#cardContainer');

// 创建卡片
const taskCard = frame.createCard('task', {
  title: '学习 CardFrame',
  priority: 'high',
  dueDate: '2026-07-15'
});

// 读取卡片
const card = frame.getCard(taskCard.id);
console.log('卡片标题:', card.props.title);

// 更新卡片（完整对象或增量）
frame.updateCard(taskCard.id, { title: '深入学习 CardFrame' });

// 获取所有卡片
const allCards = frame.getAllCards();
console.log('共有', allCards.length, '张卡片');

// 按类型筛选
const taskCards = frame.getCardsByType('task');

// 删除卡片
frame.removeCard(taskCard.id);

// 批量创建
const result = frame.batchCreateCards([
  { type: 'text', props: { title: '批量卡片 1' } },
  { type: 'text', props: { title: '批量卡片 2' } },
  { type: 'text', props: { title: '批量卡片 3' } }
]);
console.log('成功:', result.success.length, '失败:', result.errors.length);
```

---

## 核心概念介绍

### 卡片（Card）

卡片是 CardFrame 的基本单位，每张卡片都有以下结构：

```javascript
{
  id: 'card_xxx_xxx',        // 唯一标识符
  type: 'text',               // 卡片类型
  props: {                    // 卡片属性（根据类型不同而不同）
    title: '卡片标题',
    content: '卡片内容'
  },
  position: { x: 0, y: 0 },   // 位置（画布模式下使用）
  status: 'active',           // 状态：active / completed
  style: {},                  // 自定义样式
  createdAt: 1234567890,      // 创建时间戳
  updatedAt: 1234567890       // 更新时间戳
}
```

### 类型（Type）

卡片类型定义了卡片的结构、属性和渲染方式。CardFrame 支持类型继承，可以基于现有类型扩展新类型。

**内置类型继承关系：**
```
base（抽象基础类型）
├── text（文本卡）
├── task（任务卡）
├── image（图片卡）
├── list（列表卡）
└── progress（进度卡）
```

**类型定义示例：**
```javascript
{
  type: 'custom-card',
  label: '自定义卡片',
  icon: '🎨',
  extends: 'base',
  propsSchema: [
    { name: 'title', type: 'string', required: true, label: '标题' },
    { name: 'description', type: 'string', required: false, label: '描述' }
  ],
  renderTemplate: `
    <div class="card card-custom">
      <div class="card-header">
        <span class="card-icon">{{icon}}</span>
        <h3 class="card-title">{{title}}</h3>
      </div>
      <div class="card-body">
        <p>{{description}}</p>
      </div>
    </div>
  `
}
```

### 关系（Relationship）

卡片之间可以建立关系，关系在画布模式下会以 SVG 连线的形式可视化展示。

**关系类型：**

| 类型 | 颜色 | 线条样式 | 说明 |
|------|------|----------|------|
| `reference` | 蓝色 | 实线 | 引用关系 |
| `parent` | 绿色 | 实线 | 父级关系 |
| `child` | 橙色 | 虚线 | 子级关系 |
| `dependency` | 红色 | 点线 | 依赖关系 |
| `related` | 紫色 | 点划线 | 相关关系 |

**创建关系：**
```javascript
// 创建两个卡片
const card1 = frame.createCard('text', { title: '卡片 A' });
const card2 = frame.createCard('text', { title: '卡片 B' });

// 创建关系
const rel = frame.createRelationship(
  card1.id,    // 源卡片 ID
  card2.id,    // 目标卡片 ID
  'reference', // 关系类型
  { label: '引用' } // 额外数据
);

// 启用关系可视化
frame.relationshipEngine.enable();
```

### 布局（Layout）

CardFrame 支持两种布局模式：

**1. 流式布局（stream）**

卡片像瀑布流一样排列，适合列表展示场景。

```javascript
frame.setLayoutMode('stream');
```

**2. 画布模式（canvas）**

卡片可以自由拖拽定位，支持缩放和平移，适合思维导图、知识图谱等场景。

```javascript
frame.setLayoutMode('canvas');

// 重置视图
frame.layoutEngine.resetView();

// 设置缩放
frame.layoutEngine.setZoom(1.5);
```

---

## 下一步指引

恭喜你完成了 CardFrame 的快速入门！接下来你可以：

1. **深入学习 API**：阅读 [API 参考](./api-reference.md) 了解所有可用的方法和属性
2. **开发插件**：阅读 [插件开发指南](./plugin-development.md) 学习如何扩展 CardFrame
3. **AI Agent 接入**：阅读 [智能体接入指南](./agent-guide.md) 了解如何让 AI Agent 使用 CardFrame
4. **查看示例**：浏览 `examples/` 目录下的示例代码
5. **自定义主题**：学习如何注册和应用自定义主题

---

**下一篇：[API 参考 →](./api-reference.md)**
