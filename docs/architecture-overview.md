# CardFrame 架构总览

## 整体架构

CardFrame 采用 **单体核心 + 模块化构建** 的混合架构。源文件是所有类的单体 IIFE，构建脚本通过正则提取生成可独立加载的模块化产物。

```
┌─────────────────────────────────────────────────────────┐
│                    card-framework.js                     │
│                      (IIFE ~7000 行)                    │
│                                                          │
│  常量层: EVENT_TYPES, DEFAULT_CONFIG, CARD_STATUS ...   │
│  工具层: Utils, Security, Perf, FeedbackSystem          │
│  核心层: EventBus, Store, TypeRegistry, CardFrame       │
│  扩展层: ThemeManager, I18nManager, RelationshipEngine  │
│  安全层: CircuitBreaker, AutoFixer, RealTimeValidator   │
│  插件层: PluginManager                                  │
│  性能层: CardObjectPool, LayoutCache, QueryIndex        │
│  渲染层: Renderer, LayoutEngine, VirtualScroller        │
│  Web Components: CardElement, CardFrameElement          │
│  进化层: EvolutionEngine, MetricsCollector, RuleEngine  │
└─────────────────────────────────────────────────────────┘
```

## 构建产物

| 模块文件 | 包含类 | 依赖 |
|---------|--------|------|
| core.js | EventBus, Store, TypeRegistry, CardFrame | 无 |
| security.js | Security(常量), CircuitBreaker | core |
| render.js | Renderer, LayoutEngine | core |
| validation.js | AutoFixer, RealTimeValidator | core |
| extras.js | ThemeManager, I18nManager, RelationshipEngine | core, render |
| plugins.js | PluginManager | core |
| perf.js | Perf(常量), VirtualScroller | core, render |
| evolution.js | EvolutionEngine, MetricsCollector, RuleEngine, ActionLogger, CardObjectPool, LayoutCache, QueryIndex, PerfPanel, GlobalErrorHandler, ShadowCardRegistry | core, render |
| card-framework.js | 完整打包版（所有 27 个类） | 无 |
| loader.js | 模块加载器 | 无 |

## 数据流

```
用户操作 / Plugin Hook / DOM 事件
         │
         ▼
    CardFrame (主入口)
         │
    ┌────┴──────────────┐
    ▼                   ▼
  Store              EventBus
  (数据中心)        (事件总线)
    │                   │
    ├─ TypeRegistry ────┤ 验证 card
    ├─ CardObjectPool   │
    ├─ LayoutCache      │
    └─ QueryIndex       │
         │              │
         ▼              ▼
    Renderer ───── LayoutEngine
    (DOM 渲染)     (布局计算)
         │
         ▼
    VirtualScroller
    (DOM 虚拟化)

后台:
    EvolutionEngine
    ├─ MetricsCollector (采集指标)
    ├─ RuleEngine       (规则评估)
    └─ EvolutionAgent   (AI 代码进化)
```

## 关键设计决策

1. **为什么用 IIFE 而非 ES Module？**
   - 零外部依赖，直接 `<script>` 引入即可使用
   - 兼容所有浏览器，无需构建工具
   - Agent 友好：单文件部署，AI 可完整读取

2. **为什么构建产物用模块化？**
   - 按需加载，减少首屏体积
   - 插件开发者只依赖所需模块
   - 与源文件的单体架构解耦

3. **为什么测试用 Node.js mock？**
   - 框架依赖 DOM API，但单元测试需要脱离浏览器
   - 自定义 window/document mock，避免浏览器差异
   - 进化引擎测试需要精确控制定时器
