# CardFrame 通用卡片前端框架

> 以卡片为核心数据单元和 UI 载体的框架无关、Agent 友好的前端框架

[![Test Status](https://img.shields.io/badge/tests-201-brightgreen.svg)](https://github.com/your-org/card-framework/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-brightgreen.svg)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.x-green.svg)](package.json)
[![npm](https://img.shields.io/badge/npm-%3E%3D8.x-red.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-supported-blue.svg)](dist/card-framework.d.ts)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)
[![Documentation](https://img.shields.io/badge/docs-ready-blue.svg)](docs/)
[![Code Size](https://img.shields.io/badge/size-~200KB-green.svg)](dist/)
[![Platform](https://img.shields.io/badge/platform-web-lightgrey.svg)]()

---

## 特性

### 核心引擎
- **声明式 HTML**：通过简洁的 HTML 标签创建卡片，无需编写 JavaScript
- **21 种卡片类型**：支持文本、图片、链接、清单、自定义等多种卡片类型
- **类型继承**：卡片类型支持继承机制，便于扩展和复用
- **事件总线**：完善的事件系统，支持卡片生命周期和自定义事件
- **画布模式**：自由拖拽、缩放的画布布局模式
- **流式布局**：响应式流式布局，自动适配不同屏幕尺寸

### 插件系统
- **插件化架构**：核心功能与业务逻辑分离，按需加载
- **插件生命周期管理**：安装、卸载、启用、禁用完整生命周期
- **插件沙箱**：每个插件独立 `PluginSandbox` 实例，按权限裁剪 API 面，自动追踪并清理定时器/监听器/类型/主题
- **权限系统**：声明式权限（`store:read`、`store:write`、`events:emit`、`types:register` 等），运行时强制校验
- **依赖管理**：插件间依赖自动解析，确保加载顺序正确

### 主题与国际化
- **主题系统**：支持亮色/暗色主题切换，自定义主题扩展
- **主题切换动画**：平滑的 0.3s 过渡动画，可自定义动画时长
- **国际化（i18n）**：内置 8 种语言，轻松扩展新语言
- **RTL 支持**：自动检测 RTL 语言（阿拉伯语、希伯来语等），切换时自动设置 `dir` 属性
- **动态切换**：运行时动态切换主题和语言，无需刷新页面

### 关系与数据
- **关系引擎**：卡片间关系建模，支持一对多、多对多关联
- **批量操作**：批量创建、更新、删除卡片，提升操作效率
- **导入导出**：JSON 格式数据导入导出，便于数据迁移和备份
- **操作历史**：`ActionLogger` 记录所有写操作，支持 `undo` / `redo` / `rollback`

### TypeScript 与开发体验
- **完整类型定义**：`dist/card-framework.d.ts` 提供核心模型、事件、API 的完整类型
- **事件类型推断**：`CardFrameEventMap` 让事件监听拥有智能提示
- **模块接口定义**：Store、Renderer、LayoutEngine 等模块接口一目了然

### 安全与稳定
- **XSS 防护**：多层级 XSS 防护机制，HTML/属性/URL 全面净化
- **Security 模块**：独立的安全模块，提供统一的安全 API
- **CSP 兼容**：`CardFrame.Security.checkCSPCompatibility()` 检测内联样式/脚本与 CSP 策略的冲突
- **熔断机制**：单卡 + 全局双层熔断，half-open 单探针自动恢复
- **错误边界**：`Renderer.renderError` + `GlobalErrorHandler` 全局错误捕获
- **偏移防护体系**：预防层（Security/Sandbox/CircuitBreaker）+ 检测层（RealTimeValidator/GlobalErrorHandler）+ 修复层（AutoFixer）三层防护
- **硬约束系统**：`Guardrail` 运行时检测 4 类逃逸用法（非卡片元素 / 逃逸 CSS 框架 / 直接 DOM 操作 / 绕过 Store 私有字段），防止 Agent 退回原生 HTML/Tailwind 路径；附构建时检查脚本 `npm run guardrail`

### 自进化系统
- **指标采集**：`MetricsCollector` 周期性采集性能/交互/架构指标
- **规则引擎**：`RuleEngine` 内置 7 条规则（对象池扩展、缓存扩展、监听器泄漏等）
- **进化引擎**：`EvolutionEngine` 浏览器内直接调参 + 请求外部 Agent 进行代码级进化
- **性能面板**：`PerfPanel` 实时展示 DOM 节点数、渲染耗时、对象池命中率等指标

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
    const framework = new CardFrame('#app', {
      virtualScroll: false,
      autoValidate: true
    });

    // 创建卡片（参数：type, props）
    const card = framework.createCard('text', {
      title: '欢迎使用 CardFrame',
      content: '这是一个通用卡片前端框架的示例。',
      tags: ['示例', '入门']
    });

    // 监听事件
    framework.on(CardFrame.EVENT_TYPES.CARD_ADDED, (event) => {
      console.log('卡片已添加:', event.detail.card.props.title);
    });

    // 切换到画布模式
    framework.setLayoutMode('canvas');
  </script>
</body>
</html>
```

### TypeScript 使用示例

```typescript
// CardFrame 同时支持 ES Module 导入和 IIFE（window.CardFrame）
import { CardFrame } from 'card-framework';
import type { CardFrameOptions, CardData } from 'card-framework';

const frame = new CardFrame('#app', {
  virtualScroll: true,
  autoValidate: true
});

// 创建卡片（参数：type, props）
const card = frame.createCard('text', {
  title: 'TypeScript 示例',
  content: '享受完整的类型提示和自动补全'
});

// 类型安全的事件监听
frame.on(CardFrame.EVENT_TYPES.CARD_ADDED, (event) => {
  console.log('卡片已添加:', event.detail.card.id);
});
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
| [安全指南](docs/security.md) | XSS 防护、危险属性列表 |
| [FAQ 常见问题](docs/faq.md) | 常见问题及解答 |
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
| 单元测试 + 集成测试 | ✅ 通过（jsdom 真实 DOM） | **201 passing** |
| 核心引擎 | ✅ 通过 | - |
| 插件系统 | ✅ 通过 | - |
| 安全模块（净化/熔断） | ✅ 通过 | - |

> 测试运行于 jsdom 提供的真实 DOM 环境（非手写 mock）。最新架构审查与文档时效说明见 [docs/README.md](docs/README.md)；当前真实架构见 [docs/architecture-overview.md](docs/architecture-overview.md)。

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
| 首屏渲染 | < 100ms | 虚拟滚动启用时 |
| 卡片创建 | < 5ms/张 | 平均单张创建时间 |
| 批量渲染 | < 50ms/100张 | 增量渲染优化 |
| 内存占用 | < 50MB | 1000 张卡片稳定状态 |
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
