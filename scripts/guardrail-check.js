#!/usr/bin/env node
/**
 * Guardrail 构建时检查脚本
 *
 * 扫描项目中的 HTML 和 JS 文件，检测逃逸用法：
 *   R1: <card-frame> 容器内的非卡片元素（<div>/<span>/<section> 等）
 *   R2: 容器内元素的 Tailwind/Bootstrap/Bulma class
 *   R3: JS 中的 container.appendChild/innerHTML/insertAdjacentHTML 直接 DOM 操作
 *   R4: JS 中的 frame.store._* 私有字段访问
 *
 * 用法：node scripts/guardrail-check.js [扫描目录...]
 * 默认扫描 examples/ 和 src/
 *
 * 退出码：0 = 通过，1 = 发现违规
 */

const fs = require('fs');
const path = require('path');

// ─── 配置 ─────────────────────────────────────────────────

// 默认只扫描 examples/（用户代码示例）。框架自身的 src/ 天然需要操作 DOM，
// 不应被检查；用户可传入自己的目录参数来扫描应用代码。
const DEFAULT_SCAN_DIRS = ['examples'];
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'coverage', '.nyc_output',
  'docs', 'tests', 'scripts', 'evolution-agent'
]);

// Framework internal modules that legitimately need direct DOM access.
// R3 (direct DOM) checks are skipped for these paths.
const FRAMEWORK_INTERNAL_PATHS = [
  'src' + path.sep + 'render',
  'src' + path.sep + 'validation',
  'src' + path.sep + 'web-components',
  'src' + path.sep + 'guardrail',
  'src' + path.sep + 'extras' + path.sep + 'RelationshipEngine.js',
  'src' + path.sep + 'perf' + path.sep + 'VirtualScroller.js',
  'src' + path.sep + 'security' + path.sep + 'Security.js'
];

function isFrameworkInternal(filePath) {
  const relPath = path.relative(process.cwd(), filePath);
  return FRAMEWORK_INTERNAL_PATHS.some(p => relPath.startsWith(p));
}

const ALLOWED_TAG_NAMES = new Set([
  'cf-card', 'cf-shadow-card', 'card-frame', 'template',
  'script', 'style', 'link'
]);

const ESCAPE_TAG_NAMES = new Set([
  'div', 'span', 'section', 'article', 'aside', 'header',
  'footer', 'main', 'nav', 'ul', 'ol', 'li', 'table', 'tr', 'td'
]);

const TAILWIND_PATTERN = /\b(flex|grid|block|inline|hidden|inline-block|inline-flex|inline-grid|p-[a-z0-9-]+|m-[a-z0-9-]+|px-[a-z0-9-]+|py-[a-z0-9-]+|text-[a-z0-9-]+|bg-[a-z0-9-]+|border-[a-z0-9-]+|rounded[a-z0-9-]*|shadow[a-z0-9-]*|w-[a-z0-9-]+|h-[a-z0-9-]+|gap-[a-z0-9-]+|justify-[a-z0-9-]+|items-[a-z0-9-]+|font-[a-z0-9-]+|leading-[a-z0-9-]+|tracking-[a-z0-9-]+|z-[0-9]+|absolute|relative|fixed|sticky)\b/g;

const BOOTSTRAP_PATTERN = /\b(col-[a-z0-9-]+|row|container|btn[a-z0-9-]*|card[a-z0-9-]*|alert[a-z0-9-]*|badge[a-z0-9-]*|d-[a-z0-9-]+|navbar[a-z0-9-]*|nav-[a-z0-9-]+|dropdown[a-z0-9-]*|modal[a-z0-9-]*)\b/g;

// ─── 文件扫描 ─────────────────────────────────────────────

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkDir(fullPath, results);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) {
        // Skip this script itself and node_modules
        if (fullPath.includes('guardrail-check.js')) continue;
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ─── HTML 检查 ────────────────────────────────────────────

function checkHTML(filePath, content, violations) {
  // 找到所有 <card-frame> 容器
  const containerRegex = /<card-frame[^>]*>([\s\S]*?)<\/card-frame>/gi;
  let containerMatch;

  while ((containerMatch = containerRegex.exec(content)) !== null) {
    const innerHTML = containerMatch[1];
    const containerStart = containerMatch.index + containerMatch[0].indexOf('>') + 1;

    // R1: 检测非卡片元素
    const tagRegex = /<(\w+)([^>]*)>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(innerHTML)) !== null) {
      const tag = tagMatch[1].toLowerCase();
      if (ALLOWED_TAG_NAMES.has(tag)) continue;
      if (!ESCAPE_TAG_NAMES.has(tag)) continue;

      const absoluteOffset = containerStart + tagMatch.index;
      const lineNum = content.slice(0, absoluteOffset).split('\n').length;
      const classMatch = tagMatch[2].match(/class=["']([^"']*)["']/);
      const cls = classMatch ? classMatch[1] : '';

      violations.push({
        rule: 'R1',
        severity: 'warn',
        file: filePath,
        line: lineNum,
        message: `<card-frame> 容器内发现非卡片元素 <${tag}>`,
        suggestion: '改用 <cf-card type="text"> 或其他卡片类型',
        snippet: `<${tag}${cls ? ` class="${cls}"` : ''}>`
      });

      // R2: 检测逃逸 CSS class
      if (cls) {
        const tw = cls.match(TAILWIND_PATTERN);
        const bs = cls.match(BOOTSTRAP_PATTERN);
        if (tw) {
          violations.push({
            rule: 'R2',
            severity: 'info',
            file: filePath,
            line: lineNum,
            message: `使用了 Tailwind CSS: ${tw.join(', ')}`,
            suggestion: '移除原子 CSS class，使用卡片 props 控制布局'
          });
        }
        if (bs) {
          violations.push({
            rule: 'R2',
            severity: 'info',
            file: filePath,
            line: lineNum,
            message: `使用了 Bootstrap CSS: ${bs.join(', ')}`,
            suggestion: '移除原子 CSS class，使用卡片 props 控制布局'
          });
        }
      }
    }
  }
}

// ─── JS 检查 ──────────────────────────────────────────────

function checkJS(filePath, content, violations) {
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // 跳过注释
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // R3: 直接 DOM 操作
    const domPatterns = [
      { regex: /\.appendChild\s*\(/, msg: '直接使用 appendChild 操作 DOM' },
      { regex: /\.insertAdjacentHTML\s*\(/, msg: '直接使用 insertAdjacentHTML 操作 DOM' },
      { regex: /container\s*\.\s*innerHTML\s*=/, msg: '直接设置 container.innerHTML' },
      { regex: /document\.createElement\s*\(\s*['"]div['"]/, msg: '创建原生 <div> 元素而非使用卡片 API' }
    ];

    for (const { regex, msg } of domPatterns) {
      if (regex.test(line)) {
        // 跳过框架内部实现（Renderer/AutoFixer/VirtualScroller 等必须操作 DOM）
        if (isFrameworkInternal(filePath)) continue;

        violations.push({
          rule: 'R3',
          severity: 'error',
          file: filePath,
          line: lineNum,
          message: msg,
          suggestion: '改用 frame.createCard() / frame.updateCard() / frame.removeCard() 等 Store API',
          snippet: trimmed
        });
      }
    }

    // R4: 绕过 Store 私有字段
    const storeBypassPatterns = [
      { regex: /\.store\._cards/, msg: '直接访问 Store 私有字段 _cards' },
      { regex: /\.store\._relationships/, msg: '直接访问 Store 私有字段 _relationships' },
      { regex: /\.store\._listeners/, msg: '直接访问 Store 私有字段 _listeners' },
      { regex: /\.store\._pool/, msg: '直接访问 Store 私有字段 _pool' }
    ];

    for (const { regex, msg } of storeBypassPatterns) {
      if (regex.test(line)) {
        // 跳过框架内部实现
        if (isFrameworkInternal(filePath)) continue;

        violations.push({
          rule: 'R4',
          severity: 'error',
          file: filePath,
          line: lineNum,
          message: msg,
          suggestion: '改用 frame.getAllCards() / frame.createRelationship() 等 Store API',
          snippet: trimmed
        });
      }
    }
  });
}

// ─── 主流程 ───────────────────────────────────────────────

function main() {
  const scanDirs = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : DEFAULT_SCAN_DIRS;

  const files = [];
  for (const dir of scanDirs) {
    const fullDir = path.resolve(process.cwd(), dir);
    walkDir(fullDir, files);
  }

  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(process.cwd(), filePath);

    if (filePath.endsWith('.html')) {
      checkHTML(relPath, content, violations);
    } else if (filePath.endsWith('.js')) {
      checkJS(relPath, content, violations);
    }
  }

  // 输出报告
  if (violations.length === 0) {
    console.log('✅ Guardrail 检查通过：未发现逃逸用法');
    process.exit(0);
  }

  console.log(`❌ Guardrail 检查失败：发现 ${violations.length} 项违规\n`);

  const byRule = { R1: 0, R2: 0, R3: 0, R4: 0 };
  for (const v of violations) byRule[v.rule]++;

  console.log('统计：');
  console.log(`  R1 (非卡片元素):     ${byRule.R1}`);
  console.log(`  R2 (逃逸 CSS 框架):  ${byRule.R2}`);
  console.log(`  R3 (直接 DOM 操作):  ${byRule.R3}`);
  console.log(`  R4 (绕过 Store):     ${byRule.R4}`);
  console.log('');

  for (const v of violations) {
    const icon = v.severity === 'error' ? '🔴' : v.severity === 'warn' ? '🟠' : '🔵';
    console.log(`${icon} [${v.rule}] ${v.file}:${v.line}`);
    console.log(`   ${v.message}`);
    if (v.snippet) console.log(`   代码: ${v.snippet}`);
    console.log(`   建议: ${v.suggestion}`);
    console.log('');
  }

  // error 级别违规导致退出码 1
  const hasError = violations.some(v => v.severity === 'error');
  process.exit(hasError ? 1 : 0);
}

main();
