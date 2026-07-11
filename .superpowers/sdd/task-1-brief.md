# Task 1: 构建脚本 — 自动发现所有类，消除手动 extractClass

## 背景

card-framework 的构建脚本 scripts/build.js 使用手动 `extractClass(source, 'ClassName')` 调用 13 次，遗漏了 11 个类。需替换为自动扫描。

## 任务

1. 在 scripts/build.js 中添加 `autoScanClasses(source)` 函数
2. 用 autoScanClasses 替换所有手动 extractClass 调用
3. 添加 buildEvolutionModule() 生成 evolution.js 模块
4. 更新 build() 函数构建 evolution.js
5. 更新 buildLoader() 的 MODULE_CONFIG 包含 evolution
6. 创建 tests/build-tests.js 测试 autoScanClasses

## 文件

- **Modify:** `scripts/build.js`
- **Create:** `tests/build-tests.js`

## 约束

- ES5 兼容（var，无箭头函数）
- 零外部依赖
- 完成后运行 `npm test` 确认通过
- 完成后运行 `npm run build` 确认构建成功

## 报告

完成后写入 .superpowers/sdd/task-1-report.md，包含：
- 实施的步骤摘要
- 测试运行结果
- 构建运行结果
- 任何关注项
