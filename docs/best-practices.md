# CardFrame 最佳实践指南

## 目录

- [性能优化最佳实践](#性能优化最佳实践)
- [安全最佳实践](#安全最佳实践)
- [插件开发最佳实践](#插件开发最佳实践)
- [AI 接入最佳实践](#ai-接入最佳实践)
- [主题定制最佳实践](#主题定制最佳实践)

---

## 性能优化最佳实践

### 1. 大数据量时务必启用虚拟滚动

当卡片数量超过 200 张时，强烈建议启用虚拟滚动。这是提升渲染性能最有效的手段：

```javascript
const frame = new CardFrame('#app', {
  virtualScroll: true,
  overscan: 5  // 根据卡片高度和视口大小调整
});
```

**效果对比：**

| 卡片数量 | 未启用虚拟滚动 | 启用虚拟滚动 |
|---------|--------------|------------|
| 100 张 | 60 FPS | 60 FPS |
| 500 张 | 35 FPS | 60 FPS |
| 1000 张 | 15 FPS | 60 FPS |

### 2. 优先使用批量操作 API

批量创建、更新、删除卡片比循环调用单张卡片 API 性能更好：

```javascript
// ❌ 不推荐：循环单张创建
for (const item of items) {
  frame.createCard('text', item);  // 每次都会触发渲染
}

// ✅ 推荐：批量创建
frame.batchCreateCards(
  items.map(item => ({ type: 'text', props: item }))
);  // 只触发一次批量渲染
```

### 3. 利用增量渲染减少 DOM 操作

框架默认启用增量渲染，但你需要避免不必要的全量更新：

```javascript
// ❌ 不推荐：频繁单独更新属性
frame.updateCard(card);
// 又修改了另一个属性
frame.updateCard(card);

// ✅ 推荐：一次性更新所有变更
card.props.title = '新标题';
card.props.content = '新内容';
card.tags = ['标签1', '标签2'];
frame.updateCard(card);  // 只更新一次
```

### 4. 合理设置防抖和节流

对于高频触发的事件（如搜索过滤、窗口调整），使用防抖和节流：

```javascript
const debouncedSearch = CardFrame.Utils.debounce((keyword) => {
  const results = frame.getAllCards().filter(c => 
    c.props.title.includes(keyword)
  );
  frame.renderCards(results);
}, 200);

input.addEventListener('input', (e) => debouncedSearch(e.target.value));
```

### 5. 监控性能指标

定期查看性能统计数据，及时发现性能瓶颈：

```javascript
// 获取性能统计
const stats = frame.getPerfStats();
console.log('平均渲染时间:', stats.avgRenderTime, 'ms');
console.log('总渲染次数:', stats.renderCount);

// 在开发环境中开启详细性能标记
Perf.mark('custom_start');
// ... 执行操作
Perf.mark('custom_end');
const duration = Perf.measure('custom', 'custom_start', 'custom_end');
```

### 6. 及时清理无用资源

在单页应用或动态切换视图时，注意清理事件监听和卡片数据：

```javascript
// 组件卸载时清理
function destroy() {
  // 移除所有事件监听
  frame.off('cardClicked', handleCardClick);
  
  // 清空当前所有卡片（如有需要）
  frame.getAllCards().forEach(card => {
    frame.removeCard(card.id);
  });
  
  // 清空历史记录释放内存
  frame.clearHistory();
}
```

---

## 安全最佳实践

### 1. 始终使用框架提供的属性类型

框架会根据属性类型自动进行安全处理，这是最可靠的安全策略：

```javascript
// ✅ 推荐：使用框架安全类型
propsSchema: [
  { name: 'description', type: 'html', label: '描述' },   // 自动 sanitizeHtml
  { name: 'avatar', type: 'url', label: '头像' },         // 自动 sanitizeUrl
  { name: 'style', type: 'style', label: '样式' }         // 自动 sanitizeStyle
]
```

### 2. 永远不要将用户输入直接插入 innerHTML

```javascript
// ❌ 绝对禁止
card.innerHTML = userInput;

// ✅ 正确做法：使用模板或安全类型
// 方式 1：模板自动转义
renderTemplate: `<div>{{userInput}}</div>`

// 方式 2：使用 html 类型并经过净化
frame.createCard('text', {
  title: CardFrame.Utils.sanitizeHtml(userInput)
});
```

### 3. 配置严格的 CSP 策略

生产环境推荐使用严格的 Content-Security-Policy：

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
```

如果业务场景允许，使用 nonce 替代 `unsafe-inline`：

```html
<meta http-equiv="Content-Security-Policy" 
      content="style-src 'self' 'nonce-abc123'">
<style nonce="abc123">
  /* CardFrame 动态样式 */
</style>
```

### 4. 谨慎使用插件跳过安全检查

仅在完全信任的插件中使用 `unsafeSkipTemplateCheck`：

```javascript
// ⚠️ 警告：此选项会跳过模板安全检查，仅在确认插件来源可信时使用
CardFrame.installPlugin({
  name: 'trusted-plugin',
  unsafeSkipTemplateCheck: true,  // 不推荐常规使用
  cardTypes: [...]
});
```

### 5. 定期运行安全合规检查

```javascript
// 检查 CSP 兼容性
const cspReport = CardFrame.Security.checkCSPCompatibility();
if (!cspReport.compatible) {
  console.warn('CSP 兼容性问题:', cspReport.issues);
}

// 手动触发全量安全验证
frame.realTimeValidator.fullCheck();
```

### 6. 监控安全相关事件

```javascript
frame.on('cardValidationError', (e) => {
  // 记录安全验证失败日志
  logSecurityEvent('validation_error', e.detail);
});

frame.on('circuitBreakerOpened', (e) => {
  // 熔断触发可能意味着异常操作或攻击尝试
  alertSecurityTeam(e.detail);
});
```

---

## 插件开发最佳实践

### 1. 遵循语义化版本规范

插件版本号应遵循 SemVer 规范，便于依赖管理：

```javascript
const myPlugin = {
  name: 'my-plugin',
  version: '1.2.3',  // 主版本.次版本.修订号
  // ...
};
```

### 2. 明确声明插件依赖

如果插件依赖其他插件，务必在 `dependencies` 中声明：

```javascript
const plugin = {
  name: 'advanced-chart',
  version: '1.0.0',
  dependencies: ['dashboard', 'data-connector'],  // 确保这些插件先安装
  
  install(frame) {
    // 安全地访问依赖插件提供的功能
    const dashboard = frame.getPlugin('dashboard');
    if (!dashboard) {
      throw new Error('advanced-chart 插件需要 dashboard 插件');
    }
    // ...
  }
};
```

### 3. 合理使用生命周期钩子

```javascript
const plugin = {
  name: 'my-plugin',
  
  install(frame) {
    // 注册类型、动作、事件监听
    // 返回插件实例（可选）
    return { data: [] };
  },
  
  enable(frame, instance) {
    // 插件被启用时执行（如恢复定时器、重新绑定事件）
  },
  
  disable(frame, instance) {
    // 插件被禁用时执行（如暂停定时器、解绑非必要事件）
    // 注意：不要在这里清理核心资源，留给 uninstall
  },
  
  uninstall(frame, instance) {
    // 彻底清理：注销类型、移除事件监听、释放内存
    frame.typeRegistry.unregister('my-custom-type');
    frame.off('cardClicked', instance._handler);
  }
};
```

### 4. 通过钩子扩展而非修改核心

使用钩子机制扩展功能，避免直接修改框架内部状态：

```javascript
const plugin = {
  name: 'analytics-plugin',
  
  hooks: {
    // 在卡片渲染后执行
    afterCardRender(card, element) {
      // 发送埋点数据，而不是修改 element 的样式
      analytics.track('card_render', { type: card.type });
    },
    
    // 在卡片更新前执行验证
    beforeCardUpdate(card, changes) {
      // 返回 false 可阻止更新
      if (changes.priority && !['low', 'medium', 'high'].includes(changes.priority)) {
        console.warn('无效的优先级');
        return false;
      }
    }
  }
};
```

### 5. 提供完善的配置选项

让插件使用者能够根据需求自定义行为：

```javascript
const plugin = {
  name: 'configurable-plugin',
  
  install(frame, config = {}) {
    const options = {
      autoSync: true,
      syncInterval: 5000,
      maxRetries: 3,
      ...config  // 用户配置覆盖默认配置
    };
    
    if (options.autoSync) {
      this._syncTimer = setInterval(() => this.sync(), options.syncInterval);
    }
    
    return { options };
  }
};

// 使用
frame.installPlugin(plugin, { syncInterval: 10000, maxRetries: 5 });
```

### 6. 编写插件文档和示例

每个插件都应包含：

- `README.md`：功能说明、安装方法、配置选项
- `examples/`：使用示例代码
- 版本变更记录：便于用户了解升级影响

---

## AI 接入最佳实践

### 1. 为 AI 选择最合适的接入方式

根据 AI Agent 的能力选择接入方式：

| 接入方式 | 适用场景 | AI 能力要求 |
|---------|---------|------------|
| 声明式 HTML | 简单内容生成、静态展示 | 基础 HTML 生成能力 |
| DOM 操作 | 需要与现有页面交互 | 理解 DOM 结构和标准 API |
| JS API | 复杂业务逻辑、批量操作 | 理解框架 API 和 JavaScript |

### 2. 利用偏移防护体系确保安全

框架的四层防护体系会自动处理大部分 AI 操作失误：

```javascript
const frame = new CardFrame('#app', {
  autoValidate: true,  // 默认启用，保持开启
  circuitBreaker: {
    cardFailureThreshold: 5,
    globalFailureThreshold: 20
  }
});

// 监听修复事件，了解 AI 操作中的问题
frame.on('cardAutoFixed', (e) => {
  console.log('自动修复:', e.detail.fixes);
  // 可将修复记录反馈给 AI，帮助其学习
});
```

### 3. 为 AI 提供操作反馈闭环

```javascript
frame.on('frameworkError', (e) => {
  const { type, message, suggestion } = e.detail;
  
  // 将错误信息格式化为 AI 可理解的反馈
  const aiFeedback = {
    status: 'error',
    operation: type,
    reason: message,
    suggestion: suggestion,
    timestamp: Date.now()
  };
  
  // 发送给 AI Agent
  aiAgent.reportFeedback(aiFeedback);
});
```

### 4. 使用批量操作减少 API 调用

AI Agent 生成多张卡片时，使用批量 API 更高效、更可靠：

```javascript
// AI 生成的一批任务卡片
const aiGeneratedTasks = [
  { type: 'task', props: { title: '任务 1', priority: 'high' } },
  { type: 'task', props: { title: '任务 2', priority: 'medium' } },
  // ...
];

// 一次性批量创建
const result = frame.batchCreateCards(aiGeneratedTasks);

// 向 AI 反馈操作结果
if (result.errors.length > 0) {
  aiAgent.reportErrors(result.errors);
}
```

### 5. 限制 AI 的操作范围

通过插件和权限控制，限制 AI 可执行的敏感操作：

```javascript
// 创建一个受限的 AI 代理接口
const aiInterface = {
  createCard: (type, props) => frame.createCard(type, props),
  updateCard: (id, changes) => {
    const card = frame.getCard(id);
    // 禁止 AI 修改某些敏感属性
    delete changes.id;
    delete changes.createdAt;
    return frame.updateCard({ ...card, ...changes });
  },
  // 不提供 deleteAll、uninstallPlugin 等危险操作
};

// 只将受限接口暴露给 AI
aiAgent.setCardInterface(aiInterface);
```

### 6. 保存和恢复 AI 工作区状态

```javascript
// 保存当前工作区
const workspace = frame.exportToJSON();
localStorage.setItem('ai_workspace', JSON.stringify(workspace));

// AI 会话结束后恢复
const saved = localStorage.getItem('ai_workspace');
if (saved) {
  frame.importFromJSON(JSON.parse(saved));
}
```

---

## 主题定制最佳实践

### 1. 基于 CSS 变量覆盖实现主题

CardFrame 使用 CSS 变量驱动主题系统，覆盖变量即可自定义主题：

```css
/* 自定义主题 - 深蓝风格 */
.my-theme {
  --cf-bg-primary: #0f172a;
  --cf-bg-secondary: #1e293b;
  --cf-bg-card: #334155;
  --cf-text-primary: #f1f5f9;
  --cf-text-secondary: #94a3b8;
  --cf-border-color: #475569;
  --cf-accent-color: #38bdf8;
  --cf-accent-hover: #0ea5e9;
  --cf-shadow-color: rgba(0, 0, 0, 0.3);
}
```

### 2. 注册自定义主题到框架

```javascript
// 注册主题
frame.themeManager.registerTheme('ocean', {
  name: 'ocean',
  label: '深海主题',
  cssClass: 'theme-ocean',
  variables: {
    '--cf-bg-primary': '#0c4a6e',
    '--cf-bg-secondary': '#075985',
    '--cf-accent-color': '#7dd3fc'
  }
});

// 应用主题
frame.themeManager.applyTheme('ocean');
```

### 3. 保持主题切换的动画一致性

```javascript
// 设置合理的动画时长（建议 0.2s ~ 0.5s）
frame.themeManager.setAnimationDuration(0.3);

// 确保自定义样式也参与过渡动画
.theme-ocean .card {
  transition: background-color 0.3s ease, 
              border-color 0.3s ease, 
              box-shadow 0.3s ease;
}
```

### 4. 适配暗色和亮色的通用做法

```css
/* 基础样式使用变量 */
.card {
  background: var(--cf-bg-card);
  color: var(--cf-text-primary);
  border: 1px solid var(--cf-border-color);
}

/* 暗色主题下的特殊处理 */
[data-theme="dark"] .card-image {
  opacity: 0.9;  /* 暗色模式下略微降低图片亮度 */
}

/* 亮色主题下的特殊处理 */
[data-theme="light"] .card {
  box-shadow: 0 2px 8px var(--cf-shadow-color);
}
```

### 5. 确保 RTL 布局兼容性

自定义主题时，避免使用固定方向的样式：

```css
/* ❌ 不推荐：固定左/右边距 */
.card-header {
  margin-left: 12px;
}

/* ✅ 推荐：使用逻辑属性 */
.card-header {
  margin-inline-start: 12px;  /* 自动适配 LTR/RTL */
}

/* ✅ 推荐：使用 Flexbox 自动处理方向 */
.card-actions {
  display: flex;
  justify-content: flex-end;  /* 在 RTL 下会自动翻转 */
}
```

### 6. 提供主题预览和切换 UI

```javascript
// 获取所有可用主题
const themes = frame.themeManager.getAllThemes();

// 生成主题切换器
themes.forEach(theme => {
  const btn = document.createElement('button');
  btn.textContent = theme.label;
  btn.addEventListener('click', () => {
    frame.themeManager.applyTheme(theme.name);
  });
  themeSwitcher.appendChild(btn);
});

// 监听主题变化同步 UI
frame.on('themeChanged', (e) => {
  updateThemeSelector(e.detail.theme);
});
```

---

## 总结

遵循以上最佳实践，可以帮助你：

- **性能**：保持应用流畅运行，即使在大数据量下也能维持高帧率
- **安全**：有效防范 XSS 等常见攻击，保护用户数据安全
- **扩展**：开发高质量、易维护的插件，丰富框架生态
- **AI**：让 AI Agent 安全、高效地与框架协作
- **主题**：打造一致、美观、无障碍的用户界面

如需了解更多细节，请参考：

- [API 参考手册](./api-reference.md)
- [插件开发指南](./plugin-development.md)
- [安全指南](./security.md)
- [Agent 操作指南](./agent-guide.md)
