# CardFrame v1.0.0 发布公告

**发布日期：** 2026-07-09  
**版本：** v1.0.0  
**代号：** 正式发布（Production Ready）

---

## 🎉 概述

CardFrame v1.0.0 是框架的首个正式稳定版本，标志着 CardFrame 从功能验证和迭代开发阶段进入生产就绪状态。自 v0.1.0 至今，我们完成了核心引擎、插件系统、主题国际化、关系引擎、安全模块、性能优化等大量功能的开发和验证。v1.0.0 在 v0.3.0 的基础上，进一步补全了 TypeScript 类型定义、Undo/Redo 时光机、FAQ 文档和最佳实践指南，使框架在类型安全、交互体验、文档完备性方面达到了生产级标准。

---

## ✨ 新特性

### 1. TypeScript 类型定义

**完整的类型支持，开发体验再升级**

- 提供 `dist/card-framework.d.ts` 完整类型定义文件
- 覆盖核心数据模型：Card、Relationship、Position、PropDefinition 等接口
- 事件类型映射 `CardFrameEventMap`，监听事件时享有完整类型推断
- API 接口定义：Store、Renderer、LayoutEngine、EventBus、TypeRegistry 等
- 验证结果、反馈消息、插件定义等辅助类型一应俱全
- `package.json` 已配置 `types` 字段，TypeScript 项目开箱即用

**使用示例：**

```typescript
import CardFrame from 'card-framework';

const frame = new CardFrame('#app', { layout: 'flow' });

// 类型推断和自动补全
frame.on('cardAdded', (e) => {
  console.log(e.detail.card.id);   // card 属性有完整类型
});
```

### 2. Undo/Redo 时光机机制

**操作可追溯，交互更安心**

- 内置 `ActionLogger` 自动记录所有 Store 变更操作
- `frame.undo()` 一键撤销，`frame.redo()` 一键重做
- `frame.canUndo()` / `frame.canRedo()` 实时查询操作可用状态
- 支持按时间戳回滚到任意历史状态
- 默认保存 100 条历史记录，可通过初始化选项自定义
- 新操作自动清空 redo 栈，完全符合用户操作预期

**使用示例：**

```javascript
const frame = new CardFrame('#app');

// 创建卡片
const card = frame.createCard('text', { title: '示例' });

// 撤销创建
frame.undo();

// 重做
frame.redo();

// 查看状态
console.log('可撤销:', frame.canUndo());
console.log('可重做:', frame.canRedo());
```

### 3. FAQ 常见问题文档

**25 个常见问题，快速解惑**

- 覆盖 6 大分类：入门、使用、排错、性能、安全、扩展
- 每个问题配有清晰解答和可运行的代码示例
- 与现有文档体系交叉引用，便于深入学习
- 适合新用户快速上手，也适合老用户查阅排错

### 4. 最佳实践指南

**来自开发团队的官方建议**

- **性能优化**：虚拟滚动启用时机、批量操作、增量渲染、防抖节流
- **安全实践**：CSP 配置、XSS 防护、输入处理、安全事件监控
- **插件开发**：版本规范、生命周期管理、钩子使用、配置设计
- **AI 接入**：接入方式选择、偏移防护体系、操作反馈闭环、权限控制
- **主题定制**：CSS 变量覆盖、RTL 兼容、动画一致性、主题切换 UI

---

## 🚀 性能对比

### 渲染性能基准测试

基于 1000 张卡片的测试环境：

| 指标 | v0.2.0 | v0.3.0 | v1.0.0 | 较 v0.3.0 提升 |
|------|--------|--------|--------|---------------|
| 首屏渲染（100 张） | 80ms | 45ms | 42ms | 7% |
| 卡片创建速度 | 8ms/张 | 5ms/张 | 4.5ms/张 | 10% |
| 批量渲染（100 张） | 80ms | 50ms | 48ms | 4% |
| 内存占用（1000 张） | 65MB | 48MB | 46MB | 4% |
| 滚动帧率（虚拟滚动） | 45 FPS | 60 FPS | 60 FPS | - |

### Undo/Redo 性能

| 操作 | 耗时 | 内存占用 |
|------|------|---------|
| 记录一次操作 | < 1ms | ~2KB |
| 执行 undo | < 2ms | - |
| 执行 redo | < 2ms | - |
| 100 条历史记录 | - | ~200KB |

---

## 🔒 安全说明

v1.0.0 继承了 v0.3.0 的所有安全能力，并在文档层面进行了强化：

### 内置安全机制

- **多层 XSS 防护**：HTML 净化、URL 检查、样式过滤、模板自动转义
- **CSP 完全兼容**：不使用 `eval()` 和 `new Function()`
- **独立 Security 模块**：统一的安全 API（`sanitizeHtml`、`sanitizeUrl`、`sanitizeStyle`）
- **熔断机制**：异常操作自动检测，防止级联故障

### v1.0.0 安全文档增强

- 最佳实践指南新增安全专题章节
- FAQ 中新增安全常见问题（XSS 防范、CSP 配置、用户输入处理）
- 提供生产环境推荐的严格 CSP 配置模板

---

## 🌐 浏览器支持

| 浏览器 | 最低版本 | 支持状态 |
|--------|----------|----------|
| Chrome | 80+ | ✅ 完全支持 |
| Firefox | 75+ | ✅ 完全支持 |
| Safari | 13+ | ✅ 完全支持 |
| Edge | 80+ | ✅ 完全支持 |
| IE | - | ❌ 不支持 |

TypeScript 类型定义支持 TypeScript 4.5+。

---

## 📦 安装指南

### 直接引入（推荐）

```html
<link rel="stylesheet" href="dist/card-framework.css">
<script src="dist/card-framework.js"></script>
```

### npm 安装

```bash
npm install card-framework
```

### TypeScript 项目

```typescript
import CardFrame from 'card-framework';

const frame = new CardFrame('#app', {
  layout: 'flow',
  theme: 'light'
});
```

### 模块化按需加载

```html
<script src="dist/loader.js"></script>
<script>
  CardFrame.load('core')
    .then(() => CardFrame.load('render'))
    .then(() => CardFrame.load('extras'))
    .then(() => {
      const framework = new CardFrame('#app');
      framework.render();
    });
</script>
```

---

## 🔄 升级指南

### 从 v0.3.0 升级

v1.0.0 完全向后兼容 v0.3.0，无需修改现有代码。

**推荐升级步骤：**

1. 备份现有 `dist/` 目录和代码
2. 替换为 v1.0.0 的构建产物
3. 运行 `npm test` 确保所有测试通过
4. （可选）在 TypeScript 项目中配置类型支持
5. （可选）为应用添加 Undo/Redo 交互按钮
6. （可选）查阅新的 FAQ 和最佳实践指南优化代码

**破坏性变更：** 无

### 从 v0.2.0 或更早版本升级

请先参考 [v0.3.0 发布说明](#) 完成升级到 v0.3.0，再按上述步骤升级到 v1.0.0。

---

## 📚 完整文档体系

| 文档 | 说明 | 适用人群 |
|------|------|---------|
| [快速开始指南](docs/getting-started.md) | 安装、基础使用、第一个卡片应用 | 新用户 |
| [API 参考手册](docs/api-reference.md) | 完整的 API 文档、方法、属性、事件 | 开发者 |
| [插件开发指南](docs/plugin-development.md) | 插件系统架构、开发规范、示例 | 插件开发者 |
| [Agent 操作指南](docs/agent-guide.md) | 检测层、修复层、自动化操作 | AI 开发者 |
| [安全指南](docs/security.md) | CSP 配置、XSS 防护、危险属性列表 | 安全工程师 |
| [FAQ 常见问题](docs/faq.md) | 25 个常见问题及解答 | 所有用户 |
| [最佳实践指南](docs/best-practices.md) | 性能、安全、插件、AI、主题最佳实践 | 所有用户 |
| [文档搜索](docs/search.html) | 全文搜索，快速定位内容 | 所有用户 |

---

## 🧩 插件生态

### 官方示例插件

- **任务管理插件** (task-manager)：任务卡片、状态追踪、优先级管理
- **知识库插件** (knowledge-base)：知识分类、全文搜索、版本历史
- **仪表盘插件** (dashboard)：统计卡片、数据可视化、指标监控
- **MindCanvas 思维导图** (mindcanvas)：思维导图卡片、节点连接、缩放平移

---

## 🧪 测试覆盖

- **单元测试：** 231 个 ✅ 全部通过
- **测试覆盖率：** > 85%
- **浏览器兼容性测试：** Chrome / Firefox / Safari / Edge
- **性能基准测试：** 自动化性能测试
- **E2E 测试：** 端到端功能测试
- **TypeScript 类型测试：** 类型定义完整性和准确性验证

运行测试：

```bash
npm install
npm test
```

---

## 📝 更新日志

完整的更新日志请查看 [CHANGELOG.md](CHANGELOG.md)。

---

## 🤝 贡献

我们欢迎各种形式的贡献！

- 🐛 提交 Bug 报告
- 💡 提出新功能建议
- 📖 改进文档
- 🔧 提交代码 PR

---

## 📄 许可证

CardFrame 基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

感谢所有为 CardFrame 做出贡献的开发者和用户！v1.0.0 的发布离不开社区的支持和反馈。

---

**享受 CardFrame v1.0.0 吧！** 🎉

— CardFrame 团队
