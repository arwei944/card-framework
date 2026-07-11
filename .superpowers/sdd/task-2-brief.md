# Task 2: CardFrame.destroy() — 资源清理方法

## 背景

CardFrame 类当前没有 `destroy()` 方法，导致无法释放资源（setInterval 定时器、EventBus 监听器、RAF 循环、store.subscribe 回调、Window 级别事件等），造成严重内存泄漏。

## 任务

1. 在 CardFrame 类中添加 `destroy()` 方法（在 evolveNow() 之后、类结束前）
2. 添加 `removeAllByContext(context)` 到 EventBus 类
3. 修复 ShadowCardElement._cleanup() 真正 removeEventListener
4. 创建 tests/destroy-tests.js 测试 destroy() 行为

## 文件

- **Modify:** `src/card-framework.js`
- **Create:** `tests/destroy-tests.js`

## 关键实现点

### destroy() 方法

添加到 CardFrame 类中（evolveNow() 之后）：

```javascript
    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;

      // 1. 停止进化引擎（含 MetricsCollector 定时器）
      if (this.evolutionEngine) {
        this.evolutionEngine.stop();
        this.evolutionEngine = null;
      }

      // 2. 停止实时验证器（MutationObserver）
      if (this.realTimeValidator) {
        this.realTimeValidator.stop();
      }

      // 3. 禁用性能面板（RAF）
      if (this.perfPanel) {
        this.perfPanel.disable();
      }

      // 4. 禁用全局错误处理（window 事件）
      if (this.globalErrorHandler) {
        this.globalErrorHandler.disable();
      }

      // 5. 禁用虚拟滚动（window resize/scroll 事件）
      if (this.virtualScroller) {
        this.virtualScroller.destroy();
      }

      // 6. 清理关系引擎（SVG 层、拖拽事件）
      if (this.relationshipEngine) {
        this.relationshipEngine.destroy();
      }

      // 7. 清理全部 eventBus 监听器
      this.eventBus._listeners.clear();

      // 8. 清理容器引用
      this.container.classList.remove('card-frame');
      delete this.container.__cardFrame;

      // 9. 清理所有子模块引用
      this.store = null;
      this.renderer = null;
      this.layoutEngine = null;
      this.autoFixer = null;
      this.realTimeValidator = null;
      this.pluginManager = null;
      this.circuitBreaker = null;
      this.actionLogger = null;
      this.globalErrorHandler = null;
      this.perfPanel = null;
      this.cardObjectPool = null;
      this.themeManager = null;
      this.i18n = null;
      this.relationshipEngine = null;
      this.virtualScroller = null;
      this.eventBus = null;
      this.typeRegistry = null;
    }
```

### EventBus.removeAllByContext()

在 EventBus.off() 之后添加：

```javascript
    removeAllByContext(context) {
      if (!context) return;
      var self = this;
      this._listeners.forEach(function(listeners, eventName) {
        var toRemove = [];
        listeners.forEach(function(listener) {
          if (listener._context === context) {
            toRemove.push(listener);
          }
        });
        toRemove.forEach(function(listener) {
          listeners.delete(listener);
        });
        if (listeners.size === 0) {
          self._listeners.delete(eventName);
        }
      });
    }
```

同时修改 on() 方法记录上下文：

```javascript
    on(eventName, listener, context) {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      if (context) {
        listener._context = context;
      }
      this._listeners.get(eventName).add(listener);
    }
```

### ShadowCardElement._cleanup()

将 `_cleanup()` 修改为真正 removeEventListener：

```javascript
    _cleanup() {
      var self = this;
      this._listeners.forEach(function(handler, eventType) {
        self.removeEventListener(eventType, handler);
      });
      this._listeners.clear();
    }
```

### destroy-tests.js

复用 evolution-tests.js 的 mock 环境（window/document/HTMLElement/MutationObserver），加载 CardFrame，测试：
1. destroy() 后 `_destroyed === true`
2. destroy() 后 `evolutionEngine === null`
3. destroy() 后所有子模块为 null
4. destroy() 后 `container.__cardFrame === undefined`
5. 连续调用 3 次 destroy() 不抛异常
6. destroy() 后调用 createCard 应正常返回 card
7. destroy() 后 container 已清理
8. EventBus.removeAllByContext 移除指定上下文监听器
9. removeAllByContext 不影响其他上下文

## 约束

- ES5 兼容（var，无箭头函数）
- 零外部依赖
- 完成后运行 `npm test` 确认通过
- 完成后运行 `npm run build` 确认构建成功

## 报告

完成后写入 .superpowers/sdd/task-2-report.md
