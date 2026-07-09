# CardFrame 通用卡片前端框架

> 以卡片为核心数据单元和 UI 载体的框架无关、Agent 友好的前端框架

[![Test Status](https://img.shields.io/badge/tests-231-brightgreen.svg)](https://github.com/your-org/card-framework/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.x-green.svg)](package.json)
[![npm](https://img.shields.io/badge/npm-%3E%3D8.x-red.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-supported-blue.svg)](dist/card-framework.d.ts)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)
[![Documentation](https://img.shields.io/badge/docs-ready-blue.svg)](docs/)
[![Code Size](https://img.shields.io/badge/size-~50KB-green.svg)](dist/)
[![Platform](https://img.shields.io/badge/platform-web-lightgrey.svg)]()
[![RTL](https://img.shields.io/badge/rtl-supported-purple.svg)]()

---

## 特性

### 核心引擎
- **声明式 HTML**：通过简洁的 HTML 标签创建卡片，无需编写 JavaScript
- **5 种卡片类型**：支持文本、图片、链接、清单、自定义等多种卡片类型
- **类型继承**：卡片类型支持继承机制，便于扩展和复用
- **事件总线**：完善的事件系统，支持卡片生命周期和自定义事件
- **画布模式**：自由拖拽、缩放的画布布局模式
- **流式布局**：响应式流式布局，自动适配不同屏幕尺寸

### 插件系统
- **插件化架构**：核心功能与业务逻辑分离，按需加载
- **插件生命周期管理**：安装、卸载、启用、禁用完整生命周期
- **依赖管理**：插件间依赖自动解析，确保加载顺序正确

### 主题与国际化
- **主题系统**：支持亮色/暗色主题切换，自定义主题扩展
- **主题切换动画**：平滑的 0.3s 过渡动画，可自定义动画时长
- **国际化（i18n）**：多语言支持，轻松扩展新语言
- **RTL 支持**：阿拉伯语、希伯来语等 RTL 语言原生支持
- **动态切换**：运行时动态切换主题和语言，无需刷新页面

### 关系与数据
- **关系引擎**：卡片间关系建模，支持一对多、多对多关联
- **批量操作**：批量创建、更新、删除卡片，提升操作效率
- **导入导出**：JSON 格式数据导入导出，便于数据迁移和备份
- **Undo/Redo 时光机**：内置操作历史记录，支持撤销/重做/历史回滚

### TypeScript 与开发体验
- **完整类型定义**：`dist/card-framework.d.ts` 提供核心模型、事件、API 的完整类型
- **事件类型推断**：`CardFrameEventMap` 让事件监听拥有智能提示
- **模块接口定义**：Store、Renderer、LayoutEngine 等模块接口一目了然

### 安全与稳定
- **XSS 防护**：多层级 XSS 防护机制，HTML/属性/URL 全面净化
- **CSP 兼容**：完全兼容内容安全策略（Content Security Policy）
- **Security 模块**：独立的安全模块，提供统一的安全 API
- **熔断机制**：自动检测异常操作，防止级联故障
- **错误边界**：组件级错误捕获，避免整体崩溃
- **偏移防护体系**：多层级 DOM 偏移防护，确保渲染稳定性

### 性能优化
- **增量渲染**：仅更新变更部分，大幅提升渲染效率
- **虚拟滚动**：大数据量下的流畅滚动体验
- **性能监控**：内置性能指标采集，便于性能分析优化

### Agent 友好
- **检测层**：自动检测卡片状态、数据异常、布局问题
- **修复层**：针对常见问题提供自动修复能力
- **可观测性**：完善的调试信息和状态暴露

---

## 快速开始

### 安装

```html
<!-- 直接引入 -->
<link rel="stylesheet" href="dist/card-framework.css">
<script src="dist/card-framework.js"></script>
```

```bash
# npm 安装
npm install card-framework
```

### 使用示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>CardFrame 示例</title>
  <link rel="stylesheet" href="src/card-framework.css">
</head>
<body>
  <div id="app"></div>

  <script src="src/card-framework.js"></script>
  <script>
    // 初始化框架
    const framework = new CardFramework('#app', {
      layout: 'flow',
      theme: 'light'
    });

    // 创建卡片
    const card = framework.createCard({
      type: 'text',
      title: '欢迎使用 CardFrame',
      content: '这是一个通用卡片前端框架的示例。',
      tags: ['示例', '入门']
    });

    // 监听事件
    framework.on('cardClicked', (card) => {
      console.log('卡片被点击:', card.title);
    });

    // 渲染
    framework.render();
  </script>
</body>
</html>
```

### TypeScript 使用示例

```typescript
import CardFrame from 'card-framework';

const frame = new CardFrame('#app', {
  layout: 'flow',
  theme: 'light'
});

// 创建卡片
const card = frame.createCard('text', {
  title: 'TypeScript 示例',
  content: '享受完整的类型提示和自动补全'
});

// 类型安全的事件监听
frame.on('cardAdded', (e) => {
  console.log(e.detail.card.id);
});
```

### Undo/Redo 示例

```javascript
const frame = new CardFrame('#app');

// 创建卡片
frame.createCard('task', { title: '待办任务', priority: 'high' });

// 误操作？一键撤销
frame.undo();

// 撤销错了？一键重做
frame.redo();

// 查询状态
console.log('可撤销:', frame.canUndo());
console.log('可重做:', frame.canRedo());
```

### 国际化示例

```javascript
const frame = new CardFrame('#app');

// 切换到英文
frame.i18nManager.setLocale('en-US');

// 注册新语言
frame.i18nManager.registerLocale('ja-JP', {
  label: '日本語',
  messages: { 'card.title': 'タイトル' }
});

// 自动检测 RTL 布局
console.log('当前 RTL:', frame.i18nManager.isRTL());
```

更多示例请查看 [examples/](examples/) 目录。

---

## 文档导航

完整的文档位于 [docs/](docs/) 目录下：

| 文档 | 说明 |
|------|------|
| [快速开始指南](docs/getting-started.md) | 安装、基础使用、第一个卡片应用 |
| [API 参考手册](docs/api-reference.md) | 完整的 API 文档、方法、属性、事件 |
| [插件开发指南](docs/plugin-development.md) | 插件系统架构、开发规范、示例插件 |
| [Agent 操作指南](docs/agent-guide.md) | 检测层、修复层、自动化操作指南 |
| [安全指南](docs/security.md) | CSP 配置、XSS 防护、危险属性列表 |
| [FAQ 常见问题](docs/faq.md) | 25 个常见问题及解答 |
| [最佳实践指南](docs/best-practices.md) | 性能、安全、插件、AI、主题最佳实践 |
| [文档搜索](docs/search.html) | 全文搜索，快速找到需要的内容 |

---

## 插件生态

CardFrame 提供了丰富的插件生态，以下是官方示例插件：

### 1. 任务管理插件 ([task-manager](plugins/task-manager/))

任务卡片管理插件，支持：
- 任务卡片创建与管理
- 任务状态追踪（待办/进行中/已完成）
- 任务优先级和截止日期
- 任务清单和子任务

### 2. 知识库插件 ([knowledge-base](plugins/knowledge-base/))

知识卡片管理插件，支持：
- 知识卡片分类和标签
- 全文搜索和筛选
- 知识关联和引用
- 版本历史和变更追踪

### 3. 仪表盘插件 ([dashboard](plugins/dashboard/))

数据可视化仪表盘插件，支持：
- 统计卡片和数据展示
- 图表组件集成
- 数据指标监控
- 自定义仪表盘布局

> 更多插件开发请参考 [插件开发指南](docs/plugin-development.md)

---

## 测试状态

| 测试项 | 状态 | 数量 |
|--------|------|------|
| 单元测试 | ✅ 通过 | 231 个 |
| 核心引擎 | ✅ 通过 | - |
| 插件系统 | ✅ 通过 | - |
| 安全模块 | ✅ 通过 | - |

运行测试：

```bash
npm install
npm test
```

---

## 浏览器支持

| 浏览器 | 最低版本 | 支持状态 |
|--------|----------|----------|
| Chrome | 80+ | ✅ 完全支持 |
| Firefox | 75+ | ✅ 完全支持 |
| Safari | 13+ | ✅ 完全支持 |
| Edge | 80+ | ✅ 完全支持 |
| IE | - | ❌ 不支持 |

---

## 性能指标

以下性能数据基于 1000 张卡片的基准测试：

| 指标 | 数值 | 说明 |
|------|------|------|
| 首屏渲染 | &lt; 100ms | 虚拟滚动启用时 |
| 卡片创建 | &lt; 5ms/张 | 平均单张创建时间 |
| 批量渲染 | &lt; 50ms/100张 | 增量渲染优化 |
| 内存占用 | &lt; 50MB | 1000 张卡片稳定状态 |
| 滚动帧率 | 60 FPS | 虚拟滚动启用时 |

---

## 许可证

[MIT License](LICENSE)

---

## 相关资源

- [更新日志](CHANGELOG.md)
- [示例代码](examples/)
- [插件目录](plugins/)
- [测试用例](tests/)
