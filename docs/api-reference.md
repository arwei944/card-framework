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
- [ThemeManager 类](#thememanager-类)
- [I18nManager 类](#i18nmanager-类)
- [RelationshipEngine 类](#relationshipengine-类)
- [CircuitBreaker 类](#circuitbreaker-类)
- [Security 模块](#security-模块)
- [Perf 模块](#perf-模块)
- [FeedbackSystem 模块](#feedbacksystem-模块)
- [Utils 工具函数](#utils-工具函数)
- [VirtualScroller 类](#virtualscroller-类)
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
| `CardFrame.EventBus` | `object` | 全局事件总线实例 |
| `CardFrame.AutoFixer` | `class` | AutoFixer 类 |
| `CardFrame.RealTimeValidator` | `class` | RealTimeValidator 类 |
| `CardFrame.FeedbackSystem` | `object` | 反馈系统模块 |
| `CardFrame.EVENT_TYPES` | `object` | 事件类型常量 |
| `CardFrame.PluginManager` | `class` | PluginManager 类 |
| `CardFrame.CircuitBreaker` | `class` | CircuitBreaker 类 |
| `CardFrame.ThemeManager` | `class` | ThemeManager 类 |
| `CardFrame.I18nManager` | `class` | I18nManager 类 |
| `CardFrame.RelationshipEngine` | `class` | RelationshipEngine 类 |
| `CardFrame.VirtualScroller` | `class` | VirtualScroller 类 |
| `CardFrame.Security` | `object` | 安全模块 |
| `CardFrame.Perf` | `object` | 性能模块 |
| `CardFrame.store` | `object` | 全局 Store 实例 |
| `CardFrame.typeRegistry` | `object` | 全局 TypeRegistry 实例 |
| `CardFrame.renderer` | `object` | 全局 Renderer 实例 |
| `CardFrame.autoFixer` | `object` | 全局 AutoFixer 实例 |
| `CardFrame.realTimeValidator` | `object` | 全局 RealTimeValidator 实例 |

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

#### refresh()
刷新可见区域。

#### destroy()
销毁虚拟滚动器。

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

**上一篇：[快速开始 ←](./getting-started.md)** | **下一篇：[插件开发指南 →](./plugin-development.md)**
