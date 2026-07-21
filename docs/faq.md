# CardFrame 常见问题解答（FAQ）

## 目录

- [入门](#入门)
- [使用](#使用)
- [排错](#排错)
- [性能](#性能)
- [安全](#安全)
- [扩展](#扩展)

---

## 入门

### Q1: CardFrame 是什么？适合什么场景？

CardFrame 是一个以卡片为核心数据单元和 UI 载体的框架无关、Agent 友好的前端框架。它适合构建看板、任务管理、知识图谱、思维导图、数据仪表盘等以卡片为主要展示形式的 Web 应用。

### Q2: 如何快速在项目中引入 CardFrame？

最直接的方式是通过 CDN 或本地文件引入：

```html
<link rel="stylesheet" href="dist/card-framework.css">
<script src="dist/card-framework.js"></script>
```

然后通过 `CardFrame.from('#container')` 即可快速初始化。详细步骤请参考[快速开始指南](./getting-started.md)。

### Q3: CardFrame 支持哪些浏览器？

支持 Chrome 80+、Firefox 75+、Safari 13+、Edge 80+。IE 浏览器不支持。框架使用了现代 CSS 变量和 ES6+ 特性，请确保目标浏览器版本符合要求。

### Q4: CardFrame 是否支持 TypeScript？

支持。框架提供了完整的 TypeScript 类型定义文件（`dist/card-framework.d.ts`），包含核心数据模型、事件类型、API 接口等定义。在 TypeScript 项目中使用时，类型推断和代码提示均可正常工作。

```typescript
import CardFrame from 'card-framework';
const frame = new CardFrame('#app', { layoutMode: 'stream' });
```

### Q5: 框架的体积有多大？会影响页面加载速度吗？

未压缩 ESM/IIFE 完整包约 **150KB** 量级（min 约 150KB，详见 `dist/`）；gzip 后更小。框架**零运行时依赖**，单文件 IIFE 即可使用。当前**没有**独立的 `loader.js` 分包加载器；体积优化方向是按需不启用虚拟滚动/进化等可选能力，而非运行时动态切模块。

---

## 使用

### Q6: 声明式 HTML 和 JS API 应该怎么选择？

- **声明式 HTML**（`<cf-card>` 标签）：适合静态内容、AI Agent 生成内容、无需复杂交互的场景。优点是直观、无需编写 JavaScript。
- **JS API**：适合需要动态增删改卡片、批量操作、复杂事件交互的场景。优点是功能完整、控制力强。

两者可以混用：先用声明式 HTML 初始化，再通过 JS API 进行动态操作。

### Q7: 如何切换主题？支持跟随系统主题吗？

```javascript
// 切换到暗色主题
frame.themeManager.applyTheme('dark');

// 切换回亮色主题
frame.themeManager.applyTheme('light');

// 设置主题切换动画时长（秒）
frame.themeManager.setAnimationDuration(0.5);
```

框架内置亮色和暗色主题，支持运行时动态切换，主题切换时有平滑的 CSS 过渡动画。你也可以注册自定义主题，通过 CSS 变量覆盖实现个性化样式。

### Q8: 如何实现 undo（撤销）和 redo（重做）功能？

CardFrame 内置了操作日志记录与时光机机制，默认启用，无需额外配置：

```javascript
// 撤销上一次操作
frame.undo();

// 重做上一次撤销的操作
frame.redo();

// 获取当前可撤销/重做的状态
console.log(frame.canUndo());  // boolean
console.log(frame.canRedo());  // boolean

// 清空历史记录
frame.clearHistory();
```

默认最大保存 100 条操作记录，可通过初始化选项自定义。

### Q9: 国际化（i18n）如何使用？支持哪些语言？

框架内置了中英文语言包，并支持轻松扩展其他语言：

```javascript
// 切换到英文
frame.i18nManager.setLocale('en-US');

// 注册新的语言包
frame.i18nManager.registerLocale('ja-JP', {
  label: '日本語',
  messages: {
    'card.title': 'タイトル',
    'card.content': '内容'
  }
});

// 获取当前是否 RTL 布局
frame.i18nManager.isRTL();
```

支持 RTL 语言（阿拉伯语、希伯来语、波斯语等），框架会自动调整布局方向、文本对齐和按钮顺序。

### Q10: 卡片间的关系（Relationship）有什么作用？

关系引擎用于建立卡片之间的关联，在画布模式下会以 SVG 连线可视化展示。支持的关系类型包括：引用（reference）、父级（parent）、子级（child）、依赖（dependency）、相关（related）。关系可用于构建知识图谱、任务依赖图、思维导图等场景。

```javascript
frame.createRelationship(cardA.id, cardB.id, 'dependency', { label: '依赖于' });
frame.relationshipEngine.enable(); // 启用可视化连线
```

### Q11: 如何在画布模式下实现拖拽和缩放？

画布模式支持以下交互：

```javascript
frame.setLayoutMode('canvas');

// 平移画布
frame.layoutEngine.pan(100, 50);

// 缩放
frame.layoutEngine.zoom(1.5);
frame.layoutEngine.resetView(); // 重置视图

// 获取当前缩放级别
console.log(frame.layoutEngine.getZoom());
```

用户也可以通过鼠标直接拖拽卡片、滚轮缩放画布。

---

## 排错

### Q12: 卡片渲染后显示异常或内容缺失怎么办？

1. **检查卡片类型是否已注册**：自定义类型需要通过 `frame.typeRegistry.register()` 注册，或确保对应插件已安装并启用。
2. **检查属性类型**：确保传入的属性值符合类型定义（如 `number` 类型的属性不能传入字符串）。
3. **查看控制台反馈信息**：框架的反馈系统会输出具体的错误原因和修复建议。
4. **运行全量检查**：`frame.realTimeValidator.fullCheck()` 可手动触发一次完整检查。

### Q13: 遇到 "熔断器已打开"（Circuit Breaker Opened）错误是什么意思？

这是框架的保护机制。当短时间内卡片错误次数超过阈值（默认单卡片 5 次，全局 20 次），熔断器会自动打开，暂停部分操作以防止级联故障。30 秒后自动进入半开状态尝试恢复。如果你确认是误判，可以：

```javascript
// 查看熔断器状态
frame.circuitBreaker.getState();

// 手动重置（不推荐常规使用）
frame.circuitBreaker.reset();
```

### Q14: 插件安装后没有生效，如何排查？

1. 检查插件依赖是否都已安装：`plugin.dependencies` 中列出的插件必须先安装。
2. 确认插件已启用：`autoEnable` 为 `false` 时需要手动调用 `frame.enablePlugin('plugin-name')`。
3. 查看控制台是否有安装失败的错误信息。
4. 检查插件名称是否重复：名称必须是全局唯一的。

### Q15: 虚拟滚动在什么情况下应该启用？

当页面卡片数量超过 200 张，或出现滚动卡顿、帧率下降时，建议启用虚拟滚动：

```javascript
const frame = new CardFrame('#app', {
  virtualScroll: true,
  overscan: 5  // 可视区域外额外渲染的行数
});
```

虚拟滚动会只渲染视口内的卡片，大幅降低 DOM 节点数量和内存占用，使 1000+ 卡片仍能保持 60 FPS 流畅滚动。

---

## 性能

### Q16: 如何优化大量卡片的渲染性能？

1. **启用虚拟滚动**：大数据量下的首选方案。
2. **使用批量操作**：`batchCreateCards()` 比循环调用 `createCard()` 性能更好。
3. **启用增量渲染**：框架默认启用，仅更新变更的 DOM 节点。
4. **减少不必要的重渲染**：避免频繁修改卡片属性，可先在内存中组装好数据再统一更新。
5. **使用性能监控**：通过 `Perf.getStats()` 查看渲染耗时，定位瓶颈。

### Q17: 内存占用过高怎么办？

1. **检查事件监听**：确保在销毁卡片或组件时移除事件监听，避免内存泄漏。
2. **启用虚拟滚动**：减少同时存在的 DOM 节点数量。
3. **清理无用关系**：过多的关系数据也会增加内存开销，定期清理无效关系。
4. **限制 undo 历史**：如果内存敏感，可减少 `maxHistory` 配置。

### Q18: 渲染帧率低、卡顿如何排查？

```javascript
// 查看性能统计
console.log(frame.getPerfStats());
```

重点关注以下指标：
- `avgRenderTime`：平均渲染时间，超过 16ms 可能导致掉帧
- `renderCount`：渲染次数是否异常频繁
- `totalRenderTime`：累计渲染耗时

常见优化手段：减少同时动画的卡片数量、避免在滚动时进行复杂计算、使用 `requestAnimationFrame` 调度自定义动画。

---

## 安全

### Q19: CardFrame 如何防范 XSS 攻击？

框架内置了多层 XSS 防护：

1. **HTML 净化**：`Security.sanitizeHtml()` 自动移除危险标签（`<script>`、`<iframe>` 等）和事件处理器。
2. **URL 安全检查**：`Security.sanitizeUrl()` 过滤 `javascript:`、`vbscript:` 等危险协议。
3. **样式安全过滤**：`Security.sanitizeStyle()` 移除 `expression()`、`-moz-binding` 等危险 CSS。
4. **模板自动转义**：`{{属性}}` 语法渲染时会自动进行 HTML 转义。

建议始终使用框架提供的属性类型（`type: 'html'`、`type: 'url'`），让框架自动处理安全防护。

### Q20: 如何配置内容安全策略（CSP）？

CardFrame 完全兼容 CSP，不使用 `eval()` 和 `new Function()`。推荐的 CSP 配置：

```http
Content-Security-Policy: default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
```

如果需要更高安全性，可使用 nonce 替代 `unsafe-inline`。详细配置请参考[安全指南](./security.md)。

### Q21: 用户输入的内容直接显示在卡片中安全吗？

安全，只要遵循框架规范：

- 使用 `type: 'html'` 的属性类型，框架会自动净化 HTML 内容
- 使用模板系统的 `{{属性}}` 语法，会自动转义特殊字符
- **不要**直接将用户输入插入到 `innerHTML` 中
- **不要**使用 `unsafeSkipTemplateCheck: true` 跳过安全检查

---

## 扩展

### Q22: 如何开发自定义卡片类型？

通过 `frame.typeRegistry.register()` 注册新类型：

```javascript
frame.typeRegistry.register({
  type: 'my-card',
  label: '我的卡片',
  icon: '🎨',
  extends: 'base',
  propsSchema: [
    { name: 'title', type: 'string', required: true },
    { name: 'color', type: 'color', required: false }
  ],
  renderTemplate: `
    <div class="card card-my">
      <h3>{{title}}</h3>
    </div>
  `
});
```

更复杂的场景建议开发成插件，参考[插件开发指南](./plugin-development.md)。

### Q23: AI Agent 如何与 CardFrame 交互？

CardFrame 对 AI Agent 非常友好，提供三种接入方式：

1. **声明式 HTML**：Agent 直接生成 `<cf-card>` 标签 HTML，最简单
2. **DOM 操作**：Agent 通过标准 DOM API 操作卡片元素
3. **JS API**：Agent 调用 `frame.createCard()`、`frame.updateCard()` 等方法，功能最完整

框架还提供了偏移防护体系（预防-检测-修复-反馈），即使 Agent 操作失误也能自动恢复。详细指南请参考[Agent 操作指南](./agent-guide.md)。

### Q24: 如何监听框架事件并进行自定义处理？

```javascript
// 监听卡片添加事件
frame.on('cardAdded', (e) => {
  console.log('新卡片:', e.detail.card);
});

// 监听主题切换
frame.on('themeChanged', (e) => {
  console.log('当前主题:', e.detail.theme);
});

// 监听所有错误
frame.on('frameworkError', (e) => {
  console.error('框架错误:', e.detail);
});
```

支持的事件类型包括：cardAdded、cardUpdated、cardRemoved、themeChanged、languageChanged、circuitBreakerOpened 等 20 余种。

### Q25: 可以将 CardFrame 与 React/Vue/Angular 集成吗？

可以。CardFrame 是框架无关的，不依赖任何前端框架。集成方式：

- **React**：在 `useEffect` 中初始化 CardFrame，通过 ref 访问容器 DOM
- **Vue**：在 `mounted` 生命周期初始化，通过 `this.$refs` 访问容器
- **Angular**：在 `ngAfterViewInit` 中初始化，使用 `@ViewChild` 获取容器

需要注意在组件卸载时调用清理逻辑，避免内存泄漏。
