# CardFrame 智能体接入指南

## 目录

- [为什么 CardFrame 对 AI Agent 友好](#为什么-cardframe-对-ai-agent-友好)
- [三种接入方式](#三种接入方式)
  - [1. 声明式 HTML 接入（最简单）](#1-声明式-html-接入最简单)
  - [2. DOM 操作接入（最灵活）](#2-dom-操作接入最灵活)
  - [3. JS API 接入（最强大）](#3-js-api-接入最强大)
- [偏移防护体系](#偏移防护体系)
  - [预防层](#预防层)
  - [检测层](#检测层)
  - [修复层](#修复层)
  - [反馈系统](#反馈系统)
- [AI Agent 最佳实践](#ai-agent-最佳实践)
- [常见问题与解决方案](#常见问题与解决方案)
- [调试技巧](#调试技巧)

---

## 为什么 CardFrame 对 AI Agent 友好

CardFrame 从设计之初就考虑了 AI Agent 的接入需求，提供了多种友好的接入方式和完善的防护机制：

### 🎯 为什么选择 CardFrame

1. **三种接入方式**：从最简单的声明式 HTML 到最强大的 JS API，Agent 可以根据能力选择合适的方式
2. **声明式语法**：`<cf-card>` 标签直观易懂，Agent 只需生成 HTML 即可创建卡片
3. **自动归位机制**：即使 Agent 操作失误导致卡片偏移，也能自动修复
4. **实时验证**：MutationObserver 实时监控 DOM 变化，及时发现问题
5. **自动修复**：属性缺失、类型错误、DOM/Store 不一致等问题自动修复
6. **熔断机制**：三级熔断保护，防止 Agent 的错误操作导致系统崩溃
7. **反馈系统**：分级日志输出，Agent 可以根据反馈调整操作

### 🤖 典型应用场景

- **AI 助手 UI**：AI 生成卡片式内容展示
- **自动化任务管理**：Agent 创建、更新、管理任务卡片
- **知识图谱构建**：Agent 构建卡片和关系网络
- **交互式工作流**：Agent 与用户通过卡片进行交互
- **数据可视化**：Agent 生成各种类型的卡片展示数据

---

## 三种接入方式

### 1. 声明式 HTML 接入（最简单）

这是最简单的接入方式，Agent 只需生成 `<cf-card>` 标签的 HTML 代码，CardFrame 会自动解析和渲染。

#### 基本用法

```html
<div id="cardContainer">
  <!-- AI Agent 只需生成这样的 HTML -->
  <cf-card type="text" title="AI 生成的卡片">
    <p>这是由 AI 生成的卡片内容</p>
  </cf-card>
</div>

<script>
  const frame = CardFrame.from('#cardContainer');
</script>
```

#### 支持的属性

**通用属性：**

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `type` | `string` | 卡片类型（必填） | `type="text"` |
| `title` | `string` | 卡片标题 | `title="我的卡片"` |
| `id` | `string` | 卡片 ID（可选） | `id="card-001"` |

**各类型专属属性：**

| 类型 | 属性 | 说明 |
|------|------|------|
| `text` | `content` | 文本内容（也可用 innerHTML） |
| `task` | `priority` | 优先级：`high` / `medium` / `low` |
| `task` | `due-date` | 截止日期 |
| `image` | `src` | 图片地址 |
| `image` | `alt` | 替代文本 |
| `image` | `caption` | 说明文字 |
| `progress` | `value` | 当前值 |
| `progress` | `max` | 最大值 |
| `progress` | `unit` | 单位 |
| `list` | `items` | 列表项 |

**data-* 自定义属性：**

```html
<cf-card type="text" title="自定义属性示例" data-custom="value" data-category="test">
  内容
</cf-card>
```

#### 自动归位机制

即使 Agent 误操作将卡片移出容器，CardFrame 也会自动将其归位：

```javascript
// 模拟 Agent 误操作
const card = document.querySelector('.card');
document.body.appendChild(card); // 移出容器

// CardFrame 的 AutoFixer 会自动检测并修复
// 卡片会被自动移回正确的容器
```

**自动归位的触发条件：**
- 卡片元素不在预期的父容器中
- 实时验证器检测到 DOM 结构变化
- 全量检查时发现位置异常

---

### 2. DOM 操作接入（最灵活）

Agent 可以通过操作 DOM 元素来创建和管理卡片，这种方式最灵活，适合需要动态操作的场景。

#### 创建卡片

```javascript
// 方式一：创建 <cf-card> 元素
const cardEl = document.createElement('cf-card');
cardEl.setAttribute('type', 'text');
cardEl.setAttribute('title', 'DOM 创建的卡片');
cardEl.innerHTML = '<p>通过 DOM 操作创建的卡片</p>';

document.getElementById('cardContainer').appendChild(cardEl);

// CardFrame 会自动检测并注册这张卡片
```

```javascript
// 方式二：直接创建 .card 元素（不推荐，建议使用 <cf-card>）
const cardEl = document.createElement('div');
cardEl.className = 'card card-text';
cardEl.dataset.cardId = 'custom-card-id';
cardEl.dataset.cardType = 'text';
cardEl.innerHTML = `
  <div class="card-header">
    <h3 class="card-title">标题</h3>
  </div>
  <div class="card-body">内容</div>
`;

document.getElementById('cardContainer').appendChild(cardEl);

// RealTimeValidator 会检测到并同步到 Store
```

#### 更新属性

```javascript
// 修改 cf-card 的属性
const cardEl = document.querySelector('cf-card');
cardEl.setAttribute('title', '新标题');
cardEl.setAttribute('priority', 'high');

// CardFrame 会自动同步更新
```

```javascript
// 直接修改 DOM 元素的 data 属性
const cardEl = document.querySelector('[data-card-id="xxx"]');
const titleEl = cardEl.querySelector('.card-title');
titleEl.textContent = '新标题';

// RealTimeValidator 会检测到变化
```

#### 删除卡片

```javascript
// 移除元素
const cardEl = document.querySelector('[data-card-id="xxx"]');
cardEl.remove();

// Store 会自动同步删除
```

#### 注意事项

> ⚠️ **重要提示**：使用 DOM 操作方式时需要注意以下几点

1. **始终在容器内操作**：确保卡片元素在 CardFrame 容器内
2. **使用 data-card-id 标识**：为卡片添加唯一的 data-card-id
3. **避免频繁操作**：频繁的 DOM 操作可能导致性能问题
4. **验证结果**：操作后检查控制台是否有警告或错误
5. **优先使用 <cf-card>**：自定义元素能获得更好的自动同步支持

---

### 3. JS API 接入（最强大）

通过 JavaScript API 接入是功能最强大、最可靠的方式，推荐有能力的 Agent 使用。

#### 获取实例

```javascript
// 方式一：从选择器创建
const frame = CardFrame.from('#cardContainer');

// 方式二：从 DOM 元素获取
const container = document.getElementById('cardContainer');
const frame = container.__cardFrame;

// 方式三：使用全局实例（如果有）
// frame 变量在全局作用域
```

#### CRUD 操作

**创建卡片：**

```javascript
// 创建文本卡
const textCard = frame.createCard('text', {
  title: 'AI 生成的文本卡',
  content: '这是通过 JS API 创建的卡片'
});

// 创建任务卡
const taskCard = frame.createCard('task', {
  title: '完成用户需求分析',
  priority: 'high',
  dueDate: '2026-07-15'
});

// 创建图片卡
const imageCard = frame.createCard('image', {
  title: '示例图片',
  src: 'https://picsum.photos/400/200',
  alt: '示例',
  caption: 'AI 生成的图片'
});

// 创建进度卡
const progressCard = frame.createCard('progress', {
  title: '任务完成进度',
  value: 65,
  max: 100,
  unit: '%'
});
```

**读取卡片：**

```javascript
// 获取单张卡片
const card = frame.getCard('card_id');

// 获取所有卡片
const allCards = frame.getAllCards();

// 按类型筛选
const taskCards = frame.getCardsByType('task');

// 获取卡片属性
console.log(card.props.title);
console.log(card.props.priority);
```

**更新卡片：**

```javascript
const card = frame.getCard('card_id');
if (card) {
  card.props.title = '更新后的标题';
  card.props.priority = 'low';
  frame.updateCard(card);
}
```

**删除卡片：**

```javascript
const success = frame.removeCard('card_id');
if (success) {
  console.log('卡片删除成功');
}
```

#### 批量操作

```javascript
// 批量创建
const result = frame.batchCreateCards([
  { type: 'text', props: { title: '卡片 1' } },
  { type: 'text', props: { title: '卡片 2' } },
  { type: 'task', props: { title: '任务 1', priority: 'high' } },
  // ... 更多卡片
]);

console.log(`成功: ${result.success.length}, 失败: ${result.errors.length}`);

// 批量更新
const updateResult = frame.batchUpdateCards([
  { id: 'card1', props: { title: '新标题 1' } },
  { id: 'card2', props: { title: '新标题 2' } },
]);

// 批量删除
const removeResult = frame.batchRemoveCards(['card1', 'card2', 'card3']);
```

#### 事件监听

Agent 可以监听事件来了解框架状态变化：

```javascript
// 监听卡片添加
frame.on(CardFrame.EVENT_TYPES.CARD_ADDED, (event) => {
  console.log('卡片已添加:', event.detail.card);
});

// 监听卡片更新
frame.on(CardFrame.EVENT_TYPES.CARD_UPDATED, (event) => {
  console.log('卡片已更新:', event.detail.card);
});

// 监听卡片删除
frame.on(CardFrame.EVENT_TYPES.CARD_REMOVED, (event) => {
  console.log('卡片已删除:', event.detail.cardId);
});

// 监听验证错误
frame.on(CardFrame.EVENT_TYPES.CARD_VALIDATION_ERROR, (event) => {
  console.log('验证错误:', event.detail.cardId, event.detail.errors);
});

// 监听自动修复
frame.on(CardFrame.EVENT_TYPES.CARD_AUTO_FIXED, (event) => {
  console.log('自动修复:', event.detail.cardId, event.detail.changes);
});

// 监听布局变化
frame.on(CardFrame.EVENT_TYPES.LAYOUT_CHANGED, (event) => {
  console.log('布局已更改为:', event.detail.mode);
});

// 监听熔断事件
frame.on(CardFrame.EVENT_TYPES.CIRCUIT_BREAKER_OPENED, (event) => {
  console.log('熔断触发:', event.detail.level);
});
```

#### 关系管理

```javascript
// 创建关系
const rel = frame.createRelationship(
  'sourceCardId',
  'targetCardId',
  'reference',  // 关系类型
  { label: '引用' }
);

// 获取关系
const relationships = frame.getAllRelationships();
const cardRels = frame.getRelationshipsByCard('cardId');

// 删除关系
frame.removeRelationship('relId');

// 启用关系可视化
frame.relationshipEngine.enable();
```

---

## 偏移防护体系

CardFrame 为 AI Agent 提供了完善的偏移防护体系，确保即使 Agent 操作失误，系统也能保持稳定。

### 预防层

在问题发生前进行预防，减少错误发生的概率。

| 机制 | 说明 |
|------|------|
| **类型验证** | 创建和更新卡片时验证类型和属性 |
| **安全过滤** | XSS 防护、URL 安全检查、样式清理 |
| **类型继承** | 基于已有类型扩展，减少出错可能 |
| **默认值** | 必填属性缺失时自动填充默认值 |
| **声明式语法** | `<cf-card>` 标签降低操作复杂度 |

```javascript
// 类型验证示例
frame.createCard('task', {
  title: '',           // 空标题，会触发自动填充默认值
  priority: 'invalid'  // 无效值，会自动回退到默认值
});

// 控制台输出：
// [CardFrame] ⚠️ 必填属性 "title" 缺失
// [CardFrame] 🔧 属性 "title" 缺失，已填充默认值：未命名卡片
// [CardFrame] ⚠️ 属性 "priority" 值 "invalid" 不在允许列表中
// [CardFrame] 🔧 属性 "priority" 值不在允许列表中，已自动设置为默认值：medium
```

### 检测层

实时监控系统状态，及时发现问题。

| 机制 | 说明 |
|------|------|
| **MutationObserver** | 监听 DOM 变化，实时验证 |
| **定时全量检查** | 每 30 秒执行一次完整检查 |
| **DOM/Store 同步检查** | 检查 DOM 和 Store 是否一致 |
| **关系完整性检查** | 检查关系引用的卡片是否存在 |
| **安全检查** | 检测危险元素和属性 |

```javascript
// 手动触发全量检查
const results = frame.fullCheck();
console.log('卡片错误:', results.cardErrors.length);
console.log('DOM/Store 不一致:', results.domStoreMismatch.length);
console.log('关系错误:', results.relationshipErrors.length);
console.log('安全问题:', results.securityIssues.length);
```

### 修复层

问题发生后自动修复，保证系统正常运行。

| 机制 | 说明 |
|------|------|
| **属性自动修复** | 缺失属性填充默认值，错误值回退 |
| **自动归位** | 卡片被移出容器时自动移回 |
| **DOM/Store 同步修复** | 双向同步，保持数据一致 |
| **关系修复** | 删除引用不存在卡片的关系 |
| **熔断机制** | 错误过多时进入安全模式 |

```javascript
// 自动修复示例
const results = frame.fixAll();
console.log('卡片修复:', results.cardFixed);
console.log('DOM 同步修复:', results.domSyncFixed);
console.log('关系修复:', results.relationshipFixed);
```

### 反馈系统

提供清晰的反馈，帮助 Agent 了解和修正问题。

| 级别 | 方法 | 说明 |
|------|------|------|
| `info` | `FeedbackSystem.info()` | 信息提示，包含建议 |
| `warn` | `FeedbackSystem.warn()` | 警告信息，包含修复方式 |
| `error` | `FeedbackSystem.error()` | 错误信息，包含恢复方式 |
| `fix` | `FeedbackSystem.fix()` | 修复信息，包含变更详情 |

```javascript
// 设置反馈级别
CardFrame.FeedbackSystem.setLevel('info'); // 全部输出
// CardFrame.FeedbackSystem.setLevel('warn');  // 仅警告和错误
// CardFrame.FeedbackSystem.setLevel('error'); // 仅错误
// CardFrame.FeedbackSystem.setLevel('silent'); // 静默

// 监听事件获取反馈
frame.on(CardFrame.EVENT_TYPES.CARD_VALIDATION_ERROR, (e) => {
  // Agent 可以根据错误信息调整操作
  console.log('验证错误，需要修正:', e.detail.errors);
});

frame.on(CardFrame.EVENT_TYPES.CARD_AUTO_FIXED, (e) => {
  // Agent 可以了解哪些问题被自动修复了
  console.log('已自动修复:', e.detail.changes);
});
```

---

## AI Agent 最佳实践

### ✅ 推荐做法

1. **优先使用声明式 HTML**
   - 简单直观，不易出错
   - 自动同步和验证
   - 适合生成静态内容

2. **复杂操作用 JS API**
   - 批量操作、关系管理等复杂功能
   - 更可靠的错误处理
   - 完整的事件反馈

3. **逐步操作，验证结果**
   ```javascript
   // 不要一次性大量操作
   const card = frame.createCard('text', { title: '测试' });
   
   // 验证创建结果
   if (card && card.id) {
     console.log('创建成功，继续操作...');
   } else {
     console.log('创建失败，检查错误');
   }
   ```

4. **监听事件，及时调整**
   ```javascript
   frame.on(CardFrame.EVENT_TYPES.CARD_VALIDATION_ERROR, (e) => {
     // 根据错误信息调整后续操作
     adjustStrategy(e.detail.errors);
   });
   ```

5. **使用默认值和容错**
   - 提供合理的默认值
   - 处理可能的异常情况
   - 不要假设操作一定成功

6. **控制操作频率**
   - 避免短时间内大量操作
   - 使用批量操作替代单次循环
   - 注意熔断机制的阈值

### ❌ 避免的做法

1. **不要直接操作内部 DOM**
   - 避免直接修改 `.card-body` 等内部元素
   - 优先使用属性更新
   - 直接操作可能导致同步问题

2. **不要绕过验证**
   - 不要尝试绕过安全检查
   - 不要使用危险的 HTML/URL
   - 验证错误表示需要修正

3. **不要忽略警告**
   - 警告意味着潜在问题
   - 及时修正可以避免更大错误
   - 利用反馈系统提供的建议

4. **不要过度依赖自动修复**
   - 自动修复是兜底机制
   - 尽量从源头避免错误
   - 记录并学习修复的问题

5. **不要在熔断时继续操作**
   - 触发熔断说明错误较多
   - 应该先分析原因
   - 等待恢复后再操作

---

## 常见问题与解决方案

### Q1: 为什么我创建的卡片没有显示？

**可能原因：**
- 卡片类型不存在
- 必填属性缺失且没有默认值
- 容器选择器错误

**解决方案：**
```javascript
// 1. 检查类型是否存在
const typeDef = frame.typeRegistry.get('my-type');
if (!typeDef) {
  console.log('类型不存在，使用内置类型');
}

// 2. 检查控制台输出
// 查看是否有警告或错误信息

// 3. 验证容器
console.log('容器:', frame.container);
console.log('卡片数量:', frame.getAllCards().length);
```

### Q2: 属性修改后没有生效？

**可能原因：**
- 属性名称拼写错误
- 属性类型不匹配
- 没有调用 updateCard

**解决方案：**
```javascript
// 1. 检查属性名称是否正确
const propSchema = frame.typeRegistry.getPropSchema('task', 'priority');
console.log('属性定义:', propSchema);

// 2. 确保调用了 updateCard
const card = frame.getCard(id);
card.props.title = '新标题';
frame.updateCard(card); // 必须调用！
```

### Q3: DOM 操作后 Store 没有同步？

**可能原因：**
- 操作的元素不在容器内
- 元素没有 data-card-id
- 验证器被暂停

**解决方案：**
```javascript
// 1. 确保元素在容器内
const container = document.getElementById('cardContainer');
const cardEl = container.querySelector('[data-card-id="xxx"]');

// 2. 手动触发同步
frame.realTimeValidator.syncFromDOM();

// 3. 或者直接用 JS API，更可靠
frame.updateCard(card);
```

### Q4: 触发了熔断怎么办？

**可能原因：**
- 短时间内错误操作过多
- 单张卡片连续出错

**解决方案：**
```javascript
// 1. 查看熔断状态
const stats = frame.circuitBreaker.getStats();
console.log('全局状态:', stats.globalState);
console.log('熔断的卡片:', stats.openCards);

// 2. 等待自动恢复（默认 30 秒）
// 或者手动重置
frame.circuitBreaker.reset(); // 全部重置
frame.circuitBreaker.reset('card_id'); // 重置单张卡片

// 3. 分析错误原因，避免再次触发
```

### Q5: 如何知道操作是否成功？

**解决方案：**
```javascript
// 1. 检查返回值
const card = frame.createCard('text', { title: 'test' });
if (card && card.id) {
  console.log('成功');
}

// 2. 监听事件
frame.on(CardFrame.EVENT_TYPES.CARD_ADDED, (e) => {
  console.log('卡片已添加:', e.detail.card.id);
});

frame.on(CardFrame.EVENT_TYPES.CARD_VALIDATION_ERROR, (e) => {
  console.log('有验证错误:', e.detail.errors);
});

// 3. 查看统计信息
const stats = frame.getStats();
console.log('卡片总数:', stats.cards.total);
```

### Q6: 如何调试和排查问题？

**解决方案：**

```javascript
// 1. 打开所有反馈
CardFrame.FeedbackSystem.setLevel('info');

// 2. 执行全量检查
const checkResult = frame.fullCheck();
console.log('检查结果:', checkResult);

// 3. 查看修复统计
const fixStats = frame.autoFixer.getStats();
console.log('修复统计:', fixStats);

// 4. 查看性能统计
const perfStats = frame.getPerfStats();
console.log('性能统计:', perfStats);

// 5. 获取所有卡片数据
console.log('所有卡片:', frame.getAllCards());
console.log('所有关系:', frame.getAllRelationships());
```

---

## 调试技巧

### 1. 控制台调试

**查看框架实例：**
```javascript
// 从容器获取
const frame = document.querySelector('.card-frame').__cardFrame;

// 查看所有卡片
console.table(frame.getAllCards().map(c => ({
  id: c.id,
  type: c.type,
  title: c.props.title
})));
```

**监听所有事件：**
```javascript
// 列出所有事件类型
console.log(CardFrame.EVENT_TYPES);

// 监听特定事件
Object.values(CardFrame.EVENT_TYPES).forEach(eventType => {
  frame.on(eventType, (e) => {
    console.log(`[${eventType}]`, e.detail);
  });
});
```

### 2. 性能调试

```javascript
// 查看性能统计
console.log('性能统计:', frame.getPerfStats());

// 重置统计
CardFrame.Perf.reset();

// 手动标记
CardFrame.Perf.mark('start');
// ... 执行操作
CardFrame.Perf.mark('end');
const duration = CardFrame.Perf.measure('operation', 'start', 'end');
console.log('耗时:', duration, 'ms');
```

### 3. 安全调试

```javascript
// 检查 CSP 兼容性
const cspResult = CardFrame.Security.checkCSPCompatibility();
console.log('CSP 兼容:', cspResult.compatible);
console.log('问题:', cspResult.issues);

// 测试 HTML 清理
const cleanHtml = CardFrame.Security.sanitizeHtml('<script>alert(1)</script><p>safe</p>');
console.log('清理后:', cleanHtml);

// 测试 URL 安全
console.log('安全 URL:', CardFrame.Security.isSafeUrl('https://example.com'));
console.log('危险 URL:', CardFrame.Security.isSafeUrl('javascript:alert(1)'));
```

### 4. 熔断调试

```javascript
// 查看熔断状态
const cbStats = frame.circuitBreaker.getStats();
console.log('全局状态:', cbStats.globalState);
console.log('安全模式:', cbStats.safeMode);
console.log('全局错误数:', cbStats.globalFailureCount);
console.log('熔断卡片:', cbStats.openCards);

// 手动测试
try {
  frame.circuitBreaker.execute(() => {
    throw new Error('测试错误');
  }, 'test-card');
} catch (e) {
  console.log('捕获到错误:', e.message);
}
```

### 5. 验证与修复调试

```javascript
// 手动验证卡片
const testCard = {
  id: 'test',
  type: 'task',
  props: { title: '', priority: 'invalid' }
};
const validation = frame.typeRegistry.validate(testCard);
console.log('验证结果:', validation);

// 手动修复
const fixResult = frame.autoFixer.fixCard(testCard, validation);
console.log('修复结果:', fixResult);

// 执行全量修复
const allFixResult = frame.fixAll();
console.log('全部修复结果:', allFixResult);
```

### 6. 数据导入导出调试

```javascript
// 导出当前数据
const data = frame.exportData();
console.log('导出数据:', data);

// 保存到本地
localStorage.setItem('cardframe-data', JSON.stringify(data));

// 从本地恢复
const savedData = localStorage.getItem('cardframe-data');
if (savedData) {
  frame.importData(JSON.parse(savedData), { mode: 'replace' });
}
```

---

### 快速参考

| 需求 | 推荐方式 | 复杂度 | 可靠性 |
|------|----------|--------|--------|
| 简单展示内容 | 声明式 HTML | ⭐ | ⭐⭐⭐⭐ |
| 动态 DOM 操作 | DOM 操作 | ⭐⭐ | ⭐⭐⭐ |
| 完整 CRUD 操作 | JS API | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 批量处理 | JS API 批量方法 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 响应变化 | 事件监听 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

**上一篇：[插件开发指南 ←](./plugin-development.md)**

**回到 [快速开始](./getting-started.md) | [API 参考](./api-reference.md)**
