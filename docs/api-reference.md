# CardFrame API 参考

## 目录

- [CardFrame 主类](#cardframe-主类)
  - [构造函数 options](#构造函数-options)
  - [实例方法 - 卡片 CRUD](#实例方法---卡片-crud)
  - [实例方法 - 批量操作](#实例方法---批量操作)
  - [实例方法 - 关系管理](#实例方法---关系管理)
  - [实例方法 - 数据导入导出](#实例方法---数据导入导出)
  - [实例方法 - 事件监听](#实例方法---事件监听)
  - [实例方法 - 布局与主题](#实例方法---布局与主题)
  - [实例方法 - 插件管理](#实例方法---插件管理)
  - [实例方法 - 验证与修复](#实例方法---验证与修复)
  - [实例方法 - 统计与性能](#实例方法---统计与性能)
  - [实例方法 - 操作历史与撤销/重做](#实例方法---操作历史与撤销重做)
  - [实例方法 - 自进化](#实例方法---自进化)
  - [实例方法 - 性能与错误](#实例方法---性能与错误)
  - [静态方法](#静态方法)
  - [静态属性](#静态属性)
- [Store 类](#store-类)
- [TypeRegistry 类](#typeregistry-类)
- [Renderer 类](#renderer-类)
- [LayoutEngine 类](#layoutengine-类)
- [EventBus 与事件类型常量](#eventbus-与事件类型常量)
- [AutoFixer 类](#autofixer-类)
- [RealTimeValidator 类](#realtimevalidator-类)
- [PluginManager 类](#pluginmanager-类)
- [PluginSandbox 类](#pluginsandbox-类)
- [ThemeManager 类](#thememanager-类)
- [I18nManager 类](#i18nmanager-类)
- [RelationshipEngine 类](#relationshipengine-类)
- [CircuitBreaker 类](#circuitbreaker-类)
- [Security 模块](#security-模块)
- [Perf 模块](#perf-模块)
- [FeedbackSystem 模块](#feedbacksystem-模块)
- [Utils 工具函数](#utils-工具函数)
- [VirtualScroller 类](#virtualscroller-类)
- [进化子系统](#进化子系统)
- [Guardrail 硬约束系统](#guardrail-硬约束系统)
- [声明式 HTML 属性参考](#声明式-html-属性参考)

---

## CardFrame 主类

CardFrame 是框架的核心类，提供卡片管理、渲染、布局、插件等所有核心功能。

### 构造函数 options

```javascript
const frame = new CardFrame(container, options);
// 或使用快捷方式
const frame = CardFrame.from('#container');
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `container` | `string \| HTMLElement` | 必填 | 容器元素或 CSS 选择器 |
| `options` | `object` | `{}` | 配置选项 |

**options 配置项：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `virtualScroll` | `boolean` | `false` | 是否启用虚拟滚动 |
| `overscan` | `number` | `5` | 虚拟滚动超扫描行数 |
| `autoValidate` | `boolean` | `true` | 是否自动启动实时验证 |
| `circuitBreaker` | `object` | `{}` | 熔断机制配置 |
| `plugins` | `array` | `[]` | 初始安装的插件列表 |
| `guardrail` | `false \| object` | `{}` | 硬约束配置。`false` 关闭；对象配置详见 [Guardrail](#guardrail-硬约束系统) |

**circuitBreaker 配置项：**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cardFailureThreshold` | `number` | `5` | 单卡片错误阈值 |
| `globalFailureThreshold` | `number` | `20` | 全局错误阈值 |
| `windowMs` | `number` | `60000` | 错误计数时间窗口（毫秒） |
| `resetTimeoutMs` | `number` | `30000` | 熔断重置超时（毫秒） |

### 实例方法 - 卡片 CRUD

#### createCard(type, props)

创建一张新卡片。

```javascript
const card = frame.createCard('text', {
  title: '卡片标题',
  content: '卡片内容'
});
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 卡片类型 |
| `props` | `object` | 卡片属性 |

**返回值：** `object` - 创建的卡片对象

---

#### updateCard(card)

更新卡片。

```javascript
const card = frame.getCard(cardId);
card.props.title = '新标题';
frame.updateCard(card);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `card` | `object` | 完整的卡片对象 |

**返回值：** `object|null` - 更新后的卡片对象，失败返回 null

---

#### removeCard(id)

删除卡片。

```javascript
const success = frame.removeCard(cardId);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 卡片 ID |

**返回值：** `boolean` - 是否删除成功

---

#### getCard(id)

获取指定 ID 的卡片。

```javascript
const card = frame.getCard(cardId);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 卡片 ID |

**返回值：** `object|undefined` - 卡片对象

---

#### getAllCards()

获取所有卡片。

```javascript
const cards = frame.getAllCards();
```

**返回值：** `array` - 卡片数组

---

#### getCardsByType(type)

按类型获取卡片。

```javascript
const taskCards = frame.getCardsByType('task');
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 卡片类型 |

**返回值：** `array` - 卡片数组

### 实例方法 - 批量操作

#### batchCreateCards(cards)

批量创建卡片。

```javascript
const result = frame.batchCreateCards([
  { type: 'text', props: { title: '卡片1' } },
  { type: 'task', props: { title: '任务1', priority: 'high' } }
]);
console.log('成功:', result.success.length);
console.log('失败:', result.errors.length);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `cards` | `array` | 卡片数据数组 |

**返回值：** `object` - 包含 `success` 和 `errors` 的结果对象

---

#### batchUpdateCards(updates)

批量更新卡片。

```javascript
const result = frame.batchUpdateCards([
  { id: 'card1', props: { title: '新标题1' } },
  { id: 'card2', props: { title: '新标题2' } }
]);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `updates` | `array` | 更新数据数组 |

**返回值：** `object` - 包含 `success` 和 `errors` 的结果对象

---

#### batchRemoveCards(ids)

批量删除卡片。

```javascript
const result = frame.batchRemoveCards(['card1', 'card2', 'card3']);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `ids` | `array` | 卡片 ID 数组 |

**返回值：** `object` - 包含 `success` 和 `errors` 的结果对象

### 实例方法 - 关系管理

#### createRelationship(sourceId, targetId, type, data)

创建卡片间的关系。

```javascript
const rel = frame.createRelationship(
  'sourceCardId',
  'targetCardId',
  'reference',
  { label: '引用' }
);
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sourceId` | `string` | 必填 | 源卡片 ID |
| `targetId` | `string` | 必填 | 目标卡片 ID |
| `type` | `string` | `'reference'` | 关系类型 |
| `data` | `object` | `{}` | 额外数据 |

**返回值：** `object` - 关系对象

---

#### removeRelationship(id)

删除关系。

```javascript
const success = frame.removeRelationship(relId);
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 关系 ID |

**返回值：** `boolean` - 是否删除成功

---

#### getRelationship(id)

获取指定 ID 的关系。

```javascript
const rel = frame.getRelationship(relId);
```

**返回值：** `object|undefined` - 关系对象

---

#### getAllRelationships()

获取所有关系。

```javascript
const rels = frame.getAllRelationships();
```

**返回值：** `array` - 关系数组

---

#### getRelationshipsByCard(cardId)

获取指定卡片的所有关系。

```javascript
const rels = frame.getRelationshipsByCard(cardId);
```

**返回值：** `array` - 关系数组

---

#### getRelationshipsByType(type)

按类型获取关系。

```javascript
const rels = frame.getRelationshipsByType('reference');
```

**返回值：** `array` - 关系数组

### 实例方法 - 数据导入导出

#### exportData()

导出数据为对象。

```javascript
const data = frame.exportData();
```

**返回值：** `object` - 导出的数据对象

```javascript
{
  version: '1.0',
  exportedAt: 1234567890,
  cards: [...],
  relationships: [...],
  layoutMode: 'stream',
  metadata: {
    cardCount: 10,
    relationshipCount: 5
  }
}
```

---

#### exportJSON()

导出数据为 JSON 字符串。

```javascript
const json = frame.exportJSON();
```

**返回值：** `string` - JSON 字符串

---

#### importData(data, options)

导入数据。

```javascript
const result = frame.importData(data, {
  mode: 'merge',
  clearBeforeImport: false,
  preserveLayout: false
});
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `data` | `string\|object` | 必填 | 数据（JSON 字符串或对象） |
| `options.mode` | `string` | `'merge'` | 导入模式：`merge` / `replace` |
| `options.clearBeforeImport` | `boolean` | `false` | 导入前是否清空 |
| `options.preserveLayout` | `boolean` | `false` | 是否保留当前布局 |

**返回值：** `object` - 导入结果

```javascript
{
  importedCards: 10,
  importedRelationships: 5,
  mode: 'merge',
  totalCards: 15,
  totalRelationships: 8
}
```

---

#### toJSON()

转换为 JSON 格式（Store 数据）。

```javascript
const data = frame.toJSON();
```

### 实例方法 - 事件监听

#### on(eventName, listener)

监听事件。

```javascript
frame.on(CardFrame.EVENT_TYPES.CARD_ADDED, (event) => {
  console.log('卡片已添加:', event.detail.card);
});
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `eventName` | `string` | 事件名称 |
| `listener` | `function` | 事件监听器 |

---

#### off(eventName, listener)

移除事件监听。

```javascript
frame.off(CardFrame.EVENT_TYPES.CARD_ADDED, listener);
```

---

#### once(eventName, listener)

监听一次事件。

```javascript
frame.once(CardFrame.EVENT_TYPES.CARD_ADDED, (event) => {
  console.log('只会触发一次');
});
```

---

#### emit(eventName, detail)

触发事件。

```javascript
frame.emit('customEvent', { data: 'hello' });
```

### 实例方法 - 布局与主题

#### setLayoutMode(mode)

设置布局模式。

```javascript
frame.setLayoutMode('canvas'); // 'stream' 或 'canvas'
```

---

#### getLayoutMode()

获取当前布局模式。

```javascript
const mode = frame.getLayoutMode();
```

### 实例方法 - 插件管理

#### installPlugin(pluginDef)

安装插件。

```javascript
frame.installPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  install(frame) {
    console.log('插件已安装');
    return { greeting: 'Hello!' };
  }
});
```

---

#### uninstallPlugin(pluginName)

卸载插件。

```javascript
frame.uninstallPlugin('my-plugin');
```

---

#### enablePlugin(pluginName)

启用插件。

```javascript
frame.enablePlugin('my-plugin');
```

---

#### disablePlugin(pluginName)

禁用插件。

```javascript
frame.disablePlugin('my-plugin');
```

---

#### getPlugin(pluginName)

获取插件实例。

```javascript
const plugin = frame.getPlugin('my-plugin');
```

---

#### getAllPlugins()

获取所有插件信息。

```javascript
const plugins = frame.getAllPlugins();
```

### 实例方法 - 验证与修复

#### validateAll()

验证所有卡片。

```javascript
frame.validateAll();
```

---

#### fullCheck()

执行全量检查（卡片验证、DOM/Store 同步、关系完整性、安全检查）。

```javascript
const results = frame.fullCheck();
```

**返回值：** `object` - 检查结果

```javascript
{
  cardErrors: [...],
  domStoreMismatch: [...],
  relationshipErrors: [...],
  securityIssues: [...],
  timestamp: 1234567890
}
```

---

#### fixAll()

执行自动修复。

```javascript
const results = frame.fixAll();
```

**返回值：** `object` - 修复结果

```javascript
{
  cardFixed: 3,
  domSyncFixed: 1,
  relationshipFixed: 0
}
```

### 实例方法 - 统计与性能

#### getStats()

获取框架统计信息。

```javascript
const stats = frame.getStats();
```

**返回值：** `object` - 统计信息

```javascript
{
  cards: { total: 10, byType: { text: 5, task: 3, ... } },
  relationships: { total: 5 },
  plugins: { total: 2, enabled: 2 },
  layout: { mode: 'stream', zoom: 1 },
  circuitBreaker: { ... },
  autoFixer: { totalFixes: 10, ... },
  performance: { renderCount: 100, ... }
}
```

---

#### getPerfStats()

获取性能统计。

```javascript
const perf = frame.getPerfStats();
```

---

#### enableVirtualScroll(options)

启用虚拟滚动。

```javascript
frame.enableVirtualScroll({ overscan: 5 });
```

---

#### disableVirtualScroll()

禁用虚拟滚动。

```javascript
frame.disableVirtualScroll();
```

---

#### isVirtualScrollEnabled()

检查虚拟滚动是否启用。

```javascript
const enabled = frame.isVirtualScrollEnabled();
```

### 实例方法 - 操作历史与撤销/重做

> 由 `ActionLogger` 提供实现。记录 `addCard` / `updateCard` / `removeCard` / `addRelationship` / `removeRelationship` 等写操作。

#### undo()

撤销上一步操作。

```javascript
frame.undo();
```

**返回值：** `boolean` - 是否撤销成功

---

#### redo()

重做上一步被撤销的操作。

```javascript
frame.redo();
```

**返回值：** `boolean` - 是否重做成功

---

#### rollback(steps)

回滚指定步数的操作。

```javascript
frame.rollback(3); // 回滚 3 步
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `steps` | `number` | `1` | 回滚步数 |

---

#### getActionHistory()

获取操作历史记录。

```javascript
const history = frame.getActionHistory();
```

**返回值：** `array` - 操作历史数组

---

#### clearActionHistory()

清空操作历史。

```javascript
frame.clearActionHistory();
```

### 实例方法 - 自进化

> 由 `EvolutionEngine` / `MetricsCollector` / `RuleEngine` 提供。实验性功能。

#### getEvolutionHistory()

获取进化历史记录。

```javascript
const history = frame.getEvolutionHistory();
```

**返回值：** `array` - 进化历史数组

---

#### getMetricsSnapshot()

获取当前指标快照。

```javascript
const snapshot = frame.getMetricsSnapshot();
// { performance, architecture, interaction, timestamp }
```

---

#### evolveNow()

立即触发一次进化评估（不等定时器）。

```javascript
frame.evolveNow();
```

### 实例方法 - 性能与错误

#### enablePerfPanel()

启用性能面板（在容器右上角显示实时指标）。

```javascript
frame.enablePerfPanel();
```

---

#### disablePerfPanel()

禁用性能面板。

```javascript
frame.disablePerfPanel();
```

---

#### enableGlobalErrorHandler()

启用全局错误处理（捕获所有未捕获异常）。

```javascript
frame.enableGlobalErrorHandler();
```

---

#### disableGlobalErrorHandler()

禁用全局错误处理。

```javascript
frame.disableGlobalErrorHandler();
```

---

#### getGlobalErrorStats()

获取全局错误统计。

```javascript
const stats = frame.getGlobalErrorStats();
```

### 静态方法

#### CardFrame.from(selector)

通过选择器快速创建 CardFrame 实例。

```javascript
const frame = CardFrame.from('#container');
```

---

#### CardFrame.fromJSON(data)

从 JSON 数据创建 CardFrame 实例。

```javascript
const frame = CardFrame.fromJSON(jsonData);
```

---

#### CardFrame.getPerfStats()

获取全局性能统计。

```javascript
const perf = CardFrame.getPerfStats();
```

### 静态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `CardFrame.Utils` | `object` | 工具函数集合 |
| `CardFrame.Store` | `class` | Store 类 |
| `CardFrame.TypeRegistry` | `class` | TypeRegistry 类 |
| `CardFrame.Renderer` | `class` | Renderer 类 |
| `CardFrame.LayoutEngine` | `class` | LayoutEngine 类 |
| `CardFrame.EventBus` | `class` | EventBus 类 |
| `CardFrame.AutoFixer` | `class` | AutoFixer 类 |
| `CardFrame.RealTimeValidator` | `class` | RealTimeValidator 类 |
| `CardFrame.FeedbackSystem` | `object` | 反馈系统模块 |
| `CardFrame.EVENT_TYPES` | `object` | 事件类型常量 |
| `CardFrame.DEFAULT_CONFIG` | `object` | 默认配置常量 |
| `CardFrame.CARD_STATUS` | `object` | 卡片状态常量 |
| `CardFrame.RELATIONSHIP_TYPES` | `object` | 关系类型常量 |
| `CardFrame.PluginManager` | `class` | PluginManager 类 |
| `CardFrame.PluginSandbox` | `class` | PluginSandbox 类（插件沙箱） |
| `CardFrame.CircuitBreaker` | `class` | CircuitBreaker 类 |
| `CardFrame.ThemeManager` | `class` | ThemeManager 类 |
| `CardFrame.I18nManager` | `class` | I18nManager 类 |
| `CardFrame.RelationshipEngine` | `class` | RelationshipEngine 类 |
| `CardFrame.VirtualScroller` | `class` | VirtualScroller 类 |
| `CardFrame.BackendSync` | `class` | BackendSync 类（后端同步） |
| `CardFrame.Monitor` | `object` | Monitor 单例（监控上报） |
| `CardFrame.Security` | `object` | 安全模块 |
| `CardFrame.Perf` | `object` | 性能模块 |
| `CardFrame.CardObjectPool` | `class` | CardObjectPool 类（对象池） |
| `CardFrame.LayoutCache` | `class` | LayoutCache 类（布局缓存） |
| `CardFrame.QueryIndex` | `class` | QueryIndex 类（查询索引） |
| `CardFrame.ActionLogger` | `class` | ActionLogger 类（操作历史） |
| `CardFrame.MetricsCollector` | `class` | MetricsCollector 类（指标采集） |
| `CardFrame.RuleEngine` | `class` | RuleEngine 类（规则引擎） |
| `CardFrame.EvolutionEngine` | `class` | EvolutionEngine 类（进化引擎） |
| `CardFrame.PerfPanel` | `class` | PerfPanel 类（性能面板） |
| `CardFrame.GlobalErrorHandler` | `class` | GlobalErrorHandler 类（全局错误处理） |
| `CardFrame.ShadowCardRegistry` | `class` | ShadowCardRegistry 类（影子卡片注册） |
| `CardFrame.CardElement` | `class` | `<cf-card>` 自定义元素类 |
| `CardFrame.CardFrameElement` | `class` | `<card-frame>` 自定义元素类 |
| `CardFrame.VERSION` | `string` | 框架版本号（getter，如 `'1.1.0'`） |

> ✅ **v1.1.0 起**：每个 `CardFrame` 实例完全拥有自己的子系统（`store` / `typeRegistry` / `renderer` / `autoFixer` / `realTimeValidator` / `shadowCardRegistry`），通过实例属性访问（如 `frame.store`）。框架不再创建任何全局单例，多实例之间互不影响。

---

## Store 类

数据存储类，管理卡片和关系数据。

### 方法

#### addCard(card)
添加卡片，触发 `CARD_ADDED` 事件。

#### updateCard(card)
更新卡片，触发 `CARD_UPDATED` 事件。

#### updateCardProps(id, props)
更新卡片属性。

#### removeCard(id)
删除卡片（同时删除相关关系），触发 `CARD_REMOVED` 事件。

#### getCard(id)
获取指定卡片。

#### getAllCards()
获取所有卡片。

#### getCardsByType(type)
按类型获取卡片。

#### addRelationship(rel)
添加关系，触发 `RELATIONSHIP_ADDED` 事件。

#### updateRelationship(rel)
更新关系。

#### removeRelationship(id)
删除关系，触发 `RELATIONSHIP_REMOVED` 事件。

#### getRelationship(id)
获取指定关系。

#### getAllRelationships()
获取所有关系。

#### getRelationshipsByCard(cardId)
获取指定卡片的所有关系。

#### getRelationshipsByType(type)
按类型获取关系。

#### subscribe(listener)
订阅数据变化，返回取消订阅函数。

#### unsubscribe(listener)
取消订阅。

#### getSubscriberCount()
获取订阅者数量。

#### notify()
手动通知所有订阅者。

#### toJSON()
转换为 JSON 对象。

#### static fromJSON(data)
从 JSON 数据创建 Store 实例。

---

## TypeRegistry 类

类型注册表，管理卡片类型定义和验证。

### 方法

#### register(typeDef)
注册卡片类型。

**typeDef 结构：**
```javascript
{
  type: 'custom-type',
  label: '自定义类型',
  icon: '🎨',
  description: '类型描述',
  extends: 'base',
  abstract: false,
  propsSchema: [
    { 
      name: 'propName', 
      type: 'string', 
      required: true,
      label: '属性名',
      defaultValue: '默认值',
      allowedValues: ['value1', 'value2'],
      validator: (value) => true,
      safe: true,
      allowHtml: false
    }
  ],
  renderTemplate: '<div class="card">...</div>',
  actions: [...],
  defaultStyle: {}
}
```

#### get(typeName)
获取类型定义。

#### getAll()
获取所有类型。

#### validate(card)
验证卡片。

**返回值：**
```javascript
{
  valid: boolean,
  errors: [{ type, prop, message, ... }],
  warnings: [...],
  sanitizedProps?: { ... }
}
```

#### sanitizeCard(card)
清理卡片数据。

#### getPropSchema(typeName, propName)
获取属性的 schema 定义。

#### getDefaultValue(typeName, propName)
获取属性的默认值。

---

## Renderer 类

渲染器，负责卡片的 DOM 渲染和更新。

### 方法

#### renderTemplate(template, props)
渲染模板字符串，使用 `{{propName}}` 语法插入变量。

#### renderCard(card)
渲染单张卡片，返回 DOM 元素。

#### updateCardElement(cardEl, card)
更新卡片元素。

#### renderCards(cards)
渲染所有卡片（使用 requestAnimationFrame 批量渲染）。

#### forceFullRender(cards)
强制完全重新渲染。

#### cleanupCardElement(cardId)
清理卡片元素的事件监听器。

#### renderError(card, error)
渲染错误状态的卡片。

---

## LayoutEngine 类

布局引擎，管理布局模式和交互。

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `mode` | `string` | 当前布局模式：`stream` / `canvas` |
| `zoom` | `number` | 当前缩放比例 |
| `pan` | `object` | 平移位置 `{ x, y }` |

### 方法

#### setMode(mode)
设置布局模式，触发 `LAYOUT_CHANGED` 事件。

#### getMode()
获取当前布局模式。

#### applyLayout()
应用当前布局。

#### syncPositions()
同步卡片位置（画布模式）。

#### setZoom(zoom, centerX, centerY)
设置缩放比例。

#### resetView()
重置视图（缩放=1，平移=0）。

---

## EventBus 与事件类型常量

### EVENT_TYPES 常量

```javascript
CardFrame.EVENT_TYPES = {
  CARD_ADDED: 'cardAdded',
  CARD_UPDATED: 'cardUpdated',
  CARD_REMOVED: 'cardRemoved',
  RELATIONSHIP_ADDED: 'relationshipAdded',
  RELATIONSHIP_REMOVED: 'relationshipRemoved',
  CARD_VALIDATION_ERROR: 'cardValidationError',
  CARD_AUTO_FIXED: 'cardAutoFixed',
  LAYOUT_CHANGED: 'layoutChanged',
  FRAMEWORK_ERROR: 'frameworkError',
  DOM_SYNCHRONIZED: 'domSynchronized',
  PLUGIN_INSTALLED: 'pluginInstalled',
  PLUGIN_UNINSTALLED: 'pluginUninstalled',
  PLUGIN_ENABLED: 'pluginEnabled',
  PLUGIN_DISABLED: 'pluginDisabled',
  THEME_CHANGED: 'themeChanged',
  LANGUAGE_CHANGED: 'languageChanged',
  CIRCUIT_BREAKER_OPENED: 'circuitBreakerOpened',
  CIRCUIT_BREAKER_CLOSED: 'circuitBreakerClosed'
}
```

### EventBus 方法

#### on(eventName, listener)
监听事件。

#### off(eventName, listener)
移除监听。

#### once(eventName, listener)
监听一次。

#### emit(eventName, detail)
触发事件。

---

## AutoFixer 类

自动修复器，提供各种自动修复功能。

### 方法

#### setEnabled(enabled)
启用/禁用自动修复。

#### fixCard(card, validationResult)
修复卡片验证错误。

#### fixStructure(element, expectedParent)
修复卡片位置（自动归位）。

#### fixDomStoreSync(mismatches)
修复 DOM 与 Store 的不一致。

#### fixRelationships(errors)
修复关系错误。

#### fixAll()
执行全部自动修复。

#### getStats()
获取修复统计。

```javascript
{
  totalFixes: 10,
  cardFixes: 5,
  domSyncFixes: 3,
  relationshipFixes: 2
}
```

#### resetStats()
重置统计。

---

## RealTimeValidator 类

实时验证器，使用 MutationObserver 监听 DOM 变化。

### 方法

#### setEnabled(enabled)
启用/禁用验证。

#### setCheckInterval(ms)
设置全量检查间隔（毫秒）。

#### start()
启动验证。

#### stop()
停止验证。

#### validateAll()
验证所有卡片。

#### fullCheck()
执行全量检查。

#### syncFromDOM()
从 DOM 同步数据到 Store。

#### pause()
暂停验证（防止级联触发）。

#### resume()
恢复验证。

#### getLastCheckTime()
获取上次检查时间。

---

## PluginManager 类

插件管理器，管理插件的安装、卸载、启用、禁用。

### 方法

#### install(pluginDef)
安装插件。

#### uninstall(pluginName)
卸载插件。

#### enable(pluginName)
启用插件。

#### disable(pluginName)
禁用插件。

#### get(pluginName)
获取插件实例。

#### getAll()
获取所有插件信息。

#### isInstalled(pluginName)
检查插件是否已安装。

#### isEnabled(pluginName)
检查插件是否已启用。

#### registerHook(hookName, handler)
注册钩子，返回取消注册函数。

#### triggerHook(hookName, data)
触发钩子。

#### hasAction(actionName)
检查动作是否已注册。

#### executeAction(actionName, card, event)
执行卡片动作。

#### registerPermissions(pluginName, permissions)
为插件注册权限。

#### hasPermission(pluginName, permission)
检查插件是否具有指定权限。

#### checkRateLimit(pluginName)
检查插件是否超过速率限制。

#### createSandbox(pluginName, permissions, rateLimiter)
为插件创建沙箱实例。

**返回值：** `PluginSandbox` - 插件沙箱实例

#### getSandboxContext(pluginName)
获取插件的沙箱上下文（受限 API 表面）。

---

## PluginSandbox 类

插件沙箱，为每个插件提供独立的受限 API 上下文，自动追踪并清理资源。

> 详见 [插件开发指南 - 插件沙箱与权限](./plugin-development.md#插件沙箱与权限)。

### 方法

#### can(permission)
检查沙箱是否具有指定权限。

```javascript
const sandbox = frame.pluginManager.getSandboxContext('my-plugin');
if (sandbox && sandbox.can('store:write')) {
  // 执行写操作
}
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `permission` | `string` | 权限名（如 `store:read`、`store:write`、`events:emit`） |

**返回值：** `boolean`

---

#### createContext()
创建受限的插件 API 上下文。按声明的权限裁剪可见的 API 表面。

**返回值：** `object` - 受限上下文对象，包含以下字段（按权限开关）：

| 字段 | 权限要求 | 内容 |
|------|----------|------|
| `setTimeout` / `clearTimeout` / `setInterval` / `clearInterval` | 无 | 沙箱跟踪的定时器 |
| `addEventListener` | 无 | 沙箱跟踪的 DOM 监听器 |
| `store` | `store:read` | 只读卡片 API |
| `storeWrite` | `store:write` | 写卡片 API（受 rateLimit 限流） |
| `eventBus` | `events:subscribe`（`emit` 需 `events:emit`） | 事件订阅/触发 |
| `typeRegistry` | `types:register` | 类型注册 |
| `theme` | `theme:read`（`registerTheme` 需 `theme:write`） | 主题读取/注册 |
| `i18n` | `i18n:read` | 翻译函数 |
| `feedback` | 无 | `info` / `warn` / `error` |
| `utils` | `utils:read` | 工具函数 |

---

#### trackType(typeName)
登记插件注册的卡片类型（卸载时自动移除）。

#### trackTheme(themeName)
登记插件注册的主题（卸载时自动移除）。

#### destroy()
销毁沙箱，自动清理所有 tracked 资源：
- 清除所有 `setTimeout` / `setInterval` 句柄
- 移除所有 `addEventListener` 注册的 DOM 监听器
- 移除所有 `eventBus.on` 注册的订阅
- 注销所有 `typeRegistry.register` 注册的类型
- 移除所有 `theme.registerTheme` 注册的主题

> 通常由 `PluginManager.uninstall()` 自动调用，无需手动调用。

---

## ThemeManager 类

主题管理器，管理主题注册和切换。

### 方法

#### registerTheme(themeDef)
注册主题。

**themeDef 结构：**
```javascript
{
  name: 'my-theme',
  label: '我的主题',
  description: '主题描述',
  extends: 'light',
  variables: {
    '--bg-primary': '#ffffff',
    '--text-primary': '#000000',
    // ... 更多 CSS 变量
  }
}
```

#### getTheme(name)
获取主题定义。

#### getAllThemes()
获取所有主题列表。

#### applyTheme(themeName)
应用主题，触发 `THEME_CHANGED` 事件。

#### getCurrentTheme()
获取当前主题名称。

#### followSystemTheme(enable)
启用/禁用跟随系统主题。

#### isFollowingSystem()
是否跟随系统主题。

#### toggleTheme()
切换主题（亮色/暗色）。

#### removeTheme(name)
移除自定义主题。

#### setAnimationDuration(ms)
设置主题切换动画时长（毫秒）。

#### getAnimationDuration()
获取主题切换动画时长。

---

## I18nManager 类

国际化管理器，管理多语言。

### 方法

#### registerLocale(locale, localeDef)
注册语言包。

**localeDef 结构：**
```javascript
{
  label: '简体中文',
  rtl: false,
  messages: {
    'card.title.default': '未命名卡片',
    // ... 更多翻译
  }
}
```

#### getLocale(locale)
获取语言包。

#### getAllLocales()
获取所有语言列表。

#### setLocale(locale)
设置当前语言，触发 `LANGUAGE_CHANGED` 事件。

#### getCurrentLocale()
获取当前语言。

#### t(key, params)
翻译文本。

```javascript
const text = frame.i18n.t('card.title.default');
const formatted = frame.i18n.t('greeting', { name: 'World' });
```

#### detectBrowserLocale()
检测浏览器语言。

#### setFallbackLocale(locale)
设置回退语言。

#### isRTL()
当前语言是否为 RTL（从右到左）。

---

## RelationshipEngine 类

关系引擎，管理关系线的可视化。

### 方法

#### enable()
启用关系线渲染。

#### disable()
禁用关系线渲染。

#### isEnabled()
检查是否启用。

#### refresh()
刷新关系线。

---

## CircuitBreaker 类

熔断器，提供错误保护机制。

### 方法

#### recordSuccess(cardId)
记录成功。

#### recordFailure(cardId)
记录失败。

#### canExecute(cardId)
检查是否可以执行。

#### execute(fn, cardId)
执行受保护的函数。

#### getCardState(cardId)
获取卡片熔断状态：`closed` / `open` / `half-open`。

#### getGlobalState()
获取全局熔断状态。

#### isSafeMode()
是否处于安全模式。

#### reset(cardId)
重置熔断状态。

#### getStats()
获取熔断统计。

```javascript
{
  globalState: 'closed',
  safeMode: false,
  globalFailureCount: 0,
  cardCount: 0,
  openCards: []
}
```

---

## Security 模块

安全模块，提供 XSS 防护和安全验证。

### 方法

#### sanitizeHtml(html, options)
清理 HTML 内容。

#### sanitizeUrl(url)
清理 URL。

#### isSafeUrl(url)
检查 URL 是否安全。

#### sanitizeStyle(styleStr)
清理样式字符串。

#### escapeAttr(str)
转义属性字符串。

#### checkCSPCompatibility()
检查 CSP 兼容性。

#### validatePropValue(value, propSchema)
验证属性值的安全性。

---

## Perf 模块

性能监控模块。

### 方法

#### mark(name)
记录性能标记。

#### measure(name, startMark, endMark)
测量性能。

#### recordRender(duration, cardCount)
记录渲染性能。

#### getStats()
获取性能统计。

```javascript
{
  renderCount: 100,
  totalRenderTime: 5000,
  avgRenderTime: 50,
  maxRenderTime: 200,
  minRenderTime: 10,
  cardCount: 50,
  lastRenderTime: 45,
  recentMeasures: [...]
}
```

#### reset()
重置性能统计。

---

## FeedbackSystem 模块

反馈系统，提供分级日志输出。

### 方法

#### setLevel(level)
设置输出级别：`info` / `warn` / `error` / `silent`。

#### info(message, suggestion, example)
输出信息级日志。

#### warn(message, fix, correctExample)
输出警告级日志。

#### error(message, recover, docLink)
输出错误级日志。

#### fix(message, changes)
输出修复信息日志。

---

## Utils 工具函数

### 方法

#### generateId(prefix)
生成唯一 ID。

#### escapeHtml(str)
转义 HTML 特殊字符。

#### escapeAttr(str)
转义属性字符串。

#### sanitizeHtml(html, options)
清理 HTML（代理 Security 模块）。

#### sanitizeUrl(url)
清理 URL（代理 Security 模块）。

#### sanitizeStyle(styleStr)
清理样式（代理 Security 模块）。

#### isSafeUrl(url)
检查 URL 安全（代理 Security 模块）。

#### debounce(func, wait)
防抖函数。

#### throttle(func, limit)
节流函数。

#### formatTime(timestamp)
格式化时间。

#### deepClone(obj)
深拷贝对象。

#### validateType(value, type)
验证值的类型。

#### parseValue(value, type)
解析值的类型。

---

## VirtualScroller 类

虚拟滚动器，大数据量下的高性能渲染。

### 方法

#### enable(options)
启用虚拟滚动。

#### disable()
禁用虚拟滚动。

#### isEnabled()
检查是否启用。

#### getVisibleRange()
获取可见范围。

#### setOverscan(overscan)
设置超扫描行数。

#### getPoolSize()
获取 DOM 池大小（复用的元素数量）。

#### getVisibleCardCount()
获取当前可见卡片数量。

#### refresh()
刷新可见区域。

#### destroy()
销毁虚拟滚动器。

---

## 进化子系统

CardFrame 的自进化子系统由四个模块协作：`ActionLogger`（操作历史）、`MetricsCollector`（指标采集）、`RuleEngine`（规则评估）、`EvolutionEngine`（进化执行）。

> **实验性功能**：默认指标与进化历史仅存内存（刷新即丢），生产使用需配合独立的 Evolution Agent 服务。详见 [架构总览 - 自进化子系统](./architecture-overview.md#4-自进化子系统真实状态)。

### ActionLogger 类

操作历史记录器，支持撤销/重做/回滚。

#### record(action)
记录一个操作。

#### undo(store)
撤销上一步操作。

#### redo(store)
重做上一步被撤销的操作。

#### rollback(steps, store)
回滚指定步数。

#### getHistory()
获取操作历史数组。

#### clear()
清空历史。

#### pause() / resume()
暂停/恢复记录。

#### canUndo() / canRedo()
是否可撤销/重做。

#### subscribe(listener)
订阅历史变化。

#### getStatus()
获取历史状态（当前位置、总数、上限）。

### MetricsCollector 类

性能/交互/架构指标采集器，默认每 5 秒采样一次。

#### start()
启动周期性采集。

#### stop()
停止采集。

#### getSnapshot()
获取当前指标快照。

**返回值：**

```javascript
{
  timestamp: 1234567890,
  performance: {
    renderCount, avgRenderTime, maxRenderTime,
    fps, domNodes, memoryUsage
  },
  architecture: {
    cardCount, typeCount, relationshipCount,
    poolUtilization, cacheHitRate
  },
  interaction: {
    clicks, drags, scrolls, avgResponseTime
  }
}
```

### RuleEngine 类

规则引擎，内置 7 条规则，每 30 秒评估一次指标。

#### evaluate(metrics)
评估指标，返回触发的规则列表。

#### addRule(rule)
添加自定义规则。

**rule 结构：**

```javascript
{
  name: 'my-rule',
  cooldown: 300000,  // 冷却时间（毫秒）
  condition: (metrics) => metrics.performance.fps < 30,
  action: { type: 'param-tune', target: 'renderer', param: 'batchSize', value: 50 }
}
```

#### removeRule(name)
移除规则。

### EvolutionEngine 类

进化执行引擎，根据规则动作执行浏览器内调参或请求外部 Agent。

#### start()
启动进化引擎（开始周期性评估 + Agent 同步）。

#### stop()
停止进化引擎。

#### getEvolutionHistory()
获取进化历史记录。

#### getMetrics()
获取最近一次指标快照（代理 `MetricsCollector.getSnapshot()`）。

### PerfPanel 类

性能面板，在容器右上角显示实时指标。

#### enable()
启用性能面板。

#### disable()
禁用性能面板。

#### isEnabled()
检查是否启用。

### GlobalErrorHandler 类

全局错误处理器，捕获所有未捕获异常。

#### enable()
启用全局错误处理。

#### disable()
禁用全局错误处理。

#### isEnabled()
检查是否启用。

#### getErrorStats()
获取错误统计（总数、分类、最近错误）。

#### clear()
清空错误记录。

---

## Guardrail 硬约束系统

`Guardrail` 是 CardFrame 的硬约束运行时模块，防止 AI Agent 退回到原生 HTML / Tailwind / 直接 DOM 操作的旧路径。通过 `options.guardrail` 配置，默认启用。

### 检测规则

| 规则 | 严重性 | 检测内容 |
|------|--------|----------|
| **R1** | `warn` | 容器内发现非卡片元素（`<div>` / `<section>` 等） |
| **R2** | `info` | 容器内元素使用了 Tailwind / Bootstrap / Bulma CSS 框架 class |
| **R3** | `error` | 直接 DOM 操作（`container.appendChild` / `container.innerHTML =` / `insertAdjacentHTML`） |
| **R4** | `error` | 绕过 Store 私有字段访问（`frame.store._cards` / `._pool` / `._relationships` 等） |

> 作用范围：仅检测 `<card-frame>` 容器**内部**直接子元素。页面 header/nav/footer 等容器外部元素不受约束。框架 Renderer 创建的卡片 wrapper（带 `data-card-id` 属性）自动跳过。

### GuardrailOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用检测 |
| `level` | `'error' \| 'warn' \| 'info'` | `'warn'` | 最低报告级别。低于此级别的违规不输出 console |
| `onViolation` | `(v: GuardrailViolation) => void` | `null` | 违规回调 |
| `excludedFrameworks` | `string[]` | `[]` | 跳过指定 CSS 框架检测（`'tailwind'` / `'bootstrap'` / `'bulma'`） |
| `testMode` | `boolean` | `false` | `true` 时不输出 console 但仍记录违规（用于测试） |

### GuardrailViolation

```typescript
interface GuardrailViolation {
  rule: 'R1' | 'R2' | 'R3' | 'R4';
  severity: 'error' | 'warn' | 'info';
  message: string;
  element: string;
  suggestion: string;
  timestamp: number;
}
```

### 实例方法

#### scan()
对容器现有子元素执行一次扫描。构造时自动调用。

#### observe()
启动 MutationObserver 持续监控 + DOM API 劫持 + Store Proxy。构造时自动调用。

#### disconnect()
停止监控，恢复原始 DOM API。调用后不再检测新违规。

#### destroy()
等价于 `disconnect()` + 标记为已销毁，防止重用。`CardFrame.destroy()` 时自动调用。

#### getStats()
返回违规统计：

```javascript
const stats = frame.guardrail.getStats();
// {
//   total: 12,
//   byRule: { R1: 5, R2: 3, R3: 2, R4: 2 },
//   bySeverity: { error: 4, warn: 5, info: 3 },
//   enabled: true,
//   level: 'warn'
// }
```

### 构建时检查

```bash
npm run guardrail                    # 扫描 examples/
npm run guardrail -- src examples    # 扫描指定目录
```

### 静态属性

`CardFrame.Guardrail` — Guardrail 构造器，可用于独立实例化。

---

## 声明式 HTML 属性参考

### `<card-frame>` 元素

卡片框架容器元素。

**无特定属性**，使用 `CardFrame.from()` 或自动初始化。

---

### `<cf-card>` 元素

卡片元素，支持以下属性：

#### 通用属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 卡片类型（必填） |
| `id` | `string` | 卡片 ID（可选，自动生成） |
| `title` | `string` | 卡片标题 |

#### text 类型属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `content` | `string` | 内容（也可用 innerHTML） |

#### task 类型属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `priority` | `string` | 优先级：`high` / `medium` / `low` |
| `due-date` | `string` | 截止日期 |

#### image 类型属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `src` | `string` | 图片地址 |
| `alt` | `string` | 替代文本 |
| `caption` | `string` | 说明文字 |

#### list 类型属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `items` | `string` | 列表项（JSON 或逗号分隔） |

#### progress 类型属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `value` | `number` | 当前值 |
| `max` | `number` | 最大值 |
| `unit` | `string` | 单位 |

#### data-* 属性

所有 `data-*` 属性都会被解析为卡片属性。

```html
<cf-card type="text" data-custom="value" title="标题"></cf-card>
```

**使用示例：**

```html
<!-- 文本卡 -->
<cf-card type="text" title="文本卡标题">
  <p>这是卡片内容</p>
</cf-card>

<!-- 任务卡 -->
<cf-card type="task" title="完成项目" priority="high"></cf-card>

<!-- 图片卡 -->
<cf-card 
  type="image" 
  title="示例图片" 
  src="https://example.com/image.jpg"
  alt="示例"
  caption="图片说明">
</cf-card>

<!-- 进度卡 -->
<cf-card type="progress" title="进度" value="75" max="100" unit="%"></cf-card>
```

---

## 自进化系统 (EvolutionEngine / MetricsCollector / RuleEngine)

CardFrame v1.0 内置自进化系统，可在运行时自动采集性能指标、评估优化规则并执行参数调优。

### EvolutionEngine 类

自进化引擎是框架的核心扩展能力，负责协调指标采集、规则评估和执行优化动作。

#### 构造函数

```javascript
new EvolutionEngine(frame, options)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `frame` | `CardFrame` | CardFrame 实例 |
| `options.metricsInterval` | `number` | 性能采集间隔（毫秒，默认 5000） |
| `options.ruleCheckInterval` | `number` | 规则检查间隔（毫秒，默认 30000） |
| `options.agentSyncInterval` | `number` | Agent 同步间隔（毫秒，默认 60000） |
| `options.agentEndpoint` | `string` | Evolution Agent 服务地址（默认 `http://localhost:9100`） |
| `options.autoEvolve` | `boolean` | 是否自动执行进化（默认 true） |

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `start()` | `void` | 启动自进化引擎，开始采集指标和定时检查规则 |
| `stop()` | `void` | 停止自进化引擎，清理所有定时器和 WebSocket 连接 |
| `evolveNow()` | `void` | 立即执行一次进化检查 |
| `getEvolutionHistory()` | `Array` | 获取进化历史记录（最多 1000 条） |
| `getMetrics()` | `Object` | 获取当前指标快照 |

#### 使用示例

```javascript
const frame = new CardFrame(container, { evolution: true, evolutionOptions: { ruleCheckInterval: 60000 } });
frame.evolutionEngine.start();
```

### MetricsCollector 类

指标采集器，负责实时采集框架运行指标。

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `start()` | `void` | 启动性能采集（每 5 秒）和架构采集（每 60 分钟） |
| `stop()` | `void` | 停止所有定时器和交互监听 |
| `getSnapshot()` | `Object` | 获取当前指标快照 |
| `_recordInteraction(action, data)` | `void` | 记录用户交互事件 |
| `_pushSample(category, sample)` | `void` | 向指定类别添加采样数据 |
| `_avg(samples, field)` | `number` | 计算采样数组指定字段的平均值 |
| `_last(samples, field)` | `*` | 获取采样数组指定字段的最后一个值 |

#### 指标快照结构

```javascript
{
  performance: {
    renderTime: 0.5,
    cardCount: 50,
    poolHitRate: 0.85,
    cacheHitRate: 0.9
  },
  interaction: {
    cardClicks: 100,
    cardCreates: 10,
    cardDeletes: 2,
    last5: []
  },
  architecture: {
    typeCount: 15,
    maxInheritanceDepth: 3,
    listenerCount: 200,
    pluginCount: 2
  }
}
```

### RuleEngine 类

规则引擎，负责评估指标并返回匹配的优化规则。

#### 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `evaluate(metrics)` | `Array` | 根据指标评估所有规则，返回匹配的优化动作列表 |
| `addRule(rule)` | `void` | 添加自定义优化规则 |
| `removeRule(name)` | `void` | 移除指定规则 |
| `_inCooldown(name)` | `boolean` | 检查规则是否在冷却期内 |

#### 内置规则

| 规则名称 | 触发条件 | 优化动作 |
|----------|----------|----------|
| `pool-expansion` | 池命中率 < 0.5 | 增大对象池容量 |
| `cache-expansion` | 缓存命中率 < 0.5 | 增大布局缓存容量 |
| `render-batch-optimize` | 渲染耗时 > 100ms | 启用批量渲染优化 |
| `type-explosion` | 类型数 > 50 | 触发类型合并 |
| `inheritance-depth` | 继承深度 > 4 | 触发继承扁平化 |
| `listener-leak` | 监听器数 > 500 | 触发监听器清理 |

#### 使用示例

```javascript
const ruleEngine = new CardFrame.RuleEngine();
const metrics = { performance: { poolHitRate: 0.3 }, architecture: { typeCount: 60 } };
const actions = ruleEngine.evaluate(metrics);
// => [{ rule: 'pool-expansion', action: 'tune', params: { target: 'cardObjectPool', key: '_maxPerType', value: 200 } },
//     { rule: 'type-explosion', action: 'warn', params: { message: '类型数超过 50，建议检查' } }]
```

### CardFrame 上的自进化接口

CardFrame 实例提供了便捷的自进化接口：

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `frame.getEvolutionHistory()` | `Array` | 获取进化历史记录 |
| `frame.getMetricsSnapshot()` | `Object` | 获取当前指标快照 |
| `frame.evolveNow()` | `void` | 立即执行一次进化检查 |

---

**上一篇：[快速开始 ←](./getting-started.md)** | **下一篇：[插件开发指南 →](./plugin-development.md)**
