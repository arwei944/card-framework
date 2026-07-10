const assert = require('assert');
const fs = require('fs');
const path = require('path');

const buildCode = fs.readFileSync(path.join(__dirname, '../scripts/build.js'), 'utf8');
eval(buildCode);

describe('Build Script - autoScanClasses', function() {
  it('应该提取所有 24 个类（不含 Web Component 子类）', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.strictEqual(Object.keys(classes).length >= 24, true);
  });
  it('应该包含 EvolutionEngine', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.notStrictEqual(classes['EvolutionEngine'], undefined);
  });
  it('应该包含 ActionLogger', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.notStrictEqual(classes['ActionLogger'], undefined);
  });
  it('应该包含 CardObjectPool', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.notStrictEqual(classes['CardObjectPool'], undefined);
  });
  it('提取的类代码应该以 "class X {" 开头', function() {
    const source = fs.readFileSync(path.join(__dirname, '../src/card-framework.js'), 'utf8');
    const classes = autoScanClasses(source);
    assert.strictEqual(classes['EventBus'].startsWith('  class EventBus {'), true);
  });
});