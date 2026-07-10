# Task 1 Brief: 构建脚本 — 自动发现所有类，消除手动 extractClass

## 任务描述

当前 `scripts/build.js` 使用 `extractClass(source, 'ClassName')` 手动调用 13 次，遗漏了 11 个类（EvolutionEngine、ActionLogger、CardObjectPool、LayoutCache、QueryIndex、PerfPanel、GlobalErrorHandler、ShadowCardRegistry、ShadowCardElement、MetricsCollector、RuleEngine）。

本任务将其替换为 `autoScanClasses(source)` 函数，自动从 IIFE 中提取所有 `class XXXX {` 定义，消除手动维护成本。

## Files to Modify

1. **scripts/build.js** — 主要修改文件
   - L18-22: 替换 extractClass + 新增 autoScanClasses
   - L30-364: buildCoreModule 使用 autoScanClasses
   - L369-627: 所有 build*Module 函数使用 autoScanClasses
   - 新增: buildEvolutionModule（含 11 个遗漏类）

## 关键实现点

1. **autoScanClasses(source)** — 正则 `/  class (\w+) \{/g` 扫描 IIFE，调用 extractClass 提取每个类的完整代码
2. **buildEvolutionModule(source)** — 提取 EvolutionEngine、MetricsCollector、RuleEngine、ActionLogger、CardObjectPool、LayoutCache、QueryIndex、PerfPanel、GlobalErrorHandler、ShadowCardRegistry
3. **build() 函数更新** — 添加 evolution.js 构建，更新 loader.js 的 MODULE_CONFIG
4. **向后兼容** — extractClass 保留，原有手动调用的类名仍可工作

## 测试文件

创建 **tests/build-tests.js**：
- 验证 autoScanClasses 提取 ≥27 个类
- 验证包含 EvolutionEngine、ActionLogger、CardObjectPool
- 验证提取的类代码格式正确

## 约束

- ES5 兼容（var，无箭头函数）
- 零外部依赖
- 完成后运行 `npm test` 确认通过
- 完成后运行 `npm run build` 确认构建成功
- 构建后再次运行 `npm test` 确认产物不破坏测试

## 报告

完成后写入 .superpowers/sdd/task-1-report.md，包含：
- 实施的步骤摘要
- 测试运行结果
- 构建运行结果
- 任何关注项
