# Task 2 Report: CardFrame.destroy() 资源清理

## 状态：完成（已并入模块化 `src/core/CardFrame.js`）

原 Task 2 brief 针对单体 `src/card-framework.js` 添加 `destroy()`。在后续重构中，源码被拆为 `src/` ES Module，该实现已成为 `src/core/CardFrame.js` 的一部分，无需再改单体文件。

## 实施内容
- `src/core/CardFrame.js` 的 `destroy()`：幂等（`_destroyed` 守卫），依次停止 evolutionEngine / realTimeValidator / perfPanel / globalErrorHandler / virtualScroller / relationshipEngine，清空 EventBus（`eventBus.clear()`），清理容器引用并置空子模块引用。
- `src/core/EventBus.js` 的 `removeAllByContext(context)`（清理监听器与 once 跟踪）与 `clear()`。
- `src/web-components/ShadowCardElement.js` 的 `_cleanup()` 用正确 `(value, key)` 顺序调用 `removeEventListener`。

## 验证
- `tests/unit/cardframe.test.js` 中 `destroy()` 用例通过：清理全部资源、重复调用安全。
- `tests/unit/eventbus.test.js` 中 `removeAllByContext()` 用例通过。
- 全量 `npm test`：**108 passing**。

## 关联
- 与 Phase 1（模块化拆分）、Phase 2（esbuild 构建）、Phase 3（jsdom 测试）一同交付。
- 单体 `src/card-framework.js` 已删除，原 SDD Task 2 的"改单体文件"步骤不再适用。
