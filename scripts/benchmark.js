#!/usr/bin/env node
/* global document, setTimeout */
/**
 * CardFrame 性能基准测试
 *
 * 运行方式：node scripts/benchmark.js
 *
 * 输出量化指标：
 *   - 首屏渲染（卡片数 → 耗时）
 *   - 单卡片创建 / 更新 / 删除吞吐
 *   - 批量创建吞吐
 *   - getCard / getAllCards / queryCards 查询吞吐
 *   - 关系创建 / 查询吞吐
 *   - 对象池命中率
 *   - 布局缓存命中率
 *
 * 注：使用 jsdom 真实 DOM 环境（与单元测试一致），结果可与 CI 对齐。
 */

const { JSDOM } = require('jsdom');
const path = require('path');

// ---------- 环境 ----------
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/'
});
global.window = dom.window;
global.document = dom.window.document;
global.customElements = dom.window.customElements;
global.HTMLElement = dom.window.HTMLElement;
global.MutationObserver = dom.window.MutationObserver;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.WebSocket = function() { this.readyState = 0; this.close = () => {}; this.send = () => {}; };
global.localStorage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();
global.XMLHttpRequest = function() {
  this.open = () => {};
  this.setRequestHeader = () => {};
  this.send = () => {};
};

const { CardFrame } = require(path.resolve(__dirname, '../dist/card-framework.cjs.js'));

// ---------- 工具 ----------
function bench(label, fn, iterations = 1) {
  // warmup
  try { fn(); } catch (e) { /* warmup 失败忽略 */ }
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1e6;
  const avgMs = totalMs / iterations;
  return { label, totalMs, avgMs, iterations };
}

function fmt(n) {
  if (n < 1) return n.toFixed(3);
  if (n < 100) return n.toFixed(2);
  return Math.round(n).toString();
}

const results = [];
function record(b) { results.push(b); }
function print() {
  console.log('\n' + '='.repeat(70));
  console.log('CardFrame 性能基准测试');
  console.log('='.repeat(70));
  console.log('环境: Node ' + process.version + ', jsdom\n');
  console.log(
    '基准'.padEnd(42) +
    '总耗时(ms)'.padStart(12) +
    '平均(ms)'.padStart(12) +
    '次数'.padStart(8)
  );
  console.log('-'.repeat(70));
  for (const r of results) {
    console.log(
      r.label.padEnd(42) +
      fmt(r.totalMs).padStart(12) +
      fmt(r.avgMs).padStart(12) +
      String(r.iterations).padStart(8)
    );
  }
  console.log('='.repeat(70));
}

// ---------- 场景 ----------
function makeFrame() {
  document.body.innerHTML = '<div id="root"></div>';
  return new CardFrame('#root', { autoValidate: false, virtualScroll: false });
}

function makeProps(i) {
  return { title: 'Card #' + i, content: '内容 ' + i, tags: ['t' + (i % 5)] };
}

// 1. 首屏渲染（100 / 500 / 1000 张卡片）
[100, 500, 1000].forEach((n) => {
  const b = bench('首屏渲染 ' + n + ' 张卡片', () => {
    const frame = makeFrame();
    for (let i = 0; i < n; i++) frame.createCard('text', makeProps(i));
  });
  record(b);
});

// 2. 单卡片操作吞吐
{
  const frame = makeFrame();
  const card = frame.createCard('text', makeProps(0));
  record(bench('单卡片 createCard', () => frame.createCard('text', makeProps(0)), 1000));
  record(bench('单卡片 updateCard', () => frame.updateCard({ ...card, props: { title: 'updated' } }), 1000));
  record(bench('单卡片 getCard', () => frame.getCard(card.id), 10000));
}

// 3. 批量创建
{
  const frame = makeFrame();
  const batch = Array.from({ length: 100 }, (_, i) => ({ type: 'text', props: makeProps(i) }));
  record(bench('batchCreateCards 100 张', () => {
    // 用一个新 frame 避免无限增长
    const f = makeFrame();
    f.batchCreateCards(batch);
  }, 10));
}

// 4. 查询吞吐
{
  const frame = makeFrame();
  for (let i = 0; i < 1000; i++) frame.createCard('text', makeProps(i));
  const firstId = frame.getAllCards()[0].id;
  record(bench('getCard(id) 1000 张数据集', () => frame.getCard(firstId), 10000));
  record(bench('getAllCards() 1000 张', () => frame.getAllCards(), 1000));
  record(bench('getCardsByType 1000 张', () => frame.getCardsByType('text'), 1000));
  record(bench('queryCards 1000 张', () => frame.store.queryCards({ tags: 't1' }), 1000));
}

// 5. 关系操作
{
  const frame = makeFrame();
  const cards = [];
  for (let i = 0; i < 100; i++) cards.push(frame.createCard('text', makeProps(i)));
  record(bench('createRelationship 100 对', () => {
    const f = makeFrame();
    const cs = [];
    for (let i = 0; i < 100; i++) cs.push(f.createCard('text', makeProps(i)));
    for (let i = 0; i < 99; i++) f.createRelationship(cs[i].id, cs[i + 1].id, 'reference');
  }, 10));
  const relId = frame.createRelationship(cards[0].id, cards[1].id, 'reference').id;
  record(bench('getRelationship(id)', () => frame.getRelationship(relId), 10000));
  record(bench('getRelationshipsByCard', () => frame.getRelationshipsByCard(cards[0].id), 10000));
}

// 6. 导入导出
{
  const frame = makeFrame();
  for (let i = 0; i < 1000; i++) frame.createCard('text', makeProps(i));
  record(bench('exportData 1000 张', () => frame.exportData(), 100));
  const data = frame.exportData();
  record(bench('importData 1000 张', () => {
    const f = makeFrame();
    f.importData(data, { mode: 'replace' });
  }, 10));
}

// 7. 对象池 & 布局缓存命中率
{
  const frame = makeFrame();
  for (let i = 0; i < 100; i++) frame.createCard('text', makeProps(i));
  const poolStats = frame.cardObjectPool.getStats();
  console.log('\n对象池统计:', JSON.stringify(poolStats));
  const cacheStats = frame.layoutEngine.getLayoutCache().getStats();
  console.log('布局缓存统计:', JSON.stringify(cacheStats));
}

// 8. 撤销/重做
{
  const frame = makeFrame();
  for (let i = 0; i < 100; i++) frame.createCard('text', makeProps(i));
  record(bench('undo 100 步', () => {
    for (let i = 0; i < 100; i++) frame.undo();
  }, 1));
  record(bench('redo 100 步', () => {
    for (let i = 0; i < 100; i++) frame.redo();
  }, 1));
}

print();
console.log('\n基准测试完成。');
